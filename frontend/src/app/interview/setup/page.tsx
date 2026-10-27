"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCompanies, getRoles, createInterviewSession, uploadPdfResume } from "@/lib/api";
import { Sparkles, Building2, Briefcase, Gauge, Clock, ArrowRight, FileText, Upload, CheckCircle2, Loader2 } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";

const DEFAULT_ROLES = [
  // Admin
  { id: "role_admin_asst", company_id: "comp_startup", category: "Admin", role_name: "Administrative Assistant", difficulty: "Medium", requirements: ["Scheduling", "Communication", "Office Management"] },
  { id: "role_office_mgr", company_id: "comp_startup", category: "Admin", role_name: "Office Manager", difficulty: "Medium", requirements: ["Vendor Management", "Budgeting", "Operations"] },
  { id: "role_exec_asst", company_id: "comp_startup", category: "Admin", role_name: "Executive Assistant", difficulty: "Hard", requirements: ["Stakeholder Management", "Confidentiality", "Prioritization"] },
  { id: "role_receptionist", company_id: "comp_startup", category: "Admin", role_name: "Receptionist", difficulty: "Easy", requirements: ["Customer Service", "Phone Skills", "Greeting"] },
  { id: "role_data_entry", company_id: "comp_amazon", category: "Admin", role_name: "Data Entry Clerk", difficulty: "Easy", requirements: ["Typing", "Accuracy", "Data Management"] },
  
  // HR
  { id: "role_hr_gen", company_id: "comp_startup", category: "HR", role_name: "HR Generalist", difficulty: "Medium", requirements: ["Employee Relations", "Onboarding", "Compliance"] },
  { id: "role_recruiter", company_id: "comp_amazon", category: "HR", role_name: "Recruiter", difficulty: "Medium", requirements: ["Sourcing", "Interviewing", "Negotiation"] },
  { id: "role_hr_mgr", company_id: "comp_meta", category: "HR", role_name: "HR Manager", difficulty: "Hard", requirements: ["Strategic HR", "Performance Management", "Leadership"] },
  { id: "role_hr_coord", company_id: "comp_startup", category: "HR", role_name: "HR Coordinator", difficulty: "Easy", requirements: ["Scheduling", "Documentation", "HRIS"] },
  { id: "role_comp_analyst", company_id: "comp_google", category: "HR", role_name: "Compensation Analyst", difficulty: "Medium", requirements: ["Data Analysis", "Market Research", "Excel"] },
  
  // Finance
  { id: "role_fin_analyst", company_id: "comp_amazon", category: "Finance", role_name: "Financial Analyst", difficulty: "Medium", requirements: ["Financial Modeling", "Excel", "Forecasting"] },
  { id: "role_accountant", company_id: "comp_startup", category: "Finance", role_name: "Accountant", difficulty: "Medium", requirements: ["GAAP", "Reconciliation", "Tax Preparation"] },
  { id: "role_fin_mgr", company_id: "comp_google", category: "Finance", role_name: "Finance Manager", difficulty: "Hard", requirements: ["Corporate Finance", "Budgeting", "Team Management"] },
  { id: "role_bookkeeper", company_id: "comp_startup", category: "Finance", role_name: "Bookkeeper", difficulty: "Easy", requirements: ["QuickBooks", "Accounts Payable", "Accounts Receivable"] },
  { id: "role_payroll", company_id: "comp_amazon", category: "Finance", role_name: "Payroll Specialist", difficulty: "Medium", requirements: ["Payroll Processing", "Compliance", "Data Entry"] },

  // IT
  { id: "role_frontend_jr", company_id: "comp_startup", category: "IT", role_name: "Frontend Engineer", difficulty: "Easy", requirements: ["HTML/CSS/JS", "React", "State Management", "Responsive Design"] },
  { id: "role_backend_sr", company_id: "comp_amazon", category: "IT", role_name: "Backend Engineer", difficulty: "Hard", requirements: ["Python/Go", "Distributed Systems", "SQL/NoSQL", "System Design"] },
  { id: "role_devops", company_id: "comp_google", category: "IT", role_name: "DevOps Engineer", difficulty: "Medium", requirements: ["AWS/GCP", "CI/CD", "Docker/Kubernetes", "Infrastructure as Code"] },
  { id: "role_qa_eng", company_id: "comp_startup", category: "IT", role_name: "QA Engineer", difficulty: "Medium", requirements: ["Testing", "Automation", "Selenium", "Bug Tracking"] },
  { id: "role_data_sci", company_id: "comp_meta", category: "IT", role_name: "Data Scientist", difficulty: "Hard", requirements: ["Python", "Machine Learning", "SQL", "Statistics"] },

  // Sales
  { id: "role_ae", company_id: "comp_startup", category: "Sales", role_name: "Account Executive", difficulty: "Medium", requirements: ["B2B Sales", "Closing", "CRM", "Pipeline Management"] },
  { id: "role_sdr", company_id: "comp_amazon", category: "Sales", role_name: "Sales Development Rep", difficulty: "Easy", requirements: ["Cold Calling", "Lead Generation", "Email Outreach"] },
  { id: "role_sales_mgr", company_id: "comp_meta", category: "Sales", role_name: "Sales Manager", difficulty: "Hard", requirements: ["Sales Strategy", "Quota Attainment", "Team Leadership"] },
  { id: "role_csm", company_id: "comp_google", category: "Sales", role_name: "Customer Success Manager", difficulty: "Medium", requirements: ["Onboarding", "Retention", "Relationship Management"] },
  { id: "role_acct_mgr", company_id: "comp_amazon", category: "Sales", role_name: "Account Manager", difficulty: "Medium", requirements: ["Upselling", "Client Relations", "Account Planning"] }
];

