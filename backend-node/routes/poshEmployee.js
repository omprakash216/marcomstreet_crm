const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const {
  loadComplaintForAccess,
  requireCompanyModuleAccess,
  requireEmployeePortalUser,
} = require('../middleware/poshAccess');
const {
  createNotification,
  ensurePoshSchema,
  ensureUploadDir,
  logPoshAudit,
  makeComplaintId,
  maskComplaintIdentity,
} = require('../services/poshService');

const router = express.Router();
const allowedExt = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => cb(null, ensureUploadDir(req.employee?.company_id)),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExt.has(ext)) return cb(new Error('Only PDF, JPG, PNG, DOC, DOCX files allowed.'));
    cb(null, true);
  },
});

router.use(verifyToken, requireCompanyModuleAccess('posh'), requireEmployeePortalUser());

router.get('/dashboard', async (req, res) => {
  try {
    await ensurePoshSchema();
    const companyId = req.employee.company_id;
    const employeeId = req.employee.id;
    const counts = await query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status IN ('Submitted','Under Review','Investigation','Hearing Scheduled') THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status IN ('Resolved','Closed') THEN 1 ELSE 0 END) AS closed
       FROM posh_complaints
       WHERE company_id = ? AND employee_id = ? AND deleted_at IS NULL`,
      [companyId, employeeId]
    );
    const latest = await query(
      `SELECT id, complaint_id, complaint_title, status, severity_level, updated_at
       FROM posh_complaints
       WHERE company_id = ? AND employee_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC LIMIT 5`,
      [companyId, employeeId]
    );
    const hearings = await query(
      `SELECT h.*, c.complaint_id, c.complaint_title
       FROM posh_hearings h
       JOIN posh_complaints c ON c.id = h.complaint_id
       WHERE h.company_id = ? AND c.employee_id = ? AND h.hearing_date >= CURDATE()
       ORDER BY h.hearing_date ASC, h.hearing_time ASC LIMIT 3`,
      [companyId, employeeId]
    );
    res.json({ success: true, data: { stats: counts[0] || {}, latest, hearings } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/complaints', async (req, res) => {
  try {
    await ensurePoshSchema();
    const b = req.body || {};
    if (!b.complaint_title || !b.complaint_description) {
      return res.status(400).json({ success: false, message: 'Complaint title and description required.' });
    }
    const complaintId = makeComplaintId(req.employee.company_id);
    const result = await query(
      `INSERT INTO posh_complaints
       (complaint_id, company_id, employee_id, complaint_title, complaint_description,
        accused_employee_id, accused_name, accused_department, incident_date, incident_location,
        complaint_type, severity_level, anonymous_complaint, witness_name, witness_contact, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        complaintId,
        req.employee.company_id,
        req.employee.id,
        String(b.complaint_title).trim(),
        String(b.complaint_description).trim(),
        b.accused_employee_id || null,
        b.accused_name || null,
        b.accused_department || null,
        b.incident_date || null,
        b.incident_location || null,
        b.complaint_type || 'Workplace Harassment',
        b.severity_level || 'Medium',
        b.anonymous_complaint ? 1 : 0,
        b.witness_name || null,
        b.witness_contact || null,
        b.status === 'Draft' ? 'Draft' : 'Submitted',
      ]
    );
    await logPoshAudit(req, 'complaint_created', result.insertId, { complaint_id: complaintId });
    await createNotification({
      recipient: `company:${req.employee.company_id}:hr`,
      templateCode: 'posh_complaint_submitted',
      payload: { complaint_id: complaintId, title: b.complaint_title },
    });
    res.json({
      success: true,
      message: 'POSH complaint submitted successfully.',
      data: { id: result.insertId, complaint_id: complaintId },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/my-complaints', async (req, res) => {
  try {
    await ensurePoshSchema();
    const rows = await query(
      `SELECT id, complaint_id, complaint_title, complaint_type, severity_level, status,
              anonymous_complaint, incident_date, incident_location, created_at, updated_at
       FROM posh_complaints
       WHERE company_id = ? AND employee_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [req.employee.company_id, req.employee.id]
    );
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/complaints/:id', loadComplaintForAccess(), async (req, res) => {
  try {
    await logPoshAudit(req, 'complaint_viewed', req.poshComplaint.id);
    const evidence = await query(
      `SELECT id, original_name, mime_type, file_size, uploaded_at FROM posh_evidence_files
       WHERE complaint_id = ? AND deleted_at IS NULL ORDER BY uploaded_at DESC`,
      [req.poshComplaint.id]
    );
    const hearings = await query(
      'SELECT * FROM posh_hearings WHERE complaint_id = ? ORDER BY hearing_date DESC, hearing_time DESC',
      [req.poshComplaint.id]
    );
    const messages = await query(
      `SELECT pm.*, e.name AS sender_name
       FROM posh_messages pm
       LEFT JOIN employees e ON e.id = pm.sender_id
       WHERE pm.complaint_id = ? AND pm.internal_only = 0
       ORDER BY pm.created_at ASC`,
      [req.poshComplaint.id]
    );
    const resolution = await query('SELECT * FROM posh_resolutions WHERE complaint_id = ? LIMIT 1', [
      req.poshComplaint.id,
    ]);
    res.json({
      success: true,
      data: {
        complaint: await maskComplaintIdentity(req.poshComplaint, req.employee),
        evidence,
        hearings,
        messages,
        resolution: resolution[0] || null,
      },
    });
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

router.get('/evidence/:id/download', async (req, res) => {
  try {
    await ensurePoshSchema();
    const rows = await query('SELECT * FROM posh_evidence_files WHERE id = ? AND deleted_at IS NULL LIMIT 1', [
      req.params.id,
    ]);
    const file = rows[0];
    if (!file) return res.status(404).json({ success: false, message: 'Evidence not found.' });
    const complaintRows = await query('SELECT * FROM posh_complaints WHERE id = ? LIMIT 1', [file.complaint_id]);
    req.poshComplaint = complaintRows[0];
    if (!req.poshComplaint || Number(req.poshComplaint.employee_id) !== Number(req.employee.id)) {
      return res.status(403).json({ success: false, message: 'You cannot download this evidence.' });
    }
    await logPoshAudit(req, 'evidence_downloaded', file.complaint_id, { evidence_id: file.id });
    const fullPath = path.join(__dirname, '..', '..', file.file_path);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, message: 'File missing.' });
    res.download(fullPath, file.original_name);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/complaints/:id/messages', loadComplaintForAccess(), async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ success: false, message: 'Message required.' });
    await query(
      `INSERT INTO posh_messages (complaint_id, company_id, sender_id, sender_role, message, internal_only)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [req.poshComplaint.id, req.poshComplaint.company_id, req.employee.id, req.employee.role || 'employee', message]
    );
    await logPoshAudit(req, 'message_sent', req.poshComplaint.id);
    await createNotification({
      recipient: `complaint:${req.poshComplaint.id}:assigned`,
      templateCode: 'posh_new_message',
      payload: { complaint_id: req.poshComplaint.complaint_id },
    });
    res.json({ success: true, message: 'Secure message sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
