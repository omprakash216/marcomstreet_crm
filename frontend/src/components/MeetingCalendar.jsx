import { useState, useEffect } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    parseISO
} from 'date-fns';
import {
    MdChevronLeft,
    MdChevronRight,
    MdToday,
    MdLocationOn,
    MdAccessTime,
    MdFiberManualRecord
} from 'react-icons/md';
import api from '../utils/api';

const MeetingCalendar = ({ onMeetingClick }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchMeetings();
    }, [currentMonth]);

    const fetchMeetings = async () => {
        setLoading(true);
        try {
            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);

            const response = await api.get('/meetings', {
                params: {
                    date_from: format(monthStart, 'yyyy-MM-dd'),
                    date_to: format(monthEnd, 'yyyy-MM-dd'),
                    unlimited: true
                }
            });

            if (response.data.success) {
                setMeetings(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching calendar meetings:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 rounded-t-2xl">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-800">
                        {format(currentMonth, 'MMMM yyyy')}
                    </h2>
                    <button
                        onClick={() => setCurrentMonth(new Date())}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        <MdToday className="text-lg" />
                        Today
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                    >
                        <MdChevronLeft className="text-2xl" />
                    </button>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                    >
                        <MdChevronRight className="text-2xl" />
                    </button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return (
            <div className="grid grid-cols-7 bg-slate-50 border-b border-gray-100">
                {days.map((day, idx) => (
                    <div key={idx} className="py-3 text-sm font-bold text-slate-500 text-center uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;

        const getStatusColor = (status) => {
            switch (status?.toLowerCase()) {
                case 'scheduled': return 'text-blue-600 bg-blue-50 border-blue-100';
                case 'completed': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
                case 'cancelled': return 'text-rose-600 bg-rose-50 border-rose-100';
                default: return 'text-slate-600 bg-slate-50 border-slate-100';
            }
        };

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                const cloneDay = day;
                const dayMeetings = meetings.filter(m => isSameDay(parseISO(m.meeting_date), cloneDay));

                days.push(
                    <div
                        key={day.toString()}
                        className={`min-h-[140px] border-r border-b border-gray-100 p-2 transition-all hover:bg-slate-50/50 group ${!isSameMonth(day, monthStart) ? 'bg-gray-50/50' : 'bg-white'
                            } ${isSameDay(day, new Date()) ? 'relative' : ''}`}
                    >
                        {isSameDay(day, new Date()) && (
                            <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
                        )}

                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-sm font-bold flex items-center justify-center w-7 h-7 rounded-full transition-colors ${!isSameMonth(day, monthStart)
                                ? 'text-gray-300'
                                : isSameDay(day, new Date())
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}>
                                {format(day, 'd')}
                            </span>
                            {dayMeetings.length > 0 && (
                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                                    {dayMeetings.length} Msg
                                </span>
                            )}
                        </div>

                        <div className="space-y-1.5 overflow-hidden">
                            {dayMeetings.slice(0, 3).map((meeting, idx) => (
                                <div
                                    key={meeting.id}
                                    onClick={() => onMeetingClick && onMeetingClick(meeting)}
                                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${getStatusColor(meeting.status)}`}
                                >
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <MdFiberManualRecord className="text-[8px]" />
                                        <span className="truncate flex-1 font-bold">{meeting.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[9px] opacity-80">
                                        <MdAccessTime />
                                        {format(parseISO(meeting.meeting_date), 'hh:mm a')}
                                    </div>
                                    {meeting.employee_name && (
                                        <div className="mt-1 text-[9px] font-bold border-t border-current/10 pt-1 opacity-70">
                                            By: {meeting.employee_name}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {dayMeetings.length > 3 && (
                                <div className="text-[10px] text-center font-bold text-blue-600 py-1 hover:underline cursor-pointer">
                                    + {dayMeetings.length - 3} more
                                </div>
                            )}
                        </div>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="grid grid-cols-7" key={day.toString()}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="bg-white">{rows}</div>;
    };

    return (
        <div className="w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {renderHeader()}
            {renderDays()}
            <div className="relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg" />
                            <span className="text-sm font-bold text-slate-600">Updating Meetings...</span>
                        </div>
                    </div>
                )}
                {renderCells()}
            </div>
        </div>
    );
};

export default MeetingCalendar;
