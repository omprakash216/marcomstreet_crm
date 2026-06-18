-- Migration 009: Standard employee code format
-- Format: COMPANYCODE + DEPARTMENTCODE + DESIGNATIONCODE + SERIAL
-- Example: VGHRMGR00001

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing$$
CREATE PROCEDURE add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN ', p_column_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS add_index_if_missing$$
CREATE PROCEDURE add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_ddl TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @ddl = p_index_ddl;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS add_unique_employee_code_if_missing$$
CREATE PROCEDURE add_unique_employee_code_if_missing()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'employees'
      AND COLUMN_NAME = 'employee_code'
      AND NON_UNIQUE = 0
  ) THEN
    ALTER TABLE employees ADD UNIQUE KEY uniq_employee_code (employee_code);
  END IF;
END$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS designations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  designation_code VARCHAR(20) NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL add_column_if_missing('companies', 'company_code', '`company_code` VARCHAR(20) NULL');
CALL add_column_if_missing('departments', 'company_id', '`company_id` INT NULL');
CALL add_column_if_missing('departments', 'department_code', '`department_code` VARCHAR(20) NULL');
CALL add_column_if_missing('designations', 'designation_code', '`designation_code` VARCHAR(20) NULL');
CALL add_column_if_missing('employees', 'company_id', '`company_id` INT NULL');
CALL add_column_if_missing('employees', 'employee_code', '`employee_code` VARCHAR(50) NULL');
CALL add_column_if_missing('employees', 'designation_id', '`designation_id` INT NULL');
CALL add_column_if_missing('employees', 'joining_date', '`joining_date` DATE NULL');

UPDATE companies
SET company_code = CASE
  WHEN LOWER(company_name) LIKE '%vanya%' OR LOWER(company_name) LIKE '%vg%' THEN 'VG'
  ELSE COALESCE(NULLIF(UPPER(LEFT(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(company_name, '')), ' ', ''), '/', ''), '-', ''), '.', ''), 6)), ''), 'CMP')
END
WHERE company_code IS NULL OR TRIM(company_code) = '';

UPDATE companies
SET company_code = CONCAT('C', LPAD(id, 3, '0'))
WHERE company_code IS NULL OR TRIM(company_code) = '';

UPDATE departments
SET department_code = CASE
  WHEN UPPER(TRIM(name)) IN ('HR', 'HUMAN RESOURCE', 'HUMAN RESOURCES') THEN 'HR'
  WHEN UPPER(TRIM(name)) IN ('IT', 'INFORMATION TECHNOLOGY') THEN 'IT'
  WHEN UPPER(TRIM(name)) IN ('ACC', 'ACCOUNTS', 'ACCOUNT', 'FINANCE') THEN 'ACC'
  WHEN UPPER(TRIM(name)) IN ('SALES', 'SALE') THEN 'SALES'
  WHEN UPPER(TRIM(name)) IN ('MKT', 'MARKETING') THEN 'MKT'
  WHEN UPPER(TRIM(name)) IN ('CRM', 'CRM TEAM') THEN 'CRM'
  WHEN UPPER(TRIM(name)) IN ('ADM', 'ADMIN', 'ADMINISTRATION', 'MANAGEMENT') THEN 'ADM'
  WHEN UPPER(TRIM(name)) IN ('WH', 'WAREHOUSE') THEN 'WH'
  WHEN UPPER(TRIM(name)) IN ('SUP', 'SUPPORT') THEN 'SUP'
  WHEN UPPER(TRIM(name)) IN ('PRD', 'PRODUCTION') THEN 'PRD'
  WHEN UPPER(TRIM(name)) IN ('DES', 'DESIGNER', 'DESIGN', 'CREATIVE') THEN 'DES'
  ELSE COALESCE(NULLIF(UPPER(LEFT(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(name, '')), ' ', ''), '/', ''), '-', ''), '.', ''), 8)), ''), 'DEP')
END
WHERE department_code IS NULL OR TRIM(department_code) = '';

INSERT INTO designations (name, designation_code, description)
SELECT 'Employee', 'EMP', 'Employee'
WHERE NOT EXISTS (SELECT 1 FROM designations WHERE designation_code = 'EMP' OR LOWER(name) = 'employee');

INSERT INTO designations (name, designation_code, description)
SELECT 'Manager', 'MGR', 'Manager'
WHERE NOT EXISTS (SELECT 1 FROM designations WHERE designation_code = 'MGR' OR LOWER(name) = 'manager');

INSERT INTO designations (name, designation_code, description)
SELECT 'Team Leader', 'TL', 'Team Leader'
WHERE NOT EXISTS (SELECT 1 FROM designations WHERE designation_code = 'TL' OR LOWER(name) IN ('team leader', 'team lead'));

INSERT INTO designations (name, designation_code, description)
SELECT 'Department Head', 'HEAD', 'Department Head'
WHERE NOT EXISTS (SELECT 1 FROM designations WHERE designation_code = 'HEAD' OR LOWER(name) = 'department head');

