import React, { useState, useEffect } from 'react';
import ExperienceLetterPDF from './ExperienceLetterPDF';

const ExperienceLetterGenerator = ({ employeeData }) => {
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

  // Update form data when employeeData changes
  useEffect(() => {
    if (employeeData) {
      setFormData(prev => ({
        ...prev,
        employeeName: employeeData.name || '',
        employeeCode: employeeData.employee_code || '',
        designation: employeeData.designation || '',
        joiningDate: employeeData.joining_date || '',
        gender: employeeData.gender || 'male'
      }));
    }
  }, [employeeData]);

  const [showPreview, setShowPreview] = useState(false);

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

  const handlePrint = () => {
    window.print();
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
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md"
          >
            🖨️ Print PDF
          </button>
        </div>
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
          currentDate={new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        />
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