const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const UPLOADS_HR = path.join(__dirname, '../../uploads/hr_documents');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_HR)) fs.mkdirSync(UPLOADS_HR, { recursive: true });
    cb(null, UPLOADS_HR);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '_' + (file.originalname || 'document.pdf')),
});
const upload = multer({ storage });

router.get('/', verifyToken, async (req, res) => {
  try {
    const category = req.query.category || null;
    const search = req.query.search || null;
    let sql = 'SELECT d.*, e.name as employee_name FROM hr_documents d JOIN employees e ON d.employee_id = e.id WHERE 1=1';
    const params = [];
    if (category) { sql += ' AND d.type = ?'; params.push(category); }
    if (search) { sql += ' AND (d.title LIKE ? OR e.name LIKE ?)'; const t = '%' + search + '%'; params.push(t, t); }
    sql += ' ORDER BY d.created_at DESC';
    const rows = await query(sql, params).catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

router.post('/', verifyToken, upload.single('file'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!req.file) return res.status(400).json({ success: false, message: 'File is required' });
    const employeeId = b.employee_id || req.employee.id;
    const filePath = 'uploads/hr_documents/' + req.file.filename;
    await query('INSERT INTO hr_documents (employee_id, title, type, file_path) VALUES (?,?,?,?)', [employeeId, b.title || req.file.originalname, b.type || 'other', filePath]);
    return res.json({ success: true, message: 'Document uploaded' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/download', verifyToken, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM hr_documents WHERE id = ?', [req.params.id]);
    const doc = rows[0];
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    const fullPath = path.join(__dirname, '../../', doc.file_path);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, message: 'File not found' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(doc.file_path)}"`);
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await query('DELETE FROM hr_documents WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
