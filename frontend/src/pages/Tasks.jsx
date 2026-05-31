import { useState, useEffect } from 'react';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTaskId, setSelectedUploadTaskId] = useState(null);
  const [workFile, setWorkFile] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'other',
    priority: 'medium',
    due_date: '',
    lead_id: '',
  });
  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    title: '',
    description: '',
    task_type: 'other',
    priority: 'medium',
    due_date: '',
    lead_id: '',
  });
  const [assignees, setAssignees] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    setEmployee(getEmployee());
    fetchTasks();
    fetchLeads();
  }, []);

  const isManagerOrAdmin = () => {
    const role = (employee?.role || '').toLowerCase();
    return role === 'manager' || role === 'admin';
  };

  const fetchTasks = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setTasks([]);
      return;
    }

    try {
      setLoadError('');
      const response = await api.get('/tasks');
      setTasks(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching tasks:', error);
      }
      if (error.response?.status && error.response?.status !== 401) {
        setLoadError(error.response?.data?.message || `Unable to load tasks (HTTP ${error.response.status})`);
      }
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLeads([]);
      return;
    }

    try {
      const response = await api.get('/leads');
      setLeads(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching leads:', error);
      }
      setLeads([]);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tasks', formData);
      setShowModal(false);
      setFormData({
        title: '',
        description: '',
        task_type: 'other',
        priority: 'medium',
        due_date: '',
        lead_id: '',
      });
      fetchTasks();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create task');
    }
  };

  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      await api.put('/tasks/update_status', {
        task_id: taskId,
        status: newStatus,
      });
      fetchTasks();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update task');
    }
  };

  const handleUploadWork = async (e) => {
    e.preventDefault();
    if (!workFile) {
      alert('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('task_id', selectedTaskId);
    formData.append('status', 'completed');
    formData.append('work_file', workFile);

    try {
      const response = await api.post('/tasks/update_status', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) {
        alert('Work uploaded and task completed!');
        setShowUploadModal(false);
        setWorkFile(null);
        fetchTasks();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to upload work');
    }
  };

  const fetchAssignees = async () => {
    try {
      const response = await api.get('/tasks/assignees');
      if (response.data.success) {
        setAssignees(Array.isArray(response.data.data) ? response.data.data : []);
      }
    } catch (error) {
      if (error.response?.status !== 403) {
        console.error('Error fetching assignees:', error);
      }
      setAssignees([]);
    }
  };

  useEffect(() => {
    if (showAssignModal && isManagerOrAdmin()) {
      fetchAssignees();
    }
  }, [showAssignModal, employee]);

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!assignForm.employee_id) {
      alert('Please select an employee');
      return;
    }
    setAssignLoading(true);
    try {
      const payload = {
        ...assignForm,
        employee_id: Number(assignForm.employee_id),
        lead_id: assignForm.lead_id || null,
        due_date: assignForm.due_date || null,
      };
      await api.post('/tasks/assign', payload);
      alert('Task assigned successfully');
      setShowAssignModal(false);
      setAssignForm({
        employee_id: '',
        title: '',
        description: '',
        task_type: 'other',
        priority: 'medium',
        due_date: '',
        lead_id: '',
      });
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to assign task');
    } finally {
      setAssignLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'text-gray-600',
      medium: 'text-blue-600',
      high: 'text-orange-600',
      urgent: 'text-red-600',
    };
    return colors[priority] || 'text-gray-600';
  };

  return (
    <div>
      {loadError ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 flex items-start justify-between gap-3">
          <div className="text-sm">
            <div className="font-bold">Tasks page is not loading properly</div>
            <div className="text-amber-800 mt-0.5">{loadError}</div>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchTasks();
            }}
            className="shrink-0 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-black uppercase tracking-wider hover:bg-amber-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : null}
      {/* Professional Header Section */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left Side - Title and Icon */}
            <div className="flex items-center space-x-4">
              {/* Icon */}
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>

              {/* Title and Description */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-1">Tasks & Reminders</h1>
                <p className="text-slate-300 text-sm">Manage your tasks and set important reminders</p>
              </div>
            </div>

            {/* Right Side - Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 justify-end">
              {isManagerOrAdmin() && (
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="flex items-center space-x-2 px-5 py-3 bg-emerald-500 text-white rounded-xl shadow-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl hover:bg-emerald-600"
                >
                  <i className="fas fa-user-check text-sm"></i>
                  <span>Assign Team Task</span>
                </button>
              )}
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl hover:bg-slate-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create Task</span>
              </button>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#244bd8] text-white font-black uppercase tracking-widest text-[10px]">
              <tr>
                <th className="px-6 py-4 text-left">SL No</th>
                <th className="px-6 py-4 text-left">Task Details</th>
                <th className="px-6 py-4 text-left">Type</th>
                <th className="px-6 py-4 text-left">Priority</th>
                <th className="px-6 py-4 text-left">Due Date</th>
                <th className="px-6 py-4 text-left">Status Control</th>
                <th className="px-6 py-4 text-right">Work Verification</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-medium">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                    <div>Analyzing Operations...</div>
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-medium">
                    No tasks found in the pipeline
                  </td>
                </tr>
              ) : (
                tasks.map((task, index) => (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-400">
                      #{index + 1}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">{task.title}</div>
                      {task.description && (
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{task.description}</div>
                      )}
                      {task.company_name && (
                        <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-black uppercase mt-1 border border-blue-100">
                          <i className="fas fa-building mr-1.5"></i>
                          {task.company_name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-black uppercase text-slate-400 tracking-tighter">
                        {task.task_type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-700">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '∞'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {task.due_date ? new Date(task.due_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'No Deadline'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                        className={`text-[10px] font-black uppercase tracking-widest border-2 rounded-lg px-3 py-1.5 focus:outline-none transition-all cursor-pointer shadow-sm ${getStatusColor(task.status)}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {task.status !== 'completed' ? (
                        <button
                          onClick={() => {
                            setSelectedUploadTaskId(task.id);
                            setShowUploadModal(true);
                          }}
                          className="inline-flex items-center space-x-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all border border-blue-100 font-black text-[10px] uppercase tracking-widest shadow-sm"
                        >
                          <i className="fas fa-upload"></i>
                          <span>Sync Work</span>
                        </button>
                      ) : task.work_file_path ? (
                        <a
                          href={`${import.meta.env.DEV ? 'http://localhost/MARCOM-NEW-CRM' : '/MARCOM-NEW-CRM'}/${task.work_file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all border border-green-100 font-black text-[10px] uppercase tracking-widest shadow-sm"
                        >
                          <i className="fas fa-eye"></i>
                          <span>Audit File</span>
                        </a>
                      ) : (
                        <span className="text-[10px] font-black uppercase text-slate-400 italic">No Artifact</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAssignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[1.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
            <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                  <i className="fas fa-briefcase text-xl"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Assign Task to Team</h2>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">Department-limited assignment</p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleAssignTask} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-8">
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      <i className="fas fa-user-friends text-emerald-500 w-4 text-center"></i>
                      <span>Select Team Member *</span>
                    </label>
                    <select
                      required
                      value={assignForm.employee_id}
                      onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium text-sm"
                    >
                      <option value="">Choose employee</option>
                      {assignees.length === 0 && (
                        <option disabled value="">
                          {assignLoading ? 'Loading team...' : 'No team members found'}
                        </option>
                      )}
                      {assignees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} {emp.designation ? `· ${emp.designation}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">Only employees from your department are listed.</p>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      <i className="fas fa-heading text-emerald-500 w-4 text-center"></i>
                      <span>Task Title *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={assignForm.title}
                      onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                      placeholder="e.g. Client Follow-up, Project Proposal"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium text-sm"
                    />
                  </div>

                  <div>
                    <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      <i className="fas fa-align-left text-emerald-500 w-4 text-center"></i>
                      <span>Task Description</span>
                    </label>
                    <textarea
                      value={assignForm.description}
                      onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
                      rows={4}
                      placeholder="Detail the task objectives and steps..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium text-sm min-h-[118px] resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        <i className="fas fa-tags text-emerald-500 w-4 text-center"></i>
                        <span>Task Type</span>
                      </label>
                      <select
                        value={assignForm.task_type}
                        onChange={(e) => setAssignForm({ ...assignForm, task_type: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium text-sm"
                      >
                        <option value="follow_up">Follow-up</option>
                        <option value="meeting">Meeting</option>
                        <option value="call">Call</option>
                        <option value="email">Email</option>
                        <option value="document">Document</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        <i className="fas fa-flag text-emerald-500 w-4 text-center"></i>
                        <span>Priority</span>
                      </label>
                      <select
                        value={assignForm.priority}
                        onChange={(e) => setAssignForm({ ...assignForm, priority: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      <i className="fas fa-user-tie text-emerald-500 w-4 text-center"></i>
                      <span>Associate Lead (Optional)</span>
                    </label>
                    <select
                      value={assignForm.lead_id}
                      onChange={(e) => setAssignForm({ ...assignForm, lead_id: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium text-sm"
                    >
                      <option value="">Independent Task</option>
                      {leads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.company_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      <i className="fas fa-calendar-alt text-emerald-500 w-4 text-center"></i>
                      <span>Due Date & Time</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={assignForm.due_date}
                      onChange={(e) => setAssignForm({ ...assignForm, due_date: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                >
                  <i className="fas fa-paper-plane mr-2 text-[10px]"></i>
                  <span>{assignLoading ? 'Assigning...' : 'Assign Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[1.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
            {/* Modal Header */}
            <div className="bg-[#244bd8] p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                  <i className="fas fa-cloud-upload-alt text-xl"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Archive Work Result</h2>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">Final Step Verification</p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleUploadWork} className="p-6">
              <div className="mb-6">
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  <i className="fas fa-file-export text-blue-500 w-4 text-center"></i>
                  <span>Select Verification File</span>
                </label>
                <div className="relative group">
                  <input
                    type="file"
                    required
                    onChange={(e) => setWorkFile(e.target.files[0])}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm font-medium file:hidden cursor-pointer"
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 font-black text-[10px] uppercase">
                    {workFile ? workFile.name : 'Click to Browse'}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-medium italic">* File will be securely attached to the task record.</p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-green-500/20 transition-all active:scale-95"
                >
                  <i className="fas fa-check-circle mr-2"></i>
                  <span>Submit & Close</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[1.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
            {/* Modal Header */}
            <div className="bg-[#244bd8] p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                  <i className="fas fa-tasks text-xl"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Create Operational Task</h2>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">Task Management System</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-8">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      <i className="fas fa-heading text-blue-500 w-4 text-center"></i>
                      <span>Task Title *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. Client Follow-up, Project Proposal"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                    />
                  </div>

                  <div>
                    <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      <i className="fas fa-align-left text-blue-500 w-4 text-center"></i>
                      <span>Task Description</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      placeholder="Detail the task objectives and steps..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm min-h-[118px] resize-none"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        <i className="fas fa-tags text-blue-500 w-4 text-center"></i>
                        <span>Task Type</span>
                      </label>
                      <select
                        value={formData.task_type}
                        onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                      >
                        <option value="follow_up">Follow-up</option>
                        <option value="meeting">Meeting</option>
                        <option value="call">Call</option>
                        <option value="email">Email</option>
                        <option value="document">Document</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        <i className="fas fa-flag text-blue-500 w-4 text-center"></i>
                        <span>Priority</span>
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      <i className="fas fa-user-tie text-blue-500 w-4 text-center"></i>
                      <span>Associate Lead (Optional)</span>
                    </label>
                    <select
                      value={formData.lead_id}
                      onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                    >
                      <option value="">Independent Task</option>
                      {leads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.company_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      <i className="fas fa-calendar-alt text-blue-500 w-4 text-center"></i>
                      <span>Due Date & Time</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Discard Task
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#244bd8] hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <i className="fas fa-check-circle mr-2 text-[10px]"></i>
                  <span>Initialize Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

