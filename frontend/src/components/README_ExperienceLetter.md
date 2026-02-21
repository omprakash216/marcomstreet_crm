# Experience Letter PDF Component

A React component for generating professional experience letters with company letterhead and watermark.

## Features

- ✅ Professional letterhead with company logo
- ✅ Watermark background
- ✅ Print-optimized CSS
- ✅ Dynamic employee data
- ✅ PDF-ready styling
- ✅ Responsive design
- ✅ Gender-aware pronouns

## Usage

### Basic Usage

```jsx
import ExperienceLetterPDF from './components/ExperienceLetterPDF';

function MyComponent() {
  return (
    <ExperienceLetterPDF
      employeeName="John Doe"
      employeeCode="EMP001"
      designation="Software Developer"
      joiningDate="15 January 2024"
      relievingDate="15 January 2025"
      responsibilities="developing web applications, maintaining codebase, and collaborating with team members"
      companyName="Your Company Name"
      companyAddress="Company Address"
      hrName="HR Manager Name"
      hrContact="+91 9876543210"
      hrEmail="hr@company.com"
    />
  );
}
```

### With Employee Data

```jsx
import ExperienceLetterPDF from './components/ExperienceLetterPDF';

function EmployeeLetter({ employee }) {
  return (
    <ExperienceLetterPDF
      employeeName={employee.name}
      employeeCode={employee.employee_code}
      designation={employee.designation}
      joiningDate={employee.joining_date}
      relievingDate={employee.relieving_date}
      responsibilities={employee.responsibilities}
      companyName="Vanya Group (Artistry Studio)"
      companyAddress="B-023, B Block, Sector 63, Noida"
      hrName="Jyoti Sharma"
      hrContact="+91 9211608441"
      hrEmail="hrthevanygroup@gmail.com"
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `employeeName` | string | Yes | Full name of the employee |
| `employeeCode` | string | No | Employee code/ID |
| `designation` | string | Yes | Job title/designation |
| `joiningDate` | string | Yes | Joining date (DD Month YYYY format) |
| `relievingDate` | string | Yes | Relieving date (DD Month YYYY format) |
| `responsibilities` | string | Yes | Job responsibilities description |
| `companyName` | string | Yes | Company name |
| `companyAddress` | string | Yes | Company address |
| `hrName` | string | Yes | HR Manager name |
| `hrContact` | string | Yes | HR contact number |
| `hrEmail` | string | Yes | HR email address |
| `currentDate` | string | No | Current date (auto-generated if not provided) |

## Styling

The component uses inline styles for PDF compatibility:

- **Letterhead**: VG Shield logo with company branding
- **Watermark**: Semi-transparent background image
- **Typography**: Professional fonts and spacing
- **Layout**: A4 paper size optimized
- **Print CSS**: Browser print compatibility

## Integration

### In HR Documents Page

```jsx
import ExperienceLetterGenerator from './components/ExperienceLetterGenerator';

function HRDocuments() {
  return (
    <div>
      {/* Other content */}
      <ExperienceLetterGenerator employeeData={selectedEmployee} />
    </div>
  );
}
```

### Standalone Demo

```jsx
import ExperienceLetterDemo from './pages/ExperienceLetterDemo';

// Add to your router
<Route path="/experience-letter-demo" element={<ExperienceLetterDemo />} />
```

## File Structure

```
src/
├── components/
│   ├── ExperienceLetterPDF.jsx          # Main PDF component
│   ├── ExperienceLetterGenerator.jsx    # Form generator
│   └── README_ExperienceLetter.md       # This documentation
├── pages/
│   └── ExperienceLetterDemo.jsx         # Demo page
└── assets/
    ├── VANYA_GRP.png                    # Company logo
    └── watermark.png                    # Watermark image
```

## Print Instructions

1. Click the "Print Experience Letter" button
2. Use browser print dialog (Ctrl+P / Cmd+P)
3. Select "Save as PDF" option
4. Choose A4 paper size
5. Ensure background graphics are enabled

## Customization

### Company Branding

Replace the logo and watermark images:
- `VANYA_GRP.png` - Company logo (recommended 233x233px)
- `watermark.png` - Watermark image (recommended 400x170px)

### Styling Modifications

Edit the inline styles in `ExperienceLetterPDF.jsx`:
- Colors: Modify hex color values
- Fonts: Change font-family properties
- Spacing: Adjust margin/padding values
- Logo positioning: Modify shield container styles

### Content Changes

- Update company information in props
- Modify letter content structure
- Change signature format
- Add additional sections

## Dependencies

- React 18+
- No external dependencies required
- Works with standard browser print functionality

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## Notes

- Component uses inline styles for PDF compatibility
- Print CSS is automatically applied when printing
- Letterhead and watermark maintain proper positioning
- All text is selectable and editable in PDF output
- Component is fully responsive and mobile-friendly