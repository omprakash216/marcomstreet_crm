const nodemailer = require('nodemailer');
const { buildPasswordResetOtpTemplate } = require('../../templates/email/passwordResetOtpTemplate');

let cachedTransporter = null;

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function resolveTransportConfig() {
  const host = process.env.SMTP_HOST;
  if (host) {
    return {
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: toBool(process.env.SMTP_SECURE, false),
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    };
  }

  const brevoUser = process.env.BREVO_SMTP_USER || process.env.SMTP_USER || '';
  const brevoPass = process.env.BREVO_SMTP_PASS || process.env.SMTP_PASS || '';
  if (brevoUser && brevoPass && toBool(process.env.USE_BREVO_SMTP, false)) {
    return {
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: brevoUser, pass: brevoPass },
    };
  }

  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER || '';
  const gmailPass = process.env.GMAIL_PASS || process.env.SMTP_PASS || '';
  if (gmailUser && gmailPass) {
    return {
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    };
  }

  throw new Error('SMTP configuration is missing. Set SMTP_HOST/SMTP_USER/SMTP_PASS or Gmail/Brevo credentials.');
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const cfg = resolveTransportConfig();
  cachedTransporter = nodemailer.createTransport(cfg);
  return cachedTransporter;
}

function resolveFromAddress() {
  return (
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    process.env.GMAIL_USER ||
    process.env.BREVO_SMTP_USER ||
    'no-reply@example.com'
  );
}

async function sendPasswordResetOtpEmail({ toEmail, otp, expiryMinutes = 5 }) {
  const appName = process.env.APP_NAME || 'MARCOM STREET CRM';
  const { subject, text, html } = buildPasswordResetOtpTemplate({
    appName,
    otp,
    expiryMinutes,
  });

  if (toBool(process.env.DISABLE_EMAIL_SENDING, false)) {
    console.log(`[password-reset-email] Sending disabled. OTP for ${toEmail}: ${otp}`);
    return { messageId: 'disabled-mode' };
  }

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: resolveFromAddress(),
    to: toEmail,
    subject,
    text,
    html,
  });
  return info;
}

module.exports = {
  sendPasswordResetOtpEmail,
};
