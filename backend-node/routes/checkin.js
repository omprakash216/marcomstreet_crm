const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLog');
const {
  getTodaySummary,
  clockIn,
  startBreak,
  endBreak,
  clockOut,
  getAttendanceHistory,
} = require('../services/workTimer');

const router = express.Router();

function getErrorMessage(err, fallback) {
  const message = String(err?.message || fallback || 'Request failed');
  if (message.includes("doesn't exist") || message.includes('Unknown column')) {
    return 'Attendance schema is outdated. Run: node backend-node/scripts/ensure-demo-schema.js';
  }
  return message;
}

async function sendTodaySummary(req, res) {
  const data = await getTodaySummary(req.employee.id);
  return res.json({ success: true, data });
}

function buildSafeTodaySummary() {
  return {
    checked_in: false,
    checked_out: false,
    on_break: false,
    attendance: null,
    goal_seconds: 28800,
    goal_time: '08:00:00',
  };
}

router.get('/status', verifyToken, async (req, res) => {
  try {
    return await sendTodaySummary(req, res);
  } catch (err) {
    const msg = getErrorMessage(err, 'Failed to load attendance status');
    if (msg.includes('schema is outdated')) {
      return res.json({
        success: true,
        data: buildSafeTodaySummary(),
      });
    }
    return res.status(500).json({ success: false, message: msg });
  }
});

router.get('/today', verifyToken, async (req, res) => {
  try {
    return await sendTodaySummary(req, res);
  } catch (err) {
    const msg = getErrorMessage(err, 'Failed to load today summary');
    console.error('[Attendance] /today failed:', err?.message || err);
    return res.json({
      success: true,
      degraded: true,
      message: msg,
      data: buildSafeTodaySummary(),
    });
  }
});

router.get('/history', verifyToken, async (req, res) => {
  try {
    const data = await getAttendanceHistory(req.employee, req.query || {});
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: getErrorMessage(err, 'Failed to load attendance history') });
  }
});

router.post('/clock-in', verifyToken, async (req, res) => {
  try {
    const attendance = await clockIn(req.employee, req.body || {});
    await logActivity(req.employee.id, 'attendance_clock_in', 'employee_checkins', attendance.id, 'Employee clocked in', req);
    return res.json({ success: true, message: 'Clock in recorded successfully.', data: attendance });
  } catch (err) {
    return res.status(400).json({ success: false, message: getErrorMessage(err, 'Clock in failed') });
  }
});

router.post('/start-break', verifyToken, async (req, res) => {
  try {
    const attendance = await startBreak(req.employee.id);
    await logActivity(req.employee.id, 'attendance_break_start', 'employee_checkins', attendance.id, 'Employee started a break', req);
    return res.json({ success: true, message: 'Break started.', data: attendance });
  } catch (err) {
    return res.status(400).json({ success: false, message: getErrorMessage(err, 'Break start failed') });
  }
});

router.post('/end-break', verifyToken, async (req, res) => {
  try {
    const attendance = await endBreak(req.employee.id);
    await logActivity(req.employee.id, 'attendance_break_end', 'employee_checkins', attendance.id, 'Employee resumed work', req);
    return res.json({ success: true, message: 'Break ended.', data: attendance });
  } catch (err) {
    return res.status(400).json({ success: false, message: getErrorMessage(err, 'Break resume failed') });
  }
});

router.post('/clock-out', verifyToken, async (req, res) => {
  try {
    const attendance = await clockOut(req.employee.id, req.body || {});
    await logActivity(req.employee.id, 'attendance_clock_out', 'employee_checkins', attendance.id, 'Employee clocked out', req);
    return res.json({ success: true, message: 'Clock out recorded successfully.', data: attendance });
  } catch (err) {
    return res.status(400).json({ success: false, message: getErrorMessage(err, 'Clock out failed') });
  }
});

// Backward-compatible legacy endpoint used by existing UI.
router.post('/checkin', verifyToken, async (req, res) => {
  const action = String(req.body?.action || 'check_in').toLowerCase();
  try {
    if (action === 'check_out' || action === 'clock_out') {
      const attendance = await clockOut(req.employee.id, req.body || {});
      await logActivity(req.employee.id, 'attendance_clock_out', 'employee_checkins', attendance.id, 'Employee clocked out', req);
      return res.json({ success: true, message: 'Checked out. Attendance complete.', data: attendance });
    }
    const attendance = await clockIn(req.employee, req.body || {});
    await logActivity(req.employee.id, 'attendance_clock_in', 'employee_checkins', attendance.id, 'Employee checked in', req);
    return res.json({ success: true, message: 'Checked in successfully.', data: attendance });
  } catch (err) {
    return res.status(400).json({ success: false, message: getErrorMessage(err, 'Attendance update failed') });
  }
});

module.exports = router;
