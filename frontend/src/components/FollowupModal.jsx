import { useEffect, useState } from 'react';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';

const SALES_FOLLOWUP_OPTIONS = [
  { value: 'call', label: 'Voice Call Interaction' },
  { value: 'email', label: 'Formal Email Communication' },
  { value: 'whatsapp', label: 'Instant Messaging (WhatsApp)' },
  { value: 'meeting', label: 'Physical/Virtual Meeting' },
  { value: 'other', label: 'Other Operational Channel' },
];

const DESIGN_FOLLOWUP_OPTIONS = [
  { value: 'review', label: 'Internal Design Review' },
  { value: 'feedback', label: 'Client Feedback Sync' },
  { value: 'handover', label: 'Final Handover Discussion' },
  { value: 'update', label: 'Operational Update' },
  { value: 'other', label: 'Other Workflow Context' },
];

const ALL_FOLLOWUP_OPTIONS = [
  { value: 'call', label: 'Voice Call Interaction' },
  { value: 'email', label: 'Formal Email Communication' },
  { value: 'whatsapp', label: 'Instant Messaging (WhatsApp)' },
  { value: 'meeting', label: 'Physical/Virtual Meeting' },
  { value: 'review', label: 'Internal Design Review' },
  { value: 'feedback', label: 'Client Feedback Sync' },
  { value: 'handover', label: 'Final Handover Discussion' },
  { value: 'update', label: 'Operational Update' },
  { value: 'other', label: 'Other Follow-up' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'missed', label: 'Missed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function splitDateTime(value) {
  if (!value) return { date: '', time: '' };

  if (value instanceof Date) {
    return {
      date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
      time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
    };
  }

  const text = String(value).trim();
  if (!text) return { date: '', time: '' };

  const looksLikeIso = /[TzZ]|[+-]\d{2}:\d{2}$/.test(text);
  if (looksLikeIso) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
        time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
      };
    }
  }

  const normalized = text.replace('T', ' ').replace(/Z$/i, '');
  const dateMatch = normalized.match(/(\d{4}-\d{2}-\d{2})/);
  const timeMatch = normalized.match(/(\d{2}:\d{2})/);
  if (dateMatch) {
    return {
      date: dateMatch[1],
      time: timeMatch?.[1] || '',
    };
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
      time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
    };
  }

  return { date: '', time: '' };
}

function getRoleBasedOptions(mode, isDesigner, currentType) {
  const base = mode === 'create'
    ? (isDesigner ? DESIGN_FOLLOWUP_OPTIONS : SALES_FOLLOWUP_OPTIONS)
    : ALL_FOLLOWUP_OPTIONS;

  if (!currentType) return base;
  if (base.some((option) => option.value === currentType)) return base;
  return [...base, { value: currentType, label: currentType.replace(/_/g, ' ') }];
}

