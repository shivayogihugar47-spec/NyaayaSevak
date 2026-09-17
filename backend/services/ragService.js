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

  // Collect verified citations present in the analyzed clauses & document risks
  const verifiedCitations = new Set();
  clauseAnalyses.forEach(c => {
    if (c.analysis.cited_law && c.analysis.cited_law !== 'None' && c.analysis.cited_law !== 'Safe') {
      verifiedCitations.add(c.analysis.cited_law);
    }
  });
  documentRisks.forEach(r => {
    if (r.description.includes('Registration Act') || r.title.includes('Registration')) {
      verifiedCitations.add('Registration Act, 1908, Section 17');
    }
  });

  const verifiedCitationsList = Array.from(verifiedCitations).join('; ') || 'None specifically cited';

  const prompt = `You are a legal advisor helping a non-lawyer client prepare simple, direct questions to ask their advocate during a legal consultation.

Verified Citations Found in Document Analysis:
${verifiedCitationsList}

Document-Level Risks Found:
${JSON.stringify(documentRisks, null, 2)}

High-Severity Flagged Clauses:
${JSON.stringify(highRisk.map(c => ({ clause_id: c.id, text: c.text, category: c.analysis.category, issue: c.analysis.legal_issue, cited_law: c.analysis.cited_law })), null, 2)}

Medium-Severity & Low-Confidence Items:
${JSON.stringify([...mediumRisk, ...lowConfidence].map(c => ({ clause_id: c.id, text: c.text, category: c.analysis.category, issue: c.analysis.legal_issue, confidence: c.analysis.confidence_level })), null, 2)}

Generate 3 to 4 short, clear questions for the client to ask their advocate during a consultation.

CRITICAL RULES:
1. STRICT GROUNDING: You MUST ONLY reference section numbers or Act names that appear in the "Verified Citations Found in Document Analysis" list above. DO NOT invent, hallucinate, or cite any other Acts or section numbers (e.g. do NOT cite Specific Relief Act, Civil Procedure Code, or any law not in the verified list). If you mention a legal strategy concept (like an addendum or court protection), describe it in plain English without citing unverified section numbers.
2. PLAIN & DIRECT PHRASING: Write each question in plain, simple, spoken English that a non-lawyer client can easily read out loud in a meeting. Keep it short and ask ONE clear question per topic.
3. CONTEXT SEPARATION: Keep detailed legal reasoning and statutory citations in the separate "context" field — do NOT pack long legal jargon into the question text.
4. Output ONLY a strictly valid JSON object matching this schema:
{
  "questions": [
    {
      "topic": "Short 2-4 word topic (e.g. 'Deposit Forfeiture')",
      "question": "Plain, short, direct question a client can ask out loud.",
      "context": "Explanation of why to ask this, referencing the verified citation."
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
        question: "Are the penalty and immediate eviction clauses legally enforceable in court?",
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

/**
 * Generate proactive spoken briefing for voice call start
 * Uses documentRisks + top 2 highest-severity flagged clauses
 */
async function generateVoiceBriefing(documentRisks = [], clauseAnalyses = []) {
  const highRisk = clauseAnalyses.filter(c => c.analysis && c.analysis.risk_level === 'High');
  const mediumRisk = clauseAnalyses.filter(c => c.analysis && c.analysis.risk_level === 'Medium');
  const topClauses = [...highRisk, ...mediumRisk].slice(0, 2);

  const topRisksSummary = {
    documentRisks: documentRisks.map(r => ({ title: r.title, description: r.description })),
    flaggedClauses: topClauses.map(c => ({
      clauseId: c.id,
      category: c.analysis.category,
      issue: c.analysis.legal_issue,
      cited_law: c.analysis.cited_law,
      risk_level: c.analysis.risk_level
    }))
  };

  const prompt = `You are NyayaCheck Voice Assistant speaking directly to a user over a phone/voice call.
Create a short, engaging, 2-3 sentence spoken opening briefing for the user about their contract.

Document Analysis Data:
${JSON.stringify(topRisksSummary, null, 2)}

