const nodemailer = require('nodemailer');
const { buildPasswordResetOtpTemplate } = require('../../templates/email/passwordResetOtpTemplate');
const { getEmailConfig } = require('../../config/emailConfig');

let cachedTransporter = null;
let cachedDeliveryMode = null;
let cachedTransportSignature = '';

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function resolveTransportConfig(cfg = {}) {
  const host = String(cfg.SMTP_HOST || '').trim();
  if (host) {
    const smtpUser = String(cfg.SMTP_USER || '').trim();
    const smtpPass = String(cfg.SMTP_PASS || '').trim();
    if ((smtpUser && !smtpPass) || (!smtpUser && smtpPass)) {
      throw new Error('SMTP_USER and SMTP_PASS must both be set when SMTP_HOST is configured.');
    }
    return {
      deliveryMode: 'smtp',
      host,
      port: Number(cfg.SMTP_PORT || 587),
      secure: toBool(cfg.SMTP_SECURE, false),
      ...(smtpUser && smtpPass ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
    };
  }

  const brevoUser = String(cfg.BREVO_SMTP_USER || cfg.SMTP_USER || '').trim();
  const brevoPass = String(cfg.BREVO_SMTP_PASS || cfg.SMTP_PASS || '').trim();
  if ((brevoUser && !brevoPass) || (!brevoUser && brevoPass)) {
    throw new Error('Brevo SMTP user and password must both be set.');
  }
  if (brevoUser && brevoPass && toBool(cfg.USE_BREVO_SMTP, false)) {
    return {
      deliveryMode: 'smtp',
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: brevoUser, pass: brevoPass },
    };
  }

  const gmailUser = String(cfg.GMAIL_USER || cfg.SMTP_USER || '').trim();
  const gmailPass = String(cfg.GMAIL_PASS || cfg.SMTP_PASS || '').trim();
  if ((gmailUser && !gmailPass) || (!gmailUser && gmailPass)) {
    throw new Error('Gmail user and app password must both be set.');
  }
  if (gmailUser && gmailPass) {
    return {
      deliveryMode: 'smtp',
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    };
  }

  const allowPreview = toBool(cfg.ALLOW_EMAIL_PREVIEW, false);
  if (allowPreview) {
    if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production') {
      throw new Error('Preview email mode is disabled in production. Configure SMTP_HOST/SMTP_USER/SMTP_PASS.');
    }
    return {
      deliveryMode: 'preview',
      streamTransport: true,
      buffer: true,
      newline: 'unix',
    };
  }

  throw new Error('SMTP configuration is missing. Set SMTP_HOST/SMTP_USER/SMTP_PASS or Gmail/Brevo credentials.');
}

function buildTransportSignature(cfg = {}) {
  return [
    cfg.SMTP_HOST || '',
    cfg.SMTP_PORT || '',
    cfg.SMTP_SECURE || '',
    cfg.SMTP_USER || '',
    cfg.SMTP_PASS || '',
    cfg.GMAIL_USER || '',
    cfg.GMAIL_PASS || '',
    cfg.BREVO_SMTP_USER || '',
    cfg.BREVO_SMTP_PASS || '',
    cfg.USE_BREVO_SMTP || '',
    cfg.ALLOW_EMAIL_PREVIEW || '',
    cfg.DISABLE_EMAIL_SENDING || '',
  ].join('|');
}

function getTransporter(cfg = {}) {
  const signature = buildTransportSignature(cfg);
  if (cachedTransporter && cachedTransportSignature === signature) {
    return {
      transporter: cachedTransporter,
      deliveryMode: cachedDeliveryMode || 'smtp',
    };
  }

  const transportCfg = resolveTransportConfig(cfg);
  const { deliveryMode, ...transportConfig } = transportCfg;
  cachedDeliveryMode = deliveryMode || 'smtp';
  cachedTransportSignature = signature;
  cachedTransporter = nodemailer.createTransport(transportConfig);
  return {
    transporter: cachedTransporter,
    deliveryMode: cachedDeliveryMode,
  };
}

function resolveFromAddress(cfg = {}) {
  const fromName = String(cfg.SMTP_FROM_NAME || cfg.EMAIL_FROM_NAME || cfg.APP_NAME || process.env.APP_NAME || 'Vanya Group')
    .trim();
  const fromEmail = String(
    cfg.MAIL_FROM ||
      cfg.SMTP_FROM_EMAIL ||
      cfg.MAIL_FROM_EMAIL ||
      cfg.SMTP_USER ||
      cfg.GMAIL_USER ||
      cfg.BREVO_SMTP_USER ||
      ''
  ).trim();

  if (cfg.MAIL_FROM && String(cfg.MAIL_FROM).trim()) {
    return String(cfg.MAIL_FROM).trim();
  }
  if (fromName && fromEmail) {
    return `${fromName} <${fromEmail}>`;
  }
  if (fromEmail) {
    return fromEmail;
  }
  return (
    cfg.SMTP_FROM ||
    cfg.SMTP_USER ||
    cfg.GMAIL_USER ||
    cfg.BREVO_SMTP_USER ||
    'no-reply@example.com'
  );
}

async function sendPasswordResetOtpEmail({ toEmail, otpDisplay, expiryMinutes = 5 }) {
  const cfg = await getEmailConfig();
  const brandName = String(cfg.PASSWORD_RESET_BRAND_NAME || process.env.PASSWORD_RESET_BRAND_NAME || 'Vanya Group').trim() || 'Vanya Group';
  const { subject, text, html } = buildPasswordResetOtpTemplate({
    brandName,
    otpDisplay,
    expiryMinutes,
    logoUrl: cfg.PASSWORD_RESET_LOGO_URL || cfg.EMAIL_OTP_LOGO_URL || process.env.PASSWORD_RESET_LOGO_URL || process.env.EMAIL_OTP_LOGO_URL || '',
  });

  if (toBool(cfg.DISABLE_EMAIL_SENDING, false)) {
    console.log(`[password-reset-email] Sending disabled. Email skipped for ${toEmail}`);
    return { messageId: 'disabled-mode', deliveryMode: 'disabled' };
  }

  const { transporter, deliveryMode } = getTransporter(cfg);
  const info = await transporter.sendMail({
    from: resolveFromAddress(cfg),
    to: toEmail,
    subject,
    text,
    html,
  });

  if (Array.isArray(info.rejected) && info.rejected.length) {
    throw new Error(`SMTP rejected recipient(s): ${info.rejected.join(', ')}`);
  }

  if (deliveryMode !== 'smtp') {
    const previewMessage = Buffer.isBuffer(info.message)
      ? info.message.toString('utf8')
      : String(info.message || '');
    console.log(
      `[password-reset-email] ${deliveryMode} transport active for ${toEmail}. Email was not delivered through SMTP.`
    );
    if (previewMessage) {
      console.log(previewMessage);
    }
  }

  return {
    ...info,
    deliveryMode,
  };
}

module.exports = {
  sendPasswordResetOtpEmail,
};
