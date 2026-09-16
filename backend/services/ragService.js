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

  const prompt = `You are NyayaCheck, a strict legal assistant. Answer the user's question based ONLY on the provided document clauses and the retrieved laws.

Document Context:
${fullDocText.substring(0, 4000)}

Retrieved Laws Context:
${retrievedLaws.length > 0 ? lawsText : "NONE FOUND"}

Rules:
1. Do NOT invent citations or laws. Use only the Retrieved Laws context.
2. If you cite the Model Tenancy Act, you MUST append this exact caveat: "(Model Tenancy Act — binding only in states that have adopted it; verify local applicability)".
3. If no relevant laws are in the Retrieved Laws Context (i.e. it says "NONE FOUND"), or if the document clauses do not contain the answer, you MUST state that you cannot find a grounded answer in the legal context rather than guessing. Do not try to answer using general knowledge. If this happens, you MUST return an empty array [] for "sources".
4. Your output MUST be a JSON object matching this exact schema:
{
  "answer": "Your detailed answer to the question",
  "sources": [
    { "type": "clause" | "law", "reference": "e.g. Clause 2 or Indian Contract Act, Sec 74" }
  ]
}

User Question: ${question}`;

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
    console.error("Failed to parse chat JSON", err);
    return { answer: "Sorry, I encountered an error formatting my response.", sources: [] };
  }
}

// New: Negotiation Message Generator
async function generateNegotiationMessage(clauseText, analysis) {
  const prompt = `You are a polite but firm legal assistant helping a tenant draft a negotiation email to their landlord. 
The landlord proposed this clause: "${clauseText}"
This clause is problematic because: "${analysis.legal_issue}" 
Relevant Law: ${analysis.cited_law || 'General fairness'}
Your goal is to achieve this outcome: "${analysis.recommended_action}"

Draft a short, professional, 1-2 paragraph message that the tenant can copy-paste into an email or WhatsApp to ask the landlord to amend or remove this clause gracefully.

CRITICAL RULES:
1. You MUST explicitly reference the original clause and the specific law in your message.
2. Ensure the message flows naturally and is grammatically correct. Do NOT clumsily paste template variables like "Regarding [clause]" into the middle of another sentence. It must read as a coherent, human-written letter.
3. Do not offer generic legal advice.
4. Keep the tone collaborative but firm on the legal boundary.`;

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

// New: Document Level Risks
async function analyzeDocumentLevelRisks(documentText) {
  const prompt = `You are an expert Indian legal reviewer. Review the entire provided document for "Document-Level Risks" that cannot be understood by looking at a single clause in isolation.
  
Specifically, look for:
1. 11-Month Registration Avoidance: Check if the lease term is exactly 11 months. If so, explain that this is a common practice to avoid mandatory registration under Section 17(1)(d) of the Registration Act, 1908, but it reduces the tenant's legal protection in court.

Document Text:
${documentText.substring(0, 8000)}

Output a JSON object matching this schema exactly:
{
  "document_risks": [
    {
      "title": "Short title of the risk (e.g. '11-Month Registration Avoidance')",
      "description": "Clear explanation of the risk and why it matters.",
      "risk_level": "Medium" | "High"
    }
  ]
}
If no document-level risks are found, return an empty array for "document_risks".`;

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
    return JSON.parse(cleanJson).document_risks || [];
  } catch (err) {
    console.error("Failed to parse document risks JSON", err);
    return [];
  }
}

