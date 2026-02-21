import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';

export default function AdminApiIntegration() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const employee = getEmployee();
    if (!employee || employee.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/api-keys');
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load API data');
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async (companyId) => {
    try {
      setError('');
      setSuccess('');
      const response = await api.post('/admin/api-keys', { company_id: companyId });
      if (response.data.success) {
        setSuccess(`API Key generated: ${response.data.data.api_key}`);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate API key');
    }
  };

  const updateWebhook = async (companyId) => {
    try {
      setError('');
      setSuccess('');
      await api.put('/admin/api-keys', {
        company_id: companyId,
        webhook_url: webhookUrl
      });
      setSuccess('Webhook URL updated successfully!');
      setSelectedCompany(null);
      setWebhookUrl('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update webhook URL');
    }
  };

  const copyApiKey = (apiKey) => {
    navigator.clipboard.writeText(apiKey);
    setSuccess('API Key copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading API data...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-xl shadow-xl p-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
            <i className="fas fa-code text-white text-3xl"></i>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">API Integration</h1>
            <p className="text-blue-100 text-sm md:text-base">Manage API keys and webhooks for companies</p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-xl shadow-lg p-5 border border-blue-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Active API Keys</p>
              <p className="text-3xl font-bold text-gray-900">{data.statistics.activeApiKeys}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-key text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-xl shadow-lg p-5 border border-green-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Companies</p>
              <p className="text-3xl font-bold text-gray-900">{data.statistics.totalCompanies}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-building text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-purple-50/50 rounded-xl shadow-lg p-5 border border-purple-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Leads</p>
              <p className="text-3xl font-bold text-gray-900">
                {data.companies.reduce((sum, c) => sum + (parseInt(c.total_leads) || 0), 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-users text-white"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Companies API Keys Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 px-6 py-4 border-b border-gray-200/50">
          <h3 className="text-lg font-bold text-white flex items-center">
            <i className="fas fa-key mr-3"></i>
            Company API Keys
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Company</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">API Key</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Webhook URL</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Stats</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-900">{company.company_name}</div>
                    <div className="text-xs text-gray-500">{company.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    {company.api_key ? (
                      <div className="flex items-center space-x-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {company.api_key.substring(0, 20)}...
                        </code>
                        <button
                          onClick={() => copyApiKey(company.api_key)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Copy"
                        >
                          <i className="fas fa-copy"></i>
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No API Key</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-gray-600 max-w-xs truncate">
                      {company.webhook_url || 'Not set'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1">
                      <div>Leads: {company.total_leads || 0}</div>
                      <div>Meetings: {company.total_meetings || 0}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {!company.api_key && (
                        <button
                          onClick={() => generateApiKey(company.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                        >
                          Generate
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedCompany(company);
                          setWebhookUrl(company.webhook_url || '');
                        }}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                      >
                        Webhook
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhook Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Set Webhook URL</h2>
              <button
                onClick={() => {
                  setSelectedCompany(null);
                  setWebhookUrl('');
                }}
                className="text-white hover:text-gray-200"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company: {selectedCompany.company_name}
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setSelectedCompany(null);
                    setWebhookUrl('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateWebhook(selectedCompany.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

