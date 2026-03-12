import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function AdminAccounts() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editAccount, setEditAccount] = useState(null);
    const [formData, setFormData] = useState({
        bank_name: '',
        account_holder_name: '',
        account_number: '',
        ifsc_code: '',
        branch_name: '',
        balance: 0
    });
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const resp = await api.get('/accounts');
            setAccounts(resp.data.data || []);
        } catch (err) {
            console.error('Failed to fetch accounts:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editAccount) {
                await api.put(`/accounts/${editAccount.id}`, formData);
            } else {
                await api.post('/accounts', formData);
            }
            setShowModal(false);
            setEditAccount(null);
            setFormData({ bank_name: '', account_holder_name: '', account_number: '', ifsc_code: '', branch_name: '', balance: 0 });
            fetchAccounts();
        } catch (err) {
            alert(err.response?.data?.message || 'Operation failed');
        }
    };

    const openEdit = (account) => {
        setEditAccount(account);
        setFormData({
            bank_name: account.bank_name,
            account_holder_name: account.account_holder_name || '',
            account_number: account.account_number,
            ifsc_code: account.ifsc_code || '',
            branch_name: account.branch_name || '',
            balance: account.balance
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account?')) return;
        try {
            await api.delete(`/accounts/${id}`);
            fetchAccounts();
        } catch (err) {
            alert('Delete failed');
        }
    };

    const filteredAccounts = accounts.filter(acc =>
        acc.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.account_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (acc.account_holder_name && acc.account_holder_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

    return (
        <div className="space-y-6 text-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Bank Accounts</h1>
                    <p className="text-slate-500 text-sm font-medium">Manage company finances and bank distributions</p>
                </div>
                <button
                    onClick={() => { setEditAccount(null); setFormData({ bank_name: '', account_holder_name: '', account_number: '', ifsc_code: '', branch_name: '', balance: 0 }); setShowModal(true); }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98]"
                >
                    <i className="fas fa-plus"></i>
                    Register New Account
                </button>
            </div>

            {/* Hero Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 transition-transform duration-500 group-hover:scale-110"></div>
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div>
                            <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs mb-2">Aggregate Liquid Balance</p>
                            <h2 className="text-5xl font-black tracking-tight mb-2">
                                ₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </h2>
                        </div>
                        <div className="flex items-center gap-4 mt-8">
                            <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl text-sm font-bold border border-white/30">
                                {accounts.length} Active Accounts
                            </div>
                            <div className="text-indigo-100 text-xs font-semibold">
                                Last Sync: {new Date().toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                    <i className="fas fa-university absolute bottom-8 right-8 text-8xl opacity-10 rotate-12 transition-transform duration-500 group-hover:rotate-0"></i>
                </div>

                <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col justify-center">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                        <i className="fas fa-shield-alt text-xl"></i>
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-900 mb-2">Secure Management</h3>
                    <p className="text-slate-500 text-sm mb-6">All account details are encrypted and access is limited to administrators only.</p>
                    <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                        <span>Audit Enabled</span>
                        <i className="fas fa-check-circle"></i>
                    </div>
                </div>
            </div>

            {/* Search and Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Search by Bank or Account No..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-inner"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 bg-slate-50/50">
                                <th className="px-8 py-5">Financial Institution</th>
                                <th className="px-8 py-5">Account Holder</th>
                                <th className="px-8 py-5">Identities (A/C & IFSC)</th>
                                <th className="px-8 py-5 text-right">Balance</th>
                                <th className="px-8 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center">
                                        <div className="animate-spin text-indigo-600 text-3xl mb-4 inline-block">
                                            <i className="fas fa-circle-notch"></i>
                                        </div>
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Querying data modules...</p>
                                    </td>
                                </tr>
                            ) : filteredAccounts.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center">
                                        <p className="text-slate-300 font-bold text-lg mb-2">No Accounts Found</p>
                                        <p className="text-slate-400 text-sm">Create your first bank account to begin tracking</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAccounts.map((acc) => (
                                    <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                    <i className="fas fa-university"></i>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900 leading-none mb-1">{acc.bank_name}</p>
                                                    <p className="text-xs text-slate-400 font-medium">{acc.branch_name || 'Main Branch'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-sm font-bold text-slate-700">{acc.account_holder_name || 'Company Primary'}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-300 uppercase">A/C</span>
                                                    <code className="text-sm font-mono font-bold text-slate-800">{acc.account_number}</code>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-300 uppercase">IFSC</span>
                                                    <code className="text-xs font-mono font-bold text-indigo-600">{acc.ifsc_code}</code>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <p className="text-lg font-black text-slate-900 tracking-tight">
                                                ₹{parseFloat(acc.balance).toLocaleString('en-IN')}
                                            </p>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => openEdit(acc)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-xl hover:text-indigo-600 hover:border-indigo-200 hover:shadow-lg transition-all">
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button onClick={() => handleDelete(acc.id)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-xl hover:text-red-600 hover:border-red-200 hover:shadow-lg transition-all">
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300 border border-white/20">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 leading-tight">
                                    {editAccount ? 'Modify' : 'Initialize'} Account
                                </h3>
                                <p className="text-slate-400 text-sm font-medium mt-1">Provide accurate banking credentials</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-all">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 grid grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bank Name *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.bank_name}
                                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                                    placeholder="e.g. HDFC Bank, ICICI Bank"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Account Holder Name</label>
                                <input
                                    type="text"
                                    value={formData.account_holder_name}
                                    onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Account Number *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.account_number}
                                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">IFSC Code</label>
                                <input
                                    type="text"
                                    value={formData.ifsc_code}
                                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-indigo-600 font-mono font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all uppercase"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Starting Balance (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.balance}
                                    onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Branch Name</label>
                                <input
                                    type="text"
                                    value={formData.branch_name}
                                    onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>

                            <div className="col-span-2 pt-6 flex gap-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-4 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 transition-all border border-transparent">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
                                    {editAccount ? 'Confirm Update' : 'Initialize Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
