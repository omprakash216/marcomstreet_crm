const crypto = require('crypto');
const { refreshSmsConfig, getSmsConfig, isSmsConfiguredSync } = require('../config/smsConfig');

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
      rows = (rows || []).filter((employee) => !employee.status || String(employee.status).toLowerCase() === 'active');
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
      all = (all || []).filter((employee) => !employee.status || String(employee.status).toLowerCase() === 'active');
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
  if (value === '2factor' || value === 'twofactor') return '2factor';
  if (value === 'msg91') return 'msg91';
  if (value === 'fast2sms') return 'fast2sms';
  if (value === 'twilio') return 'twilio';
  return value;
}

function hasProviderCredentials(provider, cfg) {
  const c = cfg || {};
  if (provider === 'msg91') return !!c.MSG91_AUTH_KEY;
  if (provider === '2factor') return !!c.TWO_FACTOR_API_KEY;
  if (provider === 'fast2sms') return !!c.FAST2SMS_API_KEY;
  if (provider === 'twilio') return !!(c.TWILIO_ACCOUNT_SID && c.TWILIO_AUTH_TOKEN && c.TWILIO_FROM_NUMBER);
  return false;
}

function getSmsProviderName(cfg) {
  const c = cfg || {};
  const configured = normalizeProviderName(c.SMS_PROVIDER);
  if (configured) return configured;
  if (c.MSG91_AUTH_KEY) return 'msg91';
  if (c.TWO_FACTOR_API_KEY) return '2factor';
  if (c.FAST2SMS_API_KEY) return 'fast2sms';
  if (c.TWILIO_ACCOUNT_SID) return 'twilio';
  return '';
}

/** 2Factor.in - India OTP SMS (https://2factor.in) */
async function sendVia2Factor(smsMobile, otp) {
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  if (!apiKey) return null;

  const displayCode = formatOtpDisplay(otp);
  const template = process.env.TWO_FACTOR_TEMPLATE || getOtpPrefix() || 'VGOTP';
  const url = `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}/SMS/${encodeURIComponent(
    smsMobile
  )}/${encodeURIComponent(otp)}/${encodeURIComponent(template)}`;

  const res = await fetch(url);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { Details: text };
  }
  if (!res.ok || (data.Status && String(data.Status).toLowerCase() !== 'success')) {
    throw new Error(`2Factor: ${data.Details || data.Message || text.slice(0, 150)}`);
  }
  console.log(`[password-reset] 2Factor SMS sent (${displayCode})`);
  return { ok: true, mode: '2factor' };
}

/** MSG91 transactional SMS - full message with prefixed OTP (DLT template optional) */
async function sendViaMsg91Http(smsMobile, otp) {
  const authkey = process.env.MSG91_AUTH_KEY;
  if (!authkey) return null;

  const sender = process.env.MSG91_SENDER_ID || getOtpPrefix();
  const displayCode = formatOtpDisplay(otp);
  const route = process.env.MSG91_ROUTE || '4';
  const country = process.env.DEFAULT_PHONE_COUNTRY_CODE || '91';
  const text = `${displayCode} is your ${process.env.APP_NAME || 'MARCOM CRM'} password reset OTP. Valid 10 minutes. Do not share.`;

  const url =
    `https://api.msg91.com/api/sendhttp.php?authkey=${encodeURIComponent(authkey)}` +
    `&mobiles=${encodeURIComponent(smsMobile)}` +
    `&message=${encodeURIComponent(text)}` +
    `&sender=${encodeURIComponent(sender)}` +
    `&route=${encodeURIComponent(route)}` +
    `&country=${encodeURIComponent(country)}`;

  const res = await fetch(url);
  const body = await res.text();
  const trimmed = String(body || '').trim();
  if (!res.ok || /invalid|error|denied|failed/i.test(trimmed)) {
    throw new Error(`MSG91 SMS: ${trimmed.slice(0, 200)}`);
  }
  if (!trimmed || trimmed.length < 4) {
    throw new Error(`MSG91 SMS: unexpected response - ${trimmed.slice(0, 100)}`);
  }
  return { ok: true, mode: 'msg91_http' };
}

