const { query } = require('./config/database');

async function run() {
  try {
    console.log('Ensuring backup_logs table exists...');
    await query(`
      CREATE TABLE IF NOT EXISTS backup_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NULL,
        backup_type VARCHAR(50) DEFAULT 'full',
        file_path VARCHAR(255) NULL,
        file_size BIGINT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'completed',
        meta JSON NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Table backup_logs checked/created.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

run();
