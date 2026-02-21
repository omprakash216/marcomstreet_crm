const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const search = req.query.search || null;
    const status = req.query.status || null;
    let sql = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (invoice_number LIKE ? OR client_name LIKE ?)'; const t = '%' + search + '%'; params.push(t, t); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const conn = await getConnection();
    const [r] = await conn.execute(
      'INSERT INTO invoices (lead_id, company_id, employee_id, invoice_number, client_name, total_amount, status, due_date, notes) VALUES (?,?,?,?,?,?,?,?,?)',
      [b.lead_id || null, b.company_id || null, req.employee.id, b.invoice_number || 'INV' + Date.now(), b.client_name || '', b.total_amount || 0, b.status || 'draft', b.due_date || null, b.notes || '']
    );
    conn.release();
    return res.json({ success: true, message: 'Invoice created', data: { id: r.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
