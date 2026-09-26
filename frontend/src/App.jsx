import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  UploadCloud,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  FileText,
  MessageSquare,
  Send,
  X,
  ArrowLeftRight,
  AlertTriangle,
  Loader2,
  Copy,
  Printer,
  HelpCircle,
  Mic,
  Search,
  Menu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import LandingPage from "./LandingPage";
import VoicePanel from "./VoicePanel";
import DocumentViewer from "./DocumentViewer";
import { Document, Page, pdfjs } from "react-pdf";

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || "";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

function App() {
  const [view, setView] = useState("landing"); // 'landing' or 'app'
  const [appMode, setAppMode] = useState("analyze"); // 'analyze' or 'compare'
  const [language, setLanguage] = useState("English");
  const [isAppMobileMenuOpen, setIsAppMobileMenuOpen] = useState(false);

  // Analyze State
  const [file, setFile] = useState(null);
  const [textMode, setTextMode] = useState(false);
  const [rawText, setRawText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [session, setSession] = useState(null);
  const [flags, setFlags] = useState({});
  const [analyzingClause, setAnalyzingClause] = useState(null);
  const [negotiationDrafts, setNegotiationDrafts] = useState({});
  const [draftingClause, setDraftingClause] = useState(null);

  // Summary Export state
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  // Clear analysis cache when language changes so it re-translates on click
  useEffect(() => {
    setFlags({});
    setNegotiationDrafts({});
    setAnalyzingClause(null);
    setChatMessages([
      {
        role: "assistant",
        content:
          language === "Kannada"
            ? "ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಡಾಕ್ಯುಮೆಂಟ್ ಬಗ್ಗೆ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ."
            : language === "Hindi"
              ? "नमस्ते! अपने दस्तावेज़ के बारे में कोई भी प्रश्न पूछें।"
              : "Hi! Ask me any questions about your document or the laws we found.",
      },
    ]);
  }, [language]);

  const fetchSummaryChecklist = async () => {
    if (!session) return;
    setSummaryLoading(true);
    setSummaryOpen(true);
    try {
      const res = await axios.post("/api/export-summary", {
        sessionId: session.sessionId,
        clauses: session.clauses,
        flags,
        documentRisks: session.documentRisks,
      });
      setSummaryData(res.data);
    } catch (err) {
      alert("Failed to export summary checklist.");
    } finally {
      setSummaryLoading(false);
    }
  };

  // Compare State
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [compareResults, setCompareResults] = useState(null);

  // Chat & Voice state
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! Ask me any questions about your document or the laws we found.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatClauseId, setChatClauseId] = useState(null);
  const [documentBoxes, setDocumentBoxes] = useState({});

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file && !rawText) return;
    setProcessing(true);
    const formData = new FormData();
    if (file) formData.append("document", file);
    if (rawText) formData.append("text", rawText);

    const userId = localStorage.getItem("userId") || "anon_" + Date.now();
    localStorage.setItem("userId", userId);
    formData.append("userId", userId);

    try {
      const res = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSession(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || "Error parsing document";
      alert(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleCompare = async (e) => {
    e.preventDefault();
    if (!fileA || !fileB) return;
    setProcessing(true);

    const formData = new FormData();
    formData.append("fileA", fileA);
    formData.append("fileB", fileB);

    try {
      const res = await axios.post("/api/compare", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCompareResults(res.data.analysis);
    } catch (err) {
      alert(
        "Failed to compare documents. " + (err.response?.data?.error || ""),
      );
    } finally {
      setProcessing(false);
    }
  };

  const analyzeClause = async (clause) => {
    if (flags[clause.id] || analyzingClause === clause.id) return;
    setAnalyzingClause(clause.id);
    try {
      const res = await axios.post("/api/analyze-clause", {
        sessionId: session.sessionId,
        clauseId: clause.id,
        language,
      });
      setFlags((prev) => ({ ...prev, [clause.id]: res.data.analysis }));
    } catch (err) {
      setFlags((prev) => ({
        ...prev,
        [clause.id]: {
          category: "Error",
          risk_level: "Medium",
          in_simple_terms: "Network error occurred while reaching the AI.",
          legal_issue: "Could not complete analysis.",
          recommended_action: "Please try again later.",
          cited_law: null,
        },
      }));
    } finally {
      setAnalyzingClause(null);
    }
  };

  const generateNegotiation = async (clauseId, clauseText, analysis) => {
    setDraftingClause(clauseId);
    try {
      const res = await axios.post("/api/negotiate", {
        clauseText,
        analysis,
        language,
      });
      setNegotiationDrafts((prev) => ({
        ...prev,
        [clauseId]: res.data.message,
      }));
    } catch (err) {
      setNegotiationDrafts((prev) => ({
        ...prev,
        [clauseId]: "Failed to draft message.",
      }));
    } finally {
      setDraftingClause(null);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !session) return;
    const msg = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);

    try {
      const res = await axios.post("/api/chat", {
        sessionId: session.sessionId,
        question: msg,
        language,
        clauses: session.clauses,
      });
      const newSources = res.data.sources || [];
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.answer, sources: newSources },
      ]);

      // Auto-scroll DocumentViewer to first mentioned clause
      const clauseSource = newSources.find(
        (s) =>
          s.type === "clause" ||
          (s.reference && s.reference.startsWith("clause_")),
      );
      if (clauseSource && clauseSource.reference) {
        setChatClauseId(clauseSource.reference);
      } else {
        setChatClauseId(null);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#09090b] text-neutral-100 font-sans selection:bg-indigo-500/30 pb-10 relative overflow-hidden"
      role="application"
    >
      {view === "app" && (
        <header
          className="border-b border-neutral-800 bg-[#111113] sticky top-0 z-40 shadow-sm relative"
          role="banner"
          aria-label="Main Navigation"
        >
          <div className="w-full px-6 h-16 flex items-center justify-between">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => {
                setView("landing");
                setSession(null);
                setCompareResults(null);
              }}
              role="button"
              tabIndex="0"
              aria-label="Go to Home"
            >
              <ShieldAlert
                className="w-6 h-6 text-indigo-500"
                aria-hidden="true"
              />
              <h1 className="text-xl font-semibold tracking-tight">
                Nyaya<span className="text-indigo-500">Check</span>
              </h1>
            </div>
            
            <div className="hidden md:flex gap-2 bg-[#09090b] border border-neutral-800 rounded-lg p-1">
              <button
                onClick={() => {
                  setAppMode("analyze");
                  setSession(null);
                  setCompareResults(null);
                }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${appMode === "analyze" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"}`}
              >
                Single Document
              </button>
              <button
                onClick={() => {
                  setAppMode("compare");
                  setSession(null);
                  setCompareResults(null);
                }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${appMode === "compare" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"}`}
              >
                <ArrowLeftRight className="w-4 h-4" /> Compare Versions
              </button>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-[#09090b] border border-neutral-700 text-neutral-300 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors ml-2"
              >
                <option value="English">English</option>
                <option value="Hindi">हिन्दी (Hindi)</option>
                <option value="Kannada">ಕನ್ನಡ (Kannada)</option>
              </select>
            </div>

            <button 
              className="md:hidden text-neutral-400 hover:text-white"
              onClick={() => setIsAppMobileMenuOpen(!isAppMobileMenuOpen)}
            >
              {isAppMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile App Menu */}
          {isAppMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:hidden absolute top-16 left-0 w-full border-b border-neutral-800 bg-[#111113] p-4 flex flex-col gap-4 shadow-2xl z-50"
            >
              <button
                onClick={() => {
                  setAppMode("analyze");
                  setSession(null);
                  setCompareResults(null);
                  setIsAppMobileMenuOpen(false);
                }}
                className={`px-4 py-3 rounded-md text-sm font-medium transition-colors text-left ${appMode === "analyze" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"}`}
              >
                Single Document
              </button>
              <button
                onClick={() => {
                  setAppMode("compare");
                  setSession(null);
                  setCompareResults(null);
                  setIsAppMobileMenuOpen(false);
                }}
                className={`px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center gap-2 text-left ${appMode === "compare" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"}`}
              >
                <ArrowLeftRight className="w-4 h-4" /> Compare Versions
              </button>
              <div className="border-t border-neutral-800 pt-4 mt-2">
                <label className="block text-xs text-neutral-500 mb-2 px-1 uppercase tracking-wider">Select Language</label>
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    setIsAppMobileMenuOpen(false);
                  }}
                  className="w-full bg-[#09090b] border border-neutral-700 text-neutral-300 text-sm rounded-md px-3 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors"
                >
                  <option value="English">English</option>
                  <option value="Hindi">हिन्दी (Hindi)</option>
                  <option value="Kannada">ಕನ್ನಡ (Kannada)</option>
                </select>
              </div>
            </motion.div>
          )}
        </header>
      )}

      <main
        role="main"
        aria-label="Application Content"
        className={`${view === "app" ? "w-full px-6 py-6" : ""}`}
      >
        <AnimatePresence mode="wait">
          {view === "landing" ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
            >
              <LandingPage setView={setView} setAppMode={setAppMode} />
            </motion.div>
          ) : !session && !compareResults ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <div className="text-center mb-10">
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                  {appMode === "analyze"
                    ? "Spot it. Prove it. Fix it."
                    : "Compare Contract Versions"}
                </h2>
                <p className="text-lg text-neutral-400">
                  {appMode === "analyze"
                    ? "Upload your rental agreement. We'll benchmark it against real laws to find where you're disadvantaged."
                    : "Paste an old and new version of a contract. We'll instantly highlight any sneaky liability shifts."}
                </p>
              </div>

              {appMode === "analyze" ? (
                <div className="glass-panel rounded-2xl p-8 shadow-2xl max-w-2xl mx-auto">
                  <form onSubmit={handleUpload} className="flex flex-col gap-6">
                    {textMode ? (
                      <textarea
                        className="w-full h-64 bg-black/50 border border-white/10 rounded-xl p-4 text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                        placeholder="Paste your contract text here..."
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                      />
                    ) : (
                      <div className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center hover:bg-white/[0.02] transition-colors relative">
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={(e) => setFile(e.target.files[0])}
                        />
                        <UploadCloud className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                        <div className="text-lg font-medium mb-1">
                          {file ? file.name : "Drag & drop your file"}
                        </div>
                        <div className="text-sm text-neutral-500">
                          PDF, DOCX, TXT, or Image
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setTextMode(!textMode)}
                        className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {textMode
                          ? "Upload a file instead"
                          : "Paste text instead"}
                      </button>

                      <button
                        type="submit"
                        disabled={processing || (!file && !rawText)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {processing ? "Analyzing..." : "Analyze Document"}
                        {!processing && <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="bg-[#111113] border border-neutral-800 rounded-2xl p-8 shadow-2xl max-w-4xl mx-auto">
                  <form
                    onSubmit={handleCompare}
                    className="flex flex-col gap-8"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Original Version Dropzone */}
                      <div>
                        <label className="block text-sm font-semibold text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>{" "}
                          Original Draft
                        </label>
                        <div
                          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors relative ${fileA ? "border-red-500/50 bg-red-500/5" : "border-neutral-700 bg-black/40 hover:bg-neutral-900/50"}`}
                        >
                          <input
                            type="file"
                            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => setFileA(e.target.files[0])}
                          />
                          <UploadCloud
                            className={`w-10 h-10 mx-auto mb-3 ${fileA ? "text-red-400" : "text-neutral-500"}`}
                          />
                          <div className="text-sm font-medium text-white mb-1">
                            {fileA ? fileA.name : "Upload Original (V1)"}
                          </div>
                          <div className="text-xs text-neutral-500">
                            PDF, Image, or Word Document
                          </div>
                        </div>
                      </div>

                      {/* New Version Dropzone */}
                      <div>
                        <label className="block text-sm font-semibold text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>{" "}
                          Proposed Draft
                        </label>
                        <div
                          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors relative ${fileB ? "border-green-500/50 bg-green-500/5" : "border-neutral-700 bg-black/40 hover:bg-neutral-900/50"}`}
                        >
                          <input
                            type="file"
                            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => setFileB(e.target.files[0])}
                          />
                          <UploadCloud
                            className={`w-10 h-10 mx-auto mb-3 ${fileB ? "text-green-400" : "text-neutral-500"}`}
                          />
                          <div className="text-sm font-medium text-white mb-1">
                            {fileB ? fileB.name : "Upload Proposed (V2)"}
                          </div>
                          <div className="text-xs text-neutral-500">
                            PDF, Image, or Word Document
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center pt-4 border-t border-neutral-800">
                      <button
                        type="submit"
                        disabled={processing || !fileA || !fileB}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-3.5 rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_30px_rgba(79,70,229,0.2)] hover:shadow-[0_0_40px_rgba(79,70,229,0.4)]"
                      >
                        {processing
                          ? "Running X-Ray Analysis..."
                          : "Compare & Find Risks"}
                        {!processing && <ArrowLeftRight className="w-5 h-5" />}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          ) : session ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col lg:flex-row gap-6 relative z-10 h-[calc(100vh-120px)] print:h-auto print:block"
            >
              {/* Print-only Header */}
              <div className="hidden print:block print:mb-8 text-center border-b border-neutral-300 pb-6">
                <h1 className="text-3xl font-black text-black">NyayaCheck</h1>
                <p className="text-sm text-neutral-600 mt-1">
                  Document Risk Analysis Report
                </p>
              </div>

              {/* Left Column: Document View */}
              <div className="flex-1 flex flex-col min-w-0 bg-[#111113] border border-neutral-800 rounded-xl overflow-hidden shadow-sm print:hidden">
                <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-800 bg-[#18181b]">
                  <h3 className="font-medium text-white flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-neutral-400" /> Document
                    Viewer
                  </h3>
                  <button
                    onClick={() => setVoiceOpen(true)}
                    aria-label="Open Voice Assistant"
                    title="Open Voice Assistant"
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  >
                    <Mic className="w-3.5 h-3.5" /> Voice Assistant
                  </button>
                </div>

                <div className="flex-1 overflow-auto bg-[#09090b] p-4 relative">
                  <DocumentViewer
                    file={file}
                    clauses={session.clauses}
                    flags={flags}
                    activeClauseId={analyzingClause}
                    onClauseClick={analyzeClause}
                    chatClauseId={chatClauseId}
                    onBoxesReady={setDocumentBoxes}
                  />
                </div>
              </div>

              {/* Right Column: Analysis / Chat */}
              <div className="w-full lg:w-[480px] flex flex-col bg-[#111113] border border-neutral-800 rounded-xl overflow-hidden shadow-sm shrink-0 print:w-full print:border-none print:shadow-none print:bg-transparent">
                {/* Tabs */}
                <div className="flex p-1.5 border-b border-neutral-800 bg-[#18181b] gap-1 shrink-0 print:hidden">
                  <button
                    onClick={() => setChatOpen(false)}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${!chatOpen ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"}`}
                  >
                    <ShieldAlert className="w-4 h-4" /> Risk Analysis
                  </button>
                  <button
                    onClick={() => setChatOpen(true)}
                    className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${chatOpen ? "bg-indigo-600 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"}`}
                  >
                    <MessageSquare className="w-4 h-4" /> Copilot Chat
                  </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-[#09090b] relative flex flex-col print:overflow-visible print:bg-transparent">
                  {!chatOpen ? (
                    // Risk Analysis Content
                    <div className="p-5 flex-1 print:p-0">
                      <div className="flex justify-between items-center mb-6 print:hidden">
                        <h3 className="text-base font-semibold text-white">
                          Risk Flags
                        </h3>
                        <button
                          onClick={fetchSummaryChecklist}
                          className="bg-white hover:bg-neutral-200 text-black text-xs font-bold px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
                        >
                          <FileText className="w-3.5 h-3.5" /> Generate Report
                        </button>
                      </div>

                      {Object.keys(flags).length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-neutral-500 text-center">
                          <ShieldAlert className="w-10 h-10 mb-4 opacity-30" />
                          <p className="text-sm">
                            Click any clause on the left
                            <br />
                            to benchmark it against Indian law.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {session.documentRisks &&
                            session.documentRisks.length > 0 && (
                              <div className="mb-2 space-y-3">
                                {session.documentRisks.map((risk, idx) => (
                                  <div
                                    key={`doc-risk-${idx}`}
                                    className={`p-4 rounded-lg border ${risk.risk_level === "High" ? "bg-red-950/20 border-red-500/30" : "bg-yellow-950/20 border-yellow-500/30"}`}
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <h4 className="font-medium text-white flex items-center gap-2 text-sm">
                                        <AlertTriangle
                                          className={`w-4 h-4 ${risk.risk_level === "High" ? "text-red-400" : "text-yellow-400"}`}
                                        />
                                        Document Risk
                                      </h4>
                                      <span
                                        className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-bold border ${risk.risk_level === "High" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}
                                      >
                                        {risk.risk_level}
                                      </span>
                                    </div>
                                    <h5 className="text-xs font-medium text-white mb-2">
                                      {risk.title}
                                    </h5>
                                    <p className="text-xs text-neutral-400 leading-relaxed">
                                      {risk.description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                          {Object.entries(flags).map(([id, analysis]) => {
                            const isRisky =
                              analysis.risk_level === "High" ||
                              analysis.risk_level === "Medium";
                            const badgeColor =
                              analysis.risk_level === "High"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : analysis.risk_level === "Medium"
                                  ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                  : "bg-green-500/10 text-green-400 border-green-500/20";

                            return (
                              <div
                                key={id}
                                className={`p-4 rounded-lg border ${isRisky ? "bg-[#111113] border-neutral-800" : "bg-green-950/10 border-green-900/20"}`}
                              >
                                <div className="flex items-start justify-between mb-4">
                                  <h4 className="font-medium text-white flex items-center gap-2 text-sm">
                                    {isRisky ? (
                                      <ShieldAlert className="w-4 h-4 text-red-500" />
                                    ) : (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    )}
                                    {analysis.category}
                                  </h4>
                                  <span
                                    className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-wider font-bold border ${badgeColor}`}
                                  >
                                    {analysis.risk_level}
                                  </span>
                                </div>

                                <div className="mb-4 bg-indigo-500/5 border border-indigo-500/10 rounded-md p-3">
                                  <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Search className="w-3 h-3" /> Simple Terms
                                  </h5>
                                  <p className="text-xs text-neutral-300 leading-relaxed">
                                    {analysis.in_simple_terms}
                                  </p>
                                </div>

                                {isRisky && (
                                  <div className="space-y-3">
                                    <div className="bg-[#09090b] rounded-md p-3 border border-neutral-800">
                                      <h5 className="text-[10px] font-bold text-red-400/80 uppercase tracking-wider mb-1.5">
                                        The Problem
                                      </h5>
                                      <p className="text-xs text-neutral-400">
                                        {analysis.legal_issue}
                                      </p>
                                    </div>

                                    {analysis.cited_law &&
                                      analysis.cited_law !== "None" && (
                                        <div className="bg-[#09090b] rounded-md p-3 border border-neutral-800 flex items-start gap-2">
                                          <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                          <div>
                                            <h5 className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-wider mb-1">
                                              Source Law
                                            </h5>
                                            <p className="text-xs text-neutral-400">
                                              {analysis.cited_law}
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                    <div className="pt-3 border-t border-neutral-800">
                                      <h5 className="text-[10px] font-bold text-green-400/80 uppercase tracking-wider mb-2">
                                        Recommended Action
                                      </h5>
                                      <p className="text-xs text-neutral-400 mb-3">
                                        {analysis.recommended_action}
                                      </p>

                                      {!negotiationDrafts[id] ? (
                                        <button
                                          onClick={() =>
                                            generateNegotiation(
                                              id,
                                              session.clauses.find(
                                                (c) => c.id === id,
                                              ).text,
                                              analysis,
                                            )
                                          }
                                          disabled={draftingClause === id}
                                          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium py-2 rounded-md transition-colors border border-neutral-700"
                                        >
                                          {draftingClause === id
                                            ? "Drafting..."
                                            : "Draft Negotiation Email"}
                                        </button>
                                      ) : (
                                        <div className="bg-[#09090b] border border-neutral-800 rounded-md p-3 group">
                                          <div className="text-[10px] text-neutral-500 mb-2 font-medium flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                              <Send className="w-3 h-3" /> Draft
                                              Message
                                            </span>
                                            <button
                                              onClick={() =>
                                                navigator.clipboard.writeText(
                                                  negotiationDrafts[id],
                                                )
                                              }
                                              className="text-neutral-500 hover:text-white transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                                            >
                                              <Copy className="w-3 h-3" /> Copy
                                            </button>
                                          </div>
                                          <textarea
                                            className="w-full bg-transparent text-xs text-neutral-300 resize-none focus:outline-none"
                                            rows={5}
                                            value={negotiationDrafts[id]}
                                            onChange={(e) =>
                                              setNegotiationDrafts((prev) => ({
                                                ...prev,
                                                [id]: e.target.value,
                                              }))
                                            }
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Chat Content
                    <div className="flex flex-col h-full bg-[#09090b] print:hidden">
                      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                        {chatMessages.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-full text-neutral-500 text-center px-4">
                            <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
                            <p className="text-sm">
                              Ask me anything about your document or the laws we
                              found.
                            </p>
                          </div>
                        )}
                        {chatMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`max-w-[85%] rounded-xl p-3 text-sm ${
                              msg.role === "user"
                                ? "bg-indigo-600 text-white self-end rounded-br-sm"
                                : "bg-neutral-800 text-neutral-200 self-start rounded-bl-sm border border-neutral-700"
                            }`}
                          >
                            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-700">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                                <span className="text-[10px] uppercase text-neutral-500 font-semibold mb-1 w-full">
                                  Sources:
                                </span>
                                {msg.sources.map((src, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-400 flex items-center gap-1"
                                  >
                                    {src.type === "law" ? (
                                      <FileText className="w-3 h-3 text-indigo-400" />
                                    ) : (
                                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                                    )}
                                    {src.reference}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="bg-neutral-800 text-neutral-400 self-start rounded-xl rounded-bl-sm p-3 text-sm border border-neutral-700">
                            Thinking...
                          </div>
                        )}
                      </div>

                      <div className="p-3 border-t border-neutral-800 bg-[#111113] shrink-0">
                        <div className="relative">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && sendChatMessage()
                            }
                            placeholder="Ask about the document..."
                            className="w-full bg-[#09090b] border border-neutral-700 rounded-md pl-3 pr-10 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                          <button
                            onClick={sendChatMessage}
                            disabled={chatLoading || !chatInput.trim()}
                            className="absolute right-2 top-1.5 text-indigo-500 hover:text-indigo-400 disabled:opacity-50 disabled:hover:text-indigo-500"
                          >
                            <Send className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Checklist Export Modal */}
              <AnimatePresence>
                {summaryOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 no-print"
                  >
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-8 relative print-only-modal shadow-2xl">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6 mb-6 no-print">
                        <div className="flex items-start gap-3">
                          <ShieldAlert className="w-8 h-8 text-indigo-400 shrink-0 mt-1 md:mt-0" />
                          <div className="pr-8 md:pr-0">
                            <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">
                              Legal Summary & Advocate Consultation Prep
                            </h2>
                            <p className="text-xs text-neutral-400 mt-1">
                              Generated by NyayaCheck RAG Engine — Exportable
                              Statutory Audit
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                          <button
                            onClick={() => window.print()}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 md:py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg w-full md:w-auto"
                          >
                            <Printer className="w-4 h-4" /> Print / Save PDF
                          </button>
                          <button
                            onClick={() => setSummaryOpen(false)}
                            className="absolute top-4 right-4 md:static text-neutral-400 hover:text-white p-2 bg-neutral-800 md:bg-transparent rounded-full md:rounded-none z-10"
                          >
                            <X className="w-5 h-5 md:w-6 md:h-6" />
                          </button>
                        </div>
                      </div>

                      {summaryLoading || !summaryData ? (
                        <div className="py-24 flex flex-col items-center justify-center gap-4 text-neutral-400">
                          <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
                          <p className="text-sm font-medium">
                            Synthesizing full document summary and generating
                            consultation prep...
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {/* FR10 Persistent Disclaimer */}
                          <div className="bg-yellow-950/40 border border-yellow-500/40 p-4 rounded-xl text-yellow-200/90 text-xs leading-relaxed font-medium flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-yellow-300">
                                FR10 PERSISTENT DISCLAIMER:{" "}
                              </span>
                              {summaryData.disclaimer}
                            </div>
                          </div>

                          {/* Quick Metrics */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center print-card">
                              <div className="text-2xl font-bold text-white">
                                {
                                  summaryData.summary_stats
                                    .total_clauses_analyzed
                                }
                              </div>
                              <div className="text-xs text-neutral-400">
                                Total Clauses
                              </div>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center print-card">
                              <div className="text-2xl font-bold text-red-400">
                                {summaryData.summary_stats.high_risk_count}
                              </div>
                              <div className="text-xs text-red-300/80">
                                High Risk Flags
                              </div>
                            </div>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center print-card">
                              <div className="text-2xl font-bold text-yellow-400">
                                {summaryData.summary_stats.medium_risk_count}
                              </div>
                              <div className="text-xs text-yellow-300/80">
                                Medium Risk Flags
                              </div>
                            </div>
                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-center print-card">
                              <div className="text-2xl font-bold text-indigo-300">
                                {summaryData.questions_for_lawyer?.length || 0}
                              </div>
                              <div className="text-xs text-indigo-300/80">
                                Lawyer Questions
                              </div>
                            </div>
                          </div>

                          {/* Non-Obvious Legal Insights */}
                          {summaryData.non_obvious_insights &&
                            summaryData.non_obvious_insights.length > 0 && (
                              <div>
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                  <AlertTriangle className="w-5 h-5 text-indigo-400" />
                                  Non-Obvious & Document-Level Insights
                                </h3>
                                <div className="space-y-3">
                                  {summaryData.non_obvious_insights.map(
                                    (item, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-5 print-card"
                                      >
                                        <h4 className="font-semibold text-indigo-300 text-sm mb-1">
                                          {item.title}
                                        </h4>
                                        <p className="text-neutral-300 text-xs leading-relaxed">
                                          {item.insight}
                                        </p>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Questions to Ask Your Lawyer */}
                          {summaryData.questions_for_lawyer &&
                            summaryData.questions_for_lawyer.length > 0 && (
                              <div>
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                  <HelpCircle className="w-5 h-5 text-purple-400" />
                                  Questions to Ask a Lawyer (Consultation Prep)
                                </h3>
                                <div className="space-y-4">
                                  {summaryData.questions_for_lawyer.map(
                                    (q, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-5 print-card"
                                      >
                                        <div className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-1">
                                          {q.topic}
                                        </div>
                                        <p className="text-sm font-medium text-white mb-2">
                                          "{q.question}"
                                        </p>
                                        <p className="text-xs text-neutral-400 leading-relaxed">
                                          <span className="text-purple-400/80 font-medium">
                                            Why Ask:
                                          </span>{" "}
                                          {q.context}
                                        </p>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Full Summary of Flagged Clauses */}
                          <div>
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                              <FileText className="w-5 h-5 text-indigo-400" />
                              Flagged Clauses & Statutory Benchmarks
                            </h3>
                            <div className="space-y-4">
                              {summaryData.flagged_clauses.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white/[0.02] border border-white/10 rounded-xl p-5 print-card"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                      {item.category} ({item.clause_id})
                                    </span>
                                    <span
                                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                                        item.risk_level === "High"
                                          ? "bg-red-500/20 text-red-300 border-red-500/30"
                                          : item.risk_level === "Medium"
                                            ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                                            : "bg-green-500/20 text-green-300 border-green-500/30"
                                      }`}
                                    >
                                      {item.risk_level} Risk
                                    </span>
                                  </div>
                                  <p className="bg-black/40 border border-white/5 p-3 rounded-lg font-serif text-xs text-neutral-300 mb-3">
                                    {item.text}
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div>
                                      <span className="font-semibold text-neutral-400 block mb-1">
                                        Simple Explanation:
                                      </span>
                                      <p className="text-neutral-300">
                                        {item.in_simple_terms}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-neutral-400 block mb-1">
                                        Legal Issue & Citation:
                                      </span>
                                      <p className="text-neutral-300">
                                        {item.legal_issue}
                                      </p>
                                      {item.cited_law && (
                                        <p className="text-indigo-400 font-medium mt-1">
                                          Law: {item.cited_law}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="compareResults"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-6xl mx-auto flex flex-col gap-8 h-[calc(100vh-120px)]"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-6 shrink-0">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                    <ArrowLeftRight className="w-6 h-6 text-indigo-500" />
                    Version X-Ray
                  </h2>
                  <p className="text-sm text-neutral-400 mt-2">
                    Analyzing semantic liability shifts between Draft V1 and
                    Draft V2
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-[#111113] border border-neutral-800 px-4 py-2 rounded-lg text-sm">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span className="font-semibold text-white">
                      {compareResults.differences
                        ? compareResults.differences.filter(
                            (d) => d.risk_level === "High",
                          ).length
                        : 0}
                    </span>
                    <span className="text-neutral-500">Critical</span>
                  </div>
                  <button
                    onClick={() => setCompareResults(null)}
                    aria-label="Start New Comparison"
                    className="bg-white text-black hover:bg-neutral-200 px-4 py-2 rounded-lg font-bold transition-colors text-sm shadow-sm focus:ring-2 focus:ring-white focus:outline-none"
                  >
                    New Comparison
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 pb-10 space-y-8">
                {!compareResults.differences ||
                compareResults.differences.length === 0 ? (
                  <div className="bg-[#111113] border border-neutral-800 rounded-2xl p-20 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20">
                      <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Versions are Semantically Identical
                    </h3>
                    <p className="text-neutral-400 max-w-md">
                      No material shifts in liability or obligations were
                      detected between the two contract versions.
                    </p>
                  </div>
                ) : (
                  compareResults.differences.map((diff, idx) => {
                    const isHighRisk = diff.risk_level === "High";
                    const isMedRisk = diff.risk_level === "Medium";
                    const riskColor = isHighRisk
                      ? "text-red-400"
                      : isMedRisk
                        ? "text-yellow-400"
                        : "text-blue-400";
                    const riskBg = isHighRisk
                      ? "bg-red-500/10 border-red-500/20"
                      : isMedRisk
                        ? "bg-yellow-500/10 border-yellow-500/20"
                        : "bg-blue-500/10 border-blue-500/20";

                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={idx}
                        className="bg-[#09090b] border border-neutral-800 rounded-xl overflow-hidden shadow-sm flex flex-col"
                      >
                        {/* Header */}
                        <div className="bg-[#111113] border-b border-neutral-800 px-5 py-4 flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                            {diff.clause_topic}
                          </h4>
                          <span
                            className={`text-[10px] px-2.5 py-1 rounded uppercase tracking-wider font-bold border ${riskBg} ${riskColor} flex items-center gap-1.5`}
                          >
                            <AlertTriangle className="w-3 h-3" />{" "}
                            {diff.risk_level} Risk Shift
                          </span>
                        </div>

                        {/* Split Diff View */}
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-800">
                          {/* Old Version */}
                          <div className="bg-[rgba(255,0,0,0.02)] p-6 relative group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-red-500/20"></div>
                            <div className="flex items-center gap-2 mb-4">
                              <span className="w-2 h-2 rounded-full bg-red-500/50"></span>
                              <h5 className="text-xs font-bold text-red-400/80 uppercase tracking-wider">
                                Original Draft
                              </h5>
                            </div>
                            <p className="text-sm text-neutral-300 leading-relaxed line-through decoration-red-500/40">
                              {diff.old_term}
                            </p>
                          </div>

                          {/* New Version */}
                          <div className="bg-[rgba(0,255,0,0.02)] p-6 relative group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-green-500/20"></div>
                            <div className="flex items-center gap-2 mb-4">
                              <span className="w-2 h-2 rounded-full bg-green-500/50"></span>
                              <h5 className="text-xs font-bold text-green-400/80 uppercase tracking-wider">
                                Proposed Draft
                              </h5>
                            </div>
                            <p className="text-sm text-neutral-100 leading-relaxed font-medium">
                              {diff.new_term}
                            </p>
                          </div>
                        </div>

                        {/* Impact Footer */}
                        <div className="bg-[#111113] border-t border-neutral-800 p-5 flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <ShieldAlert className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
                              Material Impact Analysis
                            </h5>
                            <p className="text-sm text-neutral-300 leading-relaxed">
                              {diff.impact}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice AI Panel Modal */}
        <AnimatePresence>
          {voiceOpen && session && (
            <VoicePanel
              sessionId={session.sessionId}
              onClose={() => setVoiceOpen(false)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
