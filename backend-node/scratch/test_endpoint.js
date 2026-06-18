const jwt = require('jsonwebtoken');
const http = require('http');
const { query } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

async function testRole(employee) {
  console.log(`\n==================================================`);
  console.log(`TESTING ROLE: ${employee.role} (ID: ${employee.id}, Name: ${employee.name})`);
  console.log(`==================================================`);

  const token = jwt.sign(
    {
      id: employee.id,
      email: employee.email,
      role: employee.role,
      company_id: employee.company_id || null,
      tokenVersion: Number(employee.tokenVersion || 0),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    JWT_SECRET
  );

  const endpoints = [
    '/api/chat?action=unread_count',
    '/api/chat?action=notifications'
  ];

  for (const endpoint of endpoints) {
    await new Promise((resolve) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port: 3000,
          path: endpoint,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        },
        (res) => {
          console.log(`[${endpoint}] Status: ${res.statusCode}`);
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            console.log('Body:', body.slice(0, 300));
            resolve();
          });
        }
      );
      req.on('error', (err) => {
        console.error(`[${endpoint}] Failed:`, err.message);
        resolve();
      });
      req.end();
    });
  }
}

async function runTest() {
  try {
    // Get one employee from each unique role
    const employees = await query(`
      SELECT e.* 
      FROM employees e
      WHERE e.status = 'active'
      GROUP BY e.role
    `);
    
    console.log(`Found ${employees.length} distinct roles to test.`);
    for (const emp of employees) {
      await testRole(emp);
    }
  } catch (err) {
    console.error('Test run failed:', err);
  } finally {
    process.exit(0);
  }
}

runTest();
