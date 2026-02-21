/**
 * HRMS Attendance Rules – strict, no rounding, no grace beyond defined time.
 *
 * 1. Official Punch-In Window: 09:30 AM – 10:00 AM = ON TIME (no late count).
 * 2. Late Punch-In: Any punch-in AFTER 10:00 AM = LATE; each occurrence increments late count by 1.
 * 3. Exactly 10:00 AM = ON TIME (edge case).
 * 4. Late count threshold:
 *    - 1st, 2nd, 3rd late in the period = FULL DAY.
 *    - 4th late in the period = HALF DAY for that day; late count still increments.
 * 5. Late count is per employee, per period (e.g. monthly – caller passes period bounds).
 */

const OFFICIAL_START_MINUTES = 9 * 60 + 30;  // 09:30 AM
const OFFICIAL_END_MINUTES = 10 * 60 + 0;    // 10:00 AM (inclusive = on time)
const LATE_THRESHOLD = 4;                     // 4th late = half day

/**
 * Parse time string "HH:MM:SS" or "HH:MM" to minutes since midnight.
 * @param {string} timeStr - e.g. "09:45:00" or "10:01:00"
 * @returns {number} minutes since midnight, or 0 if invalid
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parseInt(parts[2], 10) || 0;
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m + s / 60;
}

/**
 * Returns true if punch-in time is AFTER 10:00 AM (strict).
 * 09:30–10:00 = on time; exactly 10:00:00 = on time.
 * @param {string} timeStr - e.g. "10:00:00" (on time), "10:00:01" (late)
 * @returns {boolean}
 */
function isPunchInLate(timeStr) {
  const minutes = parseTimeToMinutes(timeStr);
  return minutes > OFFICIAL_END_MINUTES;
}

/**
 * Returns true if punch-in is within official window (09:30–10:00 inclusive) = on time.
 * @param {string} timeStr
 * @returns {boolean}
 */
function isPunchInOnTime(timeStr) {
  const minutes = parseTimeToMinutes(timeStr);
  return minutes >= OFFICIAL_START_MINUTES && minutes <= OFFICIAL_END_MINUTES;
}

/**
 * Get attendance type and is_late for a punch-in.
 * Caller must pass existing late count in the current period (e.g. this month) before this punch.
 *
 * @param {string} timeStr - punch-in time "HH:MM:SS"
 * @param {number} existingLateCountInPeriod - number of late punch-ins already in this period (same employee)
 * @returns {{ attendance_type: 'full_day'|'half_day', is_late: 0|1 }}
 */
function getAttendanceForPunchIn(timeStr, existingLateCountInPeriod) {
  const late = isPunchInLate(timeStr);
  if (!late) {
    return { attendance_type: 'full_day', is_late: 0 };
  }
  const newLateCount = (existingLateCountInPeriod || 0) + 1;
  const attendance_type = newLateCount >= LATE_THRESHOLD ? 'half_day' : 'full_day';
  return { attendance_type, is_late: 1 };
}

/**
 * For legacy records: derive attendance_type from time only (no late count).
 * 09:30–10:00 = full_day; after 10:00 = full_day (we cannot know if it was 4th late, so avoid incorrect half_day).
 * @param {string} timeStr
 * @returns {'full_day'|'half_day'}
 */
function getAttendanceTypeFromPunchInTimeLegacy(timeStr) {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes >= OFFICIAL_START_MINUTES && minutes <= OFFICIAL_END_MINUTES) return 'full_day';
  return 'full_day'; // after 10:00: legacy – don't mark half_day without late count
}

/**
 * Normalize check_in_time from DB (Time object or string) to "HH:MM:SS".
 * @param {*} t - MySQL TIME or string "HH:MM:SS"
 * @returns {string}
 */
function normalizeTime(t) {
  if (t == null) return '';
  if (typeof t === 'string') return t.trim();
  if (typeof t === 'object' && t.constructor && t.constructor.name === 'Time') {
    const h = t.hours != null ? t.hours : (t.H || 0);
    const m = t.minutes != null ? t.minutes : (t.M || 0);
    const s = t.seconds != null ? t.seconds : (t.S || 0);
    return [h, m, s].map(n => String(Number(n) || 0).padStart(2, '0')).join(':');
  }
  return String(t);
}

function toDateStr(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.trim().slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

/**
 * Apply official attendance rules to an array of check-in rows (mutates rows).
 * 09:30–10:00 = on time = full_day; after 10:00 = late, 4th late in month = half_day.
 * @param {Array<{ employee_id: number, date: string|Date, check_in_time: *, attendance_type?: string, is_late?: number }>} rows
 */
function applyAttendanceRulesToRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const key = (empId, dateVal) => `${empId}-${toDateStr(dateVal).slice(0, 7)}`;
  const lateByKey = {};

  for (const r of rows) {
    const timeStr = normalizeTime(r.check_in_time);
    if (!timeStr) continue;
    if (!isPunchInLate(timeStr)) continue;
    const k = key(r.employee_id, r.date);
    if (!lateByKey[k]) lateByKey[k] = [];
    lateByKey[k].push(r);
  }

  for (const k of Object.keys(lateByKey)) {
    lateByKey[k].sort((a, b) => {
      const da = toDateStr(a.date);
      const db = toDateStr(b.date);
      const d = da.localeCompare(db);
      return d !== 0 ? d : (a.id || 0) - (b.id || 0);
    });
    lateByKey[k].forEach((r, idx) => {
      const occurrence = idx + 1;
      r.attendance_type = occurrence >= LATE_THRESHOLD ? 'half_day' : 'full_day';
      r.is_late = 1;
    });
  }

  for (const r of rows) {
    const timeStr = normalizeTime(r.check_in_time);
    if (!timeStr) continue;
    if (isPunchInLate(timeStr)) {
      if (r.attendance_type === undefined) {
        const k = key(r.employee_id, r.date);
        const list = lateByKey[k] || [];
        const idx = list.findIndex(x => x === r);
        const occurrence = idx >= 0 ? idx + 1 : 1;
        r.attendance_type = occurrence >= LATE_THRESHOLD ? 'half_day' : 'full_day';
      }
      r.is_late = 1;
    } else {
      r.attendance_type = 'full_day';
      r.is_late = 0;
    }
  }
}

module.exports = {
  OFFICIAL_START_MINUTES,
  OFFICIAL_END_MINUTES,
  LATE_THRESHOLD,
  parseTimeToMinutes,
  isPunchInLate,
  isPunchInOnTime,
  getAttendanceForPunchIn,
  getAttendanceTypeFromPunchInTimeLegacy,
  normalizeTime,
  applyAttendanceRulesToRows,
};
