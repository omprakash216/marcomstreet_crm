import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useLocation, useNavigate } from 'react-router-dom';

const ACCESS_MODULES = [
    { key: 'crm', label: 'CRM' },
    { key: 'leads', label: 'Leads' },
    { key: 'meetings', label: 'Meetings' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'followups', label: 'Follow-ups' },
    { key: 'quotations', label: 'Quotations' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'reports', label: 'Reports' },
    { key: 'hrms', label: 'HRMS' },
    { key: 'hrms_attendance', label: 'Attendance' },
    { key: 'hrms_leaves', label: 'Leaves' },
    { key: 'hrms_salary', label: 'Salary' },
    { key: 'hrms_documents', label: 'Documents' },
];

const emptyCreateForm = {
    name: '',
    email: '',
    phone: '',
    password: 'password123',
    role: 'employee',
    company_id: '',
    access_modules: [],
};

const emptyEditForm = {
    name: '',
    email: '',
    phone: '',
    role: 'employee',
    status: 'active',
    company_id: '',
    access_modules: [],
    newPassword: '',
    confirmPassword: '',
};

const createTemporaryPassword = () => {
    const token = Math.random().toString(36).slice(2, 8).toUpperCase();
    const pin = Math.floor(100 + Math.random() * 900);
    return `User@${token}${pin}`;
};

