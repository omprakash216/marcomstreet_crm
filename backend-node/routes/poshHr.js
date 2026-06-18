const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const {
  loadComplaintForAccess,
  requireCompanyModuleAccess,
  requireHrAdmin,
  requirePoshManager,
} = require('../middleware/poshAccess');
const {
  canAccessComplaint,
  canRevealIdentity,
  createNotification,
  ensurePoshSchema,
  ensureUploadDir,
  getComplaintById,
  getIccMember,
  isHrAdmin,
  logPoshAudit,
  maskComplaintIdentity,
  safeJsonParse,
} = require('../services/poshService');

const router = express.Router();
const allowedExt = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']);
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => cb(null, ensureUploadDir(req.employee?.company_id)),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExt.has(ext)) return cb(new Error('Only PDF, JPG, PNG, DOC, DOCX files allowed.'));
    cb(null, true);
  },
});

router.use(verifyToken, requireCompanyModuleAccess('posh'), requirePoshManager());

function companyId(req) {
  return req.employee.company_id;
}

async function listScopeClause(req, params) {
  const icc = req.poshIccMember || (await getIccMember(req.employee.id, companyId(req)));
  if (!isHrAdmin(req.employee) && icc) {
    params.push(req.employee.id);
    return ` AND pc.id IN (
      SELECT complaint_id FROM posh_assignments WHERE assigned_to = ? AND status = 'active'
    )`;
  }
  return '';
}

