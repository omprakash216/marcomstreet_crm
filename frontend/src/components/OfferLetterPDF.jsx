import React from 'react';
import '../styles/experience-letter.css';
import letterHeadBg from '../assets/letter-head.png';
import hrSignature from '../assets/hr_signature.png';

const OfferLetterPDF = ({
  employeeName = '',
  designation = '',
  department = '',
  address = '',
  joiningDate = '',
  gender = 'male',
  workLocation = 'B-23, B-BLOCK, SECTOR 63 NOIDA',
  companyName = 'VANYA GROUP (MARCOM STREET)',
  hrName = 'Jyoti Sharma',
  hrDesignation = 'HR & ADMIN',
  hrSignDate = '',
  reportingTo = '',
  acceptanceDays = 7,
  probationMonths = 3,
  basicSalary = '12,000',
  hra = '7,200',
  conveyanceAllowance = '1,500',
  medicalAllowance = '1,000',
  otherAllowance = '2,300',
  grossSalary = '24,000',
  netSalary = '24,000',
  showPrintButton = true,
  currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
}) => {
  const title = gender === 'female' ? 'Ms.' : 'Mr.';
  const candidateName = employeeName
    ? employeeName
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
    : '';
  const candidateNameUpper = employeeName ? employeeName.toUpperCase() : '';
  const signedDate = hrSignDate || currentDate;

  const textOrDash = (value) => (value && String(value).trim() !== '' ? value : '-');

  const pageStyle = {
    backgroundImage: `url(${letterHeadBg})`,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'top left',
    width: '210mm',
    minHeight: '297mm',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  const OfferPage = ({ children, showTitle = false }) => (
    <section
      className="experience-letter-doc experience-letter-with-letterhead offer-letter-sheet mx-auto shadow-lg border border-gray-300 relative overflow-hidden"
      style={pageStyle}
    >
      <header className={`offer-letter-sheet-header ${showTitle ? 'offer-letter-sheet-header--title' : ''}`}>
        {showTitle ? (
          <div className="offer-letter-sheet-title-block">
            <h1 className="offer-letter-sheet-title">Offer of Employment</h1>
          </div>
        ) : (
          <>
            <div className="offer-letter-sheet-top-spacer" aria-hidden="true" />
            
          </>
        )}
      </header>
      <main className="offer-letter-sheet-content text-sm text-gray-800 leading-relaxed">
        {children}
      </main>
    </section>
  );

  return (
    <div className="offer-letter-print-root bg-gray-100 py-8 print:bg-white">
      <div className="offer-letter-pages">
        <OfferPage showTitle>
          <p className="font-bold">Date: {currentDate}</p>

          <div className="mt-4 mb-2">
            <p className="font-bold">To</p>
            <p className="font-bold uppercase">{textOrDash(candidateNameUpper)}</p>
            <p>{textOrDash(address)}</p>
            <p className="mt-2 font-semibold">
              Subject: Appointment as {textOrDash(designation).toUpperCase()}
            </p>
            <p className="mt-2">
              Dear {title} {textOrDash(candidateName)},
            </p>
          </div>

          <div className="space-y-3 mt-6">
            <p>
              We are pleased to offer you employment with {companyName} for the position of
              {' '}
              "{textOrDash(designation)}" at our {textOrDash(workLocation)} office.
              Your date of joining will be <strong>{textOrDash(joiningDate)}</strong>.
              This offer is subject to the terms and conditions below.
            </p>

            <p><strong>1. Job Title and Reporting</strong></p>
            <p>Designation: <strong>{textOrDash(designation).toUpperCase()}</strong></p>
            <p>Reporting to: <strong>{textOrDash(reportingTo)}</strong></p>
            <p>Department: <strong>{textOrDash(department)}</strong></p>

            <p><strong>2. Compensation</strong></p>
            <p>Your salary structure is defined in Annexure A. All payments are subject to statutory deductions.</p>

            <p><strong>3. Probation and Confirmation</strong></p>
            <p>
              Probation Period: {probationMonths} months.
              Notice period during probation is 15 days, and after confirmation is 30 days.
            </p>

            <p><strong>4. Working Hours and Attendance</strong></p>
            <p>
              Standard working hours are 09:30 AM to 6:30 PM. Attendance and late-coming
              will be governed by the company Attendance and Punctuality Policy.
            </p>
          </div>
        </OfferPage>

        <OfferPage>
          <div className="space-y-3">
            <p><strong>5. Leaves and Holidays</strong></p>
            <p>
              Leave entitlements are governed by the Company Leave Policy.
              You are entitled to Government-declared mandatory holidays as per applicable rules.
            </p>

            <p><strong>6. Confidentiality, Intellectual Property and Non-Solicitation</strong></p>
            <p>
              You must maintain confidentiality of all company information and comply with
              confidentiality, non-solicitation, and IP requirements.
            </p>

            <p><strong>7. Company Policies and Code of Conduct</strong></p>
            <p>
              All employees are expected to follow company policies, including Leave Policy,
              Attendance Policy, IT Usage Policy, Anti-Harassment Policy, and Code of Conduct.
            </p>

            <p><strong>8. Termination for Cause</strong></p>
            <p>
              The company may terminate employment without notice in cases of misconduct,
              dishonesty, abandonment of duty, or serious policy breach.
            </p>

            <p><strong>9. Full and Final Settlement</strong></p>
            <p>Settlement will be processed as per Annexure B.</p>

            <p><strong>10. Background Verification and Pre-Employment Conditions</strong></p>
            <p>
              This offer is contingent upon satisfactory background verification,
              required document submission, and fitness/clearance, where applicable.
            </p>

            <p><strong>11. Acceptance</strong></p>
            <p>
              Please sign and return a copy of this letter within {acceptanceDays}
              {' '}
              days as your acceptance of this offer and all terms.
            </p>

            <p className="mt-5">For and on behalf of {companyName}</p>
          </div>
        </OfferPage>

        <OfferPage>
          <div className="offer-letter-keep-together">
            <p className="font-bold">Authorized Signatory</p>
            <p className="mt-2"><strong>Name: {textOrDash(hrName).toUpperCase()}</strong></p>
            <p className="text-sm text-gray-700">Designation: {textOrDash(hrDesignation)}</p>
            <p className="text-sm mt-1">Date: {signedDate}</p>

            <div className="mt-4">
              <div className="hr-signature-box w-48" style={{ minHeight: '50px' }}>
                <img
                  src={hrSignature}
                  alt="HR Signature"
                  className="w-32 h-auto mt-2"
                  style={{ display: 'block' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-300">
              <p>
                I, <strong>{textOrDash(candidateNameUpper)}</strong>, have read and understood
                the terms of employment and accept the same.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-6 max-w-xl">
                <div>
                  <p className="text-sm font-semibold text-gray-600">HR Signature:</p>
                  <div className="border-b border-gray-400 mt-1" style={{ minHeight: '36px' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Date: {signedDate}</p>
                  <div className="border-b border-gray-400 mt-1" style={{ minHeight: '36px' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Employee Signature:</p>
                  <div className="border-b border-gray-400 mt-1" style={{ minHeight: '36px' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Date:</p>
                  <div className="border-b border-gray-400 mt-1" style={{ minHeight: '36px' }} />
                </div>
              </div>
            </div>
          </div>
        </OfferPage>

        <OfferPage>
          <h2 className="text-lg font-bold mb-2">Annexure A: Salary Structure</h2>
          <p className="mb-4 text-sm">
            Standard monthly salary breakup applicable to this offer:
          </p>

          <table className="w-full border-collapse border border-gray-300 text-sm mb-4 offer-letter-keep-together">
            <thead>
              <tr>
                <th className="border border-gray-300 px-2 py-2 bg-gray-50 text-left">Components</th>
                <th className="border border-gray-300 px-2 py-2 bg-gray-50 text-left">Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border border-gray-300 px-2 py-1">Basic Salary</td><td className="border border-gray-300 px-2 py-1">{textOrDash(basicSalary)}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1">House Rent Allowance (HRA)</td><td className="border border-gray-300 px-2 py-1">{textOrDash(hra)}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1">Conveyance Allowance</td><td className="border border-gray-300 px-2 py-1">{textOrDash(conveyanceAllowance)}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1">Medical Allowance</td><td className="border border-gray-300 px-2 py-1">{textOrDash(medicalAllowance)}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1">Other Allowance</td><td className="border border-gray-300 px-2 py-1">{textOrDash(otherAllowance)}</td></tr>
              <tr><td className="border border-gray-300 px-2 py-1 font-bold">Gross Salary</td><td className="border border-gray-300 px-2 py-1 font-bold">{textOrDash(grossSalary)}</td></tr>
            </tbody>
          </table>

          <p className="text-sm">
            Net Salary Payable: INR {textOrDash(netSalary)} per month (subject to statutory deductions, if applicable).
          </p>
        </OfferPage>

        <OfferPage>
          <h2 className="text-lg font-bold mb-2">Annexure B: Full and Final Settlement Policy</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Unpaid salary, leave encashment, and approved reimbursements will be processed after all clearances.</li>
            <li>All company assets must be returned before the last working day.</li>
            <li>Settlement processing timeline is generally 30-45 days from the last working day.</li>
            <li>Any pending loans, advances, or notice shortfall will be adjusted in settlement.</li>
            <li>Final settlement is released after approvals from HR and Accounts.</li>
          </ol>
        </OfferPage>

        <OfferPage>
          <h2 className="text-lg font-bold mb-2">Annexure C: General Company Policies</h2>
          <div className="space-y-3 text-sm">
            <p><strong>1. Leave Policy:</strong> Leave is governed by company policy and manager approval workflow.</p>
            <p><strong>2. Attendance and Punctuality:</strong> Regular attendance and timely reporting are mandatory.</p>
            <p><strong>3. Code of Conduct:</strong> Professional behavior and workplace discipline are mandatory.</p>
            <p><strong>4. Confidentiality:</strong> Company/client data must not be shared outside the organization.</p>
            <p><strong>5. Anti-Harassment Policy:</strong> The company follows a zero-tolerance anti-harassment policy.</p>
            <p><strong>6. IT and Internet Policy:</strong> Company systems must be used for official work only.</p>
          </div>
        </OfferPage>

        <OfferPage>
          <h2 className="text-lg font-bold mb-2">Annexure D: Notice Period Policy</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm mb-6">
            <li>During probation, either party may terminate employment with 15 days notice or salary in lieu.</li>
            <li>After confirmation, 30 days written notice or salary in lieu is required.</li>
            <li>Shortfall in notice period may be adjusted in final settlement.</li>
            <li>The company may waive/shorten notice at its discretion.</li>
            <li>Handover completion before the last working day is mandatory.</li>
          </ol>

          <h2 className="text-lg font-bold mb-2">Annexure E: Late Coming and Attendance Policy</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Office timings are 09:30 AM to 6:30 PM, Monday to Saturday.</li>
            <li>Repeated late marks may lead to leave deduction as per policy.</li>
            <li>Attendance must be recorded in the company attendance system.</li>
            <li>Unauthorized absence may trigger disciplinary action.</li>
            <li>Repeated attendance irregularities may impact performance evaluation.</li>
          </ol>
        </OfferPage>
      </div>

      {showPrintButton && (
        <div className="text-center mt-6 no-print">
          <button
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition-colors"
          >
            Print Offer Letter
          </button>
        </div>
      )}
    </div>
  );
};

export default OfferLetterPDF;
