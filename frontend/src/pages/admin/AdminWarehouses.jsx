import { useEffect, useState } from 'react';
import api from '../../utils/api';

const emptyForm = {
  name: '',
  code: '',
  manager_name: '',
  phone: '',
  email: '',
  capacity_units: '',
  status: 'active',
  city: '',
  state: '',
  address: '',
  notes: '',
};

const emptyMovementForm = {
  type: 'in',
  item_name: '',
  item_code: '',
  quantity: '',
  from_warehouse: '',
  to_warehouse: '',
  reference_no: '',
  movement_date: new Date().toISOString().slice(0, 10),
  notes: '',
};

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const movementTypeOptions = [
  { value: 'in', label: 'Stock In' },
  { value: 'out', label: 'Stock Out' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'adjustment', label: 'Adjustment' },
];

export default function AdminWarehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [statistics, setStatistics] = useState({
    total_warehouses: 0,
    active_warehouses: 0,
    inactive_warehouses: 0,
    inventory_items: 0,
    stock_quantity: 0,
    stock_value: 0,
    low_stock_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [viewWarehouse, setViewWarehouse] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    const handle = setTimeout(fetchWarehouses, 300);
    return () => clearTimeout(handle);
  }, [filters.search, filters.status]);

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.status !== 'all') params.status = filters.status;

      const response = await api.get('/warehouses', { params });
      if (response.data?.success) {
        setWarehouses(Array.isArray(response.data.data) ? response.data.data : []);
        setStatistics(response.data.statistics || {});
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Warehouses load nahi ho paaye');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingWarehouse(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setForm({
      name: warehouse.name || '',
      code: warehouse.code || '',
      manager_name: warehouse.manager_name || '',
      phone: warehouse.phone || '',
      email: warehouse.email || '',
      capacity_units: normalizeInputNumber(warehouse.capacity_units),
      status: warehouse.status || 'active',
      city: warehouse.city || '',
      state: warehouse.state || '',
      address: warehouse.address || '',
      notes: warehouse.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingWarehouse(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      email: form.email.trim(),
      capacity_units: Number(form.capacity_units || 0),
    };

    if (!payload.name) return alert('Warehouse name required hai');
    if (payload.capacity_units < 0) return alert('Capacity valid hona chahiye');

    setSaving(true);
    try {
      if (editingWarehouse) {
        await api.put(`/warehouses/${editingWarehouse.id}`, payload);
      } else {
        await api.post('/warehouses', payload);
      }
      closeModal();
      await fetchWarehouses();
    } catch (err) {
      alert(err.response?.data?.message || 'Warehouse save nahi ho paaya');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (warehouse) => {
    if (!window.confirm(`Delete warehouse "${warehouse.name}"?`)) return;
    try {
      await api.delete(`/warehouses/${warehouse.id}`);
      if (viewWarehouse?.id === warehouse.id) closeViewModal();
      await fetchWarehouses();
    } catch (err) {
      alert(err.response?.data?.message || 'Warehouse delete nahi ho paaya');
    }
  };

  const syncExistingWarehouses = async () => {
    setSyncing(true);
    try {
      const response = await api.post('/warehouses/sync');
      alert(response.data?.message || 'Warehouse sync complete');
      await fetchWarehouses();
    } catch (err) {
      alert(err.response?.data?.message || 'Existing warehouses sync nahi ho paaye');
    } finally {
      setSyncing(false);
    }
  };

  const openView = async (warehouse) => {
    setViewWarehouse(warehouse);
    setDetails(null);
    setMovementForm({
      ...emptyMovementForm,
      from_warehouse: warehouse.name || '',
      to_warehouse: '',
    });
    await fetchDetails(warehouse.id);
  };

  const fetchDetails = async (warehouseId) => {
    setDetailsLoading(true);
    try {
      const response = await api.get(`/warehouses/${warehouseId}/dependencies`);
      setDetails(response.data?.data || null);
    } catch (err) {
      alert(err.response?.data?.message || 'Warehouse details load nahi ho paaye');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeViewModal = () => {
    setViewWarehouse(null);
    setDetails(null);
    setMovementForm(emptyMovementForm);
  };

  const addMovement = async (event) => {
    event.preventDefault();
    if (!viewWarehouse) return;

    const payload = {
      ...movementForm,
      item_name: movementForm.item_name.trim(),
      item_code: movementForm.item_code.trim().toUpperCase(),
      quantity: Number(movementForm.quantity || 0),
    };

    if (!payload.item_name) return alert('Item name required hai');
    if (payload.quantity <= 0) return alert('Quantity 0 se zyada honi chahiye');

    setSavingMovement(true);
    try {
      await api.post(`/warehouses/${viewWarehouse.id}/movements`, payload);
      setMovementForm({
        ...emptyMovementForm,
        from_warehouse: viewWarehouse.name || '',
      });
      await fetchDetails(viewWarehouse.id);
    } catch (err) {
      alert(err.response?.data?.message || 'Movement save nahi ho paaya');
    } finally {
      setSavingMovement(false);
    }
  };

  const deleteMovement = async (movementId) => {
    if (!window.confirm('Delete this movement log?')) return;
    try {
      await api.delete(`/warehouses/movements/${movementId}`);
      if (viewWarehouse) await fetchDetails(viewWarehouse.id);
    } catch (err) {
      alert(err.response?.data?.message || 'Movement delete nahi ho paaya');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
              <i className="fas fa-warehouse text-xl"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2c86ab]">Company Admin Panel</p>
              <h1 className="mt-1 text-2xl font-black text-gray-900">Warehouses</h1>
              <p className="mt-1 text-sm text-gray-600">Warehouse master, stock availability, purchase links, and movement logs</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchWarehouses}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <i className="fas fa-sync-alt"></i>
              Refresh
            </button>
            <button
              type="button"
              onClick={syncExistingWarehouses}
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
              Add Warehouse
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Warehouses" value={Number(statistics.total_warehouses || 0)} icon="fa-warehouse" tone="blue" />
        <SummaryCard label="Inventory Items" value={Number(statistics.inventory_items || 0)} icon="fa-boxes" tone="green" />
        <SummaryCard label="Stock Quantity" value={Number(statistics.stock_quantity || 0)} icon="fa-layer-group" tone="indigo" />
        <SummaryCard label="Low Stock" value={Number(statistics.low_stock_count || 0)} icon="fa-triangle-exclamation" tone="amber" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 md:grid-cols-[1fr_180px]">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search warehouse, code, manager, phone, city"
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
                <th className="px-4 py-4">Warehouse</th>
                <th className="px-4 py-4">Manager</th>
                <th className="px-4 py-4">Location</th>
                <th className="px-4 py-4 text-right">Stock Value</th>
                <th className="px-4 py-4 text-center">Items</th>
                <th className="px-4 py-4 text-center">Low Stock</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-14 text-center text-sm font-semibold text-gray-400" colSpan="8">Loading warehouses...</td>
                </tr>
              ) : warehouses.length === 0 ? (
                <tr>
                  <td className="px-4 py-14 text-center" colSpan="8">
                    <p className="text-sm font-bold text-gray-500">No warehouses found</p>
                    <p className="mt-1 text-xs text-gray-400">Add a warehouse or import existing locations from inventory/purchases.</p>
                  </td>
                </tr>
              ) : warehouses.map((warehouse) => (
                <tr key={warehouse.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-black text-gray-900">{warehouse.name}</p>
                    <p className="text-xs text-gray-500">{warehouse.code || warehouse.company_name || 'Warehouse master'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-gray-800">{warehouse.manager_name || '-'}</p>
                    <p className="text-xs text-gray-500">{warehouse.phone || warehouse.email || '-'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-700">{[warehouse.city, warehouse.state].filter(Boolean).join(', ') || '-'}</p>
                    <p className="text-xs text-gray-500">{warehouse.address || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-black text-gray-900">{formatCurrency(warehouse.stock_value)}</p>
                    <p className="text-xs text-gray-500">Qty {Number(warehouse.stock_quantity || 0)}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-black text-gray-900">{Number(warehouse.inventory_items || 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${Number(warehouse.low_stock_count || 0) > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {Number(warehouse.low_stock_count || 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={warehouse.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <IconButton title="View" icon="fa-eye" onClick={() => openView(warehouse)} />
                      <IconButton title="Edit" icon="fa-edit" onClick={() => openEdit(warehouse)} tone="blue" />
                      <IconButton title="Delete" icon="fa-trash" onClick={() => handleDelete(warehouse)} tone="red" />
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
                <h2 className="text-lg font-black text-gray-900">{editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}</h2>
                <p className="text-sm text-gray-500">{editingWarehouse?.name || 'New warehouse master'}</p>
              </div>
              <button type="button" onClick={closeModal} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Warehouse Name" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
                <Field label="Warehouse Code" value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase() })} />
                <SelectField label="Status" value={form.status} options={statusOptions} onChange={(value) => setForm({ ...form, status: value })} />
                <Field label="Manager Name" value={form.manager_name} onChange={(value) => setForm({ ...form, manager_name: value })} />
                <Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
                <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
                <Field label="Capacity Units" type="number" min="0" step="0.01" value={form.capacity_units} onChange={(value) => setForm({ ...form, capacity_units: value })} />
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
                  {saving ? 'Saving...' : editingWarehouse ? 'Save Changes' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewWarehouse && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gray-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">{viewWarehouse.name}</h2>
                <p className="text-sm text-gray-500">{viewWarehouse.code || viewWarehouse.manager_name || 'Warehouse details'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const warehouse = viewWarehouse;
                    closeViewModal();
                    if (warehouse) openEdit(warehouse);
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
                <div className="py-16 text-center text-sm font-semibold text-gray-400">Loading warehouse details...</div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Detail label="Manager" value={details?.warehouse?.manager_name || viewWarehouse.manager_name} />
                    <Detail label="Phone" value={details?.warehouse?.phone || viewWarehouse.phone} />
                    <Detail label="Email" value={details?.warehouse?.email || viewWarehouse.email} />
                    <Detail label="Capacity" value={details?.warehouse?.capacity_units || viewWarehouse.capacity_units} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
                    <section className="rounded-2xl border border-gray-200 bg-white">
                      <div className="border-b border-gray-100 p-4">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gray-700">Add Movement Log</h3>
                      </div>
                      <form onSubmit={addMovement} className="space-y-4 p-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <SelectField label="Type" value={movementForm.type} options={movementTypeOptions} onChange={(value) => setMovementForm({ ...movementForm, type: value })} />
                          <Field label="Movement Date" type="date" value={movementForm.movement_date} onChange={(value) => setMovementForm({ ...movementForm, movement_date: value })} />
                          <Field label="Reference No" value={movementForm.reference_no} onChange={(value) => setMovementForm({ ...movementForm, reference_no: value })} />
                          <Field label="Item Name" required value={movementForm.item_name} onChange={(value) => setMovementForm({ ...movementForm, item_name: value })} />
                          <Field label="Item Code" value={movementForm.item_code} onChange={(value) => setMovementForm({ ...movementForm, item_code: value.toUpperCase() })} />
                          <Field label="Quantity" required type="number" min="0.01" step="0.01" value={movementForm.quantity} onChange={(value) => setMovementForm({ ...movementForm, quantity: value })} />
                          <Field label="From Warehouse" value={movementForm.from_warehouse} onChange={(value) => setMovementForm({ ...movementForm, from_warehouse: value })} />
                          <Field label="To Warehouse" value={movementForm.to_warehouse} onChange={(value) => setMovementForm({ ...movementForm, to_warehouse: value })} />
                        </div>
                        <TextAreaField label="Notes" value={movementForm.notes} onChange={(value) => setMovementForm({ ...movementForm, notes: value })} rows={3} />
                        <div className="flex justify-end">
                          <button type="submit" disabled={savingMovement} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">
                            {savingMovement ? 'Saving...' : 'Save Movement'}
                          </button>
                        </div>
                      </form>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white">
                      <div className="border-b border-gray-100 p-4">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gray-700">Movement History</h3>
                      </div>
                      <div className="max-h-[420px] overflow-y-auto p-4">
                        {!details?.movements?.length ? (
                          <p className="py-8 text-center text-sm font-semibold text-gray-400">No movement logs yet</p>
                        ) : details.movements.map((item) => (
                          <div key={item.id} className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 last:mb-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-gray-900">{item.item_name}</p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                                  {item.type} - {formatDate(item.movement_date)} - Qty {Number(item.quantity || 0)}
                                </p>
                              </div>
                              <button type="button" onClick={() => deleteMovement(item.id)} className="text-xs font-black text-red-600 hover:text-red-700">
                                Delete
                              </button>
                            </div>
                            <p className="mt-2 text-xs font-semibold text-gray-600">
                              {[item.from_warehouse, item.to_warehouse].filter(Boolean).join(' -> ') || item.reference_no || '-'}
                            </p>
                            {item.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{item.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <DependencyTable
                    title="Warehouse Stock"
                    emptyText="No inventory items linked to this warehouse"
                    columns={['Item', 'Code', 'Category', 'Supplier', 'Qty', 'Min Stock', 'Value']}
                    rows={details?.inventory || []}
                    renderRow={(item) => (
                      <tr key={item.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3 text-sm font-black text-gray-900">{item.name || '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700">{item.item_code || '-'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{item.category || '-'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{item.supplier || '-'}</td>
                        <td className="px-4 py-3 text-sm font-black text-gray-900">{Number(item.quantity || 0)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{Number(item.minimum_stock_level || 0)}</td>
                        <td className="px-4 py-3 text-sm font-black text-gray-900">{formatCurrency(Number(item.quantity || 0) * Number(item.unit_price || 0))}</td>
                      </tr>
                    )}
                  />

                  <DependencyTable
                    title="Recent Purchases"
                    emptyText="No purchase entries linked to this warehouse"
                    columns={['Purchase', 'Supplier', 'Item', 'Date', 'Amount', 'Status']}
                    rows={details?.purchases || []}
                    renderRow={(purchase) => (
                      <tr key={purchase.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-mono text-sm font-black text-gray-900">{purchase.purchase_no || '-'}</p>
                          <p className="text-xs text-gray-500">{purchase.invoice_no || 'No invoice'}</p>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{purchase.supplier_name || '-'}</td>
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
