const { query } = require('../config/database');

async function logActivity(employeeId, activityType, entityType = null, entityId = null, description = '', req = null) {
  try {
    const ip = req && req.headers && req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : (req && req.connection && req.connection.remoteAddress) || 'unknown';
    const ua = req && req.headers && req.headers['user-agent'] ? req.headers['user-agent'] : 'unknown';
    await query(
      'INSERT INTO activity_logs (employee_id, activity_type, entity_type, entity_id, description, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [employeeId, activityType, entityType, entityId, description || '', ip, ua]
    );
  } catch (e) {
    console.error('logActivity error:', e.message);
  }
}

module.exports = { logActivity };
