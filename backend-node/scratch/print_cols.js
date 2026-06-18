const { query } = require('../config/database');

async function printCols() {
  try {
    const rows = await query('SELECT id, name, email, role, status, tokenVersion, company_id FROM employees LIMIT 1');
    console.log('Columns exist! Sample row:', rows[0]);
  } catch (err) {
    console.error('Failed to query select columns:', err.message);
  } finally {
    process.exit(0);
  }
}

printCols();
