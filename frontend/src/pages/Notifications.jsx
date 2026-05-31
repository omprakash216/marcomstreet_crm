import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('unread'); // 'unread' or 'all'
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [activeTab]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const includeRead = activeTab === 'all';
      const response = await api.get(`/chat?action=notifications&include_read=${includeRead}`);
      if (response.data.success) {
        setNotifications(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (fromUserId) => {
    try {
      // Fetching message details marks them as read in the database
      await api.get(`/chat?user_id=${fromUserId}`);
      // Refresh local list
      fetchNotifications();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      const response = await api.get('/chat?action=mark_all_read');
      if (response.data.success) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setMarkingAll(false);
    }
  };

  // Helper to format date nicely
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-[#2c86ab] to-[#1e607d] rounded-3xl shadow-xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h20v20H0V0zm10 17v-1.5M10 4.5V3M3 10h1.5M17 10h-1.5' stroke='rgba(255,255,255,0.08)' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundSize: "20px 20px"
          }}
        />
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-wide">NOTIFICATIONS</h1>
            <p className="text-xs sm:text-sm text-blue-100/90 mt-1 font-medium">
              Stay updated with team messages, tasks, and system activities.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchNotifications}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-all active:scale-95 flex items-center gap-2"
            >
              <i className={`fas fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
              Refresh
            </button>
            {activeTab === 'unread' && notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-all active:scale-95 shadow-md flex items-center gap-2"
              >
                <i className="fas fa-check-double"></i>
                {markingAll ? 'Clearing...' : 'Mark All Read'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-200 bg-white p-1.5 rounded-2xl shadow-sm">
        <button
          onClick={() => setActiveTab('unread')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'unread'
              ? 'bg-[#2c86ab] text-white shadow-md'
              : 'text-gray-600 hover:text-[#2c86ab] hover:bg-blue-50/50'
          }`}
        >
          <i className="fas fa-envelope-open-text"></i>
          Unread
          {activeTab === 'unread' && notifications.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-1">
              {notifications.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'all'
              ? 'bg-[#2c86ab] text-white shadow-md'
              : 'text-gray-600 hover:text-[#2c86ab] hover:bg-blue-50/50'
          }`}
        >
          <i className="fas fa-history"></i>
          Recent Alerts
        </button>
      </div>

      {/* Notifications List Container */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-4">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#2c86ab] border-t-transparent"></div>
            <p className="text-gray-500 font-medium text-sm">Fetching notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center max-w-sm mx-auto space-y-4">
            <div className="w-20 h-20 bg-blue-50 text-[#2c86ab] rounded-full flex items-center justify-center mx-auto shadow-inner">
              <i className="fas fa-bell-slash text-3xl"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">All caught up!</h3>
              <p className="text-xs text-gray-500 mt-1">
                {activeTab === 'unread' 
                  ? "You don't have any unread notifications right now."
                  : "No notifications history found."
                }
              </p>
            </div>
            {activeTab === 'unread' && (
              <button
                onClick={() => setActiveTab('all')}
                className="text-xs font-bold text-[#2c86ab] hover:underline"
              >
                View recent alert history
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-5 hover:bg-gray-50/80 transition-all flex items-start gap-4 ${
                  !notif.is_read ? 'bg-blue-50/15 border-l-4 border-[#2c86ab]' : ''
                }`}
              >
                {/* User Avatar */}
                <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-extrabold shadow-sm text-lg ${
                  !notif.is_read ? 'bg-gradient-to-br from-[#2c86ab] to-[#1e607d]' : 'bg-gray-400'
                }`}>
                  {notif.from_name ? notif.from_name.charAt(0).toUpperCase() : 'N'}
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1.5">
                    <h3 className={`text-sm font-bold ${!notif.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                      {notif.from_name}
                    </h3>
                    <span className="text-[11px] font-semibold text-gray-400">
                      {formatTime(notif.created_at)}
                    </span>
                  </div>
                  
                  <p className={`text-sm leading-relaxed ${!notif.is_read ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                    {notif.message}
                  </p>

                  {/* Attachment indicator if present */}
                  {notif.file_path && (
                    <div className="mt-2.5">
                      <a
                        href={`/${notif.file_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100/50 transition-colors"
                      >
                        <i className="fas fa-paperclip"></i>
                        {notif.file_name || 'Attachment File'}
                      </a>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center gap-4 mt-3">
                    <Link
                      to={`/chat?user_id=${notif.from_employee_id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2c86ab] hover:text-[#1e607d] transition-colors"
                    >
                      <i className="fas fa-reply"></i>
                      Reply in Chat
                    </Link>
                    {!notif.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(notif.from_employee_id)}
                        className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>

                {/* Unread Indicator Dot */}
                {!notif.is_read && (
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0 animate-ping mt-1"></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
