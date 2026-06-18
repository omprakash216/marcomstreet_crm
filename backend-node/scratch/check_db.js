const { query } = require('../config/database');

async function test() {
  try {
    console.log('--- Inspecting chat_messages table columns ---');
    const columns = await query('SHOW COLUMNS FROM chat_messages');
    console.table(columns);

    console.log('\n--- Running unread_count query ---');
    const employeeId = 1; // dummy test ID
    const unread = await query(
      'SELECT COUNT(*) as count FROM chat_messages WHERE to_employee_id = ? AND is_read = 0',
      [employeeId]
    );
    console.log('Unread Count Success:', unread);

    console.log('\n--- Running notifications query ---');
    const limitVal = 20;
    const notifications = await query(
      `SELECT cm.*, e.name as from_name 
       FROM chat_messages cm
       JOIN employees e ON e.id = cm.from_employee_id
       WHERE cm.to_employee_id = ? AND cm.is_read = 0
       ORDER BY cm.created_at DESC LIMIT ?`,
      [employeeId, limitVal]
    );
    console.log('Notifications query success! Found:', notifications.length, 'rows');
  } catch (err) {
    console.error('Test script failed with error:', err);
  } finally {
    process.exit(0);
  }
}

test();
