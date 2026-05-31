import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_QUOTATION_TEMPLATE, getQuotationTemplate } from '../constants/quotationTemplates';

const TEMPLATE_CONFIG = {
  standard: {
    accent: [15, 47, 110],
    soft: [236, 243, 255],
    title: [12, 18, 32],
    header: 'standard',
  },
  logo_left_details: {
    accent: [18, 63, 186],
    soft: [237, 244, 255],
    title: [18, 63, 186],
    header: 'left',
  },
  logo_center_details: {
    accent: [8, 122, 47],
    soft: [235, 250, 241],
    title: [8, 122, 47],
    header: 'center',
  },
  minimal_clean: {
    accent: [17, 24, 39],
    soft: [245, 245, 245],
    title: [0, 0, 0],
    header: 'minimal',
  },
  corporate_dark: {
    accent: [15, 23, 42],
    soft: [241, 245, 249],
    title: [255, 255, 255],
    header: 'dark',
    darkFooter: true,
  },
  premium_orange: {
    accent: [249, 115, 22],
    soft: [255, 247, 237],
    title: [249, 115, 22],
    header: 'left',
    orangeFooter: true,
  },
  premium_gold: {
    accent: [183, 121, 31],
    soft: [255, 251, 235],
    title: [183, 121, 31],
    header: 'gold',
    goldBorder: true,
  },
};

const A4 = {
  pageW: 210,
  pageH: 297,
  ml: 14,
  mr: 14,
};

const DEFAULT_SETTINGS = {
  company_name: 'Company Name',
  email: '',
  phone: '',
  address: '',
  gst_number: '',
  pan_number: '',
  logo_url: '',
  quotation_template: DEFAULT_QUOTATION_TEMPLATE,
  quotation_header_text: '',
  quotation_footer_text: 'Thank you for your business!',
};

