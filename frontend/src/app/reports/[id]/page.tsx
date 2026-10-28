"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getInterviewEvaluation, generatePDFReport, getPDFReportDownloadUrl } from "@/lib/api";
import { Award, Download, CheckCircle2, AlertTriangle, ArrowRight, Mic, BarChart3, FileText, Sparkles, Loader2, Eye, Video } from "lucide-react";
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
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Analyzing Interview Performance...</h2>
        <p className="text-sm text-gray-400 max-w-md">
          Synthesizing OpenAI rubric evaluations, scoring technical competencies, and generating your customized 2-week growth plan.
        </p>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Evaluation Unavailable</h2>
        <p className="text-sm text-gray-400 max-w-md mb-6">
          {error || "We could not find completed evaluation data for this session."}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-all"
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const scores = evaluation?.scores || {};
  const overallScore = scores.overall ?? 0;
  const feedback = evaluation?.feedback_json || {};
  // On-device body-language summary (null/undefined when the camera was off → card is omitted).
  const vision = evaluation?.vision_summary;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Session Completed & Evaluated
          </div>
          <h1 className="text-3xl font-extrabold text-white">
            Interview Performance Analytics Report
          </h1>
          <p className="text-gray-400 text-sm mt-1">Session ID: {sessionId}</p>
        </div>

        <button
          onClick={handleDownloadPDF}
          disabled={pdfGenerating}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-sm shadow-xl shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> {pdfGenerating ? "Compiling PDF Artifact..." : "Download PDF Report"}
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Overall Score & Competency Breakdown */}
        <div className="space-y-6">
          {/* Overall Score Badge */}
          <div className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-white flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/20">
              <Award className="w-8 h-8" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Overall Performance</span>
            <p className="text-5xl font-extrabold text-white mt-2">{overallScore}<span className="text-xl text-emerald-400">/100</span></p>
            <p className="text-xs text-emerald-400 font-medium mt-2">
              {overallScore >= 80 ? "Strong Engineering Alignment" : overallScore >= 60 ? "Moderate Alignment — Growth Opportunity" : "Needs Further Preparation"}
            </p>
          </div>

          {/* Competency Scores */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Competency Radar Scores</h3>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Technical Accuracy</span>
                <span className="text-brand-400">{scores.technical ?? 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, scores.technical ?? 0))}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Problem Solving</span>
                <span className="text-cyan-400">{scores.problem_solving ?? 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, scores.problem_solving ?? 0))}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Communication & Pacing</span>
                <span className="text-emerald-400">{scores.communication ?? 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, scores.communication ?? 0))}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>STAR Answer Structure</span>
                <span className="text-amber-400">{scores.structure ?? 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, scores.structure ?? 0))}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Feedback, Telemetry, and Improvement Plan */}
        <div className="lg:col-span-2 space-y-6">
          {/* Strengths Card */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" /> Key Strengths
            </h3>
            {feedback.strengths && feedback.strengths.length > 0 ? (
              <ul className="space-y-2.5 text-sm text-gray-300">
                {feedback.strengths.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No specific strengths recorded.</p>
            )}
          </div>

          {/* Areas for Improvement Card */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" /> Recommended Improvement Areas
            </h3>
            {feedback.weaknesses && feedback.weaknesses.length > 0 ? (
              <ul className="space-y-2.5 text-sm text-gray-300">
                {feedback.weaknesses.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No specific improvement areas flagged.</p>
            )}
          </div>

          {/* Body Language / Presence (shown only when the on-device camera coach was used) */}
          {vision && vision.camera_used && (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
              <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2 text-violet-300">
                <Video className="w-5 h-5" /> Body Language & Presence
              </h3>
              <p className="text-[11px] text-gray-500 mb-4">
                How your delivery came across — on-device estimates to help you practice, not a judgment of you.
              </p>
              <div className="space-y-4">
                {[
                  { label: "Eye Contact", value: vision.eye_contact_pct, color: "bg-violet-500", text: "text-violet-300" },
                  { label: "Posture Stability", value: vision.posture_stability, color: "bg-fuchsia-500", text: "text-fuchsia-300" },
                  { label: "Composure", value: vision.fidget_index != null ? Math.max(0, 100 - vision.fidget_index) : undefined, color: "bg-emerald-500", text: "text-emerald-300" },
                  { label: "Expression / Warmth", value: vision.smile_positivity, color: "bg-amber-500", text: "text-amber-300" },
                ].filter((m) => m.value != null).map((m) => (
                  <div key={m.label}>
                    <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                      <span>{m.label}</span>
                      <span className={m.text}>{Math.round(m.value as number)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                      <div className={`h-full ${m.color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, m.value as number))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {vision.blink_rate_per_min != null && (
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                  <Eye className="w-3.5 h-3.5 text-violet-300" />
                  <span>Blink rate: <span className="text-gray-200 font-semibold">{Math.round(vision.blink_rate_per_min)}/min</span> <span className="text-gray-500">(~15–20/min is a typical relaxed range)</span></span>
                </div>
              )}
            </div>
          )}

          {/* 2-Week Action Plan */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-brand-900/40 to-indigo-900/40 border border-brand-500/30 backdrop-blur-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 text-brand-300">
              <Sparkles className="w-5 h-5" /> Targeted Action Plan
            </h3>
            {feedback.improvement_plan && feedback.improvement_plan.length > 0 ? (
              <div className="space-y-3">
                {feedback.improvement_plan.map((step: string, i: number) => (
                  <div key={i} className="p-3.5 rounded-xl bg-dark-900/60 border border-white/10 text-xs text-gray-200 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No action plan items recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
