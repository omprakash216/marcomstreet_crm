const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLog');

const router = express.Router();

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

router.get('/', verifyToken, async (req, res) => {
  try {
    const isSuper = isSuperUser(req.employee);
    const id = req.query.id || null;
    if (id) {
      const sql = isSuper ? 'SELECT * FROM leads WHERE id = ?' : 'SELECT * FROM leads WHERE id = ? AND company_id = ?';
      const params = isSuper ? [id] : [id, req.employee.company_id];
      const rows = await query(sql, params);
      const lead = rows[0];
      if (!lead) return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });
      return res.json({ success: true, data: lead });
    }
    const status = req.query.status || null;
    const priority = req.query.priority || null;
    const search = req.query.search || null;
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;

    const requestedLimit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * requestedLimit;
    const limit = Math.min(requestedLimit + 1, 501);

    let sql = `SELECT l.id, l.lead_code, l.company_name, l.contact_person, l.email, l.phone,
               l.assigned_to, l.source, l.status, l.priority, l.estimated_value, l.notes,
               l.next_followup_date, l.created_at, l.updated_at
               FROM leads l WHERE 1=1`;
    const params = [];
    if (!isSuper) {
      sql += ' AND l.company_id = ?';
      params.push(req.employee.company_id);
    }
    if (status) { sql += ' AND l.status = ?'; params.push(status); }
    if (priority) { sql += ' AND l.priority = ?'; params.push(priority); }
    if (dateFrom) { sql += ' AND DATE(l.created_at) >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND DATE(l.created_at) <= ?'; params.push(dateTo); }
    if (search) {
      sql += ' AND (l.company_name LIKE ? OR l.contact_person LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.lead_code LIKE ?)';
      const term = '%' + search + '%';
      params.push(term, term, term, term, term);
    }
    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    let rows = await query(sql, params);
    const hasNext = Array.isArray(rows) && rows.length > requestedLimit;
    if (hasNext) rows = rows.slice(0, requestedLimit);

    return res.json({ success: true, data: rows, page, limit: requestedLimit, has_next: hasNext });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/crud', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.company_name || !b.contact_person) {
      return res.status(400).json({ success: false, message: 'Company name and contact person are required' });
    }
    const maxId = await query('SELECT COALESCE(MAX(id),0) as m FROM leads');
    const nextId = (maxId[0] && maxId[0].m) ? maxId[0].m + 1 : 1;
    const leadCode = 'L' + String(nextId).padStart(6, '0');
    const conn = await getConnection();
    const [r] = await conn.execute(
      `INSERT INTO leads (company_id, lead_code, company_name, contact_person, email, phone, assigned_to, source, status, priority, estimated_value, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.employee.company_id, leadCode, b.company_name, b.contact_person, b.email || null, b.phone || null, b.assigned_to || req.employee.id, b.source || 'website', b.status || 'new', b.priority || 'medium', b.estimated_value || null, b.notes || null]
    );
    conn.release();
    await logActivity(req.employee.id, 'lead_created', 'lead', r.insertId, 'Lead created: ' + b.company_name, req);
    return res.json({ success: true, message: 'Lead created successfully', data: { id: r.insertId, lead_code: leadCode } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/crud', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.id) return res.status(400).json({ success: false, message: 'Lead ID is required' });
    const isSuper = isSuperUser(req.employee);
    const rows = isSuper 
        ? await query('SELECT * FROM leads WHERE id = ?', [b.id])
        : await query('SELECT * FROM leads WHERE id = ? AND company_id = ?', [b.id, req.employee.company_id]);
    const lead = rows[0];
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });
    const role = normalizeRole(req.employee.role);
    if (role !== 'admin' && !isSuper && lead.assigned_to !== req.employee.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to modify this lead' });
    }
    const updateSql = isSuper
        ? `UPDATE leads SET company_name=?, contact_person=?, email=?, phone=?, assigned_to=?, source=?, status=?, priority=?, estimated_value=?, notes=?, updated_at=NOW() WHERE id=?`
        : `UPDATE leads SET company_name=?, contact_person=?, email=?, phone=?, assigned_to=?, source=?, status=?, priority=?, estimated_value=?, notes=?, updated_at=NOW() WHERE id=? AND company_id=?`;
    const updateParams = isSuper
        ? [b.company_name ?? lead.company_name, b.contact_person ?? lead.contact_person, b.email ?? lead.email, b.phone ?? lead.phone, b.assigned_to ?? lead.assigned_to, b.source ?? lead.source, b.status ?? lead.status, b.priority ?? lead.priority, b.estimated_value ?? lead.estimated_value, b.notes ?? lead.notes, b.id]
        : [b.company_name ?? lead.company_name, b.contact_person ?? lead.contact_person, b.email ?? lead.email, b.phone ?? lead.phone, b.assigned_to ?? lead.assigned_to, b.source ?? lead.source, b.status ?? lead.status, b.priority ?? lead.priority, b.estimated_value ?? lead.estimated_value, b.notes ?? lead.notes, b.id, req.employee.company_id];
    
    await query(updateSql, updateParams);
    await logActivity(req.employee.id, 'lead_updated', 'lead', b.id, 'Lead updated: ' + (b.company_name || lead.company_name), req);
    return res.json({ success: true, message: 'Lead updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/update_status', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const leadIdentifierRaw = b.lead_id ?? b.id ?? b.leadId ?? b.lead_code;
    const leadIdentifier = leadIdentifierRaw === undefined || leadIdentifierRaw === null
      ? ''
      : String(leadIdentifierRaw).trim();
    const nextStatus = typeof b.status === 'string' ? b.status.trim() : b.status;
    if (!leadIdentifier || nextStatus === undefined || nextStatus === null || nextStatus === '') {
      return res.status(400).json({ success: false, message: 'Lead ID and status are required' });
    }

    const isSuper = isSuperUser(req.employee);
    const isNumericId = /^\d+$/.test(leadIdentifier);
    let whereClause;
    let params;
    if (isNumericId) {
      const numericId = Number(leadIdentifier);
      whereClause = isSuper
        ? 'WHERE (id = ? OR lead_code = ?)'
        : 'WHERE (id = ? OR lead_code = ?) AND company_id = ?';
      params = isSuper
        ? [numericId, leadIdentifier]
        : [numericId, leadIdentifier, req.employee.company_id];
    } else {
      whereClause = isSuper
        ? 'WHERE lead_code = ?'
        : 'WHERE lead_code = ? AND company_id = ?';
      params = isSuper
        ? [leadIdentifier]
        : [leadIdentifier, req.employee.company_id];
    }

    const rows = await query(`SELECT id FROM leads ${whereClause} LIMIT 1`, params);
    const lead = rows[0];
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });

    await query(`UPDATE leads SET status = ?, updated_at = NOW() WHERE id = ?`, [nextStatus, lead.id]);
    await logActivity(req.employee.id, 'lead_status_updated', 'lead', lead.id, 'Lead status updated to ' + nextStatus, req);
    return res.json({ success: true, message: 'Lead status updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/crud', verifyToken, async (req, res) => {
  try {
    const id = req.body && req.body.id ? req.body.id : (req.query.id || null);
    if (!id) return res.status(400).json({ success: false, message: 'Lead ID is required' });
    const isSuper = isSuperUser(req.employee);
    const rows = isSuper 
        ? await query('SELECT * FROM leads WHERE id = ?', [id])
        : await query('SELECT * FROM leads WHERE id = ? AND company_id = ?', [id, req.employee.company_id]);
    const lead = rows[0];
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });
    const role = normalizeRole(req.employee.role);
    if (role !== 'admin' && !isSuper) {
      return res.status(403).json({ success: false, message: 'Only admin can delete leads' });
    }
    const conn = await getConnection();
    await conn.execute('DELETE FROM followups WHERE lead_id = ?', [id]);
    await conn.execute('DELETE FROM meetings WHERE lead_id = ?', [id]);
    await conn.execute('DELETE FROM tasks WHERE lead_id = ?', [id]);
    await conn.execute('DELETE FROM quotations WHERE lead_id = ?', [id]).catch(() => {});
    await conn.execute('DELETE FROM invoices WHERE lead_id = ?', [id]).catch(() => {});
    await conn.execute('DELETE FROM leads WHERE id = ?', [id]);
    conn.release();
    await logActivity(req.employee.id, 'lead_deleted', 'lead', id, 'Lead deleted: ' + lead.company_name, req);
    return res.json({ success: true, message: 'Lead and all related records deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const maxId = await query('SELECT COALESCE(MAX(id),0) as m FROM leads');
    const nextId = (maxId[0] && maxId[0].m) ? maxId[0].m + 1 : 1;
    const leadCode = b.lead_code || 'L' + String(nextId).padStart(6, '0');
    await query(
      `INSERT INTO leads (company_id, lead_code, company_name, contact_person, email, phone, assigned_to, source, status, priority, estimated_value, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.employee.company_id, leadCode, b.company_name, b.contact_person, b.email || '', b.phone || '', b.assigned_to || req.employee.id, b.source || 'website', b.status || 'new', b.priority || 'medium', b.estimated_value || 0, b.notes || '']
    );
    return res.json({ success: true, message: 'Lead created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const isSuper = isSuperUser(req.employee);
    const sql = isSuper 
        ? `UPDATE leads SET company_name=?, contact_person=?, email=?, phone=?, status=?, priority=?, notes=?, updated_at=NOW() WHERE id=?`
        : `UPDATE leads SET company_name=?, contact_person=?, email=?, phone=?, status=?, priority=?, notes=?, updated_at=NOW() WHERE id=? AND company_id=?`;
    const params = isSuper
        ? [b.company_name, b.contact_person, b.email, b.phone, b.status, b.priority, b.notes, req.params.id]
        : [b.company_name, b.contact_person, b.email, b.phone, b.status, b.priority, b.notes, req.params.id, req.employee.company_id];
        
    await query(sql, params);
    return res.json({ success: true, message: 'Lead updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/export', async (req, res, next) => {
  let token = req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token && req.query.token) token = req.query.token;
  if (!token && req.query.Authorization) token = String(req.query.Authorization).replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, message: 'Token required' });
  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    const rows = await query('SELECT * FROM employees WHERE id = ? AND status = ?', [decoded.id, 'active']);
    req.employee = rows[0];
    if (!req.employee) return res.status(401).json({ success: false, message: 'Invalid token' });
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}, async (req, res) => {
  try {
    const role = normalizeRole(req.employee.role);
    const isSuper = role === 'superadmin' || role === 'super_admin';
    const canViewAll = role === 'admin' || role === 'manager' || isSuper;
    
    let sql;
    let params = [];
    
    if (isSuper) {
        sql = 'SELECT lead_code, company_name, contact_person, email, phone, source, status, priority, estimated_value, notes, created_at FROM leads ORDER BY created_at DESC';
    } else if (canViewAll) {
        sql = 'SELECT lead_code, company_name, contact_person, email, phone, source, status, priority, estimated_value, notes, created_at FROM leads WHERE company_id = ? ORDER BY created_at DESC';
        params = [req.employee.company_id];
    } else {
        sql = 'SELECT lead_code, company_name, contact_person, email, phone, source, status, priority, estimated_value, notes, created_at FROM leads WHERE company_id = ? AND assigned_to = ? ORDER BY created_at DESC';
        params = [req.employee.company_id, req.employee.id];
    }
    
    const allRows = await query(sql, params);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="leads-export.json"');
    return res.json({ success: true, data: allRows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
