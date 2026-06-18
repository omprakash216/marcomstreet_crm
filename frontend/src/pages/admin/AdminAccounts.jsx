import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

const EMPTY_FORM = {
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    branch_name: '',
    balance: 0,
};

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
});

function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeIfsc(value) {
    return normalizeText(value).toUpperCase().replace(/\s+/g, '');
}

function toSafeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
    return CURRENCY_FORMATTER.format(toSafeNumber(value));
}

function formatSyncTime(value) {
    if (!value) return 'Not synced yet';
    return new Date(value).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

function StatCard({ label, value, helper, icon, accentClass = 'text-slate-900', iconClass = 'bg-slate-50 text-slate-600 border-slate-100' }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</p>
                    <h2 className={`mt-3 text-3xl font-black tracking-tight ${accentClass}`}>{value}</h2>
                    <p className="mt-2 text-sm text-slate-500">{helper}</p>
                </div>
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${iconClass}`}>
                    <i className={`fas ${icon} text-lg`}></i>
                </div>
            </div>
        </div>
    );
}

function FormField({
    label,
    value,
    onChange,
    placeholder,
    required = false,
    type = 'text',
    className = '',
    inputMode,
    maxLength,
    autoComplete,
    step,
}) {
    return (
        <label className={className}>
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                {label}
                {required ? ' *' : ''}
            </span>
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                required={required}
                inputMode={inputMode}
                maxLength={maxLength}
                autoComplete={autoComplete}
                step={step}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 placeholder:text-slate-300 shadow-sm outline-none transition focus:border-[#2c86ab] focus:bg-white focus:ring-4 focus:ring-[#2c86ab]/10"
            />
        </label>
    );
}

function ModalBullet({ icon, title, text }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
                <i className={`fas ${icon}`}></i>
            </div>
            <div>
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-white/75">{text}</p>
            </div>
        </div>
    );
}

export default function AdminAccounts() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editAccount, setEditAccount] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [lastSyncedAt, setLastSyncedAt] = useState(null);

    useEffect(() => {
        fetchAccounts();
    }, []);

    useEffect(() => {
        if (!showModal) return;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowModal(false);
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [showModal]);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const resp = await api.get('/accounts');
            setAccounts(Array.isArray(resp.data.data) ? resp.data.data : []);
            setLastSyncedAt(Date.now());
        } catch (err) {
            if (err.response && err.response.status !== 401) {
                console.error('Failed to fetch accounts:', err);
            }
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEditAccount(null);
        setFormData(EMPTY_FORM);
        setFormError('');
    };

    const openCreate = () => {
        resetForm();
        setShowModal(true);
    };

    const openEdit = (account) => {
        setEditAccount(account);
        setFormError('');
        setFormData({
            bank_name: account.bank_name || '',
            account_holder_name: account.account_holder_name || '',
            account_number: account.account_number || '',
            ifsc_code: account.ifsc_code || '',
            branch_name: account.branch_name || '',
            balance: toSafeNumber(account.balance),
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        resetForm();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError('');

        const payload = {
            bank_name: normalizeText(formData.bank_name),
            account_holder_name: normalizeText(formData.account_holder_name),
            account_number: normalizeText(formData.account_number),
            ifsc_code: normalizeIfsc(formData.ifsc_code),
            branch_name: normalizeText(formData.branch_name),
            balance: toSafeNumber(formData.balance),
        };

        if (!payload.bank_name || !payload.account_number) {
            setFormError('Bank name and account number are required.');
            return;
        }

        setSaving(true);
        try {
            if (editAccount) {
                await api.put(`/accounts/${editAccount.id}`, payload);
            } else {
                await api.post('/accounts', payload);
            }
            closeModal();
            await fetchAccounts();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Operation failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account?')) return;
        try {
            await api.delete(`/accounts/${id}`);
            await fetchAccounts();
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed');
        }
    };

    const filteredAccounts = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return accounts;

        return accounts.filter((account) => {
            const haystack = [
                account.bank_name,
                account.account_holder_name,
                account.account_number,
                account.ifsc_code,
                account.branch_name,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(term);
        });
    }, [accounts, searchTerm]);

    const totalBalance = useMemo(
        () => accounts.reduce((sum, account) => sum + toSafeNumber(account.balance), 0),
        [accounts]
    );

    const activeCount = accounts.length;
    const lastSyncedLabel = formatSyncTime(lastSyncedAt);

    return (
        <div className="space-y-6 text-slate-800">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#2c86ab]/15 bg-[#2c86ab]/10 text-[#2c86ab]">
                            <i className="fas fa-university text-2xl"></i>
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#2c86ab]">Company Admin Panel</p>
                            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Bank Accounts</h1>
                            <p className="mt-1 max-w-2xl text-sm text-slate-500">
                                Manage company bank accounts used for invoices, expenses, payments, and reporting.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={fetchAccounts}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
                        >
                            <i className="fas fa-plus"></i>
                            Add Account
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard
                    label="Total Balance"
                    value={formatCurrency(totalBalance)}
                    helper="Combined balance across all saved accounts"
                    icon="fa-wallet"
                    accentClass="text-[#2c86ab]"
                    iconClass="border-[#2c86ab]/15 bg-[#2c86ab]/10 text-[#2c86ab]"
                />
                <StatCard
                    label="Active Accounts"
                    value={String(activeCount)}
                    helper="Ready for expense and payment selection"
                    icon="fa-layer-group"
                />
                <StatCard
                    label="Last Sync"
                    value={lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not synced'}
                    helper={lastSyncedLabel}
                    icon="fa-clock"
                />
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Account Directory</p>
                        <h2 className="mt-1 text-lg font-black text-slate-900">{filteredAccounts.length} Records</h2>
                        <p className="text-sm text-slate-500">Search by bank name, account number, IFSC code, or holder name.</p>
                    </div>

                    <div className="relative w-full md:max-w-md">
                        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input
                            type="text"
                            placeholder="Search accounts..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#2c86ab] focus:ring-4 focus:ring-[#2c86ab]/10"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                <th className="px-6 py-4">Bank</th>
                                <th className="px-6 py-4">Account Holder</th>
                                <th className="px-6 py-4">Account No.</th>
                                <th className="px-6 py-4">IFSC / Branch</th>
                                <th className="px-6 py-4 text-right">Balance</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500">
                                            <i className="fas fa-circle-notch fa-spin text-[#2c86ab]"></i>
                                            Loading bank accounts...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredAccounts.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="mx-auto max-w-md">
                                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
                                                <i className="fas fa-university text-xl"></i>
                                            </div>
                                            <p className="mt-4 text-lg font-black text-slate-900">
                                                {accounts.length === 0 ? 'No bank accounts yet' : 'No matching accounts'}
                                            </p>
                                            <p className="mt-2 text-sm text-slate-500">
                                                {accounts.length === 0
                                                    ? 'Add your first bank account to start using it in finance modules.'
                                                    : 'Try a different search term or clear the filter.'}
                                            </p>
                                            {accounts.length === 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={openCreate}
                                                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2c86ab] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#246d8b]"
                                                >
                                                    <i className="fas fa-plus"></i>
                                                    Add First Account
                                                </button>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAccounts.map((account) => (
                                    <tr key={account.id} className="group transition-colors hover:bg-slate-50/70">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 transition group-hover:border-[#2c86ab]/20 group-hover:bg-[#2c86ab]/10 group-hover:text-[#2c86ab]">
                                                    <i className="fas fa-university"></i>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-black text-slate-900">{account.bank_name}</p>
                                                    <p className="mt-1 truncate text-xs font-medium text-slate-400">
                                                        {account.branch_name || 'Main Branch'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5">
                                            <p className="text-sm font-bold text-slate-700">
                                                {account.account_holder_name || 'Company Primary'}
                                            </p>
                                        </td>

                                        <td className="px-6 py-5">
                                            <code className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold tracking-wide text-slate-800">
                                                {account.account_number}
                                            </code>
                                        </td>

                                        <td className="px-6 py-5">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                                                        IFSC
                                                    </span>
                                                    <code className="text-sm font-bold text-[#2c86ab]">
                                                        {account.ifsc_code || '-'}
                                                    </code>
                                                </div>
                                                <p className="text-xs font-medium text-slate-400">
                                                    {account.branch_name || 'Branch not specified'}
                                                </p>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5 text-right">
                                            <p className="text-lg font-black tracking-tight text-slate-900">
                                                {formatCurrency(account.balance)}
                                            </p>
                                        </td>

                                        <td className="px-6 py-5 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(account)}
                                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-[#2c86ab]/20 hover:text-[#2c86ab] hover:shadow-sm"
                                                    title="Edit account"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(account.id)}
                                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-rose-200 hover:text-rose-600 hover:shadow-sm"
                                                    title="Delete account"
                                                >
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

            {showModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeModal();
                        }
                    }}
                >
                    <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                        <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
                            <aside className="relative overflow-hidden bg-gradient-to-br from-[#2c86ab] to-[#195a73] p-8 text-white">
                                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
                                <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>

                                <div className="relative">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                                        <i className="fas fa-university text-2xl"></i>
                                    </div>

                                    <p className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-white/70">
                                        Bank Account Setup
                                    </p>
                                    <h3 className="mt-2 text-2xl font-black leading-tight">
                                        {editAccount ? 'Update an existing account' : 'Initialize a new account'}
                                    </h3>
                                    <p className="mt-3 text-sm leading-6 text-white/80">
                                        This account will be available in expenses, invoices, payments, and financial reports.
                                    </p>

                                    <div className="mt-8 space-y-3">
                                        <ModalBullet
                                            icon="fa-building"
                                            title="Bank identity"
                                            text="Enter the bank name and branch exactly as it should appear."
                                        />
                                        <ModalBullet
                                            icon="fa-id-card"
                                            title="Account ownership"
                                            text="Keep the account holder name aligned with official banking records."
                                        />
                                        <ModalBullet
                                            icon="fa-key"
                                            title="Routing details"
                                            text="IFSC and account number help other finance modules map the account."
                                        />
                                    </div>

                                    <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
                                            Good to know
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-white/85">
                                            Saved accounts can be reused without retyping details every time.
                                        </p>
                                    </div>
                                </div>
                            </aside>

                            <section className="max-h-[90vh] overflow-y-auto bg-white p-6 md:p-8">
                                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2c86ab]">
                                            Bank Record
                                        </p>
                                        <h3 className="mt-1 text-2xl font-black text-slate-900">
                                            {editAccount ? 'Edit Bank Account' : 'Initialize Account'}
                                        </h3>
                                        <p className="mt-2 text-sm text-slate-500">
                                            Provide accurate banking credentials for clean finance operations.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                                        aria-label="Close modal"
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>

                                {formError ? (
                                    <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                                        {formError}
                                    </div>
                                ) : null}

                                <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                                Bank Identity
                                            </div>
                                            <div className="h-px flex-1 bg-slate-100"></div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            <FormField
                                                label="Bank Name"
                                                required
                                                value={formData.bank_name}
                                                onChange={(value) => setFormData((current) => ({ ...current, bank_name: value }))}
                                                placeholder="e.g. HDFC Bank, ICICI Bank"
                                                autoComplete="off"
                                            />

                                            <FormField
                                                label="Account Holder Name"
                                                value={formData.account_holder_name}
                                                onChange={(value) => setFormData((current) => ({ ...current, account_holder_name: value }))}
                                                placeholder="e.g. Vanya Group"
                                                autoComplete="off"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                                Account Details
                                            </div>
                                            <div className="h-px flex-1 bg-slate-100"></div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <FormField
                                                label="Account Number"
                                                required
                                                value={formData.account_number}
                                                onChange={(value) => setFormData((current) => ({ ...current, account_number: value }))}
                                                placeholder="1234567890"
                                                inputMode="numeric"
                                                autoComplete="off"
                                            />

                                            <FormField
                                                label="IFSC Code"
                                                value={formData.ifsc_code}
                                                onChange={(value) => setFormData((current) => ({ ...current, ifsc_code: normalizeIfsc(value) }))}
                                                placeholder="SBIN0000123"
                                                autoComplete="off"
                                            />

                                            <FormField
                                                label="Starting Balance (INR)"
                                                type="number"
                                                value={formData.balance}
                                                onChange={(value) => setFormData((current) => ({ ...current, balance: value }))}
                                                placeholder="0.00"
                                                inputMode="decimal"
                                                step="0.01"
                                                autoComplete="off"
                                            />

                                            <FormField
                                                label="Branch Name"
                                                value={formData.branch_name}
                                                onChange={(value) => setFormData((current) => ({ ...current, branch_name: value }))}
                                                placeholder="Noida"
                                                autoComplete="off"
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#2c86ab] shadow-sm">
                                                <i className="fas fa-shield-alt"></i>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">Manual Signature Ready</p>
                                                <p className="text-xs font-medium text-slate-500">
                                                    No signature image is required here. Printed documents can be signed manually.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-end">
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2c86ab] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#246d8b] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                                            {saving ? 'Saving...' : editAccount ? 'Confirm Update' : 'Initialize Account'}
                                        </button>
                                    </div>
                                </form>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
