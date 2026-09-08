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
  UserCheck
} from "lucide-react";
import { API_BASE, getDashboardSummary, getDashboardHistory } from "@/lib/api";
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
    const savedId = user?.user_id || localStorage.getItem("preppr_user_id");
    if (!savedId) {
      setLoading(false);
      return;
    }

    async function fetchDashboard() {
      try {
        const sumData = await getDashboardSummary(savedId);
        setSummary(sumData);

        const histData = await getDashboardHistory(savedId);
        setHistory(histData.sessions || []);
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
    <ProtectedRoute title="Candidate Dashboard" description="Sign in to view your interview analytics, performance scores, and past reports.">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 p-6 rounded-2xl bg-gradient-to-r from-brand-900/30 via-purple-900/20 to-dark-800/80 border border-brand-500/20 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={candidateName}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-brand-500/40 shadow-lg"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-brand-500/20">
                {candidateName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Welcome back, {candidateName}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 border border-brand-500/30 text-brand-300">
                  <UserCheck className="w-3 h-3 text-brand-400" /> Active Candidate
                </span>
              </div>
              <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                Target Track: <span className="text-gray-200 font-medium">{candidateRole}</span>
                {user?.email && <span className="text-gray-500">({user.email})</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/resume"
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-sm border border-white/10 transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-cyan-400" /> Resume Profile
            </Link>
            <Link
              href="/interview/setup"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-brand-500/20 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Start Mock Interview
            </Link>
          </div>
        </div>

        {/* Metrics Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {/* Average Overall Score */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Avg Overall Score</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white mt-4">
              {hasSessions ? (
                <>
                  {summary.average_overall_score}
                  <span className="text-lg text-emerald-400">/100</span>
                </>
              ) : (
                <span className="text-gray-500">--</span>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
              {hasSessions ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {summary.average_overall_score >= 80 ? "Strong Technical Alignment" : "Developing Performance"}
                </>
              ) : (
                <span className="text-gray-500">No mock sessions completed yet</span>
              )}
            </p>
          </div>

          {/* Average Speech Rate */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Average Speech Rate</span>
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
                <Mic className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white mt-4">
              {hasSessions ? (
                <>
                  {summary.average_wpm} <span className="text-sm font-semibold text-gray-400">WPM</span>
                </>
              ) : (
                <span className="text-gray-500">--</span>
              )}
            </p>
            <p className="text-xs text-brand-300 mt-2">
              {hasSessions ? "Optimal conversational range (~140 WPM)" : "Target pace: 130 - 150 WPM"}
            </p>
          </div>

          {/* Completed Sessions */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Completed Sessions</span>
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white mt-4">{summary.total_interviews_completed}</p>
            <p className="text-xs text-gray-400 mt-2">
              {hasSessions ? "Persistent interview records" : "0 mock sessions logged"}
            </p>
          </div>
        </div>

        {/* Zero State Onboarding Guide when 0 interviews */}
        {!hasSessions && !loading && (
          <div className="mb-10 p-8 rounded-2xl bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Your Preppr Interview Roadmap</h3>
                <p className="text-xs text-gray-400">Follow these steps to unlock AI behavioral and technical evaluation.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-5 rounded-xl bg-dark-800/80 border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center mb-3">
                  01
                </div>
                <h4 className="text-sm font-bold text-white mb-1">Upload Your Resume</h4>
                <p className="text-xs text-gray-400 mb-4">
                  Parse your skills and projects so the AI interviewer asks role-specific questions.
                </p>
                <Link
                  href="/resume"
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  Upload Resume <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="p-5 rounded-xl bg-dark-800/80 border border-brand-500/20">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 font-bold text-xs flex items-center justify-center mb-3">
                  02
                </div>
                <h4 className="text-sm font-bold text-white mb-1">Launch AI Mock Session</h4>
                <p className="text-xs text-gray-400 mb-4">
                  Select target company (Amazon, Google, Meta) and practice answering under realistic timing.
                </p>
                <Link
                  href="/interview/setup"
                  className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
                >
                  Start Practice <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="p-5 rounded-xl bg-dark-800/80 border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center mb-3">
                  03
                </div>
                <h4 className="text-sm font-bold text-white mb-1">Analyze Rubric & Telemetry</h4>
                <p className="text-xs text-gray-400 mb-4">
                  Get instant STAR evaluation, speech pace (WPM), filler word counts, and a downloadable PDF.
                </p>
                <span className="text-xs text-gray-500">Available after first session</span>
              </div>
            </div>
          </div>
        )}

        {/* Chronological Interview History */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-400" /> Recent Mock Sessions
            </h2>
            <span className="text-xs text-gray-400">{history.length} sessions logged</span>
          </div>

          {loading ? (
            <div className="space-y-3 py-6">
              <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
              <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">No Past Mock Interviews Found</h3>
              <p className="text-gray-400 text-xs max-w-sm mx-auto mb-4">
                Your completed interview performance reports and telemetry metrics will appear here.
              </p>
              <Link
                href="/interview/setup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-all shadow-lg shadow-brand-500/20"
              >
                Launch Your First Mock Interview <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((sess) => (
                <div
                  key={sess.session_id}
                  className="p-5 rounded-xl bg-dark-800/60 border border-white/10 hover:border-brand-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-white text-base">
                        {sess.company_target || "Target Tech"} Mock Interview
                      </span>
                      {sess.overall_score !== null && sess.overall_score !== undefined ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          Score: {sess.overall_score}%
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 flex flex-wrap items-center gap-4 mt-1">
                      <span>Session ID: #{sess.session_id}</span>
                      <span>Date: {sess.created_at !== "N/A" ? new Date(sess.created_at).toLocaleDateString() : "Recent"}</span>
                      {sess.average_wpm ? <span>Speed: {sess.average_wpm} WPM</span> : null}
                      {sess.total_filler_words !== null && sess.total_filler_words !== undefined ? (
                        <span>Fillers: {sess.total_filler_words}</span>
                      ) : null}
                    </p>
                  </div>

                  <Link
                    href={`/reports/${sess.session_id}`}
                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-200 hover:text-white border border-white/10 transition-colors flex items-center justify-center gap-2 self-start sm:self-auto"
                  >
                    View Report Analytics <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

