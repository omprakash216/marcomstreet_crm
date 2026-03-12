import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';

const RATINGS = ['Excellent', 'Good', 'Average', 'Needs Improvement'];

export default function Performance() {
  const [reviews, setReviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    employee_id: '',
    period_start: '',
    period_end: '',
    rating: 'Good',
    goals: '',
    feedback: '',
  });
  const employee = getEmployee();
  const role = String(employee?.role || '').toLowerCase();
  const canManage = role === 'admin' || role === 'human_resources' || role === 'hr' || role === 'hr_manager';

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [revResp, empResp] = await Promise.all([
        api.get('/hrms/performance'),
        canManage ? api.get('/employees') : Promise.resolve({ data: { success: true, data: [] } }),
      ]);
      if (revResp.data?.success) setReviews(revResp.data.data || []);
      if (empResp.data?.success) setEmployees(empResp.data.data || []);
    } catch (err) {
      console.error('Performance load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm({
      employee_id: '',
      period_start: '',
      period_end: '',
      rating: 'Good',
      goals: '',
      feedback: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.rating || (!form.employee_id && canManage)) return;
    try {
      if (editing?.id) {
        await api.put(`/hrms/performance/${editing.id}`, form);
      } else {
        await api.post('/hrms/performance', form);
      }
      resetForm();
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save review');
    }
  };

  const handleEdit = (item) => {
    setEditing(item);
    setForm({
      employee_id: item.employee_id || '',
      period_start: item.period_start ? String(item.period_start).slice(0, 10) : '',
      period_end: item.period_end ? String(item.period_end).slice(0, 10) : '',
      rating: item.rating || 'Good',
      goals: item.goals || '',
      feedback: item.feedback || '',
    });
  };

  const handleDelete = async (item) => {
    if (!item?.id) return;
    const ok = window.confirm('Delete this review?');
    if (!ok) return;
    try {
      await api.delete(`/hrms/performance/${item.id}`);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete review');
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Performance Management</h1>
          <p className="text-slate-300 text-sm">Track goals and performance ratings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canManage && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {editing ? 'Edit Review' : 'Add Review'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Employee</label>
                <select
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.employee_code ? `(${emp.employee_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">From</label>
                  <input
                    type="date"
                    value={form.period_start}
                    onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">To</label>
                  <input
                    type="date"
                    value={form.period_end}
                    onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Rating</label>
                <select
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  required
                >
                  {RATINGS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Goals</label>
                <textarea
                  rows="3"
                  value={form.goals}
                  onChange={(e) => setForm({ ...form, goals: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Feedback</label>
                <textarea
                  rows="3"
                  value={form.feedback}
                  onChange={(e) => setForm({ ...form, feedback: e.target.value })}
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
        )}

        <div className={`${canManage ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden`}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Performance Reviews</h2>
            <span className="text-xs text-slate-500">{reviews.length} records</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading...</div>
          ) : reviews.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No reviews found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reviews.map((item) => (
                <div key={item.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {item.employee_name || 'Employee'} • {item.rating}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.period_start ? String(item.period_start).slice(0, 10) : '—'} to {item.period_end ? String(item.period_end).slice(0, 10) : '—'}
                      </p>
                      {item.goals && <p className="text-xs text-slate-600 mt-2">Goals: {item.goals}</p>}
                      {item.feedback && <p className="text-xs text-slate-600 mt-1">Feedback: {item.feedback}</p>}
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(item)} className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(item)} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100">
                          Delete
                        </button>
                      </div>
                    )}
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
