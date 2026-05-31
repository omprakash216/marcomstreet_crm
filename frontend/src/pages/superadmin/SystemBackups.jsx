import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

export default function SystemBackups() {
  const navigate = useNavigate();
  const employeeRef = React.useRef(getEmployee());
  const employee = employeeRef.current;
  const role = normalizeRole(employee?.role);

  const [type, setType] = useState('full');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState({ company_id: '', from: '', to: '' });

  const employeeId = employee?.id;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/system/backups', {
        params: {
          company_id: filters.company_id || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        }
      });
      if (res.data?.success) setRows(res.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await api.get('/superadmin/companies');
      if (res.data?.success) setCompanies(res.data.data || []);
    } catch (e) { }
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

  const generateBackup = async () => {
    try {
      const res = await api.post('/superadmin/system/backups', {
        type,
        company_id: filters.company_id || null
      });
      if (res.data?.success) {
        alert('Backup generated and logged successfully.');
        await load();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const deleteBackup = async (id) => {
    if (!window.confirm('Delete this backup record?')) return;
    try {
      const res = await api.delete(`/superadmin/system/backups/${id}`);
      if (res.data?.success) await load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const downloadBackup = async (row) => {
    try {
      const res = await api.get('/superadmin/system/backups/export', {
        params: { 
          company_id: row.company_id || undefined,
          type: row.backup_type || 'full'
        },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.file_path || `backup-${row.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-6 py-5 shadow-sm mb-6">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-slate-200 blur-2xl" />
          <div className="absolute right-10 -bottom-10 h-48 w-48 rounded-full bg-slate-300 blur-3xl" />
        </div>
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Backup Management</h1>
            <p className="text-slate-500 text-sm mt-1">Generate and manage company-wise data exports</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition"
              title="Refresh History"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <i className="fas fa-database text-slate-400"></i> Generate New Backup
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Company</label>
            <select
              value={filters.company_id}
              onChange={(e) => setFilters({ ...filters, company_id: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-slate-200 transition"
            >
              <option value="">All Companies (Global)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Backup Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-slate-200 transition"
            >
              <option value="full">Full Company Backup</option>
              <option value="crm">CRM Data Backup</option>
              <option value="hrms">HRMS Data Backup</option>
              <option value="users">Users & Employees</option>
              <option value="leads">Leads Only</option>
              <option value="attendance">Attendance Only</option>
              <option value="payroll">Payroll & Slips</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <button
              onClick={generateBackup}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
            >
              <i className="fas fa-file-export"></i>
              Generate Backup
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Backup History</h3>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
             <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Completed</span>
             <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Processing</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="px-6 py-4">Sl No</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td className="px-6 py-12 text-center text-slate-400" colSpan={7}>
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full"></div>
                    Loading backup records...
                  </div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-6 py-12 text-center text-slate-400" colSpan={7}>
                  No backups found. Generate one to see it here.
                </td></tr>
              ) : rows.map((b, idx) => (
                <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-medium text-slate-500">{idx + 1}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{b.company_name || 'Global System'}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[150px]">{b.file_path}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                      {b.backup_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                    {formatSize(b.file_size)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(b.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {b.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => downloadBackup(b)}
                        title="Download Backup"
                        className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-all shadow-sm"
                      >
                        <i className="fas fa-download text-sm"></i>
                      </button>
                      <button
                        onClick={() => deleteBackup(b.id)}
                        title="Delete Record"
                        className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-all shadow-sm"
                      >
                        <i className="fas fa-trash-alt text-sm"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <i className="fas fa-info-circle"></i>
        </div>
        <div className="text-sm text-blue-900 leading-relaxed">
          <p className="font-bold mb-1">Security Note:</p>
          Backups are exported in JSON format containing raw table data. These files can be large depending on the company data size. Always handle downloaded backups securely as they contain sensitive business information.
        </div>
      </div>
    </div>
  );
}
