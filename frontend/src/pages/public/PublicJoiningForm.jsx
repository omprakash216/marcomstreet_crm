import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import '../../styles/public-joining-form.css';
import letterHeadBg from '../../assets/letter-head.png';

const todayYmd = () => new Date().toISOString().split('T')[0];

const createEmptyEducationRow = () => ({ degree: '', institution: '', year: '', percentage: '' });
const createEmptyEmploymentRow = () => ({ company: '', designation: '', from_date: '', to_date: '', reason: '' });

const createInitialFormData = (token = '', companyName = 'Vanya Group') => ({
  token,
  company_name: companyName || 'Vanya Group',
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
  candidate_signature_date: todayYmd(),
  hr_signature_date: '',
});

const normalizeText = (value) => String(value ?? '').trim();

const normalizeBoolean = (value) => value === true || value === 1 || value === '1' || value === 'true' || value === 'on' || value === 'yes';

const normalizeEducationRows = (rows) => {
  const list = Array.isArray(rows) && rows.length > 0 ? rows : [createEmptyEducationRow()];
  return list.map((row) => ({
    degree: normalizeText(row?.degree || row?.qual || ''),
    institution: normalizeText(row?.institution || row?.univ || ''),
    year: normalizeText(row?.year || ''),
    percentage: normalizeText(row?.percentage || row?.perc || ''),
  }));
};

const normalizeEmploymentRows = (rows) => {
  const list = Array.isArray(rows) && rows.length > 0 ? rows : [createEmptyEmploymentRow()];
  return list.map((row) => ({
    company: normalizeText(row?.company || row?.comp || ''),
    designation: normalizeText(row?.designation || row?.desig || ''),
    from_date: normalizeText(row?.from_date || ''),
    to_date: normalizeText(row?.to_date || ''),
    reason: normalizeText(row?.reason || row?.dur || ''),
  }));
};

const mapSnapshotToFormData = (snapshot = {}, token = '') => ({
  ...createInitialFormData(token, snapshot.company_name || 'Vanya Group'),
  token,
  company_name: normalizeText(snapshot.company_name || 'Vanya Group'),
  department: normalizeText(snapshot.department),
  designation: normalizeText(snapshot.designation),
  joining_date: normalizeText(snapshot.joining_date),
  full_name: normalizeText(snapshot.full_name),
  father_mother_name: normalizeText(snapshot.father_mother_name),
  dob: normalizeText(snapshot.dob),
  gender: normalizeText(snapshot.gender),
  marital_status: normalizeText(snapshot.marital_status),
  contact_number: normalizeText(snapshot.contact_number),
  email: normalizeText(snapshot.email),
  permanent_address: normalizeText(snapshot.permanent_address),
  current_address: normalizeText(snapshot.current_address),
  docs_resume: normalizeBoolean(snapshot.docs_resume),
  docs_id: normalizeBoolean(snapshot.docs_id),
  docs_address: normalizeBoolean(snapshot.docs_address),
  docs_certificates: normalizeBoolean(snapshot.docs_certificates),
  docs_photos: normalizeBoolean(snapshot.docs_photos),
  docs_others: normalizeText(snapshot.docs_others),
  candidate_signature_date: normalizeText(snapshot.candidate_signature_date) || todayYmd(),
  hr_signature_date: normalizeText(snapshot.hr_signature_date),
});

