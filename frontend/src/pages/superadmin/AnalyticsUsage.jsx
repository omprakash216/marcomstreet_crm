import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

export default function AnalyticsUsage() {
  const navigate = useNavigate();
  const employeeRef = React.useRef(getEmployee());
  const employee = employeeRef.current;
  const role = normalizeRole(employee?.role);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const employeeId = employee?.id;

  useEffect(() => {
    if (!employee || (role !== 'superadmin' && role !== 'super_admin')) {
      navigate('/');
      return;
    }
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get('/superadmin/analytics/usage');
        if (!aborted && res.data?.success) setData(res.data.data || null);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const companyUsage = data?.companyUsage || [];
  const apiUsage = data?.apiUsage || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-6 py-5 shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <div className="absolute -left-10 -top-12 h-44 w-44 rounded-full bg-slate-200 blur-2xl" />
          <div className="absolute right-6 -bottom-12 h-52 w-52 rounded-full bg-slate-300 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Usage Analytics</h1>
            <p className="text-slate-500 text-sm mt-1">Understand how tenants consume seats, storage, and API calls.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Company Usage</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-semibold">Company</th>
                  <th className="px-4 py-3 font-semibold">Users</th>
                  <th className="px-4 py-3 font-semibold">Employees</th>
                  <th className="px-4 py-3 font-semibold">Leads</th>
                  <th className="px-4 py-3 font-semibold">Storage (MB)</th>
                  <th className="px-4 py-3 font-semibold">API Requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td className="px-4 py-6 text-slate-500" colSpan={6}>Loading...</td></tr>
                ) : companyUsage.length === 0 ? (
                  <tr><td className="px-4 py-6 text-slate-500" colSpan={6}>No usage records yet.</td></tr>
                ) : companyUsage.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-900 font-semibold">{row.company_name || `Company #${row.company_id}`}</td>
                    <td className="px-4 py-3 text-slate-700">{row.total_users}</td>
                    <td className="px-4 py-3 text-slate-700">{row.total_employees}</td>
                    <td className="px-4 py-3 text-slate-700">{row.total_leads}</td>
                    <td className="px-4 py-3 text-slate-700">{row.storage_mb}</td>
                    <td className="px-4 py-3 text-slate-700">{row.api_requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent API usage</h2>
          <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : apiUsage.length === 0 ? (
              <p className="text-sm text-slate-500">No API logs recorded yet.</p>
            ) : apiUsage.map((d) => (
              <div key={d.day} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{d.day}</span>
                <span className="text-slate-900 font-semibold">{d.requests} requests</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

