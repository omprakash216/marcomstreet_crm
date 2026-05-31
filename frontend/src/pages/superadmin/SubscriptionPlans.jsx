import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

const AVAILABLE_MODULES = [
    'CRM', 'Projects', 'Tasks', 'Finance', 'Reports',
    'HRMS', 'Attendance', 'Leaves', 'Payroll', 'API', 'Inventory', 'Chat'
];

export default function SubscriptionPlans() {
    const navigate = useNavigate();
    // Keep a stable employee reference to avoid re-running effects on every render
    const employeeRef = React.useRef(getEmployee());
    const employee = employeeRef.current;
    const role = normalizeRole(employee?.role);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [viewPlan, setViewPlan] = useState(null);
    const [subscriptions, setSubscriptions] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [assignForm, setAssignForm] = useState({ company_id: '', plan_id: '', billing_cycle: 'monthly', status: 'active' });

    const [formData, setFormData] = useState({
        id: null, name: '', price: '', billing_cycle: 'monthly',
        user_limit: 10, storage_limit_gb: 5, modules_included: []
    });

    const employeeId = employee?.id;

    useEffect(() => {
        if (!employee || (role !== 'superadmin' && role !== 'super_admin')) {
            navigate('/');
            return;
        }

        let aborted = false;

        const run = async () => {
            try {
                setLoading(true);
                const [pl, subs, inv] = await Promise.all([
                    api.get('/superadmin/subscriptions'),
                    api.get('/superadmin/subscriptions/list'),
                    api.get('/superadmin/subscriptions/invoices'),
                ]);
                if (!aborted && pl.data?.success) setPlans(pl.data.data || []);
                if (!aborted && subs.data?.success) setSubscriptions(subs.data.data || []);
                if (!aborted && inv.data?.success) setInvoices(inv.data.data || []);
            } catch (err) {
                if (!aborted) console.error(err);
            } finally {
                if (!aborted) setLoading(false);
            }
        };

        run();

        return () => { aborted = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employeeId, navigate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [pl, subs, inv] = await Promise.all([
                api.get('/superadmin/subscriptions'),
                api.get('/superadmin/subscriptions/list'),
                api.get('/superadmin/subscriptions/invoices'),
            ]);
            if (pl.data?.success) setPlans(pl.data.data || []);
            if (subs.data?.success) setSubscriptions(subs.data.data || []);
            if (inv.data?.success) setInvoices(inv.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEdit = (plan = null) => {
        if (plan) {
            setFormData({
                id: plan.id, name: plan.name, price: plan.price,
                billing_cycle: plan.billing_cycle, user_limit: plan.user_limit,
                storage_limit_gb: plan.storage_limit_gb,
                modules_included: plan.modules_included || []
            });
        } else {
            setFormData({
                id: null, name: '', price: '', billing_cycle: 'monthly',
                user_limit: 10, storage_limit_gb: 5, modules_included: []
            });
        }
        setIsAddOpen(true);
    };

    const handleOpenView = (plan) => {
        setViewPlan(plan || null);
    };

    const handleCloseView = () => {
        setViewPlan(null);
    };

    const toggleModule = (mod) => {
        const current = formData.modules_included;
        if (current.includes(mod)) {
            setFormData({ ...formData, modules_included: current.filter(m => m !== mod) });
        } else {
            setFormData({ ...formData, modules_included: [...current, mod] });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/superadmin/subscriptions', formData);
            if (res.data?.success) {
                setIsAddOpen(false);
                fetchData();
            } else {
                alert(res.data?.message || 'Error occurred');
            }
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/superadmin/subscriptions/assign', assignForm);
            if (res.data?.success) {
                setAssignForm({ company_id: '', plan_id: '', billing_cycle: 'monthly', status: 'active' });
                fetchData();
            }
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
        <div className="min-h-screen bg-slate-50/50 pb-12 overflow-x-hidden">
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Classic Header Section */}
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-6 py-5 shadow-sm mb-8">
                    <div className="pointer-events-none absolute inset-0 opacity-10">
                        <div className="absolute -left-10 -top-12 h-44 w-44 rounded-full bg-slate-200 blur-2xl" />
                        <div className="absolute right-6 -bottom-12 h-52 w-52 rounded-full bg-slate-300 blur-3xl" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-700">
                                <i className="fas fa-layer-group text-lg"></i>
                            </div>
                            <div>
                                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Subscription Plans</h1>
                                <p className="text-slate-500 text-sm mt-1">Manage SaaS tiers, limits, and module access</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleOpenEdit(null)}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition shadow-sm active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            <span>New Plan</span>
                        </button>
                    </div>
                </div>

                {isAddOpen && (
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 mb-10 relative overflow-hidden animate-in slide-in-from-top-4 duration-500">
                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
                        <button onClick={() => setIsAddOpen(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <h2 className="text-xl font-bold text-slate-900 mb-8 flex items-center">
                            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3">
                                <i className={`fas ${formData.id ? 'fa-edit' : 'fa-plus'} text-xs`}></i>
                            </span>
                            {formData.id ? 'Edit Subscription Tier' : 'Configure New Tier'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Plan Identity</label>
                                    <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" placeholder="E.g. Enterprise Elite" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Pricing (₹)</label>
                                    <input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-indigo-600" placeholder="0.00" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Duration</label>
                                    <select value={formData.billing_cycle} onChange={e => setFormData({ ...formData, billing_cycle: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium">
                                        <option value="monthly">Monthly Cycle</option>
                                        <option value="yearly">Yearly Cycle</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">User Capacity</label>
                                    <input required type="number" value={formData.user_limit} onChange={e => setFormData({ ...formData, user_limit: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Storage (GB)</label>
                                    <input required type="number" value={formData.storage_limit_gb} onChange={e => setFormData({ ...formData, storage_limit_gb: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <label className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-4 block">Module Access Matrix</label>
                                <div className="flex flex-wrap gap-2.5">
                                    {AVAILABLE_MODULES.map(mod => {
                                        const isActive = formData.modules_included.includes(mod);
                                        return (
                                            <button
                                                key={mod}
                                                type="button"
                                                onClick={() => toggleModule(mod)}
                                                className={`px-5 py-2.5 rounded-full text-xs font-bold border-2 transition-all duration-200 ${isActive
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                                                    }`}
                                            >
                                                {isActive && <i className="fas fa-check-circle mr-2"></i>}
                                                {mod}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 flex justify-end items-center space-x-4">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">
                                    {formData.id ? 'Save Changes' : 'Publish Plan'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Table View */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-widest">Active Subscription Tiers</h3>
                        <div className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-semibold tracking-widest uppercase border border-slate-200">
                            {plans.length} Plans
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="px-6 py-4 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">Sl No</th>
                                    <th className="px-6 py-4 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">Plan Details</th>
                                    <th className="px-6 py-4 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">Pricing</th>
                                    <th className="px-6 py-4 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">Capacity</th>
                                    <th className="px-6 py-4 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">Modules</th>
                                    <th className="px-6 py-4 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {plans.map((p, index) => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-5 text-sm text-slate-500 font-medium">
                                            {(index + 1).toString().padStart(2, '0')}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                                                    <i className="fas fa-gem text-xs"></i>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                                                    <div className="text-[11px] text-slate-500">Tier ID: #SUP_{p.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-center">
                                            <div className="text-base font-semibold text-slate-900">₹{parseFloat(p.price).toFixed(2)}</div>
                                            <div className="text-[11px] text-slate-500 capitalize">{p.billing_cycle}</div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-center">
                                            <div className="inline-flex items-center gap-2">
                                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200">
                                                    {p.user_limit} Users
                                                </span>
                                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200">
                                                    {p.storage_limit_gb} GB
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-wrap gap-1.5 max-w-[320px]">
                                                {p.modules_included?.slice(0, 4).map(mod => (
                                                    <span key={mod} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                                                        {mod}
                                                    </span>
                                                ))}
                                                {p.modules_included?.length > 4 && (
                                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-semibold">
                                                        +{p.modules_included.length - 4} more
                                                    </span>
                                                )}
                                                {(!p.modules_included || p.modules_included.length === 0) && (
                                                    <span className="text-xs text-slate-400">No modules</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenEdit(p)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white text-slate-700 hover:bg-slate-900 hover:text-white transition-all border border-slate-200 shadow-sm"
                                                    title="Edit Plan"
                                                >
                                                    <i className="fas fa-edit text-xs"></i>
                                                </button>
                                                <button
                                                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white text-slate-700 hover:bg-slate-900 hover:text-white transition-all border border-slate-200 shadow-sm"
                                                    title="View Details"
                                                    onClick={() => handleOpenView(p)}
                                                >
                                                    <i className="fas fa-eye text-xs"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {plans.length === 0 && !isAddOpen && (
                        <div className="py-20 text-center">
                            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <i className="fas fa-layer-group text-slate-300 text-3xl"></i>
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 mb-2">No Plans Configured</h4>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto">Click on 'Design New Plan' to create your first subscription tier.</p>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Assign Subscription to Company</h2>
                    </div>
                    <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <input
                            type="number"
                            value={assignForm.company_id}
                            onChange={(e) => setAssignForm({ ...assignForm, company_id: e.target.value })}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            placeholder="Company ID"
                            required
                        />
                        <select
                            value={assignForm.plan_id}
                            onChange={(e) => setAssignForm({ ...assignForm, plan_id: e.target.value })}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            required
                        >
                            <option value="">Select Plan</option>
                            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select
                            value={assignForm.billing_cycle}
                            onChange={(e) => setAssignForm({ ...assignForm, billing_cycle: e.target.value })}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                        <select
                            value={assignForm.status}
                            onChange={(e) => setAssignForm({ ...assignForm, status: e.target.value })}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="active">Active</option>
                            <option value="trial">Trial</option>
                            <option value="suspended">Suspended</option>
                        </select>
                        <button className="bg-slate-900 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-slate-800">Assign</button>
                    </form>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Active Subscriptions</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-semibold tracking-[0.12em]">
                                <tr>
                                    <th className="px-4 py-2">Company</th>
                                    <th className="px-4 py-2">Plan</th>
                                    <th className="px-4 py-2">Status</th>
                                    <th className="px-4 py-2">Billing</th>
                                    <th className="px-4 py-2">Trial End</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {subscriptions.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 text-sm font-semibold text-slate-900">{s.company_name || `#${s.company_id}`}</td>
                                        <td className="px-4 py-2 text-sm text-slate-700">{s.plan_name || `#${s.plan_id}`}</td>
                                        <td className="px-4 py-2 text-sm text-slate-700">{s.status}</td>
                                        <td className="px-4 py-2 text-sm text-slate-700">{s.billing_cycle}</td>
                                        <td className="px-4 py-2 text-sm text-slate-500">{s.trial_end || '—'}</td>
                                    </tr>
                                ))}
                                {subscriptions.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-4 text-sm text-slate-500 text-center">No subscriptions yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Invoices</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-semibold tracking-[0.12em]">
                                <tr>
                                    <th className="px-4 py-2">Invoice</th>
                                    <th className="px-4 py-2">Company</th>
                                    <th className="px-4 py-2">Plan</th>
                                    <th className="px-4 py-2">Amount</th>
                                    <th className="px-4 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {invoices.map(inv => (
                                    <tr key={inv.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 text-sm font-semibold text-slate-900">{inv.invoice_number || `INV-${inv.id}`}</td>
                                        <td className="px-4 py-2 text-sm text-slate-700">{inv.company_name || '—'}</td>
                                        <td className="px-4 py-2 text-sm text-slate-700">{inv.plan_name || '—'}</td>
                                        <td className="px-4 py-2 text-sm text-slate-700">₹{parseFloat(inv.amount || 0).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-2 text-sm text-slate-700">{inv.status}</td>
                                    </tr>
                                ))}
                                {invoices.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-4 text-sm text-slate-500 text-center">No invoices.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </main>

            {viewPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={handleCloseView}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-indigo-700 to-slate-900 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <i className="fas fa-eye text-white"></i>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{viewPlan.name || 'Subscription Plan'}</h3>
                                    <p className="text-indigo-200 text-xs font-medium">Tier ID: #SUP_{viewPlan.id}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseView}
                                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                                title="Close"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Price</p>
                                    <p className="text-xl font-black text-slate-900 mt-2">
                                        ₹{parseFloat(viewPlan.price || 0).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">
                                        {viewPlan.billing_cycle || 'monthly'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">User Limit</p>
                                    <p className="text-xl font-black text-slate-900 mt-2">{viewPlan.user_limit || 0}</p>
                                    <p className="text-xs text-slate-500 mt-1">Active users allowed</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Storage</p>
                                    <p className="text-xl font-black text-slate-900 mt-2">{viewPlan.storage_limit_gb || 0} GB</p>
                                    <p className="text-xs text-slate-500 mt-1">Total storage limit</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Modules Included</p>
                                <div className="flex flex-wrap gap-2">
                                    {(viewPlan.modules_included || []).map((mod) => (
                                        <span key={mod} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
                                            {mod}
                                        </span>
                                    ))}
                                    {(!viewPlan.modules_included || viewPlan.modules_included.length === 0) && (
                                        <span className="text-sm text-slate-400">No modules configured</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
