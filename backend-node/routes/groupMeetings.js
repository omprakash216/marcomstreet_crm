const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
// Accept common role variants stored in DB.
const allowedRoles = ['admin', 'manager', 'human_resources', 'human resources', 'human resource', 'hr', 'hr manager', 'hr_manager'];

function canSeeAll(emp) {
  return allowedRoles.includes(String(emp?.role || '').toLowerCase().trim());
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
    // HR/Admin/Manager can update any meeting; others only their own.
    const canAll = canSeeAll(req.employee);
    const params = [b.title, b.description, b.meeting_date, b.location, b.status, b.notes, req.params.id];
    let sql = 'UPDATE meetings SET title=?, description=?, meeting_date=?, location=?, status=?, notes=?, updated_at=NOW() WHERE id=?';
    if (!canAll) {
      sql += ' AND employee_id=?';
      params.push(req.employee.id);
    }
    await query(sql, params);
    return res.json({ success: true, message: 'Meeting updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /group-meetings/:id/status - update meeting status (used by UI)
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid meeting id' });
    }
    const status = String(req.body?.status || '').toLowerCase().trim();
    const allowed = ['scheduled', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const canAll = canSeeAll(req.employee);
    const params = [status, id];
    let sql = 'UPDATE meetings SET status=?, updated_at=NOW() WHERE id=?';
    if (!canAll) {
      sql += ' AND employee_id=?';
      params.push(req.employee.id);
    }
    const r = await query(sql, params);
    // Best-effort "not found" check (mysql2 returns affectedRows via result object in some wrappers)
    if (r && typeof r.affectedRows === 'number' && r.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    return res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const canAll = canSeeAll(req.employee);
    const params = [req.params.id];
    let sql = 'DELETE FROM meetings WHERE id = ?';
    if (!canAll) {
      sql += ' AND employee_id=?';
      params.push(req.employee.id);
    }
    await query(sql, params);
    return res.json({ success: true, message: 'Meeting deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
