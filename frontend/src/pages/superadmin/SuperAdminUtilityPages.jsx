import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';
import GlobalUsers from './GlobalUsers';

const moduleOptions = [
  { key: 'crm', label: 'CRM' },
  { key: 'leads', label: 'Leads' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'followups', label: 'Follow-ups' },
  { key: 'quotations', label: 'Quotations' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'reports', label: 'Reports' },
  { key: 'hrms', label: 'HRMS' },
  { key: 'hrms_attendance', label: 'Attendance' },
  { key: 'hrms_leaves', label: 'Leaves' },
  { key: 'hrms_salary', label: 'Salary' },
  { key: 'hrms_documents', label: 'Documents' },
];

const templateSeeds = {
  invoice: { code: 'invoice_template', channel: 'email', subject: 'Invoice from {{company_name}}' },
  quotation: { code: 'quotation_template', channel: 'email', subject: 'Quotation from {{company_name}}' },
  whatsapp: { code: 'whatsapp_template', channel: 'whatsapp', subject: '' },
  employee: { code: 'employee_template', channel: 'email', subject: 'Employee communication' },
  email: { code: 'email_template', channel: 'email', subject: 'Email notification' },
};

const roleDefinitions = [
  { key: 'superadmin', title: 'Super Admin', icon: 'fa-crown', color: 'violet', description: 'Full platform access for SaaS owner and setup admins.' },
  { key: 'admin', title: 'Company Admin', icon: 'fa-user-tie', color: 'blue', description: 'Tenant admin access for company setup, CRM, HRMS and users.' },
  { key: 'manager', title: 'Manager', icon: 'fa-chart-line', color: 'amber', description: 'Sales and team management access for pipeline and reports.' },
  { key: 'human_resources', title: 'Human Resources', icon: 'fa-users', color: 'emerald', description: 'Employee, attendance, leave, salary and HR document access.' },
  { key: 'employee', title: 'Employee', icon: 'fa-user', color: 'slate', description: 'Daily CRM and task execution access.' },
  { key: 'designer_manager', title: 'Designer Manager', icon: 'fa-palette', color: 'rose', description: 'Design task review and team assignment access.' },
  { key: 'designer', title: 'Designer', icon: 'fa-pen-nib', color: 'cyan', description: 'Design task execution and calendar access.' },
];

const roleDefaultModules = {
  superadmin: moduleOptions.map((module) => module.key),
  admin: ['crm', 'leads', 'meetings', 'tasks', 'followups', 'quotations', 'invoices', 'reports', 'hrms', 'hrms_attendance', 'hrms_leaves', 'hrms_salary', 'hrms_documents'],
  manager: ['crm', 'leads', 'meetings', 'tasks', 'followups', 'quotations', 'reports'],
  human_resources: ['hrms', 'hrms_attendance', 'hrms_leaves', 'hrms_salary', 'hrms_documents', 'reports'],
  employee: ['crm', 'leads', 'meetings', 'tasks', 'followups'],
  designer_manager: ['tasks', 'meetings', 'reports'],
  designer: ['tasks', 'meetings'],
};

const roleToneClasses = {
  violet: 'bg-violet-50 text-violet-700 border-violet-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  slate: 'bg-slate-50 text-slate-700 border-slate-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-100',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
};

