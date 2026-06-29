const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLog');
const { localYmd, nextDocumentNumber } = require('../utils/documentNumbers');
const { generateQuotationPdfBuffer } = require('../services/templateDocumentPdf');
const { sendSalesDocumentEmail } = require('../services/salesDocumentMailer');

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

function money2(value) {
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
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
  if (!days) return base;
  const date = new Date(`${base}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeQuotationStatus(status, fallback = 'draft') {
  const raw = normalizeText(status || fallback).toLowerCase();
  if (raw === 'approved') return 'accepted';
  if (raw === 'rejected') return 'declined';
  const allowed = new Set(['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'converted']);
  return allowed.has(raw) ? raw : fallback;
}

function normalizeQuotationItems(items = []) {
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

function calculateQuotationTotals(items = [], body = {}) {
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

function buildQuotationSnapshot(quotation = {}, items = []) {
  return {
    quotation: {
      id: quotation.id || null,
      quotation_number: quotation.quotation_number || '',
      client_id: quotation.client_id || null,
      lead_id: quotation.lead_id || null,
      issue_date: quotation.issue_date || '',
      valid_until: quotation.valid_until || '',
      status: quotation.status || 'draft',
      total_amount: money2(quotation.total_amount || 0),
    },
    items,
  };
}

async function recordQuotationActivity(employeeId, quotationId, action, description, req) {
  await logActivity(employeeId, action, 'quotation', quotationId, description, req);
  await query(
    `INSERT INTO quote_activities (company_id, quotation_id, action, description, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [req?.employee?.company_id || null, quotationId, action, description || null, employeeId]
  ).catch(() => {});
}

async function storeQuotationRevision(conn, quotationId, companyId, quotation, items, reason, createdBy) {
  try {
    const [rows] = await conn.query(
      'SELECT COALESCE(MAX(revision_number), 0) AS max_revision FROM quote_revisions WHERE quotation_id = ? AND (company_id = ? OR company_id IS NULL)',
      [quotationId, companyId]
    );
    const nextRevision = (Number(rows?.[0]?.max_revision) || 0) + 1;
    await conn.query(
      `INSERT INTO quote_revisions (company_id, quotation_id, revision_number, snapshot, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [companyId, quotationId, nextRevision, JSON.stringify(buildQuotationSnapshot(quotation, items || [])), reason || null, createdBy || null]
    );
  } catch (_) {
    // Revision history is best-effort; keep the main flow working if the table is unavailable.
  }
}

async function loadQuotationDetails(quotationId, companyId, canAll, employeeId) {
  const rows = await query(
    `SELECT q.*,
            COALESCE(c.company_name, c.full_name, l.company_name, '') AS customer_name,
            COALESCE(c.full_name, l.contact_person, '') AS contact_person,
            COALESCE(c.phone_number, l.phone, '') AS customer_phone,
            COALESCE(c.email, l.email, '') AS customer_email,
            COALESCE(q.billing_address, c.address, l.address, '') AS customer_address,
            c.state AS customer_state,
            c.gst_number AS customer_gst_number,
            e.name AS employee_name,
            e.role AS employee_role
     FROM quotations q
     LEFT JOIN sales_clients c ON q.client_id = c.id
     LEFT JOIN leads l ON q.lead_id = l.id
     LEFT JOIN employees e ON q.employee_id = e.id
     WHERE q.id = ? AND q.company_id = ? ${canAll ? '' : 'AND q.employee_id = ?'}
     LIMIT 1`,
    canAll ? [quotationId, companyId] : [quotationId, companyId, employeeId]
  ).catch(() => []);
  const quotation = Array.isArray(rows) ? rows[0] : null;
  if (!quotation) return null;

  const items = await query(
    'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC',
    [quotationId]
  ).catch(() => []);

  let activities = await query(
    `SELECT a.*, e.name AS employee_name
     FROM quote_activities a
     LEFT JOIN employees e ON e.id = a.created_by
     WHERE a.quotation_id = ? AND (a.company_id = ? OR a.company_id IS NULL)
     ORDER BY a.created_at DESC`,
    [quotationId, companyId]
  ).catch(() => []);
  if (!activities.length) {
    activities = await query(
      `SELECT a.*, e.name AS employee_name
       FROM activity_logs a
       LEFT JOIN employees e ON e.id = a.employee_id
       WHERE a.entity_type = 'quotation' AND a.entity_id = ?
       ORDER BY a.created_at DESC`,
      [quotationId]
    ).catch(() => []);
  }

  const revisions = await query(
    `SELECT r.*, e.name AS employee_name
     FROM quote_revisions r
     LEFT JOIN employees e ON e.id = r.created_by
     WHERE r.quotation_id = ? AND (r.company_id = ? OR r.company_id IS NULL)
     ORDER BY r.revision_number DESC, r.created_at DESC`,
    [quotationId, companyId]
  ).catch(() => []);

  return {
    ...quotation,
    items,
    activities,
    revisions,
  };
}

// GET /quotations - sales see own; manager/admin see all; ?pending_approval=1 for status=sent only
router.get('/', verifyToken, async (req, res) => {
  try {
    const search = req.query.search || null;
    const status = req.query.status || null;
    const pendingApproval = req.query.pending_approval === '1' || req.query.pending_approval === 'true';
    const empId = req.employee?.id;
    const manager = isManagerOrAdmin(req.employee);

    let sql = `SELECT q.*,
      COALESCE(c.company_name, c.full_name, l.company_name, '') AS customer_name,
      COALESCE(c.full_name, l.contact_person, '') AS contact_person,
      COALESCE(c.phone_number, l.phone, '') AS customer_phone,
      COALESCE(c.email, l.email, '') AS customer_email,
      COALESCE(c.address, l.address, '') AS customer_address,
      e.name AS employee_name, e.role AS employee_role
      FROM quotations q
      LEFT JOIN sales_clients c ON q.client_id = c.id
      LEFT JOIN leads l ON q.lead_id = l.id
      LEFT JOIN employees e ON q.employee_id = e.id
      WHERE q.company_id = ?`;
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
      sql += ' AND (COALESCE(c.company_name, l.company_name, \'\') LIKE ? OR COALESCE(c.full_name, l.contact_person, \'\') LIKE ? OR q.quotation_number LIKE ? OR COALESCE(q.subject, \'\') LIKE ?)';
      const t = '%' + search + '%';
      params.push(t, t, t, t);
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

    const quotation = await loadQuotationDetails(id, req.employee.company_id, isManagerOrAdmin(req.employee), req.employee.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // Access check: non-managers can only view their own quotations
    if (!isManagerOrAdmin(req.employee) && quotation.employee_id !== req.employee.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.json({ success: true, data: quotation });
  } catch (err) {
    console.error('Quotation GET by ID error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /quotations/:id/pdf - generate and download quotation PDF
router.get('/:id/pdf', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quotation id' });
    }

    const quotation = await loadQuotationDetails(id, req.employee.company_id, isManagerOrAdmin(req.employee), req.employee.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // Access check: non-managers can only view their own quotations
    if (!isManagerOrAdmin(req.employee) && quotation.employee_id !== req.employee.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const settings = await getQuotationSettings(req.employee?.company_id);
    const pdfBuffer = await generateQuotationPdfBuffer({
      ...quotation,
      client_phone: quotation.customer_phone || quotation.phone || '',
      client_email: quotation.customer_email || quotation.email || '',
      client_address: quotation.customer_address || quotation.address || '',
      items: quotation.items || [],
    }, settings);
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 100) {
      return res.status(500).json({ success: false, message: 'Failed to generate quotation PDF' });
    }

    const currentStatus = String(quotation.status || '').toLowerCase();
    if (['draft', 'sent'].includes(currentStatus)) {
      await query(
        'UPDATE quotations SET status = ?, viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
        ['viewed', id, req.employee.company_id]
      ).catch(() => {});
      await recordQuotationActivity(req.employee.id, id, 'quotation_viewed', 'Quotation PDF viewed', req);
    }

    const wantsDownload =
      req.query.download === '1' || req.query.download === 'true' || req.query.disposition === 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    const safeName = `quotation_${String(quotation.quotation_number || `QT-${id}`).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
    res.setHeader('Content-Disposition', `${wantsDownload ? 'attachment' : 'inline'}; filename="${safeName}"`);
    return res.end(pdfBuffer);
  } catch (err) {
    console.error('Quotation PDF error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to generate quotation PDF' });
  }
});


// POST /quotations - create a new quote
router.post('/', verifyToken, async (req, res) => {
  let conn;
  const body = req.body || {};
  try {
    const empId = req.employee?.id;
    if (!empId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const customerContext = await loadCustomerContext(req.employee.company_id, body);
    const clientId = customerContext.client_id || null;
    const leadId = customerContext.lead_id || null;
    if (!clientId && !leadId) {
      return res.status(400).json({ success: false, message: 'client_id or lead_id is required' });
    }

    const items = normalizeQuotationItems(body.items || []);
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    const issueDate = normalizeDate(body.issue_date) || localYmd();
    const validUntil = normalizeDate(body.valid_until) || null;
    const notes = normalizeText(body.notes || '');
    const termsConditions = normalizeText(body.terms_conditions || '');
    const autoApprove = isManagerOrAdmin(req.employee);
    const sendForApproval = !autoApprove && (body.send_for_approval === true || body.send_for_approval === 'true');
    const status = normalizeQuotationStatus(autoApprove ? 'accepted' : (sendForApproval ? 'sent' : body.status || 'draft'));
    const totals = calculateQuotationTotals(items, body);

    conn = await getConnection();
    const quotationNumber = await nextDocumentNumber(conn, 'quotation', issueDate);
    await conn.beginTransaction();

    const quotationData = {
      company_id: req.employee.company_id,
      quotation_number: quotationNumber,
      client_id: clientId,
      lead_id: leadId,
      employee_id: empId,
      issue_date: issueDate,
      valid_until: validUntil,
      reference_number: normalizeText(body.reference_number || ''),
      project_name: normalizeText(body.project_name || body.project || ''),
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
      notes,
      terms_conditions: termsConditions,
      attachment_path: normalizeText(body.attachment_path || ''),
      attachment_name: normalizeText(body.attachment_name || ''),
      attachment_type: normalizeText(body.attachment_type || ''),
      attachment_size: body.attachment_size != null && body.attachment_size !== '' ? Number(body.attachment_size) : null,
    };

    const quotationColumns = Object.keys(quotationData);
    const quotationPlaceholders = quotationColumns.map(() => '?').join(',');
    const quotationValues = quotationColumns.map((key) => quotationData[key]);

    const [result] = await conn.execute(
      `INSERT INTO quotations (${quotationColumns.map((col) => `\`${col}\``).join(', ')}) VALUES (${quotationPlaceholders})`,
      quotationValues
    );
    const quotationId = result.insertId;

    for (const item of items) {
      await conn.execute(
        'INSERT INTO quotation_items (quotation_id, item_name, description, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)',
        [quotationId, item.item_name, item.description || null, item.quantity, item.unit_price, item.total_price]
      );
    }

    if (status === 'sent') {
      await conn.execute(
        'UPDATE quotations SET sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP) WHERE id = ? AND company_id = ?',
        [quotationId, req.employee.company_id]
      ).catch(() => {});
    }

    await conn.commit();
    await recordQuotationActivity(req.employee.id, quotationId, 'quotation_created', `Quotation ${quotationNumber} created`, req);
    return res.json({
      success: true,
      message: autoApprove
        ? 'Quotation created and approved.'
        : sendForApproval
          ? 'Quotation sent for manager approval.'
          : 'Quotation created.',
      data: { id: quotationId, quotation_number: quotationNumber, total_amount: totals.total_amount },
    });
  } catch (err) {
    if (conn && conn.rollback) {
      try { await conn.rollback(); } catch (_) { }
    }
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes('Unknown column') || msg.includes('ER_BAD_FIELD_ERROR')) {
      try {
        const issueDate = normalizeDate(body.issue_date) || localYmd();
        const customerContext = await loadCustomerContext(req.employee.company_id, body);
        const leadId = customerContext.lead_id || (body.lead_id ? Number(body.lead_id) : null);
        const items = normalizeQuotationItems(body.items || []);
        const totals = calculateQuotationTotals(items, body);
        const quotationNumber = await nextDocumentNumber(conn, 'quotation', issueDate);
        const legacyStatus = normalizeQuotationStatus(body.status || (body.send_for_approval ? 'sent' : 'draft'));
        const [legacyResult] = await conn.execute(
          `INSERT INTO quotations (company_id, quotation_number, lead_id, employee_id, issue_date, valid_until, subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount, total_amount, status, notes, terms_conditions)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            req.employee.company_id,
            quotationNumber,
            leadId,
            req.employee.id,
            issueDate,
            normalizeDate(body.valid_until) || null,
            totals.subtotal,
            totals.tax_percentage,
            totals.tax_amount,
            totals.discount_percentage,
            totals.discount_amount,
            totals.total_amount,
            legacyStatus,
            normalizeText(body.notes || ''),
            normalizeText(body.terms_conditions || ''),
          ]
        );
        const quotationId = legacyResult.insertId;
        for (const item of items) {
          await conn.execute(
            'INSERT INTO quotation_items (quotation_id, item_name, description, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)',
            [quotationId, item.item_name, item.description || null, item.quantity, item.unit_price, item.total_price]
          );
        }
        await conn.commit();
        await recordQuotationActivity(req.employee.id, quotationId, 'quotation_created', `Quotation ${quotationNumber} created`, req);
        return res.json({
          success: true,
          message: 'Quotation created.',
          data: { id: quotationId, quotation_number: quotationNumber, total_amount: totals.total_amount },
        });
      } catch (legacyErr) {
        if (conn && conn.rollback) {
          try { await conn.rollback(); } catch (_) { }
        }
        return res.status(500).json({ success: false, message: legacyErr.message || 'Failed to create quotation' });
      }
    }
    return res.status(500).json({ success: false, message: err.message || 'Failed to create quotation' });
  } finally {
    if (conn) conn.release();
  }
});

