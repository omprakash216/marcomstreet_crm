const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, getConnection } = require('../config/database');

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
  const conn = await getConnection();
  try {
    await ensureTables();
    const sessionId = String((req.body && req.body.sessionId) || '').trim();
    const paymentMethod = String((req.body && req.body.paymentMethod) || '').trim().toLowerCase();
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId is required' });

    const sessions = await conn.execute('SELECT * FROM subscription_sessions WHERE id = ? LIMIT 1', [sessionId]);
    const session = sessions && sessions[0] && sessions[0][0];
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status === 'paid') {
      return res.json({ success: true, data: { email: session.email, sessionId, alreadyPaid: true } });
    }

    if (!paymentMethod) return res.status(400).json({ success: false, message: 'paymentMethod is required' });

    // Mark session paid and store payment method / gateway reference
    const gatewayRef = 'MOCK-' + Date.now();
    await conn.execute(
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
  } finally {
    conn.release();
  }
});

router.post('/activate', async (req, res) => {
  const conn = await getConnection();
  try {
    await ensureTables();
    const sessionId = String((req.body && req.body.sessionId) || '').trim();
    const password = String((req.body && req.body.password) || '').trim();
    if (!sessionId || !password) {
      return res.status(400).json({ success: false, message: 'sessionId and password are required' });
    }

    const sessions = await conn.execute('SELECT * FROM subscription_sessions WHERE id = ? LIMIT 1', [sessionId]);
    const session = sessions && sessions[0] && sessions[0][0];
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status !== 'paid') return res.status(400).json({ success: false, message: 'Payment not completed for this session' });
    if (session.activation_status === 'done') {
      return res.json({ success: true, data: { email: session.email, alreadyActivated: true } });
    }

    const hashed = await bcrypt.hash(password, 10).catch(() => password);

    // 1. Create the company first
    const [compRes] = await conn.execute(
      `INSERT INTO companies (company_code, company_name, email, phone, status)
       VALUES (?, ?, ?, ?, 'active')`,
      ['COMP' + Date.now(), session.company || 'New Company', session.email, '', 'active']
    );
    const companyId = compRes.insertId;

    const existing = await conn.execute('SELECT id FROM employees WHERE LOWER(email) = LOWER(?) LIMIT 1', [session.email]);
    const existingRow = existing && existing[0] && existing[0][0];
    if (!existingRow) {
      await conn.execute(
        `INSERT INTO employees (company_id, employee_code, name, email, password, role, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,'active', NOW(), NOW())`,
        [companyId, 'EMP' + Date.now(), session.full_name || 'Subscriber', session.email, hashed, 'admin']
      );
    } else {
      await conn.execute(
        'UPDATE employees SET company_id = ?, password = ?, status = ?, updated_at = NOW() WHERE id = ?',
        [companyId, hashed, 'active', existingRow.id]
      );
    }

    await conn.execute(
      'UPDATE subscription_sessions SET activation_status = ?, activated_at = NOW() WHERE id = ?',
      ['done', sessionId]
    );

    return res.json({
      success: true,
      data: { email: session.email },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;

