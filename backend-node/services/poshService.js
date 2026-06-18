const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

const POSH_MODULE_KEY = 'posh';
const POSH_UPLOAD_ROOT = path.join(__dirname, '..', '..', 'private_uploads', 'posh');

function normalizeRole(role) {
  return String(role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

function isSuperAdmin(employee) {
  const role = normalizeRole(employee?.role);
  return role === 'superadmin' || role === 'super_admin';
}

function isHrAdmin(employee) {
  const role = normalizeRole(employee?.role);
  return ['admin', 'manager', 'human_resources', 'human_resource', 'hr', 'hr_manager', 'hr_admin'].includes(role);
}

async function hasColumn(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function addColumnIfMissing(table, column, ddl) {
  if (!(await hasColumn(table, column))) {
    await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

async function ensureCoreModuleTables() {
  await query(
    `CREATE TABLE IF NOT EXISTS modules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      code VARCHAR(120) NOT NULL UNIQUE,
      description TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'enabled',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS company_modules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      module_id INT NULL,
      module_key VARCHAR(80) NULL,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      enabled_by INT NULL,
      enabled_at DATETIME NULL,
      disabled_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_company_module_id (company_id, module_id),
      KEY idx_company_module_key (company_id, module_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await addColumnIfMissing('company_modules', 'module_id', 'INT NULL');
  await addColumnIfMissing('company_modules', 'module_key', 'VARCHAR(80) NULL');
  await addColumnIfMissing('company_modules', 'is_enabled', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addColumnIfMissing('company_modules', 'enabled_by', 'INT NULL');
  await addColumnIfMissing('company_modules', 'enabled_at', 'DATETIME NULL');
  await addColumnIfMissing('company_modules', 'disabled_at', 'DATETIME NULL');
}

async function ensureNotificationsTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      channel VARCHAR(20) DEFAULT 'inapp',
      recipient VARCHAR(255),
      template_code VARCHAR(120),
      status VARCHAR(20) DEFAULT 'queued',
      payload TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function ensurePoshSchema() {
  await ensureCoreModuleTables();
  await ensureNotificationsTable();
  await query(
    `INSERT INTO modules (name, code, description, status)
     SELECT 'POSH Portal', 'posh', 'Prevention of Sexual Harassment complaint and compliance module', 'enabled'
     WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code = 'posh')`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS posh_complaints (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      complaint_id VARCHAR(60) NOT NULL UNIQUE,
      company_id INT NOT NULL,
      employee_id INT NOT NULL,
      complaint_title VARCHAR(255) NOT NULL,
      complaint_description TEXT NOT NULL,
      accused_employee_id INT NULL,
      accused_name VARCHAR(160) NULL,
      accused_department VARCHAR(160) NULL,
      incident_date DATE NULL,
      incident_location VARCHAR(255) NULL,
      complaint_type VARCHAR(120) NULL,
      severity_level VARCHAR(30) NOT NULL DEFAULT 'Medium',
      anonymous_complaint TINYINT(1) NOT NULL DEFAULT 0,
      witness_name VARCHAR(160) NULL,
      witness_contact VARCHAR(120) NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Submitted',
      identity_revealed TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_posh_company_status (company_id, status),
      KEY idx_posh_employee (employee_id),
      KEY idx_posh_severity (severity_level)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS posh_evidence_files (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      complaint_id BIGINT NOT NULL,
      company_id INT NOT NULL,
      uploaded_by INT NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      mime_type VARCHAR(120) NULL,
      file_size BIGINT NOT NULL DEFAULT 0,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_posh_evidence_complaint (complaint_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS posh_icc_members (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      member_name VARCHAR(160) NOT NULL,
      employee_id INT NULL,
      role VARCHAR(60) NOT NULL DEFAULT 'ICC Member',
      email VARCHAR(180) NULL,
      phone VARCHAR(60) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      start_date DATE NULL,
      end_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_posh_icc_company (company_id, status),
      KEY idx_posh_icc_employee (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS posh_assignments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      complaint_id BIGINT NOT NULL,
      company_id INT NOT NULL,
      assigned_to INT NOT NULL,
      assigned_role VARCHAR(60) NULL,
      assigned_by INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_posh_assign_complaint (complaint_id),
      KEY idx_posh_assign_user (assigned_to)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS posh_investigations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      complaint_id BIGINT NOT NULL,
      company_id INT NOT NULL,
      investigator_id INT NOT NULL,
      notes TEXT NULL,
      internal_comments TEXT NULL,
      accused_response TEXT NULL,
      witness_statement TEXT NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_posh_investigation_complaint (complaint_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS posh_hearings (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      complaint_id BIGINT NOT NULL,
      company_id INT NOT NULL,
      hearing_date DATE NOT NULL,
      hearing_time TIME NULL,
      meeting_mode VARCHAR(30) NOT NULL DEFAULT 'Offline',
      meeting_location VARCHAR(255) NULL,
      meeting_link VARCHAR(500) NULL,
      attendees TEXT NULL,
      hearing_notes TEXT NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Scheduled',
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_posh_hearing_complaint (complaint_id),
      KEY idx_posh_hearing_date (hearing_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS posh_messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      complaint_id BIGINT NOT NULL,
      company_id INT NOT NULL,
      sender_id INT NOT NULL,
      sender_role VARCHAR(80) NULL,
      message TEXT NOT NULL,
      internal_only TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_posh_message_complaint (complaint_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS posh_resolutions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      complaint_id BIGINT NOT NULL UNIQUE,
      company_id INT NOT NULL,
      final_decision TEXT NOT NULL,
      action_taken VARCHAR(80) NOT NULL,
      resolution_summary TEXT NULL,
      closure_date DATE NULL,
      closed_by INT NOT NULL,
      employee_feedback TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS posh_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      company_id INT NULL,
      role VARCHAR(80) NULL,
      action VARCHAR(120) NOT NULL,
      module VARCHAR(60) NOT NULL DEFAULT 'posh',
      record_id VARCHAR(80) NULL,
      ip_address VARCHAR(80) NULL,
      user_agent VARCHAR(500) NULL,
      metadata TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_posh_audit_company (company_id, created_at),
      KEY idx_posh_audit_record (record_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS posh_settings (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      setting_key VARCHAR(120) NOT NULL,
      setting_value TEXT NULL,
      updated_by INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_posh_setting (company_id, setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function getPoshModuleId() {
  await ensurePoshSchema();
  const rows = await query('SELECT id FROM modules WHERE code = ? LIMIT 1', [POSH_MODULE_KEY]);
  return rows?.[0]?.id || null;
}

async function hasCompanyPoshAccess(companyId) {
  if (!companyId) return false;
  await ensurePoshSchema();
  const moduleId = await getPoshModuleId();
  const rows = await query(
    `SELECT cm.id
     FROM company_modules cm
     LEFT JOIN modules m ON m.id = cm.module_id
     WHERE cm.company_id = ?
       AND COALESCE(cm.is_enabled, 1) = 1
       AND (cm.module_key = ? OR m.code = ? OR cm.module_id = ?)
     LIMIT 1`,
    [companyId, POSH_MODULE_KEY, POSH_MODULE_KEY, moduleId]
  );
  return !!rows?.[0];
}

async function setCompanyPoshAccess({ companyId, enabled, actorId }) {
  await ensurePoshSchema();
  const moduleId = await getPoshModuleId();
  const existing = await query(
    `SELECT id FROM company_modules
     WHERE company_id = ? AND (module_id = ? OR module_key = ?)
     ORDER BY id ASC LIMIT 1`,
    [companyId, moduleId, POSH_MODULE_KEY]
  );
  if (existing?.[0]) {
    await query(
      `UPDATE company_modules
       SET module_id = ?, module_key = ?, is_enabled = ?, enabled_by = ?,
           enabled_at = CASE WHEN ? = 1 THEN COALESCE(enabled_at, NOW()) ELSE enabled_at END,
           disabled_at = CASE WHEN ? = 0 THEN NOW() ELSE NULL END
       WHERE id = ?`,
      [moduleId, POSH_MODULE_KEY, enabled ? 1 : 0, actorId || null, enabled ? 1 : 0, enabled ? 1 : 0, existing[0].id]
    );
  } else {
    await query(
      `INSERT INTO company_modules
        (company_id, module_id, module_key, is_enabled, enabled_by, enabled_at, disabled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        moduleId,
        POSH_MODULE_KEY,
        enabled ? 1 : 0,
        actorId || null,
        enabled ? new Date() : null,
        enabled ? null : new Date(),
      ]
    );
  }
}

async function logPoshAudit(req, action, recordId, metadata = {}) {
  const employee = req?.employee || {};
  await ensurePoshSchema();
  await query(
    `INSERT INTO posh_audit_logs
      (user_id, company_id, role, action, module, record_id, ip_address, user_agent, metadata)
     VALUES (?, ?, ?, ?, 'posh', ?, ?, ?, ?)`,
    [
      employee.id || null,
      employee.company_id || metadata.company_id || null,
      employee.role || null,
      action,
      recordId ? String(recordId) : null,
      req?.ip || null,
      String(req?.headers?.['user-agent'] || '').slice(0, 500),
      JSON.stringify(metadata || {}),
    ]
  );
}

async function createNotification({ recipient, templateCode, payload }) {
  await ensureNotificationsTable();
  await query(
    `INSERT INTO notifications (channel, recipient, template_code, status, payload)
     VALUES ('inapp', ?, ?, 'queued', ?)`,
    [String(recipient || ''), templateCode || 'posh_update', JSON.stringify(payload || {})]
  ).catch(() => {});
}

function makeComplaintId(companyId) {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `POSH-${companyId || 'C'}-${stamp}-${Math.floor(Math.random() * 900 + 100)}`;
}

function ensureUploadDir(companyId) {
  const dir = path.join(POSH_UPLOAD_ROOT, String(companyId || 'global'));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeJsonParse(value, fallback = []) {
  try {
    if (Array.isArray(value) || typeof value === 'object') return value;
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function getIccMember(employeeId, companyId) {
  if (!employeeId || !companyId) return null;
  await ensurePoshSchema();
  const rows = await query(
    `SELECT * FROM posh_icc_members
     WHERE employee_id = ? AND company_id = ? AND status = 'active'
     ORDER BY id DESC LIMIT 1`,
    [employeeId, companyId]
  );
  return rows?.[0] || null;
}

async function isAssignedToComplaint(employeeId, complaintId) {
  if (!employeeId || !complaintId) return false;
  const rows = await query(
    `SELECT id FROM posh_assignments
     WHERE complaint_id = ? AND assigned_to = ? AND status = 'active'
     LIMIT 1`,
    [complaintId, employeeId]
  );
  return !!rows?.[0];
}

async function canAccessComplaint(employee, complaint, scope = 'view') {
  if (!employee || !complaint) return false;
  if (isSuperAdmin(employee)) return true;
  if (Number(employee.company_id) !== Number(complaint.company_id)) return false;
  if (isHrAdmin(employee)) return true;
  if (Number(complaint.employee_id) === Number(employee.id)) return true;
  const icc = await getIccMember(employee.id, employee.company_id);
  if (icc && (await isAssignedToComplaint(employee.id, complaint.id))) return true;
  if (scope === 'icc_member' && icc) return true;
  return false;
}

async function canRevealIdentity(employee, complaint) {
  if (!complaint?.anonymous_complaint) return true;
  if (isSuperAdmin(employee)) return true;
  const icc = await getIccMember(employee?.id, complaint.company_id);
  return !!icc && String(icc.role || '').toLowerCase() === 'icc head';
}

async function maskComplaintIdentity(complaint, employee) {
  const out = { ...complaint };
  const reveal = await canRevealIdentity(employee, complaint);
  if (out.anonymous_complaint && !out.identity_revealed && !reveal) {
    out.employee_id = null;
    out.employee_name = 'Anonymous Complainant';
    out.employee_email = '';
    out.employee_phone = '';
  }
  return out;
}

async function getComplaintById(id) {
  await ensurePoshSchema();
  const rows = await query(
    `SELECT pc.*, e.name AS employee_name, e.email AS employee_email, e.phone AS employee_phone,
            ae.name AS accused_employee_name
     FROM posh_complaints pc
     LEFT JOIN employees e ON e.id = pc.employee_id
     LEFT JOIN employees ae ON ae.id = pc.accused_employee_id
     WHERE pc.id = ? AND pc.deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  return rows?.[0] || null;
}

module.exports = {
  POSH_MODULE_KEY,
  POSH_UPLOAD_ROOT,
  normalizeRole,
  isSuperAdmin,
  isHrAdmin,
  ensurePoshSchema,
  getPoshModuleId,
  hasCompanyPoshAccess,
  setCompanyPoshAccess,
  logPoshAudit,
  createNotification,
  makeComplaintId,
  ensureUploadDir,
  safeJsonParse,
  getIccMember,
  canAccessComplaint,
  canRevealIdentity,
  maskComplaintIdentity,
  getComplaintById,
};
