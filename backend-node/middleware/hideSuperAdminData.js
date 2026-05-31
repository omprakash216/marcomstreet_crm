const { query } = require('../config/database');

const SUPER_ROLES = new Set(['superadmin', 'super_admin']);
const CACHE_TTL_MS = Number(process.env.SUPERADMIN_CACHE_TTL_MS || 60 * 1000);
const HIDE = Symbol('HIDE_SUPERADMIN');

const superAdminCache = {
  loadedAt: 0,
  loading: null,
  ids: new Set(),
  names: new Set(),
  emails: new Set(),
};

function normalizeRole(role) {
  return String(role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

function isSuperRole(role) {
  return SUPER_ROLES.has(normalizeRole(role));
}

function normalizeText(v) {
  return String(v || '').toLowerCase().trim();
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isObject(v) {
  return v !== null && typeof v === 'object';
}

function isRecordObject(v) {
  return Object.prototype.toString.call(v) === '[object Object]';
}

function asFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function refreshSuperAdminCache() {
  let rows = [];
  try {
    rows = await query(
      `SELECT id, name, email, role
       FROM employees
       WHERE LOWER(REPLACE(REPLACE(TRIM(role), ' ', '_'), '-', '_')) IN ('superadmin', 'super_admin')`
    );
  } catch (err) {
    const msg = String(err?.message || '');
    if (!/unknown column|doesn't exist|no such table/i.test(msg)) {
      console.warn('[security] failed to refresh superadmin cache:', msg);
    }
    return;
  }

  const ids = new Set();
  const names = new Set();
  const emails = new Set();

  for (const row of Array.isArray(rows) ? rows : []) {
    const id = asFiniteNumber(row?.id);
    if (id !== null) ids.add(id);

    const name = normalizeText(row?.name);
    if (name) names.add(name);

    const email = normalizeText(row?.email);
    if (email) emails.add(email);
  }

  superAdminCache.ids = ids;
  superAdminCache.names = names;
  superAdminCache.emails = emails;
  superAdminCache.loadedAt = Date.now();
}

function ensureSuperAdminCacheFresh() {
  const now = Date.now();
  if (superAdminCache.loading) return;
  if (superAdminCache.loadedAt && now - superAdminCache.loadedAt < CACHE_TTL_MS) return;

  superAdminCache.loading = refreshSuperAdminCache()
    .catch((err) => {
      console.warn('[security] superadmin cache refresh error:', err?.message || err);
    })
    .finally(() => {
      superAdminCache.loading = null;
    });
}

function isEmployeeLikeObject(obj) {
  if (!isObject(obj) || Array.isArray(obj)) return false;
  const keys = [
    'employee_code',
    'department_id',
    'designation',
    'role',
    'role_name',
    'email',
    'phone',
    'company_id',
  ];
  return keys.some((k) => hasOwn(obj, k));
}

function isLikelyUserObject(obj) {
  if (!isObject(obj) || Array.isArray(obj)) return false;
  if (isEmployeeLikeObject(obj)) return true;
  if (!hasOwn(obj, 'name')) return false;

  const hintKeys = [
    'department',
    'department_name',
    'current_target',
    'metric_type',
    'total_leads',
    'total_revenue',
    'pending_tasks',
    'attendance_rate',
    'avatar',
    'last_login',
    'employee_name',
    'user_name',
    'from_name',
  ];
  return hintKeys.some((k) => hasOwn(obj, k));
}

function hasSuperRoleFields(obj) {
  const roleKeys = ['role', 'role_name', 'user_role', 'employee_role'];
  for (const key of roleKeys) {
    if (hasOwn(obj, key) && isSuperRole(obj[key])) return true;
  }
  if (hasOwn(obj, 'is_super_admin') && String(obj.is_super_admin).toLowerCase() === 'true') return true;
  return false;
}

function hasSuperActorId(obj) {
  const idKeys = [
    'employee_id',
    'user_id',
    'from_employee_id',
    'to_employee_id',
    'approved_by',
    'assigned_by',
    'reviewer_id',
    'verified_by',
    'created_by',
    'updated_by',
    'owner_id',
    'actor_id',
  ];
  for (const key of idKeys) {
    if (!hasOwn(obj, key)) continue;
    const n = asFiniteNumber(obj[key]);
    if (n !== null && superAdminCache.ids.has(n)) return true;
  }

  if (isLikelyUserObject(obj) && hasOwn(obj, 'id')) {
    const id = asFiniteNumber(obj.id);
    if (id !== null && superAdminCache.ids.has(id)) return true;
  }
  return false;
}

function hasSuperAdminIdentityFields(obj) {
  const email = normalizeText(obj?.email);
  if (email && superAdminCache.emails.has(email)) return true;

  const nameKeys = [
    'employee_name',
    'from_name',
    'user_name',
    'approved_by_name',
    'reviewer_name',
    'verified_by_name',
    'actor_name',
  ];
  for (const key of nameKeys) {
    const value = normalizeText(obj?.[key]);
    if (value && superAdminCache.names.has(value)) return true;
  }

  if (isLikelyUserObject(obj)) {
    const name = normalizeText(obj?.name);
    if (name && superAdminCache.names.has(name)) return true;
  }

  return false;
}

function shouldHideObject(obj) {
  if (!isObject(obj) || Array.isArray(obj)) return false;
  if (hasSuperRoleFields(obj)) return true;
  if (hasSuperActorId(obj)) return true;
  if (hasSuperAdminIdentityFields(obj)) return true;
  return false;
}

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) {
      const cleaned = sanitizeValue(item);
      if (cleaned !== HIDE) out.push(cleaned);
    }
    return out;
  }

  if (!isObject(value)) return value;
  if (value instanceof Date) return value;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return value;
  if (!isRecordObject(value)) return value;

  if (shouldHideObject(value)) return HIDE;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const cleaned = sanitizeValue(v);
    if (cleaned === HIDE) {
      out[k] = Array.isArray(v) ? [] : null;
      continue;
    }
    out[k] = cleaned;
  }
  return out;
}

function shouldBypass(req) {
  const role = normalizeRole(req?.employee?.role);
  if (!role) return true;
  if (isSuperRole(role)) return true;
  if (String(req?.path || '').startsWith('/api/superadmin')) return true;
  return false;
}

function hideSuperAdminData(req, res, next) {
  ensureSuperAdminCacheFresh();

  const originalJson = res.json.bind(res);
  res.json = function patchedJson(body) {
    if (shouldBypass(req)) return originalJson(body);
    try {
      const sanitized = sanitizeValue(body);
      if (sanitized === HIDE) {
        return originalJson({ success: true, data: [] });
      }
      return originalJson(sanitized);
    } catch (err) {
      console.warn('[security] sanitize response failed:', err?.message || err);
      return originalJson(body);
    }
  };

  next();
}

module.exports = { hideSuperAdminData, isSuperRole, normalizeRole };
