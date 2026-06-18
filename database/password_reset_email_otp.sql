-- Email OTP compatibility migration for existing installs that already have the SMS OTP table
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS user_id INT NULL;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS purpose VARCHAR(50) NOT NULL DEFAULT 'forgot_password';
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 3;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS is_used TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS used_at DATETIME NULL;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS is_blocked TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS reset_token_hash CHAR(64) NULL;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS reset_token_expires_at DATETIME NULL;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64) NULL;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255) NULL;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS consumed TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS provider VARCHAR(30) NULL;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS provider_session_id VARCHAR(180) NULL;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS sms_mobile VARCHAR(24) NULL;
ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS sent_at DATETIME NULL;
