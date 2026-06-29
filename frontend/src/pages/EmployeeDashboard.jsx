import { useState, useEffect } from 'react';
import api from '../utils/api';

import MeetingCalendar from '../components/MeetingCalendar';
import WorkingHoursCard from '../components/WorkingHoursCard';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

// Professional Icons as SVG Components
const IconUsers = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const IconCalendar = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IconCheckCircle = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconCurrency = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 7h8" />
    <path d="M8 10h8" />
    <path d="m8 13 5.5 5" />
    <path d="M8 13h2" />
    <path d="M10 13c4.5 0 4.5-6 0-6" />
  </svg>
);

const IconTrendingUp = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 300000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setDashboardData(getEmptyData());
      return;
    }

    try {
      setLoading(true);

      // Use cache for instant loading
      const response = await api.get('/dashboard', {
        params: { _t: Date.now() } // Cache busting parameter
      });

      if (response.data.success && response.data.data) {
        setDashboardData(response.data.data);
        setLastUpdated(new Date());

        // Show cache indicator if cached
        if (response.data.cached || response.headers['x-cache'] === 'HIT') {
          console.log('✅ Dashboard loaded from cache - Fast!');
        }
      } else {
        setDashboardData(getEmptyData());
      }
    } catch (error) {
      // Only log unexpected errors (not 401 or network errors)
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching dashboard:', error);
      }
      setDashboardData(getEmptyData());
    } finally {
      setLoading(false);
    }
  };

  const getEmptyData = () => ({
    total_leads: 0,
    leads_by_status: [],
    today_meetings: 0,
    month_meetings: 0,
    today_tasks_completed: 0,
    pending_tasks: 0,
    deal_value: 0,
    pending_followups: 0,
    avg_lead_score: 0,
    total_quotations: 0,
    quotations_by_status: [],
    total_invoices: 0,
    invoices_by_status: [],
    total_sales_orders: 0,
    sales_orders_by_status: [],
    total_invoice_amount: 0,
    total_reports: 0,
    reports_by_type: [],
    total_whatsapp: 0,
    whatsapp_by_status: [],
    monthly_activity: [],
    recent_activities: []
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Data Available</h2>
          <p className="text-gray-600 mb-6">Start by adding leads and activities to see your dashboard metrics.</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const leadsStatusData = (dashboardData.leads_by_status || []).map((item) => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: parseInt(item.count),
  }));

  const quotationsStatusData = (dashboardData.quotations_by_status || []).map((item) => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: parseInt(item.count),
  }));

  const salesOrdersStatusData = (dashboardData.sales_orders_by_status || []).map((item) => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: parseInt(item.count),
  }));

  const invoicesStatusData = (dashboardData.invoices_by_status || []).map((item) => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: parseInt(item.count),
  }));

  const reportsTypeData = (dashboardData.reports_by_type || []).map((item) => ({
    name: item.report_type.charAt(0).toUpperCase() + item.report_type.slice(1),
    value: parseInt(item.count),
  }));

  const whatsappStatusData = (dashboardData.whatsapp_by_status || []).map((item) => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: parseInt(item.count),
  }));

  const hasData =
    dashboardData.total_leads > 0 ||
    dashboardData.today_meetings > 0 ||
    dashboardData.pending_tasks > 0 ||
    dashboardData.total_quotations > 0 ||
    dashboardData.total_invoices > 0 ||
    dashboardData.total_sales_orders > 0 ||
    dashboardData.total_reports > 0 ||
    dashboardData.total_whatsapp > 0;

  return (
    <div>
      {/* Target Display (Only for Employees with Targets) */}
      {dashboardData?.target_data && (
        <div className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl shadow-md p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-lg font-bold">My Performance Target</h4>
            <p className="text-sm text-blue-100">Keep track of your leads goal for this period.</p>
          </div>
          <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md px-6 py-3 rounded-xl border border-white/10">
            <div className="text-right">
              <p className="text-xs text-blue-200 font-bold uppercase tracking-wider mb-0.5">Goal</p>
              <p className="text-2xl font-black text-white leading-none">{dashboardData.target_data.target_value}</p>
            </div>
            <div className="h-8 w-px bg-white/20"></div>
            <div className="text-right">
              <p className="text-xs text-orange-200 font-bold uppercase tracking-wider mb-0.5">Remaining</p>
              <p className="text-2xl font-black text-orange-400 leading-none animate-pulse">{dashboardData.target_data.remaining}</p>
            </div>
            <div className="pl-2">
              <div className="w-12 h-12 relative flex items-center justify-center">
                <svg className="transform -rotate-90 w-full h-full">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/10" />
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 - (125.6 * dashboardData.target_data.progress_percentage) / 100}
                    className="text-green-400 transition-all duration-1000 ease-out" />
                </svg>
                <span className="absolute text-[10px] font-bold text-white">{dashboardData.target_data.progress_percentage}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <WorkingHoursCard className="mb-6" />

      {/* HRMS Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div 
          onClick={() => navigate('/hrms/leaves')}
          className="bg-white rounded-xl shadow-md p-6 border-l-4 border-emerald-500 cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex items-center justify-between group"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Leave Portal</h4>
              <p className="text-xs text-gray-500">Apply for leaves & track status</p>
            </div>
          </div>
          <span className="text-emerald-500 font-bold opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">→</span>
        </div>

        <div 
          onClick={() => navigate('/hrms/attendance')}
          className="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500 cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex items-center justify-between group"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Attendance Log</h4>
              <p className="text-xs text-gray-500">View check-in history & hours</p>
            </div>
          </div>
          <span className="text-indigo-500 font-bold opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">→</span>
        </div>

        <div 
          onClick={() => navigate('/hrms/salary-slips')}
          className="bg-white rounded-xl shadow-md p-6 border-l-4 border-amber-500 cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex items-center justify-between group"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M6 3h12" />
                <path d="M6 8h12" />
                <path d="m6 13 8.5 8" />
                <path d="M6 13h3" />
                <path d="M9 13c6.667 0 6.667-10 0-10" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Salary Slips</h4>
              <p className="text-xs text-gray-500">View & download monthly slips</p>
            </div>
          </div>
          <span className="text-amber-500 font-bold opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">→</span>
        </div>
      </div>



      <div className="space-y-6">

        {/* Main Stats Grid - Professional Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Leads Card */}
          <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <IconUsers />
              </div>
              {dashboardData.total_leads > 0 && (
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  <IconTrendingUp className="inline w-3 h-3 mr-1" />
                  Active
                </span>
              )}
            </div>
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-600 mb-1">Total Leads</p>
              <h3 className="text-3xl font-bold text-gray-900">{dashboardData.total_leads || 0}</h3>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Avg Score: {dashboardData.avg_lead_score || 0}</span>
              <span className="text-blue-600 font-medium">View All →</span>
            </div>
          </div>

          {/* Meetings Card */}
          <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <IconCalendar />
              </div>
              {dashboardData.today_meetings > 0 && (
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  Today
                </span>
              )}
            </div>
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-600 mb-1">Today's Meetings</p>
              <h3 className="text-3xl font-bold text-gray-900">{dashboardData.today_meetings || 0}</h3>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>This Month: {dashboardData.month_meetings || 0}</span>
              <span className="text-green-600 font-medium">View All →</span>
            </div>
          </div>

          {/* Tasks Card */}
          <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <IconCheckCircle />
              </div>
              {dashboardData.pending_tasks > 0 && (
                <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                  Pending
                </span>
              )}
            </div>
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-600 mb-1">Pending Tasks</p>
              <h3 className="text-3xl font-bold text-gray-900">{dashboardData.pending_tasks || 0}</h3>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Completed Today: {dashboardData.today_tasks_completed || 0}</span>
              <span className="text-orange-600 font-medium">View All →</span>
            </div>
          </div>

          {/* Deal Value Card */}
          <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <IconCurrency />
              </div>
              {dashboardData.deal_value > 0 && (
                <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                  Active
                </span>
              )}
            </div>
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-600 mb-1">Total Deal Value</p>
              <h3 className="text-3xl font-bold text-gray-900">
                ₹{parseFloat(dashboardData.deal_value || 0).toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Active Deals</span>
              <span className="text-purple-600 font-medium">View All →</span>
            </div>
          </div>
        </div>

        {/* Secondary Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { label: 'Follow-ups', value: dashboardData.pending_followups || 0, color: 'indigo' },
            { label: 'Quotations', value: dashboardData.total_quotations || 0, color: 'teal' },
            { label: 'Invoices', value: dashboardData.total_invoices || 0, color: 'cyan' },
            { label: 'Sales Orders', value: dashboardData.total_sales_orders || 0, color: 'violet' },
            { label: 'Reports', value: dashboardData.total_reports || 0, color: 'pink' },
            { label: 'WhatsApp', value: dashboardData.total_whatsapp || 0, color: 'green' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 text-center border border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2">{stat.label}</p>
              <p className={`text-2xl font-bold text-${stat.color}-600`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Financial & Activity Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Financial Overview */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-md p-6 border border-blue-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Financial Overview</h2>
              <div className="p-2 bg-blue-100 rounded-lg">
                <IconCurrency className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-blue-200">
                <span className="text-gray-700 font-medium">Total Deal Value</span>
                <span className="text-xl font-bold text-blue-700">₹{parseFloat(dashboardData.deal_value || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-blue-200">
                <span className="text-gray-700 font-medium">Paid Invoices</span>
                <span className="text-xl font-bold text-green-700">₹{parseFloat(dashboardData.total_invoice_amount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-900 font-semibold">Pending Revenue</span>
                <span className="text-2xl font-bold text-orange-600">
                  ₹{parseFloat((dashboardData.deal_value || 0) - (dashboardData.total_invoice_amount || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Summary */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Activity Summary</h2>
              <div className="p-2 bg-gray-200 rounded-lg">
                <IconTrendingUp className="w-5 h-5 text-gray-700" />
              </div>
            </div>
            <div className="space-y-3">
              {[
              { label: 'Leads', value: dashboardData.total_leads || 0 },
              { label: 'Meetings (This Month)', value: dashboardData.month_meetings || 0 },
              { label: 'Tasks Completed', value: `${dashboardData.today_tasks_completed || 0} today` },
              { label: 'Sales Orders', value: dashboardData.total_sales_orders || 0 },
              { label: 'Follow-ups Pending', value: dashboardData.pending_followups || 0, highlight: true },
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-2">
                  <span className="text-gray-700">{item.label}</span>
                  <span className={`font-bold ${item.highlight ? 'text-orange-600' : 'text-gray-900'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Section */}
        {hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leads Status Pie Chart */}
            {leadsStatusData.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Leads by Status</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leadsStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {leadsStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Reports Type Chart */}
            {reportsTypeData.length > 0 ? (
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Reports by Type</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportsTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="value" fill="#ec4899" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 flex items-center justify-center h-[380px]">
                <div className="text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <p className="text-gray-500">No reports generated yet</p>
                </div>
              </div>
            )}

            {/* Recent Activities */}
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 flex flex-col h-[380px]">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-lg font-bold text-gray-900">Recent Activities</h2>
                <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">View All →</button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {dashboardData.recent_activities && dashboardData.recent_activities.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.recent_activities.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-start space-x-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div>
                            <p className="font-medium text-gray-900">{activity.activity_type}</p>
                            <p className="text-sm text-gray-600">{activity.description || 'No description'}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                          {new Date(activity.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <p className="text-gray-500">No recent activities</p>
                  </div>
                )}
              </div>
            </div>


            {/* Quotations Status */}
            {quotationsStatusData.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Quotations by Status</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={quotationsStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Sales Orders Status */}
            {salesOrdersStatusData.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Sales Orders by Status</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesOrdersStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Invoices Status */}
            {invoicesStatusData.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Invoices by Status</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={invoicesStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {invoicesStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Monthly Activity Trend */}
        {dashboardData.monthly_activity && dashboardData.monthly_activity.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Monthly Activity Trend (Last 6 Months)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dashboardData.monthly_activity}>
                <defs>
                  <linearGradient id="colorMeetings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                <Legend />
                <Area type="monotone" dataKey="meetings" stroke="#10b981" fillOpacity={1} fill="url(#colorMeetings)" />
                <Area type="monotone" dataKey="tasks" stroke="#f59e0b" fillOpacity={1} fill="url(#colorTasks)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* WhatsApp Status */}
        {whatsappStatusData.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">WhatsApp Messages by Status</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={whatsappStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
    </div>
  );
}
