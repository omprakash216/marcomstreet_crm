const mysql = require('mysql2/promise');
const { envNumber, envPath } = require('../config/env');

async function testConnection() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = envNumber('DB_PORT', 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'marcom_street_crm';

  console.log('Testing database connection...');
  console.log(`Env: ${envPath}`);
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`User: ${user}`);
  console.log(`Database: ${database}`);

  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 10000,
    });
    console.log('Successfully connected to the database!');
    await connection.end();
    process.exit(0);
  } catch (error) {
    if (error && error.code === 'ECONNREFUSED') {
      console.error(`Connection refused at ${host}:${port}. Start MySQL service or correct DB_HOST/DB_PORT in ${envPath}`);
    }
    console.error('Error connecting to the database:', error);
    process.exit(1);
  }
}

testConnection();
