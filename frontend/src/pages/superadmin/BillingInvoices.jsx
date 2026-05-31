import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

export default function BillingInvoices() {
  const navigate = useNavigate();
  const employeeRef = React.useRef(getEmployee());
  const employee = employeeRef.current;
  const role = normalizeRole(employee?.role);

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ subscription_id: '', amount: '', currency: 'INR', status: 'open', due_date: '' });

  const employeeId = employee?.id;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/billing/invoices');
      if (res.data?.success) setInvoices(res.data.data || []);
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

  const createInvoice = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        subscription_id: Number(form.subscription_id),
        amount: Number(form.amount || 0),
        currency: form.currency || 'INR',
        status: form.status || 'open',
        due_date: form.due_date || null,
      };
      const res = await api.post('/superadmin/billing/invoices', payload);
      if (res.data?.success) {
        setCreateOpen(false);
        setForm({ subscription_id: '', amount: '', currency: 'INR', status: 'open', due_date: '' });
        await load();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const markStatus = async (id, status) => {
    try {
      const res = await api.patch(`/superadmin/billing/invoices/${id}/status`, { status });
      if (res.data?.success) await load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-6 py-5 shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <div className="absolute -left-10 -top-12 h-44 w-44 rounded-full bg-slate-200 blur-2xl" />
          <div className="absolute right-6 -bottom-12 h-52 w-52 rounded-full bg-slate-300 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Invoices</h1>
            <p className="text-slate-500 text-sm mt-1">Create, track, and mark invoices as paid for tenants.</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-semibold shadow-sm hover:bg-slate-800 transition"
          >
            Create Invoice
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-semibold">Invoice</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>No invoices found.</td></tr>
              ) : invoices.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-semibold text-slate-900">{i.invoice_number || `#${i.id}`}</td>
                  <td className="px-4 py-3 text-slate-700">{i.company_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{i.plan_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-900 font-semibold">{i.currency || 'INR'} {Number(i.amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${String(i.status).toLowerCase() === 'paid'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : String(i.status).toLowerCase() === 'void'
                        ? 'bg-slate-100 text-slate-600 border border-slate-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{i.due_date ? String(i.due_date).slice(0, 10) : '-'}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => markStatus(i.id, 'paid')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    >
                      Mark paid
                    </button>
                    <button
                      onClick={() => markStatus(i.id, 'void')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-800 hover:bg-slate-300 transition"
                    >
                      Void
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Create Invoice</h2>
              <button onClick={() => setCreateOpen(false)} className="text-slate-500 hover:text-slate-800">✕</button>
            </div>
            <form onSubmit={createInvoice} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Subscription ID</label>
                  <input
                    value={form.subscription_id}
                    onChange={(e) => setForm({ ...form, subscription_id: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
                    placeholder="e.g. 12"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Amount</label>
                  <input
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
                    placeholder="e.g. 2499"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Currency</label>
                  <input
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
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
                    <option value="open">open</option>
                    <option value="draft">draft</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Due date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

