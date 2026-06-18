import { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import api from '../utils/api';

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const sourceLabels = {
  website: 'Website',
  media: 'Media Lead',
  referral: 'Referral',
  social_media: 'Social Media',
  cold_call: 'Cold Call',
  trade_show: 'Trade Show',
  other: 'Other',
};

const pageSizeOptions = [10, 25, 50];

function createEmptyActivityForm(item = null) {
  return {
    client_name: item?.client || '',
    company_name: item?.company || '',
    activity_type: 'call',
    description: item ? `Client interaction for ${item.company || item.client}` : '',
    notes: '',
    outcome: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

export default function ClientHistory() {
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRows, setTotalRows] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState(null);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activityFormData, setActivityFormData] = useState(createEmptyActivityForm());
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const emptyClientForm = {
    full_name: '', company_name: '', phone_number: '', email: '',
    address: '', city: '', state: '', postal_code: '',
    aadhar_number: '', pan_number: '', gst_number: '', status: 'active',
  };
  const [addClientForm, setAddClientForm] = useState(emptyClientForm);
  const [addClientLoading, setAddClientLoading] = useState(false);
  const [filter, setFilter] = useState({
    search: '',
    status: '',
    date_filter: '',
    date_from: '',
    date_to: '',
  });

  const employeeNameById = useMemo(() => {
    const map = new Map();
    employees.forEach((employee) => {
      map.set(String(employee.id), employee.name || employee.email || `Employee ${employee.id}`);
    });
    return map;
  }, [employees]);

  const clients = useMemo(
    () => leads.map((lead) => mapLeadToClient(lead, employeeNameById)),
    [leads, employeeNameById]
  );

  const safePage = Math.min(Math.max(page, 1), Math.max(1, Math.ceil(totalRows / pageSize)));
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = totalRows ? Math.min(startIndex + clients.length, totalRows) : 0;
  const openCount = clients.filter((item) => !['won', 'lost'].includes(item.statusKey)).length;
  const wonCount = clients.filter((item) => item.statusKey === 'won').length;

  useEffect(() => {
    fetchClients();
  }, [filter, page, pageSize]);

  useEffect(() => {
    fetchEmployees();
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const getLeadParams = (overrides = {}) => {
    const currentFilter = overrides.filter || filter;
    const range = getDateRange(currentFilter);
    const params = {
      page: overrides.page || page,
      limit: overrides.limit || pageSize,
    };

    if (currentFilter.search.trim()) params.search = currentFilter.search.trim();
    if (currentFilter.status) params.status = currentFilter.status;
    if (range.date_from) params.date_from = range.date_from;
    if (range.date_to) params.date_to = range.date_to;

    return params;
  };

  const fetchClients = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/leads', { params: getLeadParams() });
      if (!response.data?.success) {
        setLeads([]);
        setTotalRows(0);
        setHasNextPage(false);
        setError(response.data?.message || 'Clients load nahi ho paaye');
        return;
      }

      const rows = Array.isArray(response.data.data) ? response.data.data : [];
      const hasNext = Boolean(response.data.has_next);
      const responseTotal = Number(response.data.total);
      setLeads(rows);
      setHasNextPage(hasNext);
      setTotalRows(Number.isFinite(responseTotal) ? responseTotal : startIndex + rows.length + (hasNext ? 1 : 0));
    } catch (err) {
      setLeads([]);
      setTotalRows(0);
      setHasNextPage(false);
      setError(err.response?.data?.message || 'Clients load nahi ho paaye');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (_) {
      setEmployees([]);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const response = await api.get('/chat?action=users');
      setTeamMembers(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (_) {
      setTeamMembers([]);
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
      date_filter: '',
      date_from: '',
      date_to: '',
    });
  };

  const openDetails = (item) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const openLogActivity = (item = null) => {
    setSelectedItem(item);
    setActivityFormData(createEmptyActivityForm(item));
    setShowLogModal(true);
  };

  const handleAddClient = async (event) => {
    event.preventDefault();
    setAddClientLoading(true);
    try {
      const payload = {
        full_name: String(addClientForm.full_name || '').trim(),
        company_name: String(addClientForm.company_name || '').trim() || null,
        phone_number: String(addClientForm.phone_number || '').trim() || null,
        email: String(addClientForm.email || '').trim() || null,
        address: String(addClientForm.address || '').trim() || null,
        city: String(addClientForm.city || '').trim() || null,
        state: String(addClientForm.state || '').trim() || null,
        postal_code: String(addClientForm.postal_code || '').trim() || null,
        aadhar_number: String(addClientForm.aadhar_number || '').replace(/\s/g, '') || null,
        pan_number: String(addClientForm.pan_number || '').toUpperCase().trim() || null,
        gst_number: String(addClientForm.gst_number || '').toUpperCase().trim() || null,
        status: addClientForm.status || 'active',
      };
      const response = await api.post('/clients', payload);
      if (response.data?.success) {
        alert('Client added successfully!');
        setShowAddClientModal(false);
        setAddClientForm(emptyClientForm);
        fetchClients();
      } else {
        alert('Error: ' + (response.data?.message || 'Could not add client'));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add client');
    } finally {
      setAddClientLoading(false);
    }
  };

  const handleLogActivity = async (event) => {
    event.preventDefault();
    setActionLoading(true);
    try {
      const descriptionParts = [
        `${activityFormData.client_name} (${activityFormData.company_name})`,
        activityFormData.description,
        `${activityFormData.date} ${activityFormData.time}`,
      ].filter(Boolean);

      const response = await api.post('/activities/create', {
        activity_type: activityFormData.activity_type,
        entity_type: 'lead',
        entity_id: selectedItem?.leadId || null,
        description: descriptionParts.join(' - '),
        notes: activityFormData.notes,
        outcome: activityFormData.outcome,
      });

      if (response.data?.success) {
        alert('Activity logged successfully!');
        setShowLogModal(false);
        setSelectedItem(null);
        setActivityFormData(createEmptyActivityForm());
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Activity log nahi ho paayi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const response = await api.get('/leads', { params: getLeadParams({ page: 1, limit: 500 }) });
      const exportLeads = Array.isArray(response.data?.data) ? response.data.data : leads;
      const exportRows = exportLeads.map((lead) => mapLeadToClient(lead, employeeNameById));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'MARCOM CRM';
      const sheet = workbook.addWorksheet('Clients');
      const headers = ['SL No', 'Client Name', 'Company', 'Email', 'Phone', 'Source', 'Status', 'Owner', 'Created At', 'Last Updated', 'Notes'];
      sheet.addRow(headers);
      sheet.getRow(1).font = { bold: true };

      exportRows.forEach((item, index) => {
        sheet.addRow([
          index + 1,
          item.client,
          item.company,
          item.email,
          item.phone,
          item.source,
          item.status,
          item.user,
          item.date,
          item.updatedAt,
          item.notes,
        ]);
      });

      headers.forEach((header, index) => {
        const column = sheet.getColumn(index + 1);
        const maxLength = Math.max(header.length, ...column.values.map((value) => String(value || '').length));
        column.width = Math.min(Math.max(maxLength + 2, 12), 38);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Clients_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || 'Export nahi ho paaya');
    } finally {
      setExporting(false);
    }
  };

  const handleShareToChat = async () => {
    if (!selectedTeamMember || !selectedItem) return;

    setActionLoading(true);
    try {
      const shareMessage = [
        'Client shared from CRM',
        `Client: ${selectedItem.client}`,
        `Company: ${selectedItem.company}`,
        `Email: ${selectedItem.email}`,
        `Phone: ${selectedItem.phone}`,
        `Status: ${selectedItem.status}`,
        `Owner: ${selectedItem.user}`,
        `Notes: ${selectedItem.notes || '-'}`,
      ].join('\n');

      const response = await api.post('/chat', {
        to_employee_id: selectedTeamMember.id,
        message: shareMessage,
      });

      if (response.data?.success) {
        alert(`Successfully shared with ${selectedTeamMember.name || selectedTeamMember.email}!`);
        setShowShareModal(false);
        setSelectedTeamMember(null);
        setShareSearchQuery('');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Share nahi ho paaya');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTeamMembers = teamMembers.filter((member) => {
    const term = shareSearchQuery.toLowerCase();
    return (
      String(member.name || '').toLowerCase().includes(term) ||
      String(member.email || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <i className="fas fa-user-friends text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Clients</h1>
              <p className="mt-1 text-sm text-slate-300">Real client records from leads, activity logs, and team sharing</p>
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
              onClick={() => {
                setAddClientForm(emptyClientForm);
                setShowAddClientModal(true);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-blue-700 hover:bg-blue-50"
            >
              <i className="fas fa-user-plus"></i>
              Add New Client
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting || loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className={exporting ? 'fas fa-spinner fa-spin' : 'fas fa-file-excel'}></i>
              Export Excel
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat label="Filtered Clients" value={totalRows} icon="fa-address-book" tone="blue" />
        <MiniStat label="Open On Page" value={openCount} icon="fa-folder-open" tone="amber" />
        <MiniStat label="Won On Page" value={wonCount} icon="fa-trophy" tone="green" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_170px_160px_160px_160px_auto]">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Search</label>
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                value={filter.search}
                onChange={(event) => handleFilterChange('search', event.target.value)}
                placeholder="Search client, company, email, phone"
                className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>
          <FilterSelect label="Status" value={filter.status} onChange={(value) => handleFilterChange('status', value)}>
            <option value="">All Statuses</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Date Type" value={filter.date_filter} onChange={(value) => handleFilterChange('date_filter', value)}>
            <option value="">All Dates</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </FilterSelect>
          <DateInput label="From Date" value={filter.date_from} onChange={(value) => handleFilterChange('date_from', value)} />
          <DateInput label="To Date" value={filter.date_to} onChange={(value) => handleFilterChange('date_to', value)} />
          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200 text-xs font-black uppercase tracking-wider text-gray-500">
                <th className="w-20 px-5 py-4">SL No</th>
                <th className="px-5 py-4">Client & Company</th>
                <th className="px-5 py-4">Contact</th>
                <th className="px-5 py-4">Source</th>
                <th className="px-5 py-4">Owner</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Last Activity</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-5 py-14 text-center text-sm font-semibold text-gray-400">Loading clients...</td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-5 py-14 text-center text-sm font-semibold text-gray-400">
                    No clients found matching your filters.
                  </td>
                </tr>
              ) : (
                clients.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm font-black text-gray-600">{startIndex + index + 1}</td>
                    <td className="px-5 py-4">
                      <div className="max-w-[240px] truncate text-sm font-black text-gray-900">{item.client}</div>
                      <div className="text-xs font-semibold text-gray-500">{item.company}</div>
                      <div className="text-xs text-gray-400">{item.leadCode}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-gray-700">{item.email}</div>
                      <div className="text-xs text-gray-500">{item.phone}</div>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-700">{item.source}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-700">{item.user}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${getStatusColor(item.statusKey)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-gray-800">{item.date}</div>
                      <div className="text-xs text-gray-500">{item.time}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-nowrap items-center justify-end gap-2">
                        <IconButton title="View Details" icon="fa-eye" tone="blue" onClick={() => openDetails(item)} />
                        <IconButton title="Log Activity" icon="fa-clipboard-list" tone="amber" onClick={() => openLogActivity(item)} />
                        <IconButton
                          title="Send to Team Member"
                          icon="fa-paper-plane"
                          tone="green"
                          onClick={() => {
                            setSelectedItem(item);
                            setShowShareModal(true);
                          }}
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
                Showing <span className="font-semibold text-gray-700">{startIndex + 1}</span>-<span className="font-semibold text-gray-700">{endIndex}</span> of{' '}
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
                    <option key={option} value={option}>{option}</option>
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
                Page <span className="font-semibold text-gray-700">{safePage}</span> / <span className="font-semibold text-gray-700">{totalPages}</span>
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

      {showAddClientModal && (
        <AddClientModal
          formData={addClientForm}
          loading={addClientLoading}
          onClose={() => setShowAddClientModal(false)}
          onChange={(field, value) => setAddClientForm((curr) => ({ ...curr, [field]: value }))}
          onSubmit={handleAddClient}
        />
      )}

      {showModal && selectedItem && (
        <DetailsModal item={selectedItem} onClose={() => setShowModal(false)} />
      )}

      {showLogModal && (
        <ActivityModal
          formData={activityFormData}
          loading={actionLoading}
          onClose={() => {
            setShowLogModal(false);
            setSelectedItem(null);
          }}
          onChange={(field, value) => setActivityFormData((current) => ({ ...current, [field]: value }))}
          onSubmit={handleLogActivity}
        />
      )}

      {showShareModal && selectedItem && (
        <ShareModal
          item={selectedItem}
          members={filteredTeamMembers}
          selectedMember={selectedTeamMember}
          searchQuery={shareSearchQuery}
          loading={actionLoading}
          onSearch={setShareSearchQuery}
          onSelect={setSelectedTeamMember}
          onClose={() => {
            setShowShareModal(false);
            setSelectedTeamMember(null);
            setShareSearchQuery('');
          }}
          onSubmit={handleShareToChat}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, icon, tone }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    green: 'border-green-100 bg-green-50 text-green-700',
  };

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wider text-gray-600">{label}</p>
        <i className={`fas ${icon}`}></i>
      </div>
      <p className="mt-3 text-2xl font-black">{Number(value || 0).toLocaleString('en-IN')}</p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
      >
        {children}
      </select>
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
      />
    </div>
  );
}

function IconButton({ title, icon, tone, onClick }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
  };

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${tones[tone] || tones.blue}`}
    >
      <i className={`fas ${icon} text-sm`}></i>
    </button>
  );
}

function DetailsModal({ item, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-blue-700 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
              <i className="fas fa-user"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold">Client Details</h2>
              <p className="text-xs text-blue-100">{item.leadCode}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white hover:text-blue-100">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <DetailCard icon="fa-user" label="Client" value={item.client} />
          <DetailCard icon="fa-building" label="Company" value={item.company} />
          <DetailCard icon="fa-envelope" label="Email" value={item.email} />
          <DetailCard icon="fa-phone" label="Phone" value={item.phone} />
          <DetailCard icon="fa-filter" label="Source" value={item.source} />
          <DetailCard icon="fa-user-tie" label="Owner" value={item.user} />
          <DetailCard icon="fa-calendar" label="Created" value={`${item.date} ${item.time}`} />
          <DetailCard icon="fa-clock" label="Last Updated" value={item.updatedAt} />
          <div className="sm:col-span-2 rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-amber-700">Notes</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-700">{item.notes || 'No notes recorded'}</p>
          </div>
        </div>
        <div className="flex justify-end border-t border-gray-100 bg-gray-50 p-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailCard({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        <i className={`fas ${icon} mt-1 text-blue-600`}></i>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-gray-500">{label}</p>
          <p className="mt-1 break-words text-sm font-bold text-gray-800">{value || '-'}</p>
        </div>
      </div>
    </div>
  );
}

function ActivityModal({ formData, loading, onClose, onChange, onSubmit }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-blue-700 p-5 text-white">
          <div>
            <h2 className="text-lg font-bold">Log Client Activity</h2>
            <p className="text-xs text-blue-100">Record client interaction history</p>
          </div>
          <button type="button" onClick={onClose} className="text-white hover:text-blue-100">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Client/Lead Name" value={formData.client_name} required onChange={(value) => onChange('client_name', value)} />
            <TextField label="Company Name" value={formData.company_name} required onChange={(value) => onChange('company_name', value)} />
            <FilterSelect label="Activity Type" value={formData.activity_type} onChange={(value) => onChange('activity_type', value)}>
              <option value="call">Phone Call</option>
              <option value="meeting">Meeting</option>
              <option value="email">Email</option>
              <option value="contract">Contract</option>
              <option value="support">Support</option>
            </FilterSelect>
            <div className="grid grid-cols-2 gap-2">
              <DateInput label="Date" value={formData.date} onChange={(value) => onChange('date', value)} />
              <TextField label="Time" type="time" value={formData.time} onChange={(value) => onChange('time', value)} />
            </div>
          </div>
          <TextField label="Event Description" value={formData.description} required onChange={(value) => onChange('description', value)} />
          <TextArea label="Detailed Notes" value={formData.notes} onChange={(value) => onChange('notes', value)} />
          <TextArea label="Outcome / Next Step" value={formData.outcome} onChange={(value) => onChange('outcome', value)} />
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className={loading ? 'fas fa-spinner fa-spin' : 'fas fa-save'}></i>
              {loading ? 'Logging...' : 'Save Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
      />
    </div>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">{label}</label>
      <textarea
        rows="3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
      />
    </div>
  );
}

function ShareModal({ item, members, selectedMember, searchQuery, loading, onSearch, onSelect, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-emerald-600 p-5 text-white">
          <div>
            <h2 className="text-lg font-bold">Share via Team Chat</h2>
            <p className="text-xs text-emerald-100">Send client details to a team member</p>
          </div>
          <button type="button" onClick={onClose} className="text-white hover:text-emerald-100">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search by name or email"
              className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {members.length === 0 ? (
              <p className="py-8 text-center text-sm font-semibold text-gray-400">No team members found</p>
            ) : (
              members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onSelect(member)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedMember?.id === member.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">
                      {String(member.name || member.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-800">{member.name || member.email}</p>
                      <p className="truncate text-xs text-gray-500">{member.role || 'Team'} - {member.department || 'No Dept'}</p>
                    </div>
                    {selectedMember?.id === member.id && <i className="fas fa-check-circle text-emerald-500"></i>}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-semibold text-gray-700">
            Sharing: {item.client} - {item.company}
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-300">
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!selectedMember || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className={loading ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane'}></i>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function mapLeadToClient(lead, employeeNameById) {
  const statusKey = normalizeStatus(lead.status);
  return {
    id: lead.id || lead.lead_code,
    leadId: lead.id,
    leadCode: lead.lead_code || `#${lead.id}`,
    client: lead.contact_person || lead.company_name || 'Unnamed Client',
    company: lead.company_name || '-',
    email: lead.email || '-',
    phone: lead.phone || '-',
    source: sourceLabels[lead.source] || toTitle(lead.source || 'other'),
    statusKey,
    status: getStatusLabel(statusKey),
    user: employeeNameById.get(String(lead.assigned_to)) || (lead.assigned_to ? `Employee ${lead.assigned_to}` : 'Unassigned'),
    date: formatDate(lead.created_at),
    time: formatTime(lead.created_at),
    updatedAt: formatDateTime(lead.updated_at || lead.created_at),
    notes: lead.notes || '',
  };
}

function normalizeStatus(status) {
  if (status === 'closed_won') return 'won';
  if (status === 'closed_lost') return 'lost';
  return status || 'new';
}

function getStatusLabel(status) {
  return statusOptions.find((option) => option.value === status)?.label || toTitle(status);
}

function getStatusColor(status) {
  const colors = {
    new: 'border-gray-200 bg-gray-100 text-gray-700',
    contacted: 'border-blue-200 bg-blue-100 text-blue-700',
    qualified: 'border-cyan-200 bg-cyan-100 text-cyan-700',
    proposal: 'border-amber-200 bg-amber-100 text-amber-700',
    negotiation: 'border-orange-200 bg-orange-100 text-orange-700',
    won: 'border-green-200 bg-green-100 text-green-700',
    lost: 'border-red-200 bg-red-100 text-red-700',
  };
  return colors[status] || colors.new;
}

function getDateRange(filter) {
  if (filter.date_filter === 'today') {
    const today = toDateInputValue(new Date());
    return { date_from: today, date_to: today };
  }

  if (filter.date_filter === 'week') {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { date_from: toDateInputValue(start), date_to: toDateInputValue(end) };
  }

  if (filter.date_filter === 'month') {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { date_from: toDateInputValue(start), date_to: toDateInputValue(end) };
  }

  return {
    date_from: filter.date_from || '',
    date_to: filter.date_to || '',
  };
}

function toDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${formatDate(value)} ${formatTime(value)}`;
}

function toTitle(value) {
  return String(value || '-')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// ——— Add New Client Modal —————————————————————————————————————————————————————————————————————

function AddClientModal({ formData, loading, onClose, onChange, onSubmit }) {
  const inp = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 placeholder:text-gray-400';
  const lbl = 'mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500';
  const hint = 'mt-0.5 text-[10px] text-gray-400';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl max-h-[90vh]">

        {/* ——— Header ——— */}
        <div className="flex-shrink-0 flex items-center justify-between bg-gradient-to-r from-[#1a3db8] to-[#244bd8] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <i className="fas fa-user-plus text-base"></i>
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Add New Client</h2>
              <p className="text-[11px] text-blue-200">Fill in all client details</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/25 transition-colors">
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>

        {/* ——— Form Body ——— */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* ——— SECTION 1: Basic Info ——— */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-blue-700">
                <i className="fas fa-user-circle w-4 text-center"></i> Basic Information
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className={lbl}>Full Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={formData.full_name}
                    onChange={(e) => onChange('full_name', e.target.value)}
                    placeholder="Client full name" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Company / Business Name</label>
                  <input type="text" value={formData.company_name}
                    onChange={(e) => onChange('company_name', e.target.value)}
                    placeholder="Company name" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Phone Number</label>
                  <input type="tel" value={formData.phone_number}
                    onChange={(e) => onChange('phone_number', e.target.value)}
                    placeholder="+91 XXXXX XXXXX" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Email Address</label>
                  <input type="email" value={formData.email}
                    onChange={(e) => onChange('email', e.target.value)}
                    placeholder="client@example.com" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select value={formData.status}
                    onChange={(e) => onChange('status', e.target.value)} className={inp}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="prospect">Prospect</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ——— SECTION 2: Address ——— */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-emerald-700">
                <i className="fas fa-map-marker-alt w-4 text-center"></i> Address Details
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="col-span-2 sm:col-span-4">
                  <label className={lbl}>Street Address</label>
                  <input type="text" value={formData.address}
                    onChange={(e) => onChange('address', e.target.value)}
                    placeholder="House no, Street, Area, Locality" className={inp} />
                </div>
                <div>
                  <label className={lbl}>City</label>
                  <input type="text" value={formData.city}
                    onChange={(e) => onChange('city', e.target.value)}
                    placeholder="e.g. Mumbai" className={inp} />
                </div>
                <div>
                  <label className={lbl}>State</label>
                  <input type="text" value={formData.state}
                    onChange={(e) => onChange('state', e.target.value)}
                    placeholder="e.g. Maharashtra" className={inp} />
                </div>
                <div>
                  <label className={lbl}>PIN Code</label>
                  <input type="text" value={formData.postal_code}
                    onChange={(e) => onChange('postal_code', e.target.value)}
                    placeholder="6-digit PIN" maxLength={10} className={inp} />
                </div>
              </div>
            </div>

            {/* ——— SECTION 3: KYC & Tax ——— */}
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-amber-700">
                <i className="fas fa-id-card w-4 text-center"></i> KYC &amp; Tax Information
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Aadhar */}
                <div className="rounded-lg border border-amber-200 bg-white p-3">
                  <label className={lbl + ' text-amber-700'}>
                    <i className="fas fa-fingerprint mr-1"></i> Aadhar Number
                  </label>
                  <input
                    type="text"
                    value={formData.aadhar_number}
                    onChange={(e) => onChange('aadhar_number', e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="XXXX XXXX XXXX"
                    maxLength={12}
                    className={inp + ' font-mono tracking-widest text-center text-base'}
                  />
                  <p className={hint}>12 digits · Numbers only</p>
                  {formData.aadhar_number && (
                    <p className={`mt-1 text-[10px] font-bold ${formData.aadhar_number.length === 12 ? 'text-green-600' : 'text-red-500'}`}>
                      {formData.aadhar_number.length === 12 ? '✓ Valid length' : `${formData.aadhar_number.length}/12 digits`}
                    </p>
                  )}
                </div>
                {/* PAN */}
                <div className="rounded-lg border border-amber-200 bg-white p-3">
                  <label className={lbl + ' text-amber-700'}>
                    <i className="fas fa-id-badge mr-1"></i> PAN Number
                  </label>
                  <input
                    type="text"
                    value={formData.pan_number}
                    onChange={(e) => onChange('pan_number', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className={inp + ' font-mono tracking-widest text-center text-base uppercase'}
                  />
                  <p className={hint}>Format: AAAAA9999A</p>
                  {formData.pan_number && (
                    <p className={`mt-1 text-[10px] font-bold ${/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_number) ? 'text-green-600' : 'text-amber-600'}`}>
                      {/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_number) ? '✓ Valid PAN' : `${formData.pan_number.length}/10 chars`}
                    </p>
                  )}
                </div>
                {/* GST */}
                <div className="rounded-lg border border-amber-200 bg-white p-3">
                  <label className={lbl + ' text-amber-700'}>
                    <i className="fas fa-file-invoice mr-1"></i> GST Number
                  </label>
                  <input
                    type="text"
                    value={formData.gst_number}
                    onChange={(e) => onChange('gst_number', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))}
                    placeholder="29ABCDE1234F1Z5"
                    maxLength={15}
                    className={inp + ' font-mono tracking-widest text-center text-sm uppercase'}
                  />
                  <p className={hint}>15-character GSTIN</p>
                  {formData.gst_number && (
                    <p className={`mt-1 text-[10px] font-bold ${formData.gst_number.length === 15 ? 'text-green-600' : 'text-amber-600'}`}>
                      {formData.gst_number.length === 15 ? '✓ Valid length' : `${formData.gst_number.length}/15 chars`}
                    </p>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* ——— Footer ——— */}
          <div className="flex-shrink-0 flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-4">
            <p className="text-[11px] text-gray-400">
              <span className="text-red-500">*</span> Full Name is required
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#244bd8] px-6 py-2 text-sm font-bold text-white shadow shadow-blue-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 transition-all">
                <i className={loading ? 'fas fa-spinner fa-spin' : 'fas fa-user-check'}></i>
                {loading ? 'Saving...' : 'Save Client'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
