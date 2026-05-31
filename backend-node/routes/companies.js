const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Company login/register (no employee token) - for CompanyLogin.jsx and CompanyManagement.jsx
router.post('/login', async (req, res) => {
  try {
    const b = req.body || {};
    if (b.company_id) {
      const rows = await query('SELECT id, company_name, email, phone, address, city, state, country, status FROM companies WHERE id = ?', [b.company_id]);
      const company = rows && rows[0];
      if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
      return res.json({ success: true, data: { company, token: String(company.id) } });
    }
    const { company_name, email, phone, password } = b;
    if (!company_name || !email || !phone) {
      return res.status(400).json({ success: false, message: 'Company name, email and phone are required' });
    }
    let rows = await query('SELECT id, company_name, email, phone, address, city, state, country, status, password FROM companies WHERE email = ? LIMIT 1', [email]);
    let company = rows && rows[0];
    if (!company) {
      const conn = await getConnection();
      const hashedPassword = await bcrypt.hash(password || 'password123', 10).catch(() => password || 'password123');
      await conn.execute(
        `INSERT INTO companies (company_name, email, phone, password, address, city, state, country, status) VALUES (?,?,?,?,?,?,?,?,?)`,
        [company_name || '', email || '', phone || '', hashedPassword, b.address || '', b.city || '', b.state || '', b.country || '', 'active']
      );
      conn.release();
      rows = await query('SELECT id, company_name, email, phone, address, city, state, country, status, password FROM companies WHERE email = ? LIMIT 1', [email]);
      company = rows && rows[0];
      
      if (company) {
        // Automatically create an admin employee for this company
        try {
          const employeeCode = 'COM' + company.id + '-' + Math.floor(Math.random() * 10000);
          await query(
            'INSERT INTO employees (employee_code, name, email, password, role, status, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [employeeCode, company.company_name, company.email, company.password, 'admin', 'active', company.id]
          );
        } catch (empErr) {
          console.error('Failed to auto-create admin employee in company login registration:', empErr);
        }
      }
    }
    if (!company) return res.status(500).json({ success: false, message: 'Failed to create or find company' });
    return res.json({ success: true, data: { company, token: String(company.id) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const search = req.query.search || null;
    const status = req.query.status || null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const offset = ((parseInt(req.query.page, 10) || 1) - 1) * limit;
    
    const isSuper = req.employee.role === 'superadmin' || req.employee.role === 'super_admin';
    let sql = `SELECT id, company_name, email, phone, address, city, state, country, status, created_at, updated_at FROM companies WHERE 1=1`;
    const params = [];
    if (!isSuper && req.employee.company_id) {
      sql += ' AND id = ?';
      params.push(req.employee.company_id);
    }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (search) { sql += ' AND (company_name LIKE ? OR email LIKE ?)'; const t = '%' + search + '%'; params.push(t, t); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

router.get('/history', verifyToken, async (req, res) => {
  try {
    const companyId = req.query.company_id || null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    let sql = `SELECT al.id, al.activity_type, al.entity_type, al.entity_id, al.description, al.created_at, al.ip_address, e.name as employee_name, e.employee_code, c.company_name
      FROM activity_logs al LEFT JOIN employees e ON al.employee_id = e.id LEFT JOIN companies c ON al.entity_id = c.id AND al.entity_type = 'company'
      WHERE al.entity_type = 'company'`;
    const params = [];
    if (companyId) { sql += ' AND al.entity_id = ?'; params.push(companyId); }
    sql += ' ORDER BY al.created_at DESC LIMIT ?';
    params.push(limit);
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, company_name, email, phone, address, city, state, country, zip_code, website, tax_id, registration_number, status, created_at, updated_at FROM companies WHERE id = ?',
      [req.params.id]
    );
    const company = rows[0];
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    return res.json({ success: true, data: company });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/leads', verifyToken, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM leads WHERE company_id = ? ORDER BY created_at DESC', [req.params.id]);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

router.get('/:id/meetings', verifyToken, async (req, res) => {
  try {
    const rows = await query('SELECT m.*, l.company_name FROM meetings m LEFT JOIN leads l ON m.lead_id = l.id WHERE m.company_id = ? ORDER BY m.meeting_date DESC', [req.params.id]);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    const rows = await query('SELECT m.*, l.company_name FROM meetings m LEFT JOIN leads l ON m.lead_id = l.id ORDER BY m.meeting_date DESC LIMIT 50');
    return res.json({ success: true, data: rows || [] });
  }
});

router.get('/:id/quotations', verifyToken, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM quotations WHERE company_id = ? ORDER BY created_at DESC', [req.params.id]);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

router.put('/update', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.id) return res.status(400).json({ success: false, message: 'Company ID is required' });
    await query(
      `UPDATE companies SET company_name=?, email=?, phone=?, address=?, city=?, state=?, country=?, zip_code=?, website=?, tax_id=?, registration_number=?, status=?, updated_at=NOW() WHERE id=?`,
      [b.company_name, b.email, b.phone, b.address, b.city, b.state, b.country, b.zip_code, b.website, b.tax_id, b.registration_number, b.status || 'active', b.id]
    );
    return res.json({ success: true, message: 'Company updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const conn = await getConnection();
    const hashedPassword = await bcrypt.hash(b.password || 'password123', 10).catch(() => b.password || 'password123');
    const [r] = await conn.execute(
      `INSERT INTO companies (company_name, email, phone, password, address, city, state, country, status) VALUES (?,?,?,?,?,?,?,?,?)`,
      [b.company_name || '', b.email || '', b.phone || '', hashedPassword, b.address || '', b.city || '', b.state || '', b.country || '', b.status || 'active']
    );
    conn.release();
    return res.json({ success: true, message: 'Company created', data: { id: r.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;