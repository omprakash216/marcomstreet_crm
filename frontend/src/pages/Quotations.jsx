import { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';
import { generateQuotationPdf } from '../utils/quotationPdf';

function isManagerOrAdmin(employee) {
  const role = (employee?.role || '').toLowerCase();
  return role === 'manager' || role === 'admin' || role === 'superadmin' || role === 'super_admin';
}

function createDefaultItem() {
  return { item_name: '', description: '', quantity: 1, unit_price: 0 };
}

function createDefaultQuotationForm() {
  return {
    lead_id: '',
    items: [createDefaultItem()],
    tax_percentage: 10,
    discount_percentage: 0,
    valid_until: '',
    notes: '',
    terms_conditions: '',
    send_for_approval: false,
  };
}

function normalizeQuotationItem(item) {
  const quantity = Number(item?.quantity);
  const unitPrice = Number(item?.unit_price);
  return {
    item_name: item?.item_name ?? '',
    description: item?.description ?? '',
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
  };
}

function normalizeQuotationForForm(quotation) {
  const rawItems = Array.isArray(quotation?.items) ? quotation.items : [];
  return {
    ...createDefaultQuotationForm(),
    ...quotation,
    lead_id: quotation?.lead_id ?? '',
    tax_percentage: quotation?.tax_percentage ?? 10,
    discount_percentage: quotation?.discount_percentage ?? 0,
    valid_until: quotation?.valid_until ?? '',
    notes: quotation?.notes ?? '',
    terms_conditions: quotation?.terms_conditions ?? '',
    send_for_approval: false,
    items: rawItems.length ? rawItems.map(normalizeQuotationItem) : [createDefaultItem()],
  };
}

function formatPercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  return Number.isInteger(numericValue)
    ? `${numericValue}`
    : numericValue.toFixed(2).replace(/\.?0+$/, '');
}

function splitTaxEvenly(totalTaxAmount, taxPercentage) {
  const safeTaxAmount = Math.max(0, Math.round(Number(totalTaxAmount) || 0));
  const safeTaxPercentage = Math.max(0, Number(taxPercentage) || 0);
  const cgstAmount = Math.floor(safeTaxAmount / 2);
  const sgstAmount = safeTaxAmount - cgstAmount;
  const halfPercentage = safeTaxPercentage / 2;

  return {
    cgstAmount,
    sgstAmount,
    cgstPercentage: halfPercentage,
    sgstPercentage: halfPercentage,
  };
}

