const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

async function ensureSupportTicketsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(180) NOT NULL,
      description TEXT NULL,
      priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
      status ENUM('open','in_progress','resolved','closed') DEFAULT 'open',
      category VARCHAR(80) DEFAULT 'general',
      company_id INT NULL,
      created_by INT NULL,
      assigned_to INT NULL,
      resolution_note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_support_status (status),
      KEY idx_support_company (company_id),
      KEY idx_support_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

router.get('/', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await ensureSupportTicketsTable();
    const { status = '', company_id = '' } = req.query || {};
    const where = [];
    const params = [];
    if (status) {
      where.push('t.status = ?');
      params.push(status);
    }
    if (company_id) {
      where.push('t.company_id = ?');
      params.push(Number(company_id));
    }

    const rows = await query(
      `
        SELECT t.*, c.company_name, creator.name AS created_by_name, assignee.name AS assigned_to_name
        FROM support_tickets t
        LEFT JOIN companies c ON c.id = t.company_id
        LEFT JOIN employees creator ON creator.id = t.created_by
        LEFT JOIN employees assignee ON assignee.id = t.assigned_to
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY t.updated_at DESC, t.created_at DESC
        LIMIT 500
      `,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await ensureSupportTicketsTable();
    const {
      title,
      description = '',
      priority = 'medium',
      status = 'open',
      category = 'general',
      company_id = null,
      assigned_to = null,
    } = req.body || {};

    if (!String(title || '').trim()) {
      return res.status(400).json({ success: false, message: 'Ticket title is required' });
    }

    const result = await query(
      `INSERT INTO support_tickets
        (title, description, priority, status, category, company_id, created_by, assigned_to)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        String(title).trim(),
        description || null,
        priority,
        status,
        category || 'general',
        company_id || null,
        req.employee?.id || null,
        assigned_to || null,
      ]
    );

    res.json({ success: true, message: 'Ticket created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await ensureSupportTicketsTable();
    const allowed = ['title', 'description', 'priority', 'status', 'category', 'company_id', 'assigned_to', 'resolution_note'];
    const updates = [];
    const params = [];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        updates.push(`${key} = ?`);
        params.push(req.body[key] === '' ? null : req.body[key]);
      }
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    params.push(req.params.id);
    await query(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Ticket updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await ensureSupportTicketsTable();
    await query('DELETE FROM support_tickets WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
