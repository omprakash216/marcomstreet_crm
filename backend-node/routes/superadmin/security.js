const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

router.get('/login-sessions', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const rows = await query(`
      SELECT ls.*, e.name as user_name, e.email as user_email, c.company_name
      FROM login_sessions ls
      LEFT JOIN employees e ON e.id = ls.user_id
      LEFT JOIN companies c ON c.id = ls.company_id
      ORDER BY ls.created_at DESC
      LIMIT 500
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/login-sessions/:id/end', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await query("UPDATE login_sessions SET status='ended', ended_at=NOW() WHERE id=?", [req.params.id]);
    res.json({ success: true, message: 'Session ended' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

