const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const COMPANY_NAME = 'Vanya Group (Artistry Studio)';
const COMPANY_ADDRESS = 'B-023, B Block, Sector 63, Noida';
const COMPANY_PHONE = '+91 9211608441';
const COMPANY_EMAIL = 'hrthevanygroup@gmail.com';
const HEADER_BG = '#0f253b';
const FOOTER_BG = '#0f253b';

const ASSETS_DIR = path.join(__dirname, '../backend-assets');
const LOGO_PATH = path.join(ASSETS_DIR, 'VANYA_GRP.png');
const MS_LOGO_PATH = path.join(ASSETS_DIR, 'MS_LOGO2.png');
// Prefer backend asset, but fall back to frontend asset paths in case deployments forget to copy.
const LETTERHEAD_BG_CANDIDATES = [
  path.join(ASSETS_DIR, 'letter-head.png'),
  path.join(__dirname, '../../frontend/src/assets/letter-head.png'),
  path.join(__dirname, '../../frontend/HR DOcumentation/letter-head.png'),
];
const hasLogo = () => fs.existsSync(LOGO_PATH);
const hasMsLogo = () => fs.existsSync(MS_LOGO_PATH);
let _letterheadResolvedPath = null;
function getLetterheadBgPath() {
  if (_letterheadResolvedPath !== null) return _letterheadResolvedPath;
  for (const p of LETTERHEAD_BG_CANDIDATES) {
    try {
      if (fs.existsSync(p)) {
        _letterheadResolvedPath = p;
        return _letterheadResolvedPath;
      }
    } catch (_) {}
  }
  _letterheadResolvedPath = '';
  return _letterheadResolvedPath;
}
const hasLetterheadBg = () => Boolean(getLetterheadBgPath());

const CONTENT_START_Y = 153;
const FOOTER_HEIGHT = 50;
const MARGIN_X = 50;

// `letter-head.png` (same as frontend print) layout tuning:
// CSS uses ~264px top offset for the document title; convert px->pt (72/96 = 0.75).
const LETTERHEAD_TITLE_Y = 264 * 0.75; // ~198pt
const LETTERHEAD_CONTENT_START_Y = LETTERHEAD_TITLE_Y + 44; // title + small gap

function createDoc() {
  const bottomMargin = hasLetterheadBg() ? 110 : (FOOTER_HEIGHT + 20);
  const doc = new PDFDocument({
    margin: 0,
    size: 'A4',
    bufferPages: true,
  });
  doc.page.margins = { top: 0, bottom: bottomMargin, left: MARGIN_X, right: MARGIN_X };
  return doc;
}

function addLetterhead(doc, title) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = MARGIN_X;
  let y = 0;

  // Preferred: exact same letterhead background as frontend (`letter-head.png`).
  // This makes view/download PDFs match the print layout.
  if (hasLetterheadBg()) {
    const bgPath = getLetterheadBgPath();
    let bgOk = true;
    try {
      doc.image(bgPath, 0, 0, { width: pageWidth, height: pageHeight });
    } catch (e) {
      bgOk = false;
      // If the PNG can't be read, fall back to the old header so PDF generation doesn't fail.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[pdf] letter-head.png load failed:', String(e && e.message ? e.message : e));
      }
    }

    if (bgOk) {
      doc
        .fillColor('#1f2937')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(title, margin, LETTERHEAD_TITLE_Y, { width: pageWidth - 2 * margin, align: 'center' });

      doc.y = LETTERHEAD_CONTENT_START_Y;
      doc.x = margin;
      doc.fillColor('#1f2937');
      return doc.y;
    }
  }

  doc.fillColor(HEADER_BG).rect(0, 0, pageWidth, 100).fill();
  y = 100;

  if (hasLogo()) {
    try {
      doc.image(LOGO_PATH, 50, 8, { width: 84, height: 84 });
    } catch (_) {}
  }

  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(title, margin, 35, {
    width: pageWidth - 2 * margin,
    align: 'center',
  });

  doc.fillColor('#9ca3af').fontSize(9).font('Helvetica').text(
    COMPANY_NAME + '  |  ' + COMPANY_ADDRESS,
    margin,
    y + 12,
    { width: pageWidth - 2 * margin, align: 'center' }
  );
  y += 28;
  doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor('#e5e7eb').stroke();
  y += 25;
  doc.y = y;
  doc.x = margin;
  doc.fillColor('#1f2937');
  return y;
}

