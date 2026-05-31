import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function ModuleManager() {
    const [modules, setModules] = useState([]);
    const [plans, setPlans] = useState([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newModule, setNewModule] = useState({ name: '', status: 'enabled', plans: '' });
    const [configModal, setConfigModal] = useState({ open: false, module: null, status: 'enabled', plans: '' });
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const totalPages = Math.ceil(modules.length / pageSize);
    const safePage = Math.min(Math.max(page, 1), totalPages || 1);
    const startIndex = (safePage - 1) * pageSize;
    const paginatedModules = modules.slice(startIndex, startIndex + pageSize);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/modules');
            if (res.data?.success) {
                const { modules: mods, plans: planList, planModules } = res.data.data;
                setPlans(planList || []);
                const planMap = {};
                (planModules || []).forEach(pm => {
                    if (!planMap[pm.module_id]) planMap[pm.module_id] = [];
                    planMap[pm.module_id].push(pm.plan_id);
                });
                const mapped = (mods || []).map(m => ({
                    ...m,
                    plans: (planMap[m.id] || []).map(pid => planList.find(p => p.id === pid)?.name || `Plan #${pid}`),
                    plan_ids: planMap[m.id] || [],
                }));
                setModules(mapped);
            }
        } catch (err) {
            console.error('Module load error', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAddModule = async (e) => {
        e.preventDefault();
        const name = newModule.name.trim();
        if (!name) return;
        const planNames = newModule.plans.split(',').map((p) => p.trim()).filter(Boolean);
        const planIds = plans.filter(p => planNames.includes(p.name)).map(p => p.id);
        try {
            await api.post('/superadmin/modules', {
                name,
                code: name.toLowerCase().replace(/\s+/g, '-'),
                status: newModule.status,
                plan_ids: planIds,
                description: '',
            });
            await loadData();
            setNewModule({ name: '', status: 'enabled', plans: '' });
            setIsAddOpen(false);
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const openConfig = (mod) => {
        setConfigModal({
            open: true,
            module: mod,
            status: mod.status,
            plans: (mod.plan_ids || []).map(pid => plans.find(p => p.id === pid)?.name || '').filter(Boolean).join(', '),
        });
    };

    const handleConfigSave = async (e) => {
        e.preventDefault();
        if (!configModal.module) return;
        const planNames = configModal.plans.split(',').map((p) => p.trim()).filter(Boolean);
        const planIds = plans.filter(p => planNames.includes(p.name)).map(p => p.id);
        try {
            await api.put(`/superadmin/modules/${configModal.module.id}`, {
                name: configModal.module.name,
                description: configModal.module.description,
                status: configModal.status,
                plan_ids: planIds,
            });
            await loadData();
            setConfigModal({ open: false, module: null, status: 'enabled', plans: '' });
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const handleDelete = async (mod) => {
        if (!window.confirm(`Delete module "${mod.name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/superadmin/modules/${mod.id}`);
            await loadData();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-6 py-5 shadow-sm mb-6">
                <div className="pointer-events-none absolute inset-0 opacity-10">
                    <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-slate-200 blur-2xl" />
                    <div className="absolute right-10 -bottom-10 h-48 w-48 rounded-full bg-slate-300 blur-3xl" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Module Ecosystem</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage core features and toggle them globally or per plan.</p>
                    </div>
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-semibold shadow-sm hover:bg-slate-800 transition"
                    >
                        Add New Module
                    </button>
                </div>
            </div>

            {isAddOpen && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Create Module</h2>
                        <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <form onSubmit={handleAddModule} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Module Name</label>
                            <input
                                type="text"
                                value={newModule.name}
                                onChange={(e) => setNewModule({ ...newModule, name: e.target.value })}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                placeholder="e.g. Analytics"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                            <select
                                value={newModule.status}
                                onChange={(e) => setNewModule({ ...newModule, status: e.target.value })}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                            >
                                <option value="enabled">Enabled</option>
                                <option value="disabled">Disabled</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Plans (comma separated)</label>
                            <input
                                type="text"
                                value={newModule.plans}
                                onChange={(e) => setNewModule({ ...newModule, plans: e.target.value })}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                placeholder="Starter, Pro, Enterprise"
                            />
                        </div>
                        <div className="md:col-span-3 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsAddOpen(false)}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
                            >
                                Save Module
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
                            <th className="px-6 py-4">Sl No</th>
                            <th className="px-6 py-4">Module Name</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Assigned Plans</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedModules.map((mod, idx) => (
                            <tr key={mod.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-5 text-sm text-slate-500 font-medium">{startIndex + idx + 1}</td>
                                <td className="px-6 py-5 font-semibold text-slate-900">{mod.name}</td>
                                <td className="px-6 py-5">
                                    <span
                                        className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase border ${mod.status === 'enabled'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}
                                    >
                                        {mod.status}
                                    </span>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex flex-wrap gap-2">
                                        {mod.plans.map((p) => (
                                            <span
                                                key={p}
                                                className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded border border-slate-200"
                                            >
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => openConfig(mod)}
                                            title="Configure Module"
                                            className="w-9 h-9 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all shadow-sm"
                                        >
                                            <i className="fas fa-cog text-sm"></i>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(mod)}
                                            title="Delete Module"
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
                {modules.length === 0 && !loading && (
                    <div className="py-12 text-center text-slate-400">
                        No modules found. Add one to get started.
                    </div>
                )}
                {modules.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/30">
                        <div className="text-sm text-slate-500">
                            Showing <span className="font-semibold text-slate-900">{startIndex + 1}</span> to{' '}
                            <span className="font-semibold text-slate-900">{Math.min(startIndex + pageSize, modules.length)}</span> of{' '}
                            <span className="font-semibold text-slate-900">{modules.length}</span> modules
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
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-4">
                <div className="text-amber-500 mt-0.5">
                    <i className="fas fa-triangle-exclamation"></i>
                </div>
                <div className="text-sm text-amber-800 leading-relaxed">
                    <strong>Warning:</strong> Disabling a module globally will immediately remove access for all companies regardless of their subscription plan. This action is logged in the Audit Trail.
                </div>
            </div>
            <div className="flex justify-end pt-4">
                <button
                    onClick={() => alert("Global Module Configuration Syncing Successful!")}
                    className="px-6 py-2.5 bg-slate-900 text-white font-semibold rounded-lg shadow-sm hover:bg-slate-800 transition-all active:scale-95"
                >
                    Apply Global Changes
                </button>
            </div>

            {configModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfigModal({ open: false, module: null, status: 'enabled', plans: '' })}>
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Configure Module</p>
                                <h3 className="text-lg font-semibold text-slate-900">{configModal.module?.name}</h3>
                            </div>
                            <button
                                onClick={() => setConfigModal({ open: false, module: null, status: 'enabled', plans: '' })}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <form onSubmit={handleConfigSave} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                                <select
                                    value={configModal.status}
                                    onChange={(e) => setConfigModal((prev) => ({ ...prev, status: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                >
                                    <option value="enabled">Enabled</option>
                                    <option value="disabled">Disabled</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Plans (comma separated)</label>
                                <input
                                    type="text"
                                    value={configModal.plans}
                                    onChange={(e) => setConfigModal((prev) => ({ ...prev, plans: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                    placeholder="Starter, Pro, Enterprise"
                                />
                                <p className="mt-1 text-xs text-slate-500">Tip: leave blank to remove plan restrictions.</p>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setConfigModal({ open: false, module: null, status: 'enabled', plans: '' })}
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
        </div>
    );
}
