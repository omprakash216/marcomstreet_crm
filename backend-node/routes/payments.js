const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { localYmd } = require('../utils/documentNumbers');

const router = express.Router();

const allowedRoles = ['admin', 'manager', 'superadmin', 'super_admin'];
const paymentMethods = new Set(['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'online', 'other']);
const columnCache = new Map();

function canSeeAll(emp) {
  return allowedRoles.includes(String(emp?.role || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));
}

function money2(value) {
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function normalizePaymentStatus(invoice) {
  const status = String(invoice.status || '').toLowerCase();
  const total = money2(invoice.total_amount);
  const paid = money2(invoice.paid_amount);
  const due = Math.max(0, money2(total - paid));
  const today = localYmd();
  const dueDate = invoice.due_date ? String(invoice.due_date).slice(0, 10) : '';

  if (status === 'cancelled') return 'cancelled';
  if (paid >= total && total > 0) return 'paid';
  if (paid > 0) return 'partial';
  if (dueDate && dueDate < today) return 'overdue';
  return 'unpaid';
}

function withPaymentComputed(row) {
  const total = money2(row.total_amount);
  const paid = money2(row.paid_amount);
  return {
    ...row,
    total_amount: total,
    paid_amount: paid,
    due_amount: Math.max(0, money2(total - paid)),
    payment_status: normalizePaymentStatus({ ...row, total_amount: total, paid_amount: paid }),
  };
}

async function ensurePaymentsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      bank_name VARCHAR(255) NOT NULL,
      account_holder_name VARCHAR(255) NULL,
      account_number VARCHAR(100) NOT NULL,
      ifsc_code VARCHAR(50) NULL,
      branch_name VARCHAR(255) NULL,
      balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bank_accounts_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      invoice_id INT NOT NULL,
      account_id INT NULL,
      payment_date DATE NOT NULL,
      amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      method VARCHAR(40) NOT NULL DEFAULT 'bank_transfer',
      reference_no VARCHAR(120) NULL,
      notes TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_invoice_payments_company (company_id),
      INDEX idx_invoice_payments_invoice (invoice_id),
      INDEX idx_invoice_payments_account (account_id),
      INDEX idx_invoice_payments_date (payment_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
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

async function invoiceCustomerExpression() {
  const hasClientName = await hasColumn('invoices', 'client_name');
  return hasClientName ? "COALESCE(i.client_name, l.company_name, '')" : "COALESCE(l.company_name, '')";
}

async function fetchPaymentSummary(companyId, canAll, employeeId, filters = {}) {
  await ensurePaymentsTable();
  const customerExpr = await invoiceCustomerExpression();
  let sql = `
    SELECT i.id, i.invoice_number, i.lead_id, i.employee_id, i.issue_date, i.due_date,
           i.total_amount, i.status, i.created_at,
           ${customerExpr} AS customer_name,
           l.contact_person, l.phone, l.email,
           COALESCE(p.paid_amount, 0) AS paid_amount,
           p.last_payment_date
    FROM invoices i
    LEFT JOIN leads l ON i.lead_id = l.id
    LEFT JOIN (
      SELECT invoice_id, SUM(amount) AS paid_amount, MAX(payment_date) AS last_payment_date
      FROM invoice_payments
      WHERE company_id = ?
      GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    WHERE i.company_id = ?`;
  const params = [companyId, companyId];

  if (!canAll) {
    sql += ' AND i.employee_id = ?';
    params.push(employeeId);
  }

  if (filters.search) {
    const term = '%' + String(filters.search).trim() + '%';
    sql += ` AND (i.invoice_number LIKE ? OR ${customerExpr} LIKE ? OR COALESCE(l.contact_person, '') LIKE ? OR COALESCE(l.phone, '') LIKE ?)`;
    params.push(term, term, term, term);
  }

  if (filters.date_from) {
    sql += ' AND DATE(COALESCE(i.issue_date, i.created_at)) >= ?';
    params.push(String(filters.date_from).slice(0, 10));
  }

  if (filters.date_to) {
    sql += ' AND DATE(COALESCE(i.issue_date, i.created_at)) <= ?';
    params.push(String(filters.date_to).slice(0, 10));
  }

  sql += ' ORDER BY COALESCE(i.due_date, i.issue_date, i.created_at) DESC, i.id DESC LIMIT 500';
  const rows = await query(sql, params);
  const invoices = (Array.isArray(rows) ? rows : []).map(withPaymentComputed);

  const status = filters.payment_status && filters.payment_status !== 'all'
    ? String(filters.payment_status).toLowerCase()
    : '';
  return status ? invoices.filter((invoice) => invoice.payment_status === status) : invoices;
}

function buildInvoiceSummary(invoices) {
  return invoices.reduce((acc, invoice) => {
    acc.invoice_count += 1;
    acc.total_amount += money2(invoice.total_amount);
    acc.collected_amount += money2(invoice.paid_amount);
    acc.pending_amount += money2(invoice.due_amount);
    if (invoice.payment_status === 'overdue') {
      acc.overdue_count += 1;
      acc.overdue_amount += money2(invoice.due_amount);
    }
    if (invoice.payment_status === 'paid') acc.paid_count += 1;
    if (invoice.payment_status === 'partial') acc.partial_count += 1;
    if (invoice.payment_status === 'unpaid') acc.unpaid_count += 1;
    return acc;
  }, {
    invoice_count: 0,
    paid_count: 0,
    partial_count: 0,
    unpaid_count: 0,
    overdue_count: 0,
    total_amount: 0,
    collected_amount: 0,
    pending_amount: 0,
    overdue_amount: 0,
  });
}

async function listAccounts(companyId) {
  try {
    return await query(
      `SELECT id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, balance
       FROM bank_accounts
       WHERE company_id = ?
       ORDER BY bank_name ASC`,
      [companyId]
    );
  } catch (err) {
    const msg = String(err.message || '');
    if (!msg.includes('Unknown column') && !msg.includes("doesn't exist") && !msg.includes('ER_NO_SUCH_TABLE')) throw err;
    try {
      return await query(
        `SELECT id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, balance
         FROM bank_accounts
         ORDER BY bank_name ASC`
      );
    } catch (_) {
      return [];
    }
  }
}

async function updateAccountBalance(conn, accountId, companyId, delta) {
  if (!accountId || !money2(delta)) return;
  try {
    const [result] = await conn.query(
      'UPDATE bank_accounts SET balance = COALESCE(balance, 0) + ?, updated_at = NOW() WHERE id = ? AND company_id = ?',
      [money2(delta), accountId, companyId]
    );
    if (result?.affectedRows) return;
  } catch (err) {
    const msg = String(err.message || '');
    if (!msg.includes('Unknown column')) throw err;
  }
  await conn.query(
    'UPDATE bank_accounts SET balance = COALESCE(balance, 0) + ?, updated_at = NOW() WHERE id = ?',
    [money2(delta), accountId]
  ).catch(() => {});
}

async function getInvoiceForPayment(conn, invoiceId, companyId, canAll, employeeId) {
  let sql = `
    SELECT i.*, COALESCE(p.paid_amount, 0) AS paid_amount
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(amount) AS paid_amount
      FROM invoice_payments
      WHERE company_id = ?
      GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    WHERE i.id = ? AND i.company_id = ?`;
  const params = [companyId, invoiceId, companyId];
  if (!canAll) {
    sql += ' AND i.employee_id = ?';
    params.push(employeeId);
  }
  const [rows] = await conn.query(sql, params);
  return Array.isArray(rows) ? rows[0] : null;
}

async function recalculateInvoiceStatus(conn, invoiceId, companyId) {
  const [invoiceRows] = await conn.query(
    `SELECT i.id, i.total_amount, i.due_date, i.status, COALESCE(p.paid_amount, 0) AS paid_amount
     FROM invoices i
     LEFT JOIN (
       SELECT invoice_id, SUM(amount) AS paid_amount
       FROM invoice_payments
       WHERE company_id = ?
       GROUP BY invoice_id
     ) p ON p.invoice_id = i.id
     WHERE i.id = ? AND i.company_id = ?
     LIMIT 1`,
    [companyId, invoiceId, companyId]
  );
  const invoice = Array.isArray(invoiceRows) ? invoiceRows[0] : null;
  if (!invoice || String(invoice.status || '').toLowerCase() === 'cancelled') return null;

  const total = money2(invoice.total_amount);
  const paid = money2(invoice.paid_amount);
  const dueDate = invoice.due_date ? String(invoice.due_date).slice(0, 10) : '';
  const status = paid >= total && total > 0 ? 'paid' : (dueDate && dueDate < localYmd() ? 'overdue' : 'sent');

  await conn.query('UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?', [status, invoiceId, companyId]);
  return status;
}

router.get('/accounts', verifyToken, async (req, res) => {
  try {
    const accounts = await listAccounts(req.employee.company_id);
    return res.json({ success: true, data: Array.isArray(accounts) ? accounts : [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load accounts' });
  }
});

router.get('/invoices', verifyToken, async (req, res) => {
  try {
    const invoices = await fetchPaymentSummary(
      req.employee.company_id,
      canSeeAll(req.employee),
      req.employee.id,
      req.query || {}
    );
    return res.json({ success: true, data: invoices, summary: buildInvoiceSummary(invoices) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load payment invoices' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    await ensurePaymentsTable();
    const customerExpr = await invoiceCustomerExpression();
    const { search = '', method = '', account_id = '', date_from = '', date_to = '' } = req.query || {};
    const canAll = canSeeAll(req.employee);
    let sql = `
      SELECT p.*, i.invoice_number, i.total_amount, i.status AS invoice_status,
             ${customerExpr} AS customer_name,
             l.contact_person,
             ba.bank_name, ba.account_number,
             e.name AS created_by_name
      FROM invoice_payments p
      JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN leads l ON i.lead_id = l.id
      LEFT JOIN bank_accounts ba ON p.account_id = ba.id
      LEFT JOIN employees e ON p.created_by = e.id
      WHERE p.company_id = ?`;
    const params = [req.employee.company_id];

    if (!canAll) {
      sql += ' AND i.employee_id = ?';
      params.push(req.employee.id);
    }
    if (search) {
      const term = '%' + String(search).trim() + '%';
      sql += ` AND (i.invoice_number LIKE ? OR ${customerExpr} LIKE ? OR COALESCE(p.reference_no, '') LIKE ?)`;
      params.push(term, term, term);
    }
    if (method) {
      sql += ' AND p.method = ?';
      params.push(method);
    }
    if (account_id) {
      sql += ' AND p.account_id = ?';
      params.push(account_id);
    }
    if (date_from) {
      sql += ' AND p.payment_date >= ?';
      params.push(String(date_from).slice(0, 10));
    }
    if (date_to) {
      sql += ' AND p.payment_date <= ?';
      params.push(String(date_to).slice(0, 10));
    }

    sql += ' ORDER BY p.payment_date DESC, p.id DESC LIMIT 500';
    const rows = await query(sql, params);
    return res.json({ success: true, data: Array.isArray(rows) ? rows : [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to load payments' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    await ensurePaymentsTable();
    const body = req.body || {};
    const invoiceId = Number(body.invoice_id || 0);
    const accountId = body.account_id ? Number(body.account_id) : null;
    const amount = money2(body.amount);
    const method = paymentMethods.has(String(body.method || '').toLowerCase()) ? String(body.method).toLowerCase() : 'bank_transfer';
    const paymentDate = body.payment_date ? String(body.payment_date).slice(0, 10) : localYmd();

    if (!invoiceId) return res.status(400).json({ success: false, message: 'Invoice is required' });
    if (amount <= 0) return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero' });

    await conn.beginTransaction();
    const invoice = await getInvoiceForPayment(conn, invoiceId, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!invoice) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    if (String(invoice.status || '').toLowerCase() === 'cancelled') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Cancelled invoice payment record nahi ho sakta' });
    }

    const dueAmount = Math.max(0, money2(invoice.total_amount) - money2(invoice.paid_amount));
    if (amount > dueAmount + 0.01) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `Amount due se zyada hai. Pending: ${dueAmount}` });
    }

    const [result] = await conn.query(
      `INSERT INTO invoice_payments
       (company_id, invoice_id, account_id, payment_date, amount, method, reference_no, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        req.employee.company_id,
        invoiceId,
        accountId,
        paymentDate,
        amount,
        method,
        body.reference_no || null,
        body.notes || null,
        req.employee.id,
      ]
    );

    await updateAccountBalance(conn, accountId, req.employee.company_id, amount);
    const invoiceStatus = await recalculateInvoiceStatus(conn, invoiceId, req.employee.company_id);
    await conn.commit();

    return res.json({
      success: true,
      message: 'Payment recorded',
      data: { id: result.insertId, invoice_status: invoiceStatus },
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ success: false, message: err.message || 'Failed to record payment' });
  } finally {
    conn.release();
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    await ensurePaymentsTable();
    const paymentId = Number(req.params.id);
    if (!paymentId) return res.status(400).json({ success: false, message: 'Invalid payment id' });

    const body = req.body || {};
    const amount = money2(body.amount);
    const accountId = body.account_id ? Number(body.account_id) : null;
    const method = paymentMethods.has(String(body.method || '').toLowerCase()) ? String(body.method).toLowerCase() : 'bank_transfer';
    const paymentDate = body.payment_date ? String(body.payment_date).slice(0, 10) : localYmd();

    if (amount <= 0) return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero' });

    await conn.beginTransaction();
    const [existingRows] = await conn.query('SELECT * FROM invoice_payments WHERE id = ? AND company_id = ? FOR UPDATE', [paymentId, req.employee.company_id]);
    const existing = Array.isArray(existingRows) ? existingRows[0] : null;
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const invoice = await getInvoiceForPayment(conn, existing.invoice_id, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!invoice) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const dueWithoutExisting = Math.max(0, money2(invoice.total_amount) - money2(invoice.paid_amount) + money2(existing.amount));
    if (amount > dueWithoutExisting + 0.01) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `Amount due se zyada hai. Pending: ${dueWithoutExisting}` });
    }

    await updateAccountBalance(conn, existing.account_id, req.employee.company_id, -money2(existing.amount));
    await updateAccountBalance(conn, accountId, req.employee.company_id, amount);

    await conn.query(
      `UPDATE invoice_payments
       SET account_id = ?, payment_date = ?, amount = ?, method = ?, reference_no = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [accountId, paymentDate, amount, method, body.reference_no || null, body.notes || null, paymentId, req.employee.company_id]
    );
    const invoiceStatus = await recalculateInvoiceStatus(conn, existing.invoice_id, req.employee.company_id);
    await conn.commit();
    return res.json({ success: true, message: 'Payment updated', data: { invoice_status: invoiceStatus } });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ success: false, message: err.message || 'Failed to update payment' });
  } finally {
    conn.release();
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    await ensurePaymentsTable();
    const paymentId = Number(req.params.id);
    if (!paymentId) return res.status(400).json({ success: false, message: 'Invalid payment id' });

    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM invoice_payments WHERE id = ? AND company_id = ? FOR UPDATE', [paymentId, req.employee.company_id]);
    const payment = Array.isArray(rows) ? rows[0] : null;
    if (!payment) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const invoice = await getInvoiceForPayment(conn, payment.invoice_id, req.employee.company_id, canSeeAll(req.employee), req.employee.id);
    if (!invoice) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    await conn.query('DELETE FROM invoice_payments WHERE id = ? AND company_id = ?', [paymentId, req.employee.company_id]);
    await updateAccountBalance(conn, payment.account_id, req.employee.company_id, -money2(payment.amount));
    const invoiceStatus = await recalculateInvoiceStatus(conn, payment.invoice_id, req.employee.company_id);
    await conn.commit();
    return res.json({ success: true, message: 'Payment deleted', data: { invoice_status: invoiceStatus } });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete payment' });
  } finally {
    conn.release();
  }
});

module.exports = router;
