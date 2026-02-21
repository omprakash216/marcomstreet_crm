const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const search = req.query.search || null;
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;
    let sql = 'SELECT * FROM whatsapp_hits WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (phone LIKE ? OR message LIKE ?)'; const t = '%' + search + '%'; params.push(t, t); }
    if (dateFrom) { sql += ' AND DATE(created_at) >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND DATE(created_at) <= ?'; params.push(dateTo); }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const rows = await query(sql, params).catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

module.exports = router;