// New: Lawyer Questions Generator for Summary Checklist
async function generateLawyerQuestions(documentRisks, clauseAnalyses) {
  const highRisk = clauseAnalyses.filter(c => c.analysis.risk_level === 'High');
  const lowConfidence = clauseAnalyses.filter(c => c.analysis.confidence_level === 'Low');
  const mediumRisk = clauseAnalyses.filter(c => c.analysis.risk_level === 'Medium');

  const prompt = `You are a senior advocate preparing a client for a formal consultation with a lawyer regarding a rental/contract agreement.

Document-Level Risks Found:
${JSON.stringify(documentRisks, null, 2)}

High-Severity Flagged Clauses:
${JSON.stringify(highRisk.map(c => ({ clause_id: c.id, text: c.text, category: c.analysis.category, issue: c.analysis.legal_issue, cited_law: c.analysis.cited_law })), null, 2)}

Medium-Severity & Low-Confidence Items:
${JSON.stringify([...mediumRisk, ...lowConfidence].map(c => ({ clause_id: c.id, text: c.text, category: c.analysis.category, issue: c.analysis.legal_issue, confidence: c.analysis.confidence_level })), null, 2)}

Generate 3 to 4 highly targeted, professional questions for the client to ask their advocate during a legal consultation.

CRITICAL RULES:
1. Questions must read as genuine consultation prep (e.g., asking about statutory remedies, court enforceability, state-specific amendments, or structuring addendums).
2. DO NOT generate draft messages/emails to the landlord or negotiation dialogue.
3. Explicitly reference relevant statutory provisions (e.g. Section 74 of the Indian Contract Act, 1872 for penalty forfeiture, Section 17 of the Registration Act, 1908 for 11-month leases, or Model Tenancy Act adoption status) where applicable.
4. Output ONLY a strictly valid JSON object matching this schema:
{
  "questions": [
    {
      "topic": "Short topic (e.g. 'Penalty Clause Enforceability')",
      "question": "The precise, professional question to ask the advocate.",
      "context": "Brief explanation of why this question is necessary based on the flagged clause or document risk."
    }
  ]
}`;

  try {
    const response = await openrouter.chat.send({
      chatRequest: {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      }
    });

    let rawResponse = response.choices[0].message.content;
    const cleanJson = rawResponse.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJson);
    return parsed.questions || [];
  } catch (err) {
    console.error("Failed to generate lawyer questions", err);
    return [
      {
        topic: "Clause Enforceability",
        question: "Are the penalty and immediate eviction clauses legally enforceable under local state tenancy laws?",
        context: "Multiple high-risk clauses were identified in the agreement."
      }
    ];
  }
}

async function generateSummaryChecklist(documentRisks, clauseAnalyses) {
  const lawyerQuestions = await generateLawyerQuestions(documentRisks, clauseAnalyses);

  // Non-obvious legal insights collection
  const nonObviousInsights = [];
  
  const registrationRisk = documentRisks.find(r => r.title.includes('11-Month') || r.description.includes('Registration Act'));
  if (registrationRisk) {
    nonObviousInsights.push({
      title: "11-Month Lease Registration Risk (Section 17, Registration Act 1908)",
      insight: "While 11-month agreements avoid mandatory registration fees, an unregistered document may be inadmissible as primary evidence in court for enforcing lease terms or recovering deposits under Section 49 of the Registration Act."
    });
  }

  // General non-obvious insight on NI Act Section 138 (cheque bouncing / statutory notice)
  nonObviousInsights.push({
    title: "Statutory Notice Timelines for Bounced Rent Payments (NI Act Section 138)",
    insight: "If security deposit or rent cheques bounce, Section 138 of the Negotiable Instruments Act mandates serving a legal demand notice within 30 days of receiving bank dishonour memo, with 15 days provided for payment before filing a complaint."
  });

  return {
    disclaimer: "DISCLAIMER: NyayaCheck provides automated legal analysis based on statutory databases for informational purposes only. It does not constitute formal legal advice. Laws vary by state and local jurisdiction. Always consult a qualified advocate before signing or taking legal action.",
    generated_at: new Date().toISOString(),
    summary_stats: {
      total_clauses_analyzed: clauseAnalyses.length,
      high_risk_count: clauseAnalyses.filter(c => c.analysis.risk_level === 'High').length,
      medium_risk_count: clauseAnalyses.filter(c => c.analysis.risk_level === 'Medium').length,
      document_risks_count: documentRisks.length
    },
    document_level_risks: documentRisks,
    non_obvious_insights: nonObviousInsights,
    flagged_clauses: clauseAnalyses.map(c => ({
      clause_id: c.id,
      text: c.text,
      category: c.analysis.category,
      risk_level: c.analysis.risk_level,
      in_simple_terms: c.analysis.in_simple_terms,
      legal_issue: c.analysis.legal_issue,
      cited_law: c.analysis.cited_law,
      confidence_level: c.analysis.confidence_level,
      recommended_action: c.analysis.recommended_action
    })),
    questions_for_lawyer: lawyerQuestions
  };
}

module.exports = {
  processClause,
  generateChatResponse,
  generateNegotiationMessage,
  compareDocuments,
  analyzeDocumentLevelRisks,
  generateLawyerQuestions,
  generateSummaryChecklist
};
