import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
  Area
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function AdminRevenue() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('month');
  const [selectedMetric, setSelectedMetric] = useState('revenue');

  useEffect(() => {
    const employee = getEmployee();
    const role = normalizeRole(employee?.role);
    if (!employee || (role !== 'admin' && role !== 'superadmin' && role !== 'super_admin')) {
      navigate('/login');
      return;
    }
    fetchRevenueData();
  }, [navigate, dateRange]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/revenue?period=${dateRange}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format) => {
    // Mock export functionality
    alert(`Exporting revenue report as ${format.toUpperCase()}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading revenue analytics...</p>
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

  // Mock data for demonstration
  const mockData = {
    summary: {
      totalRevenue: 2850000,
      totalLeads: 245,
      totalDeals: 89,
      averageDealSize: 32022,
      conversionRate: 36.3,
      monthlyGrowth: 12.5
    },
    monthlyRevenue: [
      { month: 'Jan', revenue: 210000, leads: 18, deals: 6 },
      { month: 'Feb', revenue: 245000, leads: 22, deals: 8 },
      { month: 'Mar', revenue: 280000, leads: 25, deals: 9 },
      { month: 'Apr', revenue: 320000, leads: 28, deals: 11 },
      { month: 'May', revenue: 295000, leads: 26, deals: 10 },
      { month: 'Jun', revenue: 385000, leads: 32, deals: 13 },
      { month: 'Jul', revenue: 420000, leads: 35, deals: 15 },
      { month: 'Aug', revenue: 395000, leads: 33, deals: 14 },
      { month: 'Sep', revenue: 450000, leads: 38, deals: 16 }
    ],
    revenueBySource: [
      { name: 'Direct Sales', value: 35, amount: 997500 },
      { name: 'Referrals', value: 25, amount: 712500 },
      { name: 'Digital Marketing', value: 20, amount: 570000 },
      { name: 'Partnerships', value: 12, amount: 342000 },
      { name: 'Cold Calls', value: 8, amount: 228000 }
    ],
    topPerformers: [
      { name: 'Rajesh Kumar', revenue: 185000, deals: 12, conversion: 42 },
      { name: 'Priya Sharma', revenue: 162000, deals: 10, conversion: 38 },
      { name: 'Amit Singh', revenue: 145000, deals: 9, conversion: 35 },
      { name: 'Sneha Patel', revenue: 138000, deals: 8, conversion: 40 },
      { name: 'Vikram Rao', revenue: 125000, deals: 7, conversion: 33 }
    ],
    dealSizeDistribution: [
      { range: '0-50K', count: 25, percentage: 28 },
      { range: '50K-100K', count: 35, percentage: 39 },
      { range: '100K-200K', count: 20, percentage: 22 },
      { range: '200K-500K', count: 7, percentage: 8 },
      { range: '500K+', count: 2, percentage: 2 }
    ]
  };

  const dataToUse = data && data.summary ? data : mockData;
  const summary = dataToUse.summary || {
    totalRevenue: 0,
    totalLeads: 0,
    totalDeals: 0,
    averageDealSize: 0,
    conversionRate: 0,
    monthlyGrowth: 0,
  };
  const monthlyRevenue = Array.isArray(dataToUse.monthlyRevenue) ? dataToUse.monthlyRevenue : [];
  const revenueBySource = Array.isArray(dataToUse.revenueBySource) ? dataToUse.revenueBySource : [];
  const topPerformers = Array.isArray(dataToUse.topPerformers) ? dataToUse.topPerformers : [];
  const dealSizeDistribution = Array.isArray(dataToUse.dealSizeDistribution) ? dataToUse.dealSizeDistribution : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 via-green-700 to-green-800 rounded-xl shadow-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
              <i className="fas fa-chart-line text-white text-3xl"></i>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Revenue Analytics</h1>
              <p className="text-green-100 text-sm md:text-base">Comprehensive financial performance and insights</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 bg-white text-gray-900 rounded-lg border border-white/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-xl shadow-lg p-5 border border-green-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900">₹{(summary.totalRevenue / 100000).toFixed(1)}L</p>
              <p className="text-xs text-green-600 font-medium mt-1">
                <i className="fas fa-arrow-up mr-1"></i>
                +{summary.monthlyGrowth || 0}% from last month
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-rupee-sign text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-xl shadow-lg p-5 border border-blue-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Leads</p>
              <p className="text-3xl font-bold text-gray-900">{summary.totalLeads}</p>
              <p className="text-xs text-blue-600 font-medium mt-1">Active opportunities</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-users text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-purple-50/50 rounded-xl shadow-lg p-5 border border-purple-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Conversion Rate</p>
              <p className="text-3xl font-bold text-gray-900">{summary.conversionRate}%</p>
              <p className="text-xs text-purple-600 font-medium mt-1">Lead to deal conversion</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-percentage text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-orange-50/50 rounded-xl shadow-lg p-5 border border-orange-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Avg Deal Size</p>
              <p className="text-3xl font-bold text-gray-900">₹{(summary.averageDealSize / 1000).toFixed(0)}K</p>
              <p className="text-xs text-orange-600 font-medium mt-1">Per successful deal</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-calculator text-white"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Source */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Source</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={revenueBySource}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {revenueBySource.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name, props) => [`₹${props.payload.amount.toLocaleString()}`, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
          <div className="space-y-4">
            {topPerformers.map((performer, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{performer.name}</p>
                    <p className="text-xs text-gray-500">{performer.deals} deals • {performer.conversion}% conversion</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">₹{performer.revenue.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deal Size Distribution */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Deal Size Distribution</h3>
          <div className="space-y-3">
            {dealSizeDistribution.map((range, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{range.range}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${range.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-12">{range.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Performance Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Monthly Performance</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => exportReport('excel')}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <i className="fas fa-file-excel"></i>
              <span>Export</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deals</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Deal Size</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monthlyRevenue.map((month, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{month.month}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">₹{month.revenue.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{month.leads}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{month.deals}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {((month.deals / month.leads) * 100).toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{Math.round(month.revenue / month.deals).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