function toRgb(hexOrRgb, fallback = [15, 47, 110]) {
  if (Array.isArray(hexOrRgb)) return hexOrRgb;
  const hex = String(hexOrRgb || '').replace('#', '').trim();
  if (hex.length !== 6) return fallback;
  const value = parseInt(hex, 16);
  if (!Number.isFinite(value)) return fallback;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function formatCurrency(value) {
  return `Rs. ${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, '');
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function splitTaxEvenly(totalTaxAmount, taxPercentage) {
  const safeTaxAmount = Math.max(0, Math.round(Number(totalTaxAmount) || 0));
  const safeTaxPercentage = Math.max(0, Number(taxPercentage) || 0);
  const cgstAmount = Math.floor(safeTaxAmount / 2);
  const sgstAmount = safeTaxAmount - cgstAmount;
  return {
    cgstAmount,
    sgstAmount,
    cgstPercentage: safeTaxPercentage / 2,
    sgstPercentage: safeTaxPercentage / 2,
  };
}

function companyLines(settings) {
  return [
    settings.address,
    settings.phone ? `Phone: ${settings.phone}` : '',
    settings.email ? `Email: ${settings.email}` : '',
    settings.gst_number ? `GSTIN: ${settings.gst_number}` : '',
    settings.pan_number ? `PAN: ${settings.pan_number}` : '',
  ].filter(Boolean);
}

function imageTypeFromDataUrl(dataUrl) {
  if (/^data:image\/jpe?g/i.test(dataUrl)) return 'JPEG';
  if (/^data:image\/webp/i.test(dataUrl)) return 'WEBP';
  return 'PNG';
}

async function loadLogoDataUrl(url) {
  if (!url) return '';
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return '';
  }
}

function drawLogoSlot(doc, logoDataUrl, x, y, w = 28, h = 18, accent = [15, 47, 110]) {
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, imageTypeFromDataUrl(logoDataUrl), x, y, w, h);
      return;
    } catch (_) {}
  }
  doc.setDrawColor(...accent);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const textColor = accent.every((part) => part > 220) ? [15, 23, 42] : accent;
  doc.setTextColor(...textColor);
  doc.text('LOGO', x + w / 2, y + h / 2 + 2, { align: 'center' });
}

function drawWrappedText(doc, lines, x, y, width, options = {}) {
  const fontSize = options.fontSize || 8;
  const lineHeight = options.lineHeight || 4.5;
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(...(options.color || [75, 85, 99]));
  let currentY = y;
  lines.forEach((line) => {
    const split = doc.splitTextToSize(String(line || ''), width);
    const textX = options.align === 'center' ? x + width / 2 : x;
    if (options.align) {
      doc.text(split, textX, currentY, { align: options.align });
    } else {
      doc.text(split, textX, currentY);
    }
    currentY += Math.max(split.length, 1) * lineHeight;
  });
  return currentY;
}

function drawCompanyBlock(doc, settings, x, y, width, options = {}) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(options.nameSize || 12);
  doc.setTextColor(...(options.nameColor || [17, 24, 39]));
  doc.text(settings.company_name || 'Company Name', options.center ? x + width / 2 : x, y, options.center ? { align: 'center' } : undefined);
  const lines = companyLines(settings);
  return drawWrappedText(doc, lines, x, y + 6, width, {
    fontSize: options.fontSize || 7.5,
    lineHeight: 4,
    color: options.textColor || [75, 85, 99],
    align: options.center ? 'center' : undefined,
  });
}

function drawHeader(doc, q, settings, config, logoDataUrl, meta) {
  const { pageW, ml, mr } = A4;
  const accent = config.accent;
  const headerText = settings.quotation_header_text || '';
  const title = meta.titleUpper;
  const numberText = meta.documentNumber || '';

  if (config.goldBorder) {
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.6);
    doc.rect(8, 8, pageW - 16, 281);
  }

  if (config.header === 'dark') {
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageW, 42, 'F');
    drawLogoSlot(doc, logoDataUrl, ml, 8, 26, 18, [255, 255, 255]);
    drawCompanyBlock(doc, settings, ml + 32, 15, 90, {
      nameSize: 12,
      nameColor: [255, 255, 255],
      textColor: [226, 232, 240],
      fontSize: 7,
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text(title, pageW - mr, 18, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(numberText, pageW - mr, 27, { align: 'right' });
    return 52;
  }

  if (config.header === 'center' || config.header === 'gold') {
    drawLogoSlot(doc, logoDataUrl, pageW / 2 - 14, 10, 28, 18, accent);
    drawCompanyBlock(doc, settings, pageW / 2 - 65, 34, 130, {
      center: true,
      nameColor: [17, 24, 39],
      fontSize: 7,
    });
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.5);
    doc.line(ml, 57, pageW - mr, 57);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(config.header === 'gold' ? 16 : 15);
    doc.setTextColor(...accent);
    doc.text(title, pageW / 2, 67, { align: 'center' });
    if (headerText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(doc.splitTextToSize(headerText, 120), pageW / 2, 73, { align: 'center' });
    }
    return headerText ? 84 : 78;
  }

  if (config.header === 'left') {
    drawLogoSlot(doc, logoDataUrl, ml, 10, 28, 18, accent);
    drawCompanyBlock(doc, settings, ml + 34, 16, 88, {
      nameColor: [17, 24, 39],
      fontSize: 7,
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...accent);
    doc.text(title, pageW - mr, 19, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text(`${meta.numberLabel}: ${numberText}`, pageW - mr, 28, { align: 'right' });
    doc.text(`Date: ${formatDate(q.issue_date)}`, pageW - mr, 34, { align: 'right' });
    doc.setDrawColor(...accent);
    doc.line(ml, 48, pageW - mr, 48);
    return 58;
  }

  if (config.header === 'minimal') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(title, ml, 22);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(ml, 29, pageW - mr, 29);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${meta.numberLabel}: ${numberText}`, pageW - mr, 24, { align: 'right' });
    doc.text(`Date: ${formatDate(q.issue_date)}`, pageW - mr, 31, { align: 'right' });
    return 44;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...accent);
  doc.text(title, ml, 23);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.5);
  doc.line(ml, 31, pageW - mr, 31);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(17, 24, 39);
  doc.text(`${meta.numberLabel}: ${numberText}`, pageW - mr, 24, { align: 'right' });
  doc.text(`Date: ${formatDate(q.issue_date)}`, pageW - mr, 31, { align: 'right' });
  return 45;
}

