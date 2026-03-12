require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const safe = async (sql) => {
    try {
      await conn.execute(sql);
      console.log('OK:', sql.split('\n')[0].slice(0, 90));
    } catch (e) {
      const msg = String(e.message || '');
      if (
        e.code === 'ER_DUP_FIELDNAME' ||
        e.code === 'ER_DUP_KEYNAME' ||
        e.code === 'ER_TABLE_EXISTS_ERROR' ||
        msg.includes('Duplicate column') ||
        msg.includes('already exists')
      ) {
        console.log('SKIP:', sql.split('\n')[0].slice(0, 90));
        return;
      }
      throw e;
    }
  };

  try {
    // Extended employee profile fields used by admin/hr modules.
    await safe('ALTER TABLE employees ADD COLUMN address TEXT NULL');
    await safe('ALTER TABLE employees ADD COLUMN permanent_address TEXT NULL');
    await safe('ALTER TABLE employees ADD COLUMN dob DATE NULL');
    await safe('ALTER TABLE employees ADD COLUMN gender VARCHAR(20) NULL');
    await safe('ALTER TABLE employees ADD COLUMN marital_status VARCHAR(20) NULL');
    await safe('ALTER TABLE employees ADD COLUMN emergency_contact_name VARCHAR(255) NULL');
    await safe('ALTER TABLE employees ADD COLUMN emergency_contact_phone VARCHAR(20) NULL');
    await safe('ALTER TABLE employees ADD COLUMN joining_date DATE NULL');
    await safe("ALTER TABLE employees ADD COLUMN employment_type VARCHAR(50) NULL DEFAULT 'full_time'");
    await safe('ALTER TABLE employees ADD COLUMN probation_period INT NULL DEFAULT 3');
    await safe('ALTER TABLE employees ADD COLUMN basic_salary DECIMAL(12,2) NULL DEFAULT 0');
    await safe('ALTER TABLE employees ADD COLUMN hra DECIMAL(12,2) NULL DEFAULT 0');
    await safe('ALTER TABLE employees ADD COLUMN conveyance DECIMAL(12,2) NULL DEFAULT 0');
    await safe('ALTER TABLE employees ADD COLUMN medical_allowance DECIMAL(12,2) NULL DEFAULT 0');
    await safe('ALTER TABLE employees ADD COLUMN lta DECIMAL(12,2) NULL DEFAULT 0');
    await safe('ALTER TABLE employees ADD COLUMN other_allowances DECIMAL(12,2) NULL DEFAULT 0');
    await safe('ALTER TABLE employees ADD COLUMN allowances DECIMAL(12,2) NULL DEFAULT 0');
    await safe('ALTER TABLE employees ADD COLUMN deductions DECIMAL(12,2) NULL DEFAULT 0');
    await safe('ALTER TABLE employees ADD COLUMN previous_company VARCHAR(255) NULL');
    await safe('ALTER TABLE employees ADD COLUMN previous_designation VARCHAR(100) NULL');
    await safe('ALTER TABLE employees ADD COLUMN experience_years DECIMAL(4,1) NULL DEFAULT 0');
    await safe('ALTER TABLE employees ADD COLUMN qualification VARCHAR(255) NULL');
    await safe('ALTER TABLE employees ADD COLUMN bank_account VARCHAR(100) NULL');
    await safe('ALTER TABLE employees ADD COLUMN bank_name VARCHAR(255) NULL');
    await safe('ALTER TABLE employees ADD COLUMN ifsc_code VARCHAR(20) NULL');
    await safe('ALTER TABLE employees ADD COLUMN branch_name VARCHAR(255) NULL');
    await safe('ALTER TABLE employees ADD COLUMN account_holder_name VARCHAR(255) NULL');
    await safe('ALTER TABLE employees ADD COLUMN pan_number VARCHAR(20) NULL');
    await safe('ALTER TABLE employees ADD COLUMN aadhar_number VARCHAR(20) NULL');

    // Needed by /api/hrms/salary
    await safe(
      "CREATE TABLE IF NOT EXISTS salary_slips (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, month VARCHAR(7) NOT NULL, pay_period_start DATE NULL, pay_period_end DATE NULL, basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0, hra DECIMAL(12,2) NOT NULL DEFAULT 0, conveyance_allowance DECIMAL(12,2) NOT NULL DEFAULT 0, medical_allowance DECIMAL(12,2) NOT NULL DEFAULT 0, special_allowance DECIMAL(12,2) NOT NULL DEFAULT 0, other_allowances DECIMAL(12,2) NOT NULL DEFAULT 0, gross_salary DECIMAL(12,2) NOT NULL DEFAULT 0, pf_deduction DECIMAL(12,2) NOT NULL DEFAULT 0, esi_deduction DECIMAL(12,2) NOT NULL DEFAULT 0, tax_deduction DECIMAL(12,2) NOT NULL DEFAULT 0, professional_tax DECIMAL(12,2) NOT NULL DEFAULT 0, other_deductions DECIMAL(12,2) NOT NULL DEFAULT 0, total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0, net_salary DECIMAL(12,2) NOT NULL DEFAULT 0, amount DECIMAL(12,2) NOT NULL DEFAULT 0, file_path VARCHAR(255) NULL, status VARCHAR(50) DEFAULT 'generated', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );
    await safe('ALTER TABLE salary_slips ADD COLUMN pay_period_start DATE NULL');
    await safe('ALTER TABLE salary_slips ADD COLUMN pay_period_end DATE NULL');
    await safe('ALTER TABLE salary_slips ADD COLUMN basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN hra DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN conveyance_allowance DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN medical_allowance DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN special_allowance DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN other_allowances DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN gross_salary DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN pf_deduction DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN esi_deduction DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN tax_deduction DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN professional_tax DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN other_deductions DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN net_salary DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE salary_slips ADD COLUMN amount DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe("ALTER TABLE salary_slips ADD COLUMN status VARCHAR(50) DEFAULT 'generated'");
    await safe('ALTER TABLE salary_slips ADD COLUMN file_path VARCHAR(255) NULL');
    await safe('ALTER TABLE salary_slips ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await safe('ALTER TABLE salary_slips ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

    // HRMS configuration tables
    await safe(
      "CREATE TABLE IF NOT EXISTS designations (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, description TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );
    await safe('CREATE UNIQUE INDEX uniq_designations_name ON designations(name)');

    await safe(
      "CREATE TABLE IF NOT EXISTS hr_shifts (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, grace_minutes INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );
    await safe('CREATE UNIQUE INDEX uniq_hr_shifts_name ON hr_shifts(name)');

    await safe(
      "CREATE TABLE IF NOT EXISTS hr_shift_assignments (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, shift_id INT NOT NULL, effective_from DATE NOT NULL, effective_to DATE NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );
    await safe('CREATE INDEX idx_shift_assign_employee ON hr_shift_assignments(employee_id)');
    await safe('CREATE INDEX idx_shift_assign_shift ON hr_shift_assignments(shift_id)');

    await safe(
      "CREATE TABLE IF NOT EXISTS hr_holidays (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150) NOT NULL, date DATE NOT NULL, description TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );
    await safe('CREATE INDEX idx_hr_holidays_date ON hr_holidays(date)');

    await safe(
      "CREATE TABLE IF NOT EXISTS hr_announcements (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200) NOT NULL, message TEXT NOT NULL, starts_at DATETIME NULL, ends_at DATETIME NULL, created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );
    await safe('CREATE INDEX idx_hr_announcements_dates ON hr_announcements(starts_at, ends_at)');

    await safe(
      "CREATE TABLE IF NOT EXISTS hr_settings (setting_key VARCHAR(120) PRIMARY KEY, setting_value TEXT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );

    await safe(
      "CREATE TABLE IF NOT EXISTS hr_leave_types (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, code VARCHAR(30) NULL, default_balance INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );
    await safe('CREATE UNIQUE INDEX uniq_leave_type_name ON hr_leave_types(name)');

    await safe(
      "CREATE TABLE IF NOT EXISTS hr_leave_balances (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, leave_type_id INT NOT NULL, balance INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_leave_balance (employee_id, leave_type_id))"
    );

    await safe(
      "CREATE TABLE IF NOT EXISTS performance_reviews (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, reviewer_id INT NOT NULL, period_start DATE NULL, period_end DATE NULL, rating VARCHAR(40) NOT NULL, goals TEXT NULL, feedback TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );
    await safe('CREATE INDEX idx_perf_employee ON performance_reviews(employee_id)');

    // Needed by /api/accounts
    await safe(
      'CREATE TABLE IF NOT EXISTS bank_accounts (id INT AUTO_INCREMENT PRIMARY KEY, bank_name VARCHAR(255) NOT NULL, account_holder_name VARCHAR(255) NULL, account_number VARCHAR(100) NOT NULL, ifsc_code VARCHAR(50) NULL, branch_name VARCHAR(255) NULL, balance DECIMAL(15,2) NOT NULL DEFAULT 0.00, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)'
    );

    // Needed by /api/hrms/attendance and /api/admin/attendance
    await safe('ALTER TABLE employee_checkins ADD COLUMN check_in_time TIME AFTER date');
    await safe('ALTER TABLE employee_checkins ADD COLUMN check_out_time TIME AFTER check_in_time');
    await safe('ALTER TABLE employee_checkins ADD COLUMN check_in_location VARCHAR(255) AFTER check_out_time');
    await safe('ALTER TABLE employee_checkins ADD COLUMN check_out_location VARCHAR(255) AFTER check_in_location');
    await safe('ALTER TABLE employee_checkins ADD COLUMN total_hours DECIMAL(5,2) DEFAULT 0 AFTER check_out_location');
    await safe("ALTER TABLE employee_checkins ADD COLUMN attendance_type ENUM('full_day','half_day') DEFAULT NULL AFTER total_hours");
    await safe('ALTER TABLE employee_checkins ADD COLUMN is_late TINYINT(1) NOT NULL DEFAULT 0 AFTER attendance_type');
    await safe('ALTER TABLE employee_checkins ADD COLUMN edit_reason TEXT NULL AFTER is_late');
    await safe('ALTER TABLE employee_checkins ADD COLUMN worked_seconds INT NOT NULL DEFAULT 0 AFTER total_hours');
    await safe('ALTER TABLE employee_checkins ADD COLUMN break_seconds INT NOT NULL DEFAULT 0 AFTER worked_seconds');
    await safe('ALTER TABLE employee_checkins ADD COLUMN overtime_seconds INT NOT NULL DEFAULT 0 AFTER break_seconds');
    await safe("ALTER TABLE employee_checkins ADD COLUMN target_seconds INT NOT NULL DEFAULT 28800 AFTER overtime_seconds");
    await safe('ALTER TABLE employee_checkins ADD COLUMN current_break_start_time TIME NULL AFTER target_seconds');
    await safe('ALTER TABLE employee_checkins ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await safe("ALTER TABLE employee_checkins MODIFY COLUMN status ENUM('pending','checked_in','on_break','checked_out','completed') DEFAULT 'pending'");
    await safe('CREATE INDEX idx_employee_checkins_date ON employee_checkins(date)');
    await safe(
      "CREATE TABLE IF NOT EXISTS break_logs (id INT AUTO_INCREMENT PRIMARY KEY, attendance_id INT NOT NULL, employee_id INT NOT NULL, break_date DATE NOT NULL, break_start_time TIME NOT NULL, break_end_time TIME NULL, break_seconds INT NOT NULL DEFAULT 0, status ENUM('active','completed') NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );
    await safe('CREATE INDEX idx_break_logs_attendance ON break_logs(attendance_id)');
    await safe('CREATE INDEX idx_break_logs_employee_date ON break_logs(employee_id, break_date)');

    // Backfill from legacy columns
    await safe('UPDATE employee_checkins SET check_in_time = time WHERE check_in_time IS NULL AND time IS NOT NULL');
    await safe('UPDATE employee_checkins SET check_in_location = location WHERE check_in_location IS NULL AND location IS NOT NULL');
    await safe("UPDATE employee_checkins SET status = 'checked_in' WHERE status IS NULL OR status = ''");
    await safe("UPDATE employee_checkins SET target_seconds = 28800 WHERE target_seconds IS NULL OR target_seconds = 0");
    await safe("UPDATE employee_checkins SET worked_seconds = ROUND(COALESCE(total_hours, 0) * 3600) WHERE worked_seconds IS NULL OR worked_seconds = 0");

    // Backfill employee profile/bank fields so View Details doesn't show N/A for demo records.
    await safe("UPDATE employees SET account_holder_name = name WHERE account_holder_name IS NULL OR account_holder_name = ''");
    await safe("UPDATE employees SET bank_name = 'HDFC Bank' WHERE bank_name IS NULL OR bank_name = ''");
    await safe("UPDATE employees SET bank_account = CONCAT('98765', LPAD(id, 6, '0')) WHERE bank_account IS NULL OR bank_account = ''");
    await safe("UPDATE employees SET ifsc_code = 'HDFC0001234' WHERE ifsc_code IS NULL OR ifsc_code = ''");
    await safe("UPDATE employees SET branch_name = 'Hyderabad Main Branch' WHERE branch_name IS NULL OR branch_name = ''");
    await safe("UPDATE employees SET pan_number = CONCAT('AAAAA', LPAD(id, 4, '0'), 'A') WHERE pan_number IS NULL OR pan_number = ''");
    await safe("UPDATE employees SET aadhar_number = CONCAT('9999', LPAD(id, 8, '0')) WHERE aadhar_number IS NULL OR aadhar_number = ''");
    await safe("UPDATE employees SET qualification = 'Graduate' WHERE qualification IS NULL OR qualification = ''");
    await safe("UPDATE employees SET previous_company = 'Tech Solutions Pvt Ltd' WHERE previous_company IS NULL OR previous_company = ''");
    await safe("UPDATE employees SET experience_years = 2 WHERE experience_years IS NULL OR experience_years = ''");

    // Needed by /api/inventory (expanded inventory management)
    await safe(
      "CREATE TABLE IF NOT EXISTS inventory (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, item_code VARCHAR(100) NOT NULL, barcode VARCHAR(100) NULL, category VARCHAR(100) NULL, sub_category VARCHAR(100) NULL, location VARCHAR(255) NULL, quantity INT NOT NULL DEFAULT 0, minimum_stock_level INT NOT NULL DEFAULT 0, unit_price DECIMAL(12,2) NOT NULL DEFAULT 0, supplier VARCHAR(255) NULL, purchase_date DATE NULL, description TEXT NULL, status ENUM('available','in_use','maintenance','broken') DEFAULT 'available', assigned_to_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );
    await safe('ALTER TABLE inventory ADD COLUMN item_code VARCHAR(100) NOT NULL');
    await safe('ALTER TABLE inventory ADD COLUMN barcode VARCHAR(100) NULL');
    await safe('ALTER TABLE inventory ADD COLUMN sub_category VARCHAR(100) NULL');
    await safe('ALTER TABLE inventory ADD COLUMN location VARCHAR(255) NULL');
    await safe('ALTER TABLE inventory ADD COLUMN minimum_stock_level INT NOT NULL DEFAULT 0');
    await safe('ALTER TABLE inventory ADD COLUMN unit_price DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safe('ALTER TABLE inventory ADD COLUMN supplier VARCHAR(255) NULL');
    await safe('ALTER TABLE inventory ADD COLUMN purchase_date DATE NULL');
    await safe('ALTER TABLE inventory ADD COLUMN description TEXT NULL');
    await safe('ALTER TABLE inventory ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await safe('ALTER TABLE inventory ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await safe('CREATE UNIQUE INDEX uniq_inventory_item_code ON inventory(item_code)');
    await safe('CREATE INDEX idx_inventory_barcode ON inventory(barcode)');
    await safe("UPDATE inventory SET item_code = CONCAT('ITM', LPAD(id, 5, '0')) WHERE (item_code IS NULL OR item_code = '')");

    // API integration tables
    await safe('ALTER TABLE leads ADD COLUMN company_id INT NULL AFTER id');
    await safe(
      "CREATE TABLE IF NOT EXISTS api_logs (id INT AUTO_INCREMENT PRIMARY KEY, company_id INT NULL, endpoint VARCHAR(255) NOT NULL, method VARCHAR(10) NOT NULL, request_body LONGTEXT NULL, response_status INT NOT NULL DEFAULT 0, success TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
    );
    await safe('CREATE INDEX idx_api_logs_company ON api_logs(company_id)');
    await safe(
      "CREATE TABLE IF NOT EXISTS webhook_logs (id INT AUTO_INCREMENT PRIMARY KEY, company_id INT NULL, source VARCHAR(50) NULL, payload LONGTEXT NULL, response_status INT NOT NULL DEFAULT 0, success TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
    );
    await safe('CREATE INDEX idx_webhook_logs_company ON webhook_logs(company_id)');
    await safe(
      "CREATE TABLE IF NOT EXISTS import_jobs (id INT AUTO_INCREMENT PRIMARY KEY, company_id INT NULL, file_name VARCHAR(255) NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending', total_rows INT NOT NULL DEFAULT 0, success_count INT NOT NULL DEFAULT 0, failure_count INT NOT NULL DEFAULT 0, errors TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"
    );
    await safe('CREATE INDEX idx_import_jobs_company ON import_jobs(company_id)');

    console.log('Schema alignment complete.');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
