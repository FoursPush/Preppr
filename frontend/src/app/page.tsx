import Link from "next/link";
import { Mic, Zap, Shield, FileText, ArrowRight, Sparkles, BarChart3, Target, Award } from "lucide-react";

export default function Home() {
  return (
    <div className="relative overflow-hidden bg-hero-gradient">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse-subtle">
          <Sparkles className="w-3.5 h-3.5" /> Next-Gen AI Interview Prep Platform
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto">
          Ace Your Next Technical Interview Under <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-indigo-300 to-cyan-400">Real Pressure</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
          Preppr conducts realistic real-time voice and text mock interviews powered by custom RAG persona injection, vocal telemetry tracking, STAR structure evaluation, and PDF reports.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/interview/setup"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-base shadow-xl shadow-brand-500/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            Start Free Mock Interview <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/resume"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-base border border-white/10 transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-5 h-5 text-cyan-400" /> Upload Resume for RAG
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-500/40 transition-all backdrop-blur-sm group">
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 mb-4 group-hover:scale-110 transition-transform">
              <Mic className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Real-Time Voice AI</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Low-latency WebRTC speech conversation with adaptive follow-up logic that challenges weak answers and escalates difficulty.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/40 transition-all backdrop-blur-sm group">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Acoustic Telemetry</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Measures your Words Per Minute (WPM), filler word count (um, uh, like), silence durations, and pitch stability in real-time.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/40 transition-all backdrop-blur-sm group">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">LLM-as-a-Judge Rubric</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Comprehensive evaluation of Technical accuracy, STAR framework structure, Communication clarity, and downloadable PDF reports.
            </p>
          </div>
        </div>

        {/* Target Companies Strip */}
        <div className="mt-20 pt-10 border-t border-white/10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
            Practice for Target Companies & Roles
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-75">
            <span className="text-lg font-bold text-gray-300">Amazon (Leadership Principles)</span>
            <span className="text-lg font-bold text-gray-300">Google (System Design)</span>
            <span className="text-lg font-bold text-gray-300">Meta (Coding & Architecture)</span>
            <span className="text-lg font-bold text-gray-300">Tech Startups</span>
          </div>
        </div>
      </section>
    </div>
  );
}
