import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';

export default function DocumentGenerator() {
    const { employeeId } = useParams();
    const navigate = useNavigate();
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);

    // Form State
    const [offerData, setOfferData] = useState({
        type: 'offer_letter',
        designation: '',
        joining_date: '',
        ctc: '',
        address: '',
        reporting_manager: '',
        relieving_date: '',
        department: '',
        father_name: '',
        dob: '',
        gender: 'male',
        marital_status: 'single',
        phone: '',
        email: '',
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

    useEffect(() => {
        fetchEmployeeDetails();
    }, [employeeId]);

    const fetchEmployeeDetails = async () => {
        try {
            setLoading(true);
            const { data } = await api.get(`/admin/employees?id=${employeeId}`);
            if (data.success) {
                const emp = data.employee;
                setEmployee(emp);

                // Pre-fill data
                setOfferData(prev => ({
                    ...prev,
                    designation: emp.designation || '',
                    email: emp.email || '',
                    phone: emp.phone || '',
                    address: emp.address || '',
                    department: emp.department_name || '',
                    joining_date: emp.created_at ? emp.created_at.split('T')[0] : ''
                }));
            } else {
                alert('Failed to fetch employee details');
                navigate('/admin/employees');
            }
        } catch (error) {
            console.error('Error fetching employee:', error);
            alert('Error loading employee details');
        } finally {
            setLoading(false);
        }
    };

    const handleDynamicChange = (index, field, value, type) => {
        const updated = [...offerData[type]];
        updated[index][field] = value;
        setOfferData({ ...offerData, [type]: updated });
    };

    const addRow = (type, template) => {
        setOfferData({ ...offerData, [type]: [...offerData[type], template] });
    };

    const removeRow = (index, type) => {
        if (offerData[type].length > 1) {
            setOfferData({ ...offerData, [type]: offerData[type].filter((_, i) => i !== index) });
        }
    };

    const handleGenerateOffer = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                employee_id: employeeId,
                ...offerData
            };

            const response = await api.post('/admin/generate_offer_letter', payload);
            if (response.data.success) {
                alert('Document generated successfully!');
                navigate('/admin/employees');
            } else {
                alert('Failed to generate document: ' + response.data.message);
            }
        } catch (error) {
            console.error('Error generating document:', error);
            alert('An error occurred while generating the document.');
        }
    };

    if (loading) return <div className="p-10 text-center">Loading employee details...</div>;
    if (!employee) return <div className="p-10 text-center">Employee not found</div>;

    return (
        <div className="bg-gray-50 min-h-screen p-6 sm:p-10">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-800 to-indigo-900 px-8 py-6 flex justify-between items-center text-white">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Generate Professional Document</h1>
                        <p className="text-blue-200 text-sm mt-1 uppercase tracking-wider font-semibold">
                            For: {employee.name} <span className="text-blue-300 mx-2">|</span> {employee.employee_code || 'N/A'}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/admin/employees')}
                        className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                    >
                        <i className="fas fa-times text-lg"></i>
                    </button>
                </div>

                <form onSubmit={handleGenerateOffer} className="p-8 space-y-8">

                    {/* Document Type Selection */}
                    <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                        <label className="block text-xs font-black text-blue-800 uppercase tracking-widest mb-2">Select Document Type</label>
                        <select
                            required
                            value={offerData.type}
                            onChange={(e) => setOfferData({ ...offerData, type: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold text-gray-700 shadow-sm"
                        >
                            <option value="offer_letter">Offer Letter</option>
                            <option value="experience_letter">Experience Letter</option>
                            <option value="joining_form">Joining Form</option>
                        </select>
                    </div>

                    <div className="space-y-6">

                        {/* Offer Letter Fields */}
                        {offerData.type === 'offer_letter' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="md:col-span-2">
                                    <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">Offer Details</h3>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Designation</label>
                                    <input
                                        type="text"
                                        required
                                        value={offerData.designation}
                                        onChange={(e) => setOfferData({ ...offerData, designation: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Annual CTC (₹)</label>
                                    <input
                                        type="number"
                                        required
                                        value={offerData.ctc}
                                        onChange={(e) => setOfferData({ ...offerData, ctc: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Joining Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={offerData.joining_date}
                                        onChange={(e) => setOfferData({ ...offerData, joining_date: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reporting Manager</label>
                                    <input
                                        type="text"
                                        value={offerData.reporting_manager}
                                        onChange={(e) => setOfferData({ ...offerData, reporting_manager: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Candidate Address</label>
                                    <textarea
                                        required
                                        rows="2"
                                        value={offerData.address}
                                        onChange={(e) => setOfferData({ ...offerData, address: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Experience Letter Fields */}
                        {offerData.type === 'experience_letter' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Relieving Date</label>
                                <input
                                    type="date"
                                    required
                                    value={offerData.relieving_date}
                                    onChange={(e) => setOfferData({ ...offerData, relieving_date: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold"
                                />
                            </div>
                        )}

                        {/* Joining Form Specific Fields */}
                        {offerData.type === 'joining_form' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Header Info Group */}
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b border-blue-100 pb-2 mb-2">Form Header Details</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Department</label>
                                            <input
                                                type="text"
                                                required
                                                value={offerData.department}
                                                onChange={(e) => setOfferData({ ...offerData, department: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                                placeholder="e.g. Sales"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Date of Joining</label>
                                            <input
                                                type="date"
                                                required
                                                value={offerData.joining_date}
                                                onChange={(e) => setOfferData({ ...offerData, joining_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Personal Info Group */}
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b border-blue-100 pb-2 mb-2">Personal Information</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Father's / Mother's Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={offerData.father_name}
                                                onChange={(e) => setOfferData({ ...offerData, father_name: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Date of Birth</label>
                                            <input
                                                type="date"
                                                required
                                                value={offerData.dob}
                                                onChange={(e) => setOfferData({ ...offerData, dob: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Gender</label>
                                            <select
                                                value={offerData.gender}
                                                onChange={(e) => setOfferData({ ...offerData, gender: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                            >
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Marital Status</label>
                                            <select
                                                value={offerData.marital_status}
                                                onChange={(e) => setOfferData({ ...offerData, marital_status: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                            >
                                                <option value="single">Single</option>
                                                <option value="married">Married</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Contact Number</label>
                                            <input
                                                type="text"
                                                required
                                                value={offerData.phone}
                                                onChange={(e) => setOfferData({ ...offerData, phone: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                                placeholder="Candidate Contact"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Email ID</label>
                                            <input
                                                type="email"
                                                required
                                                value={offerData.email}
                                                onChange={(e) => setOfferData({ ...offerData, email: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                                placeholder="Candidate Email"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Permanent Address</label>
                                            <textarea
                                                required
                                                rows="2"
                                                value={offerData.permanent_address}
                                                onChange={(e) => setOfferData({ ...offerData, permanent_address: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Current Address</label>
                                            <textarea
                                                required
                                                rows="2"
                                                value={offerData.address}
                                                onChange={(e) => setOfferData({ ...offerData, address: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Education Detail Group */}
                                <div className="p-4 bg-blue-50/30 rounded-2xl border border-blue-100 space-y-4">
                                    <div className="flex justify-between items-center border-b border-blue-100 pb-2 mb-2">
                                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Educational Details</h4>
                                        <button
                                            type="button"
                                            onClick={() => addRow('education', { qual: '', univ: '', year: '', perc: '' })}
                                            className="text-[9px] bg-blue-600 text-white px-2 py-1 rounded-md font-bold"
                                        >+ Add Row</button>
                                    </div>
                                    <div className="space-y-3">
                                        {offerData.education.map((edu, idx) => (
                                            <div key={idx} className="grid grid-cols-4 gap-2 relative group pt-1">
                                                <input
                                                    placeholder="Qual"
                                                    value={edu.qual}
                                                    onChange={(e) => handleDynamicChange(idx, 'qual', e.target.value, 'education')}
                                                    className="px-2 py-1.5 border border-gray-200 rounded text-[10px] font-bold"
                                                />
                                                <input
                                                    placeholder="Univ/Board"
                                                    value={edu.univ}
                                                    onChange={(e) => handleDynamicChange(idx, 'univ', e.target.value, 'education')}
                                                    className="px-2 py-1.5 border border-gray-200 rounded text-[10px] font-bold"
                                                />
                                                <input
                                                    placeholder="Year"
                                                    value={edu.year}
                                                    onChange={(e) => handleDynamicChange(idx, 'year', e.target.value, 'education')}
                                                    className="px-2 py-1.5 border border-gray-200 rounded text-[10px] font-bold"
                                                />
                                                <div className="flex items-center space-x-1">
                                                    <input
                                                        placeholder="%"
                                                        value={edu.perc}
                                                        onChange={(e) => handleDynamicChange(idx, 'perc', e.target.value, 'education')}
                                                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-[10px] font-bold"
                                                    />
                                                    {offerData.education.length > 1 && (
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
                                <div className="p-4 bg-orange-50/30 rounded-2xl border border-orange-100 space-y-4">
                                    <div className="flex justify-between items-center border-b border-orange-100 pb-2 mb-2">
                                        <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Employment History (if any)</h4>
                                        <button
                                            type="button"
                                            onClick={() => addRow('employment', { comp: '', desig: '', dur: '', reason: '' })}
                                            className="text-[9px] bg-orange-600 text-white px-2 py-1 rounded-md font-bold"
                                        >+ Add Row</button>
                                    </div>
                                    <div className="space-y-3">
                                        {offerData.employment.map((emp, idx) => (
                                            <div key={idx} className="space-y-2 pb-2 border-b border-orange-50 last:border-0 relative">
                                                {offerData.employment.length > 1 && (
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
                                                        className="px-2 py-1.5 border border-gray-200 rounded text-[10px] font-bold"
                                                    />
                                                    <input
                                                        placeholder="Designation"
                                                        value={emp.desig}
                                                        onChange={(e) => handleDynamicChange(idx, 'desig', e.target.value, 'employment')}
                                                        className="px-2 py-1.5 border border-gray-200 rounded text-[10px] font-bold"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        placeholder="Duration"
                                                        value={emp.dur}
                                                        onChange={(e) => handleDynamicChange(idx, 'dur', e.target.value, 'employment')}
                                                        className="px-2 py-1.5 border border-gray-200 rounded text-[10px] font-bold"
                                                    />
                                                    <input
                                                        placeholder="Reason for Leaving"
                                                        value={emp.reason}
                                                        onChange={(e) => handleDynamicChange(idx, 'reason', e.target.value, 'employment')}
                                                        className="px-2 py-1.5 border border-gray-200 rounded text-[10px] font-bold"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Documents Submitted Group */}
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-200 pb-2 mb-2">Documents Submitted</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Resume', 'ID Proof', 'Address Proof', 'Certificates', 'Photos (2)'].map((doc) => {
                                            const key = `docs_${doc.toLowerCase().split(' ')[0]}`;
                                            return (
                                                <label key={doc} className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={offerData[key]}
                                                        onChange={(e) => setOfferData({ ...offerData, [key]: e.target.checked })}
                                                        className="w-3 h-3 text-blue-600 rounded"
                                                    />
                                                    <span className="text-[10px] font-bold text-gray-600">{doc}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Others</label>
                                        <input
                                            type="text"
                                            value={offerData.docs_others}
                                            onChange={(e) => setOfferData({ ...offerData, docs_others: e.target.value })}
                                            className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-[10px] font-bold"
                                            placeholder="e.g. Relieving Letter"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    <div className="pt-6 border-t border-gray-100 flex justify-end space-x-4">
                        <button
                            type="button"
                            onClick={() => navigate('/admin/employees')}
                            className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors uppercase text-xs tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-1"
                        >
                            Generate Document
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
