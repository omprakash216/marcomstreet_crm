import React from 'react';
import '../styles/experience-letter.css';
import letterHeadBg from '../assets/letter-head.png';

const JoiningFormPDF = ({
  employeeName = '',
  designation = '',
  department = '',
  joiningDate = '',
  fatherName = '',
  dob = '',
  gender = '',
  maritalStatus = '',
  phone = '',
  email = '',
  permanentAddress = '',
  currentAddress = '',
  aadharNo = '',
  panNo = '',
  emergencyContactName = '',
  emergencyRelation = '',
  emergencyPhone = '',
  education = [],
  employment = [],
  docsResume = false,
  docsId = false,
  docsAddress = false,
  docsCertificates = false,
  docsPhotos = false,
  docsOthers = '',
  companyName = 'Vanya Group (Artistry Studio)',
  companyAddress = 'B-023, B Block, Sector 63, Noida',
  hrName = 'Jyoti Sharma',
  hrContact = '+91 9211608441',
  hrEmail = 'hrthevanygroup@gmail.com',
  showPrintButton = true,
  currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}) => {
  const hasValue = (value) => String(value ?? '').trim() !== '';
  const textOrDash = (value) => (hasValue(value) ? String(value).trim() : '-');

  const emergencyParts = [];
  if (hasValue(emergencyContactName)) emergencyParts.push(emergencyContactName.trim());
  if (hasValue(emergencyRelation)) emergencyParts.push(`(${emergencyRelation.trim()})`);
  if (hasValue(emergencyPhone)) emergencyParts.push(`- ${emergencyPhone.trim()}`);
  const emergencyDisplay = emergencyParts.length > 0 ? emergencyParts.join(' ') : '-';

  const docList = [];
  if (docsResume) docList.push('Resume');
  if (docsId) docList.push('ID Proof');
  if (docsAddress) docList.push('Address Proof');
  if (docsCertificates) docList.push('Certificates');
  if (docsPhotos) docList.push('Photos (2)');
  if (hasValue(docsOthers)) docList.push(docsOthers.trim());

  const educationRows = (education || []).filter((row) =>
    row && [row.qual, row.univ, row.year, row.perc].some(hasValue)
  );

  const employmentRows = (employment || []).filter((row) =>
    row && [row.comp, row.desig, row.dur, row.reason].some(hasValue)
  );

  const personalRows = [
    ['Name', textOrDash(employeeName)],
    ['Designation', textOrDash(designation)],
    ['Department', textOrDash(department)],
    ['Date of Joining', textOrDash(joiningDate)],
    ["Father's Name", textOrDash(fatherName)],
    ['Date of Birth', textOrDash(dob)],
    ['Gender', textOrDash(gender)],
    ['Marital Status', textOrDash(maritalStatus)],
    ['Contact', textOrDash(phone)],
    ['Email', textOrDash(email)],
    ['Permanent Address', textOrDash(permanentAddress)],
    ['Current Address', textOrDash(currentAddress)],
    ['Aadhar No', textOrDash(aadharNo)],
    ['PAN No', textOrDash(panNo)],
    ['Emergency Contact', emergencyDisplay]
  ];

  const pageStyle = {
    backgroundImage: `url(${letterHeadBg})`,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'top left',
    width: '210mm',
    minHeight: '297mm',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact'
  };
  const titleHeaderStyle = {
    paddingLeft: '12mm',
    paddingRight: '12mm',
    paddingTop: '270px',
    textAlign: 'center'
  };
  const spacerHeaderStyle = {
    paddingLeft: '12mm',
    paddingRight: '12mm',
    paddingTop: '270px'
  };
  const titleStyle = {
    margin: '-10px 0 0',
    display: 'block',
    padding: '9px',
    backgroundColor: 'transparent',
    fontFamily: 'Times New Roman, Georgia, serif',
    fontSize: '1.65rem',
    lineHeight: 1.2,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'rgb(31, 41, 55)'
  };
  const mainStyle = {
    padding: '10px 12mm 24mm',
    boxSizing: 'border-box',
    color: '#1f2937',
    fontSize: '14px',
    lineHeight: 1.55
  };
  const companyNameStyle = {
    fontSize: '1.875rem',
    fontWeight: 700,
    color: '#374151'
  };
  const companyAddressStyle = { marginTop: '0.5rem' };
  const dateWrapStyle = { marginTop: '1rem', marginBottom: '1rem' };
  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    marginBottom: '1rem'
  };
  const tableHeadCellStyle = {
    border: '1px solid #d1d5db',
    padding: '0.35rem 0.5rem',
    backgroundColor: '#f9fafb',
    textAlign: 'left',
    fontWeight: 600
  };
  const labelCellStyle = {
    border: '1px solid #d1d5db',
    padding: '0.35rem 0.5rem',
    fontWeight: 600,
    backgroundColor: '#f9fafb',
    width: '33.333%'
  };
  const valueCellStyle = {
    border: '1px solid #d1d5db',
    padding: '0.35rem 0.5rem'
  };
  const sectionBlockStyle = { marginBottom: '1rem' };
  const sectionTitleStyle = { fontWeight: 700, marginBottom: '0.5rem' };
  const declarationWrapStyle = {
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid #d1d5db'
  };
  const declarationTextStyle = {
    fontSize: '12px',
    fontStyle: 'italic',
    marginBottom: '1rem'
  };
  const hrLineStyle = { color: '#4b5563' };
  const signatureGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '1rem',
    marginTop: '1.5rem'
  };
  const signatureLabelStyle = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#4b5563'
  };
  const signatureUnderlineStyle = {
    marginTop: '1.2rem',
    borderBottom: '1px solid #6b7280',
    width: '100%'
  };

  return (
    <div className="joining-form-print-root bg-gray-100 py-8 print:bg-white">
      <div className="joining-form-print-pages">
        <section
          className="joining-form-print-page mx-auto shadow-lg print:shadow-none relative overflow-hidden"
          style={pageStyle}
        >
          <header className="joining-form-print-header joining-form-print-header--title" style={titleHeaderStyle}>
            <h1 className="joining-form-print-title fw-bold" style={titleStyle}>Joining Form</h1>
          </header>

          <main className="joining-form-print-main text-sm text-gray-800 leading-relaxed" style={mainStyle}>
            <div className="font-bold text-lg text-gray-700" style={companyNameStyle}>{companyName}</div>
            <div className="mt-2" style={companyAddressStyle}>{companyAddress}</div>
            <div className="mb-4 mt-4" style={dateWrapStyle}>
              <p className="font-bold" style={{ margin: 0 }}>Date: {currentDate}</p>
            </div>

            <table className="w-full border-collapse border border-gray-300 text-sm mb-4" style={tableStyle}>
              <tbody>
                {personalRows.map(([label, value]) => (
                  <tr key={label}>
                    <td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50 w-1/3" style={labelCellStyle}>{label}</td>
                    <td className="border border-gray-300 px-2 py-1" style={valueCellStyle}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mb-4" style={sectionBlockStyle}>
              <p className="font-bold mb-2" style={sectionTitleStyle}>Educational Details</p>
              <table className="w-full border-collapse border border-gray-300 text-sm" style={tableStyle}>
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left" style={tableHeadCellStyle}>Qualification</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left" style={tableHeadCellStyle}>University/Board</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left" style={tableHeadCellStyle}>Year</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left" style={tableHeadCellStyle}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {educationRows.length > 0 ? (
                    educationRows.map((row, index) => (
                      <tr key={`${row.qual}-${row.univ}-${index}`}>
                        <td className="border border-gray-300 px-2 py-1" style={valueCellStyle}>{textOrDash(row.qual)}</td>
                        <td className="border border-gray-300 px-2 py-1" style={valueCellStyle}>{textOrDash(row.univ)}</td>
                        <td className="border border-gray-300 px-2 py-1" style={valueCellStyle}>{textOrDash(row.year)}</td>
                        <td className="border border-gray-300 px-2 py-1" style={valueCellStyle}>{textOrDash(row.perc)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 text-gray-600" style={valueCellStyle} colSpan={4}>No educational details provided.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </main>
        </section>

        <section
          className="joining-form-print-page mx-auto shadow-lg print:shadow-none relative overflow-hidden"
          style={pageStyle}
        >
          <header className="joining-form-print-header joining-form-print-header--spacer" style={spacerHeaderStyle} aria-hidden="true" />

          <main className="joining-form-print-main text-sm text-gray-800 leading-relaxed" style={mainStyle}>
            <div className="mb-4" style={sectionBlockStyle}>
              <p className="font-bold mb-2" style={sectionTitleStyle}>Employment History</p>
              <table className="w-full border-collapse border border-gray-300 text-sm" style={tableStyle}>
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left" style={tableHeadCellStyle}>Company</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left" style={tableHeadCellStyle}>Designation</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left" style={tableHeadCellStyle}>Duration</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left" style={tableHeadCellStyle}>Reason for Leaving</th>
                  </tr>
                </thead>
                <tbody>
                  {employmentRows.length > 0 ? (
                    employmentRows.map((row, index) => (
                      <tr key={`${row.comp}-${row.desig}-${index}`}>
                        <td className="border border-gray-300 px-2 py-1" style={valueCellStyle}>{textOrDash(row.comp)}</td>
                        <td className="border border-gray-300 px-2 py-1" style={valueCellStyle}>{textOrDash(row.desig)}</td>
                        <td className="border border-gray-300 px-2 py-1" style={valueCellStyle}>{textOrDash(row.dur)}</td>
                        <td className="border border-gray-300 px-2 py-1" style={valueCellStyle}>{textOrDash(row.reason)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 text-gray-600" style={valueCellStyle} colSpan={4}>No employment history provided.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mb-4" style={sectionBlockStyle}>
              <p className="font-bold mb-2" style={sectionTitleStyle}>Documents Submitted</p>
              <p style={{ margin: 0 }}>{docList.length > 0 ? docList.join(', ') : '-'}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-300" style={declarationWrapStyle}>
              <p className="text-xs italic mb-4" style={declarationTextStyle}>I hereby declare that the information provided above is true and correct to the best of my knowledge.</p>
              <p className="font-semibold" style={{ margin: 0, fontWeight: 600 }}>For {companyName}</p>
              <p className="text-gray-600" style={hrLineStyle}>{hrName} | {hrContact} | {hrEmail}</p>

              <div className="joining-form-signature-grid mt-6" style={signatureGridStyle}>
                <div>
                  <p className="text-sm font-semibold text-gray-600" style={signatureLabelStyle}>Employee Signature</p>
                  <div className="joining-form-sign-line" style={signatureUnderlineStyle} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600" style={signatureLabelStyle}>Date</p>
                  <div className="joining-form-sign-line" style={signatureUnderlineStyle} />
                </div>
              </div>
            </div>
          </main>
        </section>
      </div>

        {showPrintButton && (
          <div className="text-center mt-6 no-print">
            <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition-colors">
              Print Joining Form
            </button>
          </div>
        )}
    </div>
  );
};

export default JoiningFormPDF;
