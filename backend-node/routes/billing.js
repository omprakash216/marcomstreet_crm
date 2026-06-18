const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../config/database');
const { buildCompanyAdminEmployeeCode, normalizeCompanyCode, deriveCompanyCodeFromName } = require('../utils/companyCode');

const router = express.Router();

async function ensureTables() {
  // Stores subscription checkout sessions and generated credentials
  await query(
    `CREATE TABLE IF NOT EXISTS subscription_sessions (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NULL,
      company VARCHAR(255) NULL,
      plan VARCHAR(32) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      payment_method VARCHAR(32) NULL,
      amount DECIMAL(10,2) NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      gateway_reference VARCHAR(128) NULL,
      temp_password VARCHAR(64) NULL,
      activation_status VARCHAR(16) NOT NULL DEFAULT 'pending',
      activated_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME NULL,
      UNIQUE KEY uniq_email_plan_pending (email, plan, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  // For existing installations, try to add new columns; ignore if they already exist
  try {
    await query(
      `ALTER TABLE subscription_sessions
         ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) NULL,
         ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) NULL,
         ADD COLUMN IF NOT EXISTS currency VARCHAR(8) NOT NULL DEFAULT 'INR',
         ADD COLUMN IF NOT EXISTS gateway_reference VARCHAR(128) NULL,
         ADD COLUMN IF NOT EXISTS activation_status VARCHAR(16) NOT NULL DEFAULT 'pending',
         ADD COLUMN IF NOT EXISTS activated_at DATETIME NULL`
    );
  } catch (err) {
    // Some MySQL versions don't support IF NOT EXISTS for ADD COLUMN; fall back silently on duplicate column errors
    if (err && err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_PARSE_ERROR') {
      // Log but don't crash request
      console.error('subscription_sessions alter error:', err.message);
    }
  }
}

function generatePassword(len = 10) {
  // readable password
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

const VALID_PAYMENT_METHODS = new Set([
  'upi_phonepe',
  'upi_gpay',
  'upi_paytm',
  'card',
  'debit_card',
  'netbanking',
]);

function normalizePaymentMethod(value) {
  const method = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!method) return '';
  if (VALID_PAYMENT_METHODS.has(method)) return method;
  if (method === 'upi') return 'upi_phonepe';
  if (method === 'credit_card') return 'card';
  return '';
}

function getPlanLabel(plan) {
  const normalized = String(plan || '').trim().toLowerCase();
  if (normalized === 'starter') return 'Starter';
  if (normalized === 'business') return 'Business';
  if (normalized === 'enterprise') return 'Enterprise';
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Plan';
}

function buildGatewayReference(method, paymentDetails = {}) {
  const providedReference = String(
    paymentDetails.transactionId
    || paymentDetails.transaction_id
    || paymentDetails.referenceId
    || paymentDetails.reference_id
    || paymentDetails.bankReference
    || paymentDetails.bank_reference
    || ''
  ).trim();

  if (providedReference) {
    return providedReference;
  }

  const prefix = method.startsWith('upi_') ? 'UPI' : method === 'netbanking' ? 'NB' : 'CARD';
  return `${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

// Public pricing plans for landing page (no auth)
router.get('/plans', async (_req, res) => {
  try {
    // If subscription_plans exists (SaaS control center), use it.
    // Otherwise fall back to fixed plans (starter/business/enterprise).
    let rows = [];
    try {
      rows = await query(
        "SELECT id, name, price, billing_cycle, user_limit, storage_limit_gb, modules_included, status FROM subscription_plans WHERE status='active' ORDER BY price ASC"
      );
    } catch (e) {
      rows = [];
    }

    if (!rows || rows.length === 0) {
      return res.json({
        success: true,
        data: [
          { id: 'starter', name: 'Starter', price: 999, billing_cycle: 'monthly', user_limit: 10, storage_limit_gb: 5, modules_included: ['CRM', 'HRMS', 'API Access'] },
          { id: 'business', name: 'Business', price: 2499, billing_cycle: 'monthly', user_limit: 25, storage_limit_gb: 25, modules_included: ['CRM', 'HRMS', 'API Access', 'Automation'] },
          { id: 'enterprise', name: 'Enterprise', price: null, billing_cycle: 'custom', user_limit: null, storage_limit_gb: null, modules_included: ['CRM', 'HRMS', 'API Access', 'Dedicated Success'] },
        ],
      });
    }

    rows.forEach((r) => {
      try {
        r.modules_included = typeof r.modules_included === 'string' ? JSON.parse(r.modules_included) : r.modules_included;
      } catch (e) { }
    });

    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/session/:sessionId', async (req, res) => {
  try {
    await ensureTables();
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }

    const rows = await query(
      `SELECT id, email, full_name, company, plan, status, payment_method, amount, currency, created_at, paid_at, activation_status, activated_at
       FROM subscription_sessions
       WHERE id = ?
       LIMIT 1`,
      [sessionId]
    );

    const session = rows && rows[0];
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    return res.json({
      success: true,
      data: {
        ...session,
        plan_label: getPlanLabel(session.plan),
        payment_method: normalizePaymentMethod(session.payment_method),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/checkout', async (req, res) => {
  try {
    await ensureTables();
    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    const fullName = String(b.fullName || b.name || '').trim();
    const company = String(b.company || '').trim();
    const plan = String(b.plan || 'starter').trim().toLowerCase();

    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Invalid email' });
    if (!['starter', 'business', 'enterprise'].includes(plan)) return res.status(400).json({ success: false, message: 'Invalid plan' });

    const sessionId = crypto.randomBytes(24).toString('hex');
    const tempPassword = generatePassword(10);

    let amount = null;
    if (plan === 'starter') amount = 999;
    else if (plan === 'business') amount = 2499;

    await query(
      `INSERT INTO subscription_sessions (id, email, full_name, company, plan, status, payment_method, amount, currency, gateway_reference, temp_password)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [sessionId, email, fullName || null, company || null, plan, 'pending', null, amount, 'INR', null, tempPassword]
    );

    return res.json({
      success: true,
      data: {
        sessionId,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/confirm', async (req, res) => {
  try {
    await ensureTables();
    const sessionId = String((req.body && req.body.sessionId) || '').trim();
    const paymentMethod = normalizePaymentMethod((req.body && req.body.paymentMethod) || '');
    const paymentDetails = (req.body && req.body.paymentDetails && typeof req.body.paymentDetails === 'object')
      ? req.body.paymentDetails
      : {};
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId is required' });
    if (!paymentMethod) return res.status(400).json({ success: false, message: 'paymentMethod is required' });

    const sessions = await query('SELECT * FROM subscription_sessions WHERE id = ? LIMIT 1', [sessionId]);
    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status === 'paid') {
      return res.json({ success: true, data: { email: session.email, sessionId, alreadyPaid: true } });
    }

    // Mark session paid and store payment method / gateway reference
    const gatewayRef = buildGatewayReference(paymentMethod, paymentDetails);
    await query(
      'UPDATE subscription_sessions SET status = ?, paid_at = NOW(), payment_method = ?, gateway_reference = ? WHERE id = ?',
      ['paid', paymentMethod, gatewayRef, sessionId]
    );

    return res.json({
      success: true,
      data: {
        email: session.email,
        sessionId,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/activate', async (req, res) => {
  try {
    await ensureTables();
    const sessionId = String((req.body && req.body.sessionId) || '').trim();
    const password = String((req.body && req.body.password) || '').trim();
    if (!sessionId || !password) {
      return res.status(400).json({ success: false, message: 'sessionId and password are required' });
    }

    const sessions = await query('SELECT * FROM subscription_sessions WHERE id = ? LIMIT 1', [sessionId]);
    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status !== 'paid') return res.status(400).json({ success: false, message: 'Payment not completed for this session' });
    if (session.activation_status === 'done') {
      return res.json({ success: true, data: { email: session.email, alreadyActivated: true } });
    }

    const hashed = await bcrypt.hash(password, 10).catch(() => password);
    const safeCompanyName = String(session.company || '').trim() || 'New Company';
    const safeEmail = String(session.email || '').trim().toLowerCase();

    // 1. Create or reuse the company first so activation retries stay idempotent.
    let companyCode = normalizeCompanyCode('', safeCompanyName) || deriveCompanyCodeFromName(safeCompanyName, 'CMP');
    let companyId = 0;
    const existingCompanyRows = await query(
      'SELECT id, company_code FROM companies WHERE LOWER(email) = LOWER(?) OR LOWER(company_name) = LOWER(?) LIMIT 1',
      [safeEmail, safeCompanyName]
    ).catch(() => []);
    const existingCompany = Array.isArray(existingCompanyRows) ? existingCompanyRows[0] : null;

    if (existingCompany) {
      companyId = Number(existingCompany.id || 0);
      companyCode = String(existingCompany.company_code || companyCode || '').trim();
      await query(
        'UPDATE companies SET company_code = ?, company_name = ?, email = ?, phone = ?, status = ? WHERE id = ?',
        [companyCode, safeCompanyName, safeEmail, '', 'active', companyId]
      );
    } else {
      const companyInsert = await query(
        `INSERT INTO companies (company_code, company_name, email, phone, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [String(companyCode || '').trim(), safeCompanyName, safeEmail, '']
      );
      companyId = Number(companyInsert?.insertId || 0);
    }

    const existing = await query('SELECT id FROM employees WHERE LOWER(email) = LOWER(?) LIMIT 1', [safeEmail]);
    const existingRow = Array.isArray(existing) ? existing[0] : null;
    if (!existingRow) {
      const adminEmployeeCode = await buildCompanyAdminEmployeeCode(companyCode, companyId, {
        companyName: safeCompanyName,
      });
      await query(
        `INSERT INTO employees (company_id, employee_code, name, email, password, role, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,'active', NOW(), NOW())`,
        [companyId, String(adminEmployeeCode || '').trim(), String(session.full_name || 'Subscriber').trim(), safeEmail, hashed, 'admin']
      );
    } else {
      await query(
        'UPDATE employees SET company_id = ?, name = ?, email = ?, password = ?, status = ?, updated_at = NOW() WHERE id = ?',
        [companyId, String(session.full_name || existingRow.name || 'Subscriber').trim(), safeEmail, hashed, 'active', existingRow.id]
      );
    }

    await query(
      'UPDATE subscription_sessions SET activation_status = ?, activated_at = NOW() WHERE id = ?',
      ['done', sessionId]
    );

    return res.json({
      success: true,
      data: { email: session.email },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

