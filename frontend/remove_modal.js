const fs = require('fs');
const filePath = 'c:/XAMPP/htdocs/MARCOM-NEW-CRM/frontend/src/pages/admin/AdminEmployees.jsx';

try {
    const data = fs.readFileSync(filePath, 'utf8');
    // Split by newlines, handling both CRLF and LF
    const lines = data.split(/\r?\n/);

    // Check if the file has enough lines
    if (lines.length < 1310) {
        console.error(`File has fewer lines (${lines.length}) than expected.`);
        process.exit(1);
    }

    // Verify content at boundary lines to be extra safe
    const startLineContent = lines[914].trim(); // Index 914 = Line 915
    const endLineContent = lines[1308].trim();  // Index 1308 = Line 1309

    console.log('Line 915:', startLineContent);
    console.log('Line 1309:', endLineContent);

    if (!startLineContent.includes('Offer Letter Modal') && !startLineContent.includes('showOfferModal')) {
        console.warn("Warning: Line 915 doesn't look like the start of the modal.");
    }

    // Removing lines 915 to 1309 (indices 914 to 1308)
    // We keep 0..913 and 1309..end
    const newLines = [
        ...lines.slice(0, 914),
        ...lines.slice(1309)
    ];

    const newContent = newLines.join('\r\n'); // Use CRLF for Windows
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Successfully removed Lines 915-1309.');

} catch (err) {
    console.error(err);
}
