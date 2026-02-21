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
  companyAddress = 'B-023, B Block, Sector 63, Noida',
  hrName = 'Jyoti Sharma',
  hrDesignation = 'HR & ADMIN',
  hrContact = '+91 9211608441',
  hrEmail = 'hrthevanygroup@gmail.com',
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
  currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}) => {
  const title = gender === 'female' ? 'Ms.' : 'Mr.';
  const nameFormatted = employeeName
    ? employeeName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : '';
  const nameUpper = employeeName ? employeeName.toUpperCase() : '';
  const displayHrSignDate = hrSignDate || currentDate;

  return (
    <div className="bg-gray-100 py-8 print:bg-white">
      <div
        className="experience-letter-doc experience-letter-with-letterhead doc-print-as-screen offer-letter-doc mx-auto shadow-lg print:shadow-none border border-gray-300 print:border-0 relative overflow-hidden"
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
        <header className="experience-letter-header experience-letter-header-on-bg offer-letter-header px-10 pt-0 pb-0 relative">
          <h1 className="offer-letter-doc-title">Offer of Employment</h1>
          <div className="offer-letter-header-line" aria-hidden="true" />
        </header>

        <main className="experience-letter-main offer-letter-main px-10 py-6 text-sm text-gray-800 leading-relaxed content-layer">
          <p className="font-bold mt-4">Date: {currentDate}</p>

          <div className="mt-4 mb-2">
            <p className="font-bold">To</p>
            <p className="font-bold uppercase">{nameUpper}</p>
            <p>{address || '—'}</p>
            <p className="mt-2 font-semibold">Subject: Appointment as {designation ? designation.toUpperCase() : '—'}</p>
            <p className="mt-2">Dear, {nameFormatted}</p>
          </div>

          {/* PAGE 1: Intro + 1–4 */}
          <div className="space-y-3 mt-6">
            <p>We are pleased to offer you employment with {companyName} for the position of &apos;{designation}&apos; at our {workLocation}. Your date of joining will be <strong>{joiningDate || '—'}</strong>. This offer is subject to the terms and conditions set out below.</p>

            <p><strong>1. Job Title &amp; Reporting</strong></p>
            <p>Designation: <strong>{designation ? designation.toUpperCase() : '—'}</strong></p>
            <p>Reporting to: <strong>{reportingTo || '—'}</strong></p>

            <p><strong>2. Compensation</strong></p>
            <p>As per Annexure A (Salary Structure). All payments are subject to statutory deductions.</p>

            <p><strong>3. Probation &amp; Confirmation</strong></p>
            <p>Probation Period: {probationMonths} months. Notice period during probation is 15 days, post confirmation 30 days.</p>

            <p><strong>4. Working Hours &amp; Attendance</strong></p>
            <p>Standard working hours are 09:30 AM - 6:30 PM. Attendance and late-coming will be governed by the company&apos;s Attendance and Punctuality Policy.</p>
          </div>

          {/* PAGE 2: 5–11 + For and on behalf */}
          <div className="offer-letter-page mt-8" style={{ pageBreakBefore: 'always' }}>
            <div className="space-y-3">
              <p><strong>5. Leaves &amp; Holidays</strong></p>
              <p>Leave entitlements are governed by the Company Leave Policy. You are also entitled to all Government-declared mandatory holidays (National and Festival holidays) as per state/central notifications.</p>

              <p><strong>6. Confidentiality, IP &amp; Non-Solicitation</strong></p>
              <p>You must maintain confidentiality of all company information and adhere to non-solicitation and intellectual property clauses.</p>

              <p><strong>7. Company Policies &amp; Code of Conduct</strong></p>
              <p>All employees are expected to follow the policies, rules, and regulations of Vanya Group. These include, but are not limited to: Leave Policy, Attendance Policy, IT Usage Policy, Anti-Harassment Policy, and Code of Conduct.</p>

              <p><strong>8. Termination for Cause</strong></p>
              <p>The company may terminate your employment without notice in cases of misconduct, dishonesty, abandonment of duty, or breach of company policy.</p>

              <p><strong>9. Full &amp; Final Settlement</strong></p>
              <p>As per Annexure C (Full &amp; Final Settlement Policy).</p>

              <p><strong>10. Background Verification &amp; Pre-Employment Conditions</strong></p>
              <p>This offer is contingent upon satisfactory background verification, submission of required documents, and successful medical clearance.</p>

              <p><strong>11. Acceptance</strong></p>
              <p>Please sign and return a copy of this letter within {acceptanceDays} days as acceptance of the offer and its terms.</p>
              <p className="mt-4">For and on behalf of Vanya Group</p>
            </div>
          </div>

          {/* PAGE 3: Authorized Signatory + Employee acceptance */}
          <div className="offer-letter-page mt-10 pt-6 border-t border-gray-300" style={{ pageBreakBefore: 'always' }}>
            <p className="font-bold">Authorized Signatory</p>
            <p className="mt-2"><strong>Name: {hrName.toUpperCase()}</strong></p>
            <p className="text-sm text-gray-600">Designation: {hrDesignation}</p>
            <p className="text-sm mt-1">Date: {displayHrSignDate}</p>
            <div className="mt-6">
              <div className="hr-signature-box w-48" style={{ minHeight: '50px' }}>
                <img src={hrSignature} alt="HR Signature" className="w-32 h-auto mt-2" style={{ display: 'block' }} onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-300">
              <p>I, <strong>{nameUpper}</strong>, have read and understood the terms of employment and accept the same.</p>
              <div className="mt-6 grid grid-cols-2 gap-6 max-w-xl">
                <div>
                  <p className="text-sm font-semibold text-gray-600">HR Signature:</p>
                  <div className="border-b border-gray-400 mt-1" style={{ minHeight: '36px' }}></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Date: {displayHrSignDate}</p>
                  <div className="border-b border-gray-400 mt-1" style={{ minHeight: '36px' }}></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Employee Signature:</p>
                  <div className="border-b border-gray-400 mt-1" style={{ minHeight: '36px' }}></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Date:</p>
                  <div className="border-b border-gray-400 mt-1" style={{ minHeight: '36px' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* PAGE 4: Annexure A */}
          <div className="offer-letter-page mt-10 pt-6" style={{ pageBreakBefore: 'always' }}>
            <h2 className="text-lg font-bold mb-2">Annexure A: Salary Structure</h2>
            <p className="mb-4 text-sm">Below is the standard format for employee salary structure. Actual figures will vary based on the employee&apos;s designation and grade.</p>
            <p className="font-bold mb-2">Salary Breakup (Monthly)</p>
            <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
              <thead>
                <tr>
                  <th className="border border-gray-300 px-2 py-2 bg-gray-50 text-left">Components</th>
                  <th className="border border-gray-300 px-2 py-2 bg-gray-50 text-left">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-gray-300 px-2 py-1">Basic Salary</td><td className="border border-gray-300 px-2 py-1">{basicSalary}</td></tr>
                <tr><td className="border border-gray-300 px-2 py-1">House Rent Allowance (HRA)</td><td className="border border-gray-300 px-2 py-1">{hra}</td></tr>
                <tr><td className="border border-gray-300 px-2 py-1">Conveyance Allowance</td><td className="border border-gray-300 px-2 py-1">{conveyanceAllowance}</td></tr>
                <tr><td className="border border-gray-300 px-2 py-1">Medical Allowance</td><td className="border border-gray-300 px-2 py-1">{medicalAllowance}</td></tr>
                <tr><td className="border border-gray-300 px-2 py-1">Other Allowance</td><td className="border border-gray-300 px-2 py-1">{otherAllowance}</td></tr>
                <tr><td className="border border-gray-300 px-2 py-1 font-bold">Gross Salary</td><td className="border border-gray-300 px-2 py-1 font-bold">{grossSalary}</td></tr>
              </tbody>
            </table>
            <p className="text-sm">Net Salary Payable: ₹{netSalary} per month (subject to statutory deductions, if applicable).</p>
          </div>

          {/* PAGE 5: Annexure B - Full & Final Settlement */}
          <div className="offer-letter-page mt-8" style={{ pageBreakBefore: 'always' }}>
            <h2 className="text-lg font-bold mb-2">Annexure B: Full &amp; Final Settlement Policy</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>All dues such as unpaid salary, leave encasement, and reimbursements will be processed after clearance from all departments.</li>
              <li>Employees must return all company assets before the last working day.</li>
              <li>The settlement process typically takes 30–45 days from the employee&apos;s last working day.</li>
              <li>Any pending loans, advances, or notice period shortfall will be adjusted during settlement.</li>
              <li>The final payment will be released after approval from the HR and Accounts Department.</li>
            </ol>
          </div>

          {/* PAGE 6: Annexure C - General Company Policies */}
          <div className="offer-letter-page mt-8" style={{ pageBreakBefore: 'always' }}>
            <h2 className="text-lg font-bold mb-2">Annexure C: General Company Policies</h2>
            <div className="space-y-3 text-sm">
              <p><strong>1. Leave Policy</strong><br />Employees are entitled to Annual, Sick, and Casual Leaves as per company norms. All leaves must be applied for and approved by the reporting manager in advance. In case of emergencies, prior approval may be exempted; however, if an employee takes leave without informing the manager, it will be considered Unplanned Leave, and 2 days&apos; salary will be deducted for each such instance.</p>
              <p><strong>2. Attendance &amp; Punctuality:</strong> Regular attendance and timely reporting are mandatory. Repeated late comings or absenteeism may lead to disciplinary action.</p>
              <p><strong>3. Code of Conduct:</strong> Employees are expected to maintain professionalism, respect colleagues, and avoid any behavior that can harm the company&apos;s reputation.</p>
              <p><strong>4. Confidentiality:</strong> Employees must not share company data, trade secrets, or client information outside the organization.</p>
              <p><strong>5. Anti-Harassment Policy:</strong> Vanya Group follows a zero-tolerance policy towards harassment or discrimination of any kind.</p>
              <p><strong>6. IT &amp; Internet Policy:</strong> Company systems and email must be used for official purposes only. Misuse of company assets is prohibited.</p>
            </div>
          </div>

          {/* PAGE 7: Annexure D + E */}
          <div className="offer-letter-page mt-8 mb-6" style={{ pageBreakBefore: 'always' }}>
            <h2 className="text-lg font-bold mb-2">Annexure D: Notice Period Policy</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm mb-6">
              <li>During the probation period, either party may terminate the employment by providing 15 days&apos; written notice or payment in lieu thereof.</li>
              <li>After confirmation, a 30-day written notice or salary in lieu of notice is required from either side.</li>
              <li>Failure to serve the full notice period may result in deduction from the Full &amp; Final Settlement.</li>
              <li>The company reserves the right to waive off or shorten the notice period at its discretion.</li>
              <li>Employees are expected to complete the handover process before the last working day.</li>
            </ol>

            <h2 className="text-lg font-bold mb-2">Annexure E: Late Coming &amp; Attendance Policy</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Office timings are from 09:30 AM to 6:30 PM, Monday to Saturday.</li>
              <li>Employees arriving after 09:45 AM will be marked as &apos;Late&apos;. Three late marks in a month will result in a half-day leave deduction.</li>
              <li>Attendance must be recorded using the company&apos;s attendance system.</li>
              <li>Unauthorized absence for two consecutive days without intimation may lead to disciplinary action.</li>
              <li>Repeated late coming or absenteeism will be viewed seriously and may affect performance evaluations.</li>
            </ol>
          </div>
        </main>
      </div>
      <div className="text-center mt-6 no-print">
        <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition-colors">Print Offer Letter</button>
      </div>
    </div>
  );
};

export default OfferLetterPDF;
