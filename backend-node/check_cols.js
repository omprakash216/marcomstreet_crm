const { query } = require('./config/database');
require('dotenv').config();

async function check() {
    try {
        const columns = await query('DESCRIBE employees');
        console.log(JSON.stringify(columns.map(c => c.Field), null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
