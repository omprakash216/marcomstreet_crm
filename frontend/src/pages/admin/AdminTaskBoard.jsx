import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const columns = [
  {
    key: 'pending',
    title: 'Pending',
    icon: 'fa-clock',
    accent: 'border-amber-200 bg-amber-50 text-amber-700',
    header: 'bg-amber-100/70 text-amber-800',
  },
  {
    key: 'in_progress',
    title: 'In Progress',
    icon: 'fa-spinner',
    accent: 'border-blue-200 bg-blue-50 text-blue-700',
    header: 'bg-blue-100/70 text-blue-800',
  },
  {
    key: 'overdue',
    title: 'Overdue',
    icon: 'fa-triangle-exclamation',
    accent: 'border-red-200 bg-red-50 text-red-700',
    header: 'bg-red-100/70 text-red-800',
  },
  {
    key: 'completed',
    title: 'Completed',
    icon: 'fa-circle-check',
    accent: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    header: 'bg-emerald-100/70 text-emerald-800',
  },
];

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const priorityStyles = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};

function normalizeStatus(status) {
  const value = String(status || 'pending').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (value === 'progress') return 'in_progress';
  if (value === 'done') return 'completed';
  return value || 'pending';
}

function formatLabel(value) {
  return String(value || 'Not set')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isOverdue(task) {
  if (normalizeStatus(task.status) === 'completed') return false;
  const dueDate = parseDate(task.due_date);
  if (!dueDate) return false;
  dueDate.setHours(23, 59, 59, 999);
  return dueDate < new Date();
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return 'No due date';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getTaskColumn(task) {
  if (isOverdue(task)) return 'overdue';
  const status = normalizeStatus(task.status);
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in_progress';
  return 'pending';
}

function taskMatches(task, filters) {
  const status = normalizeStatus(task.status);
  const priority = String(task.priority || 'low').toLowerCase();
  const assigneeId = String(task.employee_id || '');
  const haystack = [
    task.title,
    task.description,
    task.employee_name,
    task.employee_email,
    task.lead_company_name,
    task.lead_contact,
    task.task_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (filters.status !== 'all') {
    if (filters.status === 'overdue') {
      if (!isOverdue(task)) return false;
    } else if (status !== filters.status) {
      return false;
    }
  }
  if (filters.priority !== 'all' && priority !== filters.priority) return false;
  if (filters.assignee !== 'all' && assigneeId !== String(filters.assignee)) return false;
  if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;
  return true;
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 font-black">{label}</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <i className={`fas ${icon}`}></i>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, updatingId, onStatusChange, onView }) {
  const overdue = isOverdue(task);
  const status = normalizeStatus(task.status);
  const priority = String(task.priority || 'low').toLowerCase();
  const priorityClass = priorityStyles[priority] || priorityStyles.low;

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-gray-900 leading-snug break-words">{task.title || 'Untitled task'}</h3>
          {task.description ? (
            <p className="text-xs text-gray-500 mt-2 leading-relaxed break-words">
              {String(task.description).slice(0, 120)}
              {String(task.description).length > 120 ? '...' : ''}
            </p>
          ) : null}
        </div>
        <span className={`shrink-0 px-2 py-1 rounded-full border text-[10px] uppercase tracking-wider font-black ${priorityClass}`}>
          {formatLabel(priority)}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <i className="fas fa-user w-4 text-slate-400"></i>
          <span className="font-semibold text-gray-800 truncate">{task.employee_name || 'Unassigned'}</span>
        </div>
        <div className="flex items-center gap-2">
          <i className="far fa-calendar w-4 text-slate-400"></i>
          <span className={overdue ? 'font-bold text-red-700' : 'font-semibold text-gray-700'}>{formatDate(task.due_date)}</span>
        </div>
        {task.lead_company_name || task.company_name ? (
          <div className="flex items-center gap-2">
            <i className="fas fa-building w-4 text-slate-400"></i>
            <span className="truncate">{task.lead_company_name || task.company_name}</span>
          </div>
        ) : null}
        {task.task_type ? (
          <div className="flex items-center gap-2">
            <i className="fas fa-layer-group w-4 text-slate-400"></i>
            <span>{formatLabel(task.task_type)}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <select
          value={statusOptions.some((item) => item.value === status) ? status : 'pending'}
          onChange={(event) => onStatusChange(task.id, event.target.value)}
          disabled={updatingId === task.id}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          title="Change task status"
        >
          {statusOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onView(task)}
          className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          title="View task details"
        >
          <i className="fas fa-eye"></i>
        </button>
      </div>
    </article>
  );
}

export default function AdminTaskBoard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    assignee: 'all',
  });

  const fetchBoard = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');
      const response = await api.get('/admin/tasks');
      const payload = response.data?.data;
      const nextTasks = Array.isArray(payload) ? payload : Array.isArray(payload?.tasks) ? payload.tasks : [];
      const nextEmployees = Array.isArray(payload?.employees) ? payload.employees : [];
      setTasks(nextTasks);
      setEmployees(nextEmployees);
    } catch (err) {
      setError(err.response?.data?.message || 'Task board load nahi ho pa raha hai.');
      setTasks([]);
      setEmployees([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, []);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => taskMatches(task, filters)),
    [tasks, filters]
  );

  const groupedTasks = useMemo(() => {
    const initial = columns.reduce((acc, column) => ({ ...acc, [column.key]: [] }), {});
    filteredTasks.forEach((task) => {
      const columnKey = getTaskColumn(task);
      initial[columnKey] = [...(initial[columnKey] || []), task];
    });
    return initial;
  }, [filteredTasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter(isOverdue).length;
    const inProgress = tasks.filter((task) => normalizeStatus(task.status) === 'in_progress' && !isOverdue(task)).length;
    const completed = tasks.filter((task) => normalizeStatus(task.status) === 'completed').length;
    const open = tasks.filter((task) => normalizeStatus(task.status) !== 'completed').length;
    return { total, open, inProgress, completed, overdue };
  }, [tasks]);

  const handleStatusChange = async (taskId, status) => {
    try {
      setUpdatingId(taskId);
      await api.patch(`/admin/tasks/${taskId}/status`, { status });
      await fetchBoard({ silent: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Task status update nahi ho paya.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading task board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 via-blue-800 to-cyan-700 rounded-xl shadow-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/15 rounded-xl flex items-center justify-center shadow-lg">
              <i className="fas fa-columns text-white text-2xl"></i>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-cyan-100 font-black">Company Admin Panel</p>
              <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">Task Board</h1>
              <p className="text-cyan-50/90 text-sm mt-1">Team tasks ko status, priority aur due date ke hisab se track karo.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/task-assignment')}
              className="px-5 py-3 bg-white text-blue-800 rounded-lg font-black hover:bg-blue-50 transition-colors shadow-lg"
            >
              <i className="fas fa-plus mr-2"></i>Assign Task
            </button>
            <button
              type="button"
              onClick={() => fetchBoard({ silent: true })}
              className="px-5 py-3 bg-white/15 text-white rounded-lg font-black hover:bg-white/25 transition-colors border border-white/20"
              disabled={refreshing}
            >
              <i className={`fas fa-rotate mr-2 ${refreshing ? 'animate-spin' : ''}`}></i>Refresh
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 flex items-start justify-between gap-3">
          <div className="text-sm font-semibold">{error}</div>
          <button
            type="button"
            onClick={() => fetchBoard({ silent: true })}
            className="shrink-0 text-xs font-black uppercase tracking-wider text-red-700 hover:text-red-900"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="Total Tasks" value={stats.total} icon="fa-list-check" color="bg-slate-100 text-slate-700" />
        <StatCard label="Open Tasks" value={stats.open} icon="fa-folder-open" color="bg-indigo-100 text-indigo-700" />
        <StatCard label="In Progress" value={stats.inProgress} icon="fa-spinner" color="bg-blue-100 text-blue-700" />
        <StatCard label="Overdue" value={stats.overdue} icon="fa-triangle-exclamation" color="bg-red-100 text-red-700" />
        <StatCard label="Completed" value={stats.completed} icon="fa-circle-check" color="bg-emerald-100 text-emerald-700" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search task, assignee, lead..."
            />
          </div>
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={filters.priority}
            onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filters.assignee}
            onChange={(event) => setFilters((current) => ({ ...current, assignee: event.target.value }))}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Assignees</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="w-16 h-16 rounded-xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
            <i className="fas fa-clipboard-list text-2xl"></i>
          </div>
          <h2 className="text-xl font-black text-gray-900 mt-4">No tasks found</h2>
          <p className="text-sm text-gray-500 mt-2">Task assignment se task create karte hi yaha board par dikhega.</p>
          <button
            type="button"
            onClick={() => navigate('/admin/task-assignment')}
            className="mt-5 px-5 py-3 rounded-lg bg-blue-600 text-white font-black hover:bg-blue-700 transition-colors"
          >
            <i className="fas fa-plus mr-2"></i>Assign Task
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
          {columns.map((column) => {
            const columnTasks = groupedTasks[column.key] || [];
            return (
              <section key={column.key} className="rounded-xl border border-gray-200 bg-slate-50/70 min-h-[420px]">
                <div className={`m-3 rounded-lg px-4 py-3 flex items-center justify-between gap-3 ${column.header}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <i className={`fas ${column.icon}`}></i>
                    <h2 className="font-black text-sm truncate">{column.title}</h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-xs font-black">{columnTasks.length}</span>
                </div>
                <div className="p-3 pt-0 space-y-3">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white/70 p-6 text-center text-sm text-gray-500">
                      <i className="fas fa-inbox text-2xl text-gray-300 mb-3 block"></i>
                      No task
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        updatingId={updatingId}
                        onStatusChange={handleStatusChange}
                        onView={setSelectedTask}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selectedTask ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-blue-600 font-black">Task Details</p>
                <h2 className="text-xl font-black text-gray-900 mt-1">{selectedTask.title || 'Untitled task'}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="w-10 h-10 rounded-lg text-gray-500 hover:bg-gray-100"
                title="Close"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider">
                  {formatLabel(normalizeStatus(selectedTask.status))}
                </span>
                <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wider ${priorityStyles[String(selectedTask.priority || 'low').toLowerCase()] || priorityStyles.low}`}>
                  {formatLabel(selectedTask.priority || 'low')}
                </span>
                {isOverdue(selectedTask) ? (
                  <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-black uppercase tracking-wider">Overdue</span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500">Assignee</p>
                  <p className="font-bold text-gray-900 mt-1">{selectedTask.employee_name || 'Unassigned'}</p>
                  {selectedTask.employee_email ? <p className="text-gray-500 text-xs mt-1">{selectedTask.employee_email}</p> : null}
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500">Due Date</p>
                  <p className="font-bold text-gray-900 mt-1">{formatDate(selectedTask.due_date)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500">Lead / Company</p>
                  <p className="font-bold text-gray-900 mt-1">{selectedTask.lead_company_name || selectedTask.company_name || 'Not linked'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500">Task Type</p>
                  <p className="font-bold text-gray-900 mt-1">{formatLabel(selectedTask.task_type || 'general')}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-500">Description</p>
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{selectedTask.description || 'No description added.'}</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex flex-col sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/task-assignment')}
                className="px-5 py-3 rounded-lg border border-gray-200 bg-white text-gray-700 font-black hover:bg-gray-100"
              >
                Open Task Assignment
              </button>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="px-5 py-3 rounded-lg bg-blue-600 text-white font-black hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
