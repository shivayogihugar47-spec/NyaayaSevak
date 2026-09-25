const path = require("path");
const fs = require("fs");
const { extractText, segmentClauses } = require("../services/documentService");
const { generateChatResponse } = require("../services/ragService");
const { initDB } = require("../services/db");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function runChatTest() {
  await initDB();
  const pdfPath = path.join(__dirname, "test_agreement.pdf");

  console.log("1. Extracting and Segmenting Clauses...");
  const buffer = fs.readFileSync(pdfPath);
  const text = await extractText(buffer, "application/pdf");
  const clauses = segmentClauses(text);

  console.log(`Extracted ${clauses.length} clauses.`);

  const questions = [
    "Can I get my full deposit back if I gave proper notice?",
    "Can the landlord evict me immediately?",
    "What are my rights under a car loan agreement?",
  ];

  for (const q of questions) {
    console.log(`\n======================================`);
    console.log(`Q: "${q}"`);
    console.log(`======================================\n`);

    try {
      const response = await generateChatResponse(q, clauses);
      console.log(JSON.stringify(response, null, 2));
    } catch (err) {
      console.error("Error generating response:", err);
    }
  }

  process.exit(0);
}

runChatTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
