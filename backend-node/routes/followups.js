const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLog');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const leadId = req.query.lead_id || null;
    const status = req.query.status || null;
    const employeeId = req.employee?.id;
    // DB column is scheduled_date (not followup_date); alias for frontend
    let sql = `SELECT f.id, f.lead_id, f.employee_id, f.scheduled_date AS followup_date, f.notes, f.status, l.company_name
      FROM followups f LEFT JOIN leads l ON f.lead_id = l.id WHERE 1=1`;
    const params = [];
    if (employeeId) { sql += ' AND f.employee_id = ?'; params.push(employeeId); }
    if (leadId) { sql += ' AND f.lead_id = ?'; params.push(leadId); }
    if (status) { sql += ' AND f.status = ?'; params.push(status); }
    sql += ' ORDER BY f.scheduled_date DESC';
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error('Followups GET:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/create', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const scheduledDate = b.followup_date || b.scheduled_date || new Date().toISOString().slice(0, 10);
    await query(
      'INSERT INTO followups (lead_id, employee_id, scheduled_date, notes, status) VALUES (?, ?, ?, ?, ?)',
      [b.lead_id, req.employee.id, scheduledDate, b.notes || '', b.status || 'pending']
    );
    return res.json({ success: true, message: 'Followup created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const scheduledDate = b.followup_date || b.scheduled_date || new Date().toISOString().slice(0, 10);
    await query(
      'INSERT INTO followups (lead_id, employee_id, scheduled_date, notes, status) VALUES (?, ?, ?, ?, ?)',
      [b.lead_id, req.employee.id, scheduledDate, b.notes || '', b.status || 'pending']
    );
    return res.json({ success: true, message: 'Followup created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/update_status', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.followup_id || !b.status) return res.status(400).json({ success: false, message: 'Follow-up ID and status are required' });
    const completedDate = b.status === 'completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    const conn = await getConnection();
    const [r] = await conn.execute('UPDATE followups SET status = ?, completed_date = ?, updated_at = NOW() WHERE id = ? AND employee_id = ?', [b.status, completedDate, b.followup_id, req.employee.id]);
    conn.release();
    if (!r || r.affectedRows === 0) return res.status(404).json({ success: false, message: 'Follow-up not found' });
    await logActivity(req.employee.id, 'followup_status_updated', 'followup', b.followup_id, 'Follow-up status updated to ' + b.status, req);
    return res.json({ success: true, message: 'Follow-up status updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
