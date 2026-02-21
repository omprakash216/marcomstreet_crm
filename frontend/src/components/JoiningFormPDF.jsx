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
  const docList = [];
  if (docsResume) docList.push('Resume');
  if (docsId) docList.push('ID Proof');
  if (docsAddress) docList.push('Address Proof');
  if (docsCertificates) docList.push('Certificates');
  if (docsPhotos) docList.push('Photos (2)');
  if (docsOthers) docList.push(docsOthers);

  return (
    <div className="bg-gray-100 py-8 print:bg-transparent">
      <div
        className="experience-letter-doc experience-letter-with-letterhead doc-print-as-screen joining-form-doc mx-auto shadow-lg print:shadow-none border border-gray-300 print:border-0 relative overflow-hidden"
        style={{
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
        }}
      >
        <div className="doc-print-letterhead-top" style={{ backgroundImage: `url(${letterHeadBg})` }} aria-hidden="true" />
        <div className="doc-print-letterhead-bottom" style={{ backgroundImage: `url(${letterHeadBg})` }} aria-hidden="true" />
        <header className="experience-letter-header experience-letter-header-on-bg joining-form-header px-10 pt-0 pb-0 relative">
          <h1 className="joining-form-doc-title">Joining Form</h1>
          <div className="joining-form-header-line" aria-hidden="true" />
        </header>
        <main className="experience-letter-main joining-form-main px-10 py-6 text-sm text-gray-800 leading-relaxed content-layer">
          <div className="joining-form-content-start font-bold text-lg text-gray-700">{companyName}</div>
          <div className="mt-2">{companyAddress}</div>
          <div className="mb-4 mt-4"><p className="font-bold">Date: {currentDate}</p></div>

          <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
            <tbody>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50 w-1/3">Name</td><td className="border border-gray-300 px-2 py-1">{employeeName}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Designation</td><td className="border border-gray-300 px-2 py-1">{designation}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Department</td><td className="border border-gray-300 px-2 py-1">{department}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Date of Joining</td><td className="border border-gray-300 px-2 py-1">{joiningDate}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Father&apos;s Name</td><td className="border border-gray-300 px-2 py-1">{fatherName}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Date of Birth</td><td className="border border-gray-300 px-2 py-1">{dob}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Gender</td><td className="border border-gray-300 px-2 py-1">{gender}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Marital Status</td><td className="border border-gray-300 px-2 py-1">{maritalStatus}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Contact</td><td className="border border-gray-300 px-2 py-1">{phone}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Email</td><td className="border border-gray-300 px-2 py-1">{email}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Permanent Address</td><td className="border border-gray-300 px-2 py-1">{permanentAddress}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Current Address</td><td className="border border-gray-300 px-2 py-1">{currentAddress}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Aadhar No</td><td className="border border-gray-300 px-2 py-1">{aadharNo}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">PAN No</td><td className="border border-gray-300 px-2 py-1">{panNo}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-semibold bg-gray-50">Emergency Contact</td><td className="border border-gray-300 px-2 py-1">{emergencyContactName} ({emergencyRelation}) - {emergencyPhone}</td></tr>
            </tbody>
          </table>

          {education && education.length > 0 && (
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
                  {education.map((row, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 px-2 py-1">{row.qual}</td>
                      <td className="border border-gray-300 px-2 py-1">{row.univ}</td>
                      <td className="border border-gray-300 px-2 py-1">{row.year}</td>
                      <td className="border border-gray-300 px-2 py-1">{row.perc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {employment && employment.length > 0 && (
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
                  {employment.map((row, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 px-2 py-1">{row.comp}</td>
                      <td className="border border-gray-300 px-2 py-1">{row.desig}</td>
                      <td className="border border-gray-300 px-2 py-1">{row.dur}</td>
                      <td className="border border-gray-300 px-2 py-1">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="joining-form-page-2">
            <div className="mb-4">
              <p className="font-bold mb-2">Documents Submitted</p>
              <p>{docList.length ? docList.join(', ') : '—'}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-300">
              <p className="text-xs italic mb-4">I hereby declare that the information provided above is true and correct to the best of my knowledge.</p>
              <p className="font-semibold">For {companyName}</p>
              <p className="text-gray-600">{hrName} | {hrContact} | {hrEmail}</p>
            </div>
          </div>
        </main>
      </div>
      <div className="text-center mt-6 no-print">
        <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition-colors">Print Joining Form</button>
      </div>
    </div>
  );
};

export default JoiningFormPDF;
