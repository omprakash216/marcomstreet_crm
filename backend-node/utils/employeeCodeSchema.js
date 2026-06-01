const { query } = require('../config/database');

let ensurePromise = null;

function isIgnorableSchemaError(err) {
  const msg = String(err?.message || err?.sqlMessage || '');
  return (
    err?.code === 'ER_DUP_FIELDNAME' ||
    err?.code === 'ER_DUP_KEYNAME' ||
    /Duplicate column name/i.test(msg) ||
    /Duplicate key name/i.test(msg)
  );
}

async function safeSchemaQuery(sql) {
  try {
    return await query(sql);
  } catch (err) {
    if (isIgnorableSchemaError(err)) return null;
    throw err;
  }
}

async function columnExists(tableName, columnName) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  return Array.isArray(rows) && rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) return;
  await safeSchemaQuery(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function indexExists(tableName, indexName) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );

  return Array.isArray(rows) && rows.length > 0;
}

async function uniqueColumnIndexExists(tableName, columnName) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
       AND NON_UNIQUE = 0
     LIMIT 1`,
    [tableName, columnName]
  );

  return Array.isArray(rows) && rows.length > 0;
}

async function addIndexIfMissing(tableName, indexName, ddl) {
  if (await indexExists(tableName, indexName)) return;
  await safeSchemaQuery(ddl);
}

async function setFallbackEmployeeCode(employeeId) {
  const code = `LEGACY${String(employeeId).padStart(8, '0')}`;
  try {
    await query('UPDATE employees SET employee_code = ? WHERE id = ?', [code, employeeId]);
  } catch (err) {
    if (err?.code !== 'ER_DUP_ENTRY') throw err;
    await query('UPDATE employees SET employee_code = ? WHERE id = ?', [`${code}${Date.now().toString().slice(-6)}`, employeeId]);
  }
}

async function normalizeDuplicateEmployeeCodes() {
  const emptyRows = await query(
    `SELECT id
     FROM employees
     WHERE employee_code IS NULL OR TRIM(employee_code) = ''
     ORDER BY id`
  );

  for (const row of emptyRows || []) {
    await setFallbackEmployeeCode(row.id);
  }

  const duplicateCodes = await query(
    `SELECT employee_code
     FROM employees
     WHERE employee_code IS NOT NULL AND TRIM(employee_code) <> ''
     GROUP BY employee_code
     HAVING COUNT(*) > 1`
  );

  for (const row of duplicateCodes || []) {
    const employees = await query(
      'SELECT id FROM employees WHERE employee_code = ? ORDER BY id',
      [row.employee_code]
    );

    for (const employee of (employees || []).slice(1)) {
      await setFallbackEmployeeCode(employee.id);
    }
  }
}

async function addUniqueEmployeeCodeIfMissing() {
  if (await uniqueColumnIndexExists('employees', 'employee_code')) return;
  await normalizeDuplicateEmployeeCodes();
  await safeSchemaQuery('ALTER TABLE employees ADD UNIQUE KEY uniq_employee_code (employee_code)');
}

async function seedDesignation(name, code, description = null) {
  await safeSchemaQuery(
    `INSERT INTO designations (name, designation_code, description)
     SELECT ${queryValue(name)}, ${queryValue(code)}, ${queryValue(description || name)}
     WHERE NOT EXISTS (
       SELECT 1 FROM designations
       WHERE UPPER(TRIM(COALESCE(designation_code, ''))) = ${queryValue(String(code).toUpperCase())}
          OR LOWER(TRIM(name)) = ${queryValue(String(name).toLowerCase())}
     )`
  );
}

function queryValue(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

async function ensureEmployeeCodeSchemaNow() {
  await safeSchemaQuery(`
    CREATE TABLE IF NOT EXISTS designations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      designation_code VARCHAR(20) NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing('companies', 'company_code', 'VARCHAR(20) NULL');
  await addColumnIfMissing('departments', 'company_id', 'INT NULL');
  await addColumnIfMissing('departments', 'department_code', 'VARCHAR(20) NULL');
  await addColumnIfMissing('designations', 'designation_code', 'VARCHAR(20) NULL');
  await addColumnIfMissing('employees', 'company_id', 'INT NULL');
  await addColumnIfMissing('employees', 'employee_code', 'VARCHAR(50) NULL');
  await addColumnIfMissing('employees', 'designation_id', 'INT NULL');
  await addColumnIfMissing('employees', 'joining_date', 'DATE NULL');

  await safeSchemaQuery(`
    UPDATE companies
    SET company_code = CASE
      WHEN LOWER(COALESCE(company_name, '')) LIKE '%vanya%' OR LOWER(COALESCE(company_name, '')) LIKE '%vg%' THEN 'VG'
      ELSE UPPER(LEFT(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(company_name, '')), ' ', ''), '/', ''), '-', ''), '.', ''), 6))
    END
    WHERE company_code IS NULL OR TRIM(company_code) = ''
  `);

  await safeSchemaQuery(`
    UPDATE companies
    SET company_code = CONCAT('C', LPAD(id, 3, '0'))
    WHERE company_code IS NULL OR TRIM(company_code) = ''
  `);

  await safeSchemaQuery(`
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
      ELSE UPPER(LEFT(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(name, '')), ' ', ''), '/', ''), '-', ''), '.', ''), 8))
    END
    WHERE department_code IS NULL OR TRIM(department_code) = ''
  `);

  await seedDesignation('Employee', 'EMP');
  await seedDesignation('Manager', 'MGR');
  await seedDesignation('Team Leader', 'TL');
  await seedDesignation('Department Head', 'HEAD');
  await seedDesignation('Supervisor', 'SUP');
  await seedDesignation('Admin', 'ADM');
  await seedDesignation('Director', 'DIR');
  await seedDesignation('Executive', 'EXE');
  await seedDesignation('Intern', 'INT');

  await safeSchemaQuery(`
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
      ELSE UPPER(LEFT(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(name, '')), ' ', ''), '/', ''), '-', ''), '.', ''), 8))
    END
    WHERE designation_code IS NULL OR TRIM(designation_code) = ''
  `);

  await addIndexIfMissing('companies', 'idx_companies_company_code', 'CREATE INDEX idx_companies_company_code ON companies (company_code)');
  await addIndexIfMissing('departments', 'idx_departments_department_code', 'CREATE INDEX idx_departments_department_code ON departments (department_code)');
  await addIndexIfMissing('designations', 'idx_designations_designation_code', 'CREATE INDEX idx_designations_designation_code ON designations (designation_code)');
  await addIndexIfMissing('employees', 'idx_employees_code_parts', 'CREATE INDEX idx_employees_code_parts ON employees (company_id, department_id, designation_id, joining_date)');
  await addUniqueEmployeeCodeIfMissing();
}

async function ensureEmployeeCodeSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureEmployeeCodeSchemaNow().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }

  return ensurePromise;
}

module.exports = { ensureEmployeeCodeSchema };
