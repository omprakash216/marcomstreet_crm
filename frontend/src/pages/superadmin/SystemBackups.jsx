import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';

const BACKUP_TIMEOUT_MS = 300000;
const BACKUP_JSON_SHEET = '_BACKUP_JSON';

const BACKUP_TYPE_OPTIONS = [
  { value: 'full', label: 'Full Company Backup', hint: 'All company-scoped CRM, HRMS, finance, support, POSH and log data' },
  { value: 'crm', label: 'CRM Data Backup', hint: 'Leads, followups, tasks, meetings, quotations and invoices' },
  { value: 'hrms', label: 'HRMS Data Backup', hint: 'Employees, leaves, checkins, salary slips and HR documents' },
  { value: 'users', label: 'Users & Access', hint: 'Employees, departments, designations, modules and access data' },
  { value: 'leads', label: 'Leads Only', hint: 'Leads with related followups, meetings, tasks and quotations' },
  { value: 'attendance', label: 'Attendance Only', hint: 'Checkins, break logs, shifts and holidays' },
  { value: 'payroll', label: 'Payroll & Slips', hint: 'Salary slips, payroll records, expenses and payment records' },
  { value: 'finance', label: 'Finance Backup', hint: 'Invoices, payments, accounts, purchases, suppliers and subscriptions' },
  { value: 'inventory', label: 'Inventory Backup', hint: 'Inventory, purchases, suppliers and warehouse data' },
  { value: 'posh', label: 'POSH Backup', hint: 'Complaints, ICC members, evidence metadata, hearings and resolutions' },
  { value: 'support', label: 'Support Backup', hint: 'Support tickets and comments' },
];

function parseMeta(meta) {
  if (!meta) return {};
  if (typeof meta === 'object') return meta;
  try {
    return JSON.parse(meta);
  } catch (_err) {
    return {};
  }
}

function getSummary(row) {
  return parseMeta(row?.meta)?.summary || row?.summary || {};
}

async function getApiErrorMessage(err) {
  const data = err?.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const text = await data.text();
    try {
      const parsed = JSON.parse(text);
      return parsed?.message || parsed?.error || text || err.message;
    } catch (_parseErr) {
      return text || err.message;
    }
  }
  return data?.message || data?.error || err.message || 'Something went wrong';
}

