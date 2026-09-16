const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
const FormData = require('form-data');

/**
 * Runs OCR.space API for images and PDFs
 */
async function runOcrSpace(buffer, mimetype) {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    throw new Error("OCR Server error: OCR_SPACE_API_KEY is missing. Please add it to your environment.");
  }

  try {
    const formData = new FormData();
    // OCR.space needs a filename with the correct extension
    const filename = mimetype === 'application/pdf' ? 'document.pdf' : 'document.png';
    formData.append('file', buffer, { filename, contentType: mimetype });
    
    // Configure OCR.space options
    formData.append('isOverlayRequired', 'false');
    formData.append('scale', 'true'); // Upscale image for better reading
    formData.append('isTable', 'true'); // Good for structured documents like contracts

    const response = await axios.post('https://api.ocr.space/parse/image', formData, {
      headers: {
        'apikey': apiKey,
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const data = response.data;

    // Check if the API returned an error
    if (data.IsErroredOnProcessing) {
      console.error("OCR.space Processing Error:", data.ErrorMessage);
      throw new Error(`Could not read this document (OCR process failed: ${data.ErrorMessage[0] || 'Unknown error'})`);
    }

    if (!data.ParsedResults || data.ParsedResults.length === 0) {
      throw new Error("Could not extract any text from this document.");
    }

    // Combine text from all pages
    const fullText = data.ParsedResults.map(result => result.ParsedText).join('\n\n').trim();

    if (!fullText) {
      throw new Error("Could not extract any text from this document.");
    }

    return fullText;
  } catch (error) {
    if (error.response && error.response.data) {
      console.error("OCR.space API Error Response:", error.response.data);
      throw new Error(`OCR process failed: ${error.response.data.error || 'API Error'}`);
    }
    
    // If it's our own thrown error, pass it along
    if (error.message.includes("OCR") || error.message.includes("extract")) {
      throw error;
    }
    console.error("OCR.space execution failed:", error.message);
    throw new Error("Server error: Failed to run OCR process.");
  }
}

/**
 * Extracts raw text from a document buffer (PDF, DOCX, Image)
 */
async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    try {
      // First try to extract native text using pdf-parse
      const data = await pdfParse(buffer);
      if (data.text && data.text.trim().length > 100) {
        return data.text.trim();
      }
      
      console.log("PDF contains very little text (likely scanned). Running OCR.space...");
      return await runOcrSpace(buffer, mimetype);
    } catch (err) {
      console.log("PDF parsing failed. Falling back to OCR.space...", err.message);
      return await runOcrSpace(buffer, mimetype);
    }
  } else if (mimetype.startsWith('image/')) {
    console.log("Image uploaded. Running OCR.space OCR...");
    return await runOcrSpace(buffer, mimetype);
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
    mimetype === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else if (mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  }
  
  throw new Error("Unsupported file type.");
}

/**
 * Segments document text into discrete clauses.
 * For a real production app, this would use an LLM or complex regex.
 * Here we use a heuristic based on numbered lists or paragraphs.
 */
function segmentClauses(text) {
  // First normalize newlines to single spaces to handle OCR jumble
  let normalizedText = text.replace(/\r?\n/g, ' ');
  
  // Split by numbered lists: looks for " 1. ", " 2. ", or start of string "1. "
  // using a positive lookahead for a word boundary, digits, a dot, and a space.
  const rawSegments = normalizedText.split(/(?=\b\d+\.\s)/);
  
  // Clean up segments and filter out very short junk (like standalone headers)
  const cleanedSegments = rawSegments
    .map(p => p.trim())
    .filter(p => p.length > 20);
    
  const clauses = cleanedSegments.map((para, index) => ({
    id: `clause_${index + 1}`,
    text: para
  }));

  return clauses;
}

module.exports = {
  extractText,
  segmentClauses
};
