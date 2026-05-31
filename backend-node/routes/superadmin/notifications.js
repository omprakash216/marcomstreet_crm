const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

// Templates (reusing notification_templates table)
router.get('/templates', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM notification_templates ORDER BY code ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/templates', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { id, code, channel = 'email', subject = null, body = '' } = req.body || {};
    if (!code) return res.status(400).json({ success: false, message: 'code required' });
    if (id) {
      await query('UPDATE notification_templates SET code=?, channel=?, subject=?, body=? WHERE id=?', [
        code,
        channel,
        subject,
        body,
        id,
      ]);
      return res.json({ success: true, message: 'Template updated' });
    }
    const result = await query(
      'INSERT INTO notification_templates (code, channel, subject, body) VALUES (?,?,?,?)',
      [code, channel, subject, body]
    );
    res.json({ success: true, message: 'Template created', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Template code already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// Logs (reusing notifications table)
router.get('/logs', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 500');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

