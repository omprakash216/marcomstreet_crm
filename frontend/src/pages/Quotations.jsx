import { useState, useEffect } from 'react';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';

function isManagerOrAdmin(employee) {
  const role = (employee?.role || '').toLowerCase();
  return role === 'manager' || role === 'admin';
}

export default function Quotations() {
  const employee = getEmployee();
  const canApprove = isManagerOrAdmin(employee);
  const [quotations, setQuotations] = useState([]);
  const [pendingQuotations, setPendingQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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
    valid_until: '',
    notes: '',
    terms_conditions: '',
    send_for_approval: false,
  });

  useEffect(() => {
    fetchQuotations();
    fetchLeads();
    if (canApprove) fetchPendingQuotations();
  }, [canApprove]);

  useEffect(() => {
    fetchQuotations();
  }, [filters]);

  const fetchPendingQuotations = async () => {
    const token = localStorage.getItem('token');
    if (!token || !canApprove) return;
    try {
      const response = await api.get('/quotations?pending_approval=1');
      setPendingQuotations(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (e) {
      if (e.response?.status !== 401 && e.code !== 'ERR_NETWORK') console.error('Pending quotations:', e);
      setPendingQuotations([]);
    }
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

      const response = await api.get(`/quotations?${params.toString()}`);
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

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
    const discount = (subtotal * (formData.discount_percentage || 0)) / 100;
    const taxableAmount = subtotal - discount;
    const tax = (taxableAmount * (formData.tax_percentage || 0)) / 100;
    const grandTotal = taxableAmount + tax;

    return {
      subtotal: Math.round(subtotal),
      discount: Math.round(discount),
      tax: Math.round(tax),
      grandTotal: Math.round(grandTotal)
    };
  };

  const totals = calculateTotals();

  // Helper to handle numeric inputs and avoid "0" stay issues
  const handleNumericInput = (value, setter, field, isItem = false, index = null) => {
    // Strip leading zeros unless it's just "0"
    let cleanValue = value.replace(/^0+/, '');
    if (cleanValue === '') cleanValue = '0';

    const parsedValue = parseInt(cleanValue) || 0;

    if (isItem) {
      handleItemChange(index, field, parsedValue);
    } else {
      setFormData(prev => ({ ...prev, [field]: parsedValue }));
    }
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
      const payload = {
        ...formData,
        send_for_approval: !!formData.send_for_approval,
        issue_date: formData.issue_date || new Date().toISOString().slice(0, 10),
      };
      await api.post('/quotations', payload);
      setShowModal(false);
      setFormData({
        lead_id: '',
        items: [{ item_name: '', description: '', quantity: 1, unit_price: 0 }],
        tax_percentage: 10,
        discount_percentage: 0,
        valid_until: '',
        notes: '',
        terms_conditions: '',
        send_for_approval: false,
      });
      fetchQuotations();
      if (canApprove) fetchPendingQuotations();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create quotation');
    }
  };

  const handleSendForApproval = async (id) => {
    try {
      await api.put(`/quotations/${id}/send`);
      fetchQuotations();
      if (canApprove) fetchPendingQuotations();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to send for approval');
    }
  };

  const handleApprove = async (id, status) => {
    try {
      await api.put(`/quotations/${id}/approve`, { status });
      fetchQuotations();
      fetchPendingQuotations();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update quotation');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quotation? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete('/quotations', { data: { id } });
      if (response.data.success) {
        alert('Quotation deleted successfully');
        fetchQuotations();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete quotation');
    }
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              {/* Title and Description */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-1">Quotations</h1>
                <p className="text-slate-300 text-sm">Create and manage quotations for your clients</p>
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
              <span>Create Quotation</span>
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
                  <th className="px-4 py-2 text-left text-xs font-bold text-blue-800 uppercase">Quotation</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-blue-800 uppercase">Company</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-blue-800 uppercase">Amount</th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-blue-800 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100">
                {pendingQuotations.map((q) => (
                  <tr key={q.id} className="hover:bg-blue-50/50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{q.quotation_number}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{q.company_name}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium">₹{Math.round(q.total_amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(q.id, 'accepted')}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApprove(q.id, 'rejected')}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
                        >
                          Reject
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
              <span>Issue Period From</span>
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
              <span>Issue Period To</span>
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
              <span>Lifecycle Status</span>
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            >
              <option value="">All Revenue States</option>
              <option value="draft">Draft Proposal</option>
              <option value="sent">Dispatched / Sent</option>
              <option value="accepted">Accepted / Won</option>
              <option value="rejected">Rejected / Lost</option>
              <option value="expired">Link Expired</option>
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

      {/* Quotations List */}
      {loading ? (
        <div className="bg-white rounded-[1.5rem] p-12 text-center border border-gray-100 shadow-md">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Retrieving Financial Records...</p>
        </div>
      ) : quotations.length === 0 ? (
        <div className="bg-white rounded-[1.5rem] p-12 text-center border border-gray-100 shadow-md">
          <div className="text-5xl mb-4 opacity-20">📄</div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">No active quotations found</h3>
          <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">Analyze your sales pipeline and initialize your first professional quotation proposal.</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-[#244bd8] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
          >
            Initialize Proposal
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">SL No</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Quotation ID</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Company & Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Issue Date</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Valid Until</th>
                  <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {quotations.map((quotation, index) => (
                  <tr key={quotation.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{quotation.quotation_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">{quotation.company_name}</div>
                      <div className="text-xs text-gray-500">{quotation.contact_person}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(quotation.issue_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
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
                      <div className="flex items-center justify-center flex-wrap gap-2">
                        {quotation.status === 'draft' && (
                          <button
                            onClick={() => handleSendForApproval(quotation.id)}
                            className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                            title="Send for manager approval"
                          >
                            Send for approval
                          </button>
                        )}
                        <button
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Download PDF"
                        >
                          <i className="fas fa-file-pdf"></i>
                        </button>
                        <button
                          onClick={() => {
                            setFormData({
                              ...quotation,
                              lead_id: quotation.lead_id,
                              items: quotation.items || [],
                              send_for_approval: false,
                            });
                            setShowModal(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors"
                          title="Edit Quotation"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(quotation.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="Delete Quotation"
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
        </div>
      )}

      {/* Create Quotation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[1.5rem] w-full max-w-5xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200 flex flex-col max-h-[95vh]">
            {/* Modal Header */}
            <div className="bg-[#244bd8] p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                  <i className="fas fa-file-invoice text-xl"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Draft Commercial Quotation</h2>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 focus-within:text-blue-600 transition-colors">
                    <i className="fas fa-building text-blue-500 w-4 text-center"></i>
                    <span>Target Client Entity *</span>
                  </label>
                  <select
                    required
                    value={formData.lead_id}
                    onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                  >
                    <option value="">Search Registered Leads...</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.company_name} — {lead.contact_person}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    <i className="fas fa-percentage text-blue-500 w-4 text-center"></i>
                    <span>Tax Levy (%)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.tax_percentage || ''}
                    onChange={(e) => handleNumericInput(e.target.value, setFormData, 'tax_percentage')}
                    onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 text-slate-500">
                    <i className="fas fa-tag text-blue-500 w-4 text-center"></i>
                    <span>Applied Discount (%)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.discount_percentage || ''}
                    onChange={(e) => handleNumericInput(e.target.value, setFormData, 'discount_percentage')}
                    onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
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

                <div className="space-y-2.5">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 bg-white border border-slate-100 p-2.5 rounded-[1.25rem] shadow-sm hover:shadow-md transition-shadow relative group">
                      <div className="col-span-12 md:col-span-5">
                        <input
                          type="text"
                          placeholder="Item Designation/Heading *"
                          required
                          value={item.item_name}
                          onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold text-[13px]"
                        />
                        <textarea
                          placeholder="Technical description (optional)"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-[13px] mt-2 resize-none"
                          rows="2"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Quantity</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={item.quantity || ''}
                          onChange={(e) => handleNumericInput(e.target.value, null, 'quantity', true, index)}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold text-[13px] text-center"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Unit Price (₹)</label>
                        <input
                          type="number"
                          required
                          value={item.unit_price || ''}
                          onChange={(e) => handleNumericInput(e.target.value, null, 'unit_price', true, index)}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold text-[13px] text-right"
                        />
                      </div>
                      <div className="col-span-10 md:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Line Total</label>
                        <div className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-black text-xs text-right h-[38px] flex items-center justify-end shadow-inner">
                          ₹{Math.round((item.quantity || 0) * (item.unit_price || 0)).toLocaleString('en-IN')}
                        </div>
                      </div>
                      {formData.items.length > 1 && (
                        <div className="col-span-2 md:col-span-1 flex items-end justify-center pb-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-100"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Strategy & Terms Footer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className="fas fa-history text-blue-500 w-4 text-center"></i>
                    <span>Proposal Validity</span>
                  </label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-[13px]"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className="fas fa-balance-scale text-blue-500 w-4 text-center"></i>
                    <span>Terms of Agreement</span>
                  </label>
                  <textarea
                    value={formData.terms_conditions}
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
                    value={formData.notes}
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
                    <span className="text-slate-500 font-medium">Discount ({formData.discount_percentage}%)</span>
                    <span className="font-bold text-red-500">- ₹{totals.discount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Tax Liability ({formData.tax_percentage}%)</span>
                    <span className="font-bold text-blue-600">+ ₹{totals.tax.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Net Payable</span>
                    <span className="text-lg font-black text-[#244bd8]">₹{totals.grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Send for approval option */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="send_for_approval"
                  checked={!!formData.send_for_approval}
                  onChange={(e) => setFormData({ ...formData, send_for_approval: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="send_for_approval" className="text-sm font-medium text-slate-700">
                  Save and send for manager approval
                </label>
              </div>

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
                  className="px-6 py-2.5 bg-[#244bd8] hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <i className="fas fa-paper-plane mr-2 text-[10px]"></i>
                  <span>{formData.send_for_approval ? 'Save & send for approval' : 'Save as draft'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
