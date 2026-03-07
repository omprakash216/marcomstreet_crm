import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';

export default function SalarySlips() {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [editSlipId, setEditSlipId] = useState(null);
  const [editSlip, setEditSlip] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [filter, setFilter] = useState({
    month: '',
    year: ''
  });
  const [newSlip, setNewSlip] = useState({
    employee_id: '',
    month: new Date().toISOString().slice(0, 7),
    pay_period_start: '',
    pay_period_end: '',
    basic_salary: '',
    hra: '',
    conveyance_allowance: '',
    medical_allowance: '',
    special_allowance: '',
    other_allowances: '',
    pf_deduction: '',
    esi_deduction: '',
    tax_deduction: '',
    professional_tax: '',
    other_deductions: '',
    status: 'generated'
  });
  const employee = getEmployee();
  const role = String(employee?.role || '').toLowerCase().trim();
  const isAdminOrManager =
    role === 'admin' ||
    role === 'manager' ||
    role === 'human_resources' ||
    role === 'human resources' ||
    role === 'human resource' ||
    role === 'humanresources' ||
    role === 'humanresource' ||
    role === 'hr' ||
    role === 'hr_manager' ||
    role === 'hr manager';

  const IconEye = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
  const IconPencil = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
  const IconDownload = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10l5 5m0 0l5-5m-5 5V4" />
    </svg>
  );
  const IconTrash = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h14" />
    </svg>
  );

  // Node only: same origin, /serve-pdf from Node
  const BASE_URL = '';

  const downloadSlipPdf = async (slip) => {
    if (!slip) return;
    const hasId = slip?.id !== undefined && slip?.id !== null && slip?.id !== '';
    const filePath = slip?.file_path;
    // Prefer authenticated API endpoint (auto-regenerates missing PDFs).
    // `regen=1` ensures latest letter-head.png layout even if an old PDF file exists on disk.
    const apiUrl = hasId ? `/hrms/salary/${encodeURIComponent(String(slip.id))}/pdf?download=1&regen=1` : null;
    const fallbackUrl = `${BASE_URL}/serve-pdf?file=${encodeURIComponent(filePath)}&download=1`;
    const safeName =
      (String(filePath || '').split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_')) || 'salary-slip.pdf';

    try {
      let blob;
      if (apiUrl) {
        const resp = await api.get(apiUrl, { responseType: 'blob' });
        blob = resp.data;
      } else {
        const resp = await fetch(fallbackUrl, { credentials: 'include' });
        if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
        blob = await resp.blob();
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
    } catch (e) {
      console.error(e);
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Failed to download PDF';
      // If backend returns 404/401/403, opening a new tab just shows an error page.
      if (status === 401 || status === 403) {
        alert('Session expired or unauthorized. Please login again.');
        return;
      }
      if (status === 404) {
        alert('PDF not found. Please regenerate the salary slip and try again.');
        return;
      }
      alert(msg);
    }
  };

  useEffect(() => {
    fetchSlips();
    if (isAdminOrManager) {
      fetchEmployees();
    }
  }, [filter, isAdminOrManager]);

  // Auto-set pay period when month changes
  useEffect(() => {
    if (newSlip.month) {
      const [year, month] = newSlip.month.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
      setNewSlip(prev => ({
        ...prev,
        pay_period_start: startDate,
        pay_period_end: endDate
      }));
    }
  }, [newSlip.month]);

  const fetchEmployees = async () => {
    try {
      // Primary source for HR/Admin salary generation: active employee master list
      const response = await api.get('/employees');
      if (response.data?.success && Array.isArray(response.data.data)) {
        setAllEmployees(response.data.data);
        return;
      }

      // Fallback for older deployments
      const fallback = await api.get('/chat?action=users');
      if (fallback.data?.success && Array.isArray(fallback.data.data)) {
        setAllEmployees(fallback.data.data);
      } else {
        setAllEmployees([]);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setAllEmployees([]);
    }
  };

  const fetchSlips = async () => {
    try {
      const response = await api.get('/hrms/salary');
      if (response.data.success) {
        setSlips(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching slips:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalsFrom = (slipLike) => {
    const earnings = [
      'basic_salary', 'hra', 'conveyance_allowance',
      'medical_allowance', 'special_allowance', 'other_allowances'
    ];
    const deductions = [
      'pf_deduction', 'esi_deduction', 'tax_deduction',
      'professional_tax', 'other_deductions'
    ];

    const grossSalary = earnings.reduce((sum, field) =>
      sum + (parseFloat(slipLike?.[field]) || 0), 0
    );
    const totalDeductions = deductions.reduce((sum, field) =>
      sum + (parseFloat(slipLike?.[field]) || 0), 0
    );
    const netSalary = grossSalary - totalDeductions;

    return { grossSalary, totalDeductions, netSalary };
  };

  const calculateTotals = () => calculateTotalsFrom(newSlip);

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

  // For <input type="date" />, value must be exactly "YYYY-MM-DD" or "".
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

  const fmtMoney = (v) => {
    const n = Number.parseFloat(v);
    if (!Number.isFinite(n)) return '0';
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const handleGenerateSlip = async (e) => {
    e.preventDefault();

    const { grossSalary, totalDeductions, netSalary } = calculateTotals();

    if (grossSalary <= 0) {
      alert('Please enter valid salary components');
      return;
    }

    const payload = {
      ...newSlip,
      gross_salary: grossSalary,
      total_deductions: totalDeductions,
      net_salary: netSalary
    };

    try {
      const response = await api.post('/hrms/salary', payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.data.success) {
        alert('Salary slip generated successfully!');
        setShowGenerateModal(false);
        resetForm();
        fetchSlips();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to generate slip');
    }
  };

  const resetForm = () => {
    setNewSlip({
      employee_id: '',
      month: new Date().toISOString().slice(0, 7),
      pay_period_start: '',
      pay_period_end: '',
      basic_salary: '',
      hra: '',
      conveyance_allowance: '',
      medical_allowance: '',
      special_allowance: '',
      other_allowances: '',
      pf_deduction: '',
      esi_deduction: '',
      tax_deduction: '',
      professional_tax: '',
      other_deductions: '',
      status: 'generated'
    });
  };

  const handleFilterChange = (field, value) => {
    setFilter({ ...filter, [field]: value });
  };

  const clearFilters = () => {
    setFilter({ month: '', year: '' });
  };

  const filteredSlips = slips.filter(slip => {
    const matchesMonth = filter.month === '' || slip.month.includes(filter.month);
    const matchesYear = filter.year === '' || slip.month.includes(filter.year);
    return matchesMonth && matchesYear;
  });

  const { grossSalary, totalDeductions, netSalary } = calculateTotals();

  const openEdit = (slip) => {
    if (!slip) return;
    setEditSlipId(slip.id);
    setEditSlip({
      month: slip.month || new Date().toISOString().slice(0, 7),
      pay_period_start: toDateInput(slip.pay_period_start),
      pay_period_end: toDateInput(slip.pay_period_end),
      basic_salary: slip.basic_salary ?? '',
      hra: slip.hra ?? '',
      conveyance_allowance: slip.conveyance_allowance ?? '',
      medical_allowance: slip.medical_allowance ?? '',
      special_allowance: slip.special_allowance ?? '',
      other_allowances: slip.other_allowances ?? '',
      pf_deduction: slip.pf_deduction ?? '',
      esi_deduction: slip.esi_deduction ?? '',
      tax_deduction: slip.tax_deduction ?? '',
      professional_tax: slip.professional_tax ?? '',
      other_deductions: slip.other_deductions ?? '',
      status: slip.status || 'generated',
    });
    setShowEditModal(true);
  };

  const handleUpdateSlip = async (e) => {
    e.preventDefault();
    if (!editSlipId || !editSlip) return;
    const { grossSalary: g, totalDeductions: td, netSalary: ns } = calculateTotalsFrom(editSlip);
    if (g <= 0) {
      alert('Please enter valid salary components');
      return;
    }
    try {
      const payload = { ...editSlip, gross_salary: g, total_deductions: td, net_salary: ns };
      const resp = await api.put(`/hrms/salary/${encodeURIComponent(String(editSlipId))}`, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (resp.data?.success) {
        alert('Salary slip updated successfully!');
        setShowEditModal(false);
        setEditSlipId(null);
        setEditSlip(null);
        fetchSlips();
      } else {
        alert(resp.data?.message || 'Failed to update slip');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update slip');
    }
  };

  const handleDeleteSlip = async (slip) => {
    if (!slip?.id) return;
    const ok = window.confirm('Delete this salary slip? This cannot be undone.');
    if (!ok) return;
    try {
      const resp = await api.delete(`/hrms/salary/${encodeURIComponent(String(slip.id))}`);
      if (resp.data?.success) {
        fetchSlips();
      } else {
        alert(resp.data?.message || 'Failed to delete slip');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete slip');
    }
  };

  return (
    <div>
      {/* Header Section */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg text-white">
              <i className="fas fa-file-invoice-dollar text-2xl"></i>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1">Salary Slips</h1>
              <p className="text-slate-300 text-sm">View and download your monthly salary slips</p>
            </div>
            {isAdminOrManager && (
              <button
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold transition-all duration-200 hover:bg-slate-50"
              >
                <i className="fas fa-plus"></i>
                <span>Generate Slip</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
            <input
              type="month"
              value={filter.month}
              onChange={(e) => handleFilterChange('month', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <input
              type="text"
              value={filter.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              placeholder="e.g. 2026"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Salary Slips List */}
      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-md">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm font-medium text-gray-500">Loading salary slips...</p>
        </div>
      ) : filteredSlips.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-md">
          <i className="fas fa-file-invoice-dollar text-4xl text-gray-300 mb-4 block"></i>
          <p className="text-gray-500">No salary slips found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Month</th>
                  {isAdminOrManager && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Employee</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Code</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Gross</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Deductions</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Net</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap sticky right-0 z-10 bg-gray-50 border-l border-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSlips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{slip.month}</td>
                    {isAdminOrManager && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{slip.employee_name || '-'}</td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{slip.employee_code || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">Rs. {fmtMoney(slip.gross_salary || slip.amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-red-600">Rs. {fmtMoney(slip.total_deductions || 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-blue-700">Rs. {fmtMoney(slip.net_salary || slip.amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${slip.status === 'paid' ? 'bg-green-100 text-green-800' : slip.status === 'generated' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                        {String(slip.status || 'generated')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{fmtDate(slip.created_at)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 z-10 bg-white border-l border-gray-100">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setSelectedSlip(slip); setShowDetailsModal(true); }}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          title="View"
                          aria-label="View"
                        >
                          <IconEye className="w-4 h-4" />
                        </button>
                        {isAdminOrManager && (
                          <button
                            type="button"
                            onClick={() => openEdit(slip)}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                            title="Edit"
                            aria-label="Edit"
                          >
                            <IconPencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => downloadSlipPdf(slip)}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                          title="Download PDF"
                          aria-label="Download PDF"
                        >
                          <IconDownload className="w-4 h-4" />
                        </button>
                        {isAdminOrManager && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSlip(slip)}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            title="Delete"
                            aria-label="Delete"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Slip Modal */}
      {showEditModal && editSlip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[calc(100vh-3rem)] flex flex-col">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 flex justify-between items-start text-white sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-bold tracking-tight leading-tight">Edit Salary Slip</h2>
                <p className="text-slate-300 text-[11px] mt-0.5 leading-snug">Update values and regenerate the PDF</p>
              </div>
              <button
                onClick={() => { setShowEditModal(false); setEditSlipId(null); setEditSlip(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                aria-label="Close"
                title="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleUpdateSlip} className="p-5 sm:p-6 overflow-y-auto">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pay Period (Month)</label>
                  <input
                    type="month"
                    required
                    value={editSlip.month}
                    onChange={(e) => setEditSlip({ ...editSlip, month: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={editSlip.status}
                    onChange={(e) => setEditSlip({ ...editSlip, status: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                  >
                    <option value="generated">generated</option>
                    <option value="paid">paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Period Start</label>
                  <input
                    type="date"
                    value={editSlip.pay_period_start}
                    onChange={(e) => setEditSlip({ ...editSlip, pay_period_start: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Period End</label>
                  <input
                    type="date"
                    value={editSlip.pay_period_end}
                    onChange={(e) => setEditSlip({ ...editSlip, pay_period_end: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden mb-6">
                <div className="bg-white p-4">
                  <h3 className="text-sm font-bold text-green-700 mb-4 flex items-center">
                    <span className="w-1.5 h-4 bg-green-500 rounded-full mr-2"></span>
                    EARNINGS
                  </h3>
                  <div className="space-y-3">
                    {[
                      ['basic_salary', 'Basic Salary *'],
                      ['hra', 'HRA'],
                      ['conveyance_allowance', 'Conveyance'],
                      ['medical_allowance', 'Medical'],
                      ['special_allowance', 'Special'],
                      ['other_allowances', 'Other'],
                    ].map(([key, label]) => (
                      <div key={key} className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</label>
                        <input
                          type="number"
                          step="0.01"
                          required={key === 'basic_salary'}
                          value={editSlip[key]}
                          onChange={(e) => setEditSlip({ ...editSlip, [key]: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-green-500 outline-none transition-colors"
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-4">
                  <h3 className="text-sm font-bold text-red-700 mb-4 flex items-center">
                    <span className="w-1.5 h-4 bg-red-500 rounded-full mr-2"></span>
                    DEDUCTIONS
                  </h3>
                  <div className="space-y-3">
                    {[
                      ['pf_deduction', 'PF'],
                      ['esi_deduction', 'ESI'],
                      ['tax_deduction', 'TDS'],
                      ['professional_tax', 'Professional Tax'],
                      ['other_deductions', 'Other'],
                    ].map(([key, label]) => (
                      <div key={key} className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editSlip[key]}
                          onChange={(e) => setEditSlip({ ...editSlip, [key]: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-red-500 outline-none transition-colors"
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {(() => {
                const t = calculateTotalsFrom(editSlip);
                return (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col md:flex-row justify-around items-center gap-4 text-center">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Gross Earnings</div>
                      <div className="text-xl font-bold text-slate-700">Rs. {fmtMoney(t.grossSalary)}</div>
                    </div>
                    <div className="w-px h-8 bg-blue-200 hidden md:block"></div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Total Deductions</div>
                      <div className="text-xl font-bold text-red-600">Rs. {fmtMoney(t.totalDeductions)}</div>
                    </div>
                    <div className="w-px h-8 bg-blue-200 hidden md:block"></div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Net Payable</div>
                      <div className="text-2xl font-bold text-blue-700">Rs. {fmtMoney(t.netSalary)}</div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditSlipId(null); setEditSlip(null); }}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-900/20 font-bold text-sm flex items-center transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <i className="fas fa-save mr-2"></i>
                  Update Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Generate Slip Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4 flex justify-between items-center text-white">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Generate Salary Slip</h2>
                <p className="text-blue-100 text-xs mt-0.5">Create professional payslips for employees</p>
              </div>
              <button
                onClick={() => { setShowGenerateModal(false); resetForm(); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleGenerateSlip} className="p-6">
              {/* Employee & Period Selection */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Selection</label>
                  <select
                    required
                    value={newSlip.employee_id}
                    onChange={(e) => setNewSlip({ ...newSlip, employee_id: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                  >
                    <option value="">{allEmployees.length ? 'Choose Employee' : 'No employees found'}</option>
                    {allEmployees.map((emp) => {
                      const empName = emp.name || emp.employee_name || 'Unnamed Employee';
                      const empCode = emp.employee_code ? ` (${emp.employee_code})` : '';
                      return (
                        <option key={emp.id} value={emp.id}>
                          {empName}{empCode}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pay Period (Month)</label>
                  <input
                    type="month"
                    required
                    value={newSlip.month}
                    onChange={(e) => setNewSlip({ ...newSlip, month: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Salary Components Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden mb-6">
                {/* Earnings Column */}
                <div className="bg-white p-4">
                  <h3 className="text-sm font-bold text-green-700 mb-4 flex items-center">
                    <span className="w-1.5 h-4 bg-green-500 rounded-full mr-2"></span>
                    EARNINGS
                  </h3>
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Basic Salary *</label>
                      <input
                        type="number" required step="0.01" value={newSlip.basic_salary}
                        onChange={(e) => setNewSlip({ ...newSlip, basic_salary: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-green-500 outline-none transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">HRA</label>
                        <input
                          type="number" step="0.01" value={newSlip.hra}
                          onChange={(e) => setNewSlip({ ...newSlip, hra: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-green-500 outline-none transition-colors"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Conveyance</label>
                        <input
                          type="number" step="0.01" value={newSlip.conveyance_allowance}
                          onChange={(e) => setNewSlip({ ...newSlip, conveyance_allowance: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-green-500 outline-none transition-colors"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Medical</label>
                        <input
                          type="number" step="0.01" value={newSlip.medical_allowance}
                          onChange={(e) => setNewSlip({ ...newSlip, medical_allowance: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-green-500 outline-none transition-colors"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Others</label>
                        <input
                          type="number" step="0.01" value={newSlip.other_allowances}
                          onChange={(e) => setNewSlip({ ...newSlip, other_allowances: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-green-500 outline-none transition-colors"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deductions Column */}
                <div className="bg-white p-4">
                  <h3 className="text-sm font-bold text-red-700 mb-4 flex items-center">
                    <span className="w-1.5 h-4 bg-red-500 rounded-full mr-2"></span>
                    DEDUCTIONS
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">PF Deduction</label>
                        <input
                          type="number" step="0.01" value={newSlip.pf_deduction}
                          onChange={(e) => setNewSlip({ ...newSlip, pf_deduction: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-red-500 outline-none transition-colors"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">ESI</label>
                        <input
                          type="number" step="0.01" value={newSlip.esi_deduction}
                          onChange={(e) => setNewSlip({ ...newSlip, esi_deduction: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-red-500 outline-none transition-colors"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">TDS (Tax)</label>
                        <input
                          type="number" step="0.01" value={newSlip.tax_deduction}
                          onChange={(e) => setNewSlip({ ...newSlip, tax_deduction: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-red-500 outline-none transition-colors"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Prof. Tax</label>
                        <input
                          type="number" step="0.01" value={newSlip.professional_tax}
                          onChange={(e) => setNewSlip({ ...newSlip, professional_tax: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-red-500 outline-none transition-colors"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Other Deductions</label>
                      <input
                        type="number" step="0.01" value={newSlip.other_deductions}
                        onChange={(e) => setNewSlip({ ...newSlip, other_deductions: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:border-red-500 outline-none transition-colors"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Bar */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col md:flex-row justify-around items-center gap-4 text-center">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Gross Earnings</div>
                  <div className="text-xl font-bold text-slate-700">Rs. {fmtMoney(grossSalary)}</div>
                </div>
                <div className="w-px h-8 bg-blue-200 hidden md:block"></div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Total Deductions</div>
                  <div className="text-xl font-bold text-red-600">Rs. {fmtMoney(totalDeductions)}</div>
                </div>
                <div className="w-px h-8 bg-blue-200 hidden md:block"></div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Net Payable</div>
                  <div className="text-2xl font-bold text-blue-700">Rs. {fmtMoney(netSalary)}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => { setShowGenerateModal(false); resetForm(); }}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 font-bold text-sm flex items-center transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <i className="fas fa-file-pdf mr-2"></i>
                  Generate PDF Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedSlip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Salary Slip Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            {/* Employee Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Employee Name</p>
                  <p className="font-semibold text-gray-900">{selectedSlip.employee_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Employee Code</p>
                  <p className="font-semibold text-gray-900">{selectedSlip.employee_code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Designation</p>
                  <p className="font-semibold text-gray-900">{selectedSlip.designation}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Department</p>
                  <p className="font-semibold text-gray-900">{selectedSlip.department}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pay Period</p>
                  <p className="font-semibold text-gray-900">{selectedSlip.month}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Bank A/C</p>
                  <p className="font-semibold text-gray-900">{selectedSlip.bank_account || '-'}</p>
                </div>
              </div>
            </div>

            {/* Earnings & Deductions */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Earnings */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <i className="fas fa-arrow-up text-green-600 mr-2"></i>
                  Earnings
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Basic Salary</span>
                    <span className="font-medium">Rs. {fmtMoney(selectedSlip.basic_salary || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">HRA</span>
                    <span className="font-medium">Rs. {fmtMoney(selectedSlip.hra || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Conveyance</span>
                    <span className="font-medium">Rs. {fmtMoney(selectedSlip.conveyance_allowance || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Medical</span>
                    <span className="font-medium">Rs. {fmtMoney(selectedSlip.medical_allowance || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Special</span>
                    <span className="font-medium">Rs. {fmtMoney(selectedSlip.special_allowance || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Other</span>
                    <span className="font-medium">Rs. {fmtMoney(selectedSlip.other_allowances || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                    <span className="text-green-600">Gross Salary</span>
                    <span className="text-green-600">Rs. {fmtMoney(selectedSlip.gross_salary || selectedSlip.amount)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <i className="fas fa-arrow-down text-red-600 mr-2"></i>
                  Deductions
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">PF</span>
                    <span className="font-medium">Rs. {fmtMoney(selectedSlip.pf_deduction || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">ESI</span>
                    <span className="font-medium">Rs. {fmtMoney(selectedSlip.esi_deduction || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax (TDS)</span>
                    <span className="font-medium">Rs. {fmtMoney(selectedSlip.tax_deduction || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Professional Tax</span>
                    <span className="font-medium">Rs. {fmtMoney(selectedSlip.professional_tax || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Other</span>
                    <span className="font-medium">Rs. {fmtMoney(selectedSlip.other_deductions || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                    <span className="text-red-600">Total Deductions</span>
                    <span className="text-red-600">Rs. {fmtMoney(selectedSlip.total_deductions || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Salary */}
            <div className="bg-blue-600 text-white rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Net Salary</span>
                <span className="text-3xl font-bold">Rs. {fmtMoney(selectedSlip.net_salary || selectedSlip.amount)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => downloadSlipPdf(selectedSlip)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-all inline-flex items-center"
              >
                <i className="fas fa-download mr-2"></i>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

