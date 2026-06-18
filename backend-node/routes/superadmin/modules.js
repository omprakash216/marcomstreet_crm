const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');
const {
  ensurePoshSchema,
  logPoshAudit,
  setCompanyPoshAccess,
} = require('../../services/poshService');

const router = express.Router();

function buildBulkInsertStatement(table, columns, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const columnList = columns.join(', ');
  const tupleSql = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
  const params = rows.reduce((acc, row) => acc.concat(row), []);

  return {
    sql: `INSERT IGNORE INTO ${table} (${columnList}) VALUES ${tupleSql}`,
    params,
  };
}

router.get('/', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    await ensurePoshSchema();
    const modules = await query('SELECT * FROM modules ORDER BY name ASC');
    const plans = await query('SELECT id, name FROM subscription_plans ORDER BY price ASC');
    const planModules = await query('SELECT plan_id, module_id FROM plan_modules');
    res.json({ success: true, data: { modules, plans, planModules } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/companies', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    await ensurePoshSchema();
    const rows = await query(
      `SELECT c.id, c.company_name, c.email, c.phone, c.status,
              MAX(CASE WHEN COALESCE(cm.is_enabled,1) = 1 AND (cm.module_key = 'posh' OR m.code = 'posh') THEN 1 ELSE 0 END) AS posh_enabled,
              COUNT(pc.id) AS posh_complaints
       FROM companies c
       LEFT JOIN company_modules cm ON cm.company_id = c.id
       LEFT JOIN modules m ON m.id = cm.module_id
       LEFT JOIN posh_complaints pc ON pc.company_id = c.id AND pc.deleted_at IS NULL
       GROUP BY c.id, c.company_name, c.email, c.phone, c.status
       ORDER BY c.company_name ASC`
    );
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/posh/enable', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const companyId = req.body?.company_id;
    if (!companyId) return res.status(400).json({ success: false, message: 'company_id required' });
    await setCompanyPoshAccess({ companyId, enabled: true, actorId: req.employee.id });
    await logPoshAudit(req, 'company_posh_enabled', companyId, { company_id: companyId });
    res.json({ success: true, message: 'POSH module enabled for company.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/posh/disable', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const companyId = req.body?.company_id;
    if (!companyId) return res.status(400).json({ success: false, message: 'company_id required' });
    await setCompanyPoshAccess({ companyId, enabled: false, actorId: req.employee.id });
    await logPoshAudit(req, 'company_posh_disabled', companyId, { company_id: companyId });
    res.json({ success: true, message: 'POSH module disabled for company.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { name, code, description, status, plan_ids = [] } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: 'name and code required' });

    const result = await query(
      'INSERT INTO modules (name, code, description, status) VALUES (?, ?, ?, ?)',
      [name, code, description || null, status || 'enabled']
    );
    const moduleId = result.insertId;

    if (Array.isArray(plan_ids) && plan_ids.length) {
      const values = plan_ids.map(pid => [pid, moduleId]);
      const statement = buildBulkInsertStatement('plan_modules', ['plan_id', 'module_id'], values);
      if (statement) {
        await query(statement.sql, statement.params);
      }
    }

    res.json({ success: true, message: 'Module created', module_id: moduleId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { name, description, status, plan_ids = [] } = req.body;
    await query('UPDATE modules SET name=?, description=?, status=? WHERE id=?', [
      name,
      description || null,
      status || 'enabled',
      req.params.id,
    ]);

    // reset plan assignments
    await query('DELETE FROM plan_modules WHERE module_id=?', [req.params.id]);
    if (Array.isArray(plan_ids) && plan_ids.length) {
      const values = plan_ids.map(pid => [pid, req.params.id]);
      const statement = buildBulkInsertStatement('plan_modules', ['plan_id', 'module_id'], values);
      if (statement) {
        await query(statement.sql, statement.params);
      }
    }

    res.json({ success: true, message: 'Module updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await query('DELETE FROM plan_modules WHERE module_id=?', [req.params.id]);
    await query('DELETE FROM company_modules WHERE module_id=?', [req.params.id]);
    await query('DELETE FROM modules WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Module deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get modules assigned to a company
router.get('/company/:companyId', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const modules = await query('SELECT * FROM modules ORDER BY name ASC');
    const companyMods = await query('SELECT module_id FROM company_modules WHERE company_id=?', [req.params.companyId]);
    const ids = companyMods.map((m) => m.module_id);
    res.json({ success: true, data: { modules, module_ids: ids } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Assign modules to a company
router.post('/assign-company', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { company_id, module_ids = [] } = req.body;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id required' });
    await query('DELETE FROM company_modules WHERE company_id=?', [company_id]);
    if (Array.isArray(module_ids) && module_ids.length) {
      const values = module_ids.map(mid => [company_id, mid]);
      const statement = buildBulkInsertStatement('company_modules', ['company_id', 'module_id'], values);
      if (statement) {
        await query(statement.sql, statement.params);
      }
    }
    res.json({ success: true, message: 'Modules assigned to company' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
