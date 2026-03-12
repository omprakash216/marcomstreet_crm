import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [filter, setFilter] = useState({
    search: '',
    role: '',
    department_id: '',
    status: ''
  });
  const [employeeDocs, setEmployeeDocs] = useState([]);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [formData, setFormData] = useState({
    // Basic Information
    employee_code: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'employee',
    department_id: '',
    designation: '',
    status: 'active',

    // Personal Details (for offer letters)
    address: '',
    permanent_address: '',
    dob: '',
    gender: '',
    marital_status: '',

    // Professional Background (for offer letters)
    education: '',
    experience_years: '',
    previous_experience: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',

    // Employment Details (for offer letters)
    joining_date: '',
    employment_type: 'full_time',
    probation_period: '3',
    basic_salary: '',
    hra: '',
    conveyance: '',
    medical_allowance: '',
    lta: '',
    other_allowances: '',
    pf_contribution: '',
    gratuity: '',

    // Additional Info
    previous_company: '',
    previous_designation: '',
    qualification: '',
    bank_account: '',
    bank_name: '',
    ifsc_code: '',
    branch_name: '',
    account_holder_name: '',
    pan_number: '',
    aadhar_number: ''
  });

  /* Removed Offer Modal Logic - Refactored to DocumentGenerator page */

  // Fetch data on component mount
  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  const handleOffer = (emp) => {
    navigate(`/admin/generate-document/${emp.id}`);
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/employees');
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let response;
      if (editingEmployee) {
        response = await api.put('/admin/employees', { ...formData, id: editingEmployee.id });
      } else {
        response = await api.post('/admin/employees', formData);
      }

      if (response.data.success) {
        alert(editingEmployee ? 'Employee updated!' : 'Employee created!');
        setShowModal(false);
        setEditingEmployee(null);
        resetForm();
        fetchEmployees();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Action failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/admin/employees?id=${id}`);
      if (response.data.success) {
        alert('Employee deleted successfully');
        fetchEmployees();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete employee');
    }
  };

  const resetForm = () => {
    setFormData({
      // Basic Information
      employee_code: '',
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'employee',
      department_id: '',
      designation: '',
      status: 'active',

      // Personal Details (for offer letters)
      address: '',
      permanent_address: '',
      dob: '',
      gender: '',
      marital_status: '',
      emergency_contact_name: '',

      // Professional Background (for offer letters)
      education: '',
      experience_years: '',
      previous_experience: '',
      emergency_contact_phone: '',

      // Employment Details (for offer letters)
      joining_date: '',
      employment_type: 'full_time',
      probation_period: '3',
      basic_salary: '',
      hra: '',
      conveyance: '',
      medical_allowance: '',
      lta: '',
      other_allowances: '',
      pf_contribution: '',
      gratuity: '',

      // Additional Info
      previous_company: '',
      previous_designation: '',
      qualification: '',
      bank_account: '',
      bank_name: '',
      ifsc_code: '',
      branch_name: '',
      account_holder_name: '',
      pan_number: '',
      aadhar_number: ''
    });
  };

  const handleEdit = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      // Basic Information
      employee_code: emp.employee_code || '',
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      password: '',
      role: emp.role || 'employee',
      department_id: emp.department_id || '',
      designation: emp.designation || '',
      status: emp.status || 'active',

      // Personal Details (for offer letters)
      address: emp.address || '',
      permanent_address: emp.permanent_address || emp.permenant_address || '',
      dob: emp.dob || '',
      gender: emp.gender || '',
      marital_status: emp.marital_status || '',
      emergency_contact_name: emp.emergency_contact_name || '',
      emergency_contact_phone: emp.emergency_contact_phone || '',

      // Professional Background (for offer letters)
      education: emp.education || '',
      experience_years: emp.experience_years || '',
      previous_experience: emp.previous_experience || '',

      // Employment Details (for offer letters)
      joining_date: emp.joining_date || '',
      employment_type: emp.employment_type || 'full_time',
      probation_period: emp.probation_period || '3',
      basic_salary: emp.basic_salary || '',
      hra: emp.hra || '',
      conveyance: emp.conveyance || '',
      medical_allowance: emp.medical_allowance || '',
      lta: emp.lta || '',
      other_allowances: emp.other_allowances || '',
      pf_contribution: emp.pf_contribution || '',
      gratuity: emp.gratuity || '',

      // Additional Info
      previous_company: emp.previous_company || '',
      previous_designation: emp.previous_designation || '',
      qualification: emp.qualification || '',
      bank_account: emp.bank_account || '',
      bank_name: emp.bank_name || '',
      ifsc_code: emp.ifsc_code || '',
      branch_name: emp.branch_name || '',
      account_holder_name: emp.account_holder_name || '',
      pan_number: emp.pan_number || '',
      aadhar_number: emp.aadhar_number || ''
    });
    setShowModal(true);
  };

  const handleView = async (emp) => {
    setShowViewModal(true);
    setSelectedEmployee(emp);

    try {
      const detailRes = await api.get(`/admin/employees?id=${emp.id}`);
      if (detailRes.data.success && detailRes.data.employee) {
        setSelectedEmployee(detailRes.data.employee);
      }
    } catch (error) {
      console.error('Error fetching employee details:', error);
    }

    // Fetch employee documents
    try {
      setFetchingDocs(true);
      const response = await api.get(`/hrms/documents?employee_id=${emp.id}`);
      if (response.data.success) {
        setEmployeeDocs(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employee documents:', error);
    } finally {
      setFetchingDocs(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilter(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilter({
      search: '',
      role: '',
      department_id: '',
      status: ''
    });
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = filter.search === '' ||
      emp.name.toLowerCase().includes(filter.search.toLowerCase()) ||
      emp.email.toLowerCase().includes(filter.search.toLowerCase()) ||
      emp.employee_code?.toLowerCase().includes(filter.search.toLowerCase());

    const matchesRole = filter.role === '' || emp.role === filter.role;
    const matchesDept = filter.department_id === '' || String(emp.department_id) === String(filter.department_id);
    const matchesStatus = filter.status === '' || emp.status === filter.status;

    return matchesSearch && matchesRole && matchesDept && matchesStatus;
  });

  // Calculate Statistics
  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    inactive: employees.filter(e => e.status === 'inactive').length,
    departments: new Set(employees.filter(e => e.department_id).map(e => e.department_id)).size
  };

  return (
    <div className="space-y-6">
      {/* Premium Header Section */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-2xl shadow-xl mb-6 p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/10 text-white">
              <i className="fas fa-users-cog text-2xl"></i>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Employee Management</h1>
              <p className="text-slate-300 text-sm">Organize and manage your professional workforce</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingEmployee(null);
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30 font-bold transition-all duration-200 hover:bg-blue-700 hover:scale-105"
          >
            <i className="fas fa-user-plus"></i>
            <span>Add New Employee</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <i className="fas fa-users text-xl"></i>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Total Employees</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
            <i className="fas fa-user-check text-xl"></i>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Active</p>
            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
            <i className="fas fa-user-slash text-xl"></i>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Inactive</p>
            <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <i className="fas fa-sitemap text-xl"></i>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Departments</p>
            <p className="text-2xl font-bold text-gray-900">{stats.departments}</p>
          </div>
        </div>
      </div>

      {/* Enhanced Filters Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Search Employee</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-gray-400"></i>
              </span>
              <input
                type="text"
                placeholder="Search by name, email or code..."
                value={filter.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">By Role</label>
            <select
              value={filter.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="human_resources">HR</option>
              <option value="sales_rep">Sales</option>
              <option value="employee">Employee</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">By Department</label>
            <select
              value={filter.department_id}
              onChange={(e) => handleFilterChange('department_id', e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">By Status</label>
            <div className="flex space-x-2">
              <select
                value={filter.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button
                onClick={clearFilters}
                className="p-2.5 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-colors"
                title="Clear Filters"
              >
                <i className="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">SL No</th>
                <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Emp Code</th>
                <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Department</th>
                <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Designation</th>
                <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="9" className="px-6 py-12 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2"></i>Loading employees...</td></tr>
              ) : filteredEmployees.length === 0 ? (
                <tr><td colSpan="9" className="px-6 py-12 text-center text-gray-400">No employees match your filters</td></tr>
              ) : (
                filteredEmployees.map((emp, index) => (
                  <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-4 py-4 text-xs font-bold text-gray-400">
                      {(index + 1).toString().padStart(2, '0')}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-gray-900 text-sm leading-tight">{emp.name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-gray-600">{emp.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[10px] text-blue-500 font-mono font-semibold">{emp.employee_code}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-gray-700 capitalize">{emp.role?.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-600">{emp.department_name || 'General'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-600">{emp.designation || 'Staff'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${emp.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleOffer(emp)}
                          className="w-8 h-8 flex items-center justify-center text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"
                          title="Generate Offer Letter"
                        >
                          <i className="fas fa-file-contract text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleView(emp)}
                          className="w-8 h-8 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                          title="View Details"
                        >
                          <i className="fas fa-eye text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleEdit(emp)}
                          className="w-8 h-8 flex items-center justify-center text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-all"
                          title="Edit Employee"
                        >
                          <i className="fas fa-edit text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="w-8 h-8 flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                          title="Delete Employee"
                        >
                          <i className="fas fa-trash-alt text-sm"></i>
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
            {/* Professional Header */}
            <div className="px-8 py-6 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 border-b border-blue-500 flex-shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">
                    {editingEmployee ? 'Update Employee Profile' : 'Register New Employee'}
                  </h1>
                  <p className="text-blue-100 text-sm">
                    {editingEmployee ? 'Modify employee information and settings' : 'Complete employee onboarding with all required details'}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all border border-white/20 shadow-lg hover:shadow-xl"
                  title="Close"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <form id="employeeForm" onSubmit={handleSubmit} className="space-y-8">

                {/* Personal Information Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                      <i className="fas fa-user"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Personal Information</h3>
                      <p className="text-sm text-gray-500">Basic details required for official documents</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="Enter employee's full legal name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="email@company.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone
                      </label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setFormData({ ...formData, phone: value });
                        }}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="10-digit mobile number"
                        maxLength="10"
                      />
                    </div>

                    {!editingEmployee && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                          placeholder="••••••••"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Employment Details Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <i className="fas fa-briefcase"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Employment Details</h3>
                      <p className="text-sm text-gray-500">Position, department, and role information</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Job Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      >
                        <option value="employee">Employee</option>
                        <option value="sales_rep">Sales Representative</option>
                        <option value="manager">Manager</option>
                        <option value="human_resources">HR Manager</option>
                        <option value="admin">System Administrator</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Department
                      </label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      >
                        <option value="">Select Department</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Job Designation
                      </label>
                      <input
                        type="text"
                        value={formData.designation}
                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="e.g. Senior Developer"
                      />
                    </div>
                  </div>
                </div>

                {/* Account Details Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <i className="fas fa-university"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Account Details</h3>
                      <p className="text-sm text-gray-500">Bank information for salary disbursement</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Account Holder Name</label>
                      <input
                        type="text"
                        value={formData.account_holder_name}
                        onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="Name as per bank records"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Name</label>
                      <input
                        type="text"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="e.g. HDFC Bank"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Account Number</label>
                      <input
                        type="text"
                        value={formData.bank_account}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 18);
                          setFormData({ ...formData, bank_account: value });
                        }}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="Enter account number"
                        maxLength="18"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">IFSC Code</label>
                      <input
                        type="text"
                        value={formData.ifsc_code}
                        onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="e.g. HDFC0001234"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Branch Name</label>
                      <input
                        type="text"
                        value={formData.branch_name}
                        onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="Branch location"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">PAN Number</label>
                      <input
                        type="text"
                        value={formData.pan_number}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase().slice(0, 10);
                          setFormData({ ...formData, pan_number: value });
                        }}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="ABCDE1234F"
                        maxLength="10"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Information Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center">
                      <i className="fas fa-info-circle"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Additional Information</h3>
                      <p className="text-sm text-gray-500">Other relevant official details</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Aadhar Number</label>
                      <input
                        type="text"
                        value={formData.aadhar_number}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                          setFormData({ ...formData, aadhar_number: value });
                        }}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="12-digit Aadhar number"
                        maxLength="12"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Qualification</label>
                      <input
                        type="text"
                        value={formData.qualification}
                        onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="Highest degree"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Previous Company</label>
                      <input
                        type="text"
                        value={formData.previous_company}
                        onChange={(e) => setFormData({ ...formData, previous_company: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="Last workplace"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Experience (Years)</label>
                      <input
                        type="number"
                        value={formData.experience_years}
                        onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="Total years"
                      />
                    </div>
                  </div>
                </div>

              </form>
            </div>

            {/* Professional Action Footer */}
            <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
              <div className="text-sm text-gray-500">
                <i className="fas fa-info-circle mr-2"></i>
                All fields marked with <span className="text-red-500">*</span> are required
              </div>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <i className="fas fa-times mr-2"></i>
                  Cancel
                </button>
                <button
                  form="employeeForm"
                  type="submit"
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold text-sm shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all active:scale-95 flex items-center"
                >
                  <i className="fas fa-user-plus mr-2"></i>
                  {editingEmployee ? 'Update Employee' : 'Register Employee'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal - Compact Professional Design */}
      {showViewModal && selectedEmployee && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-300 overflow-hidden flex flex-col border border-gray-200">
            {/* Compact Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-4 py-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-base font-bold text-white shadow-md border-2 border-white">
                      {selectedEmployee.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${selectedEmployee.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}>
                      <i className={`fas ${selectedEmployee.status === 'active' ? 'fa-check' : 'fa-times'} text-[5px] text-white`}></i>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 leading-tight">{selectedEmployee.name}</h2>
                    <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">{selectedEmployee.employee_code || 'EMP-001'}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => { setShowViewModal(false); handleEdit(selectedEmployee); }} className="px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"><i className="fas fa-edit mr-1"></i>Edit</button>
                  <button onClick={() => setShowViewModal(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><i className="fas fa-times"></i></button>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-3 overflow-y-auto max-h-[75vh] custom-scrollbar">
              <div className="space-y-3">
                {/* Contact & Professional Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Basic Info */}
                  <div className="bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm">
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center">
                      <i className="fas fa-address-book mr-1.5 text-blue-500"></i> Contact Details
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-medium">Email Address</span>
                        <span className="text-xs text-gray-900 font-semibold">{selectedEmployee.email}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-medium">Phone Number</span>
                        <span className="text-xs text-gray-900 font-semibold">{selectedEmployee.phone || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Career Info */}
                  <div className="bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm">
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center">
                      <i className="fas fa-briefcase mr-1.5 text-indigo-500"></i> Employment
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-medium">Department</span>
                        <span className="text-xs text-gray-900 font-semibold">{selectedEmployee.department_name || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-medium">Designation</span>
                        <span className="text-xs text-gray-900 font-semibold">{selectedEmployee.designation || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bank Details Section - Compact 3-Column Grid */}
                <div className="bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                    <i className="fas fa-university mr-1.5 text-emerald-500"></i> Financial Information
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-4">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">A/C Holder</p>
                      <p className="text-xs text-gray-900 font-semibold truncate">{selectedEmployee.account_holder_name || selectedEmployee.name}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Bank Name</p>
                      <p className="text-xs text-gray-900 font-semibold truncate">{selectedEmployee.bank_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">A/C Number</p>
                      <p className="text-xs text-gray-900 font-mono font-bold tracking-tight">{selectedEmployee.bank_account || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">IFSC Code</p>
                      <p className="text-xs text-gray-900 font-mono font-bold">{selectedEmployee.ifsc_code || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Branch Name</p>
                      <p className="text-xs text-gray-900 font-semibold truncate">{selectedEmployee.branch_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">PAN Number</p>
                      <p className="text-xs text-gray-900 font-mono font-bold">{selectedEmployee.pan_number || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Verification Section */}
                <div className="bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <i className="fas fa-id-card text-gray-400 mr-2 text-sm"></i>
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Aadhar Verification</span>
                    </div>
                    <span className="text-xs text-gray-900 font-mono font-bold">{selectedEmployee.aadhar_number || 'N/A'}</span>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                    <i className="fas fa-info-circle mr-1.5 text-blue-500"></i> Additional Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-4">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Qualification</p>
                      <p className="text-xs text-gray-900 font-semibold truncate">{selectedEmployee.qualification || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Previous Company</p>
                      <p className="text-xs text-gray-900 font-semibold truncate">{selectedEmployee.previous_company || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Experience (Years)</p>
                      <p className="text-xs text-gray-900 font-semibold">{selectedEmployee.experience_years || '0'}</p>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${selectedEmployee.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${selectedEmployee.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {selectedEmployee.status}
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => handleOffer(selectedEmployee)} className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"><i className="fas fa-file-contract mr-1.5"></i>Offer</button>
                    <button onClick={() => alert('Approved')} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"><i className="fas fa-check mr-1.5"></i>Approve</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );

}
export default AdminEmployees;
