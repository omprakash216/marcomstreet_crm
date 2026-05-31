/**
 * Save SMS API keys to global_settings + .env
 *
 * MSG91:
 *   node scripts/configure-sms.js --msg91=YOUR_AUTH_KEY
 *
 * 2Factor.in (India, quick setup):
 *   node scripts/configure-sms.js --2factor=YOUR_API_KEY
 */
require('../config/env');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const { refreshSmsConfig } = require('../config/smsConfig');

const args = process.argv.slice(2);
const opts = {};
for (const a of args) {
  const m = a.match(/^--([^=]+)=(.+)$/);
  if (m) opts[m[1]] = m[2];
}

async function upsertSetting(key, value) {
  await query(
    'INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    [key, String(value)]
  );
}

async function ensureTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS global_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(120) NOT NULL UNIQUE,
      setting_value TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

function patchEnvFile(updates) {
  const envPath = path.join(__dirname, '..', '.env');
  let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(text)) {
      text = text.replace(re, line);
    } else {
      text = `${text.trim()}\n${line}\n`;
    }
  }
  fs.writeFileSync(envPath, text, 'utf8');
}

(async () => {
  const msg91 = opts.msg91 || opts.MSG91;
  const twoFactor = opts['2factor'] || opts.twofactor || opts.TWO_FACTOR;
  const fast2sms = opts.fast2sms || opts.FAST2SMS;

  if (!msg91 && !twoFactor && !fast2sms) {
    console.error('Usage:');
    console.error('  node scripts/configure-sms.js --msg91=AUTH_KEY');
    console.error('  node scripts/configure-sms.js --2factor=API_KEY');
    console.error('  node scripts/configure-sms.js --fast2sms=API_KEY');
    process.exit(1);
  }

  await ensureTable();

  if (msg91) {
    await upsertSetting('msg91_auth_key', msg91);
    await upsertSetting('msg91_sender_id', 'VG');
    await upsertSetting('otp_prefix', 'VG');
    await upsertSetting('sms_provider', 'msg91');
    patchEnvFile({
      MSG91_AUTH_KEY: msg91,
      MSG91_SENDER_ID: 'VG',
      OTP_PREFIX: 'VG',
      SMS_PROVIDER: 'msg91',
    });
    console.log('MSG91 configured (DB + .env)');
  }

  if (twoFactor) {
    await upsertSetting('two_factor_api_key', twoFactor);
    await upsertSetting('otp_prefix', 'VG');
    await upsertSetting('sms_provider', '2factor');
    patchEnvFile({
      TWO_FACTOR_API_KEY: twoFactor,
      OTP_PREFIX: 'VG',
      SMS_PROVIDER: '2factor',
    });
    console.log('2Factor.in configured (DB + .env)');
  }

  if (fast2sms) {
    await upsertSetting('fast2sms_api_key', fast2sms);
    await upsertSetting('sms_provider', 'fast2sms');
    patchEnvFile({ FAST2SMS_API_KEY: fast2sms, SMS_PROVIDER: 'fast2sms' });
    console.log('Fast2SMS configured (DB + .env)');
  }

  const cfg = await refreshSmsConfig();
  console.log('SMS ready:', !!(cfg.MSG91_AUTH_KEY || cfg.TWO_FACTOR_API_KEY || cfg.FAST2SMS_API_KEY));
  console.log('Test: npm run test:sms -- 8083866879');
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
