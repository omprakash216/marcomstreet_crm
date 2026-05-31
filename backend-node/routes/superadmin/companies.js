const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const bcrypt = require('bcryptjs');
const router = express.Router();

// Get all companies with their subscription plans
router.get('/', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        let rows;
        try {
            // Try with subscription_plans JOIN first
            rows = await query(`
                SELECT c.*, sp.name as plan_name, sp.modules_included, cu.total_users, cu.total_leads, cu.total_deals,
                       cu.total_employees, cu.storage_mb, cu.api_requests, cu.last_activity
                FROM companies c
                LEFT JOIN subscription_plans sp ON c.subscription_plan_id = sp.id
                LEFT JOIN company_usage cu ON cu.company_id = c.id
                ORDER BY c.created_at DESC
            `);
        } catch (joinErr) {
            // Fallback: subscription_plans table may not exist yet
            console.warn('[SuperAdmin] subscription_plans join failed, fetching companies only:', joinErr.message);
            rows = await query('SELECT * FROM companies ORDER BY created_at DESC');
        }

        // Get user count per company (non-fatal if it fails)
        let userMap = {};
        try {
            const usersCount = await query('SELECT company_id, COUNT(*) as c FROM employees GROUP BY company_id');
            usersCount.forEach(u => { userMap[u.company_id] = Number(u.c); });
        } catch (uErr) {
            console.warn('[SuperAdmin] Could not fetch user counts:', uErr.message);
        }

        rows.forEach(r => {
            r.total_users = userMap[r.id] || 0;
            try {
                r.modules_included = typeof r.modules_included === 'string'
                    ? JSON.parse(r.modules_included)
                    : r.modules_included;
            } catch(e) {}
        });

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[SuperAdmin] GET /companies error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create a new company
router.post('/', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { company_name, email, phone, address, subscription_plan_id, domain, password, admin_name } = req.body;
        
        if (!company_name) return res.status(400).json({ success: false, message: 'Company name is required' });
        if (!email) return res.status(400).json({ success: false, message: 'Primary email is required' });

        const loginPassword = password || 'password123';
        const adminName = String(admin_name || company_name || '').trim();
        const hashedPassword = await bcrypt.hash(loginPassword, 10).catch(() => loginPassword);

        const result = await query(
            `INSERT INTO companies (company_name, email, phone, password, address, subscription_plan_id, domain, subscription_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
            [company_name, email, phone || null, hashedPassword, address || null, subscription_plan_id || null, domain || null]
        );

        const companyId = result.insertId;

        // Auto create corresponding admin employee
        try {
            const employeeCode = 'COM' + companyId + '-' + Math.floor(Math.random() * 10000);
            await query(
                'INSERT INTO employees (employee_code, name, email, password, role, status, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [employeeCode, adminName || company_name, email, hashedPassword, 'admin', 'active', companyId]
            );
        } catch (empErr) {
            console.error('[SuperAdmin] Failed to create admin employee:', empErr);
        }

        res.json({ success: true, message: 'Company created successfully', company_id: companyId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Email or Domain already in use' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update company status (suspend, activate)
router.patch('/:id/status', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['active', 'suspended', 'expired', 'trial'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        await query('UPDATE companies SET subscription_status = ? WHERE id = ?', [status, req.params.id]);
        
        // Log action
        await query('INSERT INTO audit_logs (company_id, user_id, module, action) VALUES (?, ?, ?, ?)', 
            [req.params.id, req.employee.id, 'SuperAdmin', `Changed company status to ${status}`]);

        res.json({ success: true, message: 'Company status updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update company plan
router.patch('/:id/plan', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { subscription_plan_id } = req.body;
        await query('UPDATE companies SET subscription_plan_id=? WHERE id=?', [subscription_plan_id || null, req.params.id]);
        res.json({ success: true, message: 'Company plan updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update company details
router.put('/:id', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const { company_name, email, phone, address, subscription_plan_id, domain } = req.body || {};

        if (!company_name) {
            return res.status(400).json({ success: false, message: 'Company name is required' });
        }

        const params = [
            company_name,
            domain || null,
            email || null,
            phone || null,
            address || null,
            subscription_plan_id || null,
            id,
        ];

        try {
            await query(
                'UPDATE companies SET company_name=?, domain=?, email=?, phone=?, address=?, subscription_plan_id=? WHERE id=?',
                params
            );
        } catch (updateErr) {
            // Some older schemas may not have `address` column
            if (updateErr && (updateErr.code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(updateErr.message || ''))) {
                await query(
                    'UPDATE companies SET company_name=?, domain=?, email=?, phone=?, subscription_plan_id=? WHERE id=?',
                    [company_name, domain || null, email || null, phone || null, subscription_plan_id || null, id]
                );
            } else {
                throw updateErr;
            }
        }

        // Sync corresponding employee credentials
        if (email || company_name) {
            const empUpdates = [];
            const empValues = [];
            if (email) { empUpdates.push('email=?'); empValues.push(email); }
            if (company_name) { empUpdates.push('name=?'); empValues.push(company_name); }
            if (empUpdates.length > 0) {
                empValues.push(id);
                await query(`UPDATE employees SET ${empUpdates.join(', ')} WHERE company_id = ?`, empValues);
            }
        }

        // Optional audit log (non-fatal if table missing)
        try {
            await query(
                'INSERT INTO audit_logs (company_id, user_id, module, action) VALUES (?, ?, ?, ?)',
                [id, req.employee.id, 'SuperAdmin', 'Updated company details']
            );
        } catch (logErr) {
            console.warn('[SuperAdmin] audit_logs insert failed:', logErr.message);
        }

        res.json({ success: true, message: 'Company updated successfully' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Domain or email already in use' });
        }
        console.error('[SuperAdmin] PUT /companies/:id error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Reset company admin password
router.post('/:id/reset-password', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { password } = req.body || {};
        if (!password || String(password).length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }
        const companyId = req.params.id;

        const hashedPassword = await bcrypt.hash(String(password), 10);

        // Update company password
        await query('UPDATE companies SET password=? WHERE id=?', [hashedPassword, companyId]);

        // Update employee table password for role 'admin' of this company
        await query('UPDATE employees SET password=? WHERE company_id=? AND role=?', [hashedPassword, companyId, 'admin']);

        // Audit log
        try {
            await query('INSERT INTO audit_logs (company_id, user_id, module, action) VALUES (?, ?, ?, ?)',
                [companyId, req.employee.id, 'SuperAdmin', 'Reset password for company admin']);
        } catch (logErr) {
            console.warn('[SuperAdmin] audit_logs insert failed:', logErr.message);
        }

        res.json({ success: true, message: 'Company password updated successfully' });
    } catch (err) {
        console.error('[SuperAdmin] POST /companies/:id/reset-password error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete company
router.delete('/:id', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        await query('DELETE FROM employees WHERE company_id = ?', [req.params.id]);
        await query('DELETE FROM companies WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'Company deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
