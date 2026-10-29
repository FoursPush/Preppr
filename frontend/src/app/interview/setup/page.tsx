"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCompanies, getRoles, createInterviewSession, uploadPdfResume } from "@/lib/api";
import {
  Sparkles,
  Building2,
  Briefcase,
  Gauge,
  Clock,
  ArrowRight,
  FileText,
  Upload,
  CheckCircle2,
  Loader2,
  Zap,
  Target,
  ChevronRight,
  Sliders,
  ShieldAlert,
  Mic,
  Code2,
  ShieldCheck,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";

interface CompanyPreset {
  id: string;
  name: string;
  tagline: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  iconChar: string;
}

const FEATURED_COMPANIES: CompanyPreset[] = [
  { id: "comp_google", name: "Google", tagline: "Googleyness & System Scale", color: "#BADDFD", badgeBg: "bg-nvg-light-blue", badgeText: "text-nvg-off-black", iconChar: "G" },
  { id: "comp_amazon", name: "Amazon", tagline: "16 Leadership Principles", color: "#FFC412", badgeBg: "bg-nvg-yellow", badgeText: "text-nvg-off-black", iconChar: "A" },
  { id: "comp_meta", name: "Meta", tagline: "Move Fast & Architecture", color: "#7A78FF", badgeBg: "bg-nvg-purple", badgeText: "text-white", iconChar: "M" },
  { id: "comp_startup", name: "Unicorn Startup", tagline: "Fullstack Velocity & Grit", color: "#C7FF6A", badgeBg: "bg-nvg-lime", badgeText: "text-nvg-off-black", iconChar: "✦" },
];

const DEFAULT_ROLES = [
  // Engineering / IT
  { id: "role_frontend_jr", company_id: "comp_startup", category: "IT", role_name: "Frontend Engineer", difficulty: "Easy", requirements: ["HTML/CSS/JS", "React", "State Management", "Responsive Design"] },
  { id: "role_backend_sr", company_id: "comp_amazon", category: "IT", role_name: "Backend Engineer", difficulty: "Hard", requirements: ["Python/Go", "Distributed Systems", "SQL/NoSQL", "System Design"] },
  { id: "role_devops", company_id: "comp_google", category: "IT", role_name: "DevOps Engineer", difficulty: "Medium", requirements: ["AWS/GCP", "CI/CD", "Docker/Kubernetes", "Infrastructure as Code"] },
  { id: "role_data_sci", company_id: "comp_meta", category: "IT", role_name: "Data Scientist / AI", difficulty: "Hard", requirements: ["Python", "Machine Learning", "SQL", "Statistics"] },
  { id: "role_qa_eng", company_id: "comp_startup", category: "IT", role_name: "QA Automation Engineer", difficulty: "Medium", requirements: ["Testing", "Automation", "Selenium", "Bug Tracking"] },

  // Admin
  { id: "role_admin_asst", company_id: "comp_startup", category: "Admin", role_name: "Administrative Assistant", difficulty: "Medium", requirements: ["Scheduling", "Communication", "Office Management"] },
  { id: "role_office_mgr", company_id: "comp_startup", category: "Admin", role_name: "Office Manager", difficulty: "Medium", requirements: ["Vendor Management", "Budgeting", "Operations"] },
  { id: "role_exec_asst", company_id: "comp_startup", category: "Admin", role_name: "Executive Assistant", difficulty: "Hard", requirements: ["Stakeholder Management", "Confidentiality", "Prioritization"] },
  { id: "role_receptionist", company_id: "comp_startup", category: "Admin", role_name: "Receptionist", difficulty: "Easy", requirements: ["Customer Service", "Phone Skills", "Greeting"] },
  { id: "role_data_entry", company_id: "comp_amazon", category: "Admin", role_name: "Data Entry Clerk", difficulty: "Easy", requirements: ["Typing", "Accuracy", "Data Management"] },

  // HR
  { id: "role_hr_gen", company_id: "comp_startup", category: "HR", role_name: "HR Generalist", difficulty: "Medium", requirements: ["Employee Relations", "Onboarding", "Compliance"] },
  { id: "role_recruiter", company_id: "comp_amazon", category: "HR", role_name: "Talent Recruiter", difficulty: "Medium", requirements: ["Sourcing", "Interviewing", "Negotiation"] },
  { id: "role_hr_mgr", company_id: "comp_meta", category: "HR", role_name: "HR Director", difficulty: "Hard", requirements: ["Strategic HR", "Performance Management", "Leadership"] },
  { id: "role_hr_coord", company_id: "comp_startup", category: "HR", role_name: "HR Coordinator", difficulty: "Easy", requirements: ["Scheduling", "Documentation", "HRIS"] },
  { id: "role_comp_analyst", company_id: "comp_google", category: "HR", role_name: "Compensation Analyst", difficulty: "Medium", requirements: ["Data Analysis", "Market Research", "Excel"] },

  // Finance
  { id: "role_fin_analyst", company_id: "comp_amazon", category: "Finance", role_name: "Financial Analyst", difficulty: "Medium", requirements: ["Financial Modeling", "Excel", "Forecasting"] },
  { id: "role_accountant", company_id: "comp_startup", category: "Finance", role_name: "Accountant", difficulty: "Medium", requirements: ["GAAP", "Reconciliation", "Tax Preparation"] },
  { id: "role_fin_mgr", company_id: "comp_google", category: "Finance", role_name: "Finance Manager", difficulty: "Hard", requirements: ["Corporate Finance", "Budgeting", "Team Management"] },
  { id: "role_bookkeeper", company_id: "comp_startup", category: "Finance", role_name: "Bookkeeper", difficulty: "Easy", requirements: ["QuickBooks", "Accounts Payable", "Accounts Receivable"] },
  { id: "role_payroll", company_id: "comp_amazon", category: "Finance", role_name: "Payroll Specialist", difficulty: "Medium", requirements: ["Payroll Processing", "Compliance", "Data Entry"] },

  // Sales
  { id: "role_ae", company_id: "comp_startup", category: "Sales", role_name: "Account Executive", difficulty: "Medium", requirements: ["B2B Sales", "Closing", "CRM", "Pipeline Management"] },
  { id: "role_sdr", company_id: "comp_amazon", category: "Sales", role_name: "Sales Development Rep", difficulty: "Easy", requirements: ["Cold Calling", "Lead Generation", "Email Outreach"] },
  { id: "role_sales_mgr", company_id: "comp_meta", category: "Sales", role_name: "Sales Manager", difficulty: "Hard", requirements: ["Sales Strategy", "Quota Attainment", "Team Leadership"] },
  { id: "role_csm", company_id: "comp_google", category: "Sales", role_name: "Customer Success Manager", difficulty: "Medium", requirements: ["Onboarding", "Retention", "Relationship Management"] },
  { id: "role_acct_mgr", company_id: "comp_amazon", category: "Sales", role_name: "Account Manager", difficulty: "Medium", requirements: ["Upselling", "Client Relations", "Account Planning"] },
];

const ROTATING_SETUP_TERMS = [
  { text: "interview.", badge: "bg-nvg-lime !text-black" },
  { text: "coding round.", badge: "bg-nvg-orange text-white" },
  { text: "system design.", badge: "bg-nvg-purple text-white" },
  { text: "dream offer.", badge: "bg-nvg-yellow !text-black" },
];

export default function InterviewSetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [roles, setRoles] = useState<any[]>(DEFAULT_ROLES);

  const [selectedCompany, setSelectedCompany] = useState<string>("comp_google");
  const [selectedCategory, setSelectedCategory] = useState("IT");
  const [selectedRole, setSelectedRole] = useState("role_backend_sr");
  const [difficulty, setDifficulty] = useState("Medium");
  const [duration, setDuration] = useState(15);

  const [setupWordIdx, setSetupWordIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSetupWordIdx((prev) => (prev + 1) % ROTATING_SETUP_TERMS.length);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

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
    e.target.value = "";
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
            if (firstRole) setSelectedRole(firstRole.id);
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
    const companyObj = FEATURED_COMPANIES.find((c) => c.id === selectedCompany);

    try {
      // 1. Fetch existing account profile if available (optional for personalized questions)
      let uploadData = null;
      try {
        const { getCandidateProfile } = await import("@/lib/api");
        uploadData = await getCandidateProfile(userId);
      } catch (err: any) {
        console.info("No saved resume profile found; proceeding with general role rubric.");
      }

      // 2. Role alignment check
      if (uploadData && roleObj) {
        const profileSkills = (uploadData.skills || []).map((s: string) => s.toLowerCase());
        let profileRoles: string[] = [];
        if (uploadData.past_roles) {
          profileRoles = (uploadData.past_roles || []).map((r: string) =>
            typeof r === "string" ? r.toLowerCase() : JSON.stringify(r).toLowerCase()
          );
        } else if (uploadData.experience) {
          profileRoles = (uploadData.experience || []).map((r: any) =>
            r.role ? r.role.toLowerCase() : JSON.stringify(r).toLowerCase()
          );
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
          setAlignmentError(
            `Notice: Your resume doesn't specifically mention ${roleObj.role_name} skills, so questions will emphasize core domain fundamentals.`
          );
        }
      }

      // 3. Start interview session with resilient fallback
      let sessionId = `sess_${Date.now()}`;
      try {
        const res = await createInterviewSession({
          user_id: userId,
          company_name: companyObj?.name || "Mock Interview AI",
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
  const activeRoleObj = roles.find((r) => r.id === selectedRole);

  return (
    <ProtectedRoute
      title="Launch Mock Interview"
      description="Sign in to customize your target company rubric, calibrate interview difficulty, and start practicing with the AI agent."
    >
      <div className="min-h-screen bg-nvg-off-black text-nvg-off-white font-body pt-32 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Enhanced Header Banner */}
          <div className="squircle-card p-8 sm:p-12 bg-nvg-surface/90 border border-white/10 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-nvg-purple/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-nvg-orange/15 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-nvg-lime !text-black text-xs font-heading font-extrabold uppercase tracking-wider shadow-neo-lime">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                <span>AI Mock Interview Studio</span>
              </div>

              <h1 className="text-4xl sm:text-6xl md:text-7xl font-heading font-extrabold tracking-tight text-white leading-[1.08]">
                Calibrate your next{" "}
                <span
                  key={setupWordIdx}
                  className={`inline-block animate-slide-up-word px-3.5 sm:px-4 py-0.5 sm:py-1 rounded-2xl ${ROTATING_SETUP_TERMS[setupWordIdx].badge} font-extrabold shadow-neo-sm align-middle mx-1`}
                >
                  {ROTATING_SETUP_TERMS[setupWordIdx].text}
                </span>
              </h1>

              <p className="text-base sm:text-lg text-gray-300 max-w-2xl font-body leading-relaxed">
                Configure your domain track, personalize with your resume, and simulate high-pressure technical & architectural interviews with real-time biometric telemetry.
              </p>

              {/* Feature Highlights Pills */}
              <div className="pt-2 flex flex-wrap items-center gap-2.5 text-xs font-heading font-bold">
                <span className="px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-nvg-orange" /> Sub-350ms Audio Telemetry
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-nvg-green" /> LeetCode Python Sandbox
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-nvg-purple" /> 100% On-Device Privacy
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {alignmentError && (
            <div className="p-4 rounded-2xl bg-nvg-yellow/15 border border-nvg-yellow/30 text-nvg-yellow text-sm flex justify-between items-center">
              <span>{alignmentError}</span>
              <button
                type="button"
                onClick={() => setAlignmentError("")}
                className="text-xs text-white underline hover:no-underline ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          <form onSubmit={handleStart} className="space-y-8">
            {/* Step 1: Domain Track & Target Role (Step 1 removed, this is the primary selector) */}
            <div className="squircle-card p-8 sm:p-10 bg-nvg-surface/80 border border-white/10 space-y-7 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2 text-xs font-heading font-extrabold text-nvg-purple uppercase tracking-wider">
                    <Briefcase className="w-4 h-4 text-nvg-purple" /> Step 1: Domain Track & Target Role
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-white mt-1.5">
                    What position are you simulating?
                  </h3>
                </div>
                <span className="text-xs text-gray-400 font-medium self-start sm:self-auto">
                  {filteredRoles.length} roles available in this track
                </span>
              </div>

              {/* Category Track Pills (Larger & Prominent) */}
              <div>
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-gray-400 block mb-3">
                  Select Domain Track:
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {categories.map((cat) => {
                    const isCatSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat);
                          const firstRole = roles.find((r) => (r.category || "IT") === cat);
                          if (firstRole) setSelectedRole(firstRole.id);
                        }}
                        className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-heading font-extrabold transition-all duration-200 cursor-pointer ${
                          isCatSelected
                            ? "bg-nvg-purple text-white shadow-neo-purple scale-105"
                            : "bg-nvg-off-black border border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5"
                        }`}
                      >
                        {cat} Track
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Roles Grid (Spacious, Large Titles, Clean Chips) */}
              <div>
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-gray-400 block mb-3">
                  Choose Specific Role:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRoles.map((role) => {
                    const isRoleSelected = selectedRole === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRole(role.id)}
                        className={`p-6 rounded-3xl border text-left transition-all duration-200 flex flex-col justify-between min-h-[140px] group cursor-pointer ${
                          isRoleSelected
                            ? "bg-nvg-purple/15 border-nvg-purple ring-2 ring-nvg-purple shadow-neo-purple"
                            : "bg-nvg-off-black/60 border-white/10 hover:border-white/25 hover:bg-white/5 hover:-translate-y-0.5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 w-full">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-heading font-extrabold text-lg sm:text-xl text-white group-hover:text-nvg-purple transition-colors">
                                {role.role_name}
                              </span>
                              {isRoleSelected && (
                                <CheckCircle2 className="w-5 h-5 text-nvg-purple shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1 font-body">
                              {role.description || "Comprehensive technical interview syllabus"}
                            </p>
                          </div>
                          <span
                            className={`text-xs uppercase font-heading font-extrabold px-3 py-1 rounded-full shrink-0 ${
                              role.difficulty === "Hard"
                                ? "bg-nvg-orange/20 text-nvg-orange border border-nvg-orange/30"
                                : role.difficulty === "Medium"
                                ? "bg-nvg-yellow/20 text-nvg-yellow border border-nvg-yellow/30"
                                : "bg-nvg-lime !text-black font-extrabold shadow-sm"
                            }`}
                          >
                            {role.difficulty}
                          </span>
                        </div>

                        {role.requirements && (
                          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/5">
                            {role.requirements.slice(0, 4).map((req: string, idx: number) => (
                              <span
                                key={idx}
                                className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 font-medium"
                              >
                                {req}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step 2: Resume Persona Ingestion (Spacious, Clear Dropzone) */}
            <div className="squircle-card p-8 sm:p-10 bg-nvg-surface/80 border border-white/10 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2 text-xs font-heading font-extrabold text-nvg-yellow uppercase tracking-wider">
                    <FileText className="w-4 h-4 text-nvg-yellow" /> Step 2: Candidate Resume (Optional)
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-white mt-1.5">
                    Personalize with your actual background
                  </h3>
                </div>
                <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 font-heading font-bold self-start sm:self-auto">
                  pgvector Semantic RAG
                </span>
              </div>

              {resumeProfile ? (
                <div className="p-6 sm:p-8 rounded-3xl bg-nvg-green/15 border border-nvg-green/40 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-nvg-green text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-heading font-extrabold text-white">
                          Resume Loaded{resumeProfile.candidate_name ? ` — ${resumeProfile.candidate_name}` : ""}
                        </div>
                        <div className="text-xs text-gray-300 mt-0.5">
                          Vector indexing ready · Questions will reflect your stack and achievements
                        </div>
                      </div>
                    </div>

                    <label className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-heading font-bold border border-white/20 transition-all cursor-pointer self-start sm:self-auto">
                      Replace PDF
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={handleResumeChange}
                        disabled={resumeUploading}
                      />
                    </label>
                  </div>

                  {Array.isArray(resumeProfile.skills) && resumeProfile.skills.length > 0 && (
                    <div className="pt-3 border-t border-white/10">
                      <span className="text-xs font-heading font-bold text-gray-400 block mb-2">
                        Detected Skills & Stack:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {resumeProfile.skills.slice(0, 10).map((skill: any, sIdx: number) => {
                          const label = typeof skill === "object" && skill !== null ? (skill.name || JSON.stringify(skill)) : String(skill);
                          return (
                            <span key={sIdx} className="px-3 py-1 rounded-xl bg-nvg-lime !text-black text-xs font-heading font-extrabold shadow-sm">
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <label
                  className={`flex flex-col items-center justify-center gap-4 p-10 sm:p-14 rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
                    resumeUploading
                      ? "border-nvg-yellow/50 bg-nvg-yellow/5 cursor-wait"
                      : "border-white/15 bg-nvg-off-black/50 hover:border-nvg-yellow/50 hover:bg-white/5"
                  }`}
                >
                  {resumeUploading ? (
                    <>
                      <Loader2 className="w-10 h-10 text-nvg-yellow animate-spin" />
                      <div className="text-center">
                        <span className="text-base font-heading font-bold text-white block">
                          Analyzing {resumeFileName || "your resume"}...
                        </span>
                        <span className="text-xs text-gray-400 mt-1 block">
                          Extracting skills and chunking semantic embeddings with PyMuPDF
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-3xl bg-nvg-yellow/15 border border-nvg-yellow/30 flex items-center justify-center text-nvg-yellow">
                        <Upload className="w-8 h-8 text-nvg-yellow" />
                      </div>
                      <div className="text-center space-y-1">
                        <span className="text-base sm:text-lg font-heading font-bold text-white block">
                          Drop your PDF resume here, or <span className="text-nvg-yellow underline">browse</span>
                        </span>
                        <span className="text-xs text-gray-400 block max-w-md">
                          Enables the AI interviewer to grill you on your real architecture decisions, previous roles, and tech stack.
                        </span>
                      </div>
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

            {/* Difficulty & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Difficulty */}
              <div className="squircle-card p-6 sm:p-8 bg-nvg-surface/80 border border-white/10 space-y-4">
                <label className="block text-xs font-heading font-extrabold text-nvg-yellow uppercase tracking-wider flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-nvg-yellow" /> Difficulty Calibration
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: "Easy", color: "bg-nvg-lime !text-black font-extrabold" },
                    { label: "Medium", color: "bg-nvg-yellow !text-black font-extrabold" },
                    { label: "Hard", color: "bg-nvg-orange text-white" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setDifficulty(item.label)}
                      className={`p-3.5 rounded-2xl font-heading font-extrabold text-xs sm:text-sm transition-all cursor-pointer ${
                        difficulty === item.label
                          ? `${item.color} shadow-lg scale-105`
                          : "bg-nvg-off-black border border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="squircle-card p-6 sm:p-8 bg-nvg-surface/80 border border-white/10 space-y-4">
                <label className="block text-xs font-heading font-extrabold text-nvg-light-blue uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-nvg-light-blue" /> Session Time Limit
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[15, 30, 45].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setDuration(dur)}
                      className={`p-3.5 rounded-2xl font-heading font-extrabold text-xs sm:text-sm transition-all cursor-pointer ${
                        duration === dur
                          ? "bg-nvg-light-blue text-nvg-off-black shadow-lg scale-105"
                          : "bg-nvg-off-black border border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      {dur} mins
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch CTA */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 sm:py-6 rounded-full bg-nvg-lime hover:brightness-105 !text-black font-heading font-extrabold text-xl shadow-neo-lime transition-all duration-200 flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-black" />
                    <span>Spinning up AI Interview Agent...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-6 h-6 text-black fill-black" />
                    <span>Launch AI Mock Interview</span>
                    <ArrowRight className="w-6 h-6 text-black" />
                  </>
                )}
              </button>
              <p className="text-center text-xs text-gray-500 mt-3 font-body">
                Real-time audio telemetry, speech analysis, and STAR rubric feedback will be activated automatically.
              </p>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
