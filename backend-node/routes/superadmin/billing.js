const express = require('express');
const crypto = require('crypto');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

function makeInvoiceNumber() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `INV-${y}${m}${d}-${rand}`;
}

const BILLING_INVOICE_TABLE = 'billing_invoices';
const LEGACY_INVOICE_TABLE = 'invoices';

async function getTableColumns(table) {
  try {
    const cols = await query(`SHOW COLUMNS FROM \`${table}\``);
    return new Set((cols || []).map((c) => c.Field));
  } catch (err) {
    return null;
  }
}

async function safeAddColumn(table, col, definition, cols) {
  try {
    await query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
    if (cols) cols.add(col);
    return true;
  } catch (err) {
    const msg = String(err?.message || '');
    if (err?.code === 'ER_DUP_FIELDNAME' || msg.toLowerCase().includes('duplicate column')) {
      if (cols) cols.add(col);
      return true;
    }
    return false;
  }
}

async function ensureLegacyInvoiceAmount(legacyCols) {
  if (!legacyCols) return legacyCols;
  if (!legacyCols.has('amount')) {
    const added = await safeAddColumn(
      LEGACY_INVOICE_TABLE,
      'amount',
      'amount DECIMAL(15,2) NULL',
      legacyCols
    );
    if (added && legacyCols.has('total_amount')) {
      try {
        await query('UPDATE invoices SET amount = total_amount WHERE amount IS NULL');
      } catch (err) {
        // Ignore backfill errors (non-blocking).
      }
    }
  }
  return legacyCols;
}

