import { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import api from '../../utils/api';

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'prospect', label: 'Prospect' },
];

const pageSizeOptions = [10, 25, 50];

const emptyClientForm = {
  full_name: '',
  company_name: '',
  phone_number: '',
  email: '',
  address: '',
  city: '',
  state: '',
  postal_code: '',
  aadhar_number: '',
  pan_number: '',
  gst_number: '',
  status: 'active',
};

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRows, setTotalRows] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [filter, setFilter] = useState({
    search: '',
    status: '',
  });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState(emptyClientForm);
  const [formError, setFormError] = useState('');

  const normalizedClients = useMemo(() => clients.map(normalizeClientRow), [clients]);

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = totalRows > 0 ? (safePage - 1) * pageSize : 0;
  const endIndex = totalRows > 0 ? Math.min(startIndex + normalizedClients.length, totalRows) : 0;

  const activeCount = normalizedClients.filter((client) => client.statusKey === 'active').length;
  const inactiveCount = normalizedClients.filter((client) => client.statusKey === 'inactive').length;
  const prospectCount = normalizedClients.filter((client) => client.statusKey === 'prospect').length;

  useEffect(() => {
    fetchClients();
  }, [filter, page, pageSize]);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const buildParams = (overrides = {}) => {
    const currentFilter = overrides.filter || filter;
    const nextPage = overrides.page ?? page;
    const nextPageSize = overrides.limit ?? pageSize;
    const params = {
      page: nextPage,
      limit: nextPageSize,
    };

    if (currentFilter.search.trim()) {
      params.search = currentFilter.search.trim();
    }
    if (currentFilter.status) {
      params.status = currentFilter.status;
    }

    return params;
  };

  const fetchClients = async (overrides = {}) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/clients', { params: buildParams(overrides) });
      if (!response.data?.success) {
        setClients([]);
        setTotalRows(0);
        setHasNextPage(false);
        setError(response.data?.message || 'Clients could not be loaded');
        return;
      }

      const rows = Array.isArray(response.data.data) ? response.data.data : [];
      setClients(rows);
      setTotalRows(Number(response.data.total || 0));
      setHasNextPage(Boolean(response.data.has_next));
    } catch (err) {
      setClients([]);
      setTotalRows(0);
      setHasNextPage(false);
      setError(err.response?.data?.message || 'Clients could not be loaded');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setPage(1);
    setFilter((current) => ({ ...current, [field]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilter({
      search: '',
      status: '',
    });
  };

  const openAddClient = () => {
    setEditingClient(null);
    setFormData(emptyClientForm);
    setFormError('');
    setShowFormModal(true);
  };

  const openEditClient = (client) => {
    setEditingClient(client);
    setFormData(clientToForm(client));
    setFormError('');
    setShowFormModal(true);
  };

  const openClientDetails = (client) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingClient(null);
    setFormData(emptyClientForm);
    setFormError('');
  };

  const saveClient = async (event) => {
    event.preventDefault();
    const validationError = validateClientForm(formData);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError('');
    setSaving(true);
    try {
      const payload = buildClientPayload(formData);
      const nextPage = editingClient ? page : 1;

      const response = editingClient
        ? await api.put(`/clients/${editingClient.id}`, payload)
        : await api.post('/clients', payload);

      if (response.data?.success) {
        window.alert(editingClient ? 'Client updated successfully!' : 'Client created successfully!');
        closeFormModal();
        setPage(nextPage);
        await fetchClients({ page: nextPage });
      } else {
        window.alert(response.data?.message || 'Could not save client');
      }
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not save client');
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async (client) => {
    const label = client.displayName || client.clientCode || `Client #${client.id}`;
    const confirmed = window.confirm(`Delete ${label}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(client.id);
    try {
      const response = await api.delete(`/clients/${client.id}`);
      if (response.data?.success) {
        window.alert('Client deleted successfully!');
        if (selectedClient?.id === client.id) {
          setShowDetailsModal(false);
          setSelectedClient(null);
        }
        await fetchClients({ page });
      } else {
        window.alert(response.data?.message || 'Could not delete client');
      }
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not delete client');
    } finally {
      setDeletingId(null);
    }
  };

  const exportClients = async () => {
    setExporting(true);
    try {
      const response = await api.get('/clients', {
        params: {
          ...buildParams({ page: 1, limit: 1000 }),
          page: 1,
          limit: 1000,
        },
      });
      const rows = Array.isArray(response.data?.data) ? response.data.data.map(normalizeClientRow) : [];

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Clients');
      sheet.columns = [
        { header: 'Client Code', key: 'client_code', width: 16 },
        { header: 'Full Name', key: 'full_name', width: 24 },
        { header: 'Company', key: 'company_name', width: 24 },
        { header: 'Phone', key: 'phone_number', width: 16 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'City', key: 'city', width: 16 },
        { header: 'State', key: 'state', width: 16 },
        { header: 'Postal Code', key: 'postal_code', width: 14 },
        { header: 'PAN', key: 'pan_number', width: 14 },
        { header: 'GST', key: 'gst_number', width: 18 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Created By', key: 'created_by_name', width: 20 },
        { header: 'Created At', key: 'created_at', width: 20 },
        { header: 'Updated At', key: 'updated_at', width: 20 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8EEF9' },
      };

      rows.forEach((client) => {
        sheet.addRow({
          client_code: client.clientCode,
          full_name: client.displayName,
          company_name: client.companyName,
          phone_number: client.phoneNumber,
          email: client.email,
          city: client.city,
          state: client.state,
          postal_code: client.postalCode,
          pan_number: client.panNumber,
          gst_number: client.gstNumber,
          status: client.statusLabel,
          created_by_name: client.createdByName,
          created_at: client.createdAt,
          updated_at: client.updatedAt,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clients-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not export clients');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!showFormModal) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeFormModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showFormModal]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-slate-800 p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <i className="fas fa-user-friends text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Clients</h1>
              <p className="mt-1 text-sm text-slate-300">Create, manage, and track saved client records</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fetchClients()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
            >
              <i className="fas fa-sync-alt"></i>
              Refresh
            </button>
            <button
              type="button"
              onClick={exportClients}
              disabled={exporting || loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className={exporting ? 'fas fa-spinner fa-spin' : 'fas fa-file-excel'}></i>
              Export Excel
            </button>
            <button
              type="button"
              onClick={openAddClient}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-blue-700 hover:bg-blue-50"
            >
              <i className="fas fa-user-plus"></i>
              Add New Client
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Clients" value={totalRows} icon="fa-address-book" tone="blue" />
        <StatCard label="Active" value={activeCount} icon="fa-circle-check" tone="green" />
        <StatCard label="Inactive" value={inactiveCount} icon="fa-ban" tone="slate" />
        <StatCard label="Prospect" value={prospectCount} icon="fa-bullseye" tone="amber" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Search</label>
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                value={filter.search}
                onChange={(event) => handleFilterChange('search', event.target.value)}
                placeholder="Search client, company, email, phone, PAN, GST"
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Status</label>
            <select
              value={filter.status}
              onChange={(event) => handleFilterChange('status', event.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">All Statuses</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1240px] w-full text-left">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200 text-xs font-black uppercase tracking-wider text-gray-500">
                <th className="w-20 px-5 py-4">SL No</th>
                <th className="px-5 py-4">Client</th>
                <th className="px-5 py-4">Contact</th>
                <th className="px-5 py-4">Location</th>
                <th className="px-5 py-4">Tax / KYC</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Created</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-5 py-14 text-center text-sm font-semibold text-gray-400">
                    Loading clients...
                  </td>
                </tr>
              ) : normalizedClients.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-5 py-14 text-center text-sm font-semibold text-gray-400">
                    No clients found matching your filters.
                  </td>
                </tr>
              ) : (
                normalizedClients.map((client, index) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm font-black text-gray-600">{startIndex + index + 1}</td>
                    <td className="px-5 py-4">
                      <div className="max-w-[260px] truncate text-sm font-black text-gray-900">{client.displayName}</div>
                      <div className="text-xs font-semibold text-gray-500">{client.companyName}</div>
                      <div className="text-xs font-mono text-gray-400">{client.clientCode}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-gray-700">{client.email}</div>
                      <div className="text-xs text-gray-500">{client.phoneNumber}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-gray-800">{client.location}</div>
                      <div className="text-xs text-gray-500">{client.postalCode}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1 text-xs font-semibold text-gray-600">
                        <div>PAN: <span className="font-mono text-gray-800">{client.panNumber}</span></div>
                        <div>GST: <span className="font-mono text-gray-800">{client.gstNumber}</span></div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${getStatusColor(client.statusKey)}`}>
                        {client.statusLabel}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-gray-800">{client.createdAt}</div>
                      <div className="text-xs text-gray-500">{client.createdByName}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-nowrap items-center justify-end gap-2">
                        <IconButton title="View Details" icon="fa-eye" tone="blue" onClick={() => openClientDetails(client)} />
                        <IconButton title="Edit Client" icon="fa-pen" tone="amber" onClick={() => openEditClient(client)} />
                        <IconButton
                          title="Delete Client"
                          icon={deletingId === client.id ? 'fa-spinner fa-spin' : 'fa-trash'}
                          tone="red"
                          onClick={() => deleteClient(client)}
                          disabled={deletingId === client.id}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalRows > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-100 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 text-sm text-gray-500 sm:flex-row sm:items-center">
              <span>
                Showing <span className="font-semibold text-gray-700">{startIndex + 1}</span>-
                <span className="font-semibold text-gray-700">{endIndex}</span> of{' '}
                <span className="font-semibold text-gray-700">{totalRows}</span>
              </span>
              <label className="inline-flex items-center gap-2 font-semibold text-gray-600">
                Rows
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPage(1);
                    setPageSize(Number(event.target.value));
                  }}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm font-bold text-gray-700 outline-none focus:border-blue-500"
                >
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="fas fa-chevron-left text-[10px]"></i>
                Previous
              </button>
              <div className="min-w-[92px] text-center text-sm text-gray-500">
                Page <span className="font-semibold text-gray-700">{safePage}</span> /{' '}
                <span className="font-semibold text-gray-700">{totalPages}</span>
              </div>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={!hasNextPage && safePage >= totalPages}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <i className="fas fa-chevron-right text-[10px]"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {showFormModal && (
        <ClientFormModal
          editing={Boolean(editingClient)}
          loading={saving}
          error={formError}
          formData={formData}
          onChange={(field, value) => setFormData((current) => ({ ...current, [field]: value }))}
          onClose={closeFormModal}
          onSubmit={saveClient}
        />
      )}

      {showDetailsModal && selectedClient && (
        <ClientDetailsModal
          client={selectedClient}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedClient(null);
          }}
          onEdit={() => {
            openEditClient(selectedClient);
            setShowDetailsModal(false);
          }}
        />
      )}
    </div>
  );
}

