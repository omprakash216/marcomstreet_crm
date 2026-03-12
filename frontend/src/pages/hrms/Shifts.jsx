import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', start_time: '', end_time: '', grace_minutes: 0 });
  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    shift_id: '',
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
  });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [shiftResp, assignResp, empResp] = await Promise.all([
        api.get('/hrms/shifts'),
        api.get('/hrms/shifts/assignments'),
        api.get('/employees'),
      ]);
      if (shiftResp.data?.success) setShifts(shiftResp.data.data || []);
      if (assignResp.data?.success) setAssignments(assignResp.data.data || []);
      if (empResp.data?.success) setEmployees(empResp.data.data || []);
    } catch (err) {
      console.error('Shift load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm({ name: '', start_time: '', end_time: '', grace_minutes: 0 });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.start_time || !form.end_time) return;
    try {
      if (editing?.id) {
        await api.put(`/hrms/shifts/${editing.id}`, form);
      } else {
        await api.post('/hrms/shifts', form);
      }
      resetForm();
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save shift');
    }
  };

  const handleEdit = (shift) => {
    setEditing(shift);
    setForm({
      name: shift.name || '',
      start_time: shift.start_time || '',
      end_time: shift.end_time || '',
      grace_minutes: shift.grace_minutes || 0,
    });
  };

  const handleDelete = async (shift) => {
    if (!shift?.id) return;
    const ok = window.confirm(`Delete shift "${shift.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/hrms/shifts/${shift.id}`);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete shift');
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.employee_id || !assignForm.shift_id || !assignForm.effective_from) return;
    try {
      await api.post('/hrms/shifts/assign', assignForm);
      setAssignForm({
        employee_id: '',
        shift_id: '',
        effective_from: new Date().toISOString().slice(0, 10),
        effective_to: '',
      });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign shift');
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Shift Management</h1>
          <p className="text-slate-300 text-sm">Create shifts and assign employees</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">{editing ? 'Edit Shift' : 'Add Shift'}</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Shift Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Start Time</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">End Time</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Grace Minutes</label>
              <input
                type="number"
                value={form.grace_minutes}
                onChange={(e) => setForm({ ...form, grace_minutes: e.target.value })}
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
            <h2 className="text-lg font-semibold text-slate-900">All Shifts</h2>
            <span className="text-xs text-slate-500">{shifts.length} records</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading...</div>
          ) : shifts.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No shifts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Start</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">End</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Grace</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-900">{shift.name}</td>
                      <td className="px-4 py-3 text-slate-600">{shift.start_time}</td>
                      <td className="px-4 py-3 text-slate-600">{shift.end_time}</td>
                      <td className="px-4 py-3 text-slate-600">{shift.grace_minutes || 0} mins</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => handleEdit(shift)} className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(shift)} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100">
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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-slate-900">Assign Shifts</h2>
        </div>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleAssign} className="space-y-4 lg:col-span-1">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Employee</label>
              <select
                value={assignForm.employee_id}
                onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
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
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Shift</label>
              <select
                value={assignForm.shift_id}
                onChange={(e) => setAssignForm({ ...assignForm, shift_id: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                required
              >
                <option value="">Select shift</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.start_time} - {shift.end_time})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">From</label>
                <input
                  type="date"
                  value={assignForm.effective_from}
                  onChange={(e) => setAssignForm({ ...assignForm, effective_from: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">To</label>
                <input
                  type="date"
                  value={assignForm.effective_to}
                  onChange={(e) => setAssignForm({ ...assignForm, effective_to: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
              Assign Shift
            </button>
          </form>

          <div className="lg:col-span-2">
            {loading ? (
              <div className="text-sm text-slate-500">Loading...</div>
            ) : assignments.length === 0 ? (
              <div className="text-sm text-slate-500">No assignments yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Shift</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">From</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignments.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-slate-900">{row.employee_name}</td>
                        <td className="px-4 py-3 text-slate-600">{row.shift_name}</td>
                        <td className="px-4 py-3 text-slate-600">{String(row.effective_from || '').slice(0, 10)}</td>
                        <td className="px-4 py-3 text-slate-600">{row.effective_to ? String(row.effective_to).slice(0, 10) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
