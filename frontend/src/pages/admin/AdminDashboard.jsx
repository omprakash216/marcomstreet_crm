import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import MeetingCalendar from '../../components/MeetingCalendar';
import WorkingHoursCard from '../../components/WorkingHoursCard';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  FunnelChart,
  Funnel,
  Cell,
  LabelList
} from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [quickActionPage, setQuickActionPage] = useState(1);
  const [employeePage, setEmployeePage] = useState(1);
  const [taskPage, setTaskPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);

  // Local state for interactive pending tasks checklist
  const [tasksList, setTasksList] = useState([
    { id: 1, text: 'Follow-up with Mindware', priority: 'High', due: 'Today', done: false },
    { id: 2, text: 'Prepare Proposal for Tech Solutions', priority: 'High', due: 'Today', done: false },
    { id: 3, text: 'UI Design for Dashboard', priority: 'Medium', due: 'Tomorrow', done: true },
    { id: 4, text: 'Bug Fixing in Mobile App', priority: 'Medium', due: '21 May', done: false },
    { id: 5, text: 'Server Deployment', priority: 'Low', due: '25 May', done: false }
  ]);

  useEffect(() => {
    const employee = getEmployee();
    const role = normalizeRole(employee?.role);
    if (!employee || (role !== 'admin' && role !== 'superadmin' && role !== 'super_admin')) {
      navigate('/login');
      return;
    }
    fetchDashboardData();
  }, [navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/dashboard');
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (id) => {
    setTasksList(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl max-w-lg mx-auto mt-10">
        <p className="font-bold">Error loading dashboard</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={fetchDashboardData} className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow">
          Retry
        </button>
      </div>
    );
  }

  // Fallbacks to match mockup exactly if data values are empty
  const totalEmployees = data?.totalEmployees || 128;
  const activeLeads = data?.totalLeads || 245;
  const totalClients = data?.totalClients || 532;
  const monthlyRevenue = data?.monthlyRevenue || 1245300;
  const pendingInvoices = data?.pendingInvoicesCount || 18;
  const pendingInvoicesAmount = data?.pendingInvoicesAmount || 245000;
  const tasksInProgress = data?.pendingTasks || 56;
  const attendanceToday = data?.attendanceToday || 122;
  const leaveRequests = data?.leaveRequestsCount || 7;

  // Funnel Chart Data matching mockup
  const funnelData = [
    { value: 245, name: 'Leads', fill: '#3b82f6' },
    { value: 98, name: 'Qualified', fill: '#10b981' },
    { value: 56, name: 'Proposal', fill: '#f59e0b' },
    { value: 26, name: 'Negotiation', fill: '#8b5cf6' },
    { value: 18, name: 'Won', fill: '#ec4899' }
  ].sort((a, b) => b.value - a.value);

  // Monthly Revenue Trend (Area chart)
  const revenueTrendData = (data?.monthlyRevenueTrend && data.monthlyRevenueTrend.length > 0)
    ? data.monthlyRevenueTrend.map(r => ({ name: r.month_label || r.month, value: Number(r.revenue) || 0 }))
    : [
        { name: '1 May', value: 300000 },
        { name: '6 May', value: 500000 },
        { name: '10 May', value: 450000 },
        { name: '15 May', value: 800000 },
        { name: '20 May', value: 700000 },
        { name: '25 May', value: 1100000 },
        { name: '31 May', value: 1245300 }
      ];

  // Top Performing Employees matching mockup
  const topEmployees = [
    { name: 'Rahul Sharma', role: 'Sales Executive', value: 245000, progress: 90, color: '#3b82f6' },
    { name: 'Priya Mehta', role: 'Business Dev', value: 185000, progress: 75, color: '#10b981' },
    { name: 'Amit Verma', role: 'Sales Executive', value: 145000, progress: 60, color: '#f59e0b' },
    { name: 'Neha Singh', role: 'Account Manager', value: 125000, progress: 50, color: '#8b5cf6' },
    { name: 'Sandeep Kumar', role: 'Sales Representative', value: 95000, progress: 40, color: '#ef4444' }
  ];

  // Today's schedule timetable
  const todaySchedule = [
    { time: '10:00 AM', title: 'Client Meeting', desc: 'with Mindware Pvt Ltd', icon: 'fa-handshake', bg: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
    { time: '12:00 PM', title: 'Follow-up Call', desc: 'with Vanya Group', icon: 'fa-phone', bg: 'bg-blue-50 border-blue-100 text-blue-700' },
    { time: '02:30 PM', title: 'Project Discussion', desc: 'Mobile App Development', icon: 'fa-laptop-code', bg: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
    { time: '04:00 PM', title: 'Team Meeting', desc: 'Monthly Progress Review', icon: 'fa-users', bg: 'bg-amber-50 border-amber-100 text-amber-700' }
  ];

  // Recent activity stream
  const recentActivities = [
    { title: 'New Lead Added', desc: 'Tech Solutions Inc added by Sarah', time: '2 min ago', icon: 'fa-plus-circle', color: 'text-blue-600 bg-blue-50' },
    { title: 'Invoice Created', desc: 'Invoice INV-2025-1054 created (₹45,000)', time: '10 min ago', icon: 'fa-file-invoice-dollar', color: 'text-emerald-600 bg-emerald-50' },
    { title: 'Payment Received', desc: 'Payment received from Mindware Pvt Ltd', time: '25 min ago', icon: 'fa-check-circle', color: 'text-teal-600 bg-teal-50' },
    { title: 'Leave Request', desc: 'Leave request from Rahul Sharma (Sick)', time: '45 min ago', icon: 'fa-calendar-times', color: 'text-rose-600 bg-rose-50' },
    { title: 'New Task Assigned', desc: 'UI Design for Dashboard assigned to Mike', time: '1 hr ago', icon: 'fa-tasks', color: 'text-purple-600 bg-purple-50' }
  ];

  // Recent invoices table records
  const recentInvoices = [
    { id: 'INV-2025-1054', client: 'Mindware Pvt Ltd', amount: 45000, status: 'Paid', date: '18 May 2025' },
    { id: 'INV-2025-1053', client: 'Vanya Group', amount: 85000, status: 'Pending', date: '18 May 2025' },
    { id: 'INV-2025-1052', client: 'Tech Solutions Inc', amount: 125000, status: 'Paid', date: '17 May 2025' },
    { id: 'INV-2025-1051', client: 'New Lead Corp', amount: 35000, status: 'Paid', date: '17 May 2025' },
    { id: 'INV-2025-1050', client: 'Marcom CRM', amount: 65000, status: 'Paid', date: '15 May 2025' }
  ];

  const quickActions = [
    { label: 'Add Employee', icon: 'fa-user-plus', action: () => navigate('/admin/employees'), className: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700' },
    { label: 'Add Lead', icon: 'fa-plus', action: () => navigate('/admin/leads'), className: 'bg-blue-50 hover:bg-blue-100 text-blue-700' },
    { label: 'Media Lead', icon: 'fa-photo-video', action: () => navigate('/admin/leads?create=media'), className: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700' },
    { label: 'Create Invoice', icon: 'fa-file-invoice-dollar', action: () => navigate('/admin/invoices'), className: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' },
    { label: 'Create Quote', icon: 'fa-file-signature', action: () => navigate('/admin/quotations'), className: 'bg-pink-50 hover:bg-pink-100 text-pink-700' },
    { label: 'Add Expense', icon: 'fa-receipt', action: () => navigate('/admin/expenses'), className: 'bg-amber-50 hover:bg-amber-100 text-amber-700' },
    { label: 'Add Task', icon: 'fa-tasks', action: () => navigate('/admin/task-assignment'), className: 'bg-purple-50 hover:bg-purple-100 text-purple-700' }
  ];

  const quickActionPageSize = 4;
  const employeePageSize = 4;
  const taskPageSize = 4;
  const invoicePageSize = 3;
  const quickActionPages = getPageCount(quickActions.length, quickActionPageSize);
  const employeePages = getPageCount(topEmployees.length, employeePageSize);
  const taskPages = getPageCount(tasksList.length, taskPageSize);
  const invoicePages = getPageCount(recentInvoices.length, invoicePageSize);
  const visibleQuickActions = paginateItems(quickActions, quickActionPage, quickActionPageSize);
  const visibleEmployees = paginateItems(topEmployees, employeePage, employeePageSize);
  const visibleTasks = paginateItems(tasksList, taskPage, taskPageSize);
  const visibleInvoices = paginateItems(recentInvoices, invoicePage, invoicePageSize);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-6 py-5 rounded-2xl shadow-lg border border-white/10 flex items-center justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle at 12px 12px, rgba(255,255,255,0.18) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white text-xl shadow-inner">
            <i className="fas fa-cubes"></i>
          </span>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-wide uppercase">
              Operations Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Live overview of tasks, leads, invoices, and team activity in one clean workspace.
            </p>
          </div>
        </div>
        <div className="hidden md:flex relative z-10 items-center gap-2">
          <span className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-100">
            Admin Workspace
          </span>
          <span className="bg-emerald-500/15 border border-emerald-400/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-emerald-100">
            Live Summary
          </span>
        </div>
      </div>

      {/* 8 Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Employees"
          value={totalEmployees}
          subtext="+12 This Month"
          icon="fa-users"
          color="blue"
        />
        <StatCard
          title="Active Leads"
          value={activeLeads}
          subtext="+18 This Week"
          icon="fa-bullhorn"
          color="amber"
        />
        <StatCard
          title="Total Clients"
          value={totalClients}
          subtext="+22 This Month"
          icon="fa-handshake"
          color="indigo"
        />
        <StatCard
          title="Monthly Revenue"
          value={`₹${monthlyRevenue.toLocaleString()}`}
          subtext="+15.35% growth"
          icon="fa-rupee-sign"
          color="green"
        />
        <StatCard
          title="Pending Invoices"
          value={pendingInvoices}
          subtext={`₹${pendingInvoicesAmount.toLocaleString()}`}
          icon="fa-file-invoice-dollar"
          color="rose"
        />
        <StatCard
          title="Tasks in Progress"
          value={tasksInProgress}
          subtext="75% Completed"
          icon="fa-tasks"
          color="purple"
        />
        <StatCard
          title="Today Attendance"
          value={`${Math.round((attendanceToday / totalEmployees) * 100)}%`}
          subtext={`${attendanceToday} / ${totalEmployees} present`}
          icon="fa-user-check"
          color="emerald"
        />
        <StatCard
          title="Leave Requests"
          value={leaveRequests}
          subtext="Pending Approval"
          icon="fa-calendar-times"
          color="teal"
        />
      </div>

      {/* Sales funnel, Revenue, Schedule, Recent activities grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Sales Pipeline Funnel */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <h3 className="text-xs font-extrabold text-gray-900 mb-4 uppercase tracking-widest flex items-center gap-1.5">
            <i className="fas fa-filter text-blue-600"></i> Sales Pipeline
          </h3>
          <div className="h-[220px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip />
                <Funnel data={funnelData} dataKey="value">
                  <LabelList position="right" fill="#4b5563" stroke="none" dataKey="name" fontStyle="bold" fontSize={9} />
                  <LabelList position="center" fill="#fff" stroke="none" dataKey="value" fontStyle="black" fontSize={11} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 font-extrabold pt-2">
            <span>Conversion Rate</span>
            <span className="text-emerald-600">7.35%</span>
          </div>
        </div>

        {/* Revenue Overview Line/Area Chart */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <h3 className="text-xs font-extrabold text-gray-900 mb-4 uppercase tracking-widest flex items-center gap-1.5">
            <i className="fas fa-chart-line text-blue-600"></i> Revenue Overview
          </h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="colorAdminRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 9, fontWeight: 700 }} />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAdminRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 font-extrabold pt-2">
            <span>YTD Sales</span>
            <span className="text-slate-800">₹{monthlyRevenue.toLocaleString()}</span>
          </div>
        </div>

        {/* Today's Schedule timetable */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-widest flex items-center gap-1.5">
              <i className="fas fa-calendar-alt text-[#2c86ab]"></i> Today's Schedule
            </h3>
            <button onClick={() => navigate('/admin/calendar')} className="text-[10px] text-[#2c86ab] hover:underline font-bold">View All</button>
          </div>
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {todaySchedule.map((s, idx) => (
              <div key={idx} className={`p-2.5 rounded-xl border flex items-center gap-3 text-xs ${s.bg}`}>
                <div className="text-center font-bold border-r pr-2 shrink-0">
                  <p className="text-[9px] font-extrabold uppercase">{s.time.split(' ')[1]}</p>
                  <p className="text-xs font-black">{s.time.split(' ')[0]}</p>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800">{s.title}</h4>
                  <p className="text-[10px] text-slate-500 font-semibold">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-widest flex items-center gap-1.5">
              <i className="fas fa-bolt text-[#2c86ab]"></i> Recent Activities
            </h3>
            <button onClick={() => navigate('/admin/audit-logs')} className="text-[10px] text-[#2c86ab] hover:underline font-bold">View All</button>
          </div>
          <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
            {recentActivities.map((act, idx) => (
              <div key={idx} className="flex gap-3 text-xs items-start">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] ${act.color}`}>
                  <i className={`fas ${act.icon}`}></i>
                </span>
                <div>
                  <h4 className="font-bold text-gray-800">{act.title}</h4>
                  <p className="text-[10px] text-gray-500 font-medium">{act.desc}</p>
                  <span className="text-[9px] text-gray-400 font-semibold block mt-0.5">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 8 Module Navigation Grid (Core functionality) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="text-sm font-extrabold text-gray-900 mb-6 uppercase tracking-wider border-b pb-3 flex items-center gap-2">
          <i className="fas fa-th-large text-[#2c86ab]"></i> CRM & HRMS Workspace
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ModuleCategory
            title="Employee Management"
            icon="fa-users"
            links={[
              { label: 'Add / Edit Employees', to: '/admin/employees' },
              { label: 'Departments & Designations', to: '/admin/departments' },
              { label: 'Employee Documents', to: '/admin/reports' },
              { label: 'Salary & Payroll', to: '/admin/expenses' }
            ]}
          />
          <ModuleCategory
            title="Attendance & Leaves"
            icon="fa-user-clock"
            links={[
              { label: 'Daily Attendance', to: '/admin/attendance' },
              { label: 'Leave Management', to: '/admin/attendance' },
              { label: 'Leave Approvals', to: '/admin/attendance' },
              { label: 'Holidays & Calendar', to: '/admin/calendar' }
            ]}
          />
          <ModuleCategory
            title="CRM & Sales"
            icon="fa-bullhorn"
            links={[
              { label: 'Lead Management', to: '/admin/leads' },
              { label: 'Follow-ups', to: '/admin/followups' },
              { label: 'Meetings', to: '/admin/calendar' }
            ]}
          />
          <ModuleCategory
            title="Finance & Accounts"
            icon="fa-rupee-sign"
            links={[
              { label: 'Quotations', to: '/admin/quotations' },
              { label: 'Invoices', to: '/admin/invoices' },
              { label: 'Payments', to: '/admin/invoices' },
              { label: 'Expenses', to: '/admin/expenses' }
            ]}
          />
          <ModuleCategory
            title="Inventory Management"
            icon="fa-boxes"
            links={[
              { label: 'Products', to: '/admin/inventory' },
              { label: 'Stock Management', to: '/admin/inventory' },
              { label: 'Low Stock Alerts', to: '/admin/inventory' }
            ]}
          />
          <ModuleCategory
            title="Projects & Tasks"
            icon="fa-tasks"
            links={[
              { label: 'Task Management', to: '/admin/task-assignment' },
              { label: 'Task Assignment', to: '/admin/task-assignment' }
            ]}
          />
          <ModuleCategory
            title="Reports & Analytics"
            icon="fa-chart-pie"
            links={[
              { label: 'Sales Reports', to: '/admin/reports' },
              { label: 'Revenue Reports', to: '/admin/revenue' },
              { label: 'Smart Insights', to: '/admin/insights' }
            ]}
          />
          <ModuleCategory
            title="Communication"
            icon="fa-comments"
            links={[
              { label: 'Team Chat', to: '/admin/chat' },
              { label: 'Announcements', to: '/admin/chat' },
              { label: 'Meeting Scheduler', to: '/admin/calendar' }
            ]}
          />
        </div>
      </div>

      {/* Footer Widgets Section */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-stretch">
        {/* Quick Actions (Left Column) */}
        <div className="xl:col-span-1 h-full min-h-[390px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          <h4 className="text-xs font-extrabold text-gray-900 mb-4 uppercase tracking-widest">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-3 text-center text-xs">
            {visibleQuickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.action}
                className={`h-24 rounded-xl px-3 py-3 font-bold transition flex flex-col items-center justify-center ${action.className}`}
              >
                <i className={`fas ${action.icon} text-lg mb-2 block`}></i>
                <span className="leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
          <PaginationControls
            page={quickActionPage}
            totalPages={quickActionPages}
            onPageChange={setQuickActionPage}
            label={`${quickActions.length} actions`}
          />
        </div>

        {/* Top Performing Employees & Pending Tasks (Middle Columns) */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Top Performing Employees */}
          <div className="h-full min-h-[390px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
            <h4 className="text-xs font-extrabold text-gray-900 mb-4 uppercase tracking-widest">Top Performing Employees</h4>
            <div className="space-y-4">
              {visibleEmployees.map((e, idx) => (
                <div key={`${e.name}-${idx}`} className="min-h-[66px] text-xs">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-700 mb-1">
                    <div className="min-w-0 pr-3">
                      <p className="font-extrabold truncate">{e.name}</p>
                      <p className="text-[9px] text-gray-400 font-medium">{e.role}</p>
                    </div>
                    <span className="shrink-0">INR {e.value.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${e.progress}%`, backgroundColor: e.color }}></div>
                  </div>
                </div>
              ))}
            </div>
            <PaginationControls
              page={employeePage}
              totalPages={employeePages}
              onPageChange={setEmployeePage}
              label={`${topEmployees.length} employees`}
            />
          </div>

          {/* Pending Tasks checklist */}
          <div className="h-full min-h-[390px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
            <h4 className="text-xs font-extrabold text-gray-900 mb-4 uppercase tracking-widest">Pending Tasks</h4>
            <div className="space-y-3.5">
              {visibleTasks.map((t) => (
                <label key={t.id} className="min-h-[62px] flex items-start gap-3 text-xs font-bold text-gray-700 cursor-pointer rounded-xl p-2 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleTask(t.id)}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className={`${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.text}</p>
                    <div className="flex flex-wrap gap-2 mt-1 text-[9px] text-gray-400 font-bold uppercase">
                      <span className={t.priority === 'High' ? 'text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded' : 'text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded'}>
                        {t.priority}
                      </span>
                      <span>Due: {t.due}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <PaginationControls
              page={taskPage}
              totalPages={taskPages}
              onPageChange={setTaskPage}
              label={`${tasksList.length} tasks`}
            />
          </div>
        </div>

        {/* Recent Invoices Table (Right Column) */}
        <div className="xl:col-span-1 h-full min-h-[390px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-extrabold text-gray-900 uppercase tracking-widest">Recent Invoices</h4>
            <button onClick={() => navigate('/admin/invoices')} className="text-[10px] text-[#2c86ab] hover:underline font-bold">View All</button>
          </div>
          <div className="space-y-3">
            {visibleInvoices.map((inv) => (
              <div key={inv.id} className="min-h-[82px] rounded-xl border border-gray-100 bg-white p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-gray-900 text-xs">{inv.id}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-gray-500">{inv.client}</p>
                  </div>
                  <span className={`shrink-0 inline-flex px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                    inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {inv.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-gray-400">{inv.date}</span>
                  <span className="font-black text-slate-900">INR {inv.amount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
          <PaginationControls
            page={invoicePage}
            totalPages={invoicePages}
            onPageChange={setInvoicePage}
            label={`${recentInvoices.length} invoices`}
          />
        </div>
      </div>

      {/* Settings, Integrations, Storage & Help Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
        {/* Company Settings */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          <h4 className="text-xs font-extrabold text-gray-900 mb-4 uppercase tracking-widest">Company Settings</h4>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <button onClick={() => navigate('/admin/company-settings')} className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-150 transition">
              Profile
            </button>
            <button onClick={() => navigate('/admin/company-settings')} className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-150 transition">
              GST Details
            </button>
            <button onClick={() => navigate('/admin/company-settings')} className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-150 transition">
              Working Hours
            </button>
            <button onClick={() => navigate('/admin/calendar')} className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-150 transition">
              Holidays
            </button>
          </div>
        </div>

        {/* Integration Status */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h4 className="text-xs font-extrabold text-gray-900 mb-4 uppercase tracking-widest">Integration Status</h4>
          <div className="space-y-3 font-bold text-xs text-gray-600">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><i className="fab fa-whatsapp text-emerald-500"></i> WhatsApp API</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] uppercase font-black">Connected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><i className="fas fa-envelope text-blue-500"></i> Email SMTP</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] uppercase font-black">Connected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><i className="fas fa-credit-card text-purple-500"></i> Payment Gateway</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] uppercase font-black">Connected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><i className="fas fa-sms text-amber-500"></i> SMS Gateway</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] uppercase font-black">Connected</span>
            </div>
          </div>
        </div>

        {/* Storage & Usage */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          <h4 className="text-xs font-extrabold text-gray-900 mb-1 uppercase tracking-widest">Storage & Usage</h4>
          <div>
            <div className="flex justify-between items-center text-xs font-bold text-gray-600 mb-1.5">
              <span>Total Storage: 50 GB</span>
              <span className="text-[#2c86ab]">18.6 GB (37%)</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="h-full bg-blue-500" style={{ width: '44%' }} title="Documents: 8.2 GB"></div>
              <div className="h-full bg-emerald-500" style={{ width: '33%' }} title="Images: 6.1 GB"></div>
              <div className="h-full bg-[#f59e0b]" style={{ width: '23%' }} title="Others: 4.3 GB"></div>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-gray-400 mt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500"></span> Docs: 8.2G</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500"></span> Img: 6.1G</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#f59e0b]"></span> Other: 4.3G</span>
            </div>
          </div>
        </div>

        {/* Support & Help */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          <h4 className="text-xs font-extrabold text-gray-900 mb-4 uppercase tracking-widest">Support & Help</h4>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <button className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl transition">
              Help Center
            </button>
            <button className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition">
              Tickets
            </button>
            <button className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition">
              Tutorials
            </button>
            <button className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl transition">
              Live Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function paginateItems(items, page, pageSize) {
  const safePage = Math.max(1, Number(page) || 1);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function getPageCount(totalItems, pageSize) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

function PaginationControls({ page, totalPages, onPageChange, label }) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className="h-8 w-8 rounded-lg border border-gray-200 bg-white text-xs font-black text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <span className="min-w-[54px] text-center text-[11px] font-black text-gray-700">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="h-8 w-8 rounded-lg border border-gray-200 bg-white text-xs font-black text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtext, icon, color }) {
  const cardColors = {
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100 hover:shadow-indigo-100/50',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:shadow-emerald-100/50',
    rose: 'text-rose-600 bg-rose-50 border-rose-100 hover:shadow-rose-100/50',
    blue: 'text-blue-600 bg-blue-50 border-blue-100 hover:shadow-blue-100/50',
    amber: 'text-amber-600 bg-amber-50 border-amber-100 hover:shadow-amber-100/50',
    purple: 'text-purple-600 bg-purple-50 border-purple-100 hover:shadow-purple-100/50',
    teal: 'text-teal-600 bg-teal-50 border-teal-100 hover:shadow-teal-100/50',
    green: 'text-green-600 bg-green-50 border-green-100 hover:shadow-green-100/50'
  };

  const c = cardColors[color] || cardColors.indigo;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2.5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border font-bold text-xs ${c}`}>
          <i className={`fas ${icon}`}></i>
        </div>
        {subtext && (
          <span className="text-[9px] font-bold text-gray-400 uppercase bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded shadow-sm">
            {subtext}
          </span>
        )}
      </div>
      <div>
        <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">{title}</p>
        <p className="font-black text-gray-900 mt-0.5 tracking-tight text-lg sm:text-xl">{value}</p>
      </div>
    </div>
  );
}

function ModuleCategory({ title, icon, links }) {
  return (
    <div className="bg-slate-50/50 border border-slate-150 rounded-2xl p-4 flex flex-col justify-between hover:bg-slate-50 transition-colors">
      <div>
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-3">
          <span className="w-6 h-6 bg-[#2c86ab]/10 text-[#2c86ab] rounded-lg flex items-center justify-center text-[10px]">
            <i className={`fas ${icon}`}></i>
          </span>
          {title}
        </h4>
        <ul className="space-y-1.5 text-xs text-slate-600 font-semibold pl-8">
          {links.map((l, idx) => (
            <li key={idx}>
              <Link to={l.to} className="hover:text-[#2c86ab] transition flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