INSERT INTO designations (name, designation_code, description)
SELECT 'Supervisor', 'SUP', 'Supervisor'
WHERE NOT EXISTS (SELECT 1 FROM designations WHERE designation_code = 'SUP' OR LOWER(name) = 'supervisor');

INSERT INTO designations (name, designation_code, description)
SELECT 'Admin', 'ADM', 'Admin'
WHERE NOT EXISTS (SELECT 1 FROM designations WHERE designation_code = 'ADM' OR LOWER(name) = 'admin');

INSERT INTO designations (name, designation_code, description)
SELECT 'Director', 'DIR', 'Director'
WHERE NOT EXISTS (SELECT 1 FROM designations WHERE designation_code = 'DIR' OR LOWER(name) = 'director');

INSERT INTO designations (name, designation_code, description)
SELECT 'Executive', 'EXE', 'Executive'
WHERE NOT EXISTS (SELECT 1 FROM designations WHERE designation_code = 'EXE' OR LOWER(name) = 'executive');

INSERT INTO designations (name, designation_code, description)
SELECT 'Intern', 'INT', 'Intern'
WHERE NOT EXISTS (SELECT 1 FROM designations WHERE designation_code = 'INT' OR LOWER(name) = 'intern');

UPDATE designations
SET designation_code = CASE
  WHEN UPPER(TRIM(name)) IN ('EMP', 'EMPLOYEE', 'STAFF') THEN 'EMP'
  WHEN UPPER(TRIM(name)) IN ('MGR', 'MANAGER') OR UPPER(name) LIKE '%MANAGER%' THEN 'MGR'
  WHEN UPPER(TRIM(name)) IN ('TL', 'TEAM LEADER', 'TEAM LEAD') OR UPPER(name) LIKE '%TEAM LEAD%' THEN 'TL'
  WHEN UPPER(TRIM(name)) IN ('HEAD', 'DEPARTMENT HEAD') OR UPPER(name) LIKE '%HEAD%' THEN 'HEAD'
  WHEN UPPER(TRIM(name)) IN ('SUP', 'SUPERVISOR') OR UPPER(name) LIKE '%SUPERVISOR%' THEN 'SUP'
  WHEN UPPER(TRIM(name)) IN ('ADM', 'ADMIN', 'ADMINISTRATOR') OR UPPER(name) LIKE '%ADMIN%' THEN 'ADM'
  WHEN UPPER(TRIM(name)) IN ('DIR', 'DIRECTOR') OR UPPER(name) LIKE '%DIRECTOR%' THEN 'DIR'
  WHEN UPPER(TRIM(name)) IN ('EXE', 'EXECUTIVE') OR UPPER(name) LIKE '%EXECUTIVE%' THEN 'EXE'
  WHEN UPPER(TRIM(name)) IN ('INT', 'INTERN') OR UPPER(name) LIKE '%INTERN%' THEN 'INT'
  ELSE COALESCE(NULLIF(UPPER(LEFT(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(name, '')), ' ', ''), '/', ''), '-', ''), '.', ''), 8)), ''), 'DSG')
END
WHERE designation_code IS NULL OR TRIM(designation_code) = '';

UPDATE employees e
JOIN designations d
  ON UPPER(TRIM(e.designation)) = UPPER(TRIM(d.name))
  OR UPPER(TRIM(e.designation)) = UPPER(TRIM(d.designation_code))
SET e.designation_id = d.id
WHERE e.designation_id IS NULL
  AND e.designation IS NOT NULL
  AND TRIM(e.designation) <> '';

UPDATE employees e
SET designation_id = (SELECT id FROM designations WHERE designation_code = 'MGR' ORDER BY id LIMIT 1)
WHERE designation_id IS NULL AND UPPER(COALESCE(designation, '')) LIKE '%MANAGER%';

UPDATE employees e
SET designation_id = (SELECT id FROM designations WHERE designation_code = 'TL' ORDER BY id LIMIT 1)
WHERE designation_id IS NULL AND (UPPER(COALESCE(designation, '')) LIKE '%TEAM LEAD%' OR UPPER(COALESCE(designation, '')) LIKE '%TEAM LEADER%');

UPDATE employees e
SET designation_id = (SELECT id FROM designations WHERE designation_code = 'HEAD' ORDER BY id LIMIT 1)
WHERE designation_id IS NULL AND UPPER(COALESCE(designation, '')) LIKE '%HEAD%';

UPDATE employees e
SET designation_id = (SELECT id FROM designations WHERE designation_code = 'SUP' ORDER BY id LIMIT 1)
WHERE designation_id IS NULL AND UPPER(COALESCE(designation, '')) LIKE '%SUPERVISOR%';

UPDATE employees e
SET designation_id = (SELECT id FROM designations WHERE designation_code = 'ADM' ORDER BY id LIMIT 1)
WHERE designation_id IS NULL AND UPPER(COALESCE(designation, '')) LIKE '%ADMIN%';

UPDATE employees e
SET designation_id = (SELECT id FROM designations WHERE designation_code = 'DIR' ORDER BY id LIMIT 1)
WHERE designation_id IS NULL AND UPPER(COALESCE(designation, '')) LIKE '%DIRECTOR%';

