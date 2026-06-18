function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildPasswordResetOtpTemplate({ brandName, otpDisplay, expiryMinutes, logoUrl }) {
  const safeBrandName = escapeHtml(brandName || 'Vanya Group');
  const safeOtpDisplay = escapeHtml(otpDisplay || 'VG-000000');
  const safeExpiry = Number(expiryMinutes) > 0 ? Number(expiryMinutes) : 5;
  const safeLogoUrl = String(logoUrl || '').trim();
  const subject = `Your ${safeBrandName} Password Reset OTP`;

  const text = [
    `You requested to reset your password for ${safeBrandName}.`,
    `Your OTP is ${safeOtpDisplay}.`,
    `It is valid for ${safeExpiry} minutes.`,
    'Do not share this OTP with anyone.',
    'If you did not request this, please ignore this email.',
  ].join(' ');

  const logoMarkup = safeLogoUrl
    ? `<img src="${escapeHtml(safeLogoUrl)}" alt="${safeBrandName}" style="display:block;width:72px;height:72px;object-fit:contain;border-radius:20px;" />`
    : `<div style="width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;letter-spacing:0.08em;">VG</div>`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef4ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
      <div style="background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%);border:1px solid #dbe7ff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.10);">
        <div style="padding:28px 28px 18px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 60%,#2563eb 100%);color:#fff;">
          <div style="display:flex;align-items:center;gap:16px;">
            ${logoMarkup}
            <div>
              <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.82;">Password Reset</div>
              <h1 style="margin:6px 0 0;font-size:24px;line-height:1.2;">${safeBrandName}</h1>
            </div>
          </div>
        </div>

        <div style="padding:32px 28px 28px;">
          <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">You requested to reset your password.</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#475569;">
            Use the OTP below to continue with the password reset flow. It expires in ${safeExpiry} minutes.
          </p>

          <div style="margin:0 auto 22px;max-width:360px;padding:18px 20px;border-radius:18px;border:1px dashed #8bb3ff;background:#eff6ff;text-align:center;">
            <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#2563eb;font-weight:700;margin-bottom:10px;">
              One-time code
            </div>
            <div style="font-size:34px;line-height:1.1;font-weight:800;letter-spacing:0.2em;color:#0f172a;">${safeOtpDisplay}</div>
          </div>

          <div style="border-radius:16px;background:#fff7ed;border:1px solid #fdba74;padding:14px 16px;color:#9a3412;font-size:13px;line-height:1.65;">
            Do not share this OTP with anyone. If you did not request this password reset, you can safely ignore this email.
          </div>
        </div>

        <div style="padding:18px 28px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;">
          This is an automated message from ${safeBrandName}. Please do not reply to this email.
        </div>
      </div>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

module.exports = { buildPasswordResetOtpTemplate };
