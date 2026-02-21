const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

function requireManager(req, res, next) {
  const role = (req.employee.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'manager') {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

router.get('/targets', verifyToken, requireManager, async (req, res) => {
  try {
    const periodMonth = new Date().getMonth() + 1;
    const periodYear = new Date().getFullYear();
    const rows = await query(
      `SELECT e.id, e.name, e.role, d.name as department, COALESCE(t.target_value, 0) as current_target, COALESCE(t.metric_type, 'leads') as metric_type
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN employee_targets t ON e.id = t.user_id AND t.period_month = ? AND t.period_year = ?
       WHERE e.role != 'admin' ORDER BY e.name ASC`,
      [periodMonth, periodYear]
    );
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/targets', verifyToken, requireManager, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.user_id && b.user_id !== 0) return res.status(400).json({ success: false, message: 'user_id and target_value required' });
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