// PUT /quotations/:id/send - employee only: send for manager approval (status = sent)
router.put('/:id/send', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const rows = await query('SELECT id, employee_id, status FROM quotations WHERE id = ? AND company_id = ?', [id, req.employee.company_id]);
    const q = Array.isArray(rows) ? rows[0] : null;
    if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (isManagerOrAdmin(req.employee)) return res.status(403).json({ success: false, message: 'Only employees can send quotations for approval' });
    if (q.employee_id !== req.employee.id) return res.status(403).json({ success: false, message: 'Only the creator can send for approval' });
    if (q.status !== 'draft') return res.status(400).json({ success: false, message: 'Only draft quotations can be sent for approval' });
    await query(
      'UPDATE quotations SET status = ?, sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
      ['sent', id, req.employee.company_id]
    );
    await recordQuotationActivity(req.employee.id, id, 'quotation_sent', 'Quotation sent for approval', req);
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
    const rawStatus = String(req.body?.status || '').toLowerCase().trim();
    const status = normalizeQuotationStatus(rawStatus);
    if (!id || !['accepted', 'declined'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid ID or status (accepted/declined)' });
    const rows = await query('SELECT id, status FROM quotations WHERE id = ? AND company_id = ?', [id, req.employee.company_id]);
    const q = Array.isArray(rows) ? rows[0] : null;
    if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
    if (q.status !== 'sent') return res.status(400).json({ success: false, message: 'Only quotations pending approval can be approved or rejected' });
    await query(
      'UPDATE quotations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
      [status, id, req.employee.company_id]
    );
    await recordQuotationActivity(
      req.employee.id,
      id,
      status === 'accepted' ? 'quotation_approved' : 'quotation_declined',
      status === 'accepted' ? 'Quotation approved' : 'Quotation declined',
      req
    );
    return res.json({ success: true, message: status === 'accepted' ? 'Quotation approved.' : 'Quotation declined.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/activities', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quotation id' });
    }

    let activities = await query(
      `SELECT a.*, e.name AS employee_name
       FROM quote_activities a
       LEFT JOIN employees e ON e.id = a.created_by
       WHERE a.quotation_id = ? AND (a.company_id = ? OR a.company_id IS NULL)
       ORDER BY a.created_at DESC`,
      [id, req.employee.company_id]
    ).catch(() => []);
    if (!activities.length) {
      activities = await query(
        `SELECT a.*, e.name AS employee_name
         FROM activity_logs a
         LEFT JOIN employees e ON e.id = a.employee_id
         WHERE a.entity_type = 'quotation' AND a.entity_id = ?
         ORDER BY a.created_at DESC`,
        [id]
      ).catch(() => []);
    }
    return res.json({ success: true, data: activities || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load quotation activities' });
  }
});

router.get('/:id/revisions', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quotation id' });
    }

    const revisions = await query(
      `SELECT r.*, e.name AS employee_name
       FROM quote_revisions r
       LEFT JOIN employees e ON e.id = r.created_by
       WHERE r.quotation_id = ? AND (r.company_id = ? OR r.company_id IS NULL)
       ORDER BY r.revision_number DESC, r.created_at DESC`,
      [id, req.employee.company_id]
    ).catch(() => []);

    const parsed = (Array.isArray(revisions) ? revisions : []).map((revision) => {
      let snapshot = revision.snapshot;
      if (typeof snapshot === 'string') {
        try {
          snapshot = JSON.parse(snapshot);
        } catch (_) {
          // keep raw snapshot
        }
      }
      return { ...revision, snapshot };
    });

    return res.json({ success: true, data: parsed });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load quote revisions' });
  }
});

