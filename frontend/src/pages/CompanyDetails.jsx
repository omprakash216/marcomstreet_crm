import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';

export default function CompanyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [leads, setLeads] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const employee = getEmployee();
    if (!employee) {
      navigate('/login');
      return;
    }
    fetchCompanyDetails();
  }, [id, navigate]);

  const fetchCompanyDetails = async () => {
    try {
      setLoading(true);
      const [companyRes, leadsRes, meetingsRes, quotationsRes] = await Promise.all([
        api.get(`/companies/${id}`),
        api.get(`/companies/${id}/leads`),
        api.get(`/companies/${id}/meetings`),
        api.get(`/companies/${id}/quotations`)
      ]);

      if (companyRes.data.success) {
        setCompany(companyRes.data.data);
        setLeads(leadsRes.data.success ? leadsRes.data.data : []);
        setMeetings(meetingsRes.data.success ? meetingsRes.data.data : []);
        setQuotations(quotationsRes.data.success ? quotationsRes.data.data : []);

        // Calculate statistics
        setStatistics({
          totalLeads: leadsRes.data.data?.length || 0,
          totalMeetings: meetingsRes.data.data?.length || 0,
          totalQuotations: quotationsRes.data.data?.length || 0,
          activeLeads: leadsRes.data.data?.filter(lead => lead.status !== 'lost').length || 0,
          wonLeads: leadsRes.data.data?.filter(lead => lead.status === 'won').length || 0,
          totalValue: quotationsRes.data.data?.reduce((sum, q) => sum + (parseFloat(q.total_amount) || 0), 0) || 0
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load company details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'won': return 'bg-green-100 text-green-700';
      case 'lost': return 'bg-red-100 text-red-700';
      case 'negotiation': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading company details...</p>
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

  if (!company) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-xl shadow-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg hover:bg-white/30 transition-colors"
            >
              <i className="fas fa-arrow-left text-white text-xl"></i>
            </button>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{company.company_name}</h1>
              <p className="text-blue-100 text-sm md:text-base">Company Details & Analytics</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              company.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {company.status}
            </span>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-xl shadow-lg p-5 border border-blue-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Leads</p>
              <p className="text-3xl font-bold text-gray-900">{statistics.totalLeads}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-users text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-xl shadow-lg p-5 border border-green-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Active Leads</p>
              <p className="text-3xl font-bold text-gray-900">{statistics.activeLeads}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-check-circle text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-purple-50/50 rounded-xl shadow-lg p-5 border border-purple-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Won Deals</p>
              <p className="text-3xl font-bold text-gray-900">{statistics.wonLeads}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-trophy text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-orange-50/50 rounded-xl shadow-lg p-5 border border-orange-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Value</p>
              <p className="text-3xl font-bold text-gray-900">₹{statistics.totalValue.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-rupee-sign text-white"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {[
              { id: 'overview', label: 'Overview', icon: 'fas fa-building' },
              { id: 'leads', label: 'Leads', icon: 'fas fa-users' },
              { id: 'meetings', label: 'Meetings', icon: 'fas fa-calendar' },
              { id: 'quotations', label: 'Quotations', icon: 'fas fa-file-invoice' }
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Company Information */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <i className="fas fa-info-circle mr-2 text-blue-600"></i>
                  Company Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Company Name:</span>
                    <span className="text-sm font-medium text-gray-900">{company.company_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="text-sm font-medium text-gray-900">{company.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Phone:</span>
                    <span className="text-sm font-medium text-gray-900">{company.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Website:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {company.website ? (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {company.website}
                        </a>
                      ) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Client Code:</span>
                    <span className="text-sm font-medium text-gray-900">{company.client_code || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tax ID:</span>
                    <span className="text-sm font-medium text-gray-900">{company.tax_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Registration:</span>
                    <span className="text-sm font-medium text-gray-900">{company.registration_number || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <i className="fas fa-map-marker-alt mr-2 text-green-600"></i>
                  Address Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Address:</span>
                    <p className="text-sm font-medium text-gray-900 mt-1">{company.address || 'N/A'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">City:</span>
                      <p className="text-sm font-medium text-gray-900 mt-1">{company.city || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">State:</span>
                      <p className="text-sm font-medium text-gray-900 mt-1">{company.state || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Country:</span>
                      <p className="text-sm font-medium text-gray-900 mt-1">{company.country || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">ZIP Code:</span>
                      <p className="text-sm font-medium text-gray-900 mt-1">{company.zip_code || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leads Tab */}
          {activeTab === 'leads' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Company Leads ({leads.length})</h3>
                <button
                  onClick={() => navigate('/leads')}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  View All Leads
                </button>
              </div>
              {leads.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {leads.slice(0, 10).map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{lead.company_name || lead.company_name_full}</div>
                            <div className="text-sm text-gray-500">{lead.lead_code}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{lead.contact_person}</div>
                            <div className="text-sm text-gray-500">{lead.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                              {lead.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(lead.priority)}`}>
                              {lead.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            ₹{parseFloat(lead.estimated_value || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => navigate(`/leads/${lead.id}`)}
                              className="text-blue-600 hover:text-blue-900 text-sm"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="fas fa-users text-gray-400 text-3xl mb-4"></i>
                  <p className="text-gray-500">No leads found for this company</p>
                </div>
              )}
            </div>
          )}

          {/* Meetings Tab */}
          {activeTab === 'meetings' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Company Meetings ({meetings.length})</h3>
                <button
                  onClick={() => navigate('/meetings')}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  View All Meetings
                </button>
              </div>
              {meetings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {meetings.slice(0, 9).map((meeting) => (
                    <div key={meeting.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900">{meeting.title}</h4>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          meeting.status === 'completed' ? 'bg-green-100 text-green-700' :
                          meeting.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {meeting.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div><i className="fas fa-calendar mr-1"></i>{new Date(meeting.date).toLocaleDateString()}</div>
                        <div><i className="fas fa-clock mr-1"></i>{meeting.time}</div>
                        <div><i className="fas fa-user mr-1"></i>{meeting.employee_name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="fas fa-calendar text-gray-400 text-3xl mb-4"></i>
                  <p className="text-gray-500">No meetings found for this company</p>
                </div>
              )}
            </div>
          )}

          {/* Quotations Tab */}
          {activeTab === 'quotations' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Company Quotations ({quotations.length})</h3>
                <button
                  onClick={() => navigate('/quotations')}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  View All Quotations
                </button>
              </div>
              {quotations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quote #</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {quotations.slice(0, 10).map((quotation) => (
                        <tr key={quotation.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{quotation.quote_number}</div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            ₹{parseFloat(quotation.total_amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              quotation.status === 'approved' ? 'bg-green-100 text-green-700' :
                              quotation.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              quotation.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {quotation.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(quotation.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => navigate(`/quotations/${quotation.id}`)}
                              className="text-blue-600 hover:text-blue-900 text-sm"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="fas fa-file-invoice text-gray-400 text-3xl mb-4"></i>
                  <p className="text-gray-500">No quotations found for this company</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}