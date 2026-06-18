const { query } = require('../config/database');

async function checkRole() {
  try {
    const rows = await query("SELECT SHOW_ROLE FROM (SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'role') AS t").catch(() => []);
    const hasRole = await query("SHOW COLUMNS FROM employees LIKE 'role'");
    console.log('Role column check:', hasRole);
  } catch (err) {
    console.error('Role column check error:', err.message);
  } finally {
    process.exit(0);
  }
}

checkRole();
