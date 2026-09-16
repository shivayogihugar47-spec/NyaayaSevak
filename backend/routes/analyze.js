const express = require('express');
const multer = require('multer');
const { extractText, segmentClauses } = require('../services/documentService');
const ragService = require('../services/ragService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Stores session analysis in memory for the demo
// In production, this would be in the database
const sessionStore = {};

/**
 * POST /api/upload
 * Accepts a file, parses it, segments into clauses, and returns the raw clauses.
 */
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file && !req.body.text) {
      return res.status(400).json({ error: 'No document provided' });
    }

    let rawText = '';
    
    if (req.file) {
      rawText = await extractText(req.file.buffer, req.file.mimetype);
    } else {
      rawText = req.body.text; // Text paste fallback
    }

    const clauses = segmentClauses(rawText);
    
    // Generate a temporary session ID
    const sessionId = Date.now().toString();
    sessionStore[sessionId] = { clauses, flags: {} };

    res.json({ sessionId, clauses });
  } catch (error) {
    console.error("Upload Error:", error);
    // Forward specific OCR errors to the client
    if (error.message.includes("OCR") || error.message.includes("Could not extract") || error.message.includes("Could not read") || error.message.includes("billing") || error.message.includes("PERMISSION_DENIED")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to process document' });
  }
});

/**
 * POST /api/analyze-clause
 * Analyzes a specific clause from the document.
 */
router.post('/analyze-clause', async (req, res) => {
  const { sessionId, clauseId } = req.body;

  if (!sessionId || !sessionStore[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const clause = sessionStore[sessionId].clauses.find(c => c.id === clauseId);
  if (!clause) {
    return res.status(404).json({ error: 'Clause not found' });
  }

  try {
    // Process clause with RAG
    const analysis = await ragService.processClause(clause.text);
    
    // Save to session
    sessionStore[sessionId].flags[clauseId] = analysis;

    res.json({ clauseId, analysis });
  } catch (error) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: 'Failed to analyze clause' });
  }
});

// POST /api/chat
router.post('/chat', async (req, res) => {
  try {
    const { sessionId, question } = req.body;
    const session = sessionStore[sessionId];
    if (!session) return res.status(404).json({ error: "Session not found" });

    const answer = await ragService.generateChatResponse(question, session.clauses);
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chat failed" });
  }
});

// POST /api/negotiate
router.post('/negotiate', async (req, res) => {
  try {
    const { clauseText, analysis } = req.body;
    const message = await ragService.generateNegotiationMessage(clauseText, analysis);
    res.json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Negotiation generation failed" });
  }
});


// POST /api/compare
router.post('/compare', async (req, res) => {
  try {
    const { textA, textB } = req.body;
    if (!textA || !textB) return res.status(400).json({ error: "Missing document texts" });

    const analysis = await ragService.compareDocuments(textA, textB);
    res.json({ analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Compare generation failed" });
  }
});

module.exports = router;
