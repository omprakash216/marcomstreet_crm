const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLog');
const { generateInvoicePdfBuffer } = require('../services/templateDocumentPdf');
const { sendSalesDocumentEmail } = require('../services/salesDocumentMailer');
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

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeStatus(status, fallback = 'draft') {
  const normalized = normalizeText(status || fallback).toLowerCase();
  const allowed = new Set(['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void']);
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function deriveDueDate(issueDate, paymentTerms, explicitDueDate = '') {
  const explicit = normalizeDate(explicitDueDate);
  if (explicit) return explicit;
  const base = normalizeDate(issueDate) || localYmd();
  const term = normalizeText(paymentTerms).toLowerCase();
  const match = term.match(/net\s*(\d+)/i);
  let days = 0;
  if (match) days = Number(match[1]) || 0;
  else if (/net 15/.test(term)) days = 15;
  else if (/net 30/.test(term)) days = 30;
  else if (/net 7/.test(term)) days = 7;
  else if (/custom/.test(term)) days = 0;
  if (!days) return base;
  const date = new Date(`${base}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeInvoiceItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const quantity = money2(item?.quantity || 0);
      const unitPrice = money2(item?.unit_price || 0);
      const discount = money2(item?.discount_percentage || 0);
      const tax = money2(item?.tax_percentage || 0);
      const base = money2(quantity * unitPrice);
      const discountAmount = money2(base * (discount / 100));
      const taxable = money2(base - discountAmount);
      const taxAmount = money2(taxable * (tax / 100));
      return {
        item_name: normalizeText(item?.item_name),
        description: normalizeText(item?.description),
        quantity,
        unit_price: unitPrice,
        discount_percentage: discount,
        tax_percentage: tax,
        total_price: money2(taxable + taxAmount),
      };
    })
    .filter((item) => item.item_name && item.quantity > 0);
}

function calculateInvoiceTotals(items = [], body = {}) {
  const subtotal = money2(items.reduce((sum, item) => sum + money2(item.quantity * item.unit_price), 0));
  const discountPct = money2(body.discount_percentage || 0);
  const taxPct = money2(body.tax_percentage || 0);
  const tdsPct = money2(body.tds_percentage || 0);
  const adjustmentAmount = money2(body.adjustment_amount || 0);
  const roundOffAmount = money2(body.round_off_amount || 0);
  const discountAmount = money2(subtotal * (discountPct / 100));
  const taxable = money2(subtotal - discountAmount);
  const taxAmount = money2(taxable * (taxPct / 100));
  const tdsAmount = money2(taxable * (tdsPct / 100));
  const totalAmount = money2(taxable + taxAmount - tdsAmount + adjustmentAmount + roundOffAmount);

  return {
    subtotal,
    discount_percentage: discountPct,
    discount_amount: discountAmount,
    tax_percentage: taxPct,
    tax_amount: taxAmount,
    tds_percentage: tdsPct,
    tds_amount: tdsAmount,
    adjustment_amount: adjustmentAmount,
    round_off_amount: roundOffAmount,
    total_amount: totalAmount,
  };
}

async function loadCustomerContext(companyId, body = {}, fallbackLeadId = null) {
  const clientId = body.client_id ? Number(body.client_id) : null;
  if (clientId) {
    const clientRows = await query(
      `SELECT sc.*, CONCAT('CL-', LPAD(sc.id, 6, '0')) AS client_code
       FROM sales_clients sc
       WHERE sc.id = ? AND sc.company_id = ? LIMIT 1`,
      [clientId, companyId]
    ).catch(() => []);
    const client = clientRows?.[0] || null;
    if (client) {
      return {
        client_id: client.id,
        lead_id: null,
        customer_name: client.company_name || client.full_name || '',
        contact_person: client.full_name || client.company_name || '',
        customer_phone: client.phone_number || '',
        customer_email: client.email || '',
        billing_address: body.billing_address || client.address || '',
        shipping_address: body.shipping_address || client.address || '',
        gst_number: body.gst_number || client.gst_number || '',
        place_of_supply: body.place_of_supply || client.state || '',
        customer: client,
      };
    }
  }

  const leadId = body.lead_id ? Number(body.lead_id) : (fallbackLeadId ? Number(fallbackLeadId) : null);
  if (leadId) {
    const leadRows = await query(
      'SELECT * FROM leads WHERE id = ? AND company_id = ? LIMIT 1',
      [leadId, companyId]
    ).catch(() => []);
    const lead = leadRows?.[0] || null;
    if (lead) {
      return {
        client_id: null,
        lead_id: lead.id,
        customer_name: lead.company_name || '',
        contact_person: lead.contact_person || lead.company_name || '',
        customer_phone: lead.phone || '',
        customer_email: lead.email || '',
        billing_address: body.billing_address || lead.address || '',
        shipping_address: body.shipping_address || lead.address || '',
        gst_number: body.gst_number || '',
        place_of_supply: body.place_of_supply || '',
        customer: lead,
      };
    }
  }

  return {
    client_id: clientId,
    lead_id: leadId,
    customer_name: '',
    contact_person: '',
    customer_phone: '',
    customer_email: '',
    billing_address: body.billing_address || '',
    shipping_address: body.shipping_address || '',
    gst_number: body.gst_number || '',
    place_of_supply: body.place_of_supply || '',
    customer: null,
  };
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

function buildInvoiceSnapshot(invoice = {}, items = [], payments = []) {
  return {
    invoice: {
      id: invoice.id || null,
      invoice_number: invoice.invoice_number || '',
      client_id: invoice.client_id || null,
      lead_id: invoice.lead_id || null,
      issue_date: invoice.issue_date || '',
      due_date: invoice.due_date || '',
      status: invoice.status || 'draft',
      total_amount: money2(invoice.total_amount || 0),
    },
    items,
    payments,
  };
}

async function loadInvoiceDetails(invoiceId, companyId, canAll, employeeId) {
  const rows = await query(
    `SELECT i.*,
            COALESCE(c.company_name, c.full_name, l.company_name, '') AS customer_name,
            COALESCE(c.full_name, l.contact_person, '') AS contact_person,
            COALESCE(c.phone_number, l.phone, '') AS customer_phone,
            COALESCE(c.email, l.email, '') AS customer_email,
            COALESCE(i.billing_address, c.address, l.address, '') AS customer_address,
            c.city AS customer_city,
            c.state AS customer_state,
            c.postal_code AS customer_postal_code,
            c.gst_number AS customer_gst_number,
            c.pan_number AS customer_pan_number,
            e.name AS employee_name
     FROM invoices i
     LEFT JOIN sales_clients c ON i.client_id = c.id
     LEFT JOIN leads l ON i.lead_id = l.id
     LEFT JOIN employees e ON i.employee_id = e.id
     WHERE i.id = ? AND i.company_id = ? ${canAll ? '' : 'AND i.employee_id = ?'}
     LIMIT 1`,
    canAll ? [invoiceId, companyId] : [invoiceId, companyId, employeeId]
  ).catch(() => []);
  const invoice = Array.isArray(rows) ? rows[0] : null;
  if (!invoice) return null;

  const items = await query(
    'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC',
    [invoiceId]
  ).catch(() => []);

  const payments = await query(
    `SELECT p.*, ba.bank_name, ba.account_number
     FROM invoice_payments p
     LEFT JOIN bank_accounts ba ON ba.id = p.account_id
     WHERE p.invoice_id = ? AND p.company_id = ?
     ORDER BY p.payment_date DESC, p.id DESC`,
    [invoiceId, companyId]
  ).catch(() => []);

  let activities = await query(
    `SELECT a.*, e.name AS employee_name
     FROM invoice_activities a
     LEFT JOIN employees e ON e.id = a.created_by
     WHERE a.invoice_id = ? AND (a.company_id = ? OR a.company_id IS NULL)
     ORDER BY a.created_at DESC`,
    [invoiceId, companyId]
  ).catch(() => []);
  if (!activities.length) {
    activities = await query(
      `SELECT a.*, e.name AS employee_name
       FROM activity_logs a
       LEFT JOIN employees e ON e.id = a.employee_id
       WHERE a.entity_type = 'invoice' AND a.entity_id = ?
       ORDER BY a.created_at DESC`,
      [invoiceId]
    ).catch(() => []);
  }

  const paidAmount = money2((Array.isArray(payments) ? payments : []).reduce((sum, payment) => sum + money2(payment.amount || 0), 0));
  const totalAmount = money2(invoice.total_amount || 0);
  const dueAmount = Math.max(0, money2(totalAmount - paidAmount));
  const today = localYmd();
  const dueDate = invoice.due_date ? String(invoice.due_date).slice(0, 10) : '';
  const paymentStatus = String(invoice.status || '').toLowerCase() === 'cancelled'
    ? 'cancelled'
    : paidAmount >= totalAmount && totalAmount > 0
      ? 'paid'
      : paidAmount > 0
        ? 'partially_paid'
        : dueDate && dueDate < today
          ? 'overdue'
          : String(invoice.status || 'draft').toLowerCase();

  return {
    ...invoice,
    items,
    payments,
    activities,
    paid_amount: paidAmount,
    due_amount: dueAmount,
    payment_status: paymentStatus,
  };
}

async function recordInvoiceActivity(employeeId, invoiceId, action, description, req) {
  await logActivity(employeeId, action, 'invoice', invoiceId, description, req);
  await query(
    `INSERT INTO invoice_activities (company_id, invoice_id, action, description, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [req?.employee?.company_id || null, invoiceId, action, description || null, employeeId]
  ).catch(() => {});
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const search = req.query.search || null;
    const status = req.query.status || null;
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;

    let sql = `SELECT i.*,
                      COALESCE(c.company_name, l.company_name, '') AS customer_name,
                      COALESCE(c.full_name, l.contact_person, '') AS contact_person,
                      COALESCE(c.phone_number, l.phone, '') AS customer_phone,
                      COALESCE(c.email, l.email, '') AS customer_email,
                      COALESCE(c.address, '') AS customer_address,
                      c.city AS customer_city,
                      c.state AS customer_state,
                      c.postal_code AS customer_postal_code,
                      c.gst_number AS customer_gst_number,
                      e.name AS employee_name
               FROM invoices i
               LEFT JOIN sales_clients c ON i.client_id = c.id
               LEFT JOIN leads l ON i.lead_id = l.id
               LEFT JOIN employees e ON i.employee_id = e.id
               WHERE i.company_id = ?`;
    const params = [req.employee.company_id];

    if (!canSeeAll(req.employee)) {
      sql += ' AND i.employee_id = ?';
      params.push(req.employee.id);
    }

    if (search) {
      const t = '%' + String(search) + '%';
      sql += ' AND (i.invoice_number LIKE ? OR COALESCE(i.order_number, \'\') LIKE ? OR COALESCE(i.subject, \'\') LIKE ? OR COALESCE(c.company_name, l.company_name, \'\') LIKE ? OR COALESCE(c.full_name, l.contact_person, \'\') LIKE ?)';
      params.push(t, t, t, t, t);
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
  const conn = await getConnection();
  const body = req.body || {};
  try {
    const items = normalizeInvoiceItems(body.items || []);
    const customerContext = await loadCustomerContext(req.employee.company_id, body);
    const leadId = customerContext.lead_id || null;
    const clientId = customerContext.client_id || null;
    if (!leadId && !clientId) {
      return res.status(400).json({ success: false, message: 'client_id or lead_id is required' });
    }
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    const issueDate = normalizeDate(body.issue_date) || localYmd();
    const dueDate = deriveDueDate(issueDate, body.payment_terms || body.terms_conditions || body.payment_term, body.due_date);
    const status = normalizeStatus(body.status || 'draft');
    const totals = calculateInvoiceTotals(items, body);
    const invoiceNumber = await nextDocumentNumber(conn, 'invoice', issueDate);
    const customer = customerContext.customer || {};

    await conn.beginTransaction();

    const invoiceData = {
      company_id: req.employee.company_id,
      invoice_number: invoiceNumber,
      quotation_id: body.quotation_id ? Number(body.quotation_id) : null,
      client_id: clientId,
      lead_id: leadId,
      employee_id: req.employee.id,
      issue_date: issueDate,
      due_date: dueDate || null,
      order_number: normalizeText(body.order_number || ''),
      subject: normalizeText(body.subject || ''),
      billing_address: normalizeText(customerContext.billing_address || body.billing_address || ''),
      shipping_address: normalizeText(customerContext.shipping_address || body.shipping_address || ''),
      gst_number: normalizeText(customerContext.gst_number || body.gst_number || ''),
      place_of_supply: normalizeText(customerContext.place_of_supply || body.place_of_supply || ''),
      salesperson_id: body.salesperson_id ? Number(body.salesperson_id) : null,
      subtotal: totals.subtotal,
      tax_percentage: totals.tax_percentage,
      tax_amount: totals.tax_amount,
      tds_percentage: totals.tds_percentage,
      tds_amount: totals.tds_amount,
      discount_percentage: totals.discount_percentage,
      discount_amount: totals.discount_amount,
      adjustment_amount: totals.adjustment_amount,
      round_off_amount: totals.round_off_amount,
      total_amount: totals.total_amount,
      status,
      notes: normalizeText(body.notes || ''),
      payment_terms: normalizeText(body.payment_terms || body.terms_conditions || ''),
      attachment_path: normalizeText(body.attachment_path || ''),
      attachment_name: normalizeText(body.attachment_name || ''),
      attachment_type: normalizeText(body.attachment_type || ''),
      attachment_size: body.attachment_size ? Number(body.attachment_size) : null,
    };

    const invoiceColumns = Object.keys(invoiceData);
    const invoicePlaceholders = invoiceColumns.map(() => '?').join(',');
    const invoiceValues = invoiceColumns.map((key) => invoiceData[key]);

    const [result] = await conn.execute(
      `INSERT INTO invoices (${invoiceColumns.map((col) => `\`${col}\``).join(', ')}) VALUES (${invoicePlaceholders})`,
      invoiceValues
    );
    const invoiceId = result.insertId;

    const itemValues = [];
    const itemPlaceholders = [];
    for (const item of items) {
      itemPlaceholders.push('(?,?,?,?,?,?)');
      itemValues.push(invoiceId, item.item_name, item.description || null, item.quantity, item.unit_price, item.total_price);
    }
    try {
      await conn.execute(
        `INSERT INTO invoice_items (invoice_id, item_name, description, quantity, unit_price, total_price) VALUES ${itemPlaceholders.join(',')}`,
        itemValues
      );
    } catch (itemErr) {
      const msg = String(itemErr && itemErr.message ? itemErr.message : itemErr);
      if (!(msg.includes("doesn't exist") || msg.includes('ER_NO_SUCH_TABLE'))) {
        throw itemErr;
      }
    }

    if (status === 'sent') {
      await conn.execute('UPDATE invoices SET sent_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?', [invoiceId, req.employee.company_id]).catch(() => {});
    }

    await conn.commit();
    await recordInvoiceActivity(req.employee.id, invoiceId, 'invoice_created', `Invoice ${invoiceNumber} created`, req);
    return res.json({
      success: true,
      message: 'Invoice created',
      data: {
        id: invoiceId,
        invoice_number: invoiceNumber,
        total_amount: totals.total_amount,
      },
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) { }
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes('Unknown column') || msg.includes('ER_BAD_FIELD_ERROR')) {
      try {
        const legacyLeadId = body?.lead_id ? Number(body.lead_id) : null;
        const legacyCustomerName = body?.client_name || body?.customer_name || '';
        const legacyTotals = calculateInvoiceTotals(normalizeInvoiceItems(body?.items || []), body || {});
        const legacyInvoiceNumber = await nextDocumentNumber(conn, 'invoice', normalizeDate(body?.issue_date) || localYmd());
        const [legacyResult] = await conn.execute(
          'INSERT INTO invoices (company_id, lead_id, employee_id, invoice_number, client_name, total_amount, status, due_date, notes) VALUES (?,?,?,?,?,?,?,?,?)',
          [req.employee.company_id, legacyLeadId, req.employee.id, legacyInvoiceNumber, legacyCustomerName, legacyTotals.total_amount, normalizeStatus(body?.status || 'draft'), normalizeDate(body?.due_date) || null, normalizeText(body?.notes || '')]
        );
        return res.json({
          success: true,
          message: 'Invoice created',
          data: { id: legacyResult.insertId, invoice_number: legacyInvoiceNumber, total_amount: legacyTotals.total_amount },
        });
      } catch (legacyErr) {
        try { await conn.rollback(); } catch (_) { }
        throw legacyErr;
      }
    }
    throw err;
  } finally {
    conn.release();
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

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid invoice id' });
    }

    const invoice = await loadInvoiceDetails(id, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    return res.json({ success: true, data: invoice });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load invoice' });
  }
});

// GET /invoices/:id/pdf - generate invoice PDF on the same letterhead (letter-head.png)
router.get('/:id/pdf', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid invoice id' });
    }

    const inv = await loadInvoiceDetails(id, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const settings = await getDocumentSettings(req.employee?.company_id);
    const pdfBuffer = await generateInvoicePdfBuffer({
      ...inv,
      client_phone: inv.customer_phone || inv.phone || '',
      client_email: inv.customer_email || inv.email || '',
      client_address: inv.customer_address || inv.address || '',
      items: inv.items || [],
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

router.get('/:id/activities', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid invoice id' });
    }

    let activities = await query(
      `SELECT a.*, e.name AS employee_name
       FROM invoice_activities a
       LEFT JOIN employees e ON e.id = a.created_by
       WHERE a.invoice_id = ? AND (a.company_id = ? OR a.company_id IS NULL)
       ORDER BY a.created_at DESC`,
      [id, req.employee.company_id]
    ).catch(() => []);
    if (!activities.length) {
      activities = await query(
        `SELECT a.*, e.name AS employee_name
         FROM activity_logs a
         LEFT JOIN employees e ON e.id = a.employee_id
         WHERE a.entity_type = 'invoice' AND a.entity_id = ?
         ORDER BY a.created_at DESC`,
        [id]
      ).catch(() => []);
    }
    return res.json({ success: true, data: activities || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load invoice activities' });
  }
});

router.get('/:id/payments', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid invoice id' });
    }

    const payments = await query(
      `SELECT p.*, ba.bank_name, ba.account_number
       FROM invoice_payments p
       LEFT JOIN bank_accounts ba ON ba.id = p.account_id
       WHERE p.invoice_id = ? AND p.company_id = ?
       ORDER BY p.payment_date DESC, p.id DESC`,
      [id, req.employee.company_id]
    ).catch(() => []);
    return res.json({ success: true, data: payments || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load invoice payments' });
  }
});

router.post('/:id/duplicate', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid invoice id' });
    }

    const source = await loadInvoiceDetails(id, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!source) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const newIssueDate = localYmd();
    const newDueDate = deriveDueDate(newIssueDate, source.payment_terms || source.terms_conditions || '', source.due_date);
    const newInvoiceNumber = await nextDocumentNumber(conn, 'invoice', newIssueDate);
    const items = normalizeInvoiceItems(source.items || []);
    const totals = calculateInvoiceTotals(items, source);

    await conn.beginTransaction();
    const invoiceData = {
      company_id: req.employee.company_id,
      invoice_number: newInvoiceNumber,
      quotation_id: source.quotation_id ? Number(source.quotation_id) : null,
      client_id: source.client_id || null,
      lead_id: source.lead_id || null,
      employee_id: req.employee.id,
      issue_date: newIssueDate,
      due_date: newDueDate || null,
      order_number: normalizeText(source.order_number || ''),
      subject: normalizeText(source.subject || ''),
      billing_address: normalizeText(source.billing_address || source.customer_address || ''),
      shipping_address: normalizeText(source.shipping_address || source.customer_address || ''),
      gst_number: normalizeText(source.gst_number || source.customer_gst_number || ''),
      place_of_supply: normalizeText(source.place_of_supply || source.customer_state || ''),
      salesperson_id: source.salesperson_id ? Number(source.salesperson_id) : null,
      subtotal: totals.subtotal,
      tax_percentage: totals.tax_percentage,
      tax_amount: totals.tax_amount,
      tds_percentage: totals.tds_percentage,
      tds_amount: totals.tds_amount,
      discount_percentage: totals.discount_percentage,
      discount_amount: totals.discount_amount,
      adjustment_amount: totals.adjustment_amount,
      round_off_amount: totals.round_off_amount,
      total_amount: totals.total_amount,
      status: 'draft',
      notes: normalizeText(source.notes || ''),
      payment_terms: normalizeText(source.payment_terms || source.terms_conditions || ''),
      attachment_path: normalizeText(source.attachment_path || ''),
      attachment_name: normalizeText(source.attachment_name || ''),
      attachment_type: normalizeText(source.attachment_type || ''),
      attachment_size: source.attachment_size ? Number(source.attachment_size) : null,
    };

    const invoiceColumns = Object.keys(invoiceData);
    const invoicePlaceholders = invoiceColumns.map(() => '?').join(',');
    const invoiceValues = invoiceColumns.map((key) => invoiceData[key]);

    const [result] = await conn.execute(
      `INSERT INTO invoices (${invoiceColumns.map((col) => `\`${col}\``).join(', ')}) VALUES (${invoicePlaceholders})`,
      invoiceValues
    );
    const invoiceId = result.insertId;

    for (const item of items) {
      await conn.execute(
        'INSERT INTO invoice_items (invoice_id, item_name, description, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)',
        [invoiceId, item.item_name, item.description || null, item.quantity, item.unit_price, item.total_price]
      );
    }

    await conn.commit();
    await recordInvoiceActivity(req.employee.id, invoiceId, 'invoice_duplicated', `Invoice duplicated from ${source.invoice_number}`, req);
    return res.json({
      success: true,
      message: 'Invoice duplicated',
      data: { id: invoiceId, invoice_number: newInvoiceNumber, total_amount: totals.total_amount },
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) { }
    return res.status(500).json({ success: false, message: err.message || 'Failed to duplicate invoice' });
  } finally {
    conn.release();
  }
});

router.post('/:id/email', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid invoice id' });
    }

    const invoice = await loadInvoiceDetails(id, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const recipient = normalizeText(req.body?.to || invoice.customer_email || invoice.email || '');
    if (!recipient) {
      return res.status(400).json({ success: false, message: 'Customer email is required' });
    }

    const settings = await getDocumentSettings(req.employee?.company_id);
    const pdfBuffer = await generateInvoicePdfBuffer({
      ...invoice,
      client_phone: invoice.customer_phone || invoice.phone || '',
      client_email: invoice.customer_email || invoice.email || '',
      client_address: invoice.customer_address || invoice.address || '',
      items: invoice.items || [],
    }, settings);

    const subject = normalizeText(req.body?.subject || `Invoice ${invoice.invoice_number}`);
    const text = normalizeText(req.body?.text || `Please find attached invoice ${invoice.invoice_number}.`);
    await sendSalesDocumentEmail({
      companyId: req.employee.company_id,
      moduleType: 'billing',
      entityType: 'invoice',
      entityId: id,
      to: recipient,
      subject,
      text,
      html: `<p>${text.replace(/\n/g, '<br>')}</p>`,
      attachments: [
        {
          filename: `invoice_${String(invoice.invoice_number || `INV-${id}`).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    if (!String(invoice.status || '').toLowerCase().includes('paid')) {
      await conn.execute(
        'UPDATE invoices SET status = ?, sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
        ['sent', id, req.employee.company_id]
      ).catch(() => {});
    }

    await recordInvoiceActivity(req.employee.id, id, 'invoice_emailed', `Invoice emailed to ${recipient}`, req);
    return res.json({ success: true, message: 'Invoice emailed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to email invoice' });
  } finally {
    conn.release();
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

    const clientIdInput = b.client_id != null && b.client_id !== '' ? Number(b.client_id) : (existing.client_id || null);
    const leadIdInput = b.lead_id != null && b.lead_id !== '' ? Number(b.lead_id) : (existing.lead_id || null);
    const customerContext = await loadCustomerContext(
      req.employee.company_id,
      { ...b, client_id: clientIdInput || null, lead_id: leadIdInput || null },
      leadIdInput || null
    );
    const clientId = customerContext.client_id || clientIdInput || null;
    const leadId = customerContext.lead_id || leadIdInput || null;
    const itemsIn = Array.isArray(b.items) ? b.items : [];
    if (!clientId && !leadId) return res.status(400).json({ success: false, message: 'client_id or lead_id is required' });
    if (!itemsIn.length) return res.status(400).json({ success: false, message: 'At least one item is required' });

    const issueDate = normalizeDate(b.issue_date) || (existing.issue_date ? String(existing.issue_date).slice(0, 10) : localYmd());
    const paymentTerms = b.payment_terms != null ? String(b.payment_terms) : (existing.payment_terms || '');
    const taxPct = money2(b.tax_percentage != null ? b.tax_percentage : existing.tax_percentage || 0);
    const tdsPct = money2(b.tds_percentage != null ? b.tds_percentage : existing.tds_percentage || 0);
    const discPct = money2(b.discount_percentage != null ? b.discount_percentage : existing.discount_percentage || 0);
    const adjustmentAmount = money2(b.adjustment_amount != null ? b.adjustment_amount : existing.adjustment_amount || 0);
    const roundOffAmount = money2(b.round_off_amount != null ? b.round_off_amount : existing.round_off_amount || 0);
    const dueDate = b.due_date ? normalizeDate(b.due_date) : deriveDueDate(issueDate, paymentTerms, existing.due_date || '');
    const notes = b.notes != null ? String(b.notes) : (existing.notes || '');
    const status = normalizeStatus(b.status != null ? String(b.status) : (existing.status || 'draft'));
    const quotationId = b.quotation_id != null && b.quotation_id !== '' ? Number(b.quotation_id) : (existing.quotation_id || null);
    const orderNumber = b.order_number != null ? String(b.order_number) : (existing.order_number || '');
    const subject = b.subject != null ? String(b.subject) : (existing.subject || '');
    const customer = customerContext.customer || {};

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
    const totalAmount = money2(taxable + taxAmount - tdsAmount + adjustmentAmount + roundOffAmount);

    const conn = await getConnection();
    try {
      // Prefer new schema
      await conn.execute(
        `UPDATE invoices SET
           quotation_id=?,
           client_id=?,
           lead_id=?,
           issue_date=?,
           due_date=?,
           order_number=?,
           subject=?,
           billing_address=?,
           shipping_address=?,
           gst_number=?,
           place_of_supply=?,
           salesperson_id=?,
           subtotal=?,
           tax_percentage=?,
           tax_amount=?,
           tds_percentage=?,
           tds_amount=?,
           discount_percentage=?,
           discount_amount=?,
           adjustment_amount=?,
           round_off_amount=?,
           total_amount=?,
           status=?,
           notes=?,
           payment_terms=?,
           attachment_path=?,
           attachment_name=?,
           attachment_type=?,
           attachment_size=?,
           updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [
          quotationId,
          clientId,
          leadId,
          issueDate,
          dueDate,
          orderNumber,
          subject,
          normalizeText(b.billing_address || customer.billing_address || existing.billing_address || ''),
          normalizeText(b.shipping_address || customer.shipping_address || existing.shipping_address || ''),
          normalizeText(b.gst_number || customer.gst_number || existing.gst_number || ''),
          normalizeText(b.place_of_supply || customer.place_of_supply || existing.place_of_supply || ''),
          b.salesperson_id ? Number(b.salesperson_id) : (existing.salesperson_id || null),
          subtotal,
          taxPct,
          taxAmount,
          tdsPct,
          tdsAmount,
          discPct,
          discountAmount,
          adjustmentAmount,
          roundOffAmount,
          totalAmount,
          status,
          notes,
          paymentTerms,
          normalizeText(b.attachment_path || existing.attachment_path || ''),
          normalizeText(b.attachment_name || existing.attachment_name || ''),
          normalizeText(b.attachment_type || existing.attachment_type || ''),
          b.attachment_size != null && b.attachment_size !== '' ? Number(b.attachment_size) : (existing.attachment_size || null),
          id,
        ]
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

      if (status === 'sent') {
        await conn.execute(
          'UPDATE invoices SET sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP) WHERE id = ? AND company_id = ?',
          [id, req.employee.company_id]
        ).catch(() => {});
      }
      if (status === 'viewed') {
        await conn.execute(
          'UPDATE invoices SET viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP) WHERE id = ? AND company_id = ?',
          [id, req.employee.company_id]
        ).catch(() => {});
      }

      await recordInvoiceActivity(req.employee.id, id, 'invoice_updated', `Invoice ${existing.invoice_number} updated`, req);
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
    const rawStatus = String(req.body?.status || '').toLowerCase().trim();
    if (!rawStatus) return res.status(400).json({ success: false, message: 'Status is required' });
    const status = normalizeStatus(rawStatus);
    const allowed = ['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const canAll = canSeeAll(req.employee);
    const params = [status, id, req.employee.company_id];
    const statusUpdates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    if (status === 'sent') statusUpdates.push('sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP)');
    if (status === 'viewed') statusUpdates.push('viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)');
    let sql = `UPDATE invoices SET ${statusUpdates.join(', ')} WHERE id=? AND company_id=?`;
    if (!canAll) { sql += ' AND employee_id=?'; params.push(req.employee.id); }
    const r = await query(sql, params);
    if (r && typeof r.affectedRows === 'number' && r.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    await recordInvoiceActivity(req.employee.id, id, 'invoice_status_changed', `Invoice status changed to ${status}`, req);
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
    const paymentRows = await query('SELECT COUNT(*) AS count FROM invoice_payments WHERE invoice_id = ?', [id]).catch(() => [{ count: 0 }]);
    if (Number(paymentRows?.[0]?.count || 0) > 0) {
      return res.status(400).json({ success: false, message: 'Invoice has payment history. Delete payments first.' });
    }
    await query('DELETE FROM invoice_items WHERE invoice_id = ?', [id]).catch(() => {});
    await query('DELETE FROM invoice_activities WHERE invoice_id = ?', [id]).catch(() => {});
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
