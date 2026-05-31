const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

router.get('/overview', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const [emp] = await query('SELECT COUNT(*) as c FROM employees');
    const [att] = await query('SELECT COUNT(*) as c FROM employee_checkins WHERE DATE(created_at)=CURDATE()');
    const [pay] = await query('SELECT IFNULL(SUM(net_pay),0) as total FROM payroll_slips');
    const [leaves] = await query('SELECT COUNT(*) as c FROM leaves WHERE status="approved" AND DATE(updated_at)=CURDATE()');
    res.json({
      success: true,
      data: {
        total_employees: emp?.c || 0,
        attendance_today: att?.c || 0,
        payroll_expense: pay?.total || 0,
        leaves_today: leaves?.c || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const simpleCrud = (table, allowedFields) => ({
  list: async (_req, res) => {
    try {
      const rows = await query(`SELECT * FROM ${table} ORDER BY id DESC`);
      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
  save: async (req, res) => {
    try {
      const { id, ...body } = req.body;
      const cols = Object.keys(body).filter(k => allowedFields.includes(k));
      const vals = cols.map(k => body[k]);
      if (id) {
        const setClause = cols.map(c => `${c}=?`).join(', ');
        await query(`UPDATE ${table} SET ${setClause} WHERE id=?`, [...vals, id]);
        return res.json({ success: true, message: 'Updated' });
      }
      const placeholders = cols.map(() => '?').join(', ');
      const result = await query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, vals);
      res.json({ success: true, id: result.insertId });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
  remove: async (req, res) => {
    try {
      await query(`DELETE FROM ${table} WHERE id=?`, [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
});

const leavePolicies = simpleCrud('leave_policies', ['name', 'annual_quota', 'carry_forward']);
router.get('/leave-policies', verifyToken, verifySuperAdmin, leavePolicies.list);
router.post('/leave-policies', verifyToken, verifySuperAdmin, leavePolicies.save);
router.delete('/leave-policies/:id', verifyToken, verifySuperAdmin, leavePolicies.remove);

const attendanceRules = simpleCrud('attendance_rules', ['name', 'check_in_grace_min', 'half_day_after_min']);
router.get('/attendance-rules', verifyToken, verifySuperAdmin, attendanceRules.list);
router.post('/attendance-rules', verifyToken, verifySuperAdmin, attendanceRules.save);
router.delete('/attendance-rules/:id', verifyToken, verifySuperAdmin, attendanceRules.remove);

const shiftTemplates = simpleCrud('shift_templates', ['name', 'start_time', 'end_time']);
router.get('/shift-templates', verifyToken, verifySuperAdmin, shiftTemplates.list);
router.post('/shift-templates', verifyToken, verifySuperAdmin, shiftTemplates.save);
router.delete('/shift-templates/:id', verifyToken, verifySuperAdmin, shiftTemplates.remove);

const payrollTemplates = simpleCrud('payroll_templates', ['name', 'base_pay']);
router.get('/payroll-templates', verifyToken, verifySuperAdmin, payrollTemplates.list);
router.post('/payroll-templates', verifyToken, verifySuperAdmin, payrollTemplates.save);
router.delete('/payroll-templates/:id', verifyToken, verifySuperAdmin, payrollTemplates.remove);

module.exports = router;
