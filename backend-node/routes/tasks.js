const express = require('express');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const { logActivity } = require('../middleware/activityLog');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads/task_work');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '_' + (file.originalname || 'file')),
});
const upload = multer({ storage });

function roleOf(emp) {
  return String(emp?.role || '').toLowerCase().trim();
}
function isAdmin(emp) {
  return roleOf(emp) === 'admin';
}
function isManager(emp) {
  return roleOf(emp) === 'manager';
}

function safeParams(params) {
  if (!Array.isArray(params)) return [];
  // mysql2 prepared statements can break with `undefined` params (can surface as
  // "Incorrect arguments to mysqld_stmt_execute"). Use explicit nulls instead.
  return params.map((p) => (p === undefined ? null : p));
}

async function ensureTasksTable() {
  // Minimal, schema-tolerant table (avoids FKs so it can run on older DBs too).
  // If your DB already has a richer `tasks` schema, this is a no-op.
  await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      employee_id INT NOT NULL,
      lead_id INT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      task_type VARCHAR(50) NULL,
      priority VARCHAR(20) NULL,
      due_date DATETIME NULL,
      status VARCHAR(20) NULL,
      completed_at DATETIME NULL,
      work_file_path VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_employee_id (employee_id),
      INDEX idx_due_date (due_date),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getDepartmentEmployees(departmentId, companyId) {
  if (!departmentId || !companyId) return [];
  return query(
    `SELECT e.id,
            e.employee_code,
            e.name,
            e.email,
            e.phone,
            e.role,
            e.department_id,
            e.designation,
            d.name AS department_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.status = 'active' AND e.department_id = ? AND e.company_id = ? AND e.role != 'admin'
     ORDER BY e.name ASC`,
    [departmentId, companyId]
  );
}

// GET /tasks/assignees - manager can assign tasks to employees in their department only
router.get('/assignees', verifyToken, async (req, res) => {
  console.log('DEBUG: Hit /api/tasks/assignees');
  try {
    const emp = req.employee;
    if (!isAdmin(emp) && !isManager(emp)) {
      console.log('DEBUG: Unauthorized access to assignees');
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (isAdmin(emp)) {
      const rows = await query(
        `SELECT e.id,
                e.employee_code,
                e.name,
                e.email,
                e.phone,
                e.role,
                e.department_id,
                e.designation,
                d.name AS department_name
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.status = 'active' AND e.role != 'admin' AND e.company_id = ?
         ORDER BY e.name ASC`, [req.employee.company_id]
      ).catch((err) => {
        console.error('DEBUG: Query error in assignees:', err);
        return [];
      });
      return res.json({ success: true, data: rows || [] });
    }

    const deptId = emp.department_id;
    if (!deptId) {
      console.log('DEBUG: Manager has no department_id');
      return res.json({ success: true, data: [] });
    }
    const rows = await getDepartmentEmployees(deptId, emp.company_id);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error('DEBUG: Catch error in assignees:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to load assignees' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const employeeId = req.employee?.id;
    const companyId = req.employee?.company_id;
    if (!employeeId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const companyIdNum = Number(companyId);
    const hasCompanyContext = Number.isFinite(companyIdNum) && companyIdNum > 0;

    // Prefer current schema: tasks has company_id and leads has company_name
    const attempts = [
      {
        name: 'tasks_company_id_with_leads',
        sql: `SELECT t.id, t.employee_id, t.lead_id, t.title, t.description, t.task_type, t.priority, t.due_date, t.status, t.completed_at, t.created_at, l.company_name
              FROM tasks t
              LEFT JOIN leads l ON t.lead_id = l.id
              WHERE t.employee_id = ? AND t.company_id = ?
              ORDER BY t.due_date ASC, t.created_at DESC`,
        params: [employeeId, companyId],
      },
      // Backward-compatible schema: tasks might not have company_id, so enforce via employees join.
      {
        name: 'tasks_join_employees_with_leads',
        sql: `SELECT t.id, t.employee_id, t.lead_id, t.title, t.description, t.task_type, t.priority, t.due_date, t.status, t.completed_at, t.created_at, l.company_name
              FROM tasks t
              LEFT JOIN leads l ON t.lead_id = l.id
              JOIN employees e ON e.id = t.employee_id
              WHERE t.employee_id = ? AND e.company_id = ?
              ORDER BY t.due_date ASC, t.created_at DESC`,
        params: [employeeId, companyId],
      },
      // Ultra fallback: leads table might not have company_name column.
      {
        name: 'tasks_company_id_no_leads_company_name',
        sql: `SELECT t.id, t.employee_id, t.lead_id, t.title, t.description, t.task_type, t.priority, t.due_date, t.status, t.completed_at, t.created_at
              FROM tasks t
              WHERE t.employee_id = ? AND t.company_id = ?
              ORDER BY t.due_date ASC, t.created_at DESC`,
        params: [employeeId, companyId],
      },
      {
        name: 'tasks_join_employees_no_leads_company_name',
        sql: `SELECT t.id, t.employee_id, t.lead_id, t.title, t.description, t.task_type, t.priority, t.due_date, t.status, t.completed_at, t.created_at
              FROM tasks t
              JOIN employees e ON e.id = t.employee_id
              WHERE t.employee_id = ? AND e.company_id = ?
              ORDER BY t.due_date ASC, t.created_at DESC`,
        params: [employeeId, companyId],
      },
      // Ultra fallback: older tasks schema may miss task_type/priority/due_date columns.
      {
        name: 'tasks_min_columns',
        sql: `SELECT t.id, t.employee_id, t.lead_id, t.title, t.description, t.status, t.completed_at, t.created_at
              FROM tasks t
              JOIN employees e ON e.id = t.employee_id
              WHERE t.employee_id = ? AND e.company_id = ?
              ORDER BY t.created_at DESC`,
        params: [employeeId, companyId],
      },
      // Ultimate fallback: fetch raw task rows without assuming any columns besides `employee_id`.
      // (Needed for older DBs where tasks columns differ a lot.)
      {
        name: 'tasks_star_join_employees',
        sql: `SELECT t.*
              FROM tasks t
              JOIN employees e ON e.id = t.employee_id
              WHERE t.employee_id = ? AND e.company_id = ?
              ORDER BY t.id DESC`,
        params: [employeeId, companyId],
      },
      // As a last resort, still show user their tasks (employee_id should be unique anyway).
      {
        name: 'tasks_star_no_company_guard',
        sql: `SELECT t.*
              FROM tasks t
              WHERE t.employee_id = ?
              ORDER BY t.id DESC`,
        params: [employeeId],
      },
    ];

    let lastErr = null;
    for (const attempt of attempts) {
      if (!hasCompanyContext && attempt.params.length > 1) continue;
      try {
        const rows = await query(attempt.sql, safeParams(attempt.params));
        return res.json({ success: true, data: rows || [] });
      } catch (e) {
        lastErr = e;
        // Try next attempt for schema mismatch issues only
        if (
          e &&
          (e.code === 'ER_BAD_FIELD_ERROR' ||
            e.code === 'ER_NO_SUCH_TABLE' ||
            e.code === 'ER_PARSE_ERROR' ||
            e.code === 'ER_WRONG_ARGUMENTS')
        ) {
          continue;
        }
        throw e;
      }
    }

    // If tasks table doesn't exist, auto-create and retry the simplest query.
    if (lastErr && lastErr.code === 'ER_NO_SUCH_TABLE' && /\\btasks\\b/i.test(String(lastErr.message || ''))) {
      try {
        await ensureTasksTable();
        const rows = await query(
          `SELECT t.* FROM tasks t WHERE t.employee_id = ? ORDER BY t.id DESC`,
          safeParams([employeeId])
        );
        return res.json({ success: true, data: rows || [] });
      } catch (e2) {
        lastErr = e2;
      }
    }

    throw lastErr || new Error('Failed to load tasks');
  } catch (err) {
    console.error('Tasks list error:', err);
    return res.status(500).json({ success: false, message: err.message, code: err.code || null });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};

    const insertAttempts = [
      {
        name: 'insert_with_company_id',
        sql: 'INSERT INTO tasks (company_id, employee_id, lead_id, title, description, task_type, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params: [req.employee?.company_id, req.employee?.id, b.lead_id || null, b.title, b.description || '', b.task_type || 'other', b.priority || 'medium', b.due_date || null, b.status || 'pending'],
      },
      {
        name: 'insert_no_company_id',
        sql: 'INSERT INTO tasks (employee_id, lead_id, title, description, task_type, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        params: [req.employee?.id, b.lead_id || null, b.title, b.description || '', b.task_type || 'other', b.priority || 'medium', b.due_date || null, b.status || 'pending'],
      },
      {
        name: 'insert_min_columns',
        sql: 'INSERT INTO tasks (employee_id, lead_id, title, description, due_date, status) VALUES (?, ?, ?, ?, ?, ?)',
        params: [req.employee?.id, b.lead_id || null, b.title, b.description || '', b.due_date || null, b.status || 'pending'],
      },
    ];

    let lastErr = null;
    for (const attempt of insertAttempts) {
      try {
        await query(attempt.sql, safeParams(attempt.params));
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (e && (e.code === 'ER_BAD_FIELD_ERROR' || e.code === 'ER_PARSE_ERROR')) continue;
        if (e && e.code === 'ER_NO_SUCH_TABLE' && /\\btasks\\b/i.test(String(e.message || ''))) {
          await ensureTasksTable();
          continue;
        }
        throw e;
      }
    }
    if (lastErr) throw lastErr;
    return res.json({ success: true, message: 'Task created' });
  } catch (err) {
    console.error('Task create error:', err);
    return res.status(500).json({ success: false, message: err.message, code: err.code || null });
  }
});

// POST /tasks/assign - manager assigns a task to an employee in same department (admin can assign to any)
router.post('/assign', verifyToken, async (req, res) => {
  try {
    const emp = req.employee;
    if (!isAdmin(emp) && !isManager(emp)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const b = req.body || {};
    const employeeId = Number(b.employee_id);
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
      return res.status(400).json({ success: false, message: 'employee_id is required' });
    }
    if (!b.title) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const targetRows = await query(
      'SELECT id, department_id, status, company_id FROM employees WHERE id = ? AND company_id = ?',
      [employeeId, req.employee.company_id]);
    const target = Array.isArray(targetRows) ? targetRows[0] : null;
    if (!target || target.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Employee not found or inactive' });
    }

    if (isManager(emp)) {
      const deptId = emp.department_id;
      if (!deptId) {
        return res.status(400).json({ success: false, message: 'Manager has no department assigned' });
      }
      if (Number(target.department_id) !== Number(deptId)) {
        return res.status(403).json({ success: false, message: 'You can only assign tasks within your department' });
      }
    }

    const assignAttempts = [
      {
        name: 'assign_insert_with_company_id',
        sql: 'INSERT INTO tasks (company_id, employee_id, lead_id, title, description, task_type, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params: [req.employee.company_id, employeeId, b.lead_id || null, b.title, b.description || '', b.task_type || 'other', b.priority || 'medium', b.due_date || null, b.status || 'pending'],
      },
      {
        name: 'assign_insert_no_company_id',
        sql: 'INSERT INTO tasks (employee_id, lead_id, title, description, task_type, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        params: [employeeId, b.lead_id || null, b.title, b.description || '', b.task_type || 'other', b.priority || 'medium', b.due_date || null, b.status || 'pending'],
      },
      {
        name: 'assign_insert_min_columns',
        sql: 'INSERT INTO tasks (employee_id, lead_id, title, description, due_date, status) VALUES (?, ?, ?, ?, ?, ?)',
        params: [employeeId, b.lead_id || null, b.title, b.description || '', b.due_date || null, b.status || 'pending'],
      },
    ];

    let lastErr = null;
    for (const attempt of assignAttempts) {
      try {
        await query(attempt.sql, attempt.params);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (e && (e.code === 'ER_BAD_FIELD_ERROR' || e.code === 'ER_PARSE_ERROR')) continue;
        if (e && e.code === 'ER_NO_SUCH_TABLE' && /\\btasks\\b/i.test(String(e.message || ''))) {
          await ensureTasksTable();
          continue;
        }
        throw e;
      }
    }
    if (lastErr) throw lastErr;

    await logActivity(emp.id, 'task_assigned', 'task', null, `Task assigned to employee_id=${employeeId}`, req);
    return res.json({ success: true, message: 'Task assigned' });
  } catch (err) {
    console.error('Task assign error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to assign task', code: err.code || null });
  }
});

router.put('/update_status', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const taskId = b.task_id || b.id;
    const status = b.status;
    if (!taskId || !status) return res.status(400).json({ success: false, message: 'Task ID and status are required' });
    const rows = await query('SELECT t.* FROM tasks t JOIN employees e ON t.employee_id = e.id WHERE t.id = ? AND t.employee_id = ? AND e.company_id = ?', [taskId, req.employee.id, req.employee.company_id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Task not found' });
    const completedAt = status === 'completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    await query('UPDATE tasks SET status = ?, completed_at = ?, updated_at = NOW() WHERE id = ? AND employee_id = ?', [status, completedAt, taskId, req.employee.id]);
    await logActivity(req.employee.id, 'task_updated', 'task', taskId, 'Task status updated to ' + status, req);
    return res.json({ success: true, message: 'Task updated successfully' });
  } catch (err) {
    console.error('Task status update error:', err);
    return res.status(500).json({ success: false, message: err.message, code: err.code || null });
  }
});

router.put('/:id(\\d+)', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const result = await query(
      'UPDATE tasks SET title=?, description=?, priority=?, due_date=?, status=?, updated_at=NOW() WHERE id=? AND employee_id=?',
      [b.title, b.description, b.priority, b.due_date, b.status, req.params.id, req.employee.id]
    );
    const affectedRows = Array.isArray(result) ? Number(result[0]?.affectedRows || 0) : Number(result?.affectedRows || 0);
    if (!affectedRows) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    return res.json({ success: true, message: 'Task updated' });
  } catch (err) {
    console.error('Task update error:', err);
    return res.status(500).json({ success: false, message: err.message, code: err.code || null });
  }
});

