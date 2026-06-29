import { useState, useEffect } from 'react';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';
import { downloadPdfUrl, openPdfUrlInNewTab, printPdfFromApi, sanitizePdfFileName } from '../utils/pdfActions';

function isManagerOrAdmin(employee) {
  const role = (employee?.role || '').toLowerCase();
  return role === 'manager' || role === 'admin' || role === 'superadmin' || role === 'super_admin';
}

function createDefaultItem() {
  return { item_name: '', description: '', quantity: 1, unit_price: 0 };
}

function createDefaultQuotationForm() {
  return {
    lead_id: '',
    project_name: '',
    items: [createDefaultItem()],
    tax_percentage: 10,
    discount_percentage: 0,
    valid_until: '',
    notes: '',
    terms_conditions: '',
    send_for_approval: false,
  };
}

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

function normalizeQuotationItem(item) {
  const quantity = Number(item?.quantity);
  const unitPrice = Number(item?.unit_price);
  return {
    item_name: item?.item_name ?? '',
    description: item?.description ?? '',
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
  };
}

function normalizeQuotationForForm(quotation) {
  const rawItems = Array.isArray(quotation?.items) ? quotation.items : [];
  return {
    ...createDefaultQuotationForm(),
    ...quotation,
    lead_id: quotation?.client_id ?? quotation?.lead_id ?? '',
    project_name: quotation?.project_name ?? '',
    tax_percentage: quotation?.tax_percentage ?? 10,
    discount_percentage: quotation?.discount_percentage ?? 0,
    valid_until: quotation?.valid_until ?? '',
    notes: quotation?.notes ?? '',
    terms_conditions: quotation?.terms_conditions ?? '',
    send_for_approval: false,
    items: rawItems.length ? rawItems.map(normalizeQuotationItem) : [createDefaultItem()],
  };
}

function formatPercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  return Number.isInteger(numericValue)
    ? `${numericValue}`
    : numericValue.toFixed(2).replace(/\.?0+$/, '');
}

function splitTaxEvenly(totalTaxAmount, taxPercentage) {
  const safeTaxAmount = Math.max(0, Math.round(Number(totalTaxAmount) || 0));
  const safeTaxPercentage = Math.max(0, Number(taxPercentage) || 0);
  const cgstAmount = Math.floor(safeTaxAmount / 2);
  const sgstAmount = safeTaxAmount - cgstAmount;
  const halfPercentage = safeTaxPercentage / 2;

  return {
    cgstAmount,
    sgstAmount,
    cgstPercentage: halfPercentage,
    sgstPercentage: halfPercentage,
  };
}

function formatQuotationDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SalesOrders() {
  const employee = getEmployee();
  const canEditCompanySettings = ['admin', 'superadmin', 'super_admin'].includes(String(employee?.role || '').toLowerCase());
  const canApprove = isManagerOrAdmin(employee);
  const canRequestApproval = !canApprove;
  const [quotations, setQuotations] = useState([]);
  const [pendingQuotations, setPendingQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQuotationViewModal, setShowQuotationViewModal] = useState(false);
  const [viewQuotation, setViewQuotation] = useState(null);
  const [viewQuotationLoading, setViewQuotationLoading] = useState(false);
  const [viewQuotationError, setViewQuotationError] = useState('');
  const [companySettings, setCompanySettings] = useState(createDefaultCompanySettings());
  const [companySettingsSnapshot, setCompanySettingsSnapshot] = useState(createDefaultCompanySettings());
  const [companySettingsLoading, setCompanySettingsLoading] = useState(true);
  const [companySettingsSaving, setCompanySettingsSaving] = useState(false);
  const [companySettingsError, setCompanySettingsError] = useState('');
  const [quotationSaving, setQuotationSaving] = useState(false);
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsLoadError, setLeadsLoadError] = useState('');
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    status: '',
  });
  const [formData, setFormData] = useState(createDefaultQuotationForm);

  useEffect(() => {
    fetchQuotations();
    fetchLeads();
    if (canApprove) fetchPendingQuotations();
  }, [canApprove]);

  useEffect(() => {
    fetchQuotationSettings();
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchQuotations();
  }, [filters]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(quotations.length / itemsPerPage));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [quotations]);

  const fetchPendingQuotations = async () => {
    setPendingQuotations([]);
  };

  const fetchQuotations = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setQuotations([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.status) params.append('status', filters.status);

      const response = await api.get(`/sales-orders?${params.toString()}`);
      setQuotations(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching quotations:', error);
      }
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  const normalizeLeadOptions = (items) => {
    const mapped = (Array.isArray(items) ? items : [])
      .map((lead) => {
        const id = Number(lead?.id);
        if (!Number.isFinite(id) || id <= 0) return null;
        const companyName = String(lead?.company_name || lead?.company || lead?.name || lead?.full_name || '').trim();
        const contactPerson = String(lead?.contact_person || lead?.contact || lead?.owner_name || lead?.full_name || '').trim();
        return {
          id,
          company_name: companyName || `Lead #${id}`,
          contact_person: contactPerson || 'No Contact',
        };
      })
      .filter(Boolean);

    const seen = new Set();
    return mapped.filter((lead) => {
      if (seen.has(lead.id)) return false;
      seen.add(lead.id);
      return true;
    });
  };

  const fetchLeads = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLeads([]);
      setLeadsLoadError('');
      return;
    }

    setLeadsLoading(true);
    setLeadsLoadError('');
    try {
      const response = await api.get('/clients', { params: { page: 1, limit: 500 } });
      let nextLeads = normalizeLeadOptions(response?.data?.data);

      // Fallback for setups where /leads is empty or has schema issues.
      if (nextLeads.length === 0 && employee?.company_id) {
        const fallbackResponse = await api.get(`/companies/${employee.company_id}/leads`);
        nextLeads = normalizeLeadOptions(fallbackResponse?.data?.data);
      }

      setLeads(nextLeads);
      if (nextLeads.length === 0) {
        setLeadsLoadError('No customers found. Please create a customer first.');
      }
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching leads:', error);
      }
      setLeadsLoadError(error.response?.data?.message || 'Unable to load customers.');
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  };

  const fetchQuotationSettings = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCompanySettingsLoading(false);
      return;
    }

    setCompanySettingsLoading(true);
    setCompanySettingsError('');
    try {
      const response = await api.get('/sales-orders/template-settings');
      const nextSettings = normalizeCompanySettings(response?.data?.data || {});
      setCompanySettings(nextSettings);
      setCompanySettingsSnapshot(nextSettings);
    } catch (error) {
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching quotation settings:', error);
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
    const bankFields = ['bank_name', 'account_holder_name', 'account_number', 'ifsc_code', 'branch_name', 'nature'];
    return bankFields.some((field) => String(companySettings?.[field] ?? '') !== String(companySettingsSnapshot?.[field] ?? ''));
  };

  const saveCompanySettings = async ({ silent = false } = {}) => {
    if (!canEditCompanySettings) {
      if (!silent) alert('Only admin can edit bank details from this screen.');
      return false;
    }
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
      items: [...formData.items, createDefaultItem()],
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

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
    const discount = (subtotal * (formData.discount_percentage || 0)) / 100;
    const taxableAmount = subtotal - discount;
    const tax = Math.round((taxableAmount * (formData.tax_percentage || 0)) / 100);
    const grandTotal = Math.round(taxableAmount + tax);
    const taxSplit = splitTaxEvenly(tax, formData.tax_percentage || 0);

    return {
      subtotal: Math.round(subtotal),
      discount: Math.round(discount),
      tax,
      grandTotal,
      cgstAmount: taxSplit.cgstAmount,
      sgstAmount: taxSplit.sgstAmount,
      cgstPercentage: taxSplit.cgstPercentage,
      sgstPercentage: taxSplit.sgstPercentage,
    };
  };

  const totals = calculateTotals();

  // Helper to handle numeric inputs - supports integers and decimals
  const handleNumericInput = (value, setter, field, isItem = false, index = null) => {
    // Allow empty string during typing
    if (value === '' || value === '-') {
      if (isItem) handleItemChange(index, field, 0);
      else setFormData(prev => ({ ...prev, [field]: 0 }));
      return;
    }
    // For unit_price use parseFloat to allow decimals, else parseInt
    const parsed = field === 'unit_price' ? parseFloat(value) : parseInt(value, 10);
    const finalValue = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    if (isItem) handleItemChange(index, field, finalValue);
    else setFormData(prev => ({ ...prev, [field]: finalValue }));
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

    setQuotationSaving(true);
    try {
      const settingsSaved = await saveCompanySettings({ silent: false });
      if (!settingsSaved) return;

      const payload = {
        ...formData,
        client_id: formData.lead_id ? Number(formData.lead_id) : null,
        subject: formData.project_name || formData.subject || '',
        reference_number: formData.reference_number || '',
        order_date: formData.order_date || formData.issue_date || new Date().toISOString().slice(0, 10),
        delivery_date: formData.valid_until || formData.delivery_date || '',
        billing_address: formData.billing_address || '',
        shipping_address: formData.shipping_address || '',
        gst_number: formData.gst_number || '',
        place_of_supply: formData.place_of_supply || '',
        salesperson_id: formData.salesperson_id ? Number(formData.salesperson_id) : null,
        status: formData.send_for_approval ? 'sent' : (formData.status || 'draft'),
        notes: formData.notes || '',
      };
      await api.post('/sales-orders', payload);
      setShowModal(false);
      setFormData(createDefaultQuotationForm());
      fetchQuotations();
      if (canApprove) fetchPendingQuotations();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create sales order');
    } finally {
      setQuotationSaving(false);
    }
  };

  const handleSendForApproval = async (id) => {
    if (!canRequestApproval) return;
    try {
      await api.patch(`/sales-orders/${id}/status`, { status: 'sent' });
      fetchQuotations();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update sales order');
    }
  };

  const handleApprove = async (id, status) => {
    try {
      await api.patch(`/sales-orders/${id}/status`, { status });
      fetchQuotations();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update sales order');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-emerald-100 text-emerald-800',
      fulfilled: 'bg-green-100 text-green-800',
      converted: 'bg-emerald-100 text-emerald-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this sales order? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete('/sales-orders', { data: { id } });
      if (response.data.success) {
        alert('Sales order deleted successfully');
        fetchQuotations();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete sales order');
    }
  };

  const openQuotationDetails = async (quotation) => {
    if (!quotation?.id) return;
    setViewQuotation(quotation);
    setViewQuotationError('');
    setViewQuotationLoading(true);
    setShowQuotationViewModal(true);

    try {
      const response = await api.get(`/sales-orders/${quotation.id}`);
      setViewQuotation(response?.data?.data || quotation);
    } catch (error) {
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error loading quotation details:', error);
      }
      setViewQuotationError(error.response?.data?.message || 'Failed to load quotation details.');
    } finally {
      setViewQuotationLoading(false);
    }
  };

  const closeQuotationDetails = () => {
    setShowQuotationViewModal(false);
    setViewQuotation(null);
    setViewQuotationError('');
    setViewQuotationLoading(false);
  };

  const openQuotationPdf = async (quotation, action = 'view') => {
    if (!quotation?.id) return;
    try {
      const safeNumber = sanitizePdfFileName(quotation.order_number || quotation.quotation_number || `SO-${quotation.id}`, 'sales-order');
      const mode = action === true ? 'download' : action === false ? 'view' : action;
      if (mode === 'download') {
        downloadPdfUrl(`/sales-orders/${quotation.id}/pdf`, {
          fileName: `sales_order_${safeNumber}.pdf`,
        });
        return;
      }
      if (mode === 'print') {
        await printPdfFromApi(`/sales-orders/${quotation.id}/pdf`);
        return;
      }
      openPdfUrlInNewTab(`/sales-orders/${quotation.id}/pdf`);
    } catch (err) {
      alert(err.message || 'Failed to open sales order PDF');
    }
  };

  const handleDuplicateQuotation = async (quotation) => {
    if (!quotation?.id) return;
    try {
      await api.post(`/sales-orders/${quotation.id}/duplicate`);
      fetchQuotations();
      if (canApprove) fetchPendingQuotations();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to duplicate sales order');
    }
  };

  const handleEmailQuotation = async (quotation) => {
    if (!quotation?.id) return;
    const recipient = window.prompt('Enter recipient email:', quotation.customer_email || quotation.email || '');
    if (!recipient) return;
    try {
      await api.post(`/sales-orders/${quotation.id}/email`, { to: recipient });
      alert('Sales order emailed successfully');
      fetchQuotations();
      if (canApprove) fetchPendingQuotations();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to email sales order');
    }
  };

  const handleConvertQuotation = async (quotation, target = 'invoice') => {
    if (!quotation?.id) return;
    const label = target === 'sales-order' ? 'sales order' : 'invoice';
    if (!window.confirm(`Convert this sales order into a ${label}?`)) return;
    try {
      await api.post(`/sales-orders/${quotation.id}/convert/${target}`);
      alert(`Sales order converted to ${label} successfully`);
      fetchQuotations();
      if (canApprove) fetchPendingQuotations();
    } catch (error) {
      alert(error.response?.data?.message || `Failed to convert sales order to ${label}`);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentQuotations = quotations.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="relative">
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              {/* Title and Description */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-1">Sales Orders</h1>
                <p className="text-slate-300 text-sm">Create and manage sales orders for your customers</p>
              </div>
            </div>

            {/* Right Side - Action Button */}
            <button
              onClick={() => {
                setFormData(createDefaultQuotationForm());
                fetchLeads();
                setShowModal(true);
              }}
              className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl hover:bg-slate-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Sales Order</span>
            </button>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
      </div>

      {/* Pending approval (manager/admin only) */}
      {canApprove && pendingQuotations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl shadow-sm p-4 mb-6">
          <h2 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <i className="fas fa-clock text-blue-600"></i>
            Pending your approval
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-blue-100">
              <thead className="bg-blue-100/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-blue-800 uppercase">Order</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-blue-800 uppercase">Company</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-blue-800 uppercase">Amount</th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-blue-800 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100">
                {pendingQuotations.map((q) => (
                  <tr key={q.id} className="hover:bg-blue-50/50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{q.order_number || q.quotation_number}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{q.company_name}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium">₹{Math.round(q.total_amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(q.id, 'confirmed')}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => handleApprove(q.id, 'cancelled')}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              <i className="fas fa-calendar-alt text-blue-500 w-4 text-center"></i>
              <span>Order Date From</span>
            </label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>
          <div>
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              <i className="fas fa-calendar-check text-blue-500 w-4 text-center"></i>
              <span>Order Date To</span>
            </label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>
          <div>
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              <i className="fas fa-info-circle text-blue-500 w-4 text-center"></i>
              <span>Status</span>
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="confirmed">Confirmed</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="converted">Converted</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <button
            onClick={clearFilters}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
          >
            Reset Metrics
          </button>
        </div>
      </div>

      {/* Sales Orders List */}
      {loading ? (
        <div className="bg-white rounded-[1.5rem] p-12 text-center border border-gray-100 shadow-md">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Retrieving Financial Records...</p>
        </div>
      ) : quotations.length === 0 ? (
        <div className="bg-white rounded-[1.5rem] p-12 text-center border border-gray-100 shadow-md">
          <div className="text-5xl mb-4 opacity-20">📄</div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">No sales orders found</h3>
          <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">Create your first sales order to start tracking confirmations and deliveries.</p>
          <button
            onClick={() => {
              setFormData(createDefaultQuotationForm());
              fetchLeads();
              setShowModal(true);
            }}
            className="px-6 py-3 bg-[#244bd8] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
          >
            Create Sales Order
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">SL No</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Order No</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Customer & Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Order Date</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Delivery Date</th>
                  <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentQuotations.map((quotation, index) => (
                  <tr key={quotation.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                      {indexOfFirstItem + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openQuotationDetails(quotation)}
                        className="text-sm font-black text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {quotation.order_number || quotation.quotation_number || `SO-${quotation.id}`}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">{quotation.company_name}</div>
                      <div className="text-xs text-gray-500">{quotation.contact_person}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatQuotationDate(quotation.order_date || quotation.issue_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatQuotationDate(quotation.delivery_date || quotation.valid_until)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-gray-900">₹{Math.round(quotation.total_amount || 0).toLocaleString('en-IN')}</div>
                      <div className="text-xs text-gray-500">Subtotal: ₹{Math.round(quotation.subtotal || 0).toLocaleString('en-IN')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(quotation.status)}`}>
                        {quotation.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center flex-nowrap gap-2">
                        <button
                          type="button"
                          onClick={() => openQuotationDetails(quotation)}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
                          title="View Sales Order"
                          aria-label="View Sales Order"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        {canRequestApproval && quotation.status === 'draft' && Number(quotation.employee_id) === Number(employee?.id) && (
                          <button
                            type="button"
                            onClick={() => handleSendForApproval(quotation.id)}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-900 transition-colors shrink-0"
                            title="Mark as sent"
                            aria-label="Mark as sent"
                          >
                            <i className="fas fa-paper-plane"></i>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(normalizeQuotationForForm(quotation));
                            fetchLeads();
                            setShowModal(true);
                          }}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-900 transition-colors shrink-0"
                          title="Edit Sales Order"
                          aria-label="Edit Sales Order"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => openQuotationPdf(quotation, 'print')}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-900 transition-colors shrink-0"
                          title="Print PDF"
                          aria-label="Print PDF"
                        >
                          <i className="fas fa-print"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => openQuotationPdf(quotation, 'download')}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-900 transition-colors shrink-0"
                          title="Download PDF"
                          aria-label="Download PDF"
                        >
                          <i className="fas fa-download"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(quotation.id)}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-900 transition-colors shrink-0"
                          title="Delete Sales Order"
                          aria-label="Delete Sales Order"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination Footer */}
          {quotations.length > itemsPerPage && (
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                Showing <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-bold text-slate-800">{Math.min(indexOfLastItem, quotations.length)}</span> of{' '}
                <span className="font-bold text-slate-800">{quotations.length}</span> entries
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    currentPage === 1
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95'
                  }`}
                >
                  <i className="fas fa-chevron-left mr-1"></i> Prev
                </button>

                {Array.from({ length: Math.ceil(quotations.length / itemsPerPage) }).map((_, i) => {
                  const pageNum = i + 1;
                  const isSelected = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
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
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(quotations.length / itemsPerPage)))}
                  disabled={currentPage === Math.ceil(quotations.length / itemsPerPage)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    currentPage === Math.ceil(quotations.length / itemsPerPage)
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95'
                  }`}
                >
                  Next <i className="fas fa-chevron-right ml-1"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quotation Details Modal */}
      {showQuotationViewModal && (
        <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[1.5rem] w-full max-w-5xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col max-h-[90vh]">
            <div className="bg-[#244bd8] p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                  <i className="fas fa-file-invoice text-xl"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Sales Order Details</h2>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">
                    {viewQuotation?.order_number || viewQuotation?.quotation_number || `SO-${viewQuotation?.id || ''}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeQuotationDetails}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {viewQuotationLoading ? (
                <div className="py-16 text-center">
                  <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Loading sales order details...</p>
                </div>
              ) : (
                <>
                  {viewQuotationError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      {viewQuotationError}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 md:col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Customer</p>
                      <p className="text-lg font-black text-gray-900">{viewQuotation?.company_name || 'No customer'}</p>
                      {viewQuotation?.contact_person ? (
                        <p className="text-sm text-gray-500 mt-1">Contact: {viewQuotation.contact_person}</p>
                      ) : null}
                    </div>
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Order / Delivery</p>
                      <p className="text-sm font-bold text-gray-900">{formatQuotationDate(viewQuotation?.order_date || viewQuotation?.issue_date)}</p>
                      <p className="text-sm text-gray-500">Delivery: {formatQuotationDate(viewQuotation?.delivery_date || viewQuotation?.valid_until)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Created By</p>
                      <p className="text-sm font-bold text-gray-900">{viewQuotation?.employee_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 mt-1">{viewQuotation?.employee_role || 'employee'}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Total Amount</p>
                      <p className="text-2xl font-black text-emerald-700">Rs. {Math.round(viewQuotation?.total_amount || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500 font-bold">Subtotal</p>
                      <p className="font-black text-gray-900">Rs. {Math.round(viewQuotation?.subtotal || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500 font-bold">Discount</p>
                      <p className="font-black text-gray-900">Rs. {Math.round(viewQuotation?.discount_amount || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500 font-bold">Tax</p>
                      <p className="font-black text-gray-900">{formatPercent(viewQuotation?.tax_percentage || 0)}%</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500 font-bold">Tax Amount</p>
                      <p className="font-black text-gray-900">Rs. {Math.round(viewQuotation?.tax_amount || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500 font-bold">Status</p>
                      <span className={`inline-flex mt-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(viewQuotation?.status)}`}>
                        {viewQuotation?.status || 'draft'}
                      </span>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="text-sm font-black text-gray-900">Items</h3>
                      <span className="text-xs font-bold text-gray-500">
                        {Array.isArray(viewQuotation?.items) ? viewQuotation.items.length : 0} item(s)
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Item Name</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Description</th>
                            <th className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Qty</th>
                            <th className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Rate</th>
                            <th className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {Array.isArray(viewQuotation?.items) && viewQuotation.items.length > 0 ? (
                            viewQuotation.items.map((item, idx) => (
                              <tr key={`${item.item_name || 'item'}-${idx}`}>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-gray-900">{item.item_name || '-'}</div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">{item.description || '-'}</td>
                                <td className="px-4 py-3 text-right text-sm text-gray-700">{Number(item.quantity || 0).toLocaleString('en-IN')}</td>
                                <td className="px-4 py-3 text-right text-sm text-gray-700">Rs. {Math.round(item.unit_price || 0).toLocaleString('en-IN')}</td>
                                <td className="px-4 py-3 text-right text-sm font-black text-gray-900">Rs. {Math.round(item.total_price || (Number(item.quantity || 0) * Number(item.unit_price || 0))).toLocaleString('en-IN')}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" className="px-4 py-6 text-center text-sm text-gray-500">No items found for this sales order.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {(viewQuotation?.notes || viewQuotation?.terms_conditions) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {viewQuotation?.notes ? (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Notes</p>
                          <p className="text-sm text-gray-700 whitespace-pre-line">{viewQuotation.notes}</p>
                        </div>
                      ) : null}
                      {viewQuotation?.terms_conditions ? (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Terms &amp; Conditions</p>
                          <p className="text-sm text-gray-700 whitespace-pre-line">{viewQuotation.terms_conditions}</p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {Array.isArray(viewQuotation?.activities) && viewQuotation.activities.length > 0 && (
                    <div className="mt-4 rounded-xl bg-white border border-slate-200 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Activity Log</p>
                      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                        {viewQuotation.activities.slice(0, 6).map((activity) => (
                          <div key={activity.id || `${activity.action}-${activity.created_at}`} className="flex items-start gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                            <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-blue-500"></div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-800">{activity.description || activity.action}</p>
                              <p className="text-[11px] text-slate-500">
                                {activity.employee_name || 'System'}
                                {activity.created_at ? ` • ${new Date(activity.created_at).toLocaleString('en-IN')}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(viewQuotation?.revisions) && viewQuotation.revisions.length > 0 && (
                    <div className="mt-4 rounded-xl bg-white border border-slate-200 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Revision History</p>
                      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                        {viewQuotation.revisions.slice(0, 4).map((revision) => (
                          <div key={revision.id || `${revision.revision_number}-${revision.created_at}`} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                            <div>
                              <p className="text-sm font-bold text-slate-800">Revision {revision.revision_number || '-'}</p>
                              <p className="text-[11px] text-slate-500">{revision.reason || 'Updated quote snapshot'}</p>
                            </div>
                            <p className="text-[11px] text-slate-500 whitespace-nowrap">
                              {revision.created_at ? new Date(revision.created_at).toLocaleDateString('en-IN') : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!viewQuotation) return;
                    setShowQuotationViewModal(false);
                    setFormData(normalizeQuotationForForm(viewQuotation));
                    fetchLeads();
                    setShowModal(true);
                  }}
                  disabled={viewQuotationLoading}
                  className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-edit mr-2"></i>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => viewQuotation && openQuotationPdf(viewQuotation, 'print')}
                  disabled={!viewQuotation || viewQuotationLoading}
                  className="px-4 py-2 rounded-lg bg-green-50 text-green-700 font-bold hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-print mr-2"></i>
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => viewQuotation && openQuotationPdf(viewQuotation, 'download')}
                  disabled={!viewQuotation || viewQuotationLoading}
                  className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-download mr-2"></i>
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => viewQuotation && handleDuplicateQuotation(viewQuotation)}
                  disabled={!viewQuotation || viewQuotationLoading}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-clone mr-2"></i>
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => viewQuotation && handleEmailQuotation(viewQuotation)}
                  disabled={!viewQuotation || viewQuotationLoading}
                  className="px-4 py-2 rounded-lg bg-cyan-50 text-cyan-700 font-bold hover:bg-cyan-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-envelope mr-2"></i>
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => viewQuotation && handleConvertQuotation(viewQuotation, 'invoice')}
                  disabled={!viewQuotation || viewQuotationLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-file-invoice-dollar mr-2"></i>
                  Convert to Invoice
                </button>
                  <button
                    type="button"
                    onClick={closeQuotationDetails}
                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200"
                  >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Sales Order Modal */}
      {showModal && (
        <div className="absolute inset-0 z-[90] flex items-start justify-center p-3 sm:p-4 md:p-6 bg-transparent overflow-y-auto">
          <div className="bg-white rounded-[1.5rem] w-full max-w-5xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200 flex flex-col max-h-[calc(100vh-8rem)]">
            <div className="bg-[#244bd8] p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                  <i className="fas fa-file-invoice text-xl"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Draft Sales Order</h2>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">Fiscal Asset Management System</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
              {/* Top Configuration Bar */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 focus-within:text-blue-600 transition-colors">
                    <i className="fas fa-building text-blue-500 w-4 text-center"></i>
                    <span>Target Customer Entity</span>
                  </label>
                  <select
                    value={formData.lead_id ?? ''}
                    onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                    disabled={leadsLoading}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                  >
                    <option value="">
                      {leadsLoading ? 'Loading customers...' : 'Select customer'}
                    </option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.company_name} - {lead.contact_person}
                      </option>
                    ))}
                  </select>
                  {!!leadsLoadError && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-[11px] font-semibold text-amber-800">{leadsLoadError}</p>
                      <button
                        type="button"
                        onClick={fetchLeads}
                        className="px-2.5 py-1 rounded-md bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-amber-700"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    <i className="fas fa-diagram-project text-blue-500 w-4 text-center"></i>
                    <span>Order Subject</span>
                  </label>
                  <input
                    type="text"
                    value={formData.project_name ?? ''}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                    placeholder="Enter order subject"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    <i className="fas fa-percentage text-blue-500 w-4 text-center"></i>
                    <span>Tax (GST %)</span>
                  </label>
                  <select
                    value={formData.tax_percentage ?? 0}
                    onChange={(e) => setFormData({ ...formData, tax_percentage: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                  >
                    <option value={0}>0% — No Tax</option>
                    <option value={5}>5% — GST</option>
                    <option value={9}>9% — CGST/SGST</option>
                    <option value={12}>12% — GST</option>
                    <option value={18}>18% — GST (Standard)</option>
                    <option value={28}>28% — GST (Luxury)</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 text-slate-500">
                    <i className="fas fa-tag text-blue-500 w-4 text-center"></i>
                    <span>Discount (%)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount_percentage === 0 ? '' : formData.discount_percentage}
                    placeholder="0"
                    onChange={(e) => handleNumericInput(e.target.value, setFormData, 'discount_percentage')}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                  />
                </div>
              </div>

              {/* Dynamic Items Builder */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <i className="fas fa-list-ol text-blue-500 w-4 text-center"></i>
                    <span>Commercial Line Items *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center px-4 py-1.5 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-100 shadow-sm"
                  >
                    <i className="fas fa-plus mr-2"></i>Add Line Item
                  </button>
                </div>

                {/* Items header row */}
                <div className="flex items-center gap-2 px-3 pb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="flex-[2] min-w-0">Item Name</div>
                  <div className="flex-[3] min-w-0">Description</div>
                  <div className="w-20 text-center">Qty</div>
                  <div className="w-28 text-right">Unit Price (₹)</div>
                  <div className="w-24 text-right">Total</div>
                  <div className="w-8"></div>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2.5 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                      {/* Item Name */}
                      <div className="flex-[2] min-w-0">
                        <input
                          type="text"
                          placeholder="Item name *"
                          required
                          value={item.item_name ?? ''}
                          onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all placeholder-slate-400 text-slate-800"
                        />
                      </div>

                      {/* Description */}
                      <div className="flex-[3] min-w-0">
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={item.description ?? ''}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all placeholder-slate-400 text-slate-600"
                        />
                      </div>

                      {/* Quantity */}
                      <input
                        type="number"
                        required
                        min="1"
                        value={item.quantity === 0 ? '' : item.quantity}
                        placeholder="1"
                        onChange={(e) => handleNumericInput(e.target.value, null, 'quantity', true, index)}
                        onFocus={(e) => e.target.select()}
                        className="w-20 text-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                      />

                      {/* Unit Price */}
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={item.unit_price === 0 ? '' : item.unit_price}
                        placeholder="0.00"
                        onChange={(e) => handleNumericInput(e.target.value, null, 'unit_price', true, index)}
                        onFocus={(e) => e.target.select()}
                        className="w-28 text-right bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                      />

                      {/* Line Total */}
                      <div className="w-24 text-right">
                        <span className="text-[13px] font-black text-slate-800">
                          ₹{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Remove button */}
                      <div className="w-8 flex items-center justify-center shrink-0">
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-100"
                            title="Remove item"
                          >
                            <i className="fas fa-times text-[10px]"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strategy & Terms Footer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                <div className="md:col-span-1">
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className="fas fa-history text-blue-500 w-4 text-center"></i>
                    <span>Delivery Date</span>
                  </label>
                  <input
                    type="date"
                    value={formData.valid_until ?? ''}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-[13px]"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className="fas fa-balance-scale text-blue-500 w-4 text-center"></i>
                    <span>Terms / Notes</span>
                  </label>
                  <textarea
                    value={formData.terms_conditions ?? ''}
                    onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-[13px] resize-none font-medium"
                    rows="1"
                    placeholder="Payment terms, delivery schedules, etc..."
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className="fas fa-sticky-note text-blue-500 w-4 text-center"></i>
                    <span>Internal Strategic Notes</span>
                  </label>
                  <textarea
                    value={formData.notes ?? ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-[13px] resize-none font-medium"
                    rows="1"
                    placeholder="Market intel, lead urgency, specialized pricing..."
                  />
                </div>
              </div>

              {/* Professional Financial Summary Section */}
              <div className="mt-2.5 flex justify-end">
                <div className="w-full md:w-80 space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-sm text-[13px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Gross Subtotal</span>
                    <span className="font-bold text-slate-900">₹{totals.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Discount ({formatPercent(formData.discount_percentage)}%)</span>
                    <span className="font-bold text-red-500">- ₹{totals.discount.toLocaleString('en-IN')}</span>
                  </div>

                  {Number(formData.tax_percentage || 0) > 0 ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">CGST ({formatPercent(totals.cgstPercentage)}%)</span>
                        <span className="font-bold text-blue-600">+ ₹{totals.cgstAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">SGST ({formatPercent(totals.sgstPercentage)}%)</span>
                        <span className="font-bold text-blue-600">+ ₹{totals.sgstAmount.toLocaleString('en-IN')}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Tax (0%)</span>
                      <span className="font-bold text-slate-400">+ ₹0</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Net Payable</span>
                    <span className="text-lg font-black text-[#244bd8]">₹{totals.grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      <i className="fas fa-university text-blue-500 w-4 text-center"></i>
                      <span>Bank Details</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {canEditCompanySettings
                        ? 'Admin yahan se bank details update kar sakte hain. Yeh PDF aur invoice print me use hongi.'
                        : 'Bank details read-only hain. Sirf admin is screen se update kar sakta hai.'}
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

              {/* Order Status option */}
              {canRequestApproval && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="send_for_approval"
                    checked={!!formData.send_for_approval}
                    onChange={(e) => setFormData({ ...formData, send_for_approval: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="send_for_approval" className="text-sm font-medium text-slate-700">
                    Mark as sent
                  </label>
                </div>
              )}
              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-4 pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Discard Draft
                </button>
                <button
                  type="submit"
                  disabled={quotationSaving || companySettingsSaving}
                  className="px-6 py-2.5 bg-[#244bd8] hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <i className={`fas ${quotationSaving ? 'fa-spinner fa-spin' : 'fa-paper-plane'} mr-2 text-[10px]`}></i>
                  <span>
                    {quotationSaving
                      ? 'Saving...'
                      : 'Save sales order'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
