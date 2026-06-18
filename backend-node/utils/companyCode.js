const { query } = require('../config/database');
const { ensureEmployeeCodeSchema } = require('./employeeCodeSchema');

const EMPLOYEE_CODE_SERIAL_LENGTH = 5;
const EMPLOYEE_CODE_COMPANY_MAX_LENGTH = 6;

function normalizeCodePart(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function deriveCompanyCodeFromName(companyName, fallback = 'CMP') {
  const raw = String(companyName || '').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  const initials = parts.map((part) => part.charAt(0)).join('');

  if (parts.length > 1) {
    return normalizeCodePart(initials).slice(0, 6) || fallback;
  }

  return normalizeCodePart(raw).slice(0, 6) || fallback;
}

function normalizeCompanyCode(input, companyName = '') {
  const raw = normalizeCodePart(input);
  const name = String(companyName || '').toLowerCase().trim();

  if (raw.startsWith('MARCOM')) return 'VG';
  if (/^COMP\d+$/.test(raw)) {
    return deriveCompanyCodeFromName(companyName, 'CMP');
  }
  if (name.includes('marcom') || name.includes('vanya') || name.includes('vg')) {
    return raw || 'VG';
  }

  if (raw) return raw;
  return deriveCompanyCodeFromName(companyName);
}

function compactEmployeeCompanyCode(companyCode, companyName = '') {
  const normalized = normalizeCompanyCode(companyCode, companyName);
  return (normalized || 'CMP').slice(0, EMPLOYEE_CODE_COMPANY_MAX_LENGTH) || 'CMP';
}

async function runEmployeeCodeQuery(connection, sql, params = []) {
  if (!connection) {
    return query(sql, params);
  }

  const [rows] = await connection.query(sql, params);
  return rows;
}

async function getNextEmployeeCodeSerial(prefix, options = {}) {
  const connection = options.connection || null;

  if (!connection) {
    await ensureEmployeeCodeSchema();
  }

  const rows = await runEmployeeCodeQuery(
    connection,
    `SELECT employee_code
     FROM employees
     WHERE employee_code LIKE ?
       AND employee_code REGEXP ?
     ORDER BY CAST(SUBSTRING(employee_code, ?) AS UNSIGNED) DESC
     LIMIT 1`,
    [`${prefix}%`, `^${prefix}[0-9]{${EMPLOYEE_CODE_SERIAL_LENGTH}}$`, prefix.length + 1]
  );

  const lastCode = rows && rows[0] ? String(rows[0].employee_code || '') : '';
  const lastSerial = lastCode.startsWith(prefix)
    ? Number(lastCode.slice(prefix.length)) || 0
    : 0;
  const nextSerial = lastSerial + 1;

  if (nextSerial > Number('9'.repeat(EMPLOYEE_CODE_SERIAL_LENGTH))) {
    throw new Error(`Employee code serial exceeded for ${prefix}`);
  }

  return String(nextSerial).padStart(EMPLOYEE_CODE_SERIAL_LENGTH, '0');
}

async function buildCompanyScopedEmployeeCode(companyCode, companyId, scope = 'EMP', options = {}) {
  const companyName = options.companyName || '';
  const normalizedCompanyCode = compactEmployeeCompanyCode(companyCode, companyName);
  const normalizedScope = normalizeCodePart(scope) || 'EMP';
  const prefix = `${normalizedCompanyCode}${normalizedScope}`;
  const serial = await getNextEmployeeCodeSerial(prefix, options);
  return `${prefix}${serial}`;
}

function buildCompanyAdminEmployeeCode(companyCode, companyId, options = {}) {
  return buildCompanyScopedEmployeeCode(companyCode, companyId, 'ADM', options);
}

module.exports = {
  buildCompanyAdminEmployeeCode,
  buildCompanyScopedEmployeeCode,
  compactEmployeeCompanyCode,
  deriveCompanyCodeFromName,
  normalizeCodePart,
  normalizeCompanyCode,
};
