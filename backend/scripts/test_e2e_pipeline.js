const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');
const { extractText, segmentClauses } = require('../services/documentService');
const { processClause } = require('../services/ragService');
const { initDB } = require('../services/db');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function createTestPDF(pdfPath) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);
    
    stream.on('finish', resolve);
    
    doc.fontSize(16).text('RENTAL AGREEMENT', { align: 'center' });
    doc.moveDown();
    
    // Normal clause
    doc.fontSize(12).text('1. The Tenant shall pay the monthly rent of Rs. 20,000 on or before the 5th day of every month.');
    doc.moveDown();
    
    // Unfair clause 1 (Forfeiture of full deposit)
    doc.text('2. In the event that the Tenant terminates this agreement before the expiry of the 11-month lock-in period, the Landlord shall forfeit and retain the entire security deposit of Rs. 1,00,000 as an absolute penalty, regardless of actual damages.');
    doc.moveDown();
    
    // Unfair clause 2 (Unreasonable notice)
    doc.text('3. The Landlord reserves the right to evict the Tenant and demand immediate vacant possession by providing only 2 days written notice, for any reason whatsoever.');
    doc.moveDown();
    
    // Normal clause
    doc.text('4. The Tenant shall be responsible for routine maintenance, including replacing lightbulbs and minor plumbing repairs, during the tenancy.');
    doc.end();
  });
}

async function runE2E() {
  await initDB();
  const pdfPath = path.join(__dirname, 'test_agreement.pdf');
  
  console.log("1. Generating sample PDF with planted unfair clauses...");
  await createTestPDF(pdfPath);
  console.log("PDF generated at: " + pdfPath);
  
  console.log("\n2. Extracting text via documentService (uses OCR.space / pdf-parse)...");
  const buffer = fs.readFileSync(pdfPath);
  const text = await extractText(buffer, 'application/pdf');
  
  console.log("\n3. Segmenting text into clauses...");
  const clauses = segmentClauses(text);
  console.log(`Found ${clauses.length} clauses.`);
  
  console.log("\n4. Running RAG engine over each clause...");
  const results = [];
  
  for (const clause of clauses) {
    if (clause.text.trim().length < 10) continue; // skip empty/title
    console.log(`\nAnalyzing Clause [${clause.id}]: "${clause.text.substring(0, 50)}..."`);
    const analysis = await processClause(clause.text);
    results.push({
      clause_id: clause.id,
      original_text: clause.text,
      analysis: analysis
    });
  }
  
  console.log("\n================ END-TO-END PIPELINE OUTPUT ================\n");
  console.log(JSON.stringify(results, null, 2));
  
  process.exit(0);
}

runE2E().catch(err => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
