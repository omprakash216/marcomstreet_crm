import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function Holidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', date: '', description: '' });
  const [holidayNameMode, setHolidayNameMode] = useState('select');

  const normalizedHolidayOptions = Array.from(
    new Map(
      holidays
        .filter((item) => String(item.name || '').trim())
        .map((item) => {
          const name = String(item.name || '').trim();
          return [
            name.toLowerCase(),
            {
              name,
              description: item.description || '',
            },
          ];
        })
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const selectedHolidayNameExists = normalizedHolidayOptions.some(
    (item) => item.name.toLowerCase() === String(form.name || '').trim().toLowerCase()
  );

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/hrms/holidays');
      if (resp.data?.success) setHolidays(resp.data.data || []);
    } catch (err) {
      console.error('Holidays load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm({ name: '', date: '', description: '' });
    setHolidayNameMode('select');
  };

  const handleHolidaySelect = (value) => {
    if (value === '__new__') {
      setHolidayNameMode('new');
      setForm((prev) => ({ ...prev, name: '', description: prev.description || '' }));
      return;
    }
    setHolidayNameMode('select');
    const selected = normalizedHolidayOptions.find((item) => item.name === value);
    setForm((prev) => ({
      ...prev,
      name: value,
      description: prev.description || selected?.description || '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.date) return;
    try {
      if (editing?.id) {
        await api.put(`/hrms/holidays/${editing.id}`, form);
      } else {
        await api.post('/hrms/holidays', form);
      }
      resetForm();
      fetchHolidays();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save holiday');
    }
  };

  const handleEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      date: String(item.date || '').slice(0, 10),
      description: item.description || '',
    });
    setHolidayNameMode('new');
  };

  const handleDelete = async (item) => {
    if (!item?.id) return;
    const ok = window.confirm(`Delete holiday "${item.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/hrms/holidays/${item.id}`);
      fetchHolidays();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete holiday');
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Holiday Management</h1>
          <p className="text-slate-300 text-sm">Add and manage company holidays</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editing ? 'Edit Holiday' : 'Add Holiday'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Holiday Name</label>
              <select
                value={holidayNameMode === 'new' || (form.name && !selectedHolidayNameExists) ? '__new__' : form.name}
                onChange={(e) => handleHolidaySelect(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
              >
                <option value="">{normalizedHolidayOptions.length ? 'Select company holiday' : 'No saved holidays yet'}</option>
                {normalizedHolidayOptions.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
                <option value="__new__">+ Create new holiday name</option>
              </select>
              {(holidayNameMode === 'new' || (form.name && !selectedHolidayNameExists)) && (
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="Enter new holiday name"
                  required
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description</label>
              <textarea
                rows="3"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
                {editing ? 'Update' : 'Save'}
              </button>
              {editing && (
                <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Holiday Calendar</h2>
            <span className="text-xs text-slate-500">{holidays.length} records</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading...</div>
          ) : holidays.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No holidays found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">SL</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Holiday</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holidays.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{String(item.date || '').slice(0, 10)}</td>
                      <td className="px-4 py-3 text-slate-700">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.description || '-'}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => handleEdit(item)} className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(item)} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
