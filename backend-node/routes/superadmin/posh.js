const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');
const {
  ensurePoshSchema,
  logPoshAudit,
  safeJsonParse,
  setCompanyPoshAccess,
} = require('../../services/poshService');

const router = express.Router();
router.use(verifyToken, verifySuperAdmin);

router.get('/reports', async (req, res) => {
  try {
    await ensurePoshSchema();
    const params = [];
    let where = 'WHERE pc.deleted_at IS NULL';
    if (req.query.company_id) {
      where += ' AND pc.company_id = ?';
      params.push(req.query.company_id);
    }
    if (req.query.status) {
      where += ' AND pc.status = ?';
      params.push(req.query.status);
    }
    if (req.query.severity) {
      where += ' AND pc.severity_level = ?';
      params.push(req.query.severity);
    }
    if (req.query.from) {
      where += ' AND DATE(pc.created_at) >= ?';
      params.push(req.query.from);
    }
    if (req.query.to) {
      where += ' AND DATE(pc.created_at) <= ?';
      params.push(req.query.to);
    }

    const summary = await query(
      `SELECT
         COUNT(*) AS total_complaints,
         SUM(CASE WHEN pc.status NOT IN ('Resolved','Closed','Rejected') THEN 1 ELSE 0 END) AS pending_cases,
         SUM(CASE WHEN pc.severity_level = 'Critical' AND pc.status NOT IN ('Resolved','Closed','Rejected') THEN 1 ELSE 0 END) AS critical_pending,
         SUM(CASE WHEN pc.status IN ('Resolved','Closed') THEN 1 ELSE 0 END) AS resolved_cases
       FROM posh_complaints pc ${where}`,
      params
    );
    const companyWise = await query(
      `SELECT c.id AS company_id, c.company_name, COUNT(pc.id) AS complaints_count,
              SUM(CASE WHEN pc.severity_level = 'Critical' AND pc.status NOT IN ('Resolved','Closed','Rejected') THEN 1 ELSE 0 END) AS critical_pending
       FROM companies c
       LEFT JOIN posh_complaints pc ON pc.company_id = c.id AND pc.deleted_at IS NULL
       GROUP BY c.id, c.company_name
       ORDER BY complaints_count DESC`,
      []
    );
    const enabledCompanies = await query(
      `SELECT c.id, c.company_name, c.email, c.status
       FROM companies c
       JOIN company_modules cm ON cm.company_id = c.id
       LEFT JOIN modules m ON m.id = cm.module_id
       WHERE COALESCE(cm.is_enabled,1) = 1 AND (cm.module_key = 'posh' OR m.code = 'posh')
       GROUP BY c.id, c.company_name, c.email, c.status
       ORDER BY c.company_name ASC`
    );
    const statusWise = await query(
      `SELECT pc.status, COUNT(*) AS count FROM posh_complaints pc ${where} GROUP BY pc.status`,
      params
    );
    res.json({
      success: true,
      data: {
        summary: summary[0] || {},
        enabledCompanies,
        companyWise,
        statusWise,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    await ensurePoshSchema();
    const params = [];
    let where = 'WHERE 1=1';
    if (req.query.company_id) {
      where += ' AND pal.company_id = ?';
      params.push(req.query.company_id);
    }
    if (req.query.action) {
      where += ' AND pal.action = ?';
      params.push(req.query.action);
    }
    const rows = await query(
      `SELECT pal.*, c.company_name, e.name AS user_name
       FROM posh_audit_logs pal
       LEFT JOIN companies c ON c.id = pal.company_id
       LEFT JOIN employees e ON e.id = pal.user_id
       ${where}
       ORDER BY pal.created_at DESC LIMIT 500`,
      params
    );
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/settings', async (req, res) => {
  try {
    await ensurePoshSchema();
    const params = [];
    let where = 'WHERE company_id IS NULL';
    if (req.query.company_id) {
      where = 'WHERE company_id = ?';
      params.push(req.query.company_id);
    }
    const rows = await query(`SELECT * FROM posh_settings ${where} ORDER BY setting_key ASC`, params);
    const settings = {};
    for (const row of rows || []) settings[row.setting_key] = safeJsonParse(row.setting_value, row.setting_value);
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    await ensurePoshSchema();
    const companyId = req.body?.company_id || null;
    const settings = req.body?.settings || req.body || {};
    for (const [key, value] of Object.entries(settings)) {
      if (key === 'company_id' || key === 'settings') continue;
      await query(
        `INSERT INTO posh_settings (company_id, setting_key, setting_value, updated_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [companyId, key, typeof value === 'string' ? value : JSON.stringify(value), req.employee.id]
      );
    }
    await logPoshAudit(req, 'settings_changed', 'global-settings', { company_id: companyId });
    res.json({ success: true, message: 'POSH settings saved.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/companies/:companyId/enable', async (req, res) => {
  try {
    await setCompanyPoshAccess({ companyId: req.params.companyId, enabled: true, actorId: req.employee.id });
    await logPoshAudit(req, 'company_posh_enabled', req.params.companyId, { company_id: req.params.companyId });
    res.json({ success: true, message: 'POSH module enabled for company.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/companies/:companyId/disable', async (req, res) => {
  try {
    await setCompanyPoshAccess({ companyId: req.params.companyId, enabled: false, actorId: req.employee.id });
    await logPoshAudit(req, 'company_posh_disabled', req.params.companyId, { company_id: req.params.companyId });
    res.json({ success: true, message: 'POSH module disabled for company.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
