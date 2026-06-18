const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { verifyToken, verifyTokenNoTouch, JWT_SECRET } = require('../middleware/auth');
const { buildCompanyAdminEmployeeCode } = require('../utils/companyCode');
const {
  requestPasswordResetOtp: requestEmailPasswordResetOtp,
  verifyPasswordResetOtp: verifyEmailPasswordResetOtp,
  resetPasswordWithVerifiedOtp: resetEmailPasswordWithToken,
} = require('../controllers/auth/passwordResetController');
const {
  phoneKeyFromInput,
  findActiveEmployeeByPhone,
  generateOtp6,
  formatOtpDisplay,
  parseOtpInput,
  sendOtpToPhone,
  verifyOtpWithProvider,
} = require('../services/passwordResetOtp');
const {
  refreshSmsConfig,
  getSmsConfig,
  getPublicSmsStatus,
  ensureGlobalSettingsTable,
  ensureSmsSettingsTable,
  normalizeOtpExpiry,
} = require('../config/smsConfig');
const emailPasswordResetRoutes = require('./auth/passwordResetRoutes');
const { ensureEmployeeCodeSchema } = require('../utils/employeeCodeSchema');

const router = express.Router();

router.use(async (_req, _res, next) => {
  try {
    await ensureEmployeeCodeSchema();
    next();
  } catch (err) {
    next(err);
  }
});

// Isolated email OTP password reset module (no impact on existing auth routes)
router.use('/forgot-password/email', emailPasswordResetRoutes);

/** In-memory rate limit: phone_key -> last epoch ms */
const otpRequestCooldown = new Map();
const OTP_COOLDOWN_MS = 60 * 1000;
const DEFAULT_OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const RESET_JWT_TTL_SEC = 15 * 60;
const OTP_WINDOW_MS = 15 * 60 * 1000;
const OTP_WINDOW_LIMIT = 5;

const COMMON_MODULE_KEYS = ['calendar', 'notifications', 'chat'];
const CRM_MODULE_KEYS = [
  'crm',
  'leads',
  'meetings',
  'tasks',
  'followups',
  'quotations',
  'invoices',
  'reports',
  'history',
  'whatsapp',
  'group_meetings',
];
const HRMS_MODULE_KEYS = [
  'hrms',
  'hrms_attendance',
  'hrms_leaves',
  'hrms_salary',
  'hrms_documents',
  'hrms_departments',
  'hrms_designations',
  'hrms_shifts',
  'hrms_holidays',
  'hrms_announcements',
  'hrms_performance',
  'hrms_settings',
  'hrms_reports',
];

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

