import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

export default function SecurityLoginSessions() {
  const navigate = useNavigate();
  const employeeRef = React.useRef(getEmployee());
  const employee = employeeRef.current;
  const role = normalizeRole(employee?.role);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const employeeId = employee?.id;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/security/login-sessions');
      if (res.data?.success) setRows(res.data.data || []);
    } finally {
      setLoading(false);
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
      await load();
    })();
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const endSession = async (id) => {
    try {
      const res = await api.patch(`/superadmin/security/login-sessions/${id}/end`, {});
      if (res.data?.success) await load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-6 py-5 shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <div className="absolute -left-10 -top-12 h-44 w-44 rounded-full bg-slate-200 blur-2xl" />
          <div className="absolute right-6 -bottom-12 h-52 w-52 rounded-full bg-slate-300 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Login Sessions</h1>
            <p className="text-slate-500 text-sm mt-1">Monitor active tokens and remotely end suspicious sessions.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">IP</th>
                <th className="px-4 py-3 font-semibold">User Agent</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last Seen</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>No login sessions recorded yet.</td></tr>
              ) : rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-900 font-semibold">
                    {s.user_name || `User #${s.user_id}`}
                    <div className="text-xs text-slate-500">{s.user_email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.company_name || (s.company_id ? `Company #${s.company_id}` : '-')}</td>
                  <td className="px-4 py-3 text-slate-700">{s.ip_address || '-'}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{s.user_agent || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${s.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {s.last_seen ? new Date(s.last_seen).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status === 'active' && (
                      <button
                        onClick={() => endSession(s.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-100 transition"
                      >
                        End Session
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

