import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

const emptyForm = {
  supplier_name: '',
  supplier_email: '',
  supplier_phone: '',
  item_name: '',
  item_code: '',
  category: '',
  warehouse: '',
  quantity: '',
  unit_price: '',
  tax_amount: '',
  discount_amount: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  invoice_no: '',
  payment_status: 'pending',
  status: 'ordered',
  add_to_inventory: false,
  notes: '',
};

const statusOptions = [
  { value: 'ordered', label: 'Ordered' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

const paymentOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
];

export default function AdminPurchases() {
  const [purchases, setPurchases] = useState([]);
  const [statistics, setStatistics] = useState({
    total_purchases: 0,
    total_value: 0,
    received_count: 0,
    pending_payments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [viewPurchase, setViewPurchase] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    payment_status: 'all',
  });

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.payment_status !== 'all') params.payment_status = filters.payment_status;
      if (filters.search.trim()) params.search = filters.search.trim();

      const response = await api.get('/purchases', { params });
      if (response.data?.success) {
        setPurchases(Array.isArray(response.data.data) ? response.data.data : []);
        setStatistics(response.data.statistics || {});
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Purchases load nahi ho paaye');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = setTimeout(fetchPurchases, 300);
    return () => clearTimeout(handle);
  }, [filters.search, filters.status, filters.payment_status]);

  const computedTotal = useMemo(() => {
    const quantity = Number(form.quantity || 0);
    const unitPrice = Number(form.unit_price || 0);
    const tax = Number(form.tax_amount || 0);
    const discount = Number(form.discount_amount || 0);
    return Math.max(0, quantity * unitPrice + tax - discount);
  }, [form.quantity, form.unit_price, form.tax_amount, form.discount_amount]);

  const openCreate = () => {
    setEditingPurchase(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (purchase) => {
    setEditingPurchase(purchase);
    setForm({
      supplier_name: purchase.supplier_name || '',
      supplier_email: purchase.supplier_email || '',
      supplier_phone: purchase.supplier_phone || '',
      item_name: purchase.item_name || '',
      item_code: purchase.item_code || '',
      category: purchase.category || '',
      warehouse: purchase.warehouse || '',
      quantity: normalizeInputNumber(purchase.quantity),
      unit_price: normalizeInputNumber(purchase.unit_price),
      tax_amount: normalizeInputNumber(purchase.tax_amount),
      discount_amount: normalizeInputNumber(purchase.discount_amount),
      purchase_date: toDateInputValue(purchase.purchase_date),
      invoice_no: purchase.invoice_no || '',
      payment_status: purchase.payment_status || 'pending',
      status: purchase.status || 'ordered',
      add_to_inventory: Number(purchase.add_to_inventory || 0) === 1,
      notes: purchase.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPurchase(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      quantity: Number(form.quantity || 0),
      unit_price: Number(form.unit_price || 0),
      tax_amount: Number(form.tax_amount || 0),
      discount_amount: Number(form.discount_amount || 0),
      total_amount: computedTotal,
    };

    if (!payload.supplier_name.trim()) return alert('Supplier name required hai');
    if (!payload.item_name.trim()) return alert('Item name required hai');
    if (!payload.purchase_date) return alert('Purchase date required hai');
    if (payload.quantity <= 0) return alert('Quantity 0 se zyada honi chahiye');
    if (payload.unit_price < 0) return alert('Unit price valid hona chahiye');

    setSaving(true);
    try {
      if (editingPurchase) {
        await api.put(`/purchases/${editingPurchase.id}`, payload);
      } else {
        await api.post('/purchases', payload);
      }
      closeModal();
      await fetchPurchases();
    } catch (err) {
      alert(err.response?.data?.message || 'Purchase save nahi ho paaya');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (purchase) => {
    if (!window.confirm(`Delete purchase ${purchase.purchase_no || ''}?`)) return;
    try {
      await api.delete(`/purchases/${purchase.id}`);
      await fetchPurchases();
    } catch (err) {
      alert(err.response?.data?.message || 'Purchase delete nahi ho paaya');
    }
  };

  const updateStatus = async (purchase, field, value) => {
    try {
      await api.patch(`/purchases/${purchase.id}/status`, { [field]: value });
      await fetchPurchases();
    } catch (err) {
      alert(err.response?.data?.message || 'Status update nahi ho paaya');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
              <i className="fas fa-shopping-cart text-xl"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2c86ab]">Company Admin Panel</p>
              <h1 className="mt-1 text-2xl font-black text-gray-900">Purchases</h1>
              <p className="mt-1 text-sm text-gray-600">Procurement entries, vendor invoices, and stock updates</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchPurchases}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <i className="fas fa-sync-alt"></i>
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
            >
              <i className="fas fa-plus"></i>
              Add Purchase
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Purchases" value={Number(statistics.total_purchases || 0)} icon="fa-receipt" tone="blue" />
        <SummaryCard label="Purchase Value" value={formatCurrency(statistics.total_value)} icon="fa-indian-rupee-sign" tone="green" />
        <SummaryCard label="Received" value={Number(statistics.received_count || 0)} icon="fa-box-open" tone="indigo" />
        <SummaryCard label="Pending Payments" value={Number(statistics.pending_payments || 0)} icon="fa-clock" tone="amber" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 md:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search purchase no, supplier, item, invoice"
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="all">All Status</option>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select
            value={filters.payment_status}
            onChange={(event) => setFilters((current) => ({ ...current, payment_status: event.target.value }))}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="all">All Payments</option>
            {paymentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
                <th className="px-4 py-4">Purchase</th>
                <th className="px-4 py-4">Supplier</th>
                <th className="px-4 py-4">Item</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4 text-right">Amount</th>
                <th className="px-4 py-4">Payment</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-14 text-center text-sm font-semibold text-gray-400" colSpan="8">Loading purchases...</td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td className="px-4 py-14 text-center text-sm font-semibold text-gray-400" colSpan="8">No purchase entries found</td>
                </tr>
              ) : purchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-mono text-sm font-black text-gray-900">{purchase.purchase_no}</p>
                    <p className="text-xs text-gray-500">{purchase.invoice_no || 'No invoice'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-gray-900">{purchase.supplier_name}</p>
                    <p className="text-xs text-gray-500">{purchase.supplier_phone || purchase.supplier_email || '-'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-gray-900">{purchase.item_name}</p>
                    <p className="text-xs text-gray-500">{purchase.item_code || purchase.category || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">{toDateInputValue(purchase.purchase_date) || '-'}</td>
                  <td className="px-4 py-3 text-right text-sm font-black text-gray-900">{formatCurrency(purchase.total_amount)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={purchase.payment_status || 'pending'}
                      onChange={(event) => updateStatus(purchase, 'payment_status', event.target.value)}
                      className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold"
                    >
                      {paymentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={purchase.status || 'ordered'}
                      onChange={(event) => updateStatus(purchase, 'status', event.target.value)}
                      className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold"
                    >
                      {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <IconButton title="View" icon="fa-eye" onClick={() => setViewPurchase(purchase)} />
                      <IconButton title="Edit" icon="fa-edit" onClick={() => openEdit(purchase)} tone="blue" />
                      <IconButton title="Delete" icon="fa-trash" onClick={() => handleDelete(purchase)} tone="red" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">{editingPurchase ? 'Edit Purchase' : 'Add Purchase'}</h2>
                <p className="text-sm text-gray-500">{editingPurchase?.purchase_no || 'New procurement entry'}</p>
              </div>
              <button type="button" onClick={closeModal} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Supplier Name" required value={form.supplier_name} onChange={(value) => setForm({ ...form, supplier_name: value })} />
                <Field label="Supplier Phone" value={form.supplier_phone} onChange={(value) => setForm({ ...form, supplier_phone: value })} />
                <Field label="Supplier Email" type="email" value={form.supplier_email} onChange={(value) => setForm({ ...form, supplier_email: value })} />
                <Field label="Item Name" required value={form.item_name} onChange={(value) => setForm({ ...form, item_name: value })} />
                <Field label="Item Code" value={form.item_code} onChange={(value) => setForm({ ...form, item_code: value.toUpperCase() })} />
                <Field label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
                <Field label="Warehouse / Location" value={form.warehouse} onChange={(value) => setForm({ ...form, warehouse: value })} />
                <Field label="Purchase Date" required type="date" value={form.purchase_date} onChange={(value) => setForm({ ...form, purchase_date: value })} />
                <Field label="Invoice No" value={form.invoice_no} onChange={(value) => setForm({ ...form, invoice_no: value })} />
                <Field label="Quantity" required type="number" min="0.01" step="0.01" value={form.quantity} onChange={(value) => setForm({ ...form, quantity: value })} />
                <Field label="Unit Price" required type="number" min="0" step="0.01" value={form.unit_price} onChange={(value) => setForm({ ...form, unit_price: value })} />
                <Field label="Tax Amount" type="number" min="0" step="0.01" value={form.tax_amount} onChange={(value) => setForm({ ...form, tax_amount: value })} />
                <Field label="Discount" type="number" min="0" step="0.01" value={form.discount_amount} onChange={(value) => setForm({ ...form, discount_amount: value })} />
                <SelectField label="Payment Status" value={form.payment_status} options={paymentOptions} onChange={(value) => setForm({ ...form, payment_status: value })} />
                <SelectField label="Purchase Status" value={form.status} options={statusOptions} onChange={(value) => setForm({ ...form, status: value })} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Total Amount</p>
                  <p className="mt-2 text-2xl font-black text-gray-900">{formatCurrency(computedTotal)}</p>
                  <label className="mt-4 flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm font-bold text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.add_to_inventory}
                      onChange={(event) => setForm({ ...form, add_to_inventory: event.target.checked })}
                      className="mt-1 h-4 w-4"
                    />
                    <span>Add to inventory when status is Received</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
                <button type="button" onClick={closeModal} className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Saving...' : editingPurchase ? 'Save Changes' : 'Create Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewPurchase && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">{viewPurchase.purchase_no}</h2>
                <p className="text-sm text-gray-500">{viewPurchase.supplier_name}</p>
              </div>
              <button type="button" onClick={() => setViewPurchase(null)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="grid max-h-[75vh] grid-cols-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Item" value={viewPurchase.item_name} />
              <Detail label="Item Code" value={viewPurchase.item_code} />
              <Detail label="Invoice No" value={viewPurchase.invoice_no} />
              <Detail label="Quantity" value={viewPurchase.quantity} />
              <Detail label="Unit Price" value={formatCurrency(viewPurchase.unit_price)} />
              <Detail label="Total" value={formatCurrency(viewPurchase.total_amount)} />
              <Detail label="Purchase Date" value={toDateInputValue(viewPurchase.purchase_date)} />
              <Detail label="Payment" value={viewPurchase.payment_status} />
              <Detail label="Status" value={viewPurchase.status} />
              <Detail label="Supplier Phone" value={viewPurchase.supplier_phone} />
              <Detail label="Supplier Email" value={viewPurchase.supplier_email} />
              <Detail label="Warehouse" value={viewPurchase.warehouse} />
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:col-span-2 lg:col-span-3">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Notes</p>
                <p className="whitespace-pre-wrap text-sm font-semibold text-gray-800">{viewPurchase.notes || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, ...rest }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">
        {label}{required ? ' *' : ''}
      </label>
      <input
        {...rest}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function IconButton({ title, icon, onClick, tone = 'gray' }) {
  const tones = {
    gray: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100',
    blue: 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100',
    red: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border ${tones[tone] || tones.gray}`}
    >
      <i className={`fas ${icon}`}></i>
    </button>
  );
}

function SummaryCard({ label, value, icon, tone }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    green: 'border-green-100 bg-green-50 text-green-700',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
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

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className="break-words text-sm font-bold capitalize text-gray-900">{value || '-'}</p>
    </div>
  );
}

function toDateInputValue(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function normalizeInputNumber(value) {
  if (value === null || value === undefined) return '';
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '';
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return `INR ${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
