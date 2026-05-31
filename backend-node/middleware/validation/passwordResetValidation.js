const { sanitizeOtp } = require('../../utils/otp/otpUtils');

const rateStore = new Map();

function getClientIp(req) {
  const headerIp = req.headers['x-forwarded-for'];
  if (headerIp) return String(headerIp).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function sanitizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  const value = String(password || '');
  if (value.length < 8) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/\d/.test(value)) return false;
  if (!/[^A-Za-z0-9]/.test(value)) return false;
  return true;
}

function cleanupExpiredRateEntries(now) {
  for (const [key, entry] of rateStore.entries()) {
    if (!entry || entry.expiresAt <= now) {
      rateStore.delete(key);
    }
  }
}

function buildRateLimiter({ keyPrefix, windowMs, maxRequests }) {
  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredRateEntries(now);

    const email = sanitizeEmail(req.body?.email);
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}:${email || 'no-email'}`;
    const existing = rateStore.get(key);

    if (!existing || existing.expiresAt <= now) {
      rateStore.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (existing.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
    }

    existing.count += 1;
    rateStore.set(key, existing);
    return next();
  };
}

function validateForgotPasswordRequest(req, res, next) {
  const email = sanitizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  }
  req.body.email = email;
  return next();
}

function validateVerifyOtpRequest(req, res, next) {
  const email = sanitizeEmail(req.body?.email);
  const otp = sanitizeOtp(req.body?.otp);
  if (!isValidEmail(email) || otp.length !== 6) {
    return res.status(400).json({ success: false, message: 'Enter valid email and 6-digit OTP.' });
  }
  req.body.email = email;
  req.body.otp = otp;
  return next();
}

function validateResetPasswordRequest(req, res, next) {
  const email = sanitizeEmail(req.body?.email);
  const newPassword = String(req.body?.newPassword || '');
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message:
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
    });
  }
  req.body.email = email;
  req.body.newPassword = newPassword;
  return next();
}

const forgotPasswordRateLimit = buildRateLimiter({
  keyPrefix: 'forgot-password-email-request',
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
});

const resendOtpRateLimit = buildRateLimiter({
  keyPrefix: 'forgot-password-email-resend',
  windowMs: 15 * 60 * 1000,
  maxRequests: 6,
});

const verifyOtpRateLimit = buildRateLimiter({
  keyPrefix: 'forgot-password-email-verify',
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
});

const resetPasswordRateLimit = buildRateLimiter({
  keyPrefix: 'forgot-password-email-reset',
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
});

module.exports = {
  validateForgotPasswordRequest,
  validateVerifyOtpRequest,
  validateResetPasswordRequest,
  forgotPasswordRateLimit,
  resendOtpRateLimit,
  verifyOtpRateLimit,
  resetPasswordRateLimit,
  sanitizeEmail,
  isValidEmail,
};
