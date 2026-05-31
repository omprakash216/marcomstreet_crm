import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', message: '', starts_at: '', ends_at: '' });
  const now = new Date();

  const fmtDateTime = (v) => {
    if (!v) return '-';
    const s = String(v).replace('T', ' ');
    return s.length >= 16 ? s.slice(0, 16) : s;
  };

  const getStatus = (item) => {
    const start = item?.starts_at ? new Date(item.starts_at) : null;
    const end = item?.ends_at ? new Date(item.ends_at) : null;
    if (start && !Number.isNaN(start.getTime()) && now < start) return 'scheduled';
    if (end && !Number.isNaN(end.getTime()) && now > end) return 'expired';
    return 'active';
  };

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
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">SL</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Title</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Message</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Starts</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Ends</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {announcements.map((item, idx) => {
                    const status = getStatus(item);
                    const statusUi =
                      status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : status === 'scheduled'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 text-sm text-slate-600">{idx + 1}</td>
                        <td className="px-5 py-4">
                          <div className="text-sm font-semibold text-slate-900 max-w-[240px] truncate" title={item.title || ""}>
                            {item.title || "-"}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm text-slate-600 max-w-[420px] truncate" title={item.message || ""}>
                            {item.message || "-"}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.starts_at ? fmtDateTime(item.starts_at) : "Active"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.ends_at ? fmtDateTime(item.ends_at) : "-"}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusUi}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleEdit(item)} className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100">
                              Edit
                            </button>
                            <button onClick={() => handleDelete(item)} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
