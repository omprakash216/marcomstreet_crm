const { query } = require('../config/database');

async function check500() {
  try {
    const logs = await query(
      `SELECT id, employee_id, endpoint, method, response_code, accessed_at, request_data 
       FROM api_audit_log 
       WHERE response_code = 500
       ORDER BY accessed_at DESC LIMIT 10`
    );
    console.log(`Found ${logs.length} internal server errors:`);
    for (const log of logs) {
      console.log(`- ID: ${log.id}, Time: ${log.accessed_at}, Endpoint: ${log.endpoint}, Method: ${log.method}, Emp: ${log.employee_id}`);
      console.log(`  Data: ${log.request_data}`);
    }
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit(0);
  }
}

check500();
