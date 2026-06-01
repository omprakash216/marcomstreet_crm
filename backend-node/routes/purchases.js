const express = require('express');
const { getConnection, query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const PAYMENT_STATUSES = new Set(['pending', 'partial', 'paid']);
const PURCHASE_STATUSES = new Set(['ordered', 'received', 'cancelled']);

function normalizeRole(role) {
  return String(role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

function isSuperAdmin(employee) {
  const role = normalizeRole(employee?.role);
  return role === 'superadmin' || role === 'super_admin';
}

function getScopedCompanyId(req, body = {}) {
  if (isSuperAdmin(req.employee) && body.company_id) {
    const companyId = Number(body.company_id);
    return Number.isInteger(companyId) && companyId > 0 ? companyId : null;
  }

  const companyId = Number(req.employee?.company_id);
  return Number.isInteger(companyId) && companyId > 0 ? companyId : null;
}

async function safeSchemaQuery(sql) {
  try {
    return await query(sql);
  } catch (err) {
    const msg = String(err?.message || err?.sqlMessage || '');
    if (
      err?.code === 'ER_DUP_FIELDNAME' ||
      err?.code === 'ER_DUP_KEYNAME' ||
      /Duplicate column name/i.test(msg) ||
      /Duplicate key name/i.test(msg)
    ) {
      return null;
    }
    throw err;
  }
}

async function columnExists(tableName, columnName) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) return;
  await safeSchemaQuery(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function indexExists(tableName, indexName) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function addIndexIfMissing(tableName, indexName, ddl) {
  if (await indexExists(tableName, indexName)) return;
  await safeSchemaQuery(ddl);
}

async function ensurePurchasesSchema() {
  await safeSchemaQuery(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      purchase_no VARCHAR(50) NOT NULL,
      supplier_name VARCHAR(255) NOT NULL,
      supplier_email VARCHAR(255) NULL,
      supplier_phone VARCHAR(50) NULL,
      item_name VARCHAR(255) NOT NULL,
      item_code VARCHAR(100) NULL,
      category VARCHAR(120) NULL,
      warehouse VARCHAR(180) NULL,
      quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
      unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      purchase_date DATE NOT NULL,
      invoice_no VARCHAR(120) NULL,
      payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      status VARCHAR(30) NOT NULL DEFAULT 'ordered',
      add_to_inventory TINYINT(1) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_purchases_purchase_no (purchase_no),
      KEY idx_purchases_company_date (company_id, purchase_date),
      KEY idx_purchases_status (status, payment_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing('purchases', 'company_id', 'INT NULL');
  await addColumnIfMissing('purchases', 'purchase_no', 'VARCHAR(50) NOT NULL');
  await addColumnIfMissing('purchases', 'supplier_name', 'VARCHAR(255) NOT NULL');
  await addColumnIfMissing('purchases', 'supplier_email', 'VARCHAR(255) NULL');
  await addColumnIfMissing('purchases', 'supplier_phone', 'VARCHAR(50) NULL');
  await addColumnIfMissing('purchases', 'item_name', 'VARCHAR(255) NOT NULL');
  await addColumnIfMissing('purchases', 'item_code', 'VARCHAR(100) NULL');
  await addColumnIfMissing('purchases', 'category', 'VARCHAR(120) NULL');
  await addColumnIfMissing('purchases', 'warehouse', 'VARCHAR(180) NULL');
  await addColumnIfMissing('purchases', 'quantity', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing('purchases', 'unit_price', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing('purchases', 'tax_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing('purchases', 'discount_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing('purchases', 'total_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing('purchases', 'purchase_date', 'DATE NULL');
  await addColumnIfMissing('purchases', 'invoice_no', 'VARCHAR(120) NULL');
  await addColumnIfMissing('purchases', 'payment_status', "VARCHAR(30) NOT NULL DEFAULT 'pending'");
  await addColumnIfMissing('purchases', 'status', "VARCHAR(30) NOT NULL DEFAULT 'ordered'");
  await addColumnIfMissing('purchases', 'add_to_inventory', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing('purchases', 'notes', 'TEXT NULL');
  await addColumnIfMissing('purchases', 'created_by', 'INT NULL');
  await addColumnIfMissing('purchases', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('purchases', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  await addIndexIfMissing('purchases', 'uniq_purchases_purchase_no', 'CREATE UNIQUE INDEX uniq_purchases_purchase_no ON purchases (purchase_no)');
  await addIndexIfMissing('purchases', 'idx_purchases_company_date', 'CREATE INDEX idx_purchases_company_date ON purchases (company_id, purchase_date)');
  await addIndexIfMissing('purchases', 'idx_purchases_status', 'CREATE INDEX idx_purchases_status ON purchases (status, payment_status)');

  await safeSchemaQuery(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      name VARCHAR(255) NOT NULL,
      item_code VARCHAR(100) NULL,
      barcode VARCHAR(100) NULL,
      category VARCHAR(100) NULL,
      sub_category VARCHAR(100) NULL,
      location VARCHAR(255) NULL,
      quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
      minimum_stock_level DECIMAL(12,2) NOT NULL DEFAULT 0,
      unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      supplier VARCHAR(255) NULL,
      purchase_date DATE NULL,
      description TEXT NULL,
      status VARCHAR(30) DEFAULT 'available',
      assigned_to_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await addColumnIfMissing('inventory', 'company_id', 'INT NULL');
  await addColumnIfMissing('inventory', 'item_code', 'VARCHAR(100) NULL');
  await addColumnIfMissing('inventory', 'barcode', 'VARCHAR(100) NULL');
  await addColumnIfMissing('inventory', 'category', 'VARCHAR(100) NULL');
  await addColumnIfMissing('inventory', 'sub_category', 'VARCHAR(100) NULL');
  await addColumnIfMissing('inventory', 'location', 'VARCHAR(255) NULL');
  await addColumnIfMissing('inventory', 'minimum_stock_level', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing('inventory', 'unit_price', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing('inventory', 'supplier', 'VARCHAR(255) NULL');
  await addColumnIfMissing('inventory', 'purchase_date', 'DATE NULL');
  await addColumnIfMissing('inventory', 'description', 'TEXT NULL');
  await addColumnIfMissing('inventory', 'status', "VARCHAR(30) DEFAULT 'available'");
  await addColumnIfMissing('inventory', 'assigned_to_id', 'INT NULL');
  await addColumnIfMissing('inventory', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('inventory', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
}

function toAmount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function normalizePayload(body = {}) {
  const quantity = toAmount(body.quantity);
  const unitPrice = toAmount(body.unit_price);
  const taxAmount = toAmount(body.tax_amount);
  const discountAmount = toAmount(body.discount_amount);
  const totalAmount = Math.max(0, toAmount(body.total_amount || (quantity * unitPrice + taxAmount - discountAmount)));
  const paymentStatus = PAYMENT_STATUSES.has(String(body.payment_status || '').toLowerCase())
    ? String(body.payment_status).toLowerCase()
    : 'pending';
  const status = PURCHASE_STATUSES.has(String(body.status || '').toLowerCase())
    ? String(body.status).toLowerCase()
    : 'ordered';

  return {
    supplier_name: String(body.supplier_name || '').trim(),
    supplier_email: String(body.supplier_email || '').trim() || null,
    supplier_phone: String(body.supplier_phone || '').trim() || null,
    item_name: String(body.item_name || '').trim(),
    item_code: String(body.item_code || '').trim().toUpperCase() || null,
    category: String(body.category || '').trim() || null,
    warehouse: String(body.warehouse || '').trim() || null,
    quantity,
    unit_price: unitPrice,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total_amount: totalAmount,
    purchase_date: body.purchase_date || new Date().toISOString().slice(0, 10),
    invoice_no: String(body.invoice_no || '').trim() || null,
    payment_status: paymentStatus,
    status,
    add_to_inventory: body.add_to_inventory === true || body.add_to_inventory === 1 || body.add_to_inventory === '1',
    notes: String(body.notes || '').trim() || null,
  };
}

function validatePayload(data, companyId) {
  if (!companyId) return 'Company is required';
  if (!data.supplier_name) return 'Supplier name is required';
  if (!data.item_name) return 'Item name is required';
  if (!data.purchase_date || Number.isNaN(Date.parse(data.purchase_date))) return 'Purchase date is required';
  if (!Number.isFinite(data.quantity) || data.quantity <= 0) return 'Quantity must be greater than 0';
  if (!Number.isFinite(data.unit_price) || data.unit_price < 0) return 'Unit price is invalid';
  if (!Number.isFinite(data.tax_amount) || data.tax_amount < 0) return 'Tax amount is invalid';
  if (!Number.isFinite(data.discount_amount) || data.discount_amount < 0) return 'Discount amount is invalid';
  return null;
}

async function run(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

function buildPurchaseNo(id, purchaseDate) {
  const year = String(purchaseDate || new Date().toISOString()).slice(0, 4) || new Date().getFullYear();
  return `PO${year}${String(id).padStart(5, '0')}`;
}

async function syncInventory(conn, purchase, purchaseId, companyId) {
  if (!purchase.add_to_inventory || purchase.status !== 'received') return;

  const itemCode = purchase.item_code || `PUR${String(purchaseId).padStart(5, '0')}`;
  const existing = await run(
    conn,
    `SELECT id, quantity
     FROM inventory
     WHERE company_id = ?
       AND (item_code = ? OR (item_code IS NULL AND LOWER(name) = LOWER(?)))
     ORDER BY id ASC
     LIMIT 1`,
    [companyId, itemCode, purchase.item_name]
  );

  if (existing[0]) {
    await run(
      conn,
      `UPDATE inventory
       SET quantity = COALESCE(quantity, 0) + ?,
           unit_price = ?,
           supplier = ?,
           purchase_date = ?,
           category = COALESCE(NULLIF(?, ''), category),
           location = COALESCE(NULLIF(?, ''), location),
           updated_at = NOW()
       WHERE id = ?`,
      [
        purchase.quantity,
        purchase.unit_price,
        purchase.supplier_name,
        purchase.purchase_date,
        purchase.category || '',
        purchase.warehouse || '',
        existing[0].id,
      ]
    );
    return;
  }

  await run(
    conn,
    `INSERT INTO inventory
       (company_id, name, item_code, category, location, quantity, minimum_stock_level, unit_price, supplier, purchase_date, description, status)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'available')`,
    [
      companyId,
      purchase.item_name,
      itemCode,
      purchase.category,
      purchase.warehouse,
      purchase.quantity,
      purchase.unit_price,
      purchase.supplier_name,
      purchase.purchase_date,
      purchase.notes,
    ]
  );
}

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    await ensurePurchasesSchema();

    const params = [];
    const where = [];
    if (isSuperAdmin(req.employee) && req.query.company_id) {
      where.push('p.company_id = ?');
      params.push(req.query.company_id);
    } else if (!isSuperAdmin(req.employee)) {
      where.push('p.company_id = ?');
      params.push(req.employee.company_id);
    }

    if (req.query.status && req.query.status !== 'all') {
      where.push('p.status = ?');
      params.push(req.query.status);
    }
    if (req.query.payment_status && req.query.payment_status !== 'all') {
      where.push('p.payment_status = ?');
      params.push(req.query.payment_status);
    }
    if (req.query.search) {
      where.push('(p.purchase_no LIKE ? OR p.supplier_name LIKE ? OR p.item_name LIKE ? OR p.invoice_no LIKE ?)');
      const term = `%${req.query.search}%`;
      params.push(term, term, term, term);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(
      `SELECT p.*, c.company_name
       FROM purchases p
       LEFT JOIN companies c ON c.id = p.company_id
       ${whereSql}
       ORDER BY p.purchase_date DESC, p.id DESC`,
      params
    );

    const statsRows = await query(
      `SELECT
         COUNT(*) AS total_purchases,
         COALESCE(SUM(total_amount), 0) AS total_value,
         COALESCE(SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END), 0) AS received_count,
         COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_payments
       FROM purchases p
       ${whereSql}`,
      params
    );

    return res.json({
      success: true,
      data: rows || [],
      statistics: statsRows?.[0] || {
        total_purchases: 0,
        total_value: 0,
        received_count: 0,
        pending_payments: 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  let conn;
  try {
    await ensurePurchasesSchema();

    const data = normalizePayload(req.body);
    const companyId = getScopedCompanyId(req, req.body);
    const validationMessage = validatePayload(data, companyId);
    if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });

    conn = await getConnection();
    await conn.query('START TRANSACTION');

    const tempNo = `TMP${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const result = await run(
      conn,
      `INSERT INTO purchases
        (company_id, purchase_no, supplier_name, supplier_email, supplier_phone, item_name, item_code, category, warehouse,
         quantity, unit_price, tax_amount, discount_amount, total_amount, purchase_date, invoice_no,
         payment_status, status, add_to_inventory, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        tempNo,
        data.supplier_name,
        data.supplier_email,
        data.supplier_phone,
        data.item_name,
        data.item_code,
        data.category,
        data.warehouse,
        data.quantity,
        data.unit_price,
        data.tax_amount,
        data.discount_amount,
        data.total_amount,
        data.purchase_date,
        data.invoice_no,
        data.payment_status,
        data.status,
        data.add_to_inventory ? 1 : 0,
        data.notes,
        req.employee.id || null,
      ]
    );

    const purchaseNo = buildPurchaseNo(result.insertId, data.purchase_date);
    await run(conn, 'UPDATE purchases SET purchase_no = ? WHERE id = ?', [purchaseNo, result.insertId]);
    await syncInventory(conn, data, result.insertId, companyId);

    await conn.query('COMMIT');
    return res.json({ success: true, message: 'Purchase saved successfully', data: { id: result.insertId, purchase_no: purchaseNo } });
  } catch (err) {
    if (conn) await conn.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

router.put('/:id', async (req, res) => {
  let conn;
  try {
    await ensurePurchasesSchema();

    const purchaseId = Number(req.params.id);
    if (!purchaseId) return res.status(400).json({ success: false, message: 'Invalid purchase ID' });

    const data = normalizePayload(req.body);
    const companyId = getScopedCompanyId(req, req.body);
    const validationMessage = validatePayload(data, companyId);
    if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });

    conn = await getConnection();
    await conn.query('START TRANSACTION');

    const existing = await run(
      conn,
      `SELECT * FROM purchases WHERE id = ? ${isSuperAdmin(req.employee) ? '' : 'AND company_id = ?'} LIMIT 1`,
      isSuperAdmin(req.employee) ? [purchaseId] : [purchaseId, req.employee.company_id]
    );
    if (!existing[0]) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    await run(
      conn,
      `UPDATE purchases
       SET company_id = ?, supplier_name = ?, supplier_email = ?, supplier_phone = ?, item_name = ?, item_code = ?,
           category = ?, warehouse = ?, quantity = ?, unit_price = ?, tax_amount = ?, discount_amount = ?,
           total_amount = ?, purchase_date = ?, invoice_no = ?, payment_status = ?, status = ?,
           add_to_inventory = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        companyId,
        data.supplier_name,
        data.supplier_email,
        data.supplier_phone,
        data.item_name,
        data.item_code,
        data.category,
        data.warehouse,
        data.quantity,
        data.unit_price,
        data.tax_amount,
        data.discount_amount,
        data.total_amount,
        data.purchase_date,
        data.invoice_no,
        data.payment_status,
        data.status,
        data.add_to_inventory ? 1 : 0,
        data.notes,
        purchaseId,
      ]
    );

    const wasReceived = existing[0].status === 'received' && Number(existing[0].add_to_inventory) === 1;
    if (!wasReceived) {
      await syncInventory(conn, data, purchaseId, companyId);
    }

    await conn.query('COMMIT');
    return res.json({ success: true, message: 'Purchase updated successfully' });
  } catch (err) {
    if (conn) await conn.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

router.patch('/:id/status', async (req, res) => {
  let conn;
  try {
    await ensurePurchasesSchema();
    const purchaseId = Number(req.params.id);
    const status = String(req.body?.status || '').toLowerCase();
    const paymentStatus = String(req.body?.payment_status || '').toLowerCase();
    const fields = [];
    const params = [];

    if (status) {
      if (!PURCHASE_STATUSES.has(status)) return res.status(400).json({ success: false, message: 'Invalid purchase status' });
      fields.push('status = ?');
      params.push(status);
    }
    if (paymentStatus) {
      if (!PAYMENT_STATUSES.has(paymentStatus)) return res.status(400).json({ success: false, message: 'Invalid payment status' });
      fields.push('payment_status = ?');
      params.push(paymentStatus);
    }
    if (!purchaseId || !fields.length) return res.status(400).json({ success: false, message: 'Nothing to update' });

    conn = await getConnection();
    await conn.query('START TRANSACTION');

    const existing = await run(
      conn,
      `SELECT * FROM purchases WHERE id = ? ${isSuperAdmin(req.employee) ? '' : 'AND company_id = ?'} LIMIT 1`,
      isSuperAdmin(req.employee) ? [purchaseId] : [purchaseId, req.employee.company_id]
    );
    if (!existing[0]) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    params.push(purchaseId);
    if (!isSuperAdmin(req.employee)) params.push(req.employee.company_id);

    await run(
      conn,
      `UPDATE purchases SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = ? ${isSuperAdmin(req.employee) ? '' : 'AND company_id = ?'}`,
      params
    );

    if (
      status === 'received' &&
      existing[0].status !== 'received' &&
      Number(existing[0].add_to_inventory || 0) === 1
    ) {
      await syncInventory(
        conn,
        {
          ...existing[0],
          status: 'received',
          add_to_inventory: true,
        },
        purchaseId,
        existing[0].company_id
      );
    }

    await conn.query('COMMIT');
    return res.json({ success: true, message: 'Purchase status updated' });
  } catch (err) {
    if (conn) await conn.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await ensurePurchasesSchema();
    const purchaseId = Number(req.params.id);
    if (!purchaseId) return res.status(400).json({ success: false, message: 'Invalid purchase ID' });

    const params = [purchaseId];
    if (!isSuperAdmin(req.employee)) params.push(req.employee.company_id);
    await query(
      `DELETE FROM purchases WHERE id = ? ${isSuperAdmin(req.employee) ? '' : 'AND company_id = ?'}`,
      params
    );

    return res.json({ success: true, message: 'Purchase deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
