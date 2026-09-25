const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { extractText, segmentClauses } = require("../services/documentService");
const {
  processClause,
  analyzeDocumentLevelRisks,
  generateSummaryChecklist,
} = require("../services/ragService");
const { initDB } = require("../services/db");

async function runSummaryTest() {
  await initDB();
  const pdfPath = path.join(__dirname, "test_agreement.pdf");
  console.log("1. Reading test agreement PDF:", pdfPath);

  const buffer = fs.readFileSync(pdfPath);
  const text = await extractText(buffer, "application/pdf");

  console.log("2. Segmenting clauses...");
  const clauses = segmentClauses(text);
  console.log(`Segmented into ${clauses.length} clauses.`);

  console.log("3. Analyzing document-level risks...");
  const documentRisks = await analyzeDocumentLevelRisks(text);

  console.log("4. Running RAG analysis on all clauses...");
  const clauseAnalyses = [];
  for (const clause of clauses) {
    if (clause.text.trim().length < 10) continue;
    console.log(`Analyzing [${clause.id}]...`);
    const analysis = await processClause(clause.text);
    clauseAnalyses.push({
      id: clause.id,
      text: clause.text,
      analysis,
    });
  }

  console.log("5. Generating Summary Checklist & Lawyer Questions...");
  const checklist = await generateSummaryChecklist(
    documentRisks,
    clauseAnalyses,
  );

  console.log(
    "\n=================== GENERATED SUMMARY CHECKLIST OUTPUT ===================\n",
  );
  console.log(JSON.stringify(checklist, null, 2));
  console.log(
    "\n=========================================================================\n",
  );

  process.exit(0);
}

runSummaryTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
