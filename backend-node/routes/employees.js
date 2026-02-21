const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await query(
      'SELECT e.id, e.employee_code, e.name, e.email, e.phone, e.role, e.department_id, e.designation, e.status, d.name as department_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.status = ? ORDER BY e.name',
      ['active']
    );
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
