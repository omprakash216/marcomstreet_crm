import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';

export default function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const employee = getEmployee();

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            // In this system, notifications are primarily unread chat messages
            // We'll fetch all messages sent TO this user
            const response = await api.get('/chat?action=users');
            if (response.data.success) {
                const users = response.data.data;

                // Fetch messages from all users to compile a notification list
                // This is a simplified approach. In a real system, we'd have a dedicated notifications table.
                // For now, we'll compile messages from the chat API.

                let allMessages = [];
                for (const user of users) {
                    const msgResponse = await api.get(`/chat?user_id=${user.id}`);
                    if (msgResponse.data.success) {
                        const userMsgs = msgResponse.data.data.filter(m => m.to_employee_id === employee.id);
                        allMessages = [...allMessages, ...userMsgs.map(m => ({ ...m, from_name: user.name }))];
                    }
                }

                // Sort by date descending
                allMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                setNotifications(allMessages);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (fromUserId) => {
        try {
            // Fetching messages marks them as read
            await api.get(`/chat?user_id=${fromUserId}`);
            fetchNotifications();
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    return (
        <div className="p-6">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl shadow-xl p-8 mb-8 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">Notifications</h1>
                    <p className="opacity-90">Stay updated with your latest messages and alerts</p>
                </div>
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="font-semibold text-gray-700">Recent Messages</h2>
                    <button
                        onClick={fetchNotifications}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-500">Loading your notifications...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">All clear!</h3>
                        <p className="text-gray-500">You don't have any new notifications at the moment.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {notifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={`p-4 hover:bg-gray-50 transition-colors flex items-start space-x-4 ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                            >
                                <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold shadow-sm ${!notif.is_read ? 'bg-blue-600' : 'bg-gray-400'}`}>
                                    {notif.from_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className={`font-semibold truncate ${!notif.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                                            {notif.from_name}
                                        </h3>
                                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                            {new Date(notif.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className={`text-sm ${!notif.is_read ? 'text-gray-800' : 'text-gray-500'} line-clamp-2 mb-2`}>
                                        {notif.message}
                                    </p>
                                    {notif.file_path && (
                                        <div className="mb-2">
                                            <a
                                                href={`/${notif.file_path}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                                            >
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                </svg>
                                                {notif.file_name || 'Attachment'}
                                            </a>
                                        </div>
                                    )}
                                    <div className="flex space-x-3">
                                        <Link
                                            to={`/chat?user_id=${notif.from_employee_id}`}
                                            className="text-xs font-medium text-blue-600 hover:text-blue-700"
                                        >
                                            Reply in Chat
                                        </Link>
                                        {!notif.is_read && (
                                            <button
                                                onClick={() => markAsRead(notif.from_employee_id)}
                                                className="text-xs font-medium text-gray-400 hover:text-gray-600"
                                            >
                                                Mark as Read
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {!notif.is_read && (
                                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
