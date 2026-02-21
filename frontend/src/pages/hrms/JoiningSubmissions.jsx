import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const JoiningSubmissions = () => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ status: '', search: '' });
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        fetchSubmissions();
    }, [filter]);

    const fetchSubmissions = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter.status) params.append('status', filter.status);
            if (filter.search) params.append('search', filter.search);

            const response = await api.get(`/hrms/joining_submissions?${params}`);
            if (response.data.success) {
                setSubmissions(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching submissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (submissionId, action) => {
        if (action === 'reject' && !rejectionReason) {
            alert('Please provide a rejection reason');
            return;
        }

        try {
            const response = await api.post('/hrms/verify_joining', {
                submission_id: submissionId,
                action: action,
                rejection_reason: rejectionReason
            });

            if (response.data.success) {
                alert(response.data.message);
                setShowModal(false);
                setRejectionReason('');
                fetchSubmissions();
            } else {
                alert(response.data.message || 'Failed to update submission');
            }
        } catch (error) {
            console.error('Error verifying submission:', error);
            alert('Failed to update submission');
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: 'bg-yellow-100 text-yellow-800',
            verified: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800'
        };
        return badges[status] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-800 via-purple-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6">
                <h1 className="text-3xl font-bold text-white mb-1">Joining Form Submissions</h1>
                <p className="text-purple-200 text-sm">Review and verify candidate joining forms</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <input
                            type="text"
                            placeholder="Search by name, email, or phone..."
                            value={filter.search}
                            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        />
                    </div>
                    <div>
                        <select
                            value={filter.status}
                            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="verified">Verified</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Submissions Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">Loading...</div>
                ) : submissions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No submissions found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {submissions.map((submission) => (
                                    <tr key={submission.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{submission.full_name || 'Not submitted'}</div>
                                            <div className="text-sm text-gray-500">{submission.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm">{submission.contact_number}</td>
                                        <td className="px-6 py-4 text-sm">{submission.department}</td>
                                        <td className="px-6 py-4 text-sm">
                                            {submission.submission_date ? new Date(submission.submission_date).toLocaleDateString() : 'Pending'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(submission.status)}`}>
                                                {submission.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedSubmission(submission);
                                                        setShowModal(true);
                                                    }}
                                                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                                >
                                                    View
                                                </button>
                                                {submission.status === 'pending' && submission.full_name && (
                                                    <>
                                                        <button
                                                            onClick={() => handleVerify(submission.id, 'verify')}
                                                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                                        >
                                                            Verify
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedSubmission(submission);
                                                                setShowModal(true);
                                                            }}
                                                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* View/Verify Modal */}
            {showModal && selectedSubmission && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold">Submission Details</h2>
                                <button
                                    onClick={() => {
                                        setShowModal(false);
                                        setRejectionReason('');
                                    }}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Personal Details */}
                            <div>
                                <h3 className="font-bold text-lg mb-3">Personal Details</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="font-semibold">Full Name:</span> {selectedSubmission.full_name}</div>
                                    <div><span className="font-semibold">Father/Mother Name:</span> {selectedSubmission.father_mother_name}</div>
                                    <div><span className="font-semibold">DOB:</span> {selectedSubmission.dob}</div>
                                    <div><span className="font-semibold">Gender:</span> {selectedSubmission.gender}</div>
                                    <div><span className="font-semibold">Marital Status:</span> {selectedSubmission.marital_status}</div>
                                    <div><span className="font-semibold">Contact:</span> {selectedSubmission.contact_number}</div>
                                    <div className="col-span-2"><span className="font-semibold">Email:</span> {selectedSubmission.email}</div>
                                </div>
                            </div>

                            {/* Education */}
                            {selectedSubmission.education && selectedSubmission.education.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-lg mb-3">Education</h3>
                                    <table className="w-full border text-sm">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="border p-2">Qualification</th>
                                                <th className="border p-2">University</th>
                                                <th className="border p-2">Year</th>
                                                <th className="border p-2">%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedSubmission.education.map((edu, idx) => (
                                                <tr key={idx}>
                                                    <td className="border p-2">{edu.qual}</td>
                                                    <td className="border p-2">{edu.univ}</td>
                                                    <td className="border p-2">{edu.year}</td>
                                                    <td className="border p-2">{edu.perc}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Employment */}
                            {selectedSubmission.employment && selectedSubmission.employment.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-lg mb-3">Employment History</h3>
                                    <table className="w-full border text-sm">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="border p-2">Company</th>
                                                <th className="border p-2">Designation</th>
                                                <th className="border p-2">Duration</th>
                                                <th className="border p-2">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedSubmission.employment.map((emp, idx) => (
                                                <tr key={idx}>
                                                    <td className="border p-2">{emp.comp}</td>
                                                    <td className="border p-2">{emp.desig}</td>
                                                    <td className="border p-2">{emp.dur}</td>
                                                    <td className="border p-2">{emp.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Actions for Pending */}
                            {selectedSubmission.status === 'pending' && selectedSubmission.full_name && (
                                <div className="border-t pt-6">
                                    <div className="mb-4">
                                        <label className="block font-semibold mb-2">Rejection Reason (if rejecting):</label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            rows="3"
                                            className="w-full border rounded p-2"
                                            placeholder="Enter reason for rejection..."
                                        />
                                    </div>
                                    <div className="flex space-x-4">
                                        <button
                                            onClick={() => handleVerify(selectedSubmission.id, 'verify')}
                                            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                        >
                                            Verify & Approve
                                        </button>
                                        <button
                                            onClick={() => handleVerify(selectedSubmission.id, 'reject')}
                                            className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JoiningSubmissions;
