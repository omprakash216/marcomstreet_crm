const net = require('net');
const mysql = require('mysql2/promise');
const { envNumber, envPath } = require('../config/env');

const host = process.env.DB_HOST || '127.0.0.1';
const port = envNumber('DB_PORT', 3306);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'marcom_street_crm';

function checkPortOpen(targetHost, targetPort, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    function finish(result) {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ open: true }));
    socket.once('timeout', () => finish({ open: false, reason: 'timeout' }));
    socket.once('error', (err) => finish({ open: false, reason: err.code || err.message }));
    socket.connect(targetPort, targetHost);
  });
}

async function run() {
  console.log('DB Doctor');
  console.log('Env file:', envPath);
  console.log(`Target: ${host}:${port}`);
  console.log(`User: ${user}`);
  console.log(`Database: ${database}`);

  const portCheck = await checkPortOpen(host, port);
  if (!portCheck.open) {
    console.error('');
    console.error(`Cannot reach MySQL at ${host}:${port} (${portCheck.reason}).`);
    console.error('Start MySQL service or update DB_HOST/DB_PORT in backend-node/.env.');
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 10000,
    });

    const [serverRows] = await connection.query('SELECT NOW() AS server_time, DATABASE() AS db_name');
    const [employeesTable] = await connection.query("SHOW TABLES LIKE 'employees'");
    const [employeesCountRows] = await connection.query('SELECT COUNT(*) AS total FROM employees');
    const employeesCount = Array.isArray(employeesCountRows) && employeesCountRows[0] ? employeesCountRows[0].total : 0;

    console.log('');
    console.log('Database connection: OK');
    if (Array.isArray(serverRows) && serverRows[0]) {
      console.log(`Server time: ${serverRows[0].server_time}`);
      console.log(`Active DB: ${serverRows[0].db_name}`);
    }

    if (!Array.isArray(employeesTable) || employeesTable.length === 0) {
      console.error('Connected, but required table `employees` is missing.');
      console.error('Run database/COMPLETE_DATABASE_SETUP.sql.');
      process.exit(1);
    }

    console.log(`employees table: OK (${employeesCount} rows)`);
    console.log('');
    console.log('Result: Backend DB setup looks good.');
    process.exit(0);
  } catch (err) {
    console.error('');
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Access denied: check DB_USER and DB_PASSWORD in backend-node/.env.');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error(`Database \`${database}\` not found. Create it or run database/COMPLETE_DATABASE_SETUP.sql.`);
    } else if (err.code === 'ECONNREFUSED') {
      console.error(`Connection refused at ${host}:${port}. Start MySQL service.`);
    }
    console.error('DB Doctor failed:', err.message || err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

run();
