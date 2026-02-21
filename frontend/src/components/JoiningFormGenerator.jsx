import React, { useState, useEffect } from 'react';
import JoiningFormPDF from './JoiningFormPDF';

const defaultEducation = { qual: '', univ: '', year: '', perc: '' };
const defaultEmployment = { comp: '', desig: '', dur: '', reason: '' };

const JoiningFormGenerator = ({ allEmployees = [], employeeData }) => {
  const [formData, setFormData] = useState({
    employeeName: employeeData?.name || '',
    designation: employeeData?.designation || '',
    department: employeeData?.department || '',
    joiningDate: employeeData?.joining_date || '',
    fatherName: '',
    dob: '',
    gender: employeeData?.gender || 'male',
    maritalStatus: 'single',
    phone: '',
    email: '',
    permanentAddress: '',
    currentAddress: '',
    aadharNo: '',
    panNo: '',
    emergencyContactName: '',
    emergencyRelation: '',
    emergencyPhone: '',
    education: [{ ...defaultEducation }],
    employment: [{ ...defaultEmployment }],
    docsResume: false,
    docsId: false,
    docsAddress: false,
    docsCertificates: false,
    docsPhotos: false,
    docsOthers: ''
  });

  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (employeeData) {
      setFormData(prev => ({
        ...prev,
        employeeName: employeeData.name || '',
        designation: employeeData.designation || '',
        department: employeeData.department || '',
        joiningDate: employeeData.joining_date || prev.joiningDate,
        gender: employeeData.gender || 'male',
        email: employeeData.email || prev.email,
        phone: employeeData.phone || prev.phone
      }));
    }
  }, [employeeData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleDynamicChange = (idx, field, value, section) => {
    const list = [...formData[section]];
    list[idx] = { ...list[idx], [field]: value };
    setFormData(prev => ({ ...prev, [section]: list }));
  };

  const addRow = (section, template) => {
    setFormData(prev => ({ ...prev, [section]: [...prev[section], { ...template }] }));
  };

  const removeRow = (idx, section) => {
    const list = formData[section];
    if (list.length <= 1) return;
    const next = list.filter((_, i) => i !== idx);
    setFormData(prev => ({ ...prev, [section]: next }));
  };

  const handleEmployeeSelect = (emp) => {
    if (!emp) return;
    setFormData(prev => ({
      ...prev,
      employeeName: emp.name || '',
      designation: emp.designation || '',
      department: emp.department || '',
      joiningDate: emp.joining_date || prev.joiningDate,
      gender: emp.gender || 'male',
      email: emp.email || prev.email,
      phone: emp.phone || prev.phone
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (showPreview) {
    return (
      <div>
        <div className="mb-4 flex justify-between items-center">
          <button onClick={() => setShowPreview(false)} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg">← Back to Edit</button>
          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md">🖨️ Print PDF</button>
        </div>
        <JoiningFormPDF
          employeeName={formData.employeeName}
          designation={formData.designation}
          department={formData.department}
          joiningDate={formatDate(formData.joiningDate)}
          fatherName={formData.fatherName}
          dob={formData.dob ? new Date(formData.dob).toLocaleDateString('en-GB') : ''}
          gender={formData.gender}
          maritalStatus={formData.maritalStatus}
          phone={formData.phone}
          email={formData.email}
          permanentAddress={formData.permanentAddress}
          currentAddress={formData.currentAddress}
          aadharNo={formData.aadharNo}
          panNo={formData.panNo}
          emergencyContactName={formData.emergencyContactName}
          emergencyRelation={formData.emergencyRelation}
          emergencyPhone={formData.emergencyPhone}
          education={formData.education}
          employment={formData.employment}
          docsResume={formData.docsResume}
          docsId={formData.docsId}
          docsAddress={formData.docsAddress}
          docsCertificates={formData.docsCertificates}
          docsPhotos={formData.docsPhotos}
          docsOthers={formData.docsOthers}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Generate Joining Form</h2>
        <p className="text-gray-600">Fill in the details to generate the joining form document</p>
      </div>

      {allEmployees.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
          <select
            value={allEmployees.find(e => e.name === formData.employeeName)?.id || ''}
            onChange={(e) => handleEmployeeSelect(allEmployees.find(emp => emp.id === e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select an employee (optional)</option>
            {allEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name} - {emp.employee_code} ({emp.designation})</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input type="text" name="employeeName" value={formData.employeeName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
          <input type="text" name="designation" value={formData.designation} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <input type="text" name="department" value={formData.department} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
          <input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Father&apos;s Name</label>
          <input type="text" name="fatherName" value={formData.fatherName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
          <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
          <select name="gender" value={formData.gender} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500">
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
          <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500">
            <option value="single">Single</option>
            <option value="married">Married</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
          <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar No</label>
          <input type="text" name="aadharNo" value={formData.aadharNo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PAN No</label>
          <input type="text" name="panNo" value={formData.panNo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
          <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
          <input type="text" name="emergencyRelation" value={formData.emergencyRelation} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
          <input type="text" name="emergencyPhone" value={formData.emergencyPhone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Permanent Address</label>
        <textarea name="permanentAddress" value={formData.permanentAddress} onChange={handleChange} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Current Address</label>
        <textarea name="currentAddress" value={formData.currentAddress} onChange={handleChange} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-2">Education</h3>
        {formData.education.map((row, idx) => (
          <div key={idx} className="grid grid-cols-4 gap-2 mb-2">
            <input placeholder="Qualification" value={row.qual} onChange={e => handleDynamicChange(idx, 'qual', e.target.value, 'education')} className="px-3 py-2 border rounded-md text-sm" />
            <input placeholder="University/Board" value={row.univ} onChange={e => handleDynamicChange(idx, 'univ', e.target.value, 'education')} className="px-3 py-2 border rounded-md text-sm" />
            <input placeholder="Year" value={row.year} onChange={e => handleDynamicChange(idx, 'year', e.target.value, 'education')} className="px-3 py-2 border rounded-md text-sm" />
            <div className="flex gap-1">
              <input placeholder="%" value={row.perc} onChange={e => handleDynamicChange(idx, 'perc', e.target.value, 'education')} className="px-3 py-2 border rounded-md text-sm flex-1" />
              {formData.education.length > 1 && <button type="button" onClick={() => removeRow(idx, 'education')} className="text-red-500"><i className="fas fa-trash-alt"></i></button>}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => addRow('education', defaultEducation)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded">+ Add Row</button>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-2">Employment History</h3>
        {formData.employment.map((row, idx) => (
          <div key={idx} className="grid grid-cols-2 gap-2 mb-2">
            <input placeholder="Company" value={row.comp} onChange={e => handleDynamicChange(idx, 'comp', e.target.value, 'employment')} className="px-3 py-2 border rounded-md text-sm" />
            <input placeholder="Designation" value={row.desig} onChange={e => handleDynamicChange(idx, 'desig', e.target.value, 'employment')} className="px-3 py-2 border rounded-md text-sm" />
            <input placeholder="Duration" value={row.dur} onChange={e => handleDynamicChange(idx, 'dur', e.target.value, 'employment')} className="px-3 py-2 border rounded-md text-sm" />
            <div className="flex gap-1">
              <input placeholder="Reason for Leaving" value={row.reason} onChange={e => handleDynamicChange(idx, 'reason', e.target.value, 'employment')} className="px-3 py-2 border rounded-md text-sm flex-1" />
              {formData.employment.length > 1 && <button type="button" onClick={() => removeRow(idx, 'employment')} className="text-red-500"><i className="fas fa-trash-alt"></i></button>}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => addRow('employment', defaultEmployment)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded">+ Add Row</button>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-2">Documents Submitted</h3>
        <div className="flex flex-wrap gap-4">
          {[
            { label: 'Resume', key: 'docsResume' },
            { label: 'ID Proof', key: 'docsId' },
            { label: 'Address Proof', key: 'docsAddress' },
            { label: 'Certificates', key: 'docsCertificates' },
            { label: 'Photos (2)', key: 'docsPhotos' }
          ].map(({ label, key }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData[key]} onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.checked }))} className="rounded text-blue-600" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
        <input type="text" name="docsOthers" value={formData.docsOthers} onChange={handleChange} placeholder="Others" className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
      </div>

      <div className="mt-8 text-center">
        <button onClick={() => setShowPreview(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg shadow-md font-medium">Generate Joining Form</button>
      </div>
    </div>
  );
};

export default JoiningFormGenerator;
