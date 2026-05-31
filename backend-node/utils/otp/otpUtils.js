const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const OTP_LENGTH = 6;

function generateNumericOtp(length = OTP_LENGTH) {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(crypto.randomInt(min, max));
}

function sanitizeOtp(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, OTP_LENGTH);
}

async function hashOtp(otp) {
  return bcrypt.hash(String(otp), 10);
}

async function compareOtp(plainOtp, hashedOtp) {
  if (!plainOtp || !hashedOtp) return false;
  return bcrypt.compare(String(plainOtp), String(hashedOtp));
}

function otpExpiryDate(minutes = 5) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function cooldownDate(seconds = 30) {
  return new Date(Date.now() + seconds * 1000);
}

module.exports = {
  OTP_LENGTH,
  generateNumericOtp,
  sanitizeOtp,
  hashOtp,
  compareOtp,
  otpExpiryDate,
  cooldownDate,
};
