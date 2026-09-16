const { queryWithRetry } = require('./db');
const { OpenRouter } = require('@openrouter/sdk');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'inclusionai/ling-3.0-flash-vl:free';

const openrouter = new OpenRouter({
  apiKey: OPENROUTER_API_KEY
});

function validateSchema(data) {
  if (typeof data !== 'object' || data === null) return false;
  if (typeof data.category !== 'string') return false;
  if (typeof data.risk_level !== 'string' || !['High', 'Medium', 'Low', 'Safe'].includes(data.risk_level)) return false;
  if (typeof data.in_simple_terms !== 'string') return false;
  if (typeof data.legal_issue !== 'string') return false;
  if (typeof data.recommended_action !== 'string') return false;
  if (data.cited_law !== null && typeof data.cited_law !== 'string') return false;
  if (typeof data.confidence_level !== 'string' || !['High', 'Medium', 'Low'].includes(data.confidence_level)) return false;
  return true;
}

let pipeline;
async function getRealEmbedding(text) {
  if (!pipeline) {
    const transformers = await import('@xenova/transformers');
    pipeline = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  const output = await pipeline(text, { pooling: 'mean', normalize: true });
  return `[${Array.from(output.data).join(',')}]`;
}

async function analyzeClauseWithLLM(clauseText, retrievedLaws, attempt = 1) {
const systemPrompt = `You are a world-class legal assistant helping non-lawyers understand rental agreements and contracts.
Analyze the given contract clause against the provided statutory law sections.
Return ONLY a strictly valid JSON object conforming to this EXACT schema (do not wrap it in markdown block quotes like \`\`\`json):
{
  "category": "A short, 1-3 word topic (e.g. 'Security Deposit', 'Indemnity')",
  "risk_level": "High" | "Medium" | "Low" | "Safe",
  "in_simple_terms": "Explain exactly what this clause means to a 5th grader in plain, conversational English.",
  "legal_issue": "If this is risky or unfair, explain exactly why (or how it violates the provided law). Reference the 'TYPICAL CLAUSE CONFLICT' in the provided laws. If perfectly safe, write 'None'.",
  "recommended_action": "Actionable advice on what the tenant/party should ask to change or remove.",
  "cited_law": "The specific Section X of Act Y that is violated (or null if no law is violated)",
  "confidence_level": "High" | "Medium" | "Low"
}

Rules:
1. "in_simple_terms" must be EXTREMELY easy to understand. No legal jargon.
2. "risk_level" must be exactly one of: High, Medium, Low, Safe.
3. Do NOT invent citations. Use only the Provided Laws context. Ensure you read the 'TYPICAL CLAUSE CONFLICT' sections to see if the clause matches known unfair practices.
4. If you cite the Model Tenancy Act, you MUST append this exact caveat: "(Model Tenancy Act — binding only in states that have adopted it; verify local applicability)".
5. NEVER flag a risk (High/Medium) without a real retrieved citation. If you cannot find a specific law in the context to back up the risk, you must mark it as 'Safe' or 'Low' risk and state you have low confidence.

Provided Laws:
${retrievedLaws.map(l => `${l.act_name}, Section ${l.section_number}:\n${l.content}`).join('\n\n')}`;

  try {
    const stream = await openrouter.chat.send({
      chatRequest: {
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Clause: "${clauseText}"` }
        ],
        stream: true,
        response_format: { type: "json_object" }
      }
    });

    let rawResponse = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) rawResponse += content;
    }
    
    // Robust cleanup: sometimes the model outputs text before or after the JSON.
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");
    const cleanJson = jsonMatch[0];
    
    const parsed = JSON.parse(cleanJson);
    if (!validateSchema(parsed)) throw new Error("Invalid schema");
    
    return parsed;
  } catch (error) {
    if (attempt < 2) return analyzeClauseWithLLM(clauseText, retrievedLaws, attempt + 1);
    return {
      category: "Unknown",
      risk_level: "Medium",
      in_simple_terms: "We tried to analyze this clause, but the AI failed to generate a standard response.",
      legal_issue: "Automated legal grounding failed to verify this clause properly.",
      recommended_action: "Review this clause manually or try re-running the analysis.",
      cited_law: null,
      confidence_level: "Low"
    };
  }
}

async function processClause(clauseText) {
  const embeddingStr = await getRealEmbedding(clauseText);
  let retrievedLaws = [];
  try {
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
    retrievedLaws = res.rows;
  } catch (err) {
    console.error("Vector search failed:", err.message);
  }

  if (retrievedLaws.length === 0) {
    return { 
      category: "Uncategorized", 
      risk_level: "Safe",
      in_simple_terms: "This clause doesn't seem to trigger any standard statutory regulations we track.",
      legal_issue: "None",
      recommended_action: "No action needed unless you have specific concerns.",
      cited_law: null,
      confidence_level: "High"
    };
  }
  return await analyzeClauseWithLLM(clauseText, retrievedLaws);
}

// New: Chat function
async function generateChatResponse(question, documentClauses) {
  const embeddingStr = await getRealEmbedding(question);
  let retrievedLaws = [];
  try {
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
    retrievedLaws = res.rows;
  } catch (err) {}

  const fullDocText = documentClauses.map(c => c.text).join('\n');
  const lawsText = retrievedLaws.map(l => `${l.act_name} Sec ${l.section_number}: ${l.content}`).join('\n\n');

  const prompt = `You are NyayaCheck, a legal assistant. Answer the user's question based strictly on the provided document and the retrieved laws. If the answer isn't in the provided text, say so. Do not give binding legal advice.
  
Document Context:
${fullDocText.substring(0, 4000)} // Truncated for token limit

Retrieved Laws Context:
${lawsText}

Rules:
1. Do NOT invent citations. Use only the Retrieved Laws context.
2. If you cite the Model Tenancy Act, you MUST append this exact caveat: "(Model Tenancy Act — binding only in states that have adopted it; verify local applicability)".

User Question: ${question}`;

  const response = await openrouter.chat.send({
    chatRequest: {
      model: MODEL,
      messages: [{ role: 'user', content: prompt }]
    }
  });

  return response.choices[0].message.content;
}

// New: Negotiation Message Generator
async function generateNegotiationMessage(clauseText, analysis) {
  const prompt = `You are a polite but firm legal assistant helping a tenant draft a negotiation email to their landlord. 
The landlord proposed this clause: "${clauseText}"
This clause is problematic because: "${analysis.legal_issue}" (Source: ${analysis.cited_law || 'General fairness'})
Your goal is to achieve this outcome: "${analysis.recommended_action}"

Draft a short, professional, 2-3 sentence paragraph that the tenant can copy-paste into an email to ask the landlord to amend or remove this clause gracefully.`;

  const response = await openrouter.chat.send({
    chatRequest: {
      model: MODEL,
      messages: [{ role: 'user', content: prompt }]
    }
  });

  return response.choices[0].message.content;
}

// New: Compare Documents
async function compareDocuments(textA, textB) {
  const prompt = `You are an expert legal reviewer. Compare these two versions of a rental agreement.
  
Document A (Old Version):
${textA.substring(0, 5000)}

Document B (New Version):
${textB.substring(0, 5000)}

Identify and list ONLY the material changes that shift liability, increase tenant risk, or alter obligations. 
Format your response as a valid JSON object matching this schema exactly (no markdown blocks, just raw JSON):
{
  "differences": [
    {
      "clause_topic": "Brief topic (e.g. 'Security Deposit')",
      "old_term": "What it used to say",
      "new_term": "What it says now",
      "risk_level": "High" | "Medium" | "Low",
      "impact": "Why this change is bad or good for the tenant"
    }
  ]
}`;

  const response = await openrouter.chat.send({
    chatRequest: {
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" }
    }
  });

  try {
    let rawResponse = response.choices[0].message.content;
    const cleanJson = rawResponse.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("Failed to parse compare JSON", err);
    return { differences: [] };
  }
}

module.exports = {
  processClause,
  generateChatResponse,
  generateNegotiationMessage,
  compareDocuments
};
