import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', description: '' });
  const [editingDept, setEditingDept] = useState(null);
  const [viewDept, setViewDept] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all'); // all | with | empty
  const [sortBy, setSortBy] = useState('name_asc'); // name_asc | name_desc | employees_desc | employees_asc | newest | oldest
  const [companyFilter, setCompanyFilter] = useState(''); // company_id for superadmin only
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const navigate = useNavigate();
  const employee = getEmployee();
  const role = normalizeRole(employee?.role);
  const isSuper = role === 'superadmin' || role === 'super_admin';

  useEffect(() => {
    if (!employee || (role !== 'admin' && role !== 'superadmin' && role !== 'super_admin')) {
      navigate('/login');
      return;
    }

    fetchDepartments();
    if (isSuper) fetchCompanies();
  }, [navigate]);

  useEffect(() => {
    setPage(1);
  }, [filterText, employeeFilter, sortBy, companyFilter]);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      if (response.data.success) {
        setDepartments(Array.isArray(response.data.data) ? response.data.data : []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const resp = await api.get('/admin/companies');
      if (resp.data?.success) {
        setCompanies(Array.isArray(resp.data.data) ? resp.data.data : []);
      }
    } catch (_) {
      setCompanies([]);
    }
  };

  const handleAddDept = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newDept };
      const response = editingDept
        ? await api.put(`/departments/${editingDept.id}`, payload)
        : await api.post('/departments', payload);
      if (response.data.success) {
        alert(editingDept ? 'Department updated successfully!' : 'Department added successfully!');
        setShowAddModal(false);
        setNewDept({ name: '', description: '' });
        setEditingDept(null);
        fetchDepartments();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save department');
    }
  };

  const handleDelete = async (dept) => {
    if (!dept?.id) return;
    const ok = window.confirm(`Delete department "${dept.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/departments/${dept.id}`);
      fetchDepartments();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete department');
    }
  };

  const filteredDepartments = (() => {
    const q = filterText.trim().toLowerCase();

    const filtered = departments.filter((d) => {
      if (isSuper && companyFilter) {
        const cid = Number(companyFilter);
        if (Number.isFinite(cid) && Number(d.company_id) !== cid) return false;
      }

      const employeeCount = Number(d.employee_count ?? 0) || 0;
      if (employeeFilter === 'with' && employeeCount <= 0) return false;
      if (employeeFilter === 'empty' && employeeCount > 0) return false;

      if (!q) return true;
      return (
        String(d.name || '').toLowerCase().includes(q) ||
        String(d.description || '').toLowerCase().includes(q) ||
        String(d.id || '').includes(q)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      const an = String(a?.name || '').toLowerCase();
      const bn = String(b?.name || '').toLowerCase();
      const ae = Number(a?.employee_count ?? 0) || 0;
      const be = Number(b?.employee_count ?? 0) || 0;
      const aid = Number(a?.id ?? 0) || 0;
      const bid = Number(b?.id ?? 0) || 0;

      if (sortBy === 'name_desc') return bn.localeCompare(an);
      if (sortBy === 'employees_desc') return be - ae || an.localeCompare(bn);
      if (sortBy === 'employees_asc') return ae - be || an.localeCompare(bn);
      if (sortBy === 'newest') return bid - aid || an.localeCompare(bn);
      if (sortBy === 'oldest') return aid - bid || an.localeCompare(bn);
      return an.localeCompare(bn);
    });

    return sorted;
  })();

  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filteredDepartments.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [safePage, page]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
              <i className="fas fa-sitemap text-gray-700 text-xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Department Management</h1>
              <p className="text-gray-500 text-sm">Create and manage company departments</p>
              <div className="mt-2 inline-flex items-center text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                {filteredDepartments.length} Departments
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => fetchDepartments()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingDept(null);
                setNewDept({ name: '', description: '' });
                setShowAddModal(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              title="Add Department"
            >
              <i className="fas fa-plus"></i>
              Add Department
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <i className="fas fa-search"></i>
            </span>
            <input
              type="text"
              placeholder="Search name, description, ID..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="min-w-[160px] border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Employees filter"
          >
            <option value="all">All</option>
            <option value="with">With Employees</option>
            <option value="empty">Empty</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="min-w-[190px] border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Sort"
          >
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="employees_desc">Employees (High–Low)</option>
            <option value="employees_asc">Employees (Low–High)</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>

          {isSuper ? (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="min-w-[220px] border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Company"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || `Company #${c.id}`}
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setFilterText('');
              setEmployeeFilter('all');
              setSortBy('name_asc');
              setCompanyFilter('');
            }}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
            title="Clear filters"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">SL</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Employees</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500 text-sm">Loading departments...</td>
              </tr>
            ) : filteredDepartments.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500 text-sm">No departments found.</td>
              </tr>
            ) : (
              pageRows.map((dept, idx) => (
                <tr key={dept.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{startIndex + idx + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                        <i className="fas fa-sitemap text-lg"></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{dept.name}</p>
                        <p className="text-xs text-gray-500">ID: {dept.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {dept.description || 'No description provided.'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                    <span className="inline-flex items-center bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                      {dept.employee_count ?? 0} Employees
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                    <button
                      className="text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100"
                      title="View"
                      onClick={() => {
                        setViewDept(dept);
                        setShowViewModal(true);
                      }}
                    >
                      <i className="fas fa-eye"></i>
                    </button>
                    <button
                      className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50"
                      title="Edit"
                      onClick={() => {
                        setEditingDept(dept);
                        setNewDept({ name: dept.name || '', description: dept.description || '' });
                        setShowAddModal(true);
                      }}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50"
                      title="Delete"
                      onClick={() => handleDelete(dept)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredDepartments.length > 0 ? (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-600">
            Page <span className="font-semibold">{safePage}</span> of <span className="font-semibold">{totalPages}</span> · Showing{' '}
            <span className="font-semibold">{startIndex + 1}</span>–
            <span className="font-semibold">{Math.min(startIndex + pageRows.length, filteredDepartments.length)}</span> of{' '}
            <span className="font-semibold">{filteredDepartments.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={safePage >= totalPages}
              className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{editingDept ? 'Edit Department' : 'Add New Department'}</h2>
            <form onSubmit={handleAddDept} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Department Name</label>
                <input
                  type="text"
                  required
                  value={newDept.name}
                  onChange={(e) => setNewDept({...newDept, name: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g. Creative Design"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows="3"
                  value={newDept.description}
                  onChange={(e) => setNewDept({...newDept, description: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Brief description of the department..."
                ></textarea>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md"
                >
                  {editingDept ? 'Update Department' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && viewDept && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Department Details</h2>
              <button onClick={() => setShowViewModal(false)} className="text-gray-500 hover:text-gray-800">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="space-y-3 text-sm text-gray-800">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">Name:</span>
                <span>{viewDept.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">ID:</span>
                <span>{viewDept.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-600">Employees:</span>
                <span>{viewDept.employee_count ?? 0}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-600 block mb-1">Description:</span>
                <p className="text-gray-700 whitespace-pre-line">{viewDept.description || 'No description provided.'}</p>
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

