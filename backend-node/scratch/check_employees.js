const { query } = require('../config/database');

async function checkEmployeesSchema() {
  try {
    console.log('--- Inspecting employees table columns ---');
    const columns = await query('SHOW COLUMNS FROM employees');
    console.table(columns);
  } catch (err) {
    console.error('Failed to query employees table schema:', err.message);
  } finally {
    process.exit(0);
  }
}

checkEmployeesSchema();
