const DEFAULT_PREFIX = process.env.DOCUMENT_NUMBER_PREFIX || 'VG';

const CONFIG = {
  quotation: { code: 'QT', table: 'quotations', column: 'quotation_number' },
  invoice: { code: 'INV', table: 'invoices', column: 'invoice_number' },
};

function getFinancialYear(dateInput = new Date()) {
  let year;
  let month;

  if (typeof dateInput === 'string' && /^\d{4}-\d{2}/.test(dateInput)) {
    year = Number(dateInput.slice(0, 4));
    month = Number(dateInput.slice(5, 7));
  } else {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    year = d.getFullYear();
    month = d.getMonth() + 1;
  }

  const startYear = month >= 4 ? year : year - 1;
  const endYear = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYear}`;
}

function localYmd(dateInput = new Date()) {
  const d = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatDocumentNumber(docType, financialYear, seq, prefix = DEFAULT_PREFIX) {
  const cfg = CONFIG[docType];
  if (!cfg) throw new Error(`Unsupported document type: ${docType}`);
  return `${prefix}/${cfg.code}/${financialYear}/${String(seq).padStart(4, '0')}`;
}

async function ensureSequenceTable(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS document_number_sequences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doc_type VARCHAR(20) NOT NULL,
      financial_year VARCHAR(7) NOT NULL,
      last_number INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_doc_fy (doc_type, financial_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function syncSequenceFloor(conn, docType, financialYear, prefix = DEFAULT_PREFIX) {
  const cfg = CONFIG[docType];
  if (!cfg) throw new Error(`Unsupported document type: ${docType}`);

  const likePattern = `${prefix}/${cfg.code}/${financialYear}/%`;
  const [rows] = await conn.execute(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(${cfg.column}, '/', -1) AS UNSIGNED)), 0) AS max_seq
     FROM ${cfg.table}
     WHERE ${cfg.column} LIKE ?`,
    [likePattern]
  );
  const maxSeq = Number(rows?.[0]?.max_seq) || 0;

  await conn.execute(
    `INSERT INTO document_number_sequences (doc_type, financial_year, last_number)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE last_number = GREATEST(last_number, VALUES(last_number))`,
    [docType, financialYear, maxSeq]
  );
}

async function nextDocumentNumber(conn, docType, dateInput = new Date(), prefix = DEFAULT_PREFIX) {
  const cfg = CONFIG[docType];
  if (!cfg) throw new Error(`Unsupported document type: ${docType}`);

  const financialYear = getFinancialYear(dateInput);
  await ensureSequenceTable(conn);
  await syncSequenceFloor(conn, docType, financialYear, prefix);

  let seq = 1;
  await conn.beginTransaction();
  try {
    await conn.execute(
      `INSERT IGNORE INTO document_number_sequences (doc_type, financial_year, last_number)
       VALUES (?, ?, 0)`,
      [docType, financialYear]
    );
    const [rows] = await conn.execute(
      `SELECT last_number
       FROM document_number_sequences
       WHERE doc_type = ? AND financial_year = ?
       FOR UPDATE`,
      [docType, financialYear]
    );
    seq = (Number(rows?.[0]?.last_number) || 0) + 1;
    await conn.execute(
      `UPDATE document_number_sequences
       SET last_number = ?
       WHERE doc_type = ? AND financial_year = ?`,
      [seq, docType, financialYear]
    );
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch (_) { }
    throw err;
  }

  return formatDocumentNumber(docType, financialYear, seq, prefix);
}

module.exports = {
  DEFAULT_PREFIX,
  getFinancialYear,
  localYmd,
  formatDocumentNumber,
  ensureSequenceTable,
  nextDocumentNumber,
};
