const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();

function requireAdmin(req, res, next) {
  const role = (req.employee.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'manager') return res.status(403).json({ success: false, message: 'Unauthorized' });
  next();
}

function requireAdminOrHR(req, res, next) {
  const role = (req.employee.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'manager' && role !== 'human_resources') return res.status(403).json({ success: false, message: 'Unauthorized' });
  next();
}

router.get('/dashboard', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [leads] = await query('SELECT COUNT(*) as c FROM leads');
    const [employees] = await query('SELECT COUNT(*) as c FROM employees WHERE status = ?', ['active']);
    const [companies] = await query('SELECT COUNT(*) as c FROM companies').catch(() => [{ c: 0 }]);
    const [meetings] = await query('SELECT COUNT(*) as c FROM meetings').catch(() => [{ c: 0 }]);
    const [tasks] = await query('SELECT COUNT(*) as c FROM tasks').catch(() => [{ c: 0 }]);
    const [followups] = await query('SELECT COUNT(*) as c FROM followups').catch(() => [{ c: 0 }]);
    const [invoices] = await query('SELECT COUNT(*) as c FROM invoices').catch(() => [{ c: 0 }]);
    const [quotations] = await query('SELECT COUNT(*) as c FROM quotations').catch(() => [{ c: 0 }]);
    return res.json({
      success: true,
      data: {
        total_leads: Number(leads?.c) || 0,
        total_employees: Number(employees?.c) || 0,
        total_companies: Number(companies?.c) || 0,
        total_meetings: Number(meetings?.c) || 0,
        total_tasks: Number(tasks?.c) || 0,
        total_followups: Number(followups?.c) || 0,
        total_invoices: Number(invoices?.c) || 0,
        total_quotations: Number(quotations?.c) || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/attendance', verifyToken, requireAdmin, async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const department = req.query.department || '';
    const selectedDate = req.query.selected_date || new Date().toISOString().slice(0, 10);
    const [todayCheckedIn] = await query("SELECT COUNT(DISTINCT employee_id) as c FROM employee_checkins WHERE date = CURDATE() AND status IN ('checked_in', 'completed')");
    const [totalEmployees] = await query('SELECT COUNT(*) as c FROM employees WHERE status = ?', ['active']);
    const present = parseInt(todayCheckedIn?.c) || 0;
    const total = parseInt(totalEmployees?.c) || 0;
    let sql = `SELECT ec.id, ec.employee_id, ec.date, ec.status, ec.check_in_time, ec.check_out_time, ec.check_in_location, ec.check_out_location, ec.total_hours, e.name, e.email, e.employee_code
      FROM employee_checkins ec JOIN employees e ON e.id = ec.employee_id WHERE ec.date = ? AND ec.status IN ('checked_in', 'completed', 'checked_out')`;
    const params = [selectedDate];
    if (department) { sql += ' AND e.department_id = (SELECT id FROM departments WHERE name = ? LIMIT 1)'; params.push(department); }
    sql += ' ORDER BY ec.date DESC, ec.check_in_time DESC';
    const attendanceRecords = await query(sql, params);
    const monthlyStats = await query(`
      SELECT DATE_FORMAT(date, '%Y-%m') as month, COUNT(DISTINCT employee_id) as employees, COUNT(*) as checkins
      FROM employee_checkins WHERE date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY DATE_FORMAT(date, '%Y-%m') ORDER BY month DESC
    `).catch(() => []);
    return res.json({
      success: true,
      data: {
        todayCheckedIn: present,
        totalEmployees: total,
        presentEmployees: present,
        absentEmployees: total - present,
        attendanceRecords: attendanceRecords || [],
        monthlyStats: monthlyStats || [],
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/insights', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [companies] = await query('SELECT COUNT(*) as c FROM companies');
    const [employees] = await query('SELECT COUNT(*) as c FROM employees');
    const [leads] = await query('SELECT COUNT(*) as c FROM leads');
    const [meetings] = await query('SELECT COUNT(*) as c FROM meetings');
    const [tasks] = await query('SELECT COUNT(*) as c FROM tasks');
    const [followups] = await query('SELECT COUNT(*) as c FROM followups');
    const companiesByStatus = await query('SELECT status, COUNT(*) as count FROM companies GROUP BY status').catch(() => []);
    const employeesByStatus = await query('SELECT status, COUNT(*) as count FROM employees GROUP BY status').catch(() => []);
    const leadsByStatus = await query('SELECT status, COUNT(*) as count FROM leads GROUP BY status').catch(() => []);
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
    const period = req.query.period || 'month';
    const companyRevenue = await query(`
      SELECT c.id, c.company_name, COALESCE(SUM(i.total_amount), 0) as total_sales, COUNT(i.id) as invoice_count,
        COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN i.status = 'pending' THEN i.total_amount ELSE 0 END), 0) as pending_amount
      FROM companies c LEFT JOIN invoices i ON i.company_id = c.id GROUP BY c.id, c.company_name ORDER BY total_sales DESC
    `).catch(() => []);
    const [totalRev] = await query('SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = ?', ['paid']).catch(() => [{ total: 0 }]);
    const [monthRev] = await query("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())").catch(() => [{ total: 0 }]);
    const monthlyTrend = await query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, DATE_FORMAT(created_at, '%b %Y') as month_label, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as invoice_count
      FROM invoices WHERE status = 'paid' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y') ORDER BY month ASC
    `).catch(() => []);
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
    const statusFilter = req.query.status || 'all';
    const employeeFilter = req.query.employee_id || 'all';
    const priorityFilter = req.query.priority || 'all';
    const search = req.query.search || '';
    let sql = `SELECT t.*, e.name as employee_name, e.email as employee_email, l.company_name as lead_company_name, l.contact_person as lead_contact
      FROM tasks t LEFT JOIN employees e ON e.id = t.employee_id LEFT JOIN leads l ON l.id = t.lead_id WHERE 1=1`;
    const params = [];
    if (statusFilter !== 'all') { sql += ' AND t.status = ?'; params.push(statusFilter); }
    if (employeeFilter !== 'all') { sql += ' AND t.employee_id = ?'; params.push(employeeFilter); }
    if (priorityFilter !== 'all') { sql += ' AND t.priority = ?'; params.push(priorityFilter); }
    if (search) { sql += ' AND (t.title LIKE ? OR t.description LIKE ?)'; const t = '%' + search + '%'; params.push(t, t); }
    sql += ' ORDER BY t.created_at DESC';
    const tasksList = await query(sql, params);
    const [total] = await query('SELECT COUNT(*) as c FROM tasks');
    const [pending] = await query('SELECT COUNT(*) as c FROM tasks WHERE status = ?', ['pending']);
    const [inProgress] = await query('SELECT COUNT(*) as c FROM tasks WHERE status = ?', ['in_progress']);
    const [completed] = await query('SELECT COUNT(*) as c FROM tasks WHERE status = ?', ['completed']);
    const [urgent] = await query('SELECT COUNT(*) as c FROM tasks WHERE priority = ?', ['urgent']);
    const employees = await query('SELECT id, name, email FROM employees WHERE status = ? ORDER BY name', ['active']);
    const leads = await query('SELECT id, company_name, contact_person FROM leads ORDER BY company_name');
    return res.json({
      success: true,
      data: {
        tasks: tasksList || [],
        statistics: { total: Number(total?.c) || 0, pending: Number(pending?.c) || 0, inProgress: Number(inProgress?.c) || 0, completed: Number(completed?.c) || 0, urgent: Number(urgent?.c) || 0 },
        employees: employees || [],
        leads: leads || [],
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/tasks', verifyToken, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    await query(
      'INSERT INTO tasks (employee_id, lead_id, title, description, task_type, priority, due_date, status) VALUES (?,?,?,?,?,?,?,?)',
      [b.employee_id || req.employee.id, b.lead_id || null, b.title, b.description || '', b.task_type || 'general', b.priority || 'medium', b.due_date || null, b.status || 'pending']
    );
    return res.json({ success: true, message: 'Task created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/tasks/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    await query(
      'UPDATE tasks SET employee_id=?, lead_id=?, title=?, description=?, priority=?, due_date=?, status=?, updated_at=NOW() WHERE id=?',
      [b.employee_id, b.lead_id || null, b.title, b.description, b.priority, b.due_date, b.status, req.params.id]
    );
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

router.get('/employees', verifyToken, async (req, res) => {
  try {
    const id = req.query.id || null;
    const fields = 'e.id, e.employee_code, e.name, e.email, e.phone, e.role, e.department_id, e.designation, e.status, e.created_at, d.name as department_name';
    if (id) {
      const rows = await query(`SELECT ${fields}, e.address, e.joining_date, e.permanent_address, e.dob, e.gender, e.marital_status FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.id = ?`, [id]);
      const emp = rows[0];
      if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
      return res.json({ success: true, employee: emp });
    }
    const rows = await query(`SELECT ${fields} FROM employees e LEFT JOIN departments d ON e.department_id = d.id ORDER BY e.created_at DESC`);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/employees', verifyToken, requireAdminOrHR, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !b.email || !b.password) return res.status(400).json({ success: false, message: 'Missing required fields' });
    const hashedPassword = await bcrypt.hash(b.password, 10).catch(() => b.password);
    await query(
      `INSERT INTO employees (employee_code, name, email, phone, password, role, department_id, designation, status, address, permanent_address, dob, gender, marital_status, emergency_contact_name, emergency_contact_phone, joining_date, employment_type, probation_period, basic_salary, hra, conveyance, medical_allowance, lta, other_allowances, previous_company, previous_designation, experience_years, qualification, bank_account, pan_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.employee_code || 'EMP' + Date.now(), b.name, b.email, b.phone || null, hashedPassword, b.role || 'employee', b.department_id || null, b.designation || null, 'active', b.address || null, b.permanent_address || null, b.dob || null, b.gender || null, b.marital_status || null, b.emergency_contact_name || null, b.emergency_contact_phone || null, b.joining_date || null, b.employment_type || 'full_time', b.probation_period || '3', b.basic_salary || null, b.hra || null, b.conveyance || null, b.medical_allowance || null, b.lta || null, b.other_allowances || null, b.previous_company || null, b.previous_designation || null, b.experience_years || null, b.qualification || null, b.bank_account || null, b.pan_number || null]
    );
    return res.json({ success: true, message: 'Employee created successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/employees', verifyToken, requireAdminOrHR, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.id) return res.status(400).json({ success: false, message: 'Employee ID is required' });
    const rows = await query('SELECT * FROM employees WHERE id = ?', [b.id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ success: false, message: 'Employee not found' });
    const updateFields = ['employee_code', 'name', 'email', 'phone', 'role', 'department_id', 'designation', 'status', 'address', 'permanent_address', 'dob', 'gender', 'marital_status', 'emergency_contact_name', 'emergency_contact_phone', 'joining_date', 'employment_type', 'probation_period', 'basic_salary', 'hra', 'conveyance', 'medical_allowance', 'lta', 'other_allowances', 'previous_company', 'previous_designation', 'experience_years', 'qualification', 'bank_account', 'pan_number'];
    const values = updateFields.map((f) => (b[f] !== undefined && b[f] !== null ? b[f] : existing[f]));
    values.push(b.id);
    const placeholders = updateFields.map((f) => `${f}=?`).join(', ');
    await query(`UPDATE employees SET ${placeholders} WHERE id = ?`, values);
    return res.json({ success: true, message: 'Employee updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/employees', verifyToken, requireAdminOrHR, async (req, res) => {
  try {
    const id = req.query.id || (req.body && req.body.id);
    if (!id) return res.status(400).json({ success: false, message: 'Employee ID is required' });
    if (Number(id) === req.employee.id) return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    await query('DELETE FROM employees WHERE id = ?', [id]);
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
    return res.json({
      success: true,
      data: { companies: rows || [], statistics: { activeApiKeys: Number(activeKeys?.c) || 0, totalCompanies: Number(totalCompanies?.c) || 0 } },
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
    await query('UPDATE api_keys SET webhook_url = ?, updated_at = NOW() WHERE company_id = ?', [b.webhook_url || null, b.company_id]).catch(() => {});
    return res.json({ success: true, message: 'API key updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/audit-logs', verifyToken, requireAdmin, async (req, res) => {
  try {
    const rows = await query('SELECT a.*, e.name as employee_name FROM api_audit_log a LEFT JOIN employees e ON a.employee_id = e.id ORDER BY a.accessed_at DESC LIMIT 100');
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

router.get('/companies', verifyToken, requireAdmin, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM companies ORDER BY company_name ASC, id DESC LIMIT 200');
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

router.put('/companies', verifyToken, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.id) return res.status(400).json({ success: false, message: 'Company ID is required' });
    await query(
      `UPDATE companies SET company_name=?, email=?, phone=?, address=?, city=?, state=?, country=?, status=?, updated_at=NOW() WHERE id=?`,
      [b.company_name, b.email, b.phone, b.address, b.city, b.state, b.country, b.status || 'active', b.id]
    );
    return res.json({ success: true, message: 'Company updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/companies', verifyToken, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const conn = await getConnection();
    const [r] = await conn.execute(
      'INSERT INTO companies (company_name, email, phone, address, city, state, country, status) VALUES (?,?,?,?,?,?,?,?)',
      [b.company_name || '', b.email || '', b.phone || '', b.address || '', b.city || '', b.state || '', b.country || '', b.status || 'active']
    );
    conn.release();
    return res.json({ success: true, message: 'Company created', data: { id: r.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/companies', verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = req.query.id || (req.body && req.body.id);
    if (!id) return res.status(400).json({ success: false, message: 'Company ID is required' });
    await query('DELETE FROM companies WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Company deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/ai-lead-score', verifyToken, requireAdmin, async (req, res) => {
  try {
    const rows = await query('SELECT id, lead_code, company_name, contact_person, email, status, priority, estimated_value, lead_score, created_at FROM leads ORDER BY created_at DESC LIMIT 100');
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
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
