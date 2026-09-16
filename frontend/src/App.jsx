import { useState } from 'react';
import axios from 'axios';
import { UploadCloud, ShieldAlert, CheckCircle2, ChevronRight, FileText, MessageSquare, Send, X, ArrowLeftRight, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import LandingPage from './LandingPage';

function App() {
  const [view, setView] = useState('landing'); // 'landing' or 'app'
  const [appMode, setAppMode] = useState('analyze'); // 'analyze' or 'compare'
  
  // Analyze State
  const [file, setFile] = useState(null);
  const [textMode, setTextMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [session, setSession] = useState(null);
  const [flags, setFlags] = useState({});
  const [analyzingClause, setAnalyzingClause] = useState(null);
  const [negotiationDrafts, setNegotiationDrafts] = useState({});
  const [draftingClause, setDraftingClause] = useState(null);

  // Compare State
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [compareResults, setCompareResults] = useState(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hi! Ask me any questions about your document or the laws we found.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file && !rawText) return;
    setProcessing(true);
    const formData = new FormData();
    if (file) formData.append('document', file);
    if (rawText) formData.append('text', rawText);

    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
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
    if (!textA || !textB) return;
    setProcessing(true);
    try {
      const res = await axios.post('/api/compare', { textA, textB });
      setCompareResults(res.data.analysis);
    } catch (err) {
      alert("Error comparing documents");
    } finally {
      setProcessing(false);
    }
  };

  const analyzeClause = async (clause) => {
    if (flags[clause.id] || analyzingClause === clause.id) return;
    setAnalyzingClause(clause.id);
    try {
      const res = await axios.post('/api/analyze-clause', {
        sessionId: session.sessionId,
        clauseId: clause.id
      });
      setFlags(prev => ({ ...prev, [clause.id]: res.data.analysis }));
    } catch (err) {
      setFlags(prev => ({ 
        ...prev, 
        [clause.id]: { 
          category: "Error",
          risk_level: "Medium",
          in_simple_terms: "Network error occurred while reaching the AI.",
          legal_issue: "Could not complete analysis.",
          recommended_action: "Please try again later.",
          cited_law: null 
        }
      }));
    } finally {
      setAnalyzingClause(null);
    }
  };

  const generateNegotiation = async (clauseId, clauseText, analysis) => {
    setDraftingClause(clauseId);
    try {
      const res = await axios.post('/api/negotiate', { clauseText, analysis });
      setNegotiationDrafts(prev => ({ ...prev, [clauseId]: res.data.message }));
    } catch (err) {
      setNegotiationDrafts(prev => ({ ...prev, [clauseId]: "Failed to draft message." }));
    } finally {
      setDraftingClause(null);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !session) return;
    const msg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);

    try {
      const res = await axios.post('/api/chat', {
        sessionId: session.sessionId,
        question: msg
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30 pb-20">
      {view === 'app' && (
        <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {setView('landing'); setSession(null); setCompareResults(null);}}>
              <ShieldAlert className="w-6 h-6 text-indigo-400" />
              <h1 className="text-xl font-semibold tracking-tight">Nyaya<span className="text-indigo-400">Check</span></h1>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {setAppMode('analyze'); setSession(null); setCompareResults(null);}}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${appMode === 'analyze' ? 'bg-indigo-500/20 text-indigo-300' : 'text-neutral-400 hover:text-white'}`}
              >
                Single Document
              </button>
              <button 
                onClick={() => {setAppMode('compare'); setSession(null); setCompareResults(null);}}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${appMode === 'compare' ? 'bg-indigo-500/20 text-indigo-300' : 'text-neutral-400 hover:text-white'}`}
              >
                <ArrowLeftRight className="w-4 h-4" /> Compare Versions
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={`${view === 'app' ? 'max-w-7xl mx-auto px-6 py-12' : ''}`}>
        <AnimatePresence mode="wait">
          {view === 'landing' ? (
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
                  {appMode === 'analyze' ? 'Spot it. Prove it. Fix it.' : 'Compare Contract Versions'}
                </h2>
                <p className="text-lg text-neutral-400">
                  {appMode === 'analyze' 
                    ? "Upload your rental agreement. We'll benchmark it against real laws to find where you're disadvantaged."
                    : "Paste an old and new version of a contract. We'll instantly highlight any sneaky liability shifts."
                  }
                </p>
              </div>

              {appMode === 'analyze' ? (
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
                        <div className="text-sm text-neutral-500">PDF, DOCX, TXT, or Image</div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <button 
                        type="button" 
                        onClick={() => setTextMode(!textMode)}
                        className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {textMode ? "Upload a file instead" : "Paste text instead"}
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
                <div className="glass-panel rounded-2xl p-8 shadow-2xl">
                  <form onSubmit={handleCompare} className="flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Original Version</label>
                        <textarea 
                          className="w-full h-64 bg-black/50 border border-white/10 rounded-xl p-4 text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                          placeholder="Paste old version here..."
                          value={textA}
                          onChange={(e) => setTextA(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">New/Proposed Version</label>
                        <textarea 
                          className="w-full h-64 bg-black/50 border border-white/10 rounded-xl p-4 text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                          placeholder="Paste new version here..."
                          value={textB}
                          onChange={(e) => setTextB(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        type="submit"
                        disabled={processing || !textA || !textB}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {processing ? "Comparing Versions..." : "Compare & Find Risks"}
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
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative"
            >
              {/* Single Doc UI (Unchanged) */}
              <div className="glass-panel rounded-2xl p-6 h-[80vh] overflow-y-auto flex flex-col gap-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    Document Clauses
                  </h3>
                  <button 
                    onClick={() => setChatOpen(!chatOpen)}
                    className="flex items-center gap-2 text-sm bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-500/30 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" /> Ask AI
                  </button>
                </div>

                {session.clauses.map(clause => (
                  <div 
                    key={clause.id} 
                    className={`p-4 rounded-xl border transition-colors cursor-pointer
                      ${flags[clause.id]?.risk_level === 'High' 
                        ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/50' 
                        : flags[clause.id]?.risk_level === 'Medium'
                          ? 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50'
                          : flags[clause.id]
                            ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
                            : 'bg-white/[0.02] border-white/5 hover:border-indigo-500/30'
                      }
                    `}
                    onClick={() => analyzeClause(clause)}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className="text-xs text-neutral-500 font-semibold tracking-wider uppercase">
                        {flags[clause.id]?.category || clause.id.replace('_', ' ')}
                      </div>
                      {analyzingClause === clause.id && <span className="text-xs text-indigo-400 animate-pulse font-medium">Analyzing...</span>}
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5 font-serif text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                      {clause.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="glass-panel rounded-2xl p-6 h-[80vh] overflow-y-auto">
                <h3 className="text-lg font-medium mb-6">Risk Analysis & Leverage</h3>
                
                {Object.keys(flags).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-center">
                    <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
                    <p>Click any clause on the left<br/>to benchmark it against Indian law.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {Object.entries(flags).map(([id, analysis]) => {
                      const isRisky = analysis.risk_level === 'High' || analysis.risk_level === 'Medium';
                      const badgeColor = analysis.risk_level === 'High' ? 'bg-red-500/20 text-red-300 border-red-500/30' 
                                       : analysis.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                                       : 'bg-green-500/20 text-green-300 border-green-500/30';
                      
                      return (
                        <div key={id} className={`p-6 rounded-2xl border ${isRisky ? 'bg-neutral-900/50 border-neutral-700/50' : 'bg-green-950/20 border-green-900/30'}`}>
                          <div className="flex items-start justify-between mb-4">
                            <h4 className="font-semibold text-lg text-white flex items-center gap-2">
                              {isRisky ? <ShieldAlert className="w-5 h-5 text-red-400" /> : <CheckCircle2 className="w-5 h-5 text-green-400" />}
                              {analysis.category}
                            </h4>
                            <span className={`text-xs px-3 py-1 rounded-full font-medium border ${badgeColor}`}>
                              {analysis.risk_level} Risk
                            </span>
                          </div>
                          
                          <div className="mb-5 bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4">
                            <h5 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2">In Simple Terms</h5>
                            <p className="text-sm text-neutral-200 leading-relaxed">{analysis.in_simple_terms}</p>
                          </div>
                          
                          {isRisky && (
                            <div className="mb-5 space-y-4">
                              <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                                <h5 className="text-xs font-semibold text-red-400/80 uppercase tracking-wider mb-2">The Problem</h5>
                                <p className="text-sm text-neutral-300">{analysis.legal_issue}</p>
                              </div>
                              
                              {analysis.cited_law && analysis.cited_law !== 'None' && (
                                <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex items-start gap-3">
                                  <FileText className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                                  <div>
                                    <h5 className="text-xs font-semibold text-indigo-400/80 uppercase tracking-wider mb-1">Source Law</h5>
                                    <p className="text-sm text-neutral-400">{analysis.cited_law}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {isRisky && (
                            <div className="mt-6 pt-5 border-t border-white/10">
                              <h5 className="text-xs font-semibold text-green-400/80 uppercase tracking-wider mb-3">Recommended Action</h5>
                              <p className="text-sm text-neutral-300 mb-4">{analysis.recommended_action}</p>
                              
                              {!negotiationDrafts[id] ? (
                                <button 
                                  onClick={() => generateNegotiation(id, session.clauses.find(c=>c.id === id).text, analysis)}
                                  disabled={draftingClause === id}
                                  className="w-full bg-white/5 hover:bg-white/10 text-white text-sm font-medium py-3 rounded-xl transition-all border border-white/10 shadow-sm"
                                >
                                  {draftingClause === id ? 'Drafting Message...' : 'Draft Negotiation Email'}
                                </button>
                              ) : (
                                <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 relative">
                                  <div className="text-xs text-neutral-400 mb-3 font-medium flex items-center gap-2">
                                    <Send className="w-3.5 h-3.5" /> Suggested Message to Landlord
                                  </div>
                                  <p className="text-sm text-neutral-200 whitespace-pre-wrap">{negotiationDrafts[id]}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Floating Chat Panel */}
              <AnimatePresence>
                {chatOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="absolute bottom-4 left-4 w-96 h-[500px] glass-panel bg-neutral-900/90 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-white/20"
                  >
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                      <h3 className="font-medium flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-indigo-400" />
                        AI Legal Assistant
                      </h3>
                      <button onClick={() => setChatOpen(false)} className="text-neutral-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={`max-w-[85%] rounded-xl p-4 text-sm ${
                          msg.role === 'user' 
                            ? 'bg-indigo-600 text-white self-end rounded-tr-none' 
                            : 'bg-white/10 text-neutral-200 self-start rounded-tl-none border border-white/5'
                        }`}>
                          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10">
                            <ReactMarkdown>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="bg-white/10 text-neutral-400 self-start rounded-xl rounded-tl-none p-3 text-sm border border-white/5">
                          Thinking...
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 border-t border-white/10 bg-black/40">
                      <div className="relative">
                        <input 
                          type="text" 
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                          placeholder="Ask about the document..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button 
                          onClick={sendChatMessage}
                          disabled={chatLoading}
                          className="absolute right-2 top-1.5 text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div 
              key="compareResults"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold flex items-center gap-3">
                  <ArrowLeftRight className="w-8 h-8 text-indigo-400" />
                  Contract Diff Analysis
                </h2>
                <button 
                  onClick={() => setCompareResults(null)}
                  className="bg-white/5 hover:bg-white/10 text-neutral-200 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                >
                  New Comparison
                </button>
              </div>

              <div className="flex flex-col gap-6">
                {!compareResults.differences || compareResults.differences.length === 0 ? (
                  <div className="glass-panel rounded-2xl p-12 text-center text-neutral-400">
                    <CheckCircle2 className="w-16 h-16 text-green-500/50 mx-auto mb-4" />
                    <p className="text-lg">No material shifts in liability detected between the two versions.</p>
                  </div>
                ) : (
                  compareResults.differences.map((diff, idx) => (
                    <div key={idx} className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                      <div className={`absolute top-0 left-0 w-1 h-full ${diff.risk_level === 'High' ? 'bg-red-500' : diff.risk_level === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                      
                      <div className="flex justify-between items-start mb-4 pl-3">
                        <h4 className="text-xl font-medium text-white">{diff.clause_topic}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${
                          diff.risk_level === 'High' ? 'bg-red-500/20 text-red-300' : 
                          diff.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-300' : 
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          <AlertTriangle className="w-3 h-3" /> {diff.risk_level} Risk
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pl-3 mb-4">
                        <div className="bg-red-950/20 border border-red-500/10 p-4 rounded-xl">
                          <div className="text-xs text-red-400/70 font-semibold uppercase tracking-wider mb-2">Old Version</div>
                          <div className="text-sm text-neutral-300 line-through decoration-red-500/30">{diff.old_term}</div>
                        </div>
                        <div className="bg-green-950/20 border border-green-500/10 p-4 rounded-xl">
                          <div className="text-xs text-green-400/70 font-semibold uppercase tracking-wider mb-2">New Version</div>
                          <div className="text-sm text-neutral-300">{diff.new_term}</div>
                        </div>
                      </div>

                      <div className="pl-3">
                        <div className="bg-black/40 border border-white/5 p-4 rounded-xl text-sm text-neutral-300">
                          <span className="font-semibold text-indigo-400 mr-2">Impact:</span>
                          {diff.impact}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
