export const getEmployee = () => {
  const employee = localStorage.getItem('employee');
  return employee ? JSON.parse(employee) : null;
};

export const setEmployee = (employee, token) => {
  localStorage.setItem('employee', JSON.stringify(employee));
  localStorage.setItem('token', token);
};

export const clearAuth = () => {
  localStorage.removeItem('employee');
  localStorage.removeItem('token');
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

export const normalizeRole = (role) => {
  return String(role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
};

const CRM_MODULE_KEYS = [
  'crm',
  'leads',
  'meetings',
  'tasks',
  'followups',
  'quotations',
  'invoices',
  'reports',
  'history',
  'whatsapp',
  'group_meetings',
];

const HRMS_MODULE_KEYS = [
  'hrms',
  'hrms_attendance',
  'hrms_leaves',
  'hrms_salary',
  'hrms_documents',
  'hrms_departments',
  'hrms_designations',
  'hrms_shifts',
  'hrms_holidays',
  'hrms_announcements',
  'hrms_performance',
  'hrms_settings',
  'hrms_reports',
];

const COMMON_MODULE_KEYS = [
  'calendar',
  'notifications',
  'chat',
];

const HR_ROLE_KEYS = new Set([
  'human_resources',
  'human_resource',
  'humanresources',
  'hr',
  'hr_manager',
  'hrmanager',
]);

const normalizeModuleCode = (code) =>
  String(code || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

export const isSuperAdminRole = (role) => {
  const normalized = normalizeRole(role);
  return normalized === 'superadmin' || normalized === 'super_admin';
};

export const normalizeSuperAdminPanel = (panel) => {
  const normalized = String(panel || '').toLowerCase().trim();
  if (normalized === 'setup' || normalized === 'company_setup') return 'setup';
  return 'master';
};

export const isHrRole = (role) => {
  return HR_ROLE_KEYS.has(normalizeRole(role));
};

export const isModuleRestrictedEmployee = (employee) => {
  if (typeof employee?.module_restricted === 'boolean') {
    return employee.module_restricted;
  }
  return Array.isArray(employee?.access_modules) && employee.access_modules.length > 0;
};

export const getExpandedAccessModules = (employeeOrModules) => {
  const rawModules = Array.isArray(employeeOrModules)
    ? employeeOrModules
    : Array.isArray(employeeOrModules?.access_modules)
      ? employeeOrModules.access_modules
      : [];

  const normalized = new Set(rawModules.map(normalizeModuleCode).filter(Boolean));
  if (normalized.has('crm')) CRM_MODULE_KEYS.forEach((key) => normalized.add(key));
  if (normalized.has('hrms')) HRMS_MODULE_KEYS.forEach((key) => normalized.add(key));
  COMMON_MODULE_KEYS.forEach((key) => normalized.add(key));
  return Array.from(normalized);
};

export const hasModuleAccess = (employee, moduleKey) => {
  const normalizedKey = normalizeModuleCode(moduleKey);

  if (COMMON_MODULE_KEYS.includes(normalizedKey)) {
    return true;
  }

  if (isSuperAdminRole(employee?.role)) return true;
  if (!isModuleRestrictedEmployee(employee)) return true;
  const expanded = new Set(getExpandedAccessModules(employee));
  return expanded.has(normalizedKey);
};

export const hasAnyModuleAccess = (employee, moduleKeys = []) => {
  const keys = Array.isArray(moduleKeys) ? moduleKeys : [moduleKeys];
  return keys.some((key) => hasModuleAccess(employee, key));
};

export const hasCrmModuleAccess = (employee) => {
  return hasAnyModuleAccess(employee, CRM_MODULE_KEYS);
};

export const hasHrmsModuleAccess = (employee) => {
  return hasAnyModuleAccess(employee, HRMS_MODULE_KEYS);
};

export const getDefaultPortalRoute = (employee) => {
  if (!employee) return '/login';
  const role = normalizeRole(employee?.role);
  if (isSuperAdminRole(role)) {
    const panel = normalizeSuperAdminPanel(employee?.superadmin_panel);
    return panel === 'setup' ? '/superadmin/setup' : '/superadmin/master';
  }

  const moduleRestricted = isModuleRestrictedEmployee(employee);
  if (!moduleRestricted) {
    if (role === 'admin') return '/admin';
    if (role === 'manager') return '/manager';
    if (isHrRole(role)) return '/hr';
    if (role === 'designer_manager') return '/designer-manager';
    return '/';
  }

  const canCRM = hasCrmModuleAccess(employee);
  const canHRMS = hasHrmsModuleAccess(employee);

  if (canHRMS && !canCRM) {
    return '/hr';
  }
  if (canCRM && !canHRMS) {
    if (role === 'admin') return '/admin';
    if (role === 'manager') return '/manager';
    return '/';
  }

  if (canCRM && canHRMS) {
    if (role === 'admin') return '/admin';
    if (role === 'manager') return '/manager';
    if (isHrRole(role)) return '/hr';
    return '/';
  }

  return '/login';
};

