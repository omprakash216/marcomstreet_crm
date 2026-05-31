import { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';

const initialForm = {
  name: '',
  item_code: '',
  barcode: '',
  category: '',
  sub_category: '',
  location: '',
  quantity: '',
  minimum_stock_level: '',
  unit_price: '',
  supplier: '',
  purchase_date: '',
  description: '',
  status: 'available',
  assigned_to_id: ''
};

export default function AdminInventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [searchTerm, setSearchTerm] = useState('');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanFrameRef = useRef(null);

  useEffect(() => {
    fetchInventory();
    fetchEmployees();
  }, []);

  useEffect(() => {
    return () => stopScanner();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/inventory');
      setInventory(resp.data.data || []);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const resp = await api.get('/employees');
      setEmployees(resp.data.data || []);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const fillFromBarcodeLookup = async (code) => {
    if (!code) return;
    try {
      const resp = await api.get(`/inventory/lookup/${encodeURIComponent(code)}`);
      const item = resp.data?.data;
      setFormData((prev) => ({
        ...prev,
        barcode: code,
        item_code: prev.item_code || code,
        ...(item
          ? {
              name: prev.name || item.name || '',
              category: prev.category || item.category || '',
              sub_category: prev.sub_category || item.sub_category || '',
              location: prev.location || item.location || '',
              supplier: prev.supplier || item.supplier || '',
              unit_price: Number(prev.unit_price) > 0 ? prev.unit_price : Number(item.unit_price || 0),
            }
          : {}),
      }));
    } catch (err) {
      setFormData((prev) => ({ ...prev, barcode: code, item_code: prev.item_code || code }));
    }
  };

  const stopScanner = () => {
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScannerOpen(false);
  };

  const startScanner = async () => {
    setScannerError('');

    if (!('BarcodeDetector' in window)) {
      setScannerError('Barcode scanner browser me supported nahi hai. Manual barcode enter karein.');
      setScannerOpen(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setScannerOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          detectBarcodeLoop();
        }
      }, 50);
    } catch (err) {
      setScannerError('Camera access allow karein, phir retry karein.');
      setScannerOpen(true);
    }
  };

  const detectBarcodeLoop = async () => {
    if (!videoRef.current) return;
    try {
      const detector = new window.BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'],
      });
      const barcodes = await detector.detect(videoRef.current);
      if (barcodes.length > 0 && barcodes[0].rawValue) {
        const code = String(barcodes[0].rawValue).trim();
        await fillFromBarcodeLookup(code);
        stopScanner();
        return;
      }
    } catch (_) {
      // keep scanning
    }
    scanFrameRef.current = requestAnimationFrame(detectBarcodeLoop);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const cleanedName = String(formData.name || '').trim();
      const cleanedItemCode = String(formData.item_code || '').trim().toUpperCase();
      const cleanedBarcode = String(formData.barcode || '').trim();
      const cleanedCategory = String(formData.category || '').trim();
      const cleanedSubCategory = String(formData.sub_category || '').trim();
      const cleanedLocation = String(formData.location || '').trim();
      const cleanedSupplier = String(formData.supplier || '').trim();
      const cleanedDescription = String(formData.description || '').trim();
      const quantity = formData.quantity === '' ? NaN : Number(formData.quantity);
      const minimumStockLevel =
        formData.minimum_stock_level === '' ? NaN : Number(formData.minimum_stock_level);
      const unitPrice = formData.unit_price === '' ? NaN : Number(formData.unit_price);

      if (!cleanedName || !cleanedItemCode) {
        alert('Item Name aur Item Code required hain');
        return;
      }

      if (!cleanedCategory || !cleanedLocation) {
        alert('Category aur Location required hain');
        return;
      }

      if (!Number.isFinite(quantity) || quantity < 0) {
        alert('Quantity valid hona chahiye');
        return;
      }

      if (!Number.isFinite(minimumStockLevel) || minimumStockLevel < 0) {
        alert('Minimum Stock valid hona chahiye');
        return;
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        alert('Unit Price valid hona chahiye');
        return;
      }

      const data = {
        ...formData,
        name: cleanedName,
        item_code: cleanedItemCode,
        barcode: cleanedBarcode,
        category: cleanedCategory,
        sub_category: cleanedSubCategory,
        location: cleanedLocation,
        supplier: cleanedSupplier,
        description: cleanedDescription,
        quantity,
        minimum_stock_level: minimumStockLevel,
        unit_price: unitPrice,
        assigned_to_id: formData.assigned_to_id === '' ? null : formData.assigned_to_id,
      };

      if (editItem) {
        await api.put(`/inventory/${editItem.id}`, data);
      } else {
        await api.post('/inventory', data);
      }
      setShowModal(false);
      setEditItem(null);
      setFormData(initialForm);
      fetchInventory();
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed');
    }
  };

  const openEdit = (item) => {
    setEditItem(item);
    setFormData({
      name: item.name || '',
      item_code: getItemCode(item),
      barcode: item.barcode || '',
      category: item.category || '',
      sub_category: item.sub_category || '',
      location: item.location || '',
      quantity:
        item.quantity === null || item.quantity === undefined ? '' : Number(item.quantity),
      minimum_stock_level:
        item.minimum_stock_level === null ||
        item.minimum_stock_level === undefined ||
        Number(item.minimum_stock_level) === 0
          ? ''
          : Number(item.minimum_stock_level),
      unit_price:
        item.unit_price === null || item.unit_price === undefined || Number(item.unit_price) === 0
          ? ''
          : Number(item.unit_price),
      supplier: item.supplier || '',
      purchase_date: item.purchase_date ? String(item.purchase_date).slice(0, 10) : '',
      description: item.description || '',
      status: item.status || 'available',
      assigned_to_id: item.assigned_to_id || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.delete(`/inventory/${id}`);
      fetchInventory();
    } catch (_) {
      alert('Delete failed');
    }
  };

  const closeFormModal = () => {
    setShowModal(false);
    setEditItem(null);
    setFormData(initialForm);
  };

  const filteredInventory = inventory.filter((item) => {
    const q = searchTerm.toLowerCase();
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.item_code || '').toLowerCase().includes(q) ||
      (item.barcode || '').toLowerCase().includes(q)
    );
  });

  const stats = {
    total: inventory.length,
    available: inventory.filter((i) => i.status === 'available').length,
    in_use: inventory.filter((i) => i.status === 'in_use').length,
    maintenance: inventory.filter((i) => i.status === 'maintenance' || i.status === 'broken').length,
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
              <i className="fas fa-warehouse text-gray-700 text-xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
              <p className="text-gray-500 text-sm">Items, stock levels, and barcode lookup</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => fetchInventory()}
              className="px-5 py-2.5 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setEditItem(null);
                setFormData(initialForm);
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              <i className="fas fa-plus"></i>
              Add New Item
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard label="Total Items" value={stats.total} icon="fas fa-boxes" color="blue" />
        <StatCard label="Available" value={stats.available} icon="fas fa-check-circle" color="green" />
        <StatCard label="In Use" value={stats.in_use} icon="fas fa-user-tag" color="indigo" />
        <StatCard label="Restocking/Issues" value={stats.maintenance} icon="fas fa-exclamation-triangle" color="amber" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50">
          <div className="relative flex-1 max-w-md">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="Search by name, category, item code, barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-[11px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200">
                <th className="px-4 py-4">SL</th>
                <th className="px-4 py-4">Item</th>
                <th className="px-4 py-4">Code</th>
                <th className="px-4 py-4">Category</th>
                <th className="px-4 py-4">Supplier</th>
                <th className="px-4 py-4">Location</th>
                <th className="px-4 py-4 text-center">Qty</th>
                <th className="px-4 py-4 text-center">Min Stock</th>
                <th className="px-4 py-4">Unit Price</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="11" className="px-6 py-12 text-center text-gray-400">Loading inventory...</td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-6 py-12 text-center text-gray-400">No inventory items found</td>
                </tr>
              ) : (
                filteredInventory.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-900 text-sm">{item.name || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-bold text-gray-800">{getItemCode(item)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">{item.category || 'Uncategorized'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-700">{item.supplier || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-700">{item.location || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm font-bold">{item.quantity}</td>
                    <td className="px-4 py-3 text-center font-mono text-sm">
                      {item.minimum_stock_level && Number(item.minimum_stock_level) > 0
                        ? item.minimum_stock_level
                        : '-'}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {!item.unit_price || Number(item.unit_price) <= 0
                        ? '-'
                        : `INR ${Number(item.unit_price).toLocaleString('en-IN')}`}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewItem(item)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100"
                          title="View details"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                          title="Edit item"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                          title="Delete item"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">{editItem ? 'Edit Item' : 'Add New Item'}</h3>
              <button onClick={closeFormModal} className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-400"><i className="fas fa-times"></i></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Item Name *</label>
                  <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Item Code *</label>
                  <input required type="text" value={formData.item_code} onChange={(e) => setFormData({ ...formData, item_code: e.target.value.toUpperCase() })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Barcode</label>
                  <input type="text" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" placeholder="Scan or type barcode" />
                </div>
                <div className="flex items-end gap-2">
                  <button type="button" onClick={startScanner} className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700">
                    <i className="fas fa-barcode mr-2"></i>Scan
                  </button>
                  <button type="button" onClick={() => fillFromBarcodeLookup(formData.barcode || manualCode)} className="px-4 py-2.5 bg-gray-200 rounded-xl font-semibold">Lookup</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category *</label>
                  <input required type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sub Category</label>
                  <input type="text" value={formData.sub_category} onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Quantity *</label>
                  <input required type="number" min="0" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} placeholder="Enter quantity" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Min Stock *</label>
                  <input required type="number" min="0" value={formData.minimum_stock_level} onChange={(e) => setFormData({ ...formData, minimum_stock_level: e.target.value })} placeholder="Enter minimum stock" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Unit Price *</label>
                  <input required type="number" min="0" step="0.01" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })} placeholder="Enter unit price" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <option value="available">Available</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="broken">Broken</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Location *</label>
                  <input required type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Supplier</label>
                  <input type="text" value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Purchase Date</label>
                  <input type="date" value={formData.purchase_date} onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Assigned To</label>
                  <select value={formData.assigned_to_id} onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <option value="">Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl" rows={3} />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={closeFormModal} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700">{editItem ? 'Save Changes' : 'Add Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewItem && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{viewItem.name || 'Inventory Item'}</h3>
                <p className="text-sm text-gray-500">Detailed inventory information</p>
              </div>
              <button
                onClick={() => setViewItem(null)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-400"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <DetailCard label="Item Code" value={getItemCode(viewItem)} />
              <DetailCard label="Barcode" value={viewItem.barcode} />
              <DetailCard label="Category" value={viewItem.category} />
              <DetailCard label="Sub Category" value={viewItem.sub_category} />
              <DetailCard label="Location" value={viewItem.location} />
              <DetailCard label="Supplier" value={viewItem.supplier} />
              <DetailCard label="Quantity" value={viewItem.quantity} />
              <DetailCard
                label="Minimum Stock"
                value={
                  viewItem.minimum_stock_level && Number(viewItem.minimum_stock_level) > 0
                    ? viewItem.minimum_stock_level
                    : '-'
                }
              />
              <DetailCard
                label="Unit Price"
                value={
                  !viewItem.unit_price || Number(viewItem.unit_price) <= 0
                    ? '-'
                    : `INR ${Number(viewItem.unit_price).toLocaleString('en-IN')}`
                }
              />
              <DetailCard label="Purchase Date" value={viewItem.purchase_date ? String(viewItem.purchase_date).slice(0, 10) : '-'} />
              <DetailCard label="Assigned To" value={viewItem.assigned_to_name || 'Unassigned'} />
              <DetailCard label="Status" value={String(viewItem.status || '').replace('_', ' ')} />
              <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewItem.description || 'No description available'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {scannerOpen && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-900">Barcode Scanner</h4>
              <button onClick={stopScanner} className="px-3 py-1 rounded bg-gray-100">Close</button>
            </div>
            {scannerError && <p className="text-sm text-red-600">{scannerError}</p>}
            <video ref={videoRef} className="w-full h-72 bg-black rounded-xl object-cover" autoPlay muted playsInline />
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Manual barcode"
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <button
                type="button"
                onClick={async () => {
                  await fillFromBarcodeLookup(manualCode);
                  stopScanner();
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
              >
                Use Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };
  return (
    <div className={`p-4 sm:p-5 rounded-2xl border ${colors[color]} shadow-sm`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="flex-1 text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-gray-600 leading-snug break-words">
          {label}
        </span>
        <i className={`${icon} text-lg sm:text-xl`}></i>
      </div>
      <p className="text-xl sm:text-2xl font-black leading-none">{value}</p>
    </div>
  );
}

function getItemCode(item) {
  if (item?.item_code) return item.item_code;
  if (!item?.id) return '-';
  return `ITM${String(item.id).padStart(5, '0')}`;
}

function StatusBadge({ status }) {
  const badges = {
    available: 'bg-green-100 text-green-700 border-green-200',
    in_use: 'bg-blue-100 text-blue-700 border-blue-200',
    maintenance: 'bg-amber-100 text-amber-700 border-amber-200',
    broken: 'bg-red-100 text-red-700 border-red-200',
  };
  const label = String(status || 'available').replace('_', ' ').toUpperCase();
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badges[status] || badges.available}`}>{label}</span>;
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm">
      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">{label}</p>
      <p className="text-sm font-semibold text-gray-900 break-words">
        {value === null || value === undefined || value === '' ? '-' : value}
      </p>
    </div>
  );
}
