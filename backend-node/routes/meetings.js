const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { cleanParams, getSafePagination } = require('../utils/queryHelpers');
const { logActivity } = require('../middleware/activityLog');

const router = express.Router();
const allowedRoles = ['admin', 'manager', 'human_resources', 'superadmin', 'super_admin'];

function canSeeAll(emp) {
  return allowedRoles.includes((emp.role || '').toLowerCase());
}

async function listMeetings(req) {
  const date = req.query.date || null;
  const status = req.query.status || null;
  const dateFrom = req.query.date_from || null;
  const dateTo = req.query.date_to || null;
  const { safeLimit, safeOffset } = getSafePagination(req.query, { defaultLimit: 100, maxLimit: 500 });

  const employeeId = req.employee.id;
  const companyId = req.employee.company_id;
  const seeAll = canSeeAll(req.employee);

  const addFilters = (baseSql, baseParams) => {
    let sql = baseSql;
    const params = [...baseParams];
    if (!seeAll) {
      sql += ' AND m.employee_id = ?';
      params.push(employeeId);
    }
    if (date) {
      sql += ' AND DATE(m.meeting_date) = ?';
      params.push(date);
    }
    if (dateFrom) {
      sql += ' AND DATE(m.meeting_date) >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND DATE(m.meeting_date) <= ?';
      params.push(dateTo);
    }
    if (status) {
      sql += ' AND m.status = ?';
      params.push(status);
    }
    sql += ` ORDER BY m.meeting_date DESC, m.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    return { sql, params };
  };

  // Try multiple schemas:
  // 1) meetings has company_id
  // 2) meetings doesn't have company_id -> enforce via employees join
  const attempts = [
    addFilters(
      `SELECT m.id, m.lead_id, m.employee_id, m.meeting_type, m.duration_minutes, m.title, m.description, m.meeting_date, m.location, m.status, m.notes, m.created_at, m.updated_at,
              e.name as employee_name, e.role as employee_role,
              l.company_name, l.contact_person
       FROM meetings m
       LEFT JOIN leads l ON m.lead_id = l.id
       LEFT JOIN employees e ON e.id = m.employee_id
       WHERE m.company_id = ?`,
      [companyId]
    ),
    addFilters(
      `SELECT m.id, m.lead_id, m.employee_id, m.meeting_type, m.duration_minutes, m.title, m.description, m.meeting_date, m.location, m.status, m.notes, m.created_at, m.updated_at,
              e.name as employee_name, e.role as employee_role,
              l.company_name, l.contact_person
       FROM meetings m
       LEFT JOIN leads l ON m.lead_id = l.id
       JOIN employees e ON e.id = m.employee_id
       WHERE e.company_id = ?`,
      [companyId]
    ),
    // Fallback if leads table lacks company_name/contact_person
    addFilters(
      `SELECT m.id, m.lead_id, m.employee_id, m.meeting_type, m.duration_minutes, m.title, m.description, m.meeting_date, m.location, m.status, m.notes, m.created_at, m.updated_at,
              e.name as employee_name, e.role as employee_role
       FROM meetings m
       LEFT JOIN employees e ON e.id = m.employee_id
       WHERE m.company_id = ?`,
      [companyId]
    ),
    addFilters(
      `SELECT m.id, m.lead_id, m.employee_id, m.meeting_type, m.duration_minutes, m.title, m.description, m.meeting_date, m.location, m.status, m.notes, m.created_at, m.updated_at,
              e.name as employee_name, e.role as employee_role
       FROM meetings m
       JOIN employees e ON e.id = m.employee_id
       WHERE e.company_id = ?`,
      [companyId]
    ),
    // Fallback when meeting_type/duration_minutes columns are unavailable.
    addFilters(
      `SELECT m.id, m.lead_id, m.employee_id, 'client_meeting' as meeting_type, 60 as duration_minutes, m.title, m.description, m.meeting_date, m.location, m.status, m.notes, m.created_at, m.updated_at,
              e.name as employee_name, e.role as employee_role,
              l.company_name, l.contact_person
       FROM meetings m
       LEFT JOIN leads l ON m.lead_id = l.id
       LEFT JOIN employees e ON e.id = m.employee_id
       WHERE m.company_id = ?`,
      [companyId]
    ),
    addFilters(
      `SELECT m.id, m.lead_id, m.employee_id, 'client_meeting' as meeting_type, 60 as duration_minutes, m.title, m.description, m.meeting_date, m.location, m.status, m.notes, m.created_at, m.updated_at,
              e.name as employee_name, e.role as employee_role,
              l.company_name, l.contact_person
       FROM meetings m
       LEFT JOIN leads l ON m.lead_id = l.id
       JOIN employees e ON e.id = m.employee_id
       WHERE e.company_id = ?`,
      [companyId]
    ),
    addFilters(
      `SELECT m.id, m.lead_id, m.employee_id, 'client_meeting' as meeting_type, 60 as duration_minutes, m.title, m.description, m.meeting_date, m.location, m.status, m.notes, m.created_at, m.updated_at,
              e.name as employee_name, e.role as employee_role
       FROM meetings m
       LEFT JOIN employees e ON e.id = m.employee_id
       WHERE m.company_id = ?`,
      [companyId]
    ),
    addFilters(
      `SELECT m.id, m.lead_id, m.employee_id, 'client_meeting' as meeting_type, 60 as duration_minutes, m.title, m.description, m.meeting_date, m.location, m.status, m.notes, m.created_at, m.updated_at,
              e.name as employee_name, e.role as employee_role
       FROM meetings m
       JOIN employees e ON e.id = m.employee_id
       WHERE e.company_id = ?`,
      [companyId]
    ),
  ];

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      const rows = await query(attempt.sql, cleanParams(attempt.params));
      return rows || [];
    } catch (e) {
      lastErr = e;
      if (e && (e.code === 'ER_BAD_FIELD_ERROR' || e.code === 'ER_NO_SUCH_TABLE' || e.code === 'ER_PARSE_ERROR')) continue;
      throw e;
    }
  }
  throw lastErr || new Error('Failed to load meetings');
}

async function createMeeting(req, body) {
  const b = body || {};
  if (!b.title || !b.meeting_date) {
    const err = new Error('Title and meeting date are required');
    err.statusCode = 400;
    throw err;
  }

  let meetingDate = b.meeting_date;
  if (String(meetingDate).includes('T')) {
    meetingDate = String(meetingDate).replace('T', ' ').slice(0, 19) + (meetingDate.length <= 16 ? ':00' : '');
  }

  const payload = {
    companyId: req.employee.company_id,
    employeeId: req.employee.id,
    leadId: b.lead_id || null,
    meetingType: b.meeting_type || 'client_meeting',
    title: b.title,
    description: b.description || null,
    meetingDate,
    durationMinutes: b.duration_minutes || 60,
    location: b.location || null,
    latitude: b.latitude || null,
    longitude: b.longitude || null,
    notes: b.notes || null,
  };

  const conn = await getConnection();
  try {
    const attempts = [
      {
        // Newer schema: company_id + optional geo
        sql: `INSERT INTO meetings (company_id, lead_id, employee_id, meeting_type, title, description, meeting_date, duration_minutes, location, latitude, longitude, status, notes)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,'scheduled',?)`,
        params: [
          payload.companyId,
          payload.leadId,
          payload.employeeId,
          payload.meetingType,
          payload.title,
          payload.description,
          payload.meetingDate,
          payload.durationMinutes,
          payload.location,
          payload.latitude,
          payload.longitude,
          payload.notes,
        ],
      },
      {
        // Newer schema without geo columns
        sql: `INSERT INTO meetings (company_id, lead_id, employee_id, meeting_type, title, description, meeting_date, duration_minutes, location, status, notes)
              VALUES (?,?,?,?,?,?,?,?,?,'scheduled',?)`,
        params: [
          payload.companyId,
          payload.leadId,
          payload.employeeId,
          payload.meetingType,
          payload.title,
          payload.description,
          payload.meetingDate,
          payload.durationMinutes,
          payload.location,
          payload.notes,
        ],
      },
      {
        // Older schema: no company_id, with geo
        sql: `INSERT INTO meetings (lead_id, employee_id, meeting_type, title, description, meeting_date, duration_minutes, location, latitude, longitude, status, notes)
              VALUES (?,?,?,?,?,?,?,?,?,?,'scheduled',?)`,
        params: [
          payload.leadId,
          payload.employeeId,
          payload.meetingType,
          payload.title,
          payload.description,
          payload.meetingDate,
          payload.durationMinutes,
          payload.location,
          payload.latitude,
          payload.longitude,
          payload.notes,
        ],
      },
      {
        // Older schema minimal
        sql: `INSERT INTO meetings (lead_id, employee_id, meeting_type, title, description, meeting_date, duration_minutes, location, status, notes)
              VALUES (?,?,?,?,?,?,?,?,?,'scheduled',?)`,
        params: [
          payload.leadId,
          payload.employeeId,
          payload.meetingType,
          payload.title,
          payload.description,
          payload.meetingDate,
          payload.durationMinutes,
          payload.location,
          payload.notes,
        ],
      },
    ];

    let lastErr = null;
    for (const attempt of attempts) {
      try {
        const [r] = await conn.execute(attempt.sql, attempt.params);
        return r.insertId;
      } catch (e) {
        lastErr = e;
        if (e && (e.code === 'ER_BAD_FIELD_ERROR' || e.code === 'ER_PARSE_ERROR')) continue;
        throw e;
      }
    }
    throw lastErr || new Error('Failed to create meeting');
  } finally {
    conn.release();
  }
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await listMeetings(req);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Meetings list error:', err);
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
    const insertId = await createMeeting(req, req.body);
    await logActivity(req.employee.id, 'meeting_created', 'meeting', insertId, 'Meeting created: ' + (req.body && req.body.title), req);
    return res.json({ success: true, message: 'Meeting created successfully', data: { id: insertId } });
  } catch (err) {
    console.error('Meeting create error:', err);
    if (err && err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const insertId = await createMeeting(req, req.body);
    return res.json({ success: true, message: 'Meeting created', data: { id: insertId } });
  } catch (err) {
    console.error('Meeting create (alt) error:', err);
    if (err && err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/update_outcome', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.meeting_id || b.outcome === undefined) return res.status(400).json({ success: false, message: 'Meeting ID and outcome are required' });
    const rows = await query('SELECT * FROM meetings WHERE id = ? AND employee_id = ?', [b.meeting_id, req.employee.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Meeting not found' });
    try {
      await query('UPDATE meetings SET outcome = ?, status = ?, updated_at = NOW() WHERE id = ?', [b.outcome, 'completed', b.meeting_id]);
    } catch (err) {
      // Backward compatibility: some schemas use `notes` instead of `outcome`.
      if (err && err.code === 'ER_BAD_FIELD_ERROR' && /outcome/i.test(err.message || '')) {
        await query('UPDATE meetings SET notes = ?, status = ?, updated_at = NOW() WHERE id = ?', [b.outcome, 'completed', b.meeting_id]);
      } else {
        throw err;
      }
    }
    await logActivity(req.employee.id, 'meeting_outcome_updated', 'meeting', b.meeting_id, 'Meeting MOM updated', req);
    return res.json({ success: true, message: 'Meeting outcome updated successfully' });
  } catch (err) {
    console.error('Meeting outcome update error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const meetingId = req.params.id;
    const allowedStatuses = ['scheduled', 'completed', 'cancelled', 'rescheduled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const rows = await query('SELECT * FROM meetings WHERE id = ?', [meetingId]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Meeting not found' });

    const isOwner = rows[0].employee_id === req.employee.id;
    const seeAll = canSeeAll(req.employee);

    if (!isOwner && !seeAll) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this meeting status' });
    }

    await query('UPDATE meetings SET status = ?, updated_at = NOW() WHERE id = ?', [status, meetingId]);
    await logActivity(req.employee.id, 'meeting_status_updated', 'meeting', meetingId, `Meeting status updated to ${status}`, req);

    return res.json({ success: true, message: 'Meeting status updated successfully' });
  } catch (err) {
    console.error('Meeting status update error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
