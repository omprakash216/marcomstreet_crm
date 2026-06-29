const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLog');
const { localYmd, nextDocumentNumber } = require('../utils/documentNumbers');
const { generateSalesOrderPdfBuffer } = require('../services/templateDocumentPdf');
const { sendSalesDocumentEmail } = require('../services/salesDocumentMailer');

const router = express.Router();

const allowedRoles = ['admin', 'manager', 'superadmin', 'super_admin'];

function canSeeAll(emp) {
  return allowedRoles.includes(String(emp?.role || '').toLowerCase().trim());
}

function money2(value) {
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeOrderStatus(status) {
  const normalized = String(status || 'draft').toLowerCase().trim();
  const allowed = new Set(['draft', 'sent', 'confirmed', 'fulfilled', 'converted', 'cancelled']);
  return allowed.has(normalized) ? normalized : 'draft';
}

function mapCompanySettings(row = {}) {
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

async function getCompanySettings(companyId) {
  if (!companyId) return mapCompanySettings();
  const rows = await query(
    'SELECT * FROM company_settings WHERE company_id = ? ORDER BY id DESC LIMIT 1',
    [companyId]
  ).catch(() => []);
  if (rows?.[0]) return mapCompanySettings(rows[0]);
  const companyRows = await query('SELECT * FROM companies WHERE id = ? LIMIT 1', [companyId]).catch(() => []);
  return mapCompanySettings(companyRows?.[0] || {});
}

function normalizeItems(items = []) {
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
      const total = money2(taxable + taxAmount);
      return {
        item_name: normalizeText(item?.item_name),
        description: normalizeText(item?.description),
        quantity,
        unit_price: unitPrice,
        discount_percentage: discount,
        tax_percentage: tax,
        total_price: total,
      };
    })
    .filter((item) => item.item_name && item.quantity > 0);
}

