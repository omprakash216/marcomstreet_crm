const express = require('express');
const { getConnection, query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed']);

function normalizeRole(role) {
  return String(role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

function isSuperAdmin(employee) {
  const role = normalizeRole(employee?.role);
  return role === 'superadmin' || role === 'super_admin';
}

function getScopedCompanyId(req, body = {}) {
  if (isSuperAdmin(req.employee) && body.company_id) {
    const companyId = Number(body.company_id);
    return Number.isInteger(companyId) && companyId > 0 ? companyId : null;
  }

  const companyId = Number(req.employee?.company_id);
  return Number.isInteger(companyId) && companyId > 0 ? companyId : null;
}

async function safeSchemaQuery(sql) {
  try {
    return await query(sql);
  } catch (err) {
    const msg = String(err?.message || err?.sqlMessage || '');
    if (
      err?.code === 'ER_DUP_FIELDNAME' ||
      err?.code === 'ER_DUP_KEYNAME' ||
      /Duplicate column name/i.test(msg) ||
      /Duplicate key name/i.test(msg)
    ) {
      return null;
    }
    throw err;
  }
}

async function columnExists(tableName, columnName) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) return;
  await safeSchemaQuery(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function indexExists(tableName, indexName) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function addIndexIfMissing(tableName, indexName, ddl) {
  if (await indexExists(tableName, indexName)) return;
  await safeSchemaQuery(ddl);
}

async function ensureSupportTicketsSchema() {
  await safeSchemaQuery(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_no VARCHAR(50) NULL,
      title VARCHAR(180) NOT NULL,
      description TEXT NULL,
      priority VARCHAR(30) DEFAULT 'medium',
      status VARCHAR(30) DEFAULT 'open',
      category VARCHAR(80) DEFAULT 'general',
      module VARCHAR(80) NULL,
      company_id INT NULL,
      created_by INT NULL,
      assigned_to INT NULL,
      due_date DATE NULL,
      resolution_note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_support_status (status),
      KEY idx_support_company (company_id),
      KEY idx_support_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing('support_tickets', 'ticket_no', 'VARCHAR(50) NULL');
  await addColumnIfMissing('support_tickets', 'title', 'VARCHAR(180) NOT NULL');
  await addColumnIfMissing('support_tickets', 'description', 'TEXT NULL');
  await addColumnIfMissing('support_tickets', 'priority', "VARCHAR(30) DEFAULT 'medium'");
  await addColumnIfMissing('support_tickets', 'status', "VARCHAR(30) DEFAULT 'open'");
  await addColumnIfMissing('support_tickets', 'category', "VARCHAR(80) DEFAULT 'general'");
  await addColumnIfMissing('support_tickets', 'module', 'VARCHAR(80) NULL');
  await addColumnIfMissing('support_tickets', 'company_id', 'INT NULL');
  await addColumnIfMissing('support_tickets', 'created_by', 'INT NULL');
  await addColumnIfMissing('support_tickets', 'assigned_to', 'INT NULL');
  await addColumnIfMissing('support_tickets', 'due_date', 'DATE NULL');
  await addColumnIfMissing('support_tickets', 'resolution_note', 'TEXT NULL');
  await addColumnIfMissing('support_tickets', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('support_tickets', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addIndexIfMissing('support_tickets', 'idx_support_ticket_no', 'CREATE INDEX idx_support_ticket_no ON support_tickets (ticket_no)');
  await addIndexIfMissing('support_tickets', 'idx_support_status', 'CREATE INDEX idx_support_status ON support_tickets (status)');
  await addIndexIfMissing('support_tickets', 'idx_support_company', 'CREATE INDEX idx_support_company ON support_tickets (company_id)');
  await addIndexIfMissing('support_tickets', 'idx_support_created', 'CREATE INDEX idx_support_created ON support_tickets (created_at)');

  await safeSchemaQuery(`
    CREATE TABLE IF NOT EXISTS support_ticket_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NULL,
      ticket_id INT NOT NULL,
      comment TEXT NOT NULL,
      status_from VARCHAR(30) NULL,
      status_to VARCHAR(30) NULL,
      is_internal TINYINT(1) NOT NULL DEFAULT 0,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_support_comments_ticket (ticket_id, created_at),
      KEY idx_support_comments_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing('support_ticket_comments', 'company_id', 'INT NULL');
  await addColumnIfMissing('support_ticket_comments', 'ticket_id', 'INT NOT NULL');
  await addColumnIfMissing('support_ticket_comments', 'comment', 'TEXT NOT NULL');
  await addColumnIfMissing('support_ticket_comments', 'status_from', 'VARCHAR(30) NULL');
  await addColumnIfMissing('support_ticket_comments', 'status_to', 'VARCHAR(30) NULL');
  await addColumnIfMissing('support_ticket_comments', 'is_internal', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing('support_ticket_comments', 'created_by', 'INT NULL');
  await addColumnIfMissing('support_ticket_comments', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addIndexIfMissing(
    'support_ticket_comments',
    'idx_support_comments_ticket',
    'CREATE INDEX idx_support_comments_ticket ON support_ticket_comments (ticket_id, created_at)'
  );
  await addIndexIfMissing(
    'support_ticket_comments',
    'idx_support_comments_company',
    'CREATE INDEX idx_support_comments_company ON support_ticket_comments (company_id)'
  );
}

function nullableString(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeTicketPayload(body = {}) {
  const priority = PRIORITIES.has(String(body.priority || '').toLowerCase())
    ? String(body.priority).toLowerCase()
    : 'medium';
  const status = STATUSES.has(String(body.status || '').toLowerCase())
    ? String(body.status).toLowerCase()
    : 'open';

  return {
    title: String(body.title || '').trim(),
    description: nullableString(body.description),
    priority,
    status,
    category: nullableString(body.category) || 'general',
    module: nullableString(body.module),
    assigned_to: body.assigned_to ? Number(body.assigned_to) : null,
    due_date: body.due_date || null,
    resolution_note: nullableString(body.resolution_note),
  };
}

function validateTicketPayload(data, companyId) {
  if (!companyId) return 'Company is required';
  if (!data.title) return 'Ticket title is required';
  if (data.assigned_to !== null && (!Number.isInteger(data.assigned_to) || data.assigned_to <= 0)) {
    return 'Assigned employee is invalid';
  }
  if (data.due_date && Number.isNaN(Date.parse(data.due_date))) return 'Due date is invalid';
  return null;
}

function buildTicketNo(id, createdAt = new Date().toISOString()) {
  const year = String(createdAt || new Date().toISOString()).slice(0, 4) || new Date().getFullYear();
  return `TKT${year}${String(id).padStart(5, '0')}`;
}

function buildListWhere(req) {
  const where = [];
  const params = [];

  if (isSuperAdmin(req.employee) && req.query.company_id) {
    where.push('t.company_id = ?');
    params.push(req.query.company_id);
  } else if (!isSuperAdmin(req.employee)) {
    where.push('t.company_id = ?');
    params.push(req.employee.company_id);
  }

  if (req.query.status && req.query.status !== 'all') {
    where.push('t.status = ?');
    params.push(req.query.status);
  }
  if (req.query.priority && req.query.priority !== 'all') {
    where.push('t.priority = ?');
    params.push(req.query.priority);
  }
  if (req.query.category && req.query.category !== 'all') {
    where.push('t.category = ?');
    params.push(req.query.category);
  }
  if (req.query.assigned_to && req.query.assigned_to !== 'all') {
    if (req.query.assigned_to === 'unassigned') {
      where.push('t.assigned_to IS NULL');
    } else {
      where.push('t.assigned_to = ?');
      params.push(req.query.assigned_to);
    }
  }
  if (req.query.search) {
    where.push(`(
      t.ticket_no LIKE ?
      OR t.title LIKE ?
      OR t.description LIKE ?
      OR t.category LIKE ?
      OR t.module LIKE ?
      OR creator.name LIKE ?
      OR assignee.name LIKE ?
    )`);
    const term = `%${req.query.search}%`;
    params.push(term, term, term, term, term, term, term);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function getScopedTicket(req, ticketId) {
  const params = [ticketId];
  let where = 'WHERE t.id = ?';
  if (!isSuperAdmin(req.employee)) {
    where += ' AND t.company_id = ?';
    params.push(req.employee.company_id);
  }

  const rows = await query(
    `SELECT t.*, c.company_name, creator.name AS created_by_name, assignee.name AS assigned_to_name
     FROM support_tickets t
     LEFT JOIN companies c ON c.id = t.company_id
     LEFT JOIN employees creator ON creator.id = t.created_by
     LEFT JOIN employees assignee ON assignee.id = t.assigned_to
     ${where}
     LIMIT 1`,
    params
  );
  return rows[0] || null;
}

async function run(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    await ensureSupportTicketsSchema();

    const { whereSql, params } = buildListWhere(req);
    const rows = await query(
      `SELECT t.*, c.company_name, creator.name AS created_by_name, assignee.name AS assigned_to_name
       FROM support_tickets t
       LEFT JOIN companies c ON c.id = t.company_id
       LEFT JOIN employees creator ON creator.id = t.created_by
       LEFT JOIN employees assignee ON assignee.id = t.assigned_to
       ${whereSql}
       ORDER BY
         CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         CASE t.status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'resolved' THEN 3 ELSE 4 END,
         t.updated_at DESC,
         t.created_at DESC
       LIMIT 500`,
      params
    );

    const statsRows = await query(
      `SELECT
         COUNT(*) AS total_tickets,
         COALESCE(SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END), 0) AS open_count,
         COALESCE(SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END), 0) AS in_progress_count,
         COALESCE(SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END), 0) AS resolved_count,
         COALESCE(SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END), 0) AS closed_count,
         COALESCE(SUM(CASE WHEN t.priority = 'urgent' THEN 1 ELSE 0 END), 0) AS urgent_count
       FROM support_tickets t
       LEFT JOIN employees creator ON creator.id = t.created_by
       LEFT JOIN employees assignee ON assignee.id = t.assigned_to
       ${whereSql}`,
      params
    );

    return res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        ticket_no: row.ticket_no || buildTicketNo(row.id, row.created_at),
      })),
      statistics: statsRows?.[0] || {
        total_tickets: 0,
        open_count: 0,
        in_progress_count: 0,
        resolved_count: 0,
        closed_count: 0,
        urgent_count: 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  let conn;
  try {
    await ensureSupportTicketsSchema();

    const companyId = getScopedCompanyId(req, req.body);
    const data = normalizeTicketPayload(req.body);
    const validationMessage = validateTicketPayload(data, companyId);
    if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });

    conn = await getConnection();
    await conn.query('START TRANSACTION');

    const result = await run(
      conn,
      `INSERT INTO support_tickets
        (title, description, priority, status, category, module, company_id, created_by, assigned_to, due_date, resolution_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.description,
        data.priority,
        data.status,
        data.category,
        data.module,
        companyId,
        req.employee.id || null,
        data.assigned_to,
        data.due_date,
        data.resolution_note,
      ]
    );

    const ticketNo = buildTicketNo(result.insertId);
    await run(conn, 'UPDATE support_tickets SET ticket_no = ? WHERE id = ?', [ticketNo, result.insertId]);
    await run(
      conn,
      `INSERT INTO support_ticket_comments
        (company_id, ticket_id, comment, status_to, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        companyId,
        result.insertId,
        'Ticket created',
        data.status,
        req.employee.id || null,
      ]
    );

    await conn.query('COMMIT');
    return res.json({
      success: true,
      message: 'Support ticket created',
      data: { id: result.insertId, ticket_no: ticketNo },
    });
  } catch (err) {
    if (conn) await conn.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/:id', async (req, res) => {
  try {
    await ensureSupportTicketsSchema();

    const ticketId = Number(req.params.id);
    if (!ticketId) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });

    const ticket = await getScopedTicket(req, ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const comments = await query(
      `SELECT c.*, e.name AS created_by_name
       FROM support_ticket_comments c
       LEFT JOIN employees e ON e.id = c.created_by
       WHERE c.ticket_id = ?
         AND c.company_id = ?
       ORDER BY c.created_at DESC, c.id DESC`,
      [ticketId, ticket.company_id]
    );

    return res.json({
      success: true,
      data: {
        ticket: {
          ...ticket,
          ticket_no: ticket.ticket_no || buildTicketNo(ticket.id, ticket.created_at),
        },
        comments,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  let conn;
  try {
    await ensureSupportTicketsSchema();

    const ticketId = Number(req.params.id);
    if (!ticketId) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });

    const existing = await getScopedTicket(req, ticketId);
    if (!existing) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const data = normalizeTicketPayload(req.body);
    const companyId = getScopedCompanyId(req, req.body) || existing.company_id;
    const validationMessage = validateTicketPayload(data, companyId);
    if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });

    conn = await getConnection();
    await conn.query('START TRANSACTION');

    await run(
      conn,
      `UPDATE support_tickets
       SET title = ?, description = ?, priority = ?, status = ?, category = ?, module = ?,
           company_id = ?, assigned_to = ?, due_date = ?, resolution_note = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        data.title,
        data.description,
        data.priority,
        data.status,
        data.category,
        data.module,
        companyId,
        data.assigned_to,
        data.due_date,
        data.resolution_note,
        ticketId,
      ]
    );

    if (existing.status !== data.status) {
      await run(
        conn,
        `INSERT INTO support_ticket_comments
          (company_id, ticket_id, comment, status_from, status_to, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          ticketId,
          `Status changed from ${existing.status} to ${data.status}`,
          existing.status,
          data.status,
          req.employee.id || null,
        ]
      );
    }

    await conn.query('COMMIT');
    return res.json({ success: true, message: 'Support ticket updated' });
  } catch (err) {
    if (conn) await conn.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

router.patch('/:id/status', async (req, res) => {
  let conn;
  try {
    await ensureSupportTicketsSchema();

    const ticketId = Number(req.params.id);
    const status = String(req.body?.status || '').toLowerCase();
    if (!ticketId) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    if (!STATUSES.has(status)) return res.status(400).json({ success: false, message: 'Invalid ticket status' });

    const existing = await getScopedTicket(req, ticketId);
    if (!existing) return res.status(404).json({ success: false, message: 'Ticket not found' });

    conn = await getConnection();
    await conn.query('START TRANSACTION');

    await run(conn, 'UPDATE support_tickets SET status = ?, updated_at = NOW() WHERE id = ?', [status, ticketId]);
    if (existing.status !== status) {
      await run(
        conn,
        `INSERT INTO support_ticket_comments
          (company_id, ticket_id, comment, status_from, status_to, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          existing.company_id,
          ticketId,
          req.body?.comment ? String(req.body.comment).trim() : `Status changed from ${existing.status} to ${status}`,
          existing.status,
          status,
          req.employee.id || null,
        ]
      );
    }

    await conn.query('COMMIT');
    return res.json({ success: true, message: 'Ticket status updated' });
  } catch (err) {
    if (conn) await conn.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/:id/comments', async (req, res) => {
  let conn;
  try {
    await ensureSupportTicketsSchema();

    const ticketId = Number(req.params.id);
    if (!ticketId) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });

    const ticket = await getScopedTicket(req, ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const comment = String(req.body?.comment || '').trim();
    const statusTo = STATUSES.has(String(req.body?.status || '').toLowerCase())
      ? String(req.body.status).toLowerCase()
      : null;
    if (!comment && !statusTo) return res.status(400).json({ success: false, message: 'Comment or status is required' });

    conn = await getConnection();
    await conn.query('START TRANSACTION');

    if (statusTo && statusTo !== ticket.status) {
      await run(conn, 'UPDATE support_tickets SET status = ?, updated_at = NOW() WHERE id = ?', [statusTo, ticketId]);
    }

    await run(
      conn,
      `INSERT INTO support_ticket_comments
        (company_id, ticket_id, comment, status_from, status_to, is_internal, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ticket.company_id,
        ticketId,
        comment || `Status changed from ${ticket.status} to ${statusTo}`,
        statusTo && statusTo !== ticket.status ? ticket.status : null,
        statusTo && statusTo !== ticket.status ? statusTo : null,
        req.body?.is_internal === true || req.body?.is_internal === 1 || req.body?.is_internal === '1' ? 1 : 0,
        req.employee.id || null,
      ]
    );

    await conn.query('COMMIT');
    return res.json({ success: true, message: 'Ticket comment saved' });
  } catch (err) {
    if (conn) await conn.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

router.delete('/comments/:commentId', async (req, res) => {
  try {
    await ensureSupportTicketsSchema();

    const commentId = Number(req.params.commentId);
    if (!commentId) return res.status(400).json({ success: false, message: 'Invalid comment ID' });

    const params = [commentId];
    let scope = '';
    if (!isSuperAdmin(req.employee)) {
      scope = ' AND company_id = ?';
      params.push(req.employee.company_id);
    }

    await query(`DELETE FROM support_ticket_comments WHERE id = ? ${scope}`, params);
    return res.json({ success: true, message: 'Ticket comment deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  let conn;
  try {
    await ensureSupportTicketsSchema();

    const ticketId = Number(req.params.id);
    if (!ticketId) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });

    const ticket = await getScopedTicket(req, ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    conn = await getConnection();
    await conn.query('START TRANSACTION');
    await run(conn, 'DELETE FROM support_ticket_comments WHERE ticket_id = ?', [ticketId]);
    await run(conn, 'DELETE FROM support_tickets WHERE id = ?', [ticketId]);
    await conn.query('COMMIT');

    return res.json({ success: true, message: 'Support ticket deleted' });
  } catch (err) {
    if (conn) await conn.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
