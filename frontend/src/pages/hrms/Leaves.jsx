import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';

export default function Leaves() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [filter, setFilter] = useState({
    search: '',
    status: '',
    type: ''
  });
  const [newLeave, setNewLeave] = useState({
    type: 'casual',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [currentLeaveId, setCurrentLeaveId] = useState(null);
  const [adminReason, setAdminReason] = useState('');
  const employee = getEmployee();
  const isAdminOrManager = employee?.role === 'admin' || employee?.role === 'manager' || employee?.role === 'human_resources';

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const response = await api.get('/hrms/leaves');
      if (response.data.success) {
        setLeaves(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/hrms/leaves', newLeave);
      if (response.data.success) {
        alert('Leave applied successfully!');
        setShowApplyModal(false);
        setNewLeave({
          type: 'casual',
          start_date: '',
          end_date: '',
          reason: ''
        });
        fetchLeaves();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to apply leave');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status, reason = null) => {
    try {
      const response = await api.put('/hrms/leaves', {
        id,
        status,
        admin_reason: reason
      });
      if (response.data.success) {
        fetchLeaves();
        setShowReasonModal(false);
        setAdminReason('');
      }
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const filteredLeaves = leaves.filter(leave => {
    return (filter.search === '' || leave.employee_name?.toLowerCase().includes(filter.search.toLowerCase())) &&
      (filter.status === '' || leave.status === filter.status) &&
      (filter.type === '' || leave.type === filter.type);
  });

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
              <i className="fas fa-calendar-alt text-2xl"></i>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1">Leave Management</h1>
              <p className="text-slate-300 text-sm">Manage employee leave requests and attendance balance</p>
            </div>
            <div className="flex space-x-3">
              {!isAdminOrManager && (
                <button
                  onClick={() => setShowApplyModal(true)}
                  className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold transition-all duration-200 hover:bg-slate-50"
                >
                  <i className="fas fa-plus"></i>
                  <span>Apply Leave</span>
                </button>
              )}
              <button onClick={fetchLeaves} className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 transition-all border border-white/20 backdrop-blur-md">
                <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Standardized Filters Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search employee..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Leave Type</label>
            <select
              value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="casual">Casual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="annual">Annual Leave</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full px-4 py-2 text-sm font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg text-center">
              {filteredLeaves.length} Records Found
            </div>
          </div>
        </div>
      </div>

      {/* Standardized Table Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && filteredLeaves.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-2"></div>
                  <p>Loading records...</p>
                </td>
              </tr>
            ) : filteredLeaves.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  No records found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredLeaves.map((leave) => (
                <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                        {leave.employee_name?.charAt(0) || 'E'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{leave.employee_name}</div>
                        <div className="text-xs text-gray-500">{leave.designation || 'Staff Member'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${leave.employee_role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        leave.employee_role === 'manager' ? 'bg-blue-100 text-blue-800' :
                          leave.employee_role === 'human_resources' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'}`}>
                      {leave.employee_role === 'human_resources' ? 'HR' :
                        leave.employee_role === 'admin' ? 'Admin' :
                          leave.employee_role === 'manager' ? 'Manager' : 'Employee'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 capitalize font-medium">{leave.type} Leave</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-700 max-w-[250px]">
                      {leave.reason ? (
                        <div className="truncate" title={leave.reason}>
                          {leave.reason}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No reason provided</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">{leave.start_date}</span>
                      <span className="mx-2 text-gray-400">to</span>
                      <span className="font-medium">{leave.end_date}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                        leave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'}`}>
                      {leave.status?.charAt(0).toUpperCase() + leave.status?.slice(1)}
                    </span>
                    {leave.approved_by_name && (
                      <div className="text-[10px] text-gray-500 mt-1 font-medium">
                        by {leave.approved_by_name}
                      </div>
                    )}
                    {leave.admin_reason && (
                      <div className="text-[10px] text-red-500 mt-0.5 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 max-w-[150px] truncate" title={leave.admin_reason}>
                        Note: {leave.admin_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {isAdminOrManager && leave.status === 'pending' ? (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleStatusUpdate(leave.id, 'approved')}
                          className="text-green-600 hover:text-green-900 bg-green-50 p-2 rounded-lg hover:bg-green-100 transition-all shadow-sm border border-green-100"
                          title="Approve"
                        >
                          <i className="fas fa-check-circle"></i>
                        </button>
                        <button
                          onClick={() => {
                            setCurrentLeaveId(leave.id);
                            setShowReasonModal(true);
                          }}
                          className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition-all shadow-sm border border-red-100"
                          title="Reject"
                        >
                          <i className="fas fa-times-circle"></i>
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Professional Apply Leave Modal */}
      {
        showApplyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[1.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
              {/* Modal Header */}
              <div className="bg-[#244bd8] p-5 text-white flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <i className="fas fa-paper-plane text-2xl"></i>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold leading-tight">Apply for Leave</h2>
                    <p className="text-[11px] opacity-80 uppercase tracking-widest font-black">Attendance Request System</p>
                  </div>
                </div>
                <button onClick={() => setShowApplyModal(false)} className="text-white hover:text-gray-200 transition-colors">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleApplyLeave} className="p-6 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 ml-1">Leave Type</label>
                    <select
                      value={newLeave.type}
                      onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                      <option value="casual">Casual Leave</option>
                      <option value="sick">Sick Leave</option>
                      <option value="annual">Annual Leave</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 ml-1">Start Date</label>
                      <input
                        type="date"
                        required
                        value={newLeave.start_date}
                        onChange={(e) => setNewLeave({ ...newLeave, start_date: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 ml-1">End Date</label>
                      <input
                        type="date"
                        required
                        value={newLeave.end_date}
                        onChange={(e) => setNewLeave({ ...newLeave, end_date: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 ml-1">Reason for Application</label>
                    <textarea
                      rows="3"
                      required
                      value={newLeave.reason}
                      onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="Please provide a brief reason for your leave request..."
                    ></textarea>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="pt-6 border-t border-slate-100 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(false)}
                    className="px-6 py-2.5 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-2.5 bg-[#244bd8] hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                  >
                    <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-check-circle"}></i>
                    <span>{loading ? 'Submitting...' : 'Submit Application'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Professional Rejection Reason Modal */}
      {
        showReasonModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[1.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
              <div className="bg-red-600 p-5 text-white flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-comment-slash text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Reject Application</h2>
                    <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">Mandatory Feedback Required</p>
                  </div>
                </div>
                <button onClick={() => setShowReasonModal(false)} className="text-white hover:text-gray-200 transition-colors">
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>

              <div className="p-6">
                <label className="block text-[10px] font-black text-red-600 uppercase tracking-widest mb-1.5 ml-1">Reason for Rejection</label>
                <textarea
                  rows="4"
                  required
                  value={adminReason}
                  onChange={(e) => setAdminReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all mb-6"
                  placeholder="Please state the reason for rejecting this leave request..."
                ></textarea>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowReasonModal(false)}
                    className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(currentLeaveId, 'rejected', adminReason)}
                    disabled={!adminReason.trim()}
                    className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

