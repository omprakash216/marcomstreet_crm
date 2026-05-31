/**
 * Test SMS config: node scripts/test-sms.js 8083866879
 * Requires MSG91_AUTH_KEY (or FAST2SMS_API_KEY) in backend-node/.env
 */
require('../config/env');
const { refreshSmsConfig, getPublicSmsStatus } = require('../config/smsConfig');
const { sendOtpToPhone, formatOtpDisplay, generateOtp6 } = require('../services/passwordResetOtp');

const phone = process.argv[2];
if (!phone) {
  console.error('Usage: node scripts/test-sms.js <10-digit-mobile>');
  console.error('Example: node scripts/test-sms.js 8083866879');
  process.exit(1);
}

(async () => {
  await refreshSmsConfig();
  const status = getPublicSmsStatus();
  console.log('SMS status:', status);
  if (!status.smsConfigured) {
    console.error('\nConfigure SMS:');
    console.error('  node scripts/configure-sms.js --msg91=YOUR_KEY');
    console.error('  OR Super Admin → System Settings → SMS OTP\n');
    process.exit(1);
  }
  const otp = generateOtp6();
  console.log('Sending test OTP', formatOtpDisplay(otp), 'to', phone, '...');
  try {
    const r = await sendOtpToPhone(phone, otp);
    console.log('SUCCESS:', r);
    console.log('Check phone for SMS.');
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
  }
})();
