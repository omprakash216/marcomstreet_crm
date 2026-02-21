import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function MeetingModal({ onClose, onSuccess }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    lead_id: '',
    title: '',
    description: '',
    meeting_date: '',
    meeting_time: '',
    duration_minutes: 60,
    location: '',
    meeting_type: 'client_meeting',
  });

  useEffect(() => {
    fetchLeads();
  }, []);

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[1.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
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

        <form onSubmit={handleSubmit} className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-8">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-user-tag text-blue-500 w-4 text-center"></i>
                  <span>Associate Lead</span>
                </label>
                <select
                  value={formData.lead_id}
                  onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
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
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    value={formData.meeting_time}
                    onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
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
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-tags text-blue-500 w-4 text-center"></i>
                  <span>Meeting Category</span>
                </label>
                <select
                  value={formData.meeting_type}
                  onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
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
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
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
                  rows={4}
                  placeholder="Summary of objectives and topics..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm min-h-[118px] resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-[#244bd8] hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
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

