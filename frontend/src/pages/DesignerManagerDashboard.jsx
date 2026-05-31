import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, LineChart, Line
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

// Icons tailored for Designer Manager
const IconBriefcase = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);

const IconUsers = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const IconClipboardCheck = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
);

const IconSparkles = () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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

export default function DesignerManagerDashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const employee = getEmployee();

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 300000); // 5 mins
        return () => clearInterval(interval);
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const response = await api.get('/designer-manager/dashboard');

            if (response.data && response.data.success) {
                setData(response.data.data);
                setLastUpdated(new Date());
                setError(null);
            } else {
                setError(response.data?.message || 'Failed to load dashboard data');
            }
        } catch (err) {
            console.error('Error fetching designer manager dashboard:', err);
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
                    <p className="mt-4 text-gray-600 font-medium">Loading Management Workspace...</p>
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

    const {
        stats = {},
        productivity_trends = [],
        project_progress = [],
        recent_assignments = [],
        recent_activities = [],
        critical_deadlines = []
    } = data || {};

    const defaultTrends = [
        { month: 'Jan', count: 0 }, { month: 'Feb', count: 0 }, { month: 'Mar', count: 0 },
        { month: 'Apr', count: 0 }, { month: 'May', count: 0 }, { month: 'Jun', count: 0 }
    ];
    const displayTrends = (productivity_trends && productivity_trends.length > 0) ? productivity_trends : defaultTrends;

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-500">

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Design Operations</h2>
                <button
                    onClick={fetchDashboardData}
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-500 transition-all font-semibold"
                >
                    <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                </button>
            </div>

            {/* TOP SECTION: Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Active Projects"
                    value={stats.active_projects || 0}
                    icon={<IconBriefcase />}
                    color="blue"
                    detail="Currently executing"
                />
                <StatCard
                    title="Team Workload"
                    value={stats.team_workload || 0}
                    icon={<IconUsers />}
                    color="indigo"
                    detail="Tasks assigned"
                />
                <StatCard
                    title="Pending Reviews"
                    value={stats.pending_reviews || 0}
                    icon={<IconClipboardCheck />}
                    color="amber"
                    detail="Awaiting approval"
                />
                <StatCard
                    title="Design Requests"
                    value={stats.design_requests || 0}
                    icon={<IconSparkles />}
                    color="emerald"
                    detail="New incoming requests"
                />
            </div>

            {/* MIDDLE SECTION: Charts & Progress */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Task Productivity Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-md border border-gray-100 flex flex-col hover:shadow-lg transition-shadow duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Task Productivity</h2>
                            <p className="text-sm text-gray-500 font-medium">Design output over the last 6 months</p>
                        </div>
                    </div>
                    <div className="h-[320px] w-full flex-grow">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={displayTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="barGradientMgr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#312e81" stopOpacity={1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                                        padding: '12px',
                                        backgroundColor: '#ffffff'
                                    }}
                                />
                                <Bar
                                    dataKey="count"
                                    fill="url(#barGradientMgr)"
                                    radius={[6, 6, 0, 0]}
                                    barSize={40}
                                    name="Designs Completed"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Project Progress & Time Tracking */}
                <div className="flex flex-col gap-6">
                    {/* Project Progress */}
                    <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 flex-1 hover:shadow-lg transition-shadow duration-300">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">Project Progress</h2>
                        <p className="text-xs text-gray-500 mb-5">Current design initiative completion rates</p>
                        
                        <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {project_progress && project_progress.length > 0 ? (
                                project_progress.map((project, idx) => (
                                    <div key={idx}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold text-gray-700">{project.name}</span>
                                            <span className="text-blue-600 font-bold">{project.progress}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                            <div 
                                                className={`h-2.5 rounded-full ${project.progress > 80 ? 'bg-emerald-500' : project.progress > 40 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                                                style={{ width: `${project.progress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-400 italic text-center py-4">No active major projects.</p>
                            )}
                        </div>
                    </div>

                    {/* Time Tracking / Hours Summary */}
                    <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Time Tracking</h2>
                            <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-md">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                        </div>
                        <div className="flex justify-between items-end border-b border-gray-100 pb-3 mb-3">
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Team Hours Logged Today</p>
                                <p className="text-2xl font-bold text-gray-900">32<span className="text-sm font-semibold text-gray-500">h</span> 45<span className="text-sm font-semibold text-gray-500">m</span></p>
                            </div>
                            <div className="text-right">
                                <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">+4% vs avg</span>
                            </div>
                        </div>
                        <button onClick={() => navigate('/hrms/attendance')} className="w-full py-2.5 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors">
                            View Detailed Timesheets
                        </button>
                    </div>
                </div>
            </div>

            {/* BOTTOM SECTION: Tables & Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Recent Assignments (Col Span 1) */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 min-h-[400px] flex flex-col hover:shadow-lg transition-shadow duration-300">
                    <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-white z-10 sticky top-0">
                        <h2 className="text-base font-bold text-gray-900">Recent Assignments</h2>
                        <button onClick={() => navigate('/tasks')} className="text-xs text-blue-600 font-bold uppercase tracking-wider hover:text-blue-800">
                            View All
                        </button>
                    </div>
                    <div className="px-5 py-3 overflow-y-auto flex-1 custom-scrollbar">
                        <div className="space-y-4">
                            {recent_assignments && recent_assignments.length > 0 ? (
                                recent_assignments.map((task) => (
                                    <div key={task.id} className="group border border-gray-100 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                                        <p className="text-sm font-bold text-gray-800 mb-1 line-clamp-1">{task.title}</p>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">{(task.assigned_to || 'U').charAt(0)}</div>
                                                {task.assigned_to || 'Unassigned'}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded text-white font-bold uppercase ${
                                                task.status === 'completed' ? 'bg-emerald-500' :
                                                task.status === 'in_progress' ? 'bg-blue-500' :
                                                task.status === 'under_review' ? 'bg-amber-500' : 'bg-gray-400'
                                            }`}>
                                                {task.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-center py-6 text-gray-400">No recent assignments.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Critical Deadlines (Col Span 1) */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 min-h-[400px] flex flex-col hover:shadow-lg transition-shadow duration-300">
                    <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-white z-10 sticky top-0">
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                             <h2 className="text-base font-bold text-gray-900">Critical Deadlines</h2>
                        </div>
                    </div>
                    <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
                        {critical_deadlines && critical_deadlines.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {critical_deadlines.map((task) => (
                                    <div key={task.id} className="p-4 flex flex-col gap-1.5 hover:bg-rose-50/30 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-bold text-gray-900 leading-tight">{task.title}</p>
                                            <span className="px-2 py-1 bg-rose-100 text-rose-700 text-[10px] uppercase font-bold rounded">
                                                {task.priority}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Due: {safeFormatDate(task.due_date, 'MMM dd, yyyy')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 h-full gap-3 text-gray-400">
                                <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-sm font-medium">All clear! No critical deadlines.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activities (Col Span 1) */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 min-h-[400px] flex flex-col hover:shadow-lg transition-shadow duration-300">
                    <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-white z-10 sticky top-0">
                        <h2 className="text-base font-bold text-gray-900">Recent Activities</h2>
                    </div>
                    <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
                        <div className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                            {recent_activities && recent_activities.length > 0 ? (
                                recent_activities.map((activity, idx) => (
                                    <div key={idx} className="relative pl-5">
                                        <div className="absolute -left-[9px] top-1">
                                            <div className="w-4 h-4 rounded-full bg-slate-400 ring-4 ring-white shadow-sm border border-slate-300 flex items-center justify-center"></div>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-800 font-medium">{activity.description}</p>
                                            <p className="text-[11px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">{safeFormatDate(activity.date, 'MMM dd, hh:mm a')}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-400 pl-4 py-2 italic font-medium">No activity logged.</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
}

// Reusable Stat Card Component (Tailwind styled appropriately)
function StatCard({ title, value, icon, color, detail }) {
    const colorClasses = {
        blue: "border-blue-500 text-blue-600 bg-blue-100/50 hover:border-blue-600 transition",
        amber: "border-amber-500 text-amber-600 bg-amber-100/50 hover:border-amber-600 transition",
        indigo: "border-indigo-500 text-indigo-600 bg-indigo-100/50 hover:border-indigo-600 transition",
        emerald: "border-emerald-500 text-emerald-600 bg-emerald-100/50 hover:border-emerald-600 transition",
        gray: "border-slate-500 text-slate-600 bg-slate-100/50 hover:border-slate-600 transition"
    };
    
    const iconColors = {
        blue: "text-blue-600",
        amber: "text-amber-600",
        indigo: "text-indigo-600",
        emerald: "text-emerald-600",
        gray: "text-slate-600"
    };

    return (
        <div className={`bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 p-6 border-b-4 ${colorClasses[color]} flex flex-col justify-between`}>
            <div className="flex items-start justify-between mb-2">
                <div>
                   <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{title}</p>
                   <h3 className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl bg-white shadow-sm border border-gray-100 ${iconColors[color]}`}>
                    {icon}
                </div>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold text-gray-400 mt-2">
                <span className="truncate pr-2">{detail}</span>
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white shadow-sm">
                    <IconArrowRight />
                </span>
            </div>
        </div>
    );
}
