import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// Icons (SVG - no external font)
const IconUsers = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const IconClock = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconDocument = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IconBriefcase = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V8a2 2 0 01-2 2H8a2 2 0 01-2-2V6m8 0H8m0 0V4" />
  </svg>
);
const IconCalendar = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const IconBanknotes = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconFolder = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);
const IconChart = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const IconArrowRight = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const QUICK_ACTIONS = [
  { id: 'add-employee', label: 'Add Employee', desc: 'Create profile', path: '/hr/employees', icon: IconUsers, color: 'slate' },
  { id: 'approve-leave', label: 'Approve Leave', desc: 'Review requests', path: '/hr/hrms/leaves', icon: IconCalendar, color: 'amber' },
  { id: 'generate-payslip', label: 'Generate Payslip', desc: 'Payroll run', path: '/hr/hrms/salary', icon: IconBanknotes, color: 'emerald' },
  { id: 'attendance', label: 'Attendance', desc: 'Track & correct', path: '/hr/hrms/attendance', icon: IconClock, color: 'blue' },
  { id: 'documents', label: 'HR Documents', desc: 'Offer letters & policies', path: '/hr/hrms/documents', icon: IconFolder, color: 'indigo' },
  { id: 'reports', label: 'Reports', desc: 'HR analytics', path: '/hr/hrms/reports', icon: IconChart, color: 'violet' },
];

const colorClasses = {
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', hover: 'hover:bg-emerald-100', border: 'border-emerald-200' },
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', hover: 'hover:bg-indigo-100', border: 'border-indigo-200' },
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', hover: 'hover:bg-blue-100', border: 'border-blue-200' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', hover: 'hover:bg-amber-100', border: 'border-amber-200' },
  slate: { bg: 'bg-slate-100', icon: 'text-slate-600', hover: 'hover:bg-slate-200', border: 'border-slate-200' },
  violet: { bg: 'bg-violet-50', icon: 'text-violet-600', hover: 'hover:bg-violet-100', border: 'border-violet-200' },
};

