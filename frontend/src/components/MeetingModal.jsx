import { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';

function buildInitialFormData(initialData = {}) {
  const defaults = {
    lead_id: '',
    title: '',
    description: '',
    meeting_date: '',
    meeting_time: '',
    duration_minutes: 60,
    location: '',
    meeting_type: 'client_meeting',
  };

  const seeded = { ...defaults, ...(initialData || {}) };

  if (seeded.meeting_date && String(seeded.meeting_date).includes('T')) {
    const parts = String(seeded.meeting_date).split('T');
    seeded.meeting_date = parts[0] || '';
    seeded.meeting_time = seeded.meeting_time || (parts[1] ? parts[1].slice(0, 5) : '');
  }

  return seeded;
}

function parseMeetingDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  try {
    const d = new Date(s.includes(' ') ? s.replace(' ', 'T') : s);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch (_) {
    return null;
  }
}

function formatMeetingDateTime(value) {
  const dt = parseMeetingDate(value);
  if (!dt) return '-';
  return `${dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'scheduled') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (s === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s === 'cancelled') return 'bg-rose-50 text-rose-700 border-rose-100';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function toDateInputValue(value) {
  const dt = parseMeetingDate(value);
  if (!dt) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeInputValue(value) {
  const dt = parseMeetingDate(value);
  if (!dt) return '';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function sortMeetingsByDate(list = []) {
  return [...(Array.isArray(list) ? list : [])]
    .map((meeting) => ({ ...meeting, __dt: parseMeetingDate(meeting.meeting_date) }))
    .sort((a, b) => (a.__dt?.getTime() || 0) - (b.__dt?.getTime() || 0))
    .map(({ __dt, ...meeting }) => meeting);
}

function meetingTypeLabel(type) {
  return String(type || 'general')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MeetingModal({
  onClose,
  onSuccess,
  initialData = null,
  presentation = 'global',
  contextDateLabel = '',
  dateMeetings = [],
  contextLoading = false,
  onMeetingClick = null,
  focusMeeting = null,
}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => buildInitialFormData(initialData));
  const [previewMeeting, setPreviewMeeting] = useState(null);
  const isContained = presentation === 'contained';
  const overlayClass = isContained
    ? 'absolute inset-0 z-[90] flex items-start justify-center p-3 sm:p-4 md:p-6 bg-slate-900/20 backdrop-blur-[1px] overflow-y-auto'
    : 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
  const modalClass = isContained
    ? 'bg-white rounded-[1.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200'
    : 'bg-white rounded-[1.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200';
  const formClass = isContained
    ? 'p-3 sm:p-4 lg:p-4'
    : 'p-4 sm:p-5 lg:p-6 max-h-[calc(100vh-10rem)] overflow-y-auto';
  const dateMeetingsSorted = useMemo(() => sortMeetingsByDate(dateMeetings), [dateMeetings]);

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    setFormData(buildInitialFormData(initialData));
  }, [initialData]);

  useEffect(() => {
    const nextPreview = focusMeeting || dateMeetingsSorted[0] || null;
    setPreviewMeeting(nextPreview);
  }, [focusMeeting, dateMeetingsSorted]);

  const fetchLeads = async () => {
    try {
      const response = await api.get('/leads');
      setLeads(response.data.data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const meetingDateTime = `${formData.meeting_date}T${formData.meeting_time}`;

      await api.post('/meetings/create', {
        lead_id: formData.lead_id || null,
        title: formData.title,
        description: formData.description,
        meeting_date: meetingDateTime,
        duration_minutes: formData.duration_minutes,
        location: formData.location,
        meeting_type: formData.meeting_type,
      });

      onSuccess();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewMeeting = (meeting) => {
    setPreviewMeeting(meeting || null);
    if (typeof onMeetingClick === 'function') {
      onMeetingClick(meeting);
    }
  };

  const handleScheduleSimilar = () => {
    if (!previewMeeting) return;
    setFormData((prev) => ({
      ...prev,
      lead_id: String(previewMeeting.lead_id || prev.lead_id || ''),
      meeting_date: toDateInputValue(previewMeeting.meeting_date) || prev.meeting_date,
      meeting_time: toTimeInputValue(previewMeeting.meeting_date) || prev.meeting_time,
      meeting_type: previewMeeting.meeting_type || prev.meeting_type,
      title: prev.title || `Follow-up: ${previewMeeting.title || 'Meeting'}`,
      location: prev.location || previewMeeting.location || '',
      description: prev.description || previewMeeting.description || '',
    }));
  };

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        {/* Modal Header */}
        <div className="bg-[#244bd8] p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
              <i className="fas fa-handshake text-2xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">Log Client Interaction</h2>
              <p className="text-[11px] opacity-80 uppercase tracking-widest font-black">Meeting Intelligence System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={formClass}>
          {(contextDateLabel || contextLoading || dateMeetingsSorted.length > 0) && (
            <div className="mb-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 overflow-hidden lg:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 px-3 py-2">Meetings On Selected Date</p>
                  {contextDateLabel && (
                    <span className="text-[10px] font-bold text-blue-700 bg-white border border-blue-100 rounded-full px-2 py-0.5 mr-3">
                      {contextDateLabel}
                    </span>
                  )}
                </div>
                <div className="max-h-32 overflow-auto border-t border-blue-100">
                  {contextLoading ? (
                    <div className="text-xs text-slate-500 flex items-center gap-2 px-3 py-3">
                      <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></span>
                      Loading meetings...
                    </div>
                  ) : (
                    <table className="w-full text-[11px]">
                      <thead className="bg-blue-100/60 sticky top-0 z-[1]">
                        <tr className="text-[10px] uppercase tracking-wide text-blue-800 font-black">
                          <th className="text-left px-3 py-2">Title</th>
                          <th className="text-left px-3 py-2">Time</th>
                          <th className="text-left px-3 py-2">Company</th>
                          <th className="text-left px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateMeetingsSorted.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-3 text-xs text-slate-500">
                              No meeting exists on this date yet.
                            </td>
                          </tr>
                        ) : (
                          dateMeetingsSorted.map((meeting) => (
                            <tr
                              key={`on-date-${meeting.id}`}
                              onClick={() => handlePreviewMeeting(meeting)}
                              className={`cursor-pointer border-t border-blue-100 transition-colors hover:bg-white ${previewMeeting?.id === meeting.id ? 'bg-white' : ''}`}
                            >
                              <td className="px-3 py-2 font-semibold text-slate-900">{meeting.title || 'Meeting'}</td>
                              <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{formatMeetingDateTime(meeting.meeting_date)}</td>
                              <td className="px-3 py-2 text-slate-700">{meeting.company_name || '-'}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${statusBadgeClass(meeting.status)}`}>
                                  {meeting.status || 'scheduled'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {previewMeeting && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:col-span-1">
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Selected Meeting</p>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${statusBadgeClass(previewMeeting.status)}`}>
                      {previewMeeting.status || 'scheduled'}
                    </span>
                  </div>
                  <div className="px-3 py-2 text-[11px] space-y-1.5">
                    <p className="font-bold text-slate-900 line-clamp-1">{previewMeeting.title || '-'}</p>
                    <p className="text-slate-600">{formatMeetingDateTime(previewMeeting.meeting_date)}</p>
                    <p className="text-slate-600">{meetingTypeLabel(previewMeeting.meeting_type)}</p>
                    <p className="text-slate-600 line-clamp-1">{previewMeeting.company_name || '-'}</p>
                  </div>
                  <div className="px-3 py-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleScheduleSimilar}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-bold hover:bg-blue-100"
                    >
                      Use As Base
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-4">
            {/* Left Column */}
            <div className="space-y-3">
              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-user-tag text-blue-500 w-4 text-center"></i>
                  <span>Associate Lead</span>
                </label>
                <select
                  value={formData.lead_id}
                  onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                >
                  <option value="">Independent Meeting (No Lead)</option>
                  {Array.isArray(leads) && leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.company_name} - {lead.contact_person}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-heading text-blue-500 w-4 text-center"></i>
                  <span>Meeting Title *</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Project Kickoff, Proposal Review"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className="fas fa-calendar-alt text-blue-500 w-4 text-center"></i>
                    <span>Date *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.meeting_date}
                    onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className="fas fa-clock text-blue-500 w-4 text-center"></i>
                    <span>Time *</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.meeting_time}
                    onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-map-marker-alt text-blue-500 w-4 text-center"></i>
                  <span>Location / Link</span>
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Office address or Meeting URL"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-tags text-blue-500 w-4 text-center"></i>
                  <span>Meeting Category</span>
                </label>
                <select
                  value={formData.meeting_type}
                  onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                >
                  <option value="client_meeting">Client Meeting</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="presentation">Presentation</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-hourglass-half text-blue-500 w-4 text-center"></i>
                  <span>Duration (Minutes)</span>
                </label>
                <input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-align-left text-blue-500 w-4 text-center"></i>
                  <span>Meeting Description</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Summary of objectives and topics..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#244bd8] hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-check-circle'}`}></i>
              <span>{loading ? 'Processing...' : 'Secure Meeting Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