function clientToForm(client) {
  return {
    full_name: client.full_name || '',
    company_name: client.company_name || '',
    phone_number: client.phone_number || '',
    email: client.email || '',
    address: client.address || '',
    city: client.city || '',
    state: client.state || '',
    postal_code: client.postal_code || '',
    aadhar_number: cleanExistingAadhar(client.aadhar_number),
    pan_number: cleanExistingPan(client.pan_number),
    gst_number: cleanExistingGst(client.gst_number),
    status: client.statusKey || client.status || 'active',
  };
}

function buildClientPayload(formData) {
  return {
    full_name: String(formData.full_name || '').trim(),
    company_name: String(formData.company_name || '').trim() || null,
    phone_number: String(formData.phone_number || '').trim() || null,
    email: String(formData.email || '').trim() || null,
    address: String(formData.address || '').trim() || null,
    city: String(formData.city || '').trim() || null,
    state: String(formData.state || '').trim() || null,
    postal_code: String(formData.postal_code || '').trim() || null,
    aadhar_number: String(formData.aadhar_number || '').replace(/\s/g, '') || null,
    pan_number: String(formData.pan_number || '').toUpperCase().trim() || null,
    gst_number: String(formData.gst_number || '').toUpperCase().trim() || null,
    status: String(formData.status || 'active').toLowerCase().trim() || 'active',
  };
}

