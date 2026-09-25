const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { initDB, queryWithRetry } = require("../services/db");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

let pipeline;
async function getEmbedding(text) {
  if (!pipeline) {
    const transformers = await import("@xenova/transformers");
    pipeline = await transformers.pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
  }

  const output = await pipeline(text, { pooling: "mean", normalize: true });
  const vector = Array.from(output.data);
  return `[${vector.join(",")}]`;
}

async function run() {
  await initDB();

  // NOTE: We don't truncate the table here because we want to ADD these laws
  // alongside the ones we already ingested via JSON and fallback texts.
  console.log("Fetching laws from Nyaykosh API...");

  try {
    const response = await axios.get(
      "https://lawascode.negd.in/laac-api/v1/laws",
    );
    const laws = response.data;

    console.log(`Successfully fetched ${laws.length} laws from Nyaykosh API.`);

    for (const law of laws) {
      console.log(`\nIngesting: ${law.title}`);

      const actName = law.title;
      const provisions = law.provisions || [];
      const penalties = law.penalties || [];

      for (const prov of provisions) {
        const sectionNum = prov.num;
        const provTitle = prov.title;
        const text = prov.text;

        let rulesText = "None specified.";
        if (prov.rules && prov.rules.length > 0) {
          rulesText = prov.rules.map((r) => `- ${r}`).join("\n");
        }

        // Find matching penalties
        let penaltiesText = "None specified.";
        if (penalties.length > 0) {
          // Include all penalties globally since we can't always match perfectly by section
          // without complex parsing, or we can just append general penalties for context.
          penaltiesText = penalties
            .map((p) => `- BREACH: ${p.breach}\n  PENALTY: ${p.text}`)
            .join("\n");
        }

        const chunkText = `ACT: ${actName}
SECTION ${sectionNum}: ${provTitle}

TEXT:
${text}

RULES & COMPLIANCE:
${rulesText}

GENERAL PENALTIES FOR THIS ACT:
${penaltiesText}`;

        try {
          const embedding = await getEmbedding(chunkText);

          // Check if this specific section from this act already exists to avoid duplicates
          const exists = await queryWithRetry(
            `SELECT id FROM law_chunks WHERE act_name = $1 AND section_number = $2`,
            [actName, sectionNum],
          );

          if (exists.rows.length === 0) {
            await queryWithRetry(
              `INSERT INTO law_chunks (act_name, section_number, content, embedding) VALUES ($1, $2, $3, $4)`,
              [actName, sectionNum, chunkText, embedding],
            );
            console.log(`  ✓ Inserted Section ${sectionNum}`);
          } else {
            console.log(`  - Skipped Section ${sectionNum} (already exists)`);
          }
        } catch (err) {
          console.error(
            `  ✗ Failed to insert Section ${sectionNum}:`,
            err.message,
          );
        }
      }
    }

    console.log("\nNyaykosh API Ingestion complete. Exiting.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to fetch from Nyaykosh API:", error.message);
    process.exit(1);
  }
}

run();
