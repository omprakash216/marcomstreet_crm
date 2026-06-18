import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';

const statusOptions = ['Draft', 'Submitted', 'Under Review', 'Investigation', 'Hearing Scheduled', 'Resolved', 'Closed', 'Rejected'];
const severityOptions = ['Low', 'Medium', 'High', 'Critical'];
const actionOptions = ['Warning', 'Counseling', 'Suspension', 'Termination', 'Transfer', 'No Action', 'Other'];

function Badge({ value }) {
  const text = String(value || 'Pending');
  const color =
    text === 'Critical'
      ? 'bg-red-100 text-red-700 border-red-200'
      : text.includes('Closed') || text.includes('Resolved')
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : text.includes('Investigation') || text.includes('Hearing')
          ? 'bg-amber-100 text-amber-700 border-amber-200'
          : 'bg-blue-100 text-blue-700 border-blue-200';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${color}`}>{text}</span>;
}

function StatCard({ label, value, icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-50 text-slate-700',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value ?? 0}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tones[tone] || tones.blue}`}>
          <i className={`fas ${icon}`} />
        </div>
      </div>
    </div>
  );
}

export default function POSHPortal({ mode = 'employee' }) {
  const currentEmployee = getEmployee();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const initialTab = searchParams.get('tab') || 'dashboard';
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [dashboard, setDashboard] = useState({});
  const [complaints, setComplaints] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [iccMembers, setIccMembers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reports, setReports] = useState({});
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [files, setFiles] = useState([]);

  const [complaintForm, setComplaintForm] = useState({
    complaint_title: '',
    complaint_description: '',
    accused_name: '',
    accused_department: '',
    incident_date: '',
    incident_location: '',
    complaint_type: 'Workplace Harassment',
    severity_level: 'Medium',
    anonymous_complaint: false,
    witness_name: '',
    witness_contact: '',
  });
  const [iccForm, setIccForm] = useState({
    member_name: '',
    employee_id: '',
    role: 'ICC Member',
    email: '',
    phone: '',
    status: 'active',
    start_date: '',
    end_date: '',
  });
  const [managerForm, setManagerForm] = useState({
    complaint_id: '',
    assigned_to: '',
    status: 'Under Review',
    investigation_notes: '',
    hearing_date: '',
    hearing_time: '',
    meeting_mode: 'Offline',
    meeting_location: '',
    meeting_link: '',
    final_decision: '',
    action_taken: 'Warning',
    resolution_summary: '',
    message: '',
  });

  const isEmployee = mode === 'employee';
  const isSuperAdmin = mode === 'superadmin';
  const role = normalizeRole(currentEmployee?.role);
  const isHrAdminUser = ['admin', 'manager', 'superadmin', 'super_admin', 'human_resources', 'human_resource', 'hr', 'hr_manager', 'hr_admin'].includes(role);
  const isPoshWorkspace = mode === 'hr' || mode === 'admin';
  const isCommitteeOnly = isPoshWorkspace && !isHrAdminUser;
  const canManageWorkflow = isPoshWorkspace && isHrAdminUser;
  const canViewAssignedWorkspace = isPoshWorkspace;
  const canManageIcc = canManageWorkflow;
  const canUpdateStatus = canManageWorkflow;
  const canAssignComplaint = canManageWorkflow;
  const canScheduleHearing = canManageWorkflow;
  const canSaveResolution = canManageWorkflow;
  const canAddInvestigation = canViewAssignedWorkspace;
  const canViewReports = canManageWorkflow;
  const canManageSettings = canManageWorkflow;

  const apiBase = useMemo(() => {
    if (isSuperAdmin) return '/superadmin/posh';
    if (isEmployee) return '/employee/posh';
    return '/hr/posh';
  }, [isEmployee, isSuperAdmin]);

  const tabs = useMemo(() => {
    if (isSuperAdmin) return ['dashboard', 'access', 'reports', 'audit', 'settings'];
    if (isEmployee) return ['dashboard', 'raise', 'my-complaints', 'evidence', 'messages'];
    if (canManageWorkflow) return ['dashboard', 'complaints', 'icc', 'investigations', 'hearings', 'evidence', 'reports', 'settings'];
    return ['dashboard', 'complaints', 'investigations', 'evidence', 'messages'];
  }, [canManageWorkflow, isEmployee, isSuperAdmin]);

  useEffect(() => {
    const next = searchParams.get('tab') || 'dashboard';
    setTab(tabs.includes(next) ? next : 'dashboard');
  }, [location.search, searchParams, tabs]);

  useEffect(() => {
    if (!tabs.includes(tab)) {
      setTab('dashboard');
      setSearchParams({}, { replace: true });
    }
  }, [tab, tabs, setSearchParams]);

  useEffect(() => {
    loadData();
  }, [apiBase, mode]);

  const switchTab = (next) => {
    setTab(next);
    if (next === 'dashboard') setSearchParams({});
    else setSearchParams({ tab: next });
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      if (isSuperAdmin) {
        const [companiesRes, reportsRes, auditRes] = await Promise.all([
          api.get('/superadmin/modules/companies'),
          api.get('/superadmin/posh/reports'),
          api.get('/superadmin/posh/audit-logs'),
        ]);
        setCompanies(companiesRes.data?.data || []);
        setReports(reportsRes.data?.data || {});
        setAuditLogs(auditRes.data?.data || []);
      } else if (isEmployee) {
        const [dashRes, complaintRes] = await Promise.all([
          api.get('/employee/posh/dashboard'),
          api.get('/employee/posh/my-complaints'),
        ]);
        setDashboard(dashRes.data?.data || {});
        setComplaints(complaintRes.data?.data || []);
      } else {
        const [dashRes, complaintRes] = await Promise.all([
          api.get('/hr/posh/dashboard'),
          api.get('/hr/posh/complaints'),
        ]);
        setDashboard(dashRes.data?.data || {});
        setComplaints(complaintRes.data?.data || []);
        if (canManageIcc) {
          const iccRes = await api.get('/hr/posh/icc-members');
          setIccMembers(iccRes.data?.data || []);
        } else {
          setIccMembers([]);
        }
      }
    } catch (err) {
      const text = err.response?.data?.message || err.message || 'POSH module load nahi ho paya.';
      setLoadError(text);
      showMessage('error', text);
    } finally {
      setLoading(false);
    }
  };

  const submitComplaint = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/employee/posh/complaints', complaintForm);
      showMessage('success', res.data?.message || 'Complaint submitted.');
      setComplaintForm((prev) => ({ ...prev, complaint_title: '', complaint_description: '' }));
      await loadData();
      switchTab('my-complaints');
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const loadComplaintDetail = async (complaint) => {
    try {
      setSelectedComplaint(complaint);
      setDetail(null);
      const endpoint = isEmployee ? `/employee/posh/complaints/${complaint.id}` : `/hr/posh/complaints/${complaint.id}`;
      const res = await api.get(endpoint);
      setDetail(res.data?.data || null);
      setDetailTab('overview');
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const uploadEvidence = async (e) => {
    e.preventDefault();
    const targetId = managerForm.complaint_id || selectedComplaint?.id;
    if (!targetId || !files.length) {
      showMessage('error', 'Complaint select karein aur evidence file choose karein.');
      return;
    }
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append('files', file));
      const endpoint = isEmployee
        ? `/employee/posh/complaints/${targetId}/evidence`
        : `/hr/posh/complaints/${targetId}/evidence`;
      const res = await api.post(endpoint, form);
      showMessage('success', res.data?.message || 'Evidence uploaded.');
      setFiles([]);
      if (selectedComplaint) await loadComplaintDetail(selectedComplaint);
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const saveIccMember = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/hr/posh/icc-members', iccForm);
      showMessage('success', res.data?.message || 'ICC member saved.');
      setIccForm({ member_name: '', employee_id: '', role: 'ICC Member', email: '', phone: '', status: 'active', start_date: '', end_date: '' });
      await loadData();
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const updateStatus = async (complaintId, status = managerForm.status) => {
    try {
      const res = await api.put(`/hr/posh/complaints/${complaintId}/status`, { status });
      showMessage('success', res.data?.message || 'Status updated.');
      await loadData();
      if (selectedComplaint?.id === complaintId) await loadComplaintDetail(selectedComplaint);
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const assignComplaint = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/hr/posh/complaints/${managerForm.complaint_id}/assign`, {
        assigned_to: managerForm.assigned_to,
      });
      showMessage('success', res.data?.message || 'Assigned.');
      await loadData();
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const addInvestigation = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/hr/posh/complaints/${managerForm.complaint_id}/investigations`, {
        notes: managerForm.investigation_notes,
        status: 'Open',
      });
      showMessage('success', res.data?.message || 'Investigation note saved.');
      await loadData();
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const scheduleHearing = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/hr/posh/hearings', managerForm);
      showMessage('success', res.data?.message || 'Hearing scheduled.');
      await loadData();
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const saveResolution = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/hr/posh/resolution', managerForm);
      showMessage('success', res.data?.message || 'Resolution saved.');
      await loadData();
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const targetId = selectedComplaint?.id || managerForm.complaint_id;
    if (!targetId || !managerForm.message.trim()) return;
    try {
      const endpoint = isEmployee
        ? `/employee/posh/complaints/${targetId}/messages`
        : `/hr/posh/complaints/${targetId}/messages`;
      const res = await api.post(endpoint, { message: managerForm.message });
      showMessage('success', res.data?.message || 'Message sent.');
      setManagerForm((prev) => ({ ...prev, message: '' }));
      if (selectedComplaint) await loadComplaintDetail(selectedComplaint);
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const downloadEvidence = async (evidence) => {
    try {
      const endpoint = isEmployee
        ? `/employee/posh/evidence/${evidence.id}/download`
        : `/hr/posh/evidence/${evidence.id}/download`;
      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = evidence.original_name || 'posh-evidence';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const toggleCompanyPosh = async (company, enable) => {
    try {
      const endpoint = enable ? '/superadmin/modules/posh/enable' : '/superadmin/modules/posh/disable';
      const res = await api.post(endpoint, { company_id: company.id });
      showMessage('success', res.data?.message || 'Company POSH access updated.');
      await loadData();
    } catch (err) {
      showMessage('error', err.response?.data?.message || err.message);
    }
  };

  const stats = dashboard.stats || reports.summary || {};
  const complaintChoices = complaints || [];

  return (
    <div className="space-y-6 pb-12">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">POSH Portal</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
              {isSuperAdmin ? 'POSH Compliance Control' : isEmployee ? 'POSH Portal' : 'POSH Management'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Sensitive complaints, evidence, ICC workflow, hearings, secure messages and compliance reporting with backend access checks.
            </p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
            <i className="fas fa-lock mr-2"></i>
            Private & role-gated
          </div>
        </div>
      </header>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
          message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}>
          {message.text}
        </div>
      )}

      {loadError && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-black">POSH module abhi open nahi ho pa raha hai.</p>
              <p className="mt-1 font-semibold">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold capitalize transition ${
              tab === t ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.replace(/-/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading POSH module...</div>
      ) : (
        <>
          {tab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label={isEmployee ? 'My Complaints' : 'Total Complaints'} value={stats.total || stats.total_complaints} icon="fa-clipboard-list" />
                <StatCard label="Pending" value={stats.pending || stats.pending_cases || stats.pending_complaints} icon="fa-hourglass-half" tone="amber" />
                <StatCard label="Investigation" value={stats.under_investigation} icon="fa-search" tone="slate" />
                <StatCard label="Critical" value={stats.critical_pending || stats.critical_complaints} icon="fa-triangle-exclamation" tone="red" />
              </div>
              {isSuperAdmin ? <SuperReports reports={reports} /> : <ComplaintTable complaints={complaints} onView={loadComplaintDetail} />}
              {isCommitteeOnly && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
                  Aapko sirf assigned POSH complaints, evidence, investigation notes aur secure messages dikh rahe hain.
                </div>
              )}
            </div>
          )}

          {tab === 'access' && isSuperAdmin && (
            <CompanyAccess companies={companies} onToggle={toggleCompanyPosh} />
          )}

          {tab === 'reports' && (isSuperAdmin || canViewReports) && (
            isSuperAdmin ? <SuperReports reports={reports} /> : <ManagerReports dashboard={dashboard} />
          )}

          {tab === 'audit' && isSuperAdmin && <AuditTable rows={auditLogs} />}

          {tab === 'raise' && isEmployee && (
            <ComplaintForm form={complaintForm} setForm={setComplaintForm} onSubmit={submitComplaint} />
          )}

          {(tab === 'my-complaints' || tab === 'complaints') && (
            <ComplaintTable complaints={complaints} onView={loadComplaintDetail} manager={canUpdateStatus} onStatus={updateStatus} />
          )}

          {tab === 'icc' && canManageIcc && (
            <IccManager rows={iccMembers} form={iccForm} setForm={setIccForm} onSubmit={saveIccMember} />
          )}

          {tab === 'investigations' && canAddInvestigation && (
            <ManagerActionForm
              title="Investigation Notes"
              complaints={complaintChoices}
              form={managerForm}
              setForm={setManagerForm}
              onSubmit={addInvestigation}
              fields={['complaint_id', 'investigation_notes']}
            />
          )}

          {tab === 'hearings' && canScheduleHearing && (
            <ManagerActionForm
              title="Schedule Hearing"
              complaints={complaintChoices}
              form={managerForm}
              setForm={setManagerForm}
              onSubmit={scheduleHearing}
              fields={['complaint_id', 'hearing_date', 'hearing_time', 'meeting_mode', 'meeting_location', 'meeting_link']}
            />
          )}

          {tab === 'evidence' && (
            <EvidenceUpload
              complaints={complaintChoices}
              form={managerForm}
              setForm={setManagerForm}
              files={files}
              setFiles={setFiles}
              onSubmit={uploadEvidence}
            />
          )}

          {tab === 'messages' && (
            <MessageComposer
              complaints={complaintChoices}
              form={managerForm}
              setForm={setManagerForm}
              onSubmit={sendMessage}
            />
          )}

          {tab === 'settings' && (isSuperAdmin || canManageSettings) && (
            <SettingsPanel apiBase={apiBase} onDone={() => showMessage('success', 'Settings saved.')} />
          )}

          {canManageWorkflow && tab === 'complaints' && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {canAssignComplaint && <form onSubmit={assignComplaint} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-slate-900">Assign to ICC</h3>
                <SelectComplaint complaints={complaintChoices} value={managerForm.complaint_id} onChange={(v) => setManagerForm({ ...managerForm, complaint_id: v })} />
                <select value={managerForm.assigned_to} onChange={(e) => setManagerForm({ ...managerForm, assigned_to: e.target.value })} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Select ICC member</option>
                  {iccMembers.filter((m) => m.employee_id).map((m) => <option key={m.id} value={m.employee_id}>{m.member_name} - {m.role}</option>)}
                </select>
                <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">Assign Complaint</button>
              </form>}
              {canSaveResolution && <form onSubmit={saveResolution} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-slate-900">Resolution / Final Action</h3>
                <SelectComplaint complaints={complaintChoices} value={managerForm.complaint_id} onChange={(v) => setManagerForm({ ...managerForm, complaint_id: v })} />
                <select value={managerForm.action_taken} onChange={(e) => setManagerForm({ ...managerForm, action_taken: e.target.value })} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <textarea value={managerForm.final_decision} onChange={(e) => setManagerForm({ ...managerForm, final_decision: e.target.value })} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Final decision" rows={3} />
                <textarea value={managerForm.resolution_summary} onChange={(e) => setManagerForm({ ...managerForm, resolution_summary: e.target.value })} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Resolution summary" rows={3} />
                <button className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Close / Save Resolution</button>
              </form>}
            </div>
          )}

          {selectedComplaint && (
            <ComplaintDetail
              detail={detail}
              selected={selectedComplaint}
              detailTab={detailTab}
              setDetailTab={setDetailTab}
              onClose={() => { setSelectedComplaint(null); setDetail(null); }}
              isEmployee={isEmployee}
              onDownloadEvidence={downloadEvidence}
            />
          )}
        </>
      )}
    </div>
  );
}

function ComplaintForm({ form, setForm, onSubmit }) {
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-900">Raise POSH Complaint</h2>
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <input value={form.complaint_title} onChange={(e) => set('complaint_title', e.target.value)} required className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2" placeholder="Complaint title" />
        <textarea value={form.complaint_description} onChange={(e) => set('complaint_description', e.target.value)} required className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2" rows={5} placeholder="Complaint description" />
        <input type="date" value={form.incident_date} onChange={(e) => set('incident_date', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input value={form.incident_location} onChange={(e) => set('incident_location', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Incident location" />
        <input value={form.accused_name} onChange={(e) => set('accused_name', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Accused name (optional)" />
        <input value={form.accused_department} onChange={(e) => set('accused_department', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Accused department" />
        <select value={form.severity_level} onChange={(e) => set('severity_level', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {severityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={form.complaint_type} onChange={(e) => set('complaint_type', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Complaint type" />
        <input value={form.witness_name} onChange={(e) => set('witness_name', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Witness name (optional)" />
        <input value={form.witness_contact} onChange={(e) => set('witness_contact', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Witness contact" />
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={!!form.anonymous_complaint} onChange={(e) => set('anonymous_complaint', e.target.checked)} />
          Submit as anonymous complaint
        </label>
      </div>
      <button className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white">Submit Complaint</button>
    </form>
  );
}

function ComplaintTable({ complaints, onView, manager, onStatus }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-400">
          <tr><th className="px-4 py-3">Complaint</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Action</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(complaints || []).map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-black text-slate-900">{c.complaint_id}</p>
                <p className="text-slate-500">{c.complaint_title}</p>
                {c.employee_name && <p className="text-xs text-slate-400">{c.employee_name}</p>}
              </td>
              <td className="px-4 py-3"><Badge value={c.severity_level} /></td>
              <td className="px-4 py-3"><Badge value={c.status} /></td>
              <td className="px-4 py-3 text-slate-500">{String(c.created_at || '').slice(0, 10)}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onView(c)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">View</button>
                {manager && onStatus && (
                  <select onChange={(e) => e.target.value && onStatus(c.id, e.target.value)} defaultValue="" className="ml-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                    <option value="">Status</option>
                    {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </td>
            </tr>
          ))}
          {!complaints?.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No POSH complaints found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function SelectComplaint({ complaints, value, onChange }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required>
      <option value="">Select complaint</option>
      {(complaints || []).map((c) => <option key={c.id} value={c.id}>{c.complaint_id} - {c.complaint_title}</option>)}
    </select>
  );
}

function EvidenceUpload({ complaints, form, setForm, files, setFiles, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-900">Secure Evidence Upload</h2>
      <p className="mt-1 text-sm text-slate-500">PDF, JPG, PNG, DOC, DOCX allowed. Files private route se hi download honge.</p>
      <SelectComplaint complaints={complaints} value={form.complaint_id} onChange={(v) => setForm({ ...form, complaint_id: v })} />
      <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setFiles(e.target.files)} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <button className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white">Upload Evidence</button>
    </form>
  );
}

function MessageComposer({ complaints, form, setForm, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-900">Secure Complaint Message</h2>
      <SelectComplaint complaints={complaints} value={form.complaint_id} onChange={(v) => setForm({ ...form, complaint_id: v })} />
      <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={5} placeholder="Write secure message..." />
      <button className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white">Send Message</button>
    </form>
  );
}

function IccManager({ rows, form, setForm, onSubmit }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">ICC Committee Member</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input value={form.member_name} onChange={(e) => setForm({ ...form, member_name: e.target.value })} required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Member name" />
          <input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Employee ID (optional)" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {['ICC Head', 'ICC Member', 'External Member', 'HR Representative'].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Email" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Phone" />
          <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white">Save ICC Member</button>
      </form>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">Active Committee</h2>
        <div className="mt-4 space-y-3">
          {(rows || []).map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-100 p-4">
              <p className="font-black text-slate-900">{m.member_name}</p>
              <p className="text-sm text-slate-500">{m.role} - {m.status}</p>
              <p className="text-xs text-slate-400">{m.email || 'No email'} {m.phone ? `- ${m.phone}` : ''}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManagerActionForm({ title, complaints, form, setForm, onSubmit, fields }) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-900">{title}</h2>
      <SelectComplaint complaints={complaints} value={form.complaint_id} onChange={(v) => setForm({ ...form, complaint_id: v })} />
      {fields.includes('investigation_notes') && <textarea value={form.investigation_notes} onChange={(e) => setForm({ ...form, investigation_notes: e.target.value })} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={5} placeholder="Investigation notes, evidence review, accused response, witness statement..." />}
      {fields.includes('hearing_date') && <input type="date" value={form.hearing_date} onChange={(e) => setForm({ ...form, hearing_date: e.target.value })} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />}
      {fields.includes('hearing_time') && <input type="time" value={form.hearing_time} onChange={(e) => setForm({ ...form, hearing_time: e.target.value })} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />}
      {fields.includes('meeting_mode') && <select value={form.meeting_mode} onChange={(e) => setForm({ ...form, meeting_mode: e.target.value })} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>Offline</option><option>Online</option></select>}
      {fields.includes('meeting_location') && <input value={form.meeting_location} onChange={(e) => setForm({ ...form, meeting_location: e.target.value })} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Meeting location" />}
      {fields.includes('meeting_link') && <input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Meeting link" />}
      <button className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white">Save</button>
    </form>
  );
}

function CompanyAccess({ companies, onToggle }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-400">
          <tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Complaints</th><th className="px-4 py-3">POSH Access</th><th className="px-4 py-3 text-right">Action</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(companies || []).map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3"><p className="font-black text-slate-900">{c.company_name}</p><p className="text-xs text-slate-400">{c.email}</p></td>
              <td className="px-4 py-3">{c.posh_complaints || 0}</td>
              <td className="px-4 py-3"><Badge value={Number(c.posh_enabled) ? 'Enabled' : 'Disabled'} /></td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onToggle(c, !Number(c.posh_enabled))} className={`rounded-lg px-4 py-2 text-xs font-black text-white ${Number(c.posh_enabled) ? 'bg-rose-600' : 'bg-emerald-600'}`}>
                  {Number(c.posh_enabled) ? 'Disable' : 'Enable'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuperReports({ reports }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">Company-wise POSH Summary</h2>
        <div className="mt-4 space-y-3">
          {(reports.companyWise || []).slice(0, 10).map((row) => (
            <div key={row.company_id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="font-bold text-slate-700">{row.company_name}</span>
              <span className="text-sm text-slate-500">{row.complaints_count || 0} cases</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">Status-wise Cases</h2>
        <div className="mt-4 space-y-3">
          {(reports.statusWise || []).map((row) => (
            <div key={row.status} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <Badge value={row.status} />
              <span className="font-black text-slate-900">{row.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManagerReports({ dashboard }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <ChartList title="Status-wise" rows={dashboard.byStatus || []} labelKey="status" />
      <ChartList title="Department-wise" rows={dashboard.byDepartment || []} labelKey="department" />
    </div>
  );
}

function ChartList({ title, rows, labelKey }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3">
        {(rows || []).map((row) => (
          <div key={row[labelKey]} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="font-bold text-slate-700">{row[labelKey]}</span>
            <span className="font-black text-slate-900">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditTable({ rows }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-400">
          <tr><th className="px-4 py-3">Action</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Date</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(rows || []).map((row) => (
            <tr key={row.id}><td className="px-4 py-3 font-bold">{row.action}</td><td className="px-4 py-3">{row.company_name || row.company_id}</td><td className="px-4 py-3">{row.user_name || row.user_id}</td><td className="px-4 py-3">{String(row.created_at || '').slice(0, 19).replace('T', ' ')}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsPanel({ apiBase, onDone }) {
  const [form, setForm] = useState({ policy_owner: '', escalation_email: '', retention_years: '7' });
  const save = async (e) => {
    e.preventDefault();
    await api.post(`${apiBase}/settings`, form);
    onDone();
  };
  return (
    <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-900">POSH Settings</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <input value={form.policy_owner} onChange={(e) => setForm({ ...form, policy_owner: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Policy owner" />
        <input value={form.escalation_email} onChange={(e) => setForm({ ...form, escalation_email: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Escalation email" />
        <input type="number" value={form.retention_years} onChange={(e) => setForm({ ...form, retention_years: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Retention years" />
      </div>
      <button className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white">Save Settings</button>
    </form>
  );
}

function ComplaintDetail({ detail, selected, detailTab, setDetailTab, onClose, isEmployee, onDownloadEvidence }) {
  const tabs = isEmployee
    ? ['overview', 'evidence', 'hearings', 'messages', 'resolution']
    : ['overview', 'evidence', 'investigation', 'hearings', 'messages', 'resolution', 'audit'];
  const data = detail || {};
  const complaint = data.complaint || selected;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-24">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-600">{complaint.complaint_id}</p>
            <h2 className="text-xl font-black text-slate-900">{complaint.complaint_title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><i className="fas fa-times" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3">
          {tabs.map((t) => <button key={t} onClick={() => setDetailTab(t)} className={`rounded-lg px-3 py-2 text-xs font-black capitalize ${detailTab === t ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'}`}>{t}</button>)}
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {detailTab === 'overview' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Info label="Status" value={complaint.status} />
              <Info label="Severity" value={complaint.severity_level} />
              <Info label="Complainant" value={complaint.employee_name || 'Anonymous'} />
              <Info label="Incident Date" value={complaint.incident_date} />
              <Info label="Location" value={complaint.incident_location} />
              <Info label="Accused" value={complaint.accused_employee_name || complaint.accused_name} />
              <div className="md:col-span-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{complaint.complaint_description}</div>
            </div>
          )}
          {detailTab === 'evidence' && <List rows={data.evidence || []} primary="original_name" secondary="mime_type" onDownload={onDownloadEvidence} />}
          {detailTab === 'investigation' && <List rows={data.investigations || []} primary="status" secondary="notes" />}
          {detailTab === 'hearings' && <List rows={data.hearings || []} primary="hearing_date" secondary="meeting_mode" />}
          {detailTab === 'messages' && <List rows={data.messages || []} primary="sender_name" secondary="message" />}
          {detailTab === 'resolution' && (data.resolution ? <Info label={data.resolution.action_taken} value={data.resolution.final_decision} /> : <p className="text-slate-400">Resolution not saved yet.</p>)}
          {detailTab === 'audit' && <List rows={data.audit || []} primary="action" secondary="created_at" />}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 font-bold text-slate-800">{value || '-'}</p>
    </div>
  );
}

function List({ rows, primary, secondary, onDownload }) {
  return (
    <div className="space-y-3">
      {(rows || []).map((row) => (
        <div key={row.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="font-black text-slate-900">{row[primary] || '-'}</p>
          <p className="mt-1 text-sm text-slate-500">{row[secondary] || '-'}</p>
          {onDownload && (
            <button onClick={() => onDownload(row)} className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
              Download
            </button>
          )}
        </div>
      ))}
      {!rows?.length && <p className="text-slate-400">No records yet.</p>}
    </div>
  );
}
