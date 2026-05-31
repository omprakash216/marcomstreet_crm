# Forgot Password & Reset Password (Email OTP)

## Overview
This module adds isolated email OTP based password reset flow without changing existing login/SMS modules.

## Endpoints
Base: `/api/auth/forgot-password/email`

### 1) Request OTP
`POST /request`

Request:
```json
{
  "email": "user@company.com"
}
```

Response (generic, anti-enumeration):
```json
{
  "success": true,
  "message": "If this email is registered, an OTP has been sent."
}
```

### 2) Verify OTP
`POST /verify`

Request:
```json
{
  "email": "user@company.com",
  "otp": "123456"
}
```

Success:
```json
{
  "success": true,
  "message": "OTP verified successfully."
}
```

### 3) Resend OTP
`POST /resend`

Request:
```json
{
  "email": "user@company.com"
}
```

Response:
```json
{
  "success": true,
  "message": "If this email is registered, an OTP has been sent."
}
```

### 4) Reset Password
`POST /reset`

Request:
```json
{
  "email": "user@company.com",
  "newPassword": "Strong@123"
}
```

Success:
```json
{
  "success": true,
  "message": "Password reset successful. Please login with your new password."
}
```

## Security Controls
- OTP hashed with bcrypt.
- OTP expiry: 5 minutes.
- OTP attempt lock after max attempts.
- Resend cooldown: 30 seconds.
- Generic responses for request/resend to prevent email enumeration.
- Request rate-limiting by IP + email.
- Password strength validation.
- OTP replay prevention (`otp` cleared after verify).
- JWT invalidation via `tokenVersion` increment on password reset.

## SMTP Setup
Use one of:
- Generic SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`)
- Gmail (`GMAIL_USER`, `GMAIL_PASS`)
- Brevo (`USE_BREVO_SMTP=true`, `BREVO_SMTP_USER`, `BREVO_SMTP_PASS`)

## DB Update
Run SQL from:
- `database/password_reset_email_otp.sql`

## Quick Test (curl)
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password/email/request \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@company.com\"}"
```

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password/email/verify \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@company.com\",\"otp\":\"123456\"}"
```

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password/email/reset \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@company.com\",\"newPassword\":\"Strong@123\"}"
```

## Deployment Notes
- Set production SMTP credentials in `backend-node/.env`.
- Keep `DISABLE_EMAIL_SENDING=false` in production.
- If using Gmail, use an app password (not account password).
- Ensure reverse proxy passes real client IP (`X-Forwarded-For`) for rate-limiting quality.
