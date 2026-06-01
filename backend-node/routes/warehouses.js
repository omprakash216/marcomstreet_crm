const express = require('express');
const { getConnection, query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const WAREHOUSE_STATUSES = new Set(['active', 'inactive']);
const MOVEMENT_TYPES = new Set(['in', 'out', 'transfer', 'adjustment']);

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

async function ensureWarehousesSchema() {
  await safeSchemaQuery(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(80) NULL,
      manager_name VARCHAR(255) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      address TEXT NULL,
      city VARCHAR(120) NULL,
      state VARCHAR(120) NULL,
      capacity_units DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_warehouses_company_name (company_id, name),
      KEY idx_warehouses_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing('warehouses', 'company_id', 'INT NULL');
  await addColumnIfMissing('warehouses', 'name', 'VARCHAR(255) NOT NULL');
  await addColumnIfMissing('warehouses', 'code', 'VARCHAR(80) NULL');
  await addColumnIfMissing('warehouses', 'manager_name', 'VARCHAR(255) NULL');
  await addColumnIfMissing('warehouses', 'phone', 'VARCHAR(50) NULL');
  await addColumnIfMissing('warehouses', 'email', 'VARCHAR(255) NULL');
  await addColumnIfMissing('warehouses', 'address', 'TEXT NULL');
  await addColumnIfMissing('warehouses', 'city', 'VARCHAR(120) NULL');
  await addColumnIfMissing('warehouses', 'state', 'VARCHAR(120) NULL');
  await addColumnIfMissing('warehouses', 'capacity_units', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing('warehouses', 'status', "VARCHAR(30) NOT NULL DEFAULT 'active'");
  await addColumnIfMissing('warehouses', 'notes', 'TEXT NULL');
  await addColumnIfMissing('warehouses', 'created_by', 'INT NULL');
  await addColumnIfMissing('warehouses', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('warehouses', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addIndexIfMissing('warehouses', 'idx_warehouses_company_name', 'CREATE INDEX idx_warehouses_company_name ON warehouses (company_id, name)');
  await addIndexIfMissing('warehouses', 'idx_warehouses_status', 'CREATE INDEX idx_warehouses_status ON warehouses (status)');

  await safeSchemaQuery(`
    CREATE TABLE IF NOT EXISTS warehouse_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      warehouse_id INT NOT NULL,
      type VARCHAR(30) NOT NULL DEFAULT 'in',
      item_name VARCHAR(255) NOT NULL,
      item_code VARCHAR(100) NULL,
      quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
      from_warehouse VARCHAR(255) NULL,
      to_warehouse VARCHAR(255) NULL,
      reference_no VARCHAR(120) NULL,
      movement_date DATE NOT NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_warehouse_movements_warehouse_date (warehouse_id, movement_date),
      KEY idx_warehouse_movements_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing('warehouse_movements', 'company_id', 'INT NULL');
  await addColumnIfMissing('warehouse_movements', 'warehouse_id', 'INT NOT NULL');
  await addColumnIfMissing('warehouse_movements', 'type', "VARCHAR(30) NOT NULL DEFAULT 'in'");
  await addColumnIfMissing('warehouse_movements', 'item_name', 'VARCHAR(255) NOT NULL');
  await addColumnIfMissing('warehouse_movements', 'item_code', 'VARCHAR(100) NULL');
  await addColumnIfMissing('warehouse_movements', 'quantity', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing('warehouse_movements', 'from_warehouse', 'VARCHAR(255) NULL');
  await addColumnIfMissing('warehouse_movements', 'to_warehouse', 'VARCHAR(255) NULL');
  await addColumnIfMissing('warehouse_movements', 'reference_no', 'VARCHAR(120) NULL');
  await addColumnIfMissing('warehouse_movements', 'movement_date', 'DATE NULL');
  await addColumnIfMissing('warehouse_movements', 'notes', 'TEXT NULL');
  await addColumnIfMissing('warehouse_movements', 'created_by', 'INT NULL');
  await addColumnIfMissing('warehouse_movements', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('warehouse_movements', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addIndexIfMissing(
    'warehouse_movements',
    'idx_warehouse_movements_warehouse_date',
    'CREATE INDEX idx_warehouse_movements_warehouse_date ON warehouse_movements (warehouse_id, movement_date)'
  );
  await addIndexIfMissing(
    'warehouse_movements',
    'idx_warehouse_movements_company',
    'CREATE INDEX idx_warehouse_movements_company ON warehouse_movements (company_id)'
  );
}

function nullableString(value) {
  const text = String(value || '').trim();
  return text || null;
}

function toAmount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function normalizeWarehousePayload(body = {}) {
  const status = WAREHOUSE_STATUSES.has(String(body.status || '').toLowerCase())
    ? String(body.status).toLowerCase()
    : 'active';

  return {
    name: String(body.name || '').trim(),
    code: nullableString(body.code)?.toUpperCase() || null,
    manager_name: nullableString(body.manager_name),
    phone: nullableString(body.phone),
    email: nullableString(body.email),
    address: nullableString(body.address),
    city: nullableString(body.city),
    state: nullableString(body.state),
    capacity_units: toAmount(body.capacity_units),
    status,
    notes: nullableString(body.notes),
  };
}

function validateWarehousePayload(data, companyId) {
  if (!companyId) return 'Company is required';
  if (!data.name) return 'Warehouse name is required';
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Warehouse email is invalid';
  if (!Number.isFinite(data.capacity_units) || data.capacity_units < 0) return 'Capacity is invalid';
  return null;
}

function normalizeMovementPayload(body = {}) {
  const type = MOVEMENT_TYPES.has(String(body.type || '').toLowerCase())
    ? String(body.type).toLowerCase()
    : 'in';

  return {
    type,
    item_name: String(body.item_name || '').trim(),
    item_code: nullableString(body.item_code)?.toUpperCase() || null,
    quantity: toAmount(body.quantity),
    from_warehouse: nullableString(body.from_warehouse),
    to_warehouse: nullableString(body.to_warehouse),
    reference_no: nullableString(body.reference_no),
    movement_date: body.movement_date || new Date().toISOString().slice(0, 10),
    notes: nullableString(body.notes),
  };
}

function validateMovementPayload(data) {
  if (!data.item_name) return 'Item name is required';
  if (!Number.isFinite(data.quantity) || data.quantity <= 0) return 'Quantity must be greater than 0';
  if (!data.movement_date || Number.isNaN(Date.parse(data.movement_date))) return 'Movement date is required';
  return null;
}

function buildWarehouseListWhere(req) {
  const where = [];
  const params = [];

  if (isSuperAdmin(req.employee) && req.query.company_id) {
    where.push('w.company_id = ?');
    params.push(req.query.company_id);
  } else if (!isSuperAdmin(req.employee)) {
    where.push('w.company_id = ?');
    params.push(req.employee.company_id);
  }

  if (req.query.status && req.query.status !== 'all') {
    where.push('w.status = ?');
    params.push(req.query.status);
  }

  if (req.query.search) {
    where.push(`(
      w.name LIKE ?
      OR w.code LIKE ?
      OR w.manager_name LIKE ?
      OR w.phone LIKE ?
      OR w.email LIKE ?
      OR w.city LIKE ?
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

function warehouseKey(companyId, name) {
  return `${companyId || 0}|${String(name || '').trim().toLowerCase()}`;
}

async function getWarehouseMetrics(req) {
  const metrics = new Map();

  if (await tableExists('inventory')) {
    const scope = scopedClause(req);
    const rows = await query(
      `SELECT
         COALESCE(company_id, 0) AS company_id,
         LOWER(TRIM(location)) AS warehouse_key,
         COUNT(*) AS inventory_items,
         COALESCE(SUM(quantity), 0) AS stock_quantity,
         COALESCE(SUM(quantity * unit_price), 0) AS stock_value,
         COALESCE(SUM(CASE WHEN minimum_stock_level > 0 AND quantity <= minimum_stock_level THEN 1 ELSE 0 END), 0) AS low_stock_count
       FROM inventory
       WHERE location IS NOT NULL
         AND TRIM(location) <> ''
         ${scope.sql}
       GROUP BY COALESCE(company_id, 0), LOWER(TRIM(location))`,
      scope.params
    );

    rows.forEach((row) => {
      metrics.set(warehouseKey(row.company_id, row.warehouse_key), {
        inventory_items: Number(row.inventory_items || 0),
        stock_quantity: Number(row.stock_quantity || 0),
        stock_value: Number(row.stock_value || 0),
        low_stock_count: Number(row.low_stock_count || 0),
        purchase_count: 0,
        purchase_value: 0,
        last_purchase_date: null,
      });
    });
  }

  if (await tableExists('purchases')) {
    const scope = scopedClause(req);
    const rows = await query(
      `SELECT
         COALESCE(company_id, 0) AS company_id,
         LOWER(TRIM(warehouse)) AS warehouse_key,
         COUNT(*) AS purchase_count,
         COALESCE(SUM(total_amount), 0) AS purchase_value,
         MAX(purchase_date) AS last_purchase_date
       FROM purchases
       WHERE warehouse IS NOT NULL
         AND TRIM(warehouse) <> ''
         ${scope.sql}
       GROUP BY COALESCE(company_id, 0), LOWER(TRIM(warehouse))`,
      scope.params
    );

    rows.forEach((row) => {
      const key = warehouseKey(row.company_id, row.warehouse_key);
      const current = metrics.get(key) || {
        inventory_items: 0,
        stock_quantity: 0,
        stock_value: 0,
        low_stock_count: 0,
        purchase_count: 0,
        purchase_value: 0,
        last_purchase_date: null,
      };
      metrics.set(key, {
        ...current,
        purchase_count: Number(row.purchase_count || 0),
        purchase_value: Number(row.purchase_value || 0),
        last_purchase_date: row.last_purchase_date || null,
      });
    });
  }

  return metrics;
}

async function getScopedWarehouse(req, warehouseId) {
  const params = [warehouseId];
  let where = 'WHERE w.id = ?';
  if (!isSuperAdmin(req.employee)) {
    where += ' AND w.company_id = ?';
    params.push(req.employee.company_id);
  }

  const rows = await query(
    `SELECT w.*, c.company_name
     FROM warehouses w
     LEFT JOIN companies c ON c.id = w.company_id
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
    await ensureWarehousesSchema();

    const { whereSql, params } = buildWarehouseListWhere(req);
    const warehouses = await query(
      `SELECT w.*, c.company_name
       FROM warehouses w
       LEFT JOIN companies c ON c.id = w.company_id
       ${whereSql}
       ORDER BY
         CASE w.status WHEN 'active' THEN 1 ELSE 2 END,
         w.name ASC`,
      params
    );

    const metrics = await getWarehouseMetrics(req);
    const data = warehouses.map((warehouse) => {
      const byName = metrics.get(warehouseKey(warehouse.company_id, warehouse.name));
      const byCode = warehouse.code ? metrics.get(warehouseKey(warehouse.company_id, warehouse.code)) : null;
      return {
        ...warehouse,
        ...(byName || byCode || {
          inventory_items: 0,
          stock_quantity: 0,
          stock_value: 0,
          low_stock_count: 0,
          purchase_count: 0,
          purchase_value: 0,
          last_purchase_date: null,
        }),
      };
    });

    const statistics = {
      total_warehouses: data.length,
      active_warehouses: data.filter((warehouse) => warehouse.status === 'active').length,
      inactive_warehouses: data.filter((warehouse) => warehouse.status === 'inactive').length,
      inventory_items: data.reduce((sum, warehouse) => sum + Number(warehouse.inventory_items || 0), 0),
      stock_quantity: data.reduce((sum, warehouse) => sum + Number(warehouse.stock_quantity || 0), 0),
      stock_value: data.reduce((sum, warehouse) => sum + Number(warehouse.stock_value || 0), 0),
      low_stock_count: data.reduce((sum, warehouse) => sum + Number(warehouse.low_stock_count || 0), 0),
    };

    return res.json({ success: true, data, statistics });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sync', async (req, res) => {
  let conn;
  try {
    await ensureWarehousesSchema();

    const sources = new Map();
    const scopedCompanyId = getScopedCompanyId(req, req.body);
    const scopeSql = scopedCompanyId ? ' AND company_id = ?' : '';
    const scopeParams = scopedCompanyId ? [scopedCompanyId] : [];

    if (await tableExists('inventory')) {
      const rows = await query(
        `SELECT
           COALESCE(company_id, ?) AS company_id,
           MIN(TRIM(location)) AS name
         FROM inventory
         WHERE location IS NOT NULL
           AND TRIM(location) <> ''
           ${scopeSql}
         GROUP BY COALESCE(company_id, ?), LOWER(TRIM(location))`,
        [scopedCompanyId || 0, ...scopeParams, scopedCompanyId || 0]
      );

      rows.forEach((row) => {
        sources.set(warehouseKey(row.company_id, row.name), {
          company_id: Number(row.company_id || scopedCompanyId),
          name: row.name,
        });
      });
    }

    if (await tableExists('purchases')) {
      const rows = await query(
        `SELECT
           COALESCE(company_id, ?) AS company_id,
           MIN(TRIM(warehouse)) AS name
         FROM purchases
         WHERE warehouse IS NOT NULL
           AND TRIM(warehouse) <> ''
           ${scopeSql}
         GROUP BY COALESCE(company_id, ?), LOWER(TRIM(warehouse))`,
        [scopedCompanyId || 0, ...scopeParams, scopedCompanyId || 0]
      );

      rows.forEach((row) => {
        const key = warehouseKey(row.company_id, row.name);
        if (!sources.has(key)) {
          sources.set(key, {
            company_id: Number(row.company_id || scopedCompanyId),
            name: row.name,
          });
        }
      });
    }

    if (sources.size === 0) {
      return res.json({ success: true, message: 'No warehouse data found to sync', inserted_count: 0 });
    }

    const existingScope = scopedCompanyId ? 'WHERE company_id = ?' : '';
    const existingParams = scopedCompanyId ? [scopedCompanyId] : [];
    const existingRows = await query(
      `SELECT COALESCE(company_id, 0) AS company_id, LOWER(TRIM(name)) AS warehouse_key
       FROM warehouses
       ${existingScope}`,
      existingParams
    );
    const existing = new Set(existingRows.map((row) => warehouseKey(row.company_id, row.warehouse_key)));

    conn = await getConnection();
    await conn.query('START TRANSACTION');

    let insertedCount = 0;
    for (const warehouse of sources.values()) {
      const companyId = Number(warehouse.company_id || scopedCompanyId);
      if (!companyId || existing.has(warehouseKey(companyId, warehouse.name))) continue;

      await run(
        conn,
        `INSERT INTO warehouses
          (company_id, name, status, created_by)
         VALUES (?, ?, 'active', ?)`,
        [companyId, warehouse.name, req.employee.id || null]
      );
      existing.add(warehouseKey(companyId, warehouse.name));
      insertedCount += 1;
    }

    await conn.query('COMMIT');
    return res.json({
      success: true,
      message: `${insertedCount} warehouse(s) synced`,
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
    await ensureWarehousesSchema();

    const data = normalizeWarehousePayload(req.body);
    const companyId = getScopedCompanyId(req, req.body);
    const validationMessage = validateWarehousePayload(data, companyId);
    if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });

    const result = await query(
      `INSERT INTO warehouses
        (company_id, name, code, manager_name, phone, email, address, city, state,
         capacity_units, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        data.name,
        data.code,
        data.manager_name,
        data.phone,
        data.email,
        data.address,
        data.city,
        data.state,
        data.capacity_units,
        data.status,
        data.notes,
        req.employee.id || null,
      ]
    );

    return res.json({ success: true, message: 'Warehouse saved successfully', data: { id: result.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/dependencies', async (req, res) => {
  try {
    await ensureWarehousesSchema();

    const warehouseId = Number(req.params.id);
    if (!warehouseId) return res.status(400).json({ success: false, message: 'Invalid warehouse ID' });

    const warehouse = await getScopedWarehouse(req, warehouseId);
    if (!warehouse) return res.status(404).json({ success: false, message: 'Warehouse not found' });

    const names = [warehouse.name, warehouse.code].filter(Boolean);
    const inventory = [];
    const purchases = [];

    if (await tableExists('inventory') && names.length) {
      const clauses = names.map(() => 'LOWER(TRIM(location)) = LOWER(TRIM(?))').join(' OR ');
      const rows = await query(
        `SELECT id, name, item_code, category, supplier, location, quantity, minimum_stock_level, unit_price, status, updated_at
         FROM inventory
         WHERE company_id = ?
           AND (${clauses})
         ORDER BY updated_at DESC, id DESC
         LIMIT 100`,
        [warehouse.company_id, ...names]
      );
      inventory.push(...rows);
    }

    if (await tableExists('purchases') && names.length) {
      const clauses = names.map(() => 'LOWER(TRIM(warehouse)) = LOWER(TRIM(?))').join(' OR ');
      const rows = await query(
        `SELECT id, purchase_no, supplier_name, item_name, item_code, quantity, total_amount,
                purchase_date, invoice_no, payment_status, status
         FROM purchases
         WHERE company_id = ?
           AND (${clauses})
         ORDER BY purchase_date DESC, id DESC
         LIMIT 50`,
        [warehouse.company_id, ...names]
      );
      purchases.push(...rows);
    }

    const movements = await query(
      `SELECT wm.*, e.name AS created_by_name
       FROM warehouse_movements wm
       LEFT JOIN employees e ON e.id = wm.created_by
       WHERE wm.warehouse_id = ?
         AND wm.company_id = ?
       ORDER BY wm.movement_date DESC, wm.id DESC`,
      [warehouseId, warehouse.company_id]
    );

    return res.json({
      success: true,
      data: {
        warehouse,
        inventory,
        purchases,
        movements,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await ensureWarehousesSchema();

    const warehouseId = Number(req.params.id);
    if (!warehouseId) return res.status(400).json({ success: false, message: 'Invalid warehouse ID' });

    const existing = await getScopedWarehouse(req, warehouseId);
    if (!existing) return res.status(404).json({ success: false, message: 'Warehouse not found' });

    const data = normalizeWarehousePayload(req.body);
    const companyId = getScopedCompanyId(req, req.body) || existing.company_id;
    const validationMessage = validateWarehousePayload(data, companyId);
    if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });

    await query(
      `UPDATE warehouses
       SET company_id = ?, name = ?, code = ?, manager_name = ?, phone = ?, email = ?,
           address = ?, city = ?, state = ?, capacity_units = ?, status = ?,
           notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        companyId,
        data.name,
        data.code,
        data.manager_name,
        data.phone,
        data.email,
        data.address,
        data.city,
        data.state,
        data.capacity_units,
        data.status,
        data.notes,
        warehouseId,
      ]
    );

    return res.json({ success: true, message: 'Warehouse updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/movements', async (req, res) => {
  try {
    await ensureWarehousesSchema();

    const warehouseId = Number(req.params.id);
    if (!warehouseId) return res.status(400).json({ success: false, message: 'Invalid warehouse ID' });

    const warehouse = await getScopedWarehouse(req, warehouseId);
    if (!warehouse) return res.status(404).json({ success: false, message: 'Warehouse not found' });

    const data = normalizeMovementPayload(req.body);
    const validationMessage = validateMovementPayload(data);
    if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });

    const result = await query(
      `INSERT INTO warehouse_movements
        (company_id, warehouse_id, type, item_name, item_code, quantity, from_warehouse,
         to_warehouse, reference_no, movement_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        warehouse.company_id,
        warehouseId,
        data.type,
        data.item_name,
        data.item_code,
        data.quantity,
        data.from_warehouse,
        data.to_warehouse,
        data.reference_no,
        data.movement_date,
        data.notes,
        req.employee.id || null,
      ]
    );

    return res.json({ success: true, message: 'Warehouse movement saved', data: { id: result.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/movements/:movementId', async (req, res) => {
  try {
    await ensureWarehousesSchema();

    const movementId = Number(req.params.movementId);
    if (!movementId) return res.status(400).json({ success: false, message: 'Invalid movement ID' });

    const params = [movementId];
    let scope = '';
    if (!isSuperAdmin(req.employee)) {
      scope = ' AND wm.company_id = ?';
      params.push(req.employee.company_id);
    }

    await query(
      `DELETE wm
       FROM warehouse_movements wm
       WHERE wm.id = ?
       ${scope}`,
      params
    );

    return res.json({ success: true, message: 'Warehouse movement deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  let conn;
  try {
    await ensureWarehousesSchema();

    const warehouseId = Number(req.params.id);
    if (!warehouseId) return res.status(400).json({ success: false, message: 'Invalid warehouse ID' });

    const warehouse = await getScopedWarehouse(req, warehouseId);
    if (!warehouse) return res.status(404).json({ success: false, message: 'Warehouse not found' });

    conn = await getConnection();
    await conn.query('START TRANSACTION');
    await run(conn, 'DELETE FROM warehouse_movements WHERE warehouse_id = ?', [warehouseId]);
    await run(conn, 'DELETE FROM warehouses WHERE id = ?', [warehouseId]);
    await conn.query('COMMIT');

    return res.json({ success: true, message: 'Warehouse deleted' });
  } catch (err) {
    if (conn) await conn.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
