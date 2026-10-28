"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  Mic,
  BarChart3,
  FileText,
  ArrowRight,
  Sparkles,
  Zap,
  Code2,
  Eye,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Terminal,
  Play,
  ArrowUpRight,
  Award,
  Layers,
} from "lucide-react";

const HERO_ROTATING_TERMS = [
  { text: "Interview.", color: "#FF6F39" },     // Solid NVG8 Orange
  { text: "Dream Offer.", color: "#7A78FF" },   // Solid NVG8 Purple
  { text: "System Design.", color: "#00A653" }, // Solid NVG8 Green
  { text: "Coding Round.", color: "#BADDFD" },  // Solid NVG8 Light Blue
  { text: "Tech Career.", color: "#FFC412" },   // Solid NVG8 Yellow
];

export default function Home() {
  const { user, isLoggedIn, isLoading } = useAuth();

  // Changing hero text state (solid colors, NO gradients)
  const [termIndex, setTermIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTermIndex((prev) => (prev + 1) % HERO_ROTATING_TERMS.length);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  // Scroll animation state for editorial emoji sentences
  const editorialRef = useRef<HTMLDivElement | null>(null);
  const [isInSentenceForm, setIsInSentenceForm] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      if (!editorialRef.current) return;
      const rect = editorialRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Smoothly trigger when scrolled into view
      if (rect.top <= windowHeight * 0.78 && rect.bottom >= windowHeight * 0.15) {
        setIsInSentenceForm(true);
      } else if (rect.top > windowHeight * 0.92) {
        setIsInSentenceForm(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-nvg-offblack text-nvg-offwhite font-body selection:bg-nvg-lime selection:text-black">
      {/* ===================== HERO SECTION ===================== */}
      <section className="relative pt-36 sm:pt-44 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-nvg-purple/15 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-6xl mx-auto text-center relative z-10 space-y-8">
          {/* Top category chip - solid neon lime background with black text */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-nvg-lime !text-black font-heading font-extrabold text-xs tracking-wider uppercase shadow-neo-lime">
            <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
            Next-Gen AI Interview Prep Platform
          </div>

          {/* Main Neue Montreal Bold Headline with Changing Hero Text (NO GRADIENTS) */}
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-heading font-extrabold text-white tracking-tight leading-[1.05] max-w-5xl mx-auto min-h-[140px] sm:min-h-[180px]">
            Time to own your{" "}
            <span
              key={termIndex}
              className="inline-block animate-slide-up-word"
              style={{ color: HERO_ROTATING_TERMS[termIndex].color }}
            >
              {HERO_ROTATING_TERMS[termIndex].text}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed font-normal font-body">
            Real-time voice mock interviews with Whisper STT, on-device vision telemetry,
            LeetCode DSA whiteboard, and instant STAR rubric feedback.
          </p>

          {/* Action Pills */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            {isLoading ? (
              <div className="w-56 h-12 rounded-full bg-white/10 animate-pulse" />
            ) : isLoggedIn && user ? (
              <>
                <Link
                  href="/interview/setup"
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-nvg-lime !text-black font-heading font-extrabold text-sm shadow-neo-lime hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                >
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>Start Live Mock Interview</span>
                  <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto px-7 py-4 rounded-full bg-white/5 hover:bg-white/10 text-white font-heading font-bold text-sm border border-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <BarChart3 className="w-4 h-4 text-nvg-yellow" />
                  <span>Candidate Dashboard</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-nvg-lime !text-black font-heading font-extrabold text-sm shadow-neo-lime hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/interview/setup"
                  className="w-full sm:w-auto px-7 py-4 rounded-full bg-white/5 hover:bg-white/10 text-white font-heading font-bold text-sm border border-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Mic className="w-4 h-4 text-nvg-orange" />
                  <span>Try Demo Mock</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Feature Squircle Ticker Row (NO BLACK BOXES - Clean Black Icons on Vibrant Cards) */}
        <div className="max-w-6xl mx-auto mt-20 pt-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* 1. Yellow Squircle */}
            <div className="p-6 rounded-squircle bg-nvg-yellow text-black flex flex-col justify-between aspect-square group hover:-translate-y-1 transition-transform shadow-neo-sm">
              <Code2 className="w-10 h-10 text-black stroke-[2.5]" />
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-black/70">Live Code</span>
                <p className="font-heading font-extrabold text-lg leading-tight mt-0.5 text-black">LeetCode Sandbox</p>
              </div>
            </div>

            {/* 2. Orange Squircle */}
            <div className="p-6 rounded-squircle bg-nvg-orange text-black flex flex-col justify-between aspect-square group hover:-translate-y-1 transition-transform shadow-neo-sm">
              <Mic className="w-10 h-10 text-black stroke-[2.5]" />
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-black/70">Voice AI</span>
                <p className="font-heading font-extrabold text-lg leading-tight mt-0.5 text-black">Sub-Second Audio</p>
              </div>
            </div>

            {/* 3. Green Squircle */}
            <div className="p-6 rounded-squircle bg-nvg-green text-black flex flex-col justify-between aspect-square group hover:-translate-y-1 transition-transform shadow-neo-sm">
              <Zap className="w-10 h-10 text-black stroke-[2.5]" />
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-black/70">Telemetry</span>
                <p className="font-heading font-extrabold text-lg leading-tight mt-0.5 text-black">WPM & Pacing</p>
              </div>
            </div>

            {/* 4. Light Blue Squircle (NO BLACK BOX - Solid Light Blue Card) */}
            <div className="p-6 rounded-squircle bg-nvg-lightblue text-black flex flex-col justify-between aspect-square group hover:-translate-y-1 transition-transform shadow-neo-sm">
              <Eye className="w-10 h-10 text-black stroke-[2.5]" />
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-black/70">Vision Coach</span>
                <p className="font-heading font-extrabold text-lg leading-tight mt-0.5 text-black">On-Device Camera</p>
              </div>
            </div>

            {/* 5. Purple Squircle */}
            <div className="p-6 rounded-squircle bg-nvg-purple text-black flex flex-col justify-between aspect-square group hover:-translate-y-1 transition-transform shadow-neo-sm col-span-2 sm:col-span-1">
              <FileText className="w-10 h-10 text-black stroke-[2.5]" />
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-black/70">RAG Persona</span>
                <p className="font-heading font-extrabold text-lg leading-tight mt-0.5 text-black">Resume Context</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== EDITORIAL SECTION WITH SCROLL ANIMATION ===================== */}
      <section
        ref={editorialRef}
        className="bg-nvg-offwhite text-nvg-offblack py-24 px-4 sm:px-6 lg:px-8 border-y border-black/10 relative overflow-hidden transition-colors"
      >
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Subheader */}
          <div className="text-center max-w-2xl mx-auto space-y-1">
            <span className="text-xs font-heading font-extrabold uppercase tracking-widest text-black/60 block">
              The Comprehensive Prep Engine
            </span>
            <p className="text-sm font-semibold text-black/80">
              One unified platform covering every dimension of tech hiring.
            </p>
          </div>

          {/* Phase 1: Straight Horizontal Line Alignment Tray */}
          <div
            className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
              isInSentenceForm
                ? "max-h-0 opacity-0 -translate-y-8 pointer-events-none mb-0 scale-95"
                : "max-h-56 opacity-100 translate-y-0 mb-6 scale-100"
            }`}
          >
            <div className="p-4 sm:p-5 rounded-3xl bg-black/[0.04] border border-black/10 shadow-inner max-w-3xl mx-auto text-center">
              <div className="flex items-center justify-center gap-2 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-nvg-purple animate-ping" />
                <span className="text-xs font-heading font-extrabold uppercase tracking-widest text-black/60">
                  Straight Horizontal Line Alignment
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                <div className="px-4 py-2 rounded-xl bg-nvg-purple text-white font-heading font-bold text-sm sm:text-base shadow-sm flex items-center gap-1.5">
                  <span>🏢</span> <span>companies.</span>
                </div>
                <div className="px-4 py-2 rounded-xl bg-nvg-green text-white font-heading font-bold text-sm sm:text-base shadow-sm flex items-center gap-1.5">
                  <span>💻</span> <span>system design</span>
                </div>
                <div className="px-4 py-2 rounded-xl bg-nvg-orange text-white font-heading font-bold text-sm sm:text-base shadow-sm flex items-center gap-1.5">
                  <span>⚡</span> <span>challenges</span>
                </div>
                <div className="px-4 py-2 rounded-xl bg-nvg-yellow text-black font-heading font-bold text-sm sm:text-base shadow-sm flex items-center gap-1.5">
                  <span>🎙️</span> <span>telemetry</span>
                </div>
              </div>
              <p className="text-center text-xs text-black/50 mt-2.5 font-medium">
                ↓ Scroll down to watch emojis smoothly glide from this line to form the editorial sentences
              </p>
            </div>
          </div>

          {/* Phase 2: Editorial Headline with Animated Inline Emoji Badges (Reduced by a bit) */}
          <div className="text-3xl sm:text-5xl md:text-6xl lg:text-[72px] xl:text-[84px] font-heading font-extrabold text-center tracking-tight leading-[1.14] text-nvg-offblack max-w-5xl mx-auto py-2">
            {/* Line 1 */}
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
              <span className="transition-all duration-500 text-nvg-offblack">
                Your target
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-nvg-purple text-white shadow-md transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isInSentenceForm
                    ? "translate-y-0 scale-100 opacity-100"
                    : "translate-y-8 scale-95"
                }`}
              >
                <span className="text-2xl sm:text-3xl lg:text-4xl">🏢</span>
                <span className="text-lg sm:text-2xl lg:text-3xl font-heading font-extrabold">companies.</span>
              </span>
            </div>

            {/* Line 2 */}
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 mt-0.5 sm:mt-1">
              <span className="transition-all duration-500 text-nvg-offblack">
                That
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-nvg-green text-white shadow-md transition-all duration-700 delay-75 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isInSentenceForm
                    ? "translate-y-0 scale-100 opacity-100"
                    : "translate-y-4 scale-95"
                }`}
              >
                <span className="text-2xl sm:text-3xl lg:text-4xl">💻</span>
                <span className="text-lg sm:text-2xl lg:text-3xl font-heading font-extrabold">system design</span>
              </span>
              <span className="transition-all duration-500 text-nvg-offblack">
                round.
              </span>
            </div>

            {/* Line 3 */}
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 mt-0.5 sm:mt-1">
              <span className="transition-all duration-500 text-nvg-offblack">
                Live DSA
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-nvg-orange text-white shadow-md transition-all duration-700 delay-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isInSentenceForm
                    ? "translate-y-0 scale-100 opacity-100"
                    : "-translate-y-4 scale-95"
                }`}
              >
                <span className="text-2xl sm:text-3xl lg:text-4xl">⚡</span>
                <span className="text-lg sm:text-2xl lg:text-3xl font-heading font-extrabold">challenges</span>
              </span>
              <span className="transition-all duration-500 text-nvg-offblack">
                and
              </span>
            </div>

            {/* Line 4 */}
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 mt-0.5 sm:mt-1">
              <span className="transition-all duration-500 text-nvg-offblack">
                all your acoustic
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-nvg-yellow text-black shadow-md transition-all duration-700 delay-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isInSentenceForm
                    ? "translate-y-0 scale-100 opacity-100"
                    : "-translate-y-8 scale-95"
                }`}
              >
                <span className="text-2xl sm:text-3xl lg:text-4xl">🎙️</span>
                <span className="text-lg sm:text-2xl lg:text-3xl font-heading font-extrabold text-black">telemetry</span>
              </span>
              <span className="transition-all duration-500 text-nvg-offblack">
                habits.
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar on Off-White (Reduced by a bit) */}
          <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center border-t border-black/10">
            <div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl text-nvg-orange">100+</div>
              <div className="text-[11px] sm:text-xs text-black/70 mt-0.5 font-bold">Curated Technical Roles</div>
            </div>
            <div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl text-nvg-green">&lt;350ms</div>
              <div className="text-[11px] sm:text-xs text-black/70 mt-0.5 font-bold">Voice Streaming Latency</div>
            </div>
            <div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl text-nvg-purple">100%</div>
              <div className="text-[11px] sm:text-xs text-black/70 mt-0.5 font-bold">On-Device Video Privacy</div>
            </div>
            <div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl text-black">STAR</div>
              <div className="text-[11px] sm:text-xs text-black/70 mt-0.5 font-bold">Automated Rubric Grading</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== BENTO GRID SECTION (Reference Image 1 Style) ===================== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <span className="px-4 py-1.5 rounded-full bg-nvg-lime !text-black text-xs font-heading font-extrabold uppercase tracking-wider shadow-neo-lime inline-block">
            Engineered for Top Candidates
          </span>
          <h2 className="text-4xl sm:text-6xl font-heading font-extrabold text-white tracking-tight">
            Built like no other interview tool.
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base font-body">
            Everything you need to practice, diagnose weaknesses, and calibrate your delivery under real pressure.
          </p>
        </div>

        {/* Bento Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {/* Card 1: Large Orange Card (Real-time Speech Engine) */}
          <div className="p-8 rounded-squircle bg-nvg-orange text-black flex flex-col justify-between md:col-span-2 min-h-[340px] shadow-neo-orange relative overflow-hidden group">
            <div className="space-y-3 relative z-10">
              <Mic className="w-10 h-10 text-black stroke-[2.5]" />
              <h3 className="text-2xl sm:text-3xl font-heading font-extrabold leading-tight text-black">
                Whisper STT & Real-Time Audio Telemetry
              </h3>
              <p className="text-black/85 text-sm leading-relaxed max-w-md font-body font-medium">
                Continuous speech recognition calculates Words Per Minute (WPM), speech pace anomalies,
                filler words (um, uh, like), and pauses in real-time.
              </p>
            </div>

            <div className="pt-6 relative z-10 flex items-center gap-3">
              <span className="px-3.5 py-1.5 rounded-full bg-black/15 text-xs font-heading font-extrabold text-black">
                145 WPM Optimal
              </span>
              <span className="px-3.5 py-1.5 rounded-full bg-black/15 text-xs font-heading font-extrabold text-black">
                0 Fillers Detected
              </span>
            </div>
          </div>

          {/* Card 2: Purple Card (RAG Resume Ingestion) */}
          <div className="p-8 rounded-squircle bg-nvg-purple text-black flex flex-col justify-between min-h-[340px] shadow-neo-purple">
            <div className="space-y-3">
              <FileText className="w-10 h-10 text-black stroke-[2.5]" />
              <h3 className="text-2xl font-heading font-extrabold leading-tight text-black">
                Resume Context Ingestion
              </h3>
              <p className="text-black/85 text-xs leading-relaxed font-body font-medium">
                Upload your PDF resume. Our PyMuPDF chunking pipeline indexes your stack and past projects
                into pgvector so the interviewer asks tailor-made questions.
              </p>
            </div>

            <Link
              href="/resume"
              className="inline-flex items-center gap-1.5 text-xs font-heading font-extrabold text-black hover:underline mt-4"
            >
              <span>Test Resume Parser</span>
              <ArrowUpRight className="w-4 h-4 text-black stroke-[2.5]" />
            </Link>
          </div>

          {/* Card 3: Lime Card (Vision Coach - ALL BLACK TEXT ON LIME) */}
          <div className="p-8 rounded-squircle bg-nvg-lime !text-black flex flex-col justify-between min-h-[340px] shadow-neo-lime">
            <div className="space-y-3">
              <Eye className="w-10 h-10 text-black stroke-[2.5]" />
              <h3 className="text-2xl font-heading font-extrabold leading-tight text-black">
                On-Device Vision Coach
              </h3>
              <p className="text-black/85 text-xs leading-relaxed font-body font-medium">
                Tracks eye contact percentage and body posture stability right in your browser.
                Zero video is ever uploaded or sent across the network.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-black/15 text-xs font-heading font-extrabold text-black">
              <span>85% Eye Contact</span>
              <span>Steady Posture</span>
            </div>
          </div>

          {/* Card 4: Yellow Card (LeetCode Sandbox) */}
          <div className="p-8 rounded-squircle bg-nvg-yellow text-black flex flex-col justify-between min-h-[340px] shadow-neo-sm">
            <div className="space-y-3">
              <Terminal className="w-10 h-10 text-black stroke-[2.5]" />
              <h3 className="text-2xl font-heading font-extrabold leading-tight text-black">
                LeetCode Whiteboard
              </h3>
              <p className="text-black/85 text-xs leading-relaxed font-body font-medium">
                Integrated Python sandbox for live technical coding rounds with automated test case evaluation
                and Big-O complexity analysis.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <span className="px-2.5 py-1 rounded-md bg-black/15 text-[11px] font-heading font-bold text-black">Python</span>
              <span className="px-2.5 py-1 rounded-md bg-black/15 text-[11px] font-heading font-bold text-black">JavaScript</span>
              <span className="px-2.5 py-1 rounded-md bg-black/15 text-[11px] font-heading font-bold text-black">O(N) Complexity</span>
            </div>
          </div>

          {/* Card 5: Surface Card (STAR Rubrics) */}
          <div className="p-8 rounded-squircle bg-nvg-surface border border-white/10 text-white flex flex-col justify-between md:col-span-2 min-h-[340px]">
            <div className="space-y-3">
              <Award className="w-10 h-10 text-nvg-yellow stroke-[2.5]" />
              <h3 className="text-2xl sm:text-3xl font-heading font-extrabold leading-tight text-white">
                STAR Behavioral & Executive Scoring
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed max-w-lg font-body">
                Automated evaluation of Situation, Task, Action, and Result with downloadable PDF feedback
                reports, customized action plans, and target company rubric alignment.
              </p>
            </div>

            <div className="pt-6 flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
                Amazon Leadership Principles
              </span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
                Google Distributed Systems
              </span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
                Meta Product Velocity
              </span>
            </div>
          </div>

          {/* Card 6: Light Blue Card (PDF Reports) */}
          <div className="p-8 rounded-squircle bg-nvg-lightblue text-black flex flex-col justify-between min-h-[340px] shadow-neo-sm">
            <div className="space-y-3">
              <CheckCircle2 className="w-10 h-10 text-black stroke-[2.5]" />
              <h3 className="text-2xl font-heading font-extrabold leading-tight text-black">
                PDF Improvement Plans
              </h3>
              <p className="text-black/85 text-xs leading-relaxed font-body font-medium">
                One-click downloadable PDF report artifacts detailing your vocal pace, strengths,
                competency radar, and a 2-week preparation roadmap.
              </p>
            </div>

            <span className="text-xs font-heading font-bold text-black/70">Generated with ReportLab</span>
          </div>
        </div>
      </section>

      {/* ===================== CALL TO ACTION SECTION ===================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="p-10 sm:p-16 rounded-squircle bg-gradient-to-tr from-nvg-purple via-[#6461FC] to-nvg-orange text-white text-center relative overflow-hidden shadow-2xl">
          <div className="space-y-6 relative z-10 max-w-2xl mx-auto">
            <h2 className="text-4xl sm:text-6xl font-heading font-extrabold tracking-tight leading-tight">
              Ready to crush your next interview?
            </h2>
            <p className="text-white/85 text-base sm:text-lg font-body">
              Set up your custom mock session in less than 30 seconds. Zero credit card required.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/interview/setup"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-nvg-lime !text-black font-heading font-extrabold text-sm shadow-neo-lime hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-black" />
                <span>Configure Interview Now</span>
              </Link>
              <Link
                href="/register"
                className="w-full sm:w-auto px-7 py-4 rounded-full bg-black/30 hover:bg-black/40 text-white font-heading font-bold text-sm border border-white/20 transition-all"
              >
                Create Candidate Account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