async function ensureBillingInvoiceTable() {
  const billingCols = await getTableColumns(BILLING_INVOICE_TABLE);
  if (billingCols) {
    return { table: BILLING_INVOICE_TABLE, cols: billingCols };
  }

  let legacyCols = await getTableColumns(LEGACY_INVOICE_TABLE);
  legacyCols = await ensureLegacyInvoiceAmount(legacyCols);
  const legacyHasBillingCols = legacyCols && legacyCols.has('subscription_id') && legacyCols.has('amount');
  if (legacyHasBillingCols) {
    return { table: LEGACY_INVOICE_TABLE, cols: legacyCols };
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS \`${BILLING_INVOICE_TABLE}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subscription_id INT NULL,
        invoice_number VARCHAR(64) UNIQUE,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'INR',
        status ENUM('draft','open','paid','void','refunded') DEFAULT 'open',
        due_date DATE NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_billing_subscription (subscription_id),
        INDEX idx_billing_status (status),
        INDEX idx_billing_issued (issued_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    return { table: LEGACY_INVOICE_TABLE, cols: legacyCols, createError: err };
  }

  const createdCols = await getTableColumns(BILLING_INVOICE_TABLE);
  return { table: BILLING_INVOICE_TABLE, cols: createdCols || new Set() };
}

// ===== Pricing Plans (subscription_plans) =====
router.get('/plans', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM subscription_plans ORDER BY price ASC');
    rows.forEach((r) => {
      try {
        r.modules_included = typeof r.modules_included === 'string' ? JSON.parse(r.modules_included) : r.modules_included;
      } catch (e) { }
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/plans', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { id, name, price, billing_cycle, user_limit, storage_limit_gb, modules_included, status } = req.body || {};
    if (!name) return res.status(400).json({ success: false, message: 'name required' });
    const modulesJson = modules_included === undefined ? null : JSON.stringify(modules_included || []);
    if (id) {
      await query(
        'UPDATE subscription_plans SET name=?, price=?, billing_cycle=?, user_limit=?, storage_limit_gb=?, modules_included=?, status=? WHERE id=?',
        [name, Number(price || 0), billing_cycle || 'monthly', Number(user_limit || 0), Number(storage_limit_gb || 0), modulesJson, status || 'active', id]
      );
      return res.json({ success: true, message: 'Plan updated' });
    }
    const result = await query(
      'INSERT INTO subscription_plans (name, price, billing_cycle, user_limit, storage_limit_gb, modules_included, status) VALUES (?,?,?,?,?,?,?)',
      [name, Number(price || 0), billing_cycle || 'monthly', Number(user_limit || 10), Number(storage_limit_gb || 5), modulesJson, status || 'active']
    );
    res.json({ success: true, message: 'Plan created', plan_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== Invoices =====
router.get('/invoices', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const { table, cols, createError } = await ensureBillingInvoiceTable();
    const has = (name) => cols && cols.has(name);
    const isBillingLike = table === BILLING_INVOICE_TABLE || (has('amount') && has('subscription_id'));

    if (isBillingLike) {
      const issuedExpr = has('issued_at')
        ? 'i.issued_at'
        : has('issue_date')
          ? 'i.issue_date'
          : 'i.created_at';
      const rows = await query(`
        SELECT i.*, s.company_id, c.company_name, s.plan_id, sp.name as plan_name
        FROM \`${table}\` i
        LEFT JOIN subscriptions s ON s.id = i.subscription_id
        LEFT JOIN companies c ON c.id = s.company_id
        LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
        ORDER BY ${issuedExpr} DESC
        LIMIT 500
      `);
      return res.json({ success: true, data: rows });
    }

    if (table === LEGACY_INVOICE_TABLE && has('total_amount')) {
      const issuedExpr = has('issued_at')
        ? 'i.issued_at'
        : has('issue_date')
          ? 'i.issue_date'
          : 'i.created_at';
      const companyJoin = has('company_id')
        ? 'LEFT JOIN companies c ON c.id = i.company_id'
        : '';
      const rows = await query(`
        SELECT 
          i.id,
          i.invoice_number,
          ${has('total_amount') ? 'i.total_amount' : '0'} as amount,
          ${has('currency') ? 'i.currency' : "'INR'"} as currency,
          ${has('status') ? 'i.status' : "'open'"} as status,
          ${has('due_date') ? 'i.due_date' : 'NULL'} as due_date,
          ${issuedExpr} as issued_at,
          ${has('company_id') ? 'i.company_id' : 'NULL'} as company_id,
          ${has('company_id') ? 'c.company_name' : 'NULL'} as company_name,
          NULL as subscription_id,
          NULL as plan_id,
          NULL as plan_name
        FROM \`${table}\` i
        ${companyJoin}
        ORDER BY ${issuedExpr} DESC
        LIMIT 500
      `);
      return res.json({ success: true, data: rows, message: 'Legacy invoices schema detected' });
    }

    const msg = createError
      ? 'Billing invoices unavailable (schema mismatch). Ensure billing tables can be created.'
      : 'Invoices unavailable';
    return res.json({ success: true, data: [], message: msg });
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('Unknown column') || msg.includes('ER_BAD_FIELD_ERROR')) {
      return res.json({ success: true, data: [], message: 'Invoices unavailable (schema mismatch)' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/invoices', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { table, cols, createError } = await ensureBillingInvoiceTable();
    const has = (name) => cols && cols.has(name);
    if (!has('amount') || !has('subscription_id')) {
      return res.status(400).json({
        success: false,
        message: createError
          ? 'Billing invoices schema not available. Database user cannot create billing tables.'
          : 'Billing invoices schema not available. Please run the billing migrations to add required columns.',
      });
    }
    const { subscription_id, amount, currency = 'INR', status = 'open', due_date = null } = req.body || {};
    if (!subscription_id) return res.status(400).json({ success: false, message: 'subscription_id required' });
    const invoiceNumber = makeInvoiceNumber();
    const result = await query(
      `INSERT INTO \`${table}\` (subscription_id, invoice_number, amount, currency, status, due_date) VALUES (?,?,?,?,?,?)`,
      [subscription_id, invoiceNumber, Number(amount || 0), currency, status, due_date]
    );
    res.json({ success: true, message: 'Invoice created', invoice_id: result.insertId, invoice_number: invoiceNumber });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Invoice number conflict, retry' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/invoices/:id/status', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = new Set(['draft', 'open', 'paid', 'void', 'refunded']);
    if (!allowed.has(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const { table } = await ensureBillingInvoiceTable();
    await query(`UPDATE \`${table}\` SET status=? WHERE id=?`, [status, req.params.id]);
    res.json({ success: true, message: 'Invoice updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== Transactions =====
router.get('/transactions', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const { table } = await ensureBillingInvoiceTable();
    const rows = await query(`
      SELECT t.*, i.invoice_number, i.subscription_id, s.company_id, c.company_name
      FROM transactions t
      LEFT JOIN \`${table}\` i ON i.id = t.invoice_id
      LEFT JOIN subscriptions s ON s.id = i.subscription_id
      LEFT JOIN companies c ON c.id = s.company_id
      ORDER BY t.created_at DESC
      LIMIT 500
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/transactions', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { invoice_id = null, gateway = 'manual', amount, currency = 'INR', status = 'succeeded', reference = null } = req.body || {};
    const allowed = new Set(['pending', 'succeeded', 'failed', 'refunded']);
    if (!allowed.has(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const result = await query(
      'INSERT INTO transactions (invoice_id, gateway, amount, currency, status, reference) VALUES (?,?,?,?,?,?)',
      [invoice_id, gateway, Number(amount || 0), currency, status, reference]
    );
    // If succeeded and invoice exists -> mark invoice paid
    if (invoice_id && status === 'succeeded') {
      const { table } = await ensureBillingInvoiceTable();
      await query(`UPDATE \`${table}\` SET status='paid' WHERE id=?`, [invoice_id]);
    }
    res.json({ success: true, message: 'Transaction recorded', transaction_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/transactions/:id/status', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = new Set(['pending', 'succeeded', 'failed', 'refunded']);
    if (!allowed.has(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    await query('UPDATE transactions SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true, message: 'Transaction updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

