"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getInterviewEvaluation, generatePDFReport, getPDFReportDownloadUrl } from "@/lib/api";
import {
  Award,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Mic,
  BarChart3,
  FileText,
  Sparkles,
  Loader2,
  Eye,
  Video,
  Target,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params.id as string) || "";

  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    async function loadEval() {
      if (!sessionId) {
        setError("No session ID provided.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getInterviewEvaluation(sessionId);
        setEvaluation(data);
      } catch (err: any) {
        console.error("Error loading evaluation:", err);
        setError(err?.response?.data?.detail || "Could not retrieve evaluation for this session.");
      } finally {
        setLoading(false);
      }
    }
    loadEval();
  }, [sessionId]);

  const handleDownloadPDF = async () => {
    setPdfGenerating(true);
    try {
      await generatePDFReport(sessionId);
      const url = getPDFReportDownloadUrl(sessionId);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Error downloading PDF:", err);
    } finally {
      setPdfGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[75vh] bg-nvg-off-black flex flex-col items-center justify-center p-6 pt-32 text-center font-body">
        <div className="w-16 h-16 rounded-full bg-nvg-lime text-nvg-off-black flex items-center justify-center mb-5 shadow-neo-lime">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-2xl font-heading font-extrabold text-white mb-2">
          Evaluating Performance...
        </h2>
        <p className="text-xs sm:text-sm text-gray-400 max-w-md font-body leading-relaxed">
          Synthesizing OpenAI rubric evaluations, scoring technical competencies, and generating your customized growth plan.
        </p>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-[75vh] bg-nvg-off-black flex flex-col items-center justify-center p-6 pt-32 text-center font-body">
        <div className="w-16 h-16 rounded-2xl bg-nvg-yellow/15 border border-nvg-yellow/30 flex items-center justify-center mb-5 text-nvg-yellow">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-heading font-extrabold text-white mb-2">Evaluation Unavailable</h2>
        <p className="text-xs sm:text-sm text-gray-400 max-w-md mb-6 font-body">
          {error || "We could not find completed evaluation data for this session."}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-heading font-bold transition-all"
          >
            Retry Analysis
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-full bg-nvg-lime text-nvg-off-black hover:bg-white text-xs font-heading font-extrabold transition-all"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const scores = evaluation?.scores || {};
  const overallScore = scores.overall ?? 0;
  const feedback = evaluation?.feedback_json || {};
  const vision = evaluation?.vision_summary;

  return (
    <div className="min-h-screen bg-nvg-off-black text-nvg-off-white font-body pt-32 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Editorial Top Bar */}
        <div className="squircle-card p-8 sm:p-10 bg-nvg-surface/80 border border-white/10 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 right-1/4 w-80 h-80 bg-nvg-lime/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-nvg-purple/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nvg-lime/15 border border-nvg-lime/30 text-nvg-lime text-xs font-heading font-bold uppercase tracking-wider mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Session Evaluated</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-heading font-extrabold text-white tracking-tight">
              Performance <span className="text-nvg-lime">Scorecard</span>.
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-gray-400 font-body">
              Session Ref: <span className="font-mono text-gray-300">{sessionId}</span>
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={pdfGenerating}
              className="px-6 py-4 rounded-full bg-nvg-lime hover:bg-white text-nvg-off-black font-heading font-extrabold text-sm shadow-neo-lime transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{pdfGenerating ? "Compiling PDF Artifact..." : "Download Official PDF"}</span>
            </button>
            <Link
              href="/interview/setup"
              className="px-6 py-4 rounded-full bg-nvg-off-black border border-white/15 hover:border-white/30 text-white font-heading font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <span>Practice Again</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Overall Score & Radar (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Overall Score Squircle Card */}
            <div className="squircle-card p-8 bg-nvg-surface/80 border border-white/10 text-center relative overflow-hidden">
              <div className="w-20 h-20 rounded-full bg-nvg-lime text-nvg-off-black flex items-center justify-center mx-auto mb-4 shadow-neo-lime">
                <Award className="w-10 h-10" />
              </div>
              <span className="text-xs font-heading font-bold uppercase tracking-widest text-gray-400">
                Composite Benchmark Score
              </span>
              <div className="text-6xl font-heading font-extrabold text-white mt-2">
                {overallScore}
                <span className="text-2xl text-nvg-lime font-bold">/100</span>
              </div>
              <div className="mt-3 inline-block px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-heading font-bold text-nvg-lime">
                {overallScore >= 80
                  ? "Strong Alignment — Ready for Live Interview"
                  : overallScore >= 60
                  ? "Good Competency Baseline — Focus on Structure"
                  : "Needs Focused Preparation on Core Rubric"}
              </div>
            </div>

            {/* Competency Pillar Bars */}
            <div className="squircle-card p-6 sm:p-8 bg-nvg-surface/70 border border-white/10 space-y-5">
              <h3 className="text-sm font-heading font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-nvg-purple" /> Competency Breakdown
              </h3>

              {/* Technical Accuracy */}
              <div>
                <div className="flex justify-between text-xs font-heading font-bold mb-1.5">
                  <span className="text-gray-300">Technical Depth</span>
                  <span className="text-nvg-purple">{scores.technical ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-nvg-off-black overflow-hidden">
                  <div
                    className="h-full bg-nvg-purple rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(0, scores.technical ?? 0))}%` }}
                  />
                </div>
              </div>

              {/* Problem Solving */}
              <div>
                <div className="flex justify-between text-xs font-heading font-bold mb-1.5">
                  <span className="text-gray-300">Problem Solving & Architecture</span>
                  <span className="text-nvg-light-blue">{scores.problem_solving ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-nvg-off-black overflow-hidden">
                  <div
                    className="h-full bg-nvg-light-blue rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(0, scores.problem_solving ?? 0))}%` }}
                  />
                </div>
              </div>

              {/* Communication */}
              <div>
                <div className="flex justify-between text-xs font-heading font-bold mb-1.5">
                  <span className="text-gray-300">Communication & Pacing</span>
                  <span className="text-nvg-lime">{scores.communication ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-nvg-off-black overflow-hidden">
                  <div
                    className="h-full bg-nvg-lime rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(0, scores.communication ?? 0))}%` }}
                  />
                </div>
              </div>

              {/* STAR Answer Structure */}
              <div>
                <div className="flex justify-between text-xs font-heading font-bold mb-1.5">
                  <span className="text-gray-300">STAR Storytelling Rigor</span>
                  <span className="text-nvg-orange">{scores.structure ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-nvg-off-black overflow-hidden">
                  <div
                    className="h-full bg-nvg-orange rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(0, scores.structure ?? 0))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right 2 Columns: Strengths, Areas to Polish, Vision & Roadmap (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Key Strengths */}
            <div className="squircle-card p-6 sm:p-8 bg-nvg-surface/70 border border-white/10">
              <h3 className="text-base font-heading font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-nvg-green text-white flex items-center justify-center font-bold text-xs">
                  ✓
                </div>
                <span>Demonstrated Strengths</span>
              </h3>
              {feedback.strengths && feedback.strengths.length > 0 ? (
                <ul className="space-y-3 text-xs sm:text-sm text-gray-300 font-body">
                  {feedback.strengths.map((item: any, i: number) => {
                    const text = typeof item === "object" && item !== null
                      ? (item.title ? `${item.title}: ${item.description || ""}` : item.description || item.text || JSON.stringify(item))
                      : String(item);
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-nvg-lime mt-1.5 flex-shrink-0" />
                        <span className="leading-relaxed">{text}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">No specific strengths captured.</p>
              )}
            </div>

            {/* Areas for Improvement */}
            <div className="squircle-card p-6 sm:p-8 bg-nvg-surface/70 border border-white/10">
              <h3 className="text-base font-heading font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-nvg-orange text-white flex items-center justify-center font-bold text-xs">
                  !
                </div>
                <span>Key Areas for Growth</span>
              </h3>
              {feedback.weaknesses && feedback.weaknesses.length > 0 ? (
                <ul className="space-y-3 text-xs sm:text-sm text-gray-300 font-body">
                  {feedback.weaknesses.map((item: any, i: number) => {
                    const text = typeof item === "object" && item !== null
                      ? (item.title ? `${item.title}: ${item.description || ""}` : item.description || item.text || JSON.stringify(item))
                      : String(item);
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-nvg-orange mt-1.5 flex-shrink-0" />
                        <span className="leading-relaxed">{text}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">No major weaknesses identified.</p>
              )}
            </div>

            {/* Body Language / Presence (if camera coach was active) */}
            {vision && vision.camera_used && (
              <div className="squircle-card p-6 sm:p-8 bg-nvg-surface/70 border border-white/10">
                <h3 className="text-base font-heading font-bold text-white mb-1 flex items-center gap-2 text-nvg-purple">
                  <Video className="w-5 h-5" /> On-Device Body Language & Presence
                </h3>
                <p className="text-[11px] text-gray-400 mb-4 font-body">
                  Estimated client-side telemetry indicators to calibrate physical delivery confidence.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Eye Contact", value: vision.eye_contact_pct, color: "text-nvg-purple" },
                    { label: "Posture Stability", value: vision.posture_stability, color: "text-nvg-lime" },
                    { label: "Composure", value: vision.fidget_index != null ? Math.max(0, 100 - vision.fidget_index) : undefined, color: "text-nvg-light-blue" },
                    { label: "Expression Warmth", value: vision.smile_positivity, color: "text-nvg-yellow" },
                  ]
                    .filter((m) => m.value != null)
                    .map((m) => (
                      <div key={m.label} className="p-3.5 rounded-2xl bg-nvg-off-black/60 border border-white/5">
                        <div className="text-[11px] text-gray-400 font-medium">{m.label}</div>
                        <div className={`text-xl font-heading font-extrabold mt-1 ${m.color}`}>
                          {Math.round(m.value as number)}%
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 2-Week Action Plan */}
            <div className="squircle-card p-6 sm:p-8 bg-nvg-surface/70 border border-white/10">
              <h3 className="text-base font-heading font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-nvg-lime" />
                <span>2-Week Targeted Action Roadmap</span>
              </h3>
              {feedback.improvement_plan && feedback.improvement_plan.length > 0 ? (
                <div className="space-y-3">
                  {feedback.improvement_plan.map((step: any, i: number) => {
                    const text = typeof step === "object" && step !== null
                      ? (step.title ? `${step.title}: ${step.description || ""}` : step.step || step.description || JSON.stringify(step))
                      : String(step);
                    return (
                      <div
                        key={i}
                        className="p-4 rounded-2xl bg-nvg-off-black/50 border border-white/5 text-xs text-gray-200 flex items-start gap-3.5"
                      >
                        <span className="w-6 h-6 rounded-full bg-nvg-lime text-nvg-off-black font-heading font-extrabold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="font-body leading-relaxed">{text}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No action plan items recorded.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
