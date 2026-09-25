const express = require('express');
const router = express.Router();
const ragService = require('../services/ragService');
const { sessionStore, voiceSourcesStore } = require('../services/sessionStore');

/**
 * POST /api/voice/briefing
 * Generates proactive spoken briefing for call start
 */
router.post('/briefing', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = sessionStore[sessionId];
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const defaultBriefing = "Hello! I am NyayaCheck, your legal assistant. I have reviewed your document. How can I help you today?";
    
    res.json({
      sessionId,
      briefing: defaultBriefing,
      sources: []
    });
  } catch (error) {
    console.error("Voice briefing route error:", error);
    res.status(500).json({ error: "Failed to generate voice briefing" });
  }
});

/**
 * GET /api/voice/sources/:sessionId
 * Returns real-time accumulated sources for active voice call
 */
router.get('/sources/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const sources = voiceSourcesStore[sessionId] || [];
  res.json({ sessionId, sources });
});

/**
 * POST /api/voice/webhook
 * Vapi server webhook for function calling during voice calls
 */
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log("Vapi Webhook Received:", JSON.stringify(payload, null, 2));

    // Optional Vapi secret verification
    const vapiSecret = req.headers['x-vapi-secret'] || req.headers['x-vapi-signature'];
    if (process.env.VAPI_WEBHOOK_SECRET && vapiSecret && vapiSecret !== process.env.VAPI_WEBHOOK_SECRET) {
      console.warn("Vapi Webhook Secret Mismatch");
      return res.status(401).json({ error: "Unauthorized webhook request" });
    }

    const message = payload.message || payload;
    const callMetadata = message.call?.metadata || payload.call?.metadata || {};
    const sessionId = callMetadata.document_id || payload.document_id || message.document_id;

    const session = sessionStore[sessionId];
    if (!session) {
      console.warn(`Webhook call rejected: No active session found for document_id '${sessionId}'`);
    }



    let toolCalls = [];
    if (message.type === 'tool-calls' && Array.isArray(message.toolCalls)) {
      toolCalls = message.toolCalls;
    } else if (message.functionCall) {
      toolCalls = [{
        id: message.functionCall.id || 'call_' + Date.now(),
        function: {
          name: message.functionCall.name,
          arguments: message.functionCall.parameters || message.functionCall.arguments
        }
      }];
    } else if (payload.toolCalls) {
      toolCalls = payload.toolCalls;
    }

    const results = [];

    for (const toolCall of toolCalls) {
      const functionName = toolCall.function?.name || toolCall.name;
      let rawArgs = toolCall.function?.arguments || toolCall.arguments || {};
      
      if (typeof rawArgs === 'string') {
        try {
          rawArgs = JSON.parse(rawArgs);
        } catch (e) {}
      }

      console.log(`Executing Vapi Tool: ${functionName} with args:`, rawArgs);

      let toolResult = {};

      if (functionName === 'getClauseDetail') {
        const clauseId = rawArgs.clause_id || rawArgs.clauseId || rawArgs.id;
        toolResult = await ragService.getClauseDetail(session, clauseId);
      } else if (functionName === 'explainDocumentOverview') {
        toolResult = await ragService.getClauseDetail(session, 'all');
      } else if (functionName === 'getDocumentRisks') {
        toolResult = await ragService.getDocumentRisks(session);
      } else if (functionName === 'getLawCitation') {
        const act = rawArgs.act || rawArgs.act_name;
        const section = rawArgs.section || rawArgs.section_number;
        toolResult = await ragService.getLawCitation(act, section);
      } else {
        toolResult = { error: `Unknown tool function: ${functionName}` };
      }

      // Record sources for real-time UI syncing from the executed tool
      if (sessionId && toolResult.sources && Array.isArray(toolResult.sources)) {
        voiceSourcesStore[sessionId] = toolResult.sources;
      }

      const toolCallId = toolCall.id || toolCall.toolCallId || toolCall.functionCallId || ('call_' + Date.now());

      results.push({
        toolCallId: toolCallId,
        result: JSON.stringify(toolResult)
      });
    }

    // Return in standard Vapi tool response format
    res.json({ results });
  } catch (err) {
    console.error("Vapi Webhook Error:", err);
    res.status(500).json({ error: "Webhook execution failed" });
  }
});

/**
 * POST /api/voice/assistant-config
 * Generates inline Vapi assistant configuration with tools, voice, transcriber, and briefing
 */