function drawParties(doc, q, settings, startY) {
  const { pageW, ml, mr } = A4;
  const half = (pageW - ml - mr) / 2 - 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text('From,', ml, startY);
  doc.text('To,', ml + half + 12, startY);

  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text(settings.company_name || 'Company Name', ml, startY + 6);
  doc.text(q.company_name || 'Client Name', ml + half + 12, startY + 6);

  const fromEndY = drawWrappedText(doc, companyLines(settings), ml, startY + 12, half, { fontSize: 7, lineHeight: 3.8 });
  const toEndY = drawWrappedText(doc, [q.contact_person, q.client_address || '', q.client_email || '', q.client_phone || ''].filter(Boolean), ml + half + 12, startY + 12, half, {
    fontSize: 7,
    lineHeight: 3.8,
  });

  return Math.max(startY + 36, fromEndY, toEndY) + 2;
}

function drawTotals(doc, q, config, startY) {
  const { pageW, mr } = A4;
  const accent = config.accent;
  const boxW = 78;
  const x = pageW - mr - boxW;
  const rowH = 7;
  const subtotal = Math.round(Number(q.subtotal) || 0);
  const discount = Math.round(Number(q.discount_amount) || 0);
  const tax = Math.round(Number(q.tax_amount) || 0);
  const total = Math.round(Number(q.total_amount) || 0);
  const taxPct = Number(q.tax_percentage) || 0;
  const discPct = Number(q.discount_percentage) || 0;
  const split = splitTaxEvenly(tax, taxPct);
  const rows = [
    ['Subtotal', formatCurrency(subtotal)],
    [`Discount (${formatPercent(discPct)}%)`, `- ${formatCurrency(discount)}`],
    [`CGST (${formatPercent(split.cgstPercentage)}%)`, `+ ${formatCurrency(split.cgstAmount)}`],
    [`SGST (${formatPercent(split.sgstPercentage)}%)`, `+ ${formatCurrency(split.sgstAmount)}`],
    [`Tax (${formatPercent(taxPct)}%)`, `+ ${formatCurrency(tax)}`],
  ];

  let y = startY;
  doc.setFontSize(8);
  rows.forEach(([label, value]) => {
    doc.setTextColor(55, 65, 81);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 3, y);
    doc.text(value, x + boxW - 3, y, { align: 'right' });
    y += rowH;
  });

  doc.setFillColor(...accent);
  doc.rect(x, y - 4.5, boxW, rowH + 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL', x + 3, y);
  doc.text(formatCurrency(total), x + boxW - 3, y, { align: 'right' });
  return y + 10;
}

function drawFooter(doc, settings, config) {
  const pageCount = doc.getNumberOfPages();
  const { pageW, pageH, ml, mr } = A4;
  const footerText = settings.quotation_footer_text || 'Thank you for your business!';
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (config.darkFooter) {
      doc.setFillColor(...config.accent);
      doc.rect(0, pageH - 18, pageW, 18, 'F');
      doc.setTextColor(226, 232, 240);
    } else if (config.orangeFooter) {
      doc.setFillColor(...config.accent);
      doc.rect(0, pageH - 14, pageW, 14, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setDrawColor(...config.accent);
      doc.line(ml, pageH - 16, pageW - mr, pageH - 16);
      doc.setTextColor(75, 85, 99);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(footerText, pageW - ml - mr), pageW / 2, pageH - 8, { align: 'center' });
  }
}

