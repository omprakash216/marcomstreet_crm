import React, { useState, useEffect } from 'react';
import OfferLetterPDF from './OfferLetterPDF';

const OfferLetterGenerator = ({ allEmployees = [], employeeData }) => {
  const [formData, setFormData] = useState({
    employeeName: employeeData?.name || '',
    designation: employeeData?.designation || '',
    department: employeeData?.department || '',
    address: '',
    joiningDate: '',
    gender: employeeData?.gender || 'male',
    workLocation: 'B-23, B-BLOCK, SECTOR 63 NOIDA',
    companyName: 'VANYA GROUP (MARCOM STREET)',
    companyAddress: 'B-023, B Block, Sector 63, Noida',
    hrName: 'Jyoti Sharma',
    hrDesignation: 'HR & ADMIN',
    hrContact: '+91 9211608441',
    hrEmail: 'hrthevanygroup@gmail.com',
    hrSignDate: '',
    reportingTo: '',
    acceptanceDays: '7',
    probationMonths: '3',
    basicSalary: '12,000',
    hra: '7,200',
    conveyanceAllowance: '1,500',
    medicalAllowance: '1,000',
    otherAllowance: '2,300',
    grossSalary: '24,000',
    netSalary: '24,000'
  });

  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (employeeData) {
      setFormData(prev => ({
        ...prev,
        employeeName: employeeData.name || '',
        designation: employeeData.designation || '',
        department: employeeData.department || '',
        gender: employeeData.gender || 'male',
        joiningDate: employeeData.joining_date || prev.joiningDate
      }));
    }
  }, [employeeData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEmployeeSelect = (emp) => {
    if (!emp) {
      setFormData(prev => ({ ...prev, employeeName: '', designation: '', department: '', joiningDate: '' }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      employeeName: emp.name || '',
      designation: emp.designation || '',
      department: emp.department || '',
      joiningDate: emp.joining_date || prev.joiningDate,
      gender: emp.gender || 'male'
    }));
  };

  const handleGenerate = () => {
    setShowPreview(true);
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
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md"
          >
            🖨️ Print PDF
          </button>
        </div>
        <OfferLetterPDF
          employeeName={formData.employeeName}
          designation={formData.designation}
          department={formData.department}
          address={formData.address}
          joiningDate={formData.joiningDate ? new Date(formData.joiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase() : ''}
          gender={formData.gender}
          workLocation={formData.workLocation}
          companyName={formData.companyName}
          companyAddress={formData.companyAddress}
          hrName={formData.hrName}
          hrDesignation={formData.hrDesignation}
          hrContact={formData.hrContact}
          hrEmail={formData.hrEmail}
          hrSignDate={formData.hrSignDate ? new Date(formData.hrSignDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
          reportingTo={formData.reportingTo}
          acceptanceDays={formData.acceptanceDays}
          probationMonths={Number(formData.probationMonths) || 3}
          basicSalary={formData.basicSalary}
          hra={formData.hra}
          conveyanceAllowance={formData.conveyanceAllowance}
          medicalAllowance={formData.medicalAllowance}
          otherAllowance={formData.otherAllowance}
          grossSalary={formData.grossSalary}
          netSalary={formData.netSalary}
          currentDate={new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Generate Offer Letter</h2>
        <p className="text-gray-600">Fill in the details to generate a professional offer letter</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Candidate & Offer</h3>

          {allEmployees.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
              <select
                value={formData.employeeName ? allEmployees.find(e => e.name === formData.employeeName)?.id : ''}
                onChange={(e) => {
                  const emp = allEmployees.find(emp => emp.id === e.target.value);
                  handleEmployeeSelect(emp);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an employee (optional)</option>
                {allEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} - {emp.employee_code} ({emp.designation})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Name</label>
            <input
              type="text"
              name="employeeName"
              value={formData.employeeName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Full name"
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
              placeholder="e.g. 3D Visualizer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Design"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reporting To</label>
            <input
              type="text"
              name="reportingTo"
              value={formData.reportingTo}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Gagnesh Bhardwaj"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Probation (months)</label>
            <input
              type="text"
              name="probationMonths"
              value={formData.probationMonths}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Location</label>
            <input
              type="text"
              name="workLocation"
              value={formData.workLocation}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Delhi (Head Office)"
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

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Address & Company</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Full correspondence address"
            />
          </div>

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
              rows="2"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HR Designation</label>
            <input
              type="text"
              name="hrDesignation"
              value={formData.hrDesignation}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. HR HEAD (Operation)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HR Sign Date</label>
            <input
              type="date"
              name="hrSignDate"
              value={formData.hrSignDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acceptance (days)</label>
            <input
              type="text"
              name="acceptanceDays"
              value={formData.acceptanceDays}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="7"
            />
          </div>
        </div>
      </div>

      {/* Salary Structure (Annexure A) */}
      <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4">Salary Structure (Annexure A) – Monthly ₹</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary</label>
            <input type="text" name="basicSalary" value={formData.basicSalary} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" placeholder="12,500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HRA</label>
            <input type="text" name="hra" value={formData.hra} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" placeholder="7,500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conveyance Allowance</label>
            <input type="text" name="conveyanceAllowance" value={formData.conveyanceAllowance} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" placeholder="1,500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medical Allowance</label>
            <input type="text" name="medicalAllowance" value={formData.medicalAllowance} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" placeholder="1,000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Other Allowance</label>
            <input type="text" name="otherAllowance" value={formData.otherAllowance} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" placeholder="2,500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gross Salary</label>
            <input type="text" name="grossSalary" value={formData.grossSalary} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" placeholder="25,000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Net Salary Payable</label>
            <input type="text" name="netSalary" value={formData.netSalary} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" placeholder="25,000" />
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={handleGenerate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg shadow-md transition-colors font-medium"
        >
          Generate Offer Letter
        </button>
      </div>
    </div>
  );
};

export default OfferLetterGenerator;
