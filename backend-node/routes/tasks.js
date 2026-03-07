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

async function getDepartmentEmployees(departmentId) {
  if (!departmentId) return [];
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
     WHERE e.status = 'active' AND e.department_id = ? AND e.role != 'admin'
     ORDER BY e.name ASC`,
    [departmentId]
  );
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await query(
      `SELECT t.id, t.employee_id, t.lead_id, t.title, t.description, t.task_type, t.priority, t.due_date, t.status, t.completed_at, t.created_at, l.company_name
       FROM tasks t LEFT JOIN leads l ON t.lead_id = l.id
       WHERE t.employee_id = ? ORDER BY t.due_date ASC, t.created_at DESC`,
      [req.employee.id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    await query(
      'INSERT INTO tasks (employee_id, lead_id, title, description, task_type, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      // task_type enum differs across deployments; "other" is safe default.
      [req.employee.id, b.lead_id || null, b.title, b.description || '', b.task_type || 'other', b.priority || 'medium', b.due_date || null, b.status || 'pending']
    );
    return res.json({ success: true, message: 'Task created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /tasks/assignees - manager can assign tasks to employees in their department only
router.get('/assignees', verifyToken, async (req, res) => {
  try {
    const emp = req.employee;
    if (!isAdmin(emp) && !isManager(emp)) {
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
         WHERE e.status = 'active' AND e.role != 'admin'
         ORDER BY e.name ASC`
      ).catch(() => []);
      return res.json({ success: true, data: rows || [] });
    }

    const deptId = emp.department_id;
    if (!deptId) return res.json({ success: true, data: [] });
    const rows = await getDepartmentEmployees(deptId);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load assignees' });
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
      'SELECT id, department_id, status FROM employees WHERE id = ?',
      [employeeId]
    );
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

    await query(
      'INSERT INTO tasks (employee_id, lead_id, title, description, task_type, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, b.lead_id || null, b.title, b.description || '', b.task_type || 'other', b.priority || 'medium', b.due_date || null, b.status || 'pending']
    );

    await logActivity(emp.id, 'task_assigned', 'task', null, `Task assigned to employee_id=${employeeId}`, req);
    return res.json({ success: true, message: 'Task assigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to assign task' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    await query(
      'UPDATE tasks SET title=?, description=?, priority=?, due_date=?, status=?, updated_at=NOW() WHERE id=? AND employee_id=?',
      [b.title, b.description, b.priority, b.due_date, b.status, req.params.id, req.employee.id]
    );
    return res.json({ success: true, message: 'Task updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/update_status', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const taskId = b.task_id || b.id;
    const status = b.status;
    if (!taskId || !status) return res.status(400).json({ success: false, message: 'Task ID and status are required' });
    const rows = await query('SELECT * FROM tasks WHERE id = ? AND employee_id = ?', [taskId, req.employee.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Task not found' });
    const completedAt = status === 'completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    await query('UPDATE tasks SET status = ?, completed_at = ?, updated_at = NOW() WHERE id = ? AND employee_id = ?', [status, completedAt, taskId, req.employee.id]);
    await logActivity(req.employee.id, 'task_updated', 'task', taskId, 'Task status updated to ' + status, req);
    return res.json({ success: true, message: 'Task updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/update_status', verifyToken, upload.single('work_file'), async (req, res) => {
  try {
    const taskId = (req.body && req.body.task_id) || (req.body && req.body.id);
    const status = req.body && req.body.status;
    if (!taskId || !status) return res.status(400).json({ success: false, message: 'Task ID and status are required' });
    const rows = await query('SELECT * FROM tasks WHERE id = ? AND employee_id = ?', [taskId, req.employee.id]);
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
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
