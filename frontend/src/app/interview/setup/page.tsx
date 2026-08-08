"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCompanies, getRoles, createInterviewSession } from "@/lib/api";
import { Sparkles, Building2, Briefcase, Gauge, Clock, ArrowRight } from "lucide-react";

export default function InterviewSetupPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  const [selectedCompany, setSelectedCompany] = useState("Amazon");
  const [selectedRole, setSelectedRole] = useState("Senior Software Engineer - Backend");
  const [difficulty, setDifficulty] = useState("Medium");
  const [duration, setDuration] = useState(15);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOptions() {
      try {
        const comps = await getCompanies();
        setCompanies(comps);
        const rls = await getRoles();
        setRoles(rls);
      } catch (err) {
        console.error("Error loading setup options:", err);
      }
    }
    loadOptions();
  }, []);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const userId = localStorage.getItem("preppr_user_id") || "user_101";

    try {
      const res = await createInterviewSession({
        user_id: userId,
        company_name: selectedCompany,
        role_name: selectedRole,
        difficulty: difficulty,
        duration: duration,
      });

      router.push(`/interview/${res.session_id}`);
    } catch (err: any) {
      setError("Failed to create interview session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-brand-500/20">
          <Sparkles className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">Configure Your AI Mock Interview</h1>
        <p className="text-gray-400 text-sm mt-1">Select your target company, role, difficulty, and duration</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleStart} className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-6 shadow-2xl">
        {/* Company Selection */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-400" /> Target Company
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {["Amazon", "Google", "Meta", "Generic Tech Startup"].map((comp) => (
              <button
                key={comp}
                type="button"
                onClick={() => setSelectedCompany(comp)}
                className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  selectedCompany === comp
                    ? "bg-brand-500/20 border-brand-500 text-white shadow-md shadow-brand-500/20"
                    : "bg-dark-800/60 border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                {comp}
              </button>
            ))}
          </div>
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-cyan-400" /> Target Role
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full bg-dark-800 border border-white/10 rounded-xl p-3.5 text-white focus:outline-none focus:border-brand-500 text-sm"
          >
            <option value="Senior Software Engineer - Backend">Senior Software Engineer - Backend</option>
            <option value="Full Stack Engineer">Full Stack Engineer</option>
            <option value="Systems Architect">Systems Architect</option>
            <option value="Frontend Engineer">Frontend Engineer</option>
          </select>
        </div>

        {/* Difficulty & Duration Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Difficulty */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-amber-400" /> Difficulty Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["Easy", "Medium", "Hard"].map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    difficulty === diff
                      ? "bg-amber-500/20 border-amber-500 text-white"
                      : "bg-dark-800/60 border-white/10 text-gray-400"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" /> Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[15, 30, 45].map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setDuration(dur)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    duration === dur
                      ? "bg-emerald-500/20 border-emerald-500 text-white"
                      : "bg-dark-800/60 border-white/10 text-gray-400"
                  }`}
                >
                  {dur} mins
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-extrabold text-base shadow-xl shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
        >
          {loading ? "Initializing AI Interview Room..." : <><Sparkles className="w-5 h-5" /> Launch Mock Interview <ArrowRight className="w-5 h-5" /></>}
        </button>
      </form>
    </div>
  );
}
