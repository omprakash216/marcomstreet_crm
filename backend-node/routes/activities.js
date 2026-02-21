const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLog');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const activityType = req.query.activity_type || null;
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;
    let sql = 'SELECT * FROM activity_logs WHERE employee_id = ?';
    const params = [req.employee.id];
    if (activityType) { sql += ' AND activity_type = ?'; params.push(activityType); }
    if (dateFrom) { sql += ' AND DATE(created_at) >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND DATE(created_at) <= ?'; params.push(dateTo); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/create', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const activityType = b.activity_type || 'general';
    const entityType = b.entity_type || 'lead';
    const entityId = b.entity_id || null;
    let description = b.description || '';
    if (b.notes) description += '\nNotes: ' + b.notes;
    if (b.outcome) description += '\nOutcome: ' + b.outcome;
    await logActivity(req.employee.id, activityType, entityType, entityId, description, req);
    return res.json({ success: true, message: 'Activity logged successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
