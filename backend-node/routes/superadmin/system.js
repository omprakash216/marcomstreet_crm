const express = require('express');
const os = require('os');
const mysqlFormat = require('mysql2').format;
const { getConnection, query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

const BACKUP_SCHEMA_VERSION = 'crm-company-backup-v2';
const EXPORT_TIMEOUT_NOTE = 'This export contains database rows in JSON format. Uploaded files referenced by file_path fields must be backed up from storage separately.';

const TABLE_GROUPS = {
  core: [
    'company_settings',
    'company_modules',
    'employee_module_access',
    'api_keys',
    'webhooks',
    'company_usage',
  ],
  crm: [
    'leads',
    'followups',
    'tasks',
    'meetings',
    'quotations',
    'quotation_items',
    'invoices',
    'invoice_items',
    'reminders',
    'reports',
    'whatsapp_logs',
  ],
  hrms: [
    'employees',
    'departments',
    'designations',
    'leaves',
    'employee_checkins',
    'break_logs',
    'hr_documents',
    'salary_slips',
    'hr_leave_types',
    'hr_leave_balances',
    'hr_shifts',
    'hr_shift_assignments',
    'hr_holidays',
    'hr_announcements',
    'hr_settings',
    'performance_reviews',
  ],
  finance: [
    'invoices',
    'invoice_items',
    'invoice_payments',
    'bank_accounts',
    'expenses',
    'purchases',
    'suppliers',
    'supplier_interactions',
    'subscriptions',
    'subscription_history',
    'subscription_sessions',
    'transactions',
  ],
  inventory: [
    'inventory',
    'warehouses',
    'warehouse_movements',
    'purchases',
    'suppliers',
    'supplier_interactions',
  ],
  support: [
    'support_tickets',
    'support_ticket_comments',
  ],
  posh: [
    'posh_complaints',
    'posh_evidence_files',
    'posh_icc_members',
    'posh_assignments',
    'posh_investigations',
    'posh_hearings',
    'posh_messages',
    'posh_resolutions',
    'posh_settings',
    'posh_audit_logs',
  ],
  communication: [
    'chat_messages',
    'social_media_chat_threads',
    'social_media_chat_messages',
  ],
  access: [
    'employees',
    'departments',
    'designations',
    'rbac_roles',
    'rbac_permissions',
    'rbac_role_permissions',
    'login_sessions',
  ],
  logs: [
    'activity_logs',
    'audit_logs',
    'api_audit_log',
    'api_logs',
    'webhook_logs',
    'import_jobs',
  ],
};

const BACKUP_TYPES = {
  full: {
    label: 'Full Company Backup',
    description: 'All company-scoped CRM, HRMS, finance, inventory, support, POSH, access, and log tables.',
    groups: 'all',
  },
  crm: {
    label: 'CRM Data Backup',
    description: 'Leads, followups, tasks, meetings, quotations, invoices, reminders, reports, and WhatsApp logs.',
    groups: ['crm'],
  },
  hrms: {
    label: 'HRMS Data Backup',
    description: 'Employees, departments, attendance/checkins, leaves, salary slips, HR documents, shifts, holidays, and reviews.',
    groups: ['hrms'],
  },
  users: {
    label: 'Users & Access Backup',
    description: 'Employees, departments, designations, role/access mappings, company modules, API keys, and sessions.',
    groups: ['access', 'core'],
  },
  leads: {
    label: 'Leads Backup',
    description: 'Leads with their followups, meetings, tasks, reminders, quotations, and WhatsApp logs.',
    groups: ['crm'],
    tables: ['leads', 'followups', 'meetings', 'tasks', 'reminders', 'quotations', 'quotation_items', 'whatsapp_logs'],
  },
  attendance: {
    label: 'Attendance Backup',
    description: 'Employee checkins, break logs, shifts, shift assignments, and holidays.',
    groups: ['hrms'],
    tables: ['employees', 'employee_checkins', 'break_logs', 'hr_shifts', 'hr_shift_assignments', 'hr_holidays'],
  },
  payroll: {
    label: 'Payroll Backup',
    description: 'Salary slips, employee payroll fields, expenses, bank accounts, invoice payments, and related finance rows.',
    groups: ['finance', 'hrms'],
    tables: ['employees', 'salary_slips', 'expenses', 'bank_accounts', 'invoice_payments'],
  },
  finance: {
    label: 'Finance Backup',
    description: 'Invoices, invoice items, payments, accounts, expenses, purchases, suppliers, subscriptions, and transactions.',
    groups: ['finance'],
  },
  inventory: {
    label: 'Inventory Backup',
    description: 'Inventory, purchases, suppliers, warehouses, and warehouse movements.',
    groups: ['inventory'],
  },
  posh: {
    label: 'POSH Backup',
    description: 'POSH complaints, evidence metadata, ICC members, investigations, hearings, messages, resolutions, and settings.',
    groups: ['posh'],
  },
  support: {
    label: 'Support Backup',
    description: 'Support tickets and support ticket comments.',
    groups: ['support'],
  },
};

const BACKUP_LOG_TABLES = new Set(['backup_logs', 'backups']);

const RELATED_EXPORTS = [
  {
    table: 'transactions',
    parentTable: 'invoices',
    parentKey: 'id',
    foreignKey: 'invoice_id',
    includeWhenParentSelected: true,
  },
  {
    table: 'sales_order_items',
    parentTable: 'sales_orders',
    parentKey: 'id',
    foreignKey: 'order_id',
    includeWhenParentSelected: true,
  },
  {
    table: 'social_media_chat_messages',
    parentTable: 'social_media_chat_threads',
    parentKey: 'id',
    foreignKey: 'thread_id',
    includeWhenParentSelected: true,
  },
];

const RESTORE_TABLE_ORDER = [
  'companies',
  'company_settings',
  'company_modules',
  'employee_module_access',
  'api_keys',
  'webhooks',
  'departments',
  'designations',
  'employees',
  'rbac_roles',
  'rbac_permissions',
  'rbac_role_permissions',
  'leads',
  'followups',
  'tasks',
  'meetings',
  'quotations',
  'quotation_items',
  'invoices',
  'invoice_items',
  'transactions',
  'bank_accounts',
  'invoice_payments',
  'expenses',
  'suppliers',
  'supplier_interactions',
  'purchases',
  'inventory',
  'warehouses',
  'warehouse_movements',
  'leaves',
  'employee_checkins',
  'break_logs',
  'hr_leave_types',
  'hr_leave_balances',
  'hr_shifts',
  'hr_shift_assignments',
  'hr_holidays',
  'hr_announcements',
  'hr_settings',
  'hr_documents',
  'salary_slips',
  'performance_reviews',
  'reminders',
  'reports',
  'whatsapp_logs',
  'chat_messages',
  'social_media_chat_threads',
  'social_media_chat_messages',
  'support_tickets',
  'support_ticket_comments',
  'posh_complaints',
  'posh_evidence_files',
  'posh_icc_members',
  'posh_assignments',
  'posh_investigations',
  'posh_hearings',
  'posh_messages',
  'posh_resolutions',
  'posh_settings',
  'posh_audit_logs',
  'activity_logs',
  'audit_logs',
  'api_audit_log',
  'api_logs',
  'webhook_logs',
  'import_jobs',
  'company_usage',
  'login_sessions',
  'subscription_sessions',
  'subscriptions',
  'subscription_history',
  'sales_clients',
  'sales_orders',
  'sales_order_items',
];

let backupLogsReady = false;
let tableColumnsCache = null;
let tableSchemaCache = null;

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z0-9_]+$/.test(String(identifier))) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
  return `\`${identifier}\``;
}

