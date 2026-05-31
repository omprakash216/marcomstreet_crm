const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const eid = req.employee.id;
    const [tasks] = await query('SELECT COUNT(*) as c FROM tasks WHERE employee_id = ? AND company_id = ? AND status != ? AND company_id = ?', [eid, 'completed', req.employee.company_id]);
    const [projects] = await query('SELECT COUNT(*) as c FROM tasks WHERE employee_id = ? AND company_id = ?', [eid, req.employee.company_id]);
    return res.json({
      success: true,
      data: {
        pending_tasks: Number(tasks?.c) || 0,
        total_projects: Number(projects?.c) || 0,
        recent_tasks: await query('SELECT * FROM tasks WHERE employee_id = ? AND company_id = ? ORDER BY due_date ASC LIMIT 10', [eid, req.employee.company_id]).catch(() => []),
      },
    });
  } catch (err) {
    return res.json({ success: true, data: { pending_tasks: 0, total_projects: 0, recent_tasks: [] } });
  }
});

module.exports = router;
