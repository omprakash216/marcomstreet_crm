import { useState, useEffect } from 'react';
import api from '../utils/api';
import axios from 'axios';

export default function CompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true); // Start with true to show loading state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [viewingCompany, setViewingCompany] = useState(null);
  const [companyHistory, setCompanyHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    date_filter: '', // today, week, month, custom
    date_from: '',
    date_to: '',
    status: '', // active, inactive
  });
  
  const [formData, setFormData] = useState({
    company_name: '',
    email: '',
    phone: '',
    password: '',
    client_code: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zip_code: '',
    website: '',
    tax_id: '',
    registration_number: '',
    status: 'active',
  });

  useEffect(() => {
    // Always fetch companies on component mount
    console.log('CompanyManagement: Component mounted, fetching companies...');
    fetchCompanies();
  }, []);

  useEffect(() => {
    // Refetch when filters change
    fetchCompanies();
  }, [filters]);

  const fetchCompanyHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await api.get('/companies/history?limit=100');
      if (response.data.success) {
        setCompanyHistory(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching company history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showHistory) {
      fetchCompanyHistory();
    }
  }, [showHistory]);

  const fetchCompanies = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setCompanies([]);
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      // Search filter
      if (filters.search) {
        params.append('search', filters.search);
      }
      
      // Status filter
      if (filters.status) {
        params.append('status', filters.status);
      }
      
      // Date filtering
      if (filters.date_filter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        params.append('date_from', today);
        params.append('date_to', today);
      } else if (filters.date_filter === 'week') {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
        params.append('date_from', weekStart.toISOString().split('T')[0]);
        params.append('date_to', weekEnd.toISOString().split('T')[0]);
      } else if (filters.date_filter === 'month') {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        params.append('date_from', monthStart.toISOString().split('T')[0]);
        params.append('date_to', monthEnd.toISOString().split('T')[0]);
      } else if (filters.date_filter === 'custom') {
        if (filters.date_from) {
          params.append('date_from', filters.date_from);
        }
        if (filters.date_to) {
          params.append('date_to', filters.date_to);
        }
      }
      
      const queryString = params.toString();
      const url = queryString ? `/companies?${queryString}` : '/companies';
      
      const response = await api.get(url);
      
      if (response.data.success) {
        let companiesData = Array.isArray(response.data.data) ? response.data.data : [];
        
        // Client-side filtering
        // Date filtering
        if (filters.date_from || filters.date_to) {
          companiesData = companiesData.filter(company => {
            const createdDate = new Date(company.created_at).toISOString().split('T')[0];
            if (filters.date_from && createdDate < filters.date_from) return false;
            if (filters.date_to && createdDate > filters.date_to) return false;
            return true;
          });
        }
        
        // Search filtering
        if (filters.search) {
          const searchTerm = filters.search.toLowerCase();
          companiesData = companiesData.filter(company => {
            return (
              (company.company_name && company.company_name.toLowerCase().includes(searchTerm)) ||
              (company.email && company.email.toLowerCase().includes(searchTerm)) ||
              (company.company_code && company.company_code.toLowerCase().includes(searchTerm)) ||
              (company.client_code && company.client_code.toLowerCase().includes(searchTerm)) ||
              (company.phone && company.phone.includes(searchTerm))
            );
          });
        }
        
        // Status filtering (if not already filtered by backend)
        if (filters.status && !params.has('status')) {
          companiesData = companiesData.filter(company => company.status === filters.status);
        }
        
        setCompanies(companiesData);
      } else {
        setError(response.data.message || 'Failed to load companies');
      }
    } catch (err) {
      // Only log unexpected errors
      if (err.response?.status !== 401 && err.code !== 'ERR_NETWORK') {
        console.error('Error fetching companies:', err);
        if (err.response) {
          setError(err.response.data?.message || 'Failed to load companies. Please check if backend is running.');
        } else {
          setError('Cannot connect to server. Please check if XAMPP/Apache is running.');
        }
      }
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingCompany) {
        // Update existing company
        const response = await api.put('/companies/update', {
          id: editingCompany.id,
          ...formData,
        });
        
        if (response.data.success) {
          setSuccess('Company updated successfully!');
          setShowForm(false);
          setEditingCompany(null);
          resetForm();
          fetchCompanies();
          // Refresh history if it's being shown
          if (showHistory) {
            fetchCompanyHistory();
          }
        } else {
          setError(response.data.message || 'Update failed');
        }
      } else {
        // Create new company - don't send client_code, let backend auto-generate
        const createData = { ...formData };
        // Remove client_code from create data - backend will auto-generate it
        delete createData.client_code;
        
        const response = await api.post('/companies', createData);
        
        if (response.data.success) {
          setSuccess('Company created successfully! Company Code and Client Code have been auto-generated.');
          setShowForm(false);
          resetForm();
          fetchCompanies();
          // Refresh history if it's being shown
          if (showHistory) {
            fetchCompanyHistory();
          }
        } else {
          setError(response.data.message || 'Creation failed');
        }
      }
    } catch (err) {
      console.error('Error saving company:', err);
      if (err.response) {
        setError(err.response.data?.message || 'Operation failed');
      } else {
        setError('Cannot connect to server');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      company_name: company.company_name || '',
      email: company.email || '',
      phone: company.phone || '',
      password: '', // Don't show password
      client_code: company.client_code || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      country: company.country || '',
      zip_code: company.zip_code || '',
      website: company.website || '',
      tax_id: company.tax_id || '',
      registration_number: company.registration_number || '',
      status: company.status || 'active',
    });
    setShowForm(true);
    setViewingCompany(null);
  };

  const handleView = (company) => {
    setViewingCompany(company);
    setEditingCompany(null);
    setShowForm(false);
  };

  const handleLogin = async (company) => {
    try {
      // Use axios directly for company login (no employee auth needed)
      const response = await axios.post('/api/companies/login', {
        company_id: company.id,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.data.success) {
        // Store company data
        localStorage.setItem('company', JSON.stringify(response.data.data.company));
        localStorage.setItem('company_token', response.data.data.token);
        
        setSuccess(`Successfully logged in as ${company.company_name}. Redirecting...`);
        
        // Redirect to company details page after short delay
        setTimeout(() => {
          window.location.href = '/company/details';
        }, 1000);
      } else {
        setError('Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      email: '',
      phone: '',
      password: '',
      client_code: '',
      address: '',
      city: '',
      state: '',
      country: '',
      zip_code: '',
      website: '',
      tax_id: '',
      registration_number: '',
      status: 'active',
    });
    setEditingCompany(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCompany(null);
    setViewingCompany(null);
    resetForm();
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      date_filter: '',
      date_from: '',
      date_to: '',
      status: '',
    });
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              
              {/* Title and Description */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-1">Company Management</h1>
                <p className="text-slate-300 text-sm">Create, manage, and view all companies</p>
              </div>
            </div>
            
            {/* Right Side - Action Button */}
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl hover:bg-slate-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Company</span>
            </button>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search by name, email, code..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={filters.date_filter}
              onChange={(e) => handleFilterChange('date_filter', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {filters.date_filter === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingCompany ? 'Edit Company' : 'Create New Company'}
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {editingCompany && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Company Code (Read Only)
                    </label>
                    <input
                      type="text"
                      value={editingCompany.company_code || ''}
                      disabled
                      className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Company code cannot be changed</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Client Code (Editable)
                    </label>
                    <input
                      type="text"
                      value={formData.client_code}
                      onChange={(e) => setFormData({ ...formData, client_code: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Enter client code"
                    />
                  </div>
                </>
              )}
              
              {!editingCompany && (
                <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Company Code and Client Code will be auto-generated when you create the company.
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              
              {!editingCompany && (
                <div>
                  <label className="block text-sm font-medium mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Zip Code</label>
                <input
                  type="text"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Tax ID</label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Registration Number</label>
                <input
                  type="text"
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              
              {editingCompany && (
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingCompany ? 'Update Company' : 'Create Company'}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewingCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Company Details</h2>
              <button
                onClick={() => setViewingCompany(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Company Code</label>
                <p className="text-lg font-semibold">{viewingCompany.company_code}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Client Code</label>
                <p className="text-lg font-semibold">{viewingCompany.client_code}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Company Name</label>
                <p className="text-lg">{viewingCompany.company_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-lg">{viewingCompany.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="text-lg">{viewingCompany.phone}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <p className={`text-lg font-semibold ${viewingCompany.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                  {viewingCompany.status}
                </p>
              </div>
              {viewingCompany.address && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <p className="text-lg">{viewingCompany.address}</p>
                </div>
              )}
              {viewingCompany.city && (
                <div>
                  <label className="text-sm font-medium text-gray-500">City</label>
                  <p className="text-lg">{viewingCompany.city}</p>
                </div>
              )}
              {viewingCompany.state && (
                <div>
                  <label className="text-sm font-medium text-gray-500">State</label>
                  <p className="text-lg">{viewingCompany.state}</p>
                </div>
              )}
              {viewingCompany.country && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Country</label>
                  <p className="text-lg">{viewingCompany.country}</p>
                </div>
              )}
              {viewingCompany.website && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Website</label>
                  <p className="text-lg">{viewingCompany.website}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Created At</label>
                <p className="text-lg">{new Date(viewingCompany.created_at).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setViewingCompany(null);
                  handleEdit(viewingCompany);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit
              </button>
              <button
                onClick={() => setViewingCompany(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Companies List - Always Visible */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Companies List</h2>
          <p className="text-sm text-gray-600 mt-1">Manage all companies and their details</p>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading companies...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No companies</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new company.</p>
            <div className="mt-6">
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Company
              </button>
            </div>
          </div>
        ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SL No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companies.map((company, index) => (
                    <tr key={company.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-center font-medium text-gray-600">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{company.company_code}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{company.client_code}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{company.company_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{company.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{company.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          company.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {company.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleView(company)}
                            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEdit(company)}
                            className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleLogin(company)}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                          >
                            Login
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {/* Company History Section */}
      {showHistory && (
        <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-xl font-bold text-gray-800">Company Activity History</h2>
            <p className="text-sm text-gray-600 mt-1">Track all company creation and update activities</p>
          </div>
          
          {loadingHistory ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading history...</p>
            </div>
          ) : companyHistory.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No activity history</h3>
              <p className="mt-1 text-sm text-gray-500">Company activities will appear here once companies are created or updated.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companyHistory.map((activity) => (
                    <tr key={activity.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(activity.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          activity.activity_type === 'company_created' 
                            ? 'bg-green-100 text-green-800' 
                            : activity.activity_type === 'company_updated'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {activity.activity_type === 'company_created' ? 'Created' : 
                           activity.activity_type === 'company_updated' ? 'Updated' : 
                           activity.activity_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{activity.company_name || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{activity.company_code || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {activity.description || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{activity.employee_name || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{activity.employee_code || 'N/A'}</p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