function getFilenameFromHeader(header) {
  if (!header) return '';
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] || '';
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function safeSheetName(name, usedNames = new Set()) {
  const base = String(name || 'Sheet')
    .replace(/[:\\/?*[\]]/g, '_')
    .slice(0, 31) || 'Sheet';
  let candidate = base;
  let counter = 1;
  while (usedNames.has(candidate)) {
    const suffix = `_${counter}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    counter += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function cellValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function getBackupCompanyBlocks(payload) {
  if (payload?.scope === 'all_companies' && Array.isArray(payload.companies)) {
    return payload.companies.map((company) => ({
      companyId: company.company_id || company.company?.id || '',
      companyName: company.company_name || company.company?.company_name || 'Company',
      tables: company.tables || {},
    }));
  }
  return [{
    companyId: payload?.company_id || payload?.company?.id || '',
    companyName: payload?.company_name || payload?.company?.company_name || 'Company',
    tables: payload?.tables || {},
  }];
}

function addTableSheet(workbook, usedNames, name, rows) {
  const sheet = workbook.addWorksheet(safeSheetName(name, usedNames));
  const columns = Array.from(new Set((rows || []).flatMap((row) => Object.keys(row || {}))));
  if (!columns.length) {
    sheet.addRow(['No rows']);
    return;
  }
  sheet.addRow(columns);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows || []) {
    sheet.addRow(columns.map((column) => cellValue(row?.[column])));
  }
  sheet.columns = columns.map((column) => ({
    key: column,
    width: Math.min(Math.max(String(column).length + 4, 12), 32),
  }));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

async function buildBackupWorkbook(payload) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MARCOM CRM';
  workbook.created = new Date();
  workbook.modified = new Date();

  const usedNames = new Set();
  const summarySheet = workbook.addWorksheet(safeSheetName('Summary', usedNames));
  summarySheet.addRows([
    ['Backup Type', payload?.type_label || payload?.type || ''],
    ['Scope', payload?.scope || 'company'],
    ['Company', payload?.company_name || 'All Companies'],
    ['Exported At', payload?.exported_at || ''],
    ['Tables', payload?.summary?.exported_tables || 0],
    ['Rows', payload?.summary?.total_rows || 0],
    ['Restore Data', `Hidden sheet ${BACKUP_JSON_SHEET} contains exact JSON for restore.`],
  ]);
  summarySheet.getColumn(1).width = 24;
  summarySheet.getColumn(2).width = 80;
  summarySheet.getColumn(1).font = { bold: true };

  const countsSheet = workbook.addWorksheet(safeSheetName('Table Counts', usedNames));
  countsSheet.addRow(['Table', 'Rows']);
  countsSheet.getRow(1).font = { bold: true };
  Object.entries(payload?.summary?.table_counts || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([table, count]) => countsSheet.addRow([table, count]));
  countsSheet.columns = [{ width: 34 }, { width: 14 }];

  const backupJson = JSON.stringify(payload);
  const hiddenSheet = workbook.addWorksheet(BACKUP_JSON_SHEET);
  hiddenSheet.state = 'veryHidden';
  hiddenSheet.addRow(['part', 'json_chunk']);
  const chunkSize = 30000;
  for (let i = 0; i < backupJson.length; i += chunkSize) {
    hiddenSheet.addRow([Math.floor(i / chunkSize) + 1, backupJson.slice(i, i + chunkSize)]);
  }

  for (const block of getBackupCompanyBlocks(payload)) {
    const prefix = block.companyId ? `co${block.companyId}_` : '';
    for (const [table, rows] of Object.entries(block.tables || {})) {
      addTableSheet(workbook, usedNames, `${prefix}${table}`, Array.isArray(rows) ? rows : []);
    }
  }

  return workbook;
}

async function parseBackupFile(file) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.json')) {
    return JSON.parse(await file.text());
  }
  if (name.endsWith('.xlsx')) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const hiddenSheet = workbook.getWorksheet(BACKUP_JSON_SHEET);
    if (!hiddenSheet) {
      throw new Error(`Invalid backup Excel. ${BACKUP_JSON_SHEET} sheet not found.`);
    }
    const chunks = [];
    hiddenSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const part = Number(row.getCell(1).value || rowNumber);
      const text = row.getCell(2).value;
      chunks.push({ part, text: String(text || '') });
    });
    chunks.sort((a, b) => a.part - b.part);
    return JSON.parse(chunks.map((chunk) => chunk.text).join(''));
  }
  throw new Error('Please select a CRM backup .json or .xlsx file.');
}

export default function SystemBackups() {
  const navigate = useNavigate();
  const importInputRef = useRef(null);
  const employeeRef = React.useRef(getEmployee());
  const employee = employeeRef.current;
  const role = normalizeRole(employee?.role);

  const [type, setType] = useState('full');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState({ company_id: '', from: '', to: '' });
  const [lastGenerated, setLastGenerated] = useState(null);
  const [error, setError] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importMode, setImportMode] = useState('replace');
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importPayload, setImportPayload] = useState(null);

  const employeeId = employee?.id;
  const selectedType = BACKUP_TYPE_OPTIONS.find((item) => item.value === type) || BACKUP_TYPE_OPTIONS[0];
  const selectedCompanyName = useMemo(() => {
    if (!filters.company_id) return 'All Companies';
    return companies.find((company) => String(company.id) === String(filters.company_id))?.company_name || `Company #${filters.company_id}`;
  }, [companies, filters.company_id]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/superadmin/system/backups', {
        params: {
          company_id: filters.company_id || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        },
        timeout: BACKUP_TIMEOUT_MS,
      });
      if (res.data?.success) setRows(res.data.data || []);
    } catch (err) {
      setError(await getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await api.get('/superadmin/companies', { timeout: BACKUP_TIMEOUT_MS });
      if (res.data?.success) setCompanies(res.data.data || []);
    } catch (_err) {
      setCompanies([]);
    }
  };

  useEffect(() => {
    if (!employee || (role !== 'superadmin' && role !== 'super_admin')) {
      navigate('/');
      return;
    }
    let aborted = false;
    (async () => {
      if (aborted) return;
      await loadCompanies();
      await load();
    })();
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const formatSize = (bytes) => {
    const value = Number(bytes || 0);
    if (!value) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(value) / Math.log(k)), sizes.length - 1);
    return `${parseFloat((value / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');

  const fetchBackupPayload = async (row) => {
    const key = row?.id || 'current';
    setDownloadingId(key);
    try {
      const res = await api.get('/superadmin/system/backups/export', {
        params: row?.id
          ? { id: row.id }
          : {
              company_id: row?.company_id || filters.company_id || undefined,
              type: row?.backup_type || type,
            },
        responseType: 'blob',
        timeout: BACKUP_TIMEOUT_MS,
      });
      const blob = new Blob([res.data], { type: 'application/json;charset=utf-8' });
      const text = await blob.text();
      const payload = JSON.parse(text);
      const filename = getFilenameFromHeader(res.headers?.['content-disposition'])
        || row?.file_path
        || row?.file_name
        || `backup-${Date.now()}.json`;
      return {
        payload,
        text,
        file_name: filename,
        file_size: blob.size,
        summary: payload?.summary || null,
      };
    } catch (err) {
      setError(await getApiErrorMessage(err));
      return null;
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadJsonBackup = async (row) => {
    const backup = await fetchBackupPayload(row);
    if (!backup) return null;
    downloadBlob(new Blob([backup.text], { type: 'application/json;charset=utf-8' }), backup.file_name);
    return backup;
  };

  const downloadExcelBackup = async (row) => {
    const backup = await fetchBackupPayload(row);
    if (!backup) return null;
    const workbook = await buildBackupWorkbook(backup.payload);
    const buffer = await workbook.xlsx.writeBuffer();
    const excelName = backup.file_name.replace(/\.json$/i, '.xlsx');
    downloadBlob(new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }), excelName);
    return {
      ...backup,
      file_name: excelName,
      file_size: buffer.byteLength || buffer.length || backup.file_size,
    };
  };

  const generateBackup = async (format = 'json') => {
    setGenerating(true);
    setError('');
    try {
      const row = {
        backup_type: type,
        company_id: filters.company_id || null,
      };
      const backup = format === 'excel'
        ? await downloadExcelBackup(row)
        : await downloadJsonBackup(row);
      if (backup) {
        setLastGenerated({
          ...backup,
          backup_type: type,
          company_id: filters.company_id || null,
          company_name: selectedCompanyName,
        });
        await load();
      }
    } catch (err) {
      setError(await getApiErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const deleteBackup = async (id) => {
    if (!window.confirm('Delete this backup history record?')) return;
    try {
      const res = await api.delete(`/superadmin/system/backups/${id}`, { timeout: BACKUP_TIMEOUT_MS });
      if (res.data?.success) await load();
    } catch (err) {
      alert(await getApiErrorMessage(err));
    }
  };

  const previewImport = async () => {
    if (!importFile) {
      setError('Please select a backup .json or .xlsx file first.');
      return;
    }
    setImporting(true);
    setError('');
    try {
      const parsed = await parseBackupFile(importFile);
      setImportPayload(parsed);
      const res = await api.post('/superadmin/system/backups/import', {
        backup: parsed,
        mode: importMode,
        dry_run: true,
      }, { timeout: BACKUP_TIMEOUT_MS });
      if (res.data?.success) setImportPreview(res.data.data?.summary || null);
    } catch (err) {
      setError(await getApiErrorMessage(err));
      setImportPreview(null);
      setImportPayload(null);
    } finally {
      setImporting(false);
    }
  };

  const restoreImport = async () => {
    if (!importPayload) {
      await previewImport();
      return;
    }
    const previewRows = Number(importPreview?.total_rows || 0).toLocaleString('en-IN');
    const confirmed = window.confirm(
      importMode === 'replace'
        ? `Restore backup in REPLACE mode? Existing included company rows will be removed first, then ${previewRows} backup rows will be imported.`
        : `Restore backup in UPSERT mode? ${previewRows} backup rows will be inserted/updated.`
    );
    if (!confirmed) return;

    setImporting(true);
    setError('');
    try {
      const res = await api.post('/superadmin/system/backups/import', {
        backup: importPayload,
        mode: importMode,
        dry_run: false,
        confirm: 'RESTORE_BACKUP',
      }, { timeout: BACKUP_TIMEOUT_MS });
      if (res.data?.success) {
        setImportPreview(res.data.data?.summary || importPreview);
        await load();
        alert('Backup imported successfully.');
      }
    } catch (err) {
      setError(await getApiErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const lastSummary = lastGenerated?.summary || {};

  return (
    <div className="superadmin-backups-page mx-auto max-w-7xl space-y-5 pb-10">
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <i className="fas fa-database text-slate-400"></i>
              System Backup
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Company Data Export</h1>
            <p className="mt-1 text-sm text-slate-500">Generate restore-ready JSON or Excel backups with table-wise row counts.</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Refresh History"
          >
            <i className={`fas fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900">Generate Backup</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
              JSON Export
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Company</span>
              <select
                value={filters.company_id}
                onChange={(e) => setFilters({ ...filters, company_id: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.company_name}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Backup Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              >
                {BACKUP_TYPE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">{selectedType.label}</div>
            <div className="mt-1 text-sm text-slate-600">{selectedType.hint}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-md bg-white px-2.5 py-1 ring-1 ring-slate-200">{selectedCompanyName}</span>
              <span className="rounded-md bg-white px-2.5 py-1 ring-1 ring-slate-200">JSON + Excel</span>
              <span className="rounded-md bg-white px-2.5 py-1 ring-1 ring-slate-200">5 minute timeout</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => generateBackup('json')}
              disabled={generating || downloadingId !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className={`fas ${generating ? 'fa-circle-notch animate-spin' : 'fa-file-export'}`}></i>
              {generating ? 'Generating...' : 'Generate JSON'}
            </button>
            <button
              onClick={() => generateBackup('excel')}
              disabled={generating || downloadingId !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className={`fas ${generating ? 'fa-circle-notch animate-spin' : 'fa-file-excel'}`}></i>
              {generating ? 'Generating...' : 'Generate Excel'}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Latest Export Summary</h3>
          {lastGenerated ? (
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">File</div>
                <div className="mt-1 break-all font-mono text-xs text-slate-700">{lastGenerated.file_name}</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="text-[11px] font-bold uppercase text-slate-500">Tables</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(lastSummary.exported_tables)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="text-[11px] font-bold uppercase text-slate-500">Rows</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(lastSummary.total_rows)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="text-[11px] font-bold uppercase text-slate-500">Size</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{formatSize(lastGenerated.file_size)}</div>
                </div>
              </div>
              {lastSummary.errors?.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  {lastSummary.errors.length} table issue found. Export still downloaded with available data.
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  Backup generated successfully.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Latest backup details will appear here after export.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <i className="fas fa-upload text-slate-400"></i>
              Restore Backup
            </div>
            <h2 className="mt-2 text-base font-semibold text-slate-900">Import JSON or Excel Backup</h2>
            <p className="mt-1 text-sm text-slate-500">Preview first, then restore the same exported rows back into the company tables.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-md bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200">.json</span>
            <span className="rounded-md bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200">.xlsx</span>
            <span className="rounded-md bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200">Dry-run preview</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.xlsx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setImportFile(file);
                setImportPreview(null);
                setImportPayload(null);
                setError('');
              }}
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <i className="fas fa-folder-open"></i>
              Select Backup File
            </button>
            <div className="mt-3 text-sm text-slate-600">
              {importFile ? (
                <span className="font-medium text-slate-900">{importFile.name}</span>
              ) : (
                'No file selected.'
              )}
            </div>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Restore Mode</span>
            <select
              value={importMode}
              onChange={(event) => {
                setImportMode(event.target.value);
                setImportPreview(null);
                setImportPayload(null);
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
            >
              <option value="replace">Replace company data</option>
              <option value="upsert">Merge / upsert rows</option>
            </select>
            <p className="text-xs leading-relaxed text-slate-500">
              Replace mode removes included company rows first, then imports backup rows with same IDs.
            </p>
          </label>
        </div>

        {importPreview ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="text-[11px] font-bold uppercase text-slate-500">Companies</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(importPreview.companies)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="text-[11px] font-bold uppercase text-slate-500">Tables</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(importPreview.exported_tables || Object.keys(importPreview.table_counts || {}).length)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="text-[11px] font-bold uppercase text-slate-500">Rows</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(importPreview.total_rows || importPreview.imported_rows)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="text-[11px] font-bold uppercase text-slate-500">Mode</div>
              <div className="mt-1 text-lg font-semibold capitalize text-slate-900">{importPreview.mode || importMode}</div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={previewImport}
            disabled={importing || !importFile}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className={`fas ${importing ? 'fa-circle-notch animate-spin' : 'fa-search'}`}></i>
            Preview Import
          </button>
          <button
            type="button"
            onClick={restoreImport}
            disabled={importing || !importFile || !importPreview}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className={`fas ${importing ? 'fa-circle-notch animate-spin' : 'fa-rotate-left'}`}></i>
            Restore Data
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Backup History</h3>
            <p className="mt-1 text-sm text-slate-500">Download previous backup records or remove only the history entry.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[420px]">
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">From</span>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">To</span>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                <th className="px-5 py-3">Sl No</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Tables</th>
                <th className="px-5 py-3">Rows</th>
                <th className="px-5 py-3">Size</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td className="px-5 py-12 text-center text-slate-400" colSpan={9}>
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent"></div>
                      Loading backup records...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-slate-400" colSpan={9}>
                    No backups found.
                  </td>
                </tr>
              ) : rows.map((backup, idx) => {
                const summary = getSummary(backup);
                const isDownloading = downloadingId === backup.id;
                return (
                  <tr key={backup.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-4 text-sm font-medium text-slate-500">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{backup.company_name || 'All Companies'}</div>
                      <div className="mt-0.5 max-w-[220px] truncate font-mono text-[10px] text-slate-400">{backup.file_path}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                        {backup.backup_type}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                      {formatNumber(summary.exported_tables)}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                      {formatNumber(summary.total_rows)}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-600">{formatSize(backup.file_size)}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{new Date(backup.created_at).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                        {backup.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => downloadJsonBackup(backup)}
                          disabled={downloadingId !== null}
                          title="Download JSON Backup"
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <i className={`fas ${isDownloading ? 'fa-circle-notch animate-spin' : 'fa-file-code'} text-sm`}></i>
                        </button>
                        <button
                          onClick={() => downloadExcelBackup(backup)}
                          disabled={downloadingId !== null}
                          title="Download Excel Backup"
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <i className={`fas ${isDownloading ? 'fa-circle-notch animate-spin' : 'fa-file-excel'} text-sm`}></i>
                        </button>
                        <button
                          onClick={() => deleteBackup(backup.id)}
                          disabled={downloadingId !== null}
                          title="Delete Record"
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <i className="fas fa-trash-alt text-sm"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900">
        <span className="font-bold">Security Note:</span> JSON and Excel backups contain raw database rows. File paths are included for uploaded documents, but actual files from upload storage need a separate server backup.
      </div>
    </div>
  );
}
