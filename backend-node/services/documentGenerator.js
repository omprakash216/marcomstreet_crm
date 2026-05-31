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
const MS_LOGO_PATH = path.join(ASSETS_DIR, 'vg.png');
// Prefer backend asset, but fall back to frontend asset paths in case deployments forget to copy.
const LETTERHEAD_BG_CANDIDATES = [
  path.join(ASSETS_DIR, 'letter-head.png'),
  path.join(__dirname, '../../frontend/src/assets/letter-head.png'),
  path.join(__dirname, '../../frontend/HR DOcumentation/letter-head.png'),
];
const HR_SIGNATURE_CANDIDATES = [
  path.join(ASSETS_DIR, 'hr_signature.png'),
  path.join(__dirname, '../../frontend/src/assets/hr_signature.png'),
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

let _hrSignaturePath = null;
function getHrSignaturePath() {
  if (_hrSignaturePath !== null) return _hrSignaturePath;
  for (const p of HR_SIGNATURE_CANDIDATES) {
    try {
      if (fs.existsSync(p)) {
        _hrSignaturePath = p;
        return _hrSignaturePath;
      }
    } catch (_) {}
  }
  _hrSignaturePath = '';
  return _hrSignaturePath;
}

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

function fmtDateEnGB(dateVal) {
  if (!dateVal) return 'N/A';
  try {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (Number.isNaN(d.getTime())) {
      const s = String(dateVal).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, day] = s.split('-');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${parseInt(day, 10)} ${monthNames[parseInt(m, 10) - 1]} ${y}`;
      }
      return s || 'N/A';
    }
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (_) {
    return String(dateVal) || 'N/A';
  }
}

async function generateFullAndFinalLetter(data) {
  const doc = createDoc();
  setupPageAddedListener(doc, 'Full and Final Acknowledgement');
  const startY = addLetterhead(doc, 'Full and Final Acknowledgement');
  doc.y = startY;
  doc.x = MARGIN_X;

  const companyName = data.company_name || COMPANY_NAME;
  const hrName = data.hr_name || 'Jyoti Sharma';
  const lastWorkingDate = fmtDateEnGB(data.last_working_date);
  const currentDate = fmtDateEnGB(new Date());
  const name = data.name || 'Employee';
  const nameFormatted = name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  const designationUpper = (data.designation || 'Employee').toUpperCase();

  doc.fontSize(11).font('Helvetica').fillColor('#1f2937');

  doc.font('Helvetica-Bold').fontSize(12).text('Full and Final Acknowledgement');
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(11);
  doc.text(`DATE: ${currentDate}`);
  doc.moveDown(0.5);
  doc.text(`Dear: ${nameFormatted || '—'}`);
  doc.moveDown(1);

  doc.text(
    `This is to inform you that your last working day with us was ${lastWorkingDate || '—'}. ` +
    `Your full & final settlement has been processed and you are relieved from your duties with effect from the said date as ${designationUpper || '—'}.`
  );
  doc.moveDown(0.8);

  doc.text(
    'This letter acknowledges the in-person receipt of your full & final settlement. Your account with the company stands closed ' +
    'and there are no outstanding dues or obligations between you and the company.'
  );
  doc.moveDown(0.8);

  doc.text('Any pending payments will be cleared within 45 days as per company policy. We wish you success in your future endeavors.');
  doc.moveDown(1.5);

  doc.moveTo(MARGIN_X, doc.y).lineTo(doc.page.width - MARGIN_X, doc.y).strokeColor('#d1d5db').stroke();
  doc.moveDown(1);
  doc.text('Regards,');
  doc.font('Helvetica-Bold').fontSize(11).text(hrName);
  doc.font('Helvetica').fontSize(10).fillColor('#4b5563').text('Human Resources Department');
  doc.fillColor('#1f2937').fontSize(10).text(companyName);

  if (!hasLetterheadBg()) addFooter(doc);
  return bufferFromDoc(doc);
}

async function generateExperienceLetter(data) {
  const doc = createDoc();
  setupPageAddedListener(doc, 'Experience Letter');
  const startY = addLetterhead(doc, 'Experience Letter');
  doc.y = startY;
  doc.x = MARGIN_X;

  const companyName = data.company_name || COMPANY_NAME;
  const companyAddress = data.company_address || COMPANY_ADDRESS;
  const hrName = data.hr_name || 'Jyoti Sharma';
  const hrContact = data.hr_contact || COMPANY_PHONE;
  const hrEmail = data.hr_email || COMPANY_EMAIL;

  const gender = String(data.gender || 'male').toLowerCase();
  const isFemale = gender === 'female';
  const title = isFemale ? 'Ms.' : 'Mr.';
  const pronoun = isFemale ? 'her' : 'his';
  const pronounCap = isFemale ? 'Her' : 'His';
  const pronounSub = isFemale ? 'she' : 'he';
  const pronounObj = isFemale ? 'her' : 'him';

  const name = data.name || 'Employee';
  const nameUpper = name.toUpperCase();
  const nameFormatted = name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  const designation = data.designation || 'Employee';
  const joiningDate = fmtDateEnGB(data.joining_date);
  const relievingDate = fmtDateEnGB(data.relieving_date);
  const currentDate = fmtDateEnGB(new Date());

  doc.fontSize(11).font('Helvetica').fillColor('#1f2937');

  // Company name (bold, large)
  doc.font('Helvetica-Bold').fontSize(14).text(companyName, MARGIN_X, doc.y);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(11).text(companyAddress);
  doc.moveDown(1);

  // TO WHOMSOEVER IT MAY CONCERN
  doc.font('Helvetica-Bold').fontSize(12).text('TO WHOMSOEVER IT MAY CONCERN');
  doc.moveDown(1);

  // Date
  doc.font('Helvetica').fontSize(11);
  doc.text(`Date: ${currentDate}`);
  doc.moveDown(1);

  // Paragraph 1
  doc.text(
    `This is to certify that ${title} ${nameUpper} was employed with ${companyName} as a ${designation} from ${joiningDate} to ${relievingDate}.`,
    { align: 'left' }
  );
  doc.moveDown(0.8);

  // Paragraph 2
  doc.text(
    `During ${pronoun} tenure, ${pronounSub} was responsible for handling ${designation} tasks, developing creative assets, and supporting branding and marketing requirements across various projects. ${title} ${nameFormatted} demonstrated strong creativity, attention to detail, and the ability to meet deadlines consistently. ${pronounCap} work ethics, discipline, and conduct with colleagues and management were satisfactory.`,
    { align: 'left' }
  );
  doc.moveDown(0.8);

  // Paragraph 3 - Company name
  doc.font('Helvetica-Bold').fontSize(12).text(companyName);
  doc.font('Helvetica').fontSize(11);
  doc.moveDown(0.5);

  // Paragraph 4
  doc.text(
    `All responsibilities and handovers have been completed. As per company policy, ${pronoun} pending salary will be processed and released within 45 days from ${pronoun} last working date.`,
    { align: 'left' }
  );
  doc.moveDown(0.5);

  // Paragraph 5
  doc.text(
    `We appreciate ${pronoun} contributions and wish ${pronounObj} success in ${pronoun} future endeavors.`,
    { align: 'left' }
  );
  doc.moveDown(1.5);

  // Divider line
  const pageWidth = doc.page.width;
  doc.moveTo(MARGIN_X, doc.y).lineTo(pageWidth - MARGIN_X, doc.y).strokeColor('#d1d5db').stroke();
  doc.moveDown(1);

  // Signature section
  doc.text(`For ${companyName}`);
  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(11).text(hrName);
  doc.font('Helvetica').fontSize(10).fillColor('#4b5563').text('Human Resources Department');
  doc.text(hrContact);
  doc.moveDown(0.5);
  doc.fillColor('#1f2937').fontSize(10).text('Signature:');

  const sigPath = getHrSignaturePath();
  if (sigPath) {
    try {
      doc.image(sigPath, MARGIN_X, doc.y + 4, { width: 96, height: 40 });
      doc.y += 50;
    } catch (_) {
      doc.moveDown(1);
    }
  } else {
    doc.moveDown(1.2);
  }

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
  // Salary slips must stay on a single page; reduce auto page-break sensitivity.
  if (hasLetterheadBg()) {
    doc.page.margins.bottom = 40;
  }
  // Salary slip must use same letterhead (`letter-head.png`) as other documents.
  setupPageAddedListener(doc, 'PAY SLIP', {
    letterheadFn: (d) => addLetterhead(d, 'PAY SLIP'),
    contentStartY: hasLetterheadBg() ? LETTERHEAD_CONTENT_START_Y : CONTENT_START_Y,
  });
  const startY = addLetterhead(doc, 'PAY SLIP');
  const pageWidth = doc.page.width;
  const contentLeft = MARGIN_X;
  const contentRight = pageWidth - MARGIN_X;
  const contentWidth = contentRight - contentLeft;
  const navy = '#0f2f59';
  const blue = '#15508f';
  const line = '#aeb8c6';
  const lightFill = '#eef2f7';

  const fmtDate = (v) => {
    if (!v) return '-';
    try {
      const d = v instanceof Date ? v : new Date(v);
      if (Number.isNaN(d.getTime())) {
        const s = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        return s || '-';
      }
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) {
      return String(v || '-');
    }
  };

  const fmtAmount = (v) => {
    const n = Number(v || 0);
    const isInt = Math.abs(n - Math.round(n)) < 0.000001;
    return n.toLocaleString('en-IN', {
      minimumFractionDigits: isInt ? 0 : 2,
      maximumFractionDigits: 2,
    });
  };

  const toMonthHeading = () => {
    const monthStr = String(salaryData?.month || '').trim();
    if (/^\d{4}-\d{2}$/.test(monthStr)) {
      const [yy, mm] = monthStr.split('-').map(Number);
      const d = new Date(yy, mm - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    }
    const d = salaryData?.pay_period_end || salaryData?.pay_period_start;
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigitWords = (n) => {
    const num = Number(n) || 0;
    if (num < 20) return ones[num];
    const t = Math.floor(num / 10);
    const o = num % 10;
    return `${tens[t]}${o ? ` ${ones[o]}` : ''}`.trim();
  };
  const threeDigitWords = (n) => {
    const num = Number(n) || 0;
    const h = Math.floor(num / 100);
    const rem = num % 100;
    const left = h ? `${ones[h]} Hundred` : '';
    const right = rem ? twoDigitWords(rem) : '';
    return `${left}${left && right ? ' ' : ''}${right}`.trim();
  };
  const toIndianWords = (n) => {
    let num = Math.floor(Math.abs(Number(n) || 0));
    if (num === 0) return 'Zero';
    const chunks = [];
    const crore = Math.floor(num / 10000000);
    num %= 10000000;
    const lakh = Math.floor(num / 100000);
    num %= 100000;
    const thousand = Math.floor(num / 1000);
    num %= 1000;
    if (crore) chunks.push(`${threeDigitWords(crore)} Crore`);
    if (lakh) chunks.push(`${threeDigitWords(lakh)} Lakh`);
    if (thousand) chunks.push(`${threeDigitWords(thousand)} Thousand`);
    if (num) chunks.push(threeDigitWords(num));
    return chunks.join(' ').replace(/\s+/g, ' ').trim();
  };

  // Letterhead already contains the title divider line; avoid drawing an extra one.
  let y = startY + 6;
  const monthHeading = toMonthHeading();
  if (monthHeading) {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(navy).text(`FOR THE MONTH OF ${monthHeading}`, contentLeft, y, {
      width: contentWidth,
      align: 'center',
    });
    y += 20;
  } else {
    y += 6;
  }

  const detailsTop = y;
  const detailsHeight = 96;
  const c1LabelW = 92;
  const c1ValueW = 136;
  const c2LabelW = 100;
  const c2ValueW = contentWidth - c1LabelW - c1ValueW - c2LabelW;
  const x1 = contentLeft;
  const x2 = x1 + c1LabelW;
  const x3 = x2 + c1ValueW;
  const x4 = x3 + c2LabelW;
  const rowH = detailsHeight / 4;

  // Light label backgrounds for clean scanability in print + PDF viewers.
  for (let i = 0; i < 4; i += 1) {
    const rowTop = detailsTop + i * rowH;
    doc.rect(x1, rowTop, c1LabelW, rowH).fillColor('#f3f6fb').fill();
    doc.rect(x3, rowTop, c2LabelW, rowH).fillColor('#f3f6fb').fill();
  }

  doc.rect(contentLeft, detailsTop, contentWidth, detailsHeight).lineWidth(0.8).strokeColor(line).stroke();
  doc.moveTo(x2, detailsTop).lineTo(x2, detailsTop + detailsHeight).strokeColor(line).lineWidth(0.8).stroke();
  doc.moveTo(x3, detailsTop).lineTo(x3, detailsTop + detailsHeight).strokeColor(line).lineWidth(0.8).stroke();
  doc.moveTo(x4, detailsTop).lineTo(x4, detailsTop + detailsHeight).strokeColor(line).lineWidth(0.8).stroke();
  for (let i = 1; i < 4; i += 1) {
    const yy = detailsTop + rowH * i;
    doc.moveTo(contentLeft, yy).lineTo(contentRight, yy).strokeColor(line).lineWidth(0.8).stroke();
  }

  const ifscValue = employeeData?.ifsc_code || employeeData?.bank_ifsc || employeeData?.ifsc || '';
  const accountHolderValue =
    employeeData?.account_holder_name ||
    employeeData?.account_holder ||
    employeeData?.bank_account_holder ||
    '-';

  const detailRows = [
    ['Employee Name', employeeData?.name || '-', 'Department', employeeData?.department || employeeData?.department_name || '-'],
    ['Employee ID', employeeData?.employee_code || '-', 'Date of Joining', fmtDate(employeeData?.joining_date)],
    ['Designation', employeeData?.designation || '-', 'Bank Account No', employeeData?.bank_account || employeeData?.account_number || employeeData?.account_no || '-'],
    ['IFSC Code', ifscValue || '-', 'Account Holder', accountHolderValue],
  ];

  detailRows.forEach((row, idx) => {
    const rowY = detailsTop + idx * rowH + 8;
    const leftValue = row[1] === undefined || row[1] === null ? '-' : String(row[1]);
    const rightValue = row[3] === undefined || row[3] === null ? '-' : String(row[3]);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(navy).text(`${row[0]}:`, x1 + 6, rowY, { width: c1LabelW - 10 });
    doc.font('Helvetica').fontSize(9).fillColor('#111827').text(leftValue, x2 + 6, rowY, { width: c1ValueW - 10 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(navy).text(`${row[2]}:`, x3 + 6, rowY, { width: c2LabelW - 10 });
    doc.font('Helvetica').fontSize(9).fillColor('#111827').text(rightValue, x4 + 6, rowY, { width: c2ValueW - 10 });
  });

  y = detailsTop + detailsHeight + 10;

  const earningsRows = [
    ['Basic Salary', salaryData?.basic_salary],
    ['House Rent Allowance', salaryData?.hra],
    ['Conveyance Allowance', salaryData?.conveyance_allowance],
    ['Medical Allowance', salaryData?.medical_allowance],
    ['Special Allowance', salaryData?.special_allowance],
  ];
  if (Number(salaryData?.other_allowances || 0) !== 0) {
    earningsRows.push(['Other Allowances', salaryData?.other_allowances]);
  }
  const deductionRows = [
    ['Provident Fund (PF)', salaryData?.pf_deduction],
    ['Professional Tax', salaryData?.professional_tax],
    ['Income Tax (TDS)', salaryData?.tax_deduction],
    ['ESI', salaryData?.esi_deduction],
  ];
  if (Number(salaryData?.other_deductions || 0) !== 0) {
    deductionRows.push(['Other Deductions', salaryData?.other_deductions]);
  }

  const drawSideTable = (x, top, width, title, columnLabel, rows, totalLabel, totalValue, fillerRows = 0) => {
    const titleH = 22;
    const headH = 20;
    const rowHeight = 20;
    const totalH = 24;
    const amountColW = 84;
    const labelColW = width - amountColW;
    const bodyRows = [...rows];
    for (let i = 0; i < fillerRows; i += 1) bodyRows.push(['', null]);
    const totalRows = bodyRows.length;
    const tableH = titleH + headH + rowHeight * totalRows + totalH;

    doc.rect(x, top, width, tableH).lineWidth(0.8).strokeColor(line).stroke();
    doc.rect(x, top, width, titleH).fillColor(blue).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10.5).text(title, x, top + 4, { width, align: 'center' });

    const headerTop = top + titleH;
    doc.rect(x, headerTop, width, headH).fillColor(blue).fill();
    doc.moveTo(x + labelColW, headerTop).lineTo(x + labelColW, top + tableH).strokeColor(line).lineWidth(0.8).stroke();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9.5);
    doc.text(columnLabel, x + 8, headerTop + 4, {
      width: labelColW - 12,
      align: 'left',
    });
    doc.text('Amount (Rs)', x + labelColW, headerTop + 4, {
      width: amountColW - 8,
      align: 'center',
    });

    bodyRows.forEach((row, idx) => {
      const rowTop = headerTop + headH + idx * rowHeight;
      doc.moveTo(x, rowTop).lineTo(x + width, rowTop).strokeColor(line).lineWidth(0.6).stroke();
      if (!row[0]) return;
      doc.fillColor('#111827').font('Helvetica').fontSize(9.5).text(row[0], x + 8, rowTop + 4, {
        width: labelColW - 12,
        align: 'left',
      });
      doc.text(fmtAmount(row[1]), x + labelColW + 2, rowTop + 4, {
        width: amountColW - 6,
        align: 'right',
      });
    });

    const totalTop = headerTop + headH + rowHeight * totalRows;
    doc.rect(x, totalTop, width, totalH).fillColor(lightFill).fill();
    doc.rect(x, totalTop, width, totalH).lineWidth(0.8).strokeColor(line).stroke();
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text(totalLabel, x + 8, totalTop + 5, {
      width: labelColW - 12,
      align: 'left',
    });
    doc.text(fmtAmount(totalValue), x + labelColW + 2, totalTop + 5, {
      width: amountColW - 6,
      align: 'right',
    });

    return tableH;
  };

  const panelGap = 12;
  const panelW = (contentWidth - panelGap) / 2;
  const leftPanelX = contentLeft;
  const rightPanelX = leftPanelX + panelW + panelGap;
  const filler = Math.max(0, earningsRows.length - deductionRows.length);
  const leftHeight = drawSideTable(leftPanelX, y, panelW, 'EARNINGS', 'Earnings', earningsRows, 'Gross Earnings', salaryData?.gross_salary, 0);
  const rightHeight = drawSideTable(rightPanelX, y, panelW, 'DEDUCTIONS', 'Deductions', deductionRows, 'Total Deductions', salaryData?.total_deductions, filler);
  y += Math.max(leftHeight, rightHeight) + 10;

  const summaryH = 24;
  doc.rect(contentLeft, y, contentWidth, summaryH).lineWidth(0.8).strokeColor(line).stroke();
  const half = contentWidth / 2;
  doc.moveTo(contentLeft + half, y).lineTo(contentLeft + half, y + summaryH).strokeColor(line).lineWidth(0.8).stroke();
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9.5).text('GROSS EARNINGS', contentLeft + 8, y + 6, { width: half - 16, align: 'left' });
  doc.text(`Rs. ${fmtAmount(salaryData?.gross_salary)}`, contentLeft + 8, y + 6, { width: half - 14, align: 'right' });
  doc.text(`Rs. ${fmtAmount(salaryData?.total_deductions)}`, contentLeft + half + 8, y + 6, { width: half - 14, align: 'right' });
  y += summaryH + 8;

  const netH = 30;
  const netW = panelW;
  const netLabelW = Math.round(netW * 0.65);
  doc.rect(contentLeft, y, netLabelW, netH).fillColor(navy).fill();
  doc.rect(contentLeft + netLabelW, y, netW - netLabelW, netH).fillColor(blue).fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text('NET SALARY', contentLeft + 12, y + 7, {
    width: netLabelW - 20,
    align: 'left',
  });

  // Fit amount in a single line even for large values (avoid wrap/cut in right blue box).
  const netAmountText = `Rs. ${fmtAmount(salaryData?.net_salary)}`;
  const netAmountBoxW = Math.max(28, netW - netLabelW - 12);
  let netAmountFont = 14;
  doc.font('Helvetica-Bold');
  while (netAmountFont > 8) {
    doc.fontSize(netAmountFont);
    if (doc.widthOfString(netAmountText) <= netAmountBoxW) break;
    netAmountFont -= 0.5;
  }
  const netAmountWidth = doc.widthOfString(netAmountText);
  const netAmountX = contentLeft + netW - 8 - netAmountWidth;
  const netAmountY = y + Math.max(6, (netH - doc.currentLineHeight()) / 2);
  doc.fillColor('#ffffff').text(netAmountText, netAmountX, netAmountY, { lineBreak: false });
  y += netH + 8;

  const netInWords = `${toIndianWords(salaryData?.net_salary)} Rupees Only`;
  const wordsText = `Net Salary (in words): ${netInWords}`;
  const disclaimerText = '**** This is a computer-generated payslip and does not require a signature. ****';
  const wordsFontSize = 9.5;
  const disclaimerFontSize = 8.4;
  const safeBottomY = hasLetterheadBg() ? (doc.page.height - 74) : (doc.page.height - 44);

  // Keep final block on the same page by calculating required vertical space up-front.
  doc.font('Helvetica').fontSize(wordsFontSize);
  const wordsHeight = doc.heightOfString(wordsText, { width: contentWidth - 4, align: 'left' });
  doc.font('Helvetica-Bold').fontSize(disclaimerFontSize);
  const disclaimerHeight = doc.currentLineHeight();
  const neededFooterBlock = 8 + wordsHeight + 8 + 8 + disclaimerHeight;
  if (y + neededFooterBlock > safeBottomY) {
    y = Math.max(startY + 12, safeBottomY - neededFooterBlock);
  }

  doc.moveTo(contentLeft, y).lineTo(contentRight, y).strokeColor(line).lineWidth(0.8).stroke();
  y += 8;
  doc.fillColor('#111827').font('Helvetica').fontSize(wordsFontSize).text(wordsText, contentLeft + 2, y, {
    width: contentWidth - 4,
    align: 'left',
  });
  y += wordsHeight + 8;
  doc.moveTo(contentLeft, y).lineTo(contentRight, y).strokeColor(line).lineWidth(0.8).stroke();
  y += 8;

  // Draw disclaimer as a single line (no wrapping) to avoid forced page break.
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(disclaimerFontSize);
  const disclaimerWidth = doc.widthOfString(disclaimerText);
  const disclaimerX = contentLeft + Math.max(0, (contentWidth - disclaimerWidth) / 2);
  doc.text(disclaimerText, disclaimerX, y, { lineBreak: false });

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
  const navy = '#0f2f59';
  const blue = '#15508f';
  const gray = '#6b7280';
  const border = '#e5e7eb';

  const fmtDate = (v) => {
    if (!v) return 'N/A';
    try {
      const d = v instanceof Date ? v : new Date(v);
      if (Number.isNaN(d.getTime())) return String(v) || 'N/A';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return 'N/A'; }
  };

  const fmtMoney = (v) =>
    `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const pageBreak = (needed = 0) => {
    const maxY = doc.page.height - (doc.page.margins.bottom || 60);
    if (doc.y + needed > maxY) {
      doc.addPage();
      doc.y = hasLetterheadBg() ? LETTERHEAD_CONTENT_START_Y : CONTENT_START_Y;
    }
  };

  // --- HEADER SECTION ---
  doc.y = startY + 10;
  const col1 = margin;
  const col2 = margin + (right - margin) / 2;

  // Invoice Details (Left)
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(14).text('INVOICE DETAILS', col1);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151');
  doc.text('Invoice No:', col1, doc.y, { continued: true }).font('Helvetica').text(`  ${invoice.invoice_number || 'N/A'}`);
  doc.font('Helvetica-Bold').text('Issue Date:', col1, doc.y, { continued: true }).font('Helvetica').text(`  ${fmtDate(invoice.issue_date)}`);
  doc.font('Helvetica-Bold').text('Due Date:', col1, doc.y, { continued: true }).font('Helvetica').text(`  ${fmtDate(invoice.due_date)}`);

  // Bill To (Right)
  doc.y = startY + 10;
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(14).text('BILL TO', col2);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827');
  doc.text(invoice.company_name || invoice.client_name || 'Valued Client', col2);
  doc.font('Helvetica').fontSize(10).fillColor('#4b5563');
  if (invoice.contact_person) doc.text(`Attn: ${invoice.contact_person}`, col2);
  if (invoice.company_phone || invoice.phone) doc.text(`Phone: ${invoice.company_phone || invoice.phone}`, col2);
  if (invoice.company_email || invoice.email) doc.text(`Email: ${invoice.company_email || invoice.email}`, col2);

  doc.moveDown(2.5);
  const tableTop = doc.y + 10;
  
  // --- ITEMS TABLE ---
  const tableWidth = right - margin;
  const colWidths = {
    name: tableWidth * 0.45,
    qty: tableWidth * 0.1,
    rate: tableWidth * 0.2,
    total: tableWidth * 0.25
  };

  const xName = margin;
  const xQty = xName + colWidths.name;
  const xRate = xQty + colWidths.qty;
  const xTotal = xRate + colWidths.rate;

  // Header Row
  doc.rect(margin, tableTop, tableWidth, 25).fillColor(blue).fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
  doc.text('DESCRIPTION', xName + 10, tableTop + 8);
  doc.text('QTY', xQty, tableTop + 8, { width: colWidths.qty, align: 'center' });
  doc.text('UNIT PRICE', xRate, tableTop + 8, { width: colWidths.rate, align: 'right' });
  doc.text('TOTAL', xTotal - 10, tableTop + 8, { width: colWidths.total, align: 'right' });

  doc.y = tableTop + 25;
  const itemsList = Array.isArray(items) ? items : [];
  
  itemsList.forEach((item, index) => {
    const itemH = item.description ? 35 : 25;
    pageBreak(itemH + 10);
    
    const currentY = doc.y;
    // Row background (alternate)
    if (index % 2 === 1) {
      doc.rect(margin, currentY, tableWidth, itemH).fillColor('#f9fafb').fill();
    }
    
    doc.fillColor('#111827').font('Helvetica').fontSize(10);
    doc.text(item.item_name || 'Item', xName + 10, currentY + 7, { width: colWidths.name - 15 });
    if (item.description) {
      doc.fontSize(8).fillColor(gray).text(item.description, xName + 10, currentY + 20, { width: colWidths.name - 15 });
    }
    
    doc.fontSize(10).fillColor('#111827');
    doc.text(String(item.quantity || 0), xQty, currentY + 7, { width: colWidths.qty, align: 'center' });
    doc.text(fmtMoney(item.unit_price || 0), xRate, currentY + 7, { width: colWidths.rate, align: 'right' });
    doc.font('Helvetica-Bold').text(fmtMoney(item.total_price || (item.quantity * item.unit_price)), xTotal - 10, currentY + 7, { width: colWidths.total, align: 'right' });
    
    doc.y = currentY + itemH;
    // Bottom border for row
    doc.moveTo(margin, doc.y).lineTo(right, doc.y).strokeColor(border).lineWidth(0.5).stroke();
  });

  // --- SUMMARY SECTION ---
  doc.moveDown(1.5);
  pageBreak(120);
  const summaryW = 200;
  const summaryX = right - summaryW;

  const row = (label, value, isTotal = false) => {
    const h = isTotal ? 30 : 20;
    if (isTotal) {
      doc.rect(summaryX, doc.y, summaryW, h).fillColor(blue).fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12);
    } else {
      doc.fillColor('#4b5563').font('Helvetica').fontSize(10);
    }
    
    doc.text(label, summaryX + 10, doc.y + (isTotal ? 8 : 4));
    doc.text(value, summaryX, doc.y + (isTotal ? 8 : 4), { width: summaryW - 10, align: 'right' });
    doc.y += h;
    if (!isTotal) {
      doc.moveTo(summaryX, doc.y).lineTo(right, doc.y).strokeColor(border).lineWidth(0.5).stroke();
    }
  };

  row('Subtotal', fmtMoney(invoice.subtotal));
  if (invoice.discount_amount > 0) row(`Discount (${invoice.discount_percentage}%)`, `- ${fmtMoney(invoice.discount_amount)}`);
  if (invoice.tax_amount > 0) row(`GST (${invoice.tax_percentage}%)`, `+ ${fmtMoney(invoice.tax_amount)}`);
  if (invoice.tds_amount > 0) row(`TDS (${invoice.tds_percentage}%)`, `- ${fmtMoney(invoice.tds_amount)}`);
  row('TOTAL AMOUNT', fmtMoney(invoice.total_amount), true);

  // --- FOOTER INFO ---
  doc.moveDown(2);
  if (invoice.notes || invoice.payment_terms) {
    pageBreak(80);
    const infoW = (right - margin) * 0.6;
    doc.x = margin;
    
    if (invoice.notes) {
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text('NOTES:');
      doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text(invoice.notes, { width: infoW });
      doc.moveDown(1);
    }
    
    if (invoice.payment_terms) {
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text('PAYMENT TERMS:');
      doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text(invoice.payment_terms, { width: infoW });
    }
  }

  // --- THANK YOU ---
  doc.y = doc.page.height - (hasLetterheadBg() ? 140 : 100);
  doc.fillColor(blue).font('Helvetica-Bold').fontSize(12).text('Thank you for your business!', margin, doc.y, { align: 'center', width: pageWidth - 2 * margin });

  if (!hasLetterheadBg()) addFooter(doc);
  return bufferFromDoc(doc);
}

module.exports = {
  generateOfferLetter,
  generateExperienceLetter,
  generateFullAndFinalLetter,
  generateJoiningForm,
  generateSalarySlip,
  generateInvoice,
};
