import { useEffect, useState } from 'react';
import api from '../../utils/api';

const TYPES = [
  { id: 'salary', label: 'Salary' },
  { id: 'rent', label: 'Rent' },
  { id: 'software', label: 'Software / Tools' },
  { id: 'operations', label: 'Operations' },
  { id: 'other', label: 'Other' },
];

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    type: '',
  });
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    type: 'salary',
    description: '',
    amount: '',
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.type) params.type = filters.type;
      const resp = await api.get('/expenses', { params });
      setExpenses(resp.data.data || []);
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/expenses', {
        ...form,
        amount: parseFloat(form.amount || 0),
      });
      setShowModal(false);
      setForm({
        expense_date: new Date().toISOString().slice(0, 10),
        type: 'salary',
        description: '',
        amount: '',
      });
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save expense');
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm('Delete this expense entry?')) return;
    try {
      await api.delete(`/expenses/${row.id}`);
      fetchExpenses();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.type) params.append('type', filters.type);
    window.open(`/api/expenses/export?${params.toString()}`, '_blank');
  };

  const totalAmount = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  return (
    <div className="space-y-6 text-slate-800">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Admin - Expenses</p>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Expenses</h1>
          <p className="text-slate-500 text-sm">Track salaries and all operational expenses from one consolidated view.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <i className="fas fa-file-excel text-emerald-600" />
            Export
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-800 transition shadow-sm active:scale-[0.98]"
          >
            <i className="fas fa-plus" />
            Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
                Total Expenses (Filtered)
              </p>
              <h2 className="text-4xl font-semibold text-slate-900 tracking-tight mb-2">
                INR {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <div className="px-3 py-1.5 bg-slate-50 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700">
                {expenses.length} Entries
              </div>
              <div className="text-slate-500 text-xs font-medium">Last updated: {new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold tracking-[0.25em] uppercase text-slate-500">Filters</h3>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">From</label>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">To</label>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
              >
                <option value="">All</option>
                {TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchExpenses}
              className="w-full rounded-xl bg-slate-900 text-white text-xs font-semibold py-2 mt-1 hover:bg-slate-800"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between text-xs text-slate-500">
          <span>Showing latest expense entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-400">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-400">
                    No expenses found for selected filters.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                      {e.expense_date}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold capitalize text-slate-700">
                        {e.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-800">
                        {e.description || '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-slate-900">
                        INR {parseFloat(e.amount).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(e)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 hover:shadow-md text-xs"
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 leading-tight">Add Expense</h3>
                <p className="text-slate-400 text-xs font-medium mt-1">
                  Record a new expense entry (salary, rent, tools or other).
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-500 rounded-full hover:bg-slate-100 transition"
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    {TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  placeholder="e.g. March salary payout, Figma subscription, office rent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Amount (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-sm"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


