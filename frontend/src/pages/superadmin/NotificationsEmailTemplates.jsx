import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

export default function NotificationsEmailTemplates() {
  const navigate = useNavigate();
  const employeeRef = React.useRef(getEmployee());
  const employee = employeeRef.current;
  const role = normalizeRole(employee?.role);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ id: null, code: '', channel: 'email', subject: '', body: '' });

  const employeeId = employee?.id;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/notifications/templates');
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

  const editTemplate = (tpl = null) => {
    if (!tpl) {
      setForm({ id: null, code: '', channel: 'email', subject: '', body: '' });
    } else {
      setForm({ id: tpl.id, code: tpl.code, channel: tpl.channel, subject: tpl.subject || '', body: tpl.body || '' });
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) return;
    try {
      const res = await api.post('/superadmin/notifications/templates', form);
      if (res.data?.success) {
        editTemplate(null);
        await load();
      }
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
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Email Templates</h1>
            <p className="text-slate-500 text-sm mt-1">Centralize onboarding, invoice, and password reset templates.</p>
          </div>
        </div>
      </div>

      <form onSubmit={save} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
              placeholder="welcome_email"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Channel</label>
            <select
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
            >
              <option value="email">email</option>
              <option value="sms">sms</option>
              <option value="whatsapp">whatsapp</option>
              <option value="inapp">inapp</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Subject</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
              placeholder="Welcome to MARCOM STREET"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Body</label>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={5}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none font-mono text-xs"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => editTemplate(null)}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
          >
            Clear
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
          >
            Save Template
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Channel</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={4}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={4}>No templates yet.</td></tr>
              ) : rows.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-900 font-semibold">{t.code}</td>
                  <td className="px-4 py-3 text-slate-700">{t.channel}</td>
                  <td className="px-4 py-3 text-slate-700">{t.subject || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => editTemplate(t)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-800 hover:bg-slate-300 transition"
                    >
                      Edit
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

