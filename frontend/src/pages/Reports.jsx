import { useState, useEffect } from 'react';
import api from '../utils/api';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    report_type: '',
    date_from: '',
    date_to: '',
    status: '',
  });
  const [formData, setFormData] = useState({
    report_name: '',
    report_type: 'sales',
    date_from: '',
    date_to: '',
    include_leads: true,
    include_meetings: true,
    include_tasks: true,
    include_invoices: true,
    include_quotations: false,
  });

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [filters]);

  const fetchReports = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setReports([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.report_type) params.append('report_type', filters.report_type);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.status) params.append('status', filters.status);

      const response = await api.get(`/reports?${params.toString()}`);
      setReports(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      // Only log unexpected errors
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        console.error('Error fetching reports:', error);
      }
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      report_type: '',
      date_from: '',
      date_to: '',
      status: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/reports/create', formData);
      setShowModal(false);
      setFormData({
        report_name: '',
        report_type: 'sales',
        date_from: '',
        date_to: '',
        include_leads: true,
        include_meetings: true,
        include_tasks: true,
        include_invoices: true,
        include_quotations: false,
      });
      fetchReports();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create report');
    }
  };

  const exportToExcel = async (report) => {
    try {
      const reportData = typeof report.report_data === 'string'
        ? JSON.parse(report.report_data)
        : report.report_data;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'MARCOM CRM';

      const addObjectSheet = (name, rows) => {
        if (!rows || rows.length === 0) return;

        const sheet = workbook.addWorksheet(name);
        const headers = Object.keys(rows[0]);

        sheet.addRow(headers);
        sheet.getRow(1).font = { bold: true };

        rows.forEach((row) => {
          sheet.addRow(headers.map((header) => row[header] ?? ''));
        });

        headers.forEach((header, idx) => {
          const column = sheet.getColumn(idx + 1);
          const longestCell = Math.max(
            header.length,
            ...rows.map((row) => String(row[header] ?? '').length)
          );
          column.width = Math.min(Math.max(longestCell + 2, 12), 40);
        });
      };

      // Add summary sheet
      const summaryData = [
        ['Report Name', report.report_name],
        ['Report Type', report.report_type],
        ['Created Date', new Date(report.created_at).toLocaleString()],
        ['Period', report.date_from && report.date_to
          ? `${new Date(report.date_from).toLocaleDateString()} - ${new Date(report.date_to).toLocaleDateString()}`
          : 'All Time'],
        [''],
        ['Summary'],
        ['Leads', reportData.leads?.length || 0],
        ['Meetings', reportData.meetings?.length || 0],
        ['Tasks', reportData.tasks?.length || 0],
        ['Invoices', reportData.invoices?.length || 0],
        ['Quotations', reportData.quotations?.length || 0],
      ];
      const summarySheet = workbook.addWorksheet('Summary');
      summaryData.forEach((row) => summarySheet.addRow(row));
      summarySheet.getColumn(1).width = 24;
      summarySheet.getColumn(2).width = 40;
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(6).font = { bold: true };

      // Add Leads sheet
      if (reportData.leads && reportData.leads.length > 0) {
        const leadsData = reportData.leads.map(lead => ({
          'Lead Code': lead.lead_code || '',
          'Company Name': lead.company_name || '',
          'Contact Person': lead.contact_person || '',
          'Email': lead.email || '',
          'Phone': lead.phone || '',
          'Status': lead.status || '',
          'Priority': lead.priority || '',
          'Estimated Value': lead.estimated_value || 0,
          'Lead Score': lead.lead_score || 0,
          'Created Date': lead.created_at ? new Date(lead.created_at).toLocaleString() : '',
        }));
        addObjectSheet('Leads', leadsData);
      }

      // Add Meetings sheet
      if (reportData.meetings && reportData.meetings.length > 0) {
        const meetingsData = reportData.meetings.map(meeting => ({
          'Title': meeting.title || '',
          'Company': meeting.company_name || '',
          'Contact': meeting.contact_person || '',
          'Date & Time': meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleString() : '',
          'Location': meeting.location || '',
          'Duration (Minutes)': meeting.duration_minutes || 0,
          'Status': meeting.status || '',
          'Type': meeting.meeting_type || '',
        }));
        addObjectSheet('Meetings', meetingsData);
      }

      // Add Tasks sheet
      if (reportData.tasks && reportData.tasks.length > 0) {
        const tasksData = reportData.tasks.map(task => ({
          'Title': task.title || '',
          'Type': task.task_type || '',
          'Priority': task.priority || '',
          'Status': task.status || '',
          'Due Date': task.due_date ? new Date(task.due_date).toLocaleString() : '',
          'Completed Date': task.completed_at ? new Date(task.completed_at).toLocaleString() : '',
        }));
        addObjectSheet('Tasks', tasksData);
      }

      // Add Invoices sheet
      if (reportData.invoices && reportData.invoices.length > 0) {
        const invoicesData = reportData.invoices.map(invoice => ({
          'Invoice Number': invoice.invoice_number || '',
          'Company': invoice.company_name || '',
          'Issue Date': invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : '',
          'Due Date': invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '',
          'Subtotal': invoice.subtotal || 0,
          'Tax': invoice.tax_amount || 0,
          'Total Amount': invoice.total_amount || 0,
          'Status': invoice.status || '',
        }));
        addObjectSheet('Invoices', invoicesData);
      }

      // Add Quotations sheet
      if (reportData.quotations && reportData.quotations.length > 0) {
        const quotationsData = reportData.quotations.map(quotation => ({
          'Quotation Number': quotation.quotation_number || '',
          'Company': quotation.company_name || '',
          'Issue Date': quotation.issue_date ? new Date(quotation.issue_date).toLocaleDateString() : '',
          'Valid Until': quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString() : '',
          'Subtotal': quotation.subtotal || 0,
          'Total Amount': quotation.total_amount || 0,
          'Status': quotation.status || '',
        }));
        addObjectSheet('Quotations', quotationsData);
      }

      // Generate filename
      const fileName = `${report.report_name.replace(/[^a-z0-9]/gi, '_')}_${new Date().getTime()}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob(
        [buffer],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel');
    }
  };

  const exportToPDF = async (report) => {
    try {
      const reportData = typeof report.report_data === 'string'
        ? JSON.parse(report.report_data)
        : report.report_data;

      const doc = new jsPDF();

      // Title
      doc.setFontSize(18);
      doc.text(report.report_name, 14, 20);

      // Report Info
      doc.setFontSize(11);
      doc.text(`Report Type: ${report.report_type}`, 14, 30);
      doc.text(`Created: ${new Date(report.created_at).toLocaleString()}`, 14, 36);
      if (report.date_from && report.date_to) {
        doc.text(`Period: ${new Date(report.date_from).toLocaleDateString()} - ${new Date(report.date_to).toLocaleDateString()}`, 14, 42);
      }

      let yPos = 50;

      // Summary
      doc.setFontSize(14);
      doc.text('Summary', 14, yPos);
      yPos += 10;

      const summaryData = [
        ['Leads', reportData.leads?.length || 0],
        ['Meetings', reportData.meetings?.length || 0],
        ['Tasks', reportData.tasks?.length || 0],
        ['Invoices', reportData.invoices?.length || 0],
        ['Quotations', reportData.quotations?.length || 0],
      ];
      autoTable(doc, {
        startY: yPos,
        head: [['Category', 'Count']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [66, 139, 202] },
      });
      yPos = doc.lastAutoTable.finalY + 15;

      // Leads Table
      if (reportData.leads && reportData.leads.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(14);
        doc.text('Leads', 14, yPos);
        yPos += 10;

        const leadsData = reportData.leads.map(lead => [
          lead.lead_code || '',
          lead.company_name || '',
          lead.contact_person || '',
          lead.status || '',
          `₹${lead.estimated_value || 0}`,
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Code', 'Company', 'Contact', 'Status', 'Value']],
          body: leadsData,
          theme: 'striped',
          headStyles: { fillColor: [66, 139, 202] },
        });
        yPos = doc.lastAutoTable.finalY + 15;
      }

      // Meetings Table
      if (reportData.meetings && reportData.meetings.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(14);
        doc.text('Meetings', 14, yPos);
        yPos += 10;

        const meetingsData = reportData.meetings.map(meeting => [
          meeting.title || '',
          meeting.company_name || '',
          meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : '',
          meeting.status || '',
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Title', 'Company', 'Date', 'Status']],
          body: meetingsData,
          theme: 'striped',
          headStyles: { fillColor: [66, 139, 202] },
        });
        yPos = doc.lastAutoTable.finalY + 15;
      }

      // Invoices Table
      if (reportData.invoices && reportData.invoices.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(14);
        doc.text('Invoices', 14, yPos);
        yPos += 10;

        const invoicesData = reportData.invoices.map(invoice => [
          invoice.invoice_number || '',
          invoice.company_name || '',
          `₹${invoice.total_amount || 0}`,
          invoice.status || '',
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Invoice #', 'Company', 'Amount', 'Status']],
          body: invoicesData,
          theme: 'striped',
          headStyles: { fillColor: [66, 139, 202] },
        });
      }

      // Save PDF
      const fileName = `${report.report_name.replace(/[^a-z0-9]/gi, '_')}_${new Date().getTime()}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Failed to export to PDF');
    }
  };

  const sendViaWhatsApp = (report) => {
    const reportData = typeof report.report_data === 'string'
      ? JSON.parse(report.report_data)
      : report.report_data;

    const summary = `
📊 *${report.report_name}*

📅 *Period:* ${report.date_from && report.date_to
        ? `${new Date(report.date_from).toLocaleDateString()} - ${new Date(report.date_to).toLocaleDateString()}`
        : 'All Time'}

📈 *Summary:*
• Leads: ${reportData.leads?.length || 0}
• Meetings: ${reportData.meetings?.length || 0}
• Tasks: ${reportData.tasks?.length || 0}
• Invoices: ${reportData.invoices?.length || 0}
• Quotations: ${reportData.quotations?.length || 0}

📅 Created: ${new Date(report.created_at).toLocaleString()}
    `.trim();

    const encodedMessage = encodeURIComponent(summary);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const viewReport = (report) => {
    const reportData = typeof report.report_data === 'string'
      ? JSON.parse(report.report_data)
      : report.report_data;

    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${report.report_name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 1200px; margin: 0 auto; }
            h1 { color: #333; border-bottom: 3px solid #4285f4; padding-bottom: 10px; }
            .info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .section { margin: 30px 0; }
            .section h2 { color: #4285f4; border-bottom: 2px solid #e0e0e0; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { background: #4285f4; color: white; padding: 12px; text-align: left; }
            td { padding: 10px; border-bottom: 1px solid #e0e0e0; }
            tr:hover { background: #f8f9fa; }
            .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
            .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
            .summary-card h3 { margin: 0; font-size: 24px; }
            .summary-card p { margin: 5px 0 0 0; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${report.report_name}</h1>
            <div class="info">
              <p><strong>Report Type:</strong> ${report.report_type}</p>
              <p><strong>Created:</strong> ${new Date(report.created_at).toLocaleString()}</p>
              ${report.date_from && report.date_to ? `<p><strong>Period:</strong> ${new Date(report.date_from).toLocaleDateString()} - ${new Date(report.date_to).toLocaleDateString()}</p>` : ''}
            </div>
            
            <div class="summary">
              <div class="summary-card">
                <h3>${reportData.leads?.length || 0}</h3>
                <p>Leads</p>
              </div>
              <div class="summary-card">
                <h3>${reportData.meetings?.length || 0}</h3>
                <p>Meetings</p>
              </div>
              <div class="summary-card">
                <h3>${reportData.tasks?.length || 0}</h3>
                <p>Tasks</p>
              </div>
              <div class="summary-card">
                <h3>${reportData.invoices?.length || 0}</h3>
                <p>Invoices</p>
              </div>
              <div class="summary-card">
                <h3>${reportData.quotations?.length || 0}</h3>
                <p>Quotations</p>
              </div>
            </div>
            
            ${reportData.leads && reportData.leads.length > 0 ? `
              <div class="section">
                <h2>Leads (${reportData.leads.length})</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Company</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${reportData.leads.map(lead => `
                      <tr>
                        <td>${lead.lead_code || ''}</td>
                        <td>${lead.company_name || ''}</td>
                        <td>${lead.contact_person || ''}</td>
                        <td>${lead.status || ''}</td>
                        <td>${lead.priority || ''}</td>
                        <td>₹${lead.estimated_value || 0}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
            
            ${reportData.meetings && reportData.meetings.length > 0 ? `
              <div class="section">
                <h2>Meetings (${reportData.meetings.length})</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Company</th>
                      <th>Date & Time</th>
                      <th>Location</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${reportData.meetings.map(meeting => `
                      <tr>
                        <td>${meeting.title || ''}</td>
                        <td>${meeting.company_name || ''}</td>
                        <td>${meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleString() : ''}</td>
                        <td>${meeting.location || ''}</td>
                        <td>${meeting.status || ''}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
            
            ${reportData.invoices && reportData.invoices.length > 0 ? `
              <div class="section">
                <h2>Invoices (${reportData.invoices.length})</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Company</th>
                      <th>Issue Date</th>
                      <th>Total Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${reportData.invoices.map(invoice => `
                      <tr>
                        <td>${invoice.invoice_number || ''}</td>
                        <td>${invoice.company_name || ''}</td>
                        <td>${invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : ''}</td>
                        <td>₹${invoice.total_amount || 0}</td>
                        <td>${invoice.status || ''}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
          </div>
        </body>
      </html>
    `);
  };

  // Filter reports client-side for better UX
  const filteredReports = reports.filter(report => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!report.report_name.toLowerCase().includes(searchLower) &&
        !report.report_type.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (filters.report_type && report.report_type !== filters.report_type) {
      return false;
    }
    if (filters.date_from && new Date(report.created_at) < new Date(filters.date_from)) {
      return false;
    }
    if (filters.date_to && new Date(report.created_at) > new Date(filters.date_to)) {
      return false;
    }
    if (filters.status && report.status !== filters.status) {
      return false;
    }
    return true;
  });

  return (
    <div>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              {/* Title and Description */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-1">Reports</h1>
                <p className="text-slate-300 text-sm">Generate, view, and export comprehensive reports</p>
              </div>
            </div>

            {/* Right Side - Action Button */}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl hover:bg-slate-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Report</span>
            </button>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search by name, type..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Report Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select
              value={filters.report_type}
              onChange={(e) => handleFilterChange('report_type', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              <option value="sales">Sales</option>
              <option value="performance">Performance</option>
              <option value="activity">Activity</option>
              <option value="financial">Financial</option>
            </select>
          </div>

          {/* Date From Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date To Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        {/* Table Headers - Always Visible */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SL No</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report Name</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Reports Content */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No reports found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filters.search || filters.report_type || filters.date_from || filters.date_to
                ? 'Try adjusting your filters to see more results.'
                : 'Get started by creating your first report.'}
            </p>
            {(filters.search || filters.report_type || filters.date_from || filters.date_to) && (
              <div className="mt-6">
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReports.map((report, index) => {
                  const reportData = typeof report.report_data === 'string'
                    ? JSON.parse(report.report_data)
                    : report.report_data;

                  return (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-center font-medium text-gray-600">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{report.report_name}</div>
                        <div className="text-sm text-gray-500">
                          {reportData.leads?.length || 0} Leads, {reportData.meetings?.length || 0} Meetings, {reportData.invoices?.length || 0} Invoices
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 inline-flex text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
                          {report.report_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {report.date_from && report.date_to
                          ? `${new Date(report.date_from).toLocaleDateString()} - ${new Date(report.date_to).toLocaleDateString()}`
                          : 'All Time'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(report.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${report.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                          }`}>
                          {report.status || 'completed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => viewReport(report)}
                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs font-medium"
                            title="View Report"
                          >
                            👁️ View
                          </button>
                          <button
                            onClick={() => exportToExcel(report)}
                            className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium"
                            title="Export to Excel"
                          >
                            📊 Excel
                          </button>
                          <button
                            onClick={() => exportToPDF(report)}
                            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs font-medium"
                            title="Export to PDF"
                          >
                            📄 PDF
                          </button>
                          <button
                            onClick={() => sendViaWhatsApp(report)}
                            className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium"
                            title="Send via WhatsApp"
                          >
                            💬 WhatsApp
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Report Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Create New Report</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Report Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.report_name}
                    onChange={(e) => setFormData({ ...formData, report_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Sales Report Q1 2024"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Report Type *</label>
                  <select
                    required
                    value={formData.report_type}
                    onChange={(e) => setFormData({ ...formData, report_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="sales">Sales</option>
                    <option value="performance">Performance</option>
                    <option value="activity">Activity</option>
                    <option value="financial">Financial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">From Date</label>
                  <input
                    type="date"
                    value={formData.date_from}
                    onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">To Date</label>
                  <input
                    type="date"
                    value={formData.date_to}
                    onChange={(e) => setFormData({ ...formData, date_to: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Include Sections</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <label className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.include_leads}
                      onChange={(e) => setFormData({ ...formData, include_leads: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Leads</span>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.include_meetings}
                      onChange={(e) => setFormData({ ...formData, include_meetings: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Meetings</span>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.include_tasks}
                      onChange={(e) => setFormData({ ...formData, include_tasks: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Tasks</span>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.include_invoices}
                      onChange={(e) => setFormData({ ...formData, include_invoices: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Invoices</span>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.include_quotations}
                      onChange={(e) => setFormData({ ...formData, include_quotations: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Quotations</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Generate Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
