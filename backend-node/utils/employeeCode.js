const mysqlFormat = require('mysql2').format;
const { query } = require('../config/database');
const { ensureEmployeeCodeSchema } = require('./employeeCodeSchema');
const { compactEmployeeCompanyCode } = require('./companyCode');

const SERIAL_LENGTH = 5;
const MAX_SERIAL = Number('9'.repeat(SERIAL_LENGTH));
const MAX_PREFIX_PART_LENGTH = 4;

function normalizeCodePart(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function compactCodePart(value, maxLength = MAX_PREFIX_PART_LENGTH) {
  const normalized = normalizeCodePart(value);
  return normalized.slice(0, maxLength);
}

function employeeCodeError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.isEmployeeCodeValidation = true;
  return err;
}

function normalizeId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw employeeCodeError(`${label} is required`);
  }
  return id;
}

function parseJoiningYear(joiningDate) {
  const raw = String(joiningDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw employeeCodeError('Valid joining_date is required');
  }

  const [year, month, day] = raw.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day;

  if (!isValid) {
    throw employeeCodeError('Valid joining_date is required');
  }

  return String(year);
}

function safeParams(params) {
  return (Array.isArray(params) ? params : [params]).map((p) => (
    p === undefined || (typeof p === 'number' && Number.isNaN(p)) ? null : p
  ));
}

async function runSql(connection, sql, params = []) {
  if (!connection) {
    return query(sql, params);
  }

  const finalSql = params && params.length ? mysqlFormat(sql, safeParams(params)) : sql;
  const [rows] = await connection.query(finalSql);
  return rows;
}

async function fetchCodeParts(companyId, departmentId, designationId, options = {}) {
  if (!options.connection) {
    await ensureEmployeeCodeSchema();
  }

  const connection = options.connection || null;
  const cid = normalizeId(companyId, 'Company');
  const did = normalizeId(departmentId, 'Department');
  const gid = normalizeId(designationId, 'Designation');

  const [company] = await runSql(
    connection,
    'SELECT id, company_code, company_name FROM companies WHERE id = ? LIMIT 1',
    [cid]
  );
  if (!company) throw employeeCodeError('Company not found', 404);

  const [department] = await runSql(
    connection,
    'SELECT id, company_id, department_code, name FROM departments WHERE id = ? LIMIT 1',
    [did]
  );
  if (!department) throw employeeCodeError('Department not found', 404);

  if (
    department.company_id !== undefined &&
    department.company_id !== null &&
    Number(department.company_id) !== cid
  ) {
    throw employeeCodeError('Department does not belong to selected company');
  }

  const [designation] = await runSql(
    connection,
    'SELECT id, designation_code, name FROM designations WHERE id = ? LIMIT 1',
    [gid]
  );
  if (!designation) throw employeeCodeError('Designation not found', 404);

  const companyCode = compactEmployeeCompanyCode(company.company_code, company.company_name);
  const departmentCode = compactCodePart(department.department_code);
  const designationCode = compactCodePart(designation.designation_code);

  if (!companyCode) throw employeeCodeError('company_code is required for selected company');
  if (!departmentCode) throw employeeCodeError('department_code is required for selected department');
  if (!designationCode) throw employeeCodeError('designation_code is required for selected designation');

  return {
    company,
    department,
    designation,
    companyCode,
    departmentCode,
    designationCode,
  };
}

async function buildEmployeeCodePrefix(companyId, departmentId, designationId, joiningDate, options = {}) {
  const parts = await fetchCodeParts(companyId, departmentId, designationId, options);

  return {
    ...parts,
    prefix: `${parts.companyCode}${parts.departmentCode}${parts.designationCode}`,
  };
}

async function generateEmployeeCode(companyId, departmentId, designationId, joiningDate, options = {}) {
  const connection = options.connection || null;
  const excludeEmployeeId = options.excludeEmployeeId ? Number(options.excludeEmployeeId) : null;
  const { prefix } = await buildEmployeeCodePrefix(
    companyId,
    departmentId,
    designationId,
    joiningDate,
    { connection }
  );

  const where = ['employee_code LIKE ?', 'employee_code REGEXP ?'];
  const params = [`${prefix}%`, `^${prefix}[0-9]{${SERIAL_LENGTH}}$`];

  if (excludeEmployeeId && Number.isInteger(excludeEmployeeId) && excludeEmployeeId > 0) {
    where.push('id <> ?');
    params.push(excludeEmployeeId);
  }

  params.push(prefix.length + 1);

  const lockClause = connection && options.lock !== false ? ' FOR UPDATE' : '';
  const rows = await runSql(
    connection,
    `SELECT employee_code
     FROM employees
     WHERE ${where.join(' AND ')}
     ORDER BY CAST(SUBSTRING(employee_code, ?) AS UNSIGNED) DESC
     LIMIT 1${lockClause}`,
    params
  );

  const lastCode = rows && rows[0] ? String(rows[0].employee_code || '') : '';
  const lastSerial = lastCode.startsWith(prefix)
    ? Number(lastCode.slice(prefix.length)) || 0
    : 0;
  const nextSerial = lastSerial + 1;

  if (nextSerial > MAX_SERIAL) {
    throw employeeCodeError(`Employee code serial exceeded ${String(MAX_SERIAL).padStart(SERIAL_LENGTH, '9')} for ${prefix}`);
  }

  return `${prefix}${String(nextSerial).padStart(SERIAL_LENGTH, '0')}`;
}

async function getDesignationById(designationId, options = {}) {
  const id = normalizeId(designationId, 'Designation');
  const rows = await runSql(
    options.connection || null,
    'SELECT id, name, designation_code FROM designations WHERE id = ? LIMIT 1',
    [id]
  );
  return rows && rows[0] ? rows[0] : null;
}

function isEmployeeCodeDuplicateError(err) {
  const message = String(err?.sqlMessage || err?.message || '');
  return err?.code === 'ER_DUP_ENTRY' && /employee_code|uniq_employee_code/i.test(message);
}

function isEmployeeCodeValidationError(err) {
  return Boolean(err?.isEmployeeCodeValidation);
}

module.exports = {
  buildEmployeeCodePrefix,
  fetchCodeParts,
  generateEmployeeCode,
  getDesignationById,
  isEmployeeCodeDuplicateError,
  isEmployeeCodeValidationError,
  normalizeCodePart,
  parseJoiningYear,
  runSql,
};
