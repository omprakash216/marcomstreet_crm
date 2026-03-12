import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', message: '', starts_at: '', ends_at: '' });

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/hrms/announcements');
      if (resp.data?.success) setAnnouncements(resp.data.data || []);
    } catch (err) {
      console.error('Announcements load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm({ title: '', message: '', starts_at: '', ends_at: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.message) return;
    const payload = {
      ...form,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    };
    try {
      if (editing?.id) {
        await api.put(`/hrms/announcements/${editing.id}`, payload);
      } else {
        await api.post('/hrms/announcements', payload);
      }
      resetForm();
      fetchAnnouncements();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save announcement');
    }
  };

  const handleEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || '',
      message: item.message || '',
      starts_at: item.starts_at ? String(item.starts_at).slice(0, 16) : '',
      ends_at: item.ends_at ? String(item.ends_at).slice(0, 16) : '',
    });
  };

  const handleDelete = async (item) => {
    if (!item?.id) return;
    const ok = window.confirm(`Delete announcement "${item.title}"?`);
    if (!ok) return;
    try {
      await api.delete(`/hrms/announcements/${item.id}`);
      fetchAnnouncements();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete announcement');
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Announcements</h1>
          <p className="text-slate-300 text-sm">Publish HR updates for the team</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editing ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Message</label>
              <textarea
                rows="4"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Start</label>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">End</label>
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
                {editing ? 'Update' : 'Publish'}
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
            <h2 className="text-lg font-semibold text-slate-900">Published Announcements</h2>
            <span className="text-xs text-slate-500">{announcements.length} records</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading...</div>
          ) : announcements.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No announcements found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {announcements.map((item) => (
                <div key={item.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                      <p className="text-xs text-slate-500 mt-1">{item.message}</p>
                      <p className="text-[11px] text-slate-400 mt-2">
                        {item.starts_at ? `From ${String(item.starts_at).replace('T', ' ').slice(0, 16)}` : 'Active now'}
                        {item.ends_at ? ` • Until ${String(item.ends_at).replace('T', ' ').slice(0, 16)}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(item)} className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(item)} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
