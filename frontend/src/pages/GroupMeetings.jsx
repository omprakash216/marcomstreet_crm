import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';

export default function GroupMeetings() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [filter, setFilter] = useState({
    search: '',
    status: '',
    date_filter: 'all'
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    duration: 60,
    location: '',
    meeting_type: 'internal',
    priority: 'medium',
    participants: [],
    agenda_items: [''],
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [filter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [meetingsRes, employeesRes] = await Promise.all([
        api.get('/group-meetings'),
        api.get('/employees')
      ]);

      if (meetingsRes.data.success) {
        setMeetings(meetingsRes.data.data);
      }
      if (employeesRes.data.success) {
        setEmployees(employeesRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.search) params.append('search', filter.search);
      if (filter.date_filter !== 'all') params.append('date_filter', filter.date_filter);

      const response = await api.get(`/group-meetings?${params.toString()}`);
      if (response.data.success) {
        setMeetings(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching meetings:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        agenda_items: formData.agenda_items.filter(item => item.trim() !== '')
      };

      const response = editingMeeting
        ? await api.put(`/group-meetings/${editingMeeting.id}`, data)
        : await api.post('/group-meetings', data);

      if (response.data.success) {
        fetchMeetings();
        resetForm();
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error saving meeting:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: '',
      time: '',
      duration: 60,
      location: '',
      meeting_type: 'internal',
      priority: 'medium',
      participants: [],
      agenda_items: [''],
      notes: ''
    });
    setEditingMeeting(null);
  };

  const handleEdit = (meeting) => {
    setEditingMeeting(meeting);
    setFormData({
      title: meeting.title,
      description: meeting.description || '',
      date: meeting.date,
      time: meeting.time,
      duration: meeting.duration || 60,
      location: meeting.location || '',
      meeting_type: meeting.meeting_type || 'internal',
      priority: meeting.priority || 'medium',
      participants: meeting.participants || [],
      agenda_items: meeting.agenda_items || [''],
      notes: meeting.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (meetingId) => {
    if (window.confirm('Are you sure you want to delete this group meeting?')) {
      try {
        await api.delete(`/group-meetings/${meetingId}`);
        fetchMeetings();
      } catch (err) {
        console.error('Error deleting meeting:', err);
      }
    }
  };

  const handleStatusChange = async (meetingId, newStatus) => {
    try {
      await api.patch(`/group-meetings/${meetingId}/status`, { status: newStatus });
      fetchMeetings();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const addAgendaItem = () => {
    setFormData({
      ...formData,
      agenda_items: [...formData.agenda_items, '']
    });
  };

  const removeAgendaItem = (index) => {
    setFormData({
      ...formData,
      agenda_items: formData.agenda_items.filter((_, i) => i !== index)
    });
  };

  const updateAgendaItem = (index, value) => {
    const newAgendaItems = [...formData.agenda_items];
    newAgendaItems[index] = value;
    setFormData({
      ...formData,
      agenda_items: newAgendaItems
    });
  };

  const toggleParticipant = (employeeId) => {
    setFormData({
      ...formData,
      participants: formData.participants.includes(employeeId)
        ? formData.participants.filter(id => id !== employeeId)
        : [...formData.participants, employeeId]
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading group meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 rounded-xl shadow-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
              <i className="fas fa-users text-white text-3xl"></i>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Group Meetings</h1>
              <p className="text-indigo-100 text-sm md:text-base">Manage team meetings and collaborative sessions</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-all font-semibold flex items-center space-x-2"
          >
            <i className="fas fa-plus"></i>
            <span>Schedule Meeting</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="text"
            placeholder="Search meetings..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="flex-1 min-w-[200px] border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={filter.date_filter}
            onChange={(e) => setFilter({ ...filter, date_filter: e.target.value })}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>
      </div>

      {/* Meetings List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 px-6 py-4 border-b border-gray-200/50">
          <h3 className="text-lg font-bold text-white flex items-center">
            <i className="fas fa-calendar-alt mr-3"></i>
            Group Meetings ({meetings.length})
          </h3>
        </div>

        <div className="divide-y divide-gray-200">
          {meetings.length > 0 ? (
            meetings.map((meeting) => (
              <div key={meeting.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">{meeting.title}</h4>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(meeting.status)}`}>
                        {meeting.status}
                      </span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(meeting.priority)}`}>
                        {meeting.priority}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <i className="fas fa-calendar mr-2 text-indigo-600"></i>
                        {new Date(meeting.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <i className="fas fa-clock mr-2 text-indigo-600"></i>
                        {meeting.time} ({meeting.duration}min)
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <i className="fas fa-users mr-2 text-indigo-600"></i>
                        {meeting.participants_count || meeting.participants?.length || 0} participants
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <i className="fas fa-map-marker-alt mr-2 text-indigo-600"></i>
                        {meeting.location || 'TBD'}
                      </div>
                    </div>

                    {meeting.description && (
                      <p className="text-sm text-gray-700 mb-3 line-clamp-2">{meeting.description}</p>
                    )}

                    {meeting.participants && meeting.participants.length > 0 && (
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="text-sm text-gray-600">Participants:</span>
                        <div className="flex -space-x-2">
                          {meeting.participants.slice(0, 5).map((participant, index) => (
                            <div
                              key={index}
                              className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white"
                              title={participant.name}
                            >
                              {participant.name?.charAt(0) || '?'}
                            </div>
                          ))}
                          {meeting.participants.length > 5 && (
                            <div className="w-8 h-8 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white">
                              +{meeting.participants.length - 5}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <select
                      value={meeting.status}
                      onChange={(e) => handleStatusChange(meeting.id, e.target.value)}
                      className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button
                      onClick={() => handleEdit(meeting)}
                      className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg"
                      title="Edit"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(meeting.id)}
                      className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-calendar-alt text-gray-400 text-4xl mb-4"></i>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No group meetings found</h3>
              <p className="text-gray-500">Schedule your first group meeting to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Meeting Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between sticky top-0">
              <h2 className="text-xl font-bold text-white">
                {editingMeeting ? 'Edit Group Meeting' : 'Schedule Group Meeting'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-white hover:text-gray-200"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter meeting title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Type</label>
                  <select
                    value={formData.meeting_type}
                    onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="internal">Internal Meeting</option>
                    <option value="client">Client Meeting</option>
                    <option value="training">Training Session</option>
                    <option value="review">Review Meeting</option>
                    <option value="brainstorming">Brainstorming</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Meeting description and objectives"
                />
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                  <input
                    type="number"
                    min="15"
                    max="480"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Meeting location or virtual link"
                />
              </div>

              {/* Participants */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Select Participants</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto border rounded-lg p-4">
                  {employees.map((employee) => (
                    <label key={employee.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.participants.includes(employee.id)}
                        onChange={() => toggleParticipant(employee.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold">
                          {employee.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900">{employee.name}</span>
                          <span className="text-xs text-gray-500 block">{employee.role}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                {formData.participants.length > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    {formData.participants.length} participant{formData.participants.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              {/* Agenda Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Agenda Items</label>
                {formData.agenda_items.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateAgendaItem(index, e.target.value)}
                      className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={`Agenda item ${index + 1}`}
                    />
                    {formData.agenda_items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAgendaItem(index)}
                        className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg"
                      >
                        <i className="fas fa-minus"></i>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAgendaItem}
                  className="mt-2 px-4 py-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg flex items-center space-x-2"
                >
                  <i className="fas fa-plus"></i>
                  <span>Add Agenda Item</span>
                </button>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Any additional notes or preparations needed"
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
                >
                  <i className="fas fa-save"></i>
                  <span>{editingMeeting ? 'Update Meeting' : 'Schedule Meeting'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}