function validateClientForm(formData) {
  const aadhar = String(formData.aadhar_number || '').replace(/\s/g, '').trim();
  const pan = String(formData.pan_number || '').toUpperCase().trim();
  const gst = String(formData.gst_number || '').toUpperCase().trim();

  if (!String(formData.full_name || '').trim()) {
    return 'Full name is required.';
  }
  if (aadhar && !/^\d{12}$/.test(aadhar)) {
    return 'Aadhar number must be exactly 12 digits.';
  }
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
    return 'PAN number format is invalid. Example: ABCDE1234F';
  }
  if (gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(gst)) {
    return 'GST number format is invalid. Example: 29ABCDE1234F1Z5';
  }
  return '';
}

function cleanExistingAadhar(value) {
  const raw = String(value || '').replace(/\s/g, '').trim();
  return /^\d{12}$/.test(raw) ? raw : '';
}

function cleanExistingPan(value) {
  const raw = String(value || '').toUpperCase().replace(/\s/g, '').trim();
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(raw) ? raw : '';
}

function cleanExistingGst(value) {
  const raw = String(value || '').toUpperCase().replace(/\s/g, '').trim();
  return /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(raw) ? raw : '';
}

function normalizeClientRow(client) {
  const id = Number(client?.id || 0);
  const clientCode = client?.client_code || formatClientCode(id);
  const statusKey = normalizeStatus(client?.status);
  const displayName = client?.full_name || client?.company_name || clientCode || `Client #${id || '-'}`;
  const companyName = client?.company_name || '-';
  const phoneNumber = client?.phone_number || '-';
  const email = client?.email || '-';
  const city = client?.city || '-';
  const state = client?.state || '-';
  const postalCode = client?.postal_code || '-';
  const panNumber = client?.pan_number || '-';
  const gstNumber = client?.gst_number || '-';
  const createdByName = client?.created_by_name || client?.created_by_email || (client?.created_by ? `Employee ${client.created_by}` : 'System');

  return {
    ...client,
    id,
    clientCode,
    displayName,
    companyName,
    phoneNumber,
    email,
    location: [city, state].filter((part) => part && part !== '-').join(', ') || '-',
    city,
    state,
    postalCode,
    panNumber,
    gstNumber,
    createdByName,
    statusKey,
    statusLabel: getStatusLabel(statusKey),
    createdAt: formatDate(client?.created_at),
    updatedAt: formatDateTime(client?.updated_at || client?.created_at),
  };
}

