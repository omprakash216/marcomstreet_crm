const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function upsertPanelUser({
  code,
  name,
  email,
  password,
  designation,
}) {
  const hashed = await bcrypt.hash(password, 10);
  const existing = await query('SELECT id FROM employees WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
  if (existing.length > 0) {
    await query(
      `UPDATE employees
       SET employee_code = ?, name = ?, password = ?, role = ?, designation = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [code, name, hashed, 'superadmin', designation, 'active', existing[0].id]
    );
    return { email, action: 'updated' };
  }

  await query(
    `INSERT INTO employees
      (employee_code, name, email, password, role, designation, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [code, name, email, hashed, 'superadmin', designation, 'active']
  );
  return { email, action: 'created' };
}

async function run() {
  const users = [
    {
      code: 'SUPER-MASTER-001',
      name: 'Master Admin',
      email: 'master.admin@crm.com',
      password: 'Master@123',
      designation: 'Platform Owner Master Panel',
    },
    {
      code: 'SUPER-SETUP-001',
      name: 'Super Admin Setup',
      email: 'setup.admin@crm.com',
      password: 'Setup@123',
      designation: 'Company Setup Super Admin',
    },
  ];

  const results = [];
  for (const user of users) {
    // eslint-disable-next-line no-await-in-loop
    const result = await upsertPanelUser(user);
    results.push(result);
  }

  console.log('Panel login seed completed:', results);
}

run()
  .catch((error) => {
    console.error('Failed to seed panel logins:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      const { pool } = require('../config/database');
      if (pool && typeof pool.end === 'function') {
        await pool.end();
      }
    } catch (_) {}
  });

