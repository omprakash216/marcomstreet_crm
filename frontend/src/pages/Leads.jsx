import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import AIGuidance from '../components/AIGuidance';
import FollowupModal from '../components/FollowupModal';
import LeadModal from '../components/LeadModal';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    search: '',
    status: '',
    priority: '',
    date_filter: '', // today, week, month, custom
    date_from: '',
    date_to: '',
  });
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [followupLeadId, setFollowupLeadId] = useState(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLeads();
  }, [filter]);


  const fetchLeads = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('⚠️ No token found, cannot fetch leads');
      setLoading(false);
      setLeads([]);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filter.status) params.append('status', filter.status);
      if (filter.priority) params.append('priority', filter.priority);
      if (filter.search) params.append('search', filter.search);

      // Date filtering
      if (filter.date_filter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        params.append('date_from', today);
        params.append('date_to', today);
      } else if (filter.date_filter === 'week') {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
        params.append('date_from', weekStart.toISOString().split('T')[0]);
        params.append('date_to', weekEnd.toISOString().split('T')[0]);
      } else if (filter.date_filter === 'month') {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        params.append('date_from', monthStart.toISOString().split('T')[0]);
        params.append('date_to', monthEnd.toISOString().split('T')[0]);
      } else if (filter.date_filter === 'custom') {
        if (filter.date_from) params.append('date_from', filter.date_from);
        if (filter.date_to) params.append('date_to', filter.date_to);
      }

      // Add pagination for fast loading
      params.append('page', '1');
      params.append('limit', '50'); // Load 50 records at a time for fast loading

      const apiUrl = `/leads${params.toString() ? '?' + params.toString() : ''}`;
      console.log('🔍 Fetching leads from:', apiUrl);

      const startTime = performance.now(); // Track loading time
      const response = await api.get(apiUrl);
      const loadTime = performance.now() - startTime;

      // Show cache indicator
      if (response.data?.cached || response.headers['x-cache'] === 'HIT') {
        console.log(`✅ Leads loaded from cache - Fast! (${Math.round(loadTime)}ms)`);
      } else {
        console.log(`✅ Leads loaded fresh (${Math.round(loadTime)}ms)`);
      }

      console.log('📦 Leads API Response:', {
        success: response.data?.success,
        dataType: Array.isArray(response.data?.data) ? 'array' : typeof response.data?.data,
        dataLength: response.data?.data?.length || 0,
        count: response.data?.count,
        employee_id: response.data?.employee_id,
        cached: response.data?.cached || response.headers['x-cache'] === 'HIT'
      });

      // Ensure we have valid data
      if (!response.data) {
        console.error('❌ No response data received');
        setLeads([]);
        return;
      }

      if (!response.data.success) {
        console.warn('⚠️ Leads API returned unsuccessful response:', response.data);
        setLeads([]);
        return;
      }

      let leadsData = Array.isArray(response.data.data) ? response.data.data : [];

      // Log if we got data
      if (leadsData.length > 0) {
        console.log(`✅ Successfully loaded ${leadsData.length} leads from database (qualified leads excluded)`);
        console.log('📋 First lead:', leadsData[0]);
      } else {
        console.warn('⚠️ No leads found in response after filtering. Response data:', response.data);
      }

      // Don't apply client-side filtering if backend already filtered
      // Only apply if no backend filters were used
      const hasBackendFilters = filter.status || filter.priority || filter.search || filter.date_filter;

      if (!hasBackendFilters) {
        // Client-side filtering for date (if backend doesn't support)
        if (filter.date_from || filter.date_to) {
          leadsData = leadsData.filter(lead => {
            const createdDate = new Date(lead.created_at).toISOString().split('T')[0];
            if (filter.date_from && createdDate < filter.date_from) return false;
            if (filter.date_to && createdDate > filter.date_to) return false;
            return true;
          });
        }

        // Client-side search filtering
        if (filter.search) {
          const searchTerm = filter.search.toLowerCase();
          leadsData = leadsData.filter(lead => {
            return (
              (lead.company_name && lead.company_name.toLowerCase().includes(searchTerm)) ||
              (lead.contact_person && lead.contact_person.toLowerCase().includes(searchTerm)) ||
              (lead.email && lead.email.toLowerCase().includes(searchTerm)) ||
              (lead.phone && lead.phone.includes(searchTerm)) ||
              (lead.lead_code && lead.lead_code.toLowerCase().includes(searchTerm))
            );
          });
        }
      }

      console.log(`📊 Setting ${leadsData.length} leads to state`);
      setLeads(leadsData);
    } catch (error) {
      console.error('❌ Error fetching leads:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        fullUrl: error.config?.baseURL + error.config?.url
      });

      // Only log unexpected errors (not 401 or network errors)
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('❌ Unexpected error details:', error);
      }

      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilter({ ...filter, [field]: value });
  };

  const clearFilters = () => {
    setFilter({
      search: '',
      status: '',
      priority: '',
      date_filter: '',
      date_from: '',
      date_to: '',
    });
  };

  const handleStatusUpdate = async (leadId, newStatus) => {
    try {
      await api.put('/leads/update_status', {
        lead_id: leadId,
        status: newStatus,
      });
      fetchLeads();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleCall = (phone) => {
    window.open(`tel:${phone}`);
  };

  const handleWhatsApp = (phone) => {
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`);
  };

  const handleExport = () => {
    const token = localStorage.getItem('token');
    const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.BASE_URL || '');
    window.open(`${API_BASE_URL || ''}/api/leads/export?token=${encodeURIComponent(token || '')}`, '_blank');
  };

  const handleCreateLead = () => {
    setEditingLeadId(null);
    setShowLeadModal(true);
  };

  const handleEditLead = (leadId) => {
    setEditingLeadId(leadId);
    setShowLeadModal(true);
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete('/leads/crud', { data: { id: leadId } });
      if (response.data.success) {
        alert('Lead deleted successfully!');
        fetchLeads(); // Refresh the leads list
      } else {
        alert('Error: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Error deleting lead: ' + (error.response?.data?.message || error.message));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-gray-100 text-gray-800',
      contacted: 'bg-blue-100 text-blue-800',
      proposal: 'bg-yellow-100 text-yellow-800',
      negotiation: 'bg-orange-100 text-orange-800',
      won: 'bg-green-200 text-green-900',
      lost: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'text-gray-600',
      medium: 'text-blue-600',
      high: 'text-orange-600',
      urgent: 'text-red-600',
    };
    return colors[priority] || 'text-gray-600';
  };

  if (loading) {
    return <div className="text-center py-12">Loading leads...</div>;
  }

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
          <div className="flex items-center space-x-4">
            {/* Icon */}
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>

            {/* Title and Description */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1">Leads & Follow-ups</h1>
              <p className="text-slate-300 text-sm">Manage and track all your leads and follow-up activities</p>
            </div>
            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleCreateLead}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-600 rounded-lg border border-white hover:bg-blue-50 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create Lead</span>
              </button>
              <button
                onClick={handleExport}
                className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={filter.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search by company, contact, email..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filter.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={filter.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={filter.date_filter}
              onChange={(e) => handleFilterChange('date_filter', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {filter.date_filter === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
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

      {/* Leads Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          {/* Table Headers - Always Visible */}
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">SL No</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Company</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Status</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Value</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Score</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading leads...</p>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No leads found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {filter.search || filter.status || filter.priority || filter.date_filter
                        ? 'Try adjusting your filters to see more results.'
                        : 'Get started by creating your first lead.'}
                    </p>
                    {(filter.search || filter.status || filter.priority || filter.date_filter) && (
                      <div className="mt-6">
                        <button
                          onClick={clearFilters}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                          Clear Filters
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                leads.map((lead, index) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-center font-medium text-gray-600">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium">{lead.company_name}</div>
                      <div className="text-sm text-gray-500">{lead.lead_code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{lead.contact_person}</div>
                      <div className="text-sm text-gray-500">{lead.email}</div>
                      <div className="text-sm text-gray-500">{lead.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusUpdate(lead.id, e.target.value)}
                        className={`border rounded px-2 py-1 text-sm ${getStatusColor(lead.status)}`}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="proposal">Proposal</option>
                        <option value="negotiation">Negotiation</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-medium ${getPriorityColor(lead.priority)}`}>
                        {lead.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ₹{lead.estimated_value?.toLocaleString() || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${lead.lead_score}%` }}
                          />
                        </div>
                        <span className="text-sm">{lead.lead_score}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCall(lead.phone)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Call"
                        >
                          📞
                        </button>
                        <button
                          onClick={() => handleWhatsApp(lead.phone)}
                          className="text-green-600 hover:text-green-800"
                          title="WhatsApp"
                        >
                          💬
                        </button>
                        <button
                          onClick={() => navigate(`/meetings?lead_id=${lead.id}`)}
                          className="text-purple-600 hover:text-purple-800"
                          title="Log Meeting"
                        >
                          📅
                        </button>
                        <button
                          onClick={() => {
                            setFollowupLeadId(lead.id);
                            setShowFollowupModal(true);
                          }}
                          className="text-yellow-600 hover:text-yellow-800"
                          title="Schedule Follow-up"
                        >
                          📋
                        </button>
                        <button
                          onClick={() => setSelectedLeadId(lead.id)}
                          className="text-indigo-600 hover:text-indigo-800"
                          title="AI Guidance"
                        >
                          🤖
                        </button>
                        <button
                          onClick={() => handleEditLead(lead.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit Lead"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete Lead"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLeadId && (
        <AIGuidance
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      )}

      {showFollowupModal && (
        <FollowupModal
          leadId={followupLeadId}
          onClose={() => {
            setShowFollowupModal(false);
            setFollowupLeadId(null);
          }}
          onSuccess={() => {
            setShowFollowupModal(false);
            setFollowupLeadId(null);
            fetchLeads();
          }}
        />
      )}

      {showLeadModal && (
        <LeadModal
          showModal={showLeadModal}
          setShowModal={setShowLeadModal}
          leadId={editingLeadId}
          onSuccess={() => {
            setShowLeadModal(false);
            setEditingLeadId(null);
            fetchLeads();
          }}
        />
      )}
    </div>
  );
}

