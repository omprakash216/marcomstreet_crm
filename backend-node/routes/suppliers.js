const express = require('express');
const { getConnection, query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const SUPPLIER_STATUSES = new Set(['active', 'inactive', 'blacklisted']);
const INTERACTION_TYPES = new Set(['call', 'email', 'meeting', 'note', 'whatsapp']);

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

async function tableExists(tableName) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );
  return Array.isArray(rows) && rows.length > 0;
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

async function ensureSuppliersSchema() {
  await safeSchemaQuery(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(255) NULL,
      email VARCHAR(255) NULL,
      phone VARCHAR(50) NULL,
      gstin VARCHAR(50) NULL,
      address TEXT NULL,
      city VARCHAR(120) NULL,
      state VARCHAR(120) NULL,
      category VARCHAR(120) NULL,
      payment_terms VARCHAR(120) NULL,
      opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_suppliers_company_name (company_id, name),
      KEY idx_suppliers_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing('suppliers', 'company_id', 'INT NULL');
  await addColumnIfMissing('suppliers', 'name', 'VARCHAR(255) NOT NULL');
  await addColumnIfMissing('suppliers', 'contact_person', 'VARCHAR(255) NULL');
  await addColumnIfMissing('suppliers', 'email', 'VARCHAR(255) NULL');
  await addColumnIfMissing('suppliers', 'phone', 'VARCHAR(50) NULL');
  await addColumnIfMissing('suppliers', 'gstin', 'VARCHAR(50) NULL');
  await addColumnIfMissing('suppliers', 'address', 'TEXT NULL');
  await addColumnIfMissing('suppliers', 'city', 'VARCHAR(120) NULL');
  await addColumnIfMissing('suppliers', 'state', 'VARCHAR(120) NULL');
  await addColumnIfMissing('suppliers', 'category', 'VARCHAR(120) NULL');
  await addColumnIfMissing('suppliers', 'payment_terms', 'VARCHAR(120) NULL');
  await addColumnIfMissing('suppliers', 'opening_balance', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing('suppliers', 'status', "VARCHAR(30) NOT NULL DEFAULT 'active'");
  await addColumnIfMissing('suppliers', 'notes', 'TEXT NULL');
  await addColumnIfMissing('suppliers', 'created_by', 'INT NULL');
  await addColumnIfMissing('suppliers', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('suppliers', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addIndexIfMissing('suppliers', 'idx_suppliers_company_name', 'CREATE INDEX idx_suppliers_company_name ON suppliers (company_id, name)');
  await addIndexIfMissing('suppliers', 'idx_suppliers_status', 'CREATE INDEX idx_suppliers_status ON suppliers (status)');

  await safeSchemaQuery(`
    CREATE TABLE IF NOT EXISTS supplier_interactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      supplier_id INT NOT NULL,
      type VARCHAR(30) NOT NULL DEFAULT 'note',
      subject VARCHAR(255) NOT NULL,
      description TEXT NULL,
      interaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      follow_up_date DATE NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_supplier_interactions_supplier (supplier_id, interaction_date),
      KEY idx_supplier_interactions_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing('supplier_interactions', 'company_id', 'INT NULL');
  await addColumnIfMissing('supplier_interactions', 'supplier_id', 'INT NOT NULL');
  await addColumnIfMissing('supplier_interactions', 'type', "VARCHAR(30) NOT NULL DEFAULT 'note'");
  await addColumnIfMissing('supplier_interactions', 'subject', 'VARCHAR(255) NOT NULL');
  await addColumnIfMissing('supplier_interactions', 'description', 'TEXT NULL');
  await addColumnIfMissing('supplier_interactions', 'interaction_date', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('supplier_interactions', 'follow_up_date', 'DATE NULL');
  await addColumnIfMissing('supplier_interactions', 'created_by', 'INT NULL');
  await addColumnIfMissing('supplier_interactions', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('supplier_interactions', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addIndexIfMissing(
    'supplier_interactions',
    'idx_supplier_interactions_supplier',
    'CREATE INDEX idx_supplier_interactions_supplier ON supplier_interactions (supplier_id, interaction_date)'
  );
  await addIndexIfMissing(
    'supplier_interactions',
    'idx_supplier_interactions_company',
    'CREATE INDEX idx_supplier_interactions_company ON supplier_interactions (company_id)'
  );
}

function toAmount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function nullableString(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeSupplierPayload(body = {}) {
  const status = SUPPLIER_STATUSES.has(String(body.status || '').toLowerCase())
    ? String(body.status).toLowerCase()
    : 'active';

  return {
    name: String(body.name || '').trim(),
    contact_person: nullableString(body.contact_person),
    email: nullableString(body.email),
    phone: nullableString(body.phone),
    gstin: nullableString(body.gstin),
    address: nullableString(body.address),
    city: nullableString(body.city),
    state: nullableString(body.state),
    category: nullableString(body.category),
    payment_terms: nullableString(body.payment_terms),
    opening_balance: toAmount(body.opening_balance),
    status,
    notes: nullableString(body.notes),
  };
}

function validateSupplierPayload(data, companyId) {
  if (!companyId) return 'Company is required';
  if (!data.name) return 'Supplier name is required';
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Supplier email is invalid';
  if (!Number.isFinite(data.opening_balance)) return 'Opening balance is invalid';
  return null;
}

function buildSupplierListWhere(req) {
  const where = [];
  const params = [];

  if (isSuperAdmin(req.employee) && req.query.company_id) {
    where.push('s.company_id = ?');
    params.push(req.query.company_id);
  } else if (!isSuperAdmin(req.employee)) {
    where.push('s.company_id = ?');
    params.push(req.employee.company_id);
  }

  if (req.query.status && req.query.status !== 'all') {
    where.push('s.status = ?');
    params.push(req.query.status);
  }

  if (req.query.category && req.query.category !== 'all') {
    where.push('s.category = ?');
    params.push(req.query.category);
  }

  if (req.query.search) {
    where.push(`(
      s.name LIKE ?
      OR s.contact_person LIKE ?
      OR s.email LIKE ?
      OR s.phone LIKE ?
      OR s.gstin LIKE ?
      OR s.category LIKE ?
    )`);
    const term = `%${req.query.search}%`;
    params.push(term, term, term, term, term, term);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

function scopedClause(req, alias = '') {
  const prefix = alias ? `${alias}.` : '';
  if (isSuperAdmin(req.employee) && req.query.company_id) {
    return { sql: ` AND ${prefix}company_id = ?`, params: [req.query.company_id] };
  }
  if (!isSuperAdmin(req.employee)) {
    return { sql: ` AND ${prefix}company_id = ?`, params: [req.employee.company_id] };
  }
  return { sql: '', params: [] };
}

function metricKey(companyId, supplierKey) {
  return `${companyId || 0}|${String(supplierKey || '').trim().toLowerCase()}`;
}

async function getSupplierMetrics(req) {
  const metrics = new Map();

  if (await tableExists('purchases')) {
    const scope = scopedClause(req);
    const rows = await query(
      `SELECT
         COALESCE(company_id, 0) AS company_id,
         LOWER(TRIM(supplier_name)) AS supplier_key,
         COUNT(*) AS purchase_count,
         COALESCE(SUM(total_amount), 0) AS total_purchase_value,
         MAX(purchase_date) AS last_purchase_date
       FROM purchases
       WHERE supplier_name IS NOT NULL
         AND TRIM(supplier_name) <> ''
         ${scope.sql}
       GROUP BY COALESCE(company_id, 0), LOWER(TRIM(supplier_name))`,
      scope.params
    );

    rows.forEach((row) => {
      metrics.set(metricKey(row.company_id, row.supplier_key), {
        purchase_count: Number(row.purchase_count || 0),
        total_purchase_value: Number(row.total_purchase_value || 0),
        last_purchase_date: row.last_purchase_date || null,
        inventory_items: 0,
        inventory_quantity: 0,
      });
    });
  }

  if (await tableExists('inventory')) {
    const scope = scopedClause(req);
    const rows = await query(
      `SELECT
         COALESCE(company_id, 0) AS company_id,
         LOWER(TRIM(supplier)) AS supplier_key,
         COUNT(*) AS inventory_items,
         COALESCE(SUM(quantity), 0) AS inventory_quantity
       FROM inventory
       WHERE supplier IS NOT NULL
         AND TRIM(supplier) <> ''
         ${scope.sql}
       GROUP BY COALESCE(company_id, 0), LOWER(TRIM(supplier))`,
      scope.params
    );

    rows.forEach((row) => {
      const key = metricKey(row.company_id, row.supplier_key);
      const current = metrics.get(key) || {
        purchase_count: 0,
        total_purchase_value: 0,
        last_purchase_date: null,
        inventory_items: 0,
        inventory_quantity: 0,
      };
      metrics.set(key, {
        ...current,
        inventory_items: Number(row.inventory_items || 0),
        inventory_quantity: Number(row.inventory_quantity || 0),
      });
    });
  }

  return metrics;
}

async function getScopedSupplier(req, supplierId) {
  const params = [supplierId];
  let where = 'WHERE s.id = ?';
  if (!isSuperAdmin(req.employee)) {
    where += ' AND s.company_id = ?';
    params.push(req.employee.company_id);
  }

  const rows = await query(
    `SELECT s.*, c.company_name
     FROM suppliers s
     LEFT JOIN companies c ON c.id = s.company_id
     ${where}
     LIMIT 1`,
    params
  );
  return rows[0] || null;
}

async function run(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    await ensureSuppliersSchema();

    const { whereSql, params } = buildSupplierListWhere(req);
    const suppliers = await query(
      `SELECT s.*, c.company_name
       FROM suppliers s
       LEFT JOIN companies c ON c.id = s.company_id
       ${whereSql}
       ORDER BY
         CASE s.status WHEN 'active' THEN 1 WHEN 'inactive' THEN 2 ELSE 3 END,
         s.name ASC`,
      params
    );

    const metrics = await getSupplierMetrics(req);
    const data = suppliers.map((supplier) => {
      const supplierMetrics = metrics.get(metricKey(supplier.company_id, supplier.name)) || {
        purchase_count: 0,
        total_purchase_value: 0,
        last_purchase_date: null,
        inventory_items: 0,
        inventory_quantity: 0,
      };
      return { ...supplier, ...supplierMetrics };
    });

    const statistics = {
      total_suppliers: data.length,
      active_suppliers: data.filter((supplier) => supplier.status === 'active').length,
      inactive_suppliers: data.filter((supplier) => supplier.status === 'inactive').length,
      blacklisted_suppliers: data.filter((supplier) => supplier.status === 'blacklisted').length,
      total_purchase_value: data.reduce((sum, supplier) => sum + Number(supplier.total_purchase_value || 0), 0),
    };

    return res.json({ success: true, data, statistics });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sync', async (req, res) => {
  let conn;
  try {
    await ensureSuppliersSchema();

    const sources = new Map();
    const scopedCompanyId = getScopedCompanyId(req, req.body);
    const scopeSql = scopedCompanyId ? ' AND company_id = ?' : '';
    const scopeParams = scopedCompanyId ? [scopedCompanyId] : [];

    if (await tableExists('purchases')) {
      const rows = await query(
        `SELECT
           COALESCE(company_id, ?) AS company_id,
           MIN(TRIM(supplier_name)) AS name,
           MAX(NULLIF(TRIM(supplier_email), '')) AS email,
           MAX(NULLIF(TRIM(supplier_phone), '')) AS phone
         FROM purchases
         WHERE supplier_name IS NOT NULL
           AND TRIM(supplier_name) <> ''
           ${scopeSql}
         GROUP BY COALESCE(company_id, ?), LOWER(TRIM(supplier_name))`,
        [scopedCompanyId || 0, ...scopeParams, scopedCompanyId || 0]
      );

      rows.forEach((row) => {
        const key = metricKey(row.company_id, row.name);
        sources.set(key, {
          company_id: Number(row.company_id || scopedCompanyId),
          name: row.name,
          email: row.email || null,
          phone: row.phone || null,
        });
      });
    }

    if (await tableExists('inventory')) {
      const rows = await query(
        `SELECT
           COALESCE(company_id, ?) AS company_id,
           MIN(TRIM(supplier)) AS name
         FROM inventory
         WHERE supplier IS NOT NULL
           AND TRIM(supplier) <> ''
           ${scopeSql}
         GROUP BY COALESCE(company_id, ?), LOWER(TRIM(supplier))`,
        [scopedCompanyId || 0, ...scopeParams, scopedCompanyId || 0]
      );

      rows.forEach((row) => {
        const key = metricKey(row.company_id, row.name);
        if (!sources.has(key)) {
          sources.set(key, {
            company_id: Number(row.company_id || scopedCompanyId),
            name: row.name,
            email: null,
            phone: null,
          });
        }
      });
    }

    if (sources.size === 0) {
      return res.json({ success: true, message: 'No supplier data found to sync', inserted_count: 0 });
    }

    const existingScope = scopedCompanyId ? 'WHERE company_id = ?' : '';
    const existingParams = scopedCompanyId ? [scopedCompanyId] : [];
    const existingRows = await query(
      `SELECT COALESCE(company_id, 0) AS company_id, LOWER(TRIM(name)) AS supplier_key
       FROM suppliers
       ${existingScope}`,
      existingParams
    );
    const existing = new Set(existingRows.map((row) => metricKey(row.company_id, row.supplier_key)));

    conn = await getConnection();
    await conn.query('START TRANSACTION');

    let insertedCount = 0;
    for (const supplier of sources.values()) {
      const companyId = Number(supplier.company_id || scopedCompanyId);
      if (!companyId || existing.has(metricKey(companyId, supplier.name))) continue;

      await run(
        conn,
        `INSERT INTO suppliers
          (company_id, name, email, phone, status, created_by)
         VALUES (?, ?, ?, ?, 'active', ?)`,
        [companyId, supplier.name, supplier.email, supplier.phone, req.employee.id || null]
      );
      existing.add(metricKey(companyId, supplier.name));
      insertedCount += 1;
    }

    await conn.query('COMMIT');
    return res.json({
      success: true,
      message: `${insertedCount} supplier(s) synced`,
      inserted_count: insertedCount,
    });
  } catch (err) {
    if (conn) await conn.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/', async (req, res) => {
  try {
    await ensureSuppliersSchema();

    const data = normalizeSupplierPayload(req.body);
    const companyId = getScopedCompanyId(req, req.body);
    const validationMessage = validateSupplierPayload(data, companyId);
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }

    const result = await query(
      `INSERT INTO suppliers
        (company_id, name, contact_person, email, phone, gstin, address, city, state,
         category, payment_terms, opening_balance, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        data.name,
        data.contact_person,
        data.email,
        data.phone,
        data.gstin,
        data.address,
        data.city,
        data.state,
        data.category,
        data.payment_terms,
        data.opening_balance,
        data.status,
        data.notes,
        req.employee.id || null,
      ]
    );

    return res.json({
      success: true,
      message: 'Supplier saved successfully',
      data: { id: result.insertId },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/dependencies', async (req, res) => {
  try {
    await ensureSuppliersSchema();

    const supplierId = Number(req.params.id);
    if (!supplierId) return res.status(400).json({ success: false, message: 'Invalid supplier ID' });

    const supplier = await getScopedSupplier(req, supplierId);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

    const companyId = supplier.company_id;
    const supplierName = supplier.name;
    const purchases = [];
    const inventory = [];

    if (await tableExists('purchases')) {
      const rows = await query(
        `SELECT id, purchase_no, item_name, item_code, quantity, total_amount, purchase_date,
                invoice_no, payment_status, status
         FROM purchases
         WHERE company_id = ?
           AND LOWER(TRIM(supplier_name)) = LOWER(TRIM(?))
         ORDER BY purchase_date DESC, id DESC
         LIMIT 25`,
        [companyId, supplierName]
      );
      purchases.push(...rows);
    }

    if (await tableExists('inventory')) {
      const rows = await query(
        `SELECT id, name, item_code, category, location, quantity, unit_price, status
         FROM inventory
         WHERE company_id = ?
           AND LOWER(TRIM(supplier)) = LOWER(TRIM(?))
         ORDER BY updated_at DESC, id DESC
         LIMIT 25`,
        [companyId, supplierName]
      );
      inventory.push(...rows);
    }

    const interactions = await query(
      `SELECT si.*, e.name AS created_by_name
       FROM supplier_interactions si
       LEFT JOIN employees e ON e.id = si.created_by
       WHERE si.supplier_id = ?
         AND si.company_id = ?
       ORDER BY si.interaction_date DESC, si.id DESC`,
      [supplierId, companyId]
    );

    return res.json({
      success: true,
      data: {
        supplier,
        purchases,
        inventory,
        interactions,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await ensureSuppliersSchema();

    const supplierId = Number(req.params.id);
    if (!supplierId) return res.status(400).json({ success: false, message: 'Invalid supplier ID' });

    const existing = await getScopedSupplier(req, supplierId);
    if (!existing) return res.status(404).json({ success: false, message: 'Supplier not found' });

    const data = normalizeSupplierPayload(req.body);
    const companyId = getScopedCompanyId(req, req.body) || existing.company_id;
    const validationMessage = validateSupplierPayload(data, companyId);
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }

    await query(
      `UPDATE suppliers
       SET company_id = ?, name = ?, contact_person = ?, email = ?, phone = ?, gstin = ?,
           address = ?, city = ?, state = ?, category = ?, payment_terms = ?,
           opening_balance = ?, status = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        companyId,
        data.name,
        data.contact_person,
        data.email,
        data.phone,
        data.gstin,
        data.address,
        data.city,
        data.state,
        data.category,
        data.payment_terms,
        data.opening_balance,
        data.status,
        data.notes,
        supplierId,
      ]
    );

    return res.json({ success: true, message: 'Supplier updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/interactions', async (req, res) => {
  try {
    await ensureSuppliersSchema();

    const supplierId = Number(req.params.id);
    if (!supplierId) return res.status(400).json({ success: false, message: 'Invalid supplier ID' });

    const supplier = await getScopedSupplier(req, supplierId);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

    const type = INTERACTION_TYPES.has(String(req.body?.type || '').toLowerCase())
      ? String(req.body.type).toLowerCase()
      : 'note';
    const subject = String(req.body?.subject || '').trim();
    const description = nullableString(req.body?.description);
    const interactionDate = req.body?.interaction_date || new Date().toISOString().slice(0, 10);
    const followUpDate = req.body?.follow_up_date || null;

    if (!subject) return res.status(400).json({ success: false, message: 'Subject is required' });

    const result = await query(
      `INSERT INTO supplier_interactions
        (company_id, supplier_id, type, subject, description, interaction_date, follow_up_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplier.company_id,
        supplierId,
        type,
        subject,
        description,
        interactionDate,
        followUpDate,
        req.employee.id || null,
      ]
    );

    return res.json({
      success: true,
      message: 'Supplier log saved',
      data: { id: result.insertId },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/interactions/:interactionId', async (req, res) => {
  try {
    await ensureSuppliersSchema();

    const interactionId = Number(req.params.interactionId);
    if (!interactionId) return res.status(400).json({ success: false, message: 'Invalid log ID' });

    const params = [interactionId];
    let scope = '';
    if (!isSuperAdmin(req.employee)) {
      scope = ' AND si.company_id = ?';
      params.push(req.employee.company_id);
    }

    await query(
      `DELETE si
       FROM supplier_interactions si
       WHERE si.id = ?
       ${scope}`,
      params
    );

    return res.json({ success: true, message: 'Supplier log deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  let conn;
  try {
    await ensureSuppliersSchema();

    const supplierId = Number(req.params.id);
    if (!supplierId) return res.status(400).json({ success: false, message: 'Invalid supplier ID' });

    const supplier = await getScopedSupplier(req, supplierId);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

    conn = await getConnection();
    await conn.query('START TRANSACTION');
    await run(conn, 'DELETE FROM supplier_interactions WHERE supplier_id = ?', [supplierId]);
    await run(conn, 'DELETE FROM suppliers WHERE id = ?', [supplierId]);
    await conn.query('COMMIT');

    return res.json({ success: true, message: 'Supplier deleted' });
  } catch (err) {
    if (conn) await conn.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
