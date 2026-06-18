import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';

export default function AdminTaskAssignment() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewTask, setViewTask] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [filter, setFilter] = useState({
    status: 'all',
    priority: 'all',
    assignee: 'all',
    search: ''
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee_id: '',
    priority: 'medium',
    due_date: '',
    estimated_hours: 1,
    tags: '',
    notes: ''
  });

  useEffect(() => {
    const employee = getEmployee();
    const role = normalizeRole(employee?.role);
    if (!employee || (role !== 'admin' && role !== 'superadmin' && role !== 'super_admin')) {
      navigate('/login');
      return;
    }
    fetchData();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  useEffect(() => {
    setPage(1);
  }, [filter.status, filter.priority, filter.assignee, filter.search]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((tasks?.length || 0) / pageSize));
    setPage((p) => Math.min(Math.max(p, 1), totalPages));
  }, [tasks.length]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksRes, employeesRes] = await Promise.all([
        api.get('/admin/tasks'),
        api.get('/employees')
      ]);

      if (tasksRes.data.success) {
        const payload = tasksRes.data.data;
        const list = Array.isArray(payload) ? payload : Array.isArray(payload?.tasks) ? payload.tasks : [];
        setTasks(list);
      } else {
        setTasks([]);
      }
      if (employeesRes.data.success) {
        setEmployees(employeesRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.status !== 'all') params.append('status', filter.status);
      if (filter.priority !== 'all') params.append('priority', filter.priority);
      if (filter.assignee !== 'all') params.append('employee_id', filter.assignee);
      if (filter.search) params.append('search', filter.search);

      const response = await api.get(`/admin/tasks?${params.toString()}`);
      if (response.data.success) {
        const payload = response.data.data;
        const list = Array.isArray(payload) ? payload : Array.isArray(payload?.tasks) ? payload.tasks : [];
        setTasks(list);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        title: formData.title,
        description: formData.description,
        employee_id: formData.assignee_id || null,
        priority: formData.priority,
        due_date: formData.due_date || null,
        lead_id: formData.lead_id || null,
        status: formData.status || 'pending',
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== ''),
        notes: formData.notes
      };

      const response = editingTask
        ? await api.put(`/admin/tasks/${editingTask.id}`, data)
        : await api.post('/admin/tasks', data);

      if (response.data.success) {
        fetchTasks();
        resetForm();
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error saving task:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      assignee_id: '',
      priority: 'medium',
      due_date: '',
      estimated_hours: 1,
      tags: '',
      notes: ''
    });
    setEditingTask(null);
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      assignee_id: task.employee_id,
      priority: task.priority || 'medium',
      due_date: task.due_date,
      estimated_hours: task.estimated_hours || 1,
      tags: task.tags ? task.tags.join(', ') : '',
      notes: task.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await api.delete(`/admin/tasks/${taskId}`);
        fetchTasks();
      } catch (err) {
        console.error('Error deleting task:', err);
      }
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.patch(`/admin/tasks/${taskId}/status`, { status: newStatus });
      fetchTasks();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getOverdueTasks = () => {
    return (Array.isArray(tasks) ? tasks : []).filter(task => {
      if (task.status === 'completed') return false;
      const dueDate = new Date(task.due_date);
      const today = new Date();
      return dueDate < today;
    });
  };

  const getUpcomingTasks = () => {
    return (Array.isArray(tasks) ? tasks : []).filter(task => {
      if (task.status === 'completed') return false;
      const dueDate = new Date(task.due_date);
      const today = new Date();
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      return dueDate >= today && dueDate <= weekFromNow;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading task assignments...</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil((tasks?.length || 0) / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedTasks = (Array.isArray(tasks) ? tasks : []).slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-blue-950 rounded-xl shadow-xl p-4 sm:p-6 border border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-500/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/10">
              <i className="fas fa-tasks text-white text-2xl sm:text-3xl"></i>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">Task Assignment</h1>
              <p className="text-slate-300 text-sm md:text-base">Assign and track tasks across your organization</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto px-5 py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg backdrop-blur-sm transition-all font-semibold flex items-center justify-center gap-2 border border-white/15 shadow-lg"
          >
            <i className="fas fa-plus"></i>
            <span>Assign Task</span>
          </button>
        </div>
      </div>

      {/* Task Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-xl shadow-lg p-5 border border-green-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900">{tasks.length}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-list-check text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-xl shadow-lg p-5 border border-blue-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">In Progress</p>
              <p className="text-3xl font-bold text-gray-900">{tasks.filter(t => t.status === 'in_progress').length}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-spinner text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-yellow-50/50 rounded-xl shadow-lg p-5 border border-yellow-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pending</p>
              <p className="text-3xl font-bold text-gray-900">{tasks.filter(t => t.status === 'pending').length}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-clock text-white"></i>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-red-50/50 rounded-xl shadow-lg p-5 border border-red-100/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Overdue</p>
              <p className="text-3xl font-bold text-gray-900">{getOverdueTasks().length}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fas fa-exclamation-triangle text-white"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="text"
            placeholder="Search tasks..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="flex-1 min-w-[200px] border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
          <select
            value={filter.priority}
            onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <select
            value={filter.assignee}
            onChange={(e) => setFilter({ ...filter, assignee: e.target.value })}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Assignees</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 px-6 py-4 border-b border-gray-200/50">
          <h3 className="text-lg font-bold text-white flex items-center">
            <i className="fas fa-clipboard-list mr-3"></i>
            Task Assignments ({tasks.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SL</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Assignee</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">
                    <div className="flex flex-col items-center">
                      <i className="fas fa-clipboard-list text-gray-400 text-4xl mb-4"></i>
                      <div className="text-lg font-medium text-gray-900 mb-1">No tasks found</div>
                      <div className="text-gray-500">Create your first task assignment to get started.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task, idx) => {
                  const assignee = employees.find(emp => emp.id === task.employee_id);
                  const dueDate = task.due_date ? new Date(task.due_date) : null;
                  const isOverdue = task.status !== 'completed' && dueDate && dueDate < new Date();

                  return (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{startIndex + idx + 1}</td>
                      <td className="px-6 py-4 min-w-[280px]">
                        <div className="text-sm font-semibold text-gray-900">{task.title}</div>
                        {task.description ? (
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</div>
                        ) : null}
                        {task.notes ? (
                          <div className="text-[11px] text-blue-700 mt-1 line-clamp-1">
                            <i className="fas fa-sticky-note mr-1"></i>
                            {task.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex items-center">
                          <i className="fas fa-user mr-2 text-blue-600"></i>
                          {assignee?.name || 'Unassigned'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <i className="far fa-calendar-alt text-blue-600"></i>
                          <span>{dueDate ? dueDate.toLocaleDateString() : '—'}</span>
                          {isOverdue ? (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-red-100 text-red-700">
                              Overdue
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(task.priority)}`}>
                          {task.priority || 'low'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(task.status)}`}>
                            {task.status}
                          </span>
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task.id, e.target.value)}
                            className="text-xs border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Change status"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setViewTask(task)}
                            className="w-9 h-9 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                            title="View Details"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button
                            onClick={() => handleEdit(task)}
                            className="w-9 h-9 inline-flex items-center justify-center text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg"
                            title="Edit"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="w-9 h-9 inline-flex items-center justify-center text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg"
                            title="Delete"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {tasks.length > 0 ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 py-4 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold">{Math.min(startIndex + 1, tasks.length)}</span>–
              <span className="font-semibold">{Math.min(startIndex + paginatedTasks.length, tasks.length)}</span> of{' '}
              <span className="font-semibold">{tasks.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="px-3 py-2 text-sm font-semibold text-gray-700">
                Page {safePage} / {totalPages}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Task Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-blue-950 px-6 py-4 flex items-center justify-between sticky top-0">
              <h2 className="text-xl font-bold text-white">
                {editingTask ? 'Edit Task' : 'Assign New Task'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-white hover:text-gray-200"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter task title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assignee *</label>
                  <select
                    required
                    value={formData.assignee_id}
                    onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select assignee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} - {emp.role}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Task description and requirements"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Hours</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formData.estimated_hours}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next = raw === '' ? '' : parseFloat(raw);
                      setFormData({ ...formData, estimated_hours: Number.isNaN(next) ? '' : next });
                    }}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="urgent, client, follow-up"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Any additional instructions or context"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <i className="fas fa-save"></i>
                  <span>{editingTask ? 'Update Task' : 'Assign Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {viewTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-blue-950 px-6 py-4 flex items-center justify-between sticky top-0">
              <h2 className="text-xl font-bold text-white">Task Details</h2>
              <button onClick={() => setViewTask(null)} className="text-white hover:text-gray-200">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            {(() => {
              const assignee = employees.find((emp) => emp.id === viewTask.employee_id);
              const dueDate = viewTask.due_date ? new Date(viewTask.due_date) : null;
              const tagsValue = Array.isArray(viewTask.tags)
                ? viewTask.tags
                : typeof viewTask.tags === 'string'
                  ? viewTask.tags.split(',').map((t) => t.trim()).filter(Boolean)
                  : [];
              const isOverdue = viewTask.status !== 'completed' && dueDate && dueDate < new Date();

              return (
                <div className="p-6 space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusColor(viewTask.status)}`}>
                      {viewTask.status}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${getPriorityColor(viewTask.priority)}`}>
                      {viewTask.priority || 'low'}
                    </span>
                    {isOverdue ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-100 text-red-700">
                        Overdue
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</div>
                    <div className="text-lg font-bold text-gray-900">{viewTask.title}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignee</div>
                      <div className="text-sm text-gray-900">{assignee?.name || 'Unassigned'}</div>
                      {assignee?.role ? <div className="text-xs text-gray-500">{assignee.role}</div> : null}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</div>
                      <div className="text-sm text-gray-900">{dueDate ? dueDate.toLocaleString() : '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estimated Hours</div>
                      <div className="text-sm text-gray-900">{Number(viewTask.estimated_hours) ? `${viewTask.estimated_hours}h` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</div>
                      <div className="text-sm text-gray-900">{tagsValue.length ? tagsValue.join(', ') : '—'}</div>
                    </div>
                  </div>

                  {viewTask.description ? (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</div>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">{viewTask.description}</div>
                    </div>
                  ) : null}

                  {viewTask.notes ? (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Notes</div>
                      <div className="text-sm text-blue-900 whitespace-pre-wrap">{viewTask.notes}</div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setViewTask(null)}
                      className="px-5 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setViewTask(null);
                        handleEdit(viewTask);
                      }}
                      className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
