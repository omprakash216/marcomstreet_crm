const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLog');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const id = req.query.id || null;
    if (id) {
      const rows = await query('SELECT * FROM leads WHERE id = ?', [id]);
      const lead = rows[0];
      if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
      return res.json({ success: true, data: lead });
    }
    const status = req.query.status || null;
    const search = req.query.search || null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const offset = ((parseInt(req.query.page, 10) || 1) - 1) * limit;

    let sql = `SELECT l.id, l.lead_code, l.company_name, l.contact_person, l.email, l.phone,
               l.assigned_to, l.source, l.status, l.priority, l.estimated_value, l.notes,
               l.next_followup_date, l.created_at, l.updated_at
               FROM leads l WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND l.status = ?'; params.push(status); }
    if (search) {
      sql += ' AND (l.company_name LIKE ? OR l.contact_person LIKE ? OR l.email LIKE ?)';
      const term = '%' + search + '%';
      params.push(term, term, term);
    }
    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
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
      `INSERT INTO leads (lead_code, company_name, contact_person, email, phone, assigned_to, source, status, priority, estimated_value, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [leadCode, b.company_name, b.contact_person, b.email || null, b.phone || null, b.assigned_to || req.employee.id, b.source || 'website', b.status || 'new', b.priority || 'medium', b.estimated_value || null, b.notes || null]
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
    const rows = await query('SELECT * FROM leads WHERE id = ?', [b.id]);
    const lead = rows[0];
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    const role = (req.employee.role || '').toLowerCase();
    if (role !== 'admin' && lead.assigned_to !== req.employee.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to modify this lead' });
    }
    await query(
      `UPDATE leads SET company_name=?, contact_person=?, email=?, phone=?, assigned_to=?, source=?, status=?, priority=?, estimated_value=?, notes=?, updated_at=NOW() WHERE id=?`,
      [b.company_name ?? lead.company_name, b.contact_person ?? lead.contact_person, b.email ?? lead.email, b.phone ?? lead.phone, b.assigned_to ?? lead.assigned_to, b.source ?? lead.source, b.status ?? lead.status, b.priority ?? lead.priority, b.estimated_value ?? lead.estimated_value, b.notes ?? lead.notes, b.id]
    );
    await logActivity(req.employee.id, 'lead_updated', 'lead', b.id, 'Lead updated: ' + (b.company_name || lead.company_name), req);
    return res.json({ success: true, message: 'Lead updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/update_status', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.lead_id || b.status === undefined) return res.status(400).json({ success: false, message: 'Lead ID and status are required' });
    const rows = await query('SELECT * FROM leads WHERE id = ? AND assigned_to = ?', [b.lead_id, req.employee.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Lead not found' });
    await query('UPDATE leads SET status = ?, updated_at = NOW() WHERE id = ?', [b.status, b.lead_id]);
    await logActivity(req.employee.id, 'lead_status_updated', 'lead', b.lead_id, 'Lead status updated to ' + b.status, req);
    return res.json({ success: true, message: 'Lead status updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/crud', verifyToken, async (req, res) => {
  try {
    const id = req.body && req.body.id ? req.body.id : (req.query.id || null);
    if (!id) return res.status(400).json({ success: false, message: 'Lead ID is required' });
    const rows = await query('SELECT * FROM leads WHERE id = ?', [id]);
    const lead = rows[0];
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    if ((req.employee.role || '').toLowerCase() !== 'admin') {
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
      `INSERT INTO leads (lead_code, company_name, contact_person, email, phone, assigned_to, source, status, priority, estimated_value, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [leadCode, b.company_name, b.contact_person, b.email || '', b.phone || '', b.assigned_to || req.employee.id, b.source || 'website', b.status || 'new', b.priority || 'medium', b.estimated_value || 0, b.notes || '']
    );
    return res.json({ success: true, message: 'Lead created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    await query(
      `UPDATE leads SET company_name=?, contact_person=?, email=?, phone=?, status=?, priority=?, notes=?, updated_at=NOW() WHERE id=?`,
      [b.company_name, b.contact_person, b.email, b.phone, b.status, b.priority, b.notes, req.params.id]
    );
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
    const role = (req.employee.role || '').toLowerCase();
    const allRows = role === 'admin' || role === 'manager'
      ? await query('SELECT lead_code, company_name, contact_person, email, phone, source, status, priority, estimated_value, notes, created_at FROM leads ORDER BY created_at DESC')
      : await query('SELECT lead_code, company_name, contact_person, email, phone, source, status, priority, estimated_value, notes, created_at FROM leads WHERE assigned_to = ? ORDER BY created_at DESC', [req.employee.id]);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="leads-export.json"');
    return res.json({ success: true, data: allRows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
