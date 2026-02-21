const fs = require('fs');
try {
    const content = fs.readFileSync('src/pages/admin/AdminEmployees.jsx', 'utf8');
    console.log("Success reading file. Length: " + content.length);
} catch (e) {
    console.error(e);
}