export default function PublicJoiningForm() {
  const { token: tokenFromPath = '' } = useParams();
  const [searchParams] = useSearchParams();
  const tokenFromQuery = searchParams.get('token') || '';
  const token = tokenFromPath || tokenFromQuery || '';

  const [formData, setFormData] = useState(() => createInitialFormData(token));
  const [education, setEducation] = useState([createEmptyEducationRow()]);
  const [employment, setEmployment] = useState([createEmptyEmploymentRow()]);
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadToken = async () => {
      if (!token) {
        setLoading(false);
        setLoadError('Joining token is missing.');
        setTokenInfo(null);
        setHasSubmitted(false);
        setFormData(createInitialFormData('', 'Vanya Group'));
        setEducation([createEmptyEducationRow()]);
        setEmployment([createEmptyEmploymentRow()]);
        return;
      }

      setLoading(true);
      setLoadError('');
      setSubmitMessage('');

      try {
        const response = await api.get(`/hrms/public/joining-form/${encodeURIComponent(token)}`);
        const data = response.data?.data || {};
        if (cancelled) return;

        setTokenInfo(data);
        setHasSubmitted(false);
        setFormData(mapSnapshotToFormData(data, token));
        setEducation(normalizeEducationRows(data.education));
        setEmployment(normalizeEmploymentRows(data.employment));
      } catch (error) {
        if (cancelled) return;
        setLoadError(error?.response?.data?.message || error.message || 'Unable to load joining form.');
        setTokenInfo(null);
        setHasSubmitted(false);
        setFormData(createInitialFormData(token));
        setEducation([createEmptyEducationRow()]);
        setEmployment([createEmptyEmploymentRow()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadToken();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const formLocked = Boolean(tokenInfo && tokenInfo.status && tokenInfo.status !== 'pending' && tokenInfo.has_submission);
  const submitDisabled = loading || submitting || !token || !tokenInfo || formLocked || hasSubmitted;

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleEducationChange = (index, field, value) => {
    setEducation((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const addEducationRow = () => {
    setEducation((prev) => [...prev, createEmptyEducationRow()]);
  };

  const removeEducationRow = (index) => {
    setEducation((prev) => (prev.length > 1 ? prev.filter((_, rowIndex) => rowIndex !== index) : prev));
  };

  const handleEmploymentChange = (index, field, value) => {
    setEmployment((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const addEmploymentRow = () => {
    setEmployment((prev) => [...prev, createEmptyEmploymentRow()]);
  };

  const removeEmploymentRow = (index) => {
    setEmployment((prev) => (prev.length > 1 ? prev.filter((_, rowIndex) => rowIndex !== index) : prev));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      setLoadError('Joining token is missing.');
      return;
    }
    if (formLocked) {
      setLoadError('This joining form has already been processed.');
      return;
    }

    setSubmitting(true);
    setLoadError('');
    setSubmitMessage('');

    const payload = {
      ...formData,
      token,
      education,
      employment,
    };

    try {
      const response = await api.post(`/hrms/public/joining-form/${encodeURIComponent(token)}`, payload);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to submit joining form.');
      }

      const data = response.data?.data || {};
      setTokenInfo(data);
      setHasSubmitted(true);
      setFormData(mapSnapshotToFormData(data, token));
      setEducation(normalizeEducationRows(data.education));
      setEmployment(normalizeEmploymentRows(data.employment));
      setSubmitMessage(response.data?.message || 'Form submitted successfully.');
    } catch (error) {
      setLoadError(error?.response?.data?.message || error.message || 'Failed to submit joining form.');
    } finally {
      setSubmitting(false);
    }
  };

  const pageStyle = {
    '--letterhead-url': `url(${letterHeadBg})`,
  };

  const statusMessage = formLocked
    ? `This joining form has already been ${tokenInfo?.status || 'processed'}.`
    : tokenInfo?.status === 'pending' && tokenInfo?.has_submission
      ? 'Submission saved. You can still review the data before re-submitting.'
      : '';

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
            <p>Candidate information and document checklist</p>
          </header>

          {(loading || loadError || submitMessage || statusMessage) && (
            <section className="joining-public-section no-print">
              {loading && <p className="text-sm text-blue-700">Loading joining form...</p>}
              {loadError && <p className="text-sm text-red-700">{loadError}</p>}
              {submitMessage && <p className="text-sm text-green-700">{submitMessage}</p>}
              {statusMessage && <p className="text-sm text-amber-700">{statusMessage}</p>}
            </section>
          )}

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
              <button type="button" className="joining-public-link-btn no-print" onClick={addEducationRow}>
                + Add Row
              </button>
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
                  <tr key={`edu-${index}`}>
                    <td><input value={row.degree} onChange={(event) => handleEducationChange(index, 'degree', event.target.value)} /></td>
                    <td><input value={row.institution} onChange={(event) => handleEducationChange(index, 'institution', event.target.value)} /></td>
                    <td><input value={row.year} onChange={(event) => handleEducationChange(index, 'year', event.target.value)} /></td>
                    <td><input value={row.percentage} onChange={(event) => handleEducationChange(index, 'percentage', event.target.value)} /></td>
                    <td className="joining-public-cell-center no-print">
                      {education.length > 1 && (
                        <button type="button" className="joining-public-remove-btn" onClick={() => removeEducationRow(index)}>
                          X
                        </button>
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
              <button type="button" className="joining-public-link-btn no-print" onClick={addEmploymentRow}>
                + Add Row
              </button>
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
                  <tr key={`emp-${index}`}>
                    <td><input value={row.company} onChange={(event) => handleEmploymentChange(index, 'company', event.target.value)} /></td>
                    <td><input value={row.designation} onChange={(event) => handleEmploymentChange(index, 'designation', event.target.value)} /></td>
                    <td><input type="date" value={row.from_date} onChange={(event) => handleEmploymentChange(index, 'from_date', event.target.value)} /></td>
                    <td><input type="date" value={row.to_date} onChange={(event) => handleEmploymentChange(index, 'to_date', event.target.value)} /></td>
                    <td><input value={row.reason} onChange={(event) => handleEmploymentChange(index, 'reason', event.target.value)} /></td>
                    <td className="joining-public-cell-center no-print">
                      {employment.length > 1 && (
                        <button type="button" className="joining-public-remove-btn" onClick={() => removeEmploymentRow(index)}>
                          X
                        </button>
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
            <button type="submit" className="joining-public-btn" disabled={submitDisabled}>
              {submitting ? 'Submitting...' : (formLocked || hasSubmitted) ? 'Submitted' : 'Submit Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
