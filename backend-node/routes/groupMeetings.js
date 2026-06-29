const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { cleanParams, getSafePagination } = require('../utils/queryHelpers');

const router = express.Router();
// Accept common role variants stored in DB.
const allowedRoles = ['admin', 'manager', 'human_resources', 'human resources', 'human resource', 'hr', 'hr manager', 'hr_manager'];

function canSeeAll(emp) {
  return allowedRoles.includes(String(emp?.role || '').toLowerCase().trim());
}

const editableStatuses = ['scheduled', 'rescheduled', 'completed', 'cancelled'];
const meetingTypes = ['client_meeting', 'follow_up', 'presentation', 'other'];

function normalizeStatus(status, fallback = 'scheduled') {
  const value = String(status || '').toLowerCase().trim();
  return editableStatuses.includes(value) ? value : fallback;
}

function normalizeMeetingType(type) {
  const value = String(type || '').toLowerCase().trim();
  return meetingTypes.includes(value) ? value : 'other';
}

function normalizeMeetingDate(value) {
  if (!value) return '';
  const normalized = String(value).replace('T', ' ').slice(0, 19);
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

function normalizeDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 15 && duration <= 480 ? Math.round(duration) : 60;
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const { page, safeLimit, safeOffset } = getSafePagination(req.query, { defaultLimit: 100, maxLimit: 100 });
    const hasLimitParam = Object.prototype.hasOwnProperty.call(req.query || {}, 'limit');
    const parsedLimit = parseInt(req.query.limit, 10);
    const usePagination = hasLimitParam && Number.isFinite(parsedLimit) && parsedLimit > 0;

    let baseSql = `FROM meetings m LEFT JOIN leads l ON m.lead_id = l.id LEFT JOIN employees e ON m.employee_id = e.id WHERE e.company_id = ?`;
    const params = [req.employee.company_id];
    if (!canSeeAll(req.employee)) { baseSql += ' AND m.employee_id = ?'; params.push(req.employee.id); }

    const status = String(req.query.status || '').toLowerCase().trim();
    if (editableStatuses.includes(status)) {
      baseSql += ' AND m.status = ?';
      params.push(status);
    }

    const search = String(req.query.search || '').trim();
    if (search) {
      const term = `%${search}%`;
      baseSql += ' AND (m.title LIKE ? OR m.description LIKE ? OR m.location LIKE ? OR e.name LIKE ?)';
      params.push(term, term, term, term);
    }

    switch (String(req.query.date_filter || '').toLowerCase().trim()) {
      case 'today':
        baseSql += ' AND DATE(m.meeting_date) = CURDATE()';
        break;
      case 'week':
        baseSql += ' AND YEARWEEK(m.meeting_date, 1) = YEARWEEK(CURDATE(), 1)';
        break;
      case 'month':
        baseSql += ' AND YEAR(m.meeting_date) = YEAR(CURDATE()) AND MONTH(m.meeting_date) = MONTH(CURDATE())';
        break;
      case 'upcoming':
        baseSql += ' AND m.meeting_date >= NOW()';
        break;
      default:
        break;
    }

    const selectSql = `SELECT m.id, m.lead_id, m.employee_id, m.meeting_type, m.duration_minutes, m.title, m.description, m.meeting_date, m.location, m.status, m.notes, m.created_at, m.updated_at, l.company_name, e.name as employee_name ${baseSql}`;
    const orderBy = ' ORDER BY m.meeting_date DESC, m.created_at DESC';

    if (!usePagination) {
      const rows = await query(`${selectSql}${orderBy}`, cleanParams(params));
      return res.json({ success: true, data: rows || [] });
    }

    const pageRows = await query(`${selectSql}${orderBy} LIMIT ${safeLimit} OFFSET ${safeOffset}`, cleanParams(params));
    const countRows = await query(`SELECT COUNT(*) as total ${baseSql}`, cleanParams(params));
    const total = Number(countRows && countRows[0] && countRows[0].total) || 0;

    return res.json({
      success: true,
      data: pageRows || [],
      page,
      limit: safeLimit,
      total,
      has_next: safeOffset + (Array.isArray(pageRows) ? pageRows.length : 0) < total,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  let conn;
  try {
    const b = req.body || {};
    const title = String(b.title || '').trim();
    const meetingDate = normalizeMeetingDate(b.meeting_date);
    if (!title || !meetingDate) return res.status(400).json({ success: false, message: 'Title and meeting date required' });
    conn = await getConnection();
    const [r] = await conn.execute(
      'INSERT INTO meetings (company_id, lead_id, employee_id, meeting_type, title, description, meeting_date, duration_minutes, location, status, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [req.employee.company_id, b.lead_id || null, req.employee.id, normalizeMeetingType(b.meeting_type), title, b.description || null, meetingDate, normalizeDuration(b.duration_minutes), b.location || null, 'scheduled', b.notes || null]
    );
    return res.json({ success: true, message: 'Meeting created', data: { id: r.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const title = String(b.title || '').trim();
    const meetingDate = normalizeMeetingDate(b.meeting_date);
    if (!title || !meetingDate) return res.status(400).json({ success: false, message: 'Title and meeting date required' });
    // HR/Admin/Manager can update any meeting; others only their own.
    const canAll = canSeeAll(req.employee);
    const params = [title, b.description || null, meetingDate, normalizeMeetingType(b.meeting_type), normalizeDuration(b.duration_minutes), b.location || null, normalizeStatus(b.status), b.notes || null, req.params.id];
    let sql = 'UPDATE meetings SET title=?, description=?, meeting_date=?, meeting_type=?, duration_minutes=?, location=?, status=?, notes=?, updated_at=NOW() WHERE id=?';
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
    if (!editableStatuses.includes(status)) {
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
