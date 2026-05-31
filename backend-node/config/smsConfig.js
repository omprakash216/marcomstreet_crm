const { query } = require('./database');

/** global_settings key -> env-style key */
const DB_KEY_MAP = {
  msg91_auth_key: 'MSG91_AUTH_KEY',
  msg91_sender_id: 'MSG91_SENDER_ID',
  msg91_template_id: 'MSG91_TEMPLATE_ID',
  msg91_route: 'MSG91_ROUTE',
  fast2sms_api_key: 'FAST2SMS_API_KEY',
  two_factor_api_key: 'TWO_FACTOR_API_KEY',
  twilio_account_sid: 'TWILIO_ACCOUNT_SID',
  twilio_auth_token: 'TWILIO_AUTH_TOKEN',
  twilio_from_number: 'TWILIO_FROM_NUMBER',
  otp_prefix: 'OTP_PREFIX',
  sms_provider: 'SMS_PROVIDER',
};

/**
 * Backward-compatible aliases from older schema or manual DB entries.
 * Each env key can be sourced from any of these DB keys.
 */
const DB_KEY_ALIASES = {
  MSG91_AUTH_KEY: ['msg91_auth_key', 'msg91_api_key', 'msg91_key', 'msg91_authkey'],
  MSG91_SENDER_ID: ['msg91_sender_id', 'sms_sender_id', 'sender_id'],
  MSG91_TEMPLATE_ID: ['msg91_template_id', 'msg91_dlt_template_id'],
  MSG91_ROUTE: ['msg91_route'],
  FAST2SMS_API_KEY: ['fast2sms_api_key'],
  TWO_FACTOR_API_KEY: ['two_factor_api_key', '2factor_api_key', 'twofactor_api_key'],
  TWILIO_ACCOUNT_SID: ['twilio_account_sid'],
  TWILIO_AUTH_TOKEN: ['twilio_auth_token'],
  TWILIO_FROM_NUMBER: ['twilio_from_number'],
  OTP_PREFIX: ['otp_prefix', 'sms_otp_prefix'],
  SMS_PROVIDER: ['sms_provider'],
};

const ALL_DB_KEYS = Array.from(
  new Set([...Object.keys(DB_KEY_MAP), ...Object.values(DB_KEY_ALIASES).flat()])
);

const ENV_KEYS = [
  'MSG91_AUTH_KEY',
  'MSG91_SENDER_ID',
  'MSG91_TEMPLATE_ID',
  'MSG91_ROUTE',
  'FAST2SMS_API_KEY',
  'TWO_FACTOR_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM_NUMBER',
  'OTP_PREFIX',
  'DEFAULT_PHONE_COUNTRY_CODE',
  'APP_NAME',
  'SMS_PROVIDER',
];

let cache = null;
let cacheAt = 0;
const TTL_MS = 15000;

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
  for (const [key, value] of Object.entries(cfg)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      process.env[key] = String(value).trim();
    }
  }
}

async function ensureGlobalSettingsTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS global_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(120) NOT NULL UNIQUE,
      setting_value TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

function normalizeProvider(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (!value) return '';
  if (value === '2factor' || value === 'twofactor') return '2factor';
  if (value === 'msg91') return 'msg91';
  if (value === 'fast2sms') return 'fast2sms';
  if (value === 'twilio') return 'twilio';
  return value;
}

function applyDefaultSmsConfig(cfg) {
  const out = { ...cfg };
  if (!out.OTP_PREFIX) out.OTP_PREFIX = 'VG';
  if (!out.MSG91_SENDER_ID) out.MSG91_SENDER_ID = out.OTP_PREFIX;
  if (!out.MSG91_ROUTE) out.MSG91_ROUTE = '4';
  if (out.SMS_PROVIDER) out.SMS_PROVIDER = normalizeProvider(out.SMS_PROVIDER);
  return out;
}

function mergeDbRows(cfg, rows) {
  const out = { ...cfg };
  const map = {};
  for (const row of rows || []) {
    const key = String(row?.setting_key || '').trim().toLowerCase();
    const value = row?.setting_value != null ? String(row.setting_value).trim() : '';
    if (!key || !value) continue;
    map[key] = value;
  }

  for (const [envKey, aliases] of Object.entries(DB_KEY_ALIASES)) {
    for (const dbKey of aliases) {
      if (map[dbKey]) {
        out[envKey] = map[dbKey];
        break;
      }
    }
  }

  for (const [dbKey, envKey] of Object.entries(DB_KEY_MAP)) {
    if (!out[envKey] && map[dbKey]) {
      out[envKey] = map[dbKey];
    }
  }

  return out;
}

async function refreshSmsConfig() {
  let cfg = readEnvConfig();
  try {
    await ensureGlobalSettingsTable();
    const rows = await query(
      `SELECT setting_key, setting_value FROM global_settings WHERE setting_key IN (${ALL_DB_KEYS
        .map(() => '?')
        .join(',')})`,
      ALL_DB_KEYS
    );
    cfg = mergeDbRows(cfg, rows);
  } catch (err) {
    console.warn('[sms-config] global_settings load skipped:', err.message);
  }

  cfg = applyDefaultSmsConfig(cfg);
  applyConfigToProcessEnv(cfg);
  cache = cfg;
  cacheAt = Date.now();
  return cfg;
}

async function getSmsConfig() {
  if (!cache || Date.now() - cacheAt > TTL_MS) {
    await refreshSmsConfig();
  }
  return cache || applyDefaultSmsConfig(readEnvConfig());
}

function isSmsConfiguredSync(cfg) {
  const c = cfg || cache || applyDefaultSmsConfig(readEnvConfig());
  return !!(
    c.MSG91_AUTH_KEY ||
    c.FAST2SMS_API_KEY ||
    c.TWO_FACTOR_API_KEY ||
    (c.TWILIO_ACCOUNT_SID && c.TWILIO_AUTH_TOKEN && c.TWILIO_FROM_NUMBER)
  );
}

function maskSecret(value) {
  const raw = String(value || '');
  if (!raw) return '';
  if (raw.length <= 8) return '********';
  return `${'*'.repeat(Math.min(raw.length - 4, 12))}${raw.slice(-4)}`;
}

function getPublicSmsStatus(cfg) {
  const c = cfg || cache || applyDefaultSmsConfig(readEnvConfig());
  const provider =
    normalizeProvider(c.SMS_PROVIDER) ||
    (c.MSG91_AUTH_KEY
      ? 'msg91'
      : c.TWO_FACTOR_API_KEY
        ? '2factor'
        : c.FAST2SMS_API_KEY
          ? 'fast2sms'
          : c.TWILIO_ACCOUNT_SID
            ? 'twilio'
            : null);
  return {
    smsConfigured: isSmsConfiguredSync(c),
    provider,
    senderId: c.MSG91_SENDER_ID || c.OTP_PREFIX || 'VG',
    otpPrefix: c.OTP_PREFIX || 'VG',
    msg91AuthKeySet: !!c.MSG91_AUTH_KEY,
    msg91AuthKeyMasked: maskSecret(c.MSG91_AUTH_KEY),
    twoFactorKeySet: !!c.TWO_FACTOR_API_KEY,
    fast2smsKeySet: !!c.FAST2SMS_API_KEY,
  };
}

module.exports = {
  refreshSmsConfig,
  getSmsConfig,
  ensureGlobalSettingsTable,
  isSmsConfiguredSync,
  getPublicSmsStatus,
  maskSecret,
  DB_KEY_MAP,
};