function calcTotals(items = [], payload = {}) {
  const subtotal = money2(items.reduce((sum, item) => sum + money2(item.unit_price * item.quantity), 0));
  const discountPct = money2(payload.discount_percentage || 0);
  const tdsPct = money2(payload.tds_percentage || 0);
  const taxPct = money2(payload.tax_percentage || 0);
  const adjustmentAmount = money2(payload.adjustment_amount || 0);
  const roundOffAmount = money2(payload.round_off_amount || 0);
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

async function loadClient(companyId, clientId) {
  if (!clientId) return null;
  const rows = await query(
    `SELECT sc.*, CONCAT('CL-', LPAD(sc.id, 6, '0')) AS client_code
     FROM sales_clients sc
     WHERE sc.id = ? AND sc.company_id = ? LIMIT 1`,
    [clientId, companyId]
  ).catch(() => []);
  return rows?.[0] || null;
}

function buildCustomerLines(client = {}) {
  return {
    client_name: client?.company_name || client?.full_name || '',
    contact_person: client?.full_name || client?.company_name || '',
    client_address: client?.address || '',
    client_phone: client?.phone_number || '',
    client_email: client?.email || '',
    client_gst_number: client?.gst_number || '',
    client_pan_number: client?.pan_number || '',
    billing_address: client?.address || '',
    shipping_address: client?.address || '',
    place_of_supply: client?.state || '',
  };
}

async function loadOrderDetails(orderId, companyId, canAll, employeeId) {
  const rows = await query(
    `SELECT o.*, c.full_name, c.company_name, c.phone_number, c.email, c.address, c.city, c.state, c.postal_code,
            c.gst_number, c.pan_number, c.client_code, e.name AS created_by_name
     FROM sales_orders o
     LEFT JOIN sales_clients c ON c.id = o.client_id
     LEFT JOIN employees e ON e.id = o.created_by
     WHERE o.id = ? AND o.company_id = ? ${canAll ? '' : 'AND o.created_by = ?'}`,
    canAll ? [orderId, companyId] : [orderId, companyId, employeeId]
  ).catch(() => []);
  const order = rows?.[0] || null;
  if (!order) return null;

  const items = await query(
    'SELECT * FROM sales_order_items WHERE order_id = ? ORDER BY id ASC',
    [orderId]
  ).catch(() => []);

  let activities = await query(
    `SELECT a.*, e.name AS employee_name
     FROM sales_order_activities a
     LEFT JOIN employees e ON e.id = a.created_by
     WHERE a.sales_order_id = ? AND (a.company_id = ? OR a.company_id IS NULL)
     ORDER BY a.created_at DESC`,
    [orderId, companyId]
  ).catch(() => []);
  if (!activities.length) {
    activities = await query(
      `SELECT a.*, e.name AS employee_name
       FROM activity_logs a
       LEFT JOIN employees e ON e.id = a.employee_id
       WHERE a.entity_type = 'sales_order' AND a.entity_id = ?
       ORDER BY a.created_at DESC`,
      [orderId]
    ).catch(() => []);
  }

  return {
    ...order,
    client_name: order.company_name || order.full_name || 'Customer',
    contact_person: order.full_name || order.company_name || '',
    client_phone: order.phone_number || '',
    client_email: order.email || '',
    client_address: [order.address, order.city, order.state, order.postal_code].filter(Boolean).join(', '),
    client_gst_number: order.gst_number || '',
    client_pan_number: order.pan_number || '',
    items,
    activities,
  };
}

async function recordOrderActivity(employeeId, entityId, action, description, req) {
  await logActivity(employeeId, action, 'sales_order', entityId, description, req);
  await query(
    `INSERT INTO sales_order_activities (company_id, sales_order_id, action, description, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [req?.employee?.company_id || null, entityId, action, description || null, employeeId]
  ).catch(() => {});
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const search = normalizeText(req.query.search || '');
    const status = normalizeText(req.query.status || '');
    const dateFrom = normalizeText(req.query.date_from || '');
    const dateTo = normalizeText(req.query.date_to || '');

    let sql = `SELECT o.*, c.full_name, c.company_name, c.phone_number, c.email, c.gst_number,
                      e.name AS created_by_name
               FROM sales_orders o
               LEFT JOIN sales_clients c ON c.id = o.client_id
               LEFT JOIN employees e ON e.id = o.created_by
               WHERE o.company_id = ?`;
    const params = [req.employee.company_id];

    if (!canSeeAll(req.employee)) {
      sql += ' AND o.created_by = ?';
      params.push(req.employee.id);
    }

    if (search) {
      const term = `%${search}%`;
      sql += ` AND (o.order_number LIKE ? OR COALESCE(o.reference_number, '') LIKE ? OR COALESCE(o.subject, '') LIKE ? OR COALESCE(c.company_name, '') LIKE ? OR COALESCE(c.full_name, '') LIKE ?)`;
      params.push(term, term, term, term, term);
    }

    if (status) {
      sql += ' AND o.order_status = ?';
      params.push(status);
    }

    if (dateFrom) {
      sql += ' AND DATE(COALESCE(o.order_date, o.created_at)) >= ?';
      params.push(dateFrom.slice(0, 10));
    }

    if (dateTo) {
      sql += ' AND DATE(COALESCE(o.order_date, o.created_at)) <= ?';
      params.push(dateTo.slice(0, 10));
    }

    sql += ' ORDER BY o.created_at DESC LIMIT 250';
    const rows = await query(sql, params).catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load sales orders' });
  }
});

router.get('/template-settings', verifyToken, async (req, res) => {
  try {
    const settings = await getCompanySettings(req.employee?.company_id);
    return res.json({ success: true, data: settings });
  } catch (_) {
    return res.json({ success: true, data: mapCompanySettings() });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }

    const order = await loadOrderDetails(id, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!order) return res.status(404).json({ success: false, message: 'Sales order not found' });
    return res.json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load sales order' });
  }
});

router.get('/:id/pdf', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid sales order id' });
    }

    const order = await loadOrderDetails(id, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!order) return res.status(404).json({ success: false, message: 'Sales order not found' });

    const settings = await getCompanySettings(req.employee?.company_id);
    const pdfBuffer = await generateSalesOrderPdfBuffer(order, settings);
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 100) {
      return res.status(500).json({ success: false, message: 'Failed to generate sales order PDF' });
    }

    const wantsDownload = req.query.download === '1' || req.query.download === 'true' || req.query.disposition === 'attachment';
    const safeName = `sales_order_${String(order.order_number || `SO-${id}`).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `${wantsDownload ? 'attachment' : 'inline'}; filename="${safeName}"`);
    return res.end(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to generate sales order PDF' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    const body = req.body || {};
    const clientId = Number(body.client_id || 0);
    const items = normalizeItems(body.items || []);
    if (!clientId) return res.status(400).json({ success: false, message: 'client_id is required' });
    if (!items.length) return res.status(400).json({ success: false, message: 'At least one item is required' });

    const client = await loadClient(req.employee.company_id, clientId);
    if (!client) return res.status(404).json({ success: false, message: 'Customer not found' });

    const totals = calcTotals(items, body);
    const orderDate = body.order_date ? String(body.order_date).slice(0, 10) : localYmd();
    const deliveryDate = body.delivery_date ? String(body.delivery_date).slice(0, 10) : null;
    const status = normalizeOrderStatus(body.status || body.order_status || 'draft');
    const orderNumber = await nextDocumentNumber(conn, 'sales_order', orderDate);
    const customer = buildCustomerLines(client);

    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO sales_orders
       (company_id, order_number, client_id, order_status, order_date, delivery_date, reference_number, subject,
        billing_address, shipping_address, gst_number, place_of_supply, salesperson_id,
        subtotal, tax_percentage, tax_amount, tds_percentage, tds_amount,
        discount_percentage, discount_amount, adjustment_amount, round_off_amount, total_amount,
        notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.employee.company_id,
        orderNumber,
        clientId,
        status,
        orderDate,
        deliveryDate,
        normalizeText(body.reference_number || ''),
        normalizeText(body.subject || ''),
        normalizeText(body.billing_address || customer.billing_address),
        normalizeText(body.shipping_address || customer.shipping_address),
        normalizeText(body.gst_number || customer.client_gst_number),
        normalizeText(body.place_of_supply || customer.place_of_supply),
        body.salesperson_id ? Number(body.salesperson_id) : null,
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
        normalizeText(body.notes || ''),
        req.employee.id,
      ]
    );

    const orderId = result.insertId;
    for (const item of items) {
      await conn.execute(
        `INSERT INTO sales_order_items (order_id, item_name, description, quantity, unit_price, total_price)
         VALUES (?,?,?,?,?,?)`,
        [orderId, item.item_name, item.description || null, item.quantity, item.unit_price, item.total_price]
      );
    }

    await conn.commit();
    await recordOrderActivity(req.employee.id, orderId, 'sales_order_created', `Sales order ${orderNumber} created`, req);
    return res.json({
      success: true,
      message: 'Sales order created',
      data: { id: orderId, order_number: orderNumber, total_amount: totals.total_amount },
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ success: false, message: err.message || 'Failed to create sales order' });
  } finally {
    conn.release();
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }

    const canAll = canSeeAll(req.employee);
    const existingRows = await query(
      `SELECT * FROM sales_orders WHERE id = ? AND company_id = ? ${canAll ? '' : 'AND created_by = ?'}`,
      canAll ? [id, req.employee.company_id] : [id, req.employee.company_id, req.employee.id]
    ).catch(() => []);
    const existing = existingRows?.[0] || null;
    if (!existing) return res.status(404).json({ success: false, message: 'Sales order not found' });

    const body = req.body || {};
    const clientId = Number(body.client_id || existing.client_id || 0);
    if (!clientId) return res.status(400).json({ success: false, message: 'client_id is required' });
    const client = await loadClient(req.employee.company_id, clientId);
    if (!client) return res.status(404).json({ success: false, message: 'Customer not found' });

    const items = normalizeItems(body.items || []);
    if (!items.length) return res.status(400).json({ success: false, message: 'At least one item is required' });
    const totals = calcTotals(items, body);
    const orderDate = body.order_date ? String(body.order_date).slice(0, 10) : (existing.order_date ? String(existing.order_date).slice(0, 10) : localYmd());
    const deliveryDate = body.delivery_date ? String(body.delivery_date).slice(0, 10) : (existing.delivery_date ? String(existing.delivery_date).slice(0, 10) : null);
    const status = normalizeOrderStatus(body.status || body.order_status || existing.order_status || 'draft');
    const customer = buildCustomerLines(client);

    await conn.beginTransaction();
    await conn.execute(
      `UPDATE sales_orders SET
        client_id=?,
        order_status=?,
        order_date=?,
        delivery_date=?,
        reference_number=?,
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
        notes=?,
        updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND company_id=?`,
      [
        clientId,
        status,
        orderDate,
        deliveryDate,
        normalizeText(body.reference_number || existing.reference_number || ''),
        normalizeText(body.subject || existing.subject || ''),
        normalizeText(body.billing_address || customer.billing_address),
        normalizeText(body.shipping_address || customer.shipping_address),
        normalizeText(body.gst_number || customer.client_gst_number),
        normalizeText(body.place_of_supply || customer.place_of_supply),
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
        normalizeText(body.notes || existing.notes || ''),
        id,
        req.employee.company_id,
      ]
    );

    await conn.execute('DELETE FROM sales_order_items WHERE order_id = ?', [id]);
    for (const item of items) {
      await conn.execute(
        `INSERT INTO sales_order_items (order_id, item_name, description, quantity, unit_price, total_price)
         VALUES (?,?,?,?,?,?)`,
        [id, item.item_name, item.description || null, item.quantity, item.unit_price, item.total_price]
      );
    }

    await conn.commit();
    await recordOrderActivity(req.employee.id, id, 'sales_order_updated', `Sales order ${existing.order_number} updated`, req);
    return res.json({ success: true, message: 'Sales order updated', data: { id, total_amount: totals.total_amount } });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ success: false, message: err.message || 'Failed to update sales order' });
  } finally {
    conn.release();
  }
});

