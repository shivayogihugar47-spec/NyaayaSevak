const fs = require('fs');

const appPath = 'src/App.jsx';
let code = fs.readFileSync(appPath, 'utf8');

// 1. Replace header
code = code.replace(
`  return (
    <div className="min-h-screen bg-[#030305] text-neutral-100 font-sans selection:bg-indigo-500/30 pb-20 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />

      {view === 'app' && (
        <header className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {setView('landing'); setSession(null); setCompareResults(null);}}>
              <ShieldAlert className="w-6 h-6 text-indigo-400" />
              <h1 className="text-xl font-semibold tracking-tight">Nyaya<span className="text-indigo-400">Check</span></h1>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {setAppMode('analyze'); setSession(null); setCompareResults(null);}}
                className={\`px-4 py-1.5 rounded-full text-sm font-medium transition-colors \${appMode === 'analyze' ? 'bg-indigo-500/20 text-indigo-300' : 'text-neutral-400 hover:text-white'}\`}
              >
                Single Document
              </button>
              <button 
                onClick={() => {setAppMode('compare'); setSession(null); setCompareResults(null);}}
                className={\`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 \${appMode === 'compare' ? 'bg-indigo-500/20 text-indigo-300' : 'text-neutral-400 hover:text-white'}\`}
              >
                <ArrowLeftRight className="w-4 h-4" /> Compare Versions
              </button>
              {/* 
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-black/50 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="English">English</option>
                <option value="Hindi">हिन्दी (Hindi)</option>
                <option value="Kannada">ಕನ್ನಡ (Kannada)</option>
              </select>
              */}
            </div>
          </div>
        </header>
      )}

      <main className={\`\${view === 'app' ? 'max-w-7xl mx-auto px-6 py-12' : ''}\`}>`,
`  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 font-sans selection:bg-indigo-500/30 pb-10 relative overflow-hidden">
      
      {view === 'app' && (
        <header className="border-b border-neutral-800 bg-[#111113] sticky top-0 z-40 shadow-sm">
          <div className="w-full px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {setView('landing'); setSession(null); setCompareResults(null);}}>
              <ShieldAlert className="w-6 h-6 text-indigo-500" />
              <h1 className="text-xl font-semibold tracking-tight">Nyaya<span className="text-indigo-500">Check</span></h1>
            </div>
            <div className="flex gap-2 bg-[#09090b] border border-neutral-800 rounded-lg p-1">
              <button 
                onClick={() => {setAppMode('analyze'); setSession(null); setCompareResults(null);}}
                className={\`px-4 py-1.5 rounded-md text-sm font-medium transition-colors \${appMode === 'analyze' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}\`}
              >
                Single Document
              </button>
              <button 
                onClick={() => {setAppMode('compare'); setSession(null); setCompareResults(null);}}
                className={\`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 \${appMode === 'compare' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}\`}
              >
                <ArrowLeftRight className="w-4 h-4" /> Compare Versions
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={\`\${view === 'app' ? 'w-full px-6 py-6' : ''}\`}>`
);

