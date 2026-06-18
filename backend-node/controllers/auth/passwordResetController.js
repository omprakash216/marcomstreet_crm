const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');
const { query } = require('../../config/database');
const { sendPasswordResetOtpEmail } = require('../../services/email/emailService');
const { generateNumericOtp, hashOtp, compareOtp } = require('../../utils/otp/otpUtils');

const PURPOSE = 'forgot_password';
const OTP_EXPIRY_MINUTES = Math.max(1, Number(process.env.OTP_EXPIRY_MINUTES || 5));
const OTP_MAX_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_ATTEMPTS || process.env.PASSWORD_RESET_MAX_OTP_ATTEMPTS || 3));
const OTP_RESEND_COOLDOWN_SECONDS = Math.max(1, Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30));
const RESET_TOKEN_EXPIRY_MINUTES = Math.max(1, Number(process.env.RESET_TOKEN_EXPIRY_MINUTES || 10));
const OTP_PREFIX = String(process.env.OTP_PREFIX || 'VG')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '')
  .slice(0, 6) || 'VG';

const GENERIC_RESPONSE = {
  success: true,
  message: 'If this email is registered, OTP has been sent.',
};

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return validator.isEmail(String(email || '').trim());
}

function getClientIp(req) {
  const headerIp = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  if (headerIp) return headerIp;
  return String(req.ip || req.connection?.remoteAddress || 'unknown').trim();
}

function getUserAgent(req) {
  return String(req.headers['user-agent'] || '').trim().slice(0, 255);
}

