const express = require('express');
const {
  requestPasswordResetOtp,
  resendPasswordResetOtp,
  verifyPasswordResetOtp,
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

router.post('/send-otp', forgotPasswordRateLimit, validateForgotPasswordRequest, requestPasswordResetOtp);
router.post('/request', forgotPasswordRateLimit, validateForgotPasswordRequest, requestPasswordResetOtp);
router.post('/resend-otp', resendOtpRateLimit, validateForgotPasswordRequest, resendPasswordResetOtp);
router.post('/resend', resendOtpRateLimit, validateForgotPasswordRequest, resendPasswordResetOtp);
router.post('/verify-otp', verifyOtpRateLimit, validateVerifyOtpRequest, verifyPasswordResetOtp);
router.post('/verify', verifyOtpRateLimit, validateVerifyOtpRequest, verifyPasswordResetOtp);
router.post('/reset', resetPasswordRateLimit, validateResetPasswordRequest, resetPasswordWithVerifiedOtp);
router.post('/reset-password', resetPasswordRateLimit, validateResetPasswordRequest, resetPasswordWithVerifiedOtp);

module.exports = router;
