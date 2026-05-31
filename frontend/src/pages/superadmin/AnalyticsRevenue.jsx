import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function AnalyticsRevenue() {
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
        const res = await api.get('/superadmin/analytics/revenue');
        if (!aborted && res.data?.success) setData(res.data.data || null);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const monthly = data?.monthlyRevenue || [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-6 py-5 shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <div className="absolute -left-10 -top-12 h-44 w-44 rounded-full bg-slate-200 blur-2xl" />
          <div className="absolute right-6 -bottom-12 h-52 w-52 rounded-full bg-slate-300 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Revenue Analytics</h1>
            <p className="text-slate-500 text-sm mt-1">Track SaaS MRR growth, active subscriptions, and trend over time.</p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-right">
              <p className="text-slate-500 font-medium">Active Subscriptions</p>
              <p className="text-2xl font-semibold text-slate-900">{data?.activeSubscriptions ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Monthly Revenue</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip formatter={(val) => [`₹${val}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" fill="url(#revArea)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Subscription Growth</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {(data?.subscriptionGrowth || []).map((row) => (
              <div key={row.month} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{row.month}</span>
                <span className="text-slate-900 font-semibold">{row.value}</span>
              </div>
            ))}
            {(!data || !data.subscriptionGrowth || data.subscriptionGrowth.length === 0) && (
              <p className="text-sm text-slate-500">No subscription history yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

