"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerCandidate, oauthLogin } from "@/lib/api";
import {
  User,
  Mail,
  Lock,
  Briefcase,
  Layers,
  Building2,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Zap,
  Github,
  Award,
  Check,
  LogIn,
} from "lucide-react";

const ROLE_OPTIONS = [
  "Software Engineer (Fullstack)",
  "Backend & Distributed Systems Engineer",
  "Frontend & UI/UX Engineer",
  "AI / Machine Learning Engineer",
  "Product Manager",
  "DevOps & Cloud Infrastructure Engineer",
  "Data Scientist / Analytics Engineer",
  "Mobile Engineer (iOS / Android)",
];

const EXPERIENCE_LEVELS = [
  { id: "entry", label: "Entry Level / New Grad", desc: "0-1 yrs" },
  { id: "mid", label: "Mid-Level Engineer", desc: "2-4 yrs" },
  { id: "senior", label: "Senior Engineer", desc: "5-8 yrs" },
  { id: "staff", label: "Staff / Lead / Principal", desc: "8+ yrs" },
];

const TARGET_COMPANIES_LIST = [
  "Google",
  "Amazon",
  "Meta",
  "Microsoft",
  "Apple",
  "Netflix",
  "Stripe",
  "Uber",
  "OpenAI",
  "High-Growth Startups",
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [targetRole, setTargetRole] = useState(ROLE_OPTIONS[0]);
  const [experienceLevel, setExperienceLevel] = useState("mid");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(["Google", "Amazon"]);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Success Popup Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const [registeredEmail, setRegisteredEmail] = useState("");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showSuccessModal && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (showSuccessModal && countdown === 0) {
      router.push(`/login?registered=true&email=${encodeURIComponent(registeredEmail)}`);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showSuccessModal, countdown, registeredEmail, router]);

  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const passStrength = calculatePasswordStrength(password);

  const toggleCompany = (comp: string) => {
    if (selectedCompanies.includes(comp)) {
      setSelectedCompanies(selectedCompanies.filter((c) => c !== comp));
    } else {
      setSelectedCompanies([...selectedCompanies, comp]);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setError("Please accept the Terms of Service to create an account.");
      return;
    }
    if (password.length > 0 && password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const expObj = EXPERIENCE_LEVELS.find((l) => l.id === experienceLevel);
      await registerCandidate({
        name: name.trim(),
        email: email.trim(),
        password,
        targetRole,
        experienceLevel: expObj ? `${expObj.label} (${expObj.desc})` : experienceLevel,
        targetCompanies: selectedCompanies,
      });

      // DO NOT automatically sign in; trigger success popup modal
      setRegisteredEmail(email.trim());
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message || "Failed to register candidate");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignUp = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    setError("");

    const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "649135978188-a0pbfamemjpv62d99flgsi1u5rv2ogdl.apps.googleusercontent.com";

    if (provider === "google" && typeof window !== "undefined" && (window as any).google?.accounts?.oauth2) {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "email profile openid",
          callback: async (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              try {
                const res = await oauthLogin("google", {
                  accessToken: tokenResponse.access_token,
                });
                setRegisteredEmail(res.email);
                setShowSuccessModal(true);
              } catch (authErr: any) {
                setError(authErr.message || "Failed to register with Google");
              } finally {
                setOauthLoading(null);
              }
            } else {
              setOauthLoading(null);
            }
          },
          error_callback: (err: any) => {
            console.error("Google Auth error:", err);
            setError("Google sign-up was cancelled or encountered an error.");
            setOauthLoading(null);
          }
        });

        tokenClient.requestAccessToken();
        return;
      } catch (gisErr) {
        console.warn("GIS TokenClient error, using fallback:", gisErr);
      }
    }

    try {
      const targetEmail = email.includes("@") ? email.trim() : "";
      const profile = {
        name: name || (targetEmail.includes("@") ? targetEmail.split("@")[0].replace(/[._]/g, " ") : "Candidate"),
        email: targetEmail,
      };

      const res = await oauthLogin(provider, profile);

      setRegisteredEmail(res.email || targetEmail);
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message || `Failed to sign up with ${provider}`);
    } finally {
      setOauthLoading(null);
    }
  };

  const proceedToLogin = () => {
    router.push(`/login?registered=true&email=${encodeURIComponent(registeredEmail || email)}`);
  };

  return (
    <div className="min-h-[90vh] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex items-center justify-center">
      {/* Background glow accents */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* SUCCESS POPUP MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md p-8 rounded-3xl bg-dark-900 border border-emerald-500/40 shadow-2xl shadow-emerald-500/10 text-center relative overflow-hidden transform scale-100 transition-all">
            {/* Top decorative glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto mb-5 shadow-lg shadow-emerald-500/20 animate-bounce">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>PostgreSQL Record Created</span>
            </div>

            <h3 className="text-2xl font-extrabold text-white tracking-tight">Account Created Successfully!</h3>
            
            <p className="text-sm text-gray-300 mt-2.5 leading-relaxed">
              Your candidate account for <span className="text-white font-semibold">{name || "Candidate"}</span> ({registeredEmail}) has been registered in the database.
            </p>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 mt-5 text-xs text-gray-400 text-left">
              <p className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                <CheckCircle2 className="w-4 h-4" /> Next Step: Sign In
              </p>
              <p className="text-[11px] text-gray-400">
                Please enter your credentials on the login page to access your live interview dashboard and speech telemetry.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={proceedToLogin}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-brand-600 hover:from-emerald-500 hover:to-brand-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Proceed to Sign In Now</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Redirecting automatically in <strong className="text-emerald-400">{countdown}s</strong>...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
        
        {/* Left Hero & Feature Highlights (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6 pt-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>Get Started in Under 60 Seconds</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
              Level Up Your Interview Performance with <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-indigo-300 to-cyan-400">Preppr AI</span>
            </h1>
            <p className="text-sm text-gray-400 mt-3 leading-relaxed">
              Experience real-time interactive voice mock interviews with live acoustic and behavioral feedback tailored to FAANG & top tech standards.
            </p>
          </div>

          <div className="space-y-3.5 pt-2">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-start gap-3.5 hover:border-brand-500/30 transition-all">
              <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Sub-300ms Conversational AI</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Real-time voice agent with natural interruptions and contextual follow-ups.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-start gap-3.5 hover:border-cyan-500/30 transition-all">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Comprehensive 6-Pillar Scorecard</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Deep scoring across technical depth, STAR structure, pace, fillers, and clarity.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-start gap-3.5 hover:border-emerald-500/30 transition-all">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">ATS Resume & Job Alignment</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Upload your resume chunks to generate hyper-realistic personalized questions.</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-900/30 to-indigo-950/30 border border-brand-500/20">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-300">
              <CheckCircle2 className="w-4 h-4 text-brand-400" />
              <span>100% Free Candidate Access</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Includes instant PDF report downloads and full dashboard analytics.</p>
          </div>
        </div>

        {/* Right Registration Card (7 cols on lg) */}
        <div className="lg:col-span-7">
          <div className="p-7 sm:p-8 rounded-3xl bg-dark-900/85 border border-white/10 backdrop-blur-2xl shadow-2xl relative">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-bold text-white">Create Candidate Account</h2>
                <p className="text-xs text-gray-400 mt-0.5">Set up your candidate profile and target preferences</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                <User className="w-5 h-5" />
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {error}
              </div>
            )}

            {/* Social OAuth Sign Up */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {/* Google Button */}
              <button
                type="button"
                onClick={() => handleOAuthSignUp("google")}
                disabled={loading || oauthLoading !== null}
                className="py-2.5 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium text-xs transition-all duration-200 flex items-center justify-center gap-2.5 hover:border-white/30 group disabled:opacity-50"
              >
                {oauthLoading === "google" ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Sign up with Google</span>
              </button>

              {/* GitHub Button */}
              <button
                type="button"
                onClick={() => handleOAuthSignUp("github")}
                disabled={loading || oauthLoading !== null}
                className="py-2.5 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium text-xs transition-all duration-200 flex items-center justify-center gap-2.5 hover:border-white/30 group disabled:opacity-50"
              >
                {oauthLoading === "github" ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Github className="w-4 h-4 text-white group-hover:scale-110 transition-transform shrink-0" />
                )}
                <span>Sign up with GitHub</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center mb-5">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-dark-900 px-3 text-[11px] text-gray-500 uppercase tracking-wider font-semibold">
                Or with details
              </span>
              <div className="border-t border-white/10 w-full" />
            </div>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Name & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-dark-800/80 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-xs transition-colors"
                      placeholder="e.g. Soham Dave"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-dark-800/80 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-xs transition-colors"
                      placeholder="candidate@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-300">Create Password</label>
                  {password.length > 0 && (
                    <span className="text-[10px] font-medium text-gray-400">
                      Strength:{" "}
                      <span
                        className={
                          passStrength <= 2
                            ? "text-red-400 font-semibold"
                            : passStrength <= 3
                            ? "text-amber-400 font-semibold"
                            : "text-emerald-400 font-semibold"
                        }
                      >
                        {passStrength <= 2 ? "Weak" : passStrength <= 3 ? "Good" : "Strong"}
                      </span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-dark-800/80 border border-white/10 rounded-xl py-2 pl-9 pr-9 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-xs transition-colors"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {/* Password strength bar */}
                {password.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                    <div className={`h-1 rounded-full ${passStrength >= 1 ? "bg-red-500" : "bg-white/10"}`} />
                    <div className={`h-1 rounded-full ${passStrength >= 2 ? "bg-amber-500" : "bg-white/10"}`} />
                    <div className={`h-1 rounded-full ${passStrength >= 3 ? "bg-cyan-500" : "bg-white/10"}`} />
                    <div className={`h-1 rounded-full ${passStrength >= 4 ? "bg-emerald-500" : "bg-white/10"}`} />
                  </div>
                )}
              </div>

              {/* Target Role Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Target Role / Specialization</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full bg-dark-800/80 border border-white/10 rounded-xl py-2 pl-9 pr-8 text-white focus:outline-none focus:border-brand-500 text-xs appearance-none transition-colors"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r} className="bg-dark-900 text-white">
                        {r}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Experience Level Pills */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-brand-400" />
                  <span>Experience Level</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {EXPERIENCE_LEVELS.map((tier) => {
                    const isSelected = experienceLevel === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setExperienceLevel(tier.id)}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          isSelected
                            ? "bg-brand-500/20 border-brand-500/50 text-white shadow-sm shadow-brand-500/20"
                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                        }`}
                      >
                        <div className="text-[11px] font-bold leading-tight">{tier.label.split(" ")[0]}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{tier.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Companies (Chips) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Target Interview Companies</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TARGET_COMPANIES_LIST.map((comp) => {
                    const active = selectedCompanies.includes(comp);
                    return (
                      <button
                        key={comp}
                        type="button"
                        onClick={() => toggleCompany(comp)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                          active
                            ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-semibold"
                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-300"
                        }`}
                      >
                        {active && "✓ "}
                        {comp}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="rounded bg-dark-800 border-white/20 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5 cursor-pointer"
                />
                <label htmlFor="terms" className="text-[11px] text-gray-400 cursor-pointer">
                  I agree to Preppr&apos;s Terms of Service and Privacy Policy.
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || oauthLoading !== null}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Switch to Login */}
            <div className="mt-5 pt-4 border-t border-white/10 text-center">
              <p className="text-xs text-gray-400">
                Already registered?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-brand-400 hover:text-brand-300 underline underline-offset-4 decoration-brand-500/30 hover:decoration-brand-400 transition-colors"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
