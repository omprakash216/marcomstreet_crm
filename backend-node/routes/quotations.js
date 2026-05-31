const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { localYmd, nextDocumentNumber } = require('../utils/documentNumbers');

const router = express.Router();

function isManagerOrAdmin(employee) {
  const role = (employee?.role || '').toLowerCase();
  return role === 'manager' || role === 'admin' || role === 'superadmin' || role === 'super_admin';
}

function normalizeQuotationSettings(row = {}) {
  return {
    company_name: row.company_name || row.name || 'Company Name',
    email: row.email || '',
    phone: row.phone || '',
    address: row.address || '',
    gst_number: row.gst_number || row.tax_id || '',
    pan_number: row.pan_number || row.registration_number || '',
    logo_path: row.logo_path || '',
    quotation_template: row.quotation_template || 'standard',
    quotation_header_text: row.quotation_header_text || '',
    quotation_footer_text: row.quotation_footer_text || 'Thank you for your business!',
  };
}

async function getQuotationSettings(companyId) {
  if (!companyId) return normalizeQuotationSettings();
  const settingsRows = await query(
    'SELECT * FROM company_settings WHERE company_id = ? ORDER BY id DESC LIMIT 1',
    [companyId]
  ).catch(() => []);
  if (settingsRows?.[0]) return normalizeQuotationSettings(settingsRows[0]);

  const companyRows = await query('SELECT * FROM companies WHERE id = ? LIMIT 1', [companyId]).catch(() => []);
  return normalizeQuotationSettings(companyRows?.[0] || {});
}

// GET /quotations - sales see own; manager/admin see all; ?pending_approval=1 for status=sent only
router.get('/', verifyToken, async (req, res) => {
  try {
    const search = req.query.search || null;
    const status = req.query.status || null;
    const pendingApproval = req.query.pending_approval === '1' || req.query.pending_approval === 'true';
    const empId = req.employee?.id;
    const manager = isManagerOrAdmin(req.employee);

    let sql = `SELECT q.*, l.company_name, l.contact_person
      FROM quotations q LEFT JOIN leads l ON q.lead_id = l.id WHERE q.company_id = ?`;
    const params = [req.employee.company_id];
    if (!manager && empId) {
      sql += ' AND q.employee_id = ?';
      params.push(empId);
    }
    if (pendingApproval) {
      sql += ' AND q.status = ?';
      params.push('sent');
    } else if (status) {
      sql += ' AND q.status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (l.company_name LIKE ? OR l.contact_person LIKE ? OR q.quotation_number LIKE ?)';
      const t = '%' + search + '%';
      params.push(t, t, t);
    }
    sql += ' ORDER BY q.created_at DESC LIMIT 100';
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error('Quotations GET:', err.message);
    return res.json({ success: true, data: [] });
  }
});

// GET /quotations/template-settings - company selected PDF quotation format
router.get('/template-settings', verifyToken, async (req, res) => {
  try {
    const settings = await getQuotationSettings(req.employee?.company_id);
    return res.json({ success: true, data: settings });
  } catch (err) {
    return res.json({ success: true, data: normalizeQuotationSettings() });
  }
});

