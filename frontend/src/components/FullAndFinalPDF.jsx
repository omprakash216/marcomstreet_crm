import React from 'react';
import '../styles/experience-letter.css';
import letterHeadBg from '../assets/letter-head.png';

const FullAndFinalPDF = ({
  employeeName = '',
  designation = '',
  lastWorkingDate = '',
  companyName = 'Vanya Group (Artistry Studio)',
  companyAddress = 'B-023, B Block, Sector 63, Noida',
  hrName = 'Jyoti Sharma',
  hrContact = '+91 9211608441',
  hrEmail = 'hrthevanygroup@gmail.com',
  currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}) => {
  const nameFormatted = employeeName
    ? employeeName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : '';
  const designationUpper = (designation || '').toUpperCase();

  return (
    <div className="bg-gray-100 py-8 print:bg-transparent">
      <div
        className="experience-letter-doc experience-letter-with-letterhead doc-print-as-screen full-and-final-doc mx-auto shadow-lg print:shadow-none border border-gray-300 print:border-0 relative overflow-hidden"
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
        <header className="experience-letter-header experience-letter-header-on-bg full-and-final-header px-10 pt-0 pb-0 relative">
          <h1 className="full-and-final-doc-title">Full and Final Acknowledgement</h1>
          {/* <div className="full-and-final-header-line" aria-hidden="true" /> */}
        </header>

        <main className="experience-letter-main px-10 py-6 text-sm text-gray-800 leading-relaxed content-layer">
          <div className="mb-6 full-and-final-content-block">
            <p className="font-bold text-base uppercase tracking-wide mb-2">Full and Final Acknowledgement</p>
            <p className="font-bold mb-1">DATE: {currentDate}</p>
            <p className="mt-2">Dear: {nameFormatted || '—'}</p>
          </div>

          <div className="space-y-4">
            <p>
              This is to inform you that your last working day with us was <span className="font-bold">{lastWorkingDate || '—'}</span>.
              Your full &amp; final settlement has been processed and you are relieved from your duties with effect from the said date as{' '}
              <span className="font-bold">{designationUpper || '—'}</span>.
            </p>

            <p>
              This letter acknowledges the in-person receipt of your full &amp; final settlement. Your account with the company stands closed
              and there are no outstanding dues or obligations between you and the company.
            </p>

            <p>
              Any pending payments will be cleared within 45 days as per company policy. We wish you success in your future endeavors.
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-300">
            <p className="mb-2">Regards,</p>
            <p className="font-bold text-base">{hrName}</p>
            <p className="text-sm text-gray-600">Human Resources Department</p>
            <p className="text-sm font-semibold text-gray-800">{companyName}</p>
          </div>
        </main>
      </div>

      <div className="text-center mt-6 no-print">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition-colors"
        >
          Print F&amp;F Letter
        </button>
      </div>
    </div>
  );
};

export default FullAndFinalPDF;
