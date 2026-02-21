const fs = require('fs');
const path = 'src/pages/admin/AdminEmployees.jsx';

try {
    let content = fs.readFileSync(path, 'utf8');
    const lines = content.split(/\r?\n/);
    console.log("Total lines:", lines.length);

    // We strictly target lines 915 (index 914) to 1309 (index 1308)
    // Verify content to ensure we are deleting the right block
    const startLine = lines[914];
    const endLine = lines[1308];

    console.log("Line 915:", startLine);
    console.log("Line 1309:", endLine);

    if (startLine.includes('Refactored') && endLine.trim() === '}') {
        // Keep 0..913 (914 lines)
        // Skip 914..1308 (the modal block)
        // Keep 1309..end (rest of file)
        const part1 = lines.slice(0, 914);
        const part2 = lines.slice(1309);

        const newContent = part1.concat(part2).join('\r\n');
        fs.writeFileSync(path, newContent);
        console.log("Successfully removed lines 915-1309");
    } else {
        console.error("Markers didn't match. Aborting.");
    }

} catch (e) {
    console.error(e);
}
