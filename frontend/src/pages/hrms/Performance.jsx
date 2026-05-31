import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';

const RATINGS = ['Excellent', 'Good', 'Average', 'Needs Improvement'];

export default function Performance() {
  const [reviews, setReviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(0);
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

  const fmtDate = (v) => {
    if (!v) return '-';
    const s = String(v);
    if (/^\\d{4}-\\d{2}-\\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? s.slice(0, 10) : d.toISOString().slice(0, 10);
  };

  const ratingUi = (rating) => {
    const r = String(rating || '').toLowerCase();
    if (r.includes('excellent')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (r.includes('good')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (r.includes('average')) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

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

  useEffect(() => {
    // Reset pagination when dataset changes
    setPage(0);
  }, [reviews.length]);

  const sortedReviews = [...reviews].sort((a, b) => {
    const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
    if (ta && tb && ta !== tb) return tb - ta;

    const da = a?.period_end ? new Date(a.period_end).getTime() : 0;
    const db = b?.period_end ? new Date(b.period_end).getTime() : 0;
    if (da && db && da !== db) return db - da;

    return (Number(b?.id) || 0) - (Number(a?.id) || 0);
  });

  const totalRows = sortedReviews.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const startIndex = safePage * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalRows);
  const paginatedReviews = sortedReviews.slice(startIndex, endIndex);

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
            <span className="text-xs text-slate-500">{totalRows} records</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading...</div>
          ) : reviews.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No reviews found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">SL</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Employee</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Period</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Rating</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Goals</th>
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Feedback</th>
                    {canManage && (
                      <th className="px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedReviews.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors align-top">
                      <td className="px-5 py-4 text-sm text-slate-600">{startIndex + idx + 1}</td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-semibold text-slate-900 max-w-[240px] truncate" title={item.employee_name || ''}>
                          {item.employee_name || 'Employee'}
                        </div>
                        {item.employee_code && (
                          <div className="text-xs text-slate-500 mt-0.5">{item.employee_code}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">
                        {fmtDate(item.period_start)} - {fmtDate(item.period_end)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ratingUi(item.rating)}`}>
                          {item.rating || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-slate-600 max-w-[320px] truncate" title={item.goals || ''}>
                          {item.goals || '-'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-slate-600 max-w-[360px] truncate" title={item.feedback || ''}>
                          {item.feedback || '-'}
                        </div>
                      </td>
                      {canManage && (
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
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && totalRows > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-white">
                  <div className="text-xs text-slate-500">
                    Showing <span className="font-semibold text-slate-700">{startIndex + 1}</span>-<span className="font-semibold text-slate-700">{endIndex}</span> of{' '}
                    <span className="font-semibold text-slate-700">{totalRows}</span>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <div className="text-xs text-slate-500">
                      Page <span className="font-semibold text-slate-700">{safePage + 1}</span> / <span className="font-semibold text-slate-700">{totalPages}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

