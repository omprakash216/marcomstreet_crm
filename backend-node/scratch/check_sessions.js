const { query } = require('../config/database');

async function check() {
  try {
    const rows = await query("SHOW TABLES LIKE 'sessions'");
    console.log('Tables matching sessions:', rows);
    const allTables = await query("SHOW TABLES");
    console.log('All tables:', allTables);
  } catch (err) {
    console.error('Error checking sessions table:', err);
  }
  process.exit(0);
}

check();