function normalizeStatus(status) {
  return String(status || 'active').toLowerCase().trim() || 'active';
}

function formatClientCode(id) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return 'CL-000000';
  return `CL-${String(numericId).padStart(6, '0')}`;
}

function getStatusLabel(status) {
  return statusOptions.find((option) => option.value === status)?.label || toTitle(status);
}

function getStatusColor(status) {
  const colors = {
    active: 'border-green-200 bg-green-100 text-green-700',
    inactive: 'border-slate-200 bg-slate-100 text-slate-700',
    prospect: 'border-amber-200 bg-amber-100 text-amber-700',
  };
  return colors[status] || colors.active;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${formatDate(value)} ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

function toTitle(value) {
  return String(value || '-')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatCard({ label, value, icon, tone }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    green: 'border-green-100 bg-green-50 text-green-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wider text-gray-600">{label}</p>
        <i className={`fas ${icon}`}></i>
      </div>
      <p className="mt-3 text-2xl font-black">{Number(value || 0).toLocaleString('en-IN')}</p>
    </div>
  );
}

function IconButton({ title, icon, tone, onClick, disabled = false }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
    red: 'bg-red-50 text-red-700 hover:bg-red-100',
  };

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone] || tones.blue}`}
    >
      <i className={`fas ${icon} text-sm`}></i>
    </button>
  );
}

function ClientFormModal({ editing, loading, error, formData, onChange, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-[#1a3db8] to-[#244bd8] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <i className={`fas ${editing ? 'fa-pen' : 'fa-user-plus'} text-base`}></i>
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">{editing ? 'Edit Client' : 'Add New Client'}</h2>
              <p className="text-[11px] text-blue-200">Fill client details properly so the list stays accurate</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/25"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}
            <SectionCard title="Basic Information" icon="fa-user-circle" tone="blue">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField
                  label="Full Name"
                  required
                  value={formData.full_name}
                  onChange={(value) => onChange('full_name', value)}
                  placeholder="Client name"
                />
                <TextField
                  label="Company / Business Name"
                  value={formData.company_name}
                  onChange={(value) => onChange('company_name', value)}
                  placeholder="Company name"
                />
                <TextField
                  label="Phone Number"
                  value={formData.phone_number}
                  onChange={(value) => onChange('phone_number', value)}
                  placeholder="+91 XXXXX XXXXX"
                />
                <TextField
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={(value) => onChange('email', value)}
                  placeholder="client@example.com"
                />
                <SelectField
                  label="Status"
                  value={formData.status}
                  onChange={(value) => onChange('status', value)}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </div>
            </SectionCard>

            <SectionCard title="Address Details" icon="fa-map-marker-alt" tone="emerald">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <TextField
                    label="Street Address"
                    value={formData.address}
                    onChange={(value) => onChange('address', value)}
                    placeholder="House no, street, area, locality"
                  />
                </div>
                <TextField label="City" value={formData.city} onChange={(value) => onChange('city', value)} placeholder="City" />
                <TextField label="State" value={formData.state} onChange={(value) => onChange('state', value)} placeholder="State" />
                <TextField
                  label="Postal Code"
                  value={formData.postal_code}
                  onChange={(value) => onChange('postal_code', value)}
                  placeholder="PIN / Zip"
                />
              </div>
            </SectionCard>

            <SectionCard title="KYC & Tax Information" icon="fa-id-card" tone="amber">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <TextField
                  label="Aadhar Number"
                  value={formData.aadhar_number}
                  onChange={(value) => onChange('aadhar_number', value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="12 digits"
                />
                <TextField
                  label="PAN Number"
                  value={formData.pan_number}
                  onChange={(value) => onChange('pan_number', value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                  placeholder="ABCDE1234F"
                />
                <TextField
                  label="GST Number"
                  value={formData.gst_number}
                  onChange={(value) => onChange('gst_number', value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))}
                  placeholder="29ABCDE1234F1Z5"
                />
              </div>
            </SectionCard>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-4">
            <p className="text-[11px] text-gray-400">
              <span className="text-red-500">*</span> Full Name is required
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#244bd8] px-6 py-2 text-sm font-bold text-white shadow shadow-blue-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <i className={loading ? 'fas fa-spinner fa-spin' : 'fas fa-save'}></i>
                {loading ? 'Saving...' : editing ? 'Update Client' : 'Save Client'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClientDetailsModal({ client, onClose, onEdit }) {
  const detailItems = [
    { label: 'Client Code', value: client.clientCode },
    { label: 'Full Name', value: client.displayName },
    { label: 'Company', value: client.companyName },
    { label: 'Phone', value: client.phoneNumber },
    { label: 'Email', value: client.email },
    { label: 'Location', value: client.location },
    { label: 'Postal Code', value: client.postalCode },
    { label: 'PAN', value: client.panNumber },
    { label: 'GST', value: client.gstNumber },
    { label: 'Aadhar', value: client.aadhar_number || client.aadharNumber || '-' },
    { label: 'Status', value: client.statusLabel },
    { label: 'Created By', value: client.createdByName },
    { label: 'Created At', value: client.createdAt },
    { label: 'Updated At', value: client.updatedAt },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-900 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <i className="fas fa-user"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold">Client Details</h2>
              <p className="text-xs text-slate-300">{client.clientCode}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white hover:text-slate-200">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          {detailItems.map((item) => (
            <DetailCard key={item.label} label={item.label} value={item.value} />
          ))}
          <div className="sm:col-span-2 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-gray-500">Address</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-700">
              {client.address || 'No address saved'}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 p-4">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Edit Client
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon, tone, children }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50/40 text-blue-700',
    emerald: 'border-emerald-100 bg-emerald-50/40 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50/40 text-amber-700',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.blue}`}>
      <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
        <i className={`fas ${icon} w-4 text-center`}></i>
        {title}
      </p>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text', required = false, placeholder = '' }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-black uppercase tracking-widest text-gray-500">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-black uppercase tracking-widest text-gray-500">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {children}
      </select>
    </div>
  );
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-black uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-gray-800">{value || '-'}</p>
    </div>
  );
}
