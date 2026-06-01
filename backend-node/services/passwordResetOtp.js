const crypto = require('crypto');
const {
  refreshSmsConfig,
  getSmsConfig,
  isSmsConfiguredSync,
  getSmsConfigFieldErrors,
  normalizeOtpExpiry,
} = require('../config/smsConfig');

class SmsProviderConfigError extends Error {
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = 'SmsProviderConfigError';
    this.statusCode = 400;
    this.fieldErrors = fieldErrors;
  }
}

function getOtpPrefix() {
  const prefix = String(process.env.OTP_PREFIX || 'VG')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  return prefix || 'VG';
}

/** Digits only */
function normalizeDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

function phoneKeyFromInput(phoneRaw) {
  const digits = normalizeDigits(phoneRaw);
  if (!digits) return '';
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function toSmsMobile(phoneRaw) {
  const digits = normalizeDigits(phoneRaw);
  if (!digits) return '';
  const countryCode = normalizeDigits(process.env.DEFAULT_PHONE_COUNTRY_CODE || '91') || '91';
  if (digits.length === 10) return `${countryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `${countryCode}${digits.slice(1)}`;
  if (digits.length >= 12 && digits.startsWith(countryCode)) return digits;
  if (digits.length > 10) return digits;
  return `${countryCode}${digits}`;
}

function toE164(phoneRaw) {
  const mobile = toSmsMobile(phoneRaw);
  return mobile ? `+${mobile}` : '';
}

function phonesMatch(storedPhone, inputRaw) {
  const stored = normalizeDigits(storedPhone);
  const input = normalizeDigits(inputRaw);
  if (!stored || !input) return false;
  if (stored === input) return true;
  const storedTail = stored.length >= 10 ? stored.slice(-10) : stored;
  const inputTail = input.length >= 10 ? input.slice(-10) : input;
  return storedTail === inputTail && storedTail.length >= 10;
}

async function findActiveEmployeeByPhone(query, phoneRaw) {
  const key = phoneKeyFromInput(phoneRaw);
  if (!key || key.length < 8) return null;

  const digitsOnly = normalizeDigits(phoneRaw);
  const with91 = `91${key}`;
  const with0 = `0${key}`;
  const phoneSql = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'+',''),'(',''),')',''),'.','')`;

  const runQuery = async (statusFilter) => {
    const sql = `SELECT * FROM employees
       WHERE phone IS NOT NULL AND TRIM(phone) <> ''
       AND (
         RIGHT(${phoneSql}, 10) = ?
         OR ${phoneSql} = ?
         OR ${phoneSql} = ?
         OR ${phoneSql} = ?
       )
       LIMIT 3`;
    if (statusFilter) {
      return query(
        sql.replace('WHERE phone', "WHERE status = 'active' AND phone"),
        [key, digitsOnly, with91, with0]
      );
    }
    return query(sql, [key, digitsOnly, with91, with0]);
  };

  let rows;
  try {
    rows = await runQuery(true);
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && /status/i.test(err.message || '')) {
      rows = await runQuery(false);
      rows = (rows || []).filter(
        (employee) => !employee.status || String(employee.status).toLowerCase() === 'active'
      );
    } else {
      throw err;
    }
  }

  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    let all;
    try {
      all = await query(
        "SELECT * FROM employees WHERE status = 'active' AND phone IS NOT NULL AND TRIM(phone) <> ''",
        ['active']
      );
    } catch (e) {
      all = await query("SELECT * FROM employees WHERE phone IS NOT NULL AND TRIM(phone) <> ''", []);
      all = (all || []).filter(
        (employee) => !employee.status || String(employee.status).toLowerCase() === 'active'
      );
    }
    const matches = (all || []).filter((employee) => phonesMatch(employee.phone, phoneRaw));
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    return matches.find((employee) => normalizeDigits(employee.phone) === digitsOnly) || matches[0];
  }

  if (list.length === 1) return list[0];
  return list.find((employee) => phonesMatch(employee.phone, phoneRaw)) || list[0];
}

