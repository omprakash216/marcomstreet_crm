const { query, getConnection } = require('../config/database');
const attendanceRules = require('./attendanceRules');

const DAILY_TARGET_SECONDS = 8 * 60 * 60;

function pad(n) {
  return String(n).padStart(2, '0');
}

function getTodayDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function getCurrentTime() {
  return new Date().toTimeString().slice(0, 8);
}

function normalizeDateString(dateStr) {
  if (!dateStr) return '';
  if (dateStr instanceof Date) {
    const local = new Date(dateStr.getTime() - dateStr.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  const raw = String(dateStr);
  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  return '';
}

function getDateTimeString(dateStr, timeStr) {
  const safeDate = normalizeDateString(dateStr);
  if (!safeDate) return '';
  return `${safeDate}T${String(timeStr || '00:00:00').slice(0, 8)}`;
}

function diffSeconds(dateStr, startTime, endTime) {
  if (!dateStr || !startTime || !endTime) return 0;
  const startStr = getDateTimeString(dateStr, startTime);
  const endStr = getDateTimeString(dateStr, endTime);
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

async function getShiftTargetSeconds(employeeId, dateStr) {
  try {
    const rows = await query(
      `SELECT s.start_time, s.end_time
       FROM hr_shift_assignments a
       JOIN hr_shifts s ON a.shift_id = s.id
       WHERE a.employee_id = ? AND a.effective_from <= ? AND (a.effective_to IS NULL OR a.effective_to >= ?)
       ORDER BY a.effective_from DESC LIMIT 1`,
      [employeeId, dateStr, dateStr]
    );
    const shift = rows && rows[0];
    if (!shift) return DAILY_TARGET_SECONDS;
    const start = String(shift.start_time || '').slice(0, 8);
    const end = String(shift.end_time || '').slice(0, 8);
    let seconds = diffSeconds(dateStr, start, end);
    if (seconds === 0 && start && end && start >= end) {
      // Overnight shift: add 24h
      seconds = diffSeconds(dateStr, start, '23:59:59') + diffSeconds(dateStr, '00:00:00', end) + 1;
    }
    return seconds > 0 ? seconds : DAILY_TARGET_SECONDS;
  } catch (_) {
    return DAILY_TARGET_SECONDS;
  }
}

function formatSeconds(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

function normalizeAttendanceRow(row = {}) {
  const workedSeconds = Number(row.worked_seconds) || 0;
  const breakSeconds = Number(row.break_seconds) || 0;
  const targetSeconds = Number(row.target_seconds) || DAILY_TARGET_SECONDS;
  const overtimeSeconds = Math.max(0, workedSeconds - targetSeconds);
  const remainingSeconds = Math.max(0, targetSeconds - workedSeconds);
  const progressPercent = targetSeconds > 0 ? Math.min(100, Math.round((workedSeconds / targetSeconds) * 100)) : 0;

  return {
    ...row,
    status: row.status || 'pending',
    worked_seconds: workedSeconds,
    break_seconds: breakSeconds,
    target_seconds: targetSeconds,
    overtime_seconds: overtimeSeconds,
    remaining_seconds: remainingSeconds,
    progress_percent: progressPercent,
    worked_time: formatSeconds(workedSeconds),
    break_time: formatSeconds(breakSeconds),
    remaining_time: formatSeconds(remainingSeconds),
    overtime_time: formatSeconds(overtimeSeconds),
    can_clock_in: !row.id || row.status === 'pending' || row.status === 'completed' || row.status === 'checked_out',
    can_start_break: row.status === 'checked_in',
    can_resume: row.status === 'on_break',
    can_clock_out: row.status === 'checked_in' || row.status === 'on_break',
    can_reset_timer: row.status === 'checked_in' || row.status === 'on_break',
  };
}

async function ensureTodayRow(employeeId, options = {}) {
  const today = options.date || getTodayDate();
  const rows = await query(
    'SELECT * FROM employee_checkins WHERE employee_id = ? AND date = ? ORDER BY id DESC LIMIT 1',
    [employeeId, today]
  );
  return rows[0] || null;
}

async function getLateCount(employeeId, dateStr) {
  const [year, month] = dateStr.split('-');
  const first = `${year}-${month}-01`;
  const last = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
  const rows = await query(
    'SELECT COUNT(*) as cnt FROM employee_checkins WHERE employee_id = ? AND date >= ? AND date <= ? AND is_late = 1',
    [employeeId, first, last]
  ).catch(() => [{ cnt: 0 }]);
  return Number(rows[0]?.cnt) || 0;
}

async function recalculateAttendance(attendanceId) {
  const rows = await query('SELECT * FROM employee_checkins WHERE id = ?', [attendanceId]);
  const record = rows[0];
  if (!record) return null;

  const breakLogRows = await query(
    'SELECT break_start_time, break_end_time, break_seconds FROM break_logs WHERE attendance_id = ? ORDER BY id ASC',
    [attendanceId]
  ).catch(() => []);

  const breakSecondsFromLogs = breakLogRows.reduce((sum, log) => {
    if (log.break_seconds != null) return sum + (Number(log.break_seconds) || 0);
    return sum + diffSeconds(record.date, log.break_start_time, log.break_end_time);
  }, 0);

  const nowTime = getCurrentTime();
  const effectiveEndTime =
    record.status === 'completed' || record.status === 'checked_out'
      ? record.check_out_time || nowTime
      : nowTime;

  const grossSeconds = diffSeconds(record.date, record.check_in_time, effectiveEndTime);
  const currentBreakSeconds =
    record.status === 'on_break' && record.current_break_start_time
      ? diffSeconds(record.date, record.current_break_start_time, nowTime)
      : 0;
  const totalBreakSeconds = Math.max(0, breakSecondsFromLogs + currentBreakSeconds);
  const workedSeconds = Math.max(0, grossSeconds - totalBreakSeconds);
  const overtimeSeconds = Math.max(0, workedSeconds - (Number(record.target_seconds) || DAILY_TARGET_SECONDS));

  await query(
    `UPDATE employee_checkins
     SET break_seconds = ?, worked_seconds = ?, total_hours = ROUND(? / 3600, 2), overtime_seconds = ?
     WHERE id = ?`,
    [totalBreakSeconds, workedSeconds, workedSeconds, overtimeSeconds, attendanceId]
  );

  const updatedRows = await query('SELECT * FROM employee_checkins WHERE id = ?', [attendanceId]);
  return normalizeAttendanceRow(updatedRows[0]);
}

async function getTodaySummary(employeeId) {
  const serverTimeMs = Date.now();
  const record = await ensureTodayRow(employeeId);
  if (!record) {
    const target = await getShiftTargetSeconds(employeeId, getTodayDate());
    return {
      checked_in: false,
      checked_out: false,
      on_break: false,
      attendance: null,
      goal_seconds: target,
      goal_time: formatSeconds(target),
      server_time_ms: serverTimeMs,
    };
  }

  const updated = await recalculateAttendance(record.id);
  return {
    checked_in: updated.status === 'checked_in' || updated.status === 'on_break' || updated.status === 'completed',
    checked_out: updated.status === 'completed' || updated.status === 'checked_out',
    on_break: updated.status === 'on_break',
    attendance: updated,
    goal_seconds: updated.target_seconds || DAILY_TARGET_SECONDS,
    goal_time: formatSeconds(updated.target_seconds || DAILY_TARGET_SECONDS),
    server_time_ms: serverTimeMs,
  };
}

async function clockIn(employee, payload = {}) {
  const today = getTodayDate();
  const currentTime = getCurrentTime();
  const location = payload.location || 'Office';
  const latitude = payload.latitude || null;
  const longitude = payload.longitude || null;
  const existing = await ensureTodayRow(employee.id, { date: today });
  const targetSeconds = await getShiftTargetSeconds(employee.id, today);

  if (existing && ['checked_in', 'on_break'].includes(existing.status)) {
    throw new Error('Already clocked in today');
  }

  const lateCount = await getLateCount(employee.id, today);
  const { attendance_type: attendanceType, is_late: isLate } = attendanceRules.getAttendanceForPunchIn(currentTime, lateCount);
  const conn = await getConnection();
  try {
    let attendanceId = existing?.id;
    if (existing) {
      await conn.execute(
        `UPDATE employee_checkins
         SET check_in_time=?, check_out_time=NULL, check_in_location=?, check_out_location=NULL, time=?, location=?, latitude=?, longitude=?,
             status='checked_in', attendance_type=?, is_late=?, worked_seconds=0, break_seconds=0, overtime_seconds=0,
             current_break_start_time=NULL, target_seconds=?
         WHERE id=?`,
        [currentTime, location, currentTime, location, latitude, longitude, attendanceType, isLate, targetSeconds, existing.id]
      );
    } else {
      const [result] = await conn.execute(
        `INSERT INTO employee_checkins
         (employee_id, date, check_in_time, check_in_location, time, location, latitude, longitude, status,
          attendance_type, is_late, worked_seconds, break_seconds, overtime_seconds, target_seconds)
         VALUES (?,?,?,?,?,?,?,?,'checked_in',?,?,?,?,?,?)`,
        [employee.id, today, currentTime, location, currentTime, location, latitude, longitude, attendanceType, isLate, 0, 0, 0, targetSeconds]
      );
      attendanceId = result.insertId;
    }

    return recalculateAttendance(attendanceId);
  } finally {
    conn.release();
  }
}

async function startBreak(employeeId) {
  const record = await ensureTodayRow(employeeId);
  if (!record || record.status !== 'checked_in') {
    throw new Error('Active working session not found');
  }
  const breakStart = getCurrentTime();
  await query(
    'UPDATE employee_checkins SET status = ?, current_break_start_time = ? WHERE id = ?',
    ['on_break', breakStart, record.id]
  );
  await query(
    'INSERT INTO break_logs (attendance_id, employee_id, break_date, break_start_time, status) VALUES (?, ?, ?, ?, ?)',
    [record.id, employeeId, record.date, breakStart, 'active']
  ).catch(() => {});
  return recalculateAttendance(record.id);
}

async function endBreak(employeeId) {
  const record = await ensureTodayRow(employeeId);
  if (!record || record.status !== 'on_break' || !record.current_break_start_time) {
    throw new Error('No active break found');
  }
  const breakEnd = getCurrentTime();
  const breakSeconds = diffSeconds(record.date, record.current_break_start_time, breakEnd);

  await query(
    `UPDATE break_logs
     SET break_end_time = ?, break_seconds = ?, status = 'completed', updated_at = NOW()
     WHERE attendance_id = ? AND status = 'active'
     ORDER BY id DESC LIMIT 1`,
    [breakEnd, breakSeconds, record.id]
  ).catch(() => {});

  await query(
    'UPDATE employee_checkins SET status = ?, current_break_start_time = NULL WHERE id = ?',
    ['checked_in', record.id]
  );
  return recalculateAttendance(record.id);
}

async function clockOut(employeeId, payload = {}) {
  const record = await ensureTodayRow(employeeId);
  if (!record || !['checked_in', 'on_break'].includes(record.status)) {
    throw new Error('No active session found for clock out');
  }
  const nowTime = getCurrentTime();
  const location = payload.location || record.check_out_location || 'Office';

  if (record.status === 'on_break' && record.current_break_start_time) {
    const breakSeconds = diffSeconds(record.date, record.current_break_start_time, nowTime);
    await query(
      `UPDATE break_logs
       SET break_end_time = ?, break_seconds = ?, status = 'completed', updated_at = NOW()
       WHERE attendance_id = ? AND status = 'active'
       ORDER BY id DESC LIMIT 1`,
      [nowTime, breakSeconds, record.id]
    ).catch(() => {});
  }

  await query(
    `UPDATE employee_checkins
     SET check_out_time = ?, check_out_location = ?, status = 'completed', current_break_start_time = NULL
     WHERE id = ?`,
    [nowTime, location, record.id]
  );
  return recalculateAttendance(record.id);
}

async function resetTimer(employeeId, payload = {}) {
  const record = await ensureTodayRow(employeeId);
  if (!record || !['checked_in', 'on_break'].includes(record.status)) {
    throw new Error('No active session found for timer reset');
  }

  const nowTime = getCurrentTime();
  const location = payload.location || record.check_in_location || 'Office';
  const latitude = payload.latitude || record.latitude || null;
  const longitude = payload.longitude || record.longitude || null;

  await query('DELETE FROM break_logs WHERE attendance_id = ?', [record.id]).catch(() => {});

  await query(
    `UPDATE employee_checkins
     SET check_in_time = ?,
         check_out_time = NULL,
         check_in_location = ?,
         check_out_location = NULL,
         time = ?,
         location = ?,
         latitude = ?,
         longitude = ?,
         status = 'checked_in',
         current_break_start_time = NULL,
         worked_seconds = 0,
         break_seconds = 0,
         overtime_seconds = 0,
         total_hours = 0
     WHERE id = ?`,
    [nowTime, location, nowTime, location, latitude, longitude, record.id]
  );

  const [resetRecord] = await query('SELECT * FROM employee_checkins WHERE id = ?', [record.id]);
  return normalizeAttendanceRow(resetRecord);
}

async function getAttendanceHistory(employee, filters = {}) {
  const isAdminLike = ['admin', 'manager', 'human_resources'].includes(String(employee.role || '').toLowerCase());
  let sql = `
    SELECT ec.*, e.name as employee_name, e.email as employee_email, e.employee_code, d.name as department_name
    FROM employee_checkins ec
    JOIN employees e ON e.id = ec.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE 1=1
  `;
  const params = [];
  if (!isAdminLike || !filters.employee_id) {
    sql += ' AND ec.employee_id = ?';
    params.push(filters.employee_id || employee.id);
  } else if (filters.employee_id) {
    sql += ' AND ec.employee_id = ?';
    params.push(filters.employee_id);
  }
  if (filters.date_from) {
    sql += ' AND ec.date >= ?';
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    sql += ' AND ec.date <= ?';
    params.push(filters.date_to);
  }
  sql += ' ORDER BY ec.date DESC, ec.id DESC';

  const rows = await query(sql, params);
  return rows.map(normalizeAttendanceRow);
}

async function getAdminAttendanceAnalytics(filters = {}) {
  const month = filters.month || getTodayDate().slice(0, 7);
  const selectedDate = filters.selected_date || getTodayDate();

  const summarySql = `
    SELECT
      COUNT(CASE WHEN e.status = 'active' THEN 1 END) as total_employees,
      COUNT(CASE WHEN ec.date = ? AND ec.status IN ('checked_in','on_break','completed') THEN 1 END) as present_today,
      COUNT(CASE WHEN ec.date = ? AND ec.status = 'completed' AND ec.overtime_seconds > 0 THEN 1 END) as overtime_employees,
      COUNT(CASE WHEN ec.date = ? AND ec.is_late = 1 THEN 1 END) as late_arrivals,
      COALESCE(SUM(CASE WHEN ec.date = ? THEN ec.worked_seconds ELSE 0 END), 0) as worked_seconds_today
    FROM employees e
    LEFT JOIN employee_checkins ec ON ec.employee_id = e.id
    WHERE e.status = 'active'
  `;
  const [summary] = await query(summarySql, [selectedDate, selectedDate, selectedDate, selectedDate]).catch(() => [{}]);
  const totalEmployees = Number(summary?.total_employees) || 0;
  const presentToday = Number(summary?.present_today) || 0;
  const absentToday = Math.max(0, totalEmployees - presentToday);
  const workedSecondsToday = Number(summary?.worked_seconds_today) || 0;
  const avgWorkingHours = presentToday > 0 ? Number((workedSecondsToday / presentToday / 3600).toFixed(2)) : 0;

  const attendanceRecords = await query(
    `SELECT ec.*, e.name, e.email, e.employee_code, d.name as department_name
     FROM employee_checkins ec
     JOIN employees e ON e.id = ec.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE ec.date = ?
     ORDER BY ec.id DESC`,
    [selectedDate]
  ).catch(() => []);

  const monthlyStats = await query(
    `SELECT DATE_FORMAT(date, '%Y-%m-%d') as day, COUNT(*) as records,
            SUM(worked_seconds) as worked_seconds, SUM(overtime_seconds) as overtime_seconds
     FROM employee_checkins
     WHERE DATE_FORMAT(date, '%Y-%m') = ?
     GROUP BY DATE_FORMAT(date, '%Y-%m-%d')
     ORDER BY day ASC`,
    [month]
  ).catch(() => []);

  const attendanceTypes = [
    { name: 'Present', value: presentToday, color: '#10b981' },
    { name: 'Absent', value: absentToday, color: '#ef4444' },
    { name: 'Late', value: Number(summary?.late_arrivals) || 0, color: '#f59e0b' },
    { name: 'Overtime', value: Number(summary?.overtime_employees) || 0, color: '#3b82f6' },
  ];

  return {
    summary: {
      totalEmployees,
      presentToday,
      absentToday,
      onLeave: 0,
      attendanceRate: totalEmployees > 0 ? Number(((presentToday / totalEmployees) * 100).toFixed(1)) : 0,
      avgWorkingHours,
      lateArrivals: Number(summary?.late_arrivals) || 0,
      overtimeEmployees: Number(summary?.overtime_employees) || 0,
      totalWorkedTime: formatSeconds(workedSecondsToday),
    },
    attendanceRecords: attendanceRecords.map(normalizeAttendanceRow),
    monthlyStats: monthlyStats.map((row) => ({
      day: row.day,
      workedHours: Number(((Number(row.worked_seconds) || 0) / 3600).toFixed(2)),
      overtimeHours: Number(((Number(row.overtime_seconds) || 0) / 3600).toFixed(2)),
      records: Number(row.records) || 0,
    })),
    attendanceTypes,
  };
}

async function closeOpenAttendanceRecords(forceDate) {
  const dateStr = forceDate || getTodayDate();
  const openRows = await query(
    `SELECT id, employee_id, date, check_in_time, current_break_start_time, status
     FROM employee_checkins
     WHERE date = ? AND status IN ('checked_in', 'on_break')`,
    [dateStr]
  ).catch(() => []);

  for (const row of openRows) {
    const closeTime = '23:59:59';
    if (row.status === 'on_break' && row.current_break_start_time) {
      const breakSeconds = diffSeconds(row.date, row.current_break_start_time, closeTime);
      await query(
        `UPDATE break_logs
         SET break_end_time = ?, break_seconds = ?, status = 'completed', updated_at = NOW()
         WHERE attendance_id = ? AND status = 'active'
         ORDER BY id DESC LIMIT 1`,
        [closeTime, breakSeconds, row.id]
      ).catch(() => {});
    }
    await query(
      `UPDATE employee_checkins
       SET check_out_time = ?, check_out_location = 'Auto close', current_break_start_time = NULL, status = 'completed'
       WHERE id = ?`,
      [closeTime, row.id]
    );
    await recalculateAttendance(row.id);
  }
}

module.exports = {
  DAILY_TARGET_SECONDS,
  formatSeconds,
  normalizeAttendanceRow,
  getTodaySummary,
  clockIn,
  startBreak,
  endBreak,
  clockOut,
  resetTimer,
  getAttendanceHistory,
  getAdminAttendanceAnalytics,
  closeOpenAttendanceRecords,
};
