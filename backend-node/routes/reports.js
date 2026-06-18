const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const allowedRoles = ['admin', 'manager', 'superadmin', 'super_admin'];
const columnCache = new Map();

function canSeeAll(emp) {
  return allowedRoles.includes(String(emp?.role || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));
}

async function hasColumn(tableName, columnName) {
  const key = `${tableName}.${columnName}`;
  if (columnCache.has(key)) return columnCache.get(key);
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  ).catch(() => [{ count: 0 }]);
  const exists = Number(rows?.[0]?.count || 0) > 0;
  columnCache.set(key, exists);
  return exists;
}

function addDateRange(sql, params, column, dateFrom, dateTo) {
  let out = sql;
  if (dateFrom) {
    out += ` AND DATE(${column}) >= ?`;
    params.push(String(dateFrom).slice(0, 10));
  }
  if (dateTo) {
    out += ` AND DATE(${column}) <= ?`;
    params.push(String(dateTo).slice(0, 10));
  }
  return out;
}

async function safeRows(sql, params = []) {
  return query(sql, params).catch(() => []);
}

async function scopedWhere({ table, alias, companyId, employeeId, employeeColumn = 'employee_id', assignedColumn = '' }) {
  const prefix = alias ? `${alias}.` : '';
  if (companyId && await hasColumn(table, 'company_id')) {
    return {
      clause: `(${prefix}company_id = ? OR ${prefix}company_id IS NULL)`,
      params: [companyId],
    };
  }
  if (assignedColumn && await hasColumn(table, assignedColumn)) {
    return { clause: `${prefix}${assignedColumn} = ?`, params: [employeeId] };
  }
  if (employeeColumn && await hasColumn(table, employeeColumn)) {
    return { clause: `${prefix}${employeeColumn} = ?`, params: [employeeId] };
  }
  return { clause: '1=1', params: [] };
}

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
    const companyId = req.employee.company_id;
    const allCompanyRows = canSeeAll(req.employee);
    const reportData = {};

    if (b.include_leads !== false) {
      const scope = allCompanyRows
        ? await scopedWhere({ table: 'leads', alias: 'l', companyId, employeeId: eid, assignedColumn: 'assigned_to' })
        : await scopedWhere({ table: 'leads', alias: 'l', employeeId: eid, assignedColumn: 'assigned_to' });
      let sql = `SELECT l.* FROM leads l WHERE ${scope.clause}`;
      const params = [...scope.params];
      sql = addDateRange(sql, params, 'l.created_at', dateFrom, dateTo);
      sql += ' ORDER BY l.created_at DESC LIMIT 500';
      reportData.leads = await safeRows(sql, params);
    }
    if (b.include_meetings !== false) {
      const scope = allCompanyRows
        ? await scopedWhere({ table: 'meetings', alias: 'm', companyId, employeeId: eid })
        : await scopedWhere({ table: 'meetings', alias: 'm', employeeId: eid });
      let sql = `SELECT m.*, l.company_name, l.contact_person
                 FROM meetings m
                 LEFT JOIN leads l ON m.lead_id = l.id
                 WHERE ${scope.clause}`;
      const params = [...scope.params];
      sql = addDateRange(sql, params, 'm.meeting_date', dateFrom, dateTo);
      sql += ' ORDER BY m.meeting_date DESC LIMIT 500';
      reportData.meetings = await safeRows(sql, params);
    }
    if (b.include_tasks !== false) {
      const scope = allCompanyRows
        ? await scopedWhere({ table: 'tasks', alias: 't', companyId, employeeId: eid })
        : await scopedWhere({ table: 'tasks', alias: 't', employeeId: eid });
      let sql = `SELECT t.* FROM tasks t WHERE ${scope.clause}`;
      const params = [...scope.params];
      sql = addDateRange(sql, params, 't.created_at', dateFrom, dateTo);
      sql += ' ORDER BY t.created_at DESC LIMIT 500';
      reportData.tasks = await safeRows(sql, params);
    }
    if (b.include_invoices !== false) {
      const scope = allCompanyRows
        ? await scopedWhere({ table: 'invoices', alias: 'i', companyId, employeeId: eid })
        : await scopedWhere({ table: 'invoices', alias: 'i', employeeId: eid });
      let sql = `SELECT i.*, l.company_name, l.contact_person
                 FROM invoices i
                 LEFT JOIN leads l ON i.lead_id = l.id
                 WHERE ${scope.clause}`;
      const params = [...scope.params];
      sql = addDateRange(sql, params, 'COALESCE(i.issue_date, i.created_at)', dateFrom, dateTo);
      sql += ' ORDER BY COALESCE(i.issue_date, i.created_at) DESC LIMIT 500';
      reportData.invoices = await safeRows(sql, params);
    }
    if (b.include_quotations) {
      const scope = allCompanyRows
        ? await scopedWhere({ table: 'quotations', alias: 'q', companyId, employeeId: eid })
        : await scopedWhere({ table: 'quotations', alias: 'q', employeeId: eid });
      let sql = `SELECT q.*, l.company_name, l.contact_person
                 FROM quotations q
                 LEFT JOIN leads l ON q.lead_id = l.id
                 WHERE ${scope.clause}`;
      const params = [...scope.params];
      sql = addDateRange(sql, params, 'COALESCE(q.issue_date, q.created_at)', dateFrom, dateTo);
      sql += ' ORDER BY COALESCE(q.issue_date, q.created_at) DESC LIMIT 500';
      reportData.quotations = await safeRows(sql, params);
    }
    if (reportType === 'financial') {
      let paymentsSql = `SELECT p.*, i.invoice_number, i.total_amount, l.company_name, ba.bank_name
                         FROM invoice_payments p
                         LEFT JOIN invoices i ON p.invoice_id = i.id
                         LEFT JOIN leads l ON i.lead_id = l.id
                         LEFT JOIN bank_accounts ba ON p.account_id = ba.id
                         WHERE p.company_id = ?`;
      const paymentParams = [companyId];
      paymentsSql = addDateRange(paymentsSql, paymentParams, 'p.payment_date', dateFrom, dateTo);
      paymentsSql += ' ORDER BY p.payment_date DESC LIMIT 500';
      reportData.payments = await safeRows(paymentsSql, paymentParams);

      let expensesSql = `SELECT e.*, ba.bank_name AS account_bank
                         FROM expenses e
                         LEFT JOIN bank_accounts ba ON e.account_id = ba.id
                         WHERE (e.company_id = ? OR e.company_id IS NULL)`;
      const expenseParams = [companyId];
      expensesSql = addDateRange(expensesSql, expenseParams, 'e.expense_date', dateFrom, dateTo);
      expensesSql += ' ORDER BY e.expense_date DESC LIMIT 500';
      reportData.expenses = await safeRows(expensesSql, expenseParams);

      reportData.accounts = await safeRows(
        'SELECT id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, balance FROM bank_accounts WHERE company_id = ? OR company_id IS NULL ORDER BY bank_name ASC',
        [companyId]
      );
    }

    const conn = await getConnection();
    let insertId = null;
    try {
      const [r] = await conn.execute(
        'INSERT INTO reports (employee_id, report_name, report_type, date_from, date_to, report_data, status) VALUES (?,?,?,?,?,?,?)',
        [eid, reportName, reportType, dateFrom, dateTo, JSON.stringify(reportData), 'completed']
      );
      insertId = r.insertId;
    } finally {
      conn.release();
    }
    return res.json({ success: true, message: 'Report created', data: { id: insertId } });
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
