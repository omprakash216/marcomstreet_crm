import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';
import MeetingCalendar from '../../components/MeetingCalendar';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const employee = getEmployee();
    if (!employee || employee.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchDashboardData();
  }, [navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  // Chart data for Company Sales
  const companySalesData = data.companySales.slice(0, 8).map(c => ({
    name: c.company_name.length > 15 ? c.company_name.substring(0, 15) + '...' : c.company_name,
    sales: parseFloat(c.sales)
  }));

  // Chart data for Leads Status
  const leadsStatusData = data.leadsByStatus.map(l => ({
    name: l.status.charAt(0).toUpperCase() + l.status.slice(1),
    count: l.count
  }));

  // Chart data for Monthly Revenue Trend
  const monthlyRevenueData = data.monthlyRevenueTrend.map(m => ({
    month: m.month_label,
    revenue: parseFloat(m.revenue)
  }));

  // Chart data for Employee Performance
  const employeePerformanceData = data.employeePerformance.slice(0, 8).map(e => ({
    name: e.name.length > 10 ? e.name.substring(0, 10) + '...' : e.name,
    revenue: parseFloat(e.total_revenue),
    leads: e.total_leads
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-xl shadow-lg p-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-lg">
                <i className="fas fa-tachometer-alt text-white text-2xl"></i>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">Admin Dashboard</h1>
                <p className="text-blue-100 text-xs md:text-sm">Complete overview of your CRM system</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-5 border border-blue-100/50">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-building text-white"></i>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Total Companies</p>
              <p className="text-2xl font-bold text-gray-900">{data.totalCompanies}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-green-600 font-semibold">Active: {data.activeCompanies}</span>
            <span className="text-red-600 font-semibold">Suspended: {data.suspendedCompanies}</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-5 border border-green-100/50">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-rupee-sign text-white"></i>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">₹{parseFloat(data.totalRevenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
          <div className="text-xs text-gray-600">
            This Month: ₹{parseFloat(data.monthlyRevenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-purple-50/50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-5 border border-purple-100/50">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-users text-white"></i>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900">{data.totalLeads}</p>
            </div>
          </div>
          <div className="text-xs text-gray-600">
            Live Deals: {data.liveDeals}
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-orange-50/50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-5 border border-orange-100/50">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-user-tie text-white"></i>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Employees</p>
              <p className="text-2xl font-bold text-gray-900">{data.totalEmployees}</p>
            </div>
          </div>
          <div className="text-xs text-gray-600">
            Active Employees
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Company Sales Overview */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 px-5 py-3 border-b border-gray-200/50">
            <h3 className="text-base font-bold text-white flex items-center">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mr-3">
                <i className="fas fa-chart-bar text-white text-sm"></i>
              </div>
              Company Sales Overview
            </h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={companySalesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leads Status Distribution */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 px-5 py-3 border-b border-gray-200/50">
            <h3 className="text-base font-bold text-white flex items-center">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mr-3">
                <i className="fas fa-chart-pie text-white text-sm"></i>
              </div>
              Leads Status Distribution
            </h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={leadsStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Revenue Trend */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 px-5 py-3 border-b border-gray-200/50">
            <h3 className="text-base font-bold text-white flex items-center">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mr-3">
                <i className="fas fa-chart-line text-white text-sm"></i>
              </div>
              Monthly Revenue Trend
            </h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.1} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Employee Performance */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 px-5 py-3 border-b border-gray-200/50">
            <h3 className="text-base font-bold text-white flex items-center">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mr-3">
                <i className="fas fa-user-chart text-white text-sm"></i>
              </div>
              Top Employee Performance
            </h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={employeePerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Revenue (₹)" />
                <Bar yAxisId="right" dataKey="leads" fill="#10b981" radius={[8, 8, 0, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Companies & Employees */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Companies */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 px-5 py-3 border-b border-gray-200/50">
            <h3 className="text-base font-bold text-white flex items-center">
              <i className="fas fa-building mr-3 text-sm"></i>
              Recent Companies
            </h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {data.recentCompanies.slice(0, 5).map((company) => (
                <div key={company.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{company.company_name}</p>
                    <p className="text-xs text-gray-500">{company.email}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${company.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    {company.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Employee Agent Outputs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 via-green-700 to-green-800 px-5 py-3 border-b border-gray-200/50">
            <h3 className="text-base font-bold text-white flex items-center">
              <i className="fas fa-chart-bar mr-3 text-sm"></i>
              Employee Agent Outputs
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{data.employeeAgentOutputs.total_leads}</p>
                <p className="text-xs text-gray-600 mt-1">Total Leads</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{data.employeeAgentOutputs.total_meetings}</p>
                <p className="text-xs text-gray-600 mt-1">Meetings</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-700">{data.employeeAgentOutputs.total_attendance_logs}</p>
                <p className="text-xs text-gray-600 mt-1">Attendance</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