router.get('/dashboard', async (req, res) => {
  try {
    await ensurePoshSchema();
    const params = [companyId(req)];
    const scope = await listScopeClause(req, params);
    const stats = await query(
      `SELECT
         COUNT(*) AS total_complaints,
         SUM(CASE WHEN pc.status IN ('Submitted','Under Review') THEN 1 ELSE 0 END) AS pending_complaints,
         SUM(CASE WHEN pc.status = 'Investigation' THEN 1 ELSE 0 END) AS under_investigation,
         SUM(CASE WHEN pc.status IN ('Resolved','Closed') THEN 1 ELSE 0 END) AS resolved_complaints,
         SUM(CASE WHEN pc.severity_level = 'Critical' AND pc.status NOT IN ('Resolved','Closed','Rejected') THEN 1 ELSE 0 END) AS critical_complaints,
         SUM(CASE WHEN MONTH(pc.created_at) = MONTH(CURRENT_DATE()) AND YEAR(pc.created_at) = YEAR(CURRENT_DATE()) THEN 1 ELSE 0 END) AS this_month_complaints
       FROM posh_complaints pc
       WHERE pc.company_id = ? AND pc.deleted_at IS NULL ${scope}`,
      params
    );
    const byStatus = await query(
      `SELECT pc.status, COUNT(*) AS count
       FROM posh_complaints pc WHERE pc.company_id = ? AND pc.deleted_at IS NULL ${scope}
       GROUP BY pc.status`,
      params
    );
    const byDepartment = await query(
      `SELECT COALESCE(NULLIF(pc.accused_department,''), 'Unspecified') AS department, COUNT(*) AS count
       FROM posh_complaints pc WHERE pc.company_id = ? AND pc.deleted_at IS NULL ${scope}
       GROUP BY COALESCE(NULLIF(pc.accused_department,''), 'Unspecified')`,
      params
    );
    const recent = await query(
      `SELECT pc.id, pc.complaint_id, pc.complaint_title, pc.status, pc.severity_level, pc.created_at
       FROM posh_complaints pc WHERE pc.company_id = ? AND pc.deleted_at IS NULL ${scope}
       ORDER BY pc.created_at DESC LIMIT 8`,
      params
    );
    res.json({ success: true, data: { stats: stats[0] || {}, byStatus, byDepartment, recent } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/complaints', async (req, res) => {
  try {
    await ensurePoshSchema();
    const params = [companyId(req)];
    let sql = `SELECT pc.*, e.name AS employee_name, e.email AS employee_email, e.phone AS employee_phone
       FROM posh_complaints pc
       LEFT JOIN employees e ON e.id = pc.employee_id
       WHERE pc.company_id = ? AND pc.deleted_at IS NULL`;
    if (req.query.status) {
      sql += ' AND pc.status = ?';
      params.push(req.query.status);
    }
    if (req.query.severity) {
      sql += ' AND pc.severity_level = ?';
      params.push(req.query.severity);
    }
    if (req.query.department) {
      sql += ' AND pc.accused_department = ?';
      params.push(req.query.department);
    }
    if (req.query.from) {
      sql += ' AND DATE(pc.created_at) >= ?';
      params.push(req.query.from);
    }
    if (req.query.to) {
      sql += ' AND DATE(pc.created_at) <= ?';
      params.push(req.query.to);
    }
    sql += await listScopeClause(req, params);
    sql += ' ORDER BY pc.created_at DESC';
    const rows = await query(sql, params);
    const data = [];
    for (const row of rows || []) data.push(await maskComplaintIdentity(row, req.employee));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/complaints/:id', loadComplaintForAccess(), async (req, res) => {
  try {
    await logPoshAudit(req, 'complaint_viewed', req.poshComplaint.id);
    const [evidence, assignments, investigations, hearings, messages, resolution, audit] = await Promise.all([
      query(
        `SELECT ef.*, e.name AS uploaded_by_name FROM posh_evidence_files ef
         LEFT JOIN employees e ON e.id = ef.uploaded_by
         WHERE ef.complaint_id = ? AND ef.deleted_at IS NULL ORDER BY ef.uploaded_at DESC`,
        [req.poshComplaint.id]
      ),
      query(
        `SELECT pa.*, e.name AS assigned_to_name FROM posh_assignments pa
         LEFT JOIN employees e ON e.id = pa.assigned_to
         WHERE pa.complaint_id = ? ORDER BY pa.assigned_at DESC`,
        [req.poshComplaint.id]
      ),
      query('SELECT * FROM posh_investigations WHERE complaint_id = ? ORDER BY created_at DESC', [
        req.poshComplaint.id,
      ]),
      query('SELECT * FROM posh_hearings WHERE complaint_id = ? ORDER BY hearing_date DESC, hearing_time DESC', [
        req.poshComplaint.id,
      ]),
      query(
        `SELECT pm.*, e.name AS sender_name
         FROM posh_messages pm LEFT JOIN employees e ON e.id = pm.sender_id
         WHERE pm.complaint_id = ? ORDER BY pm.created_at ASC`,
        [req.poshComplaint.id]
      ),
      query('SELECT * FROM posh_resolutions WHERE complaint_id = ? LIMIT 1', [req.poshComplaint.id]),
      query('SELECT * FROM posh_audit_logs WHERE record_id = ? ORDER BY created_at DESC LIMIT 100', [
        String(req.poshComplaint.id),
      ]),
    ]);
    res.json({
      success: true,
      data: {
        complaint: await maskComplaintIdentity(req.poshComplaint, req.employee),
        canRevealIdentity: await canRevealIdentity(req.employee, req.poshComplaint),
        evidence,
        assignments,
        investigations,
        hearings,
        messages,
        resolution: resolution[0] || null,
        audit,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/complaints/:id/status', loadComplaintForAccess(), requireHrAdmin(), async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    if (!status) return res.status(400).json({ success: false, message: 'Status required.' });
    await query('UPDATE posh_complaints SET status = ?, updated_at = NOW() WHERE id = ?', [
      status,
      req.poshComplaint.id,
    ]);
    await logPoshAudit(req, 'status_changed', req.poshComplaint.id, {
      old_status: req.poshComplaint.status,
      new_status: status,
    });
    await createNotification({
      recipient: `employee:${req.poshComplaint.employee_id}`,
      templateCode: 'posh_status_changed',
      payload: { complaint_id: req.poshComplaint.complaint_id, status },
    });
    res.json({ success: true, message: 'Complaint status updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/complaints/:id/assign', loadComplaintForAccess(), requireHrAdmin(), async (req, res) => {
  try {
    const assignedTo = Number(req.body?.assigned_to || 0);
    if (!assignedTo) return res.status(400).json({ success: false, message: 'assigned_to required.' });
    const memberRows = await query(
      'SELECT * FROM posh_icc_members WHERE company_id = ? AND employee_id = ? AND status = ? LIMIT 1',
      [companyId(req), assignedTo, 'active']
    );
    const member = memberRows[0];
    if (!member) return res.status(400).json({ success: false, message: 'Active ICC member not found.' });
    await query(
      `INSERT INTO posh_assignments (complaint_id, company_id, assigned_to, assigned_role, assigned_by, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [req.poshComplaint.id, companyId(req), assignedTo, member.role, req.employee.id]
    );
    await query('UPDATE posh_complaints SET status = ? WHERE id = ? AND status IN (?, ?)', [
      'Investigation',
      req.poshComplaint.id,
      'Submitted',
      'Under Review',
    ]);
    await logPoshAudit(req, 'assigned_to_icc', req.poshComplaint.id, { assigned_to: assignedTo });
    await createNotification({
      recipient: `employee:${assignedTo}`,
      templateCode: 'posh_complaint_assigned',
      payload: { complaint_id: req.poshComplaint.complaint_id },
    });
    res.json({ success: true, message: 'Complaint assigned to ICC member.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/complaints/:id/investigations', loadComplaintForAccess(), async (req, res) => {
  try {
    if (!(await canAccessComplaint(req.employee, req.poshComplaint))) {
      return res.status(403).json({ success: false, message: 'No investigation access.' });
    }
    const b = req.body || {};
    await query(
      `INSERT INTO posh_investigations
       (complaint_id, company_id, investigator_id, notes, internal_comments, accused_response, witness_statement, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.poshComplaint.id,
        companyId(req),
        req.employee.id,
        b.notes || null,
        b.internal_comments || null,
        b.accused_response || null,
        b.witness_statement || null,
        b.status || 'Open',
      ]
    );
    await query('UPDATE posh_complaints SET status = ? WHERE id = ? AND status <> ?', [
      'Investigation',
      req.poshComplaint.id,
      'Closed',
    ]);
    await logPoshAudit(req, 'investigation_note_added', req.poshComplaint.id);
    res.json({ success: true, message: 'Investigation note saved.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/complaints/:id/evidence', loadComplaintForAccess(), (req, res) => {
  upload.array('files', 5)(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ success: false, message: uploadErr.message });
    try {
      const files = req.files || [];
      if (!files.length) return res.status(400).json({ success: false, message: 'Evidence file required.' });
      for (const file of files) {
        await query(
          `INSERT INTO posh_evidence_files
           (complaint_id, company_id, uploaded_by, original_name, stored_name, file_path, mime_type, file_size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.poshComplaint.id,
            req.poshComplaint.company_id,
            req.employee.id,
            file.originalname,
            file.filename,
            path.relative(path.join(__dirname, '..', '..'), file.path).replace(/\\/g, '/'),
            file.mimetype,
            file.size,
          ]
        );
      }
      await logPoshAudit(req, 'evidence_uploaded', req.poshComplaint.id, { files: files.length });
      res.json({ success: true, message: 'Evidence uploaded securely.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});

router.post('/complaints/:id/messages', loadComplaintForAccess(), async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ success: false, message: 'Message required.' });
    await query(
      `INSERT INTO posh_messages (complaint_id, company_id, sender_id, sender_role, message, internal_only)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.poshComplaint.id,
        req.poshComplaint.company_id,
        req.employee.id,
        req.employee.role || 'hr',
        message,
        req.body?.internal_only ? 1 : 0,
      ]
    );
    await logPoshAudit(req, 'message_sent', req.poshComplaint.id);
    await createNotification({
      recipient: `employee:${req.poshComplaint.employee_id}`,
      templateCode: 'posh_new_message',
      payload: { complaint_id: req.poshComplaint.complaint_id },
    });
    res.json({ success: true, message: 'Secure message sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/hearings', requireHrAdmin(), async (req, res) => {
  try {
    const b = req.body || {};
    const complaint = await getComplaintById(b.complaint_id);
    if (!complaint || Number(complaint.company_id) !== Number(companyId(req))) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }
    await query(
      `INSERT INTO posh_hearings
       (complaint_id, company_id, hearing_date, hearing_time, meeting_mode, meeting_location, meeting_link,
        attendees, hearing_notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        complaint.id,
        companyId(req),
        b.hearing_date,
        b.hearing_time || null,
        b.meeting_mode || 'Offline',
        b.meeting_location || null,
        b.meeting_link || null,
        JSON.stringify(b.attendees || []),
        b.hearing_notes || null,
        b.status || 'Scheduled',
        req.employee.id,
      ]
    );
    await query('UPDATE posh_complaints SET status = ? WHERE id = ?', ['Hearing Scheduled', complaint.id]);
    await logPoshAudit(req, 'hearing_scheduled', complaint.id, { hearing_date: b.hearing_date });
    await createNotification({
      recipient: `employee:${complaint.employee_id}`,
      templateCode: 'posh_hearing_scheduled',
      payload: { complaint_id: complaint.complaint_id, hearing_date: b.hearing_date },
    });
    res.json({ success: true, message: 'Hearing scheduled.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/resolution', requireHrAdmin(), async (req, res) => {
  try {
    const b = req.body || {};
    const complaint = await getComplaintById(b.complaint_id);
    if (!complaint || Number(complaint.company_id) !== Number(companyId(req))) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }
    if (!b.final_decision || !b.action_taken) {
      return res.status(400).json({ success: false, message: 'Final decision and action taken required.' });
    }
    await query(
      `INSERT INTO posh_resolutions
       (complaint_id, company_id, final_decision, action_taken, resolution_summary, closure_date, closed_by, employee_feedback)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE final_decision = VALUES(final_decision), action_taken = VALUES(action_taken),
         resolution_summary = VALUES(resolution_summary), closure_date = VALUES(closure_date),
         closed_by = VALUES(closed_by), employee_feedback = VALUES(employee_feedback)`,
      [
        complaint.id,
        companyId(req),
        b.final_decision,
        b.action_taken,
        b.resolution_summary || null,
        b.closure_date || new Date(),
        req.employee.id,
        b.employee_feedback || null,
      ]
    );
    await query('UPDATE posh_complaints SET status = ?, updated_at = NOW() WHERE id = ?', [
      b.status || 'Closed',
      complaint.id,
    ]);
    await logPoshAudit(req, 'case_closed', complaint.id, { action_taken: b.action_taken });
    await createNotification({
      recipient: `employee:${complaint.employee_id}`,
      templateCode: 'posh_case_closed',
      payload: { complaint_id: complaint.complaint_id },
    });
    res.json({ success: true, message: 'Resolution saved and case closed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/icc-members', requireHrAdmin(), async (req, res) => {
  try {
    await ensurePoshSchema();
    const rows = await query(
      `SELECT im.*, e.name AS employee_name
       FROM posh_icc_members im
       LEFT JOIN employees e ON e.id = im.employee_id
       WHERE im.company_id = ?
       ORDER BY im.status ASC, im.role ASC, im.member_name ASC`,
      [companyId(req)]
    );
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/icc-members', requireHrAdmin(), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.member_name || !b.role) {
      return res.status(400).json({ success: false, message: 'Member name and role required.' });
    }
    const result = await query(
      `INSERT INTO posh_icc_members
       (company_id, member_name, employee_id, role, email, phone, status, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId(req),
        b.member_name,
        b.employee_id || null,
        b.role,
        b.email || null,
        b.phone || null,
        b.status || 'active',
        b.start_date || null,
        b.end_date || null,
      ]
    );
    await logPoshAudit(req, 'icc_member_created', result.insertId);
    res.json({ success: true, message: 'ICC member saved.', data: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/icc-members/:id', requireHrAdmin(), async (req, res) => {
  try {
    const b = req.body || {};
    await query(
      `UPDATE posh_icc_members
       SET member_name = ?, employee_id = ?, role = ?, email = ?, phone = ?, status = ?, start_date = ?, end_date = ?
       WHERE id = ? AND company_id = ?`,
      [
        b.member_name,
        b.employee_id || null,
        b.role,
        b.email || null,
        b.phone || null,
        b.status || 'active',
        b.start_date || null,
        b.end_date || null,
        req.params.id,
        companyId(req),
      ]
    );
    await logPoshAudit(req, 'icc_member_updated', req.params.id);
    res.json({ success: true, message: 'ICC member updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/icc-members/:id', requireHrAdmin(), async (req, res) => {
  try {
    await query('UPDATE posh_icc_members SET status = ? WHERE id = ? AND company_id = ?', [
      'inactive',
      req.params.id,
      companyId(req),
    ]);
    await logPoshAudit(req, 'icc_member_removed', req.params.id);
    res.json({ success: true, message: 'ICC member removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/evidence/:id/download', async (req, res) => {
  try {
    await ensurePoshSchema();
    const rows = await query('SELECT * FROM posh_evidence_files WHERE id = ? AND deleted_at IS NULL LIMIT 1', [
      req.params.id,
    ]);
    const file = rows[0];
    if (!file) return res.status(404).json({ success: false, message: 'Evidence not found.' });
    const complaint = await getComplaintById(file.complaint_id);
    if (!complaint || !(await canAccessComplaint(req.employee, complaint))) {
      return res.status(403).json({ success: false, message: 'You cannot download this evidence.' });
    }
    await logPoshAudit(req, 'evidence_downloaded', complaint.id, { evidence_id: file.id });
    const fullPath = path.join(__dirname, '..', '..', file.file_path);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, message: 'File missing.' });
    res.download(fullPath, file.original_name);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/reports', requireHrAdmin(), async (req, res) => {
  try {
    await ensurePoshSchema();
    const rows = await query(
      `SELECT status, severity_level, complaint_type, accused_department, COUNT(*) AS count
       FROM posh_complaints
       WHERE company_id = ? AND deleted_at IS NULL
       GROUP BY status, severity_level, complaint_type, accused_department`,
      [companyId(req)]
    );
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/settings', requireHrAdmin(), async (req, res) => {
  try {
    await ensurePoshSchema();
    const rows = await query('SELECT setting_key, setting_value FROM posh_settings WHERE company_id = ?', [
      companyId(req),
    ]);
    const settings = {};
    for (const row of rows || []) settings[row.setting_key] = safeJsonParse(row.setting_value, row.setting_value);
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/settings', requireHrAdmin(), async (req, res) => {
  try {
    await ensurePoshSchema();
    for (const [key, value] of Object.entries(req.body || {})) {
      await query(
        `INSERT INTO posh_settings (company_id, setting_key, setting_value, updated_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [companyId(req), key, typeof value === 'string' ? value : JSON.stringify(value), req.employee.id]
      );
    }
    await logPoshAudit(req, 'settings_changed', 'settings');
    res.json({ success: true, message: 'POSH settings saved.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
