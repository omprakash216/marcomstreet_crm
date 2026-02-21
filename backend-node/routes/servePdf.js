/**
 * PDF Serving Route - Fix for PDF open/download and MIME type issues
 * Serves PDF files with correct Content-Type: application/pdf
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const ALLOWED_DIRS = ['hr_documents', 'salary_slips'];

router.get('/', (req, res) => {
  const fileParam = req.query.file;
  if (!fileParam) {
    res.set('Content-Type', 'application/pdf');
    return res.status(400).end();
  }

  const decodedPath = decodeURIComponent(fileParam).replace(/\\/g, '/');
  const normalized = decodedPath.trim();

  // Security: only allow uploads/hr_documents/ or uploads/salary_slips/
  const allowed =
    normalized.startsWith('uploads/hr_documents/') ||
    normalized.startsWith('uploads/salary_slips/');
  if (!allowed) {
    res.set('Content-Type', 'application/pdf');
    return res.status(403).end();
  }

  const fullPath = path.join(__dirname, '../../', normalized);

  fullPath = path.resolve(fullPath);
  const basePath = path.resolve(UPLOADS_ROOT);

  if (!fullPath.startsWith(basePath)) {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    return res.status(403).send('Access denied. Invalid file path.');
  }

  if (!fs.existsSync(fullPath)) {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    return res.status(404).send('PDF file not found.');
  }

  const ext = path.extname(fullPath).toLowerCase();
  if (ext !== '.pdf') {
    res.set('Content-Type', 'application/pdf');
    return res.status(400).end();
  }

  const buf = Buffer.alloc(4);
  const fd = fs.openSync(fullPath, 'r');
  try {
    fs.readSync(fd, buf, 0, 4, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (buf.toString('ascii', 0, 4) !== '%PDF') {
    res.set('Content-Type', 'application/pdf');
    return res.status(400).end();
  }

  const stat = fs.statSync(fullPath);
  if (stat.size < 100) {
    res.set('Content-Type', 'application/pdf');
    return res.status(400).end();
  }

  res.set('Content-Type', 'application/pdf');
  res.set('Content-Length', stat.size);
  res.set('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);
  res.set('Cache-Control', 'private, max-age=3600, must-revalidate');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Accept-Ranges', 'bytes');

  const stream = fs.createReadStream(fullPath);
  stream.pipe(res);
});

module.exports = router;
