import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function HrmsControl() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [leavePolicies, setLeavePolicies] = useState([]);
  const [attendanceRules, setAttendanceRules] = useState([]);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [payrollTemplates, setPayrollTemplates] = useState([]);

  const [lpForm, setLpForm] = useState({ name: '', annual_quota: 0, carry_forward: 0 });
  const [arForm, setArForm] = useState({ name: '', check_in_grace_min: 0, half_day_after_min: 0 });
  const [shiftForm, setShiftForm] = useState({ name: '', start_time: '', end_time: '' });
  const [payrollForm, setPayrollForm] = useState({ name: '', base_pay: 0 });

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [ov, lp, ar, sh, pr] = await Promise.all([
        api.get('/superadmin/hrms-config/overview'),
        api.get('/superadmin/hrms-config/leave-policies'),
        api.get('/superadmin/hrms-config/attendance-rules'),
        api.get('/superadmin/hrms-config/shift-templates'),
        api.get('/superadmin/hrms-config/payroll-templates'),
      ]);
      if (ov.data?.success) setOverview(ov.data.data);
      if (lp.data?.success) setLeavePolicies(lp.data.data);
      if (ar.data?.success) setAttendanceRules(ar.data.data);
      if (sh.data?.success) setShiftTemplates(sh.data.data);
      if (pr.data?.success) setPayrollTemplates(pr.data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addLeavePolicy = async (e) => {
    e.preventDefault();
    await api.post('/superadmin/hrms-config/leave-policies', lpForm);
    setLpForm({ name: '', annual_quota: 0, carry_forward: 0 });
    loadAll();
  };
  const addAttendanceRule = async (e) => {
    e.preventDefault();
    await api.post('/superadmin/hrms-config/attendance-rules', arForm);
    setArForm({ name: '', check_in_grace_min: 0, half_day_after_min: 0 });
    loadAll();
  };
  const addShift = async (e) => {
    e.preventDefault();
    await api.post('/superadmin/hrms-config/shift-templates', shiftForm);
    setShiftForm({ name: '', start_time: '', end_time: '' });
    loadAll();
  };
  const addPayroll = async (e) => {
    e.preventDefault();
    await api.post('/superadmin/hrms-config/payroll-templates', payrollForm);
    setPayrollForm({ name: '', base_pay: 0 });
    loadAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-6 py-5">
        <h1 className="text-3xl font-semibold text-slate-900">Global HRMS Control</h1>
        <p className="text-slate-500 text-sm">Manage policies, attendance rules, shift and payroll templates.</p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 text-sm">{error}</div>}

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            ['Employees', overview.total_employees],
            ['Attendance Today', overview.attendance_today],
            ['Payroll Expense', overview.payroll_expense],
            ['Leaves Today', overview.leaves_today],
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Leave Policies</h3>
          <form onSubmit={addLeavePolicy} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Name" value={lpForm.name} onChange={(e)=>setLpForm({...lpForm,name:e.target.value})} required />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" type="number" placeholder="Annual quota" value={lpForm.annual_quota} onChange={(e)=>setLpForm({...lpForm,annual_quota:Number(e.target.value)})} />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" type="number" placeholder="Carry forward" value={lpForm.carry_forward} onChange={(e)=>setLpForm({...lpForm,carry_forward:Number(e.target.value)})} />
            <button className="bg-slate-900 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-slate-800">Add</button>
          </form>
          <div className="divide-y divide-slate-100">
            {leavePolicies.map(p=>(
              <div key={p.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">Annual: {p.annual_quota} · Carry: {p.carry_forward}</div>
                </div>
              </div>
            ))}
            {leavePolicies.length===0 && <div className="text-sm text-slate-500 py-4">No policies.</div>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Attendance Rules</h3>
          <form onSubmit={addAttendanceRule} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Name" value={arForm.name} onChange={(e)=>setArForm({...arForm,name:e.target.value})} required />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" type="number" placeholder="Grace (min)" value={arForm.check_in_grace_min} onChange={(e)=>setArForm({...arForm,check_in_grace_min:Number(e.target.value)})} />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" type="number" placeholder="Half-day after (min)" value={arForm.half_day_after_min} onChange={(e)=>setArForm({...arForm,half_day_after_min:Number(e.target.value)})} />
            <button className="bg-slate-900 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-slate-800">Add</button>
          </form>
          <div className="divide-y divide-slate-100">
            {attendanceRules.map(r=>(
              <div key={r.id} className="py-3">
                <div className="font-semibold text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-500">Grace: {r.check_in_grace_min}m · Half-day after: {r.half_day_after_min}m</div>
              </div>
            ))}
            {attendanceRules.length===0 && <div className="text-sm text-slate-500 py-4">No rules.</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Shift Templates</h3>
          <form onSubmit={addShift} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Name" value={shiftForm.name} onChange={(e)=>setShiftForm({...shiftForm,name:e.target.value})} required />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" type="time" value={shiftForm.start_time} onChange={(e)=>setShiftForm({...shiftForm,start_time:e.target.value})} />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" type="time" value={shiftForm.end_time} onChange={(e)=>setShiftForm({...shiftForm,end_time:e.target.value})} />
            <button className="bg-slate-900 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-slate-800">Add</button>
          </form>
          <div className="divide-y divide-slate-100">
            {shiftTemplates.map(s=>(
              <div key={s.id} className="py-3">
                <div className="font-semibold text-slate-900">{s.name}</div>
                <div className="text-xs text-slate-500">Start: {s.start_time || '—'} · End: {s.end_time || '—'}</div>
              </div>
            ))}
            {shiftTemplates.length===0 && <div className="text-sm text-slate-500 py-4">No shifts.</div>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Payroll Templates</h3>
          <form onSubmit={addPayroll} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Name" value={payrollForm.name} onChange={(e)=>setPayrollForm({...payrollForm,name:e.target.value})} required />
            <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm" type="number" placeholder="Base pay" value={payrollForm.base_pay} onChange={(e)=>setPayrollForm({...payrollForm,base_pay:Number(e.target.value)})} />
            <button className="bg-slate-900 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-slate-800">Add</button>
          </form>
          <div className="divide-y divide-slate-100">
            {payrollTemplates.map(p=>(
              <div key={p.id} className="py-3">
                <div className="font-semibold text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500">Base pay: {p.base_pay}</div>
              </div>
            ))}
            {payrollTemplates.length===0 && <div className="text-sm text-slate-500 py-4">No payroll templates.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
