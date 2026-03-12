import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';
import ExcelJS from 'exceljs';

const defaultApiPayload = {
  company_name: 'New Lead Corp',
  contact_person: 'John Doe',
  email: 'john@example.com',
  phone: '9876543210',
  priority: 'high',
  notes: 'Imported via API test',
};

export default function AdminApiIntegration() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [integrationStats, setIntegrationStats] = useState({
    total_api_calls: 0,
    successful_requests: 0,
    failed_requests: 0,
    total_imported_leads: 0,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [preparedLeads, setPreparedLeads] = useState([]);
  const [fileImportError, setFileImportError] = useState('');
  const [apiTestCompany, setApiTestCompany] = useState(null);
  const [apiTestPayload, setApiTestPayload] = useState(JSON.stringify(defaultApiPayload, null, 2));
  const [apiTestResponse, setApiTestResponse] = useState(null);
  const [apiTestError, setApiTestError] = useState('');
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
        setIntegrationStats(response.data.data.integrationStats || integrationStats);
        const firstWithKey = (response.data.data.companies || []).find((company) => company.api_key);
        setApiTestCompany(firstWithKey || (response.data.data.companies || [])[0] || null);
        if (!selectedCompany) {
          setSelectedCompany(firstWithKey || (response.data.data.companies || [])[0] || null);
        }
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

  const normalizeColumns = (row = {}) => {
    const normalized = {};
    Object.entries(row).forEach(([key, value]) => {
      const normalizedKey = String(key || '').trim().toLowerCase().replace(/\s+/g, '_');
      normalized[normalizedKey] = value;
    });
    return normalized;
  };

  const mapToLeadPayload = (row) => {
    const normalized = normalizeColumns(row);
    return {
      company_name: normalized.company_name || normalized.company || '',
      contact_person: normalized.contact_person || normalized.contact || '',
      email: normalized.email || normalized.contact_email || '',
      phone: normalized.phone || normalized.mobile || '',
      priority: normalized.priority || 'medium',
      notes: normalized.notes || normalized.remark || '',
    };
  };

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).filter((ln) => ln.trim());
    if (!lines.length) return [];
    const headers = lines[0].split(',').map((cell) => cell.trim());
    return lines.slice(1).map((line) => {
      const parts = line.split(',');
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = parts[idx] ? parts[idx].trim() : '';
      });
      return row;
    });
  };

  const parseExcelFile = async (file) => {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    const headerRow = sheet.getRow(1);
    const headers = headerRow.values.slice(1).map((val) => String(val || '').trim());
    const rows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values.slice(1);
      const rowObj = {};
      headers.forEach((header, idx) => {
        rowObj[header || `col_${idx}`] = values[idx] ? String(values[idx]).trim() : '';
      });
      if (Object.values(rowObj).some((val) => val && val !== '')) rows.push(rowObj);
    });
    return rows;
  };

  const parseFileLeads = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'json') {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (Array.isArray(payload)) return payload;
      if (payload.leads) return payload.leads;
      return [payload];
    }
    if (ext === 'csv') {
      const text = await file.text();
      return parseCsv(text);
    }
    if (ext === 'xls' || ext === 'xlsx') {
      return parseExcelFile(file);
    }
    throw new Error('Unsupported file format');
  };

  const handleFileSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImportPreview([]);
    setPreparedLeads([]);
    setFileImportError('');
    setImportFileName(file.name);
    setImporting(true);
    try {
      const rows = await parseFileLeads(file);
      const leads = rows.map(mapToLeadPayload);
      setImportPreview(leads.slice(0, 10));
      setPreparedLeads(leads);
      setImportResult({ prepared: leads.length });
      setImportFileName(file.name);
    } catch (err) {
      setFileImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (!apiTestCompany?.api_key) {
      setFileImportError('Select a company with an API key before importing.');
      return;
    }
    if (!preparedLeads.length) {
      setFileImportError('No parsed leads found. Upload a valid file.');
      return;
    }
    setImporting(true);
    setFileImportError('');
    try {
      const response = await api.post('/external/leads/batch', { leads: preparedLeads, file_name: importFileName }, {
        headers: { 'X-API-KEY': apiTestCompany.api_key },
      });
      setImportResult(response.data.data);
      setSuccess('Import completed. Refreshing stats...');
      await fetchData();
      setImportPreview([]);
      setPreparedLeads([]);
      setImportFileName('');
    } catch (err) {
      setFileImportError(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleApiTest = async () => {
    if (!apiTestCompany?.api_key) {
      setApiTestError('Select a company with an API key to test.');
      return;
    }
    setApiTestError('');
    setApiTestResponse(null);
    try {
      const payload = JSON.parse(apiTestPayload);
      const response = await api.post('/external/leads', payload, {
        headers: { 'X-API-KEY': apiTestCompany.api_key },
      });
      setApiTestResponse(JSON.stringify(response.data, null, 2));
      setApiTestError('');
    } catch (err) {
      setApiTestError(err.response?.data?.message || 'Test request failed');
    }
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

      {/* Integration Monitoring */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total API Requests', value: integrationStats.total_api_calls, icon: 'fas fa-bolt' },
          { label: 'Successful Requests', value: integrationStats.successful_requests, icon: 'fas fa-check-circle' },
          { label: 'Failed Requests', value: integrationStats.failed_requests, icon: 'fas fa-times-circle' },
          { label: 'Imported Leads', value: integrationStats.total_imported_leads, icon: 'fas fa-file-import' },
        ].map((card) => (
          <div key={card.label} className="bg-white p-5 rounded-xl shadow-lg border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{card.label}</p>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            </div>
            <div className="text-gray-400 text-2xl">
              <i className={card.icon}></i>
            </div>
          </div>
        ))}
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

      {/* API Endpoint & Logic Information */}
      <div className="bg-white rounded-xl shadow-lg border border-blue-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
          <h3 className="text-lg font-bold text-white flex items-center">
            <i className="fas fa-plug mr-3"></i>
            API Documentation & Endpoint
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 border rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <p className="text-blue-700 font-bold mb-1 uppercase text-xs">Primary Endpoint (POST):</p>
            <p className="text-gray-900 break-all select-all">
              {window.location.origin.replace('5175', '3000')}/api/external/leads
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-bold text-gray-800 flex items-center">
                <i className="fas fa-shield-alt mr-2 text-blue-500"></i> Authentication
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Include the header <code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600">X-API-KEY</code> with your generated company key in all requests.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-gray-800 flex items-center">
                <i className="fas fa-database mr-2 text-indigo-500"></i> Request Body (JSON)
              </h4>
              <pre className="text-[10px] bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                {`{
  "company_name": "New Lead Corp",
  "contact_person": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "priority": "high",
  "notes": "Interested in CRM"
}`}
              </pre>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-600">
              <i className="fas fa-exclamation-triangle text-xs"></i>
              <span className="text-[10px] font-bold uppercase">Note: Replace localhost:3000 with your server IP for production.</span>
            </div>
            <button
              onClick={() => navigate('/admin/leads')}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              View Incoming Leads <i className="fas fa-arrow-right ml-1"></i>
            </button>
          </div>
        </div>
      </div>

      {/* File Import */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
          <h3 className="text-lg font-bold text-white flex items-center">
            <i className="fas fa-file-upload mr-3"></i>
            Import Leads (CSV, JSON, Excel)
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <input
              type="file"
              accept=".csv,.json,.xls,.xlsx"
              onChange={handleFileSelection}
              className="border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm w-full md:w-auto cursor-pointer"
            />
            <button
              onClick={handleImport}
              disabled={importing || !preparedLeads.length || !apiTestCompany?.api_key}
              className="px-5 py-3 bg-green-600 text-white rounded-xl shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : 'Import Leads'}
            </button>
            {importFileName && <span className="text-sm text-gray-500 truncate">{importFileName}</span>}
          </div>
          {fileImportError && <p className="text-sm text-red-600">{fileImportError}</p>}
          {importResult && (
            <div className="text-sm text-gray-700">
              Imported: {importResult.success_count ?? preparedLeads.length} / {preparedLeads.length} leads
              {importResult.failure_count ? `, failed: ${importResult.failure_count}` : ''}
            </div>
          )}
          {importPreview.length > 0 && (
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 mb-2">Preview (max 10 rows):</p>
              <div className="text-[10px] font-mono max-h-40 overflow-y-auto">
                {importPreview.map((row, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-gray-500">{idx + 1}.</span>
                    <span>{row.company_name || row.company || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* API Test */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
          <h3 className="text-lg font-bold text-white flex items-center">
            <i className="fas fa-terminal mr-3"></i>
            API Testing Tool
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Company</label>
              <select
                value={apiTestCompany?.id || ''}
                onChange={(e) => {
                  const company = data.companies.find((c) => String(c.id) === e.target.value);
                  setApiTestCompany(company || null);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm"
              >
                <option value="">Select company (requires API key)</option>
                {data.companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name} {company.api_key ? '• API key ready' : '• no key'}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">JSON payload</label>
              <textarea
                rows={6}
                value={apiTestPayload}
                onChange={(e) => setApiTestPayload(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-xs font-mono"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleApiTest}
              className="px-5 py-3 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700 disabled:opacity-50"
            >
              Send Test Request
            </button>
            {apiTestError && <p className="text-sm text-red-600">{apiTestError}</p>}
          </div>
          {apiTestResponse && (
            <pre className="bg-gray-900 text-green-200 text-[10px] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">
              {apiTestResponse}
            </pre>
          )}
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

