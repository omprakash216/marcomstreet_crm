import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import MeetingModal from '../components/MeetingModal';

// SVG Icons
const IconCalendar = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IconCheckCircle = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconBell = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const IconBriefcase = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.564 23.564 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const IconPhone = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const IconMessage = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const IconEdit = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const IconEye = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [hasNextPage, setHasNextPage] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showMOMModal, setShowMOMModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [momText, setMomText] = useState('');
  const [summary, setSummary] = useState({
    today_meetings: 0,
    completed_meetings: 0,
    pending_followups: 0,
    active_deals: 0,
    active_deals_value: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    date_filter: '', // today, week, custom
    date_from: '',
    date_to: '',
    location: '', // online, offline
    status: '', // upcoming, completed, missed
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const leadId = searchParams.get('lead_id');

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [filters, leadId, page]);

  const fetchSummary = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setSummary({
        today_meetings: 0,
        completed_meetings: 0,
        pending_followups: 0,
        active_deals: 0,
        active_deals_value: 0,
      });
      return;
    }

    try {
      setLoadError('');
      // Use dedicated summary endpoint if available, otherwise calculate from multiple calls
      try {
        const summaryResponse = await api.get('/meetings/summary');
        if (summaryResponse.data.success) {
          setSummary(summaryResponse.data.data);
          return;
        }
      } catch (summaryError) {
        // Silently fallback - don't log expected errors
        if (summaryError.response?.status !== 401 && summaryError.code !== 'ERR_NETWORK') {
          console.log('Summary endpoint not available, calculating from multiple calls...');
        }
      }

      const today = new Date().toISOString().split('T')[0];

      // Today's meetings
      const todayResponse = await api.get(`/meetings?date=${today}`);
      const todayMeetings = todayResponse.data.data || [];

      // Completed meetings
      const completedResponse = await api.get('/meetings?status=completed');
      const completedMeetings = completedResponse.data.data || [];

      // Pending follow-ups
      const followupsResponse = await api.get('/followups?status=pending');
      const pendingFollowups = followupsResponse.data.data || [];

      // Active deals (from dashboard)
      const dashboardResponse = await api.get('/dashboard');
      const dashboardData = dashboardResponse.data.data || {};

      setSummary({
        today_meetings: todayMeetings.length,
        completed_meetings: completedMeetings.length,
        pending_followups: pendingFollowups.length,
        active_deals: dashboardData.total_leads || 0,
        active_deals_value: dashboardData.deal_value || 0,
      });
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching summary:', error);
      }
      if (error.response?.status && error.response?.status !== 401) {
        setLoadError(error.response?.data?.message || `Unable to load meetings summary (HTTP ${error.response.status})`);
      }
      // Set default values on error
      setSummary({
        today_meetings: 0,
        completed_meetings: 0,
        pending_followups: 0,
        active_deals: 0,
        active_deals_value: 0,
      });
    }
  };

  const fetchMeetings = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setMeetings([]);
      setHasNextPage(false);
      return;
    }

    setLoading(true);
    try {
      setLoadError('');
      const params = new URLSearchParams();

      if (leadId) params.append('lead_id', leadId);
      if (filters.search) params.append('search', filters.search);
      if (filters.status) {
        // Map frontend status to backend status
        const statusMap = {
          'upcoming': 'scheduled',
          'completed': 'completed',
          'missed': 'cancelled',
        };
        params.append('status', statusMap[filters.status] || filters.status);
      }
      if (filters.location) params.append('location', filters.location);

      // Date filtering
      if (filters.date_filter === 'today') {
        params.append('date', new Date().toISOString().split('T')[0]);
      } else if (filters.date_filter === 'week') {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
        params.append('date_from', weekStart.toISOString().split('T')[0]);
        params.append('date_to', weekEnd.toISOString().split('T')[0]);
      } else if (filters.date_from) {
        params.append('date_from', filters.date_from);
      }
      if (filters.date_to) {
        params.append('date_to', filters.date_to);
      }

      // Pagination: fetch one extra record to determine if next page exists.
      params.append('page', String(page));
      params.append('limit', String(pageSize + 1));

      const response = await api.get(`/meetings?${params.toString()}`);
      const rows = Array.isArray(response.data.data) ? response.data.data : [];
      setHasNextPage(rows.length > pageSize);
      setMeetings(rows.slice(0, pageSize));
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching meetings:', error);
      }
      if (error.response?.status && error.response?.status !== 401) {
        setLoadError(error.response?.data?.message || `Unable to load meetings (HTTP ${error.response.status})`);
      }
      setMeetings([]);
      setHasNextPage(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setPage(1);
    setFilters({ ...filters, [field]: value });
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({
      search: '',
      date_filter: '',
      date_from: '',
      date_to: '',
      location: '',
      status: '',
    });
  };

  const handleCall = (phone) => {
    if (phone) {
      window.open(`tel:${phone}`, '_self');
    }
  };

  const handleWhatsApp = (phone) => {
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    }
  };

  const handleUpdateMOM = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/meetings/update_outcome', {
        meeting_id: selectedMeetingId,
        outcome: momText
      });
      if (response.data.success) {
        alert('MOM updated successfully!');
        setShowMOMModal(false);
        setMomText('');
        fetchMeetings();
        fetchSummary();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update MOM');
    }
  };

  const handleStatusChange = async (meetingId, nextStatus) => {
    try {
      const response = await api.patch(`/meetings/${meetingId}/status`, { status: nextStatus });
      if (response.data.success) {
        fetchMeetings();
        fetchSummary();
      }
    } catch (error) {
      console.error('Error updating meeting status:', error);
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const getStatusColor = (status) => {
    const s = String(status || '').toLowerCase();
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      rescheduled: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      missed: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[s] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const renderStatusBadge = (status) => {
    const s = String(status || 'scheduled').toLowerCase();
    if (s === 'scheduled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-100 text-[10px] font-bold uppercase tracking-wider shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          Scheduled
        </span>
      );
    }
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-bold uppercase tracking-wider shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          Completed
        </span>
      );
    }
    if (s === 'cancelled' || s === 'missed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-rose-50 text-rose-700 border-rose-100 text-[10px] font-bold uppercase tracking-wider shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
          Cancelled
        </span>
      );
    }
    if (s === 'rescheduled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-100 text-[10px] font-bold uppercase tracking-wider shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          Rescheduled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-slate-50 text-slate-700 border-slate-100 text-[10px] font-bold uppercase tracking-wider shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        {s}
      </span>
    );
  };

  const getMeetingTypeColor = (type) => {
    const colors = {
      client_meeting: 'bg-purple-100 text-purple-800',
      follow_up: 'bg-indigo-100 text-indigo-800',
      presentation: 'bg-pink-100 text-pink-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getMeetingStatus = (meetingDate, status) => {
    const now = new Date();
    const meeting = new Date(meetingDate);

    if (status === 'completed') return 'completed';
    if (status === 'cancelled') return 'missed';
    if (meeting < now) return 'missed';
    return 'upcoming';
  };

  const calculateConversionProbability = (meeting) => {
    // Simple algorithm based on meeting type and status
    let probability = 30; // Base probability

    if (meeting.status === 'completed') probability += 20;
    if (meeting.meeting_type === 'presentation') probability += 15;
    if (meeting.meeting_type === 'client_meeting') probability += 10;
    const outcomeText = meeting.outcome || meeting.notes || '';
    if (outcomeText && String(outcomeText).toLowerCase().includes('positive')) probability += 25;

    return Math.min(probability, 95);
  };

  if (loading && meetings.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-6">
      {loadError ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 flex items-start justify-between gap-3">
          <div className="text-sm">
            <div className="font-bold">Meetings page is not loading properly</div>
            <div className="text-amber-800 mt-0.5">{loadError}</div>
          </div>
          <button
            onClick={() => {
              fetchSummary();
              fetchMeetings();
            }}
            className="shrink-0 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-black uppercase tracking-wider hover:bg-amber-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : null}
      {/* Professional Header Section */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left Side - Title and Icon */}
            <div className="flex items-center space-x-4">
              {/* Icon */}
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>

              {/* Title and Description */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-1">Client Meetings</h1>
                <p className="text-slate-300 text-sm">Schedule, track, and manage all your client meetings</p>
              </div>
            </div>

            {/* Right Side - Action Button */}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl hover:bg-slate-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Log Meeting</span>
            </button>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
      </div>

      {/* 1. TOP SMART SUMMARY BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => handleFilterChange('date_filter', 'today')}
          className={`bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 transition-all hover:shadow-lg hover:-translate-y-0.5 ${filters.date_filter === 'today' ? 'border-blue-500 shadow-md' : 'border-blue-200'
            }`}
        >
          <div className="flex items-center justify-between mb-2">
            <IconCalendar />
            <span className="text-2xl font-bold text-blue-700">{summary.today_meetings}</span>
          </div>
          <p className="text-xs font-semibold text-blue-900">Today's Meetings</p>
        </button>

        <button
          onClick={() => handleFilterChange('status', 'completed')}
          className={`bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border-2 transition-all hover:shadow-lg hover:-translate-y-0.5 ${filters.status === 'completed' ? 'border-green-500 shadow-md' : 'border-green-200'
            }`}
        >
          <div className="flex items-center justify-between mb-2">
            <IconCheckCircle />
            <span className="text-2xl font-bold text-green-700">{summary.completed_meetings}</span>
          </div>
          <p className="text-xs font-semibold text-green-900">Completed</p>
        </button>

        <button
          onClick={() => navigate('/followups')}
          className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200 transition-all hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-2">
            <IconBell />
            <span className="text-2xl font-bold text-orange-700">{summary.pending_followups}</span>
          </div>
          <p className="text-xs font-semibold text-orange-900">Pending Follow-ups</p>
        </button>

        <button
          onClick={() => navigate('/leads')}
          className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border-2 border-purple-200 transition-all hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-2">
            <IconBriefcase />
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-700">{summary.active_deals}</div>
              <div className="text-xs text-purple-600">₹{(summary.active_deals_value / 1000).toFixed(0)}K</div>
            </div>
          </div>
          <p className="text-xs font-semibold text-purple-900">Active Deals</p>
        </button>
      </div>

      {/* 3. FILTERS SECTION */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by client, company..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <select
              value={filters.date_filter}
              onChange={(e) => handleFilterChange('date_filter', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Location Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
            <select
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Locations</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range */}
        {filters.date_filter === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
        )}
      </div>

      {/* 4. MEETINGS DATA TABLE */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#244bd8] text-white font-black uppercase tracking-widest text-[10px]">
              <tr>
                <th className="px-6 py-4 text-left whitespace-nowrap">SL No</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">Meeting Title / Purpose</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">Client Entity</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">Schedule & Time</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">Venue / Link</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {meetings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-medium">
                    No meetings found matching your criteria
                  </td>
                </tr>
              ) : (
                meetings.map((meeting, index) => {
                  const meetingDate = new Date(meeting.meeting_date);
                  const isOnline = !meeting.location || meeting.location.toLowerCase().includes('online') ||
                    meeting.location.toLowerCase().includes('zoom') ||
                    meeting.location.toLowerCase().includes('http');

                  return (
                    <tr key={meeting.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-400">
                        #{(page - 1) * pageSize + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-900">{meeting.title}</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {meeting.meeting_type?.replace('_', ' ').toUpperCase() || 'GENERAL'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mr-3 border border-blue-100">
                            <i className="fas fa-building text-blue-600 text-xs"></i>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{meeting.company_name || 'Personal'}</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-tighter font-black mt-0.5">
                              {meeting.contact_person || 'No Contact'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-slate-700">
                          <i className="far fa-calendar-alt w-4 text-blue-500 mr-2"></i>
                          <span className="text-sm font-medium">
                            {meetingDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center text-slate-500 mt-1">
                          <i className="far fa-clock w-4 text-slate-400 mr-2"></i>
                          <span className="text-[11px]">
                            {meetingDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${isOnline ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                          <i className={`fas ${isOnline ? 'fa-video' : 'fa-location-dot'} mr-1.5`}></i>
                          {isOnline ? 'Digital Connect' : meeting.location || 'In Person'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={meeting.status || 'scheduled'}
                          onChange={(e) => handleStatusChange(meeting.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-blue-100 ${getStatusColor(meeting.status)}`}
                        >
                          <option value="scheduled" className="bg-white text-slate-800">Scheduled</option>
                          <option value="completed" className="bg-white text-slate-800">Completed</option>
                          <option value="cancelled" className="bg-white text-slate-800">Cancelled</option>
                          <option value="rescheduled" className="bg-white text-slate-800">Rescheduled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedMeetingId(meeting.id);
                              setMomText(meeting.outcome || meeting.notes || '');
                              setShowMOMModal(true);
                            }}
                            className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 flex items-center justify-center shadow-sm"
                            title="Minutes of Meeting"
                          >
                            <i className="fas fa-file-pen text-xs"></i>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMeeting(meeting);
                              setShowDetailsModal(true);
                            }}
                            className="w-8 h-8 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-800 hover:text-white transition-all border border-slate-200 flex items-center justify-center shadow-sm"
                            title="Details"
                          >
                            <i className="fas fa-eye text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 py-4 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Page <span className="font-semibold">{page}</span> · Showing{' '}
              <span className="font-semibold">{meetings.length}</span> record{meetings.length === 1 ? '' : 's'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNextPage}
                className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MOM Modal */}
      {showMOMModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-2">Update Minutes of Meeting (MOM)</h2>
            <p className="text-sm text-gray-500 mb-4">Record the outcome and next steps for this meeting.</p>
            <form onSubmit={handleUpdateMOM}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Meeting Outcome / MOM</label>
                <textarea
                  required
                  value={momText}
                  onChange={(e) => setMomText(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows="5"
                  placeholder="e.g. Client agreed to the proposal, next follow-up on Friday..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowMOMModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save & Complete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="bg-[#244bd8] px-5 py-4 text-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Meeting Details</h2>
                <p className="text-xs opacity-90 uppercase tracking-wider">Interaction Snapshot</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedMeeting(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
                title="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedMeeting.title || 'Untitled Meeting'}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {(selectedMeeting.meeting_type || 'general').replace('_', ' ').toUpperCase()}
                  </p>
                </div>
                {renderStatusBadge(selectedMeeting.status)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Client Entity</div>
                  <div className="font-semibold text-slate-900">{selectedMeeting.company_name || 'Personal Meeting'}</div>
                  <div className="text-slate-500">{selectedMeeting.contact_person || 'No contact assigned'}</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Schedule</div>
                  <div className="font-semibold text-slate-900">
                    {selectedMeeting.meeting_date
                      ? new Date(selectedMeeting.meeting_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '-'}
                  </div>
                  <div className="text-slate-500">
                    {selectedMeeting.meeting_date
                      ? new Date(selectedMeeting.meeting_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : '-'}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 md:col-span-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Venue / Link</div>
                  <div className="font-medium text-slate-900">{selectedMeeting.location || 'Not specified'}</div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 md:col-span-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Description</div>
                  <div className="text-slate-700 whitespace-pre-wrap">
                    {selectedMeeting.description || 'No description available'}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 md:col-span-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">MOM / Outcome</div>
                  <div className="text-slate-700 whitespace-pre-wrap">
                    {selectedMeeting.outcome || selectedMeeting.notes || 'No MOM recorded yet'}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedMeeting(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-white text-sm font-medium"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedMeeting(null);
                  setSelectedMeetingId(selectedMeeting.id);
                  setMomText(selectedMeeting.outcome || selectedMeeting.notes || '');
                  setShowMOMModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Update MOM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Modal */}
      {showModal && (
        <MeetingModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchMeetings();
            fetchSummary();
          }}
        />
      )}
    </div>
  );
}
