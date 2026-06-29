const express = require('express');

const path = require('path');

const fs = require('fs');

const multer = require('multer');

const { query, getConnection } = require('../config/database');

const { verifyToken } = require('../middleware/auth');
const { cleanParams, getSafePagination } = require('../utils/queryHelpers');

const bcrypt = require('bcryptjs');

const { getIntegrationStats } = require('../services/apiIntegration');

const { getAdminAttendanceAnalytics } = require('../services/workTimer');
const {
  generateEmployeeCode,
  getDesignationById,
  isEmployeeCodeDuplicateError,
  isEmployeeCodeValidationError,
  runSql,
} = require('../utils/employeeCode');
const { buildCompanyAdminEmployeeCode, buildCompanyScopedEmployeeCode, normalizeCompanyCode } = require('../utils/companyCode');
const { ensureEmployeeCodeSchema } = require('../utils/employeeCodeSchema');



const router = express.Router();



function requireAdmin(req, res, next) {

  const role = String(req.employee.role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

  if (role !== 'admin' && role !== 'manager' && role !== 'superadmin' && role !== 'super_admin') return res.status(403).json({ success: false, message: 'Unauthorized' });

  next();

}



function requireAdminOnly(req, res, next) {

  const role = String(req.employee.role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

  if (role !== 'admin' && role !== 'superadmin' && role !== 'super_admin') return res.status(403).json({ success: false, message: 'Unauthorized' });

  next();

}



function requireSuperAdminOnly(req, res, next) {


  const role = String(req.employee.role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');


  if (role !== 'superadmin' && role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Company management is available only in Super Admin / Master Panel' });
  }


  next();



}





function requireAdminOrHR(req, res, next) {

  const role = String(req.employee.role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

  if (role !== 'admin' && role !== 'manager' && role !== 'human_resources' && role !== 'superadmin' && role !== 'super_admin') return res.status(403).json({ success: false, message: 'Unauthorized' });

  next();

}


function normalizeSalaryAmount(value) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100) / 100;
}



async function ensureApiAuditLogTable() {

  // Minimal compatible schema (no FK) so it can be created even on partial DBs.

  const ddlJson = `

    CREATE TABLE IF NOT EXISTS api_audit_log (

      id INT AUTO_INCREMENT PRIMARY KEY,

      employee_id INT NULL,

      endpoint VARCHAR(255) NOT NULL,

      method VARCHAR(10) NOT NULL,

      ip_address VARCHAR(45) NULL,

      user_agent TEXT NULL,

      request_data JSON NULL,

      response_code INT NULL,

      accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      INDEX idx_employee_access (employee_id, accessed_at),

      INDEX idx_endpoint (endpoint)

    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4

  `;



  try {

    await query(ddlJson);

  } catch (err) {

    const msg = String(err?.message || '');

    if (err?.code === 'ER_PARSE_ERROR' || /json/i.test(msg)) {

      await query(`

        CREATE TABLE IF NOT EXISTS api_audit_log (

          id INT AUTO_INCREMENT PRIMARY KEY,

          employee_id INT NULL,

          endpoint VARCHAR(255) NOT NULL,

          method VARCHAR(10) NOT NULL,

          ip_address VARCHAR(45) NULL,

          user_agent TEXT NULL,

          request_data LONGTEXT NULL,

          response_code INT NULL,

          accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          INDEX idx_employee_access (employee_id, accessed_at),

          INDEX idx_endpoint (endpoint)

        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4

      `);

      return;

    }

    throw err;

  }

}



async function ensureEmployeeModuleAccessTable() {

  await query(`

    CREATE TABLE IF NOT EXISTS employee_module_access (

      id INT AUTO_INCREMENT PRIMARY KEY,

      company_id INT NULL,

      employee_id INT NOT NULL,

      module_key VARCHAR(80) NOT NULL,

      allowed TINYINT(1) NOT NULL DEFAULT 1,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      UNIQUE KEY uniq_employee_module (employee_id, module_key),

      INDEX idx_employee (employee_id),

      INDEX idx_company (company_id)

    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4

  `);

}



async function getEmployeeAccessModules(employeeId) {

  if (!employeeId) return [];

  try {

    const rows = await query(

      'SELECT module_key FROM employee_module_access WHERE employee_id = ? AND allowed = 1 ORDER BY module_key ASC',

      [employeeId]

    );

    return Array.isArray(rows) ? rows.map((r) => r.module_key).filter(Boolean) : [];

  } catch (err) {

    if (err && err.code === 'ER_NO_SUCH_TABLE' && /employee_module_access/i.test(String(err.message || ''))) {

      await ensureEmployeeModuleAccessTable();

      return [];

    }

    return [];

  }

}



async function setEmployeeAccessModules({ employeeId, companyId, modules }) {

  if (!employeeId) return;

  const normalized = Array.isArray(modules)

    ? Array.from(new Set(modules.map((m) => String(m || '').trim()).filter(Boolean)))

    : [];



  try {

    await query('DELETE FROM employee_module_access WHERE employee_id = ?', [employeeId]);

  } catch (err) {

    if (err && err.code === 'ER_NO_SUCH_TABLE' && /employee_module_access/i.test(String(err.message || ''))) {

      await ensureEmployeeModuleAccessTable();

    } else {

      throw err;

    }

    await query('DELETE FROM employee_module_access WHERE employee_id = ?', [employeeId]).catch(() => {});

  }



  if (!normalized.length) return;



  for (const moduleKey of normalized) {

    await query(

      'INSERT INTO employee_module_access (company_id, employee_id, module_key, allowed) VALUES (?,?,?,1)',

      [companyId || null, employeeId, moduleKey]

    ).catch(() => {});

  }

}



function defaultModulesForRole(role) {

  const r = String(role || 'employee')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');



  const common = ['calendar', 'notifications', 'chat'];

  const crm = ['leads', 'meetings', 'tasks', 'followups', 'quotations', 'invoices', 'sales_orders', 'reports', 'history', 'whatsapp', 'group_meetings'];

  const hrms = [
    'hrms',
    'hrms_attendance',
    'hrms_leaves',
    'hrms_salary',
    'hrms_documents',
    'hrms_departments',
    'hrms_designations',
    'hrms_shifts',
    'hrms_holidays',
    'hrms_announcements',
    'hrms_performance',
    'hrms_settings',
    'hrms_reports',
  ];



  if (r === 'human_resources' || r === 'human_resource' || r === 'hr' || r === 'hr_manager') return Array.from(new Set([...common, ...hrms]));

  if (r === 'manager') return Array.from(new Set([...common, ...crm, ...hrms]));

  if (r === 'admin' || r === 'superadmin' || r === 'super_admin') return Array.from(new Set([...common, ...crm, ...hrms]));



  // employee / sales_rep / others

  return Array.from(new Set([...common, ...crm, ...hrms]));

}



const COMPANY_UPLOADS = path.join(__dirname, '../../uploads/company_logos');
const COMPANY_BRANDING_UPLOADS = path.join(__dirname, '../../uploads/company_branding');

const companyStorage = multer.diskStorage({

  destination: (req, file, cb) => {

    if (!fs.existsSync(COMPANY_UPLOADS)) fs.mkdirSync(COMPANY_UPLOADS, { recursive: true });

    cb(null, COMPANY_UPLOADS);

  },

  filename: (req, file, cb) => {

    const ext = path.extname(file.originalname || '');

    cb(null, `company_logo_${Date.now()}${ext || '.png'}`);

  },

});

const uploadCompanyLogo = multer({ storage: companyStorage });

const companyBrandingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(COMPANY_BRANDING_UPLOADS)) fs.mkdirSync(COMPANY_BRANDING_UPLOADS, { recursive: true });
    cb(null, COMPANY_BRANDING_UPLOADS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const uploadCompanyBranding = multer({ storage: companyBrandingStorage });



async function getCompanySettingsRow(cid) {

  if (!cid) return null;

  const rows = await query('SELECT * FROM companies WHERE id = ?').catch(() => []);

  if (rows && rows[0]) return rows[0];

  await query(

    `INSERT INTO company_settings (company_name, email, phone, address, time_zone, currency, date_format, logo_path)

     VALUES (?,?,?,?,?,?,?,?)`,

    ['Marcom Street CRM', '', '', '', 'Asia/Kolkata', 'INR', 'DD/MM/YYYY', null]

  ).catch(() => {});

  const fallback = await query('SELECT * FROM companies WHERE id = ?').catch(() => []);

  return fallback[0] || null;

}



async function getRolePermissions(roleKey) {

  const perms = await query(

    `SELECT p.module, p.action

     FROM rbac_role_permissions rp

     JOIN rbac_permissions p ON p.id = rp.permission_id

     WHERE rp.role_key = ?`,

    [roleKey]

  ).catch(() => null);

  if (!perms) return null;

  return perms.map((p) => `${p.module}.${p.action}`);

}



async function ensureCompanySettingsSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      company_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NULL,
      phone VARCHAR(50) NULL,
      address TEXT NULL,
      time_zone VARCHAR(80) NULL,
      currency VARCHAR(20) NULL,
      date_format VARCHAR(40) NULL,
      gst_number VARCHAR(32) NULL,
      pan_number VARCHAR(20) NULL,
      quotation_template VARCHAR(60) NULL DEFAULT 'standard',
      quotation_header_text VARCHAR(255) NULL,
      quotation_footer_text VARCHAR(255) NULL,
      logo_path VARCHAR(255) NULL,
      bank_name VARCHAR(255) NULL,
      account_holder_name VARCHAR(255) NULL,
      account_number VARCHAR(120) NULL,
      ifsc_code VARCHAR(50) NULL,
      branch_name VARCHAR(255) NULL,
      nature VARCHAR(80) NULL DEFAULT 'Current Account',
      signature_path VARCHAR(255) NULL,
      stamp_path VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await query('ALTER TABLE company_settings ADD COLUMN company_id INT NULL').catch(() => {});
  await query('ALTER TABLE company_settings ADD COLUMN gst_number VARCHAR(32) NULL').catch(() => {});
  await query('ALTER TABLE company_settings ADD COLUMN pan_number VARCHAR(20) NULL').catch(() => {});
  await query("ALTER TABLE company_settings ADD COLUMN quotation_template VARCHAR(60) NULL DEFAULT 'standard'").catch(() => {});
  await query('ALTER TABLE company_settings ADD COLUMN quotation_header_text VARCHAR(255) NULL').catch(() => {});
  await query('ALTER TABLE company_settings ADD COLUMN quotation_footer_text VARCHAR(255) NULL').catch(() => {});
  await query('ALTER TABLE company_settings ADD COLUMN bank_name VARCHAR(255) NULL').catch(() => {});
  await query('ALTER TABLE company_settings ADD COLUMN account_holder_name VARCHAR(255) NULL').catch(() => {});
  await query('ALTER TABLE company_settings ADD COLUMN account_number VARCHAR(120) NULL').catch(() => {});
  await query('ALTER TABLE company_settings ADD COLUMN ifsc_code VARCHAR(50) NULL').catch(() => {});
  await query('ALTER TABLE company_settings ADD COLUMN branch_name VARCHAR(255) NULL').catch(() => {});
  await query("ALTER TABLE company_settings ADD COLUMN nature VARCHAR(80) NULL DEFAULT 'Current Account'").catch(() => {});
  await query('ALTER TABLE company_settings ADD COLUMN signature_path VARCHAR(255) NULL').catch(() => {});
  await query('ALTER TABLE company_settings ADD COLUMN stamp_path VARCHAR(255) NULL').catch(() => {});
}

function getNormalizedRole(employee) {
  return String(employee?.role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

function isSuperAdminRole(employee) {
  const role = getNormalizedRole(employee);
  return role === 'superadmin' || role === 'super_admin';
}

function getWritableCompanyId(req, body = {}) {
  if (isSuperAdminRole(req.employee) && body.company_id) {
    const companyId = Number(body.company_id);
    return Number.isInteger(companyId) && companyId > 0 ? companyId : null;
  }

  const companyId = Number(req.employee?.company_id);
  return Number.isInteger(companyId) && companyId > 0 ? companyId : null;
}

function normalizeCompanySettings(row = {}) {
  return {
    ...row,
    gst_number: row.gst_number || row.tax_id || '',
    pan_number: row.pan_number || row.registration_number || '',
    quotation_template: row.quotation_template || 'standard',
    quotation_header_text: row.quotation_header_text || '',
    quotation_footer_text: row.quotation_footer_text || 'Thank you for your business!',
    bank_name: row.bank_name || '',
    account_holder_name: row.account_holder_name || row.account_name || '',
    account_name: row.account_holder_name || row.account_name || '',
    account_number: row.account_number || '',
    ifsc_code: row.ifsc_code || '',
    branch_name: row.branch_name || '',
    nature: row.nature || 'Current Account',
    signature_path: row.signature_path || '',
    stamp_path: row.stamp_path || '',
  };
}

async function getAdminCompanySettingsRow(companyId) {
  await ensureCompanySettingsSchema();

  if (companyId) {
    const settingsRows = await query(
      'SELECT * FROM company_settings WHERE company_id = ? ORDER BY id DESC LIMIT 1',
      [companyId]
    ).catch(() => []);
    if (settingsRows?.[0]) return normalizeCompanySettings(settingsRows[0]);

    const companyRows = await query('SELECT * FROM companies WHERE id = ? LIMIT 1', [companyId]).catch(() => []);
    const company = companyRows?.[0] || {};
    const result = await query(
      `INSERT INTO company_settings
       (company_id, company_name, email, phone, address, time_zone, currency, date_format, gst_number, pan_number, quotation_template, quotation_header_text, quotation_footer_text, logo_path, bank_name, account_holder_name, account_number, ifsc_code, branch_name, nature, signature_path, stamp_path)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        companyId,
        company.company_name || 'Company',
        company.email || '',
        company.phone || '',
        company.address || '',
        'Asia/Kolkata',
        'INR',
        'DD/MM/YYYY',
        company.gst_number || company.tax_id || '',
        company.pan_number || company.registration_number || '',
        'standard',
        '',
        'Thank you for your business!',
        company.logo_path || null,
        company.bank_name || '',
        company.account_holder_name || company.account_name || '',
        company.account_number || '',
        company.ifsc_code || '',
        company.branch_name || '',
        company.nature || 'Current Account',
        company.signature_path || null,
        company.stamp_path || null,
      ]
    );
    const createdRows = await query('SELECT * FROM company_settings WHERE id = ? LIMIT 1', [result.insertId]).catch(() => []);
    return normalizeCompanySettings(createdRows?.[0] || {});
  }

  const rows = await query('SELECT * FROM company_settings ORDER BY id ASC LIMIT 1').catch(() => []);
  if (rows?.[0]) return normalizeCompanySettings(rows[0]);

  const result = await query(
    `INSERT INTO company_settings
     (company_name, email, phone, address, time_zone, currency, date_format, gst_number, pan_number, quotation_template, quotation_header_text, quotation_footer_text, logo_path, bank_name, account_holder_name, account_number, ifsc_code, branch_name, nature, signature_path, stamp_path)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['Marcom Street CRM', '', '', '', 'Asia/Kolkata', 'INR', 'DD/MM/YYYY', '', '', 'standard', '', 'Thank you for your business!', null, '', '', '', '', '', 'Current Account', null, null]
  );
  const createdRows = await query('SELECT * FROM company_settings WHERE id = ? LIMIT 1', [result.insertId]).catch(() => []);
  return normalizeCompanySettings(createdRows?.[0] || {});
}

router.get('/dashboard', verifyToken, requireAdmin, async (req, res) => {

  try {

    const role = String(req.employee.role || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');

    const isSuper = role === 'superadmin' || role === 'super_admin';

    const cid = req.employee.company_id;

    const whereClause = isSuper ? '' : 'WHERE company_id = ?';

    const whereAnd = isSuper ? '' : 'AND company_id = ?';

    const params = isSuper ? [] : [cid];



    const [leads] = await query(`SELECT COUNT(*) as c FROM leads ${whereClause}`, params).catch(() => [{ c: 0 }]);

    const [employees] = await query(
      `SELECT COUNT(*) as c FROM employees ${whereClause} ${isSuper ? '' : "AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')"}`,
      params
    ).catch(() => [{ c: 0 }]);

    const [activeEmployeesRow] = await query(
      isSuper
        ? `SELECT COUNT(*) as c FROM employees WHERE status = ?`
        : `SELECT COUNT(*) as c FROM employees ${whereClause}
           AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')
           AND status = ?`,
      [...params, 'active']
    ).catch(() => [{ c: 0 }]);

    const [companies] = await query('SELECT COUNT(*) as c FROM companies').catch(() => [{ c: 0 }]);

    const [activeCompanies] = await query('SELECT COUNT(*) as c FROM companies WHERE status = ?', ['active']).catch(() => [{ c: 0 }]);

    const [inactiveCompanies] = await query('SELECT COUNT(*) as c FROM companies WHERE status IN (?, ?)', ['inactive', 'suspended']).catch(() => [{ c: 0 }]);

    const [meetings] = await query(`SELECT COUNT(*) as c FROM meetings ${whereClause}`, params).catch(() => [{ c: 0 }]);

    const [tasks] = await query(`SELECT COUNT(*) as c FROM tasks ${whereClause}`, params).catch(() => [{ c: 0 }]);

    const [followups] = await query(`SELECT COUNT(*) as c FROM followups ${whereClause}`, params).catch(() => [{ c: 0 }]);

    const [invoices] = await query(`SELECT COUNT(*) as c FROM invoices ${whereClause}`, params).catch(() => [{ c: 0 }]);

    const [quotations] = await query(`SELECT COUNT(*) as c FROM quotations ${whereClause}`, params).catch(() => [{ c: 0 }]);

    const [liveDeals] = await query(

      `SELECT COUNT(*) as c FROM leads WHERE status IN ('qualified','proposal','negotiation') ${whereAnd}`,

      params

    ).catch(() => [{ c: 0 }]);

    const [dealsClosed] = await query(

      `SELECT COUNT(*) as c FROM leads WHERE status = 'won' ${whereAnd}`,

      params

    ).catch(() => [{ c: 0 }]);

    const [pendingTasks] = await query(

      `SELECT COUNT(*) as c FROM tasks WHERE status IN ('pending','in_progress') ${whereAnd}`,

      params

    ).catch(() => [{ c: 0 }]);

    const [meetingsToday] = await query(

      `SELECT COUNT(*) as c FROM meetings WHERE DATE(meeting_date) = CURDATE() ${whereAnd}`,

      params

    ).catch(() => [{ c: 0 }]);

    const [followupsToday] = await query(

      `SELECT COUNT(*) as c FROM followups WHERE DATE(scheduled_date) = CURDATE() ${whereAnd}`,

      params

    ).catch(() => [{ c: 0 }]);

    const [attendanceToday] = await query(

      `SELECT COUNT(DISTINCT employee_id) as c FROM employee_checkins WHERE date = CURDATE() AND status IN ('checked_in','on_break','completed') ${whereAnd}`,

      params

    ).catch(() => [{ c: 0 }]);



    const [totalRevenueRow] = await query(

      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status IN ('paid','sent','overdue') ${whereAnd}`,

      params

    ).catch(() => [{ total: 0 }]);

    const [monthlyRevenueRow] = await query(

      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status IN ('paid','sent','overdue') ${whereAnd} AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())`,

      params

    ).catch(() => [{ total: 0 }]);



    const leadsByStatus = await query(

      `SELECT status, COUNT(*) as count FROM leads ${whereClause} GROUP BY status ORDER BY count DESC`,

      params

    ).catch(() => []);



    const pipelineValue = await query(

      `SELECT status, COALESCE(SUM(estimated_value), 0) as value

       FROM leads

       WHERE status IN ('new','contacted','qualified','proposal','negotiation')

       GROUP BY status

       ORDER BY value DESC`

    ).catch(() => []);



    const monthlyRevenueTrend = await query(`

      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, DATE_FORMAT(created_at, '%b %Y') as month_label, COALESCE(SUM(total_amount), 0) as revenue

      FROM invoices

      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)

      GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y')

      ORDER BY month ASC

    `).catch(() => []);



    const companySales = await query(`

      SELECT l.company_name, COALESCE(SUM(i.total_amount), 0) as sales

      FROM leads l

      LEFT JOIN invoices i ON i.lead_id = l.id

      GROUP BY l.company_name

      ORDER BY sales DESC

      LIMIT 10

    `).catch(() => []);



    const employeePerformance = await query(`

      SELECT

        e.id,

        e.name,

        COUNT(DISTINCT l.id) as total_leads,

        COALESCE(SUM(i.total_amount), 0) as total_revenue

      FROM employees e

      LEFT JOIN leads l ON l.assigned_to = e.id

      LEFT JOIN invoices i ON i.lead_id = l.id

      WHERE e.status = 'active'

      GROUP BY e.id, e.name

      ORDER BY total_revenue DESC, total_leads DESC

      LIMIT 10

    `).catch(() => []);



    const recentCompanies = await query(

      'SELECT id, company_name, email, status, created_at FROM companies ORDER BY created_at DESC LIMIT 5'

    ).catch(() => []);

    const recentLeads = await query(

      'SELECT id, lead_code, company_name, status, created_at FROM leads ORDER BY created_at DESC LIMIT 5'

    ).catch(() => []);

    const recentActivities = await query(

      `SELECT a.id, a.activity_type, a.description, a.created_at, e.name as employee_name

       FROM activity_logs a LEFT JOIN employees e ON e.id = a.employee_id

       ORDER BY a.created_at DESC LIMIT 6`

    ).catch(() => []);

    const systemNotifications = await query(

      `SELECT id, title, message, reminder_date, status

       FROM reminders

       WHERE reminder_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)

       ORDER BY reminder_date DESC LIMIT 6`

    ).catch(() => []);



    const [employeeAgentOutputs] = await query(`

      SELECT

        (SELECT COUNT(*) FROM leads) as total_leads,

        (SELECT COUNT(*) FROM meetings) as total_meetings,

        (SELECT COUNT(*) FROM employee_checkins) as total_attendance_logs

    `).catch(() => [{ total_leads: 0, total_meetings: 0, total_attendance_logs: 0 }]);



    const totalRevenue = Number(totalRevenueRow?.total) || 0;

    const monthlyRevenue = Number(monthlyRevenueRow?.total) || 0;

    const totalLeads = Number(leads?.c) || 0;

    const totalEmployees = Number(employees?.c) || 0;

    const activeEmployees = Number(activeEmployeesRow?.c) || 0;

    const totalCompanies = Number(companies?.c) || 0;

    const totalMeetings = Number(meetings?.c) || 0;

    const totalTasks = Number(tasks?.c) || 0;

    const totalFollowups = Number(followups?.c) || 0;

    const totalInvoices = Number(invoices?.c) || 0;

    const totalQuotations = Number(quotations?.c) || 0;

    const activeCompaniesCount = Number(activeCompanies?.c) || 0;

    const suspendedCompaniesCount = Number(inactiveCompanies?.c) || 0;

    const liveDealsCount = Number(liveDeals?.c) || 0;



    return res.json({

      success: true,

      data: {

        totalUsers: totalEmployees,

        activeEmployees,

        dealsClosed: Number(dealsClosed?.c) || 0,

        attendanceToday: Number(attendanceToday?.c) || 0,

        pendingTasks: Number(pendingTasks?.c) || 0,

        meetingsToday: Number(meetingsToday?.c) || 0,

        followupsToday: Number(followupsToday?.c) || 0,

        totalLeads,

        totalEmployees,

        totalCompanies,

        activeCompanies: activeCompaniesCount,

        suspendedCompanies: suspendedCompaniesCount,

        liveDeals: liveDealsCount,

        totalInvoices,

        totalQuotations,

        totalRevenue,

        monthlyRevenue,

        leadsByStatus: leadsByStatus || [],

        pipelineValue: pipelineValue || [],

        monthlyRevenueTrend: monthlyRevenueTrend || [],

        companySales: companySales || [],

        employeePerformance: employeePerformance || [],

        recentCompanies: recentCompanies || [],

        recentLeads: recentLeads || [],

        recentActivities: recentActivities || [],

        systemNotifications: systemNotifications || [],

        employeeAgentOutputs: employeeAgentOutputs || { total_leads: 0, total_meetings: 0, total_attendance_logs: 0 },



        // Backward-compatible keys for older frontend screens.

        total_leads: totalLeads,

        total_employees: totalEmployees,

        total_companies: totalCompanies,

        total_meetings: totalMeetings,

        total_tasks: totalTasks,

        total_followups: totalFollowups,

        total_invoices: totalInvoices,

        total_quotations: totalQuotations,

      },

    });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



// Company Settings

router.get('/company-settings', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    const settings = await getAdminCompanySettingsRow(req.employee.company_id);

    return res.json({ success: true, data: settings || {} });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.put('/company-settings', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    const b = req.body || {};

    const existing = await getAdminCompanySettingsRow(req.employee.company_id);

    if (!existing?.id) return res.status(500).json({ success: false, message: 'Company settings not initialized' });

    await query(

      `UPDATE company_settings

       SET company_name=?, email=?, phone=?, address=?, time_zone=?, currency=?, date_format=?, gst_number=?, pan_number=?, quotation_template=?, quotation_header_text=?, quotation_footer_text=?, bank_name=?, account_holder_name=?, account_number=?, ifsc_code=?, branch_name=?, nature=?, signature_path=?, stamp_path=?, updated_at=NOW()

       WHERE id=?`,

      [

        b.company_name || existing.company_name,

        b.email || existing.email || '',

        b.phone || existing.phone || '',

        b.address || existing.address || '',

        b.time_zone || existing.time_zone || 'Asia/Kolkata',

        b.currency || existing.currency || 'INR',

        b.date_format || existing.date_format || 'DD/MM/YYYY',

        b.gst_number || existing.gst_number || '',

        b.pan_number || existing.pan_number || '',

        b.quotation_template || existing.quotation_template || 'standard',

        b.quotation_header_text !== undefined ? b.quotation_header_text : (existing.quotation_header_text || ''),

        b.quotation_footer_text !== undefined ? b.quotation_footer_text : (existing.quotation_footer_text || 'Thank you for your business!'),

        b.bank_name !== undefined ? b.bank_name : (existing.bank_name || ''),

        b.account_holder_name !== undefined ? b.account_holder_name : (existing.account_holder_name || existing.account_name || ''),

        b.account_number !== undefined ? b.account_number : (existing.account_number || ''),

        b.ifsc_code !== undefined ? b.ifsc_code : (existing.ifsc_code || ''),

        b.branch_name !== undefined ? b.branch_name : (existing.branch_name || ''),

        b.nature !== undefined ? b.nature : (existing.nature || 'Current Account'),

        b.signature_path !== undefined ? b.signature_path : (existing.signature_path || ''),

        b.stamp_path !== undefined ? b.stamp_path : (existing.stamp_path || ''),

        existing.id,

      ]

    );

    if (req.employee.company_id) {
      await query(
        'UPDATE companies SET company_name=?, email=?, phone=?, address=?, tax_id=?, registration_number=? WHERE id=?',
        [
          b.company_name || existing.company_name,
          b.email || existing.email || '',
          b.phone || existing.phone || '',
          b.address || existing.address || '',
          b.gst_number || existing.gst_number || '',
          b.pan_number || existing.pan_number || '',
          req.employee.company_id,
        ]
      ).catch(() => {});
    }

    const updated = await getAdminCompanySettingsRow(req.employee.company_id);

    return res.json({ success: true, message: 'Company settings updated', data: updated || {} });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.post('/company-settings/logo', verifyToken, requireAdminOnly, (req, res) => {

  uploadCompanyLogo.single('logo')(req, res, async (err) => {

    if (err || !req.file) {

      return res.status(400).json({ success: false, message: 'Logo upload failed' });

    }

    try {

      const existing = await getAdminCompanySettingsRow(req.employee.company_id);

      const logoPath = 'uploads/company_logos/' + req.file.filename;

      await query('UPDATE company_settings SET logo_path = ?, updated_at=NOW() WHERE id = ?', [logoPath, existing.id]);

      const updated = await getAdminCompanySettingsRow(req.employee.company_id);

      return res.json({ success: true, message: 'Logo updated', data: updated || {} });

    } catch (uploadErr) {

      return res.status(500).json({ success: false, message: uploadErr.message });

    }

  });

});

router.post('/company-settings/signature', verifyToken, requireAdminOnly, (req, res) => {
  uploadCompanyBranding.single('signature')(req, res, async (err) => {
    if (err || !req.file) {
      return res.status(400).json({ success: false, message: 'Signature upload failed' });
    }

    try {
      const existing = await getAdminCompanySettingsRow(req.employee.company_id);
      const signaturePath = 'uploads/company_branding/' + req.file.filename;
      await query('UPDATE company_settings SET signature_path = ?, updated_at=NOW() WHERE id = ?', [signaturePath, existing.id]);
      const updated = await getAdminCompanySettingsRow(req.employee.company_id);
      return res.json({ success: true, message: 'Signature updated', data: updated || {} });
    } catch (uploadErr) {
      return res.status(500).json({ success: false, message: uploadErr.message });
    }
  });
});

router.post('/company-settings/stamp', verifyToken, requireAdminOnly, (req, res) => {
  uploadCompanyBranding.single('stamp')(req, res, async (err) => {
    if (err || !req.file) {
      return res.status(400).json({ success: false, message: 'Stamp upload failed' });
    }

    try {
      const existing = await getAdminCompanySettingsRow(req.employee.company_id);
      const stampPath = 'uploads/company_branding/' + req.file.filename;
      await query('UPDATE company_settings SET stamp_path = ?, updated_at=NOW() WHERE id = ?', [stampPath, existing.id]);
      const updated = await getAdminCompanySettingsRow(req.employee.company_id);
      return res.json({ success: true, message: 'Stamp updated', data: updated || {} });
    } catch (uploadErr) {
      return res.status(500).json({ success: false, message: uploadErr.message });
    }
  });
});



router.get('/attendance', verifyToken, requireAdmin, async (req, res) => {

  try {

    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const department = req.query.department || '';

    const selectedDate = req.query.selected_date || new Date().toISOString().slice(0, 10);

    const analytics = await getAdminAttendanceAnalytics({

      month,

      selected_date: selectedDate,

      department,

    });



    const attendanceRecords = department && department !== 'all'

      ? analytics.attendanceRecords.filter((row) => String(row.department_name || '').toLowerCase() === String(department).toLowerCase())

      : analytics.attendanceRecords;



    return res.json({

      success: true,

      data: {

        todayCheckedIn: analytics.summary.presentToday,

        totalEmployees: analytics.summary.totalEmployees,

        presentEmployees: analytics.summary.presentToday,

        absentEmployees: analytics.summary.absentToday,

        lateArrivals: analytics.summary.lateArrivals,

        overtimeEmployees: analytics.summary.overtimeEmployees,

        avgWorkingHours: analytics.summary.avgWorkingHours,

        totalWorkedTime: analytics.summary.totalWorkedTime,

        attendanceRate: analytics.summary.attendanceRate,

        attendanceRecords,

        monthlyStats: analytics.monthlyStats || [],

      attendanceTypes: analytics.attendanceTypes || [],

        summary: analytics.summary,

      },

    });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.get('/insights', verifyToken, requireAdmin, async (req, res) => {

  try {

    const role = String(req.employee.role || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');

    const isSuper = role === 'superadmin' || role === 'super_admin';

    const cid = req.employee.company_id;

    const whereClause = isSuper ? '' : 'WHERE company_id = ?';

    const params = isSuper ? [] : [cid];



    const [companies] = await query('SELECT COUNT(*) as c FROM companies');

    const [employees] = await query(
      `SELECT COUNT(*) as c FROM employees ${whereClause} ${isSuper ? '' : "AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')"}`,
      params
    );

    const [leads] = await query(`SELECT COUNT(*) as c FROM leads ${whereClause}`, params);

    const [meetings] = await query(`SELECT COUNT(*) as c FROM meetings ${whereClause}`, params);

    const [tasks] = await query(`SELECT COUNT(*) as c FROM tasks ${whereClause}`, params);

    const [followups] = await query(`SELECT COUNT(*) as c FROM followups ${whereClause}`, params);

    

    const companiesByStatus = await query('SELECT status, COUNT(*) as count FROM companies GROUP BY status').catch(() => []);

    const employeesByStatus = await query(
      `SELECT status, COUNT(*) as count FROM employees ${whereClause} ${isSuper ? '' : "AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')"} GROUP BY status`,
      params
    ).catch(() => []);

    const leadsByStatus = await query(`SELECT status, COUNT(*) as count FROM leads ${whereClause} GROUP BY status`, params).catch(() => []);

    

    return res.json({

      success: true,

      data: {

        totalCompanies: Number(companies?.c) || 0,

        totalEmployees: Number(employees?.c) || 0,

        totalLeads: Number(leads?.c) || 0,

        totalMeetings: Number(meetings?.c) || 0,

        totalTasks: Number(tasks?.c) || 0,

        totalFollowups: Number(followups?.c) || 0,

        companiesByStatus: companiesByStatus || [],

        employeesByStatus: employeesByStatus || [],

        leadsByStatus: leadsByStatus || [],

      },

    });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.get('/revenue', verifyToken, requireAdmin, async (req, res) => {

  try {

    const role = String(req.employee.role || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');

    const isSuper = role === 'superadmin' || role === 'super_admin';

    const cid = req.employee.company_id;

    const whereAnd = isSuper ? '' : 'AND company_id = ?';

    const params = isSuper ? [] : [cid];



    const companyRevenue = await query(`

      SELECT c.id, c.company_name, COALESCE(SUM(i.total_amount), 0) as total_sales, COUNT(i.id) as invoice_count,

        COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END), 0) as paid_amount,

        COALESCE(SUM(CASE WHEN i.status = 'pending' THEN i.total_amount ELSE 0 END), 0) as pending_amount

      FROM companies c LEFT JOIN invoices i ON i.company_id = c.id 

      ${isSuper ? '' : 'WHERE c.id = ?'}

      GROUP BY c.id, c.company_name ORDER BY total_sales DESC

    `, params).catch(() => []);



    const [totalRev] = await query(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = ? ${whereAnd}`, ['paid', ...params]).catch(() => [{ total: 0 }]);

    const [monthRev] = await query(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) ${whereAnd}`, params).catch(() => [{ total: 0 }]);

    

    const monthlyTrend = await query(`

      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, DATE_FORMAT(created_at, '%b %Y') as month_label, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as invoice_count

      FROM invoices WHERE status = 'paid' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ${whereAnd} 

      GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y') ORDER BY month ASC`, params).catch(() => []);

      

    return res.json({

      success: true,

      data: {

        companyRevenue: companyRevenue || [],

        totalRevenue: parseFloat(totalRev?.total) || 0,

        monthRevenue: parseFloat(monthRev?.total) || 0,

        monthlyTrend: monthlyTrend || [],

      },

    });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.get('/tasks', verifyToken, requireAdmin, async (req, res) => {

  try {

    const role = String(req.employee.role || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');

    const isSuper = role === 'superadmin' || role === 'super_admin';

    const cid = req.employee.company_id;

    const whereClause = isSuper ? '' : 'WHERE company_id = ?';

    const whereAnd = isSuper ? '' : 'AND company_id = ?';

    const params = isSuper ? [] : [cid];



    const statusFilter = req.query.status || 'all';

    const employeeFilter = req.query.employee_id || 'all';

    const priorityFilter = req.query.priority || 'all';

    const search = req.query.search || '';

    

    let sql = `SELECT t.*, e.name as employee_name, e.email as employee_email, l.company_name as lead_company_name, l.contact_person as lead_contact

      FROM tasks t 

      LEFT JOIN employees e ON e.id = t.employee_id 

      LEFT JOIN leads l ON l.id = t.lead_id 

      WHERE 1=1 ${isSuper ? '' : 'AND (t.company_id = ? OR (t.company_id IS NULL AND e.company_id = ?))'}`;

    

    const queryParams = isSuper ? [] : [cid, cid];

    

    if (statusFilter !== 'all') { sql += ' AND t.status = ?'; queryParams.push(statusFilter); }

    if (employeeFilter !== 'all') { sql += ' AND t.employee_id = ?'; queryParams.push(employeeFilter); }

    if (priorityFilter !== 'all') { sql += ' AND t.priority = ?'; queryParams.push(priorityFilter); }

    if (search) { sql += ' AND (t.title LIKE ? OR t.description LIKE ?)'; const tStr = '%' + search + '%'; queryParams.push(tStr, tStr); }

    

    sql += ' ORDER BY t.created_at DESC';

    const tasksList = await query(sql, queryParams);

    

    const taskCompanyJoin = isSuper ? '' : 'LEFT JOIN employees te ON te.id = t.employee_id';
    const taskCompanyParams = isSuper ? [] : [cid, cid];
    const taskWhere = (extraClause = '') => {
      const clauses = [];
      if (extraClause) clauses.push(extraClause);
      if (!isSuper) clauses.push('(t.company_id = ? OR (t.company_id IS NULL AND te.company_id = ?))');
      return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    };

    const [total] = await query(`SELECT COUNT(*) as c FROM tasks t ${taskCompanyJoin} ${taskWhere()}`, taskCompanyParams);

    const [pending] = await query(`SELECT COUNT(*) as c FROM tasks t ${taskCompanyJoin} ${taskWhere('t.status = ?')}`, ['pending', ...taskCompanyParams]);

    const [inProgress] = await query(`SELECT COUNT(*) as c FROM tasks t ${taskCompanyJoin} ${taskWhere('t.status = ?')}`, ['in_progress', ...taskCompanyParams]);

    const [completed] = await query(`SELECT COUNT(*) as c FROM tasks t ${taskCompanyJoin} ${taskWhere('t.status = ?')}`, ['completed', ...taskCompanyParams]);

    const [urgent] = await query(`SELECT COUNT(*) as c FROM tasks t ${taskCompanyJoin} ${taskWhere('t.priority = ?')}`, ['urgent', ...taskCompanyParams]);

    

    const activeEmployees = await query(
      `SELECT id, name, email FROM employees
       WHERE status = ?
       ${whereAnd}
       ${isSuper ? '' : "AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')"}
       ORDER BY name`,
      ['active', ...params]
    );

    const allLeads = await query(`SELECT id, company_name, contact_person FROM leads ${whereClause} ORDER BY company_name`, params);

    

    return res.json({

      success: true,

      data: {

        tasks: tasksList || [],

        statistics: { 

          total: Number(total?.c) || 0, 

          pending: Number(pending?.c) || 0, 

          inProgress: Number(inProgress?.c) || 0, 

          completed: Number(completed?.c) || 0, 

          urgent: Number(urgent?.c) || 0 

        },

        employees: activeEmployees || [],

        leads: allLeads || [],

      },

    });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.post('/tasks', verifyToken, requireAdmin, async (req, res) => {

  try {

    const b = req.body || {};

    try {
      await query(
        'INSERT INTO tasks (company_id, employee_id, lead_id, title, description, task_type, priority, due_date, status) VALUES (?,?,?,?,?,?,?,?,?)',
        [req.employee.company_id || b.company_id || null, b.employee_id || req.employee.id, b.lead_id || null, b.title, b.description || '', b.task_type || 'general', b.priority || 'medium', b.due_date || null, b.status || 'pending']
      );
    } catch (insertErr) {
      if (!insertErr || (insertErr.code !== 'ER_BAD_FIELD_ERROR' && insertErr.code !== 'ER_PARSE_ERROR')) {
        throw insertErr;
      }
      await query(
        'INSERT INTO tasks (employee_id, lead_id, title, description, task_type, priority, due_date, status) VALUES (?,?,?,?,?,?,?,?)',
        [b.employee_id || req.employee.id, b.lead_id || null, b.title, b.description || '', b.task_type || 'general', b.priority || 'medium', b.due_date || null, b.status || 'pending']
      );
    }

    return res.json({ success: true, message: 'Task created' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.put('/tasks/:id', verifyToken, requireAdmin, async (req, res) => {

  try {

    const b = req.body || {};

    try {
      await query(
        'UPDATE tasks SET company_id=?, employee_id=?, lead_id=?, title=?, description=?, priority=?, due_date=?, status=?, updated_at=NOW() WHERE id=?',
        [req.employee.company_id || b.company_id || null, b.employee_id, b.lead_id || null, b.title, b.description, b.priority, b.due_date, b.status, req.params.id]
      );
    } catch (updateErr) {
      if (!updateErr || (updateErr.code !== 'ER_BAD_FIELD_ERROR' && updateErr.code !== 'ER_PARSE_ERROR')) {
        throw updateErr;
      }
      await query(
        'UPDATE tasks SET employee_id=?, lead_id=?, title=?, description=?, priority=?, due_date=?, status=?, updated_at=NOW() WHERE id=?',
        [b.employee_id, b.lead_id || null, b.title, b.description, b.priority, b.due_date, b.status, req.params.id]
      );
    }

    return res.json({ success: true, message: 'Task updated' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.delete('/tasks/:id', verifyToken, requireAdmin, async (req, res) => {

  try {

    await query('DELETE FROM tasks WHERE id = ?', [req.params.id]);

    return res.json({ success: true, message: 'Task deleted' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.patch('/tasks/:id/status', verifyToken, requireAdmin, async (req, res) => {

  try {

    const taskId = Number(req.params.id);

    const { status } = req.body || {};

    if (!taskId || !status) {

      return res.status(400).json({ success: false, message: 'Task ID and status are required' });

    }

    const completedAt = status === 'completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

    const result = await query('UPDATE tasks SET status = ?, completed_at = ?, updated_at = NOW() WHERE id = ?', [

      status,

      completedAt,

      taskId,

    ]);

    if (!result || !result.affectedRows) {

      return res.status(404).json({ success: false, message: 'Task not found' });

    }

    return res.json({ success: true, message: 'Task status updated' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.get('/employees', verifyToken, async (req, res) => {

  try {

    await ensureEmployeeCodeSchema();

    const role = String(req.employee.role || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');
    const isSuper = role === 'superadmin' || role === 'super_admin';

    const id = req.query.id || null;

    const fields = `e.*, d.name as department_name, d.department_code, c.company_name, c.company_code, dg.name as designation_name, dg.designation_code`;

    if (id) {

      const sql = isSuper 

        ? `SELECT ${fields} FROM employees e LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN companies c ON e.company_id = c.id LEFT JOIN designations dg ON e.designation_id = dg.id WHERE e.id = ?`

        : `SELECT ${fields} FROM employees e LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN companies c ON e.company_id = c.id LEFT JOIN designations dg ON e.designation_id = dg.id WHERE e.id = ? AND e.company_id = ?`;

      const params = isSuper ? [id] : [id, req.employee.company_id];

      const rows = await query(sql, cleanParams(params));

      const emp = rows[0];

      if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

      emp.access_modules = await getEmployeeAccessModules(emp.id);

      return res.json({ success: true, employee: emp });

    }

    const sql = isSuper

        ? `SELECT ${fields} FROM employees e LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN companies c ON e.company_id = c.id LEFT JOIN designations dg ON e.designation_id = dg.id ORDER BY e.created_at DESC`

        : `SELECT ${fields} FROM employees e LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN companies c ON e.company_id = c.id LEFT JOIN designations dg ON e.designation_id = dg.id WHERE e.company_id = ? ORDER BY e.created_at DESC`;

      const params = isSuper ? [] : [req.employee.company_id];

      const rows = await query(sql, cleanParams(params));

    return res.json({ success: true, data: rows });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.post('/employees/:id/reset-password', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    const employeeId = Number(req.params.id);

    if (!employeeId) return res.status(400).json({ success: false, message: 'Employee ID is required' });

    const newPassword = String(req.body?.new_password || '').trim();

    const generated = newPassword || Math.random().toString(36).slice(-8);

    const hashed = await bcrypt.hash(generated, 10).catch(() => generated);

    const result = await query('UPDATE employees SET password = ? WHERE id = ?', [hashed, employeeId]);

    if (!result || !result.affectedRows) return res.status(404).json({ success: false, message: 'Employee not found' });

    return res.json({ success: true, message: 'Password reset successful', data: { password: generated } });

  } catch (err) {

    console.error('Reset password error:', err?.message || err);

    return res.status(500).json({ success: false, message: err?.message || 'Reset password failed' });

  }

});



router.patch('/employees/:id/status', verifyToken, requireAdminOrHR, async (req, res) => {

  try {

    const employeeId = Number(req.params.id);

    const status = String(req.body?.status || '').toLowerCase();

    if (!employeeId || !['active', 'inactive'].includes(status)) {

      return res.status(400).json({ success: false, message: 'Employee ID and valid status are required' });

    }

    if (employeeId === req.employee.id) {

      return res.status(400).json({ success: false, message: 'Cannot change your own status' });

    }

    const result = await query('UPDATE employees SET status = ? WHERE id = ?', [status, employeeId]);

    if (!result || !result.affectedRows) return res.status(404).json({ success: false, message: 'Employee not found' });

    return res.json({ success: true, message: 'Status updated' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



// RBAC - Roles & Permissions

router.get('/rbac/roles', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    const rows = await query('SELECT * FROM rbac_roles ORDER BY is_system DESC, role_key ASC').catch(() => []);

    return res.json({ success: true, data: rows || [] });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.post('/rbac/roles', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    const b = req.body || {};

    if (!b.role_key || !b.label) return res.status(400).json({ success: false, message: 'role_key and label are required' });

    await query(

      'INSERT INTO rbac_roles (role_key, label, description, is_system) VALUES (?,?,?,?)',

      [b.role_key, b.label, b.description || '', 0]

    );

    return res.json({ success: true, message: 'Role created' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.put('/rbac/roles/:id', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    const b = req.body || {};

    await query('UPDATE rbac_roles SET label = ?, description = ? WHERE id = ?', [b.label || '', b.description || '', req.params.id]);

    return res.json({ success: true, message: 'Role updated' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.get('/rbac/permissions', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    const rows = await query('SELECT * FROM rbac_permissions ORDER BY module ASC, action ASC').catch(() => []);

    return res.json({ success: true, data: rows || [] });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.post('/rbac/permissions', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    const b = req.body || {};

    if (!b.module || !b.action) return res.status(400).json({ success: false, message: 'module and action are required' });

    await query(

      'INSERT INTO rbac_permissions (module, action, label) VALUES (?,?,?)',

      [b.module, b.action, b.label || `${b.module}.${b.action}`]

    );

    return res.json({ success: true, message: 'Permission created' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.put('/rbac/permissions/:id', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    const b = req.body || {};

    await query('UPDATE rbac_permissions SET module = ?, action = ?, label = ? WHERE id = ?', [

      b.module,

      b.action,

      b.label || `${b.module}.${b.action}`,

      req.params.id,

    ]);

    return res.json({ success: true, message: 'Permission updated' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.delete('/rbac/permissions/:id', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    await query('DELETE FROM rbac_permissions WHERE id = ?', [req.params.id]);

    return res.json({ success: true, message: 'Permission deleted' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.get('/rbac/role-permissions', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    const roleKey = req.query.role_key;

    if (!roleKey) return res.status(400).json({ success: false, message: 'role_key is required' });

    const rows = await query(

      `SELECT p.* FROM rbac_role_permissions rp

       JOIN rbac_permissions p ON p.id = rp.permission_id

       WHERE rp.role_key = ?`,

      [roleKey]

    ).catch(() => []);

    return res.json({ success: true, data: rows || [] });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.put('/rbac/role-permissions', verifyToken, requireAdminOnly, async (req, res) => {

  try {

    const roleKey = req.body?.role_key;

    const permissionIds = Array.isArray(req.body?.permission_ids) ? req.body.permission_ids : [];

    if (!roleKey) return res.status(400).json({ success: false, message: 'role_key is required' });

    await query('DELETE FROM rbac_role_permissions WHERE role_key = ?', [roleKey]);

    for (const permId of permissionIds) {

      await query('INSERT INTO rbac_role_permissions (role_key, permission_id) VALUES (?, ?)', [roleKey, permId]);

    }

    return res.json({ success: true, message: 'Role permissions updated' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.get('/rbac/me', verifyToken, async (req, res) => {

  try {

    const roleKey = String(req.employee.role || 'employee');

    const permissions = await getRolePermissions(roleKey);

    return res.json({ success: true, data: { role_key: roleKey, permissions: permissions || [] } });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.post('/employees', verifyToken, requireAdminOrHR, async (req, res) => {

  try {

    await ensureEmployeeCodeSchema();

    const b = req.body || {};

    if (!b.name || !b.email || !b.password) return res.status(400).json({ success: false, message: 'Missing required fields' });

    const companyId = getWritableCompanyId(req, b);
    if (!companyId) return res.status(400).json({ success: false, message: 'Company is required' });
    if (!b.department_id) return res.status(400).json({ success: false, message: 'Department is required' });
    if (!b.designation_id) return res.status(400).json({ success: false, message: 'Designation is required' });
    if (!b.joining_date) return res.status(400).json({ success: false, message: 'Joining date is required' });

    const hashedPassword = await bcrypt.hash(b.password, 10).catch(() => b.password);

    {
      const designation = await getDesignationById(b.designation_id);
      if (!designation) return res.status(400).json({ success: false, message: 'Designation not found' });

      const employeeFields = [
        'company_id', 'employee_code', 'name', 'email', 'phone', 'password', 'role', 'department_id', 'designation', 'designation_id', 'status',
        'address', 'permanent_address', 'dob', 'gender', 'marital_status', 'emergency_contact_name',
        'emergency_contact_phone', 'joining_date', 'employment_type', 'probation_period', 'basic_salary',
        'hra', 'conveyance', 'medical_allowance', 'special_allowance', 'lta', 'other_allowances', 'pf_contribution', 'gratuity', 'previous_company',
        'previous_designation', 'experience_years', 'qualification', 'bank_account', 'bank_name',
        'ifsc_code', 'branch_name', 'account_holder_name', 'pan_number', 'aadhar_number',
      ];

      const insertSql = `INSERT INTO employees (${employeeFields.join(', ')}) VALUES (${employeeFields.map(() => '?').join(',')})`;
      let employeeId = null;
      let employeeCode = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const conn = await getConnection();
        try {
          await conn.query('START TRANSACTION');
          employeeCode = await generateEmployeeCode(companyId, b.department_id, b.designation_id, b.joining_date, { connection: conn });

          const basicSalary = normalizeSalaryAmount(b.basic_salary);
          const hra = normalizeSalaryAmount(b.hra);
          const conveyance = normalizeSalaryAmount(b.conveyance);
          const medicalAllowance = normalizeSalaryAmount(b.medical_allowance);
          const specialAllowance = normalizeSalaryAmount(b.special_allowance);
          const lta = normalizeSalaryAmount(b.lta);
          const otherAllowances = normalizeSalaryAmount(b.other_allowances);
          const pfContribution = normalizeSalaryAmount(b.pf_contribution);
          const gratuity = normalizeSalaryAmount(b.gratuity);

          const params = [
            companyId, employeeCode, b.name, b.email, b.phone || null, hashedPassword,
            b.role || 'employee', b.department_id || null, designation.name || b.designation || null, b.designation_id || null, 'active',
            b.address || null, b.permanent_address || null, b.dob || null, b.gender || null,
            b.marital_status || null, b.emergency_contact_name || null, b.emergency_contact_phone || null,
            b.joining_date || null, b.employment_type || 'full_time', b.probation_period || '3',
            basicSalary, hra, conveyance, medicalAllowance,
            specialAllowance, lta, otherAllowances, pfContribution, gratuity, b.previous_company || null,
            b.previous_designation || null, b.experience_years || null, b.qualification || null,
            b.bank_account || null, b.bank_name || null, b.ifsc_code || null, b.branch_name || null,
            b.account_holder_name || null, b.pan_number || null, b.aadhar_number || null,
          ];

          const result = await runSql(conn, insertSql, params);
          employeeId = result?.insertId || null;
          await conn.query('COMMIT');
          break;
        } catch (err) {
          await conn.query('ROLLBACK').catch(() => {});
          if (isEmployeeCodeDuplicateError(err) && attempt < 4) {
            continue;
          }
          throw err;
        } finally {
          conn.release();
        }
      }

      const accessModules = Array.isArray(b.access_modules) ? b.access_modules : defaultModulesForRole(b.role);
      if (employeeId) {
        await setEmployeeAccessModules({ employeeId, companyId, modules: accessModules });
      }

      return res.json({ success: true, message: 'Employee created successfully', employee_code: employeeCode });
    }



    const queryStr = `INSERT INTO employees (

      company_id, employee_code, name, email, phone, password, role, department_id, designation, status, 

      address, permanent_address, dob, gender, marital_status, emergency_contact_name, 

      emergency_contact_phone, joining_date, employment_type, probation_period, basic_salary, 

      hra, conveyance, medical_allowance, special_allowance, lta, other_allowances, pf_contribution, gratuity, previous_company, 

      previous_designation, experience_years, qualification, bank_account, bank_name, 

      ifsc_code, branch_name, account_holder_name, pan_number, aadhar_number

    ) VALUES (${Array(40).fill('?').join(',')})`;
    let fallbackEmployeeCode = b.employee_code || null;
    if (!fallbackEmployeeCode) {
      try {
        const companyRows = await query('SELECT company_code, company_name FROM companies WHERE id = ? LIMIT 1', [req.employee.company_id]);
        const companyRow = companyRows && companyRows[0];
        const companyCode = normalizeCompanyCode(companyRow?.company_code, companyRow?.company_name);
        fallbackEmployeeCode = await buildCompanyScopedEmployeeCode(companyCode, req.employee.company_id, 'EMP', {
          companyName: companyRow?.company_name,
        });
      } catch (e) {
        fallbackEmployeeCode = `EMP${String(req.employee.company_id || '0')}00001`;
      }
    }

    const params = [

      req.employee.company_id, fallbackEmployeeCode, b.name, b.email, b.phone || null, hashedPassword,

      b.role || 'employee', b.department_id || null, b.designation || null, 'active',

      b.address || null, b.permanent_address || null, b.dob || null, b.gender || null,

      b.marital_status || null, b.emergency_contact_name || null, b.emergency_contact_phone || null,

      b.joining_date || null, b.employment_type || 'full_time', b.probation_period || '3',

      b.basic_salary || null, b.hra || null, b.conveyance || null, b.medical_allowance || null,

      b.special_allowance || null, b.lta || null, b.other_allowances || null, b.pf_contribution || null, b.gratuity || null, b.previous_company || null,

      b.previous_designation || null, b.experience_years || null, b.qualification || null,

      b.bank_account || null, b.bank_name || null, b.ifsc_code || null, b.branch_name || null,

      b.account_holder_name || null, b.pan_number || null, b.aadhar_number || null

    ];



    const result = await query(queryStr, params);

    const employeeId = result?.insertId || null;



    const accessModules = Array.isArray(b.access_modules) ? b.access_modules : defaultModulesForRole(b.role);

    if (employeeId) {

      await setEmployeeAccessModules({ employeeId, companyId: req.employee.company_id, modules: accessModules });

    }



    return res.json({ success: true, message: 'Employee created successfully' });

  } catch (err) {

    if (isEmployeeCodeValidationError(err)) {
      return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
    if (err?.code === 'ER_DUP_ENTRY' && /email/i.test(String(err.message || ''))) {
      return res.status(400).json({ success: false, message: 'Employee email already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });

  }

});



router.put('/employees', verifyToken, requireAdminOrHR, async (req, res) => {

  try {

    await ensureEmployeeCodeSchema();

    const b = req.body || {};

    if (!b.id) return res.status(400).json({ success: false, message: 'Employee ID is required' });

    const rows = await query('SELECT * FROM employees WHERE id = ?', [b.id]);

    const existing = rows[0];

    if (!existing) return res.status(404).json({ success: false, message: 'Employee not found' });

    {
      if (!isSuperAdminRole(req.employee) && Number(existing.company_id) !== Number(req.employee.company_id)) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }

      const requestedCompanyId = getWritableCompanyId(req, b);
      const companyId = isSuperAdminRole(req.employee) && requestedCompanyId
        ? requestedCompanyId
        : existing.company_id || requestedCompanyId;
      const nextDepartmentId = b.department_id !== undefined ? b.department_id : existing.department_id;
      const nextDesignationId = b.designation_id !== undefined ? b.designation_id : existing.designation_id;
      const nextJoiningDate = b.joining_date !== undefined ? b.joining_date : existing.joining_date;
      const designation = nextDesignationId ? await getDesignationById(nextDesignationId) : null;

      if (nextDesignationId && !designation) {
        return res.status(400).json({ success: false, message: 'Designation not found' });
      }

      const basisChanged =
        String(companyId || '') !== String(existing.company_id || '') ||
        String(nextDepartmentId || '') !== String(existing.department_id || '') ||
        String(nextDesignationId || '') !== String(existing.designation_id || '') ||
        String((nextJoiningDate || '').toString().slice(0, 10)) !== String((existing.joining_date || '').toString().slice(0, 10));

      const needsCodeRegeneration =
        basisChanged ||
        !existing.employee_code ||
        String(existing.employee_code || '').includes('/');

      if (needsCodeRegeneration && (!companyId || !nextDepartmentId || !nextDesignationId || !nextJoiningDate)) {
        return res.status(400).json({
          success: false,
          message: 'Company, department, designation and joining date are required to generate employee code',
        });
      }

      const updateFields = [
        'company_id', 'employee_code', 'name', 'email', 'phone', 'role', 'department_id', 'designation', 'designation_id', 'status',
        'address', 'permanent_address', 'dob', 'gender', 'marital_status', 'emergency_contact_name',
        'emergency_contact_phone', 'joining_date', 'employment_type', 'probation_period', 'basic_salary',
        'hra', 'conveyance', 'medical_allowance', 'special_allowance', 'lta', 'other_allowances', 'pf_contribution', 'gratuity', 'previous_company',
        'previous_designation', 'experience_years', 'qualification', 'bank_account', 'bank_name',
        'ifsc_code', 'branch_name', 'account_holder_name', 'pan_number', 'aadhar_number',
      ];

      let employeeCode = existing.employee_code;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const conn = await getConnection();
        try {
          await conn.query('START TRANSACTION');
          if (needsCodeRegeneration) {
            employeeCode = await generateEmployeeCode(companyId, nextDepartmentId, nextDesignationId, nextJoiningDate, {
              connection: conn,
              excludeEmployeeId: existing.id,
            });
          }

          const nextValuesByField = {
            company_id: companyId,
            employee_code: employeeCode,
            name: b.name !== undefined && b.name !== null ? b.name : existing.name,
            email: b.email !== undefined && b.email !== null ? b.email : existing.email,
            phone: b.phone !== undefined && b.phone !== null ? b.phone : existing.phone,
            role: b.role !== undefined && b.role !== null ? b.role : existing.role,
            department_id: nextDepartmentId || null,
            designation: designation?.name || b.designation || existing.designation,
            designation_id: nextDesignationId || null,
            status: b.status !== undefined && b.status !== null ? b.status : existing.status,
            address: b.address !== undefined && b.address !== null ? b.address : existing.address,
            permanent_address: b.permanent_address !== undefined && b.permanent_address !== null ? b.permanent_address : existing.permanent_address,
            dob: b.dob !== undefined && b.dob !== null ? b.dob : existing.dob,
            gender: b.gender !== undefined && b.gender !== null ? b.gender : existing.gender,
            marital_status: b.marital_status !== undefined && b.marital_status !== null ? b.marital_status : existing.marital_status,
            emergency_contact_name: b.emergency_contact_name !== undefined && b.emergency_contact_name !== null ? b.emergency_contact_name : existing.emergency_contact_name,
            emergency_contact_phone: b.emergency_contact_phone !== undefined && b.emergency_contact_phone !== null ? b.emergency_contact_phone : existing.emergency_contact_phone,
            joining_date: nextJoiningDate || null,
            employment_type: b.employment_type !== undefined && b.employment_type !== null ? b.employment_type : existing.employment_type,
            probation_period: b.probation_period !== undefined && b.probation_period !== null ? b.probation_period : existing.probation_period,
            basic_salary: b.basic_salary !== undefined && b.basic_salary !== null ? normalizeSalaryAmount(b.basic_salary) : normalizeSalaryAmount(existing.basic_salary),
            hra: b.hra !== undefined && b.hra !== null ? normalizeSalaryAmount(b.hra) : normalizeSalaryAmount(existing.hra),
            conveyance: b.conveyance !== undefined && b.conveyance !== null ? normalizeSalaryAmount(b.conveyance) : normalizeSalaryAmount(existing.conveyance),
            medical_allowance: b.medical_allowance !== undefined && b.medical_allowance !== null ? normalizeSalaryAmount(b.medical_allowance) : normalizeSalaryAmount(existing.medical_allowance),
            special_allowance: b.special_allowance !== undefined && b.special_allowance !== null ? normalizeSalaryAmount(b.special_allowance) : normalizeSalaryAmount(existing.special_allowance),
            lta: b.lta !== undefined && b.lta !== null ? normalizeSalaryAmount(b.lta) : normalizeSalaryAmount(existing.lta),
            other_allowances: b.other_allowances !== undefined && b.other_allowances !== null ? normalizeSalaryAmount(b.other_allowances) : normalizeSalaryAmount(existing.other_allowances),
            pf_contribution: b.pf_contribution !== undefined && b.pf_contribution !== null ? normalizeSalaryAmount(b.pf_contribution) : normalizeSalaryAmount(existing.pf_contribution),
            gratuity: b.gratuity !== undefined && b.gratuity !== null ? normalizeSalaryAmount(b.gratuity) : normalizeSalaryAmount(existing.gratuity),
            previous_company: b.previous_company !== undefined && b.previous_company !== null ? b.previous_company : existing.previous_company,
            previous_designation: b.previous_designation !== undefined && b.previous_designation !== null ? b.previous_designation : existing.previous_designation,
            experience_years: b.experience_years !== undefined && b.experience_years !== null ? b.experience_years : existing.experience_years,
            qualification: b.qualification !== undefined && b.qualification !== null ? b.qualification : existing.qualification,
            bank_account: b.bank_account !== undefined && b.bank_account !== null ? b.bank_account : existing.bank_account,
            bank_name: b.bank_name !== undefined && b.bank_name !== null ? b.bank_name : existing.bank_name,
            ifsc_code: b.ifsc_code !== undefined && b.ifsc_code !== null ? b.ifsc_code : existing.ifsc_code,
            branch_name: b.branch_name !== undefined && b.branch_name !== null ? b.branch_name : existing.branch_name,
            account_holder_name: b.account_holder_name !== undefined && b.account_holder_name !== null ? b.account_holder_name : existing.account_holder_name,
            pan_number: b.pan_number !== undefined && b.pan_number !== null ? b.pan_number : existing.pan_number,
            aadhar_number: b.aadhar_number !== undefined && b.aadhar_number !== null ? b.aadhar_number : existing.aadhar_number,
          };

          const values = updateFields.map((f) => nextValuesByField[f]);
          values.push(b.id);
          const placeholders = updateFields.map((f) => `${f}=?`).join(', ');
          await runSql(conn, `UPDATE employees SET ${placeholders} WHERE id = ?`, values);
          await conn.query('COMMIT');
          break;
        } catch (err) {
          await conn.query('ROLLBACK').catch(() => {});
          if (isEmployeeCodeDuplicateError(err) && attempt < 4) {
            continue;
          }
          throw err;
        } finally {
          conn.release();
        }
      }

      if (Array.isArray(b.access_modules)) {
        await setEmployeeAccessModules({ employeeId: b.id, companyId: companyId || req.employee.company_id, modules: b.access_modules });
      }

      return res.json({ success: true, message: 'Employee updated successfully', employee_code: employeeCode });
    }



    const updateFields = [

      'employee_code', 'name', 'email', 'phone', 'role', 'department_id', 'designation', 'status',

      'address', 'permanent_address', 'dob', 'gender', 'marital_status', 'emergency_contact_name',

      'emergency_contact_phone', 'joining_date', 'employment_type', 'probation_period', 'basic_salary',

      'hra', 'conveyance', 'medical_allowance', 'special_allowance', 'lta', 'other_allowances', 'pf_contribution', 'gratuity', 'previous_company',

      'previous_designation', 'experience_years', 'qualification', 'bank_account', 'bank_name',

      'ifsc_code', 'branch_name', 'account_holder_name', 'pan_number', 'aadhar_number'

    ];



    const values = updateFields.map((f) => (b[f] !== undefined && b[f] !== null ? b[f] : existing[f]));

    values.push(b.id);

    const placeholders = updateFields.map((f) => `${f}=?`).join(', ');

    await query(`UPDATE employees SET ${placeholders} WHERE id = ?`, values);



    if (Array.isArray(b.access_modules)) {

      await setEmployeeAccessModules({ employeeId: b.id, companyId: existing.company_id || req.employee.company_id, modules: b.access_modules });

    }

    return res.json({ success: true, message: 'Employee updated successfully' });

  } catch (err) {

    if (isEmployeeCodeValidationError(err)) {
      return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
    if (err?.code === 'ER_DUP_ENTRY' && /email/i.test(String(err.message || ''))) {
      return res.status(400).json({ success: false, message: 'Employee email already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });

  }

});



router.delete('/employees', verifyToken, requireAdminOrHR, async (req, res) => {

  try {

    const id = req.query.id || (req.body && req.body.id);

    if (!id) return res.status(400).json({ success: false, message: 'Employee ID is required' });

    if (Number(id) === req.employee.id) return res.status(400).json({ success: false, message: 'Cannot delete your own account' });

    const role = String(req.employee.role || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');
    const isSuper = role === 'superadmin' || role === 'super_admin';

    const deleteSql = isSuper ? 'DELETE FROM employees WHERE id = ?' : 'DELETE FROM employees WHERE id = ? AND company_id = ?';

    const deleteParams = isSuper ? [id] : [id, req.employee.company_id];

    await query(deleteSql, deleteParams);

    return res.json({ success: true, message: 'Employee deleted successfully' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.get('/api-keys', verifyToken, requireAdmin, async (req, res) => {

  try {

    const rows = await query(`

      SELECT c.*, ak.api_key, ak.webhook_url, ak.created_at as api_key_created_at FROM companies c LEFT JOIN api_keys ak ON ak.company_id = c.id ORDER BY c.created_at DESC

    `);

    const [activeKeys] = await query('SELECT COUNT(*) as c FROM api_keys WHERE api_key IS NOT NULL');

    const [totalCompanies] = await query('SELECT COUNT(*) as c FROM companies');

    const integrationStats = await getIntegrationStats();

    return res.json({

      success: true,

      data: {

        companies: rows || [],

        statistics: {

          activeApiKeys: Number(activeKeys?.c) || 0,

          totalCompanies: Number(totalCompanies?.c) || 0,

        },

        integrationStats,

      },

    });

  } catch (err) {

    return res.json({ success: true, data: { companies: [], statistics: { activeApiKeys: 0, totalCompanies: 0 } } });

  }

});



router.post('/api-keys', verifyToken, requireAdmin, async (req, res) => {

  try {

    const companyId = req.body.company_id;

    if (!companyId) return res.status(400).json({ success: false, message: 'Company ID is required' });

    const [company] = await query('SELECT id FROM companies WHERE id = ?', [companyId]);

    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const apiKey = require('crypto').randomBytes(32).toString('hex');

    const existing = await query('SELECT id FROM api_keys WHERE company_id = ?', [companyId]);

    if (existing && existing[0]) {

      await query('UPDATE api_keys SET api_key = ?, updated_at = NOW() WHERE company_id = ?', [apiKey, companyId]);

    } else {

      await query('INSERT INTO api_keys (company_id, api_key) VALUES (?, ?)', [companyId, apiKey]);

    }

    return res.json({ success: true, message: 'API key generated successfully', data: { api_key: apiKey } });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.put('/api-keys', verifyToken, requireAdmin, async (req, res) => {

  try {

    const b = req.body || {};

    await query('UPDATE api_keys SET webhook_url = ?, updated_at = NOW() WHERE company_id = ?', [b.webhook_url || null, b.company_id]).catch(() => { });

    return res.json({ success: true, message: 'API key updated' });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



router.get('/audit-logs', verifyToken, requireAdmin, async (req, res) => {

  try {

    const search = (req.query.search || '').toString().trim();

    const method = (req.query.method || '').toString().trim().toUpperCase();

    const statusGroup = (req.query.status_group || '').toString().trim().toLowerCase(); // success | error

    const { page, safeLimit, safeOffset } = getSafePagination(req.query, { defaultLimit: 50, maxLimit: 200 });

    const limit = Math.min(safeLimit + 1, 201);



    const where = [];

    const params = [];



    if (method) {

      where.push('a.method = ?');

      params.push(method);

    }



    if (statusGroup === 'success') {

      where.push('(a.response_code IS NULL OR a.response_code < 400)');

    } else if (statusGroup === 'error') {

      where.push('a.response_code >= 400');

    }



    if (search) {

      where.push('(a.endpoint LIKE ? OR e.name LIKE ? OR a.ip_address LIKE ?)');

      const like = `%${search}%`;

      params.push(like, like, like);

    }



    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';



    const attempts = [

      {

        // Preferred schema ordering by accessed_at

        sql: `SELECT a.*, e.name as employee_name

              FROM api_audit_log a

              LEFT JOIN employees e ON a.employee_id = e.id

              ${whereSql}

              ORDER BY a.accessed_at DESC

              LIMIT ${limit} OFFSET ${safeOffset}`,

      },

      {

        // Fallback ordering by id

        sql: `SELECT a.*, e.name as employee_name

              FROM api_audit_log a

              LEFT JOIN employees e ON a.employee_id = e.id

              ${whereSql}

              ORDER BY a.id DESC

              LIMIT ${limit} OFFSET ${safeOffset}`,

      },

    ];



    let rows = null;

    let lastErr = null;

    for (const attempt of attempts) {

      try {

        rows = await query(attempt.sql, cleanParams(params));

        lastErr = null;

        break;

      } catch (err) {

        lastErr = err;

        if (err && err.code === 'ER_NO_SUCH_TABLE' && /api_audit_log/i.test(String(err.message || ''))) {

          await ensureApiAuditLogTable();

          continue;

        }

        if (err && (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_PARSE_ERROR')) {

          continue;

        }

        throw err;

      }

    }



    if (lastErr) throw lastErr;



    const hasNext = Array.isArray(rows) && rows.length > safeLimit;

    const pageRows = hasNext ? rows.slice(0, safeLimit) : (rows || []);



    return res.json({ success: true, data: pageRows, page, limit: safeLimit, has_next: hasNext });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message, code: err.code || null });

  }

});



router.get('/companies', verifyToken, requireSuperAdminOnly, async (req, res) => {

  try {
    await ensureEmployeeCodeSchema();

    const rows = await query('SELECT * FROM companies ORDER BY company_name ASC, id DESC LIMIT 200');

    return res.json({ success: true, data: rows || [] });

  } catch (err) {

    return res.json({ success: true, data: [] });

  }

});



router.put('/companies', verifyToken, requireSuperAdminOnly, async (req, res) => {
  try {
    await ensureEmployeeCodeSchema();
    const b = req.body || {};
    const id = b.id || b.company_id;
    if (!id) return res.status(400).json({ success: false, message: 'Company ID is required' });
    const rows = await query('SELECT * FROM companies WHERE id = ?', [id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ success: false, message: 'Company not found' });

    const updateFields = ['company_code', 'company_name', 'email', 'phone', 'address', 'city', 'state', 'country', 'status', 'zip_code', 'website', 'tax_id', 'registration_number'];
    const values = [];
    const fieldsToSet = [];
    
    for (const f of updateFields) {
      if (b[f] !== undefined && b[f] !== null) {
        fieldsToSet.push(`${f}=?`);
        values.push(f === 'company_code' ? normalizeCompanyCode(b[f], b.company_name) : b[f]);
      }
    }
    
    if (fieldsToSet.length === 0) {
      return res.json({ success: true, message: 'No fields to update' });
    }
    
    values.push(id);
    await query(`UPDATE companies SET ${fieldsToSet.join(', ')}, updated_at=NOW() WHERE id = ?`, values);

    // Sync corresponding employee credentials
    if (b.email || b.company_name || b.status || b.password) {
      const empUpdates = [];
      const empValues = [];
      if (b.email) { empUpdates.push('email=?'); empValues.push(b.email); }
      if (b.company_name) { empUpdates.push('name=?'); empValues.push(b.company_name); }
      if (b.status) { empUpdates.push('status=?'); empValues.push(b.status); }
      if (b.password) {
        const hashedPw = await bcrypt.hash(b.password, 10).catch(() => b.password);
        empUpdates.push('password=?');
        empValues.push(hashedPw);
      }
      if (empUpdates.length > 0) {
        empValues.push(id);
        await query(`UPDATE employees SET ${empUpdates.join(', ')} WHERE company_id = ?`, empValues);
      }
    }

    return res.json({ success: true, message: 'Company updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'A company with this email is already registered' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/companies', verifyToken, requireSuperAdminOnly, async (req, res) => {
  try {
    await ensureEmployeeCodeSchema();
    const b = req.body || {};
    if (!b.company_name || !b.email) {
      return res.status(400).json({ success: false, message: 'Company name and email are required' });
    }
    const conn = await getConnection();
    const hashedPassword = await bcrypt.hash(b.password || 'password123', 10).catch(() => b.password || 'password123');
    const [r] = await conn.execute(
      `INSERT INTO companies (
        company_name, email, phone, password, address, city, state, country, zip_code, website, tax_id, registration_number, status
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        b.company_name,
        b.email,
        b.phone || '',
        hashedPassword,
        b.address || '',
        b.city || '',
        b.state || '',
        b.country || '',
        b.zip_code || '',
        b.website || '',
        b.tax_id || '',
        b.registration_number || '',
        b.status || 'active'
      ]
    );
    conn.release();

    // Automatically create/provision an admin employee for this company
    try {
      const companyId = r.insertId;
      const employeeCode = await buildCompanyAdminEmployeeCode(normalizeCompanyCode('', b.company_name), companyId, {
        companyName: b.company_name,
      });
      await query(
        'INSERT INTO employees (employee_code, name, email, password, role, status, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [employeeCode, b.company_name, b.email, hashedPassword, 'admin', 'active', companyId]
      );
    } catch (empErr) {
      console.error('Failed to create admin employee for company:', empErr);
    }

    return res.json({ success: true, message: 'Company created', data: { id: r.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'A company with this email is already registered' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/companies', verifyToken, requireSuperAdminOnly, async (req, res) => {
  try {
    const id = req.query.id || (req.body && (req.body.id || req.body.company_id));
    if (!id) return res.status(400).json({ success: false, message: 'Company ID is required' });
    await query('DELETE FROM employees WHERE company_id = ?', [id]);
    await query('DELETE FROM companies WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Company deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});



router.get('/ai-lead-score', verifyToken, requireAdmin, async (req, res) => {

  try {

    const status = (req.query.status || '').toString().trim().toLowerCase();

    const score = (req.query.score || '').toString().trim().toLowerCase(); // high | medium | low

    const search = (req.query.search || '').toString().trim();



    const where = [];

    const params = [];



    if (status) {

      where.push('l.status = ?');

      params.push(status);

    }



    // Score filtering is applied against lead_score (0-100). If lead_score is NULL, treat as 0.

    if (score === 'high') {

      where.push('COALESCE(l.lead_score, 0) >= 70');

    } else if (score === 'medium') {

      where.push('COALESCE(l.lead_score, 0) BETWEEN 40 AND 69');

    } else if (score === 'low') {

      where.push('COALESCE(l.lead_score, 0) < 40');

    }



    if (search) {

      where.push('(l.company_name LIKE ? OR l.contact_person LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)');

      const like = `%${search}%`;

      params.push(like, like, like, like);

    }



    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';



    const rows = await query(

      `SELECT

         l.id,

         l.lead_code,

         l.company_name,

         l.contact_person,

         l.email,

         l.phone,

         l.status,

         l.priority,

         l.estimated_value,

         COALESCE(l.lead_score, 0) as lead_score,

         l.created_at,

         e.name as assigned_employee_name

       FROM leads l

       LEFT JOIN employees e ON e.id = l.assigned_to

       ${whereSql}

       ORDER BY l.created_at DESC

       LIMIT 200`,

      params

    );



    const safeNumber = (v) => {

      const n = Number(v);

      return Number.isFinite(n) ? n : 0;

    };



    const gradeFor = (s) => {

      if (s >= 85) return 'A';

      if (s >= 70) return 'B';

      if (s >= 55) return 'C';

      if (s >= 40) return 'D';

      return 'E';

    };



    const leads = (rows || []).map((r) => {

      const aiScore = safeNumber(r.lead_score);

      const value = safeNumber(r.estimated_value);

      const isFresh = r.created_at && (Date.now() - new Date(r.created_at).getTime()) <= 7 * 24 * 60 * 60 * 1000;



      // Provide shape expected by the UI without requiring extra DB columns.

      return {

        ...r,

        ai_score: aiScore,

        ai_grade: gradeFor(aiScore),

        ai_factors: [

          { name: 'Lead score', score: aiScore, max: 100 },

          { name: 'Priority', score: r.priority === 'urgent' ? 15 : r.priority === 'high' ? 12 : r.priority === 'medium' ? 8 : 5, max: 15 },

          { name: 'Deal value', score: value >= 500000 ? 20 : value >= 200000 ? 14 : value >= 50000 ? 9 : 5, max: 20 },

          { name: 'Recency', score: isFresh ? 10 : 5, max: 10 },

        ],

        ai_recommendations: [

          aiScore >= 70

            ? { type: 'success', icon: 'fa-bolt', title: 'Prioritize this lead', message: 'High potential. Schedule a call and move to proposal quickly.' }

            : aiScore >= 40

              ? { type: 'warning', icon: 'fa-seedling', title: 'Nurture the lead', message: 'Medium potential. Send follow-up and gather requirements.' }

              : { type: 'danger', icon: 'fa-clipboard-check', title: 'Qualify before effort', message: 'Low potential. Validate budget and intent before investing time.' },

        ],

      };

    });



    const statistics = leads.reduce(

      (acc, l) => {

        acc.totalLeads += 1;

        if (l.ai_score >= 70) acc.highScoreLeads += 1;

        else if (l.ai_score >= 40) acc.mediumScoreLeads += 1;

        else acc.lowScoreLeads += 1;

        return acc;

      },

      { totalLeads: 0, highScoreLeads: 0, mediumScoreLeads: 0, lowScoreLeads: 0 }

    );



    return res.json({ success: true, data: { statistics, leads } });

  } catch (err) {

    // Keep UI stable even if something fails.

    return res.json({ success: true, data: { statistics: { totalLeads: 0, highScoreLeads: 0, mediumScoreLeads: 0, lowScoreLeads: 0 }, leads: [] } });

  }

});



router.post('/generate_offer_letter', verifyToken, requireAdminOrHR, async (req, res) => {

  try {

    const b = req.body || {};

    if (!b.employee_id) return res.status(400).json({ success: false, message: 'employee_id required' });

    const path = require('path');

    const fs = require('fs');

    const documentGenerator = require('../services/documentGenerator');

    const empRows = await query('SELECT e.*, d.name as department_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?', [b.employee_id]);

    const target = empRows[0];

    if (!target) return res.status(404).json({ success: false, message: 'Employee not found' });

    const docData = { name: target.name, designation: b.designation || target.designation || 'Employee', department: target.department_name || 'General', joining_date: b.joining_date || target.joining_date || new Date().toISOString().slice(0, 10), ctc: b.ctc ?? 0, address: b.address || target.address || 'Candidate Address', reporting_manager: b.reporting_manager || 'HR Manager', ...b };

    const pdfBuffer = await documentGenerator.generateOfferLetter(docData);

    const uploadsDir = path.join(__dirname, '../../uploads/hr_documents');

    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const fileName = `Offer_Letter_${target.name.replace(/\s/g, '_')}_${Date.now()}.pdf`;

    const filePath = 'uploads/hr_documents/' + fileName;

    fs.writeFileSync(path.join(__dirname, '../../', filePath), pdfBuffer);

    await query('INSERT INTO hr_documents (employee_id, title, type, file_path) VALUES (?,?,?,?)', [b.employee_id, 'Offer Letter - ' + target.name, 'offer_letter', filePath]);

    return res.json({ success: true, message: 'Offer letter generated', data: { file_path: filePath, file_name: fileName } });

  } catch (err) {

    return res.status(500).json({ success: false, message: err.message });

  }

});



module.exports = router;
