const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

// Get all subscription plans
router.get('/', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const rows = await query('SELECT * FROM subscription_plans ORDER BY price ASC');
        rows.forEach(r => {
            try { r.modules_included = typeof r.modules_included === 'string' ? JSON.parse(r.modules_included) : r.modules_included; } catch(e) {}
        });
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create/Update a new plan
router.post('/', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { id, name, price, billing_cycle, user_limit, storage_limit_gb, modules_included } = req.body;
        const modulesJson = JSON.stringify(modules_included || []);

        if (id) {
            await query(
                `UPDATE subscription_plans SET name=?, price=?, billing_cycle=?, user_limit=?, storage_limit_gb=?, modules_included=? WHERE id=?`,
                [name, price, billing_cycle, user_limit, storage_limit_gb, modulesJson, id]
            );
            return res.json({ success: true, message: 'Plan updated' });
        } else {
            const result = await query(
                `INSERT INTO subscription_plans (name, price, billing_cycle, user_limit, storage_limit_gb, modules_included) VALUES (?, ?, ?, ?, ?, ?)`,
                [name, price, billing_cycle || 'monthly', user_limit || 10, storage_limit_gb || 5, modulesJson]
            );
            return res.json({ success: true, message: 'Plan created', plan_id: result.insertId });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// List company subscriptions
router.get('/list', verifyToken, verifySuperAdmin, async (_req, res) => {
    try {
        const rows = await query(`
            SELECT s.*, c.company_name, sp.name as plan_name
            FROM subscriptions s
            LEFT JOIN companies c ON c.id = s.company_id
            LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
            ORDER BY s.created_at DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Company-wise current plan + assigned modules report
router.get('/assignment-report', verifyToken, verifySuperAdmin, async (_req, res) => {
    try {
        const rows = await query(`
            SELECT
                c.id AS company_id,
                c.company_name,
                c.domain,
                c.email,
                c.subscription_status AS company_status,
                c.subscription_plan_id AS company_plan_id,
                s.id AS subscription_id,
                s.plan_id AS subscription_plan_id,
                s.billing_cycle AS subscription_billing_cycle,
                s.status AS subscription_status,
                s.trial_end,
                s.created_at AS subscription_created_at,
                sp.id AS plan_id,
                sp.name AS plan_name,
                sp.price AS plan_price,
                sp.billing_cycle AS plan_billing_cycle,
                sp.modules_included
            FROM companies c
            LEFT JOIN (
                SELECT s1.*
                FROM subscriptions s1
                INNER JOIN (
                    SELECT company_id, MAX(id) AS id
                    FROM subscriptions
                    GROUP BY company_id
                ) latest ON latest.id = s1.id
            ) s ON s.company_id = c.id
            LEFT JOIN subscription_plans sp ON sp.id = COALESCE(s.plan_id, c.subscription_plan_id)
            ORDER BY c.company_name ASC
        `);

        let companyModules = [];
        let planModules = [];
        try {
            companyModules = await query(`
                SELECT cm.company_id, m.id, m.name, m.code
                FROM company_modules cm
                INNER JOIN modules m ON m.id = cm.module_id
                ORDER BY m.name ASC
            `);
        } catch (e) {
            companyModules = [];
        }
        try {
            planModules = await query(`
                SELECT pm.plan_id, m.id, m.name, m.code
                FROM plan_modules pm
                INNER JOIN modules m ON m.id = pm.module_id
                ORDER BY m.name ASC
            `);
        } catch (e) {
            planModules = [];
        }

        const companyModuleMap = companyModules.reduce((map, item) => {
            if (!map[item.company_id]) map[item.company_id] = [];
            map[item.company_id].push({ id: item.id, name: item.name, code: item.code });
            return map;
        }, {});
        const planModuleMap = planModules.reduce((map, item) => {
            if (!map[item.plan_id]) map[item.plan_id] = [];
            map[item.plan_id].push({ id: item.id, name: item.name, code: item.code });
            return map;
        }, {});

        const data = rows.map((row) => {
            const companyAssignedModules = companyModuleMap[row.company_id] || [];
            let planAssignedModules = planModuleMap[row.plan_id] || [];
            if (!planAssignedModules.length && row.modules_included) {
                try {
                    const included = typeof row.modules_included === 'string'
                        ? JSON.parse(row.modules_included)
                        : row.modules_included;
                    if (Array.isArray(included)) {
                        planAssignedModules = included.map((item) => ({
                            id: null,
                            name: String(item || ''),
                            code: String(item || '').toLowerCase().replace(/[\s-]+/g, '_'),
                        })).filter((item) => item.name);
                    }
                } catch (e) {
                    planAssignedModules = [];
                }
            }

            const modules = companyAssignedModules.length ? companyAssignedModules : planAssignedModules;
            return {
                company_id: row.company_id,
                company_name: row.company_name,
                domain: row.domain,
                email: row.email,
                company_status: row.company_status,
                subscription_id: row.subscription_id,
                plan_id: row.plan_id,
                plan_name: row.plan_name || 'No plan assigned',
                plan_price: row.plan_price,
                billing_cycle: row.subscription_billing_cycle || row.plan_billing_cycle || 'monthly',
                subscription_status: row.subscription_status || row.company_status || 'not_assigned',
                trial_end: row.trial_end,
                modules,
                company_modules: companyAssignedModules,
                plan_modules: planAssignedModules,
                module_source: companyAssignedModules.length ? 'company' : planAssignedModules.length ? 'plan' : 'none',
                subscription_created_at: row.subscription_created_at,
            };
        });

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Assign or update subscription for a company
router.post('/assign', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { company_id, plan_id, billing_cycle = 'monthly', status = 'active', trial_end = null } = req.body;
        if (!company_id || !plan_id) return res.status(400).json({ success: false, message: 'company_id and plan_id required' });
        const [existing] = await query('SELECT id FROM subscriptions WHERE company_id=? ORDER BY created_at DESC LIMIT 1', [company_id]);
        if (existing) {
            await query('UPDATE subscriptions SET plan_id=?, billing_cycle=?, status=?, trial_end=? WHERE id=?', [
                plan_id, billing_cycle, status, trial_end, existing.id,
            ]);
            await query(
                'UPDATE companies SET subscription_plan_id=?, subscription_status=? WHERE id=?',
                [plan_id, status, company_id]
            ).catch(() => {});
            return res.json({ success: true, message: 'Subscription updated', subscription_id: existing.id });
        }
        const result = await query(
            'INSERT INTO subscriptions (company_id, plan_id, billing_cycle, status, trial_end) VALUES (?,?,?,?,?)',
            [company_id, plan_id, billing_cycle, status, trial_end]
        );
        await query(
            'UPDATE companies SET subscription_plan_id=?, subscription_status=? WHERE id=?',
            [plan_id, status, company_id]
        ).catch(() => {});
        res.json({ success: true, message: 'Subscription created', subscription_id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Simple invoices list (return empty on any backend error to avoid UI break)
router.get('/invoices', verifyToken, verifySuperAdmin, async (_req, res) => {
    try {
        const rows = await query(`
            SELECT i.*, c.company_name, sp.name as plan_name
            FROM invoices i
            LEFT JOIN subscriptions s ON s.id = i.subscription_id
            LEFT JOIN companies c ON c.id = s.company_id
            LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
            ORDER BY i.issued_at DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.warn('[SuperAdmin] invoices fetch failed:', err.message);
        return res.json({ success: true, data: [], message: 'Invoices unavailable' });
    }
});

// Subscription Requests
router.get('/requests', verifyToken, verifySuperAdmin, async (_req, res) => {
    try {
        const rows = await query(`
            SELECT sr.*, sp.name as plan_name 
            FROM subscription_requests sr
            LEFT JOIN subscription_plans sp ON sp.id = sr.selected_plan
            ORDER BY sr.created_at DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.patch('/requests/:id', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { approval_status } = req.body;
        await query('UPDATE subscription_requests SET approval_status=? WHERE id=?', [approval_status, req.params.id]);
        
        if (approval_status === 'approved') {
            const reqData = await query('SELECT * FROM subscription_requests WHERE id=?', [req.params.id]);
            const r = reqData[0];
            if (r) {
                // Here we would automatically create company and admin, but for now we just update status
                // since the actual company creation API is quite complex.
            }
        }
        res.json({ success: true, message: 'Status updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