router.post('/update_status', verifyToken, upload.single('work_file'), async (req, res) => {
  try {
    const taskId = (req.body && req.body.task_id) || (req.body && req.body.id);
    const status = req.body && req.body.status;
    if (!taskId || !status) return res.status(400).json({ success: false, message: 'Task ID and status are required' });
    const rows = await query('SELECT t.* FROM tasks t JOIN employees e ON t.employee_id = e.id WHERE t.id = ? AND t.employee_id = ? AND e.company_id = ?', [taskId, req.employee.id, req.employee.company_id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Task not found' });
    let filePath = null;
    if (req.file) filePath = 'uploads/task_work/' + req.file.filename;
    const completedAt = status === 'completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    if (filePath) {
      await query('UPDATE tasks SET status = ?, completed_at = ?, work_file_path = ?, updated_at = NOW() WHERE id = ? AND employee_id = ?', [status, completedAt, filePath, taskId, req.employee.id]);
    } else {
      await query('UPDATE tasks SET status = ?, completed_at = ?, updated_at = NOW() WHERE id = ? AND employee_id = ?', [status, completedAt, taskId, req.employee.id]);
    }
    await logActivity(req.employee.id, 'task_updated', 'task', taskId, 'Task status updated to ' + status + (filePath ? ' with work file' : ''), req);
    return res.json({ success: true, message: 'Task updated successfully' });
  } catch (err) {
    console.error('Task status update (file) error:', err);
    return res.status(500).json({ success: false, message: err.message, code: err.code || null });
  }
});

module.exports = router;
