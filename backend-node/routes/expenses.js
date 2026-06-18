const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const columnCache = new Map();

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

async function ensureBankAccountsTable() {
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

  const columns = [
    ['company_id', 'INT NULL AFTER id'],
    ['account_holder_name', 'VARCHAR(255) NULL AFTER bank_name'],
    ['ifsc_code', 'VARCHAR(50) NULL AFTER account_number'],
    ['branch_name', 'VARCHAR(255) NULL AFTER ifsc_code'],
    ['balance', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00'],
    ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ];

  for (const [column, definition] of columns) {
    if (!(await hasColumn('bank_accounts', column))) {
      await query(`ALTER TABLE bank_accounts ADD COLUMN ${column} ${definition}`).catch(() => {});
      columnCache.delete(`bank_accounts.${column}`);
    }
  }
}

async function ensureExpensesTable() {
  await ensureBankAccountsTable();
  await query(
    `CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      expense_date DATE NOT NULL,
      type VARCHAR(32) NOT NULL, -- salary, rent, tools, other, etc.
      employee_id INT NULL,
      account_id INT NULL,
      description VARCHAR(255) NULL,
      amount DECIMAL(15,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_expense_date (expense_date),
      INDEX idx_expense_type (type),
      INDEX idx_expense_company (company_id),
      INDEX idx_expense_employee (employee_id),
      CONSTRAINT fk_expenses_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_expenses_account FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  const columns = [
    ['company_id', 'INT NULL AFTER id'],
    ['employee_id', 'INT NULL'],
    ['account_id', 'INT NULL'],
    ['description', 'VARCHAR(255) NULL'],
    ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ];

  for (const [column, definition] of columns) {
    if (!(await hasColumn('expenses', column))) {
      await query(`ALTER TABLE expenses ADD COLUMN ${column} ${definition}`).catch(() => {});
      columnCache.delete(`expenses.${column}`);
    }
  }
}

function money2(value) {
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

async function updateAccountBalance(conn, accountId, companyId, delta) {
  if (!accountId || !money2(delta)) return;
  await conn.query(
    `UPDATE bank_accounts
     SET company_id = COALESCE(company_id, ?),
         balance = COALESCE(balance, 0) + ?,
         updated_at = NOW()
     WHERE id = ? AND (company_id = ? OR company_id IS NULL)`,
    [companyId, money2(delta), accountId, companyId]
  );
}

// List expenses with optional filters
router.get('/', verifyToken, async (req, res) => {
  try {
    await ensureExpensesTable();
    const { from, to, type, employee_id } = req.query;
    let sql = `
      SELECT e.id, e.expense_date, e.type, e.description, e.amount,
             e.employee_id, e.account_id,
             emp.name AS employee_name,
             ba.bank_name AS account_bank
      FROM expenses e
      LEFT JOIN employees emp ON e.employee_id = emp.id
      LEFT JOIN bank_accounts ba ON e.account_id = ba.id
      WHERE (e.company_id = ? OR e.company_id IS NULL)`;
    const params = [req.employee.company_id];

    if (from) {
      sql += ' AND e.expense_date >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND e.expense_date <= ?';
      params.push(to);
    }
    if (type) {
      sql += ' AND e.type = ?';
      params.push(type);
    }
    if (employee_id) {
      sql += ' AND e.employee_id = ?';
      params.push(employee_id);
    }

    sql += ' ORDER BY e.expense_date DESC, e.id DESC';

    const rows = await query(sql, params);
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create expense
router.post('/', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    await ensureExpensesTable();
    const { expense_date, type, employee_id, account_id, description, amount } = req.body || {};
    const expenseAmount = money2(amount);
    if (!expense_date || !type || expenseAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Date, type and amount are required' });
    }

    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO expenses (company_id, expense_date, type, employee_id, account_id, description, amount)
       VALUES (?,?,?,?,?,?,?)`,
      [req.employee.company_id, expense_date, type, employee_id || null, account_id || null, description || null, expenseAmount]
    );
    await updateAccountBalance(conn, account_id || null, req.employee.company_id, -expenseAmount);
    await conn.commit();
    res.json({ success: true, message: 'Expense recorded', data: { id: result.insertId } });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// Update expense
router.put('/:id', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    await ensureExpensesTable();
    const { expense_date, type, employee_id, account_id, description, amount } = req.body || {};
    const expenseAmount = money2(amount);
    if (!expense_date || !type || expenseAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Date, type and amount are required' });
    }

    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT id, account_id, amount FROM expenses WHERE id = ? AND (company_id = ? OR company_id IS NULL) FOR UPDATE',
      [req.params.id, req.employee.company_id]
    );
    const expense = Array.isArray(rows) ? rows[0] : null;
    if (!expense) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    const previousAccountId = expense.account_id || null;
    const previousAmount = money2(expense.amount);
    const nextAccountId = account_id ? Number(account_id) : null;

    await conn.query(
      `UPDATE expenses
       SET company_id = COALESCE(company_id, ?),
           expense_date = ?,
           type = ?,
           employee_id = ?,
           account_id = ?,
           description = ?,
           amount = ?,
           updated_at = NOW()
       WHERE id = ? AND (company_id = ? OR company_id IS NULL)`,
      [
        req.employee.company_id,
        expense_date,
        type,
        employee_id || null,
        nextAccountId,
        description || null,
        expenseAmount,
        req.params.id,
        req.employee.company_id,
      ]
    );

    if (previousAccountId && String(previousAccountId) === String(nextAccountId)) {
      await updateAccountBalance(conn, nextAccountId, req.employee.company_id, previousAmount - expenseAmount);
    } else {
      await updateAccountBalance(conn, previousAccountId, req.employee.company_id, previousAmount);
      await updateAccountBalance(conn, nextAccountId, req.employee.company_id, -expenseAmount);
    }

    await conn.commit();
    res.json({ success: true, message: 'Expense updated successfully' });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// Delete expense
router.delete('/:id', verifyToken, async (req, res) => {
  const conn = await getConnection();
  try {
    await ensureExpensesTable();
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT id, account_id, amount FROM expenses WHERE id = ? AND (company_id = ? OR company_id IS NULL) FOR UPDATE',
      [req.params.id, req.employee.company_id]
    );
    const expense = Array.isArray(rows) ? rows[0] : null;
    if (!expense) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    await conn.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    await updateAccountBalance(conn, expense.account_id, req.employee.company_id, money2(expense.amount));
    await conn.commit();
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// Export CSV (Excel-friendly)
router.get('/export', verifyToken, async (req, res) => {
  try {
    await ensureExpensesTable();
    const { from, to, type } = req.query;
    let sql = `
      SELECT e.expense_date, e.type, e.description, e.amount,
             emp.name AS employee_name,
             ba.bank_name AS account_bank
      FROM expenses e
      LEFT JOIN employees emp ON e.employee_id = emp.id
      LEFT JOIN bank_accounts ba ON e.account_id = ba.id
      WHERE (e.company_id = ? OR e.company_id IS NULL)`;
    const params = [req.employee.company_id];
    if (from) { sql += ' AND e.expense_date >= ?'; params.push(from); }
    if (to) { sql += ' AND e.expense_date <= ?'; params.push(to); }
    if (type) { sql += ' AND e.type = ?'; params.push(type); }
    sql += ' ORDER BY e.expense_date DESC, e.id DESC';

    const rows = await query(sql, params);

    const header = ['Date', 'Type', 'Description', 'Amount', 'Employee', 'Account'].join(',');
    const lines = (rows || []).map(r =>
      [
        r.expense_date,
        r.type,
        (r.description || '').replace(/,/g, ' '),
        r.amount,
        r.employee_name || '',
        r.account_bank || ''
      ].join(',')
    );

    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

