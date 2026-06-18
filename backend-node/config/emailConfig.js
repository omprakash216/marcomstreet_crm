const dotenv = require('dotenv');
const { query } = require('./database');
const { envPath } = require('./env');
const { ensureGlobalSettingsTable, decryptSecret, encryptSecret, maskSecret } = require('./smsConfig');

const DB_KEY_ALIASES = {
  SMTP_HOST: ['smtp_host', 'smtp_gateway', 'smtp_server'],
  SMTP_PORT: ['smtp_port'],
  SMTP_SECURE: ['smtp_secure'],
  SMTP_USER: ['smtp_user', 'smtp_username', 'email_user'],
  SMTP_PASS: ['smtp_pass', 'smtp_password', 'email_password'],
  SMTP_FROM_NAME: ['smtp_from_name', 'email_from_name'],
  SMTP_FROM_EMAIL: ['smtp_from_email', 'email_from_email'],
  MAIL_FROM_EMAIL: ['mail_from_email'],
  MAIL_FROM: ['mail_from', 'mail_from_address'],
  PASSWORD_RESET_BRAND_NAME: ['password_reset_brand_name'],
  ALLOW_EMAIL_PREVIEW: ['allow_email_preview'],
  DISABLE_EMAIL_SENDING: ['disable_email_sending'],
  GMAIL_USER: ['gmail_user'],
  GMAIL_PASS: ['gmail_pass'],
  BREVO_SMTP_USER: ['brevo_smtp_user'],
  BREVO_SMTP_PASS: ['brevo_smtp_pass'],
  USE_BREVO_SMTP: ['use_brevo_smtp'],
  EMAIL_FROM_NAME: ['email_from_name'],
};

const ENV_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM_NAME',
  'SMTP_FROM_EMAIL',
  'MAIL_FROM_EMAIL',
  'MAIL_FROM',
  'PASSWORD_RESET_BRAND_NAME',
  'ALLOW_EMAIL_PREVIEW',
  'DISABLE_EMAIL_SENDING',
  'GMAIL_USER',
  'GMAIL_PASS',
  'BREVO_SMTP_USER',
  'BREVO_SMTP_PASS',
  'USE_BREVO_SMTP',
  'EMAIL_FROM_NAME',
  'APP_NAME',
];

let cache = null;
let cacheAt = 0;
const TTL_MS = 15000;

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function readEnvConfig() {
  const cfg = {};
  for (const key of ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      cfg[key] = String(value).trim();
    }
  }
  return cfg;
}

function applyConfigToProcessEnv(cfg) {
  for (const [key, value] of Object.entries(cfg || {})) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      process.env[key] = String(value).trim();
    }
  }
}

function normalizePort(value, fallback = 587) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeHost(value) {
  const host = normalizeText(value);
  if (!host) return '';
  const placeholderHosts = new Set([
    'smtp.marcomstreet.com',
    'smtp.domain.com',
    'smtp.example.com',
  ]);
  if (placeholderHosts.has(host.toLowerCase())) return '';
  return host;
}

function applyDefaults(cfg) {
  const out = { ...cfg };
  out.SMTP_HOST = normalizeHost(out.SMTP_HOST);
  out.SMTP_PORT = String(normalizePort(out.SMTP_PORT, 587));
  out.SMTP_SECURE = toBool(out.SMTP_SECURE, false) ? 'true' : 'false';
  out.ALLOW_EMAIL_PREVIEW = toBool(out.ALLOW_EMAIL_PREVIEW, false) ? 'true' : 'false';
  out.DISABLE_EMAIL_SENDING = toBool(out.DISABLE_EMAIL_SENDING, false) ? 'true' : 'false';
  out.SMTP_FROM_NAME = normalizeText(out.SMTP_FROM_NAME || out.EMAIL_FROM_NAME || out.APP_NAME || 'Vanya Group');
  out.PASSWORD_RESET_BRAND_NAME = normalizeText(out.PASSWORD_RESET_BRAND_NAME || out.APP_NAME || 'Vanya Group');
  return out;
}

async function loadGlobalSettingsRows() {
  await ensureGlobalSettingsTable();
  const keys = Array.from(new Set(Object.values(DB_KEY_ALIASES).flat()));
  const placeholders = keys.map(() => '?').join(',');
  const rows = await query(
    `SELECT setting_key, setting_value
     FROM global_settings
     WHERE setting_key IN (${placeholders})`,
    keys
  );
  return Array.isArray(rows) ? rows : [];
}

function mergeDbRows(cfg, rows) {
  const out = { ...cfg };
  const map = {};

  for (const row of rows || []) {
    const key = String(row?.setting_key || '').trim().toLowerCase();
    let value = row?.setting_value != null ? String(row.setting_value).trim() : '';
    if (!key || value === '') continue;
    if (key === 'smtp_pass' || key === 'gmail_pass' || key === 'brevo_smtp_pass') {
      value = decryptSecret(value);
    }
    map[key] = value;
  }

  for (const [envKey, aliases] of Object.entries(DB_KEY_ALIASES)) {
    for (const dbKey of aliases) {
      if (map[dbKey] !== undefined && map[dbKey] !== '') {
        out[envKey] = map[dbKey];
        break;
      }
    }
  }

  return out;
}

