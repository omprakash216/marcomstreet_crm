import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';
import MeetingCalendar from '../components/MeetingCalendar';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { format, isValid } from 'date-fns';

const safeFormatDate = (dateStr, formatStr) => {
    if (!dateStr) return '---';
    try {
        const date = new Date(dateStr);
        if (!isValid(date)) return '---';
        return format(date, formatStr);
    } catch (e) {
        return '---';
    }
};

// Professional Icons using the same style as EmployeeDashboard
const IconTasks = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
);

const IconClock = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const IconMeeting = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const IconChat = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

const IconTrendingUp = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);

const IconArrowRight = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
);

const IconPalette = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
);

export default function DesignerDashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Get current employee info
    const employee = getEmployee();

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 300000); // 5 mins refresh
        return () => clearInterval(interval);
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const response = await api.get('/designer/dashboard');

            if (response.data && response.data.success) {
                setData(response.data.data);
                setLastUpdated(new Date());
            } else {
                setError(response.data?.message || 'Failed to load dashboard data');
            }
        } catch (err) {
            console.error('Error fetching designer dashboard:', err);
            setError('Failed to load dashboard data. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                    <p className="mt-4 text-gray-600 font-medium">Loading Design Workspace...</p>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="text-5xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{error}</h2>
                <button
                    onClick={fetchDashboardData}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
                >
                    Retry Loading
                </button>
            </div>
        );
    }

    const { stats = {}, recent_tasks = [], upcoming_deadlines = [], activities = [], trends = [] } = data || {};

    const defaultTrends = [
        { month: 'Jan', count: 0 }, { month: 'Feb', count: 0 }, { month: 'Mar', count: 0 },
        { month: 'Apr', count: 0 }, { month: 'May', count: 0 }, { month: 'Jun', count: 0 }
    ];
    const displayTrends = (trends && trends.length > 0) ? trends : defaultTrends;

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-500">

            {/* Professional Header Section (Matching EmployeeDashboard) */}
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}></div>
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                            <IconPalette />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-1 tracking-tight">
                                Design Workspace
                            </h1>
                            <p className="text-slate-300 font-medium flex items-center gap-2">
                                Welcome back, {employee?.name}! <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                System Healthy
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <button
                            onClick={fetchDashboardData}
                            disabled={loading}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
                        </button>
                        {lastUpdated && (
                            <div className="hidden sm:block text-right bg-white/10 backdrop-blur-md rounded-lg px-4 py-2 border border-white/10 text-white">
                                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Last Update</p>
                                <p className="text-sm font-bold">{safeFormatDate(lastUpdated, 'hh:mm:ss a')}</p>
                            </div>
                        )}
                    </div>
                </div>
                {/* Decorative background glass items */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-slate-500/10 rounded-full blur-3xl -ml-24 -mb-24" />
            </div>

            {/* Designer Quick Actions (Custom for Designer role) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <QuickActionButton
                    icon={<IconTasks />}
                    label="View My Tasks"
                    color="blue"
                    onClick={() => navigate('/tasks')}
                />
                <QuickActionButton
                    icon={<IconMeeting />}
                    label="Team Meetings"
                    color="indigo"
                    onClick={() => navigate('/meetings')}
                />
                <QuickActionButton
                    icon={<IconChat />}
                    label="Team Chat"
                    color="emerald"
                    onClick={() => navigate('/chat')}
                />
                <QuickActionButton
                    icon={<IconClock />}
                    label="Pending Items"
                    color="amber"
                    onClick={() => navigate('/tasks?filter=pending')}
                />
            </div>

            {/* Stats Overview - Clean Professional Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Active Tasks"
                    value={stats.active_tasks}
                    icon={<IconTasks />}
                    color="blue"
                    detail="In Progress"
                />
                <StatCard
                    title="Total Overdue"
                    value={stats.pending_items}
                    icon={<IconClock />}
                    color="amber"
                    detail="Action Needed"
                />
                <StatCard
                    title="Meetings"
                    value={stats.group_meetings}
                    icon={<IconMeeting />}
                    color="indigo"
                    detail="Scheduled Today"
                />
                <StatCard
                    title="Team Pulse"
                    value={stats.team_chat}
                    icon={<IconChat />}
                    color="emerald"
                    isStatus={true}
                    statusText="Live Chat"
                    detail="Unseen messages"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Productivity Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-md border border-gray-100 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Task Productivity</h2>
                            <p className="text-sm text-gray-500 font-medium">Overview of completed designs past 6 months</p>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <IconTrendingUp className="text-blue-600 w-6 h-6" />
                        </div>
                    </div>
                    <div className="h-[300px] flex flex-col justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={displayTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9', radius: 4 }}
                                    contentStyle={{
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        padding: '12px',
                                        backgroundColor: '#ffffff'
                                    }}
                                />
                                <Bar
                                    dataKey="count"
                                    fill="url(#barGradient)"
                                    radius={[4, 4, 0, 0]}
                                    barSize={32}
                                    name="Designs Completed"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Critical Deadlines */}
                <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900">Critical Deadlines</h2>
                        <div className="p-2 bg-rose-50 rounded-lg">
                            <IconClock className="text-rose-600 w-6 h-6" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-x-auto">
                        {upcoming_deadlines && upcoming_deadlines.length > 0 ? (
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50">
                                    <tr className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                        <th className="px-4 py-3">Task</th>
                                        <th className="px-4 py-3">Priority</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-sm">
                                    {upcoming_deadlines.map((task) => (
                                        <tr key={task.id} className="hover:bg-rose-50/10 transition-colors group">
                                            <td className="px-4 py-4">
                                                <div className="font-semibold text-gray-900 line-clamp-1">{task.title}</div>
                                                <div className="text-xs text-gray-500 font-medium">{safeFormatDate(task.due_date, 'MMM dd')}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${task.priority === 'urgent' ? 'bg-rose-100 text-rose-700' :
                                                    task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {task.priority || 'low'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right whitespace-nowrap">
                                                <button
                                                    onClick={() => navigate('/tasks')}
                                                    className="inline-flex items-center justify-center p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <IconArrowRight />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center py-10">
                                <span className="text-4xl mb-3">🎨</span>
                                <p className="text-gray-500 font-medium">No urgent design tasks</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                {/* Recent Assignments Table */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col max-h-[500px]">
                    <div className="p-6 border-b border-gray-50 flex items-center justify-between shrink-0 bg-white z-10">
                        <h2 className="text-lg font-bold text-gray-900">Recent Assignments</h2>
                        <button
                            onClick={() => navigate('/tasks')}
                            className="text-sm text-blue-600 font-semibold hover:text-blue-800 transition-colors"
                        >
                            View All
                        </button>
                    </div>
                    <div className="overflow-x-auto overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 sticky top-0 z-0">
                                <tr className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                    <th className="px-6 py-4">Design Task</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recent_tasks.map((task) => (
                                    <tr key={task.id} className="hover:bg-blue-50/10 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900 text-sm">{task.title}</div>
                                            <div className="text-xs text-gray-500 font-medium">{task.lead_company || 'Internal Project'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${task.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                {task.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => navigate('/tasks')}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-xs uppercase"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Activity Table */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col max-h-[500px]">
                    <div className="p-6 border-b border-gray-50 flex items-center justify-between shrink-0 bg-white z-10">
                        <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                        <div className="p-1.5 bg-blue-50 rounded-lg">
                        </div>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar">
                        <div className="divide-y divide-gray-100">
                            {activities.length > 0 ? (
                                activities.map((activity, idx) => (
                                    <div key={idx} className="p-4 hover:bg-gray-50 transition-colors flex items-start space-x-4">
                                        <div className="mt-1">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-50"></div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-gray-900">{activity.description}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {safeFormatDate(activity.date, 'MMM dd, HH:mm')}
                                            </p>
                                        </div>
                                        <span className="inline-flex items-center px-2 pt-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800 uppercase">
                                            {activity.type || 'Log'}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="px-6 py-12 text-center text-gray-400 font-medium italic">
                                    No recent activities recorded.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Clean, Professional Stat Card Component
function StatCard({ title, value, icon, color, detail, isStatus, statusText }) {
    const colorClasses = {
        blue: "border-blue-500 text-blue-600",
        amber: "border-amber-500 text-amber-600",
        indigo: "border-indigo-500 text-indigo-600",
        emerald: "border-emerald-500 text-emerald-600"
    };

    const bgClasses = {
        blue: "bg-blue-100",
        amber: "bg-amber-100",
        indigo: "bg-indigo-100",
        emerald: "bg-emerald-100"
    };

    return (
        <div className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-6 border-l-4 ${colorClasses[color].split(' ')[0]}`}>
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${bgClasses[color]}`}>
                    <div className={colorClasses[color].split(' ')[1]}>
                        {icon}
                    </div>
                </div>
                {isStatus && (
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100`}>
                        {statusText}
                    </span>
                )}
            </div>

            <div className="mb-2">
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-gray-900">{value || 0}</h3>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{detail}</span>
                <IconArrowRight className="text-gray-300" />
            </div>
        </div>
    );
}

function QuickActionButton({ icon, label, color, onClick }) {
    const colorStyles = {
        blue: 'hover:bg-blue-50 hover:border-blue-200 text-blue-600',
        indigo: 'hover:bg-indigo-50 hover:border-indigo-200 text-indigo-600',
        emerald: 'hover:bg-emerald-50 hover:border-emerald-200 text-emerald-600',
        amber: 'hover:bg-amber-50 hover:border-amber-200 text-amber-600',
    };

    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-200 ${colorStyles[color]} group`}
        >
            <div className="mb-2 transform group-hover:scale-110 transition-transform duration-200">
                {React.cloneElement(icon, { className: "w-6 h-6" })}
            </div>
            <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{label}</span>
        </button>
    );
}
