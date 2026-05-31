#!/usr/bin/env node
/**
 * Command Center bootstrap migration.
 * Creates core SaaS control tables if they don't exist:
 * - modules, plan_modules, company_modules
 * - company_usage
 * - system_metrics
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getConnection } = require('../config/database');
const bcrypt = require('bcryptjs');

const statements = [
  `CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    billing_cycle ENUM('monthly','yearly') DEFAULT 'monthly',
    user_limit INT DEFAULT 10,
    storage_limit_gb INT DEFAULT 5,
    modules_included JSON,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(60) NOT NULL UNIQUE,
    description VARCHAR(255),
    status ENUM('enabled','disabled') DEFAULT 'enabled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS plan_modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_id INT NOT NULL,
    module_id INT NOT NULL,
    UNIQUE KEY plan_module_unique (plan_id, module_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS company_modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    module_id INT NOT NULL,
    status ENUM('enabled','disabled') DEFAULT 'enabled',
    UNIQUE KEY company_module_unique (company_id, module_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS company_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    total_users INT DEFAULT 0,
    total_leads INT DEFAULT 0,
    total_deals INT DEFAULT 0,
    total_employees INT DEFAULT 0,
    storage_mb INT DEFAULT 0,
    api_requests INT DEFAULT 0,
    last_activity DATETIME NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS system_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    metric_time DATETIME NOT NULL,
    cpu_usage DECIMAL(5,2) DEFAULT 0,
    memory_usage_mb INT DEFAULT 0,
    api_requests INT DEFAULT 0,
    active_sessions INT DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    plan_id INT NOT NULL,
    status ENUM('active','suspended','trial','canceled','expired') DEFAULT 'trial',
    billing_cycle ENUM('monthly','yearly') DEFAULT 'monthly',
    monthly_amount DECIMAL(10,2) DEFAULT 0,
    yearly_amount DECIMAL(10,2) DEFAULT 0,
    trial_end DATE NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS subscription_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subscription_id INT NOT NULL,
    company_id INT NOT NULL,
    old_plan_id INT NULL,
    new_plan_id INT NULL,
    action VARCHAR(60) NOT NULL,
    notes VARCHAR(255) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_sub_hist_company (company_id),
    KEY idx_sub_hist_subscription (subscription_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subscription_id INT NOT NULL,
    invoice_number VARCHAR(64) UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status ENUM('draft','open','paid','void','refunded') DEFAULT 'open',
    due_date DATE,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT,
    gateway VARCHAR(50),
    amount DECIMAL(10,2),
    currency VARCHAR(10) DEFAULT 'USD',
    status ENUM('pending','succeeded','failed','refunded') DEFAULT 'pending',
    reference VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS crm_pipelines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS crm_stages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pipeline_id INT NOT NULL,
    name VARCHAR(120) NOT NULL,
    position INT DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS crm_sources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    active TINYINT(1) DEFAULT 1
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS leave_policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    annual_quota INT DEFAULT 0,
    carry_forward INT DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS attendance_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120),
    check_in_grace_min INT DEFAULT 0,
    half_day_after_min INT DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS shift_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120),
    start_time TIME,
    end_time TIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS payroll_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120),
    base_pay DECIMAL(10,2) DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    company_id INT NULL,
    api_key VARCHAR(128) UNIQUE,
    key_value VARCHAR(128) NULL,
    webhook_url VARCHAR(512) NULL,
    status ENUM('active','revoked') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_api_keys_company (company_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS api_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    api_key_id INT,
    endpoint VARCHAR(255),
    method VARCHAR(8),
    status INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS webhooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NULL,
    event VARCHAR(120) NOT NULL,
    target_url VARCHAR(512) NOT NULL,
    secret VARCHAR(128) NULL,
    status ENUM('active','disabled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_webhooks_company (company_id),
    KEY idx_webhooks_event (event)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel ENUM('email','sms','whatsapp','inapp') DEFAULT 'inapp',
    recipient VARCHAR(255),
    template_code VARCHAR(120),
    status ENUM('queued','sent','failed') DEFAULT 'queued',
    payload JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS notification_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(120) UNIQUE,
    channel ENUM('email','sms','whatsapp','inapp') DEFAULT 'inapp',
    subject VARCHAR(255),
    body TEXT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS feature_flags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    feature_name VARCHAR(120) NOT NULL UNIQUE,
    status ENUM('enabled','disabled') DEFAULT 'disabled',
    description VARCHAR(255) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS global_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(120) NOT NULL UNIQUE,
    setting_value TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NULL,
    user_id INT NULL,
    module VARCHAR(120) NULL,
    action TEXT NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_company (company_id),
    KEY idx_audit_user (user_id),
    KEY idx_audit_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS login_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    company_id INT NULL,
    token_hash VARCHAR(255) NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP NULL,
    ended_at TIMESTAMP NULL,
    status ENUM('active','ended') DEFAULT 'active',
    KEY idx_sessions_user (user_id),
    KEY idx_sessions_company (company_id),
    KEY idx_sessions_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  `CREATE TABLE IF NOT EXISTS backups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NULL,
    kind VARCHAR(60) NULL,
    location VARCHAR(255),
    status ENUM('pending','completed','failed') DEFAULT 'pending',
    meta JSON NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_backups_company (company_id),
    KEY idx_backups_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
];

const seedModules = [
  ['CRM', 'crm', 'Customer relationship management'],
  ['HRMS', 'hrms', 'Human resources management'],
  ['Projects', 'projects', 'Project tracking'],
  ['Finance', 'finance', 'Billing & finance'],
  ['Helpdesk', 'helpdesk', 'Support desk'],
  ['Inventory', 'inventory', 'Inventory and stock'],
  ['Recruitment', 'recruitment', 'Hiring pipeline'],
  ['Analytics', 'analytics', 'Insights and reporting'],
];

async function run() {
  const conn = await getConnection();
  try {
    for (const sql of statements) {
      await conn.execute(sql);
    }

    // Backward-compatible columns for invoices (older schema may lack subscription_id)
    try {
      await conn.execute('ALTER TABLE invoices ADD COLUMN subscription_id INT NULL');
    } catch (e) {
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(e.message || '')))) throw e;
    }
    try {
      await conn.execute('ALTER TABLE invoices ADD COLUMN issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    } catch (e) {
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(e.message || '')))) throw e;
    }

    // Backward-compatible API keys normalization:
    // - Older schema may only have `key_value`
    // - Middleware expects `api_key`
    try {
      await conn.execute('ALTER TABLE api_keys ADD COLUMN user_id INT NULL');
    } catch (e) {
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(e.message || '')))) throw e;
    }
    try {
      await conn.execute('ALTER TABLE api_keys ADD COLUMN api_key VARCHAR(128) UNIQUE');
    } catch (e) {
      // ignore: already exists / duplicate
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(e.message || '')))) throw e;
    }
    try {
      await conn.execute('ALTER TABLE api_keys ADD COLUMN company_id INT NULL');
    } catch (e) {
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(e.message || '')))) throw e;
    }
    try {
      await conn.execute('ALTER TABLE api_keys ADD COLUMN webhook_url VARCHAR(512) NULL');
    } catch (e) {
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(e.message || '')))) throw e;
    }
    try {
      await conn.execute('ALTER TABLE api_keys ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    } catch (e) {
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(e.message || '')))) throw e;
    }
    try {
      await conn.execute('UPDATE api_keys SET api_key = key_value WHERE (api_key IS NULL OR api_key = \'\') AND key_value IS NOT NULL');
    } catch (e) {
      // ignore if key_value doesn't exist
      if (!(e && (e.code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(e.message || '')))) throw e;
    }
    // seed modules if empty
    const [rows] = await conn.execute('SELECT COUNT(*) as c FROM modules');
    if (rows[0].c === 0) {
      await conn.query(
        'INSERT INTO modules (name, code, description, status) VALUES ?',
        [seedModules.map(m => [...m, 'enabled'])]
      );
      console.log('Seeded default modules.');
    }

    // Backward-compatible backups columns (older schema had only location/status/created_at)
    const safeAlter = async (sql) => {
      try {
        await conn.execute(sql);
      } catch (e) {
        if (e && (e.code === 'ER_DUP_FIELDNAME' || /Duplicate column/i.test(e.message || ''))) return;
        throw e;
      }
    };
    await safeAlter('ALTER TABLE backups ADD COLUMN company_id INT NULL');
    await safeAlter('ALTER TABLE backups ADD COLUMN kind VARCHAR(60) NULL');
    await safeAlter('ALTER TABLE backups ADD COLUMN meta JSON NULL');
    await safeAlter('ALTER TABLE backups ADD COLUMN created_by INT NULL');

    // Seed a Super Admin user if missing (needed to access /superadmin routes)
    const superEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@crm.com').trim();
    const superPassword = String(process.env.SUPERADMIN_PASSWORD || 'password123');
    const [existingAdminRows] = await conn.execute(
      'SELECT id FROM employees WHERE LOWER(email)=LOWER(?) LIMIT 1',
      [superEmail]
    );
    if (!existingAdminRows || existingAdminRows.length === 0) {
      const hash = await bcrypt.hash(superPassword, 10);
      let employeeCode = 'SA-0001';
      const [codeRows] = await conn.execute('SELECT id FROM employees WHERE employee_code=? LIMIT 1', [employeeCode]);
      if (codeRows && codeRows.length) {
        employeeCode = `SA-${Date.now()}`;
      }
      await conn.execute(
        "INSERT INTO employees (employee_code, name, email, password, role, status, company_id) VALUES (?, ?, ?, ?, 'superadmin', 'active', 1)",
        [employeeCode, 'Super Admin', superEmail, hash]
      );
      console.log(`Seeded Super Admin: ${superEmail}`);
    }
    console.log('Command Center migration completed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
  }
}

run();
