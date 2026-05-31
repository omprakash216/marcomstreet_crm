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
  Area,
  ScatterChart,
  Scatter
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function AdminInsights() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const employee = getEmployee();
    const role = normalizeRole(employee?.role);
    if (!employee || (role !== 'admin' && role !== 'superadmin' && role !== 'super_admin')) {
      navigate('/login');
      return;
    }
    fetchInsightsData();
  }, [navigate]);

  const fetchInsightsData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/insights');
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load insights data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading business insights...</p>
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
    overview: {
      totalLeads: 1247,
      activeLeads: 892,
      convertedLeads: 355,
      lostLeads: 234,
      avgLeadScore: 68,
      customerSatisfaction: 4.2,
      employeeProductivity: 87,
      marketGrowth: 12.5
    },
    leadQuality: [
      { score: '90-100', count: 45, quality: 'Excellent' },
      { score: '80-89', count: 78, quality: 'Very Good' },
      { score: '70-79', count: 123, quality: 'Good' },
      { score: '60-69', count: 156, quality: 'Average' },
      { score: '50-59', count: 89, quality: 'Below Average' },
      { score: '0-49', count: 67, quality: 'Poor' }
    ],
    performanceTrends: [
      { month: 'Jan', leads: 98, conversions: 32, satisfaction: 4.1 },
      { month: 'Feb', leads: 112, conversions: 38, satisfaction: 4.3 },
      { month: 'Mar', leads: 134, conversions: 45, satisfaction: 4.2 },
      { month: 'Apr', leads: 145, conversions: 48, satisfaction: 4.4 },
      { month: 'May', leads: 156, conversions: 52, satisfaction: 4.1 },
      { month: 'Jun', leads: 167, conversions: 56, satisfaction: 4.3 }
    ],
    departmentEfficiency: [
      { department: 'Sales', efficiency: 92, tasksCompleted: 245, avgTime: 2.3 },
      { department: 'Marketing', efficiency: 88, tasksCompleted: 189, avgTime: 3.1 },
      { department: 'HR', efficiency: 95, tasksCompleted: 67, avgTime: 1.8 },
      { department: 'Finance', efficiency: 90, tasksCompleted: 134, avgTime: 2.7 },
      { department: 'IT', efficiency: 85, tasksCompleted: 78, avgTime: 4.2 }
    ],
    predictiveInsights: [
      {
        type: 'opportunity',
        title: 'High-Value Lead Cluster',
        description: 'Identified 15 high-value leads in the technology sector with 85%+ conversion potential',
        impact: 'high',
        recommendation: 'Prioritize these leads for immediate follow-up'
      },
      {
        type: 'warning',
        title: 'Lead Quality Decline',
        description: 'Lead quality scores have decreased by 8% in the last month',
        impact: 'medium',
        recommendation: 'Review lead generation sources and qualification criteria'
      },
      {
        type: 'trend',
        title: 'Seasonal Pattern Detected',
        description: 'Conversion rates typically increase by 25% during Q4',
        impact: 'low',
        recommendation: 'Prepare additional resources for end-of-year rush'
      }
    ],
    competitiveAnalysis: [
      { metric: 'Lead Conversion Rate', company: 36.5, industry: 28.3, difference: 8.2 },
      { metric: 'Customer Satisfaction', company: 4.2, industry: 3.8, difference: 0.4 },
      { metric: 'Response Time (hrs)', company: 2.3, industry: 4.1, difference: -1.8 },
      { metric: 'Deal Closure Time', company: 14, industry: 18, difference: -4 }
    ]
  };

  const dataToUse = data && data.overview ? data : mockData;
  const overview = dataToUse.overview || {};
  const leadQuality = Array.isArray(dataToUse.leadQuality) ? dataToUse.leadQuality : [];
  const performanceTrends = Array.isArray(dataToUse.performanceTrends) ? dataToUse.performanceTrends : [];
  const departmentEfficiency = Array.isArray(dataToUse.departmentEfficiency) ? dataToUse.departmentEfficiency : [];
  const predictiveInsights = Array.isArray(dataToUse.predictiveInsights) ? dataToUse.predictiveInsights : [];
  const competitiveAnalysis = Array.isArray(dataToUse.competitiveAnalysis) ? dataToUse.competitiveAnalysis : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-xl shadow-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
              <i className="fas fa-lightbulb text-white text-3xl"></i>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Business Insights</h1>
              <p className="text-blue-100 text-sm md:text-base">Data-driven insights and predictive analytics</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-all font-semibold">
              Generate Report
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {[
              { id: 'overview', label: 'Overview', icon: 'fas fa-chart-pie' },
              { id: 'performance', label: 'Performance', icon: 'fas fa-chart-line' },
              { id: 'predictive', label: 'Predictive', icon: 'fas fa-brain' },
              { id: 'competitive', label: 'Competitive', icon: 'fas fa-trophy' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
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
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-xl shadow-lg p-5 border border-blue-100/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Lead Quality Score</p>
                      <p className="text-3xl font-bold text-gray-900">{overview.avgLeadScore || 0}</p>
                      <p className="text-xs text-blue-600 font-medium mt-1">Out of 100</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                      <i className="fas fa-star text-white"></i>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-white to-green-50/50 rounded-xl shadow-lg p-5 border border-green-100/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Customer Satisfaction</p>
                      <p className="text-3xl font-bold text-gray-900">{overview.customerSatisfaction || 0}</p>
                      <p className="text-xs text-green-600 font-medium mt-1">Out of 5.0</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
                      <i className="fas fa-smile text-white"></i>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-white to-purple-50/50 rounded-xl shadow-lg p-5 border border-purple-100/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Employee Productivity</p>
                      <p className="text-3xl font-bold text-gray-900">{overview.employeeProductivity || 0}%</p>
                      <p className="text-xs text-purple-600 font-medium mt-1">Efficiency rate</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                      <i className="fas fa-cogs text-white"></i>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-white to-orange-50/50 rounded-xl shadow-lg p-5 border border-orange-100/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Market Growth</p>
                      <p className="text-3xl font-bold text-gray-900">{overview.marketGrowth || 0}%</p>
                      <p className="text-xs text-orange-600 font-medium mt-1">Industry trend</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
                      <i className="fas fa-chart-line text-white"></i>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lead Quality Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Quality Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={leadQuality}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="score" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Status Overview</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Active Leads</span>
                      <span className="text-lg font-bold text-blue-600">{overview.activeLeads || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Converted</span>
                      <span className="text-lg font-bold text-green-600">{overview.convertedLeads || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Lost</span>
                      <span className="text-lg font-bold text-red-600">{overview.lostLeads || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Conversion Rate</span>
                      <span className="text-lg font-bold text-purple-600">
                        {overview.totalLeads ? ((overview.convertedLeads / overview.totalLeads) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              {/* Performance Trends */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="leads" stroke="#3b82f6" name="Leads" />
                    <Line yAxisId="left" type="monotone" dataKey="conversions" stroke="#10b981" name="Conversions" />
                    <Line yAxisId="right" type="monotone" dataKey="satisfaction" stroke="#f59e0b" name="Satisfaction" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Department Efficiency */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Efficiency</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Efficiency</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tasks Completed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time (days)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {departmentEfficiency.map((dept, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dept.department}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{ width: `${dept.efficiency}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-900">{dept.efficiency}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dept.tasksCompleted}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dept.avgTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Predictive Tab */}
          {activeTab === 'predictive' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Predictive Insights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {predictiveInsights.map((insight, index) => (
                  <div key={index} className={`bg-white rounded-xl shadow-lg border p-6 ${
                    insight.impact === 'high' ? 'border-red-200 bg-red-50/50' :
                    insight.impact === 'medium' ? 'border-yellow-200 bg-yellow-50/50' :
                    'border-blue-200 bg-blue-50/50'
                  }`}>
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg ${
                        insight.type === 'opportunity' ? 'bg-green-100 text-green-600' :
                        insight.type === 'warning' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <i className={`fas ${
                          insight.type === 'opportunity' ? 'fa-arrow-trend-up' :
                          insight.type === 'warning' ? 'fa-exclamation-triangle' :
                          'fa-chart-line'
                        }`}></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">{insight.title}</h4>
                        <p className="text-xs text-gray-600 mb-3">{insight.description}</p>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            insight.impact === 'high' ? 'bg-red-100 text-red-700' :
                            insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {insight.impact} impact
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 mt-2 font-medium">💡 {insight.recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitive Tab */}
          {activeTab === 'competitive' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Competitive Analysis</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Our Performance</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Industry Average</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difference</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {competitiveAnalysis.map((metric, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{metric.metric}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{metric.company}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{metric.industry}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={metric.difference > 0 ? 'text-green-600' : 'text-red-600'}>
                              {metric.difference > 0 ? '+' : ''}{metric.difference}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              metric.difference > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {metric.difference > 0 ? 'Above Average' : 'Below Average'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