router.post('/:id/duplicate', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }

    const order = await loadOrderDetails(id, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!order) return res.status(404).json({ success: false, message: 'Sales order not found' });

    const newDate = localYmd();
    const newNumber = await nextDocumentNumber(conn, 'sales_order', newDate);
    const items = normalizeItems(order.items || []);
    const totals = calcTotals(items, order);

    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO sales_orders
       (company_id, order_number, client_id, order_status, order_date, delivery_date, reference_number, subject,
        billing_address, shipping_address, gst_number, place_of_supply, salesperson_id,
        subtotal, tax_percentage, tax_amount, tds_percentage, tds_amount,
        discount_percentage, discount_amount, adjustment_amount, round_off_amount, total_amount,
        notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.employee.company_id,
        newNumber,
        order.client_id,
        'draft',
        newDate,
        order.delivery_date ? String(order.delivery_date).slice(0, 10) : null,
        order.reference_number || null,
        order.subject || null,
        order.billing_address || null,
        order.shipping_address || null,
        order.gst_number || null,
        order.place_of_supply || null,
        order.salesperson_id || null,
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
        order.notes || null,
        req.employee.id,
      ]
    );

    const newId = result.insertId;
    for (const item of order.items || []) {
      await conn.execute(
        `INSERT INTO sales_order_items (order_id, item_name, description, quantity, unit_price, total_price)
         VALUES (?,?,?,?,?,?)`,
        [newId, item.item_name, item.description || null, item.quantity, item.unit_price, item.total_price]
      );
    }
    await conn.commit();
    await recordOrderActivity(req.employee.id, newId, 'sales_order_duplicated', `Sales order duplicated from ${order.order_number}`, req);
    return res.json({ success: true, message: 'Sales order duplicated', data: { id: newId, order_number: newNumber } });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ success: false, message: err.message || 'Failed to duplicate sales order' });
  } finally {
    conn.release();
  }
});

