const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const allowedRoles = ['admin', 'manager', 'human_resources'];

function canSeeAll(emp) {
  return allowedRoles.includes((emp.role || '').toLowerCase());
}

router.get('/', verifyToken, async (req, res) => {
  try {
    let sql = `SELECT m.*, l.company_name, e.name as employee_name FROM meetings m LEFT JOIN leads l ON m.lead_id = l.id LEFT JOIN employees e ON m.employee_id = e.id WHERE 1=1`;
    const params = [];
    if (!canSeeAll(req.employee)) { sql += ' AND m.employee_id = ?'; params.push(req.employee.id); }
    sql += ' ORDER BY m.meeting_date DESC, m.created_at DESC';
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !b.meeting_date) return res.status(400).json({ success: false, message: 'Title and meeting date required' });
    let meetingDate = b.meeting_date;
    if (String(meetingDate).indexOf('T') !== -1) meetingDate = String(meetingDate).replace('T', ' ').slice(0, 19);
    const conn = await getConnection();
    const [r] = await conn.execute(
      'INSERT INTO meetings (lead_id, employee_id, meeting_type, title, description, meeting_date, duration_minutes, location, status, notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [b.lead_id || null, req.employee.id, b.meeting_type || 'group', b.title, b.description || null, meetingDate, b.duration_minutes || 60, b.location || null, 'scheduled', b.notes || null]
    );
    conn.release();
    return res.json({ success: true, message: 'Meeting created', data: { id: r.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    await query(
      'UPDATE meetings SET title=?, description=?, meeting_date=?, location=?, status=?, notes=?, updated_at=NOW() WHERE id=? AND employee_id=?',
      [b.title, b.description, b.meeting_date, b.location, b.status, b.notes, req.params.id, req.employee.id]
    );
    return res.json({ success: true, message: 'Meeting updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await query('DELETE FROM meetings WHERE id = ? AND employee_id = ?', [req.params.id, req.employee.id]);
    return res.json({ success: true, message: 'Meeting deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
