import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import LeadModal from '../../components/LeadModal';
import FollowupModal from '../../components/FollowupModal';

const stages = [
  { key: 'new', label: 'New', tone: 'slate', probability: 10 },
  { key: 'contacted', label: 'Contacted', tone: 'blue', probability: 25 },
  { key: 'qualified', label: 'Qualified', tone: 'cyan', probability: 40 },
  { key: 'proposal', label: 'Proposal', tone: 'amber', probability: 60 },
  { key: 'negotiation', label: 'Negotiation', tone: 'orange', probability: 75 },
  { key: 'won', label: 'Won', tone: 'green', probability: 100 },
  { key: 'lost', label: 'Lost', tone: 'red', probability: 0 },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const sourceOptions = [
  { value: 'website', label: 'Website' },
  { value: 'media', label: 'Media Lead' },
  { value: 'referral', label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'trade_show', label: 'Trade Show' },
  { value: 'other', label: 'Other' },
];

const normalizeStageKey = (status) => {
  if (status === 'closed_won') return 'won';
  if (status === 'closed_lost') return 'lost';
  return status || 'new';
};

const getStageByStatus = (status) => stages.find((stage) => stage.key === normalizeStageKey(status)) || stages[0];

export default function AdminDealsPipeline() {
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [activeView, setActiveView] = useState('board');
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [followupLeadId, setFollowupLeadId] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    priority: 'all',
    source: 'all',
    owner: 'all',
    status: 'all',
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchPipeline();
    fetchEmployees();
  }, []);

  useEffect(() => {
    const handle = setTimeout(fetchPipeline, 300);
    return () => clearTimeout(handle);
  }, [filters.search, filters.priority]);

  const employeeNameById = useMemo(() => {
    const map = new Map();
    employees.forEach((employee) => map.set(String(employee.id), employee.name || employee.email || `Employee ${employee.id}`));
    return map;
  }, [employees]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filters.source !== 'all' && String(lead.source || '') !== filters.source) return false;
      if (filters.owner !== 'all' && String(lead.assigned_to || '') !== filters.owner) return false;
      if (filters.status !== 'all' && normalizeStageKey(lead.status) !== filters.status) return false;
      return true;
    });
  }, [leads, filters.source, filters.owner, filters.status]);

  const grouped = useMemo(() => {
    return stages.reduce((acc, stage) => {
      acc[stage.key] = filteredLeads.filter((lead) => normalizeStageKey(lead.status) === stage.key);
      return acc;
    }, {});
  }, [filteredLeads]);

  const statistics = useMemo(() => {
    const openStages = new Set(['new', 'contacted', 'qualified', 'proposal', 'negotiation']);
    const openDeals = filteredLeads.filter((lead) => openStages.has(normalizeStageKey(lead.status)));
    const wonDeals = filteredLeads.filter((lead) => normalizeStageKey(lead.status) === 'won');
    const lostDeals = filteredLeads.filter((lead) => normalizeStageKey(lead.status) === 'lost');
    const openValue = openDeals.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
    const weightedValue = filteredLeads.reduce((sum, lead) => {
      const stage = getStageByStatus(lead.status);
      return sum + (Number(lead.estimated_value || 0) * stage.probability) / 100;
    }, 0);
    const totalClosed = wonDeals.length + lostDeals.length;

    return {
      total: filteredLeads.length,
      open: openDeals.length,
      won: wonDeals.length,
      lost: lostDeals.length,
      openValue,
      weightedValue,
      winRate: totalClosed ? Math.round((wonDeals.length / totalClosed) * 100) : 0,
    };
  }, [filteredLeads]);

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const params = {
        limit: 500,
        page: 1,
      };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.priority !== 'all') params.priority = filters.priority;

      const response = await api.get('/leads', { params });
      if (response.data?.success) {
        setLeads(Array.isArray(response.data.data) ? response.data.data : []);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Deals pipeline load nahi ho paaya');
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

  const updateLead = async (lead, updates) => {
    if (!lead?.id) return;
    setUpdatingId(lead.id);
    try {
      await api.put('/leads/crud', {
        id: lead.id,
        company_name: lead.company_name || '',
        contact_person: lead.contact_person || '',
        email: lead.email || '',
        phone: lead.phone || '',
        assigned_to: lead.assigned_to || '',
        source: lead.source || 'website',
        status: lead.status || 'new',
        priority: lead.priority || 'medium',
        estimated_value: lead.estimated_value || 0,
        notes: lead.notes || '',
        ...updates,
      });
      setLeads((current) => current.map((item) => (
        item.id === lead.id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
      )));
    } catch (err) {
      alert(err.response?.data?.message || 'Deal update nahi ho paaya');
    } finally {
      setUpdatingId(null);
    }
  };

  const updateStage = (lead, status) => updateLead(lead, { status });

  const handleDrop = async (stageKey) => {
    const lead = leads.find((item) => String(item.id) === String(draggedLeadId));
    setDraggedLeadId(null);
    if (!lead || normalizeStageKey(lead.status) === stageKey) return;
    await updateStage(lead, stageKey);
  };

  const openCreateLead = () => {
    setEditingLeadId(null);
    setShowLeadModal(true);
  };

  const openEditLead = (leadId) => {
    setEditingLeadId(leadId);
    setShowLeadModal(true);
  };

  const openFollowup = (leadId) => {
    setFollowupLeadId(leadId);
    setShowFollowupModal(true);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      priority: 'all',
      source: 'all',
      owner: 'all',
      status: 'all',
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
              <i className="fas fa-filter text-xl"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2c86ab]">Company Admin Panel</p>
              <h1 className="mt-1 text-2xl font-black text-gray-900">Deals Pipeline</h1>
              <p className="mt-1 text-sm text-gray-600">Track stages, revenue, probability, and sales conversion in one board</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchPipeline}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <i className="fas fa-sync-alt"></i>
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreateLead}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-sm hover:bg-blue-700"
            >
              <i className="fas fa-plus"></i>
              Add Deal
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Open Pipeline" value={formatCurrency(statistics.openValue)} icon="fa-chart-line" tone="blue" />
        <SummaryCard label="Weighted Value" value={formatCurrency(statistics.weightedValue)} icon="fa-scale-balanced" tone="indigo" />
        <SummaryCard label="Open Deals" value={statistics.open} icon="fa-folder-open" tone="amber" />
        <SummaryCard label="Win Rate" value={`${statistics.winRate}%`} icon="fa-trophy" tone="green" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 xl:grid-cols-[1fr_160px_160px_170px_170px_auto]">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search company, contact, email, phone"
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <FilterSelect value={filters.status} onChange={(status) => setFilters((current) => ({ ...current, status }))} options={stages} allLabel="All Stages" />
          <FilterSelect value={filters.priority} onChange={(priority) => setFilters((current) => ({ ...current, priority }))} options={priorityOptions} allLabel="All Priority" />
          <FilterSelect value={filters.source} onChange={(source) => setFilters((current) => ({ ...current, source }))} options={sourceOptions} allLabel="All Sources" />
          <select
            value={filters.owner}
            onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))}
            className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="all">All Owners</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name || employee.email}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setActiveView('board')}
              className={`rounded-lg px-4 py-2 text-sm font-black ${activeView === 'board' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setActiveView('table')}
              className={`rounded-lg px-4 py-2 text-sm font-black ${activeView === 'table' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}
            >
              Table
            </button>
          </div>
          <p className="text-sm font-semibold text-gray-500">
            {statistics.total} deal(s), {statistics.won} won, {statistics.lost} lost
          </p>
        </div>

        {activeView === 'board' ? (
          <div className="overflow-x-auto p-4">
            <div className="grid min-w-[1300px] grid-cols-7 gap-4">
              {stages.map((stage) => {
                const stageLeads = grouped[stage.key] || [];
                const stageValue = stageLeads.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
                return (
                  <div
                    key={stage.key}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(stage.key)}
                    className="min-h-[560px] rounded-2xl border border-gray-200 bg-gray-50"
                  >
                    <div className="sticky top-0 z-10 rounded-t-2xl border-b border-gray-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-gray-900">{stage.label}</p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">{stageLeads.length} deals - {formatCurrency(stageValue)}</p>
                        </div>
                        <StageDot tone={stage.tone} />
                      </div>
                    </div>
                    <div className="space-y-3 p-3">
                      {loading ? (
                        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm font-semibold text-gray-400">Loading...</div>
                      ) : stageLeads.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-white/70 p-4 text-center text-xs font-bold text-gray-400">
                          Drop deals here
                        </div>
                      ) : stageLeads.map((lead) => (
                        <DealCard
                          key={lead.id}
                          lead={lead}
                          stage={stage}
                          employeeName={employeeNameById.get(String(lead.assigned_to))}
                          updating={updatingId === lead.id}
                          onDragStart={() => setDraggedLeadId(lead.id)}
                          onEdit={() => openEditLead(lead.id)}
                          onFollowup={() => openFollowup(lead.id)}
                          onMeeting={() => navigate(`/admin/calendar?lead_id=${lead.id}`)}
                          onStageChange={(status) => updateStage(lead, status)}
                          onPriorityChange={(priority) => updateLead(lead, { priority })}
                          onValueCommit={(value) => updateLead(lead, { estimated_value: value })}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <PipelineTable
            leads={filteredLeads}
            loading={loading}
            employees={employeeNameById}
            updatingId={updatingId}
            onEdit={openEditLead}
            onFollowup={openFollowup}
            onStageChange={updateStage}
            onPriorityChange={(lead, priority) => updateLead(lead, { priority })}
            onValueCommit={(lead, value) => updateLead(lead, { estimated_value: value })}
          />
        )}
      </div>

      {showLeadModal && (
        <LeadModal
          showModal={showLeadModal}
          setShowModal={setShowLeadModal}
          leadId={editingLeadId}
          presentation="contained"
          title={editingLeadId ? 'Edit Deal' : 'Add Deal'}
          onSuccess={() => {
            setShowLeadModal(false);
            setEditingLeadId(null);
            fetchPipeline();
          }}
        />
      )}

      {showFollowupModal && (
        <FollowupModal
          leadId={followupLeadId}
          onClose={() => {
            setShowFollowupModal(false);
            setFollowupLeadId(null);
          }}
          onSuccess={() => {
            setShowFollowupModal(false);
            setFollowupLeadId(null);
            fetchPipeline();
          }}
        />
      )}
    </div>
  );
}

function DealCard({
  lead,
  stage,
  employeeName,
  updating,
  onDragStart,
  onEdit,
  onFollowup,
  onMeeting,
  onStageChange,
  onPriorityChange,
  onValueCommit,
}) {
  const [valueDraft, setValueDraft] = useState(String(Number(lead.estimated_value || 0)));

  useEffect(() => {
    setValueDraft(String(Number(lead.estimated_value || 0)));
  }, [lead.estimated_value]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md ${updating ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-gray-900">{lead.company_name || 'Unnamed Deal'}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">{lead.contact_person || '-'} - {lead.lead_code || `#${lead.id}`}</p>
        </div>
        <PriorityBadge priority={lead.priority} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-gray-50 p-2">
          <p className="font-bold text-gray-400">Value</p>
          <input
            type="number"
            min="0"
            value={valueDraft}
            onChange={(event) => setValueDraft(event.target.value)}
            onBlur={() => onValueCommit(Number(valueDraft || 0))}
            className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-black text-gray-900 outline-none focus:border-blue-500"
          />
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <p className="font-bold text-gray-400">Weighted</p>
          <p className="mt-2 font-black text-gray-900">{formatCurrency((Number(lead.estimated_value || 0) * stage.probability) / 100)}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <select
          value={normalizeStageKey(lead.status)}
          onChange={(event) => onStageChange(event.target.value)}
          className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs font-black outline-none focus:border-blue-500"
        >
          {stages.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
        <select
          value={lead.priority || 'medium'}
          onChange={(event) => onPriorityChange(event.target.value)}
          className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs font-black outline-none focus:border-blue-500"
        >
          {priorityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <div className="mt-3 text-xs font-semibold text-gray-500">
        <p>Owner: {employeeName || 'Unassigned'}</p>
        <p>Source: {lead.source || '-'}</p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <button type="button" onClick={onEdit} className="text-xs font-black text-blue-700 hover:text-blue-800">Edit</button>
        <button type="button" onClick={onFollowup} className="text-xs font-black text-amber-700 hover:text-amber-800">Follow-up</button>
        <button type="button" onClick={onMeeting} className="text-xs font-black text-indigo-700 hover:text-indigo-800">Meeting</button>
      </div>
    </div>
  );
}

function PipelineTable({ leads, loading, employees, updatingId, onEdit, onFollowup, onStageChange, onPriorityChange, onValueCommit }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
            <th className="px-4 py-4">Deal</th>
            <th className="px-4 py-4">Owner</th>
            <th className="px-4 py-4">Stage</th>
            <th className="px-4 py-4">Priority</th>
            <th className="px-4 py-4 text-right">Value</th>
            <th className="px-4 py-4 text-right">Weighted</th>
            <th className="px-4 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr>
              <td className="px-4 py-14 text-center text-sm font-semibold text-gray-400" colSpan="7">Loading deals...</td>
            </tr>
          ) : leads.length === 0 ? (
            <tr>
              <td className="px-4 py-14 text-center text-sm font-semibold text-gray-400" colSpan="7">No deals found</td>
            </tr>
          ) : leads.map((lead) => {
            const stage = getStageByStatus(lead.status);
            return (
              <tr key={lead.id} className={updatingId === lead.id ? 'bg-blue-50/50 opacity-70' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3">
                  <p className="text-sm font-black text-gray-900">{lead.company_name || '-'}</p>
                  <p className="text-xs text-gray-500">{lead.contact_person || '-'} - {lead.lead_code || `#${lead.id}`}</p>
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-800">{employees.get(String(lead.assigned_to)) || 'Unassigned'}</td>
                <td className="px-4 py-3">
                  <select
                    value={normalizeStageKey(lead.status)}
                    onChange={(event) => onStageChange(lead, event.target.value)}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs font-black"
                  >
                    {stages.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={lead.priority || 'medium'}
                    onChange={(event) => onPriorityChange(lead, event.target.value)}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs font-black"
                  >
                    {priorityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    min="0"
                    defaultValue={Number(lead.estimated_value || 0)}
                    onBlur={(event) => onValueCommit(lead, Number(event.target.value || 0))}
                    className="h-9 w-28 rounded-lg border border-gray-200 bg-white px-2 text-right text-sm font-black"
                  />
                </td>
                <td className="px-4 py-3 text-right text-sm font-black text-gray-900">
                  {formatCurrency((Number(lead.estimated_value || 0) * stage.probability) / 100)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => onEdit(lead.id)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Edit</button>
                    <button type="button" onClick={() => onFollowup(lead.id)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">Follow-up</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
      {options.map((option) => (
        <option key={option.key || option.value} value={option.key || option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function SummaryCard({ label, value, icon, tone }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    green: 'border-green-100 bg-green-50 text-green-700',
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
    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[value] || tones.medium}`}>
      {value}
    </span>
  );
}

function StageDot({ tone }) {
  const tones = {
    slate: 'bg-slate-500',
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
  };
  return <span className={`h-3 w-3 rounded-full ${tones[tone] || tones.blue}`}></span>;
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return `INR ${number.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
