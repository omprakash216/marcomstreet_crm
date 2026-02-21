const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const documentGenerator = require('../services/documentGenerator');

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

const allowedRoles = ['admin', 'manager', 'human_resources'];

function canAccessAll(employee) {
  const role = (employee.role || '').toLowerCase();
  return allowedRoles.includes(role);
}

const attendanceRules = require('../services/attendanceRules');

function getMonthBounds(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { first, last };
}

// GET /hrms/documents - list documents
router.get('/documents', verifyToken, async (req, res) => {
  try {
    let sql = `SELECT d.*, e.name as employee_name 
               FROM hr_documents d 
               JOIN employees e ON d.employee_id = e.id 
               WHERE 1=1`;
    const params = [];
    if (!canAccessAll(req.employee)) {
      sql += ' AND d.employee_id = ?';
      params.push(req.employee.id);
    }
    if (req.query.employee_id) {
      sql += ' AND d.employee_id = ?';
      params.push(req.query.employee_id);
    }
    sql += ' ORDER BY d.created_at DESC';
    const docs = await query(sql, params);
    return res.json({ success: true, data: docs });
  } catch (err) {
    console.error('HR documents GET:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /hrms/documents - upload document
router.post('/documents', verifyToken, upload.single('file'), async (req, res) => {
  if (!canAccessAll(req.employee)) {
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
      'INSERT INTO hr_documents (employee_id, title, type, file_path) VALUES (?, ?, ?, ?)',
      [employee_id, title, type, filePath]
    );
    return res.json({ success: true, message: 'Document uploaded successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /hrms/generate_document - generate offer/experience/joining PDF
router.post('/generate_document', verifyToken, async (req, res) => {
  if (!canAccessAll(req.employee)) {
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
    const dbType = type === 'joining_form' ? 'other' : type;
    const title = (type.replace(/_/g, ' ') + ' - ' + (target.name || 'Employee')).slice(0, 255);
    try {
      await query(
        'INSERT INTO hr_documents (employee_id, title, type, file_path) VALUES (?, ?, ?, ?)',
        [Number(employee_id), title, dbType, filePath]
      );
    } catch (insertErr) {
      const imsg = (insertErr && insertErr.message) ? String(insertErr.message) : '';
      if (fullPathWritten && fs.existsSync(fullPathWritten)) {
        try { fs.unlinkSync(fullPathWritten); } catch (_) {}
      }
      return res.status(500).json({
        success: false,
        message: imsg.includes('generated_by') ? 'Database missing column. Run migration 006 or use a DB with hr_documents (employee_id, title, type, file_path) only.' : ('Save failed: ' + imsg),
      });
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
      try { fs.unlinkSync(fullPathWritten); } catch (_) {}
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
    let sql = `SELECT s.*, e.name as employee_name, e.employee_code, e.designation, d.name as department
               FROM salary_slips s 
               JOIN employees e ON s.employee_id = e.id 
               LEFT JOIN departments d ON e.department_id = d.id
               WHERE 1=1`;
    const params = [];
    if (!canAccessAll(req.employee)) {
      sql += ' AND s.employee_id = ?';
      params.push(req.employee.id);
    }
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

  try {
    const empRows = await query(
      'SELECT e.*, d.name as department FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?',
      [d.employee_id]
    );
    const employeeData = Array.isArray(empRows) ? empRows[0] : null;
    if (!employeeData) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
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

    await query(
      `INSERT INTO salary_slips (
        employee_id, pay_period_start, pay_period_end, month,
        basic_salary, hra, conveyance_allowance, medical_allowance, special_allowance, other_allowances, gross_salary,
        pf_deduction, esi_deduction, tax_deduction, professional_tax, other_deductions, total_deductions,
        net_salary, amount, file_path, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.employee_id,
        salaryData.pay_period_start,
        salaryData.pay_period_end,
        d.month,
        basicSalary,
        hra,
        conveyanceAllowance,
        medicalAllowance,
        specialAllowance,
        otherAllowances,
        grossSalary,
        pfDeduction,
        esiDeduction,
        taxDeduction,
        professionalTax,
        otherDeductions,
        totalDeductions,
        netSalary,
        grossSalary,
        filePath,
        d.status || 'generated',
      ]
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
      FROM leaves l JOIN employees e ON l.employee_id = e.id LEFT JOIN employees a ON l.approved_by = a.id WHERE 1=1`;
    const params = [];
    if (!canAccessAll(req.employee)) { sql += ' AND l.employee_id = ?'; params.push(req.employee.id); }
    sql += ' ORDER BY l.created_at DESC';
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/leaves', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.type || !b.start_date || !b.end_date) return res.status(400).json({ success: false, message: 'Missing required fields' });
    await query('INSERT INTO leaves (employee_id, type, start_date, end_date, reason, status) VALUES (?,?,?,?,?,\'pending\')', [req.employee.id, b.type, b.start_date, b.end_date, b.reason || '']);
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
    await query('UPDATE leaves SET status = ?, approved_by = ?, admin_reason = ? WHERE id = ?', [b.status, req.employee.id, b.admin_reason || null, b.id]);
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
      CASE WHEN c.check_in_time IS NOT NULL AND c.check_out_time IS NOT NULL THEN ROUND(TIMESTAMPDIFF(MINUTE, CONCAT(c.date, ' ', c.check_in_time), CONCAT(c.date, ' ', c.check_out_time)) / 60.0, 1) ELSE NULL END as total_hours
      FROM employee_checkins c JOIN employees e ON c.employee_id = e.id LEFT JOIN departments d ON e.department_id = d.id WHERE 1=1`;
    const params = [];
    if (!canAccessAll(req.employee)) { sql += ' AND c.employee_id = ?'; params.push(req.employee.id); }
    else if (req.query.employee_id) { sql += ' AND c.employee_id = ?'; params.push(req.query.employee_id); }
    if (req.query.date_from) { sql += ' AND c.date >= ?'; params.push(req.query.date_from); }
    if (req.query.date_to) { sql += ' AND c.date <= ?'; params.push(req.query.date_to); }
    sql += ' ORDER BY c.date DESC, c.created_at DESC';
    const rows = await query(sql, params);
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
    const rows = await query(sql, reportParams);
    attendanceRules.applyAttendanceRulesToRows(rows);
    const format = (req.query.format || 'csv').toLowerCase();
    if (format === 'csv') {
      const header = 'Employee Code,Employee Name,Department,Date,Check In,Check Out,Day Type,Total Hours,Status,Edit Reason\n';
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
        const reason = (r.edit_reason || '').replace(/"/g, '""');
        return `"${code}","${name}","${dept}","${date}","${ci}","${co}","${dayType}","${hours}","${status}","${reason}"`;
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
  const { getConnection } = require('../config/database');
  let conn;
  try {
    const b = req.body || {};
    const action = b.action || 'check_in';
    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toTimeString().slice(0, 8);
    const location = b.location || 'Office';
    conn = await getConnection();
    if (!req.employee || !req.employee.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized - Please login again' });
    }
    if (action === 'check_in') {
      const [ex] = await conn.execute('SELECT id, check_in_time FROM employee_checkins WHERE employee_id = ? AND date = ?', [req.employee.id, date]);
      const row = ex && ex[0];
      if (row && row.check_in_time) {
        return res.status(400).json({ success: false, message: 'Already checked in today' });
      }

      const { first: monthFirst, last: monthLast } = getMonthBounds(date);
      let existingLateCount = 0;
      try {
        const [lateRows] = await conn.execute(
          'SELECT COUNT(*) as cnt FROM employee_checkins WHERE employee_id = ? AND date >= ? AND date <= ? AND is_late = 1',
          [req.employee.id, monthFirst, monthLast]
        );
        existingLateCount = (lateRows && lateRows[0] && lateRows[0].cnt) || 0;
      } catch (_) {}

      const { attendance_type: attendanceType, is_late: isLate } = attendanceRules.getAttendanceForPunchIn(time, existingLateCount);

      if (row) {
        try {
          await conn.execute('UPDATE employee_checkins SET check_in_time=?, check_in_location=?, time=?, location=?, status=?, attendance_type=?, is_late=? WHERE id=?', [time, location, time, location, 'checked_in', attendanceType, isLate, row.id]);
        } catch (updErr) {
          const m = (updErr.message || '').toString();
          if (m.includes("Unknown column 'attendance_type'")) {
            await conn.execute('UPDATE employee_checkins SET check_in_time=?, check_in_location=?, time=?, location=?, status=? WHERE id=?', [time, location, time, location, 'checked_in', row.id]);
          } else if (m.includes("Unknown column 'is_late'")) {
            await conn.execute('UPDATE employee_checkins SET check_in_time=?, check_in_location=?, time=?, location=?, status=?, attendance_type=? WHERE id=?', [time, location, time, location, 'checked_in', attendanceType, row.id]);
          } else {
            throw updErr;
          }
        }
      } else {
        try {
          await conn.execute('INSERT INTO employee_checkins (employee_id, date, check_in_time, check_in_location, time, location, status, attendance_type, is_late) VALUES (?,?,?,?,?,?,\'checked_in\',?,?)', [req.employee.id, date, time, location, time, location, attendanceType, isLate]);
        } catch (insErr) {
          const msg = (insErr.message || '').toString();
          if (msg.includes("Unknown column 'attendance_type'")) {
            await conn.execute('INSERT INTO employee_checkins (employee_id, date, check_in_time, check_in_location, time, location, status) VALUES (?,?,?,?,?,?,\'checked_in\')', [req.employee.id, date, time, location, time, location]);
          } else if (msg.includes("Unknown column 'is_late'")) {
            await conn.execute('INSERT INTO employee_checkins (employee_id, date, check_in_time, check_in_location, time, location, status, attendance_type) VALUES (?,?,?,?,?,?,\'checked_in\',?)', [req.employee.id, date, time, location, time, location, attendanceType]);
          } else {
            throw insErr;
          }
        }
      }
      const dayLabel = attendanceType === 'full_day' ? 'Full day' : 'Half day';
      return res.json({ success: true, message: `Checked in. ${dayLabel} attendance.`, data: { attendance_type: attendanceType, is_late: isLate } });
    } else {
      const [ex] = await conn.execute('SELECT id, check_in_time FROM employee_checkins WHERE employee_id = ? AND date = ?', [req.employee.id, date]);
      const row = ex && ex[0];
      if (!row) {
        return res.status(400).json({ success: false, message: 'Not checked in today' });
      }
      await conn.execute('UPDATE employee_checkins SET check_out_time=?, check_out_location=?, status=? WHERE id=?', [time, location, 'completed', row.id]);
      return res.json({ success: true, message: 'Checked out. Attendance complete.' });
    }
  } catch (err) {
    const msg = (err && err.message) ? String(err.message) : 'Attendance update failed';
    let userMsg = msg;
    if (msg.includes("Unknown column 'check_in_time'") || msg.includes("Unknown column 'attendance_type'")) {
      userMsg = 'Database schema outdated. Run migration: cd backend-node && npm run migrate';
    } else if (msg.includes('ECONNREFUSED') || msg.includes('connect')) {
      userMsg = 'Database connection failed. Check backend .env and MySQL.';
    }
    console.error('POST /hrms/attendance error:', err && err.message);
    return res.status(500).json({ success: false, message: userMsg });
  } finally {
    if (conn && conn.release) conn.release();
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
    const [todayAtt] = await query('SELECT COUNT(*) as total FROM employee_checkins WHERE date = ?', [today]);
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
        today_attendance: parseInt(todayAtt && todayAtt.total) || 0,
        pending_leaves: parseInt(pendingLeaves && pendingLeaves.total) || 0,
        total_leave_balance: totalLeaveBalance,
        used_leaves: usedLeaves,
        monthly_salary_processed: monthlySalaryProcessed,
        attendance_trends: trends || [],
        leave_stats: leaveStatsWithApproved || [],
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

module.exports = router;
