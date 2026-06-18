const { query } = require('../config/database');

async function main() {
  try {
    const qCount = await query('SELECT COUNT(*) as cnt FROM quotations');
    const invCount = await query('SELECT COUNT(*) as cnt FROM invoices');
    console.log('Quotations Count:', qCount[0].cnt);
    console.log('Invoices Count:', invCount[0].cnt);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
