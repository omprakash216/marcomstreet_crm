const { query } = require('./config/database');
require('dotenv').config();

async function migrate() {
    try {
        const columns = await query('DESCRIBE employees');
        const fields = columns.map(c => c.Field);

        if (!fields.includes('bank_name')) {
            await query('ALTER TABLE employees ADD COLUMN bank_name VARCHAR(100) AFTER bank_account');
        }
        if (!fields.includes('ifsc_code')) {
            await query('ALTER TABLE employees ADD COLUMN ifsc_code VARCHAR(20) AFTER bank_name');
        }
        if (!fields.includes('branch_name')) {
            await query('ALTER TABLE employees ADD COLUMN branch_name VARCHAR(100) AFTER ifsc_code');
        }
        if (!fields.includes('account_holder_name')) {
            await query('ALTER TABLE employees ADD COLUMN account_holder_name VARCHAR(255) AFTER branch_name');
        }
        if (!fields.includes('aadhar_number')) {
            await query('ALTER TABLE employees ADD COLUMN aadhar_number VARCHAR(20) AFTER pan_number');
        }

        console.log('Migration successful: Bank columns and Aadhar added to employees table.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
