import { useState, useEffect } from 'react';
import api from '../utils/api';
import FollowupModal from '../components/FollowupModal';

export default function Followups() {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [followupModalMode, setFollowupModalMode] = useState('create');
  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRows, setTotalRows] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [filter, setFilter] = useState({
    search: '',
    status: '',
    type: '',
    date_filter: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    fetchFollowups();
  }, [filter, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = totalRows ? Math.min(startIndex + followups.length, totalRows) : 0;

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const fetchFollowups = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setFollowups([]);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.search) params.append('search', filter.search);
      if (filter.status) params.append('status', filter.status);
      if (filter.type) params.append('type', filter.type);
      if (filter.date_filter) params.append('date_filter', filter.date_filter);
      if (filter.date_from) params.append('date_from', filter.date_from);
      if (filter.date_to) params.append('date_to', filter.date_to);
      params.append('page', String(page));
      params.append('limit', String(pageSize));

      const response = await api.get(`/followups?${params.toString()}`);
      const rows = Array.isArray(response.data.data) ? response.data.data : [];
      const responseTotal = Number(response.data.total);
      setFollowups(rows);
      setHasNextPage(Boolean(response.data.has_next));
      setTotalRows(Number.isFinite(responseTotal) ? responseTotal : startIndex + rows.length + (response.data.has_next ? 1 : 0));
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching follow-ups:', error);
      }
      setFollowups([]);
      setTotalRows(0);
      setHasNextPage(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setPage(1);
    setFilter({ ...filter, [field]: value });
  };

  const clearFilters = () => {
    setPage(1);
    setFilter({
      search: '',
      status: '',
      type: '',
      date_filter: '',
      date_from: '',
      date_to: '',
    });
  };

  const openFollowupModal = (mode, followup = null) => {
    setFollowupModalMode(mode);
    setSelectedFollowup(followup);
    setShowModal(true);
  };

  const closeFollowupModal = () => {
    setShowModal(false);
    setSelectedFollowup(null);
    setFollowupModalMode('create');
  };

  const handleComplete = async (followupId) => {
    try {
      await api.put('/followups/update_status', {
        followup_id: followupId,
        status: 'completed',
      });
      fetchFollowups();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update follow-up');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      missed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTypeIcon = (type) => {
    const icons = {
      call: '📞',
      email: '📧',
      whatsapp: '💬',
      meeting: '📅',
      review: '🎨',
      feedback: '🔄',
      handover: '🏁',
      update: '📢',
      other: '📝',
    };
    return icons[type] || '📝';
  };

  const getTypeIconClass = (type) => {
    const icons = {
      call: 'fa-phone-volume',
      email: 'fa-envelope',
      whatsapp: 'fa-comments',
      meeting: 'fa-calendar-check',
      review: 'fa-palette',
      feedback: 'fa-rotate',
      handover: 'fa-flag-checkered',
      update: 'fa-bullhorn',
      other: 'fa-clipboard-list',
    };
    return icons[type] || 'fa-clipboard-list';
  };

  return (
    <div>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              {/* Title and Description */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-1">Follow-ups</h1>
                <p className="text-slate-300 text-sm">Track and manage all your follow-up activities</p>
              </div>
            </div>

            {/* Right Side - Action Button */}
            <button
              onClick={() => openFollowupModal('create')}
              className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl hover:bg-slate-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Schedule Follow-up</span>
            </button>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search Filter */}
          <div>
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              <i className="fas fa-search text-blue-500 w-4 text-center"></i>
              <span>Search Interaction</span>
            </label>
            <input
              type="text"
              value={filter.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Company or contact..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Interaction Type Filter */}
          <div>
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              <i className="fas fa-bullseye text-blue-500 w-4 text-center"></i>
              <span>Channel Type</span>
            </label>
            <select
              value={filter.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            >
              <option value="">All Channels</option>
              <option value="call">Voice Calls</option>
              <option value="email">Formal Emails</option>
              <option value="whatsapp">WhatsApp/Chat</option>
              <option value="meeting">Strategic Meetings</option>
              <option value="other">Other Operations</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              <i className="fas fa-filter text-blue-500 w-4 text-center"></i>
              <span>Execution State</span>
            </label>
            <select
              value={filter.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            >
              <option value="">All States</option>
              <option value="pending">Upcoming/Pending</option>
              <option value="completed">Action Finalized</option>
              <option value="missed">Schedule Missed</option>
              <option value="cancelled">Terminated</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              <i className="fas fa-calendar-alt text-blue-500 w-4 text-center"></i>
              <span>Timeline Window</span>
            </label>
            <select
              value={filter.date_filter}
              onChange={(e) => handleFilterChange('date_filter', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            >
              <option value="">All Timelines</option>
              <option value="today">Immediate (Today)</option>
              <option value="week">Current Cycle (Week)</option>
              <option value="month">Current Month</option>
              <option value="custom">Custom Parameters</option>
            </select>
          </div>

          {/* Metrics / Clear */}
          <div className="flex flex-col justify-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {filter.date_filter === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
            <div>
              <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">
                <i className="fas fa-calendar-day text-blue-500 w-4 text-center"></i>
                <span>Operation Start Date</span>
              </label>
              <input
                type="date"
                value={filter.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">
                <i className="fas fa-calendar-check text-blue-500 w-4 text-center"></i>
                <span>Operation End Date</span>
              </label>
              <input
                type="date"
                value={filter.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Follow-ups List */}
      <div className="bg-white rounded-[1.5rem] shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#244bd8] text-white font-black uppercase tracking-widest text-[10px]">
              <tr>
                <th className="px-6 py-4 text-left">SL No</th>
                <th className="px-6 py-4 text-left">Interaction Type</th>
                <th className="px-6 py-4 text-left">Company Entity</th>
                <th className="px-6 py-4 text-left">Point of Contact</th>
                <th className="px-6 py-4 text-left">Scheduled Timeline</th>
                <th className="px-6 py-4 text-left">Execution Status</th>
                <th className="px-6 py-4 text-left">Operational Notes</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Syncing CRM Data...</p>
                  </td>
                </tr>
              ) : followups.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="text-4xl mb-3 opacity-20">🕒</div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">No follow-ups recorded</h3>
                    <p className="text-xs text-slate-500 mt-1">Start by scheduling your first client interaction.</p>
                  </td>
                </tr>
              ) : (
                followups.map((followup, index) => (
                  <tr key={followup.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-400">
                      #{startIndex + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-sm">
                          <i className={`fas ${getTypeIconClass(followup.followup_type)}`}></i>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{followup.followup_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm">{followup.company_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-slate-700">{followup.contact_person}</div>
                      <div className="text-[10px] text-slate-400 font-medium flex items-center mt-0.5">
                        <i className="fas fa-phone-volume mr-1.5 w-4 text-center opacity-50"></i>
                        {followup.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-700">
                        {new Date(followup.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {new Date(followup.scheduled_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {followup.completed_date && (
                        <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-50 text-green-600 text-[9px] font-black uppercase mt-1">
                          Completed
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-sm ${getStatusColor(followup.status)}`}>
                        {followup.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[11px] text-slate-500 max-w-xs line-clamp-2 leading-relaxed">
                        {followup.notes || 'No operational notes attached'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2 min-w-max">
                        <button
                          onClick={() => openFollowupModal('view', followup)}
                          className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-600 hover:text-white transition-all shadow-sm border border-slate-100"
                          title="View Follow-up"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button
                          onClick={() => openFollowupModal('edit', followup)}
                          className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white transition-all shadow-sm border border-amber-100"
                          title="Edit Follow-up"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        {followup.status === 'pending' && (
                          <button
                            onClick={() => handleComplete(followup.id)}
                            className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-sm border border-green-100"
                            title="Mark as Completed"
                          >
                            <i className="fas fa-check"></i>
                          </button>
                        )}
                        {followup.phone && (
                          <button
                            onClick={() => window.open(`tel:${followup.phone}`)}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100"
                            title="Contact Client"
                          >
                            <i className="fas fa-phone-volume"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && totalRows > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center">
              <span>
                Showing <span className="font-semibold text-slate-700">{startIndex + 1}</span>-<span className="font-semibold text-slate-700">{endIndex}</span> of{' '}
                <span className="font-semibold text-slate-700">{totalRows}</span>
              </span>
              <label className="inline-flex items-center gap-2 font-semibold text-slate-600">
                Rows
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPage(1);
                    setPageSize(Number(event.target.value));
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                >
                  {[10, 25, 50].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="fas fa-chevron-left text-[10px]"></i>
                Previous
              </button>
              <div className="min-w-[92px] text-center text-sm text-slate-500">
                Page <span className="font-semibold text-slate-700">{safePage}</span> / <span className="font-semibold text-slate-700">{totalPages}</span>
              </div>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={!hasNextPage && safePage >= totalPages}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <i className="fas fa-chevron-right text-[10px]"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <FollowupModal
          mode={followupModalMode}
          followup={selectedFollowup}
          onClose={closeFollowupModal}
          onSuccess={() => {
            closeFollowupModal();
            fetchFollowups();
          }}
        />
      )}
    </div>
  );
}

