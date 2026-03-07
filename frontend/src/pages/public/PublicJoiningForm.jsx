import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../styles/public-joining-form.css';
import letterHeadBg from '../../assets/letter-head.png';

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
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

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

    const pageStyle = {
        '--letterhead-url': `url(${letterHeadBg})`
    };

    return (
        <div className="joining-public-page">
            <div className="joining-public-actions no-print">
                <button
                    type="button"
                    className="joining-public-btn joining-public-btn-secondary"
                    onClick={() => window.print()}
                >
                    Print A4 Form
                </button>
            </div>

            <div className="joining-public-sheet" style={pageStyle}>
                <form onSubmit={handleSubmit} className="joining-public-form">
                    <header className="joining-public-header">
                        <h1>Employee Joining Form</h1>
                        <p>Candidate Information and Document Checklist</p>
                    </header>

                    <section className="joining-public-section">
                        <h2>Official Details</h2>
                        <div className="joining-public-grid">
                            <label>
                                <span>Company Name</span>
                                <input type="text" name="company_name" value={formData.company_name} readOnly />
                            </label>
                            <label>
                                <span>Department</span>
                                <input type="text" name="department" value={formData.department} onChange={handleChange} required />
                            </label>
                            <label>
                                <span>Designation</span>
                                <input type="text" name="designation" value={formData.designation} onChange={handleChange} required />
                            </label>
                            <label>
                                <span>Date of Joining</span>
                                <input type="date" name="joining_date" value={formData.joining_date} onChange={handleChange} required />
                            </label>
                        </div>
                    </section>

                    <section className="joining-public-section">
                        <h2>Personal Details</h2>
                        <div className="joining-public-grid">
                            <label>
                                <span>Full Name</span>
                                <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} required />
                            </label>
                            <label>
                                <span>Father&apos;s / Mother&apos;s Name</span>
                                <input type="text" name="father_mother_name" value={formData.father_mother_name} onChange={handleChange} />
                            </label>
                            <label>
                                <span>Date of Birth</span>
                                <input type="date" name="dob" value={formData.dob} onChange={handleChange} />
                            </label>
                            <label>
                                <span>Gender</span>
                                <select name="gender" value={formData.gender} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </label>
                            <label>
                                <span>Marital Status</span>
                                <select name="marital_status" value={formData.marital_status} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="Single">Single</option>
                                    <option value="Married">Married</option>
                                </select>
                            </label>
                            <label>
                                <span>Contact Number</span>
                                <input type="tel" name="contact_number" value={formData.contact_number} onChange={handleChange} required />
                            </label>
                            <label className="joining-public-span-2">
                                <span>Email ID</span>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                            </label>
                            <label className="joining-public-span-2">
                                <span>Permanent Address</span>
                                <input type="text" name="permanent_address" value={formData.permanent_address} onChange={handleChange} />
                            </label>
                            <label className="joining-public-span-2">
                                <span>Current Address</span>
                                <input type="text" name="current_address" value={formData.current_address} onChange={handleChange} />
                            </label>
                        </div>
                    </section>

                    <section className="joining-public-section">
                        <div className="joining-public-section-head">
                            <h2>Educational Details</h2>
                            <button type="button" className="joining-public-link-btn no-print" onClick={addEducationRow}>+ Add Row</button>
                        </div>
                        <table className="joining-public-table">
                            <thead>
                                <tr>
                                    <th>Qualification</th>
                                    <th>University / Board</th>
                                    <th>Year of Passing</th>
                                    <th>Percentage / Grade</th>
                                    <th className="no-print">Remove</th>
                                </tr>
                            </thead>
                            <tbody>
                                {education.map((row, index) => (
                                    <tr key={index}>
                                        <td><input value={row.degree} onChange={(e) => handleEducationChange(index, 'degree', e.target.value)} /></td>
                                        <td><input value={row.institution} onChange={(e) => handleEducationChange(index, 'institution', e.target.value)} /></td>
                                        <td><input value={row.year} onChange={(e) => handleEducationChange(index, 'year', e.target.value)} /></td>
                                        <td><input value={row.percentage} onChange={(e) => handleEducationChange(index, 'percentage', e.target.value)} /></td>
                                        <td className="joining-public-cell-center no-print">
                                            {education.length > 1 && (
                                                <button type="button" className="joining-public-remove-btn" onClick={() => removeEducationRow(index)}>X</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    <section className="joining-public-section">
                        <div className="joining-public-section-head">
                            <h2>Employment History (If Any)</h2>
                            <button type="button" className="joining-public-link-btn no-print" onClick={addEmploymentRow}>+ Add Row</button>
                        </div>
                        <table className="joining-public-table">
                            <thead>
                                <tr>
                                    <th>Company Name</th>
                                    <th>Designation</th>
                                    <th>From</th>
                                    <th>To</th>
                                    <th>Reason for Leaving</th>
                                    <th className="no-print">Remove</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employment.map((row, index) => (
                                    <tr key={index}>
                                        <td><input value={row.company} onChange={(e) => handleEmploymentChange(index, 'company', e.target.value)} /></td>
                                        <td><input value={row.designation} onChange={(e) => handleEmploymentChange(index, 'designation', e.target.value)} /></td>
                                        <td><input type="date" value={row.from_date} onChange={(e) => handleEmploymentChange(index, 'from_date', e.target.value)} /></td>
                                        <td><input type="date" value={row.to_date} onChange={(e) => handleEmploymentChange(index, 'to_date', e.target.value)} /></td>
                                        <td><input value={row.reason} onChange={(e) => handleEmploymentChange(index, 'reason', e.target.value)} /></td>
                                        <td className="joining-public-cell-center no-print">
                                            {employment.length > 1 && (
                                                <button type="button" className="joining-public-remove-btn" onClick={() => removeEmploymentRow(index)}>X</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    <section className="joining-public-section">
                        <h2>Documents Submitted</h2>
                        <div className="joining-public-docs-grid">
                            <label><input type="checkbox" name="docs_resume" checked={formData.docs_resume} onChange={handleChange} /> Resume</label>
                            <label><input type="checkbox" name="docs_id" checked={formData.docs_id} onChange={handleChange} /> ID Proof</label>
                            <label><input type="checkbox" name="docs_address" checked={formData.docs_address} onChange={handleChange} /> Address Proof</label>
                            <label><input type="checkbox" name="docs_certificates" checked={formData.docs_certificates} onChange={handleChange} /> Certificates</label>
                            <label><input type="checkbox" name="docs_photos" checked={formData.docs_photos} onChange={handleChange} /> Photos (2)</label>
                            <label className="joining-public-span-2">
                                <span>Others</span>
                                <input type="text" name="docs_others" value={formData.docs_others} onChange={handleChange} />
                            </label>
                        </div>
                    </section>

                    <section className="joining-public-section">
                        <h2>Declaration</h2>
                        <p className="joining-public-declaration">
                            I hereby declare that all the information provided in this form is true and complete to the best of my knowledge.
                            I understand that any false information may result in rejection or termination of employment.
                        </p>

                        <div className="joining-public-grid">
                            <label>
                                <span>Candidate Signature</span>
                                <input type="text" placeholder="Digital Signature Placeholder" readOnly />
                            </label>
                            <label>
                                <span>Candidate Signature Date</span>
                                <input
                                    type="date"
                                    name="candidate_signature_date"
                                    value={formData.candidate_signature_date}
                                    onChange={handleChange}
                                />
                            </label>
                            <label>
                                <span>Verified By (HR)</span>
                                <input type="text" disabled placeholder="For office use only" />
                            </label>
                            <label>
                                <span>HR Signature Date</span>
                                <input type="date" name="hr_signature_date" value={formData.hr_signature_date} onChange={handleChange} />
                            </label>
                        </div>
                    </section>

                    <div className="joining-public-actions no-print">
                        <button type="submit" className="joining-public-btn">Submit Form</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
