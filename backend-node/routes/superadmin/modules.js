const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const modules = await query('SELECT * FROM modules ORDER BY name ASC');
    const plans = await query('SELECT id, name FROM subscription_plans ORDER BY price ASC');
    const planModules = await query('SELECT plan_id, module_id FROM plan_modules');
    res.json({ success: true, data: { modules, plans, planModules } });
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
      await query('INSERT IGNORE INTO plan_modules (plan_id, module_id) VALUES ?', [values]);
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
      await query('INSERT IGNORE INTO plan_modules (plan_id, module_id) VALUES ?', [values]);
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
      await query('INSERT IGNORE INTO company_modules (company_id, module_id) VALUES ?', [values]);
    }
    res.json({ success: true, message: 'Modules assigned to company' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
