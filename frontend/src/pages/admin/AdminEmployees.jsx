import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';

function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminShell = location.pathname.startsWith('/admin');
  const modalContentInsetClass = isAdminShell
    ? 'fixed top-24 bottom-0 left-0 right-0 lg:left-72'
    : 'fixed top-24 bottom-0 left-0 right-0 lg:left-64';
  const currentUser = getEmployee();
  const currentRole = (currentUser?.role || '').toLowerCase();
  const isSuperAdmin = currentRole === 'superadmin' || currentRole === 'super_admin';
  const canResetPassword = currentRole === 'admin';
  const canToggleStatus = currentRole === 'admin' || currentRole === 'human_resources';
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const [filter, setFilter] = useState({
    search: '',
    company_id: '',
    role: '',
    department_id: '',
    status: ''
  });
  const [employeeDocs, setEmployeeDocs] = useState([]);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [formData, setFormData] = useState({
    // Basic Information
    company_id: isSuperAdmin ? '' : currentUser?.company_id || '',
    employee_code: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'employee',
    department_id: '',
    designation_id: '',
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
    aadhar_number: '',

    // Access Control
    access_template: 'default', // default | crm_only | hrms_only | minimal | custom
    access_modules: getTemplateModules('default', 'employee'),
  });

  /* Removed Offer Modal Logic - Refactored to DocumentGenerator page */

  // Fetch data on component mount
  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
    fetchDesignations();
    if (isSuperAdmin) fetchCompanies();
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

  const fetchDesignations = async () => {
    try {
      const response = await api.get('/hrms/designations');
      if (response.data.success) {
        setDesignations(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching designations:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/admin/companies');
      if (response.data?.success) {
        setCompanies(Array.isArray(response.data.data) ? response.data.data : []);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      setCompanies([]);
    }
  };

  const toDateInputValue = (value) => {
    if (!value) return '';
    return String(value).slice(0, 10);
  };

  const findDesignationId = (detail) => {
    if (detail?.designation_id) return detail.designation_id;
    const label = String(detail?.designation || detail?.designation_name || '').toLowerCase().trim();
    if (!label) return '';
    const match = designations.find((item) => (
      String(item.name || '').toLowerCase().trim() === label ||
      String(item.designation_code || '').toLowerCase().trim() === label
    ));
    return match?.id || '';
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
    setCodeError('');
    setCodeLoading(false);
    setFormData({
      // Basic Information
      company_id: isSuperAdmin ? '' : currentUser?.company_id || '',
      employee_code: '',
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'employee',
      department_id: '',
      designation_id: '',
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
      aadhar_number: '',

      // Access Control
      access_template: 'default',
      access_modules: getTemplateModules('default', 'employee'),
    });
  };

  const ACCESS_MODULES = [
    { key: 'leads', label: 'Leads' },
    { key: 'meetings', label: 'Meetings' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'followups', label: 'Follow Ups' },
    { key: 'quotations', label: 'Quotations' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'reports', label: 'Reports' },
    { key: 'history', label: 'History' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'group_meetings', label: 'Group Meetings' },
    { key: 'hrms', label: 'HRMS Full Suite' },
    { key: 'hrms_attendance', label: 'HRMS Attendance' },
    { key: 'hrms_leaves', label: 'HRMS Leaves' },
    { key: 'hrms_salary', label: 'Salary Slips' },
    { key: 'hrms_documents', label: 'HR Documents' },
    { key: 'hrms_departments', label: 'Departments' },
    { key: 'hrms_designations', label: 'Designations' },
    { key: 'hrms_shifts', label: 'Shift Management' },
    { key: 'hrms_holidays', label: 'Holidays' },
    { key: 'hrms_announcements', label: 'Announcements' },
    { key: 'hrms_performance', label: 'Performance' },
    { key: 'hrms_settings', label: 'HR Settings' },
    { key: 'hrms_reports', label: 'HR Reports' },
    { key: 'chat', label: 'Chat' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'notifications', label: 'Notifications' },
  ];

  function getTemplateModules(templateKey, roleKey) {
    const common = ['calendar', 'notifications', 'chat'];
    const crm = ['leads', 'meetings', 'tasks', 'followups', 'quotations', 'invoices', 'reports', 'history', 'whatsapp', 'group_meetings'];
    const hrms = [
      'hrms',
      'hrms_attendance',
      'hrms_leaves',
      'hrms_salary',
      'hrms_documents',
      'hrms_departments',
      'hrms_designations',
      'hrms_shifts',
      'hrms_holidays',
      'hrms_announcements',
      'hrms_performance',
      'hrms_settings',
      'hrms_reports',
    ];

    if (templateKey === 'crm_only') return Array.from(new Set([...common, ...crm]));
    if (templateKey === 'hrms_only') return Array.from(new Set([...common, ...hrms]));
    if (templateKey === 'minimal') return Array.from(new Set([...common]));

    const r = String(roleKey || 'employee')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');
    if (r === 'human_resources' || r === 'human_resource' || r === 'hr' || r === 'hr_manager') {
      return Array.from(new Set([...common, ...hrms]));
    }
    if (r === 'manager') return Array.from(new Set([...common, ...crm, ...hrms]));
    if (r === 'admin') return Array.from(new Set([...common, ...crm, ...hrms]));
    return Array.from(new Set([...common, ...crm, ...hrms]));
  }

  const handleEdit = async (emp) => {
    setEditingEmployee(emp);
    setCodeError('');
    setCodeLoading(false);

    let detail = emp;
    try {
      const detailRes = await api.get(`/admin/employees?id=${emp.id}`);
      if (detailRes.data?.success && detailRes.data?.employee) {
        detail = detailRes.data.employee;
      }
    } catch (_) {
      // ignore
    }

    const existingModules = Array.isArray(detail?.access_modules) ? detail.access_modules : [];
    const accessTemplate = existingModules.length ? 'custom' : 'default';
    const effectiveModules = existingModules.length ? existingModules : getTemplateModules('default', detail?.role || emp?.role);

    setFormData({
      // Basic Information
      company_id: detail.company_id || currentUser?.company_id || '',
      employee_code: detail.employee_code || '',
      name: detail.name || '',
      email: detail.email || '',
      phone: detail.phone || '',
      password: '',
      role: detail.role || 'employee',
      department_id: detail.department_id || '',
      designation_id: findDesignationId(detail),
      designation: detail.designation_name || detail.designation || '',
      status: detail.status || 'active',

      // Personal Details (for offer letters)
      address: detail.address || '',
      permanent_address: detail.permanent_address || detail.permenant_address || '',
      dob: detail.dob || '',
      gender: detail.gender || '',
      marital_status: detail.marital_status || '',
      emergency_contact_name: detail.emergency_contact_name || '',
      emergency_contact_phone: detail.emergency_contact_phone || '',

      // Professional Background (for offer letters)
      education: detail.education || '',
      experience_years: detail.experience_years || '',
      previous_experience: detail.previous_experience || '',

      // Employment Details (for offer letters)
      joining_date: toDateInputValue(detail.joining_date),
      employment_type: detail.employment_type || 'full_time',
      probation_period: detail.probation_period || '3',
      basic_salary: detail.basic_salary || '',
      hra: detail.hra || '',
      conveyance: detail.conveyance || '',
      medical_allowance: detail.medical_allowance || '',
      lta: detail.lta || '',
      other_allowances: detail.other_allowances || '',
      pf_contribution: detail.pf_contribution || '',
      gratuity: detail.gratuity || '',

      // Additional Info
      previous_company: detail.previous_company || '',
      previous_designation: detail.previous_designation || '',
      qualification: detail.qualification || '',
      bank_account: detail.bank_account || '',
      bank_name: detail.bank_name || '',
      ifsc_code: detail.ifsc_code || '',
      branch_name: detail.branch_name || '',
      account_holder_name: detail.account_holder_name || '',
      pan_number: detail.pan_number || '',
      aadhar_number: detail.aadhar_number || '',

      // Access Control
      access_template: accessTemplate,
      access_modules: effectiveModules,
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

  const handleResetPassword = async (emp) => {
    const newPassword = window.prompt('Enter new password (leave blank to auto-generate):');
    try {
      const response = await api.post(`/admin/employees/${emp.id}/reset-password`, {
        new_password: newPassword || null,
      });
      if (response.data.success) {
        const pwd = response.data.data?.password;
        alert(pwd ? `Password reset. New password: ${pwd}` : 'Password reset.');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleToggleStatus = async (emp) => {
    const nextStatus = emp.status === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`Mark ${emp.name} as ${nextStatus}?`)) return;
    try {
      const response = await api.patch(`/admin/employees/${emp.id}/status`, { status: nextStatus });
      if (response.data.success) {
        fetchEmployees();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleFilterChange = (field, value) => {
    setFilter(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilter({
      search: '',
      company_id: '',
      role: '',
      department_id: '',
      status: ''
    });
  };

  const isSuperAdminEmployee = (emp) => {
    const role = String(emp?.role || '').toLowerCase();
    return role === 'superadmin' || role === 'super_admin';
  };

  const baseEmployees = employees.filter((emp) => !isSuperAdminEmployee(emp));

  const companyMap = new Map(companies.map((c) => [String(c.id), c.company_name || `Company #${c.id}`]));

  const departmentOptions = (() => {
    if (!isSuperAdmin) return departments;
    if (!filter.company_id) return departments;

    const hasCompanyField = departments.some((d) => d && d.company_id !== undefined && d.company_id !== null);
    if (hasCompanyField) {
      return departments.filter((d) => String(d.company_id) === String(filter.company_id));
    }

    const deptIds = new Set(
      baseEmployees
        .filter((e) => String(e.company_id) === String(filter.company_id))
        .map((e) => String(e.department_id || ''))
        .filter(Boolean)
    );
    return departments.filter((d) => deptIds.has(String(d.id)));
  })();

  const formCompanyId = isSuperAdmin ? formData.company_id : (currentUser?.company_id || formData.company_id || 'current');
  const formDepartmentOptions = (() => {
    if (!isSuperAdmin) return departments;
    if (!formData.company_id) return departments;
    const hasCompanyField = departments.some((d) => d && d.company_id !== undefined && d.company_id !== null);
    return hasCompanyField
      ? departments.filter((d) => String(d.company_id) === String(formData.company_id))
      : departments;
  })();

  useEffect(() => {
    if (!showModal) return;

    if (!formCompanyId || !formData.department_id || !formData.designation_id || !formData.joining_date) {
      setCodeLoading(false);
      setCodeError('');
      if (!editingEmployee && formData.employee_code) {
        setFormData((prev) => ({ ...prev, employee_code: '' }));
      }
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setCodeLoading(true);
        setCodeError('');
        const response = await api.post('/ajax/generate-employee-code.php', {
          company_id: formCompanyId,
          department_id: formData.department_id,
          designation_id: formData.designation_id,
          joining_date: formData.joining_date,
          exclude_employee_id: editingEmployee?.id || null,
        });
        if (!cancelled && response.data?.success) {
          setFormData((prev) => ({ ...prev, employee_code: response.data.employee_code || '' }));
        }
      } catch (error) {
        if (!cancelled) {
          setCodeError(error.response?.data?.message || 'Unable to generate employee code');
          setFormData((prev) => ({ ...prev, employee_code: editingEmployee?.employee_code || '' }));
        }
      } finally {
        if (!cancelled) setCodeLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    showModal,
    formCompanyId,
    formData.department_id,
    formData.designation_id,
    formData.joining_date,
    editingEmployee?.id,
  ]);

  const filteredEmployees = baseEmployees.filter(emp => {
    const matchesSearch = filter.search === '' ||
      emp.name.toLowerCase().includes(filter.search.toLowerCase()) ||
      emp.email.toLowerCase().includes(filter.search.toLowerCase()) ||
      emp.employee_code?.toLowerCase().includes(filter.search.toLowerCase());

    const matchesCompany = filter.company_id === '' || String(emp.company_id) === String(filter.company_id);
    const matchesRole = filter.role === '' || emp.role === filter.role;
    const matchesDept = filter.department_id === '' || String(emp.department_id) === String(filter.department_id);
    const matchesStatus = filter.status === '' || emp.status === filter.status;

    return matchesSearch && matchesCompany && matchesRole && matchesDept && matchesStatus;
  });

  useEffect(() => {
    // When filters change, reset to the first page.
    setPage(0);
  }, [filter.search, filter.company_id, filter.role, filter.department_id, filter.status, employees.length]);

  useEffect(() => {
    // If company changes, reset department filter (avoid mismatched department ids)
    if (!isSuperAdmin) return;
    if (!filter.company_id) return;
    if (!filter.department_id) return;
    const ok = departmentOptions.some((d) => String(d.id) === String(filter.department_id));
    if (!ok) {
      setFilter((prev) => ({ ...prev, department_id: '' }));
    }
  }, [filter.company_id, filter.department_id, isSuperAdmin, departmentOptions.length]);

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    // Prefer created_at when available; fallback to id.
    const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
    if (ta && tb && ta !== tb) return tb - ta;
    return (Number(b?.id) || 0) - (Number(a?.id) || 0);
  });

  const totalRows = sortedEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const startIndex = safePage * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalRows);
  const paginatedEmployees = sortedEmployees.slice(startIndex, endIndex);

  // Calculate Statistics
  const stats = {
    total: baseEmployees.length,
    active: baseEmployees.filter(e => e.status === 'active').length,
    inactive: baseEmployees.filter(e => e.status === 'inactive').length,
    departments: new Set(baseEmployees.filter(e => e.department_id).map(e => e.department_id)).size
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
        <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-6 gap-4">
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

          {isSuperAdmin && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">By Company</label>
              <select
                value={filter.company_id}
                onChange={(e) => handleFilterChange('company_id', e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || `Company #${c.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {departmentOptions.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                  {isSuperAdmin && !filter.company_id && dept.company_id ? ` (${companyMap.get(String(dept.company_id)) || `Company #${dept.company_id}`})` : ''}
                </option>
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
              ) : totalRows === 0 ? (
                <tr><td colSpan="9" className="px-6 py-12 text-center text-gray-400">No employees match your filters</td></tr>
              ) : (
                paginatedEmployees.map((emp, index) => (
                  <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-4 py-4 text-xs font-bold text-gray-400">
                      {(startIndex + index + 1).toString().padStart(2, '0')}
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
                      <span className="text-xs text-gray-600">{emp.designation_name || emp.designation || 'Staff'}</span>
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
                        {canToggleStatus && (
                          <button
                            onClick={() => handleToggleStatus(emp)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${emp.status === 'active'
                                ? 'text-red-600 bg-red-50 hover:bg-red-100'
                                : 'text-green-600 bg-green-50 hover:bg-green-100'
                              }`}
                            title={emp.status === 'active' ? 'Deactivate Employee' : 'Activate Employee'}
                          >
                            <i className={`fas ${emp.status === 'active' ? 'fa-user-slash' : 'fa-user-check'} text-sm`}></i>
                          </button>
                        )}
                        {canResetPassword && (
                          <button
                            onClick={() => handleResetPassword(emp)}
                            className="w-8 h-8 flex items-center justify-center text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all"
                            title="Reset Password"
                          >
                            <i className="fas fa-key text-sm"></i>
                          </button>
                        )}
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

        {!loading && totalRows > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-white">
            <div className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{startIndex + 1}</span>-<span className="font-semibold text-gray-700">{endIndex}</span> of{' '}
              <span className="font-semibold text-gray-700">{totalRows}</span>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="text-xs text-gray-500">
                Page <span className="font-semibold text-gray-700">{safePage + 1}</span> / <span className="font-semibold text-gray-700">{totalPages}</span>
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className={`${modalContentInsetClass} bg-gray-900/35 flex items-center justify-center z-[100] p-4`}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
            {/* Professional Header */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 border-b border-blue-500 flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                    {editingEmployee ? 'Update Employee Profile' : 'Register New Employee'}
                  </h1>
                  <p className="text-blue-100 text-sm">
                    {editingEmployee ? 'Modify employee information and settings' : 'Complete employee onboarding with all required details'}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all border border-white/20 shadow-lg hover:shadow-xl self-start sm:self-auto"
                  title="Close"
                >
                  <i className="fas fa-times text-base sm:text-lg"></i>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
              <form id="employeeForm" onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">

                {/* Personal Information Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
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
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <i className="fas fa-briefcase"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Employment Details</h3>
                      <p className="text-sm text-gray-500">Position, department, and role information</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {isSuperAdmin && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Company <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.company_id}
                          onChange={(e) => setFormData({ ...formData, company_id: e.target.value, department_id: '', employee_code: '' })}
                          required
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        >
                          <option value="">Select Company</option>
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.company_name}{company.company_code ? ` (${company.company_code})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className={isSuperAdmin ? '' : 'md:col-span-2'}>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Employee Code
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={codeLoading ? 'Generating...' : formData.employee_code}
                        className="w-full px-4 py-3 bg-gradient-to-r from-slate-950 to-blue-950 border border-blue-300/60 rounded-lg outline-none transition-all text-sm font-mono font-bold tracking-wider text-white shadow-inner cursor-not-allowed"
                        placeholder="Auto generated employee code"
                      />
                      {codeError && <p className="mt-2 text-xs font-semibold text-red-600">{codeError}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Job Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => {
                          const nextRole = e.target.value;
                          setFormData((prev) => {
                            const next = { ...prev, role: nextRole };
                            if (prev.access_template !== 'custom') {
                              const templateKey = prev.access_template || 'default';
                              next.access_modules = getTemplateModules(templateKey, nextRole);
                            }
                            return next;
                          });
                        }}
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
                        Department <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData({ ...formData, department_id: e.target.value, employee_code: '' })}
                        required
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      >
                        <option value="">Select Department</option>
                        {formDepartmentOptions.map(dept => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}{dept.department_code ? ` (${dept.department_code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Job Designation <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.designation_id}
                        onChange={(e) => {
                          const selected = designations.find((item) => String(item.id) === String(e.target.value));
                          setFormData({
                            ...formData,
                            designation_id: e.target.value,
                            designation: selected?.name || '',
                            employee_code: '',
                          });
                        }}
                        required
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      >
                        <option value="">Select Designation</option>
                        {designations.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}{item.designation_code ? ` (${item.designation_code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Joining Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.joining_date}
                        onChange={(e) => setFormData({ ...formData, joining_date: e.target.value, employee_code: '' })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-bold text-gray-900">Module Access</p>
                            <p className="text-xs text-gray-500">Select what this employee can access after login</p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <select
                              value={formData.access_template}
                              onChange={(e) => {
                                const templateKey = e.target.value;
                                setFormData((prev) => {
                                  const next = { ...prev, access_template: templateKey };
                                  if (templateKey !== 'custom') {
                                    next.access_modules = getTemplateModules(templateKey, prev.role);
                                  }
                                  return next;
                                });
                              }}
                              className="w-full sm:w-64 px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                            >
                              <option value="default">Default (Based on Role)</option>
                              <option value="crm_only">CRM Only</option>
                              <option value="hrms_only">HRMS Only</option>
                              <option value="minimal">Minimal (Calendar/Chat)</option>
                              <option value="custom">Custom</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  access_template: 'custom',
                                  access_modules: [],
                                }));
                              }}
                              className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                              title="Clear selections"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {formData.access_template === 'custom' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {ACCESS_MODULES.map((m) => {
                              const checked = Array.isArray(formData.access_modules) && formData.access_modules.includes(m.key);
                              return (
                                <label
                                  key={m.key}
                                  className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const on = e.target.checked;
                                      setFormData((prev) => {
                                        const current = Array.isArray(prev.access_modules) ? prev.access_modules : [];
                                        const nextModules = on
                                          ? Array.from(new Set([...current, m.key]))
                                          : current.filter((x) => x !== m.key);
                                        return { ...prev, access_modules: nextModules };
                                      });
                                    }}
                                    className="h-4 w-4"
                                  />
                                  <span className="text-sm text-gray-700">{m.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(formData.access_modules || []).slice(0, 50).map((k) => {
                              const label = ACCESS_MODULES.find((m) => m.key === k)?.label || k;
                              return (
                                <span key={k} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {formData.access_template === 'custom' && (formData.access_modules || []).length === 0 ? (
                          <p className="text-xs text-amber-700 mt-3">
                            If you keep this empty, the employee will see only basic pages (Dashboard/Calendar may still show depending on navigation).
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Details Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
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
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center">
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
            <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
              <div className="text-xs sm:text-sm text-gray-500">
                <i className="fas fa-info-circle mr-2"></i>
                All fields marked with <span className="text-red-500">*</span> are required
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <i className="fas fa-times mr-2"></i>
                  Cancel
                </button>
                <button
                  form="employeeForm"
                  type="submit"
                  className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold text-sm shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all active:scale-95 flex items-center justify-center"
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
        <div className={`${modalContentInsetClass} bg-gray-900/35 flex items-center justify-center z-[110] p-4`}>
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
                        <span className="text-[10px] text-gray-500 font-medium">Employee Code</span>
                        <span className="text-xs text-blue-700 font-mono font-bold">{selectedEmployee.employee_code || 'N/A'}</span>
                      </div>
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
                        <span className="text-xs text-gray-900 font-semibold">{selectedEmployee.designation_name || selectedEmployee.designation || 'N/A'}</span>
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
