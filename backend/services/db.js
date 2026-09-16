const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool to Neon DB
// Neon uses standard Postgres connection strings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Neon requires SSL
  },
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Important for remote DB latency
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Execute a query with retry logic.
 * Essential for remote Serverless Postgres (Neon) where connections might drop or latency spikes occur.
 */
async function queryWithRetry(text, params, retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const start = Date.now();
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log(`Executed query in ${duration}ms (Attempt ${i + 1})`);
      return res;
    } catch (error) {
      console.warn(`Query failed on attempt ${i + 1}: ${error.message}`);
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, backoff * (i + 1))); // exponential backoff
    }
  }
}

/**
 * Ensures the pgvector extension and required tables exist
 */
async function initDB() {
  try {
    await queryWithRetry(`CREATE EXTENSION IF NOT EXISTS vector;`);
    
    // Create the chunks table
    await queryWithRetry(`
      CREATE TABLE IF NOT EXISTS law_chunks (
        id SERIAL PRIMARY KEY,
        act_name TEXT NOT NULL,
        section_number TEXT NOT NULL,
        section_title TEXT,
        content TEXT NOT NULL,
        embedding vector(384) -- Using 384 dimensions for all-MiniLM-L6-v2 embeddings
      );
    `);
    
    // Create an HNSW index on the embedding column for fast approximate nearest neighbor search
    await queryWithRetry(`
      CREATE INDEX IF NOT EXISTS law_chunks_embedding_idx 
      ON law_chunks 
      USING hnsw (embedding vector_cosine_ops);
    `);
    
    console.log("Database initialized successfully with pgvector.");
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}

module.exports = {
  pool,
  queryWithRetry,
  initDB
};
