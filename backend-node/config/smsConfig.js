const crypto = require('crypto');
const { query } = require('./database');

const ENC_PREFIX = 'enc:v1:';

/** global_settings key -> env-style key */
const DB_KEY_MAP = {
  msg91_auth_key: 'MSG91_AUTH_KEY',
  msg91_sender_id: 'MSG91_SENDER_ID',
  msg91_template_id: 'MSG91_TEMPLATE_ID',
  msg91_route: 'MSG91_ROUTE',
  fast2sms_api_key: 'FAST2SMS_API_KEY',
  two_factor_api_key: 'TWO_FACTOR_API_KEY',
  twofactor_api_key: 'TWO_FACTOR_API_KEY',
  twilio_account_sid: 'TWILIO_ACCOUNT_SID',
  twilio_auth_token: 'TWILIO_AUTH_TOKEN',
  twilio_from_number: 'TWILIO_FROM_NUMBER',
  otp_prefix: 'OTP_PREFIX',
  otp_expiry_minutes: 'OTP_EXPIRY_MINUTES',
  sms_provider: 'SMS_PROVIDER',
  sms_otp_status: 'SMS_STATUS',
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
  TWO_FACTOR_TEMPLATE: ['two_factor_template', 'twofactor_template'],
  TWILIO_ACCOUNT_SID: ['twilio_account_sid'],
  TWILIO_AUTH_TOKEN: ['twilio_auth_token'],
  TWILIO_FROM_NUMBER: ['twilio_from_number'],
  OTP_PREFIX: ['otp_prefix', 'sms_otp_prefix'],
  OTP_EXPIRY_MINUTES: ['otp_expiry_minutes', 'sms_otp_expiry_minutes'],
  SMS_PROVIDER: ['sms_provider'],
  SMS_STATUS: ['sms_otp_status', 'sms_status'],
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
  'TWO_FACTOR_TEMPLATE',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM_NUMBER',
  'OTP_PREFIX',
  'OTP_EXPIRY_MINUTES',
  'DEFAULT_PHONE_COUNTRY_CODE',
  'APP_NAME',
  'SMS_PROVIDER',
  'SMS_STATUS',
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

async function hasColumn(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function addColumnIfMissing(table, column, ddl) {
  if (!(await hasColumn(table, column))) {
    await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

async function ensureSmsSettingsTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS sms_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      provider VARCHAR(30) NOT NULL DEFAULT 'msg91',
      msg91_auth_key TEXT NULL,
      msg91_template_id VARCHAR(160) NULL,
      twofactor_api_key TEXT NULL,
      sender_id VARCHAR(20) NULL,
      otp_expiry_minutes INT NOT NULL DEFAULT 5,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await addColumnIfMissing('sms_settings', 'provider', "VARCHAR(30) NOT NULL DEFAULT 'msg91'");
  await addColumnIfMissing('sms_settings', 'msg91_auth_key', 'TEXT NULL');
  await addColumnIfMissing('sms_settings', 'msg91_template_id', 'VARCHAR(160) NULL');
  await addColumnIfMissing('sms_settings', 'twofactor_api_key', 'TEXT NULL');
  await addColumnIfMissing('sms_settings', 'sender_id', 'VARCHAR(20) NULL');
  await addColumnIfMissing('sms_settings', 'otp_expiry_minutes', 'INT NOT NULL DEFAULT 5');
  await addColumnIfMissing('sms_settings', 'status', "VARCHAR(20) NOT NULL DEFAULT 'active'");
  await addColumnIfMissing('sms_settings', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing(
    'sms_settings',
    'updated_at',
    'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
  );

  const rows = await query('SELECT id FROM sms_settings ORDER BY id ASC LIMIT 1');
  if (!Array.isArray(rows) || rows.length === 0) {
    await query(
      `INSERT INTO sms_settings
        (provider, sender_id, otp_expiry_minutes, status)
       VALUES ('msg91', 'VG', 5, 'active')`
    );
  }
}

function normalizeProvider(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (!value) return '';
  if (value === '2factor' || value === 'twofactor' || value === 'two_factor') return '2factor';
  if (value === 'msg91') return 'msg91';
  if (value === 'fast2sms') return 'fast2sms';
  if (value === 'twilio') return 'twilio';
  return value;
}

function normalizeStatus(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (value === 'inactive' || value === 'disabled' || value === 'off') return 'inactive';
  return 'active';
}

function normalizeSender(raw) {
  return (
    String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6) || 'VG'
  );
}

function normalizeOtpExpiry(raw) {
  const value = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(value)) return 5;
  return Math.min(Math.max(value, 1), 30);
}

function getEncryptionKey() {
  const secret =
    process.env.SMS_SETTINGS_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.APP_KEY ||
    'marcom-street-crm-local-sms-key';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptSecret(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith(ENC_PREFIX)) return raw;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!raw.startsWith(ENC_PREFIX)) return raw;

  try {
    const [ivB64, tagB64, payloadB64] = raw.slice(ENC_PREFIX.length).split(':');
    if (!ivB64 || !tagB64 || !payloadB64) return '';
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(payloadB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    console.warn('[sms-config] Could not decrypt saved SMS secret:', err.message);
    return '';
  }
}

function looksMasked(value) {
  const raw = String(value || '').trim();
  return !raw || /^\*+$/.test(raw) || raw.includes('***');
}

function maskSecret(value) {
  const raw = String(value || '');
  if (!raw) return '';
  if (raw.length <= 8) return '********';
  return `${'*'.repeat(Math.min(raw.length - 4, 12))}${raw.slice(-4)}`;
}

function applyDefaultSmsConfig(cfg) {
  const out = { ...cfg };
  if (!out.OTP_PREFIX) out.OTP_PREFIX = 'VG';
  if (!out.MSG91_SENDER_ID) out.MSG91_SENDER_ID = out.OTP_PREFIX;
  if (!out.MSG91_ROUTE) out.MSG91_ROUTE = '4';
  if (!out.OTP_EXPIRY_MINUTES) out.OTP_EXPIRY_MINUTES = '5';
  if (!out.SMS_STATUS) out.SMS_STATUS = 'active';
  if (out.SMS_PROVIDER) out.SMS_PROVIDER = normalizeProvider(out.SMS_PROVIDER);
  out.SMS_STATUS = normalizeStatus(out.SMS_STATUS);
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

function mapSmsSettingsToConfig(row) {
  if (!row) return {};
  const sender = normalizeSender(row.sender_id || '');
  const cfg = {
    SMS_PROVIDER: normalizeProvider(row.provider || 'msg91') || 'msg91',
    SMS_STATUS: normalizeStatus(row.status || 'active'),
    MSG91_SENDER_ID: sender,
    OTP_PREFIX: sender,
    OTP_EXPIRY_MINUTES: String(normalizeOtpExpiry(row.otp_expiry_minutes)),
  };
  if (row.msg91_auth_key) cfg.MSG91_AUTH_KEY = row.msg91_auth_key;
  if (row.msg91_template_id) cfg.MSG91_TEMPLATE_ID = String(row.msg91_template_id).trim();
  if (row.twofactor_api_key) cfg.TWO_FACTOR_API_KEY = row.twofactor_api_key;
  return cfg;
}

async function getSmsSettingsRow({ decrypt = true } = {}) {
  await ensureSmsSettingsTable();
  const rows = await query('SELECT * FROM sms_settings ORDER BY id ASC LIMIT 1');
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return {
    id: row.id,
    provider: normalizeProvider(row.provider || 'msg91') || 'msg91',
    msg91_auth_key: decrypt ? decryptSecret(row.msg91_auth_key) : String(row.msg91_auth_key || ''),
    msg91_template_id: String(row.msg91_template_id || '').trim(),
    twofactor_api_key: decrypt
      ? decryptSecret(row.twofactor_api_key)
      : String(row.twofactor_api_key || ''),
    sender_id: normalizeSender(row.sender_id || 'VG'),
    otp_expiry_minutes: normalizeOtpExpiry(row.otp_expiry_minutes),
    status: normalizeStatus(row.status || 'active'),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

async function upsertGlobalSetting(key, value) {
  await ensureGlobalSettingsTable();
  await query(
    'INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
    [key, value, value]
  );
}

async function saveSmsSettings(input = {}) {
  await ensureSmsSettingsTable();
  const currentRaw = await getSmsSettingsRow({ decrypt: false });
  const id = currentRaw?.id || 1;

  const provider = normalizeProvider(input.provider ?? input.sms_provider ?? currentRaw?.provider) || 'msg91';
  const sender = normalizeSender(
    input.sender_id ?? input.msg91_sender_id ?? input.otp_prefix ?? currentRaw?.sender_id ?? 'VG'
  );
  const expiry = normalizeOtpExpiry(input.otp_expiry_minutes ?? currentRaw?.otp_expiry_minutes ?? 5);
  const status = normalizeStatus(input.status ?? input.sms_otp_status ?? currentRaw?.status ?? 'active');

  const msg91TemplateId =
    input.msg91_template_id !== undefined
      ? String(input.msg91_template_id || '').trim()
      : currentRaw?.msg91_template_id || '';

  let msg91AuthKey = currentRaw?.msg91_auth_key || '';
  if (input.msg91_auth_key !== undefined && !looksMasked(input.msg91_auth_key)) {
    msg91AuthKey = encryptSecret(input.msg91_auth_key);
  }

  const twoFactorInput =
    input.twofactor_api_key ?? input.two_factor_api_key ?? input['2factor_api_key'];
  let twofactorApiKey = currentRaw?.twofactor_api_key || '';
  if (twoFactorInput !== undefined && !looksMasked(twoFactorInput)) {
    twofactorApiKey = encryptSecret(twoFactorInput);
  }

  await query(
    `UPDATE sms_settings
     SET provider = ?, msg91_auth_key = ?, msg91_template_id = ?, twofactor_api_key = ?,
         sender_id = ?, otp_expiry_minutes = ?, status = ?, updated_at = NOW()
     WHERE id = ?`,
    [provider, msg91AuthKey, msg91TemplateId, twofactorApiKey, sender, expiry, status, id]
  );

  await upsertGlobalSetting('sms_provider', provider);
  await upsertGlobalSetting('msg91_sender_id', sender);
  await upsertGlobalSetting('otp_prefix', sender);
  await upsertGlobalSetting('msg91_template_id', msg91TemplateId);
  await upsertGlobalSetting('otp_expiry_minutes', String(expiry));
  await upsertGlobalSetting('sms_otp_status', status);

  cache = null;
  return getSmsSettingsRow({ decrypt: true });
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

  try {
    const smsRow = await getSmsSettingsRow({ decrypt: true });
    const smsCfg = mapSmsSettingsToConfig(smsRow);
    const hasSavedProviderSecrets = !!(
      smsRow?.msg91_auth_key ||
      smsRow?.msg91_template_id ||
      smsRow?.twofactor_api_key
    );
    if (!hasSavedProviderSecrets && cfg.SMS_PROVIDER) {
      delete smsCfg.SMS_PROVIDER;
    }
    cfg = { ...cfg, ...smsCfg };
  } catch (err) {
    console.warn('[sms-config] sms_settings load skipped:', err.message);
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

function getProviderFromConfig(c) {
  const configured = normalizeProvider(c.SMS_PROVIDER);
  if (configured) return configured;
  if (c.MSG91_AUTH_KEY || c.MSG91_TEMPLATE_ID) return 'msg91';
  if (c.TWO_FACTOR_API_KEY) return '2factor';
  if (c.FAST2SMS_API_KEY) return 'fast2sms';
  if (c.TWILIO_ACCOUNT_SID) return 'twilio';
  return '';
}

function getSmsConfigFieldErrors(cfg) {
  const c = applyDefaultSmsConfig(cfg || cache || readEnvConfig());
  const provider = getProviderFromConfig(c);
  const errors = {};

  if (c.SMS_STATUS === 'inactive') {
    errors.status = 'SMS OTP inactive hai. Status active karein.';
    return errors;
  }

  if (provider === 'msg91') {
    if (!c.MSG91_AUTH_KEY) errors.msg91_auth_key = 'MSG91 auth key required hai.';
    if (!c.MSG91_TEMPLATE_ID) errors.msg91_template_id = 'MSG91 template ID required hai.';
  } else if (provider === '2factor') {
    if (!c.TWO_FACTOR_API_KEY) errors.two_factor_api_key = '2Factor API key required hai.';
  } else if (provider === 'fast2sms') {
    if (!c.FAST2SMS_API_KEY) errors.fast2sms_api_key = 'Fast2SMS API key required hai.';
  } else if (provider === 'twilio') {
    if (!c.TWILIO_ACCOUNT_SID) errors.twilio_account_sid = 'Twilio account SID required hai.';
    if (!c.TWILIO_AUTH_TOKEN) errors.twilio_auth_token = 'Twilio auth token required hai.';
    if (!c.TWILIO_FROM_NUMBER) errors.twilio_from_number = 'Twilio from number required hai.';
  } else {
    errors.sms_provider = 'SMS provider select karein.';
  }

  return errors;
}

function isSmsConfiguredSync(cfg) {
  const c = applyDefaultSmsConfig(cfg || cache || readEnvConfig());
  return Object.keys(getSmsConfigFieldErrors(c)).length === 0;
}

function getPublicSmsStatus(cfg) {
  const c = applyDefaultSmsConfig(cfg || cache || readEnvConfig());
  const provider = getProviderFromConfig(c) || null;
  const errors = getSmsConfigFieldErrors(c);
  const smsConfigured = Object.keys(errors).length === 0;
  return {
    smsConfigured,
    provider,
    status: c.SMS_STATUS || 'active',
    senderId: c.MSG91_SENDER_ID || c.OTP_PREFIX || 'VG',
    otpPrefix: c.OTP_PREFIX || 'VG',
    otpExpiryMinutes: normalizeOtpExpiry(c.OTP_EXPIRY_MINUTES),
    msg91AuthKeySet: !!c.MSG91_AUTH_KEY,
    msg91AuthKeyMasked: maskSecret(c.MSG91_AUTH_KEY),
    msg91TemplateIdSet: !!c.MSG91_TEMPLATE_ID,
    msg91TemplateIdMasked: c.MSG91_TEMPLATE_ID ? maskSecret(c.MSG91_TEMPLATE_ID) : '',
    twoFactorKeySet: !!c.TWO_FACTOR_API_KEY,
    twoFactorKeyMasked: maskSecret(c.TWO_FACTOR_API_KEY),
    fast2smsKeySet: !!c.FAST2SMS_API_KEY,
    errors,
  };
}

async function getSmsSettingsForResponse() {
  const row = await getSmsSettingsRow({ decrypt: true });
  const cfg = await getSmsConfig();
  const status = getPublicSmsStatus(cfg);
  return {
    sms_provider: row?.provider || status.provider || 'msg91',
    provider: row?.provider || status.provider || 'msg91',
    msg91_auth_key: '',
    msg91_auth_key_configured: !!(row?.msg91_auth_key || cfg.MSG91_AUTH_KEY),
    msg91_auth_key_masked: maskSecret(row?.msg91_auth_key || cfg.MSG91_AUTH_KEY),
    msg91_template_id: row?.msg91_template_id || cfg.MSG91_TEMPLATE_ID || '',
    msg91_template_id_configured: !!(row?.msg91_template_id || cfg.MSG91_TEMPLATE_ID),
    two_factor_api_key: '',
    twofactor_api_key: '',
    two_factor_api_key_configured: !!(row?.twofactor_api_key || cfg.TWO_FACTOR_API_KEY),
    two_factor_api_key_masked: maskSecret(row?.twofactor_api_key || cfg.TWO_FACTOR_API_KEY),
    sender_id: row?.sender_id || cfg.MSG91_SENDER_ID || 'VG',
    msg91_sender_id: row?.sender_id || cfg.MSG91_SENDER_ID || 'VG',
    otp_prefix: row?.sender_id || cfg.OTP_PREFIX || 'VG',
    otp_expiry_minutes: row?.otp_expiry_minutes || normalizeOtpExpiry(cfg.OTP_EXPIRY_MINUTES),
    sms_otp_status: row?.status || cfg.SMS_STATUS || 'active',
  };
}

module.exports = {
  refreshSmsConfig,
  getSmsConfig,
  ensureGlobalSettingsTable,
  ensureSmsSettingsTable,
  getSmsSettingsRow,
  saveSmsSettings,
  getSmsSettingsForResponse,
  getSmsConfigFieldErrors,
  isSmsConfiguredSync,
  getPublicSmsStatus,
  maskSecret,
  decryptSecret,
  encryptSecret,
  normalizeProvider,
  normalizeOtpExpiry,
  DB_KEY_MAP,
};
