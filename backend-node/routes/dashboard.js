const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const employeeId = req.employee.id;
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);

    const leadCounts = await query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
              SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_count,
              SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won_count,
              SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost_count
       FROM leads WHERE 1=1`
    );
    const leads = leadCounts[0] || { total: 0, new_count: 0, contacted_count: 0, won_count: 0, lost_count: 0 };

    const taskCount = await query(
      'SELECT COUNT(*) as count FROM tasks WHERE employee_id = ? AND status != ?',
      [employeeId, 'completed']
    );
    const meetingCount = await query(
      'SELECT COUNT(*) as count FROM meetings WHERE employee_id = ? AND DATE(meeting_date) >= ?',
      [employeeId, today]
    );

    return res.json({
      success: true,
      data: {
        leads: {
          total: Number(leads.total) || 0,
          new: Number(leads.new_count) || 0,
          contacted: Number(leads.contacted_count) || 0,
          won: Number(leads.won_count) || 0,
          lost: Number(leads.lost_count) || 0,
        },
        pending_tasks: Number(taskCount[0]?.count) || 0,
        upcoming_meetings: Number(meetingCount[0]?.count) || 0,
      },
    });
  } catch (err) {
    console.error('Dashboard:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