async function hasTableColumn(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function addTableColumnIfMissing(table, column, ddl) {
  if (!(await hasTableColumn(table, column))) {
    await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function getConfiguredOtpTtlMs(cfg) {
  const minutes = normalizeOtpExpiry(cfg?.OTP_EXPIRY_MINUTES || 5);
  return minutes > 0 ? minutes * 60 * 1000 : DEFAULT_OTP_TTL_MS;
}

function getProviderFromSmsResult(result) {
  const provider = String(result?.provider || '').toLowerCase();
  if (provider) return provider;
  const mode = String(result?.mode || '').toLowerCase();
  if (mode.startsWith('msg91')) return 'msg91';
  if (mode.includes('2factor')) return '2factor';
  if (mode.includes('fast2sms')) return 'fast2sms';
  if (mode.includes('twilio')) return 'twilio';
  return '';
}

async function ensurePasswordResetTables() {
  await query(
    `CREATE TABLE IF NOT EXISTS password_reset_otps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone_key VARCHAR(32) NOT NULL,
      employee_id INT NOT NULL,
      otp_hash VARCHAR(120) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      consumed TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_phone_expires (phone_key, expires_at),
      INDEX idx_employee_created (employee_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await addTableColumnIfMissing('password_reset_otps', 'provider', 'VARCHAR(30) NULL');
  await addTableColumnIfMissing('password_reset_otps', 'provider_session_id', 'VARCHAR(180) NULL');
  await addTableColumnIfMissing('password_reset_otps', 'sms_mobile', 'VARCHAR(24) NULL');
  await addTableColumnIfMissing('password_reset_otps', 'sent_at', 'DATETIME NULL');

  await query(
    `CREATE TABLE IF NOT EXISTS password_reset_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      phone_key VARCHAR(32) NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME NULL,
      INDEX idx_employee_phone (employee_id, phone_key),
      INDEX idx_expires_used (expires_at, used)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function findEmployeeByEmail(email) {
  const normalizedEmail = String(email || '').trim();

  // Primary query for current schema (with status column).
  try {
    const rows = await query(
      'SELECT * FROM employees WHERE LOWER(email) = LOWER(?) AND status = ?',
      [normalizedEmail, 'active']
    );
    return rows[0] || null;
  } catch (err) {
    // Backward compatibility for older schemas where `status` column may not exist.
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && /status/i.test(err.message || '')) {
      const rows = await query(
        'SELECT * FROM employees WHERE LOWER(email) = LOWER(?)',
        [normalizedEmail]
      );
      const employee = rows[0] || null;
      if (!employee) return null;

      // If a status-like field exists in older schema, enforce active users only.
      if (employee.status && String(employee.status).toLowerCase() !== 'active') {
        return null;
      }
      return employee;
    }

    throw err;
  }
}

async function getCompanyModules(companyId) {
  if (!companyId) return [];
  try {
    const rows = await query(
      'SELECT m.code FROM company_modules cm JOIN modules m ON cm.module_id = m.id WHERE cm.company_id = ? AND m.status = ? AND COALESCE(cm.is_enabled, 1) = 1',
      [companyId, 'enabled']
    );
    return Array.isArray(rows) ? rows.map(r => r.code).filter(Boolean) : [];
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && /is_enabled/i.test(err.message || '')) {
      try {
        const rows = await query(
          'SELECT m.code FROM company_modules cm JOIN modules m ON cm.module_id = m.id WHERE cm.company_id = ? AND m.status = ?',
          [companyId, 'enabled']
        );
        return Array.isArray(rows) ? rows.map(r => r.code).filter(Boolean) : [];
      } catch (_) {
        return [];
      }
    }
    return [];
  }
}

function normalizeModuleCode(code) {
  return String(code || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

function normalizePortalInput(value) {
  const v = String(value || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (v === 'setup' || v === 'company_setup' || v === 'superadmin_setup') return 'setup';
  if (v === 'master' || v === 'platform_owner' || v === 'master_panel') return 'master';
  return '';
}

function inferSuperAdminPanel(employee) {
  const hint = [
    employee?.designation,
    employee?.department,
    employee?.email,
    employee?.name,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');

  if (hint.includes('setup') || hint.includes('company setup') || hint.includes('tenant setup')) {
    return 'setup';
  }
  return 'master';
}

function expandModuleCodes(rawModules = [], includeCommon = false) {
  const list = Array.isArray(rawModules) ? rawModules : [rawModules];
  const expanded = new Set(list.map(normalizeModuleCode).filter(Boolean));
  if (expanded.has('crm')) CRM_MODULE_KEYS.forEach((key) => expanded.add(key));
  if (expanded.has('hrms')) HRMS_MODULE_KEYS.forEach((key) => expanded.add(key));
  if (includeCommon) COMMON_MODULE_KEYS.forEach((key) => expanded.add(key));
  return Array.from(expanded);
}

async function getEmployeeAccessModules(employeeId, companyId, role) {
  const normalizedRole = String(role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  if (normalizedRole === 'superadmin' || normalizedRole === 'super_admin') {
    try {
      const rows = await query("SELECT code FROM modules WHERE status = 'enabled'");
      return { modules: rows.map((r) => r.code), moduleRestricted: false };
    } catch (e) {
      return { modules: [], moduleRestricted: false };
    }
  }

  const companyModules = companyId ? await getCompanyModules(companyId) : [];
  let allowedModules = [...companyModules];
  if (companyId && allowedModules.length === 0) {
    try {
      const compRows = await query('SELECT subscription_plan_id FROM companies WHERE id = ?', [companyId]);
      const planId = compRows[0]?.subscription_plan_id;
      if (planId) {
        const planMods = await query(
          'SELECT m.code FROM plan_modules pm JOIN modules m ON pm.module_id = m.id WHERE pm.plan_id = ? AND m.status = ?',
          [planId, 'enabled']
        );
        allowedModules = planMods.map(r => r.code).filter(Boolean);
      }
    } catch (e) {
      // ignore
    }
  }
  const companyRestricted = allowedModules.length > 0;
  const allowedExpanded = expandModuleCodes(allowedModules, companyRestricted);

  if (normalizedRole === 'admin') {
    return { modules: allowedExpanded, moduleRestricted: companyRestricted };
  }

  try {
    const rows = await query(
      'SELECT module_key FROM employee_module_access WHERE employee_id = ? AND allowed = 1 ORDER BY module_key ASC',
      [employeeId]
    );
    const employeeKeys = Array.isArray(rows) ? rows.map((r) => r.module_key).filter(Boolean) : [];
    const employeeExpanded = expandModuleCodes(employeeKeys, false);

    if (employeeExpanded.length === 0) {
      return { modules: allowedExpanded, moduleRestricted: companyRestricted };
    }
    if (!companyRestricted) {
      return { modules: employeeExpanded, moduleRestricted: true };
    }

    const employeeSet = new Set(employeeExpanded);
    const intersection = allowedExpanded.filter((moduleCode) => employeeSet.has(moduleCode));
    return { modules: Array.from(new Set(intersection)), moduleRestricted: true };
  } catch (err) {
    return { modules: allowedExpanded, moduleRestricted: companyRestricted };
  }
}

async function getEmployeePoshProfile(employeeId, companyId) {
  if (!employeeId || !companyId) return null;
  try {
    const rows = await query(
      `SELECT role
       FROM posh_icc_members
       WHERE employee_id = ? AND company_id = ? AND status = 'active'
       ORDER BY id DESC LIMIT 1`,
      [employeeId, companyId]
    );
    const member = Array.isArray(rows) ? rows[0] : null;
    if (!member) return null;
    return {
      posh_role: 'icc',
      posh_icc_role: member.role || 'ICC Member',
    };
  } catch (_) {
    return null;
  }
}

function resolveSuperAdminPanel(employee) {
  const storedPanel = normalizePortalInput(employee?.superadmin_panel);
  if (storedPanel) return storedPanel;
  return inferSuperAdminPanel(employee);
}

async function buildEmployeeSessionData(employee, { superadminPanel = null } = {}) {
  const accessProfile = await getEmployeeAccessModules(employee.id, employee.company_id, employee.role);
  const poshProfile = await getEmployeePoshProfile(employee.id, employee.company_id);
  const normalizedRole = String(employee.role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

  return {
    id: employee.id,
    employee_code: employee.employee_code || '',
    name: employee.name,
    email: employee.email,
    phone: employee.phone || '',
    role: employee.role || 'employee',
    department: employee.department || '',
    designation: employee.designation || '',
    status: employee.status || 'active',
    company_id: employee.company_id || null,
    created_at: employee.created_at || '',
    updated_at: employee.updated_at || '',
    access_modules: accessProfile.modules || [],
    module_restricted: !!accessProfile.moduleRestricted,
    posh_role: poshProfile?.posh_role || null,
    posh_icc_role: poshProfile?.posh_icc_role || null,
    superadmin_panel:
      normalizedRole === 'superadmin' || normalizedRole === 'super_admin'
        ? (superadminPanel || resolveSuperAdminPanel(employee))
        : null,
  };
}

router.post('/login', async (req, res) => {
  try {
    const { email, password, portal } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    let employee = await findEmployeeByEmail(email);
    if (!employee) {
      // Fallback: Check if there is a company with this email
      const companyRows = await query('SELECT * FROM companies WHERE LOWER(email) = LOWER(?) AND status = ?', [email.trim(), 'active']);
      const company = companyRows[0];
      if (company) {
        // Validate password against company password
        let companyPasswordMatch = false;
        if (password === company.password) {
          companyPasswordMatch = true;
        }
        if (!companyPasswordMatch && typeof company.password === 'string') {
          try {
            companyPasswordMatch = await bcrypt.compare(password, company.password);
          } catch (e) {
            // ignore
          }
        }

        if (companyPasswordMatch) {
          // Password is correct! Ensure an admin employee exists for this company.
          const checkEmp = await query('SELECT * FROM employees WHERE LOWER(email) = LOWER(?)', [email.trim()]);
          if (checkEmp && checkEmp.length > 0) {
            employee = checkEmp[0];
            // Sync password and status if needed
            if (employee.password !== company.password || employee.status !== 'active') {
              await query('UPDATE employees SET password = ?, status = ? WHERE id = ?', [company.password, 'active', employee.id]);
              employee.password = company.password;
              employee.status = 'active';
            }
          } else {
            // Create a new admin employee for this company
            const employeeCode = await buildCompanyAdminEmployeeCode(company.company_code, company.id, {
              companyName: company.company_name,
            });
            await query(
              'INSERT INTO employees (employee_code, name, email, password, role, status, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [employeeCode, company.company_name, company.email, company.password, 'admin', 'active', company.id]
            );
            const freshEmp = await query('SELECT * FROM employees WHERE LOWER(email) = LOWER(?)', [email.trim()]);
            employee = freshEmp[0];
          }
        }
      }
    }

    if (!employee) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    let passwordMatch = false;
    // 1) Plain text match (for existing seed/demo data)
    if (password === employee.password) {
      passwordMatch = true;
    }
    // 2) Bcrypt hash match (PHP password_hash compatibility)
    if (!passwordMatch && typeof employee.password === 'string') {
      try {
        passwordMatch = await bcrypt.compare(password, employee.password);
      } catch (e) {
        // ignore, fall through to error
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const normalizedRole = String(employee.role || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');
    const requestedPortal = normalizePortalInput(portal);
    let superadminPanel = '';

    if (requestedPortal && normalizedRole !== 'superadmin' && normalizedRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'This login is only allowed for Super Admin accounts.',
      });
    }

    if (normalizedRole === 'superadmin' || normalizedRole === 'super_admin') {
      superadminPanel = resolveSuperAdminPanel(employee);
      if (requestedPortal && requestedPortal !== superadminPanel) {
        return res.status(403).json({
          success: false,
          message:
            requestedPortal === 'setup'
              ? 'This account is not allowed in Super Admin Setup Panel. Use Master Panel login.'
              : 'This account is not allowed in Master Panel. Use Super Admin Setup Panel login.',
          data: {
            expected_panel: superadminPanel,
          },
        });
      }
    }

    const employeeData = await buildEmployeeSessionData(employee, { superadminPanel });

    req.session.employee = employee;
    req.session.createdAt = Date.now();
    req.session.lastActive = Date.now();

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ success: false, message: 'Session initialization failed' });
      }
      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          employee: employeeData,
        },
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const employeeData = await buildEmployeeSessionData(req.employee);
    return res.json({
      success: true,
      data: {
        employee: employeeData,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/verify', verifyToken, async (req, res) => {
  try {
    const employeeData = await buildEmployeeSessionData(req.employee);
    return res.json({
      success: true,
      data: {
        employee: employeeData,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Could not log out' });
      }
      res.clearCookie('sid');
      return res.json({ success: true, message: 'Logged out successfully' });
    });
  } else {
    res.clearCookie('sid');
    return res.json({ success: true, message: 'Logged out successfully' });
  }
});

router.post('/refresh-activity', verifyTokenNoTouch, (req, res) => {
  try {
    if (req.session && typeof req.session.touch === 'function') {
      req.session.touch();
    }
    return res.json({ success: true, message: 'Activity refreshed' });
  } catch (err) {
    return res.json({ success: true, message: 'Activity refreshed' });
  }
});

/** Same response for missing phone / no user to reduce account enumeration */
const FORGOT_GENERIC_OK = {
  success: true,
  message: 'If this number is registered, you will receive an OTP shortly.',
};

async function requestPasswordResetOtp(req, res) {
  try {
    await ensureGlobalSettingsTable();
    await ensureSmsSettingsTable();
    await refreshSmsConfig();
    await ensurePasswordResetTables();
    const { phone } = req.body || {};
    const phoneKey = phoneKeyFromInput(phone);
    if (!phoneKey || phoneKey.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid mobile number (at least 8 digits).',
      });
    }

    const now = Date.now();
    const last = otpRequestCooldown.get(phoneKey) || 0;
    if (now - last < OTP_COOLDOWN_MS) {
      return res.status(429).json({
        success: false,
        message: 'Please wait a minute before requesting another OTP.',
      });
    }

    const windowRows = await query(
      `SELECT COUNT(*) AS count
       FROM password_reset_otps
       WHERE phone_key = ? AND created_at >= ?`,
      [phoneKey, new Date(now - OTP_WINDOW_MS)]
    );
    if (Number(windowRows?.[0]?.count || 0) >= OTP_WINDOW_LIMIT) {
      return res.status(429).json({
        success: false,
        message: '15 minutes mein max 5 OTP allowed hain. Thoda wait karke dubara try karein.',
      });
    }

    const employee = await findActiveEmployeeByPhone(query, phone);
    if (!employee) {
      otpRequestCooldown.set(phoneKey, now);
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev) {
        return res.status(404).json({
          success: false,
          message:
            'Is mobile number par koi active employee nahi mila. Admin → Employees mein registered phone check karein (10 digit, e.g. 9876543210).',
        });
      }
      return res.json(FORGOT_GENERIC_OK);
    }

    const role = String(employee.role || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');
    if (role === 'superadmin' || role === 'super_admin') {
      otpRequestCooldown.set(phoneKey, now);
      return res.json(FORGOT_GENERIC_OK);
    }

    const smsCfg = await getSmsConfig();
    const otp = generateOtp6();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + getConfiguredOtpTtlMs(smsCfg));

    await query(
      'UPDATE password_reset_otps SET consumed = 1 WHERE phone_key = ? AND consumed = 0',
      [phoneKey]
    );
    await query('DELETE FROM password_reset_sessions WHERE phone_key = ? OR expires_at < NOW()', [phoneKey]);
    const ins = await query(
      `INSERT INTO password_reset_otps (phone_key, employee_id, otp_hash, expires_at, attempts, consumed)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [phoneKey, employee.id, otpHash, expiresAt]
    );
    const otpRowId = ins && ins.insertId ? ins.insertId : null;

    let smsResult;
    try {
      smsResult = await sendOtpToPhone(phone, otp);
    } catch (smsErr) {
      console.error('SMS error:', smsErr);
      if (otpRowId) {
        await query('DELETE FROM password_reset_otps WHERE id = ?', [otpRowId]);
      }
      return res.status(smsErr.statusCode || 502).json({
        success: false,
        message:
          smsErr.message ||
          'OTP SMS nahi bheja ja saka. backend-node/.env mein MSG91_AUTH_KEY ya FAST2SMS_API_KEY set karein.',
        errors: smsErr.fieldErrors || undefined,
      });
    }
    if (otpRowId) {
      await query(
        `UPDATE password_reset_otps
         SET provider = ?, provider_session_id = ?, sms_mobile = ?, sent_at = NOW()
         WHERE id = ?`,
        [
          getProviderFromSmsResult(smsResult),
          smsResult.providerSessionId || null,
          smsResult.smsMobile || null,
          otpRowId,
        ]
      );
    }
    otpRequestCooldown.set(phoneKey, now);

    const payload = {
      success: true,
      message: 'OTP sent successfully',
      data: {
        smsSent: true,
        deliveryMode: smsResult.mode,
        expiresInMinutes: normalizeOtpExpiry(smsCfg.OTP_EXPIRY_MINUTES || 5),
        otpVerified: false,
      },
    };
    if (process.env.ALLOW_OTP_DEBUG === '1' || process.env.ALLOW_OTP_DEBUG === 'true') {
      payload.debugOtp = formatOtpDisplay(otp);
    }
    return res.json(payload);
  } catch (err) {
    console.error('request-otp error:', err);
    return res.status(500).json({ success: false, message: 'Could not send OTP. Try again later.' });
  }
}

async function verifyPhonePasswordResetOtp(req, res) {
  try {
    await ensurePasswordResetTables();
    const { phone, otp } = req.body || {};
    const phoneKey = phoneKeyFromInput(phone);
    const otpStr = parseOtpInput(otp);

    if (!phoneKey || otpStr.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Enter mobile number and 6 digit OTP.',
      });
    }

    const rows = await query(
      `SELECT * FROM password_reset_otps WHERE phone_key = ? AND consumed = 0 ORDER BY id DESC LIMIT 1`,
      [phoneKey]
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Request a new code.' });
    }

    const exp = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    if (Date.now() > exp) {
      await query('UPDATE password_reset_otps SET consumed = 1 WHERE id = ?', [row.id]);
      return res.status(400).json({ success: false, message: 'OTP has expired. Request a new one.' });
    }

    if (row.attempts >= MAX_OTP_ATTEMPTS) {
      await query('UPDATE password_reset_otps SET consumed = 1 WHERE id = ?', [row.id]);
      return res.status(400).json({ success: false, message: 'Too many attempts. Request a new OTP.' });
    }

    const match = await bcrypt.compare(otpStr, row.otp_hash);
    if (!match) {
      await query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?', [row.id]);
      return res.status(400).json({ success: false, message: 'Incorrect OTP.' });
    }

    if (row.provider) {
      try {
        await verifyOtpWithProvider(
          row.provider,
          row.sms_mobile || phone,
          otpStr,
          row.provider_session_id || ''
        );
      } catch (providerErr) {
        console.error('provider otp verify error:', providerErr.message);
        await query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?', [row.id]);
        return res.status(400).json({
          success: false,
          message: 'OTP invalid hai ya provider verification fail hua. New OTP request karein.',
        });
      }
    }

    await query('UPDATE password_reset_otps SET consumed = 1 WHERE id = ?', [row.id]);

    const resetToken = jwt.sign(
      {
        purpose: 'password_reset',
        id: row.employee_id,
        phone_key: phoneKey,
        exp: Math.floor(Date.now() / 1000) + RESET_JWT_TTL_SEC,
      },
      JWT_SECRET
    );
    const expiresAt = new Date(Date.now() + RESET_JWT_TTL_SEC * 1000);
    const tokenHash = hashResetToken(resetToken);
    await query(
      'INSERT INTO password_reset_sessions (employee_id, phone_key, token_hash, expires_at, used) VALUES (?, ?, ?, ?, 0)',
      [row.employee_id, phoneKey, tokenHash, expiresAt]
    );

    return res.json({
      success: true,
      message: 'OTP verified. Ab naya password set karein.',
      data: { resetToken, otpVerified: true },
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed. Try again.' });
  }
}

async function handleForgotPasswordSendOtp(req, res) {
  if (req.body?.email) {
    return requestEmailPasswordResetOtp(req, res);
  }
  return requestPasswordResetOtp(req, res);
}

async function handleForgotPasswordVerifyOtp(req, res) {
  if (req.body?.email) {
    return verifyEmailPasswordResetOtp(req, res);
  }
  return verifyPhonePasswordResetOtp(req, res);
}

async function handleForgotPasswordReset(req, res) {
  if (req.body?.email) {
    return resetEmailPasswordWithToken(req, res);
  }
  return resetForgotPassword(req, res);
}

router.post('/forgot-password/request-otp', handleForgotPasswordSendOtp);
router.post('/forgot-password/send-otp', handleForgotPasswordSendOtp);

router.get('/forgot-password/sms-status', async (req, res) => {
  try {
    await ensureGlobalSettingsTable();
    await ensureSmsSettingsTable();
    await refreshSmsConfig();
    const status = getPublicSmsStatus();
    return res.json({
      success: true,
      data: {
        ...status,
        message: status.smsConfigured
          ? `SMS ready (${status.provider || 'configured'}).`
          : 'SMS not configured. Super Admin → System Settings → SMS OTP section.',
      },
    });
  } catch (err) {
    console.error('sms-status error:', err);
    const fallback = getPublicSmsStatus();
    return res.json({
      success: true,
      data: {
        ...fallback,
        message: 'SMS status temporarily unavailable. Local fallback data shown instead.',
        error: err.message || 'Unknown error',
      },
    });
  }
});

router.post('/forgot-password/verify-otp', handleForgotPasswordVerifyOtp);

async function resetForgotPassword(req, res) {
  try {
    await ensurePasswordResetTables();
    const { resetToken, newPassword } = req.body || {};
    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset session. Start again.' });
    }
    if (!decoded || decoded.purpose !== 'password_reset' || !decoded.id) {
      return res.status(400).json({ success: false, message: 'Invalid reset session.' });
    }

    const tokenHash = hashResetToken(resetToken);
    const sessionRows = await query(
      'SELECT * FROM password_reset_sessions WHERE token_hash = ? AND employee_id = ? LIMIT 1',
      [tokenHash, decoded.id]
    );
    const session = Array.isArray(sessionRows) ? sessionRows[0] : null;
    if (!session) {
      return res.status(400).json({ success: false, message: 'Reset session not found. OTP verify dubara karein.' });
    }
    if (session.used) {
      return res.status(400).json({ success: false, message: 'Reset session already used. OTP dubara verify karein.' });
    }
    const sessionExp = session.expires_at ? new Date(session.expires_at).getTime() : 0;
    if (!sessionExp || Date.now() > sessionExp) {
      await query('UPDATE password_reset_sessions SET used = 1, used_at = NOW() WHERE id = ?', [session.id]);
      return res.status(400).json({ success: false, message: 'Reset session expired. OTP dubara verify karein.' });
    }

    let employee = null;
    try {
      const rows = await query('SELECT * FROM employees WHERE id = ? AND status = ?', [decoded.id, 'active']);
      employee = rows[0] || null;
    } catch (err) {
      if (err && err.code === 'ER_BAD_FIELD_ERROR' && /status/i.test(err.message || '')) {
        const rows = await query('SELECT * FROM employees WHERE id = ?', [decoded.id]);
        employee = rows[0] || null;
      } else {
        throw err;
      }
    }
    if (!employee) {
      return res.status(400).json({ success: false, message: 'Account not found or inactive.' });
    }

    const role = String(employee.role || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');
    if (role === 'superadmin' || role === 'super_admin') {
      return res.status(403).json({ success: false, message: 'Password reset is not allowed for this account.' });
    }

    const phoneKey = phoneKeyFromInput(employee.phone);
    if (!phoneKey || (decoded.phone_key && decoded.phone_key !== phoneKey)) {
      return res.status(400).json({ success: false, message: 'Reset session does not match this account.' });
    }
    if (session.phone_key && session.phone_key !== phoneKey) {
      return res.status(400).json({ success: false, message: 'Reset session phone mismatch. OTP dubara verify karein.' });
    }

    const hashed = await bcrypt.hash(String(newPassword), 10);
    await query('UPDATE employees SET password = ?, updated_at = NOW() WHERE id = ?', [hashed, employee.id]);
    await query('UPDATE password_reset_sessions SET used = 1, used_at = NOW() WHERE id = ?', [session.id]);

    return res.json({ success: true, message: 'Password updated. You can log in with your new password.' });
  } catch (err) {
    console.error('forgot-password reset error:', err);
    return res.status(500).json({ success: false, message: 'Could not update password.' });
  }
}

router.post('/forgot-password/reset', handleForgotPasswordReset);
router.post('/forgot-password/reset-password', handleForgotPasswordReset);

router.post('/logout', verifyToken, (req, res) => {
  return res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