// GET /quotations/:id - get single quotation with items
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });

    // Fetch quotation details
    const quotationRows = await query(
      `SELECT q.*, l.company_name, l.contact_person
       FROM quotations q
       LEFT JOIN leads l ON q.lead_id = l.id
       WHERE q.id = ? AND q.company_id = ?`,
      [id, req.employee.company_id]
    );

    const quotation = Array.isArray(quotationRows) ? quotationRows[0] : null;
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // Access check: non-managers can only view their own quotations
    if (!isManagerOrAdmin(req.employee) && quotation.employee_id !== req.employee.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Fetch quotation items
    const items = await query(
      'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC',
      [id]
    );

    quotation.items = items || [];

    return res.json({ success: true, data: quotation });
  } catch (err) {
    console.error('Quotation GET by ID error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /quotations - create (sales): draft or send for approval (status sent)
router.post('/', verifyToken, async (req, res) => {
  let conn;
  try {
    const b = req.body || {};
    const empId = req.employee?.id;
    if (!empId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const leadId = b.lead_id || null;
    const items = Array.isArray(b.items) ? b.items : [];
    const subtotal = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
    const discountPct = Number(b.discount_percentage) || 0;
    const discountAmount = (subtotal * discountPct) / 100;
    const taxable = subtotal - discountAmount;
    const taxPct = Number(b.tax_percentage) || 0;
    const taxAmount = (taxable * taxPct) / 100;
    const totalAmount = taxable + taxAmount;
    const issueDate = b.issue_date || localYmd();
    const validUntil = b.valid_until || null;
    const notes = b.notes || '';
    const termsConditions = b.terms_conditions || '';
    const sendForApproval = b.send_for_approval === true || b.send_for_approval === 'true';
    const status = sendForApproval ? 'sent' : (b.status || 'draft');

    conn = await getConnection();
    const quotationNumber = await nextDocumentNumber(conn, 'quotation', issueDate);
    await conn.beginTransaction();
    const [r] = await conn.execute(
      `INSERT INTO quotations (company_id, quotation_number, lead_id, employee_id, issue_date, valid_until, subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount, total_amount, status, notes, terms_conditions)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.employee.company_id, quotationNumber, leadId, empId, issueDate, validUntil, subtotal, taxPct, taxAmount, discountPct, discountAmount, totalAmount, status, notes, termsConditions]
    );
    const quotationId = r.insertId;
    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const up = Number(item.unit_price) || 0;
      const totalPrice = qty * up;
      await conn.execute(
        'INSERT INTO quotation_items (quotation_id, item_name, description, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)',
        [quotationId, item.item_name || '', item.description || '', qty, up, totalPrice]
      );
    }
    await conn.commit();
    conn.release();
    return res.json({
      success: true,
      message: sendForApproval ? 'Quotation sent for manager approval.' : 'Quotation created.',
      data: { id: quotationId, quotation_number: quotationNumber },
    });
  } catch (err) {
    if (conn && conn.rollback) {
      try { await conn.rollback(); } catch (_) { }
    }
    if (conn && conn.release) conn.release();
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /quotations/:id/send - sales: send for manager approval (status = sent)
router.put('/:id/send', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const rows = await query('SELECT id, employee_id, status FROM quotations WHERE id = ? AND company_id = ?', [id, req.employee.company_id]);
    const q = Array.isArray(rows) ? rows[0] : null;
    if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (q.employee_id !== req.employee.id) return res.status(403).json({ success: false, message: 'Only the creator can send for approval' });
    if (q.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft quotations can be sent for approval' });
    await query('UPDATE quotations SET status = ? WHERE id = ? AND company_id = ?', ['sent', id, req.employee.company_id]);
    return res.json({ success: true, message: 'Quotation sent for manager approval.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /quotations/:id/approve - manager/admin only: approve or reject
router.put('/:id/approve', verifyToken, async (req, res) => {
  try {
    if (!isManagerOrAdmin(req.employee)) return res.status(403).json({ success: false, message: 'Only manager or admin can approve quotations' });
    const id = parseInt(req.params.id, 10);
    const status = (req.body?.status || '').toLowerCase();
    if (!id || !['accepted', 'rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid ID or status (accepted/rejected)' });
    const rows = await query('SELECT id, status FROM quotations WHERE id = ? AND company_id = ?', [id, req.employee.company_id]);
    const q = Array.isArray(rows) ? rows[0] : null;
    if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (q.status !== 'sent') return res.status(400).json({ success: false, message: 'Only quotations pending approval can be approved or rejected' });
    await query('UPDATE quotations SET status = ? WHERE id = ? AND company_id = ?', [status, id, req.employee.company_id]);
    return res.json({ success: true, message: status === 'accepted' ? 'Quotation approved.' : 'Quotation rejected.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/', verifyToken, async (req, res) => {
  try {
    const id = Number((req.body && req.body.id ? req.body.id : req.query.id) || 0);
    if (!id) return res.status(400).json({ success: false, message: 'ID required' });
    const rows = await query('SELECT id, employee_id FROM quotations WHERE id = ? AND company_id = ?', [id, req.employee.company_id]);
    const q = Array.isArray(rows) ? rows[0] : null;
    if (q && q.employee_id !== req.employee.id && !isManagerOrAdmin(req.employee)) {
      return res.status(403).json({ success: false, message: 'Not allowed to delete this quotation' });
    }
    await query('DELETE FROM quotation_items WHERE quotation_id = ?', [id]);
    await query('DELETE FROM quotations WHERE id = ? AND company_id = ?', [id, req.employee.company_id]);
    return res.json({ success: true, message: 'Quotation deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
