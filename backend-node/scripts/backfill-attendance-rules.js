#!/usr/bin/env node
/**
 * Backfill attendance rules: set is_late and attendance_type for all existing employee_checkins.
 * Rules: 09:30–10:00 = on time = full_day; after 10:00 = late, 4th late in month = half_day.
 * Run once after migration 007 (is_late column). Usage: node scripts/backfill-attendance-rules.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getConnection } = require('../config/database');
const attendanceRules = require('../services/attendanceRules');

async function ensureSchema(conn) {
  try {
    await conn.execute(`
      ALTER TABLE employee_checkins
      ADD COLUMN attendance_type ENUM('full_day', 'half_day') DEFAULT NULL
      COMMENT 'full_day or half_day per attendance rules'
    `);
    console.log('Added attendance_type column.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME' || (e.message && e.message.includes('Duplicate column name'))) {
      console.log('attendance_type column already exists.');
    } else throw e;
  }
  try {
    await conn.execute(`
      ALTER TABLE employee_checkins
      ADD COLUMN is_late TINYINT(1) NOT NULL DEFAULT 0
      COMMENT '1 if punch-in after 10:00 AM'
      AFTER attendance_type
    `);
    console.log('Added is_late column.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME' || (e.message && e.message.includes('Duplicate column name'))) {
      console.log('is_late column already exists.');
    } else throw e;
  }
  try {
    await conn.execute(`
      ALTER TABLE employee_checkins
      ADD COLUMN edit_reason TEXT NULL
      COMMENT 'Reason for HR edit / reason for late'
      AFTER is_late
    `);
    console.log('Added edit_reason column.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME' || (e.message && e.message.includes('Duplicate column name'))) {
      console.log('edit_reason column already exists.');
    } else throw e;
  }
}

async function run() {
  let conn;
  try {
    conn = await getConnection();
    await ensureSchema(conn);

    const [rows] = await conn.execute(
      'SELECT id, employee_id, date, check_in_time, attendance_type, is_late FROM employee_checkins WHERE check_in_time IS NOT NULL ORDER BY employee_id, date, id'
    );
    if (!rows || rows.length === 0) {
      console.log('No check-in records to backfill.');
      conn.release();
      process.exit(0);
      return;
    }

    attendanceRules.applyAttendanceRulesToRows(rows);

    let updated = 0;
    for (const r of rows) {
      const type = (r.attendance_type === 'half_day' ? 'half_day' : 'full_day');
      const isLate = r.is_late ? 1 : 0;
      await conn.execute(
        'UPDATE employee_checkins SET attendance_type = ?, is_late = ? WHERE id = ?',
        [type, isLate, r.id]
      );
      updated++;
    }
    console.log(`Backfill completed: ${updated} records updated.`);
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err.message);
    process.exit(1);
  } finally {
    if (conn && conn.release) conn.release();
  }
}

run();
