const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'marcom_crm_secret_key_2024';

async function verifyToken(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Please login again',
      error: 'Authentication token missing or invalid',
    });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    const rows = await query(
      'SELECT * FROM employees WHERE id = ? AND status = ?',
      [decoded.id, 'active']
    );
    const employee = rows[0];
    if (!employee) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    req.employee = employee;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Please login again',
      error: err.message,
    });
  }
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

module.exports = { verifyToken, verifyApiKey, JWT_SECRET };
