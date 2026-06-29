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
  const alterStatements = [
    'ALTER TABLE subscription_sessions ADD COLUMN payment_method VARCHAR(32) NULL',
    'ALTER TABLE subscription_sessions ADD COLUMN amount DECIMAL(10,2) NULL',
    "ALTER TABLE subscription_sessions ADD COLUMN currency VARCHAR(8) NOT NULL DEFAULT 'INR'",
    'ALTER TABLE subscription_sessions ADD COLUMN gateway_reference VARCHAR(128) NULL',
    'ALTER TABLE subscription_sessions ADD COLUMN activation_status VARCHAR(16) NOT NULL DEFAULT \'pending\'',
    'ALTER TABLE subscription_sessions ADD COLUMN activated_at DATETIME NULL',
    'ALTER TABLE subscription_sessions ADD COLUMN plan_id INT NULL',
    'ALTER TABLE subscription_sessions ADD COLUMN plan_name VARCHAR(120) NULL',
  ];

  for (const sql of alterStatements) {
    try {
      await query(sql);
    } catch (err) {
      if (err && err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_PARSE_ERROR') {
        console.error('subscription_sessions alter error:', err.message);
      }
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
  if (/^\d+$/.test(normalized)) return `Plan ${normalized}`;
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Plan';
}

function parseModulesInPlan(modules) {
  if (Array.isArray(modules)) {
    return modules;
  }

  if (typeof modules === 'string') {
    try {
      const parsed = JSON.parse(modules);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err) {
      return modules.split(',').map((item) => String(item || '').trim()).filter(Boolean);
    }
  }

  return [];
}

async function resolveCheckoutPlan(rawPlan) {
  const normalized = String(rawPlan || '').trim();
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  if (['starter', 'business', 'enterprise'].includes(lower)) {
    return {
      sessionPlan: lower,
      planId: null,
      planName: getPlanLabel(lower),
      billingCycle: lower === 'enterprise' ? 'custom' : 'monthly',
      amount: lower === 'starter' ? 999 : lower === 'business' ? 2499 : null,
      modulesIncluded: [],
    };
  }

  let rows = [];
  if (/^(?:plan[-_:])?\d+$/.test(lower)) {
    const numericId = Number(lower.replace(/^(?:plan[-_:])/, ''));
    rows = await query(
      `SELECT id, name, price, billing_cycle, modules_included
       FROM subscription_plans
       WHERE id = ? AND status = 'active'
       LIMIT 1`,
      [numericId]
    );
  }

  if (!rows.length) {
    rows = await query(
      `SELECT id, name, price, billing_cycle, modules_included
       FROM subscription_plans
       WHERE status = 'active' AND LOWER(name) = LOWER(?)
       LIMIT 1`,
      [normalized]
    );
  }

  const plan = rows && rows[0];
  if (!plan) {
    return null;
  }

  return {
    sessionPlan: String(plan.id),
    planId: Number(plan.id),
    planName: String(plan.name || 'Plan').trim() || 'Plan',
    billingCycle: String(plan.billing_cycle || 'monthly').trim().toLowerCase(),
    amount: plan.price === null || plan.price === undefined ? null : Number(plan.price),
    modulesIncluded: parseModulesInPlan(plan.modules_included),
  };
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
        "SELECT id, name, price, billing_cycle, user_limit, storage_limit_gb, modules_included, status FROM subscription_plans WHERE status='active' ORDER BY price IS NULL, price ASC, id ASC"
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
      `SELECT s.id, s.email, s.full_name, s.company, s.plan, s.plan_id, s.plan_name, s.status, s.payment_method, s.amount, s.currency, s.created_at, s.paid_at, s.activation_status, s.activated_at,
              sp.name AS catalog_plan_name, sp.price AS catalog_plan_price, sp.billing_cycle AS catalog_billing_cycle
       FROM subscription_sessions s
       LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.id = ?
       LIMIT 1`,
      [sessionId]
    );

    const session = rows && rows[0];
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const resolvedPlanLabel = String(session.plan_name || session.catalog_plan_name || getPlanLabel(session.plan)).trim();
    const resolvedAmount = session.amount !== null && session.amount !== undefined
      ? session.amount
      : session.catalog_plan_price !== null && session.catalog_plan_price !== undefined
        ? session.catalog_plan_price
        : null;
    const resolvedBillingCycle = session.catalog_billing_cycle
      || (String(session.plan || '').toLowerCase() === 'enterprise' ? 'custom' : ['starter', 'business'].includes(String(session.plan || '').toLowerCase()) ? 'monthly' : null);

    return res.json({
      success: true,
      data: {
        ...session,
        amount: resolvedAmount,
        plan_label: resolvedPlanLabel,
        billing_cycle: resolvedBillingCycle,
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
    const planInput = String(b.plan || 'starter').trim();

    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Invalid email' });

    const selectedPlan = await resolveCheckoutPlan(planInput);
    if (!selectedPlan) {
      return res.status(400).json({ success: false, message: 'Invalid plan' });
    }

    const sessionId = crypto.randomBytes(24).toString('hex');
    const tempPassword = generatePassword(10);

    await query(
      `INSERT INTO subscription_sessions (id, email, full_name, company, plan, plan_id, plan_name, status, payment_method, amount, currency, gateway_reference, temp_password)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        sessionId,
        email,
        fullName || null,
        company || null,
        selectedPlan.sessionPlan,
        selectedPlan.planId || null,
        selectedPlan.planName || null,
        'pending',
        null,
        selectedPlan.amount,
        'INR',
        null,
        tempPassword,
      ]
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

