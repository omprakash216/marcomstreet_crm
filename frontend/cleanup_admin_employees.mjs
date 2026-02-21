import fs from 'fs';
const path = 'src/pages/admin/AdminEmployees.jsx';

try {
    const data = fs.readFileSync(path, 'utf8');
    const lines = data.split(/\r?\n/);

    console.log(`Total lines: ${lines.length}`);

    // Verify start line (index 914)
    if (!lines[914] || !lines[914].includes('Offer Letter Modal')) {
        console.error('Start line mismatch at 915:', lines[914]);
        process.exit(1);
    }

    // Verify end line (index 1308) or around there
    // We expect index 1309 (line 1310) to be a closing div or similar
    // The modal block ends around 1309.

    console.log('Line 915:', lines[914]);
    // console.log('Line 1309:', lines[1308]); 
    // We'll splice out the chunk.

    // Remove lines 915 to 1309 (Indices 914 to 1308)
    // 1309 - 915 + 1 = 395 lines

    const newLines = [
        ...lines.slice(0, 914),
        ...lines.slice(1309)
    ];

    fs.writeFileSync(path, newLines.join('\r\n'));
    console.log('Successfully cleaned AdminEmployees.jsx');

} catch (err) {
    console.error(err);
}