function generateOtp6() {
  return String(crypto.randomInt(100000, 1000000));
}

function formatOtpDisplay(otpDigits) {
  const digits = String(otpDigits || '')
    .replace(/\D/g, '')
    .slice(0, 6);
  return `${getOtpPrefix()}${digits}`;
}

function parseOtpInput(raw) {
  const prefix = getOtpPrefix();
  let value = String(raw || '').trim().toUpperCase();
  if (prefix && value.startsWith(prefix)) {
    value = value.slice(prefix.length);
  }
  return value.replace(/\D/g, '').slice(0, 6);
}

async function isSmsConfigured() {
  const cfg = await getSmsConfig();
  return isSmsConfiguredSync(cfg);
}

function normalizeProviderName(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (!value) return '';
  if (value === '2factor' || value === 'twofactor' || value === 'two_factor') return '2factor';
  if (value === 'msg91') return 'msg91';
  if (value === 'fast2sms') return 'fast2sms';
  if (value === 'twilio') return 'twilio';
  if (value.startsWith('msg91')) return 'msg91';
  return value;
}

function hasProviderCredentials(provider, cfg) {
  const c = cfg || {};
  if (provider === 'msg91') return !!(c.MSG91_AUTH_KEY && c.MSG91_TEMPLATE_ID);
  if (provider === '2factor') return !!c.TWO_FACTOR_API_KEY;
  if (provider === 'fast2sms') return !!c.FAST2SMS_API_KEY;
  if (provider === 'twilio') return !!(c.TWILIO_ACCOUNT_SID && c.TWILIO_AUTH_TOKEN && c.TWILIO_FROM_NUMBER);
  return false;
}

function getSmsProviderName(cfg) {
  const c = cfg || {};
  const configured = normalizeProviderName(c.SMS_PROVIDER);
  if (configured) return configured;
  if (c.MSG91_AUTH_KEY || c.MSG91_TEMPLATE_ID) return 'msg91';
  if (c.TWO_FACTOR_API_KEY) return '2factor';
  if (c.FAST2SMS_API_KEY) return 'fast2sms';
  if (c.TWILIO_ACCOUNT_SID) return 'twilio';
  return '';
}

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function responseFailed(data, fallbackText = '') {
  const status = String(data?.type || data?.Type || data?.status || data?.Status || '').toLowerCase();
  const message = String(data?.message || data?.Message || data?.msg || data?.Details || fallbackText || '');
  return (
    status === 'error' ||
    status === 'failed' ||
    status === 'failure' ||
    /^error$/i.test(message) ||
    /invalid|failed|failure|denied|unauthorized|not found/i.test(message)
  );
}

function getProviderMessage(data, fallbackText = '') {
  return String(
    data?.message || data?.Message || data?.msg || data?.Details || data?.raw || fallbackText || ''
  ).slice(0, 200);
}

function getProviderSessionId(data) {
  const raw =
    data?.Details ||
    data?.details ||
    data?.session_id ||
    data?.sessionId ||
    data?.SessionId ||
    data?.request_id ||
    data?.requestId ||
    data?.RequestId ||
    '';
  const value = String(raw || '').trim();
  return value && !/sent|success|matched|verified/i.test(value) ? value : '';
}

/** 2Factor.in - India OTP SMS */
async function sendVia2Factor(smsMobile, otp, cfg) {
  const apiKey = cfg.TWO_FACTOR_API_KEY;
  const template = cfg.TWO_FACTOR_TEMPLATE || process.env.TWO_FACTOR_TEMPLATE || '';
  const parts = [
    'https://2factor.in/API/V1',
    encodeURIComponent(apiKey),
    'SMS',
    encodeURIComponent(smsMobile),
    encodeURIComponent(otp),
  ];
  if (template) parts.push(encodeURIComponent(template));
  const url = parts.join('/');

  const res = await fetch(url, { method: 'GET' });
  const text = await res.text();
  const data = parseJsonMaybe(text);
  if (!res.ok || responseFailed(data, text)) {
    throw new Error(`2Factor: ${getProviderMessage(data, text) || res.status}`);
  }
  return {
    ok: true,
    provider: '2factor',
    mode: '2factor',
    providerSessionId: getProviderSessionId(data),
    smsMobile,
  };
}

