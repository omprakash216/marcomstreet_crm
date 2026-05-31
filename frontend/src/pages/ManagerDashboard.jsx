import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

import { getEmployee } from '../utils/auth';
import MeetingCalendar from '../components/MeetingCalendar';
import WorkingHoursCard from '../components/WorkingHoursCard';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const IconUsers = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IconCalendar = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IconCheckCircle = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconCurrency = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 7h8" />
    <path d="M8 10h8" />
    <path d="m8 13 5.5 5" />
    <path d="M8 13h2" />
    <path d="M10 13c4.5 0 4.5-6 0-6" />
  </svg>
);

const IconTrendingUp = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const IconTarget = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconBriefcase = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V8a2 2 0 01-2 2H8a2 2 0 01-2-2V6m8 0H8m0 0V4" />
  </svg>
);

export default function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [targetForm, setTargetForm] = useState({ user_id: '', target_value: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    let result = employees;
    if (searchTerm) {
      result = result.filter(emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (roleFilter !== 'all') {
      result = result.filter(emp => emp.role === roleFilter);
    }
    setFilteredEmployees(result);
  }, [employees, searchTerm, roleFilter]);

  const navigate = useNavigate();
  const employee = getEmployee();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard');
      if (response.data.success) {
        setStats(response.data.data);
      }
      setRecentActivities([
        { id: 1, type: 'lead', title: 'New lead: Tech Solutions', time: '2 hours ago' },
        { id: 2, type: 'meeting', title: 'Meeting scheduled with Mega Corp', time: '4 hours ago' },
        { id: 3, type: 'task', title: 'Follow-up task completed', time: '6 hours ago' },
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'lead': navigate('/leads'); break;
      case 'meeting': navigate('/meetings'); break;
      case 'task': navigate('/tasks'); break;
      case 'report': navigate('/reports'); break;
      default: break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Manager Dashboard...</p>
        </div>
      </div>
    );
  }




  const fetchEmployees = async () => {
    try {
      const response = await api.get('/manager/targets');
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleSetTarget = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/manager/targets', {
        user_id: targetForm.user_id,
        target_value: targetForm.target_value,
        metric_type: 'leads' // Defaulting to leads for now
      });
      if (response.data.success) {
        alert('Target updated successfully!');
        setTargetForm({ user_id: '', target_value: 0 }); // Close modal
        fetchEmployees(); // Refresh list
      }
    } catch (error) {
      alert('Failed to set target');
    }
  };

  const openTargetModal = () => {
    fetchEmployees();
    setShowTargetModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Dashboard Overview</h2>
        <button
          onClick={openTargetModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-semibold flex items-center space-x-2 shadow-md hover:shadow-lg"
        >
          <IconTarget />
          <span>Set Team Targets</span>
        </button>
      </div>

      <WorkingHoursCard className="mb-8" />



      {/* Manager Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-6">
        <StatCard title="Team Members" value={stats?.team_members} icon={<IconUsers />} color="blue" />
        <StatCard title="Active Leads" value={stats?.active_leads} icon={<IconTarget />} color="green" />
        <StatCard title="Pending Tasks" value={stats?.pending_tasks} icon={<IconCalendar />} color="yellow" />
        <StatCard title="Monthly Revenue" value={`₹${stats?.monthly_revenue || 0}`} icon={<IconCurrency />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Team Performance Chart */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <IconTrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            Team Performance
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={[
              { month: 'Jan', leads: 20, meetings: 15, deals: 5 },
              { month: 'Feb', leads: 25, meetings: 18, deals: 7 },
              { month: 'Mar', leads: 30, meetings: 22, deals: 9 },
              { month: 'Apr', leads: 35, meetings: 25, deals: 12 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="leads" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
              <Area type="monotone" dataKey="meetings" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
              <Area type="monotone" dataKey="deals" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Team Activities</h3>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <div className={`p-2 rounded-lg bg-white shadow-sm ${activity.type === 'lead' ? 'text-blue-600' :
                  activity.type === 'meeting' ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                  {activity.type === 'lead' && <IconUsers className="w-5 h-5" />}
                  {activity.type === 'meeting' && <IconCalendar className="w-5 h-5" />}
                  {activity.type === 'task' && <IconCheckCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{activity.title}</p>
                  <p className="text-xs text-gray-500 font-medium">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Select Target Modal */}
      {/* Select Target Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            {/* Modal Header with Search and Filter */}
            <div className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col gap-4 flex-shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Team Targets</h3>
                  <p className="text-xs text-gray-500">Manage performance goals for your team members.</p>
                </div>
                <button onClick={() => setShowTargetModal(false)} className="text-gray-400 hover:text-red-500 transition-colors bg-gray-50 hover:bg-red-50 p-2 rounded-full">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Search and Filters Toolbar */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="sales_rep">Sales Rep</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
            </div>

            <div className="p-0 overflow-y-auto flex-1 custom-scrollbar bg-gray-50/50">
              {filteredEmployees.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold sticky top-0 z-10 shadow-sm backdrop-blur-sm bg-gray-50/90">
                    <tr>
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4 text-center">Role</th>
                      <th className="px-6 py-4 text-center">Current Target</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredEmployees.map(emp => (
                      <tr key={emp.id} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold mr-3 transition-colors ${emp.current_target > 0
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
                              }`}>
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <span className="block font-semibold text-gray-900 text-sm">{emp.name}</span>
                              <span className="block text-xs text-gray-400 font-medium">{emp.department || 'General'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize border border-blue-100">
                            {emp.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {emp.current_target > 0 ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="text-sm font-bold text-gray-900">{emp.current_target}</span>
                              <span className="text-[10px] text-gray-500 uppercase tracking-wide">Leads</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Not set</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setTargetForm({ user_id: emp.id, target_value: emp.current_target || 0 })}
                            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95"
                          >
                            Set Target
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <p className="text-gray-900 font-medium">No employees found</p>
                  <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
              <span className="text-xs text-gray-500">Select an employee from the list to assign or update their monthly target.</span>
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL SET TARGET POPUP MODAL */}
      {targetForm.user_id && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold">Assign Target</h3>
              <button onClick={() => setTargetForm({ user_id: '', target_value: 0 })} className="text-white/70 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg mr-3 border border-blue-200">
                  {employees.find(e => e.id === targetForm.user_id)?.name?.charAt(0)}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Employee</p>
                  <p className="text-sm font-bold text-gray-900">{employees.find(e => e.id === targetForm.user_id)?.name}</p>
                </div>
              </div>

              <form onSubmit={handleSetTarget}>
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Monthly Target (Leads)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      required
                      value={targetForm.target_value}
                      onChange={(e) => setTargetForm({ ...targetForm, target_value: parseInt(e.target.value) })}
                      className="w-full pl-4 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-lg font-bold text-gray-900 outline-none"
                      placeholder="0"
                      autoFocus
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
                      Leads
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 ml-1">Set the minimum number of leads required for this month.</p>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setTargetForm({ user_id: '', target_value: 0 })}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all transform active:scale-95"
                  >
                    Save Target
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600'
  };
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-100">
      <div className="flex items-center">
        <div className={`p-4 rounded-xl ${colors[color]} shadow-sm`}>{icon}</div>
        <div className="ml-5">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">{title}</p>
          <p className="text-2xl font-black text-gray-900">{value || 0}</p>
        </div>
      </div>
    </div>
  );
}


