const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// GET all bank accounts
router.get('/', verifyToken, async (req, res) => {
    try {
        const rows = await query('SELECT * FROM bank_accounts ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST new bank account
router.post('/', verifyToken, async (req, res) => {
    try {
        const { bank_name, account_holder_name, account_number, ifsc_code, branch_name, balance } = req.body;
        if (!bank_name || !account_number) return res.status(400).json({ success: false, message: 'Bank Name and Account Number are required' });

        await query(
            'INSERT INTO bank_accounts (bank_name, account_holder_name, account_number, ifsc_code, branch_name, balance) VALUES (?, ?, ?, ?, ?, ?)',
            [bank_name, account_holder_name, account_number, ifsc_code, branch_name, balance || 0.00]
        );
        res.json({ success: true, message: 'Bank account added' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT update bank account
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { bank_name, account_holder_name, account_number, ifsc_code, branch_name, balance } = req.body;
        await query(
            'UPDATE bank_accounts SET bank_name=?, account_holder_name=?, account_number=?, ifsc_code=?, branch_name=?, balance=?, updated_at=NOW() WHERE id=?',
            [bank_name, account_holder_name, account_number, ifsc_code, branch_name, balance, req.params.id]
        );
        res.json({ success: true, message: 'Bank account updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE bank account
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        await query('DELETE FROM bank_accounts WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'Bank account deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
