const fs = require('fs');
// Using absolute path to avoid ambiguity
const path = 'c:/XAMPP/htdocs/MARCOM-NEW-CRM/frontend/src/pages/admin/AdminEmployees.jsx';

try {
    const str = fs.readFileSync(path, 'utf8');
    const lines = str.split(/\r?\n/);

    const startIdx = lines.findIndex(l => l.includes('Refactored to DocumentGenerator'));
    let endIdx = -1;

    // Searching backwards from end
    for (let i = lines.length - 1; i > 0; i--) {
        const line = lines[i];
        const prevLine = lines[i - 1];
        if (line.trim() === '}' && prevLine.trim() === ')') {
            if (lines[i + 1] && lines[i + 1].includes('</div')) {
                endIdx = i;
                break;
            }
        }
    }

    console.log('Start Index:', startIdx);
    console.log('End Index:', endIdx);

    if (startIdx !== -1 && endIdx !== -1) {
        // Remove from startIdx to endIdx inclusive.
        const newLines = lines.slice(0, startIdx).concat(lines.slice(endIdx + 1));
        fs.writeFileSync(path, newLines.join('\n'));
        console.log('Done');
    } else {
        console.error('Could not find range. Start:', startIdx, 'End:', endIdx);
        process.exit(1);
    }
} catch (e) {
    console.error(e);
    process.exit(1);
}
