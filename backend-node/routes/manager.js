const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { isSuperRole } = require('../middleware/hideSuperAdminData');

const router = express.Router();

function requireManager(req, res, next) {
  const role = String(req.employee.role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  if (role !== 'admin' && role !== 'manager' && role !== 'superadmin' && role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

router.get('/targets', verifyToken, requireManager, async (req, res) => {
  try {
    const periodMonth = new Date().getMonth() + 1;
    const periodYear = new Date().getFullYear();
    const isSuper = isSuperRole(req.employee.role);
    let rows = [];
    try {
      let sql = `SELECT e.id, e.name, e.role, d.name as department, COALESCE(t.target_value, 0) as current_target, COALESCE(t.metric_type, 'leads') as metric_type
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         LEFT JOIN employee_targets t ON e.id = t.user_id AND t.period_month = ? AND t.period_year = ?
         WHERE e.role != 'admin'
           AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(e.role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')`;
      const params = [periodMonth, periodYear];
      if (!isSuper) {
        sql += ' AND e.company_id = ?';
        params.push(req.employee.company_id);
      }
      sql += ' ORDER BY e.name ASC';
      rows = await query(sql, params);
    } catch (qErr) {
      const msg = String(qErr?.message || '');
      if (!/unknown column|doesn't exist|no such table/i.test(msg)) throw qErr;
      if (isSuper) {
        rows = await query(
          `SELECT id, name, 'employee' as role, 'General' as department, 0 as current_target, 'leads' as metric_type
           FROM employees ORDER BY name ASC`
        ).catch(() => []);
      } else if (req.employee.company_id) {
        rows = await query(
          `SELECT id, name, 'employee' as role, 'General' as department, 0 as current_target, 'leads' as metric_type
           FROM employees WHERE company_id = ? ORDER BY name ASC`,
          [req.employee.company_id]
        ).catch(() => []);
      }
    }
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/targets', verifyToken, requireManager, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.user_id && b.user_id !== 0) return res.status(400).json({ success: false, message: 'user_id and target_value required' });
    const isSuper = isSuperRole(req.employee.role);
    const eligibilityParams = [b.user_id];
    let eligibilitySql = `SELECT id FROM employees
      WHERE id = ?
        AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')
        AND (status IS NULL OR LOWER(TRIM(COALESCE(status,''))) <> 'inactive')`;
    if (!isSuper) {
      eligibilitySql += ' AND company_id = ?';
      eligibilityParams.push(req.employee.company_id);
    }
    eligibilitySql += ' LIMIT 1';
    let eligibleRows = [];
    try {
      eligibleRows = await query(eligibilitySql, eligibilityParams);
    } catch (qErr) {
      const msg = String(qErr?.message || '');
      if (!/unknown column|doesn't exist|no such table/i.test(msg)) throw qErr;
      // Older schema fallback: keep strict company/id check when possible.
      if (!isSuper && req.employee.company_id) {
        eligibleRows = await query('SELECT id FROM employees WHERE id = ? AND company_id = ? LIMIT 1', [b.user_id, req.employee.company_id]).catch(() => []);
      } else {
        eligibleRows = await query('SELECT id FROM employees WHERE id = ? LIMIT 1', [b.user_id]).catch(() => []);
      }
    }
    if (!Array.isArray(eligibleRows) || !eligibleRows[0]) {
      return res.status(403).json({ success: false, message: 'You cannot assign target to this user' });
    }
    const metricType = b.metric_type || 'leads';
    const periodMonth = b.period_month || new Date().getMonth() + 1;
    const periodYear = b.period_year || new Date().getFullYear();
    const existing = await query('SELECT id FROM employee_targets WHERE user_id = ? AND period_month = ? AND period_year = ?', [b.user_id, periodMonth, periodYear]);
    if (existing && existing[0]) {
      await query('UPDATE employee_targets SET target_value=?, metric_type=?, assigned_by=? WHERE id=?', [b.target_value, metricType, req.employee.id, existing[0].id]);
    } else {
      await query(
        'INSERT INTO employee_targets (user_id, metric_type, target_value, period_month, period_year, assigned_by) VALUES (?,?,?,?,?,?)',
        [b.user_id, metricType, b.target_value, periodMonth, periodYear, req.employee.id]
      );
    }
    return res.json({ success: true, message: 'Target saved successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