async function generateDocumentPdf(documentData, rawSettings = {}, options = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...(rawSettings || {}) };
  const template = getQuotationTemplate(settings.quotation_template);
  const config = {
    ...(TEMPLATE_CONFIG[template.key] || TEMPLATE_CONFIG.standard),
    accent: toRgb(TEMPLATE_CONFIG[template.key]?.accent || template.accent),
  };
  const documentTitle = String(options.documentTitle || 'Quotation');
  const documentNumber = options.documentNumber || documentData.quotation_number || documentData.invoice_number || documentData.id || '';
  const meta = {
    documentTitle,
    titleUpper: documentTitle.toUpperCase(),
    numberLabel: options.numberLabel || `${documentTitle} No`,
    filenamePrefix: options.filenamePrefix || documentTitle,
    documentNumber,
  };

  const logoDataUrl = template.key === 'standard' || template.key === 'minimal_clean'
    ? ''
    : await loadLogoDataUrl(settings.logo_url);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { pageW, pageH, ml, mr } = A4;
  const contentW = pageW - ml - mr;

  const startY = drawHeader(doc, documentData, settings, config, logoDataUrl, meta);
  const partiesEndY = drawParties(doc, documentData, settings, startY);

  const items = Array.isArray(documentData.items) ? documentData.items : [];
  const tableBody = items.length
    ? items.map((item, index) => [
        index + 1,
        item.item_name || '',
        item.description || '',
        item.quantity || 1,
        formatCurrency(item.unit_price || 0),
        formatCurrency((Number(item.quantity) || 1) * (Number(item.unit_price) || 0)),
      ])
    : [['', 'No items', '', '', '', '']];

  autoTable(doc, {
    startY: partiesEndY,
    margin: { left: ml, right: mr },
    head: [['#', 'Description', 'Details', 'Qty', 'Rate', 'Amount']],
    body: tableBody,
    headStyles: {
      fillColor: config.accent,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
    },
    bodyStyles: { fontSize: 8, textColor: [31, 41, 55], cellPadding: 2.5 },
    alternateRowStyles: { fillColor: config.soft },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold', cellWidth: 48 },
      2: { cellWidth: 60, textColor: [75, 85, 99] },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
    },
  });

  let y = (doc.lastAutoTable?.finalY || partiesEndY) + 8;
  if (y > pageH - 84) {
    doc.addPage();
    y = 24;
  }

  y = drawTotals(doc, documentData, config, y);

  const notes = documentData.notes || '';
  const terms = documentData.terms_conditions || documentData.payment_terms || '';
  if (notes || terms) {
    const sectionY = Math.min(y + 8, pageH - 54);
    const halfW = contentW / 2 - 5;
    doc.setDrawColor(226, 232, 240);
    doc.line(ml, sectionY - 3, pageW - mr, sectionY - 3);
    if (notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(17, 24, 39);
      doc.text('Notes', ml, sectionY + 2);
      drawWrappedText(doc, [notes], ml, sectionY + 8, halfW, { fontSize: 7.5, lineHeight: 4 });
    }
    if (terms) {
      const termsX = ml + contentW / 2 + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(17, 24, 39);
      doc.text('Terms & Conditions', termsX, sectionY + 2);
      drawWrappedText(doc, [terms], termsX, sectionY + 8, halfW, { fontSize: 7.5, lineHeight: 4 });
    }
  }

  if (config.goldBorder) {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p += 1) {
      doc.setPage(p);
      doc.setDrawColor(...config.accent);
      doc.setLineWidth(0.6);
      doc.rect(8, 8, pageW - 16, pageH - 16);
    }
  }

  drawFooter(doc, settings, config);
  const safeNumber = String(documentNumber || 'download').replace(/[^a-zA-Z0-9._-]/g, '_');
  doc.save(`${meta.filenamePrefix}-${safeNumber}.pdf`);
}

export async function generateQuotationPdf(quotation, rawSettings = {}) {
  return generateDocumentPdf(quotation, rawSettings, {
    documentTitle: 'Quotation',
    numberLabel: 'Quotation No',
    filenamePrefix: 'Quotation',
    documentNumber: quotation.quotation_number || quotation.id,
  });
}

export async function generateInvoicePdf(invoice, rawSettings = {}) {
  const normalizedInvoice = {
    ...invoice,
    quotation_number: invoice.invoice_number || invoice.id,
    valid_until: invoice.due_date || invoice.valid_until,
    terms_conditions: invoice.payment_terms || invoice.terms_conditions || '',
    client_email: invoice.company_email || invoice.email || invoice.client_email || '',
    client_phone: invoice.company_phone || invoice.phone || invoice.client_phone || '',
  };
  return generateDocumentPdf(normalizedInvoice, rawSettings, {
    documentTitle: 'Invoice',
    numberLabel: 'Invoice No',
    filenamePrefix: 'Invoice',
    documentNumber: invoice.invoice_number || invoice.id,
  });
}
