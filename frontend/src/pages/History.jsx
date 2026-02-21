import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function History() {
  const [whatsappLogs, setWhatsappLogs] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('⚠️ No token found, cannot fetch history data');
      setLoading(false);
      if (activeTab === 'whatsapp') {
        setWhatsappLogs([]);
      } else {
        setActivityLogs([]);
      }
      return;
    }
    
    setLoading(true);
    try {
      if (activeTab === 'whatsapp') {
        console.log('🔍 Fetching WhatsApp logs...');
        const response = await api.get('/whatsapp');
        console.log('📦 WhatsApp logs response:', {
          success: response.data?.success,
          dataLength: response.data?.data?.length || 0
        });
        const logs = Array.isArray(response.data.data) ? response.data.data : [];
        if (logs.length > 0) {
          console.log(`✅ Loaded ${logs.length} WhatsApp logs`);
        }
        setWhatsappLogs(logs);
      } else {
        // Try dedicated activities endpoint first, fallback to dashboard
        console.log('🔍 Fetching activity logs...');
        try {
          const response = await api.get('/activities?limit=100');
          console.log('📦 Activities response:', {
            success: response.data?.success,
            dataLength: response.data?.data?.length || 0
          });
          if (response.data.success) {
            const activities = Array.isArray(response.data.data) ? response.data.data : [];
            if (activities.length > 0) {
              console.log(`✅ Loaded ${activities.length} activity logs`);
            }
            setActivityLogs(activities);
          } else {
            console.warn('⚠️ Activities endpoint returned unsuccessful, trying dashboard...');
            // Fallback to dashboard
            const dashboardResponse = await api.get('/dashboard');
            const activities = dashboardResponse.data.data?.recent_activities || [];
            const activitiesArray = Array.isArray(activities) ? activities : [];
            console.log(`📊 Loaded ${activitiesArray.length} activities from dashboard`);
            setActivityLogs(activitiesArray);
          }
        } catch (activitiesError) {
          console.warn('⚠️ Activities endpoint failed, trying dashboard fallback...', {
            message: activitiesError.message,
            code: activitiesError.code
          });
          // If activities endpoint fails, try dashboard
          try {
            const dashboardResponse = await api.get('/dashboard');
            const activities = dashboardResponse.data.data?.recent_activities || [];
            const activitiesArray = Array.isArray(activities) ? activities : [];
            console.log(`📊 Loaded ${activitiesArray.length} activities from dashboard`);
            setActivityLogs(activitiesArray);
          } catch (dashboardError) {
            console.error('❌ Both activities and dashboard endpoints failed:', {
              activitiesError: activitiesError.message,
              dashboardError: dashboardError.message
            });
            // Both failed, set empty array
            setActivityLogs([]);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching history data:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        url: error.config?.url
      });
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('❌ Unexpected error details:', error);
      }
      if (activeTab === 'whatsapp') {
        setWhatsappLogs([]);
      } else {
        setActivityLogs([]);
      }
    } finally {
      setLoading(false);
    }
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
          <div className="flex items-center space-x-4">
            {/* Icon */}
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            {/* Title and Description */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1">History & Reports</h1>
              <p className="text-slate-300 text-sm">View complete activity history and generate reports</p>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'whatsapp'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            WhatsApp Logs
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'activity'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Activity Logs
          </button>
        </div>
      </div>

      {/* WhatsApp Logs */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SL No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading WhatsApp logs...</p>
                  </td>
                </tr>
              ) : whatsappLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No WhatsApp logs found</h3>
                    <p className="mt-1 text-sm text-gray-500">No WhatsApp interactions logged yet.</p>
                  </td>
                </tr>
              ) : (
                whatsappLogs.map((log, index) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-center font-medium text-gray-600">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(log.sent_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.company_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{log.phone_number}</td>
                    <td className="px-6 py-4">
                      <div className="max-w-md truncate">{log.message}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          log.status === 'read'
                            ? 'bg-green-100 text-green-800'
                            : log.status === 'delivered'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Activity Logs */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Table Headers - Always Visible */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SL No</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity Type</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Activity Logs Content */}
          <div className="p-6">
            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading activity logs...</p>
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No activity logs found</h3>
                <p className="mt-1 text-sm text-gray-500">No activities logged yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activityLogs.map((activity, index) => (
                  <div key={index} className="flex justify-between items-start py-3 border-b">
                    <div className="flex items-start gap-4">
                      <div className="text-sm font-medium text-gray-600 min-w-[3rem]">SL No: {index + 1}</div>
                      <div>
                        <div className="font-medium">{activity.activity_type}</div>
                        <div className="text-sm text-gray-600">{activity.description}</div>
                        {activity.entity_type && (
                          <div className="text-xs text-gray-500 mt-1">
                            {activity.entity_type} #{activity.entity_id}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(activity.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

