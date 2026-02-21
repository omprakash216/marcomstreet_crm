const express = require('express');
const { query, getConnection } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/activityLog');
const attendanceRules = require('../services/attendanceRules');

const router = express.Router();

/** Get first and last date of month for a given date string YYYY-MM-DD */
function getMonthBounds(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { first, last };
}

router.get('/status', verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await query(
      'SELECT * FROM employee_checkins WHERE employee_id = ? AND date = ? ORDER BY id DESC LIMIT 1',
      [req.employee.id, today]
    );
    const checkin = rows[0] || null;
    const checkedIn = checkin && (checkin.status === 'checked_in' || checkin.status === 'completed');
    const checkedOut = checkin && (checkin.status === 'checked_out' || checkin.status === 'completed');
    return res.json({
      success: true,
      data: {
        checked_in: checkedIn,
        checked_out: checkedOut,
        checkin: checkin ? { ...checkin, checked_in: checkedIn, checked_out: checkedOut } : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/checkin', verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const time = new Date().toTimeString().slice(0, 8);
    const { location = 'Office', latitude = null, longitude = null } = req.body || {};
    const existing = await query('SELECT id, status FROM employee_checkins WHERE employee_id = ? AND date = ?', [req.employee.id, today]);
    const row = existing[0];
    if (row && (row.status === 'checked_in' || row.status === 'completed')) {
      return res.status(400).json({ success: false, message: 'Already checked in today' });
    }

    const { first: monthFirst, last: monthLast } = getMonthBounds(today);
    let existingLateCount = 0;
    try {
      const lateRows = await query(
        'SELECT COUNT(*) as cnt FROM employee_checkins WHERE employee_id = ? AND date >= ? AND date <= ? AND is_late = 1',
        [req.employee.id, monthFirst, monthLast]
      );
      existingLateCount = (lateRows && lateRows[0] && lateRows[0].cnt) || 0;
    } catch (_) {
      // is_late column may not exist yet
    }

    const { attendance_type: attendanceType, is_late: isLate } = attendanceRules.getAttendanceForPunchIn(time, existingLateCount);

    let checkinId;
    if (row) {
      try {
        await query(
          `UPDATE employee_checkins SET check_in_time=?, check_in_location=?, time=?, location=?, latitude=?, longitude=?, status='checked_in', attendance_type=?, is_late=? WHERE id=?`,
          [time, location, time, location, latitude, longitude, attendanceType, isLate, row.id]
        );
      } catch (updErr) {
        const msg = (updErr.message || '').toString();
        if (msg.includes("Unknown column 'is_late'")) {
          await query(
            `UPDATE employee_checkins SET check_in_time=?, check_in_location=?, time=?, location=?, latitude=?, longitude=?, status='checked_in', attendance_type=? WHERE id=?`,
            [time, location, time, location, latitude, longitude, attendanceType, row.id]
          );
        } else throw updErr;
      }
      checkinId = row.id;
    } else {
      const conn = await getConnection();
      try {
        const [r] = await conn.execute(
          `INSERT INTO employee_checkins (employee_id, date, check_in_time, check_in_location, time, location, latitude, longitude, status, attendance_type, is_late) VALUES (?,?,?,?,?,?,?,?,'checked_in',?,?)`,
          [req.employee.id, today, time, location, time, location, latitude, longitude, attendanceType, isLate]
        );
        checkinId = r && r.insertId;
      } catch (insErr) {
        const msg = (insErr.message || '').toString();
        if (msg.includes("Unknown column 'is_late'")) {
          const [r] = await conn.execute(
            `INSERT INTO employee_checkins (employee_id, date, check_in_time, check_in_location, time, location, latitude, longitude, status, attendance_type) VALUES (?,?,?,?,?,?,?,?,'checked_in',?)`,
            [req.employee.id, today, time, location, time, location, latitude, longitude, attendanceType]
          );
          checkinId = r && r.insertId;
        } else throw insErr;
      }
      conn.release();
    }
    await logActivity(req.employee.id, 'checkin', 'checkin', checkinId, 'Employee checked in', req);
    const dayLabel = attendanceType === 'full_day' ? 'Full day' : 'Half day';
    return res.json({
      success: true,
      message: `Check-in successful. ${dayLabel} attendance.`,
      data: { id: checkinId, date: today, time, location, attendance_type: attendanceType },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