async function refreshEmailConfig() {
  try {
    dotenv.config({ path: envPath, override: true });
  } catch (envErr) {
    console.warn('[email-config] Failed to reload .env from disk:', envErr.message);
  }
  let cfg = readEnvConfig();

  try {
    const rows = await loadGlobalSettingsRows();
    cfg = mergeDbRows(cfg, rows);
  } catch (err) {
    console.warn('[email-config] global_settings load skipped:', err.message);
  }

  cfg = applyDefaults(cfg);
  applyConfigToProcessEnv(cfg);
  cache = cfg;
  cacheAt = Date.now();
  return cfg;
}

async function getEmailConfig() {
  if (!cache || Date.now() - cacheAt > TTL_MS) {
    return refreshEmailConfig();
  }
  return cache;
}

function getConfiguredProvider(c) {
  const cfg = applyDefaults(c || cache || readEnvConfig());
  if (cfg.SMTP_HOST) return 'smtp';
  if (cfg.USE_BREVO_SMTP && (cfg.BREVO_SMTP_USER || cfg.BREVO_SMTP_PASS)) return 'brevo';
  if (cfg.GMAIL_USER || cfg.GMAIL_PASS) return 'gmail';
  return '';
}

function getEmailConfigFieldErrors(cfg) {
  const c = applyDefaults(cfg || cache || readEnvConfig());
  const errors = {};
  const provider = getConfiguredProvider(c);
  const previewEnabled = toBool(c.ALLOW_EMAIL_PREVIEW, false);
  const sendingDisabled = toBool(c.DISABLE_EMAIL_SENDING, false);
  const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

  if (sendingDisabled) {
    return errors;
  }

  if (previewEnabled) {
    if (isProduction) {
      errors.allow_email_preview = 'Preview email mode is disabled in production.';
    }
    return errors;
  }

  if (provider === 'smtp') {
    if (!c.SMTP_HOST) errors.smtp_host = 'SMTP host required hai.';
    if ((c.SMTP_USER && !c.SMTP_PASS) || (!c.SMTP_USER && c.SMTP_PASS)) {
      errors.smtp_user = 'SMTP user aur password dono required hain.';
      errors.smtp_pass = 'SMTP user aur password dono required hain.';
    }
  } else if (provider === 'gmail') {
    if (!c.GMAIL_USER) errors.gmail_user = 'Gmail user required hai.';
    if (!c.GMAIL_PASS) errors.gmail_pass = 'Gmail app password required hai.';
  } else if (provider === 'brevo') {
    if (!c.BREVO_SMTP_USER) errors.brevo_smtp_user = 'Brevo SMTP user required hai.';
    if (!c.BREVO_SMTP_PASS) errors.brevo_smtp_pass = 'Brevo SMTP password required hai.';
  } else {
    errors.smtp_host = 'SMTP host required hai.';
  }

  return errors;
}

function getPublicEmailStatus(cfg) {
  const c = applyDefaults(cfg || cache || readEnvConfig());
  const provider = getConfiguredProvider(c) || null;
  const errors = getEmailConfigFieldErrors(c);
  const sendingDisabled = toBool(c.DISABLE_EMAIL_SENDING, false);
  const previewEnabled = toBool(c.ALLOW_EMAIL_PREVIEW, false);
  const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

  let deliveryMode = 'smtp';
  if (sendingDisabled) deliveryMode = 'disabled';
  else if (previewEnabled && !isProduction) deliveryMode = 'preview';
  else if (previewEnabled && isProduction) deliveryMode = 'preview-blocked';

  return {
    emailConfigured: Object.keys(errors).length === 0,
    provider,
    deliveryMode,
    smtpHostSet: !!c.SMTP_HOST,
    smtpPort: normalizePort(c.SMTP_PORT, 587),
    smtpSecure: toBool(c.SMTP_SECURE, false),
    smtpUserSet: !!c.SMTP_USER,
    smtpPassSet: !!c.SMTP_PASS,
    smtpFromName: c.SMTP_FROM_NAME || '',
    smtpFromEmail: c.SMTP_FROM_EMAIL || '',
    mailFrom: c.MAIL_FROM || '',
    passwordResetBrandName: c.PASSWORD_RESET_BRAND_NAME || '',
    allowEmailPreview: previewEnabled,
    disableEmailSending: sendingDisabled,
    gmailUserSet: !!c.GMAIL_USER,
    gmailPassSet: !!c.GMAIL_PASS,
    brevoUserSet: !!c.BREVO_SMTP_USER,
    brevoPassSet: !!c.BREVO_SMTP_PASS,
    smtpHostMasked: maskSecret(c.SMTP_HOST || ''),
    errors,
  };
}

function encryptEmailSecret(value) {
  return encryptSecret(value);
}

module.exports = {
  getEmailConfig,
  refreshEmailConfig,
  getConfiguredProvider,
  getEmailConfigFieldErrors,
  getPublicEmailStatus,
  encryptEmailSecret,
  normalizeEmailHost: normalizeHost,
};