UPDATE employees e
SET designation_id = (SELECT id FROM designations WHERE designation_code = 'INT' ORDER BY id LIMIT 1)
WHERE designation_id IS NULL AND UPPER(COALESCE(designation, '')) LIKE '%INTERN%';

UPDATE employees e
SET designation_id = (SELECT id FROM designations WHERE designation_code = 'EXE' ORDER BY id LIMIT 1)
WHERE designation_id IS NULL AND UPPER(COALESCE(designation, '')) LIKE '%EXECUTIVE%';

UPDATE employees e
SET designation_id = (SELECT id FROM designations WHERE designation_code = 'EMP' ORDER BY id LIMIT 1)
WHERE designation_id IS NULL;

UPDATE employees
SET joining_date = DATE(COALESCE(created_at, CURRENT_DATE()))
WHERE joining_date IS NULL;

UPDATE employees
SET employee_code = CONCAT('LEGACY', LPAD(id, 8, '0'));

DELIMITER $$

DROP PROCEDURE IF EXISTS standardize_existing_employee_codes$$
CREATE PROCEDURE standardize_existing_employee_codes()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_employee_id INT;
  DECLARE v_prefix VARCHAR(80);
  DECLARE v_serial INT DEFAULT 0;

  DECLARE employee_cursor CURSOR FOR
    SELECT
      e.id,
      CONCAT(
        UPPER(c.company_code),
        UPPER(d.department_code),
        UPPER(g.designation_code)
      ) AS prefix
    FROM employees e
    JOIN companies c ON c.id = e.company_id
    JOIN departments d ON d.id = e.department_id
    JOIN designations g ON g.id = e.designation_id
    WHERE c.company_code IS NOT NULL AND TRIM(c.company_code) <> ''
      AND d.department_code IS NOT NULL AND TRIM(d.department_code) <> ''
      AND g.designation_code IS NOT NULL AND TRIM(g.designation_code) <> ''
      AND e.joining_date IS NOT NULL
      AND c.company_code REGEXP '^[A-Za-z0-9]+$'
      AND d.department_code REGEXP '^[A-Za-z0-9]+$'
      AND g.designation_code REGEXP '^[A-Za-z0-9]+$'
    ORDER BY prefix, e.joining_date, e.id;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  CREATE TEMPORARY TABLE IF NOT EXISTS tmp_employee_code_sequence (
    prefix VARCHAR(80) PRIMARY KEY,
    serial INT NOT NULL DEFAULT 0
  ) ENGINE=MEMORY;

  UPDATE employees e
  JOIN companies c ON c.id = e.company_id
  JOIN departments d ON d.id = e.department_id
  JOIN designations g ON g.id = e.designation_id
  SET e.employee_code = CONCAT('MIG', LEFT(REPLACE(UUID(), '-', ''), 29))
  WHERE c.company_code IS NOT NULL AND TRIM(c.company_code) <> ''
    AND d.department_code IS NOT NULL AND TRIM(d.department_code) <> ''
    AND g.designation_code IS NOT NULL AND TRIM(g.designation_code) <> ''
    AND e.joining_date IS NOT NULL
    AND c.company_code REGEXP '^[A-Za-z0-9]+$'
    AND d.department_code REGEXP '^[A-Za-z0-9]+$'
    AND g.designation_code REGEXP '^[A-Za-z0-9]+$';

  OPEN employee_cursor;

  read_loop: LOOP
    FETCH employee_cursor INTO v_employee_id, v_prefix;
    IF done THEN
      LEAVE read_loop;
    END IF;

    INSERT INTO tmp_employee_code_sequence (prefix, serial)
    VALUES (v_prefix, 1)
    ON DUPLICATE KEY UPDATE serial = serial + 1;

    SELECT serial INTO v_serial
    FROM tmp_employee_code_sequence
    WHERE prefix = v_prefix;

    UPDATE employees
    SET employee_code = CONCAT(v_prefix, LPAD(v_serial, 5, '0'))
    WHERE id = v_employee_id;
  END LOOP;

  CLOSE employee_cursor;
END$$

DELIMITER ;

CALL standardize_existing_employee_codes();

ALTER TABLE employees MODIFY COLUMN employee_code VARCHAR(50) NOT NULL;

CALL add_index_if_missing('companies', 'idx_companies_company_code', 'CREATE INDEX idx_companies_company_code ON companies (company_code)');
CALL add_index_if_missing('departments', 'idx_departments_department_code', 'CREATE INDEX idx_departments_department_code ON departments (department_code)');
CALL add_index_if_missing('designations', 'idx_designations_designation_code', 'CREATE INDEX idx_designations_designation_code ON designations (designation_code)');
CALL add_index_if_missing('employees', 'idx_employees_code_parts', 'CREATE INDEX idx_employees_code_parts ON employees (company_id, department_id, designation_id, joining_date)');
CALL add_unique_employee_code_if_missing();

DROP PROCEDURE IF EXISTS standardize_existing_employee_codes;
DROP PROCEDURE IF EXISTS add_unique_employee_code_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS add_column_if_missing;
