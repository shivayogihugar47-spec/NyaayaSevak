const express = require('express');
const multer = require('multer');
const { extractText, segmentClauses } = require('../services/documentService');
const ragService = require('../services/ragService');

const router = express.Router();

// Efficiency & Security: Limit file upload size to 5MB to prevent memory exhaustion
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } 
});

const { sessionStore, getSession, saveSession } = require('../services/sessionStore');


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
    const userId = req.body.userId || 'anon_' + sessionId;
    const sessionObj = { clauses, flags: {}, documentRisks, userId };
    sessionStore[sessionId] = sessionObj;
    await saveSession(sessionId, sessionObj);

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
  const { sessionId, clauseId, language = 'English' } = req.body;

  let session = sessionStore[sessionId];
  if (!session) session = await getSession(sessionId);
  if (!sessionId || !session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const clause = session.clauses.find(c => c.id === clauseId);
  if (!clause) {
    return res.status(404).json({ error: 'Clause not found' });
  }

  try {
    // Process clause with RAG
    const analysis = await ragService.processClause(clause.text, language);
    
    // Save to session
    session.flags[clauseId] = analysis;
    sessionStore[sessionId] = session;
    await saveSession(sessionId, session);

    res.json({ clauseId, analysis });
  } catch (error) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: 'Failed to analyze clause' });
  }
});

// POST /api/chat
router.post('/chat', async (req, res) => {
  try {
    const { sessionId, question, language = 'English', clauses } = req.body;
    let session = sessionStore[sessionId];
    if (!session) session = await getSession(sessionId);
    
    // Fallback for stateless serverless environments (Vercel)
    if (!session && clauses) {
      session = { clauses };
    }

    if (!session || !session.clauses) return res.status(404).json({ error: "Session or clauses not found" });

    const chatData = await ragService.generateChatResponse(question, session.clauses, language);
    res.json({ answer: chatData.answer, sources: chatData.sources || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chat failed" });
  }
});

// POST /api/negotiate
router.post('/negotiate', async (req, res) => {
  try {
    const { clauseText, analysis, language = 'English' } = req.body;
    const message = await ragService.generateNegotiationMessage(clauseText, analysis, language);
    res.json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Negotiation generation failed" });
  }
});


// POST /api/compare
router.post('/compare', upload.fields([{ name: 'fileA', maxCount: 1 }, { name: 'fileB', maxCount: 1 }]), async (req, res) => {
  try {
    let textA = '';
    let textB = '';

    if (req.files && req.files.fileA) {
      textA = await extractText(req.files.fileA[0].buffer, req.files.fileA[0].mimetype);
    } else if (req.body.textA) {
      textA = req.body.textA;
    }

    if (req.files && req.files.fileB) {
      textB = await extractText(req.files.fileB[0].buffer, req.files.fileB[0].mimetype);
    } else if (req.body.textB) {
      textB = req.body.textB;
    }

    if (!textA || !textB) return res.status(400).json({ error: "Missing documents to compare" });

    const analysis = await ragService.compareDocuments(textA, textB);
    res.json({ analysis });
  } catch (err) {
    console.error("Compare error:", err);
    res.status(500).json({ error: "Compare generation failed: " + err.message });
  }
});

// POST /api/export-summary
router.post('/export-summary', async (req, res) => {
  try {
    const { sessionId } = req.body;
    let session = sessionStore[sessionId];
    if (!session) session = await getSession(sessionId);
    
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
        await saveSession(sessionId, session);
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
