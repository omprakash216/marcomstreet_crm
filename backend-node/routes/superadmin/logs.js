const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

// Get all audit logs
router.get('/', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const rows = await query(`
            SELECT a.*, c.company_name, e.name as user_name 
            FROM audit_logs a
            LEFT JOIN companies c ON a.company_id = c.id
            LEFT JOIN employees e ON a.user_id = e.id
            ORDER BY a.created_at DESC
            LIMIT 500
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
