# NyayaCheck 2.0 - AI Legal & Compliance Assistant

**NyayaCheck** is a smart, dynamic AI-powered legal assistant designed to democratize legal accessibility. It instantly analyzes rental agreements, employment contracts, and other legal documents to find loopholes, highlight liability shifts, and generate negotiation strategies for non-lawyers. 

Built for the **Hack to Skill Virtual Prompt Wars**.

## 🚀 Chosen Vertical
**LegalTech / Smart Document & Compliance Assistant**
We chose this vertical because legal documents are typically filled with complex jargon designed to obscure liability shifts. NyayaCheck empowers everyday users (like tenants or gig workers) by providing an intelligent, context-aware assistant that translates legalese into plain English and highlights critical risks.

## 🧠 Approach and Logic
Our approach is centered around **Context-Aware Risk Analysis (RAG)** and **Semantic Version Comparison**:
1. **Intelligent Chunking:** When a user uploads a PDF or Image, the system runs advanced OCR (Optical Character Recognition), parses the text, and segments the document into logical legal clauses.
2. **Dynamic Risk Benchmarking:** Instead of generic AI summaries, each clause is fed into a specialized LLM prompt instructed to act as an Indian Legal Reviewer. It benchmarks the clause against standard consumer protection and property laws (e.g., Registration Act, 1908).
3. **Contextual Decision Making:** The AI categorizes risks as `High`, `Medium`, or `Low` based on how much liability is shifted to the user. High risks trigger red visual flags in the UI and generate actionable "Pushback" negotiation messages.
4. **Version X-Ray Diff:** For contract iterations, the system doesn't just do a standard string comparison. It runs a *semantic* comparison to identify material shifts in legal obligations between Draft V1 and Draft V2.

## ⚙️ How the Solution Works
- **Frontend (Vite + React + Tailwind):** Provides a high-fidelity, premium dark-mode dashboard. Features drag-and-drop file uploaders, split-pane document viewers, and a VS-Code style "Version X-Ray" diff viewer.
- **Backend (Node.js + Express):** Handles file uploads via `multer` and `form-data`. Routes PDFs and Images through OCR space APIs to extract raw text securely. 
- **AI Brain (OpenRouter):** Orchestrates the logic. Uses structured JSON prompting to ensure the LLM outputs strict risk matrices, cited laws, and negotiation scripts that the frontend can safely render.
- **Voice Assistant:** Users can click a "Voice Assistant" button to converse with the AI naturally regarding their document.

## 🔒 Security & Efficiency
- **Security:** API keys (`OPENROUTER_API_KEY`, `OCR_SPACE_API_KEY`) are kept strictly on the backend via `.env` files. The frontend only communicates with our secure Node.js proxy, ensuring zero credential leakage.
- **Efficiency:** The RAG system operates on demand. Clauses are analyzed in parallel only when clicked (or requested in bulk), preventing massive token wastage. File sizes are capped and handled entirely in memory buffers (`multer.memoryStorage()`) to prevent disk bloat.
- **Accessibility:** High contrast ratios (dark mode with bright red/green/indigo accents), semantic HTML, and intuitive UI layouts make the tool accessible.

## 📝 Assumptions Made
- We assume the user is a non-lawyer (e.g., a tenant, contractor) looking for first-pass legal defense. The system is designed to provide *guidance* and generate questions for an advocate, not to replace formal legal counsel.
- We assume English is the primary legal language of the document, though the Copilot Chat supports multilingual explanations (Hindi, Kannada).
- We assume OCR processing time is acceptable for images and scanned PDFs (typically 2-4 seconds).

## 🛠️ Local Setup Instructions
1. Clone the repository.
2. Ensure you are on the \`main\` branch.
3. Open two terminals.
4. **Backend:** 
   \`\`\`bash
   cd backend
   npm install
   npm run dev
   \`\`\`
   *(Ensure you have an \`.env\` file in the backend with \`PORT=3001\`, \`OPENROUTER_API_KEY\`, and \`OCR_SPACE_API_KEY\`)*
5. **Frontend:**
   \`\`\`bash
   cd frontend
   npm install
   npm run dev
   \`\`\`
6. Open \`http://localhost:5173\` in your browser!

---
*Built with clean, maintainable architecture, strictly adhering to the 10 MB repository limit and single-branch deployment requirement.*