import { useState, useEffect } from 'react';
import api from '../utils/api';
import * as XLSX from 'xlsx';

export default function ClientHistory() {
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showLogModal, setShowLogModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [teamMembers, setTeamMembers] = useState([]);
    const [selectedTeamMember, setSelectedTeamMember] = useState(null);
    const [shareSearchQuery, setShareSearchQuery] = useState('');
    const [activityFormData, setActivityFormData] = useState({
        client_name: '',
        company_name: '',
        activity_type: 'call',
        description: '',
        notes: '',
        outcome: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    });
    const [history, setHistory] = useState([
        {
            id: 1,
            client: 'James Taylor',
            company: 'Innovation Labs',
            email: 'james@innovation.com',
            phone: '+91 98765 43210',
            source: 'LinkedIn',
            event: 'Contract Renewed',
            date: 'January 14, 2026',
            time: '02:00 PM',
            location: 'New York Office',
            status: 'Completed',
            type: 'Contract',
            user: 'Admin',
            notes: 'Renewal signed for 24 months with a 10% volume discount.',
            outcome: 'Successfully closed the deal with a $50k annual recurring revenue.'
        },
        {
            id: 2,
            client: 'Sarah Wilson',
            company: 'Apex Innovations',
            email: 'sarah@apex.io',
            phone: '+91 88877 66554',
            source: 'Website',
            event: 'Follow-up Call',
            date: '2023-10-24',
            time: '11:00 AM',
            location: 'Remote',
            status: 'Missed',
            type: 'Call',
            user: 'Vicky Sharma',
            notes: 'Lead didn\'t answer. Left a voicemail regarding the new feature set.',
            outcome: 'No outcome recorded'
        },
        {
            id: 3,
            client: 'David Chen',
            company: 'Creative Labs',
            email: 'david@creativelabs.in',
            phone: '+91 77665 54433',
            source: 'Referral',
            event: 'Discovery Session',
            date: '2023-10-22',
            time: '03:30 PM',
            location: 'Zoom Meeting',
            status: 'Completed',
            type: 'Meeting',
            user: 'Gagnesh Bhardwaj',
            notes: 'Successful session. Client is interested in the Advanced Analytics module.',
            outcome: 'Scheduled a demo for next week.'
        },
    ]);
    const [filter, setFilter] = useState({
        search: '',
        status: '',
        date_filter: '',
        date_from: '',
        date_to: '',
    });

    const handleFilterChange = (field, value) => {
        setFilter({ ...filter, [field]: value });
    };

    const clearFilters = () => {
        setFilter({
            search: '',
            status: '',
            date_filter: '',
            date_from: '',
            date_to: '',
        });
    };

    const filteredHistory = history.filter(item => {
        const matchesSearch = item.client.toLowerCase().includes(filter.search.toLowerCase()) ||
            item.event.toLowerCase().includes(filter.search.toLowerCase());
        const matchesStatus = filter.status === '' || item.status === filter.status;
        const matchesDate = (filter.date_from === '' || item.date >= filter.date_from) &&
            (filter.date_to === '' || item.date <= filter.date_to);
        return matchesSearch && matchesStatus && matchesDate;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'Completed': return 'bg-green-100 text-green-800';
            case 'Pending': return 'bg-yellow-100 text-yellow-800';
            case 'Missed': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const openDetails = (item) => {
        setSelectedItem(item);
        setShowModal(true);
    };

    const handleLogActivity = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                activity_type: activityFormData.activity_type,
                description: `${activityFormData.client_name} (${activityFormData.company_name}) - ${activityFormData.description}`,
                notes: activityFormData.notes,
                outcome: activityFormData.outcome
            };
            const response = await api.post('/activities/create', payload);
            if (response.data.success) {
                alert('Activity logged successfully!');
                setShowLogModal(false);
                setActivityFormData({
                    client_name: '',
                    company_name: '',
                    activity_type: 'call',
                    description: '',
                    notes: '',
                    outcome: '',
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                });
            }
        } catch (error) {
            console.error('Error logging activity:', error);
            alert('Failed to log activity.');
        } finally {
            setLoading(false);
        }
    };

    // Fetch team members for sharing
    useEffect(() => {
        fetchTeamMembers();
    }, []);

    const fetchTeamMembers = async () => {
        try {
            const response = await api.get('/chat?action=users');
            if (response.data.success) {
                setTeamMembers(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching team members:', error);
        }
    };

    // Export to Excel
    const handleExportExcel = () => {
        const exportData = filteredHistory.map(item => ({
            'Client Name': item.client,
            'Company': item.company,
            'Email': item.email,
            'Phone': item.phone,
            'Event': item.event,
            'Type': item.type,
            'Status': item.status,
            'Date': item.date,
            'Time': item.time,
            'Location': item.location,
            'User': item.user,
            'Notes': item.notes,
            'Outcome': item.outcome
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Client History');

        const timestamp = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Client_History_${timestamp}.xlsx`);
    };

    // Share via team chat
    const handleShareToChat = async () => {
        if (!selectedTeamMember || !selectedItem) return;

        try {
            const shareMessage = `📊 *Client History Shared*\n\n` +
                `👤 Client: ${selectedItem.client}\n` +
                `🏢 Company: ${selectedItem.company}\n` +
                `📧 Email: ${selectedItem.email}\n` +
                `📞 Phone: ${selectedItem.phone}\n` +
                `📅 Event: ${selectedItem.event}\n` +
                `📆 Date: ${selectedItem.date} at ${selectedItem.time}\n` +
                `📍 Location: ${selectedItem.location}\n` +
                `✅ Status: ${selectedItem.status}\n` +
                `📝 Notes: ${selectedItem.notes}\n` +
                `🎯 Outcome: ${selectedItem.outcome}`;

            const response = await api.post('/chat', {
                to_employee_id: selectedTeamMember.id,
                message: shareMessage
            });

            if (response.data.success) {
                alert(`Successfully shared with ${selectedTeamMember.name}!`);
                setShowShareModal(false);
                setSelectedTeamMember(null);
                setShareSearchQuery('');
            }
        } catch (error) {
            console.error('Error sharing to chat:', error);
            alert('Failed to share. Please try again.');
        }
    };

    const filteredTeamMembers = teamMembers.filter(member =>
        member.name.toLowerCase().includes(shareSearchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(shareSearchQuery.toLowerCase())
    );

    return (
        <div>
            {/* Standardized Header Section */}
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}></div>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg text-white">
                            <i className="fas fa-history text-2xl"></i>
                        </div>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-white mb-1">Client History</h1>
                            <p className="text-slate-300 text-sm">Manage and track all client interaction and engagement logs</p>
                        </div>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowLogModal(true)}
                                className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-600 rounded-lg border border-white hover:bg-blue-50 transition-all font-medium"
                            >
                                <i className="fas fa-plus-circle"></i>
                                <span>Log Activity</span>
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all font-medium"
                            >
                                <i className="fas fa-file-excel"></i>
                                <span>Export Excel</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Standardized Filters Section */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                        <input
                            type="text"
                            value={filter.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            placeholder="Search by client or event..."
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                            value={filter.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Statuses</option>
                            <option value="Completed">Completed</option>
                            <option value="Pending">Pending</option>
                            <option value="Missed">Missed</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date Type</label>
                        <select
                            value={filter.date_filter}
                            onChange={(e) => handleFilterChange('date_filter', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Dates</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                        <input
                            type="date"
                            value={filter.date_from}
                            onChange={(e) => handleFilterChange('date_from', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={clearFilters}
                            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Standardized Table Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SL No</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client & Company</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Details</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredHistory.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                    No records found matching your criteria.
                                </td>
                            </tr>
                        ) : (
                            filteredHistory.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">{index + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-gray-900">{item.client}</div>
                                        <div className="text-xs text-gray-500">{item.company}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-700">{item.event}</div>
                                        <div className="text-xs text-gray-400">{item.date} • {item.time}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-bold">{item.user}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => openDetails(item)}
                                                className="text-blue-600 hover:text-blue-800 transition-colors p-2 bg-blue-50 rounded-lg"
                                                title="View Details"
                                            >
                                                <i className="fas fa-eye text-sm"></i>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedItem(item);
                                                    setShowShareModal(true);
                                                }}
                                                className="text-green-600 hover:text-green-800 transition-colors p-2 bg-green-50 rounded-lg"
                                                title="Send to Team Member"
                                            >
                                                <i className="fas fa-paper-plane text-sm"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Professional Modal (Leads Standard) */}
            {showModal && selectedItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[1.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
                        {/* Modal Header */}
                        <div className="bg-[#244bd8] p-5 text-white flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                    <i className="far fa-calendar-alt text-2xl"></i>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold leading-tight">Meeting Details</h2>
                                    <p className="text-[11px] opacity-80 decoration-blue-300">View complete meeting information</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200 transition-colors">
                                <i className="fas fa-times text-xl"></i>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Top Grid Boxes */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[#eff6ff] p-4 rounded-xl border border-blue-100 flex items-start space-x-3">
                                    <i className="fas fa-user mt-1 text-blue-600 text-sm"></i>
                                    <div>
                                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-0.5">CLIENT / LEAD</p>
                                        <p className="text-sm font-bold text-slate-800">{selectedItem.client}</p>
                                    </div>
                                </div>
                                <div className="bg-[#f5f3ff] p-4 rounded-xl border border-purple-100 flex items-start space-x-3">
                                    <i className="fas fa-building mt-1 text-purple-600 text-sm"></i>
                                    <div>
                                        <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-0.5">COMPANY</p>
                                        <p className="text-sm font-bold text-slate-800">{selectedItem.company}</p>
                                    </div>
                                </div>
                                <div className="bg-[#f0fdf4] p-4 rounded-xl border border-green-100 flex items-start space-x-3">
                                    <i className="far fa-calendar mt-1 text-green-600 text-sm"></i>
                                    <div>
                                        <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-0.5">DATE</p>
                                        <p className="text-sm font-bold text-slate-800">{selectedItem.date}</p>
                                    </div>
                                </div>
                                <div className="bg-[#fff7ed] p-4 rounded-xl border border-orange-100 flex items-start space-x-3">
                                    <i className="far fa-clock mt-1 text-orange-600 text-sm"></i>
                                    <div>
                                        <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-0.5">TIME</p>
                                        <p className="text-sm font-bold text-slate-800">{selectedItem.time}</p>
                                    </div>
                                </div>
                                <div className="bg-[#eef2ff] p-4 rounded-xl border border-indigo-100 flex items-start space-x-3">
                                    <i className="fas fa-map-marker-alt mt-1 text-indigo-600 text-sm"></i>
                                    <div>
                                        <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-0.5">LOCATION</p>
                                        <p className="text-sm font-bold text-slate-800">{selectedItem.location || '-'}</p>
                                    </div>
                                </div>
                                <div className="bg-[#f8fafc] p-4 rounded-xl border border-slate-200 flex items-start space-x-3 shadow-sm">
                                    <i className="fas fa-info-circle mt-1 text-slate-500 text-sm"></i>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">STATUS</p>
                                        <span className={`px-4 py-1.5 rounded-full border text-[10px] font-bold ${selectedItem.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                            {selectedItem.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Notes Section */}
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <i className="fas fa-sticky-note text-amber-500"></i>
                                    <h4 className="text-sm font-bold text-slate-700">Notes</h4>
                                </div>
                                <div className="bg-[#fffce8] p-5 rounded-xl border border-yellow-200 text-slate-600 font-medium text-sm leading-relaxed min-h-[60px]">
                                    {selectedItem.notes || 'No notes recorded'}
                                </div>
                            </div>

                            {/* Outcome Section */}
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <i className="fas fa-check-circle text-emerald-500"></i>
                                    <h4 className="text-sm font-bold text-slate-700">Outcome</h4>
                                </div>
                                <div className="bg-[#effdf5] p-5 rounded-xl border border-green-200 text-slate-600 font-medium text-sm leading-relaxed min-h-[60px]">
                                    {selectedItem.outcome || 'No outcome recorded'}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-[#f8fafc] p-4 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-slate-700 rounded-lg font-bold text-xs flex items-center space-x-2 transition-all"
                            >
                                <i className="fas fa-times text-[10px]"></i>
                                <span>Close</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Professional Log Activity Modal */}
            {showLogModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[1.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
                        {/* Modal Header */}
                        <div className="bg-[#244bd8] p-5 text-white flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                    <i className="fas fa-edit text-2xl"></i>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold leading-tight">Log New Activity</h2>
                                    <p className="text-[11px] opacity-80 uppercase tracking-widest font-black">Record Interaction History</p>
                                </div>
                            </div>
                            <button onClick={() => setShowLogModal(false)} className="text-white hover:text-gray-200 transition-colors">
                                <i className="fas fa-times text-xl"></i>
                            </button>
                        </div>

                        <form onSubmit={handleLogActivity} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 ml-1">Client/Lead Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={activityFormData.client_name}
                                        onChange={(e) => setActivityFormData({ ...activityFormData, client_name: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        placeholder="Enter client name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 ml-1">Company Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={activityFormData.company_name}
                                        onChange={(e) => setActivityFormData({ ...activityFormData, company_name: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        placeholder="Enter company name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 ml-1">Activity Type</label>
                                    <select
                                        value={activityFormData.activity_type}
                                        onChange={(e) => setActivityFormData({ ...activityFormData, activity_type: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    >
                                        <option value="call">Phone Call</option>
                                        <option value="meeting">Discovery Meeting</option>
                                        <option value="email">Email Correspodence</option>
                                        <option value="contract">Contract Negotiation</option>
                                        <option value="support">Technical Support</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 ml-1">Date & Time</label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="date"
                                            value={activityFormData.date}
                                            onChange={(e) => setActivityFormData({ ...activityFormData, date: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        />
                                        <input
                                            type="time"
                                            value={activityFormData.time}
                                            onChange={(e) => setActivityFormData({ ...activityFormData, time: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 ml-1">Event Description</label>
                                    <input
                                        type="text"
                                        required
                                        value={activityFormData.description}
                                        onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        placeholder="e.g. Discovery session regarding Zenith Phase 2"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Detailed Notes</label>
                                    <textarea
                                        rows="2"
                                        value={activityFormData.notes}
                                        onChange={(e) => setActivityFormData({ ...activityFormData, notes: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        placeholder="Enter detailed observation notes..."
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Session Outcome</label>
                                    <textarea
                                        rows="2"
                                        value={activityFormData.outcome}
                                        onChange={(e) => setActivityFormData({ ...activityFormData, outcome: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        placeholder="What was the final result or next step?"
                                    ></textarea>
                                </div>
                            </div>

                            {/* Action Footer */}
                            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowLogModal(false)}
                                    className="px-6 py-2.5 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-8 py-2.5 bg-[#244bd8] hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                                >
                                    <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-save"}></i>
                                    <span>{loading ? 'Logging...' : 'Securely Log Activity'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Team Member Share Modal */}
            {showShareModal && selectedItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[1.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
                        {/* Modal Header */}
                        <div className="bg-[#10b981] p-5 text-white flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                    <i className="fas fa-share-alt text-2xl"></i>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold leading-tight">Share via Team Chat</h2>
                                    <p className="text-[11px] opacity-80 uppercase tracking-widest font-black">Send to Team Member</p>
                                </div>
                            </div>
                            <button onClick={() => {
                                setShowShareModal(false);
                                setSelectedTeamMember(null);
                                setShareSearchQuery('');
                            }} className="text-white hover:text-gray-200 transition-colors">
                                <i className="fas fa-times text-xl"></i>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Search Team Members */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Search Team Member</label>
                                <div className="relative">
                                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                    <input
                                        type="text"
                                        value={shareSearchQuery}
                                        onChange={(e) => setShareSearchQuery(e.target.value)}
                                        placeholder="Search by name or email..."
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Team Members List */}
                            <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
                                {filteredTeamMembers.length === 0 ? (
                                    <p className="text-center text-slate-400 py-8 text-sm">No team members found</p>
                                ) : (
                                    filteredTeamMembers.map(member => (
                                        <button
                                            key={member.id}
                                            onClick={() => setSelectedTeamMember(member)}
                                            className={`w-full p-3 rounded-xl border-2 transition-all text-left ${selectedTeamMember?.id === member.id
                                                    ? 'border-green-500 bg-green-50'
                                                    : 'border-slate-200 bg-white hover:border-green-300 hover:bg-green-50/50'
                                                }`}
                                        >
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-black text-sm border border-green-200">
                                                    {member.name.charAt(0)}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-slate-800">{member.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{member.role} • {member.department || 'No Dept'}</p>
                                                </div>
                                                {selectedTeamMember?.id === member.id && (
                                                    <i className="fas fa-check-circle text-green-500"></i>
                                                )}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>

                            {/* Selected Item Preview */}
                            {selectedTeamMember && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Sharing Details</p>
                                    <div className="space-y-1 text-xs">
                                        <p><span className="font-bold text-slate-700">Client:</span> {selectedItem.client}</p>
                                        <p><span className="font-bold text-slate-700">Event:</span> {selectedItem.event}</p>
                                        <p><span className="font-bold text-slate-700">Date:</span> {selectedItem.date}</p>
                                    </div>
                                </div>
                            )}

                            {/* Action Footer */}
                            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowShareModal(false);
                                        setSelectedTeamMember(null);
                                        setShareSearchQuery('');
                                    }}
                                    className="px-6 py-2.5 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleShareToChat}
                                    disabled={!selectedTeamMember}
                                    className="px-8 py-2.5 bg-[#10b981] hover:bg-green-700 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <i className="fas fa-paper-plane"></i>
                                    <span>Send to Chat</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
