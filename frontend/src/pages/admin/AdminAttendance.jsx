import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';
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
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminAttendance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [viewMode, setViewMode] = useState('overview');

  useEffect(() => {
    const employee = getEmployee();
    if (!employee || employee.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchAttendanceData();
  }, [navigate, selectedMonth, selectedDepartment]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/attendance?month=${selectedMonth}&department=${selectedDepartment}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const exportAttendance = (format) => {
    // Mock export functionality
    alert(`Exporting attendance data as ${format.toUpperCase()}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading attendance data...</p>
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
      totalEmployees: 64,
      presentToday: 58,
      absentToday: 6,
      onLeave: 4,
      attendanceRate: 90.6,
      avgWorkingHours: 8.2
    },
    monthlyStats: [
      { month: 'Jan', present: 1456, absent: 144, leave: 80, rate: 89.2 },
      { month: 'Feb', present: 1384, absent: 156, leave: 96, rate: 87.8 },
      { month: 'Mar', present: 1520, absent: 120, leave: 72, rate: 91.2 },
      { month: 'Apr', present: 1488, absent: 132, leave: 88, rate: 90.1 },
      { month: 'May', present: 1552, absent: 108, leave: 64, rate: 92.3 },
      { month: 'Jun', present: 1504, absent: 116, leave: 80, rate: 91.5 }
    ],
    departmentStats: [
      { department: 'Sales', present: 184, absent: 16, leave: 10, rate: 91.0 },
      { department: 'Marketing', present: 138, absent: 12, leave: 6, rate: 92.0 },
      { department: 'HR', present: 48, absent: 2, leave: 2, rate: 96.0 },
      { department: 'Finance', present: 38, absent: 4, leave: 3, rate: 88.4 },
      { department: 'IT', present: 55, absent: 5, leave: 4, rate: 91.7 }
    ],
    attendanceTypes: [
      { name: 'Present', value: 58, color: '#10b981' },
      { name: 'Absent', value: 6, color: '#ef4444' },
      { name: 'On Leave', value: 4, color: '#f59e0b' },
      { name: 'Late', value: 2, color: '#3b82f6' }
    ],
    employeeAttendance: [
      { id: 1, name: 'Rajesh Kumar', department: 'Sales', present: 22, absent: 1, leave: 2, rate: 91.7, status: 'present' },
      { id: 2, name: 'Priya Sharma', department: 'Marketing', present: 23, absent: 0, leave: 1, rate: 95.8, status: 'present' },
      { id: 3, name: 'Amit Singh', department: 'Sales', present: 21, absent: 2, leave: 1, rate: 87.5, status: 'absent' },
      { id: 4, name: 'Sneha Patel', department: 'HR', present: 24, absent: 0, leave: 0, rate: 100, status: 'present' },
      { id: 5, name: 'Vikram Rao', department: 'IT', present: 20, absent: 3, leave: 1, rate: 83.3, status: 'present' }
    ]
  };

  const dataToUse = data && data.summary ? data : mockData;
  const summary = dataToUse.summary || { totalEmployees: 0, presentToday: 0, absentToday: 0, onLeave: 0, attendanceRate: 0, avgWorkingHours: 0 };
  const monthlyStats = Array.isArray(dataToUse.monthlyStats) ? dataToUse.monthlyStats : [];
  const departmentStats = Array.isArray(dataToUse.departmentStats) ? dataToUse.departmentStats : [];
  const attendanceTypes = Array.isArray(dataToUse.attendanceTypes) ? dataToUse.attendanceTypes : [];
  const employeeAttendance = Array.isArray(dataToUse.employeeAttendance) ? dataToUse.employeeAttendance : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 via-green-700 to-green-800 rounded-xl shadow-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
              <i className="fas fa-calendar-check text-white text-3xl"></i>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Attendance Management</h1>
              <p className="text-green-100 text-sm md:text-base">Monitor and manage employee attendance across departments</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 bg-white/20 text-white rounded-lg backdrop-blur-sm border border-white/30"
            >
              <option value="2024-01">January 2024</option>
              <option value="2024-02">February 2024</option>
              <option value="2024-03">March 2024</option>
              <option value="2024-04">April 2024</option>
              <option value="2024-05">May 2024</option>
              <option value="2024-06">June 2024</option>
              <option value="2026-02">February 2026</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Departments</option>
            <option value="sales">Sales</option>
            <option value="marketing">Marketing</option>
            <option value="hr">HR</option>
            <option value="finance">Finance</option>
            <option value="it">IT</option>
          </select>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-lg font-medium ${
                viewMode === 'overview' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-4 py-2 rounded-lg font-medium ${
                viewMode === 'detailed' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Detailed View
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-xl shadow-lg p-5 border border-green-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Present Today</p>
              <p className="text-3xl font-bold text-gray-900">{summary.presentToday}</p>
              <p className="text-xs text-green-600 font-medium mt-1">Out of {summary.totalEmployees}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-check-circle text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-red-50/50 rounded-xl shadow-lg p-5 border border-red-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Absent Today</p>
              <p className="text-3xl font-bold text-gray-900">{summary.absentToday}</p>
              <p className="text-xs text-red-600 font-medium mt-1">Requires attention</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-times-circle text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-xl shadow-lg p-5 border border-blue-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Attendance Rate</p>
              <p className="text-3xl font-bold text-gray-900">{summary.attendanceRate}%</p>
              <p className="text-xs text-blue-600 font-medium mt-1">Monthly average</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-percentage text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-purple-50/50 rounded-xl shadow-lg p-5 border border-purple-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Avg Working Hours</p>
              <p className="text-3xl font-bold text-gray-900">{summary.avgWorkingHours}h</p>
              <p className="text-xs text-purple-600 font-medium mt-1">Per day</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-clock text-white"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Attendance Breakdown */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Attendance Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={attendanceTypes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {attendanceTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Attendance Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rate" stroke="#10b981" name="Attendance Rate %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Department-wise Statistics */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Department-wise Attendance</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => exportAttendance('excel')}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">On Leave</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dataToUse.departmentStats.map((dept, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dept.department}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{dept.present}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{dept.absent}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">{dept.leave}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dept.rate}%</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          dept.rate >= 90 ? 'bg-green-100 text-green-700' :
                          dept.rate >= 80 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {dept.rate >= 90 ? 'Excellent' : dept.rate >= 80 ? 'Good' : 'Needs Attention'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual Employee Attendance */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Individual Employee Attendance</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Today</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employeeAttendance.map((employee, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.department}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{employee.present}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{employee.absent}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">{employee.leave}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.rate}%</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          employee.status === 'present' ? 'bg-green-100 text-green-700' :
                          employee.status === 'absent' ? 'bg-red-100 text-red-700' :
                          employee.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {employee.status}
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
  );
}
