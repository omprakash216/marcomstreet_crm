import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';

export default function Attendance() {
  const location = useLocation();
  const isHRRoute = location.pathname.startsWith('/hr/');
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false); // true while getting location + saving punch
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0 });
  const [filter, setFilter] = useState({
    date_from: '',
    date_to: '',
    status: '',
    dayType: '' // '' | 'full_day' | 'half_day'
  });
  const employee = getEmployee();
  const isHRManager = employee?.role === 'admin' || employee?.role === 'manager' || employee?.role === 'human_resources';

  const [editModal, setEditModal] = useState({ open: false, record: null });
  const [editForm, setEditForm] = useState({ check_in_time: '', check_out_time: '', attendance_type: 'full_day', reason: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [viewModal, setViewModal] = useState({ open: false, employeeId: null, employeeName: '', month: '' });
  const [viewAttendance, setViewAttendance] = useState([]);
  const [loadingView, setLoadingView] = useState(false);
  const [downloadingEmployeeReport, setDownloadingEmployeeReport] = useState(false);
  const [downloadingRowKey, setDownloadingRowKey] = useState(null); // 'employeeId-month' when downloading from row

  useEffect(() => {
    fetchAttendance();
  }, [filter.date_from, filter.date_to]);

  const fetchAttendance = async () => {
    try {
      const params = {};
      if (filter.date_from) params.date_from = filter.date_from;
      if (filter.date_to) params.date_to = filter.date_to;
      const response = await api.get('/hrms/attendance', { params });
      if (response.data.success) {
        setAttendance(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Office geofence: set in .env (VITE_OFFICE_LAT, VITE_OFFICE_LNG, VITE_OFFICE_RADIUS_M)
  const officeLat = parseFloat(import.meta.env.VITE_OFFICE_LAT);
  const officeLng = parseFloat(import.meta.env.VITE_OFFICE_LNG);
  const officeRadiusM = parseFloat(import.meta.env.VITE_OFFICE_RADIUS_M) || 200;
  const hasOfficeGeofence = !Number.isNaN(officeLat) && !Number.isNaN(officeLng);

  const distanceInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'MARCOM-CRM-Attendance/1.0' } }
      );
      const data = await res.json();
      return data.display_name || null;
    } catch (_) {
      return null;
    }
  };

  const handlePunch = async (action) => {
    setPunching(true);
    try {
      let locationStr = 'Office';
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          const lat = pos.coords.latitude.toFixed(4);
          const lng = pos.coords.longitude.toFixed(4);
          const coordsStr = `Lat: ${lat}, Lng: ${lng}`;
          const isAtOffice = hasOfficeGeofence && distanceInMeters(pos.coords.latitude, pos.coords.longitude, officeLat, officeLng) <= officeRadiusM;
          if (isAtOffice) {
            locationStr = `Office | ${coordsStr}`;
          } else {
            const placeName = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
            locationStr = placeName ? `${placeName} | ${coordsStr}` : coordsStr;
          }
        } catch (_) {
          locationStr = 'Location unavailable';
        }
      }
      const response = await api.post('/hrms/attendance', { action, location: locationStr });
      if (response.data.success) {
        const msg = response.data.message || (action === 'check_in' ? 'Checked in' : 'Checked out');
        alert(msg);
        fetchAttendance();
      }
    } catch (error) {
      const msg =
        (error.response && error.response.data && (error.response.data.message || error.response.data.error)) ||
        error.message ||
        'Failed to record attendance';
      alert(msg);
    } finally {
      setPunching(false);
    }
  };

  // Show only location name (part before " | ") or full string if no pipe
  const getLocationName = (loc) => {
    if (!loc || typeof loc !== 'string') return '';
    const i = loc.indexOf(' | ');
    return i > 0 ? loc.slice(0, i) : loc;
  };

  // Parse "Lat: 28.5810, Lng: 77.3574" or "Name | Lat: ..." to get map URL
  const getMapUrl = (loc) => {
    if (!loc || typeof loc !== 'string') return null;
    const latMatch = loc.match(/Lat:\s*([-\d.]+)/i);
    const lngMatch = loc.match(/Lng:\s*([-\d.]+)/i);
    if (latMatch && lngMatch) return `https://www.google.com/maps?q=${latMatch[1]},${lngMatch[1]}`;
    return null;
  };

  const handleFilterChange = (field, value) => {
    setFilter({ ...filter, [field]: value });
  };

  const openEditModal = (record) => {
    setEditModal({ open: true, record });
    setEditForm({
      check_in_time: record.check_in_time ? String(record.check_in_time).slice(0, 8) : '',
      check_out_time: record.check_out_time ? String(record.check_out_time).slice(0, 8) : '',
      attendance_type: (record.attendance_type || 'full_day').toLowerCase() === 'half_day' ? 'half_day' : 'full_day',
      reason: record.edit_reason || '',
    });
  };

  const closeEditModal = () => {
    setEditModal({ open: false, record: null });
  };

  const handleSaveEdit = async () => {
    if (!editModal.record || !editModal.record.id) return;
    const reasonTrim = (editForm.reason || '').trim();
    if (!reasonTrim) {
      alert('Please enter reason for edit (e.g. why attendance is being changed or reason for late coming).');
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/hrms/attendance/${editModal.record.id}`, {
        check_in_time: editForm.check_in_time || null,
        check_out_time: editForm.check_out_time || null,
        attendance_type: editForm.attendance_type,
        reason: reasonTrim,
      });
      alert('Attendance updated successfully.');
      closeEditModal();
      fetchAttendance();
    } catch (err) {
      const msg = (err.response && err.response.data && err.response.data.message) || err.message || 'Failed to update';
      alert(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!reportMonth) return;
    setDownloadingReport(true);
    try {
      const response = await api.get('/hrms/attendance/report', {
        params: { month: reportMonth, format: 'csv' },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-report-${reportMonth}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = (err.response && err.response.data && (err.response.data.message || (typeof err.response.data === 'string' ? err.response.data : 'Download failed'))) || err.message || 'Download failed';
      alert(msg);
    } finally {
      setDownloadingReport(false);
    }
  };

  const getMonthBounds = (monthStr) => {
    if (!/^\d{4}-\d{2}$/.test(monthStr)) return { first: '', last: '' };
    const [y, m] = monthStr.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      first: `${monthStr}-01`,
      last: `${monthStr}-${String(lastDay).padStart(2, '0')}`,
    };
  };

  const openViewModal = (record) => {
    const month = (record.date && String(record.date).slice(0, 7)) || reportMonth;
    setViewModal({
      open: true,
      employeeId: record.employee_id,
      employeeName: record.employee_name || 'Employee',
      month,
    });
    setViewAttendance([]);
  };

  const closeViewModal = () => {
    setViewModal({ open: false, employeeId: null, employeeName: '', month: '' });
    setViewAttendance([]);
  };

  useEffect(() => {
    if (!viewModal.open || !viewModal.employeeId || !viewModal.month) return;
    const { first, last } = getMonthBounds(viewModal.month);
    if (!first || !last) return;
    setLoadingView(true);
    api
      .get('/hrms/attendance', {
        params: { employee_id: viewModal.employeeId, date_from: first, date_to: last },
      })
      .then((res) => {
        if (res.data && res.data.success && Array.isArray(res.data.data)) {
          setViewAttendance(res.data.data);
        }
      })
      .catch(() => setViewAttendance([]))
      .finally(() => setLoadingView(false));
  }, [viewModal.open, viewModal.employeeId, viewModal.month]);

  const handleDownloadEmployeeReport = async (employeeId, month, employeeName) => {
    if (!month || !employeeId) return;
    setDownloadingEmployeeReport(true);
    try {
      const response = await api.get('/hrms/attendance/report', {
        params: { month, employee_id: employeeId, format: 'csv' },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (employeeName || 'employee').replace(/\s+/g, '-').slice(0, 30);
      a.download = `attendance-${month}-${safeName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = (err.response && err.response.data && (typeof err.response.data === 'string' ? err.response.data : err.response.data?.message)) || err.message || 'Download failed';
      alert(msg);
    } finally {
      setDownloadingEmployeeReport(false);
    }
  };

  const clearFilters = () => {
    setFilter({
      date_from: '',
      date_to: '',
      status: '',
      dayType: ''
    });
  };

  const filteredAttendance = attendance.filter(record => {
    const matchesStatus = filter.status === '' || record.attendance_status === filter.status;
    const matchesDateFrom = filter.date_from === '' || record.date >= filter.date_from;
    const matchesDateTo = filter.date_to === '' || record.date <= filter.date_to;
    const recordDayType = (record.attendance_type || '').toLowerCase();
    const matchesDayType = filter.dayType === '' || recordDayType === filter.dayType;
    return matchesStatus && matchesDateFrom && matchesDateTo && matchesDayType;
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecord = attendance.find(r => r.date === todayStr);
  const todayDayType = (todayRecord?.attendance_type || '').toLowerCase(); // 'full_day' | 'half_day' | ''

  const fullDayCount = attendance.filter(a => (a.attendance_type || '').toLowerCase() === 'full_day').length;
  const halfDayCount = attendance.filter(a => (a.attendance_type || '').toLowerCase() === 'half_day').length;
  const presentCount = attendance.filter(a => a.attendance_status === 'completed' || a.attendance_status === 'checked_in').length;

  // 6 days working (Mon–Sat), 8h/day = 48h per week. Monday = 48h remaining; as work is done, remaining decreases.
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 Sun, 1 Mon, ..., 6 Sat
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // This week's Monday (Sunday = previous Monday)
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setDate(today.getDate() - mondayOffset);
  thisWeekMonday.setHours(0, 0, 0, 0);
  const thisWeekSaturday = new Date(thisWeekMonday);
  thisWeekSaturday.setDate(thisWeekMonday.getDate() + 5);
  thisWeekSaturday.setHours(23, 59, 59, 999);
  const weekRecords = attendance.filter(a => {
    if (a.attendance_status !== 'completed' && a.attendance_status !== 'checked_in') return false;
    const d = new Date(a.date);
    d.setHours(12, 0, 0, 0);
    return d >= thisWeekMonday && d <= thisWeekSaturday;
  });
  const workingHoursThisWeek = weekRecords.reduce((sum, a) => sum + (parseFloat(a.total_hours) || 0), 0);
  const weeklyTargetHours = 48; // 6 days × 8h
  const remainingHoursThisWeek = Math.max(0, weeklyTargetHours - workingHoursThisWeek);

  // Fixed company policy (as requested)
  const targetCheckInTime = '09:30 AM';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Breadcrumb when under /hr */}
      {isHRRoute && (
        <nav className="flex text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
          <Link to="/hr" className="hover:text-blue-600">HR</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 font-medium">Attendance</span>
        </nav>
      )}
      {/* Standardized Header Section */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg text-white">
              <i className="fas fa-clock text-2xl"></i>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1">
                {isHRManager ? 'Employee Attendance Tracker' : 'My Attendance Tracker'}
              </h1>
              <p className="text-slate-300 text-sm">
                {isHRManager ? 'Monitor and manage employee daily attendance' : 'Record and view your daily attendance'}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => handlePunch('check_in')}
                disabled={punching}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg font-semibold transition-all duration-200 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <i className={`fas ${punching ? 'fa-spinner fa-spin' : 'fa-sign-in-alt'}`}></i>
                <span>{punching ? 'Getting location...' : 'Punch In'}</span>
              </button>
              <button
                onClick={() => handlePunch('check_out')}
                disabled={punching}
                className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-xl shadow-lg font-semibold transition-all duration-200 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <i className={`fas ${punching ? 'fa-spinner fa-spin' : 'fa-sign-out-alt'}`}></i>
                <span>{punching ? 'Getting location...' : 'Punch Out'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - icon center, text centered, professional */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex flex-col items-center text-center min-h-[180px]">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
            <i className="fas fa-calendar-check text-blue-600 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-1">Total Days Present</p>
          <p className="text-3xl font-bold text-blue-600 tracking-tight">{filteredAttendance.filter(a => a.attendance_status === 'completed' || a.attendance_status === 'checked_in').length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border border-green-100 flex flex-col items-center text-center min-h-[180px]">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-4">
            <i className="fas fa-sun text-green-600 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-1">Full day</p>
          <p className="text-3xl font-bold text-green-600 tracking-tight">{fullDayCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border border-amber-100 flex flex-col items-center text-center min-h-[180px]">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
            <i className="fas fa-clock text-amber-600 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-1">Half day</p>
          <p className="text-3xl font-bold text-amber-600 tracking-tight">{halfDayCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border border-indigo-50 flex flex-col items-center text-center min-h-[180px]">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
            <i className="fas fa-hourglass-half text-indigo-600 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-1">Remaining Hours</p>
          <p className="text-3xl font-bold text-indigo-600 tracking-tight">{`${remainingHoursThisWeek.toFixed(1)}h`}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border border-yellow-50 flex flex-col items-center text-center min-h-[180px]">
          <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center mb-4">
            <i className="fas fa-user-clock text-yellow-600 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-1">Target Check-in</p>
          <p className="text-2xl font-bold text-yellow-600 tracking-tight">{targetCheckInTime}</p>
        </div>
      </div>

      {/* HR only: Download month-wise report */}
      {isHRManager && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month-wise report</label>
              <input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              <i className={`fas ${downloadingReport ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
              {downloadingReport ? 'Downloading...' : 'Download Report'}
            </button>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={filter.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={filter.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filter.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="checked_in">Checked In</option>
              <option value="not_checked_in">Not Checked In</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Day Type</label>
            <select
              value={filter.dayType}
              onChange={(e) => handleFilterChange('dayType', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="full_day">Full day (9:30–9:40)</option>
              <option value="half_day">Half day (after 9:40)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filter.dayType && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
            Showing {filteredAttendance.length} record(s) — {filter.dayType === 'full_day' ? 'Full day only' : 'Half day only'}.
          </div>
        )}
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {isHRManager && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>}
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check In</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check Out</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Day Type</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Hours</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              {isHRManager && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={isHRManager ? 8 : 6} className="px-6 py-4 text-center">Loading...</td></tr>
            ) : filteredAttendance.length === 0 ? (
              <tr><td colSpan={isHRManager ? 8 : 6} className="px-6 py-4 text-center text-gray-500">No attendance records found</td></tr>
            ) : (
              filteredAttendance.map((record) => (
                <tr
                  key={record.id}
                  className={`hover:bg-gray-50 transition-colors ${record.date === todayStr ? 'bg-blue-50/50' : ''}`}
                >
                  {isHRManager && (
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                          {record.employee_name?.charAt(0) || 'E'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{record.employee_name}</div>
                          <div className="text-xs text-gray-500">{record.department || 'Staff'}</div>
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 font-medium">{record.date}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {record.check_in_time ? (
                      <div>
                        <div className="font-medium">{record.check_in_time}</div>
                        {record.check_in_location && (
                          <div className="text-xs mt-1">
                            {getMapUrl(record.check_in_location) ? (
                              <a
                                href={getMapUrl(record.check_in_location)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                                title="Open in map"
                              >
                                {getLocationName(record.check_in_location)}
                              </a>
                            ) : (
                              <span className="text-gray-600">{getLocationName(record.check_in_location)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {record.check_out_time ? (
                      <div>
                        <div className="font-medium">{record.check_out_time}</div>
                        {record.check_out_location && (
                          <div className="text-xs mt-1">
                            {getMapUrl(record.check_out_location) ? (
                              <a
                                href={getMapUrl(record.check_out_location)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                                title="Open in map"
                              >
                                {getLocationName(record.check_out_location)}
                              </a>
                            ) : (
                              <span className="text-gray-600">{getLocationName(record.check_out_location)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const dt = (record.attendance_type || '').toLowerCase();
                      return (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${dt === 'full_day' ? 'bg-green-100 text-green-700' : dt === 'half_day' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                          {dt === 'full_day' ? 'Full day' : dt === 'half_day' ? 'Half day' : '-'}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {record.total_hours ? (
                      <span className="font-medium text-blue-600">{record.total_hours}h</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${record.attendance_status === 'completed' ? 'bg-green-100 text-green-700' :
                      record.attendance_status === 'checked_in' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                      {record.attendance_status === 'completed' ? 'Completed' :
                        record.attendance_status === 'checked_in' ? 'Checked In' :
                          'Not Checked In'}
                    </span>
                  </td>
                  {isHRManager && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openViewModal(record)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View month attendance"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadEmployeeReport(record.employee_id, (record.date && String(record.date).slice(0, 7)) || reportMonth, record.employee_name, true)}
                          disabled={!!downloadingRowKey}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-60"
                          title="Download month report"
                        >
                          <i className={`fas ${downloadingRowKey === `${record.employee_id}-${(record.date && String(record.date).slice(0, 7)) || reportMonth}` ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(record)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit attendance"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Attendance Modal – HR only */}
      {editModal.open && editModal.record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeEditModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Attendance</h3>
            <p className="text-sm text-gray-500 mb-4">
              {editModal.record.employee_name} – {String(editModal.record.date).slice(0, 10)}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check In Time</label>
                <input
                  type="time"
                  value={editForm.check_in_time}
                  onChange={(e) => setEditForm({ ...editForm, check_in_time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check Out Time</label>
                <input
                  type="time"
                  value={editForm.check_out_time}
                  onChange={(e) => setEditForm({ ...editForm, check_out_time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day Type</label>
                <select
                  value={editForm.attendance_type}
                  onChange={(e) => setEditForm({ ...editForm, attendance_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="full_day">Full day</option>
                  <option value="half_day">Half day</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for edit <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editForm.reason || ''}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  placeholder="e.g. Why is attendance being changed? If late, reason for late coming."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {savingEdit ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Attendance Modal – employee month details + download */}
      {viewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeViewModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-user-clock text-white text-lg"></i>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Attendance – {viewModal.employeeName}</h3>
                  <p className="text-indigo-200 text-sm">
                    Month: {viewModal.month}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadEmployeeReport(viewModal.employeeId, viewModal.month, viewModal.employeeName)}
                  disabled={downloadingEmployeeReport}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                >
                  <i className={`fas ${downloadingEmployeeReport ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                  {downloadingEmployeeReport ? 'Downloading...' : 'Download Report'}
                </button>
                <button
                  type="button"
                  onClick={closeViewModal}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                  title="Close"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 border-t border-gray-100">
              {loadingView ? (
                <div className="flex items-center justify-center py-12">
                  <i className="fas fa-spinner fa-spin text-3xl text-indigo-600"></i>
                </div>
              ) : viewAttendance.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <i className="fas fa-calendar-times text-4xl mb-3 text-gray-300"></i>
                  <p>No attendance records for this month.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700">Date</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Check In</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Check Out</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Day Type</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Hours</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                        {viewAttendance.some(r => r.edit_reason) && (
                          <th className="px-4 py-3 font-semibold text-gray-700">Edit Reason</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewAttendance.map((r) => {
                        const dt = (r.attendance_type || '').toLowerCase();
                        const status = r.attendance_status || (r.check_out_time ? 'completed' : 'checked_in');
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{r.date && String(r.date).slice(0, 10)}</td>
                            <td className="px-4 py-3 text-gray-600">{r.check_in_time || '–'}</td>
                            <td className="px-4 py-3 text-gray-600">{r.check_out_time || '–'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dt === 'full_day' ? 'bg-green-100 text-green-700' : dt === 'half_day' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                {dt === 'full_day' ? 'Full day' : dt === 'half_day' ? 'Half day' : '–'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{r.total_hours != null ? `${r.total_hours}h` : '–'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status === 'completed' ? 'bg-green-100 text-green-700' : status === 'checked_in' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                {status === 'completed' ? 'Completed' : status === 'checked_in' ? 'Checked In' : 'Not Checked In'}
                              </span>
                            </td>
                            {viewAttendance.some(row => row.edit_reason) && (
                              <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate" title={r.edit_reason || ''}>
                                {r.edit_reason || '–'}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!loadingView && viewAttendance.length > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  Total: {viewAttendance.length} record(s) · Full day: {viewAttendance.filter(a => (a.attendance_type || '').toLowerCase() === 'full_day').length} · Half day: {viewAttendance.filter(a => (a.attendance_type || '').toLowerCase() === 'half_day').length}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
