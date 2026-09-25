const express = require('express');
const router = express.Router();
const ragService = require('../services/ragService');
const { sessionStore, voiceSourcesStore, getSession } = require('../services/sessionStore');

/**
 * POST /api/voice/briefing
 * Generates proactive spoken briefing for call start
 */
router.post('/briefing', async (req, res) => {
  try {
    const { sessionId } = req.body;
    let session = sessionStore[sessionId];
    if (!session) session = await getSession(sessionId);
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
    
    // Distinguish assistant server messages from tool/function calls
    if (payload.message && payload.message.type && payload.message.type !== 'tool-calls' && payload.message.type !== 'function-call') {
      // It's a server message (e.g. call started, ended, etc)
      return res.status(200).send();
    }

    const message = payload.message || payload;
    const callMetadata = message.call?.metadata || payload.call?.metadata || {};
    const sessionId = callMetadata.document_id || payload.document_id || message.document_id;
    const userId = callMetadata.user_id || payload.user_id;

    if (!sessionId || !userId) {
      console.warn("Webhook rejected: Missing document_id or user_id");
      return res.status(401).json({ error: "Unauthorized: Missing context" });
    }

    let session = sessionStore[sessionId];
    if (!session) session = await getSession(sessionId);
    
    // User isolation check
    if (!session || session.userId !== userId) {
      console.warn(`Webhook call rejected: Unauthorized access to document_id '${sessionId}'`);
      // We must return a structured error result instead of 401, so Vapi can speak the error
      return res.json({
        results: [{
          toolCallId: (message.toolCalls && message.toolCalls[0]?.id) || 'error',
          result: JSON.stringify({ error: "Document cannot be found or unauthorized access." })
        }]
      });
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

      if (functionName === 'get_document_risks') {
        toolResult = await ragService.getDocumentRisks(session, rawArgs.agreement_type || 'unknown', rawArgs.max_risks || 5);
      } else if (functionName === 'get_clause_with_citations') {
        toolResult = await ragService.getClauseWithCitations(session, rawArgs.question, rawArgs.jurisdiction, rawArgs.clause_reference);
      } else if (functionName === 'end_legal_guidance_call') {
        // Handled natively by Vapi, but if routed here, just acknowledge
        toolResult = { status: "ended" };
      } else {
        toolResult = { error: `Unknown tool function: ${functionName}` };
      }

      // Record sources for real-time UI syncing
      if (toolResult.sources && Array.isArray(toolResult.sources)) {
        voiceSourcesStore[sessionId] = toolResult.sources;
      }

      results.push({
        toolCallId: toolCall.id || ('call_' + Date.now()),
        result: JSON.stringify(toolResult)
      });
    }

    res.json({ results });
  } catch (err) {
    console.error("Vapi Webhook Error:", err);
    res.status(500).json({ error: "Webhook execution failed" });
  }
});

module.exports = router;