router.post('/:id/convert/invoice', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }

    const order = await loadOrderDetails(id, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!order) return res.status(404).json({ success: false, message: 'Sales order not found' });

    const invoiceNumber = await nextDocumentNumber(conn, 'invoice', localYmd());
    const items = normalizeItems(order.items || []);
    const totals = calcTotals(items, order);

    await conn.beginTransaction();
    const [invoiceResult] = await conn.execute(
      `INSERT INTO invoices
       (company_id, invoice_number, quotation_id, client_id, lead_id, employee_id, issue_date, due_date,
        order_number, subject, billing_address, shipping_address, gst_number, place_of_supply, salesperson_id,
        subtotal, tax_percentage, tax_amount, tds_percentage, tds_amount,
        discount_percentage, discount_amount, adjustment_amount, round_off_amount, total_amount,
        status, notes, payment_terms)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.employee.company_id,
        invoiceNumber,
        null,
        order.client_id,
        null,
        req.employee.id,
        order.order_date || localYmd(),
        order.delivery_date || null,
        order.order_number,
        order.subject || null,
        order.billing_address || null,
        order.shipping_address || null,
        order.gst_number || null,
        order.place_of_supply || null,
        order.salesperson_id || null,
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
        'draft',
        order.notes || null,
        order.terms_conditions || null,
      ]
    );

    const invoiceId = invoiceResult.insertId;
    for (const item of items) {
      await conn.execute(
        `INSERT INTO invoice_items (invoice_id, item_name, description, quantity, unit_price, total_price)
         VALUES (?,?,?,?,?,?)`,
        [invoiceId, item.item_name, item.description || null, item.quantity, item.unit_price, item.total_price]
      );
    }

    await conn.execute(
      'UPDATE sales_orders SET order_status = ?, converted_invoice_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
      ['converted', invoiceId, id, req.employee.company_id]
    ).catch(() => {});

    await conn.commit();
    await recordOrderActivity(req.employee.id, id, 'sales_order_converted', `Converted to invoice ${invoiceNumber}`, req);
    return res.json({
      success: true,
      message: 'Sales order converted to invoice',
      data: { invoice_id: invoiceId, invoice_number: invoiceNumber },
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ success: false, message: err.message || 'Failed to convert sales order' });
  } finally {
    conn.release();
  }
});

router.post('/:id/email', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }

    const order = await loadOrderDetails(id, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!order) return res.status(404).json({ success: false, message: 'Sales order not found' });

    const settings = await getCompanySettings(req.employee?.company_id);
    const pdfBuffer = await generateSalesOrderPdfBuffer(order, settings);
    const recipient = normalizeText(req.body?.to || order.client_email);
    if (!recipient) {
      return res.status(400).json({ success: false, message: 'Customer email is required' });
    }

    const subject = normalizeText(req.body?.subject || `Sales Order ${order.order_number}`);
    const text = normalizeText(
      req.body?.text ||
      `Please find attached sales order ${order.order_number}.`
    );

    await sendSalesDocumentEmail({
      companyId: req.employee.company_id,
      moduleType: 'sales',
      entityType: 'sales_order',
      entityId: id,
      to: recipient,
      subject,
      text,
      html: `<p>${text.replace(/\n/g, '<br>')}</p>`,
      attachments: [
        {
          filename: `${String(order.order_number || `SO-${id}`).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    await recordOrderActivity(req.employee.id, id, 'sales_order_emailed', `Email sent to ${recipient}`, req);
    return res.json({ success: true, message: 'Sales order emailed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to email sales order' });
  }
});