router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quotation id' });
    }

    const rawStatus = String(req.body?.status || '').toLowerCase().trim();
    if (!rawStatus) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }
    const status = normalizeQuotationStatus(rawStatus);
    if (!['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'converted'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const canAll = isManagerOrAdmin(req.employee);
    const params = [status, id, req.employee.company_id];
    const setParts = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    if (status === 'sent') setParts.push('sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP)');
    if (status === 'viewed') setParts.push('viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)');
    if (status === 'converted') setParts.push('converted_at = COALESCE(converted_at, CURRENT_TIMESTAMP)');
    let sql = `UPDATE quotations SET ${setParts.join(', ')} WHERE id = ? AND company_id = ?`;
    if (!canAll) {
      sql += ' AND employee_id = ?';
      params.push(req.employee.id);
    }

    const result = await query(sql, params);
    if (result && typeof result.affectedRows === 'number' && result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    await recordQuotationActivity(req.employee.id, id, 'quotation_status_changed', `Quotation status changed to ${status}`, req);
    return res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update quotation status' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quotation id' });
    }

    const canAll = isManagerOrAdmin(req.employee);
    const existingRows = await query(
      `SELECT * FROM quotations WHERE id = ? AND company_id = ? ${canAll ? '' : 'AND employee_id = ?'}`,
      canAll ? [id, req.employee.company_id] : [id, req.employee.company_id, req.employee.id]
    ).catch(() => []);
    const existing = Array.isArray(existingRows) ? existingRows[0] : null;
    if (!existing) return res.status(404).json({ success: false, message: 'Quotation not found' });
    const existingItems = await query(
      'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC',
      [id]
    ).catch(() => []);

    const body = req.body || {};
    const customerContext = await loadCustomerContext(req.employee.company_id, body, existing.lead_id || null);
    const clientId = customerContext.client_id || existing.client_id || null;
    const leadId = customerContext.lead_id || existing.lead_id || null;
    if (!clientId && !leadId) {
      return res.status(400).json({ success: false, message: 'client_id or lead_id is required' });
    }

    const items = normalizeQuotationItems(body.items || []);
    if (!items.length) return res.status(400).json({ success: false, message: 'At least one item is required' });

    const issueDate = normalizeDate(body.issue_date) || (existing.issue_date ? String(existing.issue_date).slice(0, 10) : localYmd());
    const validUntil = normalizeDate(body.valid_until) || (existing.valid_until ? String(existing.valid_until).slice(0, 10) : null);
    const notes = body.notes != null ? normalizeText(body.notes) : normalizeText(existing.notes || '');
    const termsConditions = body.terms_conditions != null ? normalizeText(body.terms_conditions) : normalizeText(existing.terms_conditions || '');
    const status = normalizeQuotationStatus(body.status != null ? body.status : existing.status || 'draft');
    const totals = calculateQuotationTotals(items, body);

    conn = await getConnection();
    await conn.beginTransaction();
    await storeQuotationRevision(conn, id, req.employee.company_id, existing, existingItems || [], 'Before update', req.employee.id);

    await conn.execute(
      `UPDATE quotations SET
         client_id=?,
         lead_id=?,
         issue_date=?,
         valid_until=?,
         reference_number=?,
         project_name=?,
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
         terms_conditions=?,
         attachment_path=?,
         attachment_name=?,
         attachment_type=?,
         attachment_size=?,
         updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND company_id=?`,
      [
        clientId,
        leadId,
        issueDate,
        validUntil,
        normalizeText(body.reference_number || existing.reference_number || ''),
        normalizeText(body.project_name || body.project || existing.project_name || ''),
        normalizeText(body.subject || existing.subject || ''),
        normalizeText(body.billing_address || customerContext.billing_address || existing.billing_address || ''),
        normalizeText(body.shipping_address || customerContext.shipping_address || existing.shipping_address || ''),
        normalizeText(body.gst_number || customerContext.gst_number || existing.gst_number || ''),
        normalizeText(body.place_of_supply || customerContext.place_of_supply || existing.place_of_supply || ''),
        body.salesperson_id ? Number(body.salesperson_id) : (existing.salesperson_id || null),
        totals.subtotal,
        totals.tax_percentage,
        totals.tax_amount,
        totals.tds_percentage,
        totals.tds_amount,
        totals.discount_percentage,
        totals.discount_amount,
        totals.adjustment_amount,
        totals.round_off_amount,
        totals.total_amount,
        status,
        notes,
        termsConditions,
        normalizeText(body.attachment_path || existing.attachment_path || ''),
        normalizeText(body.attachment_name || existing.attachment_name || ''),
        normalizeText(body.attachment_type || existing.attachment_type || ''),
        body.attachment_size != null && body.attachment_size !== '' ? Number(body.attachment_size) : (existing.attachment_size || null),
        id,
        req.employee.company_id,
      ]
    );

    await conn.execute('DELETE FROM quotation_items WHERE quotation_id = ?', [id]);
    for (const item of items) {
      await conn.execute(
        'INSERT INTO quotation_items (quotation_id, item_name, description, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)',
        [id, item.item_name, item.description || null, item.quantity, item.unit_price, item.total_price]
      );
    }

    if (status === 'sent') {
      await conn.execute(
        'UPDATE quotations SET sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP) WHERE id = ? AND company_id = ?',
        [id, req.employee.company_id]
      ).catch(() => {});
    }
    if (status === 'viewed') {
      await conn.execute(
        'UPDATE quotations SET viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP) WHERE id = ? AND company_id = ?',
        [id, req.employee.company_id]
      ).catch(() => {});
    }
    if (status === 'converted') {
      await conn.execute(
        'UPDATE quotations SET converted_at = COALESCE(converted_at, CURRENT_TIMESTAMP) WHERE id = ? AND company_id = ?',
        [id, req.employee.company_id]
      ).catch(() => {});
    }

    await conn.commit();
    await recordQuotationActivity(req.employee.id, id, 'quotation_updated', `Quotation ${existing.quotation_number} updated`, req);
    return res.json({ success: true, message: 'Quotation updated', data: { id, total_amount: totals.total_amount } });
  } catch (err) {
    if (conn && conn.rollback) {
      try { await conn.rollback(); } catch (_) { }
    }
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes('Unknown column') || msg.includes('ER_BAD_FIELD_ERROR')) {
      return res.status(500).json({ success: false, message: 'Quotation schema is missing required sales columns. Run the sales module migration.' });
    }
    return res.status(500).json({ success: false, message: err.message || 'Failed to update quotation' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/:id/duplicate', verifyToken, async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quotation id' });
    }

    const source = await loadQuotationDetails(id, req.employee.company_id, isManagerOrAdmin(req.employee), req.employee.id);
    if (!source) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const items = normalizeQuotationItems(source.items || []);
    const totals = calculateQuotationTotals(items, source);
    const issueDate = localYmd();
    const validUntil = source.valid_until ? normalizeDate(source.valid_until) : null;

    conn = await getConnection();
    const quotationNumber = await nextDocumentNumber(conn, 'quotation', issueDate);
    await conn.beginTransaction();
    const quotationData = {
      company_id: req.employee.company_id,
      quotation_number: quotationNumber,
      client_id: source.client_id || null,
      lead_id: source.lead_id || null,
      employee_id: req.employee.id,
      issue_date: issueDate,
      valid_until: validUntil,
      reference_number: normalizeText(source.reference_number || ''),
      project_name: normalizeText(source.project_name || ''),
      subject: normalizeText(source.subject || ''),
      billing_address: normalizeText(source.billing_address || source.customer_address || ''),
      shipping_address: normalizeText(source.shipping_address || source.customer_address || ''),
      gst_number: normalizeText(source.gst_number || source.customer_gst_number || ''),
      place_of_supply: normalizeText(source.place_of_supply || source.customer_state || ''),
      salesperson_id: source.salesperson_id || null,
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
      terms_conditions: normalizeText(source.terms_conditions || ''),
      attachment_path: normalizeText(source.attachment_path || ''),
      attachment_name: normalizeText(source.attachment_name || ''),
      attachment_type: normalizeText(source.attachment_type || ''),
      attachment_size: source.attachment_size ? Number(source.attachment_size) : null,
    };

    const quotationColumns = Object.keys(quotationData);
    const quotationPlaceholders = quotationColumns.map(() => '?').join(',');
    const quotationValues = quotationColumns.map((key) => quotationData[key]);
    const [result] = await conn.execute(
      `INSERT INTO quotations (${quotationColumns.map((col) => `\`${col}\``).join(', ')}) VALUES (${quotationPlaceholders})`,
      quotationValues
    );
    const quotationId = result.insertId;

    for (const item of items) {
      await conn.execute(
        'INSERT INTO quotation_items (quotation_id, item_name, description, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)',
        [quotationId, item.item_name, item.description || null, item.quantity, item.unit_price, item.total_price]
      );
    }

    await conn.commit();
    await recordQuotationActivity(req.employee.id, quotationId, 'quotation_duplicated', `Quotation duplicated from ${source.quotation_number}`, req);
    return res.json({
      success: true,
      message: 'Quotation duplicated',
      data: { id: quotationId, quotation_number: quotationNumber, total_amount: totals.total_amount },
    });
  } catch (err) {
    if (conn && conn.rollback) {
      try { await conn.rollback(); } catch (_) { }
    }
    return res.status(500).json({ success: false, message: err.message || 'Failed to duplicate quotation' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/:id/email', verifyToken, async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quotation id' });
    }

    const quotation = await loadQuotationDetails(id, req.employee.company_id, isManagerOrAdmin(req.employee), req.employee.id);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const recipient = normalizeText(req.body?.to || quotation.customer_email || quotation.email || '');
    if (!recipient) {
      return res.status(400).json({ success: false, message: 'Customer email is required' });
    }

    const settings = await getQuotationSettings(req.employee?.company_id);
    const pdfBuffer = await generateQuotationPdfBuffer({
      ...quotation,
      client_phone: quotation.customer_phone || quotation.phone || '',
      client_email: quotation.customer_email || quotation.email || '',
      client_address: quotation.customer_address || quotation.address || '',
      items: quotation.items || [],
    }, settings);

    const subject = normalizeText(req.body?.subject || `Quotation ${quotation.quotation_number}`);
    const text = normalizeText(req.body?.text || `Please find attached quotation ${quotation.quotation_number}.`);
    await sendSalesDocumentEmail({
      companyId: req.employee.company_id,
      moduleType: 'sales',
      entityType: 'quotation',
      entityId: id,
      to: recipient,
      subject,
      text,
      html: `<p>${text.replace(/\n/g, '<br>')}</p>`,
      attachments: [
        {
          filename: `quotation_${String(quotation.quotation_number || `QT-${id}`).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    if (String(quotation.status || '').toLowerCase() === 'draft') {
      conn = await getConnection();
      await conn.execute(
        'UPDATE quotations SET status = ?, sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
        ['sent', id, req.employee.company_id]
      ).catch(() => {});
    }

    await recordQuotationActivity(req.employee.id, id, 'quotation_emailed', `Quotation emailed to ${recipient}`, req);
    return res.json({ success: true, message: 'Quotation emailed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to email quotation' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/:id/convert/invoice', verifyToken, async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quotation id' });
    }

    const quotation = await loadQuotationDetails(id, req.employee.company_id, isManagerOrAdmin(req.employee), req.employee.id);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const items = normalizeQuotationItems(quotation.items || []);
    const totals = calculateQuotationTotals(items, quotation);
    const issueDate = normalizeDate(req.body?.issue_date) || localYmd();
    const dueDate = deriveDueDate(issueDate, quotation.terms_conditions || quotation.payment_terms || '', req.body?.due_date || '');
    const numberConn = await getConnection();
    let invoiceNumber;
    try {
      invoiceNumber = await nextDocumentNumber(numberConn, 'invoice', issueDate);
    } finally {
      if (numberConn) numberConn.release();
    }
    conn = await getConnection();
    await conn.beginTransaction();

    const invoiceData = {
      company_id: req.employee.company_id,
      invoice_number: invoiceNumber,
      quotation_id: quotation.id,
      client_id: quotation.client_id || null,
      lead_id: quotation.lead_id || null,
      employee_id: req.employee.id,
      issue_date: issueDate,
      due_date: dueDate || null,
      order_number: normalizeText(quotation.reference_number || ''),
      subject: normalizeText(quotation.subject || ''),
      billing_address: normalizeText(quotation.billing_address || quotation.customer_address || ''),
      shipping_address: normalizeText(quotation.shipping_address || quotation.customer_address || ''),
      gst_number: normalizeText(quotation.gst_number || quotation.customer_gst_number || ''),
      place_of_supply: normalizeText(quotation.place_of_supply || quotation.customer_state || ''),
      salesperson_id: quotation.salesperson_id || null,
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
      notes: normalizeText(quotation.notes || ''),
      payment_terms: normalizeText(quotation.terms_conditions || ''),
      attachment_path: normalizeText(quotation.attachment_path || ''),
      attachment_name: normalizeText(quotation.attachment_name || ''),
      attachment_type: normalizeText(quotation.attachment_type || ''),
      attachment_size: quotation.attachment_size ? Number(quotation.attachment_size) : null,
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

    await conn.execute(
      'UPDATE quotations SET status = ?, converted_at = COALESCE(converted_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
      ['converted', id, req.employee.company_id]
    ).catch(() => {});

    await conn.commit();
    await recordQuotationActivity(req.employee.id, id, 'quotation_converted_to_invoice', `Converted to invoice ${invoiceNumber}`, req);
    return res.json({
      success: true,
      message: 'Quotation converted to invoice',
      data: { invoice_id: invoiceId, invoice_number: invoiceNumber },
    });
  } catch (err) {
    if (conn && conn.rollback) {
      try { await conn.rollback(); } catch (_) { }
    }
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes('Unknown column') || msg.includes('ER_BAD_FIELD_ERROR')) {
      return res.status(500).json({ success: false, message: 'Invoice schema migration is required before converting quotations to invoices.' });
    }
    return res.status(500).json({ success: false, message: err.message || 'Failed to convert quotation to invoice' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/:id/convert/sales-order', verifyToken, async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid quotation id' });
    }

    const quotation = await loadQuotationDetails(id, req.employee.company_id, isManagerOrAdmin(req.employee), req.employee.id);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const items = normalizeQuotationItems(quotation.items || []);
    const totals = calculateQuotationTotals(items, quotation);
    const orderDate = normalizeDate(req.body?.order_date) || localYmd();
    const deliveryDate = normalizeDate(req.body?.delivery_date) || null;
    conn = await getConnection();
    const orderNumber = await nextDocumentNumber(conn, 'sales_order', orderDate);
    await conn.beginTransaction();

    const orderData = {
      company_id: req.employee.company_id,
      order_number: orderNumber,
      client_id: quotation.client_id || null,
      order_status: 'draft',
      order_date: orderDate,
      delivery_date: deliveryDate,
      reference_number: normalizeText(quotation.reference_number || ''),
      subject: normalizeText(quotation.subject || ''),
      billing_address: normalizeText(quotation.billing_address || quotation.customer_address || ''),
      shipping_address: normalizeText(quotation.shipping_address || quotation.customer_address || ''),
      gst_number: normalizeText(quotation.gst_number || quotation.customer_gst_number || ''),
      place_of_supply: normalizeText(quotation.place_of_supply || quotation.customer_state || ''),
      salesperson_id: quotation.salesperson_id || null,
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
      notes: normalizeText(quotation.notes || ''),
      created_by: req.employee.id,
    };

    const orderColumns = Object.keys(orderData);
    const orderPlaceholders = orderColumns.map(() => '?').join(',');
    const orderValues = orderColumns.map((key) => orderData[key]);
    const [result] = await conn.execute(
      `INSERT INTO sales_orders (${orderColumns.map((col) => `\`${col}\``).join(', ')}) VALUES (${orderPlaceholders})`,
      orderValues
    );
    const orderId = result.insertId;

    for (const item of items) {
      await conn.execute(
        'INSERT INTO sales_order_items (order_id, item_name, description, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)',
        [orderId, item.item_name, item.description || null, item.quantity, item.unit_price, item.total_price]
      );
    }

    await conn.execute(
      'UPDATE quotations SET status = ?, converted_at = COALESCE(converted_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
      ['converted', id, req.employee.company_id]
    ).catch(() => {});

    await conn.commit();
    await recordQuotationActivity(req.employee.id, id, 'quotation_converted_to_sales_order', `Converted to sales order ${orderNumber}`, req);
    return res.json({
      success: true,
      message: 'Quotation converted to sales order',
      data: { sales_order_id: orderId, order_number: orderNumber },
    });
  } catch (err) {
    if (conn && conn.rollback) {
      try { await conn.rollback(); } catch (_) { }
    }
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes('Unknown column') || msg.includes('ER_BAD_FIELD_ERROR')) {
      return res.status(500).json({ success: false, message: 'Sales order schema migration is required before converting quotations to sales orders.' });
    }
    return res.status(500).json({ success: false, message: err.message || 'Failed to convert quotation to sales order' });
  } finally {
    if (conn) conn.release();
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
    await query('DELETE FROM quotation_items WHERE quotation_id = ?', [id]).catch(() => {});
    await query('DELETE FROM quote_activities WHERE quotation_id = ?', [id]).catch(() => {});
    await query('DELETE FROM quote_revisions WHERE quotation_id = ?', [id]).catch(() => {});
    await query('DELETE FROM quotations WHERE id = ? AND company_id = ?', [id, req.employee.company_id]);
    return res.json({ success: true, message: 'Quotation deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
