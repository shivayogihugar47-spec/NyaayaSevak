const { initDB, queryWithRetry } = require('../services/db');
async function run() {
  await initDB();
  await queryWithRetry(`DELETE FROM law_chunks WHERE act_name IN ('The Information Technology Act', 'The Promotion and Regulation of Online Gaming Act', 'The Digital Personal Data Protection Act', 'Aadhaar Act')`);
  console.log('Purged Nyaykosh acts.');
  process.exit(0);
}
run();
