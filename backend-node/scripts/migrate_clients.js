require('../config/env');
const { query } = require('../config/database');

async function migrate() {
  try {
    await query(`ALTER TABLE sales_clients
      ADD COLUMN IF NOT EXISTS company_name VARCHAR(200) NULL AFTER full_name,
      ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(20) NULL,
      ADD COLUMN IF NOT EXISTS pan_number VARCHAR(15) NULL,
      ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20) NULL
    `);
    console.log('✅ Columns added: company_name, aadhar_number, pan_number, gst_number');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  }
}

migrate();