export default function InterviewSetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [roles, setRoles] = useState<any[]>(DEFAULT_ROLES);

  const [selectedCategory, setSelectedCategory] = useState("Admin");
  const [selectedRole, setSelectedRole] = useState("role_admin_asst");
  const [difficulty, setDifficulty] = useState("Medium");
  const [duration, setDuration] = useState(15);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [alignmentError, setAlignmentError] = useState("");

  // Optional resume upload — enables resume-aware questions
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeProfile, setResumeProfile] = useState<any>(null);
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeError, setResumeError] = useState("");

  const resolveUserId = () =>
    user?.user_id ||
    (typeof window !== "undefined" ? localStorage.getItem("preppr_user_id") : null) ||
    "user_101";

  const handleResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so re-selecting the same file still fires onChange
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setResumeError("Please choose a PDF resume.");
      return;
    }

    setResumeError("");
    setResumeFileName(file.name);
    setResumeUploading(true);
    try {
      const profile = await uploadPdfResume(file, resolveUserId());
      setResumeProfile(profile);
    } catch (err: any) {
      setResumeProfile(null);
      setResumeFileName("");
      setResumeError(err?.message || "Couldn't read that resume. You can still start the interview.");
    } finally {
      setResumeUploading(false);
    }
  };

  useEffect(() => {
    async function loadOptions() {
      try {
        const rls = await getRoles();
        if (rls && Array.isArray(rls) && rls.length > 0) {
          setRoles(rls);
          const cats = Array.from(new Set(rls.map((r: any) => r.category || "IT")));
          if (cats.length > 0 && !cats.includes(selectedCategory)) {
            setSelectedCategory(cats[0] as string);
            const firstRole = rls.find((r: any) => (r.category || "IT") === cats[0]);
            if (firstRole) {
              setSelectedRole(firstRole.id);
            }
          }
        }
      } catch (err) {
        console.warn("Using seeded default roles:", err);
      }
    }
    loadOptions();
  }, []);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAlignmentError("");

    const userId = resolveUserId();
    const roleObj = roles.find((r) => r.id === selectedRole);

    try {
      // 1. Fetch existing account profile if available (optional for personalized questions)
      let uploadData = null;
      try {
        const { getCandidateProfile } = await import("@/lib/api");
        uploadData = await getCandidateProfile(userId);
      } catch (err: any) {
        console.info("No saved resume profile found; proceeding with general role rubric.");
      }

      // 2. Role alignment check (advisory only, never blocks interview practice)
      if (uploadData && roleObj) {
        const profileSkills = (uploadData.skills || []).map((s: string) => s.toLowerCase());
        let profileRoles: string[] = [];
        if (uploadData.past_roles) {
          profileRoles = (uploadData.past_roles || []).map((r: string) => (typeof r === 'string' ? r.toLowerCase() : JSON.stringify(r).toLowerCase()));
        } else if (uploadData.experience) {
          profileRoles = (uploadData.experience || []).map((r: any) => (r.role ? r.role.toLowerCase() : JSON.stringify(r).toLowerCase()));
        }
        
        const allProfileText = [...profileSkills, ...profileRoles].join(" ");
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
          setAlignmentError(`Notice: Your resume doesn't specifically mention ${roleObj.role_name} skills, so questions will emphasize core domain skills.`);
        }
      }

      // 3. Start interview session with resilient fallback
      let sessionId = `sess_${Date.now()}`;
      try {
        const res = await createInterviewSession({
          user_id: userId,
          company_name: "Mock Interview AI",
          role_name: roleObj ? roleObj.role_name : selectedRole,
          difficulty: difficulty,
          duration: duration,
          role_category: roleObj ? roleObj.category : selectedCategory,
        });
        if (res && res.session_id) {
          sessionId = res.session_id;
        }
      } catch (sessionErr: any) {
        console.warn("Backend session initialization note, proceeding to interview room:", sessionErr);
      }

      router.push(`/interview/${sessionId}`);
    } catch (err: any) {
      setError(err.message || "Failed to start interview session.");
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
                <option key={cat} value={cat} className="bg-gray-900 text-white py-1">{cat}</option>
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
                <option key={role.id} value={role.id} className="bg-gray-900 text-white py-1">
                  {role.role_name}
                </option>
              ))}
            </select>
          </div>
        </div>



        {/* Resume Upload — enables resume-aware questions (optional) */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-400" /> Resume
            <span className="normal-case font-normal tracking-normal text-gray-500">(optional — personalizes your questions)</span>
          </label>

          {resumeProfile ? (
            <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-start gap-3 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    Resume ready{resumeProfile.candidate_name ? ` — ${resumeProfile.candidate_name}` : ""}
                  </div>
                  <div className="text-xs text-emerald-200/80 mt-0.5">
                    {Array.isArray(resumeProfile.skills) && resumeProfile.skills.length > 0
                      ? `${resumeProfile.skills.length} skills detected · `
                      : ""}
                    Questions will be tailored to your background.
                  </div>
                </div>
              </div>
              <label className="text-xs text-emerald-200 hover:text-white underline cursor-pointer flex-shrink-0">
                Replace
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleResumeChange}
                  disabled={resumeUploading}
                />
              </label>
            </div>
          ) : (
            <label
              className={`flex items-center justify-center gap-3 p-4 rounded-xl border border-dashed transition-all ${
                resumeUploading
                  ? "border-brand-500/50 bg-brand-500/5 cursor-wait"
                  : "border-white/15 bg-dark-800/60 hover:border-brand-500/50 hover:bg-white/5 cursor-pointer"
              }`}
            >
              {resumeUploading ? (
                <>
                  <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                  <span className="text-sm text-gray-300">
                    Analyzing {resumeFileName || "your resume"}...
                  </span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-brand-400" />
                  <span className="text-sm text-gray-300">Upload a PDF resume for resume-aware questions</span>
                </>
              )}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleResumeChange}
                disabled={resumeUploading}
              />
            </label>
          )}

          {resumeError && <p className="text-xs text-red-400 mt-2">{resumeError}</p>}
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
