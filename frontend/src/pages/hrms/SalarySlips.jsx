import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';

export default function SalarySlips() {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);
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
  const isAdminOrManager = employee?.role === 'admin' || employee?.role === 'manager' || employee?.role === 'human_resources';

  // Node only: same origin, /serve-pdf from Node
  const BASE_URL = '';

  useEffect(() => {
    fetchSlips();
    if (isAdminOrManager) {
      fetchEmployees();
    }
  }, [filter]);

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
      const response = await api.get('/chat?action=users');
      if (response.data.success) {
        setAllEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
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

  const calculateTotals = () => {
    const earnings = [
      'basic_salary', 'hra', 'conveyance_allowance',
      'medical_allowance', 'special_allowance', 'other_allowances'
    ];
    const deductions = [
      'pf_deduction', 'esi_deduction', 'tax_deduction',
      'professional_tax', 'other_deductions'
    ];

    const grossSalary = earnings.reduce((sum, field) =>
      sum + (parseFloat(newSlip[field]) || 0), 0
    );
    const totalDeductions = deductions.reduce((sum, field) =>
      sum + (parseFloat(newSlip[field]) || 0), 0
    );
    const netSalary = grossSalary - totalDeductions;

    return { grossSalary, totalDeductions, netSalary };
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

      {/* Salary Slips Grid */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSlips.map((slip) => (
            <div key={slip.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <i className="fas fa-file-pdf text-xl"></i>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-gray-400 uppercase block">{slip.month}</span>
                  {isAdminOrManager && <span className="text-xs text-blue-500 font-medium">{slip.employee_name}</span>}
                </div>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Salary Slip - {slip.month}</h3>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Gross Salary:</span>
                  <span className="font-semibold text-gray-900">₹{parseFloat(slip.gross_salary || slip.amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Deductions:</span>
                  <span className="font-semibold text-red-600">-₹{parseFloat(slip.total_deductions || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                  <span className="text-gray-900">Net Salary:</span>
                  <span className="text-blue-600">₹{parseFloat(slip.net_salary || slip.amount).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedSlip(slip);
                    setShowDetailsModal(true);
                  }}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-all border border-gray-200 text-sm"
                >
                  <i className="fas fa-eye mr-2"></i>
                  View Details
                </button>
                <a
                  href={`${BASE_URL}/serve-pdf?file=${encodeURIComponent(slip.file_path)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-all text-sm"
                >
                  <i className="fas fa-download mr-2"></i>
                  Download
                </a>
              </div>
            </div>
          ))}
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
                    <option value="">Choose Employee</option>
                    {allEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
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
                  <div className="text-xl font-bold text-slate-700">₹{grossSalary.toLocaleString()}</div>
                </div>
                <div className="w-px h-8 bg-blue-200 hidden md:block"></div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Total Deductions</div>
                  <div className="text-xl font-bold text-red-600">₹{totalDeductions.toLocaleString()}</div>
                </div>
                <div className="w-px h-8 bg-blue-200 hidden md:block"></div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Net Payable</div>
                  <div className="text-2xl font-bold text-blue-700">₹{netSalary.toLocaleString()}</div>
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
                    <span className="font-medium">₹{parseFloat(selectedSlip.basic_salary || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">HRA</span>
                    <span className="font-medium">₹{parseFloat(selectedSlip.hra || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Conveyance</span>
                    <span className="font-medium">₹{parseFloat(selectedSlip.conveyance_allowance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Medical</span>
                    <span className="font-medium">₹{parseFloat(selectedSlip.medical_allowance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Special</span>
                    <span className="font-medium">₹{parseFloat(selectedSlip.special_allowance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Other</span>
                    <span className="font-medium">₹{parseFloat(selectedSlip.other_allowances || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                    <span className="text-green-600">Gross Salary</span>
                    <span className="text-green-600">₹{parseFloat(selectedSlip.gross_salary || selectedSlip.amount).toLocaleString()}</span>
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
                    <span className="font-medium">₹{parseFloat(selectedSlip.pf_deduction || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">ESI</span>
                    <span className="font-medium">₹{parseFloat(selectedSlip.esi_deduction || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax (TDS)</span>
                    <span className="font-medium">₹{parseFloat(selectedSlip.tax_deduction || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Professional Tax</span>
                    <span className="font-medium">₹{parseFloat(selectedSlip.professional_tax || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Other</span>
                    <span className="font-medium">₹{parseFloat(selectedSlip.other_deductions || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                    <span className="text-red-600">Total Deductions</span>
                    <span className="text-red-600">₹{parseFloat(selectedSlip.total_deductions || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Salary */}
            <div className="bg-blue-600 text-white rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Net Salary</span>
                <span className="text-3xl font-bold">₹{parseFloat(selectedSlip.net_salary || selectedSlip.amount).toLocaleString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end">
              <a
                href={`${BASE_URL}/serve-pdf?file=${encodeURIComponent(selectedSlip.file_path)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-all inline-flex items-center"
              >
                <i className="fas fa-download mr-2"></i>
                Download PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
