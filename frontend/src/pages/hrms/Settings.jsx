import { useEffect, useState } from 'react';
import api from '../../utils/api';

const DEFAULTS = {
  company_name: '',
  working_hours_start: '09:30',
  working_hours_end: '18:30',
  leave_policy: '',
  payroll_rules: '',
};

export default function Settings() {
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/hrms/settings');
      if (resp.data?.success) {
        setForm({ ...DEFAULTS, ...resp.data.data });
      }
    } catch (err) {
      console.error('Settings load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put('/hrms/settings', form);
      alert('Settings saved');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save settings');
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-white">HR Settings</h1>
          <p className="text-slate-300 text-sm">Company details and HR policies</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {loading ? (
          <div className="text-sm text-slate-500">Loading...</div>
        ) : (
          <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Company Name</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Working Hours Start</label>
                <input
                  type="time"
                  value={form.working_hours_start}
                  onChange={(e) => setForm({ ...form, working_hours_start: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Working Hours End</label>
                <input
                  type="time"
                  value={form.working_hours_end}
                  onChange={(e) => setForm({ ...form, working_hours_end: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Leave Policy</label>
              <textarea
                rows="4"
                value={form.leave_policy}
                onChange={(e) => setForm({ ...form, leave_policy: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                placeholder="Summarize leave rules and balances..."
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Payroll Rules</label>
              <textarea
                rows="4"
                value={form.payroll_rules}
                onChange={(e) => setForm({ ...form, payroll_rules: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                placeholder="Tax, PF, overtime, and deduction rules..."
              />
            </div>
            <div className="lg:col-span-2 flex justify-end">
              <button type="submit" className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
                Save Settings
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
