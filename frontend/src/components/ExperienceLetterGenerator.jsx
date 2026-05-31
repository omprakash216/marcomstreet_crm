import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import ExperienceLetterPDF from './ExperienceLetterPDF';
import { buildPdfBlobFromPreview } from '../utils/previewPdf';

const ExperienceLetterGenerator = ({ allEmployees = [], employeeData, onSaved }) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeData?.id || employeeData?.employee_id || '');
  const [formData, setFormData] = useState({
    employeeName: employeeData?.name || '',
    employeeCode: employeeData?.employee_code || '',
    designation: employeeData?.designation || '',
    joiningDate: employeeData?.joining_date || '',
    relievingDate: '', // This would be set when generating the letter
    gender: employeeData?.gender || 'male',
    responsibilities: '',
    companyName: 'Vanya Group (Artistry Studio)',
    companyAddress: 'B-023, B Block, Sector 63, Noida',
    hrName: 'Jyoti Sharma',
    hrContact: '+91 9211608441',
    hrEmail: 'hrthevanygroup@gmail.com'
  });

  useEffect(() => {
    if (employeeData) {
      setFormData((prev) => ({
        ...prev,
        employeeName: employeeData.name || '',
        employeeCode: employeeData.employee_code || '',
        designation: employeeData.designation || '',
        joiningDate: employeeData.joining_date || '',
        gender: employeeData.gender || 'male'
      }));
      setSelectedEmployeeId(employeeData.id || employeeData.employee_id || '');
    }
  }, [employeeData]);

  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const previewRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGenerate = () => {
    setShowPreview(true);
  };

  const handleEmployeeSelect = (emp) => {
    if (!emp) {
      setSelectedEmployeeId('');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      employeeName: emp.name || '',
      employeeCode: emp.employee_code || '',
      designation: emp.designation || '',
      joiningDate: emp.joining_date || prev.joiningDate,
      gender: emp.gender || 'male'
    }));
    setSelectedEmployeeId(emp.id || emp.employee_id || '');
  };

  const handleSave = async () => {
    const employeeId = selectedEmployeeId || employeeData?.id || employeeData?.employee_id;
    if (!employeeId) {
      alert('Please select an employee to save this document.');
      return;
    }
    setSaving(true);
    try {
      const pdfBlob = await buildPdfBlobFromPreview({
        root: previewRef.current,
        pageSelector: '.experience-letter-doc',
      });

      const safeName = String(formData.employeeName || 'Employee')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '');
      const fileName = `Experience_Letter_${safeName || 'Employee'}_${Date.now()}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      const uploadData = new FormData();
      uploadData.append('employee_id', String(employeeId));
      uploadData.append('title', `Experience Letter - ${formData.employeeName || 'Employee'}`);
      uploadData.append('type', 'experience_letter');
      uploadData.append('file', pdfFile);

      await api.post('/hrms/documents', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('Experience letter saved to Document Library.');
      if (onSaved) onSaved();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save experience letter');
    } finally {
      setSaving(false);
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

  if (showPreview) {
    return (
      <div>
        <div className="mb-4 flex justify-between items-center">
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
          <ExperienceLetterPDF
            employeeName={formData.employeeName}
            employeeCode={formData.employeeCode}
            designation={formData.designation}
            joiningDate={formatDate(formData.joiningDate)}
            relievingDate={formatDate(formData.relievingDate)}
            gender={formData.gender}
            companyName={formData.companyName}
            companyAddress={formData.companyAddress}
            hrName={formData.hrName}
            hrContact={formData.hrContact}
            hrEmail={formData.hrEmail}
            showPrintButton={false}
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
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Generate Experience Letter</h2>
        <p className="text-gray-600">Fill in the details to generate a professional experience letter</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Employee Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Employee Information</h3>

          {allEmployees.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee <span className="text-red-500">*</span></label>
              <select
                value={selectedEmployeeId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const emp = val ? allEmployees.find((emp) => String(emp.id) === String(val)) : null;
                  handleEmployeeSelect(emp);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select an employee —</option>
                {allEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.employee_code ? `(${emp.employee_code})` : ''} {emp.designation ? `- ${emp.designation}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name</label>
            <input
              type="text"
              name="employeeName"
              value={formData.employeeName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter employee name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee Code</label>
            <input
              type="text"
              name="employeeCode"
              value={formData.employeeCode}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter employee code"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
            <input
              type="text"
              name="designation"
              value={formData.designation}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter designation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date</label>
            <input
              type="date"
              name="joiningDate"
              value={formData.joiningDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relieving Date</label>
            <input
              type="date"
              name="relievingDate"
              value={formData.relievingDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Company Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Company Information</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Address</label>
            <textarea
              name="companyAddress"
              value={formData.companyAddress}
              onChange={handleInputChange}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HR Name</label>
            <input
              type="text"
              name="hrName"
              value={formData.hrName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HR Contact</label>
            <input
              type="text"
              name="hrContact"
              value={formData.hrContact}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HR Email</label>
            <input
              type="email"
              name="hrEmail"
              value={formData.hrEmail}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Responsibilities */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Job Responsibilities</label>
        <textarea
          name="responsibilities"
          value={formData.responsibilities}
          onChange={handleInputChange}
          rows="4"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Describe the employee's job responsibilities and achievements..."
        />
      </div>

      {/* Generate Button */}
      <div className="mt-8 text-center">
        <button
          onClick={handleGenerate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg shadow-md transition-colors font-medium"
        >
          Generate Experience Letter
        </button>
      </div>
    </div>
  );
};

export default ExperienceLetterGenerator;
