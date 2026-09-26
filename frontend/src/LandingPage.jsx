import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  ChevronRight,
  FileText,
  ArrowLeftRight,
  UploadCloud,
  ShieldCheck,
  Scale,
  User,
  MessageSquare,
  Menu,
  X,
} from "lucide-react";

export default function LandingPage({ setView, setAppMode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Global Navbar */}
      <header className="border-b border-white/5 bg-neutral-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer">
            <ShieldAlert className="w-6 h-6 text-indigo-500" />
            <h1 className="text-xl font-bold tracking-tight">
              Nyaya<span className="text-indigo-500">Check</span>
            </h1>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-white transition-colors"
            >
              How it Works
            </a>
            <a href="#security" className="hover:text-white transition-colors">
              Security
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <button className="text-sm font-medium text-neutral-400 hover:text-white transition-colors hidden md:block">
              Sign In
            </button>
            <button
              onClick={() => {
                setView("app");
                setAppMode("analyze");
              }}
              className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-neutral-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] hidden md:block"
            >
              Start Free Trial
            </button>
            <button 
              className="md:hidden text-neutral-400 hover:text-white"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t border-white/5 bg-neutral-950 px-6 py-4 flex flex-col gap-4 absolute w-full left-0 shadow-2xl"
          >
            <a href="#features" className="text-neutral-400 hover:text-white transition-colors py-2 text-lg font-medium" onClick={() => setIsMobileMenuOpen(false)}>
              Features
            </a>
            <a href="#how-it-works" className="text-neutral-400 hover:text-white transition-colors py-2 text-lg font-medium" onClick={() => setIsMobileMenuOpen(false)}>
              How it Works
            </a>
            <a href="#security" className="text-neutral-400 hover:text-white transition-colors py-2 text-lg font-medium" onClick={() => setIsMobileMenuOpen(false)}>
              Security
            </a>
            <a href="#pricing" className="text-neutral-400 hover:text-white transition-colors py-2 text-lg font-medium" onClick={() => setIsMobileMenuOpen(false)}>
              Pricing
            </a>
            <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-white/5">
              <button className="text-lg font-medium text-neutral-400 hover:text-white transition-colors py-2 text-left w-full">
                Sign In
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setView("app");
                  setAppMode("analyze");
                }}
                className="bg-white text-black px-4 py-3 rounded-full text-lg font-bold hover:bg-neutral-200 transition-colors w-full text-center mt-2"
              >
                Start Free Trial
              </button>
            </div>
          </motion.div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 bg-gradient-to-br from-white via-white to-neutral-500 bg-clip-text text-transparent max-w-5xl leading-[1.1]"
          >
            Contract intelligence, <br className="hidden md:block" /> solved.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-neutral-400 max-w-2xl mb-12 leading-relaxed"
          >
            Upload any legal agreement. Our statutory grounding engine
            benchmarks it against Indian law to instantly flag risks, missing
            clauses, and predatory terms.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 mb-20"
          >
            <button
              onClick={() => {
                setView("app");
                setAppMode("analyze");
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-full font-semibold transition-all flex items-center justify-center gap-2 text-lg shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_40px_rgba(79,70,229,0.5)]"
            >
              Analyze a Document
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setView("app");
                setAppMode("compare");
              }}
              className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-full font-semibold transition-all flex items-center justify-center gap-2 text-lg border border-white/10"
            >
              <ArrowLeftRight className="w-5 h-5" />
              Compare Versions
            </button>
          </motion.div>

          {/* High-Fidelity Product Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="w-full max-w-6xl relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] bg-neutral-900"
          >
            {/* Mockup Top Bar */}
            <div className="h-10 bg-neutral-900 border-b border-white/10 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <img
              src="/nyayacheck-hero.png"
              alt="NyayaCheck Dashboard"
              className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity"
            />
          </motion.div>
        </div>
      </section>

      {/* Bento Box Grid */}
      <section id="features" className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Built for precision.
            </h2>
            <p className="text-xl text-neutral-400 max-w-2xl">
              A powerful suite of tools designed to extract, analyze, and
              protect your legal interests with zero friction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Large Box 1 */}
            <div className="md:col-span-2 bg-gradient-to-br from-neutral-900 to-black border border-white/10 rounded-3xl p-10 overflow-hidden relative group">
              <div className="relative z-10">
                <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/30">
                  <Scale className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-bold mb-3">
                  Statutory Grounding Engine
                </h3>
                <p className="text-neutral-400 max-w-md">
                  We don't rely on generic AI guesses. Every clause is strictly
                  benchmarked against actual, localized statutory laws (e.g. The
                  Indian Contract Act, 1872).
                </p>
              </div>
              {/* Decorative Code Snippet Background */}
              <div className="absolute right-[-50px] bottom-[-50px] opacity-20 group-hover:opacity-40 transition-opacity font-mono text-sm text-indigo-300 leading-relaxed pointer-events-none">
                {`import { RAG } from '@nyayacheck/core'
const laws = await DB.fetch('contract_act_1872')
const analysis = await RAG.analyze(
  clause, 
  { constraints: laws }
)
return analysis.risk_level // HIGH`}
              </div>
            </div>

            {/* Small Box 1 */}
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-10 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center mb-6 border border-green-500/30">
                  <UploadCloud className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Instant OCR</h3>
                <p className="text-neutral-400">
                  Scanned PDFs? Potato-quality phone pictures? Drop them in. We
                  extract the text perfectly.
                </p>
              </div>
            </div>

            {/* Small Box 2 */}
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-10 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/30">
                  <MessageSquare className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Pushback Copilot</h3>
                <p className="text-neutral-400">
                  Instantly generate professional negotiation emails citing the
                  exact laws the landlord violated.
                </p>
              </div>
            </div>

            {/* Large Box 2 */}
            <div className="md:col-span-2 bg-gradient-to-br from-neutral-900 to-black border border-white/10 rounded-3xl p-10 relative overflow-hidden">
              <div className="relative z-10 w-1/2">
                <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-6 border border-orange-500/30">
                  <ArrowLeftRight className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Version Compare</h3>
                <p className="text-neutral-400">
                  Upload Draft V1 and Draft V2. We'll highlight exactly what
                  they sneaked into the new version while you weren't looking.
                </p>
              </div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 w-1/2">
                <div className="bg-black border border-white/10 rounded-xl p-4 shadow-2xl rotate-[-5deg]">
                  <div className="text-red-400 line-through text-sm mb-2">
                    - Landlord covers major repairs.
                  </div>
                  <div className="text-green-400 text-sm">
                    + Tenant is responsible for all structural repairs.
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-orange-400 bg-orange-500/10 p-2 rounded border border-orange-500/20">
                    <ShieldAlert className="w-3 h-3" /> Critical Liability Shift
                    Detected
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Alternating Deep Dives */}
      <section
        id="how-it-works"
        className="py-24 bg-black border-t border-white/5"
      >
        <div className="max-w-7xl mx-auto px-6">
          {/* Deep Dive 1 */}
          <div className="flex flex-col md:flex-row items-center gap-16 mb-32">
            <div className="w-full md:w-1/2">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                Eliminate blind spots instantly.
              </h2>
              <p className="text-lg text-neutral-400 mb-8 leading-relaxed">
                Legal jargon is designed to confuse you. Our AI reads through
                the noise and extracts the true meaning of every clause,
                color-coding it by risk level so you know exactly what requires
                your attention.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-neutral-300">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Plain English translation for complex clauses.</span>
                </li>
                <li className="flex items-start gap-3 text-neutral-300">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Traffic-light risk system (Red/Yellow/Green).</span>
                </li>
              </ul>
            </div>
            <div className="w-full md:w-1/2 bg-neutral-900 border border-white/10 rounded-2xl p-8 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-2xl"></div>
              <div className="relative z-10 flex items-start justify-between mb-4">
                <h4 className="font-semibold text-lg text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  Security Deposit Deductions
                </h4>
                <span className="text-xs px-3 py-1 rounded-full font-medium border bg-red-500/20 text-red-300 border-red-500/30">
                  High Risk
                </span>
              </div>
              <div className="relative z-10 mb-5 bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4">
                <h5 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2">
                  In Simple Terms
                </h5>
                <p className="text-sm text-neutral-200 leading-relaxed">
                  The landlord can keep your deposit for completely normal wear
                  and tear.
                </p>
              </div>
            </div>
          </div>

          {/* Deep Dive 2 */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-16">
            <div className="w-full md:w-1/2">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                Negotiate with absolute leverage.
              </h2>
              <p className="text-lg text-neutral-400 mb-8 leading-relaxed">
                Don't just find problems—fix them. With one click, NyayaCheck
                generates polite, professional, and legally sound negotiation
                emails that cite the exact laws the landlord is violating.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-neutral-300">
                  <FileText className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Auto-generated pushback drafts.</span>
                </li>
                <li className="flex items-start gap-3 text-neutral-300">
                  <FileText className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Direct citations to local statutory acts.</span>
                </li>
              </ul>
            </div>
            <div className="w-full md:w-1/2 bg-neutral-900 border border-white/10 rounded-2xl p-8 shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-4">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
                    <User className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">New Message</div>
                    <div className="text-xs text-neutral-500">To: Landlord</div>
                  </div>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Hi [Landlord],
                  <br />
                  <br />
                  I noticed Clause 4 regarding the security deposit. Under the
                  Model Tenancy Act, deductions cannot be made for standard wear
                  and tear. Could we update this clause to reflect the standard
                  statutory protections before signing?
                  <br />
                  <br />
                  Thanks!
                </p>
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                  <div className="bg-indigo-600 text-white text-xs px-4 py-2 rounded-lg font-medium">
                    Send Draft
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden border-t border-white/5">
        <div className="absolute inset-0 bg-indigo-600/5"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Ready to protect yourself?
          </h2>
          <p className="text-xl text-neutral-400 mb-10">
            Join thousands of tenants using NyayaCheck to level the playing
            field.
          </p>
          <button
            onClick={() => {
              setView("app");
              setAppMode("analyze");
            }}
            className="bg-white text-black hover:bg-neutral-200 px-8 py-4 rounded-full font-bold transition-all text-lg shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)]"
          >
            Start Analyzing for Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-neutral-950 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <ShieldAlert className="w-5 h-5 text-indigo-500" />
                <span className="font-bold tracking-tight text-white">
                  NyayaCheck
                </span>
              </div>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Empowering individuals with AI-driven contract intelligence.
                Never sign an unfair agreement again.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contract Analysis
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Version Compare
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    API Access
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Legal Database
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Community
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-neutral-600">
              © 2026 NyayaCheck. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
// Note: Requires adding User icon from lucide-react in the import, but I missed it. I'll fix that.