async function sendViaMsg91OtpApi(smsMobile, otp) {
  const authkey = process.env.MSG91_AUTH_KEY;
  if (!authkey) return null;

  const sender = process.env.MSG91_SENDER_ID || getOtpPrefix();
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const displayCode = formatOtpDisplay(otp);

  if (templateId) {
    const url = `https://control.msg91.com/api/v5/otp?otp_expiry=10&template_id=${encodeURIComponent(
      templateId
    )}&mobile=${encodeURIComponent(smsMobile)}&authkey=${encodeURIComponent(authkey)}&otp=${encodeURIComponent(displayCode)}`;
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!res.ok || (data.type && data.type !== 'success')) {
      throw new Error(`MSG91 OTP: ${data.message || text.slice(0, 150)}`);
    }
    return { ok: true, mode: 'msg91_template' };
  }

  const message = encodeURIComponent(
    `${getOtpPrefix()}##OTP## is your ${process.env.APP_NAME || 'MARCOM CRM'} password reset OTP. Valid 10 minutes.`
  );
  const url =
    `https://api.msg91.com/api/sendotp.php?authkey=${encodeURIComponent(authkey)}` +
    `&mobile=${encodeURIComponent(smsMobile)}&message=${message}` +
    `&sender=${encodeURIComponent(sender)}&otp=${encodeURIComponent(otp)}&otp_expiry=10`;

  const res = await fetch(url);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (data.type === 'error' || data.message === 'error') {
    throw new Error(`MSG91 OTP: ${data.msg || data.message || text.slice(0, 150)}`);
  }
  return { ok: true, mode: 'msg91_otp' };
}

async function sendViaFast2Sms(phoneKey, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) return null;

  const displayCode = formatOtpDisplay(otp);
  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'otp',
      variables_values: displayCode,
      numbers: phoneKey,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.return === false) {
    throw new Error(`Fast2SMS: ${data.message || res.status}`);
  }
  return { ok: true, mode: 'fast2sms' };
}

async function sendViaTwilio(phoneE164, otp) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return null;

  const displayCode = formatOtpDisplay(otp);
  const body = `Your ${process.env.APP_NAME || 'MARCOM CRM'} password reset code is ${displayCode}. Valid 10 minutes.`;
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
  return { ok: true, mode: 'twilio' };
}

function buildProviderAttempts(cfg, smsMobile, phoneKey, e164) {
  const preferred = getSmsProviderName(cfg);
  const available = ['msg91', '2factor', 'fast2sms', 'twilio'].filter((provider) =>
    hasProviderCredentials(provider, cfg)
  );

  const order = [];
  if (preferred) order.push(preferred);
  for (const provider of available) {
    if (!order.includes(provider)) {
      order.push(provider);
    }
  }

  const attempts = [];
  for (const provider of order) {
    if (provider === 'msg91') {
      attempts.push({ name: 'msg91_otp', fn: (otp) => sendViaMsg91OtpApi(smsMobile, otp) });
      attempts.push({ name: 'msg91_http', fn: (otp) => sendViaMsg91Http(smsMobile, otp) });
    } else if (provider === '2factor') {
      attempts.push({ name: '2factor', fn: (otp) => sendVia2Factor(smsMobile, otp) });
    } else if (provider === 'fast2sms') {
      attempts.push({ name: 'fast2sms', fn: (otp) => sendViaFast2Sms(phoneKey, otp) });
    } else if (provider === 'twilio') {
      attempts.push({ name: 'twilio', fn: (otp) => sendViaTwilio(e164, otp) });
    }
  }
  return attempts;
}

/**
 * Send OTP to phone. Fails if no SMS provider or all providers fail.
 * Never logs OTP to console in production path.
 */
async function sendOtpToPhone(phoneRaw, otp) {
  await refreshSmsConfig();

  const smsMobile = toSmsMobile(phoneRaw);
  const phoneKey = phoneKeyFromInput(phoneRaw);
  const e164 = toE164(phoneRaw);

  if (!smsMobile) {
    throw new Error('Invalid phone number');
  }

  const cfg = await getSmsConfig();
  if (!isSmsConfiguredSync(cfg)) {
    throw new Error(
      'SMS configure nahi hai. Super Admin -> System Settings -> SMS OTP mein API key save karein, ya: node scripts/configure-sms.js --msg91=KEY'
    );
  }

  const attempts = buildProviderAttempts(cfg, smsMobile, phoneKey, e164);
  if (attempts.length === 0) {
    throw new Error(
      'SMS provider configured hai, lekin selected provider ki API key missing hai. Super Admin -> System Settings mein provider aur key verify karein.'
    );
  }

  const errors = [];
  for (const { name, fn } of attempts) {
    try {
      const result = await fn(otp);
      if (result) {
        console.log(`[password-reset] SMS sent via ${result.mode} to ${smsMobile.slice(0, 4)}***`);
        return result;
      }
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      console.error(`[password-reset] ${name} failed:`, err.message);
    }
  }

  throw new Error(
    errors[0] ||
      'OTP SMS bhejne mein fail. MSG91 dashboard par sender ID "VG" aur balance check karein.'
  );
}

module.exports = {
  OTP_PREFIX: getOtpPrefix(),
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
  isSmsConfigured,
  isSmsConfiguredSync,
};
