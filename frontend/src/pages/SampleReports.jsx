import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';
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
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function SampleReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sales');
  const [dateRange, setDateRange] = useState('month');
  const [reportData, setReportData] = useState({});
  const [employee] = useState(getEmployee());

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/reports/sample?period=${dateRange}`);
      if (response.data.success) {
        setReportData(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      // Set sample data for demonstration
      setReportData({
        sales: {
          monthlyRevenue: [
            { month: 'Jan', revenue: 45000, leads: 45, deals: 12 },
            { month: 'Feb', revenue: 52000, leads: 52, deals: 15 },
            { month: 'Mar', revenue: 48000, leads: 48, deals: 14 },
            { month: 'Apr', revenue: 61000, leads: 61, deals: 18 },
            { month: 'May', revenue: 55000, leads: 55, deals: 16 },
            { month: 'Jun', revenue: 67000, leads: 67, deals: 20 }
          ],
          leadStatus: [
            { name: 'New', value: 35, color: '#3b82f6' },
            { name: 'Contacted', value: 25, color: '#f59e0b' },
            { name: 'Proposal', value: 20, color: '#10b981' },
            { name: 'Negotiation', value: 15, color: '#8b5cf6' },
            { name: 'Won', value: 12, color: '#14b8a6' },
            { name: 'Lost', value: 8, color: '#ef4444' }
          ],
          topPerformers: [
            { name: 'John Doe', leads: 25, revenue: 125000 },
            { name: 'Jane Smith', leads: 22, revenue: 98000 },
            { name: 'Mike Johnson', leads: 20, revenue: 87000 },
            { name: 'Sarah Wilson', leads: 18, revenue: 76000 },
            { name: 'Tom Brown', leads: 15, revenue: 65000 }
          ]
        },
        marketing: {
          campaignPerformance: [
            { campaign: 'Email Campaign', sent: 5000, opened: 1200, clicked: 300, converted: 45 },
            { campaign: 'Social Media', sent: 8000, opened: 2400, clicked: 480, converted: 72 },
            { campaign: 'Webinar', sent: 1500, opened: 1350, clicked: 405, converted: 81 },
            { campaign: 'Trade Show', sent: 2000, opened: 1600, clicked: 240, converted: 36 }
          ],
          channelBreakdown: [
            { name: 'Email', value: 40, color: '#3b82f6' },
            { name: 'Social Media', value: 30, color: '#10b981' },
            { name: 'Website', value: 15, color: '#f59e0b' },
            { name: 'Referrals', value: 10, color: '#8b5cf6' },
            { name: 'Direct', value: 5, color: '#ec4899' }
          ]
        },
        hr: {
          employeeStats: [
            { department: 'Sales', employees: 25, active: 23, onLeave: 2 },
            { department: 'Marketing', employees: 15, active: 14, onLeave: 1 },
            { department: 'HR', employees: 8, active: 8, onLeave: 0 },
            { department: 'Finance', employees: 6, active: 6, onLeave: 0 },
            { department: 'IT', employees: 10, active: 9, onLeave: 1 }
          ],
          attendanceTrend: [
            { month: 'Jan', present: 95, absent: 5 },
            { month: 'Feb', present: 92, absent: 8 },
            { month: 'Mar', present: 97, absent: 3 },
            { month: 'Apr', present: 94, absent: 6 },
            { month: 'May', present: 96, absent: 4 },
            { month: 'Jun', present: 93, absent: 7 }
          ]
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format) => {
    // Mock export functionality
    alert(`Exporting ${activeTab} report as ${format.toUpperCase()}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sample reports...</p>
        </div>
      </div>
    );
  }

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
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Sample Reports</h1>
              <p className="text-green-100 text-sm md:text-base">Comprehensive analytics and insights dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 bg-white/20 text-white rounded-lg backdrop-blur-sm border border-white/30"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {[
              { id: 'sales', label: 'Sales Reports', icon: 'fas fa-chart-bar' },
              { id: 'marketing', label: 'Marketing Reports', icon: 'fas fa-bullhorn' },
              { id: 'hr', label: 'HR Reports', icon: 'fas fa-users-cog' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className={tab.icon}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Export Options */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 capitalize">{activeTab} Analytics</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => exportReport('pdf')}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 flex items-center space-x-2"
              >
                <i className="fas fa-file-pdf"></i>
                <span>PDF</span>
              </button>
              <button
                onClick={() => exportReport('excel')}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                <i className="fas fa-file-excel"></i>
                <span>Excel</span>
              </button>
              <button
                onClick={() => exportReport('csv')}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <i className="fas fa-file-csv"></i>
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Sales Reports */}
          {activeTab === 'sales' && reportData.sales && (
            <div className="space-y-6">
              {/* Revenue Trend */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={reportData.sales.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, '']} />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Lead Status Distribution */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Status Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reportData.sales.leadStatus}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {reportData.sales.leadStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Top Performers */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
                  <div className="space-y-4">
                    {reportData.sales.topPerformers.map((performer, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                            {performer.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{performer.name}</p>
                            <p className="text-xs text-gray-500">{performer.leads} leads</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">₹{performer.revenue.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Monthly Performance Table */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Performance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deals</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.sales.monthlyRevenue.map((month, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{month.month}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{month.revenue.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{month.leads}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{month.deals}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {((month.deals / month.leads) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Marketing Reports */}
          {activeTab === 'marketing' && reportData.marketing && (
            <div className="space-y-6">
              {/* Campaign Performance */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Performance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opened</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clicked</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Converted</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.marketing.campaignPerformance.map((campaign, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{campaign.campaign}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{campaign.sent.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{campaign.opened.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{campaign.clicked.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{campaign.converted}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {((campaign.converted / campaign.sent) * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Channel Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Source Breakdown</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reportData.marketing.channelBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {reportData.marketing.channelBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Marketing Metrics</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Total Campaigns</span>
                      <span className="text-lg font-bold text-blue-600">4</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Total Leads Generated</span>
                      <span className="text-lg font-bold text-green-600">234</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Conversion Rate</span>
                      <span className="text-lg font-bold text-purple-600">3.2%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">ROI</span>
                      <span className="text-lg font-bold text-orange-600">285%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HR Reports */}
          {activeTab === 'hr' && reportData.hr && (
            <div className="space-y-6">
              {/* Employee Statistics */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Overview</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Employees</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">On Leave</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.hr.employeeStats.map((dept, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dept.department}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dept.employees}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{dept.active}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">{dept.onLeave}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {((dept.active / dept.employees) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Attendance Trend */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={reportData.hr.attendanceTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} />
                      <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* HR Metrics */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">HR Metrics</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Total Employees</span>
                      <span className="text-lg font-bold text-blue-600">64</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Active Employees</span>
                      <span className="text-lg font-bold text-green-600">60</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">On Leave</span>
                      <span className="text-lg font-bold text-yellow-600">4</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Average Attendance</span>
                      <span className="text-lg font-bold text-purple-600">94.5%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}