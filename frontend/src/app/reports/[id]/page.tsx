"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getInterviewEvaluation, generatePDFReport, getPDFReportDownloadUrl } from "@/lib/api";
import { Award, Download, CheckCircle2, AlertTriangle, ArrowRight, Mic, BarChart3, FileText, Sparkles } from "lucide-react";

export default function ReportPage() {
  const params = useParams();
  const sessionId = (params.id as string) || "demo_session";

  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    async function loadEval() {
      try {
        const data = await getInterviewEvaluation(sessionId);
        setEvaluation(data);
      } catch (err) {
        console.error("Error loading evaluation:", err);
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

  const scores = evaluation?.scores || {
    overall: 84.5,
    technical: 85.0,
    communication: 78.0,
    problem_solving: 84.0,
    structure: 75.0,
  };

  const feedback = evaluation?.feedback_json || {
    strengths: [
      "Demonstrated solid technical depth in microservices and database optimization.",
      "Maintained optimal conversational pacing (~142 WPM).",
    ],
    weaknesses: [
      "Some behavioral answers lacked explicit quantifiable outcome metrics.",
      "Detected 3 filler word instances (um, uh) during complex architectural explanations.",
    ],
    improvement_plan: [
      "Week 1: Practice framing project achievements with explicit metrics (e.g. latency reduction %).",
      "Week 2: Perform 2 timed mock sessions focusing on pause management instead of filler words.",
    ],
  };

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
            <p className="text-5xl font-extrabold text-white mt-2">{scores.overall}<span className="text-xl text-emerald-400">/100</span></p>
            <p className="text-xs text-emerald-400 font-medium mt-2">Strong Engineering Alignment</p>
          </div>

          {/* Competency Scores */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Competency Radar Scores</h3>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Technical Accuracy</span>
                <span className="text-brand-400">{scores.technical}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${scores.technical}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Problem Solving</span>
                <span className="text-cyan-400">{scores.problem_solving}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${scores.problem_solving}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Communication & Pacing</span>
                <span className="text-emerald-400">{scores.communication}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${scores.communication}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>STAR Answer Structure</span>
                <span className="text-amber-400">{scores.structure}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${scores.structure}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Feedback, Telemetry, and Improvement Plan */}
        <div className="lg:col-span-2 space-y-6">
          {/* Strengths Card */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" /> Verified Key Strengths
            </h3>
            <ul className="space-y-2.5 text-sm text-gray-300">
              {feedback.strengths?.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Areas for Improvement Card */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" /> Recommended Improvement Areas
            </h3>
            <ul className="space-y-2.5 text-sm text-gray-300">
              {feedback.weaknesses?.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* 2-Week Action Plan */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-brand-900/40 to-indigo-900/40 border border-brand-500/30 backdrop-blur-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 text-brand-300">
              <Sparkles className="w-5 h-5" /> Targeted 2-Week Action Plan
            </h3>
            <div className="space-y-3">
              {feedback.improvement_plan?.map((step: string, i: number) => (
                <div key={i} className="p-3.5 rounded-xl bg-dark-900/60 border border-white/10 text-xs text-gray-200 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
