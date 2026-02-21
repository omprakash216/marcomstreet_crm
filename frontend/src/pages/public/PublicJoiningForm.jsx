import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function PublicJoiningForm() {
    const [searchParams] = useSearchParams();
    const tokenFromUrl = searchParams.get('token');

    const [formData, setFormData] = useState({
        token: tokenFromUrl || '',
        company_name: 'Vanya Group',
        department: '',
        designation: '',
        joining_date: '',

        full_name: '',
        father_mother_name: '',
        dob: '',
        gender: '',
        marital_status: '',
        contact_number: '',
        email: '',
        permanent_address: '',
        current_address: '',

        docs_resume: false,
        docs_id: false,
        docs_address: false,
        docs_certificates: false,
        docs_photos: false,
        docs_others: '',

        candidate_signature_date: new Date().toISOString().split('T')[0],
        hr_signature_date: ''
    });

    const [education, setEducation] = useState([
        { degree: '', institution: '', year: '', percentage: '' }
    ]);

    const [employment, setEmployment] = useState([
        { company: '', designation: '', from_date: '', to_date: '', reason: '' }
    ]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Dynamic Row Handlers for Education
    const handleEducationChange = (index, field, value) => {
        const updated = [...education];
        updated[index][field] = value;
        setEducation(updated);
    };

    const addEducationRow = () => {
        setEducation([...education, { degree: '', institution: '', year: '', percentage: '' }]);
    };

    const removeEducationRow = (index) => {
        if (education.length > 1) {
            setEducation(education.filter((_, i) => i !== index));
        }
    };

    // Dynamic Row Handlers for Employment
    const handleEmploymentChange = (index, field, value) => {
        const updated = [...employment];
        updated[index][field] = value;
        setEmployment(updated);
    };

    const addEmploymentRow = () => {
        setEmployment([...employment, { company: '', designation: '', from_date: '', to_date: '', reason: '' }]);
    };

    const removeEmploymentRow = (index) => {
        if (employment.length > 1) {
            setEmployment(employment.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            education,
            employment
        };
        console.log('Form Data JSON:', JSON.stringify(payload, null, 2));
        alert('Form data logged to console (Simulation). In production, this would POST to the backend.');
    };

    return (
        <div className="bg-gray-100 p-6 min-h-screen font-sans">
            <div className="max-w-4xl mx-auto bg-white p-8 border border-gray-400 shadow-md">

                {/* Header */}
                <div className="border-b border-gray-300 pb-3 mb-6">
                    <h1 className="text-2xl font-bold uppercase text-gray-800">Vanya Group</h1>
                </div>

                <h2 className="text-lg font-semibold mb-4 uppercase text-gray-700">Employee Joining Form</h2>

                <form onSubmit={handleSubmit}>
                    {/* Company Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="font-semibold block text-sm text-gray-700">Company Name:</label>
                            <input
                                type="text"
                                name="company_name"
                                value={formData.company_name}
                                readOnly
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent"
                            />
                        </div>
                        <div>
                            <label className="font-semibold block text-sm text-gray-700">Department:</label>
                            <input
                                type="text"
                                name="department"
                                value={formData.department}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors"
                                required
                            />
                        </div>
                        <div>
                            <label className="font-semibold block text-sm text-gray-700">Designation:</label>
                            <input
                                type="text"
                                name="designation"
                                value={formData.designation}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors"
                                required
                            />
                        </div>
                        <div>
                            <label className="font-semibold block text-sm text-gray-700">Date of Joining:</label>
                            <input
                                type="date"
                                name="joining_date"
                                value={formData.joining_date}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors"
                                required
                            />
                        </div>
                    </div>

                    {/* Personal Details */}
                    <h3 className="font-semibold text-md mb-3 uppercase border-b border-gray-300 pb-1 text-gray-700">Personal Details</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm text-gray-600">Full Name:</label>
                            <input
                                type="text"
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600">Father’s / Mother’s Name:</label>
                            <input
                                type="text"
                                name="father_mother_name"
                                value={formData.father_mother_name}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600">Date of Birth:</label>
                            <input
                                type="date"
                                name="dob"
                                value={formData.dob}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600">Gender:</label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors appearance-none"
                            >
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600">Marital Status:</label>
                            <select
                                name="marital_status"
                                value={formData.marital_status}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors appearance-none"
                            >
                                <option value="">Select</option>
                                <option value="Single">Single</option>
                                <option value="Married">Married</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600">Contact Number:</label>
                            <input
                                type="tel"
                                name="contact_number"
                                value={formData.contact_number}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors"
                                required
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-gray-600">Email ID:</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors"
                                required
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-gray-600">Permanent Address:</label>
                            <input
                                type="text"
                                name="permanent_address"
                                value={formData.permanent_address}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-gray-600">Current Address:</label>
                            <input
                                type="text"
                                name="current_address"
                                value={formData.current_address}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 text-gray-900 bg-transparent focus:border-black transition-colors"
                            />
                        </div>
                    </div>

                    {/* Educational Details */}
                    <div className="flex justify-between items-center border-b border-gray-300 pb-1 mb-3">
                        <h3 className="font-semibold text-md uppercase text-gray-700">Educational Details</h3>
                        <button type="button" onClick={addEducationRow} className="text-blue-600 text-xs font-bold hover:underline">+ Add Row</button>
                    </div>

                    <table className="w-full border border-gray-400 mb-6 text-sm">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="border border-gray-400 p-2 text-left font-semibold text-gray-700">Qualification</th>
                                <th className="border border-gray-400 p-2 text-left font-semibold text-gray-700">University / Board</th>
                                <th className="border border-gray-400 p-2 text-left font-semibold text-gray-700">Year of Passing</th>
                                <th className="border border-gray-400 p-2 text-left font-semibold text-gray-700">Percentage / Grade</th>
                                <th className="border border-gray-400 p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {education.map((row, index) => (
                                <tr key={index}>
                                    <td className="border border-gray-400 p-2">
                                        <input
                                            className="w-full outline-none bg-transparent"
                                            value={row.degree}
                                            onChange={(e) => handleEducationChange(index, 'degree', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <input
                                            className="w-full outline-none bg-transparent"
                                            value={row.institution}
                                            onChange={(e) => handleEducationChange(index, 'institution', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <input
                                            className="w-full outline-none bg-transparent"
                                            value={row.year}
                                            onChange={(e) => handleEducationChange(index, 'year', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <input
                                            className="w-full outline-none bg-transparent"
                                            value={row.percentage}
                                            onChange={(e) => handleEducationChange(index, 'percentage', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2 text-center">
                                        {education.length > 1 && (
                                            <button type="button" onClick={() => removeEducationRow(index)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Employment History */}
                    <div className="flex justify-between items-center border-b border-gray-300 pb-1 mb-3">
                        <h3 className="font-semibold text-md uppercase text-gray-700">Employment History (If Any)</h3>
                        <button type="button" onClick={addEmploymentRow} className="text-blue-600 text-xs font-bold hover:underline">+ Add Row</button>
                    </div>

                    <table className="w-full border border-gray-400 mb-6 text-sm">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="border border-gray-400 p-2 text-left font-semibold text-gray-700">Company Name</th>
                                <th className="border border-gray-400 p-2 text-left font-semibold text-gray-700">Designation</th>
                                <th className="border border-gray-400 p-2 text-left font-semibold text-gray-700 w-24">From</th>
                                <th className="border border-gray-400 p-2 text-left font-semibold text-gray-700 w-24">To</th>
                                <th className="border border-gray-400 p-2 text-left font-semibold text-gray-700">Reason for Leaving</th>
                                <th className="border border-gray-400 p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {employment.map((row, index) => (
                                <tr key={index}>
                                    <td className="border border-gray-400 p-2">
                                        <input
                                            className="w-full outline-none bg-transparent"
                                            value={row.company}
                                            onChange={(e) => handleEmploymentChange(index, 'company', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <input
                                            className="w-full outline-none bg-transparent"
                                            value={row.designation}
                                            onChange={(e) => handleEmploymentChange(index, 'designation', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <input
                                            type="date"
                                            className="w-full outline-none bg-transparent text-xs"
                                            value={row.from_date}
                                            onChange={(e) => handleEmploymentChange(index, 'from_date', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <input
                                            type="date"
                                            className="w-full outline-none bg-transparent text-xs"
                                            value={row.to_date}
                                            onChange={(e) => handleEmploymentChange(index, 'to_date', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <input
                                            className="w-full outline-none bg-transparent"
                                            value={row.reason}
                                            onChange={(e) => handleEmploymentChange(index, 'reason', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2 text-center">
                                        {employment.length > 1 && (
                                            <button type="button" onClick={() => removeEmploymentRow(index)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Documents Submitted */}
                    <h3 className="font-semibold text-md mb-3 uppercase border-b border-gray-300 pb-1 text-gray-700">Documents Submitted</h3>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 text-sm text-gray-700">
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" name="docs_resume" checked={formData.docs_resume} onChange={handleChange} className="accent-black" />
                            <span>Resume</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" name="docs_id" checked={formData.docs_id} onChange={handleChange} className="accent-black" />
                            <span>ID Proof</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" name="docs_address" checked={formData.docs_address} onChange={handleChange} className="accent-black" />
                            <span>Address Proof</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" name="docs_certificates" checked={formData.docs_certificates} onChange={handleChange} className="accent-black" />
                            <span>Certificates</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" name="docs_photos" checked={formData.docs_photos} onChange={handleChange} className="accent-black" />
                            <span>Photos (2)</span>
                        </label>
                        <label className="col-span-1 md:col-span-3 flex items-center space-x-2">
                            <span className="whitespace-nowrap">Others:</span>
                            <input
                                type="text"
                                name="docs_others"
                                value={formData.docs_others}
                                onChange={handleChange}
                                className="border-b border-gray-400 outline-none w-full bg-transparent focus:border-black transition-colors"
                            />
                        </label>
                    </div>

                    {/* Declaration */}
                    <h3 className="font-semibold text-md mb-3 uppercase border-b border-gray-300 pb-1 text-gray-700">Declaration</h3>

                    <p className="text-sm mb-6 text-gray-700 leading-relaxed text-justify">
                        I hereby declare that the above information is true to the best of my knowledge and belief.
                        I understand that any false information may lead to termination of employment.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-sm">
                        <div>
                            <label className="block text-gray-600 mb-1">Signature of Candidate:</label>
                            <input type="text" className="w-full border-b border-gray-400 outline-none py-1 bg-transparent" placeholder="(Digital Signature Placeholder)" readOnly />

                            <label className="block mt-4 text-gray-600 mb-1">Date:</label>
                            <input
                                type="date"
                                name="candidate_signature_date"
                                value={formData.candidate_signature_date}
                                onChange={handleChange}
                                className="w-full border-b border-gray-400 outline-none py-1 bg-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-600 mb-1">Verified by (HR):</label>
                            <input type="text" className="w-full border-b border-gray-400 outline-none py-1 bg-transparent" disabled placeholder="For Office Use Only" />

                            <label className="block mt-4 text-gray-600 mb-1">Signature:</label>
                            <input type="text" className="w-full border-b border-gray-400 outline-none py-1 bg-transparent" disabled />

                            <label className="block mt-4 text-gray-600 mb-1">Date:</label>
                            <input type="date" className="w-full border-b border-gray-400 outline-none py-1 bg-transparent" disabled />
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <button
                            type="submit"
                            className="bg-black text-white px-8 py-3 uppercase font-bold tracking-widest hover:bg-gray-800 transition-colors shadow-lg"
                        >
                            Submit Form
                        </button>
                    </div>

                </form>

            </div>
        </div>
    );
}
