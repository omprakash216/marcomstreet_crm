import { useState } from 'react';
import api from '../../utils/api';

export default function HRReports() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 3000);
  };

  const downloadReport = async (path, filename) => {
    try {
      setLoading(true);
      const resp = await api.get(path, { responseType: 'blob' });
      downloadBlob(resp.data, filename);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to download report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-white">HR Reports</h1>
          <p className="text-slate-300 text-sm">Export attendance, leaves, payroll, and employee data</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Report Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="text-xs text-slate-500">
            Use this month for attendance, leave, and payroll exports.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <button
            onClick={() => downloadReport(`/hrms/attendance/report?month=${encodeURIComponent(month)}&format=csv`, `attendance-${month}.csv`)}
            className="p-4 border border-slate-200 rounded-xl text-left hover:bg-slate-50 transition-colors"
            disabled={loading}
          >
            <p className="text-sm font-semibold text-slate-900">Attendance Report</p>
            <p className="text-xs text-slate-500">CSV export for monthly attendance</p>
          </button>

          <button
            onClick={() => downloadReport(`/hrms/reports/leaves?month=${encodeURIComponent(month)}`, `leaves-${month}.csv`)}
            className="p-4 border border-slate-200 rounded-xl text-left hover:bg-slate-50 transition-colors"
            disabled={loading}
          >
            <p className="text-sm font-semibold text-slate-900">Leave Report</p>
            <p className="text-xs text-slate-500">Approved and pending leaves</p>
          </button>

          <button
            onClick={() => downloadReport(`/hrms/reports/payroll?month=${encodeURIComponent(month)}`, `payroll-${month}.csv`)}
            className="p-4 border border-slate-200 rounded-xl text-left hover:bg-slate-50 transition-colors"
            disabled={loading}
          >
            <p className="text-sm font-semibold text-slate-900">Payroll Report</p>
            <p className="text-xs text-slate-500">Salary slips summary</p>
          </button>

          <button
            onClick={() => downloadReport('/hrms/reports/employees', 'employees-report.csv')}
            className="p-4 border border-slate-200 rounded-xl text-left hover:bg-slate-50 transition-colors"
            disabled={loading}
          >
            <p className="text-sm font-semibold text-slate-900">Employee Report</p>
            <p className="text-xs text-slate-500">Active employees master list</p>
          </button>
        </div>
      </div>
    </div>
  );
}
