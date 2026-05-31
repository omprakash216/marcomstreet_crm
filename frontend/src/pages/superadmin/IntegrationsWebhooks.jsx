import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

export default function IntegrationsWebhooks() {
  const navigate = useNavigate();
  const employeeRef = React.useRef(getEmployee());
  const employee = employeeRef.current;
  const role = normalizeRole(employee?.role);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ company_id: '', event: 'lead.created', target_url: '', secret: '', status: 'active' });

  const employeeId = employee?.id;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/integrations/webhooks');
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

  const createWebhook = async (e) => {
    e.preventDefault();
    if (!form.target_url.trim()) return;
    try {
      const payload = {
        company_id: form.company_id ? Number(form.company_id) : null,
        event: form.event,
        target_url: form.target_url,
        secret: form.secret || null,
        status: form.status,
      };
      const res = await api.post('/superadmin/integrations/webhooks', payload);
      if (res.data?.success) {
        setForm({ company_id: '', event: 'lead.created', target_url: '', secret: '', status: 'active' });
        await load();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const setStatus = async (row, status) => {
    try {
      const res = await api.patch(`/superadmin/integrations/webhooks/${row.id}/status`, { status });
      if (res.data?.success) await load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const remove = async (row) => {
    if (!window.confirm('Delete this webhook?')) return;
    try {
      const res = await api.delete(`/superadmin/integrations/webhooks/${row.id}`);
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
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Webhooks</h1>
            <p className="text-slate-500 text-sm mt-1">Notify external systems when leads, deals, or HR events happen.</p>
          </div>
        </div>
      </div>

      <form onSubmit={createWebhook} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-600">Company ID (optional)</label>
            <input
              value={form.company_id}
              onChange={(e) => setForm({ ...form, company_id: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
              placeholder="Leave blank for all tenants"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Event</label>
            <select
              value={form.event}
              onChange={(e) => setForm({ ...form, event: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
            >
              <option value="lead.created">lead.created</option>
              <option value="lead.updated">lead.updated</option>
              <option value="employee.created">employee.created</option>
              <option value="invoice.paid">invoice.paid</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Target URL</label>
            <input
              value={form.target_url}
              onChange={(e) => setForm({ ...form, target_url: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
              placeholder="https://example.com/webhooks/leads"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Secret (optional)</label>
            <input
              value={form.secret}
              onChange={(e) => setForm({ ...form, secret: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
            >
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition">
            Add Webhook
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">URL</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>No webhooks configured.</td></tr>
              ) : rows.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-900 font-semibold">{w.company_name || (w.company_id ? `Company #${w.company_id}` : 'All')}</td>
                  <td className="px-4 py-3 text-slate-700">{w.event}</td>
                  <td className="px-4 py-3 text-slate-700 break-all">{w.target_url}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${w.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {w.status === 'active' ? (
                      <button
                        onClick={() => setStatus(w, 'disabled')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-800 hover:bg-slate-300 transition"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus(w, 'active')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                      >
                        Enable
                      </button>
                    )}
                    <button
                      onClick={() => remove(w)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-100 transition"
                    >
                      Delete
                    </button>
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

