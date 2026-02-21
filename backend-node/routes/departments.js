const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await query(
      'SELECT d.*, (SELECT COUNT(*) FROM employees WHERE department_id = d.id) as employee_count FROM departments d ORDER BY name ASC'
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const role = (req.employee.role || '').toLowerCase();
    if (role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ success: false, message: 'Name is required' });
    const conn = await getConnection();
    const [r] = await conn.execute('INSERT INTO departments (name, description) VALUES (?, ?)', [b.name, b.description || '']);
    conn.release();
    return res.json({ success: true, message: 'Department created successfully', data: { id: r.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
