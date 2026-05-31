const { query } = require('../config/database');

async function ensureApiAuditLogTable() {
  // Minimal compatible schema (no FK) so it can be created even on partial DBs.
  const ddlJson = `
    CREATE TABLE IF NOT EXISTS api_audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NULL,
      endpoint VARCHAR(255) NOT NULL,
      method VARCHAR(10) NOT NULL,
      ip_address VARCHAR(45) NULL,
      user_agent TEXT NULL,
      request_data JSON NULL,
      response_code INT NULL,
      accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_employee_access (employee_id, accessed_at),
      INDEX idx_endpoint (endpoint)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `;

  try {
    await query(ddlJson);
  } catch (err) {
    // Some MariaDB/MySQL variants might not support JSON type; fallback to LONGTEXT.
    const msg = String(err?.message || '');
    if (err?.code === 'ER_PARSE_ERROR' || /json/i.test(msg)) {
      await query(`
        CREATE TABLE IF NOT EXISTS api_audit_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          employee_id INT NULL,
          endpoint VARCHAR(255) NOT NULL,
          method VARCHAR(10) NOT NULL,
          ip_address VARCHAR(45) NULL,
          user_agent TEXT NULL,
          request_data LONGTEXT NULL,
          response_code INT NULL,
          accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_employee_access (employee_id, accessed_at),
          INDEX idx_endpoint (endpoint)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      return;
    }
    throw err;
  }
}

function truncateString(value, maxLen) {
  const s = String(value ?? '');
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '…';
}

function sanitize(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return '[truncated]';

  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));

  if (typeof value === 'object') {
    const out = {};
    const keys = Object.keys(value).slice(0, 50);
    for (const k of keys) {
      const key = String(k).toLowerCase();
      if (
        key.includes('password') ||
        key === 'token' ||
        key.includes('access_token') ||
        key.includes('refresh_token') ||
        key.includes('authorization') ||
        key.includes('api_key') ||
        key.includes('apikey')
      ) {
        out[k] = '***';
      } else {
        out[k] = sanitize(value[k], depth + 1);
      }
    }
    return out;
  }

  if (typeof value === 'string') {
    // Avoid huge base64/data blobs in logs.
    if (value.length > 500) return value.slice(0, 500) + '…';
    return value;
  }

  return value;
}

function getIp(req) {
  const xf = req.headers['x-forwarded-for'];
  const fromHeader = Array.isArray(xf) ? xf[0] : String(xf || '');
  const ip = fromHeader.split(',')[0]?.trim();
  return ip || req.socket?.remoteAddress || null;
}

function buildRequestData(req, durationMs) {
  const data = {
    query: sanitize(req.query || {}),
    duration_ms: durationMs,
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    data.body = sanitize(req.body || {});
  }
  return data;
}

async function insertAuditLog(row) {
  const {
    employeeId,
    endpoint,
    method,
    ipAddress,
    userAgent,
    requestData,
    responseCode,
  } = row;

  const sql = `
    INSERT INTO api_audit_log
      (employee_id, endpoint, method, ip_address, user_agent, request_data, response_code)
    VALUES
      (?, ?, ?, ?, ?, ?, ?)
  `;

  let json = null;
  try {
    const s = JSON.stringify(requestData ?? null);
    // Keep it reasonably small (MySQL JSON can be large, but UI doesn't need it huge).
    json = s && s.length <= 10000 ? s : null;
  } catch (e) {
    json = null;
  }

  await query(sql, [
    employeeId ?? null,
    truncateString(endpoint, 255),
    truncateString(method, 10),
    ipAddress ?? null,
    userAgent ?? null,
    json,
    Number.isFinite(Number(responseCode)) ? Number(responseCode) : null,
  ]);
}

function apiAuditLogger(req, res, next) {
  // Log only API requests (avoid frontend assets).
  if (!req.originalUrl || !req.originalUrl.startsWith('/api/')) return next();

  const startedAt = process.hrtime.bigint();

  res.once('finish', () => {
    // Never block the response; log in background.
    Promise.resolve()
      .then(async () => {
        const durationMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);
        const endpoint = String(req.originalUrl || '').split('?')[0] || req.path || '';

        const row = {
          employeeId: req.employee?.id ?? null,
          endpoint,
          method: req.method,
          ipAddress: getIp(req),
          userAgent: req.headers['user-agent'] || null,
          requestData: buildRequestData(req, durationMs),
          responseCode: res.statusCode,
        };

        try {
          await insertAuditLog(row);
        } catch (err) {
          if (err && err.code === 'ER_NO_SUCH_TABLE' && /api_audit_log/i.test(String(err.message || ''))) {
            await ensureApiAuditLogTable();
            await insertAuditLog(row).catch(() => {});
            return;
          }
          // Ignore all other audit-log failures (do not impact API).
        }
      })
      .catch(() => {});
  });

  next();
}

module.exports = { apiAuditLogger };
