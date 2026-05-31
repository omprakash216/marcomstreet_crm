const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

async function ensureExpensesTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
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
      INDEX idx_expense_employee (employee_id),
      CONSTRAINT fk_expenses_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
      CONSTRAINT fk_expenses_account FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
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
      WHERE 1=1`;
    const params = [];

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
  try {
    await ensureExpensesTable();
    const { expense_date, type, employee_id, account_id, description, amount } = req.body || {};
    if (!expense_date || !type || !amount) {
      return res.status(400).json({ success: false, message: 'Date, type and amount are required' });
    }
    await query(
      `INSERT INTO expenses (expense_date, type, employee_id, account_id, description, amount)
       VALUES (?,?,?,?,?,?)`,
      [expense_date, type, employee_id || null, account_id || null, description || null, amount]
    );
    res.json({ success: true, message: 'Expense recorded' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete expense
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await ensureExpensesTable();
    await query('DELETE FROM expenses WHERE id = ? AND company_id = ?', [req.params.id, req.employee.company_id]);
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
      WHERE 1=1`;
    const params = [];
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

