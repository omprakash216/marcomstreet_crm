import React from 'react';
import '../styles/experience-letter.css';
import letterHeadBg from '../assets/letter-head.png';
import hrSignature from '../assets/hr_signature.png';

const ExperienceLetterPDF = ({
  employeeName = "KAJAL KUMARI",
  employeeCode = "EMP001",
  designation = "3D Visualizer Designer",
  joiningDate = "22 July 2025",
  relievingDate = "29 November 2025",
  gender = "female",
  companyName = "Vanya Group (Artistry Studio)",
  companyAddress = "B-023, B Block, Sector 63, Noida",
  hrName = "Jyoti Sharma",
  hrContact = "+91 9211608441",
  hrEmail = "hrthevanygroup@gmail.com",
  currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}) => {
  // Determine pronouns based on gender
  const isFemale = gender === 'female';
  const title = isFemale ? 'Ms.' : 'Mr.';
  const pronoun = isFemale ? 'her' : 'his';
  const pronounCap = isFemale ? 'Her' : 'His';
  const pronounSub = isFemale ? 'she' : 'he';
  const pronounObj = isFemale ? 'her' : 'him';
  
  // Format employee name
  const nameUpper = employeeName.toUpperCase();
  const nameFormatted = employeeName.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');

  return (
    <div className="bg-gray-100 py-8 print:bg-white">
      {/* Main Document Container - letterhead as background; only this prints */}
      <div
        className="experience-letter-doc experience-letter-with-letterhead doc-print-as-screen mx-auto shadow-lg print:shadow-none border border-gray-300 relative overflow-hidden"
        style={{
          backgroundImage: `url(${letterHeadBg})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top left',
          width: '210mm',
          minHeight: '297mm',
          backgroundColor: '#fff',
          boxSizing: 'border-box'
        }}
      >
        {/* Header: only title + divider (logo & watermark are on letterhead image) */}
        <header className="experience-letter-header experience-letter-header-on-bg p-8 pb-4 relative">
          <h1 className="experience-letter-doc-title">
            Experience Letter
          </h1>
          {/* <div className="letterhead-divider letterhead-divider-on-bg"></div> */}
        </header>

        {/* Main Content - flows across pages, padding in print for fixed header/footer */}
        <main className="experience-letter-main px-10 py-6 text-sm text-gray-800 leading-relaxed content-layer">
          <div className="font-bold text-lg text-gray-800 mt-12">
            {companyName}
          </div>
          {/* 13px gap between company name and line; line then address */}
        
          <div className="mt-2">
            {companyAddress}
          </div>
          
          {/* Recipient */}
          <div className="mb-6">
            <p className="font-bold text-lg uppercase tracking-wide">
              To Whomsoever It May Concern
            </p>
          </div>

          {/* Date */}
          <div className="mb-6">
            <p>
              <span className="font-semibold">Date:</span>{' '}
              <span className="font-bold">{currentDate}</span>
            </p>
          </div>

          {/* Certification Content */}
          <div className="space-y-4">
            <p>
              This is to certify that <span className="font-bold">{title} {nameUpper}</span> was employed with{' '}
              <span className="font-bold">{companyName}</span> as a{' '}
              <span className="font-bold">{designation}</span> from{' '}
              <span className="font-bold">{joiningDate}</span> to <span className="font-bold">{relievingDate}</span>.
            </p>

            <p>
              During {pronoun} tenure, {pronounSub} was responsible for handling {designation} tasks,
              developing creative assets, and supporting branding and marketing requirements
              across various projects. {title} {nameFormatted} demonstrated strong creativity,
              attention to detail, and the ability to meet deadlines consistently.
              {pronounCap} work ethics, discipline, and conduct with colleagues and management were satisfactory.
            </p>

            <p className="font-semibold text-base">
              {companyName}
            </p>

            <p>
              All responsibilities and handovers have been completed. As per company policy,
              {pronoun} pending salary will be processed and released within 45 days from {pronoun} last working date.
            </p>

            <p>
              We appreciate {pronoun} contributions and wish {pronounObj} success in {pronoun} future endeavors.
            </p>
          </div>

          {/* Signature Section */}
          <div className="mt-12 pt-8 border-t border-gray-300">
            <div className="flex justify-start">
              <div className="text-left">
                <p className="mb-2">
                  For <span className="font-semibold">{companyName}</span>
                </p>
                <div className="mt-8">
                  <p className="font-bold text-base">{hrName}</p>
                  <p className="text-sm text-gray-600">Human Resources Department</p>
                  <p className="text-sm text-gray-600">{hrContact}</p>
                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2">Signature:</p>
                    <div className="experience-letter-signature-box w-48" style={{ minHeight: '60px', paddingBottom: '50px' }}>
                      <img
                        src={hrSignature}
                        alt="HR Signature" 
                        className="w-32 h-auto mt-2"
                        style={{ display: 'block' }}
                        onError={(e) => {
                          // Hide image if not found, show placeholder
                          e.target.style.display = 'none';
                          const placeholder = e.target.nextElementSibling;
                          if (placeholder) {
                            placeholder.style.display = 'block';
                          }
                        }}
                      />
                      {/* Fallback placeholder - shown if image fails */}
                      <div 
                        style={{ 
                          display: 'none',
                          minHeight: '50px', 
                          paddingTop: '10px', 
                          color: '#6b7280', 
                          fontStyle: 'italic',
                          fontSize: '12px'
                        }}
                      >
                        (Signature)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        {/* Footer strip is on letterhead image - no duplicate footer */}
      </div>

      {/* Print Button (Hidden in print) */}
      <div className="text-center mt-6 no-print">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition-colors"
        >
          Print Experience Letter
        </button>
      </div>
    </div>
  );
};

export default ExperienceLetterPDF;
