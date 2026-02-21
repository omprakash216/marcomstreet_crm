import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function LeadModal({ showModal, setShowModal, leadId, onSuccess }) {
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    assigned_to: '',
    source: 'website',
    status: 'new',
    priority: 'medium',
    estimated_value: '',
    notes: ''
  });
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (showModal) {
      fetchEmployees();
      if (leadId) {
        setIsEditing(true);
        fetchLead(leadId);
      } else {
        setIsEditing(false);
        resetForm();
      }
    }
  }, [showModal, leadId]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/admin/employees');
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchLead = async (id) => {
    try {
      setLoading(true);
      const response = await api.get(`/leads?id=${id}`);
      if (response.data.success && response.data.data.length > 0) {
        const lead = response.data.data[0];
        setFormData({
          company_name: lead.company_name || '',
          contact_person: lead.contact_person || '',
          email: lead.email || '',
          phone: lead.phone || '',
          assigned_to: lead.assigned_to || '',
          source: lead.source || 'website',
          status: lead.status || 'new',
          priority: lead.priority || 'medium',
          estimated_value: lead.estimated_value || '',
          notes: lead.notes || ''
        });
      }
    } catch (error) {
      console.error('Error fetching lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      contact_person: '',
      email: '',
      phone: '',
      assigned_to: '',
      source: 'website',
      status: 'new',
      priority: 'medium',
      estimated_value: '',
      notes: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let response;
      if (isEditing) {
        // Update lead
        response = await api.put('/leads/crud', { ...formData, id: leadId });
      } else {
        // Create new lead
        response = await api.post('/leads/crud', formData);
      }

      if (response.data.success) {
        alert(`Lead ${isEditing ? 'updated' : 'created'} successfully!`);
        setShowModal(false);
        resetForm();
        if (onSuccess) onSuccess();
      } else {
        alert('Error: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      alert('Error saving lead: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[1.5rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200">
        {/* Modal Header */}
        <div className="bg-[#244bd8] p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
              <i className={`fas ${isEditing ? 'fa-edit' : 'fa-plus-circle'} text-xl`}></i>
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">
                {isEditing ? 'Modify Potential Lead' : 'Create New Lead'}
              </h2>
              <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">Lead Management System</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(false)}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-8">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-building text-blue-500 w-4 text-center"></i>
                  <span>Company Name *</span>
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter company name"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-user-tie text-blue-500 w-4 text-center"></i>
                  <span>Contact Person *</span>
                </label>
                <input
                  type="text"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleInputChange}
                  required
                  placeholder="Full name of contact"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-envelope text-blue-500 w-4 text-center"></i>
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="example@company.com"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-phone text-blue-500 w-4 text-center"></i>
                  <span>Phone Number</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-user-check text-blue-500 w-4 text-center"></i>
                  <span>Assigned Representative</span>
                </label>
                <select
                  name="assigned_to"
                  value={formData.assigned_to}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                >
                  <option value="">Select Employee</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-share-nodes text-blue-500 w-4 text-center"></i>
                  <span>Lead Source</span>
                </label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                >
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="social_media">Social Media</option>
                  <option value="cold_call">Cold Call</option>
                  <option value="trade_show">Trade Show</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-signal text-blue-500 w-4 text-center"></i>
                  <span>Operational Status</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="closed_won">Closed Won</option>
                  <option value="closed_lost">Closed Lost</option>
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-arrow-up-wide-short text-blue-500 w-4 text-center"></i>
                  <span>Priority Level</span>
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-indian-rupee-sign text-blue-500 w-4 text-center"></i>
                  <span>Est. Deal Value</span>
                </label>
                <input
                  type="number"
                  name="estimated_value"
                  value={formData.estimated_value}
                  onChange={handleInputChange}
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  <i className="fas fa-sticky-note text-blue-500 w-4 text-center"></i>
                  <span>Additional Notes</span>
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={1}
                  placeholder="Comments..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-sm min-h-[38px] resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-50">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-[#244bd8] hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-check-circle'} text-[10px]`}></i>
              <span>{loading ? 'Processing...' : (isEditing ? 'Sync Lead' : 'Initialize Lead')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

