const { query, getConnection } = require('../config/database');

const allowedWebhookSources = ['hubspot', 'salesforce', 'zoho'];

function safeStringify(payload) {
  try {
    const json = JSON.stringify(payload || {});
    return json.length > 2000 ? json.slice(0, 2000) + '...' : json;
  } catch {
    return '';
  }
}

async function logApiRequest({ company_id, endpoint, method, request_body, response_status, success }) {
  await query(
    `INSERT INTO api_logs (company_id, endpoint, method, request_body, response_status, success) VALUES (?,?,?,?,?,?)`,
    [company_id || null, endpoint || '', method || 'POST', request_body || '', response_status || 0, success ? 1 : 0]
  ).catch(() => {});
}

async function logWebhookRequest({ company_id, source, payload, status, success }) {
  await query(
    `INSERT INTO webhook_logs (company_id, source, payload, response_status, success) VALUES (?,?,?,?,?)`,
    [company_id || null, source || '', payload || '', status || 0, success ? 1 : 0]
  ).catch(() => {});
}

async function createImportJob({ company_id, file_name, total_rows }) {
  const conn = await getConnection();
  try {
    const [r] = await conn.execute(
      `INSERT INTO import_jobs (company_id, file_name, status, total_rows) VALUES (?,?,?,?)`,
      [company_id || null, file_name || 'bulk_import', 'pending', total_rows || 0]
    );
    return r.insertId;
  } finally {
    conn.release();
  }
}

async function updateImportJob(jobId, updates = {}) {
  const fields = [];
  const params = [];
  if (updates.status) {
    fields.push('status = ?');
    params.push(updates.status);
  }
  if (updates.success_count != null) {
    fields.push('success_count = ?');
    params.push(updates.success_count);
  }
  if (updates.failure_count != null) {
    fields.push('failure_count = ?');
    params.push(updates.failure_count);
  }
  if (updates.errors) {
    fields.push('errors = ?');
    params.push(updates.errors);
  }
  if (!fields.length) return;
  params.push(jobId);
  await query(`UPDATE import_jobs SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, params).catch(() => {});
}

async function getIntegrationStats() {
  try {
    const [total] = await query('SELECT COUNT(*) as c FROM api_logs');
    const [successful] = await query('SELECT COUNT(*) as c FROM api_logs WHERE success = 1');
    const [failed] = await query('SELECT COUNT(*) as c FROM api_logs WHERE success = 0');
    const [imported] = await query("SELECT COALESCE(SUM(success_count),0) as total FROM import_jobs WHERE status = 'completed'");
    return {
      total_api_calls: Number(total?.c) || 0,
      successful_requests: Number(successful?.c) || 0,
      failed_requests: Number(failed?.c) || 0,
      total_imported_leads: Number(imported?.total) || 0,
    };
  } catch (err) {
    return {
      total_api_calls: 0,
      successful_requests: 0,
      failed_requests: 0,
      total_imported_leads: 0,
    };
  }
}

async function validateLeadPayload(payload) {
  const normalized = {};
  const keys = ['company_name', 'contact_person', 'email', 'phone', 'priority', 'notes'];
  keys.forEach((key) => {
    const value = payload[key];
    normalized[key] = typeof value === 'string' ? value.trim() : value || '';
  });
  if (!normalized.company_name) throw Object.assign(new Error('company_name is required'), { statusCode: 400 });
  if (!normalized.contact_person) throw Object.assign(new Error('contact_person is required'), { statusCode: 400 });
  if (!normalized.email) throw Object.assign(new Error('email is required'), { statusCode: 400 });
  if (!normalized.phone) throw Object.assign(new Error('phone is required'), { statusCode: 400 });
  normalized.priority = ['low', 'medium', 'high', 'urgent'].includes(normalized.priority?.toLowerCase())
    ? normalized.priority.toLowerCase()
    : 'medium';
  normalized.notes = normalized.notes || '';
  return normalized;
}

async function getNextLeadCode() {
  const [max] = await query('SELECT COALESCE(MAX(id),0) as max_id FROM leads');
  const nextId = Number(max?.max_id || 0) + 1;
  return 'API' + String(nextId).padStart(6, '0');
}

async function assignLead() {
  const candidates = await query('SELECT id FROM employees WHERE role IN ("admin","manager") AND status = "active" ORDER BY id LIMIT 1');
  return (candidates[0] && candidates[0].id) || 1;
}

async function insertLeadForCompany(companyId, payload = {}) {
  const data = await validateLeadPayload(payload);
  const leadCode = await getNextLeadCode();
  const assignedTo = await assignLead();
  const conn = await getConnection();
  try {
    const [result] = await conn.execute(
      `INSERT INTO leads (company_id, lead_code, company_name, contact_person, email, phone, assigned_to, source, status, priority, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [companyId, leadCode, data.company_name, data.contact_person, data.email, data.phone, assignedTo, 'api_integration', 'new', data.priority, data.notes]
    );
    return {
      id: result.insertId,
      lead_code: leadCode,
      company_name: data.company_name,
      contact_person: data.contact_person,
      email: data.email,
      phone: data.phone,
      priority: data.priority,
      notes: data.notes,
    };
  } finally {
    conn.release();
  }
}

async function insertLeadsBatch(companyId, leads = []) {
  const jobId = await createImportJob({ company_id: companyId, file_name: 'bulk-upload', total_rows: leads.length });
  let successCount = 0;
  let failureCount = 0;
  const errors = [];
  for (const lead of leads) {
    try {
      await insertLeadForCompany(companyId, lead);
      successCount += 1;
    } catch (err) {
      failureCount += 1;
      errors.push(err.message);
    }
  }
  const status = failureCount > 0 ? 'completed_with_errors' : 'completed';
  await updateImportJob(jobId, { status, success_count: successCount, failure_count: failureCount, errors: errors.join('\n') });
  return { job_id: jobId, success_count: successCount, failure_count: failureCount, errors };
}

module.exports = {
  logApiRequest,
  logWebhookRequest,
  getIntegrationStats,
  insertLeadForCompany,
  insertLeadsBatch,
  allowedWebhookSources,
  safeStringify,
};
