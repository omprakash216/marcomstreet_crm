const express = require('express');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');
const multer = require('multer');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const documentGenerator = require('../services/documentGenerator');
const { normalizeCodePart } = require('../utils/employeeCode');
const { ensureEmployeeCodeSchema } = require('../utils/employeeCodeSchema');

const router = express.Router();
const UPLOADS_HR = path.join(__dirname, '../../uploads/hr_documents');
const UPLOADS_SALARY = path.join(__dirname, '../../uploads/salary_slips');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_HR)) fs.mkdirSync(UPLOADS_HR, { recursive: true });
    cb(null, UPLOADS_HR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + (file.originalname || 'document.pdf'));
  },
});
const upload = multer({ storage });

// Accept common HR role variants stored in DB (some older records use spaces, underscores, or short codes).
const allowedRoles = [
  'admin',
  'superadmin',
  'super_admin',
  'super admin',
  'human_resources',
  'human resources',
  'human resource',
  'humanresources',
  'humanresource',
  'hr',
  'hr_manager',
  'hr manager',
];

function canAccessAll(employee) {
  const role = String(employee?.role || '').toLowerCase().trim();
  return allowedRoles.includes(role);
}

function isSuperAdmin(employee) {
  const role = String(employee?.role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  return role === 'superadmin' || role === 'super_admin';
}

function canAccessSalaryCompany(employee, companyId) {
  if (isSuperAdmin(employee)) return true;
  const requesterCompanyId = Number(employee?.company_id);
  const targetCompanyId = Number(companyId);
  return Number.isFinite(requesterCompanyId) &&
    requesterCompanyId > 0 &&
    requesterCompanyId === targetCompanyId;
}

const salaryStatuses = new Set(['generated', 'paid']);

function normalizeSalaryStatus(value, fallback = 'generated') {
  const status = String(value || '').toLowerCase().trim();
  return salaryStatuses.has(status) ? status : fallback;
}

// HR Documents: allow all authenticated users (super admin, admin, HR, manager, employee, etc.)
function canAccessDocuments(_employee) {
  return true;
}

const attendanceRules = require('../services/attendanceRules');
const workTimer = require('../services/workTimer');

function getMonthBounds(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { first, last };
}

async function ensureJoiningFormSubmissionsTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS joining_form_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      unique_token VARCHAR(128) NOT NULL UNIQUE,
      company_name VARCHAR(255) NULL,
      full_name VARCHAR(255) NULL,
      email VARCHAR(255) NULL,
      contact_number VARCHAR(50) NULL,
      education_json JSON NULL,
      employment_json JSON NULL,
      status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
      submission_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      verification_date DATETIME NULL,
      verified_by INT NULL,
      rejection_reason TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_joining_unique_token (unique_token),
      INDEX idx_joining_status (status),
      INDEX idx_joining_verified_by (verified_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

// Debug endpoint to verify correct backend/routes are running (no auth).
router.get('/__ping', (req, res) => {
  return res.json({
    success: true,
    service: 'hrms',
    has_salary_pdf_route: true,
    time: new Date().toISOString(),
  });
});

// Debug route list (no auth) to confirm this file is loaded by the running server.
router.get('/__routes', (req, res) => {
  return res.json({
    success: true,
    routes: [
      '/documents',
      '/generate_document',
      '/salary',
      '/attendance',
      '/attendance/report',
      '/leaves',
      '/stats',
      '/designations',
      '/shifts',
      '/shifts/assignments',
      '/shifts/assign',
      '/holidays',
      '/announcements',
      '/settings',
      '/leave-types',
      '/leave-balances',
      '/performance',
      '/reports/employees',
      '/reports/leaves',
      '/reports/payroll',
    ],
  });
});

// GET /hrms/documents - list documents
router.get('/documents', verifyToken, async (req, res) => {
  try {
    let sql = `SELECT d.*, e.name as employee_name, e.employee_code 
               FROM hr_documents d JOIN employees e ON d.employee_id = e.id WHERE e.company_id = ?`;
    const params = [];
    if (req.query.employee_id) {
      sql += ' AND d.employee_id = ?';
      params.push(req.query.employee_id);
    }
    sql += ' ORDER BY d.created_at DESC';
    const docs = await query(sql, [req.employee.company_id, ...params]);

    const uploadsRoot = path.resolve(path.join(__dirname, '../../uploads'));
    const safeDocs = (docs || []).filter((doc) => {
      const fp = String(doc.file_path || '').replace(/\\/g, '/').trim();
      if (!fp) return false;
      const normalized = fp.startsWith('uploads/') ? fp : `uploads/${fp.replace(/^\/+/, '')}`;
      const abs = path.resolve(path.join(__dirname, '../../', normalized));
      if (!abs.startsWith(uploadsRoot)) return false;
      if (!fs.existsSync(abs)) return false;
      return true;
    });

    return res.json({ success: true, data: safeDocs });
  } catch (err) {
    console.error('HR documents GET:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /hrms/documents - upload document
router.post('/documents', verifyToken, upload.single('file'), async (req, res) => {
  if (!canAccessDocuments(req.employee)) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const { employee_id, title, type } = req.body || {};
  if (!employee_id || !title || !type) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Document file is required' });
  }
  try {
    const filePath = 'uploads/hr_documents/' + req.file.filename;
    await query(
      'INSERT INTO hr_documents (company_id, employee_id, title, type, file_path) VALUES (?, ?, ?, ?, ?)',
      [req.employee.company_id, employee_id, title, type, filePath]
    );
    return res.json({ success: true, message: 'Document uploaded successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /hrms/documents/:id - delete uploaded/generated document (DB + file)
router.delete('/documents/:id', verifyToken, async (req, res) => {
  if (!canAccessDocuments(req.employee)) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid document id' });
  }

  try {
    const rows = await query('SELECT * FROM hr_documents WHERE id = ?', [id]);
    const doc = Array.isArray(rows) ? rows[0] : null;
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Best-effort: delete file if it lives under uploads/hr_documents/
    const filePath = String(doc.file_path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (filePath.startsWith('uploads/hr_documents/')) {
      const fullPath = path.resolve(path.join(__dirname, '../../', filePath));
      const uploadsRoot = path.resolve(path.join(__dirname, '../../uploads'));
      if (fullPath.startsWith(uploadsRoot) && fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (_) { }
      }
    }

    await query('DELETE FROM hr_documents WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    console.error('HR documents DELETE:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /hrms/generate_document - generate offer/experience/joining PDF
router.post('/generate_document', verifyToken, async (req, res) => {
  if (!canAccessDocuments(req.employee)) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const { type, employee_id, ...data } = req.body || {};
  if (!type || !employee_id) {
    return res.status(400).json({ success: false, message: 'Missing document type or employee ID' });
  }
  let fullPathWritten = null;
  try {
    const empRows = await query(
      `SELECT e.*, d.name as department_name 
       FROM employees e 
       LEFT JOIN departments d ON e.department_id = d.id 
       WHERE e.id = ?`,
      [Number(employee_id)]
    );
    const target = Array.isArray(empRows) ? empRows[0] : null;
    if (!target) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const safeName = (target.name || 'Employee').toString().replace(/\s/g, '_').replace(/[^\w\-]/g, '') || 'Employee';

    const docData = {
      name: target.name || 'Employee',
      designation: data.designation || target.designation || 'Employee',
      department: target.department_name || 'General',
      joining_date: data.joining_date || target.joining_date || new Date().toISOString().slice(0, 10),
      ctc: data.ctc ?? 0,
      address: data.address || target.address || 'Candidate Address',
      reporting_manager: data.reporting_manager || 'HR Manager',
      relieving_date: data.relieving_date || new Date().toISOString().slice(0, 10),
      ...data,
    };

    let pdfBuffer;
    let fileName;
    if (type === 'offer_letter') {
      pdfBuffer = await documentGenerator.generateOfferLetter(docData);
      fileName = `Offer_Letter_${safeName}_${Date.now()}.pdf`;
    } else if (type === 'experience_letter') {
      pdfBuffer = await documentGenerator.generateExperienceLetter(docData);
      fileName = `Experience_Letter_${safeName}_${Date.now()}.pdf`;
      } else if (type === 'joining_form') {
        pdfBuffer = await documentGenerator.generateJoiningForm(docData);
        fileName = `Joining_Form_${safeName}_${Date.now()}.pdf`;
      } else if (type === 'full_and_final') {
        pdfBuffer = await documentGenerator.generateFullAndFinalLetter({
          ...docData,
          last_working_date: data.last_working_date || data.relieving_date || docData.relieving_date,
        });
        fileName = `Full_And_Final_${safeName}_${Date.now()}.pdf`;
      } else {
        return res.status(400).json({ success: false, message: `Unsupported document type: ${type}` });
      }

    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 100) {
      return res.status(500).json({ success: false, message: 'Failed to generate PDF' });
    }

    if (!fs.existsSync(UPLOADS_HR)) fs.mkdirSync(UPLOADS_HR, { recursive: true });
    const filePath = 'uploads/hr_documents/' + fileName;
    fullPathWritten = path.join(__dirname, '../../', filePath);
    fs.writeFileSync(fullPathWritten, pdfBuffer);

    // hr_documents: only columns (employee_id, title, type, file_path). type ENUM = offer_letter, experience_letter, policy, other
    const dbType = (type === 'joining_form' || type === 'full_and_final') ? 'other' : type;
    const title = (type.replace(/_/g, ' ') + ' - ' + (target.name || 'Employee')).slice(0, 255);
    const companyId = Number(req.employee?.company_id || target.company_id) || null;

    try {
      if (companyId !== null) {
        await query(
          'INSERT INTO hr_documents (company_id, employee_id, title, type, file_path) VALUES (?, ?, ?, ?, ?)',
          [companyId, Number(employee_id), title, dbType, filePath]
        );
      } else {
        await query(
          'INSERT INTO hr_documents (employee_id, title, type, file_path) VALUES (?, ?, ?, ?)',
          [Number(employee_id), title, dbType, filePath]
        );
      }
    } catch (insertErr) {
      const imsg = (insertErr && insertErr.message) ? String(insertErr.message) : '';

      // Fallbacks for legacy schemas or drivers that dislike prepared statements
      if (imsg.includes('Incorrect arguments to mysqld_stmt_execute')) {
        const rawInsert = async (useCompany) => {
          const cols = useCompany
            ? 'company_id, employee_id, title, type, file_path'
            : 'employee_id, title, type, file_path';
          const vals = useCompany
            ? [companyId, Number(employee_id), title, dbType, filePath]
            : [Number(employee_id), title, dbType, filePath];
          const rawValues = vals.map((v) => mysql.escape(v));
          const rawSql = `INSERT INTO hr_documents (${cols}) VALUES (${rawValues.join(',')})`;
          await query(rawSql);
        };

        try {
          if (companyId !== null) {
            await rawInsert(true);
          } else {
            await rawInsert(false);
          }
        } catch (rawErr) {
          const rmsg = (rawErr && rawErr.message) ? String(rawErr.message) : '';
          if (companyId !== null) {
            try {
              await rawInsert(false);
            } catch (rawErr2) {
              const rmsg2 = (rawErr2 && rawErr2.message) ? String(rawErr2.message) : '';
              if (fullPathWritten && fs.existsSync(fullPathWritten)) {
                try { fs.unlinkSync(fullPathWritten); } catch (_) { }
              }
              return res.status(500).json({
                success: false,
                message: rmsg2.includes('generated_by')
                  ? 'Database missing column. Run migration 006 or use a DB with hr_documents (employee_id, title, type, file_path) only.'
                  : ('Save failed: ' + rmsg2),
              });
            }
          } else {
            if (fullPathWritten && fs.existsSync(fullPathWritten)) {
              try { fs.unlinkSync(fullPathWritten); } catch (_) { }
            }
            return res.status(500).json({
              success: false,
              message: rmsg.includes('generated_by')
                ? 'Database missing column. Run migration 006 or use a DB with hr_documents (employee_id, title, type, file_path) only.'
                : ('Save failed: ' + rmsg),
            });
          }
        }
      } else if (imsg.includes("Unknown column 'company_id'")) {
        try {
          await query(
            'INSERT INTO hr_documents (employee_id, title, type, file_path) VALUES (?, ?, ?, ?)',
            [Number(employee_id), title, dbType, filePath]
          );
        } catch (fallbackErr) {
          const fmsg = (fallbackErr && fallbackErr.message) ? String(fallbackErr.message) : '';
          if (fullPathWritten && fs.existsSync(fullPathWritten)) {
            try { fs.unlinkSync(fullPathWritten); } catch (_) { }
          }
          return res.status(500).json({
            success: false,
            message: fmsg.includes('generated_by')
              ? 'Database missing column. Run migration 006 or use a DB with hr_documents (employee_id, title, type, file_path) only.'
              : ('Save failed: ' + fmsg),
          });
        }
      } else {
        if (fullPathWritten && fs.existsSync(fullPathWritten)) {
          try { fs.unlinkSync(fullPathWritten); } catch (_) { }
        }
        return res.status(500).json({
          success: false,
          message: imsg.includes('generated_by')
            ? 'Database missing column. Run migration 006 or use a DB with hr_documents (employee_id, title, type, file_path) only.'
            : ('Save failed: ' + imsg),
        });
      }
    }

    return res.json({
      success: true,
      message: 'Document generated successfully',
      data: {
        file_path: filePath,
        file_name: fileName,
        file_size: pdfBuffer.length,
      },
    });
  } catch (err) {
    console.error('Generate document error:', err);
    if (fullPathWritten && fs.existsSync(fullPathWritten)) {
      try { fs.unlinkSync(fullPathWritten); } catch (_) { }
    }
    const msg = (err && err.message) ? String(err.message) : 'PDF generation failed';
    return res.status(500).json({
      success: false,
      message: 'Error generating PDF: ' + msg,
    });
  }
});

// GET /hrms/salary - list salary slips
router.get('/salary', verifyToken, async (req, res) => {
  try {
    let sql = `SELECT s.*, e.name as employee_name, e.employee_code, e.designation, e.bank_account, e.bank_name, e.ifsc_code, e.branch_name, e.account_holder_name, e.pan_number, d.name as department
               FROM salary_slips s JOIN employees e ON s.employee_id = e.id
               LEFT JOIN departments d ON e.department_id = d.id`;
    const where = [];
    const params = [];
    if (!isSuperAdmin(req.employee)) {
      if (!Number(req.employee?.company_id)) {
        return res.json({ success: true, data: [] });
      }
      where.push('e.company_id = ?');
      params.push(req.employee.company_id);
    }
    if (!canAccessAll(req.employee)) {
      where.push('s.employee_id = ?');
      params.push(req.employee.id);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY s.month DESC, s.created_at DESC';
    const slips = await query(sql, params);
    return res.json({ success: true, data: slips || [] });
  } catch (err) {
    console.error('Salary GET:', err);
    const msg = (err && err.message) ? String(err.message) : 'Failed to load salary slips';
    if (msg.includes("doesn't exist") || msg.includes('Unknown column')) {
      return res.json({ success: true, data: [] });
    }
    return res.status(500).json({ success: false, message: msg });
  }
});

// GET /hrms/salary/:id/pdf - download/view salary slip (regenerates file if missing)
router.get('/salary/:id/pdf', verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid salary slip id' });
    }

    const rows = await query(
      `SELECT s.*, e.company_id as employee_company_id, e.name as employee_name, e.employee_code, e.designation, e.joining_date, e.bank_account, e.ifsc_code, e.account_holder_name, e.pan_number, d.name as department
       FROM salary_slips s JOIN employees e ON s.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE s.id = ?`,
      [id]
    );
    const slip = Array.isArray(rows) ? rows[0] : null;
    if (!slip) {
      return res.status(404).json({ success: false, message: 'Salary slip not found' });
    }

    if (!canAccessSalaryCompany(req.employee, slip.employee_company_id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Access control: employees can only access their own slips.
    if (!canAccessAll(req.employee) && Number(slip.employee_id) !== Number(req.employee.id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const wantsDownload =
      req.query.download === '1' || req.query.download === 'true' || req.query.disposition === 'attachment';
    const forceRegen =
      req.query.regen === '1' ||
      req.query.regen === 'true' ||
      req.query.force === '1' ||
      req.query.force === 'true' ||
      Boolean(req.query.ts);

    const cleanEmpCode = String(slip.employee_code || 'EMP').trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const cleanMonth = String(slip.month || '').trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFilename = `salary-slip_${cleanEmpCode}_${cleanMonth}.pdf`;

    const ensureAndSend = (absPath, filename) => {
      const stat = fs.statSync(absPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      res.setHeader('X-Salary-PDF-Generated-At', new Date().toISOString());
      res.setHeader(
        'Content-Disposition',
        `${wantsDownload ? 'attachment' : 'inline'}; filename="${filename}"`
      );
      fs.createReadStream(absPath).pipe(res);
    };

    // If file exists on disk, stream it (unless forced regenerate).
    const filePath = String(slip.file_path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!forceRegen && filePath.startsWith('uploads/salary_slips/')) {
      const abs = path.resolve(path.join(__dirname, '../../', filePath));
      const uploadsRoot = path.resolve(path.join(__dirname, '../../uploads'));
      if (abs.startsWith(uploadsRoot) && fs.existsSync(abs)) {
        return ensureAndSend(abs, safeFilename);
      }
    }

    // Regenerate PDF if missing/bad path.
    if (!fs.existsSync(UPLOADS_SALARY)) fs.mkdirSync(UPLOADS_SALARY, { recursive: true });
    const monthStr = String(slip.month || '').trim(); // expected "YYYY-MM"
    const monthSafe = monthStr ? monthStr.replace(/-/g, '') : 'UNKNOWN';
    const code = String(slip.employee_code || 'EMP').replace(/[^\w\-]/g, '') || 'EMP';
    const fileName = `${code}_${monthSafe}_${Date.now()}.pdf`;
    const newRelPath = 'uploads/salary_slips/' + fileName;
    const absOut = path.join(__dirname, '../../', newRelPath);

    const employeeData = {
      name: slip.employee_name || 'Employee',
      employee_code: slip.employee_code || code,
      designation: slip.designation || '',
      joining_date: slip.joining_date || '',
      department: slip.department || '',
      bank_account: slip.bank_account || '',
      ifsc_code: slip.ifsc_code || '',
      account_holder_name: slip.account_holder_name || '',
      pan_number: slip.pan_number || '',
    };

    const salaryData = {
      month: monthStr,
      pay_period_start: slip.pay_period_start,
      pay_period_end: slip.pay_period_end,
      basic_salary: slip.basic_salary,
      hra: slip.hra,
      conveyance_allowance: slip.conveyance_allowance,
      medical_allowance: slip.medical_allowance,
      special_allowance: slip.special_allowance,
      other_allowances: slip.other_allowances,
      gross_salary: slip.gross_salary,
      pf_deduction: slip.pf_deduction,
      esi_deduction: slip.esi_deduction,
      tax_deduction: slip.tax_deduction,
      professional_tax: slip.professional_tax,
      other_deductions: slip.other_deductions,
      total_deductions: slip.total_deductions,
      net_salary: slip.net_salary,
      payment_mode: slip.payment_mode || '',
    };

    const pdfBuffer = await documentGenerator.generateSalarySlip(employeeData, salaryData);
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 100) {
      return res.status(500).json({ success: false, message: 'Failed to generate salary slip PDF' });
    }
    fs.writeFileSync(absOut, pdfBuffer);
    try {
      await query('UPDATE salary_slips SET file_path = ? WHERE id = ?', [newRelPath, id]);
      if (filePath.startsWith('uploads/salary_slips/')) {
        const absOld = path.resolve(path.join(__dirname, '../../', filePath));
        const uploadsRoot = path.resolve(path.join(__dirname, '../../uploads'));
        if (absOld !== absOut && absOld.startsWith(uploadsRoot) && fs.existsSync(absOld)) {
          try { fs.unlinkSync(absOld); } catch (_) { }
        }
      }
    } catch (_) { }

    return ensureAndSend(absOut, safeFilename);
  } catch (err) {
    console.error('Salary PDF:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to serve salary slip PDF' });
  }
});

// PUT /hrms/salary/:id - update salary slip (HR/Admin only) and regenerate PDF
router.put('/salary/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid salary slip id' });
  }
  const d = req.body || {};
  if (!d.month) {
    return res.status(400).json({ success: false, message: 'Missing month' });
  }

  const basicSalary = parseFloat(d.basic_salary) || 0;
  const hra = parseFloat(d.hra) || 0;
  const conveyanceAllowance = parseFloat(d.conveyance_allowance) || 0;
  const medicalAllowance = parseFloat(d.medical_allowance) || 0;
  const specialAllowance = parseFloat(d.special_allowance) || 0;
  const otherAllowances = parseFloat(d.other_allowances) || 0;
  const pfDeduction = parseFloat(d.pf_deduction) || 0;
  const esiDeduction = parseFloat(d.esi_deduction) || 0;
  const taxDeduction = parseFloat(d.tax_deduction) || 0;
  const professionalTax = parseFloat(d.professional_tax) || 0;
  const otherDeductions = parseFloat(d.other_deductions) || 0;

  const grossSalary = basicSalary + hra + conveyanceAllowance + medicalAllowance + specialAllowance + otherAllowances;
  const totalDeductions = pfDeduction + esiDeduction + taxDeduction + professionalTax + otherDeductions;
  const netSalary = grossSalary - totalDeductions;
  if (grossSalary <= 0) {
    return res.status(400).json({ success: false, message: 'Gross salary must be greater than zero' });
  }

  try {
    const rows = await query(
      `SELECT s.*, e.company_id as employee_company_id, e.name as employee_name, e.employee_code, e.designation, e.joining_date, e.bank_account, e.ifsc_code, e.account_holder_name, e.pan_number, d.name as department
       FROM salary_slips s JOIN employees e ON s.employee_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE s.id = ?`,
      [id]
    );
    const slip = Array.isArray(rows) ? rows[0] : null;
    if (!slip) {
      return res.status(404).json({ success: false, message: 'Salary slip not found' });
    }
    if (!canAccessSalaryCompany(req.employee, slip.employee_company_id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Update DB first (file_path will be updated after regeneration)
    await query(
      `UPDATE salary_slips SET
        month = ?, pay_period_start = ?, pay_period_end = ?,
        basic_salary = ?, hra = ?, conveyance_allowance = ?, medical_allowance = ?, special_allowance = ?, other_allowances = ?,
        pf_deduction = ?, esi_deduction = ?, tax_deduction = ?, professional_tax = ?, other_deductions = ?,
        gross_salary = ?, total_deductions = ?, net_salary = ?, status = ?
       WHERE id = ?`,
      [
        String(d.month).trim(),
        d.pay_period_start || slip.pay_period_start || null,
        d.pay_period_end || slip.pay_period_end || null,
        basicSalary,
        hra,
        conveyanceAllowance,
        medicalAllowance,
        specialAllowance,
        otherAllowances,
        pfDeduction,
        esiDeduction,
        taxDeduction,
        professionalTax,
        otherDeductions,
        grossSalary,
        totalDeductions,
        netSalary,
        normalizeSalaryStatus(d.status, normalizeSalaryStatus(slip.status)),
        id,
      ]
    );

    // Regenerate PDF with latest template (letter-head.png)
    if (!fs.existsSync(UPLOADS_SALARY)) fs.mkdirSync(UPLOADS_SALARY, { recursive: true });
    const monthStr = String(d.month || slip.month || '').trim(); // "YYYY-MM"
    const monthSafe = monthStr ? monthStr.replace(/-/g, '') : 'UNKNOWN';
    const code = String(slip.employee_code || 'EMP').replace(/[^\w\-]/g, '') || 'EMP';
    const fileName = `${code}_${monthSafe}_${Date.now()}.pdf`;
    const newRelPath = 'uploads/salary_slips/' + fileName;
    const absOut = path.join(__dirname, '../../', newRelPath);

    const employeeData = {
      name: slip.employee_name || 'Employee',
      employee_code: slip.employee_code || code,
      designation: slip.designation || '',
      joining_date: slip.joining_date || '',
      department: slip.department || '',
      bank_account: slip.bank_account || '',
      ifsc_code: slip.ifsc_code || '',
      account_holder_name: slip.account_holder_name || '',
      pan_number: slip.pan_number || '',
    };
    const salaryData = {
      month: monthStr,
      pay_period_start: d.pay_period_start || slip.pay_period_start,
      pay_period_end: d.pay_period_end || slip.pay_period_end,
      basic_salary: basicSalary,
      hra,
      conveyance_allowance: conveyanceAllowance,
      medical_allowance: medicalAllowance,
      special_allowance: specialAllowance,
      other_allowances: otherAllowances,
      gross_salary: grossSalary,
      pf_deduction: pfDeduction,
      esi_deduction: esiDeduction,
      tax_deduction: taxDeduction,
      professional_tax: professionalTax,
      other_deductions: otherDeductions,
      total_deductions: totalDeductions,
      net_salary: netSalary,
      payment_mode: d.payment_mode || slip.payment_mode || '',
    };

    const pdfBuffer = await documentGenerator.generateSalarySlip(employeeData, salaryData);
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 100) {
      return res.status(500).json({ success: false, message: 'Failed to regenerate salary slip PDF' });
    }
    fs.writeFileSync(absOut, pdfBuffer);

    // Best effort cleanup of old file
    const oldPath = String(slip.file_path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (oldPath.startsWith('uploads/salary_slips/')) {
      const absOld = path.resolve(path.join(__dirname, '../../', oldPath));
      const uploadsRoot = path.resolve(path.join(__dirname, '../../uploads'));
      if (absOld.startsWith(uploadsRoot) && fs.existsSync(absOld)) {
        try { fs.unlinkSync(absOld); } catch (_) { }
      }
    }
    try {
      await query('UPDATE salary_slips SET file_path = ? WHERE id = ?', [newRelPath, id]);
    } catch (_) { }

    return res.json({ success: true, message: 'Salary slip updated successfully', data: { id, file_path: newRelPath } });
  } catch (err) {
    console.error('Salary PUT:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to update salary slip' });
  }
});

// DELETE /hrms/salary/:id - delete salary slip (HR/Admin only)
router.delete('/salary/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid salary slip id' });
  }
  try {
    const rows = await query(
      `SELECT s.id, s.file_path, e.company_id as employee_company_id
       FROM salary_slips s JOIN employees e ON s.employee_id = e.id
       WHERE s.id = ?`,
      [id]
    );
    const slip = Array.isArray(rows) ? rows[0] : null;
    if (!slip) {
      return res.status(404).json({ success: false, message: 'Salary slip not found' });
    }
    if (!canAccessSalaryCompany(req.employee, slip.employee_company_id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await query('DELETE FROM salary_slips WHERE id = ?', [id]);

    const rel = String(slip.file_path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (rel.startsWith('uploads/salary_slips/')) {
      const abs = path.resolve(path.join(__dirname, '../../', rel));
      const uploadsRoot = path.resolve(path.join(__dirname, '../../uploads'));
      if (abs.startsWith(uploadsRoot) && fs.existsSync(abs)) {
        try { fs.unlinkSync(abs); } catch (_) { }
      }
    }
    return res.json({ success: true, message: 'Salary slip deleted successfully' });
  } catch (err) {
    console.error('Salary DELETE:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete salary slip' });
  }
});

// POST /hrms/salary - generate salary slip PDF
router.post('/salary', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const d = req.body || {};
  if (!d.employee_id || !d.month) {
    return res.status(400).json({ success: false, message: 'Missing employee_id or month' });
  }

  const basicSalary = parseFloat(d.basic_salary) || 0;
  const hra = parseFloat(d.hra) || 0;
  const conveyanceAllowance = parseFloat(d.conveyance_allowance) || 0;
  const medicalAllowance = parseFloat(d.medical_allowance) || 0;
  const specialAllowance = parseFloat(d.special_allowance) || 0;
  const otherAllowances = parseFloat(d.other_allowances) || 0;
  const pfDeduction = parseFloat(d.pf_deduction) || 0;
  const esiDeduction = parseFloat(d.esi_deduction) || 0;
  const taxDeduction = parseFloat(d.tax_deduction) || 0;
  const professionalTax = parseFloat(d.professional_tax) || 0;
  const otherDeductions = parseFloat(d.other_deductions) || 0;

  const grossSalary = basicSalary + hra + conveyanceAllowance + medicalAllowance + specialAllowance + otherAllowances;
  const totalDeductions = pfDeduction + esiDeduction + taxDeduction + professionalTax + otherDeductions;
  const netSalary = grossSalary - totalDeductions;

  if (grossSalary <= 0) {
    return res.status(400).json({ success: false, message: 'Gross salary must be greater than zero' });
  }

  let generatedFilePath = null;
  try {
    const empRows = await query(
      'SELECT e.*, d.name as department FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?',
      [d.employee_id]
    );
    const employeeData = Array.isArray(empRows) ? empRows[0] : null;
    if (!employeeData) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    if (!canAccessSalaryCompany(req.employee, employeeData.company_id)) {
      return res.status(403).json({ success: false, message: 'Employee is outside your company' });
    }

    // Last day of month for pay_period_end (avoid timezone issues)
    const monthStr = String(d.month || '').trim();
    const payPeriodStart = d.pay_period_start || (monthStr ? monthStr + '-01' : null);
    let payPeriodEnd = d.pay_period_end;
    if (!payPeriodEnd && monthStr) {
      const [y, m] = monthStr.split('-').map(Number);
      const lastDay = new Date(y, m || 1, 0);
      payPeriodEnd = lastDay.getFullYear() + '-' + String(lastDay.getMonth() + 1).padStart(2, '0') + '-' + String(lastDay.getDate()).padStart(2, '0');
    }

    const salaryData = {
      month: monthStr,
      pay_period_start: payPeriodStart,
      pay_period_end: payPeriodEnd || payPeriodStart,
      basic_salary: basicSalary,
      hra,
      conveyance_allowance: conveyanceAllowance,
      medical_allowance: medicalAllowance,
      special_allowance: specialAllowance,
      other_allowances: otherAllowances,
      gross_salary: grossSalary,
      pf_deduction: pfDeduction,
      esi_deduction: esiDeduction,
      tax_deduction: taxDeduction,
      professional_tax: professionalTax,
      other_deductions: otherDeductions,
      total_deductions: totalDeductions,
      net_salary: netSalary,
      payment_mode: d.payment_mode || employeeData.payment_mode || '',
    };

    const pdfBuffer = await documentGenerator.generateSalarySlip(employeeData, salaryData);
    if (!pdfBuffer || pdfBuffer.length < 100) {
      return res.status(500).json({ success: false, message: 'Failed to generate salary slip PDF' });
    }

    if (!fs.existsSync(UPLOADS_SALARY)) fs.mkdirSync(UPLOADS_SALARY, { recursive: true });
    const fileName = (employeeData.employee_code || 'EMP') + '_' + d.month.replace(/-/g, '') + '_' + Date.now() + '.pdf';
    const filePath = 'uploads/salary_slips/' + fileName;
    const fullPath = path.join(__dirname, '../../', filePath);
    fs.writeFileSync(fullPath, pdfBuffer);
    generatedFilePath = fullPath;

    const salaryInsert = {
      employee_id: d.employee_id,
      pay_period_start: salaryData.pay_period_start,
      pay_period_end: salaryData.pay_period_end,
      month: d.month,
      basic_salary: basicSalary,
      hra,
      conveyance_allowance: conveyanceAllowance,
      medical_allowance: medicalAllowance,
      special_allowance: specialAllowance,
      other_allowances: otherAllowances,
      gross_salary: grossSalary,
      pf_deduction: pfDeduction,
      esi_deduction: esiDeduction,
      tax_deduction: taxDeduction,
      professional_tax: professionalTax,
      other_deductions: otherDeductions,
      total_deductions: totalDeductions,
      net_salary: netSalary,
      amount: grossSalary,
      file_path: filePath,
      status: normalizeSalaryStatus(d.status),
    };
    const insertColumns = Object.keys(salaryInsert);
    const insertValues = Object.values(salaryInsert);
    const insertPlaceholders = insertColumns.map(() => '?').join(', ');
    const salaryCompanyId = employeeData.company_id || req.employee.company_id;
    await query(
      `INSERT INTO salary_slips (company_id, ${insertColumns.join(', ')}) VALUES (?, ${insertPlaceholders})`, [salaryCompanyId, ...insertValues]
    );

    return res.json({
      success: true,
      message: 'Salary slip generated successfully',
      data: {
        file_path: filePath,
        gross_salary: grossSalary,
        net_salary: netSalary,
      },
    });
  } catch (err) {
    if (generatedFilePath && fs.existsSync(generatedFilePath)) {
      try { fs.unlinkSync(generatedFilePath); } catch (_) { }
    }
    console.error('Salary POST:', err);
    let msg = (err && err.message) ? String(err.message) : 'Salary slip generation failed';
    if (msg.includes('Unknown column') || msg.includes('ER_BAD_FIELD_ERROR')) {
      msg = 'Database schema may be outdated. Ensure salary_slips table has all columns (run database/COMPLETE_DATABASE_SETUP.sql or migrations).';
    }
    return res.status(500).json({ success: false, message: msg });
  }
});

// GET/POST/PUT leaves
router.get('/leaves', verifyToken, async (req, res) => {
  try {
    let sql = `SELECT l.*, e.name as employee_name, e.role as employee_role, e.designation, a.name as approved_by_name
      FROM leaves l JOIN employees e ON l.employee_id = e.id LEFT JOIN employees a ON l.approved_by = a.id WHERE e.company_id = ?`; const params = [req.employee.company_id];
    if (!canAccessAll(req.employee)) { sql += ' AND l.employee_id = ?'; params.push(req.employee.id); }
    sql += ' ORDER BY l.created_at DESC';
    let rows = [];
    try {
      rows = await query(sql, params);
    } catch (err) {
      // Fallback for older schemas missing e.role / e.designation columns
      const msg = (err && err.message) ? String(err.message) : '';
      if (!(msg.includes("Unknown column") || msg.includes("doesn't exist") || msg.includes('ER_BAD_FIELD_ERROR'))) throw err;

      let sql2 = `SELECT l.*, e.name as employee_name, 'employee' as employee_role, NULL as designation, a.name as approved_by_name
        FROM leaves l JOIN employees e ON l.employee_id = e.id LEFT JOIN employees a ON l.approved_by = a.id WHERE e.company_id = ?`;
      const params2 = [req.employee.company_id];
      if (!canAccessAll(req.employee)) { sql2 += ' AND l.employee_id = ?'; params2.push(req.employee.id); }
      sql2 += ' ORDER BY l.created_at DESC';
      rows = await query(sql2, params2).catch(() => []);
    }
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/leaves', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.type || !b.start_date || !b.end_date) return res.status(400).json({ success: false, message: 'Missing required fields' });
    await query(
      'INSERT INTO leaves (employee_id, type, start_date, end_date, reason, status) VALUES (?,?,?,?,?,\'pending\')',
      [req.employee.id, b.type, b.start_date, b.end_date, b.reason || '']
    );
    return res.json({ success: true, message: 'Leave application submitted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/leaves', verifyToken, async (req, res) => {
  try {
    if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
    const b = req.body || {};
    if (!b.id || !b.status) return res.status(400).json({ success: false, message: 'Missing required fields' });
    // Some DBs don't have admin_reason column; update it best-effort.
    try {
      await query(
        'UPDATE leaves SET status = ?, approved_by = ?, admin_reason = ? WHERE id = ?',
        [b.status, req.employee.id, b.admin_reason || null, b.id]
      );
    } catch (err) {
      const msg = (err && err.message) ? String(err.message) : '';
      if (!(msg.includes("Unknown column") || msg.includes('ER_BAD_FIELD_ERROR'))) throw err;
      await query('UPDATE leaves SET status = ?, approved_by = ? WHERE id = ?', [b.status, req.employee.id, b.id]);
    }
    // Update leave balance if approved and balance table exists
    if (String(b.status).toLowerCase() === 'approved') {
      try {
        const [leaveRow] = await query('SELECT employee_id, type, start_date, end_date FROM leaves WHERE id = ?', [b.id]);
        if (leaveRow) {
          const typeName = String(leaveRow.type || '').trim().toLowerCase();
          const [typeRow] = await query('SELECT id FROM hr_leave_types WHERE LOWER(name) = ? OR LOWER(code) = ? LIMIT 1', [typeName, typeName]);
          if (typeRow && typeRow.id) {
            const days =
              Math.max(1, Math.floor((new Date(leaveRow.end_date) - new Date(leaveRow.start_date)) / (1000 * 60 * 60 * 24)) + 1);
            await query(
              'INSERT INTO hr_leave_balances (employee_id, leave_type_id, balance) VALUES (?, ?, GREATEST(0, (SELECT default_balance FROM hr_leave_types WHERE id = ?) - ?)) ON DUPLICATE KEY UPDATE balance = GREATEST(0, balance - ?)',
              [leaveRow.employee_id, typeRow.id, typeRow.id, days, days]
            );
          }
        }
      } catch (_) {
        // Optional: ignore if tables are missing or date parsing fails
      }
    }
    return res.json({ success: true, message: 'Leave status updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET/POST hrms/attendance (history + punch in/out)
router.get('/attendance', verifyToken, async (req, res) => {
  try {
      let sql = `SELECT c.*, e.name as employee_name, d.name as department,
        CASE WHEN c.check_in_time IS NOT NULL AND c.check_out_time IS NOT NULL THEN 'completed' WHEN c.check_in_time IS NOT NULL THEN 'checked_in' ELSE 'not_checked_in' END as attendance_status,
        CASE
          WHEN c.total_hours IS NOT NULL AND c.total_hours > 0 THEN c.total_hours
          WHEN c.worked_seconds IS NOT NULL AND c.worked_seconds > 0 THEN ROUND(c.worked_seconds / 3600, 2)
          WHEN c.check_in_time IS NOT NULL AND c.check_out_time IS NOT NULL THEN ROUND(TIMESTAMPDIFF(MINUTE, CONCAT(c.date, ' ', c.check_in_time), CONCAT(c.date, ' ', c.check_out_time)) / 60.0, 2)
          WHEN c.check_in_time IS NOT NULL AND c.check_out_time IS NULL THEN ROUND(GREATEST(TIMESTAMPDIFF(SECOND, CONCAT(c.date, ' ', c.check_in_time), NOW()) - COALESCE(c.break_seconds, 0), 0) / 3600, 2)
          ELSE NULL
        END as total_hours
        FROM employee_checkins c JOIN employees e ON c.employee_id = e.id LEFT JOIN departments d ON e.department_id = d.id WHERE e.company_id = ?`; const params = [req.employee.company_id];
    if (!canAccessAll(req.employee)) { sql += ' AND c.employee_id = ?'; params.push(req.employee.id); }
    else if (req.query.employee_id) { sql += ' AND c.employee_id = ?'; params.push(req.query.employee_id); }
    if (req.query.date_from) { sql += ' AND c.date >= ?'; params.push(req.query.date_from); }
    if (req.query.date_to) { sql += ' AND c.date <= ?'; params.push(req.query.date_to); }
    // Some DBs don't have created_at on employee_checkins; id ordering is always safe.
    sql += ' ORDER BY c.date DESC, c.id DESC';
    let rows;
      try {
        rows = await query(sql, params);
      } catch (e) {
        const msg = String((e && e.message) || '');
        // Backward compatibility for old DB schema without check_in/check_out columns or new timer columns.
        if (
          msg.includes("Unknown column 'c.check_in_time'") ||
          msg.includes("Unknown column 'check_in_time'") ||
          msg.includes("Unknown column 'c.worked_seconds'") ||
          msg.includes("Unknown column 'worked_seconds'") ||
          msg.includes("Unknown column 'c.break_seconds'") ||
          msg.includes("Unknown column 'break_seconds'") ||
          msg.includes("Unknown column 'c.total_hours'") ||
          msg.includes("Unknown column 'total_hours'")
        ) {
          let fallbackSql = `SELECT c.*, e.name as employee_name, d.name as department,
            CASE WHEN c.time IS NOT NULL THEN 'checked_in' ELSE 'not_checked_in' END as attendance_status,
            CASE WHEN c.check_in_time IS NOT NULL AND c.check_out_time IS NOT NULL THEN ROUND(TIMESTAMPDIFF(MINUTE, CONCAT(c.date, ' ', c.check_in_time), CONCAT(c.date, ' ', c.check_out_time)) / 60.0, 2) ELSE NULL END as total_hours
            FROM employee_checkins c JOIN employees e ON c.employee_id = e.id LEFT JOIN departments d ON e.department_id = d.id WHERE e.company_id = ?`;
          const fallbackParams = [req.employee.company_id];
          if (!canAccessAll(req.employee)) { fallbackSql += ' AND c.employee_id = ?'; fallbackParams.push(req.employee.id); }
          else if (req.query.employee_id) { fallbackSql += ' AND c.employee_id = ?'; fallbackParams.push(req.query.employee_id); }
          if (req.query.date_from) { fallbackSql += ' AND c.date >= ?'; fallbackParams.push(req.query.date_from); }
          if (req.query.date_to) { fallbackSql += ' AND c.date <= ?'; fallbackParams.push(req.query.date_to); }
          fallbackSql += ' ORDER BY c.date DESC, c.id DESC';
          rows = await query(fallbackSql, fallbackParams);
        } else {
          throw e;
        }
      }
    // Apply official rules to ALL records: 09:30–10:00 = on time = full_day; after 10:00 = late, 4th late in month = half_day
    attendanceRules.applyAttendanceRulesToRows(rows);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /hrms/attendance/:id – HR only: edit a single attendance record (must be before /attendance/report so :id is not confused)
router.put('/attendance/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) {
    return res.status(403).json({ success: false, message: 'Only HR/Admin can edit attendance' });
  }
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid record id' });
  const { check_in_time, check_out_time, attendance_type, check_in_location, check_out_location, reason, edit_reason } = req.body || {};
  const reasonText = (reason != null && String(reason).trim() !== '') ? String(reason).trim() : (edit_reason != null && String(edit_reason).trim() !== '') ? String(edit_reason).trim() : '';
  if (!reasonText) {
    return res.status(400).json({ success: false, message: 'Reason for edit is required (e.g. why attendance is being changed or reason for late coming)' });
  }
  try {
    const existing = await query('SELECT id, employee_id, date FROM employee_checkins WHERE id = ?', [id]);
    if (!existing || !existing[0]) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    const updates = [];
    const params = [];
    if (check_in_time != null && String(check_in_time).trim() !== '') {
      updates.push('check_in_time = ?'); params.push(String(check_in_time).trim());
      updates.push('time = ?'); params.push(String(check_in_time).trim());
    }
    if (check_out_time != null && String(check_out_time).trim() !== '') {
      updates.push('check_out_time = ?'); params.push(String(check_out_time).trim());
      updates.push('status = ?'); params.push('completed');
    }
    if (attendance_type === 'full_day' || attendance_type === 'half_day') {
      updates.push('attendance_type = ?'); params.push(attendance_type);
    }
    if (check_in_location != null) { updates.push('check_in_location = ?'); params.push(String(check_in_location)); }
    if (check_out_location != null) { updates.push('check_out_location = ?'); params.push(String(check_out_location)); }
    updates.push('edit_reason = ?'); params.push(reasonText);
    // Recalculate total_hours if both times present
    let checkIn = check_in_time != null ? String(check_in_time).trim() : null;
    let checkOut = check_out_time != null ? String(check_out_time).trim() : null;
    const row = existing[0];
    if (!checkIn || !checkOut) {
      const full = await query('SELECT check_in_time, check_out_time FROM employee_checkins WHERE id = ?', [id]);
      if (full && full[0]) {
        if (!checkIn) checkIn = full[0].check_in_time ? String(full[0].check_in_time) : null;
        if (!checkOut) checkOut = full[0].check_out_time ? String(full[0].check_out_time) : null;
      }
    }
    if (checkIn && checkOut && row.date) {
      const dateStr = String(row.date).slice(0, 10);
      updates.push('total_hours = ROUND(TIMESTAMPDIFF(MINUTE, CONCAT(?, " ", ?), CONCAT(?, " ", ?)) / 60.0, 1)');
      params.push(dateStr, checkIn, dateStr, checkOut);
    }
    params.push(id);
    try {
      await query(`UPDATE employee_checkins SET ${updates.join(', ')} WHERE id = ?`, params);
    } catch (updateErr) {
      const msg = (updateErr.message || '').toString();
      if (msg.includes("Unknown column 'edit_reason'")) {
        const idx = updates.indexOf('edit_reason = ?');
        if (idx !== -1) {
          updates.splice(idx, 1);
          params.splice(params.length - 2, 1);
        }
        await query(`UPDATE employee_checkins SET ${updates.join(', ')} WHERE id = ?`, params);
      } else {
        throw updateErr;
      }
    }
    return res.json({ success: true, message: 'Attendance updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Update failed' });
  }
});

// GET /hrms/attendance/report?month=YYYY-MM&format=csv – HR only: month-wise attendance report (download)
router.get('/attendance/report', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) {
    return res.status(403).json({ success: false, message: 'Only HR/Admin can download attendance report' });
  }
  const month = (req.query.month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ success: false, message: 'Query month=YYYY-MM is required' });
  }
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${month}-${String(lastDay).padStart(2, '0')}`;
  const employeeId = req.query.employee_id ? parseInt(req.query.employee_id, 10) : null;
  try {
    let sql = `SELECT c.id, c.employee_id, c.date, c.check_in_time, c.check_out_time, c.attendance_type, c.is_late,
      c.check_in_location, c.check_out_location, c.status, c.total_hours, c.edit_reason,
      e.name as employee_name, e.employee_code, d.name as department
      FROM employee_checkins c
      JOIN employees e ON c.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE c.date >= ? AND c.date <= ?`;
    const reportParams = [first, last];
    if (employeeId) {
      sql += ' AND c.employee_id = ?';
      reportParams.push(employeeId);
    }
    sql += ' ORDER BY e.name, c.date';
    let rows;
    let hasEditReason = true;
    try {
      rows = await query(sql, reportParams);
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      // Backward compatibility: some DBs don't have employee_checkins.edit_reason
      if (msg.includes("Unknown column 'c.edit_reason'") || msg.includes("Unknown column 'edit_reason'")) {
        hasEditReason = false;
        sql = `SELECT c.id, c.employee_id, c.date, c.check_in_time, c.check_out_time, c.attendance_type, c.is_late,
          c.check_in_location, c.check_out_location, c.status, c.total_hours,
          e.name as employee_name, e.employee_code, d.name as department
          FROM employee_checkins c
          JOIN employees e ON c.employee_id = e.id
          LEFT JOIN departments d ON e.department_id = d.id
          WHERE c.date >= ? AND c.date <= ?`;
        if (employeeId) sql += ' AND c.employee_id = ?';
        sql += ' ORDER BY e.name, c.date';
        rows = await query(sql, reportParams);
      } else {
        throw e;
      }
    }
    attendanceRules.applyAttendanceRulesToRows(rows);
    const format = (req.query.format || 'csv').toLowerCase();
    if (format === 'csv') {
      const header = hasEditReason
        ? 'Employee Code,Employee Name,Department,Date,Check In,Check Out,Day Type,Total Hours,Status,Edit Reason\n'
        : 'Employee Code,Employee Name,Department,Date,Check In,Check Out,Day Type,Total Hours,Status\n';
      const csvRows = (rows || []).map(r => {
        const code = (r.employee_code || '').replace(/"/g, '""');
        const name = (r.employee_name || '').replace(/"/g, '""');
        const dept = (r.department || '').replace(/"/g, '""');
        const date = (r.date && String(r.date).slice(0, 10)) || '';
        const ci = (r.check_in_time && String(r.check_in_time)) || '';
        const co = (r.check_out_time && String(r.check_out_time)) || '';
        const dayType = (r.attendance_type || '').toLowerCase() === 'half_day' ? 'Half day' : 'Full day';
        const hours = r.total_hours != null ? String(r.total_hours) : '';
        const status = r.attendance_status || (r.check_out_time ? 'completed' : 'checked_in');
        if (hasEditReason) {
          const reason = (r.edit_reason || '').replace(/"/g, '""');
          return `"${code}","${name}","${dept}","${date}","${ci}","${co}","${dayType}","${hours}","${status}","${reason}"`;
        }
        return `"${code}","${name}","${dept}","${date}","${ci}","${co}","${dayType}","${hours}","${status}"`;
      });
      const csv = header + csvRows.join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const fileName = employeeId ? `attendance-report-${month}-employee-${employeeId}.csv` : `attendance-report-${month}.csv`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send('\uFEFF' + csv);
    }
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Report failed' });
  }
});

router.post('/attendance', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!req.employee || !req.employee.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized - Please login again' });
    }
    const action = String(b.action || 'check_in').toLowerCase();
    if (action === 'check_in' || action === 'clock_in') {
      const attendance = await workTimer.clockIn(req.employee, b);
      return res.json({ success: true, message: 'Punched in successfully.', data: attendance });
    }
    if (action === 'break' || action === 'start_break') {
      const attendance = await workTimer.startBreak(req.employee.id);
      return res.json({ success: true, message: 'Break started.', data: attendance });
    }
    if (action === 'resume' || action === 'end_break') {
      const attendance = await workTimer.endBreak(req.employee.id);
      return res.json({ success: true, message: 'Work resumed.', data: attendance });
    }
    if (action === 'reset_timer' || action === 'reset') {
      const attendance = await workTimer.resetTimer(req.employee.id, b);
      return res.json({ success: true, message: 'Timer reset successfully.', data: attendance });
    }
    const attendance = await workTimer.clockOut(req.employee.id, b);
    return res.json({ success: true, message: 'Punched out. Attendance complete.', data: attendance });
  } catch (err) {
    const msg = (err && err.message) ? String(err.message) : 'Attendance update failed';
    let userMsg = msg;
    if (msg.includes('Already clocked in today') || msg.includes('Already checked in')) {
      return res.status(409).json({ success: false, message: 'Already clocked in today.' });
    }
    if (msg.includes("Unknown column 'check_in_time'") || msg.includes("Unknown column 'attendance_type'") || msg.includes('Unknown column') || msg.includes("doesn't exist")) {
      userMsg = 'Database schema outdated. Run: node backend-node/scripts/ensure-demo-schema.js';
    } else if (msg.includes('ECONNREFUSED') || msg.includes('connect')) {
      const host = process.env.DB_HOST || '127.0.0.1';
      const port = Number(process.env.DB_PORT) || 3306;
      userMsg = `Database connection failed at ${host}:${port}. Check backend-node/.env and MySQL service.`;
    }
    console.error('POST /hrms/attendance error:', err && err.message);
    return res.status(500).json({ success: false, message: userMsg });
  }
});

// GET hrms/stats (HR dashboard)
router.get('/stats', verifyToken, async (req, res) => {
  try {
    if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const [totalEmp] = await query('SELECT COUNT(*) as total FROM employees WHERE status = ?', ['active']);
    const totalEmployees = parseInt(totalEmp && totalEmp.total) || 0;
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = new Date().toISOString().slice(0, 7).replace(/-/, '-'); // YYYY-MM

    const [presentTodayRow] = await query(
      "SELECT COUNT(DISTINCT employee_id) as total FROM employee_checkins WHERE date = ? AND status IN ('checked_in','on_break','checked_out','completed')",
      [today]
    ).catch(() => [{ total: 0 }]);
    const presentToday = parseInt(presentTodayRow && presentTodayRow.total) || 0;

    const [lateRow] = await query(
      'SELECT COUNT(DISTINCT employee_id) as total FROM employee_checkins WHERE date = ? AND is_late = 1',
      [today]
    ).catch(() => [{ total: 0 }]);
    const lateEmployees = parseInt(lateRow && lateRow.total) || 0;

    const [onLeaveRow] = await query(
      "SELECT COUNT(DISTINCT employee_id) as total FROM leaves WHERE status = 'approved' AND ? BETWEEN start_date AND end_date",
      [today]
    ).catch(() => [{ total: 0 }]);
    const onLeaveToday = parseInt(onLeaveRow && onLeaveRow.total) || 0;

    const [pendingLeaves] = await query('SELECT COUNT(*) as total FROM leaves WHERE status = ?', ['pending']);
    const [usedLeavesRow] = await query("SELECT COUNT(*) as total FROM leaves WHERE status = ?", ['approved']).catch(() => [{ total: 0 }]);
    const usedLeaves = parseInt(usedLeavesRow && usedLeavesRow.total) || 0;
    const totalLeaveBalance = Math.max(0, totalEmployees * 12 - usedLeaves);
    const [salaryProcessedRow] = await query('SELECT COUNT(*) as total FROM salary_slips WHERE month = ?', [currentMonth]).catch(() => [{ total: 0 }]);
    const monthlySalaryProcessed = parseInt(salaryProcessedRow && salaryProcessedRow.total) || 0;

    const trends = await query(`
      SELECT DATE_FORMAT(date, '%b') as month, COUNT(CASE WHEN status = 'completed' THEN 1 END) as present, COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as active
      FROM employee_checkins WHERE date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY DATE_FORMAT(date, '%Y-%m'), DATE_FORMAT(date, '%b') ORDER BY date ASC
    `).catch(() => []);
    const leaveStats = await query('SELECT type, COUNT(*) as used FROM leaves WHERE status = ? GROUP BY type', ['approved']).catch(() => []);
    const leaveStatsWithApproved = (leaveStats || []).map((ls) => ({ ...ls, approved: ls.used }));
    const deptCounts = await query(
      `SELECT COALESCE(d.name, 'Unassigned') as department, COUNT(*) as total
       FROM employees e LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.status = 'active'
       GROUP BY d.name ORDER BY total DESC`
    ).catch(() => []);
    const upcomingHolidays = await query(
      'SELECT id, name, date, description FROM hr_holidays WHERE date >= CURDATE() ORDER BY date ASC LIMIT 5'
    ).catch(() => []);
    const recent = await query(`
      (SELECT 'leave' as category, employee_id, status, created_at, 'applied for leave' as action FROM leaves)
      UNION ALL (SELECT 'attendance', employee_id, status, created_at, 'marked attendance' FROM employee_checkins)
      ORDER BY created_at DESC LIMIT 10
    `).catch(() => []);
    const recentActivities = (recent || []).map((r) => ({ id: Math.random(), title: 'Employee ' + r.action, time: r.created_at, status: r.status, type: r.category }));
    return res.json({
      success: true,
      data: {
        total_employees: totalEmployees,
        present_today: presentToday,
        on_leave_today: onLeaveToday,
        late_employees: lateEmployees,
        pending_leaves: parseInt(pendingLeaves && pendingLeaves.total) || 0,
        total_leave_balance: totalLeaveBalance,
        used_leaves: usedLeaves,
        monthly_salary_processed: monthlySalaryProcessed,
        attendance_trends: trends || [],
        leave_stats: leaveStatsWithApproved || [],
        department_counts: deptCounts || [],
        upcoming_holidays: upcomingHolidays || [],
        recent_activities: recentActivities,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET hrms/joining_submissions
router.get('/joining_submissions', verifyToken, async (req, res) => {
  try {
    if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
    await ensureJoiningFormSubmissionsTable();
    const status = req.query.status || '';
    const search = req.query.search || '';
    let sql = 'SELECT js.*, e.name as verified_by_name FROM joining_form_submissions js LEFT JOIN employees e ON js.verified_by = e.id WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND js.status = ?'; params.push(status); }
    if (search) { sql += ' AND (js.full_name LIKE ? OR js.email LIKE ? OR js.contact_number LIKE ?)'; const t = '%' + search + '%'; params.push(t, t, t); }
    sql += ' ORDER BY js.submission_date DESC';
    const rows = await query(sql, params).catch(() => []);
    const data = (rows || []).map((r) => {
      const o = { ...r };
      try { o.education = typeof r.education_json === 'string' ? JSON.parse(r.education_json || '[]') : (r.education || []); } catch (_) { o.education = []; }
      try { o.employment = typeof r.employment_json === 'string' ? JSON.parse(r.employment_json || '[]') : (r.employment || []); } catch (_) { o.employment = []; }
      delete o.education_json; delete o.employment_json;
      return o;
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

// POST hrms/verify_joining
router.post('/verify_joining', verifyToken, async (req, res) => {
  try {
    if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
    await ensureJoiningFormSubmissionsTable();
    const b = req.body || {};
    const submissionId = parseInt(b.submission_id, 10);
    const action = b.action;
    const rejectionReason = b.rejection_reason || '';
    if (!submissionId || !['verify', 'reject'].includes(action)) return res.status(400).json({ success: false, message: 'Invalid parameters' });
    const status = action === 'verify' ? 'verified' : 'rejected';
    await query('UPDATE joining_form_submissions SET status = ?, verification_date = NOW(), verified_by = ?, rejection_reason = ? WHERE id = ?', [status, req.employee.id, rejectionReason, submissionId]);
    return res.json({ success: true, message: action === 'verify' ? 'Submission verified successfully' : 'Submission rejected' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST hrms/generate_qr
router.post('/generate_qr', verifyToken, async (req, res) => {
  try {
    if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
    await ensureJoiningFormSubmissionsTable();
    const token = require('crypto').randomBytes(32).toString('hex');
    const { getConnection } = require('../config/database');
    const conn = await getConnection();
    const [r] = await conn.execute('INSERT INTO joining_form_submissions (unique_token, company_name) VALUES (?, ?)', [token, 'Vanya Group']);
    conn.release();
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    const formUrl = baseUrl + '/#/public/joining-form/' + token;
    return res.json({ success: true, token, url: formUrl, message: 'QR code generated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- Designations ---
router.get('/designations', verifyToken, async (req, res) => {
  try {
    await ensureEmployeeCodeSchema();
    const rows = await query('SELECT * FROM designations ORDER BY name ASC').catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/designations', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  try {
    await ensureEmployeeCodeSchema();
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const designationCode = normalizeCodePart(req.body?.designation_code);
    if (!designationCode) return res.status(400).json({ success: false, message: 'Designation code is required' });
    await query('INSERT INTO designations (name, designation_code, description) VALUES (?, ?, ?)', [String(name).trim(), designationCode, description || null]);
    return res.json({ success: true, message: 'Designation created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/designations/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  try {
    await ensureEmployeeCodeSchema();
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const designationCode = normalizeCodePart(req.body?.designation_code);
    if (!designationCode) return res.status(400).json({ success: false, message: 'Designation code is required' });
    await query('UPDATE designations SET name = ?, designation_code = ?, description = ? WHERE id = ?', [String(name).trim(), designationCode, description || null, id]);
    return res.json({ success: true, message: 'Designation updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/designations/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  try {
    await ensureEmployeeCodeSchema();
    await query('DELETE FROM designations WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Designation deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- Shifts ---
router.get('/shifts', verifyToken, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM hr_shifts ORDER BY name ASC').catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/shifts', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { name, start_time, end_time, grace_minutes } = req.body || {};
  if (!name || !start_time || !end_time) {
    return res.status(400).json({ success: false, message: 'Name, start_time, end_time are required' });
  }
  try {
    await query(
      'INSERT INTO hr_shifts (name, start_time, end_time, grace_minutes) VALUES (?, ?, ?, ?)',
      [String(name).trim(), start_time, end_time, Number(grace_minutes) || 0]
    );
    return res.json({ success: true, message: 'Shift created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/shifts/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  const { name, start_time, end_time, grace_minutes } = req.body || {};
  if (!name || !start_time || !end_time) {
    return res.status(400).json({ success: false, message: 'Name, start_time, end_time are required' });
  }
  try {
    await query(
      'UPDATE hr_shifts SET name = ?, start_time = ?, end_time = ?, grace_minutes = ? WHERE id = ?',
      [String(name).trim(), start_time, end_time, Number(grace_minutes) || 0, id]
    );
    return res.json({ success: true, message: 'Shift updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/shifts/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  try {
    await query('DELETE FROM hr_shifts WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Shift deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/shifts/assignments', verifyToken, async (req, res) => {
  try {
    let sql = `SELECT sa.*, s.name as shift_name, s.start_time, s.end_time, e.name as employee_name
               FROM hr_shift_assignments sa
               JOIN hr_shifts s ON sa.shift_id = s.id
               JOIN employees e ON sa.employee_id = e.id WHERE e.company_id = ?`; const params = [req.employee.company_id];
    if (!canAccessAll(req.employee)) {
      sql += ' AND sa.employee_id = ?';
      params.push(req.employee.id);
    } else if (req.query.employee_id) {
      sql += ' AND sa.employee_id = ?';
      params.push(Number(req.query.employee_id));
    }
    sql += ' ORDER BY sa.effective_from DESC';
    const rows = await query(sql, params).catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/shifts/assign', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { employee_id, shift_id, effective_from, effective_to } = req.body || {};
  if (!employee_id || !shift_id || !effective_from) {
    return res.status(400).json({ success: false, message: 'employee_id, shift_id, effective_from are required' });
  }
  try {
    await query(
      'INSERT INTO hr_shift_assignments (employee_id, shift_id, effective_from, effective_to) VALUES (?, ?, ?, ?)',
      [employee_id, shift_id, effective_from, effective_to || null]
    );
    return res.json({ success: true, message: 'Shift assigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/shifts/assignments/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  const { employee_id, shift_id, effective_from, effective_to } = req.body || {};
  if (!employee_id || !shift_id || !effective_from) {
    return res.status(400).json({ success: false, message: 'employee_id, shift_id, effective_from are required' });
  }
  try {
    // Ensure target employee belongs to same company.
    const empRows = await query('SELECT id FROM employees WHERE id = ? AND company_id = ?', [employee_id, req.employee.company_id]).catch(() => []);
    if (!empRows || empRows.length === 0) return res.status(403).json({ success: false, message: 'Invalid employee for this company' });

    // Ensure shift exists.
    const shiftRows = await query('SELECT id FROM hr_shifts WHERE id = ?', [shift_id]).catch(() => []);
    if (!shiftRows || shiftRows.length === 0) return res.status(400).json({ success: false, message: 'Invalid shift' });

    // Update only if the existing assignment belongs to this company (via current employee_id).
    const result = await query(
      `UPDATE hr_shift_assignments sa
       JOIN employees e ON e.id = sa.employee_id
       SET sa.employee_id = ?, sa.shift_id = ?, sa.effective_from = ?, sa.effective_to = ?
       WHERE sa.id = ? AND e.company_id = ?`,
      [employee_id, shift_id, effective_from, effective_to || null, id, req.employee.company_id]
    );

    const affected = Number(result?.affectedRows || result?.[0]?.affectedRows || 0);
    if (!affected) return res.status(404).json({ success: false, message: 'Assignment not found' });

    return res.json({ success: true, message: 'Assignment updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/shifts/assignments/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  try {
    const result = await query(
      `DELETE sa FROM hr_shift_assignments sa
       JOIN employees e ON e.id = sa.employee_id
       WHERE sa.id = ? AND e.company_id = ?`,
      [id, req.employee.company_id]
    );
    const affected = Number(result?.affectedRows || result?.[0]?.affectedRows || 0);
    if (!affected) return res.status(404).json({ success: false, message: 'Assignment not found' });
    return res.json({ success: true, message: 'Assignment deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- Holidays ---
router.get('/holidays', verifyToken, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM hr_holidays ORDER BY date ASC').catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/holidays', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { name, date, description } = req.body || {};
  if (!name || !date) return res.status(400).json({ success: false, message: 'Name and date are required' });
  try {
    await query('INSERT INTO hr_holidays (name, date, description) VALUES (?, ?, ?)', [String(name).trim(), date, description || null]);
    return res.json({ success: true, message: 'Holiday created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/holidays/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  const { name, date, description } = req.body || {};
  if (!name || !date) return res.status(400).json({ success: false, message: 'Name and date are required' });
  try {
    await query('UPDATE hr_holidays SET name = ?, date = ?, description = ? WHERE id = ?', [String(name).trim(), date, description || null, id]);
    return res.json({ success: true, message: 'Holiday updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/holidays/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  try {
    await query('DELETE FROM hr_holidays WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Holiday deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- Announcements ---
router.get('/announcements', verifyToken, async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM hr_announcements
       WHERE (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY created_at DESC`
    ).catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/announcements', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { title, message, starts_at, ends_at } = req.body || {};
  if (!title || !message) return res.status(400).json({ success: false, message: 'Title and message are required' });
  try {
    await query(
      'INSERT INTO hr_announcements (title, message, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?)',
      [String(title).trim(), String(message).trim(), starts_at || null, ends_at || null, req.employee.id]
    );
    return res.json({ success: true, message: 'Announcement created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/announcements/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  const { title, message, starts_at, ends_at } = req.body || {};
  if (!title || !message) return res.status(400).json({ success: false, message: 'Title and message are required' });
  try {
    await query(
      'UPDATE hr_announcements SET title = ?, message = ?, starts_at = ?, ends_at = ? WHERE id = ?',
      [String(title).trim(), String(message).trim(), starts_at || null, ends_at || null, id]
    );
    return res.json({ success: true, message: 'Announcement updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/announcements/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  try {
    await query('DELETE FROM hr_announcements WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Announcement deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- HR Settings ---
router.get('/settings', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  try {
    const rows = await query('SELECT setting_key, setting_value FROM hr_settings ORDER BY setting_key ASC').catch(() => []);
    const settings = {};
    (rows || []).forEach((r) => {
      settings[r.setting_key] = r.setting_value;
    });
    return res.json({ success: true, data: settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/settings', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const settings = req.body || {};
  try {
    const keys = Object.keys(settings);
    for (const key of keys) {
      await query(
        'INSERT INTO hr_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [key, String(settings[key])]
      );
    }
    return res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- Leave Types & Balances ---
router.get('/leave-types', verifyToken, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM hr_leave_types ORDER BY name ASC').catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/leave-types', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { name, code, default_balance } = req.body || {};
  if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
  try {
    await query(
      'INSERT INTO hr_leave_types (name, code, default_balance) VALUES (?, ?, ?)',
      [String(name).trim(), code || null, Number(default_balance) || 0]
    );
    return res.json({ success: true, message: 'Leave type created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/leave-types/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  const { name, code, default_balance } = req.body || {};
  if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
  try {
    await query(
      'UPDATE hr_leave_types SET name = ?, code = ?, default_balance = ? WHERE id = ?',
      [String(name).trim(), code || null, Number(default_balance) || 0, id]
    );
    return res.json({ success: true, message: 'Leave type updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/leave-types/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  try {
    await query('DELETE FROM hr_leave_types WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Leave type deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/leave-balances', verifyToken, async (req, res) => {
  try {
    let sql = `SELECT b.*, e.name as employee_name, t.name as leave_type
               FROM hr_leave_balances b
               JOIN employees e ON b.employee_id = e.id
               JOIN hr_leave_types t ON b.leave_type_id = t.id WHERE e.company_id = ?`; const params = [req.employee.company_id];
    if (!canAccessAll(req.employee)) {
      sql += ' AND b.employee_id = ?';
      params.push(req.employee.id);
    } else if (req.query.employee_id) {
      sql += ' AND b.employee_id = ?';
      params.push(Number(req.query.employee_id));
    }
    const rows = await query(sql, params).catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/leave-balances', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { employee_id, leave_type_id, balance } = req.body || {};
  if (!employee_id || !leave_type_id) {
    return res.status(400).json({ success: false, message: 'employee_id and leave_type_id are required' });
  }
  try {
    await query(
      'INSERT INTO hr_leave_balances (employee_id, leave_type_id, balance) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE balance = VALUES(balance)',
      [employee_id, leave_type_id, Number(balance) || 0]
    );
    return res.json({ success: true, message: 'Leave balance updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- Performance Reviews ---
router.get('/performance', verifyToken, async (req, res) => {
  try {
    let sql = `SELECT pr.*, e.name as employee_name, r.name as reviewer_name
               FROM performance_reviews pr
               JOIN employees e ON pr.employee_id = e.id
               JOIN employees r ON pr.reviewer_id = r.id WHERE e.company_id = ?`; const params = [req.employee.company_id];
    if (!canAccessAll(req.employee)) {
      sql += ' AND pr.employee_id = ?';
      params.push(req.employee.id);
    } else if (req.query.employee_id) {
      sql += ' AND pr.employee_id = ?';
      params.push(Number(req.query.employee_id));
    }
    sql += ' ORDER BY pr.created_at DESC';
    const rows = await query(sql, params).catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/performance', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { employee_id, period_start, period_end, rating, goals, feedback } = req.body || {};
  if (!employee_id || !rating) return res.status(400).json({ success: false, message: 'employee_id and rating are required' });
  try {
    await query(
      'INSERT INTO performance_reviews (employee_id, reviewer_id, period_start, period_end, rating, goals, feedback) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [employee_id, req.employee.id, period_start || null, period_end || null, rating, goals || null, feedback || null]
    );
    return res.json({ success: true, message: 'Performance review created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/performance/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  const { period_start, period_end, rating, goals, feedback } = req.body || {};
  if (!rating) return res.status(400).json({ success: false, message: 'Rating is required' });
  try {
    await query(
      'UPDATE performance_reviews SET period_start = ?, period_end = ?, rating = ?, goals = ?, feedback = ? WHERE id = ?',
      [period_start || null, period_end || null, rating, goals || null, feedback || null, id]
    );
    return res.json({ success: true, message: 'Performance review updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/performance/:id', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) return res.status(403).json({ success: false, message: 'Unauthorized' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  try {
    await query('DELETE FROM performance_reviews WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Performance review deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- Reports (CSV) ---
router.get('/reports/employees', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) {
    return res.status(403).json({ success: false, message: 'Only HR/Admin can download reports' });
  }
  try {
    const rows = await query(
      `SELECT e.employee_code, e.name, e.email, e.phone, e.designation, d.name as department, e.joining_date, e.employment_type
       FROM employees e LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.status = 'active' ORDER BY e.name ASC`
    );
    const header = 'Employee Code,Name,Email,Phone,Designation,Department,Joining Date,Employment Type\n';
    const csvRows = (rows || []).map((r) =>
      `"${(r.employee_code || '').replace(/"/g, '""')}","${(r.name || '').replace(/"/g, '""')}","${(r.email || '').replace(/"/g, '""')}","${(r.phone || '').replace(/"/g, '""')}","${(r.designation || '').replace(/"/g, '""')}","${(r.department || '').replace(/"/g, '""')}","${(r.joining_date || '').toString().slice(0, 10)}","${(r.employment_type || '').replace(/"/g, '""')}"`
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="employees-report.csv"');
    return res.send('\uFEFF' + header + csvRows.join('\n'));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/reports/leaves', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) {
    return res.status(403).json({ success: false, message: 'Only HR/Admin can download reports' });
  }
  const month = (req.query.month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ success: false, message: 'Query month=YYYY-MM is required' });
  }
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${month}-${String(lastDay).padStart(2, '0')}`;
  try {
    const rows = await query(
      `SELECT l.id, e.employee_code, e.name, l.type, l.start_date, l.end_date, l.status, l.reason
       FROM leaves l JOIN employees e ON l.employee_id = e.id
       WHERE l.start_date <= ? AND l.end_date >= ? ORDER BY l.start_date ASC`,
      [last, first]
    );
    const header = 'Employee Code,Name,Leave Type,Start Date,End Date,Status,Reason\n';
    const csvRows = (rows || []).map((r) =>
      `"${(r.employee_code || '').replace(/"/g, '""')}","${(r.name || '').replace(/"/g, '""')}","${(r.type || '').replace(/"/g, '""')}","${(r.start_date || '').toString().slice(0, 10)}","${(r.end_date || '').toString().slice(0, 10)}","${(r.status || '').replace(/"/g, '""')}","${(r.reason || '').replace(/"/g, '""')}"`
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leave-report-${month}.csv"`);
    return res.send('\uFEFF' + header + csvRows.join('\n'));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/reports/payroll', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) {
    return res.status(403).json({ success: false, message: 'Only HR/Admin can download reports' });
  }
  const month = (req.query.month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ success: false, message: 'Query month=YYYY-MM is required' });
  }
  try {
    const rows = await query(
      `SELECT s.month, e.employee_code, e.name, s.gross_salary, s.total_deductions, s.net_salary, s.status
       FROM salary_slips s JOIN employees e ON s.employee_id = e.id
       WHERE s.month = ? ORDER BY e.name ASC`,
      [month]
    );
    const header = 'Month,Employee Code,Name,Gross Salary,Total Deductions,Net Salary,Status\n';
    const csvRows = (rows || []).map((r) =>
      `"${(r.month || '').replace(/"/g, '""')}","${(r.employee_code || '').replace(/"/g, '""')}","${(r.name || '').replace(/"/g, '""')}","${r.gross_salary || 0}","${r.total_deductions || 0}","${r.net_salary || 0}","${(r.status || '').replace(/"/g, '""')}"`
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-report-${month}.csv"`);
    return res.send('\uFEFF' + header + csvRows.join('\n'));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
