import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';
import ExperienceLetterGenerator from '../../components/ExperienceLetterGenerator';
import OfferLetterGenerator from '../../components/OfferLetterGenerator';
import JoiningFormGenerator from '../../components/JoiningFormGenerator';
import FullAndFinalGenerator from '../../components/FullAndFinalGenerator';

export default function HRDocuments() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [filter, setFilter] = useState({
    search: '',
    type: ''
  });
  const [newDoc, setNewDoc] = useState({
    employee_id: '',
    title: '',
    type: 'offer_letter',
    file: null
  });
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' or 'experience-letter'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [docToGenerate, setDocToGenerate] = useState({
    employee_id: '',
    type: 'offer_letter',
    ctc: '',
    address: '',
    relieving_date: '',
    father_name: '',
    dob: '',
    gender: 'male',
    marital_status: 'single',
    aadhar_no: '',
    pan_no: '',
    emergency_contact_name: '',
    emergency_relation: '',
    emergency_phone: '',
    department: '',
    permanent_address: '',
    education: [{ qual: '', univ: '', year: '', perc: '' }],
    employment: [{ comp: '', desig: '', dur: '', reason: '' }],
    docs_resume: false,
    docs_id: false,
    docs_address: false,
    docs_certificates: false,
    docs_photos: false,
    docs_others: ''
  });

  const employee = getEmployee();
  const isAdminOrManager = employee?.role === 'admin' || employee?.role === 'manager' || employee?.role === 'human_resources';

  // Node only: same origin, /serve-pdf from Node
  const BASE_URL = '';

  useEffect(() => {
    fetchDocs();
    if (isAdminOrManager) {
      fetchEmployees();
    }
  }, [filter]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/chat?action=users');
      if (response.data.success) {
        setAllEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchDocs = async () => {
    try {
      const response = await api.get('/hrms/documents');
      if (response.data.success) {
        setDocs(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching docs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!newDoc.file) {
      alert('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('employee_id', newDoc.employee_id);
    formData.append('title', newDoc.title);
    formData.append('type', newDoc.type);
    formData.append('file', newDoc.file);

    try {
      const response = await api.post('/hrms/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) {
        alert('Document uploaded successfully!');
        setShowUploadModal(false);
        setNewDoc({
          employee_id: '',
          title: '',
          type: 'offer_letter',
          file: null
        });
        fetchDocs();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to upload document');
    }
  };

  const handleFilterChange = (field, value) => {
    setFilter({ ...filter, [field]: value });
  };

  const clearFilters = () => {
    setFilter({
      search: '',
      type: ''
    });
  };

  const filteredDocs = docs.filter(doc => {
    const matchesSearch = filter.search === '' ||
      doc.title.toLowerCase().includes(filter.search.toLowerCase()) ||
      doc.employee_name?.toLowerCase().includes(filter.search.toLowerCase());
    const matchesType = filter.type === '' || doc.type === filter.type;
    return matchesSearch && matchesType;
  });

  const handleGenerateDoc = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/hrms/generate_document', docToGenerate);
      if (response.data.success) {
        alert('Document generated successfully!');
        setShowGenerateModal(false);
        fetchDocs();

        // Automatically open the generated document
        if (response.data.data?.file_path) {
          const fileUrl = getDocUrl(response.data.data.file_path);
          window.open(fileUrl, '_blank');
        }
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to generate document');
    }
  };

  const handleDynamicChange = (idx, field, value, section) => {
    const list = [...docToGenerate[section]];
    list[idx][field] = value;
    setDocToGenerate({ ...docToGenerate, [section]: list });
  };

  const addRow = (section, template) => {
    setDocToGenerate({
      ...docToGenerate,
      [section]: [...docToGenerate[section], { ...template }]
    });
  };

  const removeRow = (idx, section) => {
    const list = [...docToGenerate[section]];
    if (list.length > 1) {
      list.splice(idx, 1);
      setDocToGenerate({ ...docToGenerate, [section]: list });
    }
  };

  const getDocUrl = (filePath) => {
    if (!filePath) return '#';
    // Clean up path - handle cases from DB
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    // Use PDF serving endpoint for proper MIME type handling
    if (cleanPath.endsWith('.pdf')) {
      return `${BASE_URL}/serve-pdf?file=${encodeURIComponent(cleanPath)}`;
    }
    return `${BASE_URL}/${cleanPath}`;
  };

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    setActiveTab('experience-letter');
  };

  return (
    <div>
      {/* Standardized Header Section */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg text-white">
              <i className="fas fa-folder-open text-2xl"></i>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1">HR Documents</h1>
              <p className="text-slate-300 text-sm">Access your official documents and company policies</p>
            </div>
            {isAdminOrManager && activeTab === 'documents' && (
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg font-semibold transition-all duration-200 hover:bg-blue-700"
                >
                  <i className="fas fa-magic"></i>
                  <span>Generate Letter</span>
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold transition-all duration-200 hover:bg-slate-50"
                >
                  <i className="fas fa-upload"></i>
                  <span>Upload Document</span>
                </button>
              </div>
            )}

            {(activeTab === 'experience-letter' || activeTab === 'offer-letter' || activeTab === 'joining-form' || activeTab === 'full-and-final') && isAdminOrManager && (
              <div className="flex space-x-3">
                <select
                  value={selectedEmployee?.id || ''}
                  onChange={(e) => {
                    const emp = allEmployees.find(emp => emp.id === e.target.value);
                    setSelectedEmployee(emp);
                  }}
                  className="px-4 py-3 bg-white text-slate-700 rounded-xl shadow-lg font-semibold border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Employee</option>
                  {allEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} - {emp.employee_code} ({emp.designation})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'documents'
              ? 'bg-white text-blue-600 shadow-sm border-2 border-gray-900'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          📄 Document Library
        </button>
        <button
          onClick={() => setActiveTab('experience-letter')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'experience-letter'
              ? 'bg-white text-blue-600 shadow-sm border-2 border-gray-900'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          📝 Experience Letter
        </button>
        <button
          onClick={() => setActiveTab('offer-letter')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'offer-letter'
              ? 'bg-white text-blue-600 shadow-sm border-2 border-gray-900'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          📋 Offer Letter
        </button>
        <button
          onClick={() => setActiveTab('joining-form')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'joining-form'
              ? 'bg-white text-blue-600 shadow-sm border-2 border-gray-900'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          📑 Joining Form
        </button>
        <button
          onClick={() => setActiveTab('full-and-final')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'full-and-final'
              ? 'bg-white text-blue-600 shadow-sm border-2 border-gray-900'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          📋 F&amp;F
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'documents' ? (
        <>
          {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={filter.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search by title or employee..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
            <select
              value={filter.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="offer_letter">Offer Letter</option>
              <option value="experience_letter">Experience Letter</option>
              <option value="policy">Company Policy</option>
              <option value="other">Other</option>
            </select>
          </div>
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

      {/* Documents Grid */}
      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-md">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm font-medium text-gray-500">Loading documents...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-md">
          <i className="fas fa-folder-open text-4xl text-gray-300 mb-4 block"></i>
          <p className="text-gray-500">No documents found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map((doc) => (
            <div key={doc.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all">
                  <i className="fas fa-file-alt text-xl"></i>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase block mb-1 ${doc.type === 'offer_letter' ? 'bg-green-100 text-green-700' :
                    doc.type === 'policy' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                    {doc.type ? doc.type.replace('_', ' ') : 'Unknown'}
                  </span>
                  {isAdminOrManager && <span className="text-xs text-purple-500 font-medium">{doc.employee_name}</span>}
                </div>
              </div>
              <h3 className="font-bold text-gray-900 mb-1 truncate" title={doc.title}>{doc.title}</h3>
              <p className="text-xs text-gray-500 mb-4">Uploaded on {new Date(doc.created_at).toLocaleDateString()}</p>
              <div className="flex space-x-2">
                {doc.file_path ? (
                  <>
                    <a
                      href={getDocUrl(doc.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium transition-all border border-gray-200"
                    >
                      View
                    </a>
                    <a
                      href={getDocUrl(doc.file_path)}
                      download
                      className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all border border-blue-100"
                    >
                      <i className="fas fa-download text-sm"></i>
                    </a>
                  </>
                ) : (
                  <span className="flex-1 text-center text-sm text-gray-400">File not available</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Document Modal */}
        </>
      ) : activeTab === 'experience-letter' ? (
        <ExperienceLetterGenerator employeeData={selectedEmployee} />
      ) : activeTab === 'offer-letter' ? (
        <OfferLetterGenerator allEmployees={allEmployees} employeeData={selectedEmployee} />
      ) : activeTab === 'joining-form' ? (
        <JoiningFormGenerator allEmployees={allEmployees} employeeData={selectedEmployee} />
      ) : activeTab === 'full-and-final' ? (
        <FullAndFinalGenerator allEmployees={allEmployees} employeeData={selectedEmployee} />
      ) : null}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Upload HR Document</h2>
            <form onSubmit={handleUploadDoc} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Employee</label>
                <select
                  required
                  value={newDoc.employee_id}
                  onChange={(e) => setNewDoc({ ...newDoc, employee_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Select an employee</option>
                  {allEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Document Title</label>
                <input
                  type="text"
                  required
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g. Offer Letter - John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Document Type</label>
                <select
                  required
                  value={newDoc.type}
                  onChange={(e) => setNewDoc({ ...newDoc, type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="offer_letter">Offer Letter</option>
                  <option value="experience_letter">Experience Letter</option>
                  <option value="policy">Company Policy</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">File</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setNewDoc({ ...newDoc, file: e.target.files[0] })}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md"
                >
                  Upload Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Generate Document Modal - Professional layout */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200/80">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
                  <i className="fas fa-file-invoice text-white text-lg"></i>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white tracking-tight">Generate Document</h2>
                  <p className="text-xs text-slate-300 mt-0.5">Select employee & type to create PDF</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleGenerateDoc} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 max-h-[58vh] overflow-y-auto space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee</label>
                  <select
                    required
                    value={docToGenerate.employee_id}
                    onChange={(e) => setDocToGenerate({ ...docToGenerate, employee_id: e.target.value })}
                    className="w-full px-4 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  >
                    <option value="">Select an employee</option>
                    {allEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Document type</label>
                  <select
                    required
                    value={docToGenerate.type}
                    onChange={(e) => setDocToGenerate({ ...docToGenerate, type: e.target.value })}
                    className="w-full px-4 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  >
                    <option value="offer_letter">Offer Letter</option>
                    <option value="experience_letter">Experience Letter</option>
                    <option value="joining_form">Joining Form</option>
                  </select>
                </div>

                {/* Offer Letter Fields */}
                {docToGenerate.type === 'offer_letter' && (
                  <div className="space-y-4 pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Annual CTC (₹)</label>
                      <input
                        type="number"
                        required
                        value={docToGenerate.ctc}
                        onChange={(e) => setDocToGenerate({ ...docToGenerate, ctc: e.target.value })}
                        className="w-full px-4 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="e.g. 500000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Candidate address</label>
                      <textarea
                        required
                        rows="3"
                        value={docToGenerate.address}
                        onChange={(e) => setDocToGenerate({ ...docToGenerate, address: e.target.value })}
                        className="w-full px-4 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm resize-none"
                        placeholder="Full permanent address"
                      />
                    </div>
                  </div>
                )}

                {/* Experience Letter Fields */}
                {docToGenerate.type === 'experience_letter' && (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Relieving Date</label>
                      <input
                        type="date"
                        required
                        value={docToGenerate.relieving_date}
                        onChange={(e) => setDocToGenerate({ ...docToGenerate, relieving_date: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* Joining Form Specific Fields */}
                {docToGenerate.type === 'joining_form' && (
                  <div className="space-y-5 pt-1 border-t border-slate-100">
                    {/* Header Info Group */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-4">
                      <h4 className="text-xs font-semibold text-slate-700 border-b border-slate-200 pb-2 mb-2">Form header details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Department</label>
                          <input
                            type="text"
                            required
                            value={docToGenerate.department}
                            onChange={(e) => setDocToGenerate({ ...docToGenerate, department: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                            placeholder="e.g. Sales"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Joining</label>
                          <input
                            type="date"
                            required
                            value={docToGenerate.joining_date}
                            onChange={(e) => setDocToGenerate({ ...docToGenerate, joining_date: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Personal Info Group */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-4">
                      <h4 className="text-xs font-semibold text-slate-700 border-b border-slate-200 pb-2 mb-2">Personal information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Father\'s Name</label>
                          <input
                            type="text"
                            required
                            value={docToGenerate.father_name}
                            onChange={(e) => setDocToGenerate({ ...docToGenerate, father_name: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
                          <input
                            type="date"
                            required
                            value={docToGenerate.dob}
                            onChange={(e) => setDocToGenerate({ ...docToGenerate, dob: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Gender</label>
                          <select
                            value={docToGenerate.gender}
                            onChange={(e) => setDocToGenerate({ ...docToGenerate, gender: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Marital Status</label>
                          <select
                            value={docToGenerate.marital_status}
                            onChange={(e) => setDocToGenerate({ ...docToGenerate, marital_status: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                          >
                            <option value="single">Single</option>
                            <option value="married">Married</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Contact Number</label>
                          <input
                            type="text"
                            required
                            value={docToGenerate.phone}
                            onChange={(e) => setDocToGenerate({ ...docToGenerate, phone: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                            placeholder="Candidate Contact"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email ID</label>
                          <input
                            type="email"
                            required
                            value={docToGenerate.email}
                            onChange={(e) => setDocToGenerate({ ...docToGenerate, email: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                            placeholder="Candidate Email"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Permanent Address</label>
                        <textarea
                          required
                          rows="2"
                          value={docToGenerate.permanent_address}
                          onChange={(e) => setDocToGenerate({ ...docToGenerate, permanent_address: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                          placeholder="As per documents"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Address</label>
                        <textarea
                          required
                          rows="2"
                          value={docToGenerate.address}
                          onChange={(e) => setDocToGenerate({ ...docToGenerate, address: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                          placeholder="Current residential address"
                        />
                      </div>
                    </div>

                    {/* Education Detail Group */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                        <h4 className="text-xs font-semibold text-slate-700">Educational details</h4>
                        <button
                          type="button"
                          onClick={() => addRow('education', { qual: '', univ: '', year: '', perc: '' })}
                          className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg font-medium"
                        >+ Add Row</button>
                      </div>
                      <div className="space-y-3">
                        {docToGenerate.education.map((edu, idx) => (
                          <div key={idx} className="grid grid-cols-4 gap-2 relative group pt-1">
                            <input
                              placeholder="Qual"
                              value={edu.qual}
                              onChange={(e) => handleDynamicChange(idx, 'qual', e.target.value, 'education')}
                              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            />
                            <input
                              placeholder="Univ/Board"
                              value={edu.univ}
                              onChange={(e) => handleDynamicChange(idx, 'univ', e.target.value, 'education')}
                              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            />
                            <input
                              placeholder="Year"
                              value={edu.year}
                              onChange={(e) => handleDynamicChange(idx, 'year', e.target.value, 'education')}
                              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            />
                            <div className="flex items-center space-x-1">
                              <input
                                placeholder="%"
                                value={edu.perc}
                                onChange={(e) => handleDynamicChange(idx, 'perc', e.target.value, 'education')}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                              />
                              {docToGenerate.education.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeRow(idx, 'education')}
                                  className="text-red-500 hover:text-red-700"
                                ><i className="fas fa-trash-alt text-[10px]"></i></button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Employment History Group */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                        <h4 className="text-xs font-semibold text-slate-700">Employment history (if any)</h4>
                        <button
                          type="button"
                          onClick={() => addRow('employment', { comp: '', desig: '', dur: '', reason: '' })}
                          className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg font-medium"
                        >+ Add Row</button>
                      </div>
                      <div className="space-y-3">
                        {docToGenerate.employment.map((emp, idx) => (
                          <div key={idx} className="space-y-2 pb-2 border-b border-slate-100 last:border-0 relative">
                            {docToGenerate.employment.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRow(idx, 'employment')}
                                className="absolute -right-1 -top-1 text-red-500 hover:text-red-700"
                              ><i className="fas fa-trash-alt text-[10px]"></i></button>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                placeholder="Company Name"
                                value={emp.comp}
                                onChange={(e) => handleDynamicChange(idx, 'comp', e.target.value, 'employment')}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                              />
                              <input
                                placeholder="Designation"
                                value={emp.desig}
                                onChange={(e) => handleDynamicChange(idx, 'desig', e.target.value, 'employment')}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                placeholder="Duration"
                                value={emp.dur}
                                onChange={(e) => handleDynamicChange(idx, 'dur', e.target.value, 'employment')}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                              />
                              <input
                                placeholder="Reason for Leaving"
                                value={emp.reason}
                                onChange={(e) => handleDynamicChange(idx, 'reason', e.target.value, 'employment')}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Documents Submitted Group */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-4">
                      <h4 className="text-xs font-semibold text-slate-700 border-b border-slate-200 pb-2 mb-2">Documents submitted</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {['Resume', 'ID Proof', 'Address Proof', 'Certificates', 'Photos (2)'].map((doc) => {
                          const key = `docs_${doc.toLowerCase().split(' ')[0]}`;
                          return (
                            <label key={doc} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={docToGenerate[key]}
                                onChange={(e) => setDocToGenerate({ ...docToGenerate, [key]: e.target.checked })}
                                className="w-3 h-3 text-blue-600 rounded"
                              />
                              <span className="text-sm font-medium text-slate-600">{doc}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Others</label>
                        <input
                          type="text"
                          value={docToGenerate.docs_others}
                          onChange={(e) => setDocToGenerate({ ...docToGenerate, docs_others: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                          placeholder="e.g. Relieving Letter"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-5 py-2.5 text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm shadow-sm flex items-center gap-2 transition-colors"
                >
                  <i className="fas fa-file-pdf text-sm"></i>
                  Generate PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
