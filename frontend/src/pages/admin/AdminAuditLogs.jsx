import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await api.get('/admin/audit-logs');
      if (response.data.success) {
        setLogs(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Audit Logs</h1>
          <p className="text-sm text-gray-500">Monitor all API access and system activities</p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
        >
          Refresh Logs
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Endpoint</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Method</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">IP Address</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-4 text-center">Loading logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-4 text-center text-gray-500">No audit logs found</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(log.accessed_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{log.employee_name || 'System'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-[200px]" title={log.endpoint}>
                      {log.endpoint}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        log.method === 'POST' ? 'bg-green-100 text-green-700' :
                        log.method === 'PUT' ? 'bg-blue-100 text-blue-700' :
                        log.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {log.method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.ip_address}</td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        log.response_code >= 400 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {log.response_code}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

