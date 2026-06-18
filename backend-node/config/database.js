const mysql = require('mysql2/promise');
const mysqlFormat = require('mysql2').format;
const { envNumber } = require('./env');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: envNumber('DB_PORT', 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'marcom_street_crm',
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
  charset: 'utf8mb4',
};

let pool = null;
const QUERY_MODE = 'text-first';

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

async function getConnection() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool.getConnection();
}

async function query(sql, params = []) {
  const conn = await getConnection();
  try {
    let arrParams = [];
    if (params !== undefined && params !== null) {
      arrParams = Array.isArray(params) ? params : [params];
    }
    const safeParams = arrParams.map((p) => (p === undefined || (typeof p === 'number' && Number.isNaN(p)) ? null : p));

    // Use mysql.format() + simple query to bypass prepared statements entirely.
    // This avoids "Incorrect arguments to mysqld_stmt_execute" on MySQL 8.0.22+.
    // mysql.format() safely escapes values - no SQL injection.
    const finalSql = safeParams.length > 0 ? mysqlFormat(sql, safeParams) : sql;
    const [rows] = await conn.query(finalSql);
    return rows;
  } catch (err) {
    console.error('SQL Error:', err.message, 'Query:', sql, 'Params:', params);
    throw err;
  } finally {
    conn.release();
  }
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = { getConnection, query, queryOne, QUERY_MODE, getPool };
