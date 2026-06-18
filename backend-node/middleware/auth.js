const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'marcom_crm_secret_key_2024';

function clearSessionAndRespond(req, res, status, payload) {
  if (req.session && typeof req.session.destroy === 'function') {
    req.session.destroy(() => {
      res.clearCookie('sid');
      return res.status(status).json(payload);
    });
    return;
  }
  res.clearCookie('sid');
  return res.status(status).json(payload);
}

function buildSessionGuard({ touchActivity = true } = {}) {
  return function verifySession(req, res, next) {
  // Set cache control headers to prevent back-button viewing
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  console.log('[DEBUG AUTH] URL:', req.originalUrl || req.url);
  console.log('[DEBUG AUTH] Cookie Header:', req.headers.cookie);
  console.log('[DEBUG AUTH] Session ID:', req.sessionID);
  console.log('[DEBUG AUTH] Session employee:', req.session ? req.session.employee : 'no session');

  if (!req.session || !req.session.employee) {
    console.log('[DEBUG AUTH] Auth failed - no session or employee');
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Please login again',
      error: 'Session missing or invalid',
    });
  }

  const now = Date.now();
  const idleTimeout = 15 * 60 * 1000; // 15 minutes
  const absoluteTimeout = 8 * 60 * 60 * 1000; // 8 hours

  const lastActive = req.session.lastActive || now;
  const createdAt = req.session.createdAt || now;

  // 1) Idle Timeout Check
  if (now - lastActive > idleTimeout) {
    return clearSessionAndRespond(req, res, 401, {
      success: false,
      message: 'Session expired due to inactivity. Please login again.',
    });
  }

  // 2) Absolute Timeout Check
  if (now - createdAt > absoluteTimeout) {
    return clearSessionAndRespond(req, res, 401, {
      success: false,
      message: 'Session expired (absolute timeout). Please login again.',
    });
  }

  // Session is valid, update activity and set req.employee
  if (touchActivity) {
    req.session.lastActive = now;
  }
  req.employee = req.session.employee;
  next();
  };
}

const verifyToken = buildSessionGuard({ touchActivity: true });
const verifyTokenNoTouch = buildSessionGuard({ touchActivity: false });

async function verifySuperAdmin(req, res, next) {
  if (!req.employee) {
    return res.status(401).json({ success: false, message: 'Unauthorized - Please login again' });
  }
  const role = String(req.employee.role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  if (role !== 'superadmin' && role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Super Admin access required' });
  }
  next();
}

async function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey) {
    return res.status(401).json({ success: false, message: 'API Key missing' });
  }
  try {
    const rows = await query('SELECT company_id FROM api_keys WHERE api_key = ?', [apiKey]);
    if (!rows[0]) {
      return res.status(401).json({ success: false, message: 'Invalid API Key' });
    }
    req.company_id = rows[0].company_id;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error during API key verification' });
  }
}

module.exports = { verifyToken, verifyTokenNoTouch, verifySuperAdmin, verifyApiKey, JWT_SECRET };