export default function GlobalUsers({
    rolePreset = 'all',
    title = 'Global User Management',
    description = 'Search, filter, export, create, and control users across all tenants.',
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const employeeRef = React.useRef(getEmployee());
    const employee = employeeRef.current;
    const employeeId = employee?.id;
    const normalizedRolePreset = normalizeRole(rolePreset);

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [companies, setCompanies] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState(normalizedRolePreset === 'all' ? 'all' : normalizedRolePreset);
    const [companyFilter, setCompanyFilter] = useState('all');
    const [page, setPage] = useState(0);
    const pageSize = 10;
    const [viewUser, setViewUser] = useState(null);
    const [editUser, setEditUser] = useState(null);
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [resetUser, setResetUser] = useState(null);
    const [resetForm, setResetForm] = useState({ email: '', newPassword: '', confirmPassword: '' });
    const [resetSaving, setResetSaving] = useState(false);
    const [resetSuccess, setResetSuccess] = useState('');
    const [createForm, setCreateForm] = useState({
        ...emptyCreateForm,
        role: normalizedRolePreset === 'all' ? 'employee' : normalizedRolePreset,
    });

    useEffect(() => {
        const controller = new AbortController();
        const role = normalizeRole(employee?.role);

        if (!employee || (role !== 'superadmin' && role !== 'super_admin')) {
            navigate('/');
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                const [res, comps] = await Promise.all([
                    api.get('/superadmin/users', { signal: controller.signal }),
                    api.get('/superadmin/companies', { signal: controller.signal }).catch(() => ({ data: { success: true, data: [] } })),
                ]);
                if (res.data?.success) setUsers(res.data.data || []);
                if (comps.data?.success) setCompanies(comps.data.data || []);
            } catch (err) {
                if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
                    console.error('Error fetching users:', err);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        return () => controller.abort();
    }, [employeeId, navigate, employee?.role]);

    useEffect(() => {
        const nextRole = normalizedRolePreset === 'all' ? 'all' : normalizedRolePreset;
        setRoleFilter(nextRole);
        setCreateForm((prev) => ({
            ...prev,
            role: normalizedRolePreset === 'all' ? prev.role || 'employee' : normalizedRolePreset,
        }));
    }, [normalizedRolePreset]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('create') === '1') {
            setIsCreateOpen(true);
        }
    }, [location.search]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/users');
            if (res.data?.success) {
                setUsers(res.data.data || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openView = (u) => setViewUser(u);
    const closeView = () => setViewUser(null);

    const openEdit = (u) => {
        setEditUser(u);
        setEditForm({
            name: u?.name || '',
            email: u?.email || '',
            phone: u?.phone || '',
            role: u?.role || 'employee',
            status: u?.status || 'active',
            company_id: u?.company_id ? String(u.company_id) : '',
            access_modules: Array.isArray(u?.access_modules) ? u.access_modules : [],
            newPassword: '',
            confirmPassword: '',
        });
    };
    const closeEdit = () => {
        setEditUser(null);
        setEditForm(emptyEditForm);
    };

    const closeCreate = () => {
        setIsCreateOpen(false);
        setCreateForm({
            ...emptyCreateForm,
            role: normalizedRolePreset === 'all' ? 'employee' : normalizedRolePreset,
        });
    };

    const saveCreate = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...createForm,
                company_id: createForm.company_id ? Number(createForm.company_id) : null,
                access_modules: createForm.access_modules || [],
            };
            const res = await api.post('/superadmin/users', payload);
            if (res.data?.success) {
                await fetchUsers();
                closeCreate();
            }
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        if (!editUser?.id) return;
        const newPassword = String(editForm.newPassword || '').trim();
        const confirmPassword = String(editForm.confirmPassword || '').trim();
        if (newPassword || confirmPassword) {
            if (newPassword.length < 6) {
                return alert('Password must be at least 6 characters');
            }
            if (newPassword !== confirmPassword) {
                return alert('Passwords do not match');
            }
        }
        try {
            const payload = {
                name: editForm.name,
                email: editForm.email,
                phone: editForm.phone,
                role: editForm.role,
                status: editForm.status,
                company_id: editForm.company_id ? Number(editForm.company_id) : null,
                access_modules: editForm.access_modules || [],
            };
            const res = await api.patch(`/superadmin/users/${editUser.id}`, payload);
            if (res.data?.success) {
                if (newPassword) {
                    await api.post(`/superadmin/users/${editUser.id}/reset-password`, {
                        password: newPassword,
                    });
                }
                await fetchUsers();
                closeEdit();
            }
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const generateEditPassword = () => {
        const password = createTemporaryPassword();
        setEditForm(prev => ({
            ...prev,
            newPassword: password,
            confirmPassword: password,
        }));
    };

    const deleteUser = async (u) => {
        if (!u?.id) return;
        if (!window.confirm(`Delete user "${u.name}"?`)) return;
        try {
            const res = await api.delete(`/superadmin/users/${u.id}`);
            if (res.data?.success) {
                await fetchUsers();
            }
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const handleDeactivate = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'deactivated' : 'active';
        if (!window.confirm(`Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} this user?`)) return;

        try {
            const res = await api.patch(`/superadmin/users/${id}`, { status: newStatus });
            if (res.data?.success) {
                fetchUsers();
            }
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const openResetPassword = (u) => {
        setResetUser(u);
        setResetForm({ email: u?.email || '', newPassword: '', confirmPassword: '' });
        setResetSuccess('');
    };
    const closeResetPassword = () => {
        setResetUser(null);
        setResetForm({ email: '', newPassword: '', confirmPassword: '' });
        setResetSuccess('');
    };

    const saveResetPassword = async (e) => {
        e.preventDefault();
        if (!resetUser?.id) return;
        if (!resetForm.newPassword || resetForm.newPassword.length < 6) {
            return alert('Password must be at least 6 characters');
        }
        if (resetForm.newPassword !== resetForm.confirmPassword) {
            return alert('Passwords do not match');
        }
        try {
            setResetSaving(true);
            // Update email if changed
            if (resetForm.email && resetForm.email !== resetUser.email) {
                await api.patch(`/superadmin/users/${resetUser.id}`, { email: resetForm.email });
            }
            // Reset password
            const res = await api.post(`/superadmin/users/${resetUser.id}/reset-password`, {
                password: resetForm.newPassword,
            });
            if (res.data?.success) {
                setResetSuccess(`Password reset successfully for ${resetForm.email}`);
                await fetchUsers();
                setTimeout(() => closeResetPassword(), 2000);
            }
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        } finally {
            setResetSaving(false);
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch =
            (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.company_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
        const matchesRole = roleFilter === 'all' || normalizeRole(u.role) === roleFilter;
        const matchesCompany = companyFilter === 'all' || u.company_name === companyFilter;
        return matchesSearch && matchesStatus && matchesRole && matchesCompany;
    });

    // Reset pagination when filters/search change
    useEffect(() => {
        setPage(0);
    }, [searchTerm, statusFilter, roleFilter, companyFilter]);

    const totalRows = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const startIndex = safePage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRows);
    const pagedUsers = filteredUsers.slice(startIndex, endIndex);

    const exportCSV = () => {
        if (filteredUsers.length === 0) {
            alert('No users to export for current filters.');
            return;
        }
        const header = ['Name', 'Email', 'Company', 'Role', 'Status'];
        const rows = filteredUsers.map(u => [
            `"${u.name || ''}"`,
            `"${u.email || ''}"`,
            `"${u.company_name || ''}"`,
            `"${u.role || ''}"`,
            `"${u.status || ''}"`,
        ]);
        const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-export-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const uniqueCompanies = Array.from(new Set(users.map(u => u.company_name).filter(Boolean))).sort();
    const uniqueRoles = Array.from(new Set(users.map(u => normalizeRole(u.role)))).filter(Boolean).sort();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="global-users-page space-y-6 pb-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-6 py-5 shadow-sm mb-6">
                <div className="pointer-events-none absolute inset-0 opacity-10">
                    <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-slate-200 blur-2xl" />
                    <div className="absolute right-10 -bottom-10 h-48 w-48 rounded-full bg-slate-300 blur-3xl" />
                </div>

                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
                        <p className="text-slate-500 text-sm mt-1">{description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => setIsCreateOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition shadow-sm"
                        >
                            <i className="fas fa-user-plus"></i>
                            New User
                        </button>
                        <button
                            onClick={exportCSV}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg transition shadow-sm hover:bg-slate-50"
                        >
                            <i className="fas fa-file-export"></i>
                            Export CSV
                        </button>
                        <button
                            onClick={fetchUsers}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg transition shadow-sm hover:bg-slate-50"
                        >
                            <i className="fas fa-sync-alt"></i>
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search name, email, company..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-10 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        />
                        <svg className="w-5 h-5 absolute left-3 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm text-sm font-medium text-slate-700 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    >
                        <option value="all">Status: All</option>
                        <option value="active">Status: Active</option>
                        <option value="deactivated">Status: Deactivated</option>
                    </select>
                    {normalizedRolePreset === 'all' ? (
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm text-sm font-medium text-slate-700 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        >
                            <option value="all">Role: All</option>
                            {uniqueRoles.map(r => (
                                <option key={r} value={r}>Role: {r}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="w-full px-4 py-2.5 rounded-xl border border-indigo-100 bg-indigo-50 text-sm font-bold text-indigo-700">
                            Role: {normalizedRolePreset}
                        </div>
                    )}
                    <select
                        value={companyFilter}
                        onChange={(e) => setCompanyFilter(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm text-sm font-medium text-slate-700 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    >
                        <option value="all">Company: All</option>
                        {uniqueCompanies.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {isCreateOpen && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Create User</h2>
                        <button onClick={closeCreate} className="text-slate-400 hover:text-slate-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <form onSubmit={saveCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <Field label="Name" value={createForm.name} onChange={(name) => setCreateForm({ ...createForm, name })} required />
                        <Field label="Email" type="email" value={createForm.email} onChange={(email) => setCreateForm({ ...createForm, email })} required />
                        <Field label="Phone" value={createForm.phone} onChange={(phone) => setCreateForm({ ...createForm, phone })} />
                        <Field label="Password" value={createForm.password} onChange={(password) => setCreateForm({ ...createForm, password })} required />
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Role</label>
                            <select
                                value={createForm.role}
                                disabled={normalizedRolePreset !== 'all'}
                                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-70"
                            >
                                <option value="employee">employee</option>
                                <option value="admin">admin</option>
                                <option value="manager">manager</option>
                                <option value="human_resources">human_resources</option>
                                <option value="designer_manager">designer_manager</option>
                                <option value="superadmin">superadmin</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Company</label>
                            <select
                                value={createForm.company_id}
                                onChange={(e) => setCreateForm({ ...createForm, company_id: e.target.value })}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                            >
                                <option value="">No company</option>
                                {companies.map((c) => (
                                    <option key={c.id} value={c.id}>{c.company_name || `Company #${c.id}`}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2 lg:col-span-3">
                            <label className="text-sm font-semibold text-slate-700">Module Access</label>
                            <ModuleAccessPicker
                                value={createForm.access_modules}
                                onChange={(access_modules) => setCreateForm({ ...createForm, access_modules })}
                            />
                        </div>
                        <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3">
                            <button type="button" onClick={closeCreate} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition shadow-sm">Create User</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-[960px] w-full text-left whitespace-nowrap">
                        <thead className="bg-slate-50">
                            <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
                                <th className="px-6 py-4">Sl No</th>
                                <th className="px-6 py-4">Full Name & Email</th>
                                <th className="px-6 py-4">Tenant Company</th>
                                <th className="px-6 py-4">System Role</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pagedUsers.map((user, index) => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                                        {startIndex + index + 1}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                                {user.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-900">{user.name}</div>
                                                <div className="text-xs text-slate-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-slate-800">{user.company_name || <span className="text-slate-400 italic">No Company</span>}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex px-2.5 py-1 text-[10px] font-semibold uppercase rounded-md bg-slate-100 text-slate-700">
                                            {normalizeRole(user.role)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 text-[10px] font-semibold uppercase rounded-full border ${user.status === 'active'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openView(user)}
                                                title="View Details"
                                                className="w-9 h-9 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all shadow-sm"
                                            >
                                                <i className="fas fa-eye text-sm"></i>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openEdit(user)}
                                                title="Edit User"
                                                className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-all shadow-sm"
                                            >
                                                <i className="fas fa-edit text-sm"></i>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openResetPassword(user)}
                                                title="Reset Password"
                                                className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 flex items-center justify-center transition-all shadow-sm"
                                            >
                                                <i className="fas fa-key text-sm"></i>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeactivate(user.id, user.status)}
                                                title={user.status === 'active' ? 'Suspend User' : 'Activate User'}
                                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                                                    user.status === 'active' 
                                                    ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                }`}
                                            >
                                                <i className={`fas ${user.status === 'active' ? 'fa-user-slash' : 'fa-user-check'} text-sm`}></i>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteUser(user)}
                                                title="Delete User"
                                                className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-all shadow-sm"
                                            >
                                                <i className="fas fa-trash-alt text-sm"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredUsers.length === 0 && (
                    <div className="py-20 text-center">
                        <div className="text-gray-300 text-5xl mb-4">🔍</div>
                        <p className="text-gray-500 font-medium">No users found matching your search criteria.</p>
                    </div>
                )}

                {!loading && totalRows > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/30">
                        <div className="text-sm text-slate-500">
                            Showing <span className="font-semibold text-slate-900">{startIndex + 1}</span> to{' '}
                            <span className="font-semibold text-slate-900">{Math.min(endIndex, totalRows)}</span> of{' '}
                            <span className="font-semibold text-slate-900">{totalRows}</span> users
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={safePage === 0}
                                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                <i className="fas fa-chevron-left mr-2 text-[10px]"></i> Previous
                            </button>
                            <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">
                                {safePage + 1} <span className="text-slate-400 font-medium mx-1">/</span> {totalPages}
                            </div>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={safePage >= totalPages - 1}
                                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                Next <i className="fas fa-chevron-right ml-2 text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* View Modal */}
            {viewUser && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">User Details</h2>
                            <button onClick={closeView} className="text-slate-500 hover:text-slate-800">✕</button>
                        </div>
                        <div className="p-6 space-y-3 text-sm">
                            <div className="flex justify-between gap-4"><span className="text-slate-500">Name</span><span className="font-semibold text-slate-900">{viewUser.name}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-slate-500">Email</span><span className="font-semibold text-slate-900">{viewUser.email}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-slate-500">Phone</span><span className="font-semibold text-slate-900">{viewUser.phone || '-'}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-slate-500">Company</span><span className="font-semibold text-slate-900">{viewUser.company_name || '-'}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-slate-500">Role</span><span className="font-semibold text-slate-900">{normalizeRole(viewUser.role)}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-slate-500">Status</span><span className="font-semibold text-slate-900">{viewUser.status}</span></div>
                            <div>
                                <span className="text-slate-500">Access Modules</span>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {(viewUser.access_modules || []).length ? (
                                        viewUser.access_modules.map((moduleKey) => (
                                            <span key={moduleKey} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                                                {moduleKey}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs font-semibold text-slate-400">Default access by role</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button onClick={() => { closeView(); openEdit(viewUser); }} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition">Edit</button>
                            <button onClick={closeView} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editUser && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-2xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">Edit User</h2>
                            <button onClick={closeEdit} className="text-slate-500 hover:text-slate-800">✕</button>
                        </div>
                        <form onSubmit={saveEdit} className="p-6 space-y-4 max-h-[calc(92vh-73px)] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600">Name</label>
                                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600">Phone</label>
                                    <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-slate-600">Email</label>
                                    <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none" />
                                </div>
                                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <label className="text-xs font-semibold text-slate-600">Update Password</label>
                                        <button
                                            type="button"
                                            onClick={generateEditPassword}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-100 hover:bg-indigo-50 transition"
                                        >
                                            <i className="fas fa-sync-alt text-[10px]"></i>
                                            Generate
                                        </button>
                                    </div>
                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500">New Password</label>
                                            <input
                                                type="text"
                                                minLength={6}
                                                value={editForm.newPassword}
                                                onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                                                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-indigo-500 outline-none"
                                                placeholder="Leave blank to keep current"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500">Confirm Password</label>
                                            <input
                                                type="text"
                                                minLength={6}
                                                value={editForm.confirmPassword}
                                                onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                                                className={`mt-1 w-full px-3 py-2 rounded-lg border bg-white outline-none ${
                                                    editForm.confirmPassword && editForm.confirmPassword !== editForm.newPassword
                                                        ? 'border-red-300 focus:border-red-500'
                                                        : editForm.confirmPassword && editForm.confirmPassword === editForm.newPassword
                                                        ? 'border-emerald-300 focus:border-emerald-500'
                                                        : 'border-slate-200 focus:border-indigo-500'
                                                }`}
                                                placeholder="Repeat password"
                                            />
                                            {editForm.confirmPassword && editForm.confirmPassword !== editForm.newPassword && (
                                                <p className="mt-1 text-[11px] font-semibold text-red-500">Passwords do not match</p>
                                            )}
                                            {editForm.confirmPassword && editForm.confirmPassword === editForm.newPassword && (
                                                <p className="mt-1 text-[11px] font-semibold text-emerald-600">Passwords match</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600">Role</label>
                                    <input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600">Status</label>
                                    <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none">
                                        <option value="active">active</option>
                                        <option value="deactivated">deactivated</option>
                                        <option value="blocked">blocked</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-slate-600">Company</label>
                                    <select value={editForm.company_id} onChange={(e) => setEditForm({ ...editForm, company_id: e.target.value })}
                                        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none">
                                        <option value="">No company</option>
                                        {companies.map((c) => (
                                            <option key={c.id} value={c.id}>{c.company_name || `Company #${c.id}`}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-slate-600">Module Access</label>
                                    <ModuleAccessPicker
                                        value={editForm.access_modules}
                                        onChange={(access_modules) => setEditForm({ ...editForm, access_modules })}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button type="button" onClick={closeEdit} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetUser && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-orange-50 to-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                                    <i className="fas fa-key text-lg"></i>
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Reset Credentials</h2>
                                    <p className="text-xs text-slate-500">Update login email &amp; password</p>
                                </div>
                            </div>
                            <button onClick={closeResetPassword} className="text-slate-400 hover:text-slate-700 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {resetSuccess ? (
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                                    <i className="fas fa-check-circle text-3xl"></i>
                                </div>
                                <p className="text-lg font-semibold text-emerald-700">{resetSuccess}</p>
                                <p className="text-sm text-slate-500 mt-2">User can now login with the new credentials.</p>
                            </div>
                        ) : (
                            <form onSubmit={saveResetPassword} className="p-6 space-y-5">
                                {/* User Info */}
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                        {(resetUser.name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900 text-sm">{resetUser.name}</p>
                                        <p className="text-xs text-slate-500">{resetUser.company_name || 'No Company'} · <span className="uppercase font-bold text-indigo-600">{normalizeRole(resetUser.role)}</span></p>
                                    </div>
                                </div>

                                {/* Email / User ID */}
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Email (User ID)</label>
                                    <input
                                        type="email"
                                        required
                                        value={resetForm.email}
                                        onChange={(e) => setResetForm({ ...resetForm, email: e.target.value })}
                                        className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none text-sm"
                                        placeholder="user@company.com"
                                    />
                                    {resetForm.email !== resetUser.email && (
                                        <p className="mt-1 text-xs text-amber-600 font-medium">
                                            <i className="fas fa-exclamation-triangle mr-1"></i>
                                            Email will be updated from <strong>{resetUser.email}</strong>
                                        </p>
                                    )}
                                </div>

                                {/* New Password */}
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wide text-slate-600">New Password</label>
                                    <input
                                        type="text"
                                        required
                                        minLength={6}
                                        value={resetForm.newPassword}
                                        onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                                        className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none text-sm"
                                        placeholder="Minimum 6 characters"
                                    />
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Confirm Password</label>
                                    <input
                                        type="text"
                                        required
                                        minLength={6}
                                        value={resetForm.confirmPassword}
                                        onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                                        className={`mt-1 w-full px-3 py-2.5 rounded-lg border bg-slate-50 focus:bg-white outline-none text-sm ${
                                            resetForm.confirmPassword && resetForm.confirmPassword !== resetForm.newPassword
                                                ? 'border-red-300 focus:border-red-500'
                                                : resetForm.confirmPassword && resetForm.confirmPassword === resetForm.newPassword
                                                ? 'border-emerald-300 focus:border-emerald-500'
                                                : 'border-slate-200 focus:border-indigo-500'
                                        }`}
                                        placeholder="Re-enter password"
                                    />
                                    {resetForm.confirmPassword && resetForm.confirmPassword !== resetForm.newPassword && (
                                        <p className="mt-1 text-xs text-red-500 font-medium">
                                            <i className="fas fa-times-circle mr-1"></i>Passwords do not match
                                        </p>
                                    )}
                                    {resetForm.confirmPassword && resetForm.confirmPassword === resetForm.newPassword && (
                                        <p className="mt-1 text-xs text-emerald-600 font-medium">
                                            <i className="fas fa-check-circle mr-1"></i>Passwords match
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button type="button" onClick={closeResetPassword} className="px-4 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition text-sm">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={resetSaving || !resetForm.newPassword || resetForm.newPassword !== resetForm.confirmPassword}
                                        className="px-5 py-2.5 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {resetSaving ? (
                                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Resetting...</>
                                        ) : (
                                            <><i className="fas fa-key"></i> Reset Password</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {false && isCreateOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">Create User</h2>
                            <button onClick={closeCreate} className="text-slate-500 hover:text-slate-800">×</button>
                        </div>
                        <form onSubmit={saveCreate} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Name" value={createForm.name} onChange={(name) => setCreateForm({ ...createForm, name })} required />
                                <Field label="Phone" value={createForm.phone} onChange={(phone) => setCreateForm({ ...createForm, phone })} />
                                <Field className="md:col-span-2" label="Email" type="email" value={createForm.email} onChange={(email) => setCreateForm({ ...createForm, email })} required />
                                <Field label="Password" value={createForm.password} onChange={(password) => setCreateForm({ ...createForm, password })} required />
                                <div>
                                    <label className="text-xs font-semibold text-slate-600">Role</label>
                                    <select
                                        value={createForm.role}
                                        disabled={normalizedRolePreset !== 'all'}
                                        onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                                        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none disabled:opacity-70"
                                    >
                                        <option value="employee">employee</option>
                                        <option value="admin">admin</option>
                                        <option value="manager">manager</option>
                                        <option value="human_resources">human_resources</option>
                                        <option value="designer_manager">designer_manager</option>
                                        <option value="superadmin">superadmin</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-slate-600">Company</label>
                                    <select
                                        value={createForm.company_id}
                                        onChange={(e) => setCreateForm({ ...createForm, company_id: e.target.value })}
                                        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
                                    >
                                        <option value="">No company</option>
                                        {companies.map((c) => (
                                            <option key={c.id} value={c.id}>{c.company_name || `Company #${c.id}`}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-slate-600">Module Access</label>
                                    <ModuleAccessPicker
                                        value={createForm.access_modules}
                                        onChange={(access_modules) => setCreateForm({ ...createForm, access_modules })}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button type="button" onClick={closeCreate} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function Field({ label, value, onChange, type = 'text', required = false, className = '' }) {
    return (
        <div className={`space-y-1 ${className}`}>
            <label className="text-sm font-semibold text-slate-700">{label}</label>
            <input
                type={type}
                required={required}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
        </div>
    );
}

function ModuleAccessPicker({ value = [], onChange }) {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (key) => {
        if (selected.includes(key)) {
            onChange(selected.filter((item) => item !== key));
        } else {
            onChange([...selected, key]);
        }
    };

    return (
        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {ACCESS_MODULES.map((module) => (
                <label key={module.key} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                        type="checkbox"
                        checked={selected.includes(module.key)}
                        onChange={() => toggle(module.key)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {module.label}
                </label>
            ))}
        </div>
    );
}
