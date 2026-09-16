const { initDB, queryWithRetry } = require('../services/db');
const { OpenRouter } = require('@openrouter/sdk');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});

let pipeline;
async function getRealEmbedding(text) {
  if (!pipeline) {
    const transformers = await import('@xenova/transformers');
    pipeline = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  const output = await pipeline(text, { pooling: 'mean', normalize: true });
  return `[${Array.from(output.data).join(',')}]`;
}

async function run() {
  await initDB();
  
  const question = "can my landlord keep my full deposit if I break the lease early?";
  console.log(`User Question: "${question}"\n`);
  
  const embeddingStr = await getRealEmbedding(question);
  
  const res = await queryWithRetry(`
      WITH RankedChunks AS (
        SELECT act_name, section_number, content, 
               1 - (embedding <=> $1) as similarity,
               ROW_NUMBER() OVER(PARTITION BY act_name ORDER BY embedding <=> $1) as rn
        FROM law_chunks
        WHERE 1 - (embedding <=> $1) >= 0.3
      )
      SELECT * 
      FROM RankedChunks 
      WHERE rn <= 2
      ORDER BY similarity DESC
      LIMIT 7
    `, [embeddingStr]);
  
  const retrievedLaws = res.rows;
  console.log("=== RAW RETRIEVED CHUNKS ===");
  retrievedLaws.forEach((l, i) => {
    console.log(`\n[Chunk ${i+1}] Similarity: ${l.similarity.toFixed(4)} | Act: ${l.act_name} | Section: ${l.section_number}`);
    console.log(`Content Preview: ${l.content.substring(0, 150).replace(/\n/g, ' ')}...`);
  });
  
  const lawsText = retrievedLaws.map(l => `${l.act_name} Sec ${l.section_number}: ${l.content}`).join('\n\n');
  
  const prompt = `You are NyayaCheck, a legal assistant. Answer the user's question based strictly on the retrieved laws. If the answer isn't in the provided text, say so. Do not give binding legal advice.
  
Retrieved Laws Context:
${lawsText}

Rules:
1. Do NOT invent citations. Use only the Retrieved Laws context.
2. If you cite the Model Tenancy Act, you MUST append this exact caveat: "(Model Tenancy Act — binding only in states that have adopted it; verify local applicability)".

User Question: ${question}`;

  console.log("\n=== CALLING AI... ===");
  
  const response = await openrouter.chat.send({
    chatRequest: {
      model: process.env.OPENROUTER_MODEL || 'inclusionai/ling-3.0-flash-vl:free',
      messages: [{ role: 'user', content: prompt }]
    }
  });

  console.log("\n=== AI RESPONSE ===\n");
  console.log(response.choices[0].message.content);
  
  process.exit(0);
}

run();
