const fs = require('fs');
const path = require('path');
const { initDB, queryWithRetry } = require('../services/db');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let pipeline;
async function getEmbedding(text) {
  if (!pipeline) {
    const transformers = await import('@xenova/transformers');
    pipeline = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  
  const output = await pipeline(text, { pooling: 'mean', normalize: true });
  const vector = Array.from(output.data);
  return `[${vector.join(',')}]`;
}

async function run() {
  await initDB();
  
  console.log("Clearing old law chunks...");
  await queryWithRetry('TRUNCATE TABLE law_chunks RESTART IDENTITY');
  
  const scriptsDir = __dirname;
  const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.json'));
  
  console.log(`Found ${files.length} JSON law files.`);
  
  for (const file of files) {
    console.log(`\nIngesting ${file}...`);
    const filePath = path.join(scriptsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    const actName = data.act_name;
    const jurisdiction = data.jurisdiction || 'India';
    const sections = data.sections || [];
    
    for (const section of sections) {
      const sectionNum = section.section_number;
      const title = section.title;
      const text = section.text;
      const conflict = section.typical_clause_conflict;
      
      const chunkText = `ACT: ${actName}
JURISDICTION: ${jurisdiction}

SECTION ${sectionNum}: ${title}
${text}

TYPICAL CLAUSE CONFLICT:
${conflict}`;

      try {
        const embedding = await getEmbedding(chunkText);
        await queryWithRetry(
          `INSERT INTO law_chunks (act_name, section_number, content, embedding) VALUES ($1, $2, $3, $4)`,
          [actName, sectionNum, chunkText, embedding]
        );
        console.log(`  ✓ Inserted Section ${sectionNum}`);
      } catch (err) {
        console.error(`  ✗ Failed to insert Section ${sectionNum}:`, err.message);
      }
    }
  }
  
  console.log('\nJSON Ingestion complete. Exiting.');
  process.exit(0);
}

run();
