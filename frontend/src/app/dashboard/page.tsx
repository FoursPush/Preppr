"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Clock,
  ArrowRight,
  Award,
  Mic,
  FileText,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Target,
  Compass,
  UserCheck,
  Play,
  ArrowUpRight,
} from "lucide-react";
import { getDashboardSummary, getDashboardHistory } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";

interface SessionItem {
  session_id: string;
  company_target?: string;
  overall_score?: number;
  created_at: string;
  average_wpm?: number;
  total_filler_words?: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState({
    average_overall_score: 0,
    average_wpm: 0,
    total_interviews_completed: 0,
  });
  const [history, setHistory] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedId = user?.user_id || (typeof window !== "undefined" ? localStorage.getItem("preppr_user_id") : null);
    if (!savedId) {
      setLoading(false);
      return;
    }

    async function fetchDashboard() {
      try {
        const sumData = await getDashboardSummary(savedId);
        if (sumData) setSummary(sumData);

        const histData = await getDashboardHistory(savedId);
        setHistory(histData?.sessions || []);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [user]);

  const candidateName = user?.name || "Candidate";
  const candidateRole = user?.role || "Software Engineer";
  const hasSessions = summary.total_interviews_completed > 0;

  return (
    <ProtectedRoute
      title="Candidate Dashboard"
      description="Sign in to view your interview analytics, performance scores, and past reports."
    >
      <div className="min-h-screen bg-nvg-offblack text-nvg-offwhite pt-32 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-8 font-body">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Welcome Bento Card */}
          <div className="p-6 sm:p-8 rounded-squircle bg-nvg-surface border border-white/10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="flex items-center gap-5 relative z-10">
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={candidateName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-nvg-lime/50 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-nvg-purple to-nvg-orange flex items-center justify-center text-white font-heading font-extrabold text-2xl shadow-neo-purple">
                  {candidateName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-4xl font-heading font-extrabold text-white tracking-tight">
                    Welcome back, {candidateName}
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-heading font-extrabold bg-nvg-lime !text-black shadow-sm">
                    Active Track
                  </span>
                </div>
                <p className="text-gray-400 text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-nvg-orange" />
                  <span>Target Role:</span>
                  <span className="text-white font-semibold">{candidateRole}</span>
                  {user?.email && <span className="text-gray-500 hidden md:inline">({user.email})</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 relative z-10">
              <Link
                href="/resume"
                className="px-5 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white font-heading font-bold text-xs border border-white/10 transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-nvg-purple" />
                <span>Resume Persona</span>
              </Link>
              <Link
                href="/interview/setup"
                className="px-6 py-3 rounded-full bg-nvg-lime !text-black font-heading font-extrabold text-xs shadow-neo-lime hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-black" />
                <span>Start Mock Session</span>
              </Link>
            </div>
          </div>

          {/* Metric Bento Summary Cards (User's Exact Color Palette) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* 1. Purple Card: Overall Score */}
            <div className="p-7 rounded-squircle bg-nvg-purple text-white flex flex-col justify-between min-h-[190px] shadow-neo-purple relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">Average Score</span>
                <div className="w-9 h-9 rounded-xl bg-black/25 flex items-center justify-center text-white">
                  <Award className="w-5 h-5" />
                </div>
              </div>

              <div className="my-2">
                <div className="text-4xl sm:text-5xl font-heading font-extrabold tracking-tight">
                  {hasSessions ? (
                    <>
                      {summary.average_overall_score}
                      <span className="text-xl text-white/70">/100</span>
                    </>
                  ) : (
                    <span className="text-white/60">--</span>
                  )}
                </div>
              </div>

              <div className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                {hasSessions ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>{summary.average_overall_score >= 80 ? "Strong technical delivery" : "Practice recommended"}</span>
                  </>
                ) : (
                  <span>Complete a mock to calculate</span>
                )}
              </div>
            </div>

            {/* 2. Orange Card: Speech Rate */}
            <div className="p-7 rounded-squircle bg-nvg-orange text-white flex flex-col justify-between min-h-[190px] shadow-neo-orange relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">Speech Pace</span>
                <div className="w-9 h-9 rounded-xl bg-black/25 flex items-center justify-center text-white">
                  <Mic className="w-5 h-5" />
                </div>
              </div>

              <div className="my-2">
                <div className="text-4xl sm:text-5xl font-heading font-extrabold tracking-tight">
                  {hasSessions ? (
                    <>
                      {summary.average_wpm}
                      <span className="text-xl text-white/70 ml-1">WPM</span>
                    </>
                  ) : (
                    <span className="text-white/60">--</span>
                  )}
                </div>
              </div>

              <div className="text-xs font-medium text-white/80">
                {hasSessions ? "Whisper telemetry audio rate" : "Optimal conversational: 130 - 150 WPM"}
              </div>
            </div>

            {/* 3. Lime Card: Completed Sessions (Direct Vector, No Black Box) */}
            <div className="p-7 rounded-squircle bg-nvg-lime !text-black flex flex-col justify-between min-h-[190px] shadow-neo-lime relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-heading font-extrabold uppercase tracking-wider text-black/70">Total Interviews</span>
                <BarChart3 className="w-7 h-7 text-black stroke-[2.5]" />
              </div>

              <div className="my-2">
                <div className="text-4xl sm:text-5xl font-heading font-extrabold tracking-tight text-black">
                  {summary.total_interviews_completed}
                </div>
              </div>

              <div className="text-xs font-heading font-bold text-black/70">
                {hasSessions ? "Persistent PostgreSQL session logs" : "0 sessions recorded"}
              </div>
            </div>
          </div>

          {/* Zero State Onboarding Guide */}
          {!hasSessions && !loading && (
            <div className="p-8 sm:p-10 rounded-squircle bg-nvg-surface border border-white/10 space-y-6">
              <div className="space-y-1">
                <span className="text-xs font-heading font-extrabold uppercase tracking-wider text-nvg-orange">Getting Started</span>
                <h3 className="text-2xl font-heading font-extrabold text-white">Your 3-Step Interview Roadmap</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                  <div className="w-9 h-9 rounded-xl bg-nvg-purple text-white font-heading font-extrabold text-sm flex items-center justify-center">
                    01
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-white text-base">Index Resume for RAG</h4>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Upload your PDF resume to extract skills and persona context into pgvector.
                    </p>
                  </div>
                  <Link
                    href="/resume"
                    className="inline-flex items-center gap-1 text-xs font-bold text-nvg-purple hover:underline"
                  >
                    <span>Upload Resume</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                  <div className="w-9 h-9 rounded-xl bg-nvg-orange text-white font-heading font-extrabold text-sm flex items-center justify-center">
                    02
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-white text-base">Configure Mock Session</h4>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Choose your company (Amazon, Google, Meta) and difficulty level.
                    </p>
                  </div>
                  <Link
                    href="/interview/setup"
                    className="inline-flex items-center gap-1 text-xs font-bold text-nvg-orange hover:underline"
                  >
                    <span>Setup Interview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                  <div className="w-9 h-9 rounded-xl bg-nvg-lime text-nvg-offblack font-heading font-extrabold text-sm flex items-center justify-center">
                    03
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-white text-base">Review Rubrics & PDF</h4>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Receive immediate STAR feedback and download your comprehensive PDF roadmap.
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">Unlocked after session</span>
                </div>
              </div>
            </div>
          )}

          {/* Chronological Interview History */}
          <div className="p-6 sm:p-8 rounded-squircle bg-nvg-surface border border-white/10 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-nvg-yellow" /> Past Mock Sessions
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Chronological record of completed evaluations</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-gray-300 font-bold border border-white/10">
                {history.length} logged
              </span>
            </div>

            {loading ? (
              <div className="space-y-3 py-4">
                <div className="h-16 rounded-2xl bg-white/5 animate-pulse" />
                <div className="h-16 rounded-2xl bg-white/5 animate-pulse" />
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-3">
                {history.map((session, i) => (
                  <div
                    key={i}
                    className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/15 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-nvg-offblack border border-white/10 flex items-center justify-center text-nvg-yellow font-heading font-extrabold">
                        {session.overall_score ? `${Math.round(session.overall_score)}` : "--"}
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-white text-sm">
                          {session.company_target || "Target Tech Company"}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                          <span>{new Date(session.created_at).toLocaleDateString()}</span>
                          {session.average_wpm && <span>• {Math.round(session.average_wpm)} WPM</span>}
                          {session.total_filler_words !== undefined && (
                            <span>• {session.total_filler_words} fillers</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/reports/${session.session_id}`}
                      className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white font-heading font-bold text-xs border border-white/10 transition-colors flex items-center gap-1.5 self-end sm:self-auto"
                    >
                      <span>View Rubric</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500 text-xs">
                No mock sessions yet. Start your first session to view telemetry records!
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
