const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

const columnCache = new Map();

function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeIfsc(value) {
    return normalizeText(value).toUpperCase();
}

function normalizeBalance(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
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

// GET all bank accounts
router.get('/', verifyToken, async (req, res) => {
    try {
        await ensureBankAccountsTable();
        const rows = await query(
            'SELECT * FROM bank_accounts WHERE company_id = ? OR company_id IS NULL ORDER BY created_at DESC',
            [req.employee.company_id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST new bank account
router.post('/', verifyToken, async (req, res) => {
    try {
        await ensureBankAccountsTable();
        const bank_name = normalizeText(req.body.bank_name);
        const account_holder_name = normalizeText(req.body.account_holder_name);
        const account_number = normalizeText(req.body.account_number);
        const ifsc_code = normalizeIfsc(req.body.ifsc_code);
        const branch_name = normalizeText(req.body.branch_name);
        const balance = normalizeBalance(req.body.balance);

        if (!bank_name || !account_number) {
            return res.status(400).json({ success: false, message: 'Bank Name and Account Number are required' });
        }

        const result = await query(
            'INSERT INTO bank_accounts (company_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.employee.company_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, balance]
        );
        res.json({
            success: true,
            message: 'Bank account added',
            data: {
                id: result?.insertId || null,
                company_id: req.employee.company_id,
                bank_name,
                account_holder_name,
                account_number,
                ifsc_code,
                branch_name,
                balance,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT update bank account
router.put('/:id', verifyToken, async (req, res) => {
    try {
        await ensureBankAccountsTable();
        const bank_name = normalizeText(req.body.bank_name);
        const account_holder_name = normalizeText(req.body.account_holder_name);
        const account_number = normalizeText(req.body.account_number);
        const ifsc_code = normalizeIfsc(req.body.ifsc_code);
        const branch_name = normalizeText(req.body.branch_name);
        const balance = normalizeBalance(req.body.balance);

        if (!bank_name || !account_number) {
            return res.status(400).json({ success: false, message: 'Bank Name and Account Number are required' });
        }

        const result = await query(
            'UPDATE bank_accounts SET company_id=COALESCE(company_id, ?), bank_name=?, account_holder_name=?, account_number=?, ifsc_code=?, branch_name=?, balance=?, updated_at=NOW() WHERE id=? AND (company_id=? OR company_id IS NULL)',
            [req.employee.company_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, balance, req.params.id, req.employee.company_id]
        );

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Bank account not found or access denied' });
        }

        res.json({ success: true, message: 'Bank account updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE bank account
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        await ensureBankAccountsTable();
        const result = await query(
            'DELETE FROM bank_accounts WHERE id=? AND (company_id=? OR company_id IS NULL)',
            [req.params.id, req.employee.company_id]
        );

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Bank account not found or access denied' });
        }

        res.json({ success: true, message: 'Bank account deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
