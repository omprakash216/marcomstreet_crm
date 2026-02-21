import { useState, useEffect } from 'react';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';

export default function FollowupModal({ leadId, onClose, onSuccess }) {
  const [items, setItems] = useState([]); // Can be leads or tasks
  const [loading, setLoading] = useState(false);
  const employee = getEmployee();
  const isDesigner = employee?.role === 'designer';

  const [formData, setFormData] = useState({
    lead_id: leadId || '',
    task_id: '',
    followup_type: isDesigner ? 'review' : 'call',
    scheduled_date: '',
    scheduled_time: '',
    notes: '',
  });

  useEffect(() => {
    if (!leadId) {
      if (isDesigner) {
        fetchTasks();
      } else {
        fetchLeads();
      }
    }
  }, [leadId, isDesigner]);

  const fetchLeads = async () => {
    try {
      const response = await api.get('/leads', {
        params: { unlimited: true }
      });
      setItems(response.data.data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await api.get('/tasks', {
        params: { unlimited: true, status: 'pending,in_progress' }
      });
      setItems(response.data.data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const handleItemSelect = (e) => {
    const val = e.target.value;
    if (isDesigner) {
      const selectedTask = items.find(t => t.id.toString() === val);
      setFormData({
        ...formData,
        task_id: val,
        lead_id: selectedTask?.lead_id || ''
      });
    } else {
      setFormData({ ...formData, lead_id: val });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.lead_id || !formData.scheduled_date || !formData.scheduled_time) {
      return;
    }

    setLoading(true);

    try {
      const scheduledDateTime = `${formData.scheduled_date} ${formData.scheduled_time}`;

      // Append task info to notes if it's a designer follow-up
      let finalNotes = formData.notes;
      if (isDesigner && formData.task_id) {
        const selectedTask = items.find(t => t.id.toString() === formData.task_id);
        if (selectedTask) {
          finalNotes = `[Task: ${selectedTask.title}] ${finalNotes}`;
        }
      }

      await api.post('/followups/create', {
        lead_id: formData.lead_id,
        followup_type: formData.followup_type,
        scheduled_date: scheduledDateTime,
        notes: finalNotes,
      });

      onSuccess();
    } catch (error) {
      console.error('Failed to create follow-up:', error);
      alert(error.response?.data?.message || 'Failed to schedule follow-up. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[1.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
        {/* Modal Header */}
        <div className="bg-[#244bd8] p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
              <i className={`fas ${isDesigner ? 'fa-palette' : 'fa-clock'} text-xl`}></i>
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">
                {isDesigner ? 'Schedule Design Review' : 'Schedule Strategic Follow-up'}
              </h2>
              <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">
                {isDesigner ? 'Creative Workflow Management' : 'Retention & Engagement System'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-8">
            {/* Left Column */}
            <div className="space-y-4">
              {!leadId && (
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className={`fas ${isDesigner ? 'fa-tasks' : 'fa-user-tie'} text-blue-500 w-4 text-center`}></i>
                    <span>{isDesigner ? 'Target Assignment / Task *' : 'Target Lead / Company *'}</span>
                  </label>
                  <select
                    required
                    value={isDesigner ? formData.task_id : formData.lead_id}
                    onChange={handleItemSelect}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                  >
                    <option value="">
                      {items.length === 0
                        ? (isDesigner ? 'No Active Tasks Assigned' : 'No Leads Available')
                        : (isDesigner ? 'Select Your Assignment' : 'Select Target Entity')}
                    </option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {isDesigner
                          ? `${item.title} (${item.company_name || 'Internal'})`
                          : `${item.company_name} ${item.contact_person ? `(${item.contact_person})` : ''}`
                        }
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-bullseye text-blue-500 w-4 text-center"></i>
                  <span>{isDesigner ? 'Follow-up Context *' : 'Interaction Type *'}</span>
                </label>
                <select
                  required
                  value={formData.followup_type}
                  onChange={(e) => setFormData({ ...formData, followup_type: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                >
                  {isDesigner ? (
                    <>
                      <option value="review">Internal Design Review</option>
                      <option value="feedback">Client Feedback Sync</option>
                      <option value="handover">Final Handover Discussion</option>
                      <option value="update">Operational Update</option>
                      <option value="other">Other Workflow Context</option>
                    </>
                  ) : (
                    <>
                      <option value="call">Voice Call Interaction</option>
                      <option value="email">Formal Email Communication</option>
                      <option value="whatsapp">Instant Messaging (WhatsApp)</option>
                      <option value="meeting">Physical/Virtual Meeting</option>
                      <option value="other">Other Operational Channel</option>
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className="fas fa-calendar-day text-blue-500 w-4 text-center"></i>
                    <span>Date *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
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
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-sticky-note text-blue-500 w-4 text-center"></i>
                  <span>Strategy & Discussion Notes</span>
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={8}
                  placeholder="Outline the objectives and talking points for this interaction..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-50">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Discard Schedule
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-[#244bd8] hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <i className="fas fa-calendar-check mr-2 text-[10px]"></i>
              <span>{loading ? 'Initializing...' : 'Finalize Schedule'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

