const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { generateInvoicePdfBuffer } = require('../services/templateDocumentPdf');
const { localYmd, nextDocumentNumber } = require('../utils/documentNumbers');

const router = express.Router();

// Accept common role variants stored in DB.
const allowedRoles = ['admin', 'manager', 'human_resources', 'human resources', 'human resource', 'hr', 'hr manager', 'hr_manager'];
function canSeeAll(emp) {
  return allowedRoles.includes(String(emp?.role || '').toLowerCase().trim());
}

function money2(n) {
  const v = Number.parseFloat(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

function normalizeDocumentSettings(row = {}) {
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
    bank_name: row.bank_name || '',
    account_holder_name: row.account_holder_name || row.account_name || '',
    account_number: row.account_number || '',
    ifsc_code: row.ifsc_code || '',
    branch_name: row.branch_name || '',
    nature: row.nature || 'Current Account',
    signature_path: row.signature_path || '',
    stamp_path: row.stamp_path || '',
  };
}

async function getDocumentSettings(companyId) {
  if (!companyId) return normalizeDocumentSettings();
  const settingsRows = await query(
    'SELECT * FROM company_settings WHERE company_id = ? ORDER BY id DESC LIMIT 1',
    [companyId]
  ).catch(() => []);
  if (settingsRows?.[0]) return normalizeDocumentSettings(settingsRows[0]);

  const companyRows = await query('SELECT * FROM companies WHERE id = ? LIMIT 1', [companyId]).catch(() => []);
  return normalizeDocumentSettings(companyRows?.[0] || {});
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const search = req.query.search || null;
    const status = req.query.status || null;
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;

    let sql = `SELECT i.*, l.company_name, l.contact_person, l.phone, l.email
               FROM invoices i LEFT JOIN leads l ON i.lead_id = l.id WHERE i.company_id = ?`;
    const params = [req.employee.company_id];

    if (!canSeeAll(req.employee)) {
      sql += ' AND i.employee_id = ?';
      params.push(req.employee.id);
    }

    if (search) {
      const t = '%' + String(search) + '%';
      // Some older schemas used client_name; newer uses lead/company in leads table.
      sql += ' AND (i.invoice_number LIKE ? OR COALESCE(i.client_name, l.company_name, \'\') LIKE ?)';
      params.push(t, t);
    }
    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }
    if (dateFrom) {
      sql += ' AND DATE(COALESCE(i.issue_date, i.created_at)) >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND DATE(COALESCE(i.issue_date, i.created_at)) <= ?';
      params.push(dateTo);
    }

    sql += ' ORDER BY i.created_at DESC LIMIT 200';

    const invoices = await query(sql, params).catch(() => []);
    const ids = (Array.isArray(invoices) ? invoices : []).map((r) => r.id).filter(Boolean);
    if (!ids.length) return res.json({ success: true, data: [] });

    // Attach items (if table exists). If it doesn't, keep items empty.
    let items = [];
    try {
      items = await query(`SELECT * FROM invoice_items WHERE invoice_id IN (${ids.map(() => '?').join(',')}) ORDER BY id ASC`, ids);
    } catch (_) {
      items = [];
    }
    const byInvoice = new Map();
    for (const it of Array.isArray(items) ? items : []) {
      const arr = byInvoice.get(it.invoice_id) || [];
      arr.push(it);
      byInvoice.set(it.invoice_id, arr);
    }

    const out = invoices.map((inv) => ({
      ...inv,
      items: byInvoice.get(inv.id) || [],
    }));

    return res.json({ success: true, data: out });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load invoices' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const leadId = b.lead_id ? Number(b.lead_id) : null;
    const itemsIn = Array.isArray(b.items) ? b.items : [];
    if (!leadId) return res.status(400).json({ success: false, message: 'lead_id is required' });
    if (!itemsIn.length) return res.status(400).json({ success: false, message: 'At least one item is required' });

    const taxPct = money2(b.tax_percentage || 0);
    const tdsPct = money2(b.tds_percentage || 0);
    const discPct = money2(b.discount_percentage || 0);
    const issueDate = localYmd();
    const dueDate = b.due_date ? String(b.due_date).slice(0, 10) : null;
    const notes = b.notes || '';
    const paymentTerms = b.payment_terms || '';
    const status = b.status || 'draft';

    const normItems = itemsIn.map((it) => {
      const qty = money2(it.quantity || 0);
      const unit = money2(it.unit_price || 0);
      return {
        item_name: String(it.item_name || '').trim(),
        description: it.description ? String(it.description) : null,
        quantity: qty,
        unit_price: unit,
        total_price: money2(qty * unit),
      };
    }).filter((it) => it.item_name && it.quantity > 0 && it.unit_price > 0);

    if (!normItems.length) return res.status(400).json({ success: false, message: 'Invalid items' });

    const subtotal = money2(normItems.reduce((s, it) => s + it.total_price, 0));
    const discountAmount = money2(subtotal * (discPct / 100));
    const taxable = money2(subtotal - discountAmount);
    const taxAmount = money2(taxable * (taxPct / 100));
    const tdsAmount = money2(taxable * (tdsPct / 100));
    const totalAmount = money2(taxable + taxAmount);

    const conn = await getConnection();
    let invoiceNumber = '';
    try {
      invoiceNumber = await nextDocumentNumber(conn, 'invoice', issueDate);
      await conn.beginTransaction();

      // New schema (COMPLETE_DATABASE_SETUP.sql)
      const [r] = await conn.execute(
        `INSERT INTO invoices (company_id, invoice_number, quotation_id, lead_id, employee_id, issue_date, due_date, subtotal, tax_percentage, tax_amount, tds_percentage, tds_amount, discount_percentage, discount_amount, total_amount, status, notes, payment_terms)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [req.employee.company_id, invoiceNumber, b.quotation_id || null, leadId, req.employee.id, issueDate, dueDate, subtotal, taxPct, taxAmount, tdsPct, tdsAmount, discPct, discountAmount, totalAmount, status, notes, paymentTerms]
      );
      const invoiceId = r.insertId;

      // Items table is part of the same schema, but some deployments may not have it.
      const values = [];
      const placeholders = [];
      for (const it of normItems) {
        placeholders.push('(?,?,?,?,?,?)');
        values.push(invoiceId, it.item_name, it.description, it.quantity, it.unit_price, it.total_price);
      }
      try {
        await conn.execute(
          `INSERT INTO invoice_items (invoice_id, item_name, description, quantity, unit_price, total_price) VALUES ${placeholders.join(',')}`,
          values
        );
      } catch (eItems) {
        const m = String(eItems && eItems.message ? eItems.message : eItems);
        // If table doesn't exist in older schemas, still allow invoice creation.
        if (!(m.includes("doesn't exist") || m.includes('ER_NO_SUCH_TABLE'))) {
          throw eItems;
        }
      }

      await conn.commit();
      return res.json({
        success: true,
        message: 'Invoice created',
        data: { id: invoiceId, invoice_number: invoiceNumber, total_amount: totalAmount },
      });
    } catch (e) {
      // Legacy fallback schema (older deployments)
      const msg = String(e && e.message ? e.message : e);
      if (msg.includes('Unknown column') || msg.includes('ER_BAD_FIELD_ERROR')) {
        try {
          const [r2] = await conn.execute(
            'INSERT INTO invoices (company_id, lead_id, employee_id, invoice_number, client_name, total_amount, status, due_date, notes) VALUES (?,?,?,?,?,?,?,?,?)',
            [req.employee.company_id, leadId, req.employee.id, invoiceNumber, b.client_name || '', totalAmount, status, dueDate, notes]
          );
          await conn.commit();
          return res.json({ success: true, message: 'Invoice created', data: { id: r2.insertId, invoice_number: invoiceNumber, total_amount: totalAmount } });
        } catch (fallbackErr) {
          try { await conn.rollback(); } catch (_) { }
          throw fallbackErr;
        }
      }
      try { await conn.rollback(); } catch (_) { }
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /invoices/template-settings - use the same selected format as quotations
router.get('/template-settings', verifyToken, async (req, res) => {
  try {
    const settings = await getDocumentSettings(req.employee?.company_id);
    return res.json({ success: true, data: settings });
  } catch (_) {
    return res.json({ success: true, data: normalizeDocumentSettings() });
  }
});

// GET /invoices/:id/pdf - generate invoice PDF on the same letterhead (letter-head.png)
router.get('/:id/pdf', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid invoice id' });
    }

    // Access control
    const canAll = canSeeAll(req.employee);
    const invRows = await query(
      `SELECT i.*, l.company_name, l.contact_person, l.phone as company_phone, l.email as company_email
       FROM invoices i
       LEFT JOIN leads l ON i.lead_id = l.id
       WHERE i.id = ? AND i.company_id = ? ${canAll ? '' : 'AND i.employee_id = ?'}`,
      canAll ? [id, req.employee.company_id] : [id, req.employee.company_id, req.employee.id]
    );
    const inv = Array.isArray(invRows) ? invRows[0] : null;
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });

    let items = [];
    try {
      items = await query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC', [id]);
    } catch (_) {
      items = [];
    }

    const settings = await getDocumentSettings(req.employee?.company_id);
    const pdfBuffer = await generateInvoicePdfBuffer({
      ...inv,
      client_phone: inv.client_phone || inv.company_phone || inv.phone || '',
      client_email: inv.client_email || inv.company_email || inv.email || '',
      client_address: inv.client_address || inv.address || '',
      items,
    }, settings);
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 100) {
      return res.status(500).json({ success: false, message: 'Failed to generate invoice PDF' });
    }

    const wantsDownload =
      req.query.download === '1' || req.query.download === 'true' || req.query.disposition === 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    const numberPart = String(inv.invoice_number || `INV-${id}`).trim();
    const safeName = `invoice_${numberPart.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
    res.setHeader('Content-Disposition', `${wantsDownload ? 'attachment' : 'inline'}; filename="${safeName}"`);
    return res.end(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to generate invoice PDF' });
  }
});

// PUT /invoices/:id - update invoice + items (recalculates totals)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid invoice id' });
    }
    const b = req.body || {};
    const canAll = canSeeAll(req.employee);

    // Load existing for access + legacy fallback defaults
    const invRows = await query(
      `SELECT * FROM invoices WHERE id = ? AND company_id = ? ${canAll ? '' : 'AND employee_id = ?'}`,
      canAll ? [id, req.employee.company_id] : [id, req.employee.company_id, req.employee.id]
    );
    const existing = Array.isArray(invRows) ? invRows[0] : null;
    if (!existing) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const leadId = b.lead_id ? Number(b.lead_id) : existing.lead_id || null;
    const itemsIn = Array.isArray(b.items) ? b.items : [];
    if (!leadId) return res.status(400).json({ success: false, message: 'lead_id is required' });
    if (!itemsIn.length) return res.status(400).json({ success: false, message: 'At least one item is required' });

    const taxPct = money2(b.tax_percentage != null ? b.tax_percentage : existing.tax_percentage || 0);
    const tdsPct = money2(b.tds_percentage != null ? b.tds_percentage : existing.tds_percentage || 0);
    const discPct = money2(b.discount_percentage != null ? b.discount_percentage : existing.discount_percentage || 0);
    const dueDate = b.due_date ? String(b.due_date).slice(0, 10) : (existing.due_date ? String(existing.due_date).slice(0, 10) : null);
    const notes = b.notes != null ? String(b.notes) : (existing.notes || '');
    const paymentTerms = b.payment_terms != null ? String(b.payment_terms) : (existing.payment_terms || '');
    const status = b.status != null ? String(b.status) : (existing.status || 'draft');

    const normItems = itemsIn.map((it) => {
      const qty = money2(it.quantity || 0);
      const unit = money2(it.unit_price || 0);
      return {
        item_name: String(it.item_name || '').trim(),
        description: it.description ? String(it.description) : null,
        quantity: qty,
        unit_price: unit,
        total_price: money2(qty * unit),
      };
    }).filter((it) => it.item_name && it.quantity > 0 && it.unit_price > 0);
    if (!normItems.length) return res.status(400).json({ success: false, message: 'Invalid items' });

    const subtotal = money2(normItems.reduce((s, it) => s + it.total_price, 0));
    const discountAmount = money2(subtotal * (discPct / 100));
    const taxable = money2(subtotal - discountAmount);
    const taxAmount = money2(taxable * (taxPct / 100));
    const tdsAmount = money2(taxable * (tdsPct / 100));
    const totalAmount = money2(taxable + taxAmount);

    const conn = await getConnection();
    try {
      // Prefer new schema
      await conn.execute(
        `UPDATE invoices SET
           lead_id=?,
           due_date=?,
           subtotal=?,
           tax_percentage=?,
           tax_amount=?,
           tds_percentage=?,
           tds_amount=?,
           discount_percentage=?,
           discount_amount=?,
           total_amount=?,
           status=?,
           notes=?,
           payment_terms=?,
           updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [leadId, dueDate, subtotal, taxPct, taxAmount, tdsPct, tdsAmount, discPct, discountAmount, totalAmount, status, notes, paymentTerms, id]
      );

      // Replace items if table exists
      try {
        await conn.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
        const values = [];
        const placeholders = [];
        for (const it of normItems) {
          placeholders.push('(?,?,?,?,?,?)');
          values.push(id, it.item_name, it.description, it.quantity, it.unit_price, it.total_price);
        }
        await conn.execute(
          `INSERT INTO invoice_items (invoice_id, item_name, description, quantity, unit_price, total_price) VALUES ${placeholders.join(',')}`,
          values
        );
      } catch (eItems) {
        const m = String(eItems && eItems.message ? eItems.message : eItems);
        if (!(m.includes("doesn't exist") || m.includes('ER_NO_SUCH_TABLE'))) {
          throw eItems;
        }
      }

      return res.json({ success: true, message: 'Invoice updated', data: { id, total_amount: totalAmount } });
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      // Legacy fallback
      if (msg.includes('Unknown column') || msg.includes('ER_BAD_FIELD_ERROR')) {
        await conn.execute(
          'UPDATE invoices SET lead_id=?, total_amount=?, status=?, due_date=?, notes=? WHERE id=?',
          [leadId, totalAmount, status, dueDate, notes, id]
        );
        return res.json({ success: true, message: 'Invoice updated', data: { id, total_amount: totalAmount } });
      }
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update invoice' });
  }
});

// PATCH /invoices/:id/status - quick status update
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid invoice id' });
    const status = String(req.body?.status || '').toLowerCase().trim();
    const allowed = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const canAll = canSeeAll(req.employee);
    const params = [status, id, req.employee.company_id];
    let sql = 'UPDATE invoices SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?';
    if (!canAll) { sql += ' AND employee_id=?'; params.push(req.employee.id); }
    const r = await query(sql, params);
    if (r && typeof r.affectedRows === 'number' && r.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    return res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update status' });
  }
});

// DELETE /invoices/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid invoice id' });
    const canAll = canSeeAll(req.employee);
    const params = [id, req.employee.company_id];
    let sql = 'DELETE FROM invoices WHERE id = ? AND company_id = ?';
    if (!canAll) { sql += ' AND employee_id=?'; params.push(req.employee.id); }
    const r = await query(sql, params);
    if (r && typeof r.affectedRows === 'number' && r.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    return res.json({ success: true, message: 'Invoice deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete invoice' });
  }
});

module.exports = router;
