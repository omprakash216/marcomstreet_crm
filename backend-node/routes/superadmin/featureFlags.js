const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM feature_flags ORDER BY feature_name ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { feature_name, status = 'disabled', description = null } = req.body || {};
    if (!feature_name) return res.status(400).json({ success: false, message: 'feature_name required' });
    await query(
      'INSERT INTO feature_flags (feature_name, status, description) VALUES (?,?,?)',
      [feature_name, status, description]
    );
    res.json({ success: true, message: 'Feature created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Feature already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { feature_name, status, description } = req.body || {};
    await query(
      'UPDATE feature_flags SET feature_name=?, status=?, description=? WHERE id=?',
      [feature_name, status, description, req.params.id]
    );
    res.json({ success: true, message: 'Feature updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/toggle', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (status !== 'enabled' && status !== 'disabled') {
      return res.status(400).json({ success: false, message: 'status must be enabled or disabled' });
    }
    await query('UPDATE feature_flags SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true, message: 'Feature toggled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

