import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
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
  const [filterMode, setFilterMode] = useState('month'); // 'month' | 'custom'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const employee = getEmployee();
    const role = normalizeRole(employee?.role);
    if (!employee || (role !== 'admin' && role !== 'superadmin' && role !== 'super_admin')) {
      navigate('/login');
      return;
    }
    fetchAttendanceData();
  }, [navigate, selectedMonth, selectedDepartment, filterMode, dateFrom, dateTo]);

  const summary = useMemo(() => {
    return data?.summary || {
      totalEmployees: 0,
      presentToday: 0,
      absentToday: 0,
      onLeave: 0,
      attendanceRate: 0,
      avgWorkingHours: 0,
      lateArrivals: 0,
      overtimeEmployees: 0,
    };
  }, [data]);

  const monthlyStats = useMemo(() => {
    if (!Array.isArray(data?.monthlyStats)) return [];
    return data.monthlyStats.map((item) => ({
      month: item.day ? item.day.slice(8, 10) : item.month,
      rate: item.records || 0,
      workedHours: item.workedHours || 0,
      overtimeHours: item.overtimeHours || 0,
    }));
  }, [data]);

  const attendanceTypes = useMemo(() => {
    if (!Array.isArray(data?.attendanceTypes)) return [];
    return data.attendanceTypes;
  }, [data]);

  const attendanceRecords = useMemo(() => {
    if (!Array.isArray(data?.attendanceRecords)) return [];
    return data.attendanceRecords;
  }, [data]);

  const departmentStats = useMemo(() => {
    const grouped = new Map();
    attendanceRecords.forEach((record) => {
      const key = record.department_name || 'Unassigned';
      const current = grouped.get(key) || {
        department: key,
        present: 0,
        onBreak: 0,
        completed: 0,
        late: 0,
        avgHours: 0,
        totalHours: 0,
        count: 0,
      };
      if (record.status === 'checked_in') current.present += 1;
      if (record.status === 'on_break') current.onBreak += 1;
      if (record.status === 'completed') current.completed += 1;
      if (record.is_late) current.late += 1;
      current.totalHours += Number(record.total_hours) || 0;
      current.count += 1;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).map((item) => ({
      ...item,
      avgHours: item.count ? (item.totalHours / item.count).toFixed(2) : '0.00',
    }));
  }, [attendanceRecords]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const params = { department: selectedDepartment };
      if (filterMode === 'month') {
        params.month = selectedMonth;
      } else {
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
      }
      const response = await api.get('/admin/attendance', { params });
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const exportAttendance = async () => {
    const params = { format: 'csv' };
    if (filterMode === 'month') {
      params.month = selectedMonth;
    } else {
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
    }
    const response = await api.get('/hrms/attendance/report', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const suffix = filterMode === 'month'
      ? selectedMonth
      : `${dateFrom || 'start'}-to-${dateTo || 'end'}`;
    link.download = `attendance-report-${suffix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter Type</label>
            <div className="inline-flex w-full rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setFilterMode('month')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  filterMode === 'month' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setFilterMode('custom')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  filterMode === 'custom' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Custom Range
              </button>
            </div>
          </div>
          {filterMode === 'month' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Departments</option>
              <option value="sales">Sales</option>
              <option value="marketing">Marketing</option>
              <option value="hr">HR</option>
              <option value="finance">Finance</option>
              <option value="it">IT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">View</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setViewMode('overview')}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium ${
                  viewMode === 'overview' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium ${
                  viewMode === 'detailed' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Detailed View
              </button>
            </div>
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
                  <Line type="monotone" dataKey="workedHours" stroke="#10b981" name="Worked Hours" />
                  <Line type="monotone" dataKey="overtimeHours" stroke="#3b82f6" name="Overtime Hours" />
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
                  onClick={exportAttendance}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">On Break</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Hours</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {departmentStats.map((dept, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dept.department}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{dept.present}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-600">{dept.onBreak}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{dept.completed}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{dept.late}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dept.avgHours}h</td>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worked</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Break</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceRecords.map((employee, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.department_name || 'Unassigned'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.check_in_time || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.check_out_time || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{employee.worked_time || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-600">{employee.break_time || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          employee.status === 'checked_in' ? 'bg-green-100 text-green-700' :
                          employee.status === 'on_break' ? 'bg-yellow-100 text-yellow-700' :
                          employee.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
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
