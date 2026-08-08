"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Clock, ArrowRight, Award, Mic, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import { API_BASE } from "@/lib/api";

interface SessionItem {
  session_id: string;
  company_target?: string;
  overall_score?: number;
  created_at: string;
  average_wpm?: number;
  total_filler_words?: number;
}

export default function DashboardPage() {
  const [userId, setUserId] = useState("user_101");
  const [summary, setSummary] = useState({
    average_overall_score: 84.5,
    average_wpm: 142.0,
    total_interviews_completed: 4,
  });
  const [history, setHistory] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedId = localStorage.getItem("preppr_user_id") || "user_101";
    setUserId(savedId);

    async function fetchDashboard() {
      try {
        const sumRes = await fetch(`${API_BASE}/api/dashboard/summary/${savedId}`);
        if (sumRes.ok) setSummary(await sumRes.json());

        const histRes = await fetch(`${API_BASE}/api/dashboard/history/${savedId}`);
        if (histRes.ok) {
          const data = await histRes.json();
          setHistory(data.sessions || []);
        }
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            Candidate Analytics Dashboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">Track your speaking telemetry, scores, and mock session progress.</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/resume"
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-sm border border-white/10 transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-cyan-400" /> Manage Resume
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
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Avg Overall Score</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-4">{summary.average_overall_score}<span className="text-lg text-emerald-400">/100</span></p>
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> High technical alignment
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Average Speech Rate</span>
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-4">{summary.average_wpm} <span className="text-sm font-semibold text-gray-400">WPM</span></p>
          <p className="text-xs text-brand-300 mt-2">Optimal conversational range (~140 WPM)</p>
        </div>

        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Completed Sessions</span>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-4">{summary.total_interviews_completed}</p>
          <p className="text-xs text-gray-400 mt-2">Mock interviews logged</p>
        </div>
      </div>

      {/* Chronological Interview History */}
      <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-400" /> Recent Mock Sessions
          </h2>
          <span className="text-xs text-gray-400">{history.length} sessions stored</span>
        </div>

        {loading ? (
          <p className="text-center py-10 text-gray-400 text-sm">Loading session history...</p>
        ) : history.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
            <p className="text-gray-400 text-sm">No past interview sessions found.</p>
            <Link
              href="/interview/setup"
              className="inline-flex items-center gap-2 text-brand-400 text-sm font-semibold mt-3 hover:underline"
            >
              Start your first mock session <ArrowRight className="w-4 h-4" />
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
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      Score: {sess.overall_score || 84.5}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-4">
                    <span>ID: {sess.session_id}</span>
                    <span>Date: {new Date(sess.created_at).toLocaleDateString()}</span>
                    <span>WPM: {sess.average_wpm || 142}</span>
                    <span>Fillers: {sess.total_filler_words || 2}</span>
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
  );
}