router.get('/:id/activities', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }

    let activities = await query(
      `SELECT a.*, e.name AS employee_name
       FROM sales_order_activities a
       LEFT JOIN employees e ON e.id = a.created_by
       WHERE a.sales_order_id = ? AND (a.company_id = ? OR a.company_id IS NULL)
       ORDER BY a.created_at DESC`,
      [id, req.employee.company_id]
    ).catch(() => []);
    if (!activities.length) {
      activities = await query(
        `SELECT a.*, e.name AS employee_name
         FROM activity_logs a
         LEFT JOIN employees e ON e.id = a.employee_id
         WHERE a.entity_type = 'sales_order' AND a.entity_id = ?
         ORDER BY a.created_at DESC`,
        [id]
      ).catch(() => []);
    }
    return res.json({ success: true, data: activities || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load activities' });
  }
});

router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }

    const status = normalizeOrderStatus(req.body?.status);
    const canAll = canSeeAll(req.employee);
    const params = [status, id, req.employee.company_id];
    let sql = 'UPDATE sales_orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?';
    if (!canAll) {
      sql += ' AND created_by = ?';
      params.push(req.employee.id);
    }

    const result = await query(sql, params);
    if (result && typeof result.affectedRows === 'number' && result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Sales order not found' });
    }
    await recordOrderActivity(req.employee.id, id, 'sales_order_status_changed', `Sales order status changed to ${status}`, req);
    return res.json({ success: true, message: 'Sales order status updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update sales order status' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }

    const canAll = canSeeAll(req.employee);
    const params = [id, req.employee.company_id];
    let sql = 'DELETE FROM sales_orders WHERE id = ? AND company_id = ?';
    if (!canAll) {
      sql += ' AND created_by = ?';
      params.push(req.employee.id);
    }

    await query('DELETE FROM sales_order_items WHERE order_id = ?', [id]).catch(() => {});
    await query('DELETE FROM sales_order_activities WHERE sales_order_id = ?', [id]).catch(() => {});
    const result = await query(sql, params);
    if (result && typeof result.affectedRows === 'number' && result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Sales order not found' });
    }

    await recordOrderActivity(req.employee.id, id, 'sales_order_deleted', 'Sales order deleted', req);
    return res.json({ success: true, message: 'Sales order deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete sales order' });
  }
});

module.exports = router;
