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

  return (
    <div className="joining-form-print-root bg-gray-100 py-8 print:bg-white">
      <div className="joining-form-print-pages">
        <section
          className="joining-form-print-page mx-auto shadow-lg print:shadow-none border border-gray-300 print:border-0 relative overflow-hidden"
          style={pageStyle}
        >
          <header className="joining-form-print-header joining-form-print-header--title">
            <h1 className="joining-form-print-title fw-bold">Joining Form</h1>
            
          </header>

          <main className="joining-form-print-main text-sm text-gray-800 leading-relaxed">
            <div className="font-bold text-lg text-gray-700">{companyName}</div>
            <div className="mt-2">{companyAddress}</div>
            <div className="mb-4 mt-4">
              <p className="font-bold">Date: {currentDate}</p>
            </div>

            <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
              <tbody>
                {personalRows.map(([label, value]) => (
                  <tr key={label}>
                    <td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50 w-1/3">{label}</td>
                    <td className="border border-gray-300 px-2 py-1">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mb-4">
              <p className="font-bold mb-2">Educational Details</p>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left">Qualification</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left">University/Board</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left">Year</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left">%</th>
                  </tr>
                </thead>
                <tbody>
                  {educationRows.length > 0 ? (
                    educationRows.map((row, index) => (
                      <tr key={`${row.qual}-${row.univ}-${index}`}>
                        <td className="border border-gray-300 px-2 py-1">{textOrDash(row.qual)}</td>
                        <td className="border border-gray-300 px-2 py-1">{textOrDash(row.univ)}</td>
                        <td className="border border-gray-300 px-2 py-1">{textOrDash(row.year)}</td>
                        <td className="border border-gray-300 px-2 py-1">{textOrDash(row.perc)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 text-gray-600" colSpan={4}>No educational details provided.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </main>
        </section>

        <section
          className="joining-form-print-page mx-auto shadow-lg print:shadow-none border border-gray-300 print:border-0 relative overflow-hidden"
          style={pageStyle}
        >
          <header className="joining-form-print-header joining-form-print-header--title">
            <h1 className="joining-form-print-title fw-bold">Joining Form</h1>
       
          </header>

          <main className="joining-form-print-main text-sm text-gray-800 leading-relaxed">
            <div className="mb-4">
              <p className="font-bold mb-2">Employment History</p>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left">Company</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left">Designation</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left">Duration</th>
                    <th className="border border-gray-300 px-2 py-1 bg-gray-50 text-left">Reason for Leaving</th>
                  </tr>
                </thead>
                <tbody>
                  {employmentRows.length > 0 ? (
                    employmentRows.map((row, index) => (
                      <tr key={`${row.comp}-${row.desig}-${index}`}>
                        <td className="border border-gray-300 px-2 py-1">{textOrDash(row.comp)}</td>
                        <td className="border border-gray-300 px-2 py-1">{textOrDash(row.desig)}</td>
                        <td className="border border-gray-300 px-2 py-1">{textOrDash(row.dur)}</td>
                        <td className="border border-gray-300 px-2 py-1">{textOrDash(row.reason)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="border border-gray-300 px-2 py-1 text-gray-600" colSpan={4}>No employment history provided.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mb-4">
              <p className="font-bold mb-2">Documents Submitted</p>
              <p>{docList.length > 0 ? docList.join(', ') : '-'}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-300">
              <p className="text-xs italic mb-4">I hereby declare that the information provided above is true and correct to the best of my knowledge.</p>
              <p className="font-semibold">For {companyName}</p>
              <p className="text-gray-600">{hrName} | {hrContact} | {hrEmail}</p>

              <div className="joining-form-signature-grid mt-6">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Employee Signature</p>
                  <div className="joining-form-sign-line" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Date</p>
                  <div className="joining-form-sign-line" />
                </div>
              </div>
            </div>
          </main>
        </section>
      </div>

      <div className="text-center mt-6 no-print">
        <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition-colors">
          Print Joining Form
        </button>
      </div>
    </div>
  );
};

export default JoiningFormPDF;
