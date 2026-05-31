import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

export default function CompanyManagement() {
    const navigate = useNavigate();
    // Get employee once and memoize so the object reference stays stable
    const employeeRef = React.useRef(getEmployee());
    const employee = employeeRef.current;
    
    const [companies, setCompanies] = useState([]);
    const pageSize = 10;
    const [page, setPage] = useState(1);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [formData, setFormData] = useState({ company_name: '', domain: '', email: '', phone: '', subscription_plan_id: '', password: '' });
    const [editModal, setEditModal] = useState({ open: false, company: null, form: { company_name: '', domain: '', email: '', phone: '', subscription_plan_id: '' } });
    const [modulesModal, setModulesModal] = useState({ open: false, company: null, modules: [], selected: [] });
    const [resetPasswordModal, setResetPasswordModal] = useState({ open: false, company: null, password: '', confirmPassword: '', success: false, loading: false, error: '' });

    // Use employee?.id (a primitive) as dependency â€” not the whole object
    const employeeId = employee?.id;

    useEffect(() => {
        const role = normalizeRole(employee?.role);
        if (!employee || (role !== 'superadmin' && role !== 'super_admin')) {
            navigate('/');
            return;
        }

        let aborted = false;
        const fetchData = async () => {
            try {
                setLoading(true);
                setError('');
                const [compRes, plansRes] = await Promise.all([
                    api.get('/superadmin/companies'),
                    api.get('/superadmin/subscriptions')
                ]);
                
                if (aborted) return;

                if (compRes.data?.success) setCompanies(compRes.data.data || []);
                if (plansRes.data?.success) setPlans(plansRes.data.data || []);
            } catch (err) {
                if (aborted) return;
                console.error(err);
                if (!err.response || err.code === 'ERR_NETWORK') {
                    setError('Cannot connect to backend. Start the Node server on port 3000.');
                } else {
                    setError(err.response?.data?.message || 'Failed to load data.');
                }
            } finally {
                if (!aborted) setLoading(false);
            }
        };

        fetchData();
        return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employeeId, navigate]);

    const fetchData = async () => {
        // This function is now kept for manual retries/refreshes
        try {
            setLoading(true);
            setError('');
            const [compRes, plansRes] = await Promise.all([
                api.get('/superadmin/companies'),
                api.get('/superadmin/subscriptions')
            ]);
            if (compRes.data?.success) setCompanies(compRes.data.data || []);
            if (plansRes.data?.success) setPlans(plansRes.data.data || []);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to refresh data.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCompany = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/superadmin/companies', formData);
            if (res.data?.success) {
                setIsAddOpen(false);
                setFormData({ company_name: '', domain: '', email: '', phone: '', subscription_plan_id: '', password: '' });
                fetchData();
            } else {
                alert(res.data?.message || 'Error occurred');
            }
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    useEffect(() => {
        setPage(1);
    }, [companies.length]);

    const sortedCompanies = (Array.isArray(companies) ? companies : []).slice().sort((a, b) => {
        const aId = Number(a?.id) || 0;
        const bId = Number(b?.id) || 0;
        return bId - aId;
    });

    const totalPages = Math.max(1, Math.ceil(sortedCompanies.length / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const pageRows = sortedCompanies.slice(startIndex, startIndex + pageSize);

    const openEdit = (company) => {
        setEditModal({
            open: true,
            company,
            form: {
                company_name: company.company_name || '',
                domain: company.domain || '',
                email: company.email || '',
                phone: company.phone || '',
                subscription_plan_id: company.subscription_plan_id || '',
            },
        });
    };

    const handleEditSave = async (e) => {
        e.preventDefault();
        if (!editModal.company) return;
        try {
            const res = await api.put(`/superadmin/companies/${editModal.company.id}`, editModal.form);
            if (res.data?.success) {
                setEditModal({ open: false, company: null, form: { company_name: '', domain: '', email: '', phone: '', subscription_plan_id: '' } });
                fetchData();
            } else {
                alert(res.data?.message || 'Update failed');
            }
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        const { company, password, confirmPassword } = resetPasswordModal;
        if (!company) return;
        if (password !== confirmPassword) {
            setResetPasswordModal(prev => ({ ...prev, error: 'Passwords do not match' }));
            return;
        }
        if (password.length < 6) {
            setResetPasswordModal(prev => ({ ...prev, error: 'Password must be at least 6 characters' }));
            return;
        }
        
        setResetPasswordModal(prev => ({ ...prev, loading: true, error: '' }));
        try {
            const res = await api.post(`/superadmin/companies/${company.id}/reset-password`, { password });
            if (res.data?.success) {
                setResetPasswordModal(prev => ({ ...prev, success: true, loading: false }));
                setTimeout(() => {
                    setResetPasswordModal({ open: false, company: null, password: '', confirmPassword: '', success: false, loading: false, error: '' });
                }, 2000);
            } else {
                setResetPasswordModal(prev => ({ ...prev, error: res.data?.message || 'Password reset failed', loading: false }));
            }
        } catch (err) {
            setResetPasswordModal(prev => ({
                ...prev,
                error: err.response?.data?.message || 'Something went wrong',
                loading: false
            }));
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        if (!window.confirm(`Are you sure you want to ${newStatus} this company?`)) return;
        
        try {
            const res = await api.patch(`/superadmin/companies/${id}/status`, { status: newStatus });
            if (res.data?.success) fetchData();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-6 py-5 shadow-sm mb-6">
                <div className="pointer-events-none absolute inset-0 opacity-10">
                    <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-slate-200 blur-2xl" />
                    <div className="absolute right-10 -bottom-10 h-48 w-48 rounded-full bg-slate-300 blur-3xl" />
                </div>
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Company Management</h1>
                        <p className="text-slate-500 text-sm mt-1">Provision and manage SaaS tenants</p>
                    </div>
                    <button 
                        onClick={() => setIsAddOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                        New Tenant
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg flex items-center justify-between">
                    <div>{error}</div>
                    <button
                        onClick={fetchData}
                        className="text-sm font-semibold text-rose-700 hover:text-rose-900"
                    >
                        Retry
                    </button>
                </div>
            )}

            {isAddOpen && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Provision New Company</h2>
                        <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                    <form onSubmit={handleAddCompany} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Company Name *</label>
                            <input required type="text" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300" placeholder="Acme Corp" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Subdomain / Domain</label>
                            <input type="text" value={formData.domain} onChange={e => setFormData({...formData, domain: e.target.value})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300" placeholder="acme.yourcrm.com" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Primary Email</label>
                            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300" placeholder="admin@acme.com" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Phone</label>
                            <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Subscription Plan</label>
                            <select value={formData.subscription_plan_id} onChange={e => setFormData({...formData, subscription_plan_id: e.target.value})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300">
                                <option value="">Select Plan...</option>
                                {plans.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} (${p.price}/{p.billing_cycle})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Admin Password *</label>
                            <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300" placeholder="password123" />
                        </div>
                        <div className="md:col-span-2 lg:col-span-1 flex items-end">
                            <button type="submit" className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-sm transition">
                                Create Tenant
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-slate-50">
                            <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
                                <th className="px-6 py-4">Sl No</th>
                                <th className="px-6 py-4">Company Details</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Plan & Modules</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pageRows.map((c, idx) => (
                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                                        {startIndex + idx + 1}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-900">{c.company_name}</div>
                                        <div className="text-xs text-slate-500">{c.domain || 'No domain attached'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-slate-900">{c.email || 'N/A'}</div>
                                        <div className="text-xs text-slate-500">{c.phone || 'N/A'}</div>
                                        <div className="text-[11px] text-slate-400">Users: {c.total_users ?? 0} Â· Leads: {c.total_leads ?? 0} Â· Deals: {c.total_deals ?? 0}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-slate-800">{c.plan_name || 'Legacy Custom'}</div>
                                        <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate">
                                            {(c.modules_included || []).join(', ')}
                                        </div>
                                        <div className="text-[11px] text-slate-400 mt-1">
                                            Storage: {c.storage_mb ?? 0} MB Â· API: {c.api_requests ?? 0} Â· Last: {c.last_activity || 'â€”'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 text-[10px] font-semibold uppercase rounded-full border ${
                                            c.subscription_status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                            c.subscription_status === 'suspended' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}>
                                            {c.subscription_status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => toggleStatus(c.id, c.subscription_status)}
                                                title={c.subscription_status === 'active' ? 'Suspend Company' : 'Activate Company'}
                                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                                    c.subscription_status === 'active' 
                                                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                }`}
                                            >
                                                <i className={`fas ${c.subscription_status === 'active' ? 'fa-ban' : 'fa-check-circle'} text-sm`}></i>
                                            </button>
                                            
                                            <button 
                                                onClick={() => openEdit(c)}
                                                title="Edit Company"
                                                className="w-9 h-9 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all"
                                            >
                                                <i className="fas fa-edit text-sm"></i>
                                            </button>

                                            <button 
                                                onClick={() => setResetPasswordModal({ open: true, company: c, password: '', confirmPassword: '', success: false, loading: false, error: '' })}
                                                title="Reset Admin Password"
                                                className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center transition-all"
                                            >
                                                <i className="fas fa-key text-sm"></i>
                                            </button>

                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await api.get(`/superadmin/modules/company/${c.id}`);
                                                        if (res.data?.success) {
                                                            setModulesModal({
                                                                open: true,
                                                                company: c,
                                                                modules: res.data.data.modules || [],
                                                                selected: res.data.data.module_ids || [],
                                                            });
                                                        }
                                                    } catch (err) {
                                                        alert(err.response?.data?.message || err.message);
                                                    }
                                                }}
                                                title="Manage Modules"
                                                className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-all"
                                            >
                                                <i className="fas fa-cubes text-sm"></i>
                                            </button>

                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm('Delete this company?')) return;
                                                    await api.delete(`/superadmin/companies/${c.id}`);
                                                    fetchData();
                                                }}
                                                title="Delete Company"
                                                className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-all"
                                            >
                                                <i className="fas fa-trash-alt text-sm"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {sortedCompanies.length === 0 && (
                        <div className="py-12 text-center text-gray-500">
                            No companies found. Click "New Tenant" to provision one.
                        </div>
                    )}
                </div>

                {sortedCompanies.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/30">
                        <div className="text-sm text-slate-500">
                            Showing <span className="font-semibold text-slate-900">{startIndex + 1}</span> to{' '}
                            <span className="font-semibold text-slate-900">{Math.min(startIndex + pageSize, sortedCompanies.length)}</span> of{' '}
                            <span className="font-semibold text-slate-900">{sortedCompanies.length}</span> companies
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                <i className="fas fa-chevron-left mr-2 text-[10px]"></i> Previous
                            </button>
                            <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">
                                {safePage} <span className="text-slate-400 font-medium mx-1">/</span> {totalPages}
                            </div>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                Next <i className="fas fa-chevron-right ml-2 text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {editModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditModal({ open: false, company: null, form: { company_name: '', domain: '', email: '', phone: '', subscription_plan_id: '' } })}>
                    <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Edit Company</p>
                                <h3 className="text-xl font-semibold text-slate-900">{editModal.company?.company_name}</h3>
                            </div>
                            <button
                                onClick={() => setEditModal({ open: false, company: null, form: { company_name: '', domain: '', email: '', phone: '', subscription_plan_id: '' } })}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleEditSave} className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-700">Company Name *</label>
                                <input
                                    required
                                    type="text"
                                    value={editModal.form.company_name}
                                    onChange={e => setEditModal(prev => ({ ...prev, form: { ...prev.form, company_name: e.target.value } }))}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-700">Subdomain / Domain</label>
                                <input
                                    type="text"
                                    value={editModal.form.domain}
                                    onChange={e => setEditModal(prev => ({ ...prev, form: { ...prev.form, domain: e.target.value } }))}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-700">Primary Email</label>
                                <input
                                    type="email"
                                    value={editModal.form.email}
                                    onChange={e => setEditModal(prev => ({ ...prev, form: { ...prev.form, email: e.target.value } }))}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-700">Phone</label>
                                <input
                                    type="text"
                                    value={editModal.form.phone}
                                    onChange={e => setEditModal(prev => ({ ...prev, form: { ...prev.form, phone: e.target.value } }))}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-700">Subscription Plan</label>
                                <select
                                    value={editModal.form.subscription_plan_id}
                                    onChange={e => setEditModal(prev => ({ ...prev, form: { ...prev.form, subscription_plan_id: e.target.value } }))}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                                >
                                    <option value="">Select Plan...</option>
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} (${p.price}/{p.billing_cycle})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2 lg:col-span-1 flex items-end justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditModal({ open: false, company: null, form: { company_name: '', domain: '', email: '', phone: '', subscription_plan_id: '' } })}
                                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modulesModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModulesModal({ open: false, company: null, modules: [], selected: [] })}>
                    <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Modules</p>
                                <h3 className="text-xl font-semibold text-slate-900">{modulesModal.company?.company_name}</h3>
                            </div>
                            <button
                                onClick={() => setModulesModal({ open: false, company: null, modules: [], selected: [] })}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {modulesModal.modules.map((m) => {
                                    const checked = modulesModal.selected.includes(m.id);
                                    return (
                                        <label key={m.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => {
                                                    setModulesModal((prev) => {
                                                        const set = new Set(prev.selected);
                                                        if (e.target.checked) set.add(m.id); else set.delete(m.id);
                                                        return { ...prev, selected: Array.from(set) };
                                                    });
                                                }}
                                            />
                                            <div>
                                                <p className="font-semibold text-slate-900">{m.name}</p>
                                                <p className="text-xs text-slate-500">{m.description || 'Module'}</p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setModulesModal({ open: false, company: null, modules: [], selected: [] })}
                                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await api.post('/superadmin/modules/assign-company', {
                                                company_id: modulesModal.company.id,
                                                module_ids: modulesModal.selected,
                                            });
                                            setModulesModal({ open: false, company: null, modules: [], selected: [] });
                                        } catch (err) {
                                            alert(err.response?.data?.message || err.message);
                                        }
                                    }}
                                    className="px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {resetPasswordModal.open && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200" 
                    onClick={() => setResetPasswordModal({ open: false, company: null, password: '', confirmPassword: '', success: false, loading: false, error: '' })}
                >
                    <div 
                        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transform transition-all duration-300 scale-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-50/50">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                                    <i className="fas fa-key text-sm"></i>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800">Security Access</p>
                                    <h3 className="text-lg font-bold text-slate-900">Reset Credentials</h3>
                                </div>
                            </div>
                            <button
                                onClick={() => setResetPasswordModal({ open: false, company: null, password: '', confirmPassword: '', success: false, loading: false, error: '' })}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>

                        {resetPasswordModal.success ? (
                            <div className="p-8 text-center space-y-3">
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                                    </svg>
                                </div>
                                <h4 className="text-xl font-bold text-slate-900">Password Reset Done!</h4>
                                <p className="text-sm text-slate-500">Credentials updated for company admin.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase">Tenant Details</div>
                                    <div className="text-sm font-semibold text-slate-900">{resetPasswordModal.company?.company_name}</div>
                                    <div className="text-xs text-slate-500 font-medium">User ID / Email: <span className="text-slate-700">{resetPasswordModal.company?.email}</span></div>
                                </div>

                                {resetPasswordModal.error && (
                                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-2">
                                        <i className="fas fa-exclamation-circle"></i>
                                        <span>{resetPasswordModal.error}</span>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-600 block">New Password *</label>
                                    <div className="relative">
                                        <input
                                            required
                                            type="password"
                                            value={resetPasswordModal.password}
                                            onChange={e => setResetPasswordModal(prev => ({ ...prev, password: e.target.value, error: '' }))}
                                            placeholder="Minimum 6 characters"
                                            className="w-full px-4 py-2 pl-10 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
                                        />
                                        <i className="fas fa-lock absolute left-3.5 top-3 text-slate-400 text-xs"></i>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-600 block">Confirm New Password *</label>
                                    <div className="relative">
                                        <input
                                            required
                                            type="password"
                                            value={resetPasswordModal.confirmPassword}
                                            onChange={e => setResetPasswordModal(prev => ({ ...prev, confirmPassword: e.target.value, error: '' }))}
                                            placeholder="Repeat password"
                                            className="w-full px-4 py-2 pl-10 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
                                        />
                                        <i className="fas fa-lock absolute left-3.5 top-3 text-slate-400 text-xs"></i>
                                    </div>
                                    {resetPasswordModal.password && resetPasswordModal.confirmPassword && (
                                        <div className="flex items-center gap-1.5 mt-1 text-xs">
                                            {resetPasswordModal.password === resetPasswordModal.confirmPassword ? (
                                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                                    <i className="fas fa-check-circle"></i> Passwords match
                                                </span>
                                            ) : (
                                                <span className="text-rose-600 font-semibold flex items-center gap-1">
                                                    <i className="fas fa-times-circle"></i> Passwords do not match
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setResetPasswordModal({ open: false, company: null, password: '', confirmPassword: '', success: false, loading: false, error: '' })}
                                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={resetPasswordModal.loading || !resetPasswordModal.password || resetPasswordModal.password !== resetPasswordModal.confirmPassword}
                                        className="px-5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                    >
                                        {resetPasswordModal.loading ? (
                                            <>
                                                <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Updating...
                                            </>
                                        ) : (
                                            'Reset Password'
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
