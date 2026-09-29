"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCompanies, getRoles, createInterviewSession, uploadPdfResume } from "@/lib/api";
import { Sparkles, Building2, Briefcase, Gauge, Clock, ArrowRight } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";

export default function InterviewSetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);

  const [selectedCategory, setSelectedCategory] = useState("Admin");
  const [selectedRole, setSelectedRole] = useState("role_admin_asst");
  const [difficulty, setDifficulty] = useState("Medium");
  const [duration, setDuration] = useState(15);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [alignmentError, setAlignmentError] = useState("");

  useEffect(() => {
    async function loadOptions() {
      try {
        const rls = await getRoles();
        setRoles(rls);
        
        if (rls && rls.length > 0) {
          const cats = Array.from(new Set(rls.map((r: any) => r.category || "IT")));
          if (cats.length > 0) {
            setSelectedCategory(cats[0] as string);
            const firstRole = rls.find((r: any) => (r.category || "IT") === cats[0]);
            if (firstRole) {
              setSelectedRole(firstRole.id);
            }
          }
        }
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
    setAlignmentError("");

    const userId = user?.user_id || localStorage.getItem("preppr_user_id") || "user_101";

    try {
      // 1. Fetch existing account profile
      let uploadData;
      try {
        const { getCandidateProfile } = await import("@/lib/api");
        uploadData = await getCandidateProfile(userId);
      } catch (err: any) {
        throw new Error("Failed to load your account resume. Please ensure you have added a resume to your profile.");
      }

      const profileSkills = (uploadData.skills || []).map((s: string) => s.toLowerCase());
      
      let profileRoles: string[] = [];
      if (uploadData.past_roles) {
        profileRoles = (uploadData.past_roles || []).map((r: string) => (typeof r === 'string' ? r.toLowerCase() : JSON.stringify(r).toLowerCase()));
      } else if (uploadData.experience) {
        profileRoles = (uploadData.experience || []).map((r: any) => (r.role ? r.role.toLowerCase() : JSON.stringify(r).toLowerCase()));
      }
      
      const allProfileText = [...profileSkills, ...profileRoles].join(" ");

      // 2. Find selected role requirements
      const roleObj = roles.find((r) => r.id === selectedRole);
      if (roleObj) {
        const reqs = (roleObj.requirements || []).map((req: string) => req.toLowerCase());
        const roleNameParts = roleObj.role_name.toLowerCase().split(" ");
        
        let matchCount = 0;
        
        for (const req of reqs) {
           if (allProfileText.includes(req) || profileSkills.some((s: string) => s.includes(req) || req.includes(s))) {
             matchCount++;
           }
        }
        for (const part of roleNameParts) {
           if (part.length > 3 && allProfileText.includes(part)) {
             matchCount++;
           }
        }

        if (matchCount === 0 && reqs.length > 0) {
          setAlignmentError(`The uploaded resume does not appear to align with the ${roleObj.role_name} role. Please check again or upload a different resume.`);
          setLoading(false);
          return;
        }
      }

      // 3. Start interview
      const res = await createInterviewSession({
        user_id: userId,
        company_name: "Mock Interview AI",
        role_name: roleObj ? roleObj.role_name : selectedRole,
        difficulty: difficulty,
        duration: duration,
      });

      router.push(`/interview/${res.session_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create interview session.");
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(roles.map((r) => r.category || "IT")));
  const filteredRoles = roles.filter((r) => (r.category || "IT") === selectedCategory);


  return (
    <ProtectedRoute title="Launch Mock Interview" description="Sign in to customize your target company, role rubric, difficulty level, and start practicing with the AI agent.">
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

      {alignmentError && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex justify-between items-center">
          <span>{alignmentError}</span>
          <button onClick={() => setAlignmentError("")} className="text-amber-200 hover:text-white underline text-xs">Dismiss</button>
        </div>
      )}

      <form onSubmit={handleStart} className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-6 shadow-2xl">
        {/* Category & Role Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-cyan-400" /> Sector / Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                const firstRole = roles.find((r) => (r.category || "IT") === e.target.value);
                if (firstRole) setSelectedRole(firstRole.id);
              }}
              className="w-full bg-dark-800 border border-white/10 rounded-xl p-3.5 text-white focus:outline-none focus:border-brand-500 text-sm"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-cyan-400" /> Target Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-dark-800 border border-white/10 rounded-xl p-3.5 text-white focus:outline-none focus:border-brand-500 text-sm"
            >
              {filteredRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.role_name}</option>
              ))}
            </select>
          </div>
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
    </ProtectedRoute>
  );
}
