import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

function SubscriptionRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/subscriptions/requests');
            if (res.data.success) {
                setRequests(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching requests', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleUpdateStatus = async (id, status) => {
        if (!window.confirm(`Are you sure you want to mark this as ${status}?`)) return;
        try {
            const res = await api.patch(`/superadmin/subscriptions/requests/${id}`, { approval_status: status });
            if (res.data.success) {
                fetchRequests();
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Error updating status');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-2xl shadow-xl mb-6 p-6">
                <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/10 text-white">
                        <i className="fas fa-envelope-open-text text-2xl"></i>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Subscription Requests</h1>
                        <p className="text-slate-300 text-sm">Review and approve new company registrations</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">SL No</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Company Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Contact</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Selected Plan</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Payment Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Approval</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="7" className="text-center py-8 text-gray-500">Loading...</td></tr>
                            ) : requests.length === 0 ? (
                                <tr><td colSpan="7" className="text-center py-8 text-gray-500">No requests found.</td></tr>
                            ) : (
                                requests.map((req, index) => (
                                    <tr key={req.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-500">{(index + 1).toString().padStart(2, '0')}</td>
                                        <td className="px-6 py-4 font-semibold text-gray-800">{req.company_name}</td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-medium">{req.email}</p>
                                            <p className="text-xs text-gray-500">{req.phone}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm">{req.plan_name || `Plan #${req.selected_plan}`}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${req.payment_status === 'success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {req.payment_status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${req.approval_status === 'approved' ? 'bg-green-100 text-green-700' : req.approval_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {req.approval_status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {req.approval_status === 'pending' && (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleUpdateStatus(req.id, 'approved')} className="p-2 text-green-600 bg-green-50 rounded hover:bg-green-100">
                                                        <i className="fas fa-check"></i>
                                                    </button>
                                                    <button onClick={() => handleUpdateStatus(req.id, 'rejected')} className="p-2 text-red-600 bg-red-50 rounded hover:bg-red-100">
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                </div>
                                            )}
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

export default SubscriptionRequests;
