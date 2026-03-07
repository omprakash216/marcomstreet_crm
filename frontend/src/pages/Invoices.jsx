import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [leads, setLeads] = useState([]);
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    status: '',
  });
  const [formData, setFormData] = useState({
    lead_id: '',
    items: [{ item_name: '', description: '', quantity: 1, unit_price: 0 }],
    tax_percentage: 10,
    discount_percentage: 0,
    due_date: '',
    notes: '',
    payment_terms: '',
  });

  useEffect(() => {
    fetchInvoices();
    fetchLeads();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [filters]);

  const fetchInvoices = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setInvoices([]);
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.status) params.append('status', filters.status);

      const response = await api.get(`/invoices?${params.toString()}`);
      setInvoices(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching invoices:', error);
      }
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLeads([]);
      return;
    }
    
    try {
      const response = await api.get('/leads');
      setLeads(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching leads:', error);
      }
      setLeads([]);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const clearFilters = () => {
    setFilters({
      date_from: '',
      date_to: '',
      status: '',
    });
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { item_name: '', description: '', quantity: 1, unit_price: 0 }],
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    setFormData({ ...formData, items: newItems });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const fmtMoney = (v) => {
    const n = Number.parseFloat(v);
    if (!Number.isFinite(n)) return '0.00';
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtDate = (v) => {
    if (!v) return '-';
    const s = String(v);
    if (/^\\d{4}-\\d{2}-\\d{2}/.test(s)) return s.slice(0, 10);
    try {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch (_) {}
    return s.slice(0, 10);
  };

  const toDateInput = (v) => {
    if (!v) return '';
    const s = String(v);
    if (/^\\d{4}-\\d{2}-\\d{2}/.test(s)) return s.slice(0, 10);
    try {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch (_) {}
    return '';
  };

  const openInvoicePdf = async (invoice, download = false) => {
    if (!invoice?.id) return;
    const url = `/invoices/${encodeURIComponent(String(invoice.id))}/pdf${download ? '?download=1' : ''}`;
    const safeName = `${String(invoice.invoice_number || `invoice_${invoice.id}`).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;

    try {
      const resp = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(resp.data);

      if (download) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      }

      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 8000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to open invoice PDF');
    }
  };

  const openEditInvoice = (invoice) => {
    if (!invoice?.id) return;
    setEditingInvoiceId(invoice.id);
    setFormData({
      lead_id: invoice.lead_id ? String(invoice.lead_id) : '',
      items: Array.isArray(invoice.items) && invoice.items.length
        ? invoice.items.map((it) => ({
          item_name: it.item_name || '',
          description: it.description || '',
          quantity: Number(it.quantity || 1),
          unit_price: Number(it.unit_price || 0),
        }))
        : [{ item_name: '', description: '', quantity: 1, unit_price: 0 }],
      tax_percentage: Number(invoice.tax_percentage ?? 10),
      discount_percentage: Number(invoice.discount_percentage ?? 0),
      due_date: toDateInput(invoice.due_date),
      notes: invoice.notes || '',
      payment_terms: invoice.payment_terms || '',
      status: invoice.status || 'draft',
    });
    setShowModal(true);
  };

  const handleDeleteInvoice = async (invoice) => {
    if (!invoice?.id) return;
    const ok = window.confirm(`Delete invoice ${invoice.invoice_number || ''}? This cannot be undone.`);
    if (!ok) return;
    try {
      const resp = await api.delete(`/invoices/${encodeURIComponent(String(invoice.id))}`);
      if (resp.data?.success) {
        fetchInvoices();
      } else {
        alert(resp.data?.message || 'Failed to delete invoice');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete invoice');
    }
  };

  const handleWhatsAppSend = async (invoice) => {
    if (!invoice?.id) return;
    const defaultPhone = String(invoice.phone || '').trim();
    const phone = window.prompt('Enter WhatsApp number (with country code, e.g. 919XXXXXXXXX):', defaultPhone) || '';
    const clean = phone.replace(/[^\d]/g, '');
    if (!clean) return;

    // Open PDF for user to attach manually (WhatsApp web deep links cannot auto-attach files).
    await openInvoicePdf(invoice, false);

    const msg =
      `Invoice: ${invoice.invoice_number || invoice.id}\\n` +
      `Company: ${invoice.company_name || invoice.client_name || ''}\\n` +
      `Amount: Rs. ${fmtMoney(invoice.total_amount || 0)}\\n\\n` +
      `Please find the invoice PDF attached.`;

    const waUrl = `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    alert('WhatsApp will open in a new tab. Please attach the PDF from the opened invoice PDF tab.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate items
    const invalidItems = formData.items.filter(item => 
      !item.item_name || !item.quantity || item.quantity <= 0 || !item.unit_price || item.unit_price <= 0
    );
    
    if (invalidItems.length > 0) {
      alert('Please fill all required item fields (Name, Quantity > 0, Unit Price > 0)');
      return;
    }
    
    try {
      await api.post('/invoices', formData);
      setShowModal(false);
      setFormData({
        lead_id: '',
        items: [{ item_name: '', description: '', quantity: 1, unit_price: 0 }],
        tax_percentage: 10,
        discount_percentage: 0,
        due_date: '',
        notes: '',
        payment_terms: '',
      });
      fetchInvoices();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create invoice');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      {/* Professional Header Section */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left Side - Title and Icon */}
            <div className="flex items-center space-x-4">
              {/* Icon */}
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
              </div>
              
              {/* Title and Description */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-1">Invoices</h1>
                <p className="text-slate-300 text-sm">Generate and manage invoices for your clients</p>
              </div>
            </div>
            
            {/* Right Side - Action Button */}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl hover:bg-slate-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Invoice</span>
            </button>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        {/* Table Headers - Always Visible */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SL No</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Number</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Invoices Content */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🧾</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No invoices found</h3>
            <p className="text-gray-600 mb-6">
              {filters.date_from || filters.date_to || filters.status
                ? 'No invoices match your filters. Try adjusting your search criteria.'
                : 'No invoices logged yet. Start by creating your first invoice.'}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg"
            >
              Create Invoice
            </button>
          </div>
        ) : (
          <div className="p-6">
            <div className="space-y-4">
              {invoices.map((invoice, index) => (
            <div key={invoice.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-500">SL No: {index + 1}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{invoice.invoice_number}</h3>
                  <p className="text-sm text-gray-600 mt-1">{invoice.company_name}</p>
                  {invoice.contact_person && (
                    <p className="text-xs text-gray-500 mt-1">Contact: {invoice.contact_person}</p>
                  )}
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(invoice.status)}`}>
                  {invoice.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Issue Date</div>
                  <div className="font-semibold text-gray-900">{new Date(invoice.issue_date).toLocaleDateString()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Due Date</div>
                  <div className="font-semibold text-gray-900">
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Subtotal</div>
                  <div className="font-semibold text-gray-900">₹{parseFloat(invoice.subtotal || 0).toLocaleString('en-IN')}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border-2 border-green-200">
                  <div className="text-xs text-green-600 mb-1">Total Amount</div>
                  <div className="font-bold text-lg text-green-700">₹{parseFloat(invoice.total_amount || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {invoice.items && invoice.items.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Items ({invoice.items.length})</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {invoice.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{item.item_name}</div>
                              {item.description && (
                                <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-sm">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-sm">₹{parseFloat(item.unit_price || 0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{parseFloat(item.total_price || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {invoice.notes && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
                  <p className="text-sm text-gray-600">{invoice.notes}</p>
                </div>
              )}

              {invoice.payment_terms && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-1">Payment Terms:</p>
                  <p className="text-sm text-gray-600">{invoice.payment_terms}</p>
                </div>
              )}
              </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg p-4 w-full max-w-5xl my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold">Create Invoice</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Lead Selection - Compact */}
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1">Select Lead *</label>
                  <select
                    required
                    value={formData.lead_id}
                    onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">Select Lead</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.company_name} - {lead.contact_person}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tax %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tax_percentage}
                    onChange={(e) => setFormData({ ...formData, tax_percentage: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Discount %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              {/* Items Table - Landscape Format */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-medium">Items *</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-1.5 px-2 font-medium text-xs">Item Name</th>
                        <th className="text-right py-1.5 px-2 font-medium text-xs w-20">Qty</th>
                        <th className="text-right py-1.5 px-2 font-medium text-xs w-24">Unit Price</th>
                        <th className="text-right py-1.5 px-2 font-medium text-xs w-24">Total</th>
                        <th className="w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              placeholder="Item Name *"
                              required
                              value={item.item_name}
                              onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                              className="w-full border rounded px-2 py-1 text-xs"
                            />
                            <textarea
                              placeholder="Description (optional)"
                              value={item.description}
                              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                              className="w-full border rounded px-2 py-1 text-xs mt-1"
                              rows="1"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              placeholder="Qty"
                              required
                              min="1"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                              className="w-full border rounded px-2 py-1 text-xs text-right"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              placeholder="Price"
                              required
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                              className="w-full border rounded px-2 py-1 text-xs text-right"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right text-xs font-medium">
                            ₹{((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {formData.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-red-600 hover:text-red-800 text-xs"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Row - Landscape */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Payment Terms</label>
                  <textarea
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    rows="2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    rows="2"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
