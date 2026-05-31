const express = require('express');
const {
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  resetPasswordWithVerifiedOtp,
} = require('../../controllers/auth/passwordResetController');
const {
  validateForgotPasswordRequest,
  validateVerifyOtpRequest,
  validateResetPasswordRequest,
  forgotPasswordRateLimit,
  resendOtpRateLimit,
  verifyOtpRateLimit,
  resetPasswordRateLimit,
} = require('../../middleware/validation/passwordResetValidation');

const router = express.Router();

router.post('/request', forgotPasswordRateLimit, validateForgotPasswordRequest, requestPasswordResetOtp);
router.post('/verify', verifyOtpRateLimit, validateVerifyOtpRequest, verifyPasswordResetOtp);
router.post('/resend', resendOtpRateLimit, validateForgotPasswordRequest, resendPasswordResetOtp);
router.post('/reset', resetPasswordRateLimit, validateResetPasswordRequest, resetPasswordWithVerifiedOtp);

module.exports = router;
