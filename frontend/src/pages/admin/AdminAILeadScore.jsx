import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';

export default function AdminAILeadScore() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const pageSize = 10;

  useEffect(() => {
    const employee = getEmployee();
    const role = normalizeRole(employee?.role);
    if (!employee || (role !== 'admin' && role !== 'superadmin' && role !== 'super_admin')) {
      navigate('/login');
      return;
    }
    fetchLeadScores();
  }, [navigate, statusFilter, scoreFilter, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, scoreFilter, searchQuery]);

  const fetchLeadScores = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (scoreFilter !== 'all') params.score = scoreFilter;
      if (searchQuery) params.search = searchQuery;
      
      const response = await api.get('/admin/ai-lead-score', { params });
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load lead scores');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-green-600 bg-green-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreRange = (score) => {
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  const leadsCount = Array.isArray(data?.leads) ? data.leads.length : 0;
  const totalPages = Math.max(1, Math.ceil(leadsCount / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lead scores...</p>
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

  const statistics = data.statistics || {};
  const leads = Array.isArray(data.leads) ? data.leads : [];
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedLeads = leads.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 rounded-xl shadow-xl p-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
            <i className="fas fa-robot text-white text-3xl"></i>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">AI Guidance Lead Score</h1>
            <p className="text-purple-100 text-sm md:text-base">AI-powered lead scoring and recommendations</p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-xl shadow-lg p-5 border border-blue-100/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Leads</p>
          <p className="text-3xl font-bold text-gray-900">{statistics.totalLeads || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-xl shadow-lg p-5 border border-green-100/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">High Score</p>
          <p className="text-3xl font-bold text-gray-900">{statistics.highScoreLeads || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-white to-yellow-50/50 rounded-xl shadow-lg p-5 border border-yellow-100/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Medium Score</p>
          <p className="text-3xl font-bold text-gray-900">{statistics.mediumScoreLeads || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-white to-red-50/50 rounded-xl shadow-lg p-5 border border-red-100/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Low Score</p>
          <p className="text-3xl font-bold text-gray-900">{statistics.lowScoreLeads || 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="text"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
          <select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Scores</option>
            <option value="high">High (70+)</option>
            <option value="medium">Medium (40-69)</option>
            <option value="low">Low (0-39)</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 px-6 py-4 border-b border-gray-200/50">
          <h3 className="text-lg font-bold text-white flex items-center">
            <i className="fas fa-list mr-3"></i>
            Lead Scores & Analysis
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SL</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Company</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Value</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">AI Score</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Grade</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm text-gray-500">
                    No leads found for selected filters.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead, index) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{startIndex + index + 1}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-900">{lead.company_name || lead.company_name_full}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{lead.contact_person}</div>
                    <div className="text-xs text-gray-500">{lead.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">{lead.assigned_employee_name || 'Unassigned'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      lead.status === 'won' ? 'bg-green-100 text-green-700' :
                      lead.status === 'lost' ? 'bg-red-100 text-red-700' :
                      lead.status === 'negotiation' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      lead.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                      lead.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      lead.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {lead.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">INR {parseFloat(lead.estimated_value || 0).toLocaleString('en-IN')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(lead.ai_score)}`}>
                        {lead.ai_score}
                      </span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        getScoreRange(lead.ai_score) === 'High' ? 'bg-green-100 text-green-700' :
                        getScoreRange(lead.ai_score) === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {getScoreRange(lead.ai_score)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                      {lead.ai_grade}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedLead(lead)}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                    >
                      View
                    </button>
                  </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {leads.length > 0 ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 py-4 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold">{Math.min(startIndex + 1, leads.length)}</span>–
              <span className="font-semibold">{Math.min(startIndex + paginatedLeads.length, leads.length)}</span> of{' '}
              <span className="font-semibold">{leads.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="px-3 py-2 text-sm font-semibold text-gray-700">
                Page {safePage} / {totalPages}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Lead Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between sticky top-0">
              <h2 className="text-xl font-bold text-white">Lead Details & AI Analysis</h2>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-white hover:text-gray-200"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Score Range Indicator */}
              <div className="flex items-center justify-center mb-4">
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  getScoreRange(selectedLead.ai_score) === 'High' ? 'bg-green-100 text-green-700' :
                  getScoreRange(selectedLead.ai_score) === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  Score Range: {getScoreRange(selectedLead.ai_score)} ({selectedLead.ai_score >= 70 ? '70-100' : selectedLead.ai_score >= 40 ? '40-69' : '0-39'})
                </span>
              </div>

              {/* Score Circle */}
              <div className="flex items-center justify-center mb-6">
                <div className="relative w-24 h-24">
                  <svg className="transform -rotate-90 w-24 h-24">
                    <circle cx="48" cy="48" r="40" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke={selectedLead.ai_score >= 70 ? '#10b981' : selectedLead.ai_score >= 40 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${(selectedLead.ai_score / 100) * 251.2} 251.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getScoreColor(selectedLead.ai_score).split(' ')[0]}`}>
                        {selectedLead.ai_score}
                      </div>
                      <div className="text-xs text-gray-500">Grade {selectedLead.ai_grade}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lead Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Company</label>
                  <p className="text-sm font-semibold text-gray-900">{selectedLead.company_name || selectedLead.company_name_full}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Contact Person</label>
                  <p className="text-sm text-gray-900">{selectedLead.contact_person}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Email</label>
                  <p className="text-sm text-gray-900">{selectedLead.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Phone</label>
                  <p className="text-sm text-gray-900">{selectedLead.phone || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
                  <p className="text-sm text-gray-900">{selectedLead.status}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Priority</label>
                  <p className="text-sm text-gray-900">{selectedLead.priority}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Estimated Value</label>
                  <p className="text-sm text-gray-900">INR {parseFloat(selectedLead.estimated_value || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Assigned To</label>
                  <p className="text-sm text-gray-900">{selectedLead.assigned_employee_name || 'Unassigned'}</p>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Breakdown</h3>
                <div className="space-y-2">
                  {selectedLead.ai_factors && selectedLead.ai_factors.map((factor, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">{factor.name}</span>
                      <span className="text-sm font-semibold text-gray-900">{factor.score}/{factor.max}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Recommendations */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">AI Recommendations</h3>
                <div className="space-y-2">
                  {selectedLead.ai_recommendations && selectedLead.ai_recommendations.map((rec, index) => (
                    <div key={index} className={`p-3 rounded-lg ${
                      rec.type === 'success' ? 'bg-green-50 border border-green-200' :
                      rec.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                      rec.type === 'danger' ? 'bg-red-50 border border-red-200' :
                      'bg-blue-50 border border-blue-200'
                    }`}>
                      <div className="flex items-start space-x-2">
                        <i className={`fas ${rec.icon} mt-1 ${
                          rec.type === 'success' ? 'text-green-600' :
                          rec.type === 'warning' ? 'text-yellow-600' :
                          rec.type === 'danger' ? 'text-red-600' :
                          'text-blue-600'
                        }`}></i>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                          <p className="text-xs text-gray-600 mt-1">{rec.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Score Range Legend */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Range Indicators</h3>
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">High (70-100): Excellent potential, prioritize immediately</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-gray-600">Medium (40-69): Good potential, needs nurturing</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-gray-600">Low (0-39): Requires significant effort</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


