const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const search = req.query.search || null;
    const reportType = req.query.report_type || null;
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;
    const status = req.query.status || null;
    let sql = 'SELECT * FROM reports WHERE employee_id = ?';
    const params = [req.employee.id];
    if (search) { sql += ' AND (report_name LIKE ? OR report_type LIKE ?)'; const t = '%' + search + '%'; params.push(t, t); }
    if (reportType) { sql += ' AND report_type = ?'; params.push(reportType); }
    if (dateFrom) { sql += ' AND DATE(created_at) >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND DATE(created_at) <= ?'; params.push(dateTo); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

router.get('/sample', verifyToken, async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const eid = req.employee.id;
    const leads = await query('SELECT * FROM leads WHERE assigned_to = ? ORDER BY created_at DESC LIMIT 50', [eid]);
    const meetings = await query('SELECT * FROM meetings WHERE employee_id = ? ORDER BY meeting_date DESC LIMIT 50', [eid]);
    const tasks = await query('SELECT * FROM tasks WHERE employee_id = ? ORDER BY created_at DESC LIMIT 50', [eid]);
    return res.json({ success: true, data: { leads: leads || [], meetings: meetings || [], tasks: tasks || [], period } });
  } catch (err) {
    return res.json({ success: true, data: { leads: [], meetings: [], tasks: [], period: 'month' } });
  }
});

router.post('/create', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const reportName = b.report_name || 'Untitled Report';
    const reportType = b.report_type || 'sales';
    const dateFrom = b.date_from || null;
    const dateTo = b.date_to || null;
    const eid = req.employee.id;
    const reportData = {};
    if (b.include_leads !== false) {
      let sql = 'SELECT * FROM leads WHERE assigned_to = ?';
      const params = [eid];
      if (dateFrom && dateTo) { sql += ' AND created_at BETWEEN ? AND ?'; params.push(dateFrom, dateTo); }
      reportData.leads = await query(sql, params);
    }
    if (b.include_meetings !== false) {
      let sql = 'SELECT * FROM meetings WHERE employee_id = ?';
      const params = [eid];
      if (dateFrom && dateTo) { sql += ' AND meeting_date BETWEEN ? AND ?'; params.push(dateFrom, dateTo); }
      reportData.meetings = await query(sql, params);
    }
    if (b.include_tasks !== false) {
      let sql = 'SELECT * FROM tasks WHERE employee_id = ?';
      const params = [eid];
      if (dateFrom && dateTo) { sql += ' AND created_at BETWEEN ? AND ?'; params.push(dateFrom, dateTo); }
      reportData.tasks = await query(sql, params);
    }
    const conn = await getConnection();
    const [r] = await conn.execute('INSERT INTO reports (employee_id, report_name, report_type, report_data, status) VALUES (?,?,?,?,?)', [eid, reportName, reportType, JSON.stringify(reportData), 'generated']);
    conn.release();
    return res.json({ success: true, message: 'Report created', data: { id: r.insertId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/download', verifyToken, async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ success: false, message: 'Report ID required' });
    const rows = await query('SELECT * FROM reports WHERE id = ? AND employee_id = ?', [id, req.employee.id]);
    const report = rows[0];
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.json"`);
    return res.json({
      success: true,
      report,
      data: typeof report.report_data === 'string' ? JSON.parse(report.report_data || '{}') : report.report_data,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
