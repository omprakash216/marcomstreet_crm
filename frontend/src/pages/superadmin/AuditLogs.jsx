import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

export default function AuditLogs() {
    const navigate = useNavigate();
    const employeeRef = React.useRef(getEmployee());
    const employee = employeeRef.current;
    const employeeId = employee?.id;

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 12;

    useEffect(() => {
        const controller = new AbortController();
        const role = normalizeRole(employee?.role);

        if (!employee || (role !== 'superadmin' && role !== 'super_admin')) {
            navigate('/');
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await api.get('/superadmin/logs', { signal: controller.signal });
                if (res.data?.success) {
                    setLogs(res.data.data || []);
                    setLastRefreshed(new Date());
                }
            } catch (err) {
                if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
                    console.error('Error fetching logs:', err);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        return () => controller.abort();
    }, [employeeId, navigate, employee?.role]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/logs');
            if (res.data?.success) {
                setLogs(res.data.data || []);
                setLastRefreshed(new Date());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const totalLogs = logs.length;
    const uniqueUsers = new Set(logs.map(l => l.user_name || 'System')).size;
    const latestEntry = logs.reduce((acc, l) => {
        const ts = new Date(l.created_at || 0).getTime();
        return ts > acc ? ts : acc;
    }, 0);
    const latestDate = latestEntry ? new Date(latestEntry) : null;
    const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, totalLogs);
    const paginatedLogs = logs.slice(startIndex, endIndex);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 sm:px-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Super Admin</p>
                        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">System Audit Trail</h1>
                        <p className="text-slate-500 text-sm mt-1">Global activity logs across tenants and admin actions.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                            <span className="text-xs font-semibold text-slate-700">Latest: {latestDate ? latestDate.toLocaleString() : '—'}</span>
                        </div>
                        <button
                            onClick={fetchLogs}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700"
                        >
                            <i className="fas fa-sync-alt"></i> Refresh
                        </button>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Total Logs</p>
                        <p className="text-2xl font-semibold text-slate-900">{totalLogs}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Unique Users</p>
                        <p className="text-2xl font-semibold text-slate-900">{uniqueUsers}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Last Refreshed</p>
                        <p className="text-sm font-medium text-slate-800">{lastRefreshed ? lastRefreshed.toLocaleString() : '—'}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                <th className="px-6 py-5 whitespace-nowrap">Sl No</th>
                                <th className="px-8 py-5 whitespace-nowrap">Timestamp</th>
                                <th className="px-8 py-5 whitespace-nowrap">User</th>
                                <th className="px-8 py-5 whitespace-nowrap">Action</th>
                                <th className="px-8 py-5 whitespace-nowrap">Entity</th>
                                <th className="px-8 py-5 whitespace-nowrap">Company</th>
                                <th className="px-8 py-5 whitespace-nowrap">IP Address</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginatedLogs.map((log, idx) => (
                                <tr key={log.id || idx} className="hover:bg-indigo-50/10 transition-colors">
                                    <td className="px-6 py-5 text-gray-500 font-semibold whitespace-nowrap">
                                        {startIndex + idx + 1}
                                    </td>
                                    <td className="px-8 py-5 text-gray-500 font-medium whitespace-nowrap">
                                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                                    </td>
                                    <td className="px-8 py-5 whitespace-nowrap">
                                        <div className="font-bold text-gray-900 truncate max-w-[220px]" title={log.user_name || 'System'}>
                                            {log.user_name || 'System'}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${log.action?.includes('CREATE') ? 'bg-emerald-100 text-emerald-700' :
                                                log.action?.includes('DELETE') ? 'bg-rose-100 text-rose-700' :
                                                    log.action?.includes('UPDATE') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-gray-600 italic font-medium whitespace-nowrap truncate max-w-[160px]" title={log.entity_type || ''}>
                                        {log.entity_type}
                                    </td>
                                    <td className="px-8 py-5 font-semibold text-gray-700 whitespace-nowrap truncate max-w-[200px]" title={log.company_name || 'Global'}>
                                        {log.company_name || 'Global'}
                                    </td>
                                    <td className="px-8 py-5 text-xs text-gray-400 font-mono whitespace-nowrap">{log.ip_address || '0.0.0.0'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {logs.length === 0 && (
                        <div className="py-20 text-center">
                            <p className="text-gray-400 italic">No audit records found.</p>
                        </div>
                    )}
                </div>
            </div>
            {logs.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
                    <div className="text-xs text-gray-600">
                        Showing <span className="font-semibold">{startIndex + 1}</span>-<span className="font-semibold">{endIndex}</span> of{' '}
                        <span className="font-semibold">{totalLogs}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage <= 1}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <div className="text-xs text-gray-600 px-2">
                            Page <span className="font-semibold">{safePage}</span> / <span className="font-semibold">{totalPages}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage >= totalPages}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
