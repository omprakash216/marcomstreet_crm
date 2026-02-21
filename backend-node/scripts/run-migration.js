#!/usr/bin/env node
/**
 * Run attendance migration: add attendance_type to employee_checkins.
 * Usage: npm run migrate   (from backend-node) or node scripts/run-migration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getConnection } = require('../config/database');

const MIGRATION_SQL = `
ALTER TABLE employee_checkins
ADD COLUMN attendance_type ENUM('full_day', 'half_day') DEFAULT NULL
COMMENT 'full_day if punch in 9:30-9:40, else half_day'
`.trim();

async function run() {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(MIGRATION_SQL);
    console.log('Migration completed: attendance_type added to employee_checkins.');
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME' || (err.message && err.message.includes('Duplicate column name'))) {
      console.log('Migration skipped: attendance_type column already exists.');
      process.exit(0);
    }
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
  }
}

run();