export default function HRDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [leaveStats, setLeaveStats] = useState([]);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [activityPage, setActivityPage] = useState(0);
  const navigate = useNavigate();
  const employee = getEmployee();

  const ACTIVITY_PAGE_SIZE = 4;
  const activityTotalPages = Math.max(1, Math.ceil(recentActivities.length / ACTIVITY_PAGE_SIZE));
  const paginatedActivities = recentActivities.slice(
    activityPage * ACTIVITY_PAGE_SIZE,
    activityPage * ACTIVITY_PAGE_SIZE + ACTIVITY_PAGE_SIZE
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/hrms/stats');
      if (response.data.success) {
        const data = response.data.data;
        setStats({
          total_employees: data.total_employees ?? 0,
          present_today: data.present_today ?? 0,
          on_leave_today: data.on_leave_today ?? 0,
          late_employees: data.late_employees ?? 0,
          pending_leaves: data.pending_leaves ?? 0,
          total_leave_balance: data.total_leave_balance ?? 0,
          used_leaves: data.used_leaves ?? 0,
          monthly_salary_processed: data.monthly_salary_processed ?? 0,
        });
        if (data.attendance_trends?.length > 0) {
          setAttendanceData(data.attendance_trends.map(at => ({
            month: at.month,
            present: parseInt(at.present, 10) || 0,
            active: parseInt(at.active, 10) || 0,
          })));
        }
        if (data.leave_stats?.length > 0) {
          setLeaveStats(data.leave_stats.map(ls => ({
            type: (ls.type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            used: parseInt(ls.used, 10) || 0,
            approved: parseInt(ls.approved, 10) || 0,
          })));
        }
        if (data.department_counts?.length > 0) {
          setDepartmentStats(data.department_counts.map(dc => ({
            department: dc.department || 'Unassigned',
            total: parseInt(dc.total, 10) || 0,
          })));
        }
        if (data.upcoming_holidays?.length > 0) {
          setUpcomingHolidays(data.upcoming_holidays.map(h => ({
            id: h.id,
            name: h.name,
            date: h.date ? String(h.date).slice(0, 10) : '',
            description: h.description || '',
          })));
        }
        if (data.recent_activities?.length > 0) {
          setRecentActivities(data.recent_activities.map(ra => ({
            id: ra.id,
            type: ra.type || 'activity',
            title: ra.title || 'Activity',
            time: ra.time ? new Date(ra.time).toLocaleString() : '',
            status: ra.status || 'completed',
          })));
        }
      }
    } catch (err) {
      console.error('HR dashboard data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (path) => path && navigate(path);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-sm font-medium">Loading HR dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <section className="mb-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="h-1 bg-gradient-to-r from-blue-700 via-indigo-600 to-slate-200" />
            <div className="px-6 py-5 sm:px-8 sm:py-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">HR</p>
                  <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
                    Dashboard
                  </h1>
                  <p className="mt-1 text-sm text-slate-600 max-w-2xl">
                    Welcome back, {employee?.name || 'HR Manager'}. Manage people and operations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Quick actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              const c = colorClasses[action.color] || colorClasses.slate;
              return (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.path)}
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border ${c.border} ${c.bg} ${c.hover} transition-colors text-left`}
                >
                  <div className={`p-2.5 rounded-lg bg-white border ${c.border} shadow-sm`}>
                    <Icon className={`w-5 h-5 ${c.icon}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 text-sm">{action.label}</p>
                    <p className="text-xs text-slate-500 truncate">{action.desc}</p>
                  </div>
                  <IconArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </section>

        {/* Stats cards - right above charts */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
          {[
            { label: 'Total Employees', value: stats?.total_employees ?? 0, icon: IconUsers, sub: 'Active' },
            { label: 'Present Today', value: stats?.present_today ?? 0, icon: IconClock, sub: 'Checked in' },
            { label: 'On Leave Today', value: stats?.on_leave_today ?? 0, icon: IconCalendar, sub: 'Approved' },
            { label: 'Late Employees', value: stats?.late_employees ?? 0, icon: IconBriefcase, sub: 'Late marks' },
            { label: 'Pending Leaves', value: stats?.pending_leaves ?? 0, icon: IconDocument, sub: 'Awaiting approval' },
            { label: 'Payslips (Month)', value: stats?.monthly_salary_processed ?? 0, icon: IconBanknotes, sub: 'Generated' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</p>
                    {item.sub && <p className="mt-0.5 text-xs text-slate-400">{item.sub}</p>}
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Charts row */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Attendance trend</h3>
            {attendanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="present" name="Present" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="active" name="Active" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">No attendance data yet</div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Leave overview</h3>
            {leaveStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={leaveStats} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis dataKey="type" type="category" width={80} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="used" name="Used" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="approved" name="Approved" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">No leave data yet</div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Department-wise employees</h3>
            {departmentStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={departmentStats} dataKey="total" nameKey="department" outerRadius={100} innerRadius={50} paddingAngle={3}>
                    {departmentStats.map((_, idx) => (
                      <Cell key={idx} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9'][idx % 6]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">No department data yet</div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Upcoming holidays</h3>
            {upcomingHolidays.length > 0 ? (
              <div className="space-y-3">
                {upcomingHolidays.map((h) => (
                  <div key={h.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
                    <p className="text-sm font-semibold text-slate-900">{h.name}</p>
                    <p className="text-xs text-slate-500">{h.date}</p>
                    {h.description && <p className="text-xs text-slate-500 mt-1">{h.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 text-sm">No upcoming holidays</div>
            )}
          </div>
        </section>

        {/* Recent HR Activities - fixed height, scroll, prev/next */}
        <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Recent HR Activities</h3>
            {recentActivities.length > ACTIVITY_PAGE_SIZE && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivityPage((p) => Math.max(0, p - 1))}
                  disabled={activityPage === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500">
                  {activityPage + 1} / {activityTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setActivityPage((p) => Math.min(activityTotalPages - 1, p + 1))}
                  disabled={activityPage >= activityTotalPages - 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
          <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100">
            {recentActivities.length > 0 ? (
              paginatedActivities.map((a) => (
                <div key={a.id} className="px-6 py-2.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <IconDocument className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.time}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">{a.status}</span>
                </div>
              ))
            ) : (
              <div className="px-6 py-6 text-center text-slate-400 text-sm">No recent activity</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
