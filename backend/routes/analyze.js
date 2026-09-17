const express = require('express');
const multer = require('multer');
const { extractText, segmentClauses } = require('../services/documentService');
const ragService = require('../services/ragService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const { sessionStore } = require('../services/sessionStore');


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
    
    // Run document-level risk check (e.g. 11-month lease)
    const documentRisks = await ragService.analyzeDocumentLevelRisks(rawText);

    // Generate a temporary session ID
    const sessionId = Date.now().toString();
    sessionStore[sessionId] = { clauses, flags: {}, documentRisks };

    res.json({ sessionId, clauses, documentRisks });
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

    const chatData = await ragService.generateChatResponse(question, session.clauses);
    res.json({ answer: chatData.answer, sources: chatData.sources || [] });
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

// POST /api/export-summary
router.post('/export-summary', async (req, res) => {
  try {
    const { sessionId } = req.body;
    let session = sessionStore[sessionId];
    
    if (!session && req.body.clauses && req.body.flags) {
      session = {
        clauses: req.body.clauses,
        flags: req.body.flags,
        documentRisks: req.body.documentRisks || []
      };
    }

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Ensure all clauses have analysis
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

    const summaryChecklist = await ragService.generateSummaryChecklist(session.documentRisks || [], clauseAnalyses);
    res.json(summaryChecklist);
  } catch (err) {
    console.error("Export summary error:", err);
    res.status(500).json({ error: "Summary export failed" });
  }
});

module.exports = router;
