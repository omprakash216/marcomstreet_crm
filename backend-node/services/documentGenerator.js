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
const hasLogo = () => fs.existsSync(LOGO_PATH);

const CONTENT_START_Y = 153;
const FOOTER_HEIGHT = 50;
const MARGIN_X = 50;

function createDoc() {
  const doc = new PDFDocument({
    margin: 0,
    size: 'A4',
    bufferPages: true,
  });
  doc.page.margins = { top: 0, bottom: FOOTER_HEIGHT + 20, left: MARGIN_X, right: MARGIN_X };
  return doc;
}

function addLetterhead(doc, title) {
  const pageWidth = doc.page.width;
  const margin = MARGIN_X;
  let y = 0;

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

function setupPageAddedListener(doc, title) {
  doc.on('pageAdded', () => {
    addLetterhead(doc, title);
    addFooter(doc);
    doc.y = CONTENT_START_Y;
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
  addFooter(doc);
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
  addFooter(doc);
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
  addFooter(doc);
  return bufferFromDoc(doc);
}

async function generateSalarySlip(employeeData, salaryData) {
  const doc = createDoc();
  setupPageAddedListener(doc, 'SALARY SLIP');
  const startY = addLetterhead(doc, 'SALARY SLIP');
  doc.y = startY;
  doc.x = MARGIN_X;
  doc.fontSize(10).font('Helvetica').fillColor('#1f2937');
  doc.text(`Employee: ${employeeData.name} (${employeeData.employee_code || 'N/A'})`);
  doc.text(`Department: ${employeeData.department || 'N/A'}`);
  doc.text(`Month: ${salaryData.pay_period_start || ''} to ${salaryData.pay_period_end || ''}`);
  doc.moveDown(1);
  doc.font('Helvetica-Bold').text('Earnings');
  doc.font('Helvetica');
  doc.text(`Basic Salary:     ₹ ${salaryData.basic_salary}`);
  doc.text(`HRA:               ₹ ${salaryData.hra}`);
  doc.text(`Conveyance:        ₹ ${salaryData.conveyance_allowance}`);
  doc.text(`Medical:           ₹ ${salaryData.medical_allowance}`);
  doc.text(`Special Allowance: ₹ ${salaryData.special_allowance}`);
  doc.text(`Other Allowances:  ₹ ${salaryData.other_allowances}`);
  doc.text(`Gross Salary:      ₹ ${salaryData.gross_salary}`);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text('Deductions');
  doc.font('Helvetica');
  doc.text(`PF:                 ₹ ${salaryData.pf_deduction}`);
  doc.text(`ESI:                ₹ ${salaryData.esi_deduction}`);
  doc.text(`Tax:                ₹ ${salaryData.tax_deduction}`);
  doc.text(`Professional Tax:   ₹ ${salaryData.professional_tax}`);
  doc.text(`Other:              ₹ ${salaryData.other_deductions}`);
  doc.text(`Total Deductions:   ₹ ${salaryData.total_deductions}`);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text(`Net Salary: ₹ ${salaryData.net_salary}`);
  addFooter(doc);
  return bufferFromDoc(doc);
}

module.exports = {
  generateOfferLetter,
  generateExperienceLetter,
  generateJoiningForm,
  generateSalarySlip,
};