// Legacy: salary slip letterhead variant (kept for compatibility, but not used now).
function addSalarySlipLetterhead(doc) {
  const pageWidth = doc.page.width;
  const margin = MARGIN_X;

  // White letterhead (A4) like standard printed letterhead.
  doc.fillColor('#ffffff').rect(0, 0, pageWidth, 140).fill();

  // Logo (optional) + centered company name.
  const logoBoxW = 56;
  const logoX = margin;
  const logoY = 26;
  if (hasMsLogo()) {
    try {
      doc.image(MS_LOGO_PATH, logoX, logoY, { width: logoBoxW, height: logoBoxW });
    } catch (_) {}
  }

  const headerLeft = hasMsLogo() ? logoX + logoBoxW + 12 : margin;
  const headerWidth = pageWidth - margin * 2 - (hasMsLogo() ? (logoBoxW + 12) : 0);

  doc
    .fillColor('#1d4ed8')
    .font('Helvetica-Bold')
    .fontSize(16)
    .text('MARCOM STREET CRM', headerLeft, 28, { width: headerWidth, align: 'center' });

  doc
    .fillColor('#374151')
    .font('Helvetica')
    .fontSize(8.5)
    .text('123 Business Street, Mumbai, Maharashtra 400001', headerLeft, 48, {
      width: headerWidth,
      align: 'center',
    });

  doc
    .fillColor('#374151')
    .font('Helvetica')
    .fontSize(8.5)
    .text('Phone: +91-9876543210 | Email: admin@marcomstreet.com', headerLeft, 60, {
      width: headerWidth,
      align: 'center',
    });

  const lineY = 78;
  doc.moveTo(margin, lineY).lineTo(pageWidth - margin, lineY).strokeColor('#111827').lineWidth(1).stroke();

  doc
    .fillColor('#1d4ed8')
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .text('SALARY SLIP', margin, lineY + 10, { width: pageWidth - margin * 2, align: 'center' });

  const contentStartY = lineY + 34;
  doc.y = contentStartY;
  doc.x = margin;
  doc.fillColor('#1f2937');
  return contentStartY;
}

function setupPageAddedListener(doc, title, opts = {}) {
  const letterheadFn = opts.letterheadFn || ((d) => addLetterhead(d, title));
  const contentStartY =
    typeof opts.contentStartY === 'number'
      ? opts.contentStartY
      : (hasLetterheadBg() ? LETTERHEAD_CONTENT_START_Y : CONTENT_START_Y);
  // If we are using the letterhead background image, do not draw a separate footer strip
  // (the footer is already part of the background).
  const footerFn =
    opts.footerFn === undefined
      ? (hasLetterheadBg() ? null : addFooter)
      : opts.footerFn; // allow disabling footer
  doc.on('pageAdded', () => {
    letterheadFn(doc);
    if (typeof footerFn === 'function') footerFn(doc);
    doc.y = contentStartY;
    doc.x = MARGIN_X;
    doc.fillColor('#1f2937');
  });
}

function addFooter(doc) {
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width;
  const margin = MARGIN_X;
  const bottom = pageHeight - FOOTER_HEIGHT;

  doc.fillColor(FOOTER_BG).rect(0, bottom, pageWidth, FOOTER_HEIGHT).fill();
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica').text(
    COMPANY_ADDRESS + '  |  ' + COMPANY_PHONE + '  |  ' + COMPANY_EMAIL,
    margin,
    bottom + 18,
    { align: 'center', width: pageWidth - 2 * margin }
  );
}

