const rateLimit = require('express-rate-limit');
const validator = require('validator');
const { sanitizeOtp } = require('../../utils/otp/otpUtils');

function getClientIp(req) {
  const headerIp = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  if (headerIp) return headerIp;
  return String(req.ip || req.connection?.remoteAddress || 'unknown').trim();
}

function sanitizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizePhone(value) {
  return String(value || '').trim();
}

function isValidEmail(email) {
  return validator.isEmail(String(email || '').trim());
}

function isStrongPassword(password) {
  return validator.isStrongPassword(String(password || ''), {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  });
}

function createRateLimit({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => getClientIp(req),
    message: {
      success: false,
      message,
    },
    handler: (req, res, _next, options) => {
      res.status(options.statusCode).json(options.message);
    },
  });
}

function validateForgotPasswordRequest(req, res, next) {
  const email = sanitizeEmail(req.body?.email);
  const phone = sanitizePhone(req.body?.phone);

  if (email) {
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    req.body.email = email;
    return next();
  }

  if (phone) {
    req.body.phone = phone;
    return next();
  }

  return res.status(400).json({ success: false, message: 'Email or phone number is required.' });
}

function validateVerifyOtpRequest(req, res, next) {
  const email = sanitizeEmail(req.body?.email);
  const phone = sanitizePhone(req.body?.phone);
  const otp = sanitizeOtp(req.body?.otp);

  if (email) {
    if (!isValidEmail(email) || otp.length !== 6) {
      return res.status(400).json({ success: false, message: 'Enter a valid email and 6-digit OTP.' });
    }
    req.body.email = email;
    req.body.otp = otp;
    return next();
  }

  if (phone) {
    if (otp.length !== 6) {
      return res.status(400).json({ success: false, message: 'Enter a valid phone number and 6-digit OTP.' });
    }
    req.body.phone = phone;
    req.body.otp = otp;
    return next();
  }

  return res.status(400).json({ success: false, message: 'Email or phone number is required.' });
}

function validateResetPasswordRequest(req, res, next) {
  const email = sanitizeEmail(req.body?.email);
  const phone = sanitizePhone(req.body?.phone);
  const resetToken = String(req.body?.resetToken || '').trim();
  const newPassword = String(req.body?.newPassword || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (email) {
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (!resetToken) {
      return res.status(400).json({ success: false, message: 'Reset token is required.' });
    }
    if (!confirmPassword) {
      return res.status(400).json({ success: false, message: 'Confirm password is required.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
      });
    }
    req.body.email = email;
    req.body.resetToken = resetToken;
    req.body.newPassword = newPassword;
    req.body.confirmPassword = confirmPassword;
    return next();
  }

  if (phone) {
    if (!resetToken) {
      return res.status(400).json({ success: false, message: 'Reset token is required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    req.body.phone = phone;
    req.body.resetToken = resetToken;
    req.body.newPassword = newPassword;
    return next();
  }

  if (resetToken) {
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    req.body.resetToken = resetToken;
    req.body.newPassword = newPassword;
    return next();
  }

  return res.status(400).json({ success: false, message: 'Email, phone number, or reset token is required.' });
}

const forgotPasswordRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many OTP requests. Please try again later.',
});

const resendOtpRateLimit = forgotPasswordRateLimit;

const verifyOtpRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many OTP verification attempts. Please try again later.',
});

const resetPasswordRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: 'Too many password reset attempts. Please try again later.',
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