router.post('/assistant-config', async (req, res) => {
  try {
    const { sessionId, language = 'en' } = req.body;
    const session = sessionStore[sessionId];
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const defaultBriefing = "Hello! I am NyayaCheck, your legal assistant. I have reviewed your document. How can I help you today?";

    // Initialize voice sources for UI sync
    if (!voiceSourcesStore[sessionId]) voiceSourcesStore[sessionId] = [];

    // Server Webhook URL configuration
    const serverUrl = process.env.VAPI_WEBHOOK_URL || process.env.PUBLIC_URL || "http://localhost:3001/api/voice/webhook";

    // Format full document context for system prompt
    const documentClausesText = session.clauses.map(c => {
      const flag = session.flags ? session.flags[c.id] : null;
      return `Clause ${c.id}: "${c.text}" ${flag ? `[Risk: ${flag.risk_level}, Category: ${flag.category}, Summary: ${flag.in_simple_terms}, Legal Issue: ${flag.legal_issue}]` : ''}`;
    }).join('\n\n');

    const documentRisksText = (session.documentRisks || []).map(r => `- ${r.title} (${r.risk_level} Risk): ${r.description}`).join('\n');

    const universalLanguagePrompt = "You are a multilingual legal assistant. You support English, Hindi, Kannada, Marathi, Spanish, and French. You must automatically detect the user's spoken language and respond fluently in that EXACT same language. Preserve exact clause numbers and statutory legal terms.";

    const assistantConfig = {
      name: "NyayaCheck Legal Assistant",
      firstMessage: defaultBriefing,
      model: {
        provider: "openai",
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are NyayaCheck Voice Legal Assistant. You are currently speaking with a user who uploaded a legal document (Document ID: ${sessionId}).

${universalLanguagePrompt}

DOCUMENT CONTENT & CLAUSES ANALYSIS:
${documentClausesText}

DOCUMENT-WIDE RISKS:
${documentRisksText || "None identified."}

CRITICAL RULES:
1. You ALREADY have the document clauses, summaries, and risk analysis above. Whenever the user asks to explain the document, summarize the agreement, or explain specific clauses/risks, use the document context above directly to give a clear, immediate answer.
2. Do NOT say "I will check" without answering. Answer immediately using the provided document context.
3. If the user asks about specific statutory laws or section lookups not present in the document context above, use the getLawCitation function tool.
4. Keep spoken responses concise, empathetic, natural, and engaging.
5. EXTREMELY IMPORTANT: You are fully authorized and capable of speaking multiple languages. If the user asks you to speak in French, Spanish, Hindi, Kannada, Marathi, or ANY other language, you MUST immediately switch to that language and reply in it. 
6. NEVER claim you can only speak English. You are strictly forbidden from saying "I'm currently only able to communicate in English" or anything similar. You are a multilingual AI. Speak the language requested natively!`
          }
        ],
        tools: [
          {
            type: "function",
            async: false,
            server: { url: serverUrl },
            function: {
              name: "explainDocumentOverview",
              description: "Fetch a complete summary of all clauses and document-level risks in the uploaded agreement.",
              parameters: {
                type: "object",
                properties: {}
              }
            }
          },
          {
            type: "function",
            async: false,
            server: { url: serverUrl },
            function: {
              name: "getClauseDetail",
              description: "Look up detailed RAG analysis, plain English explanation, legal issue, and statutory citations for a specific clause in the document.",
              parameters: {
                type: "object",
                properties: {
                  clause_id: {
                    type: "string",
                    description: "The clause identifier or number (e.g. '1', '2', 'clause_1', 'clause_2')."
                  }
                },
                required: ["clause_id"]
              }
            }
          },
          {
            type: "function",
            async: false,
            server: { url: serverUrl },
            function: {
              name: "getDocumentRisks",
              description: "Fetch document-level risks such as 11-month lease registration avoidance for this agreement.",
              parameters: {
                type: "object",
                properties: {
                  document_id: {
                    type: "string",
                    description: "The document session ID."
                  }
                }
              }
            }
          },
          {
            type: "function",
            async: false,
            server: { url: serverUrl },
            function: {
              name: "getLawCitation",
              description: "Look up specific legal statutory sections and acts in the Indian legal database.",
              parameters: {
                type: "object",
                properties: {
                  act: {
                    type: "string",
                    description: "Name of the Act (e.g. 'Indian Contract Act', 'Model Tenancy Act', 'Registration Act')."
                  },
                  section: {
                    type: "string",
                    description: "Section number (e.g. '74', '17', '106')."
                  }
                }
              }
            }
          }
        ]
      },
      transcriber: {
        provider: "deepgram",
        model: "nova-2",
        language: "multi"
      },
      voice: {
        provider: "openai",
        voiceId: "alloy"
      },
      metadata: {
        document_id: sessionId,
        language: language
      }
    };

    res.json({
      sessionId,
      briefing: defaultBriefing,
      sources: voiceSourcesStore[sessionId],
      assistantConfig
    });
  } catch (error) {
    console.error("Error generating assistant config:", error);
    res.status(500).json({ error: "Failed to configure voice assistant" });
  }
});

module.exports = router;