function getOtpDisplay(otpDigits) {
  const digits = String(otpDigits || '')
    .replace(/\D/g, '')
    .slice(0, 6);
  return `${OTP_PREFIX}-${digits}`;
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function buildEmailPhoneKey(email) {
  const digest = crypto.createHash('sha1').update(normalizeEmail(email)).digest('hex').slice(0, 24);
  return `EMAIL:${digest}`;
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

async function addColumnIfMissing(table, column, ddl) {
  if (!(await hasTableColumn(table, column))) {
    await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

async function ensurePasswordResetColumns() {
  await query(
    `CREATE TABLE IF NOT EXISTS password_reset_otps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone_key VARCHAR(32) NOT NULL,
      employee_id INT NOT NULL,
      user_id INT NULL,
      email VARCHAR(255) NULL,
      otp_hash VARCHAR(255) NOT NULL,
      purpose VARCHAR(50) NOT NULL DEFAULT 'forgot_password',
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      expires_at DATETIME NOT NULL,
      is_used TINYINT(1) NOT NULL DEFAULT 0,
      used_at DATETIME NULL,
      is_blocked TINYINT(1) NOT NULL DEFAULT 0,
      reset_token_hash CHAR(64) NULL,
      reset_token_expires_at DATETIME NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(255) NULL,
      consumed TINYINT(1) NOT NULL DEFAULT 0,
      provider VARCHAR(30) NULL,
      provider_session_id VARCHAR(180) NULL,
      sms_mobile VARCHAR(24) NULL,
      sent_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_phone_expires (phone_key, expires_at),
      INDEX idx_employee_created (employee_id, created_at),
      INDEX idx_email_created (email, created_at),
      INDEX idx_email_purpose (email, purpose, created_at),
      INDEX idx_user_created (user_id, created_at),
      INDEX idx_ip_created (ip_address, created_at),
      INDEX idx_reset_token (reset_token_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  const columns = [
    ['user_id', 'INT NULL'],
    ['email', 'VARCHAR(255) NULL'],
    ['purpose', "VARCHAR(50) NOT NULL DEFAULT 'forgot_password'"],
    ['max_attempts', 'INT NOT NULL DEFAULT 3'],
    ['is_used', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['used_at', 'DATETIME NULL'],
    ['is_blocked', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['reset_token_hash', 'CHAR(64) NULL'],
    ['reset_token_expires_at', 'DATETIME NULL'],
    ['ip_address', 'VARCHAR(64) NULL'],
    ['user_agent', 'VARCHAR(255) NULL'],
    ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
    ['consumed', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['provider', 'VARCHAR(30) NULL'],
    ['provider_session_id', 'VARCHAR(180) NULL'],
    ['sms_mobile', 'VARCHAR(24) NULL'],
    ['sent_at', 'DATETIME NULL'],
  ];

  for (const [column, ddl] of columns) {
    await addColumnIfMissing('password_reset_otps', column, ddl);
  }
}

async function findActiveEmployeeByEmail(email) {
  try {
    const rows = await query(
      'SELECT * FROM employees WHERE LOWER(email) = LOWER(?) AND status = ? LIMIT 1',
      [email, 'active']
    );
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && /status/i.test(String(err.message || ''))) {
      const rows = await query('SELECT * FROM employees WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
      const employee = Array.isArray(rows) ? rows[0] || null : null;
      if (!employee) return null;
      if (employee.status && String(employee.status).toLowerCase() !== 'active') return null;
      return employee;
    }
    throw err;
  }
}

async function findActiveCompanyByEmail(email) {
  try {
    const rows = await query(
      'SELECT * FROM companies WHERE LOWER(email) = LOWER(?) AND status = ? LIMIT 1',
      [email, 'active']
    );
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && /status/i.test(String(err.message || ''))) {
      const rows = await query('SELECT * FROM companies WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
      const company = Array.isArray(rows) ? rows[0] || null : null;
      if (!company) return null;
      if (company.status && String(company.status).toLowerCase() !== 'active') return null;
      return company;
    }
    throw err;
  }
}

async function findResettableAccountByEmail(email) {
  const employee = await findActiveEmployeeByEmail(email);
  if (employee) {
    return {
      type: 'employee',
      id: employee.id,
      email: employee.email,
      name: employee.name || employee.company_name || '',
    };
  }

  const company = await findActiveCompanyByEmail(email);
  if (company) {
    return {
      type: 'company',
      id: company.id,
      email: company.email,
      name: company.company_name || company.name || '',
    };
  }

  return null;
}

async function cleanupExpiredEmailRows(email) {
  await query(
    `UPDATE password_reset_otps
     SET is_blocked = 1,
         consumed = 1,
         reset_token_hash = NULL,
         reset_token_expires_at = NULL
     WHERE LOWER(email) = LOWER(?)
       AND purpose = ?
       AND (
         expires_at < NOW()
         OR (reset_token_expires_at IS NOT NULL AND reset_token_expires_at < NOW())
       )`,
    [email, PURPOSE]
  );
}

async function countEmailRequestsLastHour(email) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM password_reset_otps
     WHERE LOWER(email) = LOWER(?)
       AND purpose = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    [email, PURPOSE]
  );
  return Number(rows?.[0]?.count || 0);
}

async function getLatestActiveEmailRow(email) {
  const rows = await query(
    `SELECT *
     FROM password_reset_otps
     WHERE LOWER(email) = LOWER(?)
       AND purpose = ?
       AND is_blocked = 0
       AND is_used = 0
     ORDER BY id DESC
     LIMIT 1`,
    [email, PURPOSE]
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function blockOtherEmailRows(email, currentRowId) {
  await query(
    `UPDATE password_reset_otps
     SET is_blocked = 1,
         consumed = 1,
         reset_token_hash = NULL,
         reset_token_expires_at = NULL,
         updated_at = NOW()
     WHERE LOWER(email) = LOWER(?)
       AND purpose = ?
       AND id <> ?`,
    [email, PURPOSE, currentRowId]
  );
}

async function markRowSent(rowId) {
  await query(
    `UPDATE password_reset_otps
     SET sent_at = NOW(),
         updated_at = NOW()
     WHERE id = ?`,
    [rowId]
  );
}

async function invalidateAllRowsForEmail(email) {
  await query(
    `UPDATE password_reset_otps
     SET is_used = 1,
         is_blocked = 1,
         consumed = 1,
         reset_token_hash = NULL,
         reset_token_expires_at = NULL,
         updated_at = NOW()
     WHERE LOWER(email) = LOWER(?)
       AND purpose = ?`,
    [email, PURPOSE]
  );
}

async function updatePasswordByRecord(tableName, recordId, hashedPassword) {
  try {
    await query(
      `UPDATE ${tableName}
       SET password = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [hashedPassword, recordId]
    );
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && /updated_at/i.test(String(err.message || ''))) {
      await query(`UPDATE ${tableName} SET password = ? WHERE id = ?`, [hashedPassword, recordId]);
      return;
    }
    throw err;
  }
}

async function syncPasswordsForEmail(email, hashedPassword) {
  const employee = await findActiveEmployeeByEmail(email);
  if (employee) {
    await updatePasswordByRecord('employees', employee.id, hashedPassword);
  }

  const company = await findActiveCompanyByEmail(email);
  if (company) {
    await updatePasswordByRecord('companies', company.id, hashedPassword);
  }
}

function getGenericResetResponse(now = Date.now()) {
  return {
    ...GENERIC_RESPONSE,
    data: {
      expiresAt: new Date(now + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString(),
      resendAvailableAt: new Date(now + OTP_RESEND_COOLDOWN_SECONDS * 1000).toISOString(),
    },
  };
}

async function requestPasswordResetOtp(req, res) {
  try {
    await ensurePasswordResetColumns();
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }

    await cleanupExpiredEmailRows(email);
    const now = Date.now();
    const genericResponse = getGenericResetResponse(now);
    const account = await findResettableAccountByEmail(email);

    if (!account) {
      return res.status(400).json({
        success: false,
        message: 'This email address is not registered in the system.'
      });
    }

    const requestCount = await countEmailRequestsLastHour(email);
    if (requestCount >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
    }

    const latestRow = await getLatestActiveEmailRow(email);
    if (latestRow && latestRow.created_at) {
      const latestCreatedAt = new Date(latestRow.created_at).getTime();
      if (!Number.isNaN(latestCreatedAt) && now - latestCreatedAt < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        return res.json(genericResponse);
      }
    }

    const otpDigits = generateNumericOtp();
    const otpHash = await hashOtp(otpDigits);
    const expiresAt = new Date(now + OTP_EXPIRY_MINUTES * 60 * 1000);
    const phoneKey = buildEmailPhoneKey(email);
    const userAgent = getUserAgent(req);
    const ipAddress = getClientIp(req);

    const insertResult = await query(
      `INSERT INTO password_reset_otps
       (phone_key, employee_id, user_id, email, otp_hash, purpose, attempts, max_attempts, expires_at, is_used, used_at, is_blocked, reset_token_hash, reset_token_expires_at, ip_address, user_agent, consumed)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0, NULL, 0, NULL, NULL, ?, ?, 0)`,
      [
        phoneKey,
        account.id,
        account.id,
        email,
        otpHash,
        PURPOSE,
        OTP_MAX_ATTEMPTS,
        expiresAt,
        ipAddress,
        userAgent,
      ]
    );

    const rowId = insertResult?.insertId || null;
    const otpDisplay = getOtpDisplay(otpDigits);
    let emailDeliveryMode = 'smtp';

    try {
      const emailSendResult = await sendPasswordResetOtpEmail({
        toEmail: email,
        otpDisplay,
        expiryMinutes: OTP_EXPIRY_MINUTES,
      });
      emailDeliveryMode = String(emailSendResult?.deliveryMode || 'smtp').toLowerCase();
    } catch (emailErr) {
      if (rowId) {
        await query('DELETE FROM password_reset_otps WHERE id = ?', [rowId]);
      }
      if (/SMTP configuration is missing/i.test(String(emailErr?.message || ''))) {
        return res.status(503).json({
          success: false,
          message:
            'Email OTP service is not configured. Super Admin -> Global System Settings -> Email OTP section mein SMTP save karein ya backend-node/.env me SMTP_HOST/SMTP_USER/SMTP_PASS set karein.',
        });
      }
      throw emailErr;
    }

    if (rowId) {
      await blockOtherEmailRows(email, rowId);
      await markRowSent(rowId);
    }

    return res.json({
      ...GENERIC_RESPONSE,
      data: {
        expiresAt: expiresAt.toISOString(),
        resendAvailableAt: new Date(now + OTP_RESEND_COOLDOWN_SECONDS * 1000).toISOString(),
        deliveryMode: emailDeliveryMode,
        ...(emailDeliveryMode !== 'smtp' ? { debugOtp: otpDisplay } : {}),
      },
    });
  } catch (err) {
    console.error('requestPasswordResetOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Unable to send OTP right now.' });
  }
}

async function resendPasswordResetOtp(req, res) {
  return requestPasswordResetOtp(req, res);
}

async function verifyPasswordResetOtp(req, res) {
  try {
    await ensurePasswordResetColumns();
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || '')
      .replace(/\D/g, '')
      .slice(0, 6);

    if (!isValidEmail(email) || otp.length !== 6) {
      return res.status(400).json({ success: false, message: 'Enter a valid email and 6-digit OTP.' });
    }

    await cleanupExpiredEmailRows(email);
    const row = await getLatestActiveEmailRow(email);
    if (!row || !row.otp_hash || !row.expires_at) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const expiryMs = new Date(row.expires_at).getTime();
    if (!expiryMs || Date.now() > expiryMs) {
      await query('UPDATE password_reset_otps SET is_blocked = 1, consumed = 1, updated_at = NOW() WHERE id = ?', [row.id]);
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const maxAttempts = Math.max(1, Number(row.max_attempts || OTP_MAX_ATTEMPTS));
    const attempts = Number(row.attempts || 0);
    if (attempts >= maxAttempts) {
      await query('UPDATE password_reset_otps SET is_blocked = 1, consumed = 1, updated_at = NOW() WHERE id = ?', [row.id]);
      return res.status(400).json({ success: false, message: 'Too many invalid attempts. Request a new OTP.' });
    }

    const matched = await compareOtp(otp, row.otp_hash);
    if (!matched) {
      const nextAttempts = attempts + 1;
      const shouldBlock = nextAttempts >= maxAttempts ? 1 : 0;
      await query(
        `UPDATE password_reset_otps
         SET attempts = attempts + 1,
             is_blocked = CASE WHEN attempts + 1 >= max_attempts THEN 1 ELSE is_blocked END,
             consumed = CASE WHEN attempts + 1 >= max_attempts THEN 1 ELSE consumed END,
             updated_at = NOW()
         WHERE id = ?`,
        [row.id]
      );
      if (shouldBlock) {
        return res.status(400).json({ success: false, message: 'Too many invalid attempts. Request a new OTP.' });
      }
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = hashResetToken(resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await query(
      `UPDATE password_reset_otps
       SET is_used = 1,
           used_at = NOW(),
           consumed = 1,
           reset_token_hash = ?,
           reset_token_expires_at = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [resetTokenHash, resetTokenExpiresAt, row.id]
    );

    await query(
      `UPDATE password_reset_otps
       SET reset_token_hash = NULL,
           reset_token_expires_at = NULL,
           updated_at = NOW()
       WHERE LOWER(email) = LOWER(?)
         AND purpose = ?
         AND id <> ?`,
      [email, PURPOSE, row.id]
    );

    return res.json({
      success: true,
      message: 'OTP verified successfully.',
      resetToken,
      data: {
        resetToken,
        resetTokenExpiresAt: resetTokenExpiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('verifyPasswordResetOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Unable to verify OTP right now.' });
  }
}

async function resetPasswordWithVerifiedOtp(req, res) {
  try {
    await ensurePasswordResetColumns();
    const email = normalizeEmail(req.body?.email);
    const resetToken = String(req.body?.resetToken || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (!resetToken) {
      return res.status(400).json({ success: false, message: 'Reset token is required.' });
    }
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirm password are required.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (
      !validator.isStrongPassword(newPassword, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      })
    ) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
      });
    }

    const tokenHash = hashResetToken(resetToken);
    const rows = await query(
      `SELECT *
       FROM password_reset_otps
       WHERE LOWER(email) = LOWER(?)
         AND purpose = ?
         AND reset_token_hash = ?
         AND is_used = 1
         AND is_blocked = 0
       ORDER BY id DESC
       LIMIT 1`,
      [email, PURPOSE, tokenHash]
    );
    const row = Array.isArray(rows) ? rows[0] || null : null;
    if (!row) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset session. Start again.' });
    }

    const tokenExpiryMs = row.reset_token_expires_at ? new Date(row.reset_token_expires_at).getTime() : 0;
    if (!tokenExpiryMs || Date.now() > tokenExpiryMs) {
      await query(
        `UPDATE password_reset_otps
         SET is_blocked = 1,
             reset_token_hash = NULL,
             reset_token_expires_at = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [row.id]
      );
      return res.status(400).json({ success: false, message: 'Invalid or expired reset session. Start again.' });
    }

    const account = await findResettableAccountByEmail(email);
    if (!account) {
      return res.status(400).json({ success: false, message: 'Account not found or inactive.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await syncPasswordsForEmail(email, hashedPassword);

    await invalidateAllRowsForEmail(email);

    return res.json({
      success: true,
      message: 'Password reset successfully. Please login.',
    });
  } catch (err) {
    console.error('resetPasswordWithVerifiedOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Unable to reset password right now.' });
  }
}

module.exports = {
  ensurePasswordResetColumns,
  requestPasswordResetOtp,
  resendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithVerifiedOtp,
};
