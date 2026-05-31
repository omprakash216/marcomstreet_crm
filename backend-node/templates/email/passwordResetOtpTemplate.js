function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildPasswordResetOtpTemplate({ appName, otp, expiryMinutes }) {
  const safeAppName = escapeHtml(appName || 'MARCOM STREET CRM');
  const safeOtp = escapeHtml(otp || '');
  const safeExpiry = Number(expiryMinutes) > 0 ? Number(expiryMinutes) : 5;

  const subject = `${safeAppName} Password Reset OTP`;
  const text = `Your ${safeAppName} password reset OTP is ${safeOtp}. It expires in ${safeExpiry} minutes. If you did not request this, please ignore this email.`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${subject}</title>
    <style>
      body { margin: 0; padding: 0; background: #f5f8ff; font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
      .wrap { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
      .card { background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; }
      .head { background: linear-gradient(135deg,#1d4ed8,#4338ca); padding: 20px 24px; color: #ffffff; }
      .head h1 { margin: 0; font-size: 18px; letter-spacing: .2px; }
      .body { padding: 24px; }
      .otp { margin: 20px 0; font-size: 32px; letter-spacing: 8px; text-align: center; font-weight: 700; color: #1d4ed8; background: #eff6ff; border: 1px dashed #93c5fd; border-radius: 12px; padding: 16px 8px; }
      .note { font-size: 14px; line-height: 1.55; color: #4b5563; }
      .warn { margin-top: 16px; padding: 12px; border-radius: 10px; background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; font-size: 13px; }
      .foot { padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
      @media (max-width: 600px) {
        .body, .head, .foot { padding: 18px; }
        .otp { font-size: 28px; letter-spacing: 6px; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="head">
          <h1>${safeAppName}</h1>
        </div>
        <div class="body">
          <p>Hello,</p>
          <p class="note">We received a request to reset your account password. Use this OTP to continue:</p>
          <div class="otp">${safeOtp}</div>
          <p class="note">This OTP will expire in <strong>${safeExpiry} minutes</strong>.</p>
          <div class="warn">
            Security note: Never share this OTP with anyone. If you did not request a password reset, you can safely ignore this email.
          </div>
        </div>
        <div class="foot">
          This is an automated message from ${safeAppName}. Please do not reply to this email.
        </div>
      </div>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

module.exports = { buildPasswordResetOtpTemplate };
