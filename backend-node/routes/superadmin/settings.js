const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');
const {
  refreshSmsConfig,
  getPublicSmsStatus,
  maskSecret,
  ensureGlobalSettingsTable,
} = require('../../config/smsConfig');
const { sendOtpToPhone, generateOtp6, formatOtpDisplay } = require('../../services/passwordResetOtp');

const router = express.Router();

const SENSITIVE_KEYS = new Set([
  'msg91_auth_key',
  'fast2sms_api_key',
  'two_factor_api_key',
  'twilio_auth_token',
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
  return str;
}

// Get global settings
router.get('/', async (req, res) => {
  try {
    await ensureGlobalSettingsTable();
    await refreshSmsConfig();
    const rows = await query('SELECT * FROM global_settings');
    const settings = {};
    rows.forEach((r) => {
      settings[r.setting_key] = r.setting_value;
    });
    const smsStatus = getPublicSmsStatus();
    res.json({
      success: true,
      data: {
        ...maskSettingsForResponse(settings),
        sms_status: smsStatus,
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
    const settings = req.body || {};
    for (const [key, value] of Object.entries(settings)) {
      if (key === 'sms_status' || key.endsWith('_configured')) continue;
      if (value === undefined || value === null) continue;
      const strVal = normalizeSettingForStorage(key, value);
      if (SENSITIVE_KEYS.has(key) && (strVal.includes('*') || strVal === '')) {
        continue;
      }
      await query(
        'INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, strVal, strVal]
      );
    }
    await refreshSmsConfig();
    const smsStatus = getPublicSmsStatus();
    res.json({
      success: true,
      message: smsStatus.smsConfigured
        ? 'Settings saved. SMS OTP service is active.'
        : 'Settings saved. Add MSG91 or 2Factor API key to enable SMS OTP.',
      data: { sms_status: smsStatus },
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
      return res.status(400).json({ success: false, message: 'Test mobile number required.' });
    }
    await refreshSmsConfig();
    const status = getPublicSmsStatus();
    if (!status.smsConfigured) {
      return res.status(400).json({
        success: false,
        message: 'Pehle MSG91 ya 2Factor API key save karein (SMS OTP section).',
      });
    }
    const otp = generateOtp6();
    const result = await sendOtpToPhone(phone, otp);
    return res.json({
      success: true,
      message: `Test SMS bheja gaya (${formatOtpDisplay(otp)}). Phone check karein.`,
      data: { deliveryMode: result.mode, provider: status.provider },
    });
  } catch (err) {
    return res.status(502).json({ success: false, message: err.message });
  }
});

module.exports = router;
