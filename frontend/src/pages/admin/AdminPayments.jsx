import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

const paymentStatuses = [
  { value: 'all', label: 'All Status' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
];

const emptyForm = {
  invoice_id: '',
  account_id: '',
  payment_date: '',
  amount: '',
  method: 'bank_transfer',
  reference_no: '',
  notes: '',
};

export default function AdminPayments() {
  const [activeTab, setActiveTab] = useState('invoices');
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState(defaultSummary);
  const [loading, setLoading] = useState(true);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm, payment_date: todayYmd() });
  const [filters, setFilters] = useState({
    search: '',
    payment_status: 'all',
    method: '',
    account_id: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      fetchInvoices();
      fetchReceipts();
    }, 250);
    return () => clearTimeout(handle);
  }, [filters.search, filters.payment_status, filters.method, filters.account_id, filters.date_from, filters.date_to]);

  useEffect(() => {
    if (!showPaymentModal) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closePaymentModal();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showPaymentModal]);

  const accountById = useMemo(() => {
    const map = new Map();
    accounts.forEach((account) => map.set(String(account.id), account));
    return map;
  }, [accounts]);

  const collectionRate = useMemo(() => {
    const total = Number(summary.total_amount || 0);
    if (!total) return 0;
    return Math.round((Number(summary.collected_amount || 0) / total) * 100);
  }, [summary]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await api.get('/payments/invoices', {
        params: {
          search: filters.search || undefined,
          payment_status: filters.payment_status !== 'all' ? filters.payment_status : undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
        },
      });
      setInvoices(Array.isArray(response.data?.data) ? response.data.data : []);
      setSummary(response.data?.summary || defaultSummary);
    } catch (err) {
      alert(err.response?.data?.message || 'Payments invoices load nahi ho paaye');
      setInvoices([]);
      setSummary(defaultSummary);
    } finally {
      setLoading(false);
    }
  };

  const fetchReceipts = async () => {
    setReceiptsLoading(true);
    try {
      const response = await api.get('/payments', {
        params: {
          search: filters.search || undefined,
          method: filters.method || undefined,
          account_id: filters.account_id || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
        },
      });
      setReceipts(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (err) {
      alert(err.response?.data?.message || 'Payment receipts load nahi ho paaye');
      setReceipts([]);
    } finally {
      setReceiptsLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/payments/accounts');
      setAccounts(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (_) {
      setAccounts([]);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchInvoices(), fetchReceipts(), fetchAccounts()]);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      payment_status: 'all',
      method: '',
      account_id: '',
      date_from: '',
      date_to: '',
    });
  };

  const openPaymentModal = (invoice) => {
    setSelectedInvoice(invoice);
    setEditingPayment(null);
    setFormData({
      ...emptyForm,
      invoice_id: invoice?.id || '',
      payment_date: todayYmd(),
      amount: invoice?.due_amount ? String(Number(invoice.due_amount).toFixed(2)) : '',
      account_id: accounts[0]?.id ? String(accounts[0].id) : '',
    });
    setShowPaymentModal(true);
  };

  const openEditPayment = (payment) => {
    setSelectedInvoice({
      id: payment.invoice_id,
      invoice_number: payment.invoice_number,
      customer_name: payment.customer_name,
      total_amount: payment.total_amount,
      paid_amount: 0,
      due_amount: payment.amount,
      payment_status: payment.invoice_status,
    });
    setEditingPayment(payment);
    setFormData({
      invoice_id: payment.invoice_id || '',
      account_id: payment.account_id ? String(payment.account_id) : '',
      payment_date: toDateInput(payment.payment_date) || todayYmd(),
      amount: String(Number(payment.amount || 0).toFixed(2)),
      method: payment.method || 'bank_transfer',
      reference_no: payment.reference_no || '',
      notes: payment.notes || '',
    });
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    setEditingPayment(null);
    setFormData({ ...emptyForm, payment_date: todayYmd() });
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount || 0),
        account_id: formData.account_id || null,
      };
      if (editingPayment) {
        await api.put(`/payments/${editingPayment.id}`, payload);
      } else {
        await api.post('/payments', payload);
      }
      closePaymentModal();
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Payment save nahi ho paaya');
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async (payment) => {
    if (!payment?.id) return;
    const ok = window.confirm(`Delete payment for ${payment.invoice_number || 'invoice'}? Bank balance and invoice status will be recalculated.`);
    if (!ok) return;
    try {
      await api.delete(`/payments/${payment.id}`);
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Payment delete nahi ho paaya');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
              <i className="fas fa-credit-card text-xl"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2c86ab]">Company Admin Panel</p>
              <h1 className="mt-1 text-2xl font-black text-gray-900">Payments</h1>
              <p className="mt-1 text-sm text-gray-600">Record invoice receipts, track pending dues, and reconcile bank collections.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <i className="fas fa-sync-alt"></i>
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                const firstDue = invoices.find((invoice) => Number(invoice.due_amount || 0) > 0 && invoice.payment_status !== 'cancelled');
                if (firstDue) openPaymentModal(firstDue);
                else alert('Koi pending invoice nahi mila');
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
            >
              <i className="fas fa-plus"></i>
              Record Payment
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Receivable" value={formatCurrency(summary.total_amount)} icon="fa-file-invoice-dollar" tone="blue" />
        <SummaryCard label="Collected" value={formatCurrency(summary.collected_amount)} icon="fa-circle-check" tone="green" />
        <SummaryCard label="Pending Dues" value={formatCurrency(summary.pending_amount)} icon="fa-hourglass-half" tone="amber" />
        <SummaryCard label="Overdue" value={formatCurrency(summary.overdue_amount)} icon="fa-triangle-exclamation" tone="red" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-black text-gray-900">Collection Health</p>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              {summary.invoice_count} invoices, {summary.paid_count} paid, {summary.partial_count} partial, {summary.overdue_count} overdue
            </p>
          </div>
          <div className="flex min-w-[260px] items-center gap-3">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(collectionRate, 100)}%` }}></div>
            </div>
            <span className="w-12 text-right text-sm font-black text-gray-900">{collectionRate}%</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 xl:grid-cols-[1fr_150px_150px_150px_170px_170px_auto]">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search invoice, customer, reference"
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <select
            value={filters.payment_status}
            onChange={(event) => setFilters((current) => ({ ...current, payment_status: event.target.value }))}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white"
          >
            {paymentStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <select
            value={filters.method}
            onChange={(event) => setFilters((current) => ({ ...current, method: event.target.value }))}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white"
          >
            <option value="">All Methods</option>
            {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
          </select>
          <select
            value={filters.account_id}
            onChange={(event) => setFilters((current) => ({ ...current, account_id: event.target.value }))}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white"
          >
            <option value="">All Accounts</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.bank_name}</option>)}
          </select>
          <input
            type="date"
            value={filters.date_from}
            onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white"
          />
          <button
            type="button"
            onClick={clearFilters}
            className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`rounded-lg px-4 py-2 text-sm font-black ${activeTab === 'invoices' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600'}`}
            >
              Invoice Dues
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('receipts')}
              className={`rounded-lg px-4 py-2 text-sm font-black ${activeTab === 'receipts' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600'}`}
            >
              Payment Receipts
            </button>
          </div>
          <p className="text-sm font-semibold text-gray-500">
            {activeTab === 'invoices' ? `${invoices.length} invoice(s)` : `${receipts.length} receipt(s)`}
          </p>
        </div>

        {activeTab === 'invoices' ? (
          <InvoiceDueTable
            invoices={invoices}
            loading={loading}
            onRecordPayment={openPaymentModal}
          />
        ) : (
          <ReceiptTable
            receipts={receipts}
            loading={receiptsLoading}
            accountById={accountById}
            onEdit={openEditPayment}
            onDelete={deletePayment}
          />
        )}
      </div>

      {showPaymentModal && (
        <PaymentModal
          invoice={selectedInvoice}
          accounts={accounts}
          formData={formData}
          setFormData={setFormData}
          editing={Boolean(editingPayment)}
          saving={saving}
          onClose={closePaymentModal}
          onSubmit={submitPayment}
        />
      )}
    </div>
  );
}

