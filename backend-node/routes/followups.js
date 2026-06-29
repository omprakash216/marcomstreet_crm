const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLog');
const { cleanParams, getSafePagination } = require('../utils/queryHelpers');

const router = express.Router();

const FOLLOWUP_STATUSES = new Set(['pending', 'completed', 'missed', 'cancelled']);
const FOLLOWUP_TYPES = new Set(['call', 'email', 'whatsapp', 'meeting', 'review', 'feedback', 'handover', 'update', 'other']);

function normalizeRole(role) {
  return String(role || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .trim();
}

function isSuperUser(employee) {
  const role = normalizeRole(employee?.role);
  return role === 'superadmin' || role === 'super_admin';
}

function canViewCompanyFollowups(employee) {
  const role = normalizeRole(employee?.role);
  return role === 'admin' || role === 'manager' || role === 'human_resources' || role === 'hr' || isSuperUser(employee);
}

function isMissingTypeColumnError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return err?.code === 'ER_BAD_FIELD_ERROR' || (msg.includes('unknown column') && msg.includes('followup_type'));
}

function isInvalidTypeValueError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('followup_type') && (msg.includes('truncated') || msg.includes('incorrect'));
}

function buildFollowupListSql({ includeTypeColumn, filters, employee, countOnly = false, limit = null, offset = 0 }) {
  const {
    leadId,
    status,
    type,
    search,
    dateFilter,
    dateFrom,
    dateTo,
  } = filters;

  const employeeId = employee?.id;
  const companyId = employee?.company_id || null;
  const superUser = isSuperUser(employee);
  const viewCompanyWide = canViewCompanyFollowups(employee);

  let sql = countOnly
    ? `SELECT COUNT(*) as total
    FROM followups f
    LEFT JOIN leads l ON f.lead_id = l.id
    LEFT JOIN employees e ON f.employee_id = e.id
    WHERE 1=1`
    : `SELECT f.id, f.lead_id, f.employee_id, f.scheduled_date, f.completed_date,
      ${includeTypeColumn ? 'f.followup_type' : "'other' AS followup_type"},
      f.notes, f.outcome, f.status, l.company_name, l.contact_person, l.phone, e.name AS employee_name
    FROM followups f
    LEFT JOIN leads l ON f.lead_id = l.id
    LEFT JOIN employees e ON f.employee_id = e.id
    WHERE 1=1`;
  const params = [];

  if (!superUser && companyId) {
    sql += ' AND e.company_id = ?';
    params.push(companyId);
  }
  if (!viewCompanyWide && employeeId) {
    sql += ' AND f.employee_id = ?';
    params.push(employeeId);
  }
  if (leadId) {
    sql += ' AND f.lead_id = ?';
    params.push(leadId);
  }
  if (status) {
    sql += ' AND f.status = ?';
    params.push(status);
  }
  if (type) {
    if (includeTypeColumn) {
      sql += ' AND f.followup_type = ?';
      params.push(type);
    } else if (type !== 'other') {
      sql += ' AND 1 = 0';
    }
  }
  if (dateFilter === 'today') {
    sql += ' AND DATE(f.scheduled_date) = CURDATE()';
  } else if (dateFilter === 'week') {
    sql += ' AND YEARWEEK(f.scheduled_date, 1) = YEARWEEK(CURDATE(), 1)';
  } else if (dateFilter === 'month') {
    sql += ' AND YEAR(f.scheduled_date) = YEAR(CURDATE()) AND MONTH(f.scheduled_date) = MONTH(CURDATE())';
  }
  if (dateFrom) {
    sql += ' AND DATE(f.scheduled_date) >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    sql += ' AND DATE(f.scheduled_date) <= ?';
    params.push(dateTo);
  }
  if (search) {
    sql += ' AND (l.company_name LIKE ? OR l.contact_person LIKE ? OR l.phone LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (!countOnly) {
    sql += ' ORDER BY f.scheduled_date DESC, f.id DESC';
    if (Number.isFinite(limit)) {
      const safeLimit = Math.max(Math.trunc(Number(limit)) || 0, 0);
      const safeOffset = Number.isFinite(Number(offset)) ? Math.max(Math.trunc(Number(offset)), 0) : 0;
      sql += ` LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    }
  }

  return { sql, params };
}

function normalizeFollowupType(value) {
  const next = String(value || 'call').toLowerCase().trim();
  return FOLLOWUP_TYPES.has(next) ? next : 'other';
}

function normalizeFollowupStatus(value) {
  const next = String(value || 'pending').toLowerCase().trim();
  return FOLLOWUP_STATUSES.has(next) ? next : 'pending';
}

function normalizeDateTimeValue(value) {
  if (!value) return '';

  if (value instanceof Date) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  const raw = String(value).trim();
  if (!raw) return '';

  const cleaned = raw.replace('T', ' ').replace(/Z$/i, '');
  const match = cleaned.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?/);
  if (match) {
    return `${match[1]} ${match[2] || '00:00'}:00`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
  }

  return cleaned.slice(0, 19);
}

function getRequestedScheduledDateTime(body) {
  return normalizeDateTimeValue(body?.scheduled_date || body?.followup_date || body?.scheduled_at || '');
}

function buildFollowupDetailSql(includeTypeColumn) {
  return `SELECT f.id, f.lead_id, f.employee_id, f.scheduled_date, f.completed_date,
      ${includeTypeColumn ? 'f.followup_type' : "'other' AS followup_type"},
      f.notes, f.outcome, f.status,
      l.company_id AS lead_company_id, l.company_name, l.contact_person, l.phone,
      e.company_id AS employee_company_id, e.name AS employee_name
    FROM followups f
    LEFT JOIN leads l ON f.lead_id = l.id
    LEFT JOIN employees e ON f.employee_id = e.id
    WHERE f.id = ? LIMIT 1`;
}

async function createFollowupRecord({ leadId, employeeId, followupType, scheduledDate, notes, status }) {
  try {
    await query(
      'INSERT INTO followups (lead_id, employee_id, followup_type, scheduled_date, notes, status) VALUES (?, ?, ?, ?, ?, ?)',
      [leadId, employeeId, followupType, scheduledDate, notes || '', status]
    );
    return;
  } catch (err) {
    if (isMissingTypeColumnError(err)) {
      await query(
        'INSERT INTO followups (lead_id, employee_id, scheduled_date, notes, status) VALUES (?, ?, ?, ?, ?)',
        [leadId, employeeId, scheduledDate, notes || '', status]
      );
      return;
    }
    if (isInvalidTypeValueError(err)) {
      await query(
        'INSERT INTO followups (lead_id, employee_id, followup_type, scheduled_date, notes, status) VALUES (?, ?, ?, ?, ?, ?)',
        [leadId, employeeId, 'other', scheduledDate, notes || '', status]
      );
      return;
    }
    throw err;
  }
}

async function createFollowupHandler(req, res) {
  try {
    const b = req.body || {};
    const leadId = Number(b.lead_id);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      return res.status(400).json({ success: false, message: 'Lead is required' });
    }

    const scheduledDate = getRequestedScheduledDateTime(b) || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const followupType = normalizeFollowupType(b.followup_type);
    const status = normalizeFollowupStatus(b.status);

    const leadRows = await query('SELECT id, company_id FROM leads WHERE id = ? LIMIT 1', [leadId]);
    const lead = Array.isArray(leadRows) ? leadRows[0] : null;
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    if (!isSuperUser(req.employee) && req.employee?.company_id && Number(lead.company_id) !== Number(req.employee.company_id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized lead access' });
    }

    await createFollowupRecord({
      leadId,
      employeeId: req.employee.id,
      followupType,
      scheduledDate,
      notes: b.notes || '',
      status,
    });

    await logActivity(req.employee.id, 'followup_created', 'followup', leadId, 'Follow-up scheduled', req).catch(() => {});
    return res.json({ success: true, message: 'Follow-up created successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const leadId = req.query.lead_id || null;
    const status = req.query.status || null;
    const type = req.query.type || null;
    const search = req.query.search || null;
    const dateFilter = req.query.date_filter || null;
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;
    const filters = { leadId, status, type, search, dateFilter, dateFrom, dateTo };
    const shouldPaginate = req.query.unlimited !== 'true' && (req.query.page || req.query.limit);
    const { page, safeLimit, safeOffset } = getSafePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const queryLimit = safeLimit + 1;

    let rows;
    let total = 0;
    try {
      const withTypeSql = buildFollowupListSql({
        includeTypeColumn: true,
        filters,
        employee: req.employee,
        limit: shouldPaginate ? queryLimit : null,
        offset: safeOffset,
      });
      rows = await query(withTypeSql.sql, cleanParams(withTypeSql.params));
      if (shouldPaginate) {
        const countSql = buildFollowupListSql({ includeTypeColumn: true, filters, employee: req.employee, countOnly: true });
        const countRows = await query(countSql.sql, cleanParams(countSql.params));
        total = Number(countRows?.[0]?.total || 0);
      }
    } catch (err) {
      if (!isMissingTypeColumnError(err)) throw err;
      const withoutTypeSql = buildFollowupListSql({
        includeTypeColumn: false,
        filters,
        employee: req.employee,
        limit: shouldPaginate ? queryLimit : null,
        offset: safeOffset,
      });
      rows = await query(withoutTypeSql.sql, cleanParams(withoutTypeSql.params));
      if (shouldPaginate) {
        const countSql = buildFollowupListSql({ includeTypeColumn: false, filters, employee: req.employee, countOnly: true });
        const countRows = await query(countSql.sql, cleanParams(countSql.params));
        total = Number(countRows?.[0]?.total || 0);
      }
    }

    const hasNext = shouldPaginate && Array.isArray(rows) && rows.length > safeLimit;
    if (hasNext) rows = rows.slice(0, safeLimit);
    const data = (rows || []).map((row) => ({
      ...row,
      followup_type: row.followup_type || 'other',
      followup_date: row.scheduled_date,
      outcome: row.outcome || '',
    }));
    return res.json({
      success: true,
      data,
      page: shouldPaginate ? page : 1,
      limit: shouldPaginate ? safeLimit : data.length,
      total: shouldPaginate ? total : data.length,
      has_next: hasNext,
    });
  } catch (err) {
    console.error('Followups GET:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/create', verifyToken, createFollowupHandler);
router.post('/', verifyToken, createFollowupHandler);

router.put('/update_status', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.followup_id || !b.status) return res.status(400).json({ success: false, message: 'Follow-up ID and status are required' });
    const nextStatus = normalizeFollowupStatus(b.status);
    const completedDate = nextStatus === 'completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

    const followupRows = await query(
      `SELECT f.id, f.employee_id, e.company_id
       FROM followups f
       LEFT JOIN employees e ON e.id = f.employee_id
       WHERE f.id = ? LIMIT 1`,
      [b.followup_id]
    );
    const followup = Array.isArray(followupRows) ? followupRows[0] : null;
    if (!followup) return res.status(404).json({ success: false, message: 'Follow-up not found' });

    const superUser = isSuperUser(req.employee);
    const viewCompanyWide = canViewCompanyFollowups(req.employee);
    if (!superUser && req.employee?.company_id && Number(followup.company_id) !== Number(req.employee.company_id)) {
      return res.status(404).json({ success: false, message: 'Follow-up not found' });
    }
    if (!viewCompanyWide && Number(followup.employee_id) !== Number(req.employee.id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this follow-up' });
    }

    const conn = await getConnection();
    const [r] = await conn.execute(
      'UPDATE followups SET status = ?, completed_date = ?, updated_at = NOW() WHERE id = ?',
      [nextStatus, completedDate, b.followup_id]
    );
    conn.release();
    if (!r || r.affectedRows === 0) return res.status(404).json({ success: false, message: 'Follow-up not found' });
    await logActivity(req.employee.id, 'followup_status_updated', 'followup', b.followup_id, 'Follow-up status updated to ' + nextStatus, req);
    return res.json({ success: true, message: 'Follow-up status updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const followupId = Number(req.params.id);
    if (!Number.isFinite(followupId) || followupId <= 0) {
      return res.status(400).json({ success: false, message: 'Valid follow-up ID is required' });
    }

    let row = null;
    try {
      const rows = await query(buildFollowupDetailSql(true), [followupId]);
      row = Array.isArray(rows) ? rows[0] : null;
    } catch (err) {
      if (!isMissingTypeColumnError(err)) throw err;
      const rows = await query(buildFollowupDetailSql(false), [followupId]);
      row = Array.isArray(rows) ? rows[0] : null;
    }

    if (!row) {
      return res.status(404).json({ success: false, message: 'Follow-up not found' });
    }

    const superUser = isSuperUser(req.employee);
    const viewCompanyWide = canViewCompanyFollowups(req.employee);
    const recordCompanyId = row.employee_company_id || row.lead_company_id || null;

    if (!superUser && req.employee?.company_id && recordCompanyId && Number(recordCompanyId) !== Number(req.employee.company_id)) {
      return res.status(404).json({ success: false, message: 'Follow-up not found' });
    }
    if (!viewCompanyWide && Number(row.employee_id) !== Number(req.employee.id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this follow-up' });
    }

    return res.json({
      success: true,
      data: {
        ...row,
        followup_type: row.followup_type || 'other',
        followup_date: row.scheduled_date,
        outcome: row.outcome || '',
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const followupId = Number(req.params.id);
    if (!Number.isFinite(followupId) || followupId <= 0) {
      return res.status(400).json({ success: false, message: 'Valid follow-up ID is required' });
    }

    const body = req.body || {};
    const nextScheduledDate = getRequestedScheduledDateTime(body);
    const nextLeadId = body.lead_id !== undefined && body.lead_id !== '' ? Number(body.lead_id) : null;

    if (nextLeadId !== null && (!Number.isFinite(nextLeadId) || nextLeadId <= 0)) {
      return res.status(400).json({ success: false, message: 'Valid lead is required' });
    }
    if (!nextScheduledDate) {
      return res.status(400).json({ success: false, message: 'Scheduled date and time are required' });
    }

    const followupRows = await query(
      buildFollowupDetailSql(true),
      [followupId]
    ).catch(async (err) => {
      if (!isMissingTypeColumnError(err)) throw err;
      return query(buildFollowupDetailSql(false), [followupId]);
    });
    const existing = Array.isArray(followupRows) ? followupRows[0] : null;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Follow-up not found' });
    }

    const superUser = isSuperUser(req.employee);
    const viewCompanyWide = canViewCompanyFollowups(req.employee);
    const recordCompanyId = existing.employee_company_id || existing.lead_company_id || null;

    if (!superUser && req.employee?.company_id && recordCompanyId && Number(recordCompanyId) !== Number(req.employee.company_id)) {
      return res.status(404).json({ success: false, message: 'Follow-up not found' });
    }
    if (!viewCompanyWide && Number(existing.employee_id) !== Number(req.employee.id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this follow-up' });
    }

    let resolvedLeadId = nextLeadId || Number(existing.lead_id);
    if (!resolvedLeadId || !Number.isFinite(resolvedLeadId)) {
      return res.status(400).json({ success: false, message: 'Lead is required' });
    }

    if (nextLeadId !== null && Number(nextLeadId) !== Number(existing.lead_id)) {
      const leadRows = await query('SELECT id, company_id FROM leads WHERE id = ? LIMIT 1', [nextLeadId]);
      const lead = Array.isArray(leadRows) ? leadRows[0] : null;
      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }
      if (!superUser && req.employee?.company_id && Number(lead.company_id) !== Number(req.employee.company_id)) {
        return res.status(403).json({ success: false, message: 'Unauthorized lead access' });
      }
      resolvedLeadId = nextLeadId;
    }

    const nextStatus = body.status !== undefined
      ? normalizeFollowupStatus(body.status)
      : normalizeFollowupStatus(existing.status);
    const nextFollowupType = body.followup_type !== undefined
      ? normalizeFollowupType(body.followup_type)
      : normalizeFollowupType(existing.followup_type);
    const nextNotes = body.notes !== undefined ? String(body.notes || '') : String(existing.notes || '');
    const nextOutcome = body.outcome !== undefined ? String(body.outcome || '') : String(existing.outcome || '');

    const nextCompletedDate = nextStatus === 'completed'
      ? (existing.completed_date || new Date().toISOString().slice(0, 19).replace('T', ' '))
      : null;

    const updateWithTypeSql = `
      UPDATE followups
      SET lead_id = ?, followup_type = ?, scheduled_date = ?, status = ?, notes = ?, outcome = ?, completed_date = ?, updated_at = NOW()
      WHERE id = ?`;
    const updateWithoutTypeSql = `
      UPDATE followups
      SET lead_id = ?, scheduled_date = ?, status = ?, notes = ?, outcome = ?, completed_date = ?, updated_at = NOW()
      WHERE id = ?`;

    async function executeFollowupUpdate(sql, params) {
      const conn = await getConnection();
      try {
        const [result] = await conn.execute(sql, params);
        return result?.affectedRows || 0;
      } finally {
        conn.release();
      }
    }

    let affectedRows = 0;
    try {
      affectedRows = await executeFollowupUpdate(updateWithTypeSql, [
        resolvedLeadId,
        nextFollowupType,
        nextScheduledDate,
        nextStatus,
        nextNotes,
        nextOutcome,
        nextCompletedDate,
        followupId,
      ]);
    } catch (err) {
      if (!isMissingTypeColumnError(err)) throw err;
      affectedRows = await executeFollowupUpdate(updateWithoutTypeSql, [
        resolvedLeadId,
        nextScheduledDate,
        nextStatus,
        nextNotes,
        nextOutcome,
        nextCompletedDate,
        followupId,
      ]);
    }

    if (!affectedRows) {
      return res.status(404).json({ success: false, message: 'Follow-up not found' });
    }

    await logActivity(req.employee.id, 'followup_updated', 'followup', followupId, `Follow-up updated to ${nextStatus}`, req).catch(() => {});
    return res.json({ success: true, message: 'Follow-up updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
