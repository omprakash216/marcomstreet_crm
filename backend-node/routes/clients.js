const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { cleanParams, getSafePagination } = require('../utils/queryHelpers');

const router = express.Router();

function normalizeRole(role) {
  return String(role || '').toLowerCase().replace(/[\s-]+/g, '_').trim();
}

function isSuperUser(employee) {
  const role = normalizeRole(employee?.role);
  return role === 'superadmin' || role === 'super_admin';
}

function toPositiveInt(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function formatClientCode(id) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return '';
  return `CL-${String(numericId).padStart(6, '0')}`;
}

function mapClientRow(row) {
  if (!row) return row;
  const clientCode = row.client_code || formatClientCode(row.id);
  return {
    ...row,
    id: Number(row.id),
    client_code: clientCode,
    status: String(row.status || 'active').toLowerCase(),
    full_name: row.full_name || '',
    company_name: row.company_name || '',
    phone_number: row.phone_number || '',
    email: row.email || '',
    created_by_name: row.created_by_name || row.created_by_email || (row.created_by ? `Employee ${row.created_by}` : 'System'),
  };
}

// ─── GET all clients ───────────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const isSuper = isSuperUser(req.employee);
    const companyId = toPositiveInt(req.employee.company_id);
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    const { page, safeLimit, safeOffset } = getSafePagination(req.query, { defaultLimit: 25, maxLimit: 1000 });

    let where = [];
    const params = [];

    if (!isSuper) {
      where.push('sc.company_id = ?');
      params.push(companyId);
    }
    if (status) {
      where.push('LOWER(sc.status) = ?');
      params.push(status);
    }
    if (search) {
      const t = `%${search}%`;
      where.push(`(
        sc.full_name LIKE ?
        OR sc.company_name LIKE ?
        OR sc.email LIKE ?
        OR sc.phone_number LIKE ?
        OR sc.gst_number LIKE ?
        OR sc.pan_number LIKE ?
        OR CONCAT('CL-', LPAD(sc.id, 6, '0')) LIKE ?
      )`);
      params.push(t, t, t, t, t, t, t);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const fromSql = `FROM sales_clients sc LEFT JOIN employees creator ON creator.id = sc.created_by`;
    const countRows = await query(`SELECT COUNT(*) as total ${fromSql} ${whereSql}`, cleanParams(params));
    const total = Number(countRows?.[0]?.total || 0);

    const rows = await query(
      `SELECT sc.*, CONCAT('CL-', LPAD(sc.id, 6, '0')) AS client_code,
              creator.name AS created_by_name,
              creator.email AS created_by_email
       ${fromSql} ${whereSql}
       ORDER BY sc.created_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      cleanParams(params)
    );

    return res.json({ success: true, data: rows.map(mapClientRow), total, page, limit: safeLimit, has_next: rows.length === safeLimit });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET single client by ID ───────────────────────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const isSuper = isSuperUser(req.employee);
    const companyId = toPositiveInt(req.employee.company_id);
    const clientId = toPositiveInt(req.params.id) || req.params.id;
    const sql = isSuper
      ? `SELECT sc.*, CONCAT('CL-', LPAD(sc.id, 6, '0')) AS client_code,
                creator.name AS created_by_name,
                creator.email AS created_by_email
         FROM sales_clients sc
         LEFT JOIN employees creator ON creator.id = sc.created_by
         WHERE sc.id = ?`
      : `SELECT sc.*, CONCAT('CL-', LPAD(sc.id, 6, '0')) AS client_code,
                creator.name AS created_by_name,
                creator.email AS created_by_email
         FROM sales_clients sc
         LEFT JOIN employees creator ON creator.id = sc.created_by
         WHERE sc.id = ? AND sc.company_id = ?`;
    const params = isSuper ? [clientId] : [clientId, companyId];
    const rows = await query(sql, cleanParams(params));
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Client not found' });
    return res.json({ success: true, data: mapClientRow(rows[0]) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST create client ────────────────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const companyId = toPositiveInt(req.employee.company_id);
    if (!b.full_name || !b.full_name.trim()) {
      return res.status(400).json({ success: false, message: 'Client full name is required' });
    }

    const cleanAadhar = (b.aadhar_number && String(b.aadhar_number).trim() && String(b.aadhar_number).toLowerCase().trim() !== 'null' && String(b.aadhar_number).toLowerCase().trim() !== 'undefined')
      ? String(b.aadhar_number).replace(/\s/g, '')
      : null;

    const cleanPan = (b.pan_number && String(b.pan_number).trim() && String(b.pan_number).toLowerCase().trim() !== 'null' && String(b.pan_number).toLowerCase().trim() !== 'undefined')
      ? String(b.pan_number).toUpperCase().trim()
      : null;

    const cleanGst = (b.gst_number && String(b.gst_number).trim() && String(b.gst_number).toLowerCase().trim() !== 'null' && String(b.gst_number).toLowerCase().trim() !== 'undefined')
      ? String(b.gst_number).toUpperCase().trim()
      : null;

    // Validate Aadhar (12 digits if provided)
    if (cleanAadhar && !/^\d{12}$/.test(cleanAadhar)) {
      return res.status(400).json({ success: false, message: 'Aadhar number must be 12 digits' });
    }
    // Validate PAN (10 alphanumeric if provided)
    if (cleanPan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      return res.status(400).json({ success: false, message: 'PAN number format invalid (e.g. ABCDE1234F)' });
    }
    // Validate GST (15 chars if provided)
    if (cleanGst && !/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(cleanGst)) {
      return res.status(400).json({ success: false, message: 'GST number format invalid (e.g. 29ABCDE1234F1Z5)' });
    }

    const conn = await getConnection();
    const [result] = await conn.execute(
      `INSERT INTO sales_clients
        (company_id, full_name, company_name, phone_number, email,
         address, city, state, postal_code,
         aadhar_number, pan_number, gst_number,
         status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        companyId,
        b.full_name.trim(),
        b.company_name?.trim() || null,
        b.phone_number?.trim() || null,
        b.email?.trim() || null,
        b.address?.trim() || null,
        b.city?.trim() || null,
        b.state?.trim() || null,
        b.postal_code?.trim() || null,
        cleanAadhar,
        cleanPan,
        cleanGst,
        String(b.status || 'active').toLowerCase().trim() || 'active',
        req.employee.id,
      ]
    );
    conn.release();

    return res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: { id: result.insertId, client_code: formatClientCode(result.insertId) },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'A client with this record already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT update client ─────────────────────────────────────────────────────
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const isSuper = isSuperUser(req.employee);
    const companyId = toPositiveInt(req.employee.company_id);
    const clientId = toPositiveInt(req.params.id) || req.params.id;
    const b = req.body || {};

    const cleanAadhar = (b.aadhar_number && String(b.aadhar_number).trim() && String(b.aadhar_number).toLowerCase().trim() !== 'null' && String(b.aadhar_number).toLowerCase().trim() !== 'undefined')
      ? String(b.aadhar_number).replace(/\s/g, '')
      : null;

    const cleanPan = (b.pan_number && String(b.pan_number).trim() && String(b.pan_number).toLowerCase().trim() !== 'null' && String(b.pan_number).toLowerCase().trim() !== 'undefined')
      ? String(b.pan_number).toUpperCase().trim()
      : null;

    const cleanGst = (b.gst_number && String(b.gst_number).trim() && String(b.gst_number).toLowerCase().trim() !== 'null' && String(b.gst_number).toLowerCase().trim() !== 'undefined')
      ? String(b.gst_number).toUpperCase().trim()
      : null;

    // Validate if provided
    if (cleanAadhar && !/^\d{12}$/.test(cleanAadhar)) {
      return res.status(400).json({ success: false, message: 'Aadhar number must be 12 digits' });
    }
    if (cleanPan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      return res.status(400).json({ success: false, message: 'PAN number format invalid' });
    }
    if (cleanGst && !/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(cleanGst)) {
      return res.status(400).json({ success: false, message: 'GST number format invalid' });
    }

    const sql = isSuper
      ? `UPDATE sales_clients SET
           full_name=?, company_name=?, phone_number=?, email=?,
           address=?, city=?, state=?, postal_code=?,
           aadhar_number=?, pan_number=?, gst_number=?, status=?
         WHERE id=?`
      : `UPDATE sales_clients SET
           full_name=?, company_name=?, phone_number=?, email=?,
           address=?, city=?, state=?, postal_code=?,
           aadhar_number=?, pan_number=?, gst_number=?, status=?
         WHERE id=? AND company_id=?`;

    const baseParams = [
      b.full_name?.trim() || null,
      b.company_name?.trim() || null,
      b.phone_number?.trim() || null,
      b.email?.trim() || null,
      b.address?.trim() || null,
      b.city?.trim() || null,
      b.state?.trim() || null,
      b.postal_code?.trim() || null,
      cleanAadhar,
      cleanPan,
      cleanGst,
      String(b.status || 'active').toLowerCase().trim() || 'active',
      clientId,
    ];

    const params = isSuper ? baseParams : [...baseParams, companyId];
    await query(sql, params);
    return res.json({ success: true, message: 'Client updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE client ─────────────────────────────────────────────────────────
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const isSuper = isSuperUser(req.employee);
    const role = normalizeRole(req.employee.role);
    if (role !== 'admin' && !isSuper) {
      return res.status(403).json({ success: false, message: 'Only admin can delete clients' });
    }
    const sql = isSuper
      ? 'DELETE FROM sales_clients WHERE id = ?'
      : 'DELETE FROM sales_clients WHERE id = ? AND company_id = ?';
    const params = isSuper
      ? [toPositiveInt(req.params.id) || req.params.id]
      : [toPositiveInt(req.params.id) || req.params.id, toPositiveInt(req.employee.company_id)];
    await query(sql, params);
    return res.json({ success: true, message: 'Client deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
