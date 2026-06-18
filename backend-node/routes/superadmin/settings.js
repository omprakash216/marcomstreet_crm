const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');
const {
  refreshSmsConfig,
  getPublicSmsStatus,
  maskSecret,
  ensureGlobalSettingsTable,
  ensureSmsSettingsTable,
  getSmsSettingsForResponse,
  saveSmsSettings,
  decryptSecret,
  encryptSecret,
} = require('../../config/smsConfig');
const { refreshEmailConfig, getPublicEmailStatus, normalizeEmailHost } = require('../../config/emailConfig');
const { sendOtpToPhone, generateOtp6 } = require('../../services/passwordResetOtp');

const router = express.Router();

const SENSITIVE_KEYS = new Set([
  'msg91_auth_key',
  'fast2sms_api_key',
  'two_factor_api_key',
  'twofactor_api_key',
  'twilio_auth_token',
  'smtp_pass',
  'gmail_pass',
  'brevo_smtp_pass',
]);

const SMS_SETTING_KEYS = new Set([
  'sms_provider',
  'provider',
  'msg91_auth_key',
  'msg91_template_id',
  'two_factor_api_key',
  'twofactor_api_key',
  '2factor_api_key',
  'sender_id',
  'msg91_sender_id',
  'otp_prefix',
  'otp_expiry_minutes',
  'sms_otp_status',
  'status',
]);

const EMAIL_SETTING_KEYS = new Set([
  'smtp_host',
  'smtp_port',
  'smtp_secure',
  'smtp_user',
  'smtp_pass',
  'smtp_from_name',
  'smtp_from_email',
  'mail_from',
  'password_reset_brand_name',
  'allow_email_preview',
  'disable_email_sending',
  'gmail_user',
  'gmail_pass',
  'brevo_smtp_user',
  'brevo_smtp_pass',
  'use_brevo_smtp',
  'email_from_name',
]);

function maskSettingsForResponse(settings) {
  const out = { ...settings };
  for (const key of SENSITIVE_KEYS) {
    if (out[key]) out[key] = maskSecret(out[key]);
    out[`${key}_configured`] = !!(settings[key] && String(settings[key]).trim());
  }
  return out;
}

function normalizeSettingForStorage(key, value) {
  const str = String(value ?? '').trim();
  if (!str) return '';
  if (key === 'sms_provider') {
    const provider = str.toLowerCase();
    if (provider === 'twofactor') return '2factor';
    return provider;
  }
  if (key === 'msg91_sender_id' || key === 'otp_prefix') {
    return str.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'VG';
  }
  if (key === 'smtp_host') {
    return normalizeEmailHost(str);
  }
  if (key === 'smtp_port') {
    const port = Number.parseInt(str, 10);
    return Number.isFinite(port) && port > 0 ? String(port) : '';
  }
  if (key === 'smtp_secure' || key === 'allow_email_preview' || key === 'disable_email_sending' || key === 'use_brevo_smtp') {
    return ['1', 'true', 'yes', 'on'].includes(str.toLowerCase()) ? 'true' : 'false';
  }
  return str;
}

// Get global settings
router.get('/', async (req, res) => {
  try {
    await ensureGlobalSettingsTable();
    await ensureSmsSettingsTable();
    await refreshSmsConfig();
    await refreshEmailConfig();
    const rows = await query('SELECT * FROM global_settings');
    const settings = {};
    rows.forEach((r) => {
      settings[r.setting_key] = r.setting_value;
    });
    for (const secretKey of ['smtp_pass', 'gmail_pass', 'brevo_smtp_pass']) {
      if (settings[secretKey]) {
        settings[secretKey] = decryptSecret(settings[secretKey]);
      }
    }
    if (settings.smtp_host) {
      settings.smtp_host = normalizeEmailHost(settings.smtp_host);
    }
    const smsStatus = getPublicSmsStatus();
    const emailStatus = getPublicEmailStatus();
    const smsSettings = await getSmsSettingsForResponse();
    res.json({
      success: true,
      data: {
        ...maskSettingsForResponse(settings),
        ...smsSettings,
        sms_status: smsStatus,
        email_status: emailStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update global settings (SMS keys saved here)
router.post('/', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await ensureGlobalSettingsTable();
    await ensureSmsSettingsTable();
    const settings = req.body || {};
    const hasSmsPayload = Object.keys(settings).some((key) => SMS_SETTING_KEYS.has(key));

    if (hasSmsPayload) {
      await saveSmsSettings(settings);
    }

    for (const [key, value] of Object.entries(settings)) {
      if (SMS_SETTING_KEYS.has(key)) continue;
      if (key === 'sms_status' || key.endsWith('_configured')) continue;
      if (value === undefined || value === null) continue;
      const strVal = normalizeSettingForStorage(key, value);
      if (SENSITIVE_KEYS.has(key) && (strVal.includes('*') || strVal === '')) {
        continue;
      }
      if (EMAIL_SETTING_KEYS.has(key) && SENSITIVE_KEYS.has(key)) {
        const encrypted = encryptSecret(strVal);
        await query(
          'INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          [key, encrypted, encrypted]
        );
        continue;
      }
      await query(
        'INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, strVal, strVal]
      );
    }
    await refreshSmsConfig();
    await refreshEmailConfig();
    const smsStatus = getPublicSmsStatus();
    const emailStatus = getPublicEmailStatus();
    res.json({
      success: true,
      message:
        smsStatus.smsConfigured
          ? 'Settings saved. SMS OTP service is active.'
          : 'Settings saved. SMS OTP fields complete karein.',
      data: { sms_status: smsStatus, email_status: emailStatus },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Test SMS from Super Admin panel
router.post('/test-sms', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Test mobile number required.',
        errors: { test_phone: 'Test mobile number required hai.' },
      });
    }
    await ensureSmsSettingsTable();
    await refreshSmsConfig();
    const status = getPublicSmsStatus();
    if (!status.smsConfigured) {
      return res.status(400).json({
        success: false,
        message:
          Object.values(status.errors || {})[0] ||
          'Pehle MSG91 ya 2Factor API key save karein (SMS OTP section).',
        errors: status.errors || {},
      });
    }
    const otp = generateOtp6();
    const result = await sendOtpToPhone(phone, otp);
    return res.json({
      success: true,
      message: 'Test SMS sent successfully. Phone par OTP check karein.',
      data: { deliveryMode: result.mode, provider: status.provider },
    });
  } catch (err) {
    return res.status(err.statusCode || 502).json({
      success: false,
      message: err.message,
      errors: err.fieldErrors || undefined,
    });
  }
});

module.exports = router;
