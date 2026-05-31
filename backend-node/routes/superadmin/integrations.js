const express = require('express');
const crypto = require('crypto');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

function makeKey() {
  return crypto.randomBytes(24).toString('hex');
}

// ===== API Keys =====
router.get('/api-keys', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const rows = await query(`
      SELECT ak.*, c.company_name
      FROM api_keys ak
      LEFT JOIN companies c ON c.id = ak.company_id
      ORDER BY ak.created_at DESC
      LIMIT 500
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/api-keys', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { company_id = null, user_id = null } = req.body || {};
    const apiKey = makeKey();
    const result = await query(
      'INSERT INTO api_keys (company_id, user_id, api_key, status) VALUES (?,?,?,?)',
      [company_id, user_id, apiKey, 'active']
    );
    res.json({ success: true, message: 'API key created', id: result.insertId, api_key: apiKey });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/api-keys/:id/revoke', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await query("UPDATE api_keys SET status='revoked' WHERE id=?", [req.params.id]);
    res.json({ success: true, message: 'API key revoked' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== Webhooks =====
router.get('/webhooks', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const rows = await query(`
      SELECT w.*, c.company_name
      FROM webhooks w
      LEFT JOIN companies c ON c.id = w.company_id
      ORDER BY w.created_at DESC
      LIMIT 500
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/webhooks', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { company_id = null, event, target_url, secret = null, status = 'active' } = req.body || {};
    if (!event || !target_url) return res.status(400).json({ success: false, message: 'event and target_url required' });
    const result = await query(
      'INSERT INTO webhooks (company_id, event, target_url, secret, status) VALUES (?,?,?,?,?)',
      [company_id, event, target_url, secret, status]
    );
    res.json({ success: true, message: 'Webhook created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/webhooks/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { company_id = null, event, target_url, secret = null, status = 'active' } = req.body || {};
    await query(
      'UPDATE webhooks SET company_id=?, event=?, target_url=?, secret=?, status=? WHERE id=?',
      [company_id, event, target_url, secret, status, req.params.id]
    );
    res.json({ success: true, message: 'Webhook updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/webhooks/:id/status', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (status !== 'active' && status !== 'disabled') return res.status(400).json({ success: false, message: 'Invalid status' });
    await query('UPDATE webhooks SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true, message: 'Webhook status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/webhooks/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await query('DELETE FROM webhooks WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

