import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';

export default function NotificationDropdown({ theme = 'dark', unreadCount = 0 }) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const dropdownRef = useRef(null);
    const employee = getEmployee();
    const hasToken = !!localStorage.getItem('token');
    const navigate = useNavigate();
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith('/admin');
    const notificationsPath = isAdminRoute ? '/admin/notifications' : '/notifications';
    const chatPath = isAdminRoute ? '/admin/chat' : '/chat';

    const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (!employee || !hasToken || !isOpen) return;

        let cancelled = false;

        const loadNotifications = async () => {
            try {
                const response = await api.get('/chat?action=notifications');
                if (!cancelled && response.data.success) {
                    setNotifications(response.data.data.slice(0, 5));
                }
            } catch (error) {
                if (error.response && error.response.status !== 401) {
                    console.error('Error fetching dropdown notifications:', error);
                }
            }
        };

        loadNotifications();
        const interval = setInterval(loadNotifications, 30000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [employee, hasToken, isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                className={`p-2 rounded-lg transition-all relative group ${
                    theme === 'light'
                        ? 'hover:bg-white/10 text-white/90 hover:text-white'
                        : 'hover:bg-gray-100'
                }`}
                title="Notifications"
            >
                <i className={`fas fa-bell text-lg transition-colors ${
                    theme === 'light'
                        ? 'text-white/90 group-hover:text-white'
                        : (isOpen ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-600')
                }`}></i>
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-1 ring-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white rounded-xl shadow-2xl border border-gray-100 z-[10000] overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-bold text-gray-800">Notifications</h3>
                        <Link to={notificationsPath} onClick={() => setIsOpen(false)} className="text-xs text-blue-600 hover:underline font-medium">
                            View All
                        </Link>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <i className="fas fa-bell-slash text-gray-200 text-3xl mb-2"></i>
                                <p className="text-sm text-gray-500">No new messages</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                         onClick={() => {
                                             setIsOpen(false);
                                             navigate(`${chatPath}?user_id=${notif.from_employee_id}`, { state: { selectedUserId: notif.from_employee_id } });
                                         }}
                                        className="flex items-start p-4 hover:bg-blue-50/50 transition-colors group cursor-pointer"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                                            {notif.from_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="ml-3 flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-semibold text-gray-900 truncate">{notif.from_name}</p>
                                                <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                                    {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">
                                                {notif.message}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t border-gray-50 bg-gray-50/30 text-center">
                        <Link
                            to={notificationsPath}
                            onClick={() => setIsOpen(false)}
                            className="text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors"
                        >
                            Open Notifications Page
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
