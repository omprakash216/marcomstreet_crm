import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

const emptyForm = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'open',
  category: 'general',
  module: '',
  assigned_to: '',
  due_date: '',
  resolution_note: '',
};

const emptyCommentForm = {
  comment: '',
  status: '',
  is_internal: false,
};

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const categoryOptions = [
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Technical' },
  { value: 'crm', label: 'CRM' },
  { value: 'hrms', label: 'HRMS' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'finance', label: 'Finance' },
  { value: 'access', label: 'Access' },
  { value: 'other', label: 'Other' },
];

export default function AdminSupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statistics, setStatistics] = useState({
    total_tickets: 0,
    open_count: 0,
    in_progress_count: 0,
    resolved_count: 0,
    closed_count: 0,
    urgent_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [viewTicket, setViewTicket] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [commentForm, setCommentForm] = useState(emptyCommentForm);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    category: 'all',
    assigned_to: 'all',
  });

  useEffect(() => {
    fetchTickets();
    fetchEmployees();
  }, []);

  useEffect(() => {
    const handle = setTimeout(fetchTickets, 300);
    return () => clearTimeout(handle);
  }, [filters.search, filters.status, filters.priority, filters.category, filters.assigned_to]);

  const employeeOptions = useMemo(() => {
    return employees.map((employee) => ({
      value: String(employee.id),
      label: employee.name || employee.email || `Employee ${employee.id}`,
    }));
  }, [employees]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params[key] = value;
      });
      if (!filters.search.trim()) delete params.search;

      const response = await api.get('/support-tickets', { params });
      if (response.data?.success) {
        setTickets(Array.isArray(response.data.data) ? response.data.data : []);
        setStatistics(response.data.statistics || {});
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Support tickets load nahi ho paaye');
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

  const openCreate = () => {
    setEditingTicket(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (ticket) => {
    setEditingTicket(ticket);
    setForm({
      title: ticket.title || '',
      description: ticket.description || '',
      priority: ticket.priority || 'medium',
      status: ticket.status || 'open',
      category: ticket.category || 'general',
      module: ticket.module || '',
      assigned_to: ticket.assigned_to ? String(ticket.assigned_to) : '',
      due_date: toDateInputValue(ticket.due_date),
      resolution_note: ticket.resolution_note || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTicket(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      title: form.title.trim(),
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
    };

    if (!payload.title) return alert('Ticket title required hai');

    setSaving(true);
    try {
      if (editingTicket) {
        await api.put(`/support-tickets/${editingTicket.id}`, payload);
      } else {
        await api.post('/support-tickets', payload);
      }
      closeModal();
      await fetchTickets();
      if (viewTicket?.id === editingTicket?.id) await fetchDetails(editingTicket.id);
    } catch (err) {
      alert(err.response?.data?.message || 'Support ticket save nahi ho paaya');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ticket) => {
    if (!window.confirm(`Delete ticket "${ticket.ticket_no || ticket.title}"?`)) return;
    try {
      await api.delete(`/support-tickets/${ticket.id}`);
      if (viewTicket?.id === ticket.id) closeViewModal();
      await fetchTickets();
    } catch (err) {
      alert(err.response?.data?.message || 'Support ticket delete nahi ho paaya');
    }
  };

  const updateStatus = async (ticket, status) => {
    try {
      await api.patch(`/support-tickets/${ticket.id}/status`, { status });
      await fetchTickets();
      if (viewTicket?.id === ticket.id) await fetchDetails(ticket.id);
    } catch (err) {
      alert(err.response?.data?.message || 'Status update nahi ho paaya');
    }
  };

  const openView = async (ticket) => {
    setViewTicket(ticket);
    setDetails(null);
    setCommentForm(emptyCommentForm);
    await fetchDetails(ticket.id);
  };

  const fetchDetails = async (ticketId) => {
    setDetailsLoading(true);
    try {
      const response = await api.get(`/support-tickets/${ticketId}`);
      setDetails(response.data?.data || null);
    } catch (err) {
      alert(err.response?.data?.message || 'Ticket details load nahi ho paaye');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeViewModal = () => {
    setViewTicket(null);
    setDetails(null);
    setCommentForm(emptyCommentForm);
  };

  const addComment = async (event) => {
    event.preventDefault();
    if (!viewTicket) return;
    if (!commentForm.comment.trim() && !commentForm.status) {
      return alert('Comment ya status required hai');
    }

    setSavingComment(true);
    try {
      await api.post(`/support-tickets/${viewTicket.id}/comments`, {
        ...commentForm,
        comment: commentForm.comment.trim(),
        status: commentForm.status || null,
      });
      setCommentForm(emptyCommentForm);
      await fetchDetails(viewTicket.id);
      await fetchTickets();
    } catch (err) {
      alert(err.response?.data?.message || 'Comment save nahi ho paaya');
    } finally {
      setSavingComment(false);
    }
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm('Delete this ticket comment?')) return;
    try {
      await api.delete(`/support-tickets/comments/${commentId}`);
      if (viewTicket) await fetchDetails(viewTicket.id);
    } catch (err) {
      alert(err.response?.data?.message || 'Comment delete nahi ho paaya');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
              <i className="fas fa-life-ring text-xl"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2c86ab]">Company Admin Panel</p>
              <h1 className="mt-1 text-2xl font-black text-gray-900">Support Tickets</h1>
              <p className="mt-1 text-sm text-gray-600">Create, assign, track, and resolve internal support requests</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchTickets}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <i className="fas fa-sync-alt"></i>
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
            >
              <i className="fas fa-plus"></i>
              New Ticket
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Tickets" value={Number(statistics.total_tickets || 0)} icon="fa-ticket-alt" tone="blue" />
        <SummaryCard label="Open" value={Number(statistics.open_count || 0)} icon="fa-folder-open" tone="amber" />
        <SummaryCard label="In Progress" value={Number(statistics.in_progress_count || 0)} icon="fa-spinner" tone="indigo" />
        <SummaryCard label="Urgent" value={Number(statistics.urgent_count || 0)} icon="fa-triangle-exclamation" tone="red" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 xl:grid-cols-[1fr_160px_160px_170px_180px]">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search ticket no, title, category, module, assignee"
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <FilterSelect value={filters.status} onChange={(status) => setFilters((current) => ({ ...current, status }))} options={statusOptions} allLabel="All Status" />
          <FilterSelect value={filters.priority} onChange={(priority) => setFilters((current) => ({ ...current, priority }))} options={priorityOptions} allLabel="All Priority" />
          <FilterSelect value={filters.category} onChange={(category) => setFilters((current) => ({ ...current, category }))} options={categoryOptions} allLabel="All Categories" />
          <select
            value={filters.assigned_to}
            onChange={(event) => setFilters((current) => ({ ...current, assigned_to: event.target.value }))}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {employeeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
                <th className="px-4 py-4">Ticket</th>
                <th className="px-4 py-4">Category</th>
                <th className="px-4 py-4">Assignee</th>
                <th className="px-4 py-4">Priority</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Due</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-14 text-center text-sm font-semibold text-gray-400" colSpan="7">Loading support tickets...</td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td className="px-4 py-14 text-center" colSpan="7">
                    <p className="text-sm font-bold text-gray-500">No support tickets found</p>
                    <p className="mt-1 text-xs text-gray-400">Create a ticket to track an issue, task, or module request.</p>
                  </td>
                </tr>
              ) : tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-black text-blue-700">{ticket.ticket_no || `TKT${ticket.id}`}</p>
                    <p className="mt-1 text-sm font-black text-gray-900">{ticket.title}</p>
                    <p className="text-xs text-gray-500">{ticket.created_by_name || 'System'} - {formatDate(ticket.created_at)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold capitalize text-gray-900">{ticket.category || 'general'}</p>
                    <p className="text-xs text-gray-500">{ticket.module || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-800">{ticket.assigned_to_name || 'Unassigned'}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                  <td className="px-4 py-3">
                    <select
                      value={ticket.status || 'open'}
                      onChange={(event) => updateStatus(ticket, event.target.value)}
                      className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs font-black capitalize"
                    >
                      {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">{formatDate(ticket.due_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <IconButton title="View" icon="fa-eye" onClick={() => openView(ticket)} />
                      <IconButton title="Edit" icon="fa-edit" onClick={() => openEdit(ticket)} tone="blue" />
                      <IconButton title="Delete" icon="fa-trash" onClick={() => handleDelete(ticket)} tone="red" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">{editingTicket ? 'Edit Ticket' : 'New Ticket'}</h2>
                <p className="text-sm text-gray-500">{editingTicket?.ticket_no || 'Create an internal support request'}</p>
              </div>
              <button type="button" onClick={closeModal} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-3">
                  <Field label="Ticket Title" required value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
                </div>
                <SelectField label="Priority" value={form.priority} options={priorityOptions} onChange={(value) => setForm({ ...form, priority: value })} />
                <SelectField label="Status" value={form.status} options={statusOptions} onChange={(value) => setForm({ ...form, status: value })} />
                <SelectField label="Category" value={form.category} options={categoryOptions} onChange={(value) => setForm({ ...form, category: value })} />
                <Field label="Module / Area" value={form.module} onChange={(value) => setForm({ ...form, module: value })} placeholder="Inventory, Quotations, Login..." />
                <SelectField
                  label="Assign To"
                  value={form.assigned_to}
                  options={employeeOptions}
                  onChange={(value) => setForm({ ...form, assigned_to: value })}
                  emptyLabel="Unassigned"
                />
                <Field label="Due Date" type="date" value={form.due_date} onChange={(value) => setForm({ ...form, due_date: value })} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextAreaField label="Description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} rows={5} />
                <TextAreaField label="Resolution Note" value={form.resolution_note} onChange={(value) => setForm({ ...form, resolution_note: value })} rows={5} />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
                <button type="button" onClick={closeModal} className="rounded-xl px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Saving...' : editingTicket ? 'Save Changes' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewTicket && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gray-50 px-6 py-4">
              <div>
                <p className="font-mono text-xs font-black text-blue-700">{details?.ticket?.ticket_no || viewTicket.ticket_no}</p>
                <h2 className="mt-1 text-lg font-black text-gray-900">{details?.ticket?.title || viewTicket.title}</h2>
                <p className="text-sm text-gray-500">{details?.ticket?.assigned_to_name || viewTicket.assigned_to_name || 'Unassigned'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const ticket = details?.ticket || viewTicket;
                    closeViewModal();
                    openEdit(ticket);
                  }}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                >
                  Edit
                </button>
                <button type="button" onClick={closeViewModal} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {detailsLoading ? (
                <div className="py-16 text-center text-sm font-semibold text-gray-400">Loading ticket details...</div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Detail label="Priority" value={<PriorityBadge priority={details?.ticket?.priority || viewTicket.priority} />} />
                    <Detail label="Status" value={<StatusBadge status={details?.ticket?.status || viewTicket.status} />} />
                    <Detail label="Category" value={details?.ticket?.category || viewTicket.category} />
                    <Detail label="Due Date" value={formatDate(details?.ticket?.due_date || viewTicket.due_date)} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
                    <section className="rounded-2xl border border-gray-200 bg-white p-4">
                      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gray-700">Ticket Details</h3>
                      <div className="mt-4 space-y-4">
                        <TextBlock label="Description" value={details?.ticket?.description || viewTicket.description} />
                        <TextBlock label="Resolution Note" value={details?.ticket?.resolution_note || viewTicket.resolution_note} />
                      </div>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white">
                      <div className="border-b border-gray-100 p-4">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gray-700">Add Update</h3>
                      </div>
                      <form onSubmit={addComment} className="space-y-4 p-4">
                        <SelectField
                          label="Change Status"
                          value={commentForm.status}
                          options={statusOptions}
                          onChange={(value) => setCommentForm({ ...commentForm, status: value })}
                          emptyLabel="No status change"
                        />
                        <TextAreaField label="Comment" value={commentForm.comment} onChange={(value) => setCommentForm({ ...commentForm, comment: value })} rows={4} />
                        <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-bold text-gray-700">
                          <input
                            type="checkbox"
                            checked={commentForm.is_internal}
                            onChange={(event) => setCommentForm({ ...commentForm, is_internal: event.target.checked })}
                          />
                          Internal note
                        </label>
                        <div className="flex justify-end">
                          <button type="submit" disabled={savingComment} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">
                            {savingComment ? 'Saving...' : 'Save Update'}
                          </button>
                        </div>
                      </form>
                    </section>
                  </div>

                  <section className="rounded-2xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-100 p-4">
                      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gray-700">Activity Timeline</h3>
                    </div>
                    <div className="max-h-[460px] overflow-y-auto p-4">
                      {!details?.comments?.length ? (
                        <p className="py-8 text-center text-sm font-semibold text-gray-400">No activity yet</p>
                      ) : details.comments.map((item) => (
                        <div key={item.id} className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 last:mb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-gray-900">{item.created_by_name || 'System'}</p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                                {formatDateTime(item.created_at)}
                                {item.status_to ? ` - ${item.status_from || 'new'} to ${item.status_to}` : ''}
                              </p>
                            </div>
                            <button type="button" onClick={() => deleteComment(item.id)} className="text-xs font-black text-red-600 hover:text-red-700">
                              Delete
                            </button>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{item.comment || '-'}</p>
                          {Number(item.is_internal || 0) === 1 && (
                            <p className="mt-2 inline-flex rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700">
                              Internal
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, placeholder = '', ...rest }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">
        {label}{required ? ' *' : ''}
      </label>
      <input
        {...rest}
        required={required}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange, rows = 4 }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">{label}</label>
      <textarea
        rows={rows}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange, emptyLabel = '' }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">{label}</label>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
      >
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function FilterSelect({ value, onChange, options, allLabel }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
    >
      <option value="all">{allLabel}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function IconButton({ title, icon, onClick, tone = 'gray' }) {
  const tones = {
    gray: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100',
    blue: 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100',
    red: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border ${tones[tone] || tones.gray}`}
    >
      <i className={`fas ${icon}`}></i>
    </button>
  );
}

function SummaryCard({ label, value, icon, tone }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    red: 'border-red-100 bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-600">{label}</p>
        <i className={`fas ${icon} text-lg`}></i>
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const tones = {
    low: 'border-green-200 bg-green-100 text-green-700',
    medium: 'border-blue-200 bg-blue-100 text-blue-700',
    high: 'border-amber-200 bg-amber-100 text-amber-700',
    urgent: 'border-red-200 bg-red-100 text-red-700',
  };
  const value = priority || 'medium';
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[value] || tones.medium}`}>
      {String(value).replace('_', ' ')}
    </span>
  );
}

function StatusBadge({ status }) {
  const tones = {
    open: 'border-amber-200 bg-amber-100 text-amber-700',
    in_progress: 'border-indigo-200 bg-indigo-100 text-indigo-700',
    resolved: 'border-green-200 bg-green-100 text-green-700',
    closed: 'border-gray-200 bg-gray-100 text-gray-700',
  };
  const value = status || 'open';
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[value] || tones.open}`}>
      {String(value).replace('_', ' ')}
    </span>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <div className="break-words text-sm font-bold text-gray-900">{value || '-'}</div>
    </div>
  );
}

function TextBlock({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className="whitespace-pre-wrap text-sm font-semibold text-gray-800">{value || '-'}</p>
    </div>
  );
}

function toDateInputValue(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}