Rules:
1. Start directly with a warm, professional greeting and state the main findings immediately.
2. Mention 1 primary document risk (if any, like 11-month lease registration) and up to 2 top clause red flags.
3. Keep it conversational, spoken-friendly, clear, and under 60 words so it sounds natural when spoken aloud.
4. End by inviting the user to ask questions about any clause or law.`;

  try {
    const response = await openrouter.chat.send({
      chatRequest: {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }]
      }
    });

    const briefingText = response.choices[0].message.content.trim();
    
    // Collect sources present in top briefing
    const sources = [];
    topClauses.forEach(c => {
      if (c.analysis && c.analysis.cited_law && c.analysis.cited_law !== 'None') {
        sources.push({ type: 'law', reference: c.analysis.cited_law });
      }
      sources.push({ type: 'clause', reference: `Clause ${c.id}: ${c.analysis.category}` });
    });
    if (documentRisks.some(r => r.title.includes('Registration'))) {
      sources.push({ type: 'law', reference: 'Registration Act 1908, Sec 17' });
    }

    return {
      briefing: briefingText,
      topRisksSummary,
      sources
    };
  } catch (err) {
    console.error("Voice briefing generation error:", err);
    return {
      briefing: "Hello! I've reviewed your agreement. I found a few key areas that require your attention, including security deposit terms and lease duration risks. What specific clause would you like me to explain?",
      sources: []
    };
  }
}

/**
 * Tool: getClauseDetail(session, clauseId)
 */
async function getClauseDetail(session, clauseIdQuery) {
  if (!session || !session.clauses) {
    return { error: "Session or clauses not found." };
  }

  // Handle various clause ID formats (e.g. "clause_1", "1", "Clause 2", 2)
  const normalizedQuery = String(clauseIdQuery).toLowerCase().replace(/[^0-9]/g, '');
  
  let targetClause = session.clauses.find(c => {
    const normId = String(c.id).toLowerCase().replace(/[^0-9]/g, '');
    return normId === normalizedQuery || String(c.id).toLowerCase() === String(clauseIdQuery).toLowerCase();
  });

  if (!targetClause && session.clauses.length > 0) {
    // Fallback: try by index (1-based or 0-based)
    const idx = parseInt(normalizedQuery, 10);
    if (!isNaN(idx) && idx > 0 && idx <= session.clauses.length) {
      targetClause = session.clauses[idx - 1];
    }
  }

  if (!targetClause) {
    return { 
      found: false, 
      message: `Clause '${clauseIdQuery}' was not found in this document. Total clauses available: ${session.clauses.length}.`
    };
  }

  let analysis = session.flags ? session.flags[targetClause.id] : null;
  if (!analysis) {
    analysis = await processClause(targetClause.text);
    if (session.flags) session.flags[targetClause.id] = analysis;
  }

  const sourceList = [
    { type: 'clause', reference: `Clause ${targetClause.id}: ${analysis.category}` }
  ];
  if (analysis.cited_law && analysis.cited_law !== 'None' && analysis.cited_law !== 'Safe') {
    sourceList.push({ type: 'law', reference: analysis.cited_law });
  }

  return {
    found: true,
    clauseId: targetClause.id,
    clauseText: targetClause.text,
    category: analysis.category,
    risk_level: analysis.risk_level,
    in_simple_terms: analysis.in_simple_terms,
    legal_issue: analysis.legal_issue,
    cited_law: analysis.cited_law,
    recommended_action: analysis.recommended_action,
    sources: sourceList
  };
}

/**
 * Tool: getDocumentRisks(session)
 */
async function getDocumentRisks(session) {
  if (!session) return { error: "Session not found." };
  const risks = session.documentRisks || [];
  const sources = [];
  risks.forEach(r => {
    if (r.title.includes('11-Month') || r.description.includes('Registration Act')) {
      sources.push({ type: 'law', reference: 'Registration Act 1908, Sec 17' });
    }
  });

  return {
    documentRisks: risks,
    sources
  };
}

/**
 * Tool: getLawCitation(actQuery, sectionQuery)
 */
async function getLawCitation(actQuery, sectionQuery) {
  let act = (actQuery || '').trim();
  let section = (sectionQuery || '').trim();

  // Extract section number if embedded in actQuery (e.g. "Section 74")
  if (!section && act.match(/section\s*(\d+)/i)) {
    const m = act.match(/section\s*(\d+)/i);
    section = m[1];
  }

  const rawSectionDigits = section.replace(/[^0-9]/g, '');
  let retrievedLaws = [];

  // 1. Attempt exact/structured section number lookup first
  if (rawSectionDigits) {
    try {
      const res = await queryWithRetry(`
        SELECT act_name, section_number, content
        FROM law_chunks
        WHERE (section_number ILIKE $1 OR content ILIKE $2)
        ORDER BY id ASC
        LIMIT 3
      `, [`%${rawSectionDigits}%`, `%Section ${rawSectionDigits}:%`]);
      retrievedLaws = res.rows;
    } catch (err) {
      console.error("Direct section lookup error:", err.message);
    }
  }

  // 2. Fallback to vector similarity search if direct lookup yields no results
  if (retrievedLaws.length === 0) {
    const searchTerm = `${act} ${section}`.trim();
    if (!searchTerm) {
      return { error: "Act or section query required." };
    }
    const embeddingStr = await getRealEmbedding(searchTerm);
    try {
      const res = await queryWithRetry(`
        SELECT act_name, section_number, content, 
               1 - (embedding <=> $1) as similarity
        FROM law_chunks
        WHERE 1 - (embedding <=> $1) >= 0.25
        ORDER BY similarity DESC
        LIMIT 3
      `, [embeddingStr]);
      retrievedLaws = res.rows;
    } catch (err) {
      console.error("getLawCitation DB search error:", err.message);
    }
  }

  const sources = retrievedLaws.map(l => ({
    type: 'law',
    reference: `${l.act_name}, Section ${l.section_number}`
  }));

  return {
    query: `${act} ${section}`.trim(),
    foundCount: retrievedLaws.length,
    citations: retrievedLaws.map(l => ({
      act: l.act_name,
      section: l.section_number,
      content: l.content
    })),
    sources
  };
}


module.exports = {
  processClause,
  generateChatResponse,
  generateNegotiationMessage,
  compareDocuments,
  analyzeDocumentLevelRisks,
  generateLawyerQuestions,
  generateSummaryChecklist,
  generateVoiceBriefing,
  getClauseDetail,
  getDocumentRisks,
  getLawCitation
};

