const { query } = require('../config/database');

async function migrate() {
    console.log('Running Subscription Requests Migration...');
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS subscription_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                selected_plan INT NOT NULL,
                payment_id VARCHAR(100),
                payment_status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
                approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Migration successful');
    } catch (err) {
        console.error('Migration failed:', err);
    }
    process.exit(0);
}

migrate();
