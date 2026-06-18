const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { normalizeCodePart } = require('../utils/employeeCode');
const { ensureEmployeeCodeSchema } = require('../utils/employeeCodeSchema');

const router = express.Router();

router.use(async (_req, _res, next) => {
  try {
    await ensureEmployeeCodeSchema();
    next();
  } catch (err) {
    next(err);
  }
});

function isPrivileged(employee) {
  const role = String(employee?.role || '').toLowerCase().trim();
  return role === 'admin' || role === 'human_resources' || role === 'superadmin' || role === 'super_admin';
}

function requireCompany(employee) {
  const cid = employee?.company_id;
  const n = Number(cid);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function deriveDepartmentCode(name) {
  const rawName = String(name || '').trim();
  if (!rawName) return '';

  const bracketMatch = rawName.match(/\(([^)]+)\)/);
  if (bracketMatch) {
    const bracketCode = normalizeCodePart(bracketMatch[1]);
    if (bracketCode) return bracketCode.slice(0, 20);
  }

  const parts = rawName.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length > 1) {
    const initials = normalizeCodePart(parts.map((part) => part[0]).join(''));
    if (initials) return initials.slice(0, 20);
  }

  return normalizeCodePart(rawName).slice(0, 20);
}

function resolveDepartmentCode(value, fallbackName) {
  const explicit = normalizeCodePart(value);
  if (explicit) return explicit.slice(0, 20);
  return deriveDepartmentCode(fallbackName);
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const isSuper = ['superadmin', 'super_admin'].includes(String(req.employee?.role || '').toLowerCase().trim());
    const companyId = requireCompany(req.employee);

    // In normal tenant context, restrict departments to the employee's company.
    // Super admin can see all departments (kept for compatibility).
    let sql =
      'SELECT d.*, (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id' +
      (isSuper ? '' : ' AND e.company_id = d.company_id') +
      ') as employee_count FROM departments d';
    const params = [];
    if (!isSuper) {
      if (!companyId) return res.status(400).json({ success: false, message: 'Missing company context' });
      sql += ' WHERE d.company_id = ?';
      params.push(companyId);
    }
    sql += ' ORDER BY d.name ASC';
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    if (!isPrivileged(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
    const companyId = requireCompany(req.employee);
    if (!companyId) return res.status(400).json({ success: false, message: 'Missing company context' });
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const departmentCode = resolveDepartmentCode(b.department_code, name);
    if (!departmentCode) return res.status(400).json({ success: false, message: 'Department code is required' });
    const conn = await getConnection();
    const [r] = await conn.execute(
      'INSERT INTO departments (company_id, name, department_code, description) VALUES (?, ?, ?, ?)',
      [companyId, name, departmentCode, b.description || '']
    );
    conn.release();
    return res.json({ success: true, message: 'Department created successfully', data: { id: r.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Update department
router.put('/:id', verifyToken, async (req, res) => {
  try {
    if (!isPrivileged(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
    const companyId = requireCompany(req.employee);
    if (!companyId) return res.status(400).json({ success: false, message: 'Missing company context' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid department id' });
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const existingRows = await query('SELECT department_code, name FROM departments WHERE id = ? AND company_id = ? LIMIT 1', [id, companyId]);
    const existing = existingRows && existingRows[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    const departmentCode = resolveDepartmentCode(b.department_code, name || existing.name);
    if (!departmentCode) return res.status(400).json({ success: false, message: 'Department code is required' });
    const result = await query('UPDATE departments SET name = ?, department_code = ?, description = ? WHERE id = ? AND company_id = ?', [
      name,
      departmentCode,
      b.description || '',
      id,
      companyId,
    ]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    return res.json({ success: true, message: 'Department updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Delete department
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (!isPrivileged(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
    const companyId = requireCompany(req.employee);
    if (!companyId) return res.status(400).json({ success: false, message: 'Missing company context' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid department id' });

    // Optional: prevent delete if employees are linked
    const [empCountRows] = await query('SELECT COUNT(*) as c FROM employees WHERE department_id = ? AND company_id = ?', [id, companyId]);
    if (empCountRows && empCountRows.c > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete department with employees assigned' });
    }

    const result = await query('DELETE FROM departments WHERE id = ? AND company_id = ?', [id, companyId]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    return res.json({ success: true, message: 'Department deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
