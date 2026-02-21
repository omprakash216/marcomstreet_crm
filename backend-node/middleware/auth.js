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

module.exports = { verifyToken, JWT_SECRET };