function buildInitialForm({ leadId, followup, mode, isDesigner }) {
  const isExisting = mode !== 'create' && followup;
  const dateParts = splitDateTime(followup?.scheduled_date || followup?.followup_date || '');
  const defaultType = isDesigner ? 'review' : 'call';

  return {
    lead_id: String(isExisting ? (followup?.lead_id || leadId || '') : (leadId || '')),
    task_id: '',
    followup_type: isExisting ? (followup?.followup_type || defaultType) : defaultType,
    scheduled_date: isExisting ? dateParts.date : '',
    scheduled_time: isExisting ? dateParts.time : '',
    notes: isExisting ? (followup?.notes || '') : '',
    outcome: isExisting ? (followup?.outcome || '') : '',
    status: isExisting ? (followup?.status || 'pending') : 'pending',
  };
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-800 break-words">{value || '—'}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    missed: 'bg-red-100 text-red-800 border-red-200',
    cancelled: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${styles[status] || styles.pending}`}>
      {status || 'pending'}
    </span>
  );
}

export default function FollowupModal({
  leadId,
  followup = null,
  mode = 'create',
  onClose,
  onSuccess,
  presentation = 'global',
}) {
  const employee = getEmployee();
  const isDesigner = employee?.role === 'designer';
  const isCreateMode = mode === 'create';
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isReadOnly = isViewMode;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => buildInitialForm({ leadId, followup, mode, isDesigner }));

  useEffect(() => {
    setFormData(buildInitialForm({ leadId, followup, mode, isDesigner }));
  }, [leadId, followup, mode, isDesigner]);

  const shouldLoadTaskList = isCreateMode && isDesigner && !leadId;
  const shouldLoadLeadList = !shouldLoadTaskList && (!isCreateMode || !leadId);

  useEffect(() => {
    if (shouldLoadTaskList) {
      fetchTasks();
      return;
    }
    if (shouldLoadLeadList) {
      fetchLeads();
      return;
    }
    setItems([]);
  }, [shouldLoadTaskList, shouldLoadLeadList]);

  const fetchLeads = async () => {
    try {
      const response = await api.get('/leads', { params: { unlimited: true } });
      setItems(response.data.data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await api.get('/tasks', {
        params: { unlimited: true, status: 'pending,in_progress' },
      });
      setItems(response.data.data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const handleLeadSelect = (event) => {
    const value = event.target.value;
    setFormData((current) => ({ ...current, lead_id: value }));
  };

  const handleTaskSelect = (event) => {
    const value = event.target.value;
    const selectedTask = items.find((task) => task.id.toString() === value);

    setFormData((current) => ({
      ...current,
      task_id: value,
      lead_id: selectedTask?.lead_id ? String(selectedTask.lead_id) : '',
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isReadOnly) {
      onClose?.();
      return;
    }

    if (!formData.lead_id || !formData.scheduled_date || !formData.scheduled_time) {
      alert('Please select a lead and provide both follow-up date and time.');
      return;
    }

    setLoading(true);

    try {
      const scheduledDateTime = `${formData.scheduled_date} ${formData.scheduled_time}:00`;

      let finalNotes = formData.notes;
      if (isCreateMode && isDesigner && formData.task_id) {
        const selectedTask = items.find((task) => task.id.toString() === formData.task_id);
        if (selectedTask) {
          finalNotes = `[Task: ${selectedTask.title}] ${finalNotes}`.trim();
        }
      }

      const payload = {
        lead_id: formData.lead_id,
        followup_type: formData.followup_type,
        scheduled_date: scheduledDateTime,
        notes: finalNotes,
        outcome: formData.outcome,
        status: formData.status,
      };

      if (isEditMode) {
        if (!followup?.id) {
          throw new Error('Follow-up record is missing.');
        }
        await api.put(`/followups/${followup.id}`, payload);
      } else {
        await api.post('/followups/create', payload);
      }

      onSuccess?.();
    } catch (error) {
      console.error('Failed to save follow-up:', error);
      alert(error.response?.data?.message || error.message || 'Failed to save follow-up.');
    } finally {
      setLoading(false);
    }
  };

  const isInline = presentation === 'inline';
  const overlayClass = isInline
    ? 'relative z-20 w-full'
    : 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
  const shellClass = isInline
    ? 'mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-xl'
    : 'bg-white rounded-[1.5rem] w-full max-w-5xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200';
  const formClass = isInline ? 'p-4 sm:p-5' : 'p-6';
  const gridClass = isInline ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : 'grid grid-cols-1 lg:grid-cols-2 gap-6';

  const modalTitle = isViewMode
    ? 'Follow-up Details'
    : isEditMode
      ? 'Edit Follow-up'
      : (isDesigner ? 'Schedule Design Review' : 'Schedule Strategic Follow-up');

  const modalSubtitle = isViewMode
    ? 'Read-only record overview'
    : isEditMode
      ? 'Update timeline, status, notes, and outcome'
      : (isDesigner ? 'Creative Workflow Management' : 'Retention & Engagement System');

  const iconClass = isViewMode
    ? 'fa-eye'
    : isEditMode
      ? 'fa-pen'
      : (isDesigner ? 'fa-palette' : 'fa-clock');

  const actionLabel = isViewMode
    ? 'Close'
    : isEditMode
      ? 'Save Changes'
      : 'Finalize Schedule';

  const currentOptions = getRoleBasedOptions(mode, isDesigner, formData.followup_type);

  const selectedLead = items.find((item) => item.id.toString() === String(formData.lead_id));
  const leadDisplayLabel = followup?.company_name
    || selectedLead?.company_name
    || (formData.lead_id ? `Lead #${formData.lead_id}` : '—');
  const contactDisplayLabel = followup?.contact_person || selectedLead?.contact_person || '—';
  const phoneDisplayLabel = followup?.phone || selectedLead?.phone || '—';

  return (
    <div className={overlayClass}>
      <div className={shellClass}>
        <div className="bg-[#244bd8] p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
              <i className={`fas ${iconClass} text-xl`}></i>
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">{modalTitle}</h2>
              <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">{modalSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            type="button"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {!isCreateMode && (
          <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Company" value={leadDisplayLabel} />
            <DetailItem label="Contact" value={contactDisplayLabel} />
            <DetailItem label="Phone" value={phoneDisplayLabel} />
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Status</div>
              <div className="mt-2">
                <StatusPill status={formData.status} />
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={formClass}>
          <div className={gridClass}>
            <div className="space-y-4">
              {(mode !== 'create' || !leadId) && (
                <div>
                  <label className="mb-1 flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <i className={`fas ${isDesigner && isCreateMode ? 'fa-tasks' : 'fa-user-tie'} text-blue-500 w-4 text-center`}></i>
                    <span>{isDesigner && isCreateMode && !leadId ? 'Target Assignment / Task *' : 'Target Lead / Company *'}</span>
                  </label>

                  {isDesigner && isCreateMode && !leadId ? (
                    <select
                      required
                      value={formData.task_id}
                      onChange={handleTaskSelect}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">
                        {items.length === 0 ? 'No Active Tasks Assigned' : 'Select Your Assignment'}
                      </option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {`${item.title} (${item.company_name || 'Internal'})`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      required
                      value={formData.lead_id}
                      onChange={handleLeadSelect}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">{items.length === 0 ? 'No Leads Available' : 'Select Target Entity'}</option>
                      {formData.lead_id && !selectedLead && followup?.company_name && (
                        <option value={formData.lead_id}>
                          {`${followup.company_name}${followup.contact_person ? ` (${followup.contact_person})` : ''}`}
                        </option>
                      )}
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {`${item.company_name}${item.contact_person ? ` (${item.contact_person})` : ''}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <i className="fas fa-bullseye text-blue-500 w-4 text-center"></i>
                  <span>{isDesigner && isCreateMode ? 'Follow-up Context *' : 'Interaction Type *'}</span>
                </label>
                <select
                  required
                  value={formData.followup_type}
                  onChange={(event) => setFormData((current) => ({ ...current, followup_type: event.target.value }))}
                  disabled={isReadOnly}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  {currentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <i className="fas fa-calendar-day text-blue-500 w-4 text-center"></i>
                    <span>Date *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.scheduled_date}
                    onChange={(event) => setFormData((current) => ({ ...current, scheduled_date: event.target.value }))}
                    disabled={isReadOnly}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <i className="fas fa-clock text-blue-500 w-4 text-center"></i>
                    <span>Time *</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.scheduled_time}
                    onChange={(event) => setFormData((current) => ({ ...current, scheduled_time: event.target.value }))}
                    disabled={isReadOnly}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>
              </div>

              {(!isCreateMode || followup?.status) && (
                <div>
                  <label className="mb-1 flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <i className="fas fa-layer-group text-blue-500 w-4 text-center"></i>
                    <span>Execution Status</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))}
                    disabled={isViewMode}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <i className="fas fa-sticky-note text-blue-500 w-4 text-center"></i>
                  <span>Strategy & Discussion Notes</span>
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                  rows={7}
                  placeholder="Outline the objectives and talking points for this interaction..."
                  readOnly={isReadOnly}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm resize-none disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <i className="fas fa-bullhorn text-blue-500 w-4 text-center"></i>
                  <span>Outcome / Resolution</span>
                </label>
                <textarea
                  value={formData.outcome}
                  onChange={(event) => setFormData((current) => ({ ...current, outcome: event.target.value }))}
                  rows={6}
                  placeholder="Capture the final discussion, resolution, or next step..."
                  readOnly={isReadOnly}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm resize-none disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              {followup?.completed_date && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Completed On</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">
                    {new Date(followup.completed_date).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-50 pt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
            {isViewMode ? (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-[#244bd8] hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  {isEditMode ? 'Cancel Changes' : 'Discard Schedule'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#244bd8] hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <i className={`fas ${isEditMode ? 'fa-save' : 'fa-calendar-check'} mr-2 text-[10px]`}></i>
                  <span>{loading ? 'Saving...' : actionLabel}</span>
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