async function bufferFromDoc(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

async function generateOfferLetter(data) {
  const doc = createDoc();
  setupPageAddedListener(doc, 'OFFER LETTER');
  const startY = addLetterhead(doc, 'OFFER LETTER');
  doc.y = startY;
  doc.x = MARGIN_X;
  doc.fontSize(11).font('Helvetica').fillColor('#1f2937');
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
  doc.moveDown(1);
  doc.text(`Dear ${data.name},`);
  doc.moveDown(0.5);
  doc.text(
    `We are pleased to offer you the position of ${data.designation} in the ${data.department} department at ${COMPANY_NAME}.`
  );
  doc.moveDown(0.5);
  doc.text(`Joining Date: ${data.joining_date || 'To be communicated'}`);
  doc.text(`CTC: ${data.ctc ? '₹' + data.ctc : 'As per discussion'}`);
  doc.text(`Address: ${data.address || 'N/A'}`);
  doc.moveDown(1);
  doc.text('Please sign and return a copy of this letter to confirm your acceptance.');
  doc.moveDown(2);
  doc.text('Sincerely,');
  doc.text('HR Department');
  if (!hasLetterheadBg()) addFooter(doc);
  return bufferFromDoc(doc);
}

async function generateExperienceLetter(data) {
  const doc = createDoc();
  setupPageAddedListener(doc, 'EXPERIENCE LETTER');
  const startY = addLetterhead(doc, 'EXPERIENCE LETTER');
  doc.y = startY;
  doc.x = MARGIN_X;
  doc.fontSize(11).font('Helvetica').fillColor('#1f2937');
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
  doc.moveDown(1);
  doc.text(`To Whomsoever It May Concern,`);
  doc.moveDown(0.5);
  doc.text(
    `This is to certify that ${data.name} was employed with ${COMPANY_NAME} as ${data.designation} in the ${data.department} department.`
  );
  doc.moveDown(0.5);
  doc.text(`Period of employment: ${data.joining_date || 'N/A'} to ${data.relieving_date || 'Till date'}.`);
  doc.moveDown(0.5);
  doc.text('We wish them success in their future endeavours.');
  doc.moveDown(2);
  doc.text('Sincerely,');
  doc.text('HR Department');
  if (!hasLetterheadBg()) addFooter(doc);
  return bufferFromDoc(doc);
}

async function generateJoiningForm(data) {
  const doc = createDoc();
  setupPageAddedListener(doc, 'JOINING FORM');
  const startY = addLetterhead(doc, 'JOINING FORM');
  doc.y = startY;
  doc.x = MARGIN_X;
  doc.fontSize(10).font('Helvetica').fillColor('#1f2937');
  doc.text(`Name: ${data.name}`);
  doc.text(`Designation: ${data.designation}`);
  doc.text(`Department: ${data.department}`);
  doc.text(`Joining Date: ${data.joining_date || 'N/A'}`);
  doc.text(`Address: ${data.address || 'N/A'}`);
  doc.text(`Phone: ${data.phone || 'N/A'}`);
  doc.text(`Email: ${data.email || 'N/A'}`);
  doc.moveDown(1);
  doc.text('I hereby declare that the information provided is true and correct.');
  doc.moveDown(2);
  doc.text('Signature: _________________________');
  if (!hasLetterheadBg()) addFooter(doc);
  return bufferFromDoc(doc);
}

async function generateSalarySlip(employeeData, salaryData) {
  const doc = createDoc();
  // Salary slip must use same letterhead (`letter-head.png`) as other documents.
  setupPageAddedListener(doc, 'SALARY SLIP', {
    letterheadFn: (d) => addLetterhead(d, 'SALARY SLIP'),
    contentStartY: hasLetterheadBg() ? LETTERHEAD_CONTENT_START_Y : CONTENT_START_Y,
  });
  const startY = addLetterhead(doc, 'SALARY SLIP');
  const pageWidth = doc.page.width;
  const rightX = pageWidth - MARGIN_X;
  const valueX = pageWidth - MARGIN_X - 8;
  const fmtMoney = (v) => `\u20B9 ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const maxY = () => doc.page.height - (doc.page.margins.bottom || 0);
  let y = startY + 6;

  // Salary slip must be a single page: do not auto-add pages.
  const pageBreak = (_neededHeight) => {};

  doc.x = MARGIN_X;
  doc.fillColor('#1f2937');

  const fmtDate = (v) => {
    if (!v) return 'N/A';
    try {
      const d = v instanceof Date ? v : new Date(v);
      if (Number.isNaN(d.getTime())) {
        // Likely a plain YYYY-MM-DD already
        const s = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        return s || 'N/A';
      }
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) {
      return String(v) || 'N/A';
    }
  };
  const employeeName = employeeData?.name || 'N/A';
  const employeeCode = employeeData?.employee_code || 'N/A';
  const employeeDept = employeeData?.department || employeeData?.department_name || 'N/A';
  const accountNo = employeeData?.bank_account || employeeData?.account_number || employeeData?.account_no || '';
  const ifsc = employeeData?.ifsc_code || employeeData?.bank_ifsc || employeeData?.ifsc || '';
  const payPeriodText = `${fmtDate(salaryData.pay_period_start)} - ${fmtDate(salaryData.pay_period_end)}`;
  const generatedOnText = fmtDate(new Date());

  // Compute meta-box height dynamically to avoid any overlap/wrapping issues.
  const lineGap = 1;
  const fontSize = 9;
  const metaW = pageWidth - MARGIN_X * 2;
  const colGap = 16;
  const colPad = 10;
  const colW = (metaW - colPad * 2 - colGap) / 2;

  const leftLines = [
    `Name: ${employeeName}`,
    `Employee Code: ${employeeCode}`,
    `Department: ${employeeDept}`,
    `Bank A/C: ${accountNo ? accountNo : '-'}`,
    `IFSC: ${ifsc ? ifsc : '-'}`,
  ];
  const rightLines = [
    `Pay Period: ${payPeriodText}`,
    `Generated On: ${generatedOnText}`,
  ];

  doc.font('Helvetica').fontSize(fontSize);
  const linesHeight = (lines) => {
    let total = 0;
    for (const t of lines) {
      const h = doc.heightOfString(String(t), { width: colW, lineGap });
      total += h + 6;
    }
    return total;
  };
  const contentTopOffset = 26; // where columns begin inside the box
  const titleArea = 18; // "Employee Details" title line
  const metaHeight = Math.max(84, titleArea + contentTopOffset + Math.max(linesHeight(leftLines), linesHeight(rightLines)) + 6);

  pageBreak(metaHeight + 20);
  const metaTop = y;
  doc
    .rect(MARGIN_X, metaTop, metaW, metaHeight)
    .lineWidth(0.8)
    .strokeColor('#cbd5e1')
    .stroke();

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827');
  doc.text('Employee Details', MARGIN_X + 10, metaTop + 8);

  const leftX = MARGIN_X + colPad;
  const rightXCol = leftX + colW + colGap;
  let ly = metaTop + 26;
  let ry = metaTop + 26;

  const drawLine = (text, x, yy, width) => {
    doc.font('Helvetica').fontSize(fontSize).fillColor('#111827');
    const h = doc.heightOfString(text, { width, lineGap });
    doc.text(text, x, yy, { width, lineGap });
    return yy + h + 6;
  };

  for (const t of leftLines) ly = drawLine(t, leftX, ly, colW);
  for (const t of rightLines) ry = drawLine(t, rightXCol, ry, colW);

  y = metaTop + metaHeight + 10;
  doc.font('Helvetica-Bold').fontSize(10).text('Earnings', MARGIN_X, y);
  y += 14;
  doc.moveTo(MARGIN_X, y - 5).lineTo(rightX, y - 5).strokeColor('#d1d5db').lineWidth(0.8).stroke();

  const earningsRows = [
    ['Basic Salary', salaryData.basic_salary],
    ['HRA', salaryData.hra],
    ['Conveyance Allowance', salaryData.conveyance_allowance],
    ['Medical Allowance', salaryData.medical_allowance],
    ['Special Allowance', salaryData.special_allowance],
    ['Other Allowances', salaryData.other_allowances],
    ['Gross Salary', salaryData.gross_salary],
  ];

  doc.font('Helvetica').fontSize(9);
  earningsRows.forEach(([label, value], idx) => {
    pageBreak(22);
    if (idx === earningsRows.length - 1) doc.font('Helvetica-Bold');
    doc.text(label, MARGIN_X, y, { width: 320, align: 'left' });
    doc.text(fmtMoney(value), MARGIN_X, y, { width: valueX - MARGIN_X, align: 'right' });
    if (idx === earningsRows.length - 1) doc.font('Helvetica');
    y += 14;
  });

  y += 8;
  pageBreak(40);
  doc.font('Helvetica-Bold').fontSize(10).text('Deductions', MARGIN_X, y);
  y += 14;
  doc.moveTo(MARGIN_X, y - 5).lineTo(rightX, y - 5).strokeColor('#d1d5db').lineWidth(0.8).stroke();

  const deductionRows = [
    ['PF', salaryData.pf_deduction],
    ['ESI', salaryData.esi_deduction],
    ['Tax', salaryData.tax_deduction],
    ['Professional Tax', salaryData.professional_tax],
    ['Other Deductions', salaryData.other_deductions],
    ['Total Deductions', salaryData.total_deductions],
  ];

  doc.font('Helvetica').fontSize(9);
  deductionRows.forEach(([label, value], idx) => {
    pageBreak(22);
    if (idx === deductionRows.length - 1) doc.font('Helvetica-Bold');
    doc.text(label, MARGIN_X, y, { width: 320, align: 'left' });
    doc.text(fmtMoney(value), MARGIN_X, y, { width: valueX - MARGIN_X, align: 'right' });
    if (idx === deductionRows.length - 1) doc.font('Helvetica');
    y += 14;
  });

  y += 10;
  pageBreak(90);
  doc.rect(MARGIN_X, y, pageWidth - MARGIN_X * 2, 24).fillColor('#f1f5f9').fill();
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12);
  doc.text('Net Salary', MARGIN_X + 10, y + 6);
  doc.text(fmtMoney(salaryData.net_salary), MARGIN_X, y + 6, { width: valueX - MARGIN_X, align: 'right' });

  return bufferFromDoc(doc);
}

async function generateInvoice(invoice, items) {
  const doc = createDoc();
  setupPageAddedListener(doc, 'INVOICE', {
    letterheadFn: (d) => addLetterhead(d, 'INVOICE'),
    contentStartY: hasLetterheadBg() ? LETTERHEAD_CONTENT_START_Y : CONTENT_START_Y,
  });
  const startY = addLetterhead(doc, 'INVOICE');
  const pageWidth = doc.page.width;
  const margin = MARGIN_X;
  const right = pageWidth - margin;

  const fmtDate = (v) => {
    if (!v) return 'N/A';
    try {
      const d = v instanceof Date ? v : new Date(v);
      if (Number.isNaN(d.getTime())) {
        const s = String(v).trim();
        if (/^\\d{4}-\\d{2}-\\d{2}/.test(s)) return s.slice(0, 10);
        return s || 'N/A';
      }
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) {
      return String(v) || 'N/A';
    }
  };
  const fmtMoney = (v) =>
    `Rs. ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const pageBreak = (needed = 0) => {
    const maxY = () => doc.page.height - (doc.page.margins.bottom || 0);
    if (doc.y + needed > maxY()) {
      doc.addPage();
      doc.y = hasLetterheadBg() ? LETTERHEAD_CONTENT_START_Y : CONTENT_START_Y;
      doc.x = margin;
    }
  };

  doc.x = margin;
  doc.y = startY + 8;
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11);

  const invNo = invoice?.invoice_number || `INV-${invoice?.id || ''}`;
  const issueDate = fmtDate(invoice?.issue_date || invoice?.created_at);
  const dueDate = fmtDate(invoice?.due_date);
  const companyName = invoice?.company_name || invoice?.client_name || 'N/A';
  const contact = invoice?.contact_person || '';

  // Header block
  pageBreak(90);
  doc.text(`Invoice No: ${invNo}`, margin, doc.y, { width: (right - margin) / 2 });
  doc.font('Helvetica').fontSize(10).fillColor('#374151');
  doc.text(`Issue Date: ${issueDate}`, margin, doc.y + 18, { width: (right - margin) / 2 });
  doc.text(`Due Date: ${dueDate}`, margin, doc.y + 36, { width: (right - margin) / 2 });

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827');
  doc.text('Bill To', margin + (right - margin) / 2, doc.y - 0, { width: (right - margin) / 2, align: 'left' });
  doc.font('Helvetica').fontSize(10).fillColor('#374151');
  doc.text(companyName, margin + (right - margin) / 2, doc.y + 18, { width: (right - margin) / 2 });
  if (contact) {
    doc.text(`Attn: ${contact}`, margin + (right - margin) / 2, doc.y + 34, { width: (right - margin) / 2 });
  }

  doc.moveDown(3);
  doc.y += 10;
  doc.moveTo(margin, doc.y).lineTo(right, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.y += 14;

  // Items table
  const colItem = margin;
  const colQty = right - 210;
  const colUnit = right - 140;
  const colTotal = right - 60;

  pageBreak(40);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280');
  doc.text('ITEM', colItem, doc.y, { width: colQty - colItem - 10 });
  doc.text('QTY', colQty, doc.y, { width: 40, align: 'right' });
  doc.text('RATE', colUnit, doc.y, { width: 60, align: 'right' });
  doc.text('AMOUNT', colTotal, doc.y, { width: 60, align: 'right' });
  doc.y += 14;
  doc.moveTo(margin, doc.y).lineTo(right, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.y += 10;

  doc.font('Helvetica').fontSize(10).fillColor('#111827');
  const rows = Array.isArray(items) ? items : [];
  for (const it of rows) {
    pageBreak(34);
    const name = String(it.item_name || '').trim() || 'Item';
    const desc = it.description ? String(it.description) : '';
    const qty = Number(it.quantity || 0);
    const unit = Number(it.unit_price || 0);
    const total = Number(it.total_price != null ? it.total_price : qty * unit);

    const y0 = doc.y;
    doc.text(name, colItem, y0, { width: colQty - colItem - 10 });
    if (desc) {
      doc.fontSize(9).fillColor('#6b7280');
      doc.text(desc, colItem, doc.y + 2, { width: colQty - colItem - 10 });
      doc.fontSize(10).fillColor('#111827');
    }

    doc.text(String(qty || 0), colQty, y0, { width: 40, align: 'right' });
    doc.text(fmtMoney(unit), colUnit, y0, { width: 60, align: 'right' });
    doc.text(fmtMoney(total), colTotal, y0, { width: 60, align: 'right' });

    doc.y = Math.max(doc.y, y0 + 18);
    doc.moveTo(margin, doc.y + 6).lineTo(right, doc.y + 6).strokeColor('#f1f5f9').lineWidth(1).stroke();
    doc.y += 14;
  }

  // Totals
  const subtotal = Number(invoice?.subtotal || 0);
  const discountAmt = Number(invoice?.discount_amount || 0);
  const taxAmt = Number(invoice?.tax_amount || 0);
  const totalAmt = Number(invoice?.total_amount || 0);

  pageBreak(120);
  doc.y += 6;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827');
  const labelX = right - 210;
  const valX = right - 10;
  const line = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#374151');
    doc.text(label, labelX, doc.y, { width: 150, align: 'right' });
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#111827');
    doc.text(value, valX - 120, doc.y, { width: 120, align: 'right' });
    doc.y += 16;
  };
  line('Subtotal', fmtMoney(subtotal));
  if (discountAmt > 0) line('Discount', `- ${fmtMoney(discountAmt)}`);
  if (taxAmt > 0) line('Tax', fmtMoney(taxAmt));
  doc.moveTo(labelX, doc.y).lineTo(right, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.y += 10;
  line('Total', fmtMoney(totalAmt), true);

  if (invoice?.notes) {
    pageBreak(80);
    doc.y += 10;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Notes', margin, doc.y);
    doc.y += 6;
    doc.font('Helvetica').fontSize(9).fillColor('#4b5563').text(String(invoice.notes), margin, doc.y, { width: right - margin });
  }

  if (invoice?.payment_terms) {
    pageBreak(80);
    doc.y += 10;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Payment Terms', margin, doc.y);
    doc.y += 6;
    doc.font('Helvetica').fontSize(9).fillColor('#4b5563').text(String(invoice.payment_terms), margin, doc.y, { width: right - margin });
  }

  if (!hasLetterheadBg()) addFooter(doc);
  return bufferFromDoc(doc);
}

module.exports = {
  generateOfferLetter,
  generateExperienceLetter,
  generateJoiningForm,
  generateSalarySlip,
  generateInvoice,
};
