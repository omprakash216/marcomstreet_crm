# Forgot Password via Email OTP

This module implements a secure email-based forgot-password flow without breaking the existing SMS OTP flow used elsewhere in the app.

## Primary Endpoints

Base: `/api/auth/forgot-password`

### 1) Send OTP
`POST /send-otp`

Request:
```json
{
  "email": "admin@vanyagroup.com"
}
```

Response:
```json
{
  "success": true,
  "message": "If this email is registered, OTP has been sent.",
  "data": {
    "expiresAt": "2026-06-17T12:34:56.000Z",
    "resendAvailableAt": "2026-06-17T12:30:56.000Z"
  }
}
```

### 2) Verify OTP
`POST /verify-otp`

Request:
```json
{
  "email": "admin@vanyagroup.com",
  "otp": "482913"
}
```

Success:
```json
{
  "success": true,
  "message": "OTP verified successfully.",
  "resetToken": "secure-temporary-token",
  "data": {
    "resetToken": "secure-temporary-token",
    "resetTokenExpiresAt": "2026-06-17T12:40:56.000Z"
  }
}
```

### 3) Reset Password
`POST /reset`

Request:
```json
{
  "email": "admin@vanyagroup.com",
  "resetToken": "secure-temporary-token",
  "newPassword": "Admin@12345!",
  "confirmPassword": "Admin@12345!"
}
```

Success:
```json
{
  "success": true,
  "message": "Password reset successfully. Please login."
}
```

## Legacy Aliases

For backward compatibility, these routes are also accepted:
- `/api/auth/forgot-password/request-otp`
- `/api/auth/forgot-password/verify-otp`
- `/api/auth/forgot-password/reset-password`
- `/api/auth/forgot-password/email/request`
- `/api/auth/forgot-password/email/verify`
- `/api/auth/forgot-password/email/resend`
- `/api/auth/forgot-password/email/reset`

## Security Controls

- OTPs are bcrypt-hashed before storage.
- OTP expiry: 5 minutes by default.
- OTP max attempts: 3 by default.
- Resend cooldown: 30 seconds.
- Per-email OTP cap: 5 per hour.
- Per-IP OTP cap: 10 per hour.
- Reset token is randomly generated, then hashed before storage.
- Reset token expiry: 10 minutes by default.
- Passwords are validated with strong password rules.
- After reset, all old OTP and reset-token rows for that email are invalidated.
- Generic responses reduce account enumeration.

## Database

The app stores both SMS and email reset data in the same `password_reset_otps` table. The email flow uses the additional fields below:

- `user_id`
- `email`
- `purpose`
- `max_attempts`
- `is_used`
- `used_at`
- `is_blocked`
- `reset_token_hash`
- `reset_token_expires_at`
- `ip_address`
- `user_agent`

See:
- `database/password_reset_otps.sql`
- `database/password_reset_email_otp.sql`

## SMTP Setup

Use any of these:
- Generic SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`
- Gmail shortcut: `GMAIL_USER`, `GMAIL_PASS`
- Brevo shortcut: `USE_BREVO_SMTP=true`, `BREVO_SMTP_USER`, `BREVO_SMTP_PASS`

Production me `ALLOW_EMAIL_PREVIEW` false rehna chahiye. Preview mode sirf local testing ke liye hai.

Super Admin panel me `Global System Settings` ka `Email OTP (Forgot Password)` section use karke bhi SMTP values save ki ja sakti hain. The backend reads the saved values and refreshes the transporter cache automatically.

Recommended OTP env:

```env
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=3
OTP_RESEND_COOLDOWN_SECONDS=30
RESET_TOKEN_EXPIRY_MINUTES=10
PASSWORD_RESET_BRAND_NAME=Vanya Group
OTP_PREFIX=VG
ALLOW_EMAIL_PREVIEW=false
```

## Quick Test

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password/send-otp \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@vanyagroup.com\"}"
```

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password/verify-otp \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@vanyagroup.com\",\"otp\":\"482913\"}"
```

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password/reset \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@vanyagroup.com\",\"resetToken\":\"secure-temporary-token\",\"newPassword\":\"Admin@12345!\",\"confirmPassword\":\"Admin@12345!\"}"
```
