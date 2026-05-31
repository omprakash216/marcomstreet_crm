import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

const EMPTY_FORM = {
  title: '',
  description: '',
  date: '',
  time: '',
  duration_minutes: 60,
  location: '',
  meeting_type: 'other',
  notes: ''
};

const EDITABLE_STATUSES = ['scheduled', 'rescheduled', 'completed', 'cancelled'];
const MEETING_TYPES = ['other', 'presentation', 'follow_up', 'client_meeting'];

function parseMeetingDate(value) {
  if (!value) return null;
  const raw = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(raw.getTime()) ? null : raw;
}

function inputParts(value) {
  const date = parseMeetingDate(value);
  if (!date) return { date: '', time: '' };
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

function formatDate(value) {
  const date = parseMeetingDate(value);
  if (!date) return '-';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(value) {
  const date = parseMeetingDate(value);
  if (!date) return '-';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return '-';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function labelValue(value, fallback = '-') {
  if (!value) return fallback;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function meetingTypeLabel(type) {
  const labels = {
    other: 'Team Meeting',
    presentation: 'Presentation',
    follow_up: 'Follow Up',
    client_meeting: 'Client Meeting'
  };
  return labels[type] || labelValue(type, 'Meeting');
}

function getStatusColor(status) {
  switch (String(status || '').toLowerCase()) {
    case 'completed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'scheduled':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'cancelled':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'rescheduled':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-700';
  }
}

export default function GroupMeetings() {
  const firstRequest = useRef(true);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [activeActionId, setActiveActionId] = useState(null);
  const [filter, setFilter] = useState({
    search: '',
    status: '',
    date_filter: 'all'
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalMeetings, setTotalMeetings] = useState(0);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchMeetings = async (showPageLoader = false) => {
    if (showPageLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      setLoadError('');
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.search.trim()) params.append('search', filter.search.trim());
      if (filter.date_filter !== 'all') params.append('date_filter', filter.date_filter);
      params.append('page', String(page));
      params.append('limit', String(pageSize));

      const response = await api.get(`/group-meetings?${params.toString()}`);
      if (response.data.success) {
        const rows = Array.isArray(response.data.data) ? response.data.data : [];
        if (page > 1 && rows.length === 0) {
          setPage((previous) => Math.max(1, previous - 1));
          return;
        }
        setMeetings(rows);
        setHasNextPage(Boolean(response.data.has_next));
        setTotalMeetings(Number(response.data.total) || 0);
      }
    } catch (error) {
      console.error('Error fetching group meetings:', error);
      setMeetings([]);
      setHasNextPage(false);
      setTotalMeetings(0);
      setLoadError(error.response?.data?.message || 'Unable to load group meetings right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const showPageLoader = firstRequest.current;
    firstRequest.current = false;
    fetchMeetings(showPageLoader);
    // Filter changes deliberately trigger a refreshed list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilter((previous) => ({ ...previous, [key]: value }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingMeeting(null);
  };

  const openNewMeeting = () => {
    resetForm();
    setFeedback('');
    setFormError('');
    setShowForm(true);
  };

  const handleEdit = (meeting) => {
    const meetingParts = inputParts(meeting.meeting_date);
    setEditingMeeting(meeting);
    setFeedback('');
    setFormError('');
    setFormData({
      title: meeting.title || '',
      description: meeting.description || '',
      date: meetingParts.date,
      time: meetingParts.time,
      duration_minutes: Number(meeting.duration_minutes) || 60,
      location: meeting.location || '',
      meeting_type: MEETING_TYPES.includes(meeting.meeting_type) ? meeting.meeting_type : 'other',
      notes: meeting.notes || ''
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError('');
    resetForm();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        meeting_date: `${formData.date}T${formData.time}`,
        duration_minutes: Number(formData.duration_minutes) || 60,
        location: formData.location.trim(),
        meeting_type: formData.meeting_type,
        notes: formData.notes.trim(),
        status: editingMeeting?.status || 'scheduled'
      };

      const response = editingMeeting
        ? await api.put(`/group-meetings/${editingMeeting.id}`, payload)
        : await api.post('/group-meetings', payload);

      if (response.data.success) {
        setFeedback(editingMeeting ? 'Meeting updated successfully.' : 'Meeting scheduled successfully.');
        closeForm();
        await fetchMeetings(false);
      }
    } catch (error) {
      console.error('Error saving group meeting:', error);
      setFormError(error.response?.data?.message || 'Meeting could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (meetingId) => {
    if (!window.confirm('Are you sure you want to delete this group meeting?')) return;

    setActiveActionId(meetingId);
    setFeedback('');
    try {
      const response = await api.delete(`/group-meetings/${meetingId}`);
      if (response.data.success) {
        setFeedback('Meeting deleted successfully.');
        await fetchMeetings(false);
      }
    } catch (error) {
      console.error('Error deleting group meeting:', error);
      setFeedback(error.response?.data?.message || 'Meeting could not be deleted.');
    } finally {
      setActiveActionId(null);
    }
  };

  const handleStatusChange = async (meetingId, nextStatus) => {
    setActiveActionId(meetingId);
    setFeedback('');
    try {
      const response = await api.patch(`/group-meetings/${meetingId}/status`, { status: nextStatus });
      if (response.data.success) {
        setFeedback('Meeting status updated.');
        await fetchMeetings(false);
      }
    } catch (error) {
      console.error('Error updating meeting status:', error);
      setFeedback(error.response?.data?.message || 'Status could not be updated.');
    } finally {
      setActiveActionId(null);
    }
  };

  const hasFilters = Boolean(filter.search || filter.status || filter.date_filter !== 'all');
  const startSerial = meetings.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const endSerial = meetings.length > 0 ? startSerial + meetings.length - 1 : 0;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-600">Loading group meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-lg bg-gradient-to-r from-indigo-700 to-blue-700 px-5 py-5 shadow-sm sm:px-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-white/15">
              <i className="fas fa-users text-xl text-white"></i>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Group Meetings</h1>
              <p className="mt-1 text-sm text-indigo-100">Manage scheduled team sessions in one organized list</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openNewMeeting}
            className="inline-flex h-11 flex-none items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
          >
            <i className="fas fa-plus"></i>
            Schedule Meeting
          </button>
        </div>
      </section>

      {feedback && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="text-blue-600 hover:text-blue-900" title="Dismiss">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{loadError}</span>
          <button type="button" onClick={() => fetchMeetings(false)} className="font-semibold text-rose-700 hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search meetings</span>
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400"></i>
            <input
              type="search"
              placeholder="Search title, location or organizer"
              value={filter.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              className="h-11 w-full rounded-lg border border-gray-200 pl-11 pr-4 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <select
            aria-label="Filter by status"
            value={filter.status}
            onChange={(event) => updateFilter('status', event.target.value)}
            className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 lg:w-48"
          >
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            aria-label="Filter by date"
            value={filter.date_filter}
            onChange={(event) => updateFilter('date_filter', event.target.value)}
            className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 lg:w-48"
          >
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="upcoming">Upcoming</option>
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setFilter({ search: '', status: '', date_filter: 'all' });
              }}
              className="h-11 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-900 px-5 py-4 text-white sm:px-6">
          <h2 className="flex items-center gap-3 text-base font-semibold">
            <i className="far fa-calendar-alt text-indigo-300"></i>
            Meetings List
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gray-100">{totalMeetings}</span>
          </h2>
          {refreshing && <span className="text-xs text-gray-300">Refreshing...</span>}
        </div>

        {meetings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] table-fixed text-left">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="w-[6%] px-4 py-3">Sl No</th>
                  <th className="w-[18%] px-5 py-3">Meeting Title</th>
                  <th className="w-[11%] px-5 py-3">Meeting Type</th>
                  <th className="w-[13%] px-5 py-3">Company</th>
                  <th className="w-[14%] px-5 py-3">Date and Time</th>
                  <th className="w-[9%] px-5 py-3">Duration</th>
                  <th className="w-[12%] px-5 py-3">Location</th>
                  <th className="w-[10%] px-5 py-3">Organizer</th>
                  <th className="w-[11%] px-5 py-3">Status</th>
                  <th className="w-[10%] px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {meetings.map((meeting, index) => (
                  <tr key={meeting.id} className="align-middle transition hover:bg-gray-50/80">
                    <td className="px-4 py-4 text-sm font-semibold text-gray-500">{startSerial + index}</td>
                    <td className="px-5 py-4">
                      <p className="truncate text-sm font-semibold text-gray-900" title={meeting.title}>{meeting.title || 'Untitled meeting'}</p>
                      {meeting.description && <p className="mt-1 truncate text-xs text-gray-500" title={meeting.description}>{meeting.description}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {meetingTypeLabel(meeting.meeting_type)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">{meeting.company_name || '-'}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">{formatDate(meeting.meeting_date)}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatTime(meeting.meeting_date)}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">{formatDuration(meeting.duration_minutes)}</td>
                    <td className="px-5 py-4">
                      <p className="truncate text-sm text-gray-700" title={meeting.location || 'To be decided'}>{meeting.location || 'TBD'}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">{meeting.employee_name || '-'}</td>
                    <td className="px-5 py-4">
                      <select
                        value={meeting.status || 'scheduled'}
                        disabled={activeActionId === meeting.id}
                        onChange={(event) => handleStatusChange(meeting.id, event.target.value)}
                        className={`h-9 w-full rounded-lg border px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 ${getStatusColor(meeting.status)}`}
                      >
                        {!EDITABLE_STATUSES.includes(String(meeting.status || '').toLowerCase()) && meeting.status && (
                          <option value={meeting.status}>{labelValue(meeting.status)}</option>
                        )}
                        <option value="scheduled">Scheduled</option>
                        <option value="rescheduled">Rescheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(meeting)}
                          disabled={activeActionId === meeting.id}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50"
                          title="Edit meeting"
                        >
                          <i className="fas fa-pen"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(meeting.id)}
                          disabled={activeActionId === meeting.id}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                          title="Delete meeting"
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
        ) : (
          <div className="px-6 py-14 text-center">
            <i className="far fa-calendar text-3xl text-gray-300"></i>
            <h3 className="mt-4 text-base font-semibold text-gray-900">No meetings found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {hasFilters ? 'Try changing your filters.' : 'Schedule your first group meeting to get started.'}
            </p>
          </div>
        )}

        {!loading && meetings.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600">
              Page <span className="font-semibold">{page}</span> · Showing{' '}
              <span className="font-semibold">{startSerial}-{endSerial}</span> of{' '}
              <span className="font-semibold">{totalMeetings}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                disabled={page <= 1 || refreshing}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((previous) => previous + 1)}
                disabled={!hasNextPage || refreshing}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/55 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-indigo-600 bg-indigo-700 px-5 py-4 text-white sm:px-6">
              <div>
                <h2 className="text-lg font-semibold">{editingMeeting ? 'Edit Group Meeting' : 'Schedule Group Meeting'}</h2>
                <p className="mt-0.5 text-xs text-indigo-100">Enter meeting details and schedule</p>
              </div>
              <button type="button" onClick={closeForm} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10" title="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">
                  Meeting title <span className="text-rose-600">*</span>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="Weekly team review"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Meeting type
                  <select
                    value={formData.meeting_type}
                    onChange={(event) => setFormData({ ...formData, meeting_type: event.target.value })}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="other">Team Meeting</option>
                    <option value="presentation">Presentation</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="client_meeting">Client Meeting</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-gray-700">
                Description
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Purpose and key discussion points"
                />
              </label>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <label className="text-sm font-medium text-gray-700">
                  Date <span className="text-rose-600">*</span>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Time <span className="text-rose-600">*</span>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(event) => setFormData({ ...formData, time: event.target.value })}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Duration (minutes)
                  <input
                    type="number"
                    min="15"
                    max="480"
                    required
                    value={formData.duration_minutes}
                    onChange={(event) => setFormData({ ...formData, duration_minutes: event.target.value })}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-gray-700">
                Location
                <input
                  type="text"
                  value={formData.location}
                  onChange={(event) => setFormData({ ...formData, location: event.target.value })}
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Conference room or online meeting link"
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Notes
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Preparations or reminders"
                />
              </label>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  className="h-11 rounded-lg border border-gray-200 px-5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-indigo-700 px-5 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <i className="fas fa-save"></i>
                  {submitting ? 'Saving...' : editingMeeting ? 'Update Meeting' : 'Schedule Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
