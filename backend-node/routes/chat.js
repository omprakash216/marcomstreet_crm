const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const action = req.query.action || 'messages';
    const employeeId = req.employee.id;

    if (action === 'users') {
      const users = await query(
        `SELECT e.id, e.name, e.email, e.role, d.name as department
         FROM employees e 
         LEFT JOIN departments d ON e.department_id = d.id 
         WHERE e.id != ? AND e.status = 'active'
         ORDER BY e.name ASC`,
        [employeeId]
      );
      return res.json({ success: true, data: users });
    }

    if (action === 'unread_count') {
      const rows = await query(
        'SELECT COUNT(*) as count FROM chat_messages WHERE to_employee_id = ? AND is_read = 0',
        [employeeId]
      );
      return res.json({ success: true, count: Number(rows[0]?.count || 0) });
    }

    if (action === 'notifications') {
      const notifications = await query(
        `SELECT cm.*, e.name as from_name 
         FROM chat_messages cm
         JOIN employees e ON e.id = cm.from_employee_id
         WHERE cm.to_employee_id = ? AND cm.is_read = 0
         ORDER BY cm.created_at DESC LIMIT 10`,
        [employeeId]
      );
      return res.json({ success: true, data: notifications });
    }

    const targetUserId = req.query.user_id;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required' });
    }

    const messages = await query(
      `SELECT * FROM chat_messages 
       WHERE (from_employee_id = ? AND to_employee_id = ?) OR (from_employee_id = ? AND to_employee_id = ?) 
       ORDER BY created_at ASC`,
      [employeeId, targetUserId, targetUserId, employeeId]
    );

    await query(
      'UPDATE chat_messages SET is_read = 1 WHERE from_employee_id = ? AND to_employee_id = ?',
      [targetUserId, employeeId]
    );

    return res.json({ success: true, data: messages });
  } catch (err) {
    console.error('Chat GET:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { to_employee_id, message } = req.body || {};
    if (!to_employee_id || !message) {
      return res.status(400).json({ success: false, message: 'to_employee_id and message required' });
    }
    await query(
      'INSERT INTO chat_messages (from_employee_id, to_employee_id, message, is_read) VALUES (?, ?, ?, 0)',
      [req.employee.id, to_employee_id, message]
    );
    return res.json({ success: true, message: 'Message sent' });
  } catch (err) {
    console.error('Chat POST:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