export default function Quotations() {
  const employee = getEmployee();
  const canApprove = isManagerOrAdmin(employee);
  const [quotations, setQuotations] = useState([]);
  const [pendingQuotations, setPendingQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsLoadError, setLeadsLoadError] = useState('');
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    status: '',
  });
  const [formData, setFormData] = useState(createDefaultQuotationForm);
  const [quotationSettings, setQuotationSettings] = useState({});

  const uploadsBase = useMemo(() => {
    const base = api.defaults.baseURL || '';
    return base.replace(/\/api\/?$/, '');
  }, []);

  const quotationPdfSettings = useMemo(() => ({
    ...quotationSettings,
    logo_url: quotationSettings.logo_path ? `${uploadsBase}/${quotationSettings.logo_path}` : '',
  }), [quotationSettings, uploadsBase]);

  useEffect(() => {
    fetchQuotations();
    fetchLeads();
    fetchQuotationSettings();
    if (canApprove) fetchPendingQuotations();
  }, [canApprove]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchQuotations();
  }, [filters]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(quotations.length / itemsPerPage));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [quotations]);

  const fetchPendingQuotations = async () => {
    const token = localStorage.getItem('token');
    if (!token || !canApprove) return;
    try {
      const response = await api.get('/quotations?pending_approval=1');
      setPendingQuotations(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (e) {
      if (e.response?.status !== 401 && e.code !== 'ERR_NETWORK') console.error('Pending quotations:', e);
      setPendingQuotations([]);
    }
  };

  const fetchQuotationSettings = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await api.get('/quotations/template-settings');
      if (response.data?.success) {
        setQuotationSettings(response.data.data || {});
      }
    } catch (error) {
      setQuotationSettings({});
    }
  };

  const fetchQuotations = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setQuotations([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.status) params.append('status', filters.status);

      const response = await api.get(`/quotations?${params.toString()}`);
      setQuotations(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching quotations:', error);
      }
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  const normalizeLeadOptions = (items) => {
    const mapped = (Array.isArray(items) ? items : [])
      .map((lead) => {
        const id = Number(lead?.id);
        if (!Number.isFinite(id) || id <= 0) return null;
        const companyName = String(lead?.company_name || lead?.company || lead?.name || '').trim();
        const contactPerson = String(lead?.contact_person || lead?.contact || lead?.owner_name || '').trim();
        return {
          id,
          company_name: companyName || `Lead #${id}`,
          contact_person: contactPerson || 'No Contact',
        };
      })
      .filter(Boolean);

    const seen = new Set();
    return mapped.filter((lead) => {
      if (seen.has(lead.id)) return false;
      seen.add(lead.id);
      return true;
    });
  };

  const fetchLeads = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLeads([]);
      setLeadsLoadError('');
      return;
    }

    setLeadsLoading(true);
    setLeadsLoadError('');
    try {
      const response = await api.get('/leads', { params: { page: 1, limit: 500 } });
      let nextLeads = normalizeLeadOptions(response?.data?.data);

      // Fallback for setups where /leads is empty or has schema issues.
      if (nextLeads.length === 0 && employee?.company_id) {
        const fallbackResponse = await api.get(`/companies/${employee.company_id}/leads`);
        nextLeads = normalizeLeadOptions(fallbackResponse?.data?.data);
      }

      setLeads(nextLeads);
      if (nextLeads.length === 0) {
        setLeadsLoadError('No client entries found. Please create a lead first.');
      }
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching leads:', error);
      }
      setLeadsLoadError(error.response?.data?.message || 'Unable to load client entries.');
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const clearFilters = () => {
    setFilters({
      date_from: '',
      date_to: '',
      status: '',
    });
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, createDefaultItem()],
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    setFormData({ ...formData, items: newItems });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
    const discount = (subtotal * (formData.discount_percentage || 0)) / 100;
    const taxableAmount = subtotal - discount;
    const tax = Math.round((taxableAmount * (formData.tax_percentage || 0)) / 100);
    const grandTotal = Math.round(taxableAmount + tax);
    const taxSplit = splitTaxEvenly(tax, formData.tax_percentage || 0);

    return {
      subtotal: Math.round(subtotal),
      discount: Math.round(discount),
      tax,
      grandTotal,
      cgstAmount: taxSplit.cgstAmount,
      sgstAmount: taxSplit.sgstAmount,
      cgstPercentage: taxSplit.cgstPercentage,
      sgstPercentage: taxSplit.sgstPercentage,
    };
  };

  const totals = calculateTotals();

  // Helper to handle numeric inputs - supports integers and decimals
  const handleNumericInput = (value, setter, field, isItem = false, index = null) => {
    // Allow empty string during typing
    if (value === '' || value === '-') {
      if (isItem) handleItemChange(index, field, 0);
      else setFormData(prev => ({ ...prev, [field]: 0 }));
      return;
    }
    // For unit_price use parseFloat to allow decimals, else parseInt
    const parsed = field === 'unit_price' ? parseFloat(value) : parseInt(value, 10);
    const finalValue = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    if (isItem) handleItemChange(index, field, finalValue);
    else setFormData(prev => ({ ...prev, [field]: finalValue }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate items
    const invalidItems = formData.items.filter(item =>
      !item.item_name || !item.quantity || item.quantity <= 0 || !item.unit_price || item.unit_price <= 0
    );

    if (invalidItems.length > 0) {
      alert('Please fill all required item fields (Name, Quantity > 0, Unit Price > 0)');
      return;
    }

    try {
      const payload = {
        ...formData,
        send_for_approval: !!formData.send_for_approval,
        issue_date: formData.issue_date || new Date().toISOString().slice(0, 10),
      };
      await api.post('/quotations', payload);
      setShowModal(false);
      setFormData(createDefaultQuotationForm());
      fetchQuotations();
      if (canApprove) fetchPendingQuotations();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create quotation');
    }
  };

  const handleSendForApproval = async (id) => {
    try {
      await api.put(`/quotations/${id}/send`);
      fetchQuotations();
      if (canApprove) fetchPendingQuotations();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to send for approval');
    }
  };

  const handleApprove = async (id, status) => {
    try {
      await api.put(`/quotations/${id}/approve`, { status });
      fetchQuotations();
      fetchPendingQuotations();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update quotation');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quotation? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete('/quotations', { data: { id } });
      if (response.data.success) {
        alert('Quotation deleted successfully');
        fetchQuotations();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete quotation');
    }
  };

  const downloadQuotationPDF = async (quotation) => {
    // Fetch full quotation (includes items array)
    let q = quotation;
    try {
      const res = await api.get(`/quotations/${quotation.id}`);
      q = res.data?.data || res.data || quotation;
    } catch (_) {}

    try {
      await generateQuotationPdf(q, quotationPdfSettings);
    } catch (error) {
      console.error('Quotation PDF error:', error);
      alert('Quotation PDF generate nahi ho paya');
    }
    return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;   // A4 width in mm
    const pageH = 297;   // A4 height in mm
    const ml = 14;       // left margin
    const mr = 14;       // right margin
    const cW = pageW - ml - mr; // 182mm content width
    const INR = (n) => `Rs. ${Math.round(n || 0).toLocaleString('en-IN')}`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

    // ─── HEADER BAND ───────────────────────────────────────────────────
    doc.setFillColor(30, 64, 175);            // deep blue
    doc.rect(0, 0, pageW, 46, 'F');
    // thin accent stripe
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 46, pageW, 2, 'F');

    // Logo (vg.png — square, fits nicely)
    try { doc.addImage(vgLogo, 'PNG', ml, 7, 30, 30); } catch (_) {}

    // Company text
    const tx = ml + 35;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text('MARCOM STREET', tx, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(186, 214, 255);
    doc.text('Marketing & Creative Solutions', tx, 25);
    doc.text('www.marcomstreet.com  |  info@marcomstreet.com', tx, 31);

    // QUOTATION label – right side, safely inside margin
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(255, 255, 255);
    doc.text('QUOTATION', pageW - mr, 20, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(186, 214, 255);
    doc.text(q.quotation_number || '', pageW - mr, 28, { align: 'right' });

    // ─── INFO BLOCK ────────────────────────────────────────────────────
    const infoY = 56;

    // LEFT: Billed To (occupies left ~40% = 73mm)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text('BILLED TO', ml, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(q.company_name || 'N/A', ml, infoY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(q.contact_person || '', ml, infoY + 13);

    // RIGHT: 3 sub-columns that fit exactly in the right 60% of the page
    // Available right zone: from x=87 to x=196 (109mm wide)
    // Sub-col widths: ISSUE DATE 42mm | VALID UNTIL 42mm | STATUS 25mm
    const rc1 = 87;   // issue date
    const rc2 = 129;  // valid until
    const rc3 = 171;  // status (badge width 22mm → ends at 193 < 196 ✓)

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text('ISSUE DATE',  rc1, infoY);
    doc.text('VALID UNTIL', rc2, infoY);
    doc.text('STATUS',      rc3, infoY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(fmtDate(q.issue_date),  rc1, infoY + 7);
    doc.text(fmtDate(q.valid_until), rc2, infoY + 7);

    // Status badge
    const statusClr = { draft:[107,114,128], sent:[37,99,235], accepted:[22,163,74], rejected:[220,38,38], expired:[202,138,4] };
    const sc = statusClr[q.status] || [107, 114, 128];
    doc.setFillColor(...sc);
    doc.roundedRect(rc3, infoY + 1, 22, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text((q.status || '').toUpperCase(), rc3 + 11, infoY + 6.5, { align: 'center' });

    // Divider
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.4);
    doc.line(ml, infoY + 20, pageW - mr, infoY + 20);

    // ─── ITEMS TABLE ───────────────────────────────────────────────────
    const items = Array.isArray(q.items) ? q.items : [];
    const tableBody = items.map((item, i) => [
      i + 1,
      item.item_name || '',
      item.description || '',
      item.quantity || 1,
      INR(item.unit_price || 0),
      INR((item.quantity || 1) * (item.unit_price || 0)),
    ]);

    // Column widths must sum to cW = 182
    autoTable(doc, {
      startY: infoY + 24,
      margin: { left: ml, right: mr },
      head: [['#', 'Item / Service', 'Description', 'Qty', 'Unit Price', 'Total']],
      body: tableBody.length > 0 ? tableBody : [['', 'No items', '', '', '', '']],
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      },
      bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30], cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { fontStyle: 'bold', cellWidth: 42 },
        2: { cellWidth: 62, textColor: [90, 90, 90] },
        3: { halign: 'center', cellWidth: 12 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
      },
    });

    // ─── TOTALS BLOCK ──────────────────────────────────────────────────
    const tY = doc.lastAutoTable.finalY + 8;
    // Box occupies the right 82mm → x from (pageW-mr-82)=114 to x=196
    const boxX = pageW - mr - 82;
    const boxW = 82;
    const rH = 7.5;

    const subtotal  = Math.round(q.subtotal || 0);
    const discount  = Math.round(q.discount_amount || 0);
    const tax       = Math.round(q.tax_amount || 0);
    const grandTotal= Math.round(q.total_amount || 0);
    const discPct   = q.discount_percentage || 0;
    const taxPct    = q.tax_percentage || 0;

    const taxSplit = splitTaxEvenly(tax, taxPct);
    const numRows = 5;

    // Subtle bg behind the totals rows
    doc.setFillColor(248, 249, 253);
    doc.roundedRect(boxX, tY - 3, boxW, rH * numRows + 2, 2, 2, 'F');

    const drawRow = (label, value, y, bold = false, highlight = false) => {
      if (highlight) {
        doc.setFillColor(30, 64, 175);
        doc.roundedRect(boxX, y - 4.5, boxW, rH + 1, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setTextColor(bold ? 25 : 100, bold ? 25 : 100, bold ? 25 : 100);
      }
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(highlight ? 9.5 : 8.5);
      doc.text(label, boxX + 3, y);
      doc.text(value, boxX + boxW - 3, y, { align: 'right' });
    };

    drawRow('Subtotal',              INR(subtotal),             tY);
    drawRow(`Discount (${discPct}%)`,`- ${INR(discount)}`,      tY + rH);
    drawRow(`CGST (${formatPercent(taxSplit.cgstPercentage)}%)`, `+ ${INR(taxSplit.cgstAmount)}`, tY + rH * 2);
    drawRow(`SGST (${formatPercent(taxSplit.sgstPercentage)}%)`, `+ ${INR(taxSplit.sgstAmount)}`, tY + rH * 3);
    drawRow(`Tax (${formatPercent(taxPct)}%)`, `+ ${INR(tax)}`, tY + rH * 4);
    doc.setDrawColor(200, 205, 220);
    doc.setLineWidth(0.35);
    doc.line(boxX, tY + rH * numRows - 1, boxX + boxW, tY + rH * numRows - 1);
    drawRow('GRAND TOTAL',           INR(grandTotal),           tY + rH * numRows + 4, true, true);

    // ─── NOTES & TERMS ─────────────────────────────────────────────────
    const ntY = tY + rH * (numRows + 1) + 14;
    if (q.notes || q.terms_conditions) {
      doc.setDrawColor(220, 225, 235);
      doc.setLineWidth(0.4);
      doc.line(ml, ntY - 3, pageW - mr, ntY - 3);
      const halfCW = cW / 2 - 4;
      if (q.notes) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(60, 60, 60);
        doc.text('NOTES', ml, ntY + 2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(90, 90, 90);
        doc.text(doc.splitTextToSize(q.notes, halfCW), ml, ntY + 8);
      }
      if (q.terms_conditions) {
        const termsX = ml + cW / 2 + 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(60, 60, 60);
        doc.text('TERMS & CONDITIONS', termsX, ntY + 2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(90, 90, 90);
        doc.text(doc.splitTextToSize(q.terms_conditions, halfCW), termsX, ntY + 8);
      }
    }

    // ─── FOOTER BAND ───────────────────────────────────────────────────
    doc.setFillColor(30, 64, 175);
    doc.rect(0, pageH - 14, pageW, 14, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(186, 214, 255);
    doc.text(
      'Thank you for your business!  This quotation is computer-generated and valid until the date shown above.',
      pageW / 2, pageH - 5.5, { align: 'center' }
    );

    doc.save(`Quotation-${q.quotation_number || q.id}.pdf`);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentQuotations = quotations.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="relative">
      {/* Professional Header Section */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left Side - Title and Icon */}
            <div className="flex items-center space-x-4">
              {/* Icon */}
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              {/* Title and Description */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-1">Quotations</h1>
                <p className="text-slate-300 text-sm">Create and manage quotations for your clients</p>
              </div>
            </div>

            {/* Right Side - Action Button */}
            <button
              onClick={() => {
                setFormData(createDefaultQuotationForm());
                fetchLeads();
                setShowModal(true);
              }}
              className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl hover:bg-slate-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Quotation</span>
            </button>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
      </div>

      {/* Pending approval (manager/admin only) */}
      {canApprove && pendingQuotations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl shadow-sm p-4 mb-6">
          <h2 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <i className="fas fa-clock text-blue-600"></i>
            Pending your approval
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-blue-100">
              <thead className="bg-blue-100/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-blue-800 uppercase">Quotation</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-blue-800 uppercase">Company</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-blue-800 uppercase">Amount</th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-blue-800 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100">
                {pendingQuotations.map((q) => (
                  <tr key={q.id} className="hover:bg-blue-50/50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{q.quotation_number}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{q.company_name}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium">₹{Math.round(q.total_amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(q.id, 'accepted')}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApprove(q.id, 'rejected')}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              <i className="fas fa-calendar-alt text-blue-500 w-4 text-center"></i>
              <span>Issue Period From</span>
            </label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>
          <div>
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              <i className="fas fa-calendar-check text-blue-500 w-4 text-center"></i>
              <span>Issue Period To</span>
            </label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>
          <div>
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              <i className="fas fa-info-circle text-blue-500 w-4 text-center"></i>
              <span>Lifecycle Status</span>
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            >
              <option value="">All Revenue States</option>
              <option value="draft">Draft Proposal</option>
              <option value="sent">Dispatched / Sent</option>
              <option value="accepted">Accepted / Won</option>
              <option value="rejected">Rejected / Lost</option>
              <option value="expired">Link Expired</option>
            </select>
          </div>
          <button
            onClick={clearFilters}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
          >
            Reset Metrics
          </button>
        </div>
      </div>

      {/* Quotations List */}
      {loading ? (
        <div className="bg-white rounded-[1.5rem] p-12 text-center border border-gray-100 shadow-md">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Retrieving Financial Records...</p>
        </div>
      ) : quotations.length === 0 ? (
        <div className="bg-white rounded-[1.5rem] p-12 text-center border border-gray-100 shadow-md">
          <div className="text-5xl mb-4 opacity-20">📄</div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">No active quotations found</h3>
          <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">Analyze your sales pipeline and initialize your first professional quotation proposal.</p>
          <button
            onClick={() => {
              setFormData(createDefaultQuotationForm());
              fetchLeads();
              setShowModal(true);
            }}
            className="px-6 py-3 bg-[#244bd8] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
          >
            Initialize Proposal
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">SL No</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Quotation ID</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Company & Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Issue Date</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Valid Until</th>
                  <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentQuotations.map((quotation, index) => (
                  <tr key={quotation.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                      {indexOfFirstItem + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{quotation.quotation_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">{quotation.company_name}</div>
                      <div className="text-xs text-gray-500">{quotation.contact_person}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(quotation.issue_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-gray-900">₹{Math.round(quotation.total_amount || 0).toLocaleString('en-IN')}</div>
                      <div className="text-xs text-gray-500">Subtotal: ₹{Math.round(quotation.subtotal || 0).toLocaleString('en-IN')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(quotation.status)}`}>
                        {quotation.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center flex-wrap gap-2">
                        {quotation.status === 'draft' && (
                          <button
                            onClick={() => handleSendForApproval(quotation.id)}
                            className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                            title="Send for manager approval"
                          >
                            Send for approval
                          </button>
                        )}
                        <button
                          onClick={() => downloadQuotationPDF(quotation)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="Download PDF"
                        >
                          <i className="fas fa-file-pdf"></i>
                        </button>
                        <button
                          onClick={() => {
                            setFormData(normalizeQuotationForForm(quotation));
                            fetchLeads();
                            setShowModal(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors"
                          title="Edit Quotation"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(quotation.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="Delete Quotation"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination Footer */}
          {quotations.length > itemsPerPage && (
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                Showing <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-bold text-slate-800">{Math.min(indexOfLastItem, quotations.length)}</span> of{' '}
                <span className="font-bold text-slate-800">{quotations.length}</span> entries
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    currentPage === 1
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95'
                  }`}
                >
                  <i className="fas fa-chevron-left mr-1"></i> Prev
                </button>

                {Array.from({ length: Math.ceil(quotations.length / itemsPerPage) }).map((_, i) => {
                  const pageNum = i + 1;
                  const isSelected = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(quotations.length / itemsPerPage)))}
                  disabled={currentPage === Math.ceil(quotations.length / itemsPerPage)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    currentPage === Math.ceil(quotations.length / itemsPerPage)
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95'
                  }`}
                >
                  Next <i className="fas fa-chevron-right ml-1"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Quotation Modal */}
      {showModal && (
        <div className="absolute inset-0 z-[90] flex items-start justify-center p-3 sm:p-4 md:p-6 bg-transparent overflow-y-auto">
          <div className="bg-white rounded-[1.5rem] w-full max-w-5xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-200 flex flex-col max-h-[calc(100vh-8rem)]">
            <div className="bg-[#244bd8] p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                  <i className="fas fa-file-invoice text-xl"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Draft Commercial Quotation</h2>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">Fiscal Asset Management System</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
              {/* Top Configuration Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 focus-within:text-blue-600 transition-colors">
                    <i className="fas fa-building text-blue-500 w-4 text-center"></i>
                    <span>Target Client Entity</span>
                  </label>
                  <select
                    value={formData.lead_id ?? ''}
                    onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                    disabled={leadsLoading}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                  >
                    <option value="">
                      {leadsLoading ? 'Loading client entries...' : 'Independent Quotation (No Lead)'}
                    </option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.company_name} - {lead.contact_person}
                      </option>
                    ))}
                  </select>
                  {!!leadsLoadError && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-[11px] font-semibold text-amber-800">{leadsLoadError}</p>
                      <button
                        type="button"
                        onClick={fetchLeads}
                        className="px-2.5 py-1 rounded-md bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-amber-700"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    <i className="fas fa-percentage text-blue-500 w-4 text-center"></i>
                    <span>Tax (GST %)</span>
                  </label>
                  <select
                    value={formData.tax_percentage ?? 0}
                    onChange={(e) => setFormData({ ...formData, tax_percentage: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                  >
                    <option value={0}>0% — No Tax</option>
                    <option value={5}>5% — GST</option>
                    <option value={9}>9% — CGST/SGST</option>
                    <option value={12}>12% — GST</option>
                    <option value={18}>18% — GST (Standard)</option>
                    <option value={28}>28% — GST (Luxury)</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 text-slate-500">
                    <i className="fas fa-tag text-blue-500 w-4 text-center"></i>
                    <span>Discount (%)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount_percentage === 0 ? '' : formData.discount_percentage}
                    placeholder="0"
                    onChange={(e) => handleNumericInput(e.target.value, setFormData, 'discount_percentage')}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-[13px]"
                  />
                </div>
              </div>

              {/* Dynamic Items Builder */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <i className="fas fa-list-ol text-blue-500 w-4 text-center"></i>
                    <span>Commercial Line Items *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center px-4 py-1.5 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-100 shadow-sm"
                  >
                    <i className="fas fa-plus mr-2"></i>Add Line Item
                  </button>
                </div>

                {/* Items header row */}
                <div className="flex items-center gap-2 px-3 pb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="flex-[2] min-w-0">Item Name</div>
                  <div className="flex-[3] min-w-0">Description</div>
                  <div className="w-20 text-center">Qty</div>
                  <div className="w-28 text-right">Unit Price (₹)</div>
                  <div className="w-24 text-right">Total</div>
                  <div className="w-8"></div>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2.5 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                      {/* Item Name */}
                      <div className="flex-[2] min-w-0">
                        <input
                          type="text"
                          placeholder="Item name *"
                          required
                          value={item.item_name ?? ''}
                          onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all placeholder-slate-400 text-slate-800"
                        />
                      </div>

                      {/* Description */}
                      <div className="flex-[3] min-w-0">
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={item.description ?? ''}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all placeholder-slate-400 text-slate-600"
                        />
                      </div>

                      {/* Quantity */}
                      <input
                        type="number"
                        required
                        min="1"
                        value={item.quantity === 0 ? '' : item.quantity}
                        placeholder="1"
                        onChange={(e) => handleNumericInput(e.target.value, null, 'quantity', true, index)}
                        onFocus={(e) => e.target.select()}
                        className="w-20 text-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                      />

                      {/* Unit Price */}
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={item.unit_price === 0 ? '' : item.unit_price}
                        placeholder="0.00"
                        onChange={(e) => handleNumericInput(e.target.value, null, 'unit_price', true, index)}
                        onFocus={(e) => e.target.select()}
                        className="w-28 text-right bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                      />

                      {/* Line Total */}
                      <div className="w-24 text-right">
                        <span className="text-[13px] font-black text-slate-800">
                          ₹{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Remove button */}
                      <div className="w-8 flex items-center justify-center shrink-0">
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-100"
                            title="Remove item"
                          >
                            <i className="fas fa-times text-[10px]"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strategy & Terms Footer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                <div className="md:col-span-1">
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className="fas fa-history text-blue-500 w-4 text-center"></i>
                    <span>Proposal Validity</span>
                  </label>
                  <input
                    type="date"
                    value={formData.valid_until ?? ''}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-[13px]"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className="fas fa-balance-scale text-blue-500 w-4 text-center"></i>
                    <span>Terms of Agreement</span>
                  </label>
                  <textarea
                    value={formData.terms_conditions ?? ''}
                    onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-[13px] resize-none font-medium"
                    rows="1"
                    placeholder="Payment terms, delivery schedules, etc..."
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    <i className="fas fa-sticky-note text-blue-500 w-4 text-center"></i>
                    <span>Internal Strategic Notes</span>
                  </label>
                  <textarea
                    value={formData.notes ?? ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-[13px] resize-none font-medium"
                    rows="1"
                    placeholder="Market intel, lead urgency, specialized pricing..."
                  />
                </div>
              </div>

              {/* Professional Financial Summary Section */}
              <div className="mt-2.5 flex justify-end">
                <div className="w-full md:w-80 space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-sm text-[13px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Gross Subtotal</span>
                    <span className="font-bold text-slate-900">₹{totals.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Discount ({formatPercent(formData.discount_percentage)}%)</span>
                    <span className="font-bold text-red-500">- ₹{totals.discount.toLocaleString('en-IN')}</span>
                  </div>

                  {Number(formData.tax_percentage || 0) > 0 ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">CGST ({formatPercent(totals.cgstPercentage)}%)</span>
                        <span className="font-bold text-blue-600">+ ₹{totals.cgstAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">SGST ({formatPercent(totals.sgstPercentage)}%)</span>
                        <span className="font-bold text-blue-600">+ ₹{totals.sgstAmount.toLocaleString('en-IN')}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Tax (0%)</span>
                      <span className="font-bold text-slate-400">+ ₹0</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Net Payable</span>
                    <span className="text-lg font-black text-[#244bd8]">₹{totals.grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Send for approval option */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="send_for_approval"
                  checked={!!formData.send_for_approval}
                  onChange={(e) => setFormData({ ...formData, send_for_approval: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="send_for_approval" className="text-sm font-medium text-slate-700">
                  Save and send for manager approval
                </label>
              </div>
              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-4 pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Discard Draft
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#244bd8] hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <i className="fas fa-paper-plane mr-2 text-[10px]"></i>
                  <span>{formData.send_for_approval ? 'Save & send for approval' : 'Save as draft'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