// 2. Replace the dashboard UI block
// I'll use regex to replace from "key="dashboard"" to just before " summaryOpen"
const dashboardRegex = /<motion\.div\s+key="dashboard"[\s\S]*?(?={\/\* Summary Checklist Export Modal \*\/)/;

const newDashboardUI = `<motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col lg:flex-row gap-6 relative z-10 h-[calc(100vh-120px)]"
            >
              {/* Left Column: Document View */}
              <div className="flex-1 flex flex-col min-w-0 bg-[#111113] border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-800 bg-[#18181b]">
                  <h3 className="font-medium text-white flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-neutral-400" /> Document Viewer
                  </h3>
                  <button 
                    onClick={() => setVoiceOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-sm"
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
              <div className="w-full lg:w-[480px] flex flex-col bg-[#111113] border border-neutral-800 rounded-xl overflow-hidden shadow-sm shrink-0">
                
                {/* Tabs */}
                <div className="flex p-1.5 border-b border-neutral-800 bg-[#18181b] gap-1 shrink-0">
                  <button 
                    onClick={() => setChatOpen(false)}
                    className={\`flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2 \${!chatOpen ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}\`}
                  >
                    <ShieldAlert className="w-4 h-4" /> Risk Analysis
                  </button>
                  <button 
                    onClick={() => setChatOpen(true)}
                    className={\`flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2 \${chatOpen ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}\`}
                  >
                    <MessageSquare className="w-4 h-4" /> Copilot Chat
                  </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-[#09090b] relative flex flex-col">
                  {!chatOpen ? (
                    // Risk Analysis Content
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-base font-semibold text-white">Risk Flags</h3>
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
                          <p className="text-sm">Click any clause on the left<br/>to benchmark it against Indian law.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          
                          {session.documentRisks && session.documentRisks.length > 0 && (
                            <div className="mb-2 space-y-3">
                              {session.documentRisks.map((risk, idx) => (
                                <div key={\`doc-risk-\${idx}\`} className={\`p-4 rounded-lg border \${risk.risk_level === 'High' ? 'bg-red-950/20 border-red-500/30' : 'bg-yellow-950/20 border-yellow-500/30'}\`}>
                                  <div className="flex items-start justify-between mb-3">
                                    <h4 className="font-medium text-white flex items-center gap-2 text-sm">
                                      <AlertTriangle className={\`w-4 h-4 \${risk.risk_level === 'High' ? 'text-red-400' : 'text-yellow-400'}\`} />
                                      Document Risk
                                    </h4>
                                    <span className={\`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-bold border \${risk.risk_level === 'High' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}\`}>
                                      {risk.risk_level}
                                    </span>
                                  </div>
                                  <h5 className="text-xs font-medium text-white mb-2">{risk.title}</h5>
                                  <p className="text-xs text-neutral-400 leading-relaxed">{risk.description}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {Object.entries(flags).map(([id, analysis]) => {
                            const isRisky = analysis.risk_level === 'High' || analysis.risk_level === 'Medium';
                            const badgeColor = analysis.risk_level === 'High' ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                                             : analysis.risk_level === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                             : 'bg-green-500/10 text-green-400 border-green-500/20';
                            
                            return (
                              <div key={id} className={\`p-4 rounded-lg border \${isRisky ? 'bg-[#111113] border-neutral-800' : 'bg-green-950/10 border-green-900/20'}\`}>
                                <div className="flex items-start justify-between mb-4">
                                  <h4 className="font-medium text-white flex items-center gap-2 text-sm">
                                    {isRisky ? <ShieldAlert className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                    {analysis.category}
                                  </h4>
                                  <span className={\`text-[9px] px-2 py-0.5 rounded uppercase tracking-wider font-bold border \${badgeColor}\`}>
                                    {analysis.risk_level}
                                  </span>
                                </div>
                                
                                <div className="mb-4 bg-indigo-500/5 border border-indigo-500/10 rounded-md p-3">
                                  <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Search className="w-3 h-3"/> Simple Terms</h5>
                                  <p className="text-xs text-neutral-300 leading-relaxed">{analysis.in_simple_terms}</p>
                                </div>
                                
                                {isRisky && (
                                  <div className="space-y-3">
                                    <div className="bg-[#09090b] rounded-md p-3 border border-neutral-800">
                                      <h5 className="text-[10px] font-bold text-red-400/80 uppercase tracking-wider mb-1.5">The Problem</h5>
                                      <p className="text-xs text-neutral-400">{analysis.legal_issue}</p>
                                    </div>
                                    
                                    {analysis.cited_law && analysis.cited_law !== 'None' && (
                                      <div className="bg-[#09090b] rounded-md p-3 border border-neutral-800 flex items-start gap-2">
                                        <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                        <div>
                                          <h5 className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-wider mb-1">Source Law</h5>
                                          <p className="text-xs text-neutral-400">{analysis.cited_law}</p>
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="pt-3 border-t border-neutral-800">
                                      <h5 className="text-[10px] font-bold text-green-400/80 uppercase tracking-wider mb-2">Recommended Action</h5>
                                      <p className="text-xs text-neutral-400 mb-3">{analysis.recommended_action}</p>
                                      
                                      {!negotiationDrafts[id] ? (
                                        <button 
                                          onClick={() => generateNegotiation(id, session.clauses.find(c=>c.id === id).text, analysis)}
                                          disabled={draftingClause === id}
                                          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium py-2 rounded-md transition-colors border border-neutral-700"
                                        >
                                          {draftingClause === id ? 'Drafting...' : 'Draft Negotiation Email'}
                                        </button>
                                      ) : (
                                        <div className="bg-[#09090b] border border-neutral-800 rounded-md p-3 group">
                                          <div className="text-[10px] text-neutral-500 mb-2 font-medium flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                              <Send className="w-3 h-3" /> Draft Message
                                            </span>
                                            <button 
                                              onClick={() => navigator.clipboard.writeText(negotiationDrafts[id])}
                                              className="text-neutral-500 hover:text-white transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                                            >
                                              <Copy className="w-3 h-3" /> Copy
                                            </button>
                                          </div>
                                          <textarea 
                                            className="w-full bg-transparent text-xs text-neutral-300 resize-none focus:outline-none"
                                            rows={5}
                                            value={negotiationDrafts[id]}
                                            onChange={(e) => setNegotiationDrafts(prev => ({ ...prev, [id]: e.target.value }))}
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
                    <div className="flex flex-col h-full bg-[#09090b]">
                      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                        {chatMessages.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-full text-neutral-500 text-center px-4">
                            <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
                            <p className="text-sm">Ask me anything about your document or the laws we found.</p>
                          </div>
                        )}
                        {chatMessages.map((msg, idx) => (
                          <div key={idx} className={\`max-w-[85%] rounded-xl p-3 text-sm \${
                            msg.role === 'user' 
                              ? 'bg-indigo-600 text-white self-end rounded-br-sm' 
                              : 'bg-neutral-800 text-neutral-200 self-start rounded-bl-sm border border-neutral-700'
                          }\`}>
                            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-700">
                              <ReactMarkdown>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                                <span className="text-[10px] uppercase text-neutral-500 font-semibold mb-1 w-full">Sources:</span>
                                {msg.sources.map((src, i) => (
                                  <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-neutral-400 flex items-center gap-1">
                                    {src.type === 'law' ? <FileText className="w-3 h-3 text-indigo-400" /> : <CheckCircle2 className="w-3 h-3 text-green-400" />}
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
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
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
            </motion.div>
`;

code = code.replace(dashboardRegex, newDashboardUI);
fs.writeFileSync(appPath, code);
console.log('App.jsx modified successfully!');
