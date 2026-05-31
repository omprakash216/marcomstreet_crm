import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import FullAndFinalPDF from './FullAndFinalPDF';
import { buildPdfBlobFromPreview } from '../utils/previewPdf';

const FullAndFinalGenerator = ({ employeeData, allEmployees = [], onSaved }) => {
  const [formData, setFormData] = useState({
    employeeName: employeeData?.name || '',
    designation: employeeData?.designation || '',
    lastWorkingDate: '',
    companyName: 'Vanya Group (Artistry Studio)',
    companyAddress: 'B-023, B Block, Sector 63, Noida',
    hrName: 'Jyoti Sharma',
    hrContact: '+91 9211608441',
    hrEmail: 'hrthevanygroup@gmail.com'
  });

  const [saving, setSaving] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeData?.id || employeeData?.employee_id || '');
  const previewRef = useRef(null);

  useEffect(() => {
    if (employeeData) {
      setFormData(prev => ({
        ...prev,
        employeeName: employeeData.name || '',
        designation: employeeData.designation || ''
      }));
      setSelectedEmployeeId(employeeData.id || employeeData.employee_id || '');
    }
  }, [employeeData]);

  const [showPreview, setShowPreview] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEmployeeSelect = (e) => {
    const id = e.target.value;
    if (!id) {
      setSelectedEmployeeId('');
      return;
    }
    const emp = allEmployees.find((emp) => String(emp.id) === String(id));
    if (emp) {
      setFormData((prev) => ({
        ...prev,
        employeeName: emp.name || '',
        designation: emp.designation || ''
      }));
      setSelectedEmployeeId(emp.id || '');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleSave = async () => {
    const employeeId = selectedEmployeeId || employeeData?.id || employeeData?.employee_id;
    if (!employeeId) {
      alert('Please select an employee to save this document.');
      return;
    }
    if (!formData.employeeName || !formData.designation || !formData.lastWorkingDate) {
      alert('Please fill Employee Name, Designation, and Last Working Date.');
      return;
    }
    setSaving(true);
    try {
      const pdfBlob = await buildPdfBlobFromPreview({
        root: previewRef.current,
        pageSelector: '.full-and-final-doc',
      });

      const safeName = String(formData.employeeName || 'Employee')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '');
      const fileName = `Full_And_Final_${safeName || 'Employee'}_${Date.now()}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      const uploadData = new FormData();
      uploadData.append('employee_id', String(employeeId));
      uploadData.append('title', `Full and Final - ${formData.employeeName || 'Employee'}`);
      uploadData.append('type', 'other');
      uploadData.append('file', pdfFile);

      await api.post('/hrms/documents', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('Full & Final letter saved to Document Library.');
      if (onSaved) onSaved();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save Full & Final letter');
    } finally {
      setSaving(false);
    }
  };

  if (showPreview) {
    return (
      <div>
        <div className="mb-4 flex justify-between items-center no-print">
          <button
            onClick={() => setShowPreview(false)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
          >
            ← Back to Edit
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save to Library'}
          </button>
        </div>
        <div ref={previewRef}>
          <FullAndFinalPDF
            employeeName={formData.employeeName}
            designation={formData.designation}
            lastWorkingDate={formatDate(formData.lastWorkingDate)}
            companyName={formData.companyName}
            companyAddress={formData.companyAddress}
            hrName={formData.hrName}
            hrContact={formData.hrContact}
            showPrintButton={false}
            hrEmail={formData.hrEmail}
            currentDate={new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Generate Full &amp; Final Acknowledgement</h2>
      <p className="text-gray-600 text-sm mb-6">
        Fill the details below. The letter will use the same letterhead and print layout as the Experience Letter.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allEmployees.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Employee</label>
            <select
              name="employeeSelect"
              onChange={handleEmployeeSelect}
              value={selectedEmployeeId || ''}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select —</option>
              {allEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} {emp.designation ? `(${emp.designation})` : ''}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Employee Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            name="employeeName"
            value={formData.employeeName}
            onChange={handleInputChange}
            placeholder="e.g. Indu"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Designation <span className="text-red-500">*</span></label>
          <input
            type="text"
            name="designation"
            value={formData.designation}
            onChange={handleInputChange}
            placeholder="e.g. Business Development Manager"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Last Working Date <span className="text-red-500">*</span></label>
          <input
            type="date"
            name="lastWorkingDate"
            value={formData.lastWorkingDate}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
          <input
            type="text"
            name="companyName"
            value={formData.companyName}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Company Address</label>
          <input
            type="text"
            name="companyAddress"
            value={formData.companyAddress}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">HR Name</label>
          <input
            type="text"
            name="hrName"
            value={formData.hrName}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">HR Contact</label>
          <input
            type="text"
            name="hrContact"
            value={formData.hrContact}
            onChange={handleInputChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => {
            if (!formData.employeeName || !formData.designation || !formData.lastWorkingDate) {
              alert('Please fill Employee Name, Designation, and Last Working Date.');
              return;
            }
            setShowPreview(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition-colors"
        >
          Generate F&amp;F Letter
        </button>
      </div>
    </div>
  );
};

export default FullAndFinalGenerator;