async function verifyVia2Factor(providerSessionId, otp, cfg) {
  if (!providerSessionId) {
    return { ok: true, provider: '2factor', skipped: true };
  }
  const apiKey = cfg.TWO_FACTOR_API_KEY;
  const url = `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}/SMS/VERIFY/${encodeURIComponent(
    providerSessionId
  )}/${encodeURIComponent(otp)}`;
  const res = await fetch(url, { method: 'GET' });
  const text = await res.text();
  const data = parseJsonMaybe(text);
  if (!res.ok || responseFailed(data, text)) {
    throw new Error(`2Factor verify: ${getProviderMessage(data, text) || res.status}`);
  }
  return { ok: true, provider: '2factor' };
}

async function sendViaMsg91OtpApi(smsMobile, otp, cfg) {
  const authkey = cfg.MSG91_AUTH_KEY;
  const templateId = cfg.MSG91_TEMPLATE_ID;
  const expiry = normalizeOtpExpiry(cfg.OTP_EXPIRY_MINUTES || 5);
  const params = new URLSearchParams({
    otp_expiry: String(expiry),
    template_id: templateId,
    mobile: smsMobile,
    authkey,
    otp,
  });
  const url = `https://control.msg91.com/api/v5/otp?${params.toString()}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authkey,
    },
  });
  const text = await res.text();
  const data = parseJsonMaybe(text);
  if (!res.ok || responseFailed(data, text)) {
    throw new Error(`MSG91 OTP: ${getProviderMessage(data, text) || res.status}`);
  }
  return { ok: true, provider: 'msg91', mode: 'msg91_otp', smsMobile };
}

async function verifyViaMsg91OtpApi(smsMobile, otp, cfg) {
  const authkey = cfg.MSG91_AUTH_KEY;
  const params = new URLSearchParams({
    mobile: smsMobile,
    otp,
    authkey,
  });
  const url = `https://control.msg91.com/api/v5/otp/verify?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authkey,
    },
  });
  const text = await res.text();
  const data = parseJsonMaybe(text);
  if (!res.ok || responseFailed(data, text)) {
    throw new Error(`MSG91 verify: ${getProviderMessage(data, text) || res.status}`);
  }
  return { ok: true, provider: 'msg91' };
}

async function sendViaFast2Sms(phoneKey, otp, cfg) {
  const apiKey = cfg.FAST2SMS_API_KEY;
  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'otp',
      variables_values: otp,
      numbers: phoneKey,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.return === false) {
    throw new Error(`Fast2SMS: ${data.message || res.status}`);
  }
  return { ok: true, provider: 'fast2sms', mode: 'fast2sms' };
}

