/**
 * PDF Serving Route - Fix for PDF open/download and MIME type issues
 * Serves PDF files with correct Content-Type: application/pdf
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { query } = require('../config/database');

const router = express.Router();
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const ALLOWED_DIRS = ['hr_documents', 'hr_docs', 'salary_slips'];

router.get('/', async (req, res) => {
  const fileParam = req.query.file;
  if (!fileParam) {
    return res.status(400).json({ success: false, message: 'Missing file parameter' });
  }

  const wantsDownload =
    req.query.download === '1' ||
    req.query.download === 'true' ||
    req.query.disposition === 'attachment';

  // Decode defensively (max 2 times)
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

  // Allow callers to omit the "uploads/" prefix
  if (normalized.startsWith('salary_slips/')) normalized = 'uploads/' + normalized;
  if (normalized.startsWith('hr_documents/')) normalized = 'uploads/' + normalized;
  if (normalized.startsWith('hr_docs/')) normalized = 'uploads/' + normalized;

  // Extract safe relative segment
  const lower = normalized.toLowerCase();
  const idxHr = lower.indexOf('uploads/hr_documents/');
  const idxHrDocs = lower.indexOf('uploads/hr_docs/');
  const idxSalary = lower.indexOf('uploads/salary_slips/');
  if (idxHr >= 0) normalized = normalized.slice(idxHr);
  if (idxHrDocs >= 0) normalized = normalized.slice(idxHrDocs);
  if (idxSalary >= 0) normalized = normalized.slice(idxSalary);

  const lower2 = normalized.toLowerCase();
  const idxHr2 = lower2.indexOf('hr_documents/');
  const idxHrDocs2 = lower2.indexOf('hr_docs/');
  const idxSalary2 = lower2.indexOf('salary_slips/');
  if (idxHr2 >= 0) normalized = 'uploads/' + normalized.slice(idxHr2);
  if (idxHrDocs2 >= 0) normalized = 'uploads/' + normalized.slice(idxHrDocs2);
  if (idxSalary2 >= 0) normalized = 'uploads/' + normalized.slice(idxSalary2);

  normalized = normalized.replace(/^uploads\/hr_documents\//i, 'uploads/hr_documents/');
  normalized = normalized.replace(/^uploads\/hr_docs\//i, 'uploads/hr_docs/');
  normalized = normalized.replace(/^uploads\/salary_slips\//i, 'uploads/salary_slips/');

  // Security check
  const allowed =
    normalized.startsWith('uploads/hr_documents/') ||
    normalized.startsWith('uploads/hr_docs/') ||
    normalized.startsWith('uploads/salary_slips/');
  if (!allowed) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[serve-pdf] blocked path:', { fileParam, decodedPath, normalized });
    }
    return res.status(403).json({ success: false, message: 'Access denied. Invalid file path.' });
  }

  const joinedPath = path.join(__dirname, '../../', normalized);
  let fullPath = path.resolve(joinedPath);
  const basePath = path.resolve(UPLOADS_ROOT);

  if (!fullPath.startsWith(basePath)) {
    return res.status(403).json({ success: false, message: 'Access denied. Invalid file path.' });
  }

  const tryResolveLatestSibling = () => {
    try {
      const relDir = path.dirname(normalized).replace(/\\/g, '/');
      const base = path.basename(normalized);
      const absDir = path.resolve(path.join(__dirname, '../../', relDir));
      if (!absDir.startsWith(basePath) || !fs.existsSync(absDir)) return null;

      const prefixes = [];
      const mTs = base.match(/^(.*)_\d{10,13}\.pdf$/i);
      if (mTs) prefixes.push(mTs[1] + '_');

      const mSalaryDash = base.match(/^([A-Za-z0-9]+)_(\d{4})-(\d{2})\.pdf$/i);
      if (mSalaryDash) {
        const code = mSalaryDash[1];
        const y = mSalaryDash[2];
        const mm = mSalaryDash[3];
        prefixes.push(`${code}_${y}${mm}_`);
        prefixes.push(`${code}_${y}-${mm}_`);
      }

      const mSalaryPlain = base.match(/^([A-Za-z0-9]+)_(\d{6})\.pdf$/i);
      if (mSalaryPlain) {
        prefixes.push(`${mSalaryPlain[1]}_${mSalaryPlain[2]}_`);
      }

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
    return res.status(400).json({ success: false, message: 'Invalid file extension. Only PDFs are allowed.' });
  }

  const buf = Buffer.alloc(4);
  const fd = fs.openSync(fullPath, 'r');
  try {
    fs.readSync(fd, buf, 0, 4, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (buf.toString('ascii', 0, 4) !== '%PDF') {
    return res.status(400).json({ success: false, message: 'File is not a valid PDF document.' });
  }

  const stat = fs.statSync(fullPath);
  if (stat.size < 100) {
    return res.status(400).json({ success: false, message: 'PDF file is empty or corrupted.' });
  }

  const baseName = path.basename(fullPath);
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  let friendlyFilename = safeName;

  if (normalized.includes('salary_slips/')) {
    try {
      const slipRows = await query(
        `SELECT s.month, e.employee_code 
         FROM salary_slips s 
         JOIN employees e ON s.employee_id = e.id 
         WHERE s.file_path LIKE ? OR s.file_path LIKE ?`,
        [`%${baseName}`, `%${normalized}`]
      );
      const slip = slipRows[0];
      if (slip) {
        const cleanEmpCode = String(slip.employee_code || 'EMP').trim().replace(/[^a-zA-Z0-9._-]/g, '_');
        const cleanMonth = String(slip.month || '').trim().replace(/[^a-zA-Z0-9._-]/g, '_');
        friendlyFilename = `salary-slip_${cleanEmpCode}_${cleanMonth}.pdf`;
      }
    } catch (dbErr) {
      console.error('servePdf db error (salary):', dbErr);
    }
  } else if (normalized.includes('hr_documents/') || normalized.includes('hr_docs/')) {
    try {
      const docRows = await query(
        `SELECT d.type, d.title, d.file_path, e.employee_code 
         FROM hr_documents d 
         LEFT JOIN employees e ON d.employee_id = e.id 
         WHERE d.file_path LIKE ? OR d.file_path LIKE ?`,
        [`%${baseName}`, `%${normalized}`]
      );
      const doc = docRows[0];
      if (doc) {
        let docType = 'document';
        const typeLower = String(doc.type || '').toLowerCase();
        const titleLower = String(doc.title || '').toLowerCase();
        const pathLower = String(doc.file_path || '').toLowerCase();

        if (typeLower === 'offer_letter' || pathLower.includes('offer_letter') || titleLower.includes('offer letter')) {
          docType = 'offer-letter';
        } else if (typeLower === 'experience_letter' || pathLower.includes('experience_letter') || titleLower.includes('experience letter')) {
          docType = 'experience-letter';
        } else if (typeLower === 'joining_form' || pathLower.includes('joining_form') || titleLower.includes('joining form')) {
          docType = 'joining-form';
        } else if (typeLower === 'full_and_final' || pathLower.includes('full_and_final') || titleLower.includes('full_and_final') || titleLower.includes('f&f') || titleLower.includes('full and final')) {
          docType = 'full-and-final';
        } else if (typeLower && typeLower !== 'other') {
          docType = typeLower.replace(/_/g, '-');
        }

        const cleanEmpCode = String(doc.employee_code || 'EMP').trim().replace(/[^a-zA-Z0-9._-]/g, '_');
        friendlyFilename = `${docType}_${cleanEmpCode}.pdf`;
      }
    } catch (dbErr) {
      console.error('servePdf db error (hr):', dbErr);
    }
  }

  res.set('Content-Type', 'application/pdf');
  res.set('Content-Length', stat.size);
  res.set('Content-Disposition', `${wantsDownload ? 'attachment' : 'inline'}; filename="${friendlyFilename}"`);
  res.set('Cache-Control', 'private, max-age=3600, must-revalidate');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Accept-Ranges', 'bytes');

  const stream = fs.createReadStream(fullPath);
  stream.pipe(res);
});

module.exports = router;