function InvoiceDueTable({ invoices, loading, onRecordPayment }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
            <th className="px-4 py-4">Invoice</th>
            <th className="px-4 py-4">Customer</th>
            <th className="px-4 py-4">Due Date</th>
            <th className="px-4 py-4 text-right">Total</th>
            <th className="px-4 py-4 text-right">Paid</th>
            <th className="px-4 py-4 text-right">Pending</th>
            <th className="px-4 py-4">Status</th>
            <th className="px-4 py-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr>
              <td colSpan="8" className="px-4 py-16 text-center text-sm font-semibold text-gray-400">Loading payment dues...</td>
            </tr>
          ) : invoices.length === 0 ? (
            <tr>
              <td colSpan="8" className="px-4 py-16 text-center text-sm font-semibold text-gray-400">No invoices found</td>
            </tr>
          ) : invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <p className="text-sm font-black text-gray-900">{invoice.invoice_number || `Invoice #${invoice.id}`}</p>
                <p className="text-xs font-semibold text-gray-500">Issued {formatDate(invoice.issue_date || invoice.created_at)}</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-sm font-bold text-gray-800">{invoice.customer_name || '-'}</p>
                <p className="text-xs text-gray-500">{invoice.contact_person || invoice.phone || '-'}</p>
              </td>
              <td className="px-4 py-3 text-sm font-bold text-gray-800">{formatDate(invoice.due_date)}</td>
              <td className="px-4 py-3 text-right text-sm font-black text-gray-900">{formatCurrency(invoice.total_amount)}</td>
              <td className="px-4 py-3 text-right text-sm font-black text-emerald-700">{formatCurrency(invoice.paid_amount)}</td>
              <td className="px-4 py-3 text-right text-sm font-black text-gray-900">{formatCurrency(invoice.due_amount)}</td>
              <td className="px-4 py-3"><PaymentStatusBadge status={invoice.payment_status} /></td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  disabled={Number(invoice.due_amount || 0) <= 0 || invoice.payment_status === 'cancelled'}
                  onClick={() => onRecordPayment(invoice)}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  Receive
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReceiptTable({ receipts, loading, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
            <th className="px-4 py-4">Receipt</th>
            <th className="px-4 py-4">Invoice</th>
            <th className="px-4 py-4">Method</th>
            <th className="px-4 py-4">Account</th>
            <th className="px-4 py-4">Reference</th>
            <th className="px-4 py-4 text-right">Amount</th>
            <th className="px-4 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr>
              <td colSpan="7" className="px-4 py-16 text-center text-sm font-semibold text-gray-400">Loading receipts...</td>
            </tr>
          ) : receipts.length === 0 ? (
            <tr>
              <td colSpan="7" className="px-4 py-16 text-center text-sm font-semibold text-gray-400">No payment receipts found</td>
            </tr>
          ) : receipts.map((payment) => (
            <tr key={payment.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <p className="text-sm font-black text-gray-900">PMT-{String(payment.id).padStart(5, '0')}</p>
                <p className="text-xs font-semibold text-gray-500">{formatDate(payment.payment_date)}</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-sm font-bold text-gray-800">{payment.invoice_number || '-'}</p>
                <p className="text-xs text-gray-500">{payment.customer_name || '-'}</p>
              </td>
              <td className="px-4 py-3 text-sm font-bold text-gray-800">{methodLabel(payment.method)}</td>
              <td className="px-4 py-3">
                <p className="text-sm font-bold text-gray-800">{payment.bank_name || 'No bank selected'}</p>
                <p className="text-xs text-gray-500">{maskAccount(payment.account_number)}</p>
              </td>
              <td className="px-4 py-3 text-sm font-semibold text-gray-600">{payment.reference_no || '-'}</td>
              <td className="px-4 py-3 text-right text-sm font-black text-emerald-700">{formatCurrency(payment.amount)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => onEdit(payment)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Edit</button>
                  <button type="button" onClick={() => onDelete(payment)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentModal({ invoice, accounts, formData, setFormData, editing, saving, onClose, onSubmit }) {
  const selectedAccount = accounts.find((account) => String(account.id) === String(formData.account_id));
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-gray-900/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">{editing ? 'Edit Receipt' : 'Record Payment'}</p>
            <h2 className="mt-1 text-xl font-black text-gray-900">{invoice?.invoice_number || 'Invoice Payment'}</h2>
            <p className="mt-1 text-sm font-semibold text-gray-500">{invoice?.customer_name || '-'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-black text-gray-500 hover:bg-gray-50">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MiniStat label="Invoice Total" value={formatCurrency(invoice?.total_amount)} />
            <MiniStat label={editing ? 'Receipt Amount' : 'Paid Till Now'} value={formatCurrency(editing ? formData.amount : invoice?.paid_amount)} />
            <MiniStat label={editing ? 'Editable Amount' : 'Pending Due'} value={formatCurrency(editing ? formData.amount : invoice?.due_amount)} tone="emerald" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Payment Amount" required>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(event) => setFormData((current) => ({ ...current, amount: event.target.value }))}
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white"
                required
              />
            </Field>
            <Field label="Payment Date" required>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(event) => setFormData((current) => ({ ...current, payment_date: event.target.value }))}
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white"
                required
              />
            </Field>
            <Field label="Method">
              <select
                value={formData.method}
                onChange={(event) => setFormData((current) => ({ ...current, method: event.target.value }))}
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white"
              >
                {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </Field>
            <Field label="Credit Bank Account">
              <select
                value={formData.account_id}
                onChange={(event) => setFormData((current) => ({ ...current, account_id: event.target.value }))}
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white"
              >
                <option value="">No bank account / cash only</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.bank_name} - {maskAccount(account.account_number)}</option>
                ))}
              </select>
              {selectedAccount && (
                <p className="mt-2 text-xs font-semibold text-gray-500">Current balance: {formatCurrency(selectedAccount.balance)}</p>
              )}
            </Field>
            <Field label="Reference No">
              <input
                type="text"
                value={formData.reference_no}
                onChange={(event) => setFormData((current) => ({ ...current, reference_no: event.target.value }))}
                placeholder="UTR, cheque no, transaction id"
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white"
              />
            </Field>
            <Field label="Notes">
              <input
                type="text"
                value={formData.notes}
                onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Internal note"
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white"
              />
            </Field>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-gray-200 px-5 text-sm font-black text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
              {saving ? 'Saving...' : editing ? 'Update Payment' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-gray-500">
        {label}{required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === 'emerald' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-50 text-gray-900'}`}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-gray-500">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value, icon, tone }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    red: 'border-red-100 bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-600">{label}</p>
        <i className={`fas ${icon} text-lg`}></i>
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function PaymentStatusBadge({ status }) {
  const tones = {
    paid: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    partial: 'border-blue-200 bg-blue-100 text-blue-700',
    unpaid: 'border-gray-200 bg-gray-100 text-gray-700',
    overdue: 'border-red-200 bg-red-100 text-red-700',
    cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
  };
  const value = status || 'unpaid';
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[value] || tones.unpaid}`}>
      {value}
    </span>
  );
}

function methodLabel(value) {
  return paymentMethods.find((method) => method.value === value)?.label || value || '-';
}

function maskAccount(value) {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= 4) return text;
  return `****${text.slice(-4)}`;
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return `INR ${number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function todayYmd() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

const defaultSummary = {
  invoice_count: 0,
  paid_count: 0,
  partial_count: 0,
  unpaid_count: 0,
  overdue_count: 0,
  total_amount: 0,
  collected_amount: 0,
  pending_amount: 0,
  overdue_amount: 0,
};