async function sendViaTwilio(phoneE164, otp, cfg) {
  const sid = cfg.TWILIO_ACCOUNT_SID;
  const token = cfg.TWILIO_AUTH_TOKEN;
  const from = cfg.TWILIO_FROM_NUMBER;
  const body = `Your ${process.env.APP_NAME || 'MARCOM CRM'} password reset code is ${otp}. Valid ${
    normalizeOtpExpiry(cfg.OTP_EXPIRY_MINUTES || 5)
  } minutes.`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams();
  params.set('To', phoneE164);
  params.set('From', from);
  params.set('Body', body);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio: ${res.status} ${text.slice(0, 200)}`);
  }
  return { ok: true, provider: 'twilio', mode: 'twilio' };
}

function buildProviderAttempts(cfg, smsMobile, phoneKey, e164) {
  const preferred = getSmsProviderName(cfg);
  const order = preferred
    ? [preferred]
    : ['msg91', '2factor', 'fast2sms', 'twilio'].filter((provider) => hasProviderCredentials(provider, cfg));

  const attempts = [];
  for (const provider of order) {
    if (provider === 'msg91') {
      attempts.push({ name: 'msg91_otp', fn: (otp) => sendViaMsg91OtpApi(smsMobile, otp, cfg) });
    } else if (provider === '2factor') {
      attempts.push({ name: '2factor', fn: (otp) => sendVia2Factor(smsMobile, otp, cfg) });
    } else if (provider === 'fast2sms') {
      attempts.push({ name: 'fast2sms', fn: (otp) => sendViaFast2Sms(phoneKey, otp, cfg) });
    } else if (provider === 'twilio') {
      attempts.push({ name: 'twilio', fn: (otp) => sendViaTwilio(e164, otp, cfg) });
    }
  }
  return attempts;
}

function buildMissingConfigError(cfg) {
  const fieldErrors = getSmsConfigFieldErrors(cfg);
  const message =
    fieldErrors.msg91_auth_key ||
    fieldErrors.msg91_template_id ||
    fieldErrors.two_factor_api_key ||
    fieldErrors.status ||
    fieldErrors.sms_provider ||
    'Pehle MSG91 ya 2Factor API key save karein (SMS OTP section).';
  return new SmsProviderConfigError(message, fieldErrors);
}

/**
 * Send OTP to phone. Fails if selected SMS provider is not fully configured.
 * Never logs OTP to console in production path.
 */
async function sendOtpToPhone(phoneRaw, otp) {
  await refreshSmsConfig();

  const smsMobile = toSmsMobile(phoneRaw);
  const phoneKey = phoneKeyFromInput(phoneRaw);
  const e164 = toE164(phoneRaw);

  if (!smsMobile || phoneKey.length < 10) {
    throw new Error('Invalid mobile number. 10 digit Indian mobile number enter karein.');
  }

  const cfg = await getSmsConfig();
  if (!isSmsConfiguredSync(cfg)) {
    throw buildMissingConfigError(cfg);
  }

  const attempts = buildProviderAttempts(cfg, smsMobile, phoneKey, e164);
  if (attempts.length === 0) {
    throw buildMissingConfigError(cfg);
  }

  const errors = [];
  for (const { name, fn } of attempts) {
    try {
      const result = await fn(otp);
      if (result) {
        console.log(`[password-reset] SMS sent via ${result.mode} to ${smsMobile.slice(0, 4)}***`);
        return { ...result, smsMobile };
      }
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      console.error(`[password-reset] ${name} failed:`, err.message);
    }
  }

  throw new Error(errors[0] || 'Provider API failed. SMS dashboard, template ID aur balance check karein.');
}

async function verifyOtpWithProvider(provider, phoneRaw, otp, providerSessionId) {
  const normalized = normalizeProviderName(provider);
  if (!normalized || normalized === 'fast2sms' || normalized === 'twilio') {
    return { ok: true, skipped: true };
  }

  await refreshSmsConfig();
  const cfg = await getSmsConfig();
  const smsMobile = toSmsMobile(phoneRaw);
  if (normalized === 'msg91') {
    return verifyViaMsg91OtpApi(smsMobile, otp, cfg);
  }
  if (normalized === '2factor') {
    return verifyVia2Factor(providerSessionId, otp, cfg);
  }
  return { ok: true, skipped: true };
}

module.exports = {
  OTP_PREFIX: getOtpPrefix(),
  SmsProviderConfigError,
  getOtpPrefix,
  normalizeDigits,
  phoneKeyFromInput,
  toSmsMobile,
  toE164,
  findActiveEmployeeByPhone,
  generateOtp6,
  formatOtpDisplay,
  parseOtpInput,
  sendOtpToPhone,
  verifyOtpWithProvider,
  isSmsConfigured,
  isSmsConfiguredSync,
};
