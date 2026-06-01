import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

const emptyForm = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  gstin: '',
  category: '',
  payment_terms: '',
  opening_balance: '',
  status: 'active',
  city: '',
  state: '',
  address: '',
  notes: '',
};

const emptyLogForm = {
  type: 'note',
  subject: '',
  description: '',
  interaction_date: new Date().toISOString().slice(0, 10),
  follow_up_date: '',
};

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blacklisted', label: 'Blacklisted' },
];

const logTypeOptions = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [statistics, setStatistics] = useState({
    total_suppliers: 0,
    active_suppliers: 0,
    inactive_suppliers: 0,
    blacklisted_suppliers: 0,
    total_purchase_value: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewSupplier, setViewSupplier] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [logForm, setLogForm] = useState(emptyLogForm);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    category: 'all',
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    const handle = setTimeout(fetchSuppliers, 300);
    return () => clearTimeout(handle);
  }, [filters.search, filters.status, filters.category]);

  const categories = useMemo(() => {
    const unique = new Set(
      suppliers
        .map((supplier) => String(supplier.category || '').trim())
        .filter(Boolean)
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [suppliers]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.category !== 'all') params.category = filters.category;

      const response = await api.get('/suppliers', { params });
      if (response.data?.success) {
        setSuppliers(Array.isArray(response.data.data) ? response.data.data : []);
        setStatistics(response.data.statistics || {});
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Suppliers load nahi ho paaye');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingSupplier(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name || '',
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      gstin: supplier.gstin || '',
      category: supplier.category || '',
      payment_terms: supplier.payment_terms || '',
      opening_balance: normalizeInputNumber(supplier.opening_balance),
      status: supplier.status || 'active',
      city: supplier.city || '',
      state: supplier.state || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      opening_balance: Number(form.opening_balance || 0),
    };

    if (!payload.name) return alert('Supplier name required hai');
    if (payload.opening_balance < 0) return alert('Opening balance valid hona chahiye');

    setSaving(true);
    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, payload);
      } else {
        await api.post('/suppliers', payload);
      }
      closeModal();
      await fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.message || 'Supplier save nahi ho paaya');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier) => {
    if (!window.confirm(`Delete supplier "${supplier.name}"?`)) return;
    try {
      await api.delete(`/suppliers/${supplier.id}`);
      if (viewSupplier?.id === supplier.id) closeViewModal();
      await fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.message || 'Supplier delete nahi ho paaya');
    }
  };

  const syncExistingSuppliers = async () => {
    setSyncing(true);
    try {
      const response = await api.post('/suppliers/sync');
      alert(response.data?.message || 'Supplier sync complete');
      await fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.message || 'Existing suppliers sync nahi ho paaye');
    } finally {
      setSyncing(false);
    }
  };

  const openView = async (supplier) => {
    setViewSupplier(supplier);
    setDetails(null);
    setLogForm(emptyLogForm);
    await fetchDetails(supplier.id);
  };

  const fetchDetails = async (supplierId) => {
    setDetailsLoading(true);
    try {
      const response = await api.get(`/suppliers/${supplierId}/dependencies`);
      setDetails(response.data?.data || null);
    } catch (err) {
      alert(err.response?.data?.message || 'Supplier details load nahi ho paaye');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeViewModal = () => {
    setViewSupplier(null);
    setDetails(null);
    setLogForm(emptyLogForm);
  };

  const addInteraction = async (event) => {
    event.preventDefault();
    if (!viewSupplier) return;
    if (!logForm.subject.trim()) return alert('Log subject required hai');

    setSavingLog(true);
    try {
      await api.post(`/suppliers/${viewSupplier.id}/interactions`, {
        ...logForm,
        subject: logForm.subject.trim(),
        follow_up_date: logForm.follow_up_date || null,
      });
      setLogForm(emptyLogForm);
      await fetchDetails(viewSupplier.id);
    } catch (err) {
      alert(err.response?.data?.message || 'Supplier log save nahi ho paaya');
    } finally {
      setSavingLog(false);
    }
  };

  const deleteInteraction = async (interactionId) => {
    if (!window.confirm('Delete this supplier log?')) return;
    try {
      await api.delete(`/suppliers/interactions/${interactionId}`);
      if (viewSupplier) await fetchDetails(viewSupplier.id);
    } catch (err) {
      alert(err.response?.data?.message || 'Supplier log delete nahi ho paaya');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
              <i className="fas fa-truck-loading text-xl"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2c86ab]">Company Admin Panel</p>
              <h1 className="mt-1 text-2xl font-black text-gray-900">Suppliers</h1>
              <p className="mt-1 text-sm text-gray-600">Supplier master, contact history, and procurement dependencies</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchSuppliers}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <i className="fas fa-sync-alt"></i>
              Refresh
            </button>
            <button
              type="button"
              onClick={syncExistingSuppliers}
              disabled={syncing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
            >
              <i className="fas fa-file-import"></i>
              {syncing ? 'Syncing...' : 'Import Existing'}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
            >
              <i className="fas fa-plus"></i>
              Add Supplier
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Suppliers" value={Number(statistics.total_suppliers || 0)} icon="fa-users" tone="blue" />
        <SummaryCard label="Active" value={Number(statistics.active_suppliers || 0)} icon="fa-check-circle" tone="green" />
        <SummaryCard label="Inactive / Blocked" value={Number(statistics.inactive_suppliers || 0) + Number(statistics.blacklisted_suppliers || 0)} icon="fa-ban" tone="amber" />
        <SummaryCard label="Purchase Value" value={formatCurrency(statistics.total_purchase_value)} icon="fa-indian-rupee-sign" tone="indigo" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 md:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search name, contact, email, phone, GSTIN"
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
            value={filters.category}
            onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
                <th className="px-4 py-4">Supplier</th>
                <th className="px-4 py-4">Contact</th>
                <th className="px-4 py-4">Category</th>
                <th className="px-4 py-4 text-right">Purchases</th>
                <th className="px-4 py-4 text-center">Inventory</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-14 text-center text-sm font-semibold text-gray-400" colSpan="7">Loading suppliers...</td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td className="px-4 py-14 text-center" colSpan="7">
                    <p className="text-sm font-bold text-gray-500">No suppliers found</p>
                    <p className="mt-1 text-xs text-gray-400">Add a supplier or import existing supplier names from purchases/inventory.</p>
                  </td>
                </tr>
              ) : suppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-black text-gray-900">{supplier.name}</p>
                    <p className="text-xs text-gray-500">{supplier.gstin || supplier.company_name || 'Supplier master'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-gray-800">{supplier.contact_person || '-'}</p>
                    <p className="text-xs text-gray-500">{supplier.phone || supplier.email || '-'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">
                      {supplier.category || 'General'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-black text-gray-900">{formatCurrency(supplier.total_purchase_value)}</p>
                    <p className="text-xs text-gray-500">{Number(supplier.purchase_count || 0)} order(s)</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <p className="text-sm font-black text-gray-900">{Number(supplier.inventory_items || 0)}</p>
                    <p className="text-xs text-gray-500">items</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={supplier.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <IconButton title="View" icon="fa-eye" onClick={() => openView(supplier)} />
                      <IconButton title="Edit" icon="fa-edit" onClick={() => openEdit(supplier)} tone="blue" />
                      <IconButton title="Delete" icon="fa-trash" onClick={() => handleDelete(supplier)} tone="red" />
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
                <h2 className="text-lg font-black text-gray-900">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
                <p className="text-sm text-gray-500">{editingSupplier?.name || 'New supplier master'}</p>
              </div>
              <button type="button" onClick={closeModal} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Supplier Name" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
                <Field label="Contact Person" value={form.contact_person} onChange={(value) => setForm({ ...form, contact_person: value })} />
                <Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
                <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
                <Field label="GSTIN" value={form.gstin} onChange={(value) => setForm({ ...form, gstin: value.toUpperCase() })} />
                <Field label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
                <Field label="Payment Terms" value={form.payment_terms} onChange={(value) => setForm({ ...form, payment_terms: value })} />
                <Field label="Opening Balance" type="number" min="0" step="0.01" value={form.opening_balance} onChange={(value) => setForm({ ...form, opening_balance: value })} />
                <SelectField label="Status" value={form.status} options={statusOptions} onChange={(value) => setForm({ ...form, status: value })} />
                <Field label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
                <Field label="State" value={form.state} onChange={(value) => setForm({ ...form, state: value })} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextAreaField label="Address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
                <TextAreaField label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
                <button type="button" onClick={closeModal} className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Saving...' : editingSupplier ? 'Save Changes' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewSupplier && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gray-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">{viewSupplier.name}</h2>
                <p className="text-sm text-gray-500">{viewSupplier.contact_person || viewSupplier.phone || 'Supplier details'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const supplier = viewSupplier;
                    closeViewModal();
                    if (supplier) openEdit(supplier);
                  }}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                >
                  Edit
                </button>
                <button type="button" onClick={closeViewModal} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {detailsLoading ? (
                <div className="py-16 text-center text-sm font-semibold text-gray-400">Loading supplier details...</div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Detail label="Phone" value={details?.supplier?.phone || viewSupplier.phone} />
                    <Detail label="Email" value={details?.supplier?.email || viewSupplier.email} />
                    <Detail label="GSTIN" value={details?.supplier?.gstin || viewSupplier.gstin} />
                    <Detail label="Terms" value={details?.supplier?.payment_terms || viewSupplier.payment_terms} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
                    <section className="rounded-2xl border border-gray-200 bg-white">
                      <div className="border-b border-gray-100 p-4">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gray-700">Add Communication Log</h3>
                      </div>
                      <form onSubmit={addInteraction} className="space-y-4 p-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <SelectField label="Type" value={logForm.type} options={logTypeOptions} onChange={(value) => setLogForm({ ...logForm, type: value })} />
                          <Field label="Date" type="date" value={logForm.interaction_date} onChange={(value) => setLogForm({ ...logForm, interaction_date: value })} />
                          <Field label="Follow Up" type="date" value={logForm.follow_up_date} onChange={(value) => setLogForm({ ...logForm, follow_up_date: value })} />
                        </div>
                        <Field label="Subject" required value={logForm.subject} onChange={(value) => setLogForm({ ...logForm, subject: value })} />
                        <TextAreaField label="Description" value={logForm.description} onChange={(value) => setLogForm({ ...logForm, description: value })} rows={3} />
                        <div className="flex justify-end">
                          <button type="submit" disabled={savingLog} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">
                            {savingLog ? 'Saving...' : 'Save Log'}
                          </button>
                        </div>
                      </form>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white">
                      <div className="border-b border-gray-100 p-4">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gray-700">Communication History</h3>
                      </div>
                      <div className="max-h-[360px] overflow-y-auto p-4">
                        {!details?.interactions?.length ? (
                          <p className="py-8 text-center text-sm font-semibold text-gray-400">No communication logs yet</p>
                        ) : details.interactions.map((item) => (
                          <div key={item.id} className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 last:mb-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-gray-900">{item.subject}</p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                                  {item.type} - {formatDate(item.interaction_date)}
                                </p>
                              </div>
                              <button type="button" onClick={() => deleteInteraction(item.id)} className="text-xs font-black text-red-600 hover:text-red-700">
                                Delete
                              </button>
                            </div>
                            {item.description && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{item.description}</p>}
                            {item.follow_up_date && <p className="mt-2 text-xs font-bold text-amber-700">Follow up: {formatDate(item.follow_up_date)}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <DependencyTable
                    title="Recent Purchases"
                    emptyText="No purchase entries linked to this supplier"
                    columns={['Purchase', 'Item', 'Date', 'Amount', 'Status']}
                    rows={details?.purchases || []}
                    renderRow={(purchase) => (
                      <tr key={purchase.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-mono text-sm font-black text-gray-900">{purchase.purchase_no || '-'}</p>
                          <p className="text-xs text-gray-500">{purchase.invoice_no || 'No invoice'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-gray-900">{purchase.item_name || '-'}</p>
                          <p className="text-xs text-gray-500">{purchase.item_code || '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{formatDate(purchase.purchase_date)}</td>
                        <td className="px-4 py-3 text-sm font-black text-gray-900">{formatCurrency(purchase.total_amount)}</td>
                        <td className="px-4 py-3"><SmallBadge text={purchase.status || '-'} /></td>
                      </tr>
                    )}
                  />

                  <DependencyTable
                    title="Inventory Dependencies"
                    emptyText="No inventory items linked to this supplier"
                    columns={['Item', 'Code', 'Category', 'Location', 'Qty']}
                    rows={details?.inventory || []}
                    renderRow={(item) => (
                      <tr key={item.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3 text-sm font-black text-gray-900">{item.name || '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700">{item.item_code || '-'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{item.category || '-'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{item.location || '-'}</td>
                        <td className="px-4 py-3 text-sm font-black text-gray-900">{Number(item.quantity || 0)}</td>
                      </tr>
                    )}
                  />
                </div>
              )}
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

function TextAreaField({ label, value, onChange, rows = 4 }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
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

function StatusBadge({ status }) {
  const tones = {
    active: 'border-green-200 bg-green-100 text-green-700',
    inactive: 'border-amber-200 bg-amber-100 text-amber-700',
    blacklisted: 'border-red-200 bg-red-100 text-red-700',
  };
  const value = status || 'active';
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[value] || tones.active}`}>
      {String(value).replace('_', ' ')}
    </span>
  );
}

function SmallBadge({ text }) {
  return (
    <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-gray-600">
      {String(text || '-').replace('_', ' ')}
    </span>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className="break-words text-sm font-bold text-gray-900">{value || '-'}</p>
    </div>
  );
}

function DependencyTable({ title, emptyText, columns, rows, renderRow }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-4">
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gray-700">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
              {columns.map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm font-semibold text-gray-400">{emptyText}</td>
              </tr>
            ) : rows.map(renderRow)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function normalizeInputNumber(value) {
  if (value === null || value === undefined) return '';
  const number = Number(value);
  return Number.isFinite(number) && number !== 0 ? String(number) : '';
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return `INR ${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}
