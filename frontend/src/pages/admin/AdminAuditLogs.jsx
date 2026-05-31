import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [statusGroup, setStatusGroup] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [page, method, statusGroup]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page,
        limit: pageSize,
      };
      if (search) params.search = search;
      if (method) params.method = method;
      if (statusGroup) params.status_group = statusGroup;

      const response = await api.get('/admin/audit-logs', { params });
      if (response.data?.success) {
        const rows = Array.isArray(response.data.data) ? response.data.data : [];
        setLogs(rows);
        setHasNextPage(Boolean(response.data?.has_next) || rows.length === pageSize);
      } else {
        setLogs([]);
        setHasNextPage(false);
        setError(response.data?.message || 'Failed to load audit logs');
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setLogs([]);
      setHasNextPage(false);
      setError(error.response?.data?.message || `Failed to load audit logs (HTTP ${error.response?.status || 'error'})`);
    }
    finally { setLoading(false); }
  };

  const formatTime = (log) => {
    const raw = log.accessed_at || log.created_at || log.timestamp || log.time;
    if (!raw) return '—';
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return String(raw);
    return dt.toLocaleString();
  };

  const methodPill = (m) => {
    const method = String(m || '').toUpperCase();
    const base = 'px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider';
    if (method === 'POST') return `${base} bg-green-100 text-green-700`;
    if (method === 'PUT' || method === 'PATCH') return `${base} bg-blue-100 text-blue-700`;
    if (method === 'DELETE') return `${base} bg-red-100 text-red-700`;
    return `${base} bg-gray-100 text-gray-700`;
  };

  const statusTone = (code) => {
    const n = Number(code);
    if (!Number.isFinite(n)) return 'text-gray-600';
    if (n >= 400) return 'text-red-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/15 rounded-xl flex items-center justify-center">
              <i className="fas fa-history text-white text-2xl"></i>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Audit Logs</h1>
              <p className="text-slate-300 text-sm">Track API access and key system events</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              onClick={() => fetchLogs()}
              className="px-5 py-2.5 bg-white text-slate-800 rounded-xl font-semibold hover:bg-slate-100 transition-colors shadow-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search endpoint, user, IP..."
            className="flex-1 min-w-[220px] border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
          <select
            value={method}
            onChange={(e) => { setMethod(e.target.value); setPage(1); }}
            className="border rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
          <select
            value={statusGroup}
            onChange={(e) => { setStatusGroup(e.target.value); setPage(1); }}
            className="border rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="">All Status</option>
            <option value="success">Success (&lt; 400)</option>
            <option value="error">Error (≥ 400)</option>
          </select>
          <button
            onClick={() => { setSearch(''); setMethod(''); setStatusGroup(''); setPage(1); }}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-900 font-semibold">Audit logs not loading</p>
          <p className="text-amber-800 text-sm mt-1">{error}</p>
        </div>
      ) : null}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Endpoint</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-4 text-center">Loading logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-4 text-center text-gray-500">No audit logs found</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatTime(log)}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{log.employee_name || 'System'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-[200px]" title={log.endpoint}>
                      {log.endpoint || log.path || log.url || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={methodPill(log.method)}>{log.method || '—'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.ip_address || log.ip || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-bold ${statusTone(log.response_code ?? log.status_code)}`}>
                        {log.response_code ?? log.status_code ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 py-4 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Page <span className="font-semibold">{page}</span> · Showing{' '}
              <span className="font-semibold">{logs.length}</span> record{logs.length === 1 ? '' : 's'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNextPage}
                className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

