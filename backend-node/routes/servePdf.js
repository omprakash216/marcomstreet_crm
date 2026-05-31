/**
 * PDF Serving Route - Fix for PDF open/download and MIME type issues
 * Serves PDF files with correct Content-Type: application/pdf
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const router = express.Router();
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
// Allow-list of folders under /uploads that can be served via /serve-pdf.
// Note: `hr_docs` exists in some legacy deployments.
const ALLOWED_DIRS = ['hr_documents', 'hr_docs', 'salary_slips'];

router.get('/', (req, res) => {
  const fileParam = req.query.file;
  if (!fileParam) {
    res.set('Content-Type', 'application/pdf');
    return res.status(400).end();
  }

  const wantsDownload =
    req.query.download === '1' ||
    req.query.download === 'true' ||
    req.query.disposition === 'attachment';

  // Some clients accidentally send pre-encoded paths (e.g. "uploads%2Fsalary_slips%2F...")
  // or double-encode the value. Decode defensively (max 2 times).
  let decodedPath = String(fileParam);
  for (let i = 0; i < 2; i++) {
    if (/%2f|%5c|%25/i.test(decodedPath)) {
      try {
        decodedPath = decodeURIComponent(decodedPath);
      } catch (_) {
        break;
      }
    }
  }

  let normalized = decodedPath.replace(/\\/g, '/').trim();
  if (normalized.startsWith('/')) normalized = normalized.slice(1);

  // Allow callers to omit the "uploads/" prefix (older UI/DB values)
  if (normalized.startsWith('salary_slips/')) normalized = 'uploads/' + normalized;
  if (normalized.startsWith('hr_documents/')) normalized = 'uploads/' + normalized;
  if (normalized.startsWith('hr_docs/')) normalized = 'uploads/' + normalized;

  // Some legacy DB rows store an absolute path (e.g. "D:/.../uploads/hr_documents/file.pdf").
  // Extract the safe relative segment if present.
  const lower = normalized.toLowerCase();
  const idxHr = lower.indexOf('uploads/hr_documents/');
  const idxHrDocs = lower.indexOf('uploads/hr_docs/');
  const idxSalary = lower.indexOf('uploads/salary_slips/');
  if (idxHr >= 0) normalized = normalized.slice(idxHr);
  if (idxHrDocs >= 0) normalized = normalized.slice(idxHrDocs);
  if (idxSalary >= 0) normalized = normalized.slice(idxSalary);

  // Also allow callers to pass "hr_documents/<file>.pdf" (no uploads prefix).
  // (We still keep the allow-list strict: only these two folders.)
  const lower2 = normalized.toLowerCase();
  const idxHr2 = lower2.indexOf('hr_documents/');
  const idxHrDocs2 = lower2.indexOf('hr_docs/');
  const idxSalary2 = lower2.indexOf('salary_slips/');
  if (idxHr2 >= 0) normalized = 'uploads/' + normalized.slice(idxHr2);
  if (idxHrDocs2 >= 0) normalized = 'uploads/' + normalized.slice(idxHrDocs2);
  if (idxSalary2 >= 0) normalized = 'uploads/' + normalized.slice(idxSalary2);

  // Normalize casing for folder names.
  normalized = normalized.replace(/^uploads\/hr_documents\//i, 'uploads/hr_documents/');
  normalized = normalized.replace(/^uploads\/hr_docs\//i, 'uploads/hr_docs/');
  normalized = normalized.replace(/^uploads\/salary_slips\//i, 'uploads/salary_slips/');

  // Security: only allow uploads/hr_documents/ or uploads/salary_slips/
  const allowed =
    normalized.startsWith('uploads/hr_documents/') ||
    normalized.startsWith('uploads/hr_docs/') ||
    normalized.startsWith('uploads/salary_slips/');
  if (!allowed) {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[serve-pdf] blocked path:', { fileParam, decodedPath, normalized });
    }
    return res.status(403).send('Access denied. Invalid file path.');
  }

  const joinedPath = path.join(__dirname, '../../', normalized);
  let fullPath = path.resolve(joinedPath);
  const basePath = path.resolve(UPLOADS_ROOT);

  if (!fullPath.startsWith(basePath)) {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    return res.status(403).send('Access denied. Invalid file path.');
  }

  // If DB points to a missing file (common after cleanup), try to resolve to the latest matching PDF
  // in the same folder. Example:
  // uploads/hr_documents/Experience_Letter_NAME_1769516657.pdf -> uploads/hr_documents/Experience_Letter_NAME_<latest>.pdf
  const tryResolveLatestSibling = () => {
    try {
      const relDir = path.dirname(normalized).replace(/\\/g, '/');
      const base = path.basename(normalized);
      const absDir = path.resolve(path.join(__dirname, '../../', relDir));
      if (!absDir.startsWith(basePath) || !fs.existsSync(absDir)) return null;

      // Candidate prefixes to search for "latest matching file"
      const prefixes = [];

      // 1) Files with timestamp suffix: <prefix>_<ts>.pdf
      const mTs = base.match(/^(.*)_\d{10,13}\.pdf$/i);
      if (mTs) prefixes.push(mTs[1] + '_');

      // 2) Salary slips sometimes stored in DB without timestamp: EMP003_2026-01.pdf
      // Actual generated format: EMP003_202601_<ts>.pdf
      const mSalaryDash = base.match(/^([A-Za-z0-9]+)_(\d{4})-(\d{2})\.pdf$/i);
      if (mSalaryDash) {
        const code = mSalaryDash[1];
        const y = mSalaryDash[2];
        const mm = mSalaryDash[3];
        prefixes.push(`${code}_${y}${mm}_`);
        prefixes.push(`${code}_${y}-${mm}_`);
      }

      // 3) Salary slips without dash: EMP003_202601.pdf -> EMP003_202601_<ts>.pdf
      const mSalaryPlain = base.match(/^([A-Za-z0-9]+)_(\d{6})\.pdf$/i);
      if (mSalaryPlain) {
        prefixes.push(`${mSalaryPlain[1]}_${mSalaryPlain[2]}_`);
      }

      // 4) Generic: "<name>.pdf" -> "<name>_" prefix
      if (prefixes.length === 0 && base.toLowerCase().endsWith('.pdf')) {
        prefixes.push(base.slice(0, -4) + '_');
      }

      if (prefixes.length === 0) return null;

      const candidates = fs
        .readdirSync(absDir)
        .filter((f) => {
          if (!f.toLowerCase().endsWith('.pdf')) return false;
          return prefixes.some((p) => f.startsWith(p));
        })
        .map((f) => {
          const p = path.join(absDir, f);
          let st;
          try {
            st = fs.statSync(p);
          } catch (_) {
            return null;
          }
          return { p, mtimeMs: st.mtimeMs || 0 };
        })
        .filter(Boolean)
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

      return candidates[0]?.p || null;
    } catch (_) {
      return null;
    }
  };

  if (!fs.existsSync(fullPath)) {
    const sibling = tryResolveLatestSibling();
    if (sibling) {
      fullPath = sibling;
    }
  }

  if (!fs.existsSync(fullPath)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[serve-pdf] not found:', { fileParam, normalized, fullPath });
    }
    // Return a friendly "Document not found" PDF instead of raw 404 for better UX
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.status(200);
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Length', pdfBuffer.length);
      res.set('Content-Disposition', 'inline; filename="document-not-found.pdf"');
      res.set('X-Document-Status', 'not-found');
      res.send(pdfBuffer);
    });
    doc.fontSize(18).text('Document Not Found', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('This document file could not be found on the server. It may have been deleted or the path is invalid.', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text('Please regenerate the document from the HR Documents page if needed.', { align: 'center' });
    doc.end();
    return;
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

  // Default: inline view in browser. If `download=1`, force attachment download.
  const safeName = path.basename(fullPath).replace(/[^a-zA-Z0-9._-]/g, '_');
  res.set('Content-Disposition', `${wantsDownload ? 'attachment' : 'inline'}; filename="${safeName}"`);
  res.set('Cache-Control', 'private, max-age=3600, must-revalidate');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Accept-Ranges', 'bytes');

  const stream = fs.createReadStream(fullPath);
  stream.pipe(res);
});

module.exports = router;
