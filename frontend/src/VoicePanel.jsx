import React, { useState, useEffect, useRef } from 'react';
import VapiSDK from '@vapi-ai/web';
import axios from 'axios';
import { Mic, MicOff, PhoneOff, Volume2, Globe, ShieldAlert, FileText, CheckCircle2, Loader2, Sparkles, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || '';

// Safely resolve Vapi constructor across ESM/CJS bundlers
function getVapiConstructor(sdk) {
  if (typeof sdk === 'function') return sdk;
  if (typeof sdk?.default === 'function') return sdk.default;
  if (typeof sdk?.default?.default === 'function') return sdk.default.default;
  if (typeof sdk?.Vapi === 'function') return sdk.Vapi;
  return sdk;
}

// Replace with VAPI Public Key or retrieve from env
const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY;
const VAPI_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID;

function VoicePanel({ sessionId, onClose }) {
  const [callState, setCallState] = useState('idle'); // 'idle', 'connecting', 'active', 'ended'
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [briefing, setBriefing] = useState('');
  const [sources, setSources] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  const vapiRef = useRef(null);

  // Poll real-time sources during active call
  useEffect(() => {
    let interval = null;
    if (callState === 'active' || callState === 'connecting') {
      const fetchSources = async () => {
        try {
          const res = await axios.get(`/api/voice/sources/${sessionId}`, { withCredentials: true });
          if (res.data && res.data.sources) {
            setSources(res.data.sources);
          }
        } catch (e) {}
      };
      fetchSources();
      interval = setInterval(fetchSources, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState, sessionId]);

  // Load initial briefing on mount
  useEffect(() => {
    const loadBriefing = async () => {
      try {
        const res = await axios.post('/api/voice/briefing', { sessionId }, { withCredentials: true });
        setBriefing(res.data.briefing);
        if (res.data.sources) setSources(res.data.sources);
      } catch (e) {
        console.error("Failed to load voice briefing:", e);
      }
    };
    loadBriefing();
  }, [sessionId]);

  const startVoiceCall = async () => {
    try {
      setCallState('connecting');
      setErrorMsg(null);

      if (!VAPI_PUBLIC_KEY) {
        throw new Error("VITE_VAPI_PUBLIC_KEY environment variable is missing.");
      }
      if (!VAPI_ASSISTANT_ID) {
        throw new Error("VITE_VAPI_ASSISTANT_ID environment variable is missing.");
      }
      if (!sessionId) {
        throw new Error("Document context is missing. Cannot start call.");
      }

      // Initialize Vapi client safely
      const VapiClass = getVapiConstructor(VapiSDK);
      if (typeof VapiClass !== 'function') {
        throw new Error("Could not resolve Vapi constructor from @vapi-ai/web SDK.");
      }

      const vapi = new VapiClass(VAPI_PUBLIC_KEY);
      vapiRef.current = vapi;

      vapi.on('call-start', () => {
        setCallState('active');
        setTranscript(prev => [...prev, { role: 'assistant', text: briefing }]);
      });

      vapi.on('call-end', () => {
        setCallState('ended');
      });

      vapi.on('speech-start', () => {
        setIsSpeaking(true);
      });

      vapi.on('speech-end', () => {
        setIsSpeaking(false);
      });

      vapi.on('message', (message) => {
        console.log("Vapi Event Message:", message);
        if (message.type === 'transcript' && message.transcriptType === 'final') {
          setTranscript(prev => [...prev, { role: message.role, text: message.transcript }]);
        }
        
        // Listen for function call responses to update sources instantly
        if (message.type === 'function-call' || message.type === 'tool-calls') {
          axios.get(`/api/voice/sources/${sessionId}`, { withCredentials: true }).then(res => {
            if (res.data?.sources) setSources(res.data.sources);
          }).catch(() => {});
        }

        // Handle abrupt ended status errors (e.g. transcriber failures)
        if (message.type === 'status-update' && message.status === 'ended') {
          if (message.endedReason && message.endedReason.includes('error-vapifault')) {
            setErrorMsg(`Voice call disconnected: Transcriber error (${message.endedReason}).`);
          }
        }
      });

      vapi.on('error', (err) => {
        console.error("Vapi Error Event:", err);
        let detailStr = "Check mic permissions or Vapi configuration.";
        if (typeof err === 'string') {
          detailStr = err;
        } else if (err?.error?.message) {
          detailStr = err.error.message;
        } else if (typeof err?.error === 'string') {
          detailStr = err.error;
        } else if (err?.message) {
          detailStr = err.message;
        } else if (err?.type) {
          detailStr = `Event error (${err.type})`;
        }
        
        const rawString = JSON.stringify(err || {});
        if (rawString.includes('401') || rawString.includes('Unauthorized')) {
          setErrorMsg("Vapi Public Key Unauthorized (401). Please verify VITE_VAPI_PUBLIC_KEY in frontend/.env.");
        } else if (rawString.includes('400') || rawString.includes('Bad Request')) {
          setErrorMsg("Voice configuration error (400 Bad Request).");
        } else {
          setErrorMsg("Voice connection failed: " + detailStr);
        }
        setCallState('idle');
      });

      // Start call with configured Assistant ID and bind document_id and user_id as metadata
      const userId = localStorage.getItem('userId') || 'anon_' + Date.now();
      localStorage.setItem('userId', userId);
      
      await vapi.start(VAPI_ASSISTANT_ID, {
        assistantOverrides: {
          metadata: {
            document_id: sessionId,
            user_id: userId
          }
        }
      });

    } catch (err) {
      console.error("Start Call Error:", err);
      setErrorMsg("Failed to start voice call: " + (err.message || "Unknown error"));
      setCallState('idle');
    }
  };

  const endVoiceCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
    }
    setCallState('ended');
  };

  const toggleMute = () => {
    if (vapiRef.current) {
      vapiRef.current.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-lg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel bg-neutral-900/95 border border-white/20 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                NyayaCheck Voice Assistant
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-normal border border-indigo-500/30">
                  Document-Tied RAG
                </span>
              </h3>
              <p className="text-xs text-neutral-400">Proactive briefing & real-time statutory function calling</p>
            </div>
          </div>
          <button onClick={() => { endVoiceCall(); onClose(); }} className="text-neutral-400 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Language Selector Removed - Vapi handles language detection automatically */}

          {/* Call Status Orb & Proactive Opening Briefing */}
          <div className="bg-gradient-to-b from-indigo-950/30 to-black/40 border border-indigo-500/20 rounded-2xl p-6 text-center flex flex-col items-center justify-center relative overflow-hidden">
            {/* Animated Pulsing Waveform Ring */}
            <div className="relative mb-6">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                callState === 'active' 
                  ? isSpeaking 
                    ? 'border-indigo-400 bg-indigo-500/30 shadow-[0_0_40px_rgba(99,102,241,0.6)] scale-105' 
                    : 'border-green-500/50 bg-green-500/10'
                  : callState === 'connecting'
                    ? 'border-yellow-500/50 bg-yellow-500/10 animate-pulse'
                    : 'border-white/10 bg-white/5'
              }`}>
                {callState === 'connecting' ? (
                  <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
                ) : callState === 'active' ? (
                  <Volume2 className={`w-10 h-10 ${isSpeaking ? 'text-indigo-300 animate-bounce' : 'text-green-400'}`} />
                ) : (
                  <Mic className="w-10 h-10 text-neutral-500" />
                )}
              </div>
            </div>

            {/* Status Text */}
            <div className="text-sm font-semibold mb-3 tracking-wide uppercase">
              {callState === 'idle' && <span className="text-neutral-400">Ready to Start Voice Session</span>}
              {callState === 'connecting' && <span className="text-yellow-400">Initializing NyayaCheck Voice...</span>}
              {callState === 'active' && (
                <span className="text-green-400 flex items-center gap-2 justify-center">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                  Voice Call Active (Auto-Detect)
                </span>
              )}
              {callState === 'ended' && <span className="text-neutral-500">Call Ended</span>}
            </div>

            {/* Proactive Opening Briefing Box */}
            {briefing && (
              <div className="bg-black/50 border border-white/10 rounded-xl p-4 text-left max-w-lg w-full">
                <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Proactive Opening Briefing
                </div>
                <p className="text-xs text-neutral-200 leading-relaxed font-sans">{briefing}</p>
              </div>
            )}
          </div>

          {/* Real-time Sources Syncing Stream */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Real-Time Grounded Sources
              </h4>
              <span className="text-[10px] text-neutral-500">{sources.length} Active Citations</span>
            </div>

            {sources.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center text-xs text-neutral-500">
                Sources will appear here in real time as statutory function calls execute during speech.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {sources.map((src, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-xs px-3 py-1.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-neutral-200 flex items-center gap-2 shadow-sm"
                    >
                      {src.type === 'law' ? (
                        <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      )}
                      <span className="font-medium text-white">{src.reference}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Real-time Spoken Transcript */}
          {transcript.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Spoken Conversation Transcript</h4>
              <div className="space-y-2.5 max-h-40 overflow-y-auto bg-black/40 border border-white/5 rounded-xl p-4 text-xs">
                {transcript.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'text-indigo-300' : 'text-neutral-300'}`}>
                    <span className="font-bold uppercase text-[10px] opacity-60 w-16 shrink-0">{msg.role}:</span>
                    <span>{msg.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Call Controls */}
        <div className="p-6 border-t border-white/10 bg-black/40 flex items-center justify-center gap-4">
          {callState === 'idle' || callState === 'ended' ? (
            <button
              onClick={startVoiceCall}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-2xl transition-all shadow-xl flex items-center gap-3 text-sm"
            >
              <Mic className="w-5 h-5" /> Start Proactive Voice Call
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`p-4 rounded-2xl border transition-all ${
                  isMuted 
                    ? 'bg-red-500/20 border-red-500/40 text-red-400' 
                    : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                }`}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button
                onClick={endVoiceCall}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold px-8 py-3.5 rounded-2xl transition-all shadow-xl flex items-center gap-3 text-sm"
              >
                <PhoneOff className="w-5 h-5" /> End Call
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default VoicePanel;
