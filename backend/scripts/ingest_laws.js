const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const { initDB, pool, queryWithRetry } = require("../services/db");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Real embedding generator using local transformers
let pipeline;
async function getEmbedding(text) {
  if (!pipeline) {
    // Dynamic import to avoid top-level await issues if any
    const transformers = await import("@xenova/transformers");
    pipeline = await transformers.pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
  }

  // Extract embedding
  const output = await pipeline(text, { pooling: "mean", normalize: true });
  // output.data is a Float32Array of length 384
  const vector = Array.from(output.data);
  return `[${vector.join(",")}]`;
}

// Fallback texts location
const FALLBACK_DIR = path.join(__dirname, "fallback_texts");

async function ingestAct(actName, actUrl, fallbackFilename) {
  console.log(`Starting ingestion for: ${actName}`);
  let actText = "";

  try {
    console.log(`Attempting to scrape ${actUrl}...`);
    // NOTE: This scraping logic is highly dependent on the structure of indiacode.nic.in
    // We fetch the page and extract text.
    const response = await axios.get(actUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    const $ = cheerio.load(response.data);
    // Assuming the text is in some container, this selector might need tuning
    actText = $("body").text();

    // Cache it as fallback for future runs
    if (actText.length > 500) {
      fs.writeFileSync(path.join(FALLBACK_DIR, fallbackFilename), actText);
      console.log(`Successfully scraped and cached ${actName}`);
    } else {
      throw new Error("Scraped text too short, might be blocked.");
    }
  } catch (err) {
    console.warn(
      `Scraping failed for ${actName} (${err.message}). Using fallback file.`,
    );
    try {
      actText = fs.readFileSync(
        path.join(FALLBACK_DIR, fallbackFilename),
        "utf-8",
      );
    } catch (fsErr) {
      console.error(
        `Fallback file not found: ${fallbackFilename}. Please manually download it.`,
      );
      return;
    }
  }

  // Simple chunking strategy (by paragraphs or sections)
  // In a real scenario, this would use a robust legal-text regex to split by "Section 1", "Section 2"
  const chunks = actText
    .split(/(?=Section \d+)/i)
    .filter((c) => c.trim().length > 20);

  console.log(
    `Chunked ${actName} into ${chunks.length} sections. Embedding and inserting...`,
  );

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim();
    // basic extraction for demo
    const sectionMatch = chunk.match(/Section (\d+[A-Z]?)/i);
    const sectionNumber = sectionMatch ? sectionMatch[1] : `P${i}`;

    try {
      const embedding = await getEmbedding(chunk);
      await queryWithRetry(
        `INSERT INTO law_chunks (act_name, section_number, content, embedding) VALUES ($1, $2, $3, $4)`,
        [actName, sectionNumber, chunk, embedding],
      );
    } catch (e) {
      console.error(`Failed to insert chunk ${i} for ${actName}:`, e.message);
    }
  }

  console.log(`Finished ingesting ${actName}`);
}

async function run() {
  await initDB();

  console.log("Clearing old law chunks...");
  await queryWithRetry("TRUNCATE TABLE law_chunks RESTART IDENTITY");

  // URLs would be the actual indiacode pages
  await ingestAct(
    "Transfer of Property Act, 1882",
    "https://www.indiacode.nic.in/handle/123456789/2338",
    "transfer_of_property_act.txt",
  );
  await ingestAct(
    "Indian Contract Act, 1872",
    "https://www.indiacode.nic.in/handle/123456789/2187",
    "indian_contract_act.txt",
  );
  await ingestAct(
    "Model Tenancy Act, 2021",
    "https://mohua.gov.in/upload/uploadfiles/magazines/Model-Tenancy-Act.pdf",
    "model_tenancy_act.txt",
  );

  console.log("Ingestion complete. Exiting.");
  process.exit(0);
}

run();
