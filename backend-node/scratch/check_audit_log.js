const { query } = require('../config/database');

async function checkAuditLog() {
  try {
    console.log('--- Inspecting recent 500 errors in api_audit_log ---');
    const logs = await query(
      `SELECT * FROM api_audit_log 
       WHERE response_code = 500
       ORDER BY accessed_at DESC LIMIT 50`
    );
    if (logs.length === 0) {
      console.log('No 500 errors found in api_audit_log.');
    } else {
      console.table(logs.map(log => ({
        id: log.id,
        employee_id: log.employee_id,
        endpoint: log.endpoint,
        method: log.method,
        response_code: log.response_code,
        accessed_at: log.accessed_at,
        request_data: log.request_data ? log.request_data.substring(0, 100) : null
      })));
    }
  } catch (err) {
    console.error('Failed to query api_audit_log:', err.message);
  } finally {
    process.exit(0);
  }
}

checkAuditLog();
