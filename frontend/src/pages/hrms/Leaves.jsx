import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';

export default function Leaves() {
  const [leaves, setLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const PAGE_SIZE = 10;
  const [leavePage, setLeavePage] = useState(0);
  const [leaveTypePage, setLeaveTypePage] = useState(0);
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewLeave, setViewLeave] = useState(null);
  const [editLeave, setEditLeave] = useState({
    id: '',
    type: '',
    start_date: '',
    end_date: '',
    reason: '',
    status: 'pending',
    admin_reason: ''
  });
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState({ name: '', code: '', default_balance: 0, description: '' });
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [currentLeaveId, setCurrentLeaveId] = useState(null);
  const [decisionStatus, setDecisionStatus] = useState('rejected');
  const [adminReason, setAdminReason] = useState('');
  const employee = getEmployee();
  const role = String(employee?.role || '').toLowerCase().trim();
  const isAdminOrManager =
    role === 'admin' ||
    role === 'manager' ||
    role === 'human_resources' ||
    role === 'human resources' ||
    role === 'human resource' ||
    role === 'humanresources' ||
    role === 'humanresource' ||
    role === 'hr' ||
    role === 'hr_manager' ||
    role === 'hr manager';

  const fallbackLeaveTypes = [
    { name: 'Casual Leave', code: 'CL', default_balance: 12, description: 'Personal kaam, emergency ya short break ke liye.' },
    { name: 'Sick Leave', code: 'SL', default_balance: 12, description: 'Bimari ya health issue ke liye.' },
    { name: 'Earned Leave / Privilege Leave', code: 'EL', default_balance: 24, description: 'Kaam karne ke badle accumulate hone wali leave.' },
    { name: 'Paid Leave', code: 'PL', default_balance: 0, description: 'Leave ke dauran salary milti hai.' },
    { name: 'Unpaid Leave', code: 'LWP', default_balance: 0, description: 'Salary ke bina leave.' },
    { name: 'Maternity Leave', code: 'ML', default_balance: 182, description: 'Mahila employees ke liye 26 weeks tak ki leave.' },
    { name: 'Paternity Leave', code: 'PTL', default_balance: 7, description: 'Male employees ke child birth ke time leave.' },
    { name: 'Bereavement Leave', code: 'BL', default_balance: 3, description: 'Family member ke nidhan par leave.' },
    { name: 'Marriage Leave', code: 'MRL', default_balance: 5, description: 'Marriage ke liye leave.' },
    { name: 'Compensatory Off', code: 'COMP', default_balance: 0, description: 'Holiday ya weekend duty ke badle leave.' },
    { name: 'Public Holidays', code: 'PH', default_balance: 0, description: 'National aur festival holidays.' },
    { name: 'Optional Holiday', code: 'RH', default_balance: 2, description: 'Employee ke choice se festival holiday.' }
  ];

  const normalizeLeaveTypeKey = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/\bleave\b/g, '')
      .replace(/[\s_-]+/g, '')
      .trim();

  const normalizeLeaveStatus = (value) => String(value || '').toLowerCase().trim();

  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const resolveLeaveTypeMeta = (value) => {
    const key = normalizeLeaveTypeKey(value);
    const allTypes = leaveTypes.length > 0 ? leaveTypes : fallbackLeaveTypes;
    const directMatch = allTypes.find((t) => {
      const nameKey = normalizeLeaveTypeKey(t?.name);
      const codeKey = normalizeLeaveTypeKey(t?.code);
      return key && (nameKey === key || codeKey === key);
    });
    if (directMatch) return directMatch;
    const optionMatch = leaveTypeOptions.find((option) => option.value === key);
    if (optionMatch) {
      return {
        name: optionMatch.label,
        code: optionMatch.code,
        description: optionMatch.description,
        default_balance: optionMatch.default_balance,
      };
    }
    return null;
  };

  const formatLeaveTypeLabel = (value) => {
    const meta = resolveLeaveTypeMeta(value);
    if (meta?.name) {
      return meta.code ? `${meta.name} (${meta.code})` : meta.name;
    }
    if (!value) return 'Leave';
    const text = String(value).replace(/[_-]+/g, ' ').trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const isOwnLeaveRequest = (leave) => Number(leave?.employee_id) === Number(employee?.id);
  const canViewLeaveRequest = (leave) => isAdminOrManager || isOwnLeaveRequest(leave);
  const canSelfEditLeaveRequest = (leave) =>
    isOwnLeaveRequest(leave) && normalizeLeaveStatus(leave?.status) !== 'approved';
  const canEditLeaveRequest = (leave) => isAdminOrManager || canSelfEditLeaveRequest(leave);
  const canReapplyLeaveRequest = (leave) =>
    !isAdminOrManager && isOwnLeaveRequest(leave) && ['rejected', 'cancelled'].includes(normalizeLeaveStatus(leave?.status));

  const IconCheck = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
  const IconX = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const statusLabels = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled'
  };

  const getDecisionConfig = (status) => {
    if (status === 'cancelled') {
      return {
        title: 'Cancel Leave',
        eyebrow: 'Cancellation Reason Required',
        label: 'Reason for Cancellation',
        placeholder: 'Please state why this leave request is being cancelled...',
        button: 'Confirm Cancellation',
        headerClass: 'bg-slate-700',
        labelClass: 'text-slate-700',
        focusClass: 'focus:ring-slate-500',
        buttonClass: 'bg-slate-700 hover:bg-slate-800 shadow-slate-500/20'
      };
    }
    return {
      title: 'Reject Application',
      eyebrow: 'Mandatory Feedback Required',
      label: 'Reason for Rejection',
      placeholder: 'Please state the reason for rejecting this leave request...',
      button: 'Confirm Rejection',
      headerClass: 'bg-red-600',
      labelClass: 'text-red-600',
      focusClass: 'focus:ring-red-500',
      buttonClass: 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
    };
  };

  const fmtDate = (v) => {
    if (!v) return '-';
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    if (typeof v === 'object') {
      // Common wrappers (e.g. Dayjs, nested date payloads)
      const nested = v.$d || v.date || v.value;
      if (nested && nested !== v) return fmtDate(nested);

      // Object-style date parts fallback
      const year = Number(v.year ?? v.y);
      const monthRaw = Number(v.month ?? v.M);
      const day = Number(v.day ?? v.date ?? v.d);
      if (Number.isFinite(year) && Number.isFinite(monthRaw) && Number.isFinite(day)) {
        const month = monthRaw >= 1 ? monthRaw : monthRaw + 1;
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    try {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch (_) {}
    return typeof v === 'object' ? '-' : s.slice(0, 10);
  };

  useEffect(() => {
    fetchLeaves();
    fetchLeaveTypes();
    fetchLeaveBalances();
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

  const fetchLeaveTypes = async () => {
    try {
      const resp = await api.get('/hrms/leave-types');
      if (resp.data?.success) setLeaveTypes(resp.data.data || []);
    } catch (_) {
      setLeaveTypes([]);
    }
  };

  const fetchLeaveBalances = async () => {
    const employeeId = Number(employee?.id) || 0;
    if (!employeeId) {
      setLeaveBalances([]);
      return;
    }
    try {
      const resp = await api.get(`/hrms/leave-balances?employee_id=${employeeId}`);
      if (resp.data?.success) {
        setLeaveBalances(resp.data.data || []);
      }
    } catch (_) {
      setLeaveBalances([]);
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

  const resetTypeForm = () => {
    setEditingType(null);
    setTypeForm({ name: '', code: '', default_balance: 0, description: '' });
  };

  const handleSaveLeaveType = async (e) => {
    e.preventDefault();
    if (!typeForm.name) return;
    try {
      if (editingType?.id) {
        await api.put(`/hrms/leave-types/${editingType.id}`, typeForm);
      } else {
        await api.post('/hrms/leave-types', typeForm);
      }
      resetTypeForm();
      fetchLeaveTypes();
      fetchLeaveBalances();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save leave type');
    }
  };

  const handleEditLeaveType = (t) => {
    setEditingType(t);
    setTypeForm({
      name: t.name || '',
      code: t.code || '',
      default_balance: t.default_balance || 0,
      description: t.description || '',
    });
  };

  const handleDeleteLeaveType = async (t) => {
    const ok = window.confirm(`Delete leave type "${t.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/hrms/leave-types/${t.id}`);
      fetchLeaveTypes();
      fetchLeaveBalances();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete leave type');
    }
  };

  const openDecisionModal = (leave, status) => {
    setCurrentLeaveId(leave.id);
    setDecisionStatus(status);
    setAdminReason('');
    setShowReasonModal(true);
  };

  const handleViewLeave = (leave) => {
    setViewLeave(leave);
    setShowViewModal(true);
  };

  const handleEditLeave = (leave) => {
    setEditLeave({
      id: leave.id,
      type: normalizeLeaveTypeKey(leave.type) || String(leave.type || ''),
      start_date: fmtDate(leave.start_date),
      end_date: fmtDate(leave.end_date),
      reason: leave.reason || '',
      status: leave.status || 'pending',
      admin_reason: leave.admin_reason || ''
    });
    setShowEditModal(true);
  };

  const handleStatusUpdate = async (id, status, reason = null) => {
    if (['rejected', 'cancelled'].includes(status) && !String(reason || '').trim()) {
      alert(status === 'cancelled' ? 'Cancellation reason is required' : 'Rejection reason is required');
      return;
    }
    try {
      const response = await api.put('/hrms/leaves', {
        id,
        status,
        admin_reason: reason
      });
      if (response.data.success) {
        fetchLeaves();
        fetchLeaveBalances();
        setShowReasonModal(false);
        setAdminReason('');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleSaveLeaveEdit = async (e) => {
    e.preventDefault();
    const isSelfUpdate = !isAdminOrManager;
    const nextStatus = isSelfUpdate ? 'pending' : (editLeave.status || 'pending');
    const needsAdminReason = !isSelfUpdate && ['rejected', 'cancelled'].includes(nextStatus);
    if (isSelfUpdate && !String(editLeave.reason || '').trim()) {
      alert('Reason is required');
      return;
    }
    if (needsAdminReason && !String(editLeave.admin_reason || '').trim()) {
      alert(nextStatus === 'cancelled' ? 'Cancellation reason is required' : 'Rejection reason is required');
      return;
    }
    try {
      const response = await api.put('/hrms/leaves', {
        ...editLeave,
        status: nextStatus,
        admin_reason: needsAdminReason ? editLeave.admin_reason : ''
      });
      if (response.data.success) {
        setShowEditModal(false);
        setViewLeave(null);
        fetchLeaves();
        fetchLeaveBalances();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update leave request');
    }
  };

  const matchesLeaveTypeFilter = (leaveType) => {
    if (!filter.type) return true;
    const selectedKey = normalizeLeaveTypeKey(filter.type);
    const rawKey = normalizeLeaveTypeKey(leaveType);
    if (rawKey && rawKey === selectedKey) return true;
    const allTypes = leaveTypes.length > 0 ? leaveTypes : fallbackLeaveTypes;
    const selectedType = allTypes.find((t) => {
      const nameKey = normalizeLeaveTypeKey(t?.name);
      const codeKey = normalizeLeaveTypeKey(t?.code);
      return nameKey === selectedKey || codeKey === selectedKey;
    });
    if (!selectedType) return false;
    const selectedKeys = new Set([
      normalizeLeaveTypeKey(selectedType.name),
      normalizeLeaveTypeKey(selectedType.code),
    ].filter(Boolean));
    const leaveTypeRow = allTypes.find((t) => {
      const nameKey = normalizeLeaveTypeKey(t?.name);
      const codeKey = normalizeLeaveTypeKey(t?.code);
      return nameKey === rawKey || codeKey === rawKey;
    });
    if (!leaveTypeRow) return false;
    const leaveKeys = [
      normalizeLeaveTypeKey(leaveTypeRow.name),
      normalizeLeaveTypeKey(leaveTypeRow.code),
    ].filter(Boolean);
    return leaveKeys.some((key) => selectedKeys.has(key));
  };

  const filteredLeaves = leaves.filter(leave => {
    return (filter.search === '' || leave.employee_name?.toLowerCase().includes(filter.search.toLowerCase())) &&
      (filter.status === '' || leave.status === filter.status) &&
      matchesLeaveTypeFilter(leave.type);
  });

  useEffect(() => {
    // Reset pagination when filters or dataset changes
    setLeavePage(0);
  }, [filter.search, filter.status, filter.type, leaves.length]);

  useEffect(() => {
    // Reset leave type pagination when list changes
    setLeaveTypePage(0);
  }, [leaveTypes.length]);

  const sortedLeaves = [...filteredLeaves].sort((a, b) => {
    // Prefer created_at when available; otherwise fallback to date/id.
    const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
    if (ta && tb && ta !== tb) return tb - ta;

    const da = a?.start_date ? new Date(a.start_date).getTime() : 0;
    const db = b?.start_date ? new Date(b.start_date).getTime() : 0;
    if (da && db && da !== db) return db - da;

    return (Number(b?.id) || 0) - (Number(a?.id) || 0);
  });

  const leaveTotalRows = sortedLeaves.length;
  const leaveTotalPages = Math.max(1, Math.ceil(leaveTotalRows / PAGE_SIZE));
  const leaveSafePage = Math.min(Math.max(leavePage, 0), leaveTotalPages - 1);
  const leaveStartIndex = leaveSafePage * PAGE_SIZE;
  const leaveEndIndex = Math.min(leaveStartIndex + PAGE_SIZE, leaveTotalRows);
  const paginatedLeaves = sortedLeaves.slice(leaveStartIndex, leaveEndIndex);

  const mergedLeaveTypes = (() => {
    const source = [...(leaveTypes || []), ...fallbackLeaveTypes];
    const map = new Map();
    for (const t of source) {
      const nameKey = normalizeLeaveTypeKey(t?.name);
      const codeKey = normalizeLeaveTypeKey(t?.code);
      const key = nameKey || codeKey;
      if (!key || map.has(key)) continue;
      map.set(key, t);
    }
    return Array.from(map.values());
  })();

  const sortedLeaveTypes = [...leaveTypes].sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0));
  const leaveTypeTotalRows = sortedLeaveTypes.length;
  const leaveTypeTotalPages = Math.max(1, Math.ceil(leaveTypeTotalRows / PAGE_SIZE));
  const leaveTypeSafePage = Math.min(Math.max(leaveTypePage, 0), leaveTypeTotalPages - 1);
  const leaveTypeStartIndex = leaveTypeSafePage * PAGE_SIZE;
  const leaveTypeEndIndex = Math.min(leaveTypeStartIndex + PAGE_SIZE, leaveTypeTotalRows);
  const paginatedLeaveTypes = sortedLeaveTypes.slice(leaveTypeStartIndex, leaveTypeEndIndex);
  const leaveTypeOptions = mergedLeaveTypes.map((t) => {
    const value = normalizeLeaveTypeKey(t.name || t.code);
    return {
      value,
      label: t.code ? `${t.name} (${t.code})` : (t.name || 'Leave'),
      code: t.code || '',
      description: t.description || '',
      default_balance: toNumber(t.default_balance),
    };
  });
  const leaveTypeLookup = leaveTypeOptions.reduce((acc, option) => {
    if (option.value) acc[option.value] = option;
    return acc;
  }, {});
  const leaveBalanceLookup = leaveBalances.reduce((acc, row) => {
    const keys = [
      normalizeLeaveTypeKey(row?.leave_type),
      normalizeLeaveTypeKey(row?.leave_type_code),
      normalizeLeaveTypeKey(row?.leave_type_id),
    ].filter(Boolean);
    for (const key of keys) acc[key] = row;
    return acc;
  }, {});
  const leaveTypeSelectOptions = leaveTypeOptions.map((option) => {
    const balanceRow = leaveBalanceLookup[option.value] || leaveBalanceLookup[normalizeLeaveTypeKey(option.code)];
    const totalBalance = toNumber(balanceRow?.total_balance ?? option.default_balance);
    const usedBalance = toNumber(balanceRow?.used_balance ?? Math.max(totalBalance - toNumber(balanceRow?.remaining_balance ?? totalBalance), 0));
    return {
      ...option,
      displayLabel: `${option.label}${totalBalance}/${usedBalance}`,
    };
  });
  const editTypeExists = leaveTypeOptions.some((option) => option.value === normalizeLeaveTypeKey(editLeave.type));
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' }
  ];
  const activeDecision = getDecisionConfig(decisionStatus);
  const editModalStatus = normalizeLeaveStatus(editLeave.status);
  const editModalIsSelfReapply = !isAdminOrManager && ['rejected', 'cancelled'].includes(editModalStatus);
  const editModalTitle = editModalIsSelfReapply ? 'Reapply Leave Request' : 'Edit Leave Request';
  const editModalSubtitle = editModalIsSelfReapply
    ? 'Update your request and resubmit it for approval'
    : 'Update dates, status and notes';
  const editModalActionLabel = editModalIsSelfReapply ? 'Reapply Leave' : 'Save Changes';

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
              {leaveTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
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
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full px-4 py-2 text-sm font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg text-center">
              {leaveTotalRows} Records Found
            </div>
          </div>
        </div>
      </div>

      {/* Standardized Table Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">SL No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Leave Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Date Range</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
              {/* Keep Actions always visible even when table scrolls horizontally */}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap sticky right-0 z-10 bg-gray-50 border-l border-gray-200">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && leaveTotalRows === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-2"></div>
                  <p>Loading records...</p>
                </td>
              </tr>
            ) : leaveTotalRows === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                  No records found matching your criteria.
                </td>
              </tr>
            ) : (
              paginatedLeaves.map((leave, index) => (
                <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-500">
                    {leaveStartIndex + index + 1}
                  </td>
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
                    <div className="text-sm text-gray-900 font-medium">{formatLeaveTypeLabel(leave.type)}</div>
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
                      <span className="font-medium">{fmtDate(leave.start_date)}</span>
                      <span className="mx-2 text-gray-400">to</span>
                      <span className="font-medium">{fmtDate(leave.end_date)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                        leave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          leave.status === 'cancelled' ? 'bg-slate-100 text-slate-800' :
                          'bg-yellow-100 text-yellow-800'}`}>
                      {statusLabels[leave.status] || (leave.status?.charAt(0).toUpperCase() + leave.status?.slice(1))}
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
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 z-10 bg-white border-l border-gray-100">
                    <div className="flex items-center justify-end space-x-2">
                      {canViewLeaveRequest(leave) && (
                        <button
                          onClick={() => handleViewLeave(leave)}
                          className="inline-flex items-center justify-center text-slate-700 hover:text-slate-900 bg-slate-50 w-10 h-10 rounded-lg hover:bg-slate-100 transition-all shadow-sm border border-slate-200"
                          title="View leave request"
                          aria-label="View leave request"
                        >
                          <i className="fas fa-eye text-sm"></i>
                        </button>
                      )}
                      {isAdminOrManager ? (
                        <>
                          <button
                            onClick={() => handleEditLeave(leave)}
                            className="inline-flex items-center justify-center text-blue-700 hover:text-blue-900 bg-blue-50 w-10 h-10 rounded-lg hover:bg-blue-100 transition-all shadow-sm border border-blue-100"
                            title="Edit leave request"
                            aria-label="Edit leave request"
                          >
                            <i className="fas fa-pen text-sm"></i>
                          </button>
                          {leave.status !== 'approved' && (
                            <button
                              onClick={() => handleStatusUpdate(leave.id, 'approved')}
                              className="inline-flex items-center justify-center text-green-700 hover:text-green-900 bg-green-50 w-10 h-10 rounded-lg hover:bg-green-100 transition-all shadow-sm border border-green-100"
                              title="Approve"
                              aria-label="Approve"
                            >
                              <IconCheck className="w-4 h-4" />
                            </button>
                          )}
                          {leave.status !== 'rejected' && (
                            <button
                              onClick={() => openDecisionModal(leave, 'rejected')}
                              className="inline-flex items-center justify-center text-red-700 hover:text-red-900 bg-red-50 w-10 h-10 rounded-lg hover:bg-red-100 transition-all shadow-sm border border-red-100"
                              title="Reject"
                              aria-label="Reject"
                            >
                              <IconX className="w-4 h-4" />
                            </button>
                          )}
                          {leave.status !== 'cancelled' && (
                            <button
                              onClick={() => openDecisionModal(leave, 'cancelled')}
                              className="inline-flex items-center justify-center text-slate-700 hover:text-slate-900 bg-slate-50 w-10 h-10 rounded-lg hover:bg-slate-100 transition-all shadow-sm border border-slate-200"
                              title="Cancel leave"
                              aria-label="Cancel leave"
                            >
                              <i className="fas fa-ban text-sm"></i>
                            </button>
                          )}
                        </>
                      ) : canSelfEditLeaveRequest(leave) ? (
                        <button
                          onClick={() => handleEditLeave(leave)}
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all shadow-sm border ${
                            canReapplyLeaveRequest(leave)
                              ? 'text-orange-700 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 border-orange-100'
                              : 'text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border-blue-100'
                          }`}
                          title={canReapplyLeaveRequest(leave) ? 'Reapply leave request' : 'Edit leave request'}
                          aria-label={canReapplyLeaveRequest(leave) ? 'Reapply leave request' : 'Edit leave request'}
                        >
                          <i className={`fas ${canReapplyLeaveRequest(leave) ? 'fa-sync-alt' : 'fa-pen'} text-sm`}></i>
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>

        {!loading && leaveTotalRows > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-white">
            <div className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{leaveStartIndex + 1}</span>-<span className="font-semibold text-gray-700">{leaveEndIndex}</span> of{' '}
              <span className="font-semibold text-gray-700">{leaveTotalRows}</span>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setLeavePage((p) => Math.max(0, p - 1))}
                disabled={leaveSafePage === 0}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="text-xs text-gray-500">
                Page <span className="font-semibold text-gray-700">{leaveSafePage + 1}</span> / <span className="font-semibold text-gray-700">{leaveTotalPages}</span>
              </div>
              <button
                type="button"
                onClick={() => setLeavePage((p) => Math.min(leaveTotalPages - 1, p + 1))}
                disabled={leaveSafePage >= leaveTotalPages - 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Professional Apply Leave Modal */}
      {
        showApplyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[1.5rem] w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
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
                      {leaveTypeSelectOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.displayLabel}
                        </option>
                      ))}
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

      {
        showViewModal && viewLeave && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[1.5rem] w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
              <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
                    <i className="fas fa-eye text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold leading-tight">Leave Request Details</h2>
                    <p className="text-[11px] opacity-75 uppercase tracking-widest font-black">View applied leave information</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                  aria-label="Close view modal"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">Employee</div>
                    <div className="text-xl font-bold text-slate-900">{viewLeave.employee_name || 'Employee'}</div>
                    <div className="text-sm text-slate-500">{viewLeave.designation || viewLeave.employee_role || 'Staff Member'}</div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    normalizeLeaveStatus(viewLeave.status) === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : normalizeLeaveStatus(viewLeave.status) === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : normalizeLeaveStatus(viewLeave.status) === 'cancelled'
                          ? 'bg-slate-100 text-slate-800'
                          : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {statusLabels[viewLeave.status] || (viewLeave.status?.charAt(0).toUpperCase() + viewLeave.status?.slice(1))}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 mb-1">Leave Type</div>
                    <div className="text-base font-semibold text-slate-900">{formatLeaveTypeLabel(viewLeave.type)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 mb-1">Date Range</div>
                    <div className="text-base font-semibold text-slate-900">
                      {fmtDate(viewLeave.start_date)} <span className="text-slate-400">to</span> {fmtDate(viewLeave.end_date)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 mb-1">Applied On</div>
                    <div className="text-base font-semibold text-slate-900">
                      {viewLeave.created_at ? new Date(viewLeave.created_at).toLocaleString() : '-'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 mb-1">Approved By</div>
                    <div className="text-base font-semibold text-slate-900">{viewLeave.approved_by_name || '-'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2">Employee Reason</div>
                    <div className="text-sm leading-6 text-slate-700 whitespace-pre-wrap">
                      {viewLeave.reason || 'No reason provided'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2">Admin Note</div>
                    <div className="text-sm leading-6 text-slate-700 whitespace-pre-wrap">
                      {viewLeave.admin_reason || 'No admin note available'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-slate-100">
                  {canEditLeaveRequest(viewLeave) && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowViewModal(false);
                        handleEditLeave(viewLeave);
                      }}
                      className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm border ${
                        canReapplyLeaveRequest(viewLeave)
                          ? 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100'
                          : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
                      }`}
                    >
                      {canReapplyLeaveRequest(viewLeave) ? 'Reapply' : 'Edit'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowViewModal(false)}
                    className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        showEditModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[1.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
              <div className="bg-blue-700 p-5 text-white flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-pen text-lg"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{editModalTitle}</h2>
                    <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">{editModalSubtitle}</p>
                  </div>
                </div>
                <button onClick={() => setShowEditModal(false)} className="text-white hover:text-gray-200 transition-colors">
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>

              <form onSubmit={handleSaveLeaveEdit} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1.5 ml-1">Leave Type</label>
                    <select
                      value={editLeave.type}
                      onChange={(e) => setEditLeave({ ...editLeave, type: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      required
                    >
                      {editLeave.type && !editTypeExists && (
                        <option value={normalizeLeaveTypeKey(editLeave.type)}>{formatLeaveTypeLabel(editLeave.type)}</option>
                      )}
                      {leaveTypeSelectOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.displayLabel}</option>
                      ))}
                    </select>
                  </div>
                  {isAdminOrManager ? (
                    <div>
                      <label className="block text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1.5 ml-1">Status</label>
                      <select
                        value={editLeave.status}
                        onChange={(e) => {
                          const nextStatus = e.target.value;
                          setEditLeave({
                            ...editLeave,
                            status: nextStatus,
                            admin_reason: ['rejected', 'cancelled'].includes(nextStatus) ? editLeave.admin_reason : ''
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1.5">Current Status</div>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                        editModalStatus === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : editModalStatus === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : editModalStatus === 'cancelled'
                              ? 'bg-slate-100 text-slate-800'
                              : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {statusLabels[editLeave.status] || (editLeave.status?.charAt(0).toUpperCase() + editLeave.status?.slice(1))}
                      </span>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1.5 ml-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={editLeave.start_date}
                      onChange={(e) => setEditLeave({ ...editLeave, start_date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1.5 ml-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={editLeave.end_date}
                      onChange={(e) => setEditLeave({ ...editLeave, end_date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1.5 ml-1">Employee Reason</label>
                  <textarea
                    rows="3"
                    required={!isAdminOrManager}
                    value={editLeave.reason}
                    onChange={(e) => setEditLeave({ ...editLeave, reason: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder={editModalIsSelfReapply ? 'Update the reason and reapply for approval' : 'Add or update the leave reason'}
                  ></textarea>
                </div>

                {!isAdminOrManager && editModalIsSelfReapply && editLeave.admin_reason && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <div className="text-[10px] font-black uppercase tracking-widest mb-1">Previous rejection note</div>
                    <div className="leading-6 whitespace-pre-wrap">{editLeave.admin_reason}</div>
                  </div>
                )}

                {isAdminOrManager && ['rejected', 'cancelled'].includes(editLeave.status) && (
                  <div>
                    <label className="block text-[10px] font-black text-red-600 uppercase tracking-widest mb-1.5 ml-1">
                      {editLeave.status === 'cancelled' ? 'Cancellation Reason' : 'Rejection Reason'}
                    </label>
                    <textarea
                      rows="3"
                      required
                      value={editLeave.admin_reason}
                      onChange={(e) => setEditLeave({ ...editLeave, admin_reason: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                      placeholder={editLeave.status === 'cancelled' ? 'Why is this leave being cancelled?' : 'Why is this leave being rejected?'}
                    ></textarea>
                  </div>
                )}

                <div className="pt-5 border-t border-slate-100 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all"
                  >
                    {editModalActionLabel}
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
              <div className={`${activeDecision.headerClass} p-5 text-white flex items-center justify-between`}>
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <i className={`${decisionStatus === 'cancelled' ? 'fas fa-ban' : 'fas fa-comment-slash'} text-xl`}></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{activeDecision.title}</h2>
                    <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">{activeDecision.eyebrow}</p>
                  </div>
                </div>
                <button onClick={() => setShowReasonModal(false)} className="text-white hover:text-gray-200 transition-colors">
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>

              <div className="p-6">
                <label className={`block text-[10px] font-black ${activeDecision.labelClass} uppercase tracking-widest mb-1.5 ml-1`}>{activeDecision.label}</label>
                <textarea
                  rows="4"
                  required
                  value={adminReason}
                  onChange={(e) => setAdminReason(e.target.value)}
                  className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 ${activeDecision.focusClass} transition-all mb-6`}
                  placeholder={activeDecision.placeholder}
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
                    onClick={() => handleStatusUpdate(currentLeaveId, decisionStatus, adminReason)}
                    disabled={!adminReason.trim()}
                    className={`px-8 py-2.5 ${activeDecision.buttonClass} text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all disabled:opacity-50`}
                  >
                    {activeDecision.button}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {isAdminOrManager && (
        <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Leave Types & Default Balance</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <form onSubmit={handleSaveLeaveType} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Leave Type</label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Code</label>
                <input
                  type="text"
                  value={typeForm.code}
                  onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Default Balance</label>
                <input
                  type="number"
                  value={typeForm.default_balance}
                  onChange={(e) => setTypeForm({ ...typeForm, default_balance: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description</label>
                <textarea
                  rows="4"
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="Leave policy aur usage note likhein"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
                  {editingType ? 'Update' : 'Add'}
                </button>
                {editingType && (
                  <button type="button" onClick={resetTypeForm} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="lg:col-span-2">
              {leaveTypes.length === 0 ? (
                <p className="text-sm text-slate-500">No leave types configured.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">SL No</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Default</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedLeaveTypes.map((t, index) => (
                        <tr key={t.id}>
                          <td className="px-4 py-3 text-slate-500 font-semibold">{leaveTypeStartIndex + index + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                          <td className="px-4 py-3 text-slate-600">{t.code || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{t.default_balance || 0}</td>
                          <td className="px-4 py-3 text-slate-600 max-w-[280px]">
                            <div className="truncate" title={t.description || ''}>
                              {t.description || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button onClick={() => handleEditLeaveType(t)} className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteLeaveType(t)} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100">
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {leaveTypeTotalRows > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-white">
                      <div className="text-xs text-slate-500">
                        Showing <span className="font-semibold text-slate-700">{leaveTypeStartIndex + 1}</span>-<span className="font-semibold text-slate-700">{leaveTypeEndIndex}</span> of{' '}
                        <span className="font-semibold text-slate-700">{leaveTypeTotalRows}</span>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setLeaveTypePage((p) => Math.max(0, p - 1))}
                          disabled={leaveTypeSafePage === 0}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <div className="text-xs text-slate-500">
                          Page <span className="font-semibold text-slate-700">{leaveTypeSafePage + 1}</span> / <span className="font-semibold text-slate-700">{leaveTypeTotalPages}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLeaveTypePage((p) => Math.min(leaveTypeTotalPages - 1, p + 1))}
                          disabled={leaveTypeSafePage >= leaveTypeTotalPages - 1}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div >
  );
}