function normalizeBackupType(type) {
  const key = String(type || 'full').toLowerCase();
  return BACKUP_TYPES[key] ? key : 'full';
}

function getBackupTypeConfig(type) {
  return BACKUP_TYPES[normalizeBackupType(type)] || BACKUP_TYPES.full;
}

async function ensureBackupLogsTable() {
  if (backupLogsReady) return;
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
  backupLogsReady = true;
}

async function getTableColumnsMap() {
  if (tableColumnsCache) return tableColumnsCache;
  const rows = await query(
    `SELECT TABLE_NAME, COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, ORDINAL_POSITION`
  );
  const map = new Map();
  for (const row of rows || []) {
    const table = row.TABLE_NAME;
    if (!map.has(table)) map.set(table, []);
    map.get(table).push(row.COLUMN_NAME);
  }
  tableColumnsCache = map;
  return map;
}

async function refreshTableColumnsMap() {
  tableColumnsCache = null;
  tableSchemaCache = null;
  return getTableColumnsMap();
}

async function getTableSchemaMap() {
  if (tableSchemaCache) return tableSchemaCache;
  const rows = await query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_KEY, EXTRA
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, ORDINAL_POSITION`
  );
  const map = new Map();
  for (const row of rows || []) {
    const table = row.TABLE_NAME;
    if (!map.has(table)) {
      map.set(table, {
        table,
        columns: [],
        primaryKeys: [],
        autoIncrementColumns: [],
      });
    }
    const schema = map.get(table);
    schema.columns.push(row.COLUMN_NAME);
    if (row.COLUMN_KEY === 'PRI') schema.primaryKeys.push(row.COLUMN_NAME);
    if (String(row.EXTRA || '').toLowerCase().includes('auto_increment')) {
      schema.autoIncrementColumns.push(row.COLUMN_NAME);
    }
  }
  tableSchemaCache = map;
  return map;
}

async function refreshTableSchemaMap() {
  tableSchemaCache = null;
  tableColumnsCache = null;
  await getTableColumnsMap();
  return getTableSchemaMap();
}

async function runOnConnection(conn, sql, params = []) {
  const safeParams = (Array.isArray(params) ? params : [params]).map((p) => (
    p === undefined || (typeof p === 'number' && Number.isNaN(p)) ? null : p
  ));
  const finalSql = safeParams.length ? mysqlFormat(sql, safeParams) : sql;
  const [rows] = await conn.query(finalSql);
  return rows;
}

function getOrderSql(columns) {
  if (!Array.isArray(columns)) return '';
  if (columns.includes('id')) return ' ORDER BY `id` ASC';
  if (columns.includes('created_at')) return ' ORDER BY `created_at` ASC';
  if (columns.includes('updated_at')) return ' ORDER BY `updated_at` ASC';
  return '';
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

async function getTablesForType(type) {
  const normalizedType = normalizeBackupType(type);
  const config = getBackupTypeConfig(normalizedType);
  const columnsMap = await getTableColumnsMap();

  if (config.groups === 'all') {
    return [...columnsMap.entries()]
      .filter(([table, columns]) => columns.includes('company_id') && !BACKUP_LOG_TABLES.has(table))
      .map(([table]) => table)
      .sort();
  }

  const fromGroups = (config.groups || []).flatMap((group) => TABLE_GROUPS[group] || []);
  const selectedTables = Array.isArray(config.tables) && config.tables.length ? config.tables : fromGroups;
  return unique(selectedTables)
    .filter((table) => columnsMap.has(table) && !BACKUP_LOG_TABLES.has(table));
}

async function selectRowsByColumn(table, column, value) {
  const columnsMap = await getTableColumnsMap();
  const columns = columnsMap.get(table);
  if (!columns) return { rows: [], skipped: `${table} table does not exist` };
  if (!columns.includes(column)) return { rows: [], skipped: `${table}.${column} column does not exist` };

  const rows = await query(
    `SELECT * FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(column)} = ?${getOrderSql(columns)}`,
    [value]
  );
  return { rows: rows || [] };
}

async function selectRowsByIds(table, column, ids) {
  const columnsMap = await getTableColumnsMap();
  const columns = columnsMap.get(table);
  if (!columns) return { rows: [], skipped: `${table} table does not exist` };
  if (!columns.includes(column)) return { rows: [], skipped: `${table}.${column} column does not exist` };

  const safeIds = unique(ids).filter((id) => id !== null && id !== undefined);
  if (!safeIds.length) return { rows: [] };

  const rows = [];
  const chunkSize = 800;
  for (let i = 0; i < safeIds.length; i += chunkSize) {
    const chunk = safeIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const part = await query(
      `SELECT * FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(column)} IN (${placeholders})${getOrderSql(columns)}`,
      chunk
    );
    rows.push(...(part || []));
  }
  return { rows };
}

function addSummaryCount(out, table, rows) {
  const count = Array.isArray(rows) ? rows.length : 0;
  out.summary.table_counts[table] = count;
  out.summary.total_rows += count;
  out.summary.exported_tables = Object.keys(out.summary.table_counts).length;
}

function addSkipped(out, table, reason) {
  out.summary.skipped_tables.push({ table, reason });
}

function addError(out, table, error) {
  out.summary.errors.push({ table, message: error?.message || String(error) });
}

async function addCompanyScopedTable(out, table, companyId) {
  const columnsMap = await getTableColumnsMap();
  const columns = columnsMap.get(table);
  if (!columns) {
    addSkipped(out, table, 'Table does not exist in this database.');
    return;
  }

  if (!columns.includes('company_id')) {
    addSkipped(out, table, 'No company_id column; handled only when a supported parent relation exists.');
    return;
  }

  try {
    const { rows } = await selectRowsByColumn(table, 'company_id', companyId);
    out.tables[table] = rows;
    addSummaryCount(out, table, rows);
  } catch (err) {
    addError(out, table, err);
  }
}

async function addRelatedTables(out, selectedTables) {
  const columnsMap = await getTableColumnsMap();
  const selected = new Set(selectedTables);

  for (const relation of RELATED_EXPORTS) {
    if (out.tables[relation.table]) continue;
    if (!columnsMap.has(relation.table)) continue;
    if (!selected.has(relation.table) && !(relation.includeWhenParentSelected && selected.has(relation.parentTable))) continue;

    const parentRows = out.tables[relation.parentTable] || [];
    const parentIds = parentRows.map((row) => row?.[relation.parentKey]).filter(Boolean);
    try {
      const { rows, skipped } = await selectRowsByIds(relation.table, relation.foreignKey, parentIds);
      if (skipped) {
        addSkipped(out, relation.table, skipped);
        continue;
      }
      out.tables[relation.table] = rows;
      addSummaryCount(out, relation.table, rows);
    } catch (err) {
      addError(out, relation.table, err);
    }
  }
}

function buildFileName(type, companyId) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return companyId ? `backup-${type}-co${companyId}-${stamp}.json` : `backup-${type}-all-${stamp}.json`;
}

async function insertBackupLog({ companyId, type, fileName, fileSize, meta, createdBy }) {
  await ensureBackupLogsTable();
  const result = await query(
    'INSERT INTO backup_logs (company_id, backup_type, file_path, file_size, status, meta, created_by) VALUES (?,?,?,?,?,?,?)',
    [companyId || null, type, fileName, fileSize, 'completed', JSON.stringify(meta || {}), createdBy || null]
  );
  return result.insertId;
}

async function safeSelect(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (e) {
    return null;
  }
}

async function exportCompanyData(companyId, type = 'full') {
  const normalizedType = normalizeBackupType(type);
  const typeConfig = getBackupTypeConfig(normalizedType);
  await refreshTableColumnsMap();

  const companyRows = companyId
    ? await safeSelect('SELECT * FROM companies WHERE id=?', [companyId])
    : [];
  const company = companyRows?.[0] || null;

  const out = { 
    schema_version: BACKUP_SCHEMA_VERSION,
    scope: 'company',
    company_id: companyId, 
    company_name: company?.company_name || null,
    type: normalizedType,
    type_label: typeConfig.label,
    exported_at: new Date().toISOString(), 
    note: EXPORT_TIMEOUT_NOTE,
    summary: {
      exported_tables: 0,
      total_rows: 0,
      table_counts: {},
      skipped_tables: [],
      errors: [],
    },
    company,
    tables: {},
  };

  if (companyRows) {
    out.tables.companies = companyRows;
    addSummaryCount(out, 'companies', companyRows);
  }

  const selectedTables = await getTablesForType(normalizedType);
  for (const table of selectedTables) {
    await addCompanyScopedTable(out, table, companyId);
  }

  await addRelatedTables(out, selectedTables);

  out.summary.skipped_tables = out.summary.skipped_tables.filter((item, index, arr) => (
    arr.findIndex((x) => x.table === item.table && x.reason === item.reason) === index
  ));
  out.summary.errors = out.summary.errors.filter((item, index, arr) => (
    arr.findIndex((x) => x.table === item.table && x.message === item.message) === index
  ));
  return out;
}

async function exportBackupPayload(companyId, type = 'full') {
  const normalizedType = normalizeBackupType(type);
  const typeConfig = getBackupTypeConfig(normalizedType);

  if (companyId) {
    return exportCompanyData(Number(companyId), normalizedType);
  }

  await refreshTableColumnsMap();
  const companies = await safeSelect('SELECT id, company_name FROM companies ORDER BY id ASC');
  const companyBackups = [];
  const tableCounts = {};
  const skippedTables = [];
  const errors = [];
  let totalRows = 0;

  for (const company of companies || []) {
    const backup = await exportCompanyData(company.id, normalizedType);
    companyBackups.push(backup);

    for (const [table, count] of Object.entries(backup.summary.table_counts || {})) {
      tableCounts[table] = (tableCounts[table] || 0) + Number(count || 0);
      totalRows += Number(count || 0);
    }
    skippedTables.push(...(backup.summary.skipped_tables || []).map((item) => ({
      company_id: company.id,
      ...item,
    })));
    errors.push(...(backup.summary.errors || []).map((item) => ({
      company_id: company.id,
      ...item,
    })));
  }

  return {
    schema_version: BACKUP_SCHEMA_VERSION,
    scope: 'all_companies',
    company_id: null,
    company_name: 'All Companies',
    type: normalizedType,
    type_label: typeConfig.label,
    exported_at: new Date().toISOString(),
    note: EXPORT_TIMEOUT_NOTE,
    summary: {
      companies: (companies || []).length,
      exported_tables: Object.keys(tableCounts).length,
      total_rows: totalRows,
      table_counts: tableCounts,
      skipped_tables: skippedTables,
      errors,
    },
    companies: companyBackups,
  };
}

function getRelationForTable(table) {
  return RELATED_EXPORTS.find((relation) => relation.table === table) || null;
}

function normalizeImportMode(mode) {
  const key = String(mode || 'upsert').toLowerCase();
  return key === 'replace' ? 'replace' : 'upsert';
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!['{', '['].includes(trimmed[0])) return value;
  try {
    return JSON.parse(trimmed);
  } catch (_err) {
    return value;
  }
}

function normalizeDbValue(value) {
  if (value === undefined) return null;
  if (value === '') return '';
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value;
}

function coerceImportRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = parseMaybeJson(value);
  }
  return out;
}

function normalizeTablesObject(tables) {
  const out = {};
  if (!tables || typeof tables !== 'object') return out;
  for (const [table, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) continue;
    out[table] = rows.map(coerceImportRow).filter(Boolean);
  }
  return out;
}

function getCompanyIdFromBackup(backup) {
  const explicit = backup?.company_id ?? backup?.company?.id;
  if (explicit !== undefined && explicit !== null && explicit !== '') return Number(explicit);
  const companyRows = backup?.tables?.companies;
  if (Array.isArray(companyRows) && companyRows[0]?.id) return Number(companyRows[0].id);
  return null;
}

function flattenBackupPayload(backup) {
  if (!backup || typeof backup !== 'object') {
    throw new Error('Invalid backup file. Backup JSON object was not found.');
  }

  if (backup.scope === 'all_companies' && Array.isArray(backup.companies)) {
    return backup.companies.map((companyBackup) => ({
      companyId: getCompanyIdFromBackup(companyBackup),
      companyName: companyBackup?.company_name || companyBackup?.company?.company_name || null,
      type: normalizeBackupType(companyBackup?.type || backup.type),
      tables: normalizeTablesObject(companyBackup?.tables),
    })).filter((item) => item.companyId || Object.keys(item.tables).length);
  }

  return [{
    companyId: getCompanyIdFromBackup(backup),
    companyName: backup?.company_name || backup?.company?.company_name || null,
    type: normalizeBackupType(backup?.type),
    tables: normalizeTablesObject(backup?.tables),
  }];
}

function isAllowedImportTable(table, schema) {
  if (!schema || BACKUP_LOG_TABLES.has(table)) return false;
  if (table === 'companies') return true;
  if (schema.columns.includes('company_id')) return true;
  return Boolean(getRelationForTable(table));
}

function orderTablesForRestore(tableNames, reverse = false) {
  const order = new Map(RESTORE_TABLE_ORDER.map((table, index) => [table, index]));
  const sorted = [...new Set(tableNames)].sort((a, b) => {
    const ai = order.has(a) ? order.get(a) : RESTORE_TABLE_ORDER.length;
    const bi = order.has(b) ? order.get(b) : RESTORE_TABLE_ORDER.length;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
  return reverse ? sorted.reverse() : sorted;
}

function buildBackupImportPlan(backup) {
  const companies = flattenBackupPayload(backup);
  const plan = {
    schema_version: backup?.schema_version || null,
    scope: backup?.scope || (companies.length > 1 ? 'all_companies' : 'company'),
    companies,
  };
  if (!companies.length) {
    throw new Error('No importable company data found in this backup file.');
  }
  return plan;
}

async function summarizeImportPlan(backup, mode = 'upsert') {
  const schemaMap = await refreshTableSchemaMap();
  const plan = buildBackupImportPlan(backup);
  const summary = {
    mode: normalizeImportMode(mode),
    schema_version: plan.schema_version,
    scope: plan.scope,
    companies: plan.companies.length,
    exported_companies: [],
    exported_tables: 0,
    total_rows: 0,
    table_counts: {},
    skipped_tables: [],
    errors: [],
  };

  for (const company of plan.companies) {
    const companySummary = {
      company_id: company.companyId,
      company_name: company.companyName,
      tables: 0,
      rows: 0,
    };
    for (const [table, rows] of Object.entries(company.tables)) {
      const schema = schemaMap.get(table);
      if (!isAllowedImportTable(table, schema)) {
        summary.skipped_tables.push({ company_id: company.companyId, table, reason: 'Table is missing or not company-scoped/importable.' });
        continue;
      }
      const count = Array.isArray(rows) ? rows.length : 0;
      summary.table_counts[table] = (summary.table_counts[table] || 0) + count;
      summary.total_rows += count;
      companySummary.tables += 1;
      companySummary.rows += count;
    }
    summary.exported_companies.push(companySummary);
  }

  summary.exported_tables = Object.keys(summary.table_counts).length;
  return { plan, schemaMap, summary };
}

function filterRowsForSchema(table, rows, schema, companyId) {
  const columns = schema.columns;
  return (rows || []).map((row) => {
    const out = {};
    for (const column of columns) {
      if (Object.prototype.hasOwnProperty.call(row, column)) {
        out[column] = normalizeDbValue(row[column]);
      }
    }
    if (table !== 'companies' && columns.includes('company_id') && companyId) {
      out.company_id = companyId;
    }
    return out;
  }).filter((row) => Object.keys(row).length > 0);
}

async function deleteByIds(conn, table, column, ids) {
  const safeIds = unique(ids).filter((id) => id !== null && id !== undefined && id !== '');
  if (!safeIds.length) return 0;

  let deleted = 0;
  const chunkSize = 800;
  for (let i = 0; i < safeIds.length; i += chunkSize) {
    const chunk = safeIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const result = await runOnConnection(
      conn,
      `DELETE FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(column)} IN (${placeholders})`,
      chunk
    );
    deleted += Number(result?.affectedRows || 0);
  }
  return deleted;
}

async function deleteExistingRowsForTable(conn, table, rows, companyId, schema, companyTables) {
  if (table === 'companies') return 0;

  if (schema.columns.includes('company_id') && companyId) {
    const result = await runOnConnection(
      conn,
      `DELETE FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier('company_id')} = ?`,
      [companyId]
    );
    return Number(result?.affectedRows || 0);
  }

  const relation = getRelationForTable(table);
  if (relation) {
    const parentRows = companyTables[relation.parentTable] || [];
    const parentIds = parentRows.map((row) => row?.[relation.parentKey]).filter(Boolean);
    if (parentIds.length) {
      return deleteByIds(conn, table, relation.foreignKey, parentIds);
    }
  }

  if (schema.primaryKeys.length === 1) {
    return deleteByIds(conn, table, schema.primaryKeys[0], rows.map((row) => row?.[schema.primaryKeys[0]]));
  }
  return 0;
}

async function upsertRows(conn, table, rows, schema, mode = 'upsert') {
  const cleanRows = rows.filter((row) => Object.keys(row).length > 0);
  if (!cleanRows.length) return { affected: 0, rows: 0 };

  const allColumns = schema.columns.filter((column) => cleanRows.some((row) => Object.prototype.hasOwnProperty.call(row, column)));
  if (!allColumns.length) return { affected: 0, rows: 0 };

  const updateColumns = allColumns.filter((column) => !schema.primaryKeys.includes(column));
  const updateSql = updateColumns.length
    ? updateColumns.map((column) => `${quoteIdentifier(column)}=VALUES(${quoteIdentifier(column)})`).join(', ')
    : `${quoteIdentifier(allColumns[0])}=VALUES(${quoteIdentifier(allColumns[0])})`;

  let affected = 0;
  const chunkSize = mode === 'replace' ? 250 : 150;
  for (let i = 0; i < cleanRows.length; i += chunkSize) {
    const chunk = cleanRows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => `(${allColumns.map(() => '?').join(',')})`).join(',');
    const params = [];
    for (const row of chunk) {
      for (const column of allColumns) {
        params.push(Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null);
      }
    }
    const result = await runOnConnection(
      conn,
      `INSERT INTO ${quoteIdentifier(table)} (${allColumns.map(quoteIdentifier).join(',')}) VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE ${updateSql}`,
      params
    );
    affected += Number(result?.affectedRows || 0);
  }

  return { affected, rows: cleanRows.length };
}

async function applyImportPlan({ plan, schemaMap, mode, createdBy }) {
  const normalizedMode = normalizeImportMode(mode);
  const conn = await getConnection();
  const summary = {
    mode: normalizedMode,
    companies: plan.companies.length,
    deleted_rows: 0,
    imported_rows: 0,
    affected_rows: 0,
    table_counts: {},
    skipped_tables: [],
    errors: [],
  };

  try {
    await conn.beginTransaction();
    await runOnConnection(conn, 'SET FOREIGN_KEY_CHECKS=0');

    for (const company of plan.companies) {
      const tableNames = Object.keys(company.tables).filter((table) => isAllowedImportTable(table, schemaMap.get(table)));

      if (normalizedMode === 'replace') {
        for (const table of orderTablesForRestore(tableNames, true)) {
          const schema = schemaMap.get(table);
          const rows = company.tables[table] || [];
          try {
            summary.deleted_rows += await deleteExistingRowsForTable(conn, table, rows, company.companyId, schema, company.tables);
          } catch (err) {
            summary.errors.push({ company_id: company.companyId, table, action: 'delete', message: err.message });
            throw err;
          }
        }
      }

      for (const table of orderTablesForRestore(tableNames)) {
        const schema = schemaMap.get(table);
        if (!isAllowedImportTable(table, schema)) {
          summary.skipped_tables.push({ company_id: company.companyId, table, reason: 'Table is missing or not importable.' });
          continue;
        }
        const rows = filterRowsForSchema(table, company.tables[table], schema, company.companyId);
        try {
          const result = await upsertRows(conn, table, rows, schema, normalizedMode);
          summary.imported_rows += result.rows;
          summary.affected_rows += result.affected;
          summary.table_counts[table] = (summary.table_counts[table] || 0) + result.rows;
        } catch (err) {
          summary.errors.push({ company_id: company.companyId, table, action: 'upsert', message: err.message });
          throw err;
        }
      }
    }

    await runOnConnection(
      conn,
      'INSERT INTO backup_logs (company_id, backup_type, file_path, file_size, status, meta, created_by) VALUES (?,?,?,?,?,?,?)',
      [
        plan.companies.length === 1 ? plan.companies[0].companyId || null : null,
        'import',
        `import-${Date.now()}.json`,
        0,
        'completed',
        JSON.stringify({
          action: 'import',
          mode: normalizedMode,
          schema_version: plan.schema_version,
          summary,
        }),
        createdBy || null,
      ]
    );

    await runOnConnection(conn, 'SET FOREIGN_KEY_CHECKS=1');
    await conn.commit();
    return summary;
  } catch (err) {
    try {
      await runOnConnection(conn, 'SET FOREIGN_KEY_CHECKS=1');
      await conn.rollback();
    } catch (_rollbackErr) {}
    throw err;
  } finally {
    conn.release();
  }
}

router.get('/health', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const uptimeSec = Math.floor(process.uptime());
    const mem = process.memoryUsage();
    const load = os.loadavg();
    res.json({
      success: true,
      data: {
        status: 'ok',
        uptimeSec,
        node: process.version,
        memory: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
        },
        loadAvg: load,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/cache/clear', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    if (typeof global.gc === 'function') {
      global.gc();
    }
    res.json({
      success: true,
      message: 'Runtime cache clear request completed',
      data: {
        cleared_at: new Date().toISOString(),
        memory: process.memoryUsage(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/backups', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await ensureBackupLogsTable();
    const { company_id, from, to } = req.query || {};
    const where = [];
    const params = [];
    if (company_id) {
      where.push('company_id = ?');
      params.push(Number(company_id));
    }
    if (from) {
      where.push('created_at >= ?');
      params.push(new Date(from));
    }
    if (to) {
      where.push('created_at <= ?');
      params.push(new Date(to));
    }
    const sql = `
      SELECT b.*, c.company_name 
      FROM backup_logs b 
      LEFT JOIN companies c ON b.company_id = c.id 
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} 
      ORDER BY b.created_at DESC LIMIT 500
    `;
    const rows = await query(sql, params);
    const data = (rows || []).map((row) => {
      let meta = row.meta;
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta);
        } catch (_err) {
          meta = {};
        }
      }
      return { ...row, meta: meta || {} };
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/backups', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await ensureBackupLogsTable();
    const { type = 'full', company_id = null } = req.body || {};
    const normalizedType = normalizeBackupType(type);
    const companyId = company_id ? Number(company_id) : null;

    const payload = await exportBackupPayload(companyId, normalizedType);
    const json = JSON.stringify(payload, null, 2);
    const fileSize = Buffer.byteLength(json);
    const fileName = buildFileName(normalizedType, companyId);
    const meta = {
      schema_version: BACKUP_SCHEMA_VERSION,
      type: normalizedType,
      type_label: payload.type_label,
      company_id: companyId,
      company_name: payload.company_name,
      scope: payload.scope,
      summary: payload.summary,
    };
    const id = await insertBackupLog({
      companyId,
      type: normalizedType,
      fileName,
      fileSize,
      meta,
      createdBy: req.employee?.id || null,
    });
    
    res.json({
      success: true,
      message: 'Backup generated successfully',
      data: {
        id,
        file_name: fileName,
        file_size: fileSize,
        download_url: `/superadmin/system/backups/export?id=${id}`,
        summary: payload.summary,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/backups/import', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await ensureBackupLogsTable();
    const { backup, payload, mode = 'upsert', dry_run = true, confirm = '' } = req.body || {};
    const backupPayload = backup || payload;
    const normalizedMode = normalizeImportMode(mode);
    const { plan, schemaMap, summary } = await summarizeImportPlan(backupPayload, normalizedMode);

    if (dry_run !== false) {
      return res.json({
        success: true,
        message: 'Backup import preview generated',
        data: {
          dry_run: true,
          summary,
        },
      });
    }

    if (confirm !== 'RESTORE_BACKUP') {
      return res.status(400).json({
        success: false,
        message: 'Import confirmation missing. Please preview and confirm restore before applying.',
      });
    }

    const result = await applyImportPlan({
      plan,
      schemaMap,
      mode: normalizedMode,
      createdBy: req.employee?.id || null,
    });

    return res.json({
      success: true,
      message: 'Backup imported successfully',
      data: {
        dry_run: false,
        summary: result,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/backups/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await ensureBackupLogsTable();
    await query('DELETE FROM backup_logs WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Backup record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Export backup JSON (company-wise or all companies)
router.get('/backups/export', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await ensureBackupLogsTable();
    const { id, company_id, type = 'full' } = req.query || {};

    let companyId = company_id ? Number(company_id) : null;
    let normalizedType = normalizeBackupType(type);
    let fileBase = buildFileName(normalizedType, companyId);
    let shouldLogExport = true;

    if (id) {
      const rows = await query('SELECT * FROM backup_logs WHERE id=? LIMIT 1', [id]);
      const log = rows?.[0];
      if (!log) {
        return res.status(404).json({ success: false, message: 'Backup record not found' });
      }
      companyId = log.company_id ? Number(log.company_id) : null;
      normalizedType = normalizeBackupType(log.backup_type);
      fileBase = log.file_path || buildFileName(normalizedType, companyId);
      shouldLogExport = false;
    }

    const payload = await exportBackupPayload(companyId, normalizedType);
    const json = JSON.stringify(payload, null, 2);
    const fileSize = Buffer.byteLength(json);

    if (shouldLogExport) {
      await insertBackupLog({
        companyId,
        type: normalizedType,
        fileName: fileBase,
        fileSize,
        meta: {
          schema_version: BACKUP_SCHEMA_VERSION,
          action: 'export',
          type: normalizedType,
          type_label: payload.type_label,
          company_id: companyId,
          company_name: payload.company_name,
          scope: payload.scope,
          summary: payload.summary,
        },
        createdBy: req.employee?.id || null,
      });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}"`);
    return res.status(200).send(json);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

