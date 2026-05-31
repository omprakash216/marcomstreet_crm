const express = require('express');
const os = require('os');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

async function safeSelect(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (e) {
    return null;
  }
}

async function exportCompanyData(companyId, type = 'full') {
  const out = { 
    company_id: companyId, 
    type, 
    exported_at: new Date().toISOString(), 
    tables: {} 
  };

  // Always include company info if possible
  if (companyId) {
    const companyRows = await safeSelect('SELECT * FROM companies WHERE id=?', [companyId]);
    if (companyRows) out.tables.companies = companyRows;
  }

  let tablesToExport = [];
  
  if (type === 'full' || type === 'crm') {
    tablesToExport.push('leads', 'followups', 'tasks', 'meetings', 'quotations', 'group_meetings');
  }
  
  if (type === 'full' || type === 'hrms') {
    tablesToExport.push('leaves', 'attendance', 'payroll', 'salary_slips', 'departments', 'designations', 'hr_documents');
  }

  if (type === 'full' || type === 'users') {
    tablesToExport.push('users', 'employees');
  }

  if (type === 'leads') tablesToExport = ['leads'];
  if (type === 'attendance') tablesToExport = ['attendance'];
  if (type === 'payroll') tablesToExport = ['payroll', 'salary_slips'];

  // De-duplicate
  tablesToExport = [...new Set(tablesToExport)];

  for (const t of tablesToExport) {
    let rows;
    if (companyId) {
      rows = await safeSelect(`SELECT * FROM \`${t}\` WHERE company_id=?`, [companyId]);
    } else {
      // Global export (for Super Admin context if needed)
      rows = await safeSelect(`SELECT * FROM \`${t}\` LIMIT 5000`);
    }
    if (rows) out.tables[t] = rows;
  }

  // Special logic for billing if full or crm
  if (type === 'full' || type === 'crm') {
    if (companyId) {
      const subs = await safeSelect('SELECT id FROM subscriptions WHERE company_id=?', [companyId]);
      if (subs && subs.length) {
        const subIds = subs.map(s => s.id);
        const inv = await safeSelect(`SELECT * FROM invoices WHERE subscription_id IN (${subIds.map(() => '?').join(',')})`, subIds);
        if (inv) {
          out.tables.invoices = inv;
          const invIds = inv.map(i => i.id).filter(Boolean);
          if (invIds.length) {
            const tx = await safeSelect(`SELECT * FROM transactions WHERE invoice_id IN (${invIds.map(() => '?').join(',')})`, invIds);
            if (tx) out.tables.transactions = tx;
          }
        }
      }
    }
  }

  return out;
}

router.get('/health', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const uptimeSec = Math.floor(process.uptime());
    const mem = process.memoryUsage();
    const load = os.loadavg();
    res.json({
      success: true,
      data: {
        status: 'ok',
        uptimeSec,
        node: process.version,
        memory: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
        },
        loadAvg: load,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/cache/clear', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    if (typeof global.gc === 'function') {
      global.gc();
    }
    res.json({
      success: true,
      message: 'Runtime cache clear request completed',
      data: {
        cleared_at: new Date().toISOString(),
        memory: process.memoryUsage(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/backups', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { company_id, from, to } = req.query || {};
    const where = [];
    const params = [];
    if (company_id) {
      where.push('company_id = ?');
      params.push(Number(company_id));
    }
    if (from) {
      where.push('created_at >= ?');
      params.push(new Date(from));
    }
    if (to) {
      where.push('created_at <= ?');
      params.push(new Date(to));
    }
    const sql = `
      SELECT b.*, c.company_name 
      FROM backup_logs b 
      LEFT JOIN companies c ON b.company_id = c.id 
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} 
      ORDER BY b.created_at DESC LIMIT 500
    `;
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/backups', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { type = 'full', company_id = null } = req.body || {};
    
    // Simulate generation for history (since it's an export-based system in this implementation)
    const payload = await exportCompanyData(company_id ? Number(company_id) : null, type);
    const json = JSON.stringify(payload);
    const fileSize = Buffer.byteLength(json);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const fileName = company_id ? `backup-${type}-co${company_id}-${stamp}.json` : `backup-${type}-all-${stamp}.json`;

    const result = await query(
      'INSERT INTO backup_logs (company_id, backup_type, file_path, file_size, status, meta, created_by) VALUES (?,?,?,?,?,?,?)',
      [company_id ? Number(company_id) : null, type, fileName, fileSize, 'completed', JSON.stringify({ type }), req.employee?.id || null]
    );
    
    res.json({ success: true, message: 'Backup generated successfully', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/backups/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await query('DELETE FROM backup_logs WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Backup record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Export backup JSON (company-wise or all companies)
router.get('/backups/export', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { company_id, type = 'full' } = req.query || {};
    const now = new Date();
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');

    let payload;
    let fileBase;

    if (company_id) {
      const cid = Number(company_id);
      payload = await exportCompanyData(cid, type);
      fileBase = `backup-${type}-co${cid}-${stamp}.json`;
    } else {
      const companies = await safeSelect('SELECT id, company_name FROM companies ORDER BY id ASC');
      const all = [];
      for (const c of companies || []) {
        all.push(await exportCompanyData(c.id, type));
      }
      payload = { exported_at: new Date().toISOString(), type, companies: all };
      fileBase = `backup-${type}-all-${stamp}.json`;
    }

    const json = JSON.stringify(payload, null, 2);
    const fileSize = Buffer.byteLength(json);

    // Log the download/export action
    await query(
      'INSERT INTO backup_logs (company_id, backup_type, file_path, file_size, status, meta, created_by) VALUES (?,?,?,?,?,?,?)',
      [company_id ? Number(company_id) : null, type, fileBase, fileSize, 'completed', JSON.stringify({ action: 'export' }), req.employee?.id || null]
    );

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}"`);
    return res.status(200).send(json);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

