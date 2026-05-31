const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();

async function audit(companyId, actorId, action) {
    try {
        await query(
            'INSERT INTO audit_logs (company_id, user_id, module, action) VALUES (?, ?, ?, ?)',
            [companyId || null, actorId || null, 'SuperAdmin', action]
        );
    } catch (e) { }
}

async function ensureEmployeeModuleAccessTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS employee_module_access (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NULL,
            employee_id INT NOT NULL,
            module_key VARCHAR(80) NOT NULL,
            allowed TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_employee_module (employee_id, module_key),
            INDEX idx_employee (employee_id),
            INDEX idx_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

async function getEmployeeAccessMap(employeeIds = []) {
    const ids = employeeIds.map(Number).filter(Boolean);
    if (!ids.length) return {};
    try {
        await ensureEmployeeModuleAccessTable();
        const rows = await query(
            `SELECT employee_id, module_key
             FROM employee_module_access
             WHERE allowed = 1 AND employee_id IN (${ids.map(() => '?').join(',')})
             ORDER BY module_key ASC`,
            ids
        );
        return rows.reduce((map, row) => {
            if (!map[row.employee_id]) map[row.employee_id] = [];
            map[row.employee_id].push(row.module_key);
            return map;
        }, {});
    } catch (e) {
        return {};
    }
}

async function setEmployeeAccessModules({ employeeId, companyId, modules }) {
    await ensureEmployeeModuleAccessTable();
    const normalized = Array.isArray(modules)
        ? Array.from(new Set(modules.map((m) => String(m || '').trim()).filter(Boolean)))
        : [];

    await query('DELETE FROM employee_module_access WHERE employee_id = ?', [employeeId]);
    for (const moduleKey of normalized) {
        await query(
            'INSERT INTO employee_module_access (company_id, employee_id, module_key, allowed) VALUES (?,?,?,1)',
            [companyId || null, employeeId, moduleKey]
        );
    }
}

// Get all users globally
router.get('/', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const rows = await query(`
            SELECT e.id, e.name, e.email, e.phone, e.role, e.status, e.company_id, c.company_name 
            FROM employees e 
            LEFT JOIN companies c ON e.company_id = c.id
            ORDER BY e.created_at DESC
        `);
        const accessMap = await getEmployeeAccessMap(rows.map((row) => row.id));
        rows.forEach((row) => {
            row.access_modules = accessMap[row.id] || [];
            row.module_restricted = row.access_modules.length > 0;
        });
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get single user details
router.get('/:id', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const rows = await query(
            `SELECT e.id, e.name, e.email, e.phone, e.role, e.status, e.company_id, c.company_name
             FROM employees e
             LEFT JOIN companies c ON e.company_id = c.id
             WHERE e.id = ?
             LIMIT 1`,
            [req.params.id]
        );
        const user = rows?.[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const accessMap = await getEmployeeAccessMap([user.id]);
        user.access_modules = accessMap[user.id] || [];
        user.module_restricted = user.access_modules.length > 0;
        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create Global User
router.post('/', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { name, email, password, role, company_id, access_modules = [] } = req.body;
        
        if (!email || !password || !name) {
             return res.status(400).json({ success: false, message: 'Name, email, and password required' });
        }

        const hash = await bcrypt.hash(password, 10);
        
        const result = await query(
            `INSERT INTO employees (employee_code, name, email, password, role, company_id, status) VALUES (?, ?, ?, ?, ?, ?, 'active')`,
            ['EMP' + Date.now(), name, email, hash, role || 'employee', company_id || null]
        );

        if (Array.isArray(access_modules)) {
            await setEmployeeAccessModules({
                employeeId: result.insertId,
                companyId: company_id || null,
                modules: access_modules,
            });
        }

        audit(company_id, req.employee.id, `Created user ${email}`);
        res.json({ success: true, message: 'User created' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Email already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update User (Role/Status)
router.patch('/:id', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { role, status, company_id, name, email, phone, access_modules } = req.body;
        
        const updates = [];
        const params = [];
        if (name !== undefined) { updates.push('name = ?'); params.push(name || null); }
        if (email !== undefined) { updates.push('email = ?'); params.push(email || null); }
        if (phone !== undefined) { updates.push('phone = ?'); params.push(phone || null); }
        if (role) { updates.push('role = ?'); params.push(role); }
        if (status) { updates.push('status = ?'); params.push(status); }
        if (company_id !== undefined) { updates.push('company_id = ?'); params.push(company_id || null); }

        if (updates.length > 0) {
             params.push(req.params.id);
             await query(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        if (Array.isArray(access_modules)) {
            const [existing] = await query('SELECT company_id FROM employees WHERE id=? LIMIT 1', [req.params.id]);
            await setEmployeeAccessModules({
                employeeId: req.params.id,
                companyId: company_id !== undefined ? company_id : existing?.company_id,
                modules: access_modules,
            });
        }

        audit(company_id, req.employee.id, `Updated user ${req.params.id}`);
        res.json({ success: true, message: 'User updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
});

// Block / Unblock
router.patch('/:id/block', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        await query("UPDATE employees SET status='blocked' WHERE id=?", [req.params.id]);
        audit(null, req.employee.id, `Blocked user ${req.params.id}`);
        res.json({ success: true, message: 'User blocked' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.patch('/:id/unblock', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        await query("UPDATE employees SET status='active' WHERE id=?", [req.params.id]);
        audit(null, req.employee.id, `Unblocked user ${req.params.id}`);
        res.json({ success: true, message: 'User unblocked' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Reset password
router.post('/:id/reset-password', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { password } = req.body || {};
        if (!password || String(password).length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 chars' });
        }
        const hash = await bcrypt.hash(String(password), 10);
        await query('UPDATE employees SET password=? WHERE id=?', [hash, req.params.id]);
        audit(null, req.employee.id, `Reset password for user ${req.params.id}`);
        res.json({ success: true, message: 'Password reset' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/:id/access', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const [user] = await query('SELECT id, company_id FROM employees WHERE id=? LIMIT 1', [req.params.id]);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const accessMap = await getEmployeeAccessMap([user.id]);
        res.json({ success: true, data: { access_modules: accessMap[user.id] || [] } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/:id/access', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const [user] = await query('SELECT id, company_id FROM employees WHERE id=? LIMIT 1', [req.params.id]);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const modules = Array.isArray(req.body?.access_modules) ? req.body.access_modules : [];
        await setEmployeeAccessModules({ employeeId: user.id, companyId: user.company_id, modules });
        audit(user.company_id, req.employee.id, `Updated access modules for user ${user.id}`);
        res.json({ success: true, message: 'Access modules updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete user (safe soft-delete to avoid FK issues)
router.delete('/:id', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        if (!targetId) return res.status(400).json({ success: false, message: 'Invalid id' });
        if (req.employee?.id === targetId) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
        }

        const rows = await query('SELECT id, email, role, company_id FROM employees WHERE id=? LIMIT 1', [targetId]);
        const user = rows?.[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const r = String(user.role || '').toLowerCase();
        if (r === 'superadmin' || r === 'super_admin') {
            return res.status(400).json({ success: false, message: 'Cannot delete Super Admin user' });
        }

        // Make email unique to avoid unique constraints during soft-delete
        await query(
            `UPDATE employees
             SET status='deleted',
                 email = CONCAT(COALESCE(email,'user'), '#deleted#', id, '#', UNIX_TIMESTAMP())
             WHERE id=?`,
            [targetId]
        );
        audit(user.company_id, req.employee.id, `Deleted user ${targetId}`);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
