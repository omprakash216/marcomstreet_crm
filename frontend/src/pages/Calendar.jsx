import { useState } from 'react';
import MeetingCalendar from '../components/MeetingCalendar';
import { MdEventNote } from 'react-icons/md';

export default function Calendar() {
    const [selectedMeeting, setSelectedMeeting] = useState(null);

    const handleMeetingClick = (meeting) => {
        setSelectedMeeting(meeting);
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-6">
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-2xl shadow-lg p-8 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                        backgroundSize: '40px 40px'
                    }}></div>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center space-x-5">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-2xl border border-white/20">
                            <MdEventNote className="text-white text-3xl" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-white leading-tight tracking-tight">Meeting Calendar</h1>
                            <p className="text-slate-300 text-sm font-medium">Consolidated view of all upcoming and past meetings</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <MeetingCalendar onMeetingClick={handleMeetingClick} />
            </div>

            {/* Detail Popup/Modal could go here if selectedMeeting is set */}
            {selectedMeeting && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800">Meeting Details</h3>
                            <button
                                onClick={() => setSelectedMeeting(null)}
                                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all"
                            >
                                X
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Title</label>
                                <div className="text-lg font-bold text-slate-900">{selectedMeeting.title}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Company</label>
                                    <div className="font-bold text-blue-600">{selectedMeeting.company_name || 'N/A'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Status</label>
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${selectedMeeting.status === 'scheduled' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                            selectedMeeting.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                'bg-slate-50 text-slate-600 border-slate-100'
                                        }`}>
                                        {selectedMeeting.status}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Time</label>
                                <div className="text-slate-700 font-medium">
                                    {new Date(selectedMeeting.meeting_date).toLocaleString('en-IN', {
                                        dateStyle: 'full',
                                        timeStyle: 'short'
                                    })}
                                </div>
                            </div>
                            {selectedMeeting.description && (
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Description</label>
                                    <div className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                                        "{selectedMeeting.description}"
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setSelectedMeeting(null)}
                                className="px-6 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

