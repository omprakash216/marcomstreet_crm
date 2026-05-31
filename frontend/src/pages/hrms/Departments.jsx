import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/departments');
      if (resp.data?.success) setDepartments(resp.data.data || []);
    } catch (err) {
      console.error('Departments load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      if (editing?.id) {
        await api.put(`/departments/${editing.id}`, form);
      } else {
        await api.post('/departments', form);
      }
      resetForm();
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save department');
    }
  };

  const handleEdit = (dept) => {
    setEditing(dept);
    setForm({
      name: dept.name || '',
      description: dept.description || '',
    });
  };

  const handleDelete = async (dept) => {
    if (!dept?.id) return;
    const ok = window.confirm(`Delete department "${dept.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/departments/${dept.id}`);
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete department');
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Departments</h1>
            <p className="text-slate-300 text-sm">Create and manage departments</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editing ? 'Edit Department' : 'Add Department'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Department Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                placeholder="e.g. HR"
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
                placeholder="Optional notes"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                {editing ? 'Update' : 'Save'}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">All Departments</h2>
            <span className="text-xs text-slate-500">{departments.length} records</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading...</div>
          ) : departments.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No departments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">SL No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.map((dept, index) => (
                    <tr key={dept.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-500 font-semibold whitespace-nowrap">{String(index + 1).padStart(2, '0')}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{dept.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="max-w-[520px] truncate" title={dept.description || ''}>
                          {dept.description || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleEdit(dept)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(dept)}
                          className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100"
                        >
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
