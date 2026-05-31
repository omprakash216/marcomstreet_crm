const bcrypt = require('bcryptjs');
const { query } = require('../../config/database');
const { sendPasswordResetOtpEmail } = require('../../services/email/emailService');
const {
  generateNumericOtp,
  hashOtp,
  compareOtp,
  otpExpiryDate,
  cooldownDate,
} = require('../../utils/otp/otpUtils');

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_OTP_ATTEMPTS = Number(process.env.PASSWORD_RESET_MAX_OTP_ATTEMPTS || 5);

const FORGOT_GENERIC_RESPONSE = {
  success: true,
  message: 'If this email is registered, an OTP has been sent.',
};

function isDuplicateColumnError(err) {
  if (!err) return false;
  if (err.code === 'ER_DUP_FIELDNAME') return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('duplicate column');
}

async function ensurePasswordResetColumns() {
  const statements = [
    'ALTER TABLE employees ADD COLUMN otp VARCHAR(255) NULL',
    'ALTER TABLE employees ADD COLUMN otpExpiry DATETIME NULL',
    'ALTER TABLE employees ADD COLUMN otpAttempts INT NOT NULL DEFAULT 0',
    'ALTER TABLE employees ADD COLUMN resetVerified TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE employees ADD COLUMN resendCooldown DATETIME NULL',
    'ALTER TABLE employees ADD COLUMN tokenVersion INT NOT NULL DEFAULT 0',
  ];

  for (const sql of statements) {
    try {
      await query(sql);
    } catch (err) {
      if (!isDuplicateColumnError(err)) throw err;
    }
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

function isCooldownActive(employee) {
  const cooldown = employee?.resendCooldown ? new Date(employee.resendCooldown).getTime() : 0;
  return cooldown > Date.now();
}

async function updateOtpForEmployee(employeeId, otp) {
  const otpHash = await hashOtp(otp);
  const expiresAt = otpExpiryDate(OTP_EXPIRY_MINUTES);
  const resendAt = cooldownDate(RESEND_COOLDOWN_SECONDS);
  await query(
    'UPDATE employees SET otp = ?, otpExpiry = ?, otpAttempts = 0, resetVerified = 0, resendCooldown = ? WHERE id = ?',
    [otpHash, expiresAt, resendAt, employeeId]
  );
}

async function clearResetArtifacts(employeeId) {
  await query(
    'UPDATE employees SET otp = NULL, otpExpiry = NULL, otpAttempts = 0, resetVerified = 0, resendCooldown = NULL WHERE id = ?',
    [employeeId]
  );
}

async function requestPasswordResetOtp(req, res) {
  try {
    await ensurePasswordResetColumns();
    const email = req.body.email;
    const employee = await findActiveEmployeeByEmail(email);

    if (!employee) {
      return res.json(FORGOT_GENERIC_RESPONSE);
    }

    if (!isCooldownActive(employee)) {
      const otp = generateNumericOtp();
      await updateOtpForEmployee(employee.id, otp);
      try {
        await sendPasswordResetOtpEmail({ toEmail: employee.email, otp, expiryMinutes: OTP_EXPIRY_MINUTES });
      } catch (emailErr) {
        console.error('[password-reset-email] send failed:', emailErr.message);
      }
    }

    return res.json(FORGOT_GENERIC_RESPONSE);
  } catch (err) {
    console.error('requestPasswordResetOtp error:', err);
    return res.status(500).json({ success: false, message: 'Unable to process request right now.' });
  }
}

async function resendPasswordResetOtp(req, res) {
  try {
    await ensurePasswordResetColumns();
    const email = req.body.email;
    const employee = await findActiveEmployeeByEmail(email);

    if (!employee) {
      return res.json(FORGOT_GENERIC_RESPONSE);
    }

    if (isCooldownActive(employee)) {
      return res.json(FORGOT_GENERIC_RESPONSE);
    }

    const otp = generateNumericOtp();
    await updateOtpForEmployee(employee.id, otp);
    try {
      await sendPasswordResetOtpEmail({ toEmail: employee.email, otp, expiryMinutes: OTP_EXPIRY_MINUTES });
    } catch (emailErr) {
      console.error('[password-reset-email] resend failed:', emailErr.message);
    }

    return res.json(FORGOT_GENERIC_RESPONSE);
  } catch (err) {
    console.error('resendPasswordResetOtp error:', err);
    return res.status(500).json({ success: false, message: 'Unable to process request right now.' });
  }
}

async function verifyPasswordResetOtp(req, res) {
  try {
    await ensurePasswordResetColumns();
    const { email, otp } = req.body;
    const employee = await findActiveEmployeeByEmail(email);

    if (!employee || !employee.otp || !employee.otpExpiry) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const attempts = Number(employee.otpAttempts || 0);
    if (attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many invalid attempts. Request a new OTP.',
      });
    }

    const expiryMs = new Date(employee.otpExpiry).getTime();
    if (!expiryMs || Date.now() > expiryMs) {
      await clearResetArtifacts(employee.id);
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const otpMatched = await compareOtp(otp, employee.otp);
    if (!otpMatched) {
      await query('UPDATE employees SET otpAttempts = otpAttempts + 1 WHERE id = ?', [employee.id]);
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    await query(
      'UPDATE employees SET resetVerified = 1, otp = NULL, otpExpiry = NULL, otpAttempts = 0, resendCooldown = NULL WHERE id = ?',
      [employee.id]
    );

    return res.json({
      success: true,
      message: 'OTP verified successfully.',
    });
  } catch (err) {
    console.error('verifyPasswordResetOtp error:', err);
    return res.status(500).json({ success: false, message: 'Unable to verify OTP right now.' });
  }
}

async function resetPasswordWithVerifiedOtp(req, res) {
  try {
    await ensurePasswordResetColumns();
    const { email, newPassword } = req.body;
    const employee = await findActiveEmployeeByEmail(email);

    if (!employee || Number(employee.resetVerified || 0) !== 1) {
      return res.status(403).json({
        success: false,
        message: 'OTP verification required before password reset.',
      });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);

    try {
      await query(
        `UPDATE employees
         SET password = ?,
             otp = NULL,
             otpExpiry = NULL,
             otpAttempts = 0,
             resetVerified = 0,
             resendCooldown = NULL,
             tokenVersion = COALESCE(tokenVersion, 0) + 1,
             updated_at = NOW()
         WHERE id = ?`,
        [hashedPassword, employee.id]
      );
    } catch (err) {
      if (err && err.code === 'ER_BAD_FIELD_ERROR' && /updated_at/i.test(String(err.message || ''))) {
        await query(
          `UPDATE employees
           SET password = ?,
               otp = NULL,
               otpExpiry = NULL,
               otpAttempts = 0,
               resetVerified = 0,
               resendCooldown = NULL,
               tokenVersion = COALESCE(tokenVersion, 0) + 1
           WHERE id = ?`,
          [hashedPassword, employee.id]
        );
      } else {
        throw err;
      }
    }

    return res.json({
      success: true,
      message: 'Password reset successful. Please login with your new password.',
    });
  } catch (err) {
    console.error('resetPasswordWithVerifiedOtp error:', err);
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
