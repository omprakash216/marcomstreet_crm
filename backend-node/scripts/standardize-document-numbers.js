#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getConnection } = require('../config/database');
const {
  DEFAULT_PREFIX,
  ensureSequenceTable,
  formatDocumentNumber,
  getFinancialYear,
} = require('../utils/documentNumbers');

const DOCS = [
  {
    docType: 'quotation',
    label: 'quotations',
    table: 'quotations',
    numberColumn: 'quotation_number',
    preferredDateColumns: ['issue_date', 'created_at'],
  },
  {
    docType: 'invoice',
    label: 'invoices',
    table: 'invoices',
    numberColumn: 'invoice_number',
    preferredDateColumns: ['issue_date', 'issued_at', 'created_at'],
  },
];

function qid(identifier) {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

async function getColumns(conn, table) {
  try {
    const [rows] = await conn.execute(`SHOW COLUMNS FROM ${qid(table)}`);
    return new Set((rows || []).map((r) => r.Field));
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return null;
    throw err;
  }
}

function firstDate(row, columns) {
  for (const col of columns) {
    if (row[col]) return row[col];
  }
  return new Date();
}

async function standardizeDoc(conn, doc) {
  const columns = await getColumns(conn, doc.table);
  if (!columns) {
    console.log(`SKIP: ${doc.table} table not found`);
    return;
  }
  if (!columns.has('id') || !columns.has(doc.numberColumn)) {
    console.log(`SKIP: ${doc.table} missing id or ${doc.numberColumn}`);
    return;
  }

  const dateColumns = doc.preferredDateColumns.filter((col) => columns.has(col));
  const selectDateColumns = dateColumns.map((col) => qid(col)).join(', ');
  const orderDate = dateColumns.length
    ? `COALESCE(${dateColumns.map((col) => qid(col)).join(', ')})`
    : 'id';
  const selectSql = `SELECT id, ${qid(doc.numberColumn)}${selectDateColumns ? `, ${selectDateColumns}` : ''}
                     FROM ${qid(doc.table)}
                     ORDER BY ${orderDate} ASC, id ASC`;
  const [rows] = await conn.execute(selectSql);
  if (!rows.length) {
    console.log(`OK: ${doc.label} has no rows`);
    return;
  }

  const tempPrefix = `TMP-${doc.docType.toUpperCase()}-${Date.now()}-`;
  const counters = new Map();

  await conn.beginTransaction();
  try {
    await conn.execute(
      `UPDATE ${qid(doc.table)} SET ${qid(doc.numberColumn)} = CONCAT(?, id)`,
      [tempPrefix]
    );

    for (const row of rows) {
      const financialYear = getFinancialYear(firstDate(row, dateColumns));
      const nextSeq = (counters.get(financialYear) || 0) + 1;
      counters.set(financialYear, nextSeq);
      const number = formatDocumentNumber(doc.docType, financialYear, nextSeq, DEFAULT_PREFIX);
      await conn.execute(
        `UPDATE ${qid(doc.table)} SET ${qid(doc.numberColumn)} = ? WHERE id = ?`,
        [number, row.id]
      );
    }

    for (const [financialYear, lastNumber] of counters.entries()) {
      await conn.execute(
        `INSERT INTO document_number_sequences (doc_type, financial_year, last_number)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE last_number = VALUES(last_number)`,
        [doc.docType, financialYear, lastNumber]
      );
    }

    await conn.commit();
    console.log(`OK: ${doc.label} standardized (${rows.length} rows)`);
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}

async function run() {
  let conn;
  try {
    conn = await getConnection();
    await ensureSequenceTable(conn);
    for (const doc of DOCS) {
      await standardizeDoc(conn, doc);
    }
    console.log('Document number standardization complete.');
  } finally {
    if (conn) conn.release();
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
