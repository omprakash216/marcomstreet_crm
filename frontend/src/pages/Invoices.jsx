import { useState, useEffect } from 'react';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';
import { downloadPdfUrl, openPdfUrlInNewTab, printPdfFromApi, sanitizePdfFileName } from '../utils/pdfActions';

function createDefaultCompanySettings() {
  return {
    company_name: '',
    email: '',
    phone: '',
    address: '',
    gst_number: '',
    pan_number: '',
    quotation_template: 'standard',
    quotation_header_text: '',
    quotation_footer_text: 'Thank you for your business!',
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    branch_name: '',
    nature: 'Current Account',
    logo_path: '',
  };
}

function normalizeCompanySettings(settings = {}) {
  return {
    ...createDefaultCompanySettings(),
    ...settings,
    quotation_footer_text: settings?.quotation_footer_text ?? 'Thank you for your business!',
    nature: settings?.nature || 'Current Account',
  };
}

export default function Invoices() {
  const employee = getEmployee();
  const canEditCompanySettings = ['admin', 'superadmin', 'super_admin'].includes(String(employee?.role || '').toLowerCase());
  const itemsPerPage = 20;
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [leads, setLeads] = useState([]);
  const [companySettings, setCompanySettings] = useState(createDefaultCompanySettings());
  const [companySettingsSnapshot, setCompanySettingsSnapshot] = useState(createDefaultCompanySettings());
  const [companySettingsLoading, setCompanySettingsLoading] = useState(true);
  const [companySettingsSaving, setCompanySettingsSaving] = useState(false);
  const [companySettingsError, setCompanySettingsError] = useState('');
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    status: '',
  });
  const [formData, setFormData] = useState({
    lead_id: '',
    items: [{ item_name: '', description: '', quantity: 1, unit_price: 0 }],
    tax_percentage: 18,
    tds_percentage: 0,
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
    fetchCompanySettings();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.date_from, filters.date_to, filters.status]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(invoices.length / itemsPerPage));
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [invoices.length, currentPage]);

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
    } catch (_) { }
    return s.slice(0, 10);
  };

  const toDateInput = (v) => {
    if (!v) return '';
    const s = String(v);
    if (/^\\d{4}-\\d{2}-\\d{2}/.test(s)) return s.slice(0, 10);
    try {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch (_) { }
    return '';
  };

  const openInvoicePdf = async (invoice, action = 'view') => {
    if (!invoice?.id) return;
    try {
      const safeNumber = sanitizePdfFileName(invoice.invoice_number || `INV-${invoice.id}`, 'invoice');
      const mode = action === true ? 'download' : action === false ? 'view' : action;
      if (mode === 'download') {
        downloadPdfUrl(`/invoices/${invoice.id}/pdf`, {
          fileName: `invoice_${safeNumber}.pdf`,
        });
        return;
      }
      if (mode === 'print') {
        await printPdfFromApi(`/invoices/${invoice.id}/pdf`);
        return;
      }
      openPdfUrlInNewTab(`/invoices/${invoice.id}/pdf`);
    } catch (err) {
      alert(err.message || 'Failed to open invoice PDF');
    }
  };

  const fetchCompanySettings = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCompanySettingsLoading(false);
      return;
    }

    setCompanySettingsLoading(true);
    setCompanySettingsError('');
    try {
      const response = await api.get('/invoices/template-settings');
      const nextSettings = normalizeCompanySettings(response?.data?.data || {});
      setCompanySettings(nextSettings);
      setCompanySettingsSnapshot(nextSettings);
    } catch (error) {
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching company settings:', error);
      }
      const fallbackSettings = createDefaultCompanySettings();
      setCompanySettings(fallbackSettings);
      setCompanySettingsSnapshot(fallbackSettings);
      setCompanySettingsError(error.response?.data?.message || 'Unable to load company bank details.');
    } finally {
      setCompanySettingsLoading(false);
    }
  };

  const handleCompanySettingChange = (field, value) => {
    setCompanySettings((current) => ({ ...current, [field]: value }));
  };

  const buildCompanySettingsPayload = (settings) => ({
    company_name: settings.company_name || '',
    email: settings.email || '',
    phone: settings.phone || '',
    address: settings.address || '',
    gst_number: settings.gst_number || '',
    pan_number: settings.pan_number || '',
    quotation_template: settings.quotation_template || 'standard',
    quotation_header_text: settings.quotation_header_text || '',
    quotation_footer_text: settings.quotation_footer_text || 'Thank you for your business!',
    bank_name: settings.bank_name || '',
    account_holder_name: settings.account_holder_name || '',
    account_number: settings.account_number || '',
    ifsc_code: settings.ifsc_code || '',
    branch_name: settings.branch_name || '',
    nature: settings.nature || 'Current Account',
    logo_path: settings.logo_path || '',
  });

  const hasCompanySettingsChanges = () => {
    if (!canEditCompanySettings) return false;
    const fields = ['bank_name', 'account_holder_name', 'account_number', 'ifsc_code', 'branch_name', 'nature'];
    return fields.some((field) => String(companySettings?.[field] ?? '') !== String(companySettingsSnapshot?.[field] ?? ''));
  };

  const saveCompanySettings = async ({ silent = false } = {}) => {
    if (!canEditCompanySettings) return true;
    if (!hasCompanySettingsChanges()) return true;

    setCompanySettingsSaving(true);
    try {
      const payload = buildCompanySettingsPayload(companySettings);
      const response = await api.put('/admin/company-settings', payload);
      if (response?.data?.success) {
        const nextSettings = normalizeCompanySettings({ ...companySettings, ...(response.data.data || {}) });
        setCompanySettings(nextSettings);
        setCompanySettingsSnapshot(nextSettings);
        setCompanySettingsError('');
        return true;
      }
      throw new Error(response?.data?.message || 'Failed to save company settings');
    } catch (error) {
      if (!silent) {
        alert(error.response?.data?.message || error.message || 'Failed to save bank details');
      }
      return false;
    } finally {
      setCompanySettingsSaving(false);
    }
  };

  const openInvoiceDetails = (invoice) => {
    setViewInvoice(invoice);
    setShowViewModal(true);
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
      tax_percentage: Number(invoice.tax_percentage ?? 18),
      tds_percentage: Number(invoice.tds_percentage ?? 0),
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

    // Download PDF for user to attach manually (WhatsApp web deep links cannot auto-attach files).
    await openInvoicePdf(invoice, true);

    const msg =
      `Invoice: ${invoice.invoice_number || invoice.id}\\n` +
      `Company: ${invoice.company_name || invoice.client_name || ''}\\n` +
      `Amount: Rs. ${fmtMoney(invoice.total_amount || 0)}\\n\\n` +
      `Please find the invoice PDF attached.`;

    const waUrl = `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    alert('WhatsApp will open in a new tab. Please attach the downloaded invoice PDF.');
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

    setInvoiceSaving(true);
    try {
      const companySettingsSaved = await saveCompanySettings({ silent: false });
      if (!companySettingsSaved) return;

      if (editingInvoiceId) {
        await api.put(`/invoices/${editingInvoiceId}`, formData);
      } else {
        await api.post('/invoices', formData);
      }
      setShowModal(false);
      setEditingInvoiceId(null);
      setFormData({
        lead_id: '',
        items: [{ item_name: '', description: '', quantity: 1, unit_price: 0 }],
        tax_percentage: 18,
        tds_percentage: 0,
        discount_percentage: 0,
        due_date: '',
        notes: '',
        payment_terms: '',
      });
      fetchInvoices();
    } catch (error) {
      alert(error.response?.data?.message || `Failed to ${editingInvoiceId ? 'update' : 'create'} invoice`);
    } finally {
      setInvoiceSaving(false);
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

  const totalPages = Math.max(1, Math.ceil(invoices.length / itemsPerPage));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const indexOfFirstInvoice = (safePage - 1) * itemsPerPage;
  const indexOfLastInvoice = indexOfFirstInvoice + itemsPerPage;
  const currentInvoices = invoices.slice(indexOfFirstInvoice, indexOfLastInvoice);

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
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-200 overflow-hidden">
        {/* Invoices Content */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Retrieving invoice records...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🧾</div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">No invoices found</h3>
            <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
              {filters.date_from || filters.date_to || filters.status
                ? 'No invoices match your filters. Try adjusting your search criteria.'
                : 'No invoices logged yet. Start by creating your first invoice.'}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-[#244bd8] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
            >
              Create Invoice
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest w-20">SL No</th>
                    <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Invoice No</th>
                    <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Company &amp; Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Issue Date</th>
                    <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Due Date</th>
                    <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Amount</th>
                    <th className="px-6 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {currentInvoices.map((invoice, index) => {
                    const itemCount = Array.isArray(invoice.items) ? invoice.items.length : 0;
                    const companyName = invoice.company_name || invoice.client_name || 'No company';
                    const contactLine = invoice.contact_person || invoice.client_phone || invoice.client_email || '';

                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-700">
                          {indexOfFirstInvoice + index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openInvoiceDetails(invoice)}
                            className="text-sm font-black text-blue-700 hover:text-blue-900 hover:underline"
                          >
                            {invoice.invoice_number || `INV-${invoice.id}`}
                          </button>
                        </td>
                        <td className="px-6 py-4 min-w-[240px]">
                          <div className="text-sm font-bold text-gray-900 truncate">{companyName}</div>
                          {contactLine ? <div className="text-xs text-gray-500 mt-0.5 truncate">{contactLine}</div> : null}
                          <div className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                            Items: {itemCount}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fmtDate(invoice.issue_date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fmtDate(invoice.due_date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-black text-gray-900">Rs. {fmtMoney(invoice.total_amount || 0)}</div>
                          <div className="text-xs text-gray-500">Subtotal: Rs. {fmtMoney(invoice.subtotal || 0)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(invoice.status)}`}>
                            {invoice.status || 'draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center flex-nowrap gap-2">
                            <button
                              type="button"
                              onClick={() => openInvoiceDetails(invoice)}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                              title="View Details"
                              aria-label="View Details"
                            >
                              <i className="fas fa-eye"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditInvoice(invoice)}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-900 transition-colors"
                              title="Edit Invoice"
                              aria-label="Edit Invoice"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => openInvoicePdf(invoice, 'print')}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-900 transition-colors"
                              title="Print PDF"
                              aria-label="Print PDF"
                            >
                              <i className="fas fa-print"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => openInvoicePdf(invoice, 'download')}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-900 transition-colors"
                              title="Download PDF"
                              aria-label="Download PDF"
                            >
                              <i className="fas fa-download"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleWhatsAppSend(invoice)}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-900 transition-colors"
                              title="WhatsApp"
                              aria-label="WhatsApp"
                            >
                              <i className="fab fa-whatsapp"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteInvoice(invoice)}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-900 transition-colors"
                              title="Delete Invoice"
                              aria-label="Delete Invoice"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                Showing <span className="font-bold text-slate-800">{indexOfFirstInvoice + 1}</span> to{' '}
                <span className="font-bold text-slate-800">{Math.min(indexOfLastInvoice, invoices.length)}</span> of{' '}
                <span className="font-bold text-slate-800">{invoices.length}</span> invoices
              </div>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                  disabled={safePage === 1}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    safePage === 1
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95'
                  }`}
                >
                  <i className="fas fa-chevron-left mr-1"></i> Prev
                </button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  const isSelected = pageNum === safePage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                  disabled={safePage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    safePage === totalPages
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95'
                  }`}
                >
                  Next <i className="fas fa-chevron-right ml-1"></i>
                </button>
              </div>
            </div>

            {false && (
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
                  <div className="mt-6 flex flex-wrap gap-3 pt-6 border-t border-gray-100">
                    <button
                      onClick={() => openEditInvoice(invoice)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => openInvoicePdf(invoice, true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors font-medium text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download PDF
                    </button>
                    <button
                      onClick={() => handleWhatsAppSend(invoice)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors font-medium text-sm"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </button>
                    <button
                      onClick={() => handleDeleteInvoice(invoice)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm ml-auto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
            )}
          </>
        )}
      </div>

      {/* Invoice Details Modal */}
      {showViewModal && viewInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl my-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-blue-600">Invoice Details</p>
                <h2 className="text-2xl font-black text-gray-900">{viewInvoice.invoice_number || `INV-${viewInvoice.id}`}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                title="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 md:col-span-2">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Company</p>
                  <p className="text-lg font-black text-gray-900">{viewInvoice.company_name || viewInvoice.client_name || 'No company'}</p>
                  {viewInvoice.contact_person ? <p className="text-sm text-gray-500 mt-1">Contact: {viewInvoice.contact_person}</p> : null}
                </div>
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Issue / Due</p>
                  <p className="text-sm font-bold text-gray-900">{fmtDate(viewInvoice.issue_date)}</p>
                  <p className="text-sm text-gray-500">Due: {fmtDate(viewInvoice.due_date)}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-2">Total Amount</p>
                  <p className="text-2xl font-black text-emerald-700">Rs. {fmtMoney(viewInvoice.total_amount || 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 font-bold">Subtotal</p>
                  <p className="font-black text-gray-900">Rs. {fmtMoney(viewInvoice.subtotal || 0)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 font-bold">GST</p>
                  <p className="font-black text-gray-900">{fmtMoney(viewInvoice.tax_percentage || 0)}%</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 font-bold">TDS</p>
                  <p className="font-black text-gray-900">{fmtMoney(viewInvoice.tds_percentage || 0)}%</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 font-bold">Discount</p>
                  <p className="font-black text-gray-900">{fmtMoney(viewInvoice.discount_percentage || 0)}%</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 font-bold">Status</p>
                  <span className={`inline-flex mt-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(viewInvoice.status)}`}>
                    {viewInvoice.status || 'draft'}
                  </span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-900">Items</h3>
                  <span className="text-xs font-bold text-gray-500">
                    {Array.isArray(viewInvoice.items) ? viewInvoice.items.length : 0} item(s)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Item Name</th>
                        <th className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Unit Price</th>
                        <th className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {Array.isArray(viewInvoice.items) && viewInvoice.items.length > 0 ? (
                        viewInvoice.items.map((item, idx) => (
                          <tr key={`${item.item_name || 'item'}-${idx}`}>
                            <td className="px-4 py-3">
                              <div className="font-bold text-gray-900">{item.item_name || '-'}</div>
                              {item.description ? <div className="text-xs text-gray-500 mt-0.5">{item.description}</div> : null}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700">{item.quantity || 0}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700">Rs. {fmtMoney(item.unit_price || 0)}</td>
                            <td className="px-4 py-3 text-right text-sm font-black text-gray-900">Rs. {fmtMoney(item.total_price || (Number(item.quantity || 0) * Number(item.unit_price || 0)))}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="px-4 py-6 text-center text-sm text-gray-500">No items found for this invoice.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {(viewInvoice.notes || viewInvoice.payment_terms) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {viewInvoice.notes ? (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Notes</p>
                      <p className="text-sm text-gray-700">{viewInvoice.notes}</p>
                    </div>
                  ) : null}
                  {viewInvoice.payment_terms ? (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Payment Terms</p>
                      <p className="text-sm text-gray-700">{viewInvoice.payment_terms}</p>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowViewModal(false);
                    openEditInvoice(viewInvoice);
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100"
                >
                  <i className="fas fa-edit mr-2"></i>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => openInvoicePdf(viewInvoice, true)}
                  className="px-4 py-2 rounded-lg bg-green-50 text-green-700 font-bold hover:bg-green-100"
                >
                  <i className="fas fa-download mr-2"></i>
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg p-4 w-full max-w-5xl my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingInvoiceId ? 'Edit Invoice' : 'Create New Invoice'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingInvoiceId(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                  <label className="block text-xs font-medium mb-1">GST %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tax_percentage}
                    onChange={(e) => setFormData({ ...formData, tax_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">TDS %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tds_percentage}
                    onChange={(e) => setFormData({ ...formData, tds_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Disc %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || 0 })}
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

              {/* Totals Summary */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">₹{formData.items.reduce((s, it) => s + (it.quantity * it.unit_price || 0), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-gray-500">GST ({formData.tax_percentage}%)</span>
                  <span className="font-medium text-blue-600">+₹{(formData.items.reduce((s, it) => s + (it.quantity * it.unit_price || 0), 0) * (1 - formData.discount_percentage / 100) * (formData.tax_percentage / 100)).toFixed(2)}</span>
                </div>
                {formData.tds_percentage > 0 && (
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-gray-500">TDS ({formData.tds_percentage}%)</span>
                    <span className="font-medium text-red-600">-₹{(formData.items.reduce((s, it) => s + (it.quantity * it.unit_price || 0), 0) * (1 - formData.discount_percentage / 100) * (formData.tds_percentage / 100)).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-base font-bold text-gray-900 pt-2 border-t mt-1">
                  <span>Grand Total</span>
                  <span className="text-blue-700">₹{(
                    formData.items.reduce((s, it) => s + (it.quantity * it.unit_price || 0), 0) *
                    (1 - formData.discount_percentage / 100) *
                    (1 + formData.tax_percentage / 100)
                  ).toFixed(2)}</span>
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

              {/* Bank Details */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      <i className="fas fa-university text-blue-500 w-4 text-center"></i>
                      <span>Bank Details</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {canEditCompanySettings
                        ? 'Yahan se bank details edit karke invoice PDF aur print me same data use hoga.'
                        : 'Bank details read-only hain. Sirf admin yahan update kar sakta hai.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {companySettingsSaving && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Saving...</span>
                    )}
                    {canEditCompanySettings && (
                      <button
                        type="button"
                        onClick={() => saveCompanySettings({ silent: false })}
                        disabled={!hasCompanySettingsChanges() || companySettingsSaving}
                        className="inline-flex items-center px-4 py-2 rounded-xl border border-blue-200 bg-white text-blue-700 text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <i className="fas fa-save mr-2"></i>
                        {hasCompanySettingsChanges() ? 'Save Bank Details' : 'Saved'}
                      </button>
                    )}
                  </div>
                </div>

                {companySettingsError ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
                    {companySettingsError}
                  </div>
                ) : null}

                {companySettingsLoading ? (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white/80 p-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                    Loading bank details...
                  </div>
                ) : canEditCompanySettings ? (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        value={companySettings.account_holder_name || ''}
                        onChange={(e) => handleCompanySettingChange('account_holder_name', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                        placeholder="Vanya Group"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={companySettings.bank_name || ''}
                        onChange={(e) => handleCompanySettingChange('bank_name', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                        placeholder="Canara Bank"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Account Number</label>
                      <input
                        type="text"
                        value={companySettings.account_number || ''}
                        onChange={(e) => handleCompanySettingChange('account_number', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                        placeholder="120039354715"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">IFSC Code</label>
                      <input
                        type="text"
                        value={companySettings.ifsc_code || ''}
                        onChange={(e) => handleCompanySettingChange('ifsc_code', e.target.value.toUpperCase())}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                        placeholder="CNRB0018686"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Branch Name</label>
                      <input
                        type="text"
                        value={companySettings.branch_name || ''}
                        onChange={(e) => handleCompanySettingChange('branch_name', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                        placeholder="NOIDA SECTOR 48"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nature</label>
                      <select
                        value={companySettings.nature || 'Current Account'}
                        onChange={(e) => handleCompanySettingChange('nature', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                      >
                        <option value="Current Account">Current Account</option>
                        <option value="Savings Account">Savings Account</option>
                        <option value="OD Account">OD Account</option>
                        <option value="CC Account">CC Account</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Account Holder Name</p>
                      <p className="font-semibold text-slate-900">{companySettings.account_holder_name || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Bank Name</p>
                      <p className="font-semibold text-slate-900">{companySettings.bank_name || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Account Number</p>
                      <p className="font-semibold text-slate-900">{companySettings.account_number || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">IFSC Code</p>
                      <p className="font-semibold text-slate-900">{companySettings.ifsc_code || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Branch Name</p>
                      <p className="font-semibold text-slate-900">{companySettings.branch_name || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Nature</p>
                      <p className="font-semibold text-slate-900">{companySettings.nature || '-'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingInvoiceId(null);
                  }}
                  className="px-6 py-2.5 text-sm font-semibold border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={invoiceSaving || companySettingsSaving}
                  className="px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {invoiceSaving ? 'Saving...' : editingInvoiceId ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
