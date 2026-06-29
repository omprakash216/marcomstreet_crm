const nodemailer = require('nodemailer');
const { query } = require('../config/database');
const { getEmailConfig } = require('../config/emailConfig');

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
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

function resolveTransportConfig(cfg = {}) {
  const smtpHost = String(cfg.SMTP_HOST || '').trim();
  if (smtpHost) {
    const smtpUser = String(cfg.SMTP_USER || '').trim();
    const smtpPass = String(cfg.SMTP_PASS || '').trim();
    if ((smtpUser && !smtpPass) || (!smtpUser && smtpPass)) {
      throw new Error('SMTP_USER and SMTP_PASS must both be set when SMTP_HOST is configured.');
    }
    return {
      deliveryMode: 'smtp',
      host: smtpHost,
      port: Number(cfg.SMTP_PORT || 587),
      secure: toBool(cfg.SMTP_SECURE, false),
      ...(smtpUser && smtpPass ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
    };
  }

  const gmailUser = String(cfg.GMAIL_USER || '').trim();
  const gmailPass = String(cfg.GMAIL_PASS || '').trim();
  if (gmailUser && gmailPass) {
    return {
      deliveryMode: 'smtp',
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    };
  }

  const brevoUser = String(cfg.BREVO_SMTP_USER || '').trim();
  const brevoPass = String(cfg.BREVO_SMTP_PASS || '').trim();
  if (brevoUser && brevoPass && toBool(cfg.USE_BREVO_SMTP, false)) {
    return {
      deliveryMode: 'smtp',
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: brevoUser, pass: brevoPass },
    };
  }

  if (toBool(cfg.ALLOW_EMAIL_PREVIEW, false)) {
    if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production') {
      throw new Error('Preview email mode is disabled in production.');
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

function resolveFromAddress(cfg = {}) {
  const fromName = String(cfg.SMTP_FROM_NAME || cfg.EMAIL_FROM_NAME || cfg.APP_NAME || process.env.APP_NAME || 'Vanya Group').trim();
  const fromEmail = String(
    cfg.MAIL_FROM ||
    cfg.SMTP_FROM_EMAIL ||
    cfg.MAIL_FROM_EMAIL ||
    cfg.SMTP_USER ||
    cfg.GMAIL_USER ||
    cfg.BREVO_SMTP_USER ||
    ''
  ).trim();

  if (cfg.MAIL_FROM && String(cfg.MAIL_FROM).trim()) return String(cfg.MAIL_FROM).trim();
  if (fromName && fromEmail) return `${fromName} <${fromEmail}>`;
  if (fromEmail) return fromEmail;
  return cfg.SMTP_FROM || cfg.SMTP_USER || cfg.GMAIL_USER || cfg.BREVO_SMTP_USER || 'no-reply@example.com';
}

let cachedTransporter = null;
let cachedTransportSignature = '';
let cachedDeliveryMode = '';

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
  cachedTransportSignature = signature;
  cachedDeliveryMode = deliveryMode || 'smtp';
  cachedTransporter = nodemailer.createTransport(transportConfig);
  return {
    transporter: cachedTransporter,
    deliveryMode: cachedDeliveryMode,
  };
}

async function logEmailEvent(payload = {}) {
  try {
    await query(
      `INSERT INTO email_logs
       (company_id, module_type, entity_type, entity_id, recipient_email, subject, status, provider_message_id, error_message, sent_at)
       VALUES (?,?,?,?,?,?,?,?,?, NOW())`,
      [
        payload.company_id || null,
        payload.module_type || null,
        payload.entity_type || null,
        payload.entity_id || null,
        payload.recipient_email || null,
        payload.subject || null,
        payload.status || 'sent',
        payload.provider_message_id || null,
        payload.error_message || null,
      ]
    );
  } catch (_) {
    // Best effort only. Email sending should not fail because logging is unavailable.
  }
}

async function sendSalesDocumentEmail({
  companyId = null,
  moduleType = 'sales',
  entityType = 'document',
  entityId = null,
  to,
  subject,
  text,
  html,
  attachments = [],
}) {
  const recipient = String(to || '').trim();
  if (!recipient) {
    throw new Error('Recipient email is required.');
  }

  const cfg = await getEmailConfig();
  if (toBool(cfg.DISABLE_EMAIL_SENDING, false)) {
    await logEmailEvent({
      company_id: companyId,
      module_type: moduleType,
      entity_type: entityType,
      entity_id: entityId,
      recipient_email: recipient,
      subject,
      status: 'disabled',
      provider_message_id: 'disabled-mode',
    });
    return { messageId: 'disabled-mode', deliveryMode: 'disabled' };
  }

  const { transporter, deliveryMode } = getTransporter(cfg);
  const info = await transporter.sendMail({
    from: resolveFromAddress(cfg),
    to: recipient,
    subject,
    text,
    html,
    attachments,
  });

  if (Array.isArray(info.rejected) && info.rejected.length) {
    await logEmailEvent({
      company_id: companyId,
      module_type: moduleType,
      entity_type: entityType,
      entity_id: entityId,
      recipient_email: recipient,
      subject,
      status: 'failed',
      error_message: `SMTP rejected recipient(s): ${info.rejected.join(', ')}`,
    });
    throw new Error(`SMTP rejected recipient(s): ${info.rejected.join(', ')}`);
  }

  await logEmailEvent({
    company_id: companyId,
    module_type: moduleType,
    entity_type: entityType,
    entity_id: entityId,
    recipient_email: recipient,
    subject,
    status: 'sent',
    provider_message_id: info.messageId || info?.response || null,
  });

  return {
    ...info,
    deliveryMode,
  };
}

module.exports = {
  sendSalesDocumentEmail,
};
