const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLog');

const router = express.Router();
const allowedRoles = ['admin', 'manager', 'human_resources'];

function canSeeAll(emp) {
  return allowedRoles.includes((emp.role || '').toLowerCase());
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const date = req.query.date || null;
    const status = req.query.status || null;
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = ((parseInt(req.query.page, 10) || 1) - 1) * limit;
    let sql = `SELECT m.id, m.lead_id, m.employee_id, m.title, m.description, m.meeting_date, m.location, m.status, m.notes, m.created_at, m.updated_at, l.company_name, l.contact_person
       FROM meetings m LEFT JOIN leads l ON m.lead_id = l.id WHERE 1=1`;
    const params = [];
    if (!canSeeAll(req.employee)) {
      sql += ' AND m.employee_id = ?';
      params.push(req.employee.id);
    }
    if (date) { sql += ' AND DATE(m.meeting_date) = ?'; params.push(date); }
    if (dateFrom) { sql += ' AND DATE(m.meeting_date) >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND DATE(m.meeting_date) <= ?'; params.push(dateTo); }
    if (status) { sql += ' AND m.status = ?'; params.push(status); }
    sql += ' ORDER BY m.meeting_date DESC, m.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/summary', verifyToken, async (req, res) => {
  try {
    const eid = req.employee.id;
    const today = new Date().toISOString().slice(0, 10);
    const [todayM] = await query('SELECT COUNT(*) as count FROM meetings WHERE employee_id = ? AND DATE(meeting_date) = ?', [eid, today]);
    const [completedM] = await query('SELECT COUNT(*) as count FROM meetings WHERE employee_id = ? AND status = ?', [eid, 'completed']);
    const [pendingF] = await query('SELECT COUNT(*) as count FROM followups WHERE employee_id = ? AND status = ?', [eid, 'pending']);
    const [activeD] = await query('SELECT COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as total_value FROM leads WHERE assigned_to = ? AND status NOT IN (?, ?)', [eid, 'won', 'lost']);
    return res.json({
      success: true,
      data: {
        today_meetings: parseInt(todayM && todayM.count) || 0,
        completed_meetings: parseInt(completedM && completedM.count) || 0,
        pending_followups: parseInt(pendingF && pendingF.count) || 0,
        active_deals: parseInt(activeD && activeD.count) || 0,
        active_deals_value: parseFloat(activeD && activeD.total_value) || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/create', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !b.meeting_date) return res.status(400).json({ success: false, message: 'Title and meeting date are required' });
    let meetingDate = b.meeting_date;
    if (String(meetingDate).indexOf('T') !== -1) meetingDate = String(meetingDate).replace('T', ' ').slice(0, 19) + (meetingDate.length <= 16 ? ':00' : '');
    const conn = await getConnection();
    const [r] = await conn.execute(
      `INSERT INTO meetings (lead_id, employee_id, meeting_type, title, description, meeting_date, duration_minutes, location, latitude, longitude, status, notes) VALUES (?,?,?,?,?,?,?,?,?,?,'scheduled',?)`,
      [b.lead_id || null, req.employee.id, b.meeting_type || 'client_meeting', b.title, b.description || null, meetingDate, b.duration_minutes || 60, b.location || null, b.latitude || null, b.longitude || null, b.notes || null]
    );
    conn.release();
    await logActivity(req.employee.id, 'meeting_created', 'meeting', r.insertId, 'Meeting created: ' + b.title, req);
    return res.json({ success: true, message: 'Meeting created successfully', data: { id: r.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !b.meeting_date) return res.status(400).json({ success: false, message: 'Title and meeting date are required' });
    let meetingDate = b.meeting_date;
    if (String(meetingDate).indexOf('T') !== -1) meetingDate = String(meetingDate).replace('T', ' ').slice(0, 19) + (meetingDate.length <= 16 ? ':00' : '');
    const conn = await getConnection();
    const [r] = await conn.execute(
      `INSERT INTO meetings (lead_id, employee_id, meeting_type, title, description, meeting_date, duration_minutes, location, status, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [b.lead_id || null, req.employee.id, b.meeting_type || 'client_meeting', b.title, b.description || null, meetingDate, b.duration_minutes || 60, b.location || null, 'scheduled', b.notes || null]
    );
    conn.release();
    return res.json({ success: true, message: 'Meeting created', data: { id: r.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/update_outcome', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.meeting_id || b.outcome === undefined) return res.status(400).json({ success: false, message: 'Meeting ID and outcome are required' });
    const rows = await query('SELECT * FROM meetings WHERE id = ? AND employee_id = ?', [b.meeting_id, req.employee.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Meeting not found' });
    await query('UPDATE meetings SET outcome = ?, status = ?, updated_at = NOW() WHERE id = ?', [b.outcome, 'completed', b.meeting_id]);
    await logActivity(req.employee.id, 'meeting_outcome_updated', 'meeting', b.meeting_id, 'Meeting MOM updated', req);
    return res.json({ success: true, message: 'Meeting outcome updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