function normalizeRoleKey(value) {
  return String(value || 'employee').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function SuperAdminUsersPage() {
  return (
    <GlobalUsers
      rolePreset="superadmin"
      title="Super Admin Management"
      description="Create and manage master/setup super admin accounts."
    />
  );
}

export function CompanyAdminsPage() {
  return (
    <GlobalUsers
      rolePreset="admin"
      title="Company Admins"
      description="Create, assign, and manage tenant admin users."
    />
  );
}

export function AdminsAndUsersPage() {
  return (
    <GlobalUsers
      title="Admins & Users"
      description="Complete user control across all companies, roles, status and access."
    />
  );
}

export function RolesAccessPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('admin');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedModules, setSelectedModules] = useState([]);
  const [savingUser, setSavingUser] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/superadmin/users');
      if (res.data?.success) setUsers(res.data.data || []);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const roleRows = useMemo(() => {
    const definitionsByKey = new Map(roleDefinitions.map((role) => [role.key, role]));
    users.forEach((user) => {
      const key = normalizeRoleKey(user.role);
      if (!definitionsByKey.has(key)) {
        definitionsByKey.set(key, {
          key,
          title: toTitle(key),
          icon: 'fa-id-badge',
          color: 'slate',
          description: 'Custom role found from user records.',
        });
      }
    });

    return Array.from(definitionsByKey.values()).map((role) => {
      const roleUsers = users.filter((user) => normalizeRoleKey(user.role) === role.key);
      const customAccess = roleUsers.filter((user) => Array.isArray(user.access_modules) && user.access_modules.length > 0).length;
      return {
        ...role,
        count: roleUsers.length,
        active: roleUsers.filter((user) => user.status === 'active').length,
        customAccess,
        defaultModules: roleDefaultModules[role.key] || [],
      };
    });
  }, [users]);

  const selectedRoleInfo = roleRows.find((role) => role.key === selectedRole) || roleRows[0];
  const selectedRoleUsers = useMemo(
    () => users.filter((user) => normalizeRoleKey(user.role) === selectedRole),
    [users, selectedRole]
  );
  const selectedUser = selectedRoleUsers.find((user) => String(user.id) === String(selectedUserId));

  useEffect(() => {
    if (!selectedRoleUsers.length) {
      setSelectedUserId('');
      return;
    }
    if (!selectedRoleUsers.some((user) => String(user.id) === String(selectedUserId))) {
      setSelectedUserId(String(selectedRoleUsers[0].id));
    }
  }, [selectedRoleUsers, selectedUserId]);

  useEffect(() => {
    setSelectedModules(Array.isArray(selectedUser?.access_modules) ? selectedUser.access_modules : []);
  }, [selectedUser?.id]);

  const updateUsersAccessState = (ids, modules) => {
    const idSet = new Set(ids.map((id) => String(id)));
    setUsers((prev) => prev.map((user) => (
      idSet.has(String(user.id))
        ? { ...user, access_modules: modules, module_restricted: modules.length > 0 }
        : user
    )));
  };

  const saveSelectedUserAccess = async () => {
    if (!selectedUser) return alert('Please select a user first');
    try {
      setSavingUser(true);
      const res = await api.post(`/superadmin/users/${selectedUser.id}/access`, { access_modules: selectedModules });
      if (res.data?.success) {
        updateUsersAccessState([selectedUser.id], selectedModules);
        alert('User access updated');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const applyAccessToRole = async () => {
    if (!selectedRoleUsers.length) return alert('No users found in this role');
    if (!window.confirm(`Apply selected module access to all ${selectedRoleUsers.length} ${selectedRoleInfo?.title || selectedRole} users?`)) return;

    try {
      setSavingRole(true);
      await Promise.all(selectedRoleUsers.map((user) => (
        api.post(`/superadmin/users/${user.id}/access`, { access_modules: selectedModules })
      )));
      updateUsersAccessState(selectedRoleUsers.map((user) => user.id), selectedModules);
      alert('Role users access updated');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSavingRole(false);
    }
  };

  const totalUsers = users.length;
  const restrictedUsers = users.filter((user) => Array.isArray(user.access_modules) && user.access_modules.length > 0).length;

  return (
    <PageShell title="Roles & Access" subtitle="Review every role, select users by role, and assign module-level access without leaving this page.">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Summary label="Total Roles" value={roleRows.length} />
        <Summary label="Total Users" value={totalUsers} />
        <Summary label="Custom Access" value={restrictedUsers} />
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">System Roles</h2>
            <Link to="/superadmin/users?create=1" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">New User</Link>
          </div>

          <div className="space-y-2">
            {roleRows.map((role) => {
              const active = selectedRole === role.key;
              return (
                <button
                  key={role.key}
                  type="button"
                  onClick={() => setSelectedRole(role.key)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    active ? 'border-indigo-300 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${roleToneClasses[role.color] || roleToneClasses.slate}`}>
                      <i className={`fas ${role.icon}`}></i>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-black text-slate-900">{role.title}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-slate-700">{role.count}</span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{role.description}</span>
                      <span className="mt-2 block text-[11px] font-bold text-slate-400">
                        {role.active} active · {role.customAccess} custom access
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Selected Role</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{selectedRoleInfo?.title || toTitle(selectedRole)}</h2>
                <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">{selectedRoleInfo?.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/superadmin/access-assign" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
                  Access Assign
                </Link>
                <button
                  type="button"
                  onClick={loadUsers}
                  disabled={loading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(selectedRoleInfo?.defaultModules || []).length ? (
                selectedRoleInfo.defaultModules.map((moduleKey) => (
                  <span key={moduleKey} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                    {moduleOptions.find((module) => module.key === moduleKey)?.label || toTitle(moduleKey)}
                  </span>
                ))
              ) : (
                <span className="text-sm font-semibold text-slate-400">No default modules mapped for this custom role.</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Users In Role</h3>
              </div>
              <div className="max-h-[520px] overflow-y-auto bg-white">
                {selectedRoleUsers.length ? selectedRoleUsers.map((user) => {
                  const active = String(user.id) === String(selectedUserId);
                  const moduleCount = Array.isArray(user.access_modules) ? user.access_modules.length : 0;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(String(user.id))}
                      className={`flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition ${
                        active ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-slate-900">{user.name || 'Unnamed User'}</span>
                        <span className="block truncate text-xs font-medium text-slate-500">{user.email || 'No email'} · {user.company_name || 'No company'}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {user.status || 'active'}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                          {moduleCount ? `${moduleCount} modules` : 'Default'}
                        </span>
                      </span>
                    </button>
                  );
                }) : (
                  <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
                    No users found for this role.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Module Access</h3>
              {selectedUser ? (
                <>
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <p className="truncate text-sm font-black text-slate-900">{selectedUser.name}</p>
                    <p className="truncate text-xs font-medium text-slate-500">{selectedUser.email}</p>
                  </div>
                  <div className="mt-4">
                    <ModulePicker value={selectedModules} onChange={setSelectedModules} />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-400">
                    Empty selection means this user will follow default access for their role.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={saveSelectedUserAccess}
                      disabled={savingUser}
                      className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {savingUser ? 'Saving...' : 'Save User Access'}
                    </button>
                    <button
                      type="button"
                      onClick={applyAccessToRole}
                      disabled={savingRole || !selectedRoleUsers.length}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {savingRole ? 'Applying...' : 'Apply To Whole Role'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-lg bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-400">
                  Select a role user to edit access.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export function CreateCompanyPage() {
  const [plans, setPlans] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    domain: '',
    email: '',
    phone: '',
    address: '',
    subscription_plan_id: '',
    password: 'password123',
  });

  useEffect(() => {
    api.get('/superadmin/subscriptions').then((res) => {
      if (res.data?.success) setPlans(res.data.data || []);
    }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = { ...form, subscription_plan_id: form.subscription_plan_id || null };
      const res = await api.post('/superadmin/companies', payload);
      if (res.data?.success) {
        alert('Company created successfully');
        setForm({ company_name: '', domain: '', email: '', phone: '', address: '', subscription_plan_id: '', password: 'password123' });
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title="Create Company" subtitle="Provision a tenant and its default company admin in one flow.">
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Company Name" value={form.company_name} onChange={(company_name) => setForm({ ...form, company_name })} required />
        <Input label="Domain" value={form.domain} onChange={(domain) => setForm({ ...form, domain })} placeholder="example.com" />
        <Input label="Admin Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
        <Input label="Phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
        <Input label="Temporary Password" value={form.password} onChange={(password) => setForm({ ...form, password })} required />
        <Select label="Plan" value={form.subscription_plan_id} onChange={(subscription_plan_id) => setForm({ ...form, subscription_plan_id })}>
          <option value="">No plan selected</option>
          {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
        </Select>
        <div className="md:col-span-2">
          <Input label="Address" value={form.address} onChange={(address) => setForm({ ...form, address })} />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button disabled={saving} className="rounded-lg bg-[#2c86ab] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#247596] disabled:opacity-60">
            {saving ? 'Creating...' : 'Create Company'}
          </button>
        </div>
      </form>
    </PageShell>
  );
}

export function AccessAssignPage() {
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedModules, setSelectedModules] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = React.useRef(null);
  const selectedUser = users.find((u) => String(u.id) === String(selectedId));

  const load = async () => {
    const res = await api.get('/superadmin/users');
    if (res.data?.success) setUsers(res.data.data || []);
  };

  useEffect(() => { load().catch(() => {}); }, []);
  useEffect(() => {
    setSelectedModules(Array.isArray(selectedUser?.access_modules) ? selectedUser.access_modules : []);
  }, [selectedUser?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase();
    return (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term);
  });

  const handleSelectUser = (userId) => {
    setSelectedId(String(userId));
    setDropdownOpen(false);
    setSearchTerm('');
  };

  const save = async () => {
    if (!selectedId) return alert('Please select a user');
    try {
      const res = await api.post(`/superadmin/users/${selectedId}/access`, { access_modules: selectedModules });
      if (res.data?.success) {
        alert('Access updated');
        await load();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <PageShell title="Access Assign" subtitle="Assign module-level access for a user across CRM and HRMS.">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          {/* Custom Dropdown - always opens DOWNWARD */}
          <div ref={dropdownRef} className="relative">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-600">User</label>
            <button
              type="button"
              onClick={() => { setDropdownOpen((prev) => !prev); setSearchTerm(''); }}
              className="mt-1 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm outline-none transition-colors hover:border-indigo-400 focus:border-indigo-500 focus:bg-white"
            >
              <span className={selectedUser ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                {selectedUser ? `${selectedUser.name} - ${selectedUser.email}` : 'Select user'}
              </span>
              <i className={`fas fa-chevron-down text-xs text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div
                className="absolute left-0 right-0 z-[9999] mt-1 max-h-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
                style={{ top: '100%' }}
              >
                {/* Search input */}
                <div className="sticky top-0 border-b border-slate-100 bg-white p-2">
                  <input
                    type="text"
                    autoFocus
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search users..."
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                {/* User list */}
                <div className="max-h-48 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-slate-400">No users found</div>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleSelectUser(user.id)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-indigo-50 ${
                          String(user.id) === String(selectedId)
                            ? 'bg-indigo-50 font-bold text-indigo-700'
                            : 'text-slate-700'
                        }`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{user.name}</span>
                          <span className="block truncate text-xs text-slate-400">{user.email}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedUser && (
            <div className="mt-4 rounded-lg bg-white p-4 text-sm text-slate-600">
              <p className="font-bold text-slate-900">{selectedUser.name}</p>
              <p>{selectedUser.company_name || 'No company'}</p>
              <p className="mt-1 uppercase text-xs font-bold text-indigo-600">{selectedUser.role}</p>
            </div>
          )}
        </div>
        <div>
          <ModulePicker value={selectedModules} onChange={setSelectedModules} />
          <div className="mt-5 flex justify-end">
            <button onClick={save} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
              Save Access
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export function ModuleAssignPage() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [modules, setModules] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    api.get('/superadmin/companies').then((res) => {
      if (res.data?.success) setCompanies(res.data.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!companyId) return;
    api.get(`/superadmin/modules/company/${companyId}`).then((res) => {
      if (res.data?.success) {
        setModules(res.data.data?.modules || []);
        setSelected((res.data.data?.module_ids || []).map(String));
      }
    }).catch(() => {});
  }, [companyId]);

  const save = async () => {
    if (!companyId) return alert('Select company');
    try {
      const res = await api.post('/superadmin/modules/assign-company', {
        company_id: Number(companyId),
        module_ids: selected.map(Number),
      });
      if (res.data?.success) alert('Modules assigned');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <PageShell title="Module Assign" subtitle="Enable or remove modules for a tenant company.">
      <Select label="Company" value={companyId} onChange={setCompanyId}>
        <option value="">Select company</option>
        {companies.map((company) => <option key={company.id} value={company.id}>{company.company_name}</option>)}
      </Select>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {modules.map((module) => (
          <label key={module.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={selected.includes(String(module.id))}
              onChange={() => setSelected((prev) => prev.includes(String(module.id)) ? prev.filter((id) => id !== String(module.id)) : [...prev, String(module.id)])}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-bold text-slate-900">{module.name}</span>
              <span className="text-xs text-slate-500">{module.code}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <button onClick={save} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Save Modules</button>
      </div>
    </PageShell>
  );
}

export function PlanAssignPage() {
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({ company_id: '', plan_id: '', billing_cycle: 'monthly', status: 'active', trial_end: '' });
  const [reportReloadKey, setReportReloadKey] = useState(0);

  useEffect(() => {
    Promise.all([api.get('/superadmin/companies'), api.get('/superadmin/subscriptions')]).then(([companiesRes, plansRes]) => {
      if (companiesRes.data?.success) setCompanies(companiesRes.data.data || []);
      if (plansRes.data?.success) setPlans(plansRes.data.data || []);
    }).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/superadmin/subscriptions/assign', {
        ...form,
        company_id: Number(form.company_id),
        plan_id: Number(form.plan_id),
        trial_end: form.trial_end || null,
      });
      if (res.data?.success) alert('Plan assigned');
      setReportReloadKey((key) => key + 1);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <PageShell title="Plan Assign" subtitle="Assign or update a tenant subscription plan.">
      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Company" value={form.company_id} onChange={(company_id) => setForm({ ...form, company_id })} required>
          <option value="">Select company</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.company_name}</option>)}
        </Select>
        <Select label="Plan" value={form.plan_id} onChange={(plan_id) => setForm({ ...form, plan_id })} required>
          <option value="">Select plan</option>
          {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} - Rs {Number(plan.price || 0).toLocaleString()}</option>)}
        </Select>
        <Select label="Billing Cycle" value={form.billing_cycle} onChange={(billing_cycle) => setForm({ ...form, billing_cycle })}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Select>
        <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })}>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="expired">Expired</option>
        </Select>
        <Input label="Trial End" type="date" value={form.trial_end} onChange={(trial_end) => setForm({ ...form, trial_end })} />
        <div className="md:col-span-2 flex justify-end">
          <button className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Assign Plan</button>
        </div>
      </form>
      <CompanyAssignmentReport reloadKey={reportReloadKey} className="mt-8" />
    </PageShell>
  );
}

export function SetupReportsPage() {
  const [data, setData] = useState({ metrics: null, companies: [], users: [], logs: [] });

  useEffect(() => {
    Promise.all([
      api.get('/superadmin/metrics').catch(() => ({ data: {} })),
      api.get('/superadmin/companies').catch(() => ({ data: {} })),
      api.get('/superadmin/users').catch(() => ({ data: {} })),
      api.get('/superadmin/logs').catch(() => ({ data: {} })),
    ]).then(([metrics, companies, users, logs]) => {
      setData({
        metrics: metrics.data?.data || null,
        companies: companies.data?.data || [],
        users: users.data?.data || [],
        logs: logs.data?.data || [],
      });
    });
  }, []);

  const totals = data.metrics?.totals || {};
  return (
    <PageShell title="Setup Reports" subtitle="Tenant setup, admin creation, module assignment and activity snapshot.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Summary label="Companies" value={totals.total_companies || data.companies.length} />
        <Summary label="Active Companies" value={totals.active_companies || data.companies.filter((c) => c.subscription_status === 'active').length} />
        <Summary label="Users" value={totals.total_users || data.users.length} />
        <Summary label="Recent Logs" value={data.logs.length} />
      </div>
      <CompanyAssignmentReport className="mt-6" />
      <DataList title="Recent Activity" rows={data.logs.slice(0, 10)} render={(row) => row.action || row.description || 'Activity'} />
    </PageShell>
  );
}

export function MyActivityPage() {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    api.get('/superadmin/logs').then((res) => {
      if (res.data?.success) setLogs(res.data.data || []);
    }).catch(() => {});
  }, []);
  return (
    <PageShell title="My Activity" subtitle="Latest platform-owner and setup-admin audit trail.">
      <DataList title="Activity Logs" rows={logs} render={(row) => row.action || row.description || 'Activity'} />
    </PageShell>
  );
}

export function SupportTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', status: 'open', category: 'general', company_id: '' });

  const load = async () => {
    const [ticketsRes, companiesRes] = await Promise.all([
      api.get('/superadmin/support'),
      api.get('/superadmin/companies').catch(() => ({ data: { success: true, data: [] } })),
    ]);
    if (ticketsRes.data?.success) setTickets(ticketsRes.data.data || []);
    if (companiesRes.data?.success) setCompanies(companiesRes.data.data || []);
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/superadmin/support', { ...form, company_id: form.company_id || null });
      if (res.data?.success) {
        setForm({ title: '', description: '', priority: 'medium', status: 'open', category: 'general', company_id: '' });
        await load();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const updateStatus = async (ticket, status) => {
    await api.patch(`/superadmin/support/${ticket.id}`, { status });
    await load();
  };

  return (
    <PageShell title="Support Tickets" subtitle="Create, track and close platform support requests.">
      <form onSubmit={create} className="grid grid-cols-1 lg:grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <Input label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} required />
        <Select label="Company" value={form.company_id} onChange={(company_id) => setForm({ ...form, company_id })}>
          <option value="">Platform ticket</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.company_name}</option>)}
        </Select>
        <Select label="Priority" value={form.priority} onChange={(priority) => setForm({ ...form, priority })}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </Select>
        <div className="flex items-end">
          <button className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Create Ticket</button>
        </div>
        <div className="lg:col-span-4">
          <Input label="Description" value={form.description} onChange={(description) => setForm({ ...form, description })} />
        </div>
      </form>
      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{ticket.title}</td>
                <td className="px-4 py-3 text-slate-600">{ticket.company_name || 'Platform'}</td>
                <td className="px-4 py-3 uppercase text-xs font-bold">{ticket.priority}</td>
                <td className="px-4 py-3 uppercase text-xs font-bold">{ticket.status}</td>
                <td className="px-4 py-3 text-right">
                  <select value={ticket.status} onChange={(e) => updateStatus(ticket, e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function ProfilePage() {
  const employee = getEmployee();
  const [form, setForm] = useState({ name: employee?.name || '', email: employee?.email || '', phone: employee?.phone || '' });

  const save = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch(`/superadmin/users/${employee.id}`, form);
      if (res.data?.success) alert('Profile updated');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <PageShell title="Profile" subtitle="Manage your super admin profile details.">
      <form onSubmit={save} className="max-w-2xl space-y-4">
        <Input label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
        <Input label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
        <Input label="Phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
        <button className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Save Profile</button>
      </form>
    </PageShell>
  );
}

export function SecurityCenterPage() {
  const [sessions, setSessions] = useState([]);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/superadmin/security/login-sessions').catch(() => ({ data: {} })),
      api.get('/superadmin/system/health').catch(() => ({ data: {} })),
    ]).then(([sessionsRes, healthRes]) => {
      if (sessionsRes.data?.success) setSessions(sessionsRes.data.data || []);
      if (healthRes.data?.success) setHealth(healthRes.data.data || null);
    });
  }, []);

  return (
    <PageShell title="Security Center" subtitle="Review active sessions and platform security posture.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Summary label="Platform Status" value={health?.status || 'ok'} />
        <Summary label="Active Sessions" value={sessions.filter((s) => s.status === 'active').length} />
        <Summary label="Ended Sessions" value={sessions.filter((s) => s.status === 'ended').length} />
      </div>
      <DataList title="Recent Login Sessions" rows={sessions.slice(0, 12)} render={(row) => `${row.user_name || row.user_email || 'User'} - ${row.status}`} />
    </PageShell>
  );
}

export function SystemMonitorPage() {
  const [health, setHealth] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    const res = await api.get('/superadmin/system/health');
    if (res.data?.success) setHealth(res.data.data || null);
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const clearCache = async () => {
    const res = await api.post('/superadmin/system/cache/clear');
    setMessage(res.data?.message || 'Cache request completed');
    await load();
  };

  const memoryMb = health?.memory?.heapUsed ? Math.round(health.memory.heapUsed / 1024 / 1024) : 0;
  return (
    <PageShell title="System Monitor" subtitle="Live backend health, runtime memory and cache controls.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Summary label="Status" value={health?.status || 'Loading'} />
        <Summary label="Node" value={health?.node || '-'} />
        <Summary label="Uptime" value={`${Math.floor((health?.uptimeSec || 0) / 60)} min`} />
        <Summary label="Heap Used" value={`${memoryMb} MB`} />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button onClick={clearCache} className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700">Clear Cache</button>
        {message && <span className="text-sm font-semibold text-emerald-700">{message}</span>}
      </div>
    </PageShell>
  );
}

export function WhiteLabelSettingsPage() {
  const [form, setForm] = useState(null);

  useEffect(() => {
    api.get('/superadmin/white-label').then((res) => {
      if (res.data?.success) setForm(res.data.data || {});
    }).catch(() => setForm({}));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const res = await api.post('/superadmin/white-label', form);
    if (res.data?.success) alert('White label settings saved');
  };

  if (!form) return <PageShell title="White Label Settings" subtitle="Loading..." />;

  return (
    <PageShell title="White Label Settings" subtitle="Configure platform branding defaults.">
      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.keys(form).map((key) => (
          <Input key={key} label={toTitle(key)} type={key.includes('color') ? 'color' : 'text'} value={form[key] || ''} onChange={(value) => setForm({ ...form, [key]: value })} />
        ))}
        <div className="md:col-span-2 flex justify-end">
          <button className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Save Branding</button>
        </div>
      </form>
    </PageShell>
  );
}

export function TemplateCenterPage({ type = 'email' }) {
  const seed = templateSeeds[type] || templateSeeds.email;
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ ...seed, body: '' });
  const channel = seed.channel;

  const load = async () => {
    const res = await api.get('/superadmin/notifications/templates');
    if (res.data?.success) setTemplates(res.data.data || []);
  };
  useEffect(() => {
    setForm({ ...seed, body: '' });
    load().catch(() => {});
  }, [type]);

  const filtered = useMemo(() => templates.filter((t) => t.channel === channel || String(t.code || '').includes(type)), [templates, channel, type]);

  const save = async (e) => {
    e.preventDefault();
    const res = await api.post('/superadmin/notifications/templates', form);
    if (res.data?.success) {
      setForm({ ...seed, body: '' });
      await load();
    }
  };

  return (
    <PageShell title={`${toTitle(type)} Templates`} subtitle="Create and update reusable communication templates.">
      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <Input label="Code" value={form.code} onChange={(code) => setForm({ ...form, code })} required />
        <Select label="Channel" value={form.channel} onChange={(channelValue) => setForm({ ...form, channel: channelValue })}>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="inapp">In-app</option>
        </Select>
        <Input className="md:col-span-2" label="Subject" value={form.subject || ''} onChange={(subject) => setForm({ ...form, subject })} />
        <div className="md:col-span-2">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Body</label>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="mt-1 min-h-32 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Save Template</button>
        </div>
      </form>
      <DataList title="Saved Templates" rows={filtered} render={(row) => `${row.code} - ${row.channel}`} onPick={(row) => setForm(row)} />
    </PageShell>
  );
}

function CompanyAssignmentReport({ reloadKey = 0, className = '' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get('/superadmin/subscriptions/assignment-report');
      if (res.data?.success) setRows(res.data.data || []);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [reloadKey]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const modules = (row.modules || []).map((module) => `${module.name} ${module.code}`).join(' ');
      return [
        row.company_name,
        row.domain,
        row.email,
        row.plan_name,
        row.subscription_status,
        modules,
      ].join(' ').toLowerCase().includes(term);
    });
  }, [rows, search]);

  const assignedPlans = rows.filter((row) => row.plan_id).length;
  const companyModuleOverrides = rows.filter((row) => row.module_source === 'company').length;
  const missingModules = rows.filter((row) => !row.modules?.length).length;

  const exportCsv = () => {
    const header = ['Company', 'Domain', 'Email', 'Plan', 'Price', 'Billing Cycle', 'Status', 'Module Source', 'Modules'];
    const body = filteredRows.map((row) => [
      row.company_name || '',
      row.domain || '',
      row.email || '',
      row.plan_name || '',
      row.plan_price ? `Rs ${Number(row.plan_price).toLocaleString()}` : '',
      row.billing_cycle || '',
      row.subscription_status || '',
      row.module_source || '',
      (row.modules || []).map((module) => module.name || module.code).join(', '),
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `company-plan-module-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2c86ab]">Assignment Report</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Company Plan & Module Report</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">See every company current plan and assigned modules in one place.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, plan, module..."
              className="w-full min-w-[260px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:bg-white"
            />
            <button type="button" onClick={load} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button type="button" onClick={exportCsv} disabled={!filteredRows.length} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Summary label="Companies" value={rows.length} />
          <Summary label="Plan Assigned" value={assignedPlans} />
          <Summary label="Company Modules" value={companyModuleOverrides} />
          <Summary label="No Modules" value={missingModules} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-5 py-3 font-black">Company</th>
              <th className="px-5 py-3 font-black">Current Plan</th>
              <th className="px-5 py-3 font-black">Billing</th>
              <th className="px-5 py-3 font-black">Status</th>
              <th className="px-5 py-3 font-black">Assigned Modules</th>
              <th className="px-5 py-3 font-black">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm font-semibold text-slate-400">Loading report...</td>
              </tr>
            ) : filteredRows.length ? filteredRows.map((row) => (
              <tr key={row.company_id} className="hover:bg-slate-50">
                <td className="px-5 py-4 align-top">
                  <p className="font-black text-slate-900">{row.company_name || 'Unnamed Company'}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{row.domain || row.email || 'No domain/email'}</p>
                </td>
                <td className="px-5 py-4 align-top">
                  <p className="font-bold text-slate-900">{row.plan_name || 'No plan assigned'}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {row.plan_price ? `Rs ${Number(row.plan_price).toLocaleString()}` : 'Price not set'}
                  </p>
                </td>
                <td className="px-5 py-4 align-top">
                  <p className="font-bold capitalize text-slate-700">{row.billing_cycle || 'monthly'}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {row.trial_end ? `Trial end: ${new Date(row.trial_end).toLocaleDateString()}` : 'No trial end'}
                  </p>
                </td>
                <td className="px-5 py-4 align-top">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black capitalize ${
                    row.subscription_status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : row.subscription_status === 'trial'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {row.subscription_status || 'not assigned'}
                  </span>
                </td>
                <td className="px-5 py-4 align-top">
                  <div className="flex max-w-xl flex-wrap gap-2">
                    {(row.modules || []).length ? row.modules.map((module) => (
                      <span key={`${row.company_id}-${module.id || module.code || module.name}`} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                        {module.name || toTitle(module.code)}
                      </span>
                    )) : (
                      <span className="text-xs font-semibold text-slate-400">No modules assigned</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 align-top">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black uppercase text-slate-600">
                    {row.module_source === 'company' ? 'Custom' : row.module_source === 'plan' ? 'Plan' : 'None'}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm font-semibold text-slate-400">No matching company assignment found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageShell({ title, subtitle, children }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2c86ab]">Super Admin</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', required = false, placeholder = '', className = '' }) {
  return (
    <div className={className}>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</label>
      <input
        type={type}
        required={required}
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:bg-white"
      />
    </div>
  );
}

function Select({ label, value, onChange, children, required = false }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</label>
      <select
        required={required}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:bg-white"
      >
        {children}
      </select>
    </div>
  );
}

function ModulePicker({ value = [], onChange }) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {moduleOptions.map((module) => (
        <label key={module.key} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={selected.includes(module.key)}
            onChange={() => onChange(selected.includes(module.key) ? selected.filter((key) => key !== module.key) : [...selected, module.key])}
          />
          {module.label}
        </label>
      ))}
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function DataList({ title, rows = [], render, onPick }) {
  return (
    <div className="mt-6 rounded-lg border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-700">{title}</div>
      <div className="divide-y divide-slate-100">
        {rows.length ? rows.map((row, index) => (
          <button
            key={row.id || index}
            type="button"
            onClick={() => onPick?.(row)}
            className="block w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {render(row)}
            <span className="ml-2 text-xs font-medium text-slate-400">{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</span>
          </button>
        )) : (
          <div className="px-4 py-8 text-center text-sm font-semibold text-slate-400">No records found.</div>
        )}
      </div>
    </div>
  );
}

function toTitle(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
