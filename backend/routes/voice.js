const express = require('express');
const router = express.Router();
const ragService = require('../services/ragService');
const { sessionStore, voiceSourcesStore } = require('../services/sessionStore');

/**
 * Helper to ensure all clauses in a session have analysis
 */
async function getOrAnalyzeSessionClauses(session) {
  const clauseAnalyses = [];
  for (const clause of session.clauses) {
    let analysis = session.flags[clause.id];
    if (!analysis) {
      analysis = await ragService.processClause(clause.text);
      session.flags[clause.id] = analysis;
    }
    clauseAnalyses.push({
      id: clause.id,
      text: clause.text,
      analysis
    });
  }
  return clauseAnalyses;
}

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

    const clauseAnalyses = await getOrAnalyzeSessionClauses(session);
    const briefingResult = await ragService.generateVoiceBriefing(session.documentRisks || [], clauseAnalyses);
    
    // Store initial briefing sources
    if (!voiceSourcesStore[sessionId]) {
      voiceSourcesStore[sessionId] = [];
    }
    if (briefingResult.sources && briefingResult.sources.length > 0) {
      briefingResult.sources.forEach(src => {
        if (!voiceSourcesStore[sessionId].some(existing => existing.reference === src.reference)) {
          voiceSourcesStore[sessionId].push(src);
        }
      });
    }

    res.json({
      sessionId,
      briefing: briefingResult.briefing,
      sources: voiceSourcesStore[sessionId]
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


      results.push({
        toolCallId: toolCall.id,
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

    const clauseAnalyses = await getOrAnalyzeSessionClauses(session);
    const briefingData = await ragService.generateVoiceBriefing(session.documentRisks || [], clauseAnalyses);

    // Initialize voice sources for UI sync
    if (!voiceSourcesStore[sessionId]) voiceSourcesStore[sessionId] = [];
    if (briefingData.sources) {
      briefingData.sources.forEach(src => {
        if (!voiceSourcesStore[sessionId].some(e => e.reference === src.reference)) {
          voiceSourcesStore[sessionId].push(src);
        }
      });
    }

    const languageConfigMap = {
      en: { provider: "deepgram", model: "nova-2", language: "en" },
      hi: { provider: "deepgram", model: "nova-2", language: "hi" },
      kn: { provider: "talkscriber", model: "whisper" }
    };
    
    const transcriberConfig = languageConfigMap[language] || languageConfigMap.en;
    
    // Server Webhook URL configuration (uses process.env.PUBLIC_URL or default server endpoint)
    const serverUrl = process.env.VAPI_WEBHOOK_URL || process.env.PUBLIC_URL || "http://localhost:3001/api/voice/webhook";

    const assistantConfig = {
      name: "NyayaCheck Legal Assistant",
      firstMessage: briefingData.briefing,
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are NyayaCheck Voice Legal Assistant. You are currently speaking with a user who uploaded a legal document (Document ID: ${sessionId}).
            
CRITICAL RULES:
1. Always use function tools (getClauseDetail, getDocumentRisks, getLawCitation) whenever the user asks about specific clauses, risks, or statutory laws. DO NOT hallucinate legal provisions outside the tool responses.
2. Keep spoken responses concise, empathetic, and clear (1-3 conversational sentences).
3. If speaking in Hindi or Kannada, summarize the retrieved legal fact clearly in that language while preserving exact section numbers and act names.`
          }
        ],
        tools: [
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
      transcriber: transcriberConfig,

      voice: {
        provider: "azure",
        voiceId: "andrew"
      },
      metadata: {
        document_id: sessionId,
        language: language
      }
    };

    res.json({
      sessionId,
      briefing: briefingData.briefing,
      sources: voiceSourcesStore[sessionId],
      assistantConfig
    });
  } catch (error) {
    console.error("Error generating assistant config:", error);
    res.status(500).json({ error: "Failed to configure voice assistant" });
  }
});

module.exports = router;
