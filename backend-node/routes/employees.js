const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    let rows = [];
    try {
      rows = await query(
        'SELECT e.id, e.employee_code, e.name, e.email, e.phone, e.role, e.department_id, e.designation, e.status, d.name as department_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.status = ? ORDER BY e.name',
        ['active']
      );
    } catch (qErr) {
      const msg = (qErr && qErr.message) ? String(qErr.message) : '';
      if (!(msg.includes("doesn't exist") || msg.includes('Unknown column'))) throw qErr;
      // Fallback for older schema
      rows = await query(
        `SELECT id, NULL as employee_code, name, email, NULL as phone,
                'employee' as role, NULL as department_id, NULL as designation,
                'active' as status, 'General' as department_name
         FROM employees
         ORDER BY name`
      );
    }
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
