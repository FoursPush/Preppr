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
  { id: "entry", label: "Entry Level", desc: "0-1 yrs" },
  { id: "mid", label: "Mid-Level", desc: "2-4 yrs" },
  { id: "senior", label: "Senior", desc: "5-8 yrs" },
  { id: "staff", label: "Staff / Lead", desc: "8+ yrs" },
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
          },
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
    <div className="min-h-screen bg-nvg-off-black text-nvg-off-white font-body pt-32 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex items-center justify-center">
      {/* Background glow accents */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-nvg-lime/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-nvg-purple/10 rounded-full blur-3xl pointer-events-none" />

      {/* SUCCESS POPUP MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md p-8 rounded-squircle bg-nvg-surface border border-nvg-lime/40 shadow-neo-lime text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-full bg-nvg-lime !text-black flex items-center justify-center mx-auto mb-5 shadow-lg">
              <Check className="w-8 h-8 stroke-[3] text-black" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nvg-lime !text-black text-xs font-heading font-extrabold mb-3 shadow-neo-lime">
              <Sparkles className="w-3.5 h-3.5 text-black" />
              <span>PostgreSQL Account Initialized</span>
            </div>

            <h3 className="text-2xl font-heading font-extrabold text-white tracking-tight">
              Registration Successful!
            </h3>

            <p className="text-xs text-gray-300 mt-2 leading-relaxed">
              Your candidate profile for <span className="text-white font-bold">{name || "Candidate"}</span> ({registeredEmail}) has been securely saved.
            </p>

            <div className="p-4 rounded-2xl bg-nvg-off-black/60 border border-white/10 mt-5 text-xs text-gray-400 text-left">
              <p className="flex items-center gap-2 text-nvg-orange font-heading font-bold mb-1">
                <CheckCircle2 className="w-4 h-4 text-nvg-orange" /> Sign In to Proceed
              </p>
              <p className="text-[11px] text-gray-400 font-body">
                Log in to calibrate mock interview parameters and stream live voice turns.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={proceedToLogin}
                className="w-full py-4 rounded-full bg-nvg-lime hover:brightness-105 !text-black font-heading font-extrabold text-sm shadow-neo-lime transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4 text-black" />
                <span className="text-black font-extrabold">Sign In Now</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-heading">
                <span className="w-2 h-2 rounded-full bg-nvg-orange animate-ping" />
                <span>Redirecting in <strong className="text-nvg-orange">{countdown}s</strong>...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
        {/* Left Feature Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6 pt-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nvg-lime !text-black text-xs font-heading font-extrabold uppercase tracking-wider mb-4 shadow-neo-lime">
              <Sparkles className="w-3.5 h-3.5 text-black" />
              <span>Fast Track Onboarding</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-heading font-extrabold text-white tracking-tight leading-tight">
              Master the <span className="text-nvg-orange">interview</span> craft.
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-3 font-body leading-relaxed">
              Experience real-time interactive voice mock interviews with live acoustic and behavioral feedback calibrated to FAANG and high-growth benchmarks.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="squircle-card p-4 bg-nvg-surface/70 border border-white/5 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-nvg-lime !text-black flex items-center justify-center font-extrabold text-xs shrink-0 mt-0.5">
                ⚡
              </div>
              <div>
                <h3 className="text-xs font-heading font-bold text-white">Sub-300ms Conversational AI</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Real-time voice agent with natural interruptions and contextual follow-ups.</p>
              </div>
            </div>

            <div className="squircle-card p-4 bg-nvg-surface/70 border border-white/5 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-nvg-purple text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ✦
              </div>
              <div>
                <h3 className="text-xs font-heading font-bold text-white">6-Pillar Evaluation Rubric</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Granular scoring across technical depth, STAR structure, pace, fillers, and clarity.</p>
              </div>
            </div>

            <div className="squircle-card p-4 bg-nvg-surface/70 border border-white/5 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-nvg-orange text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                🎯
              </div>
              <div>
                <h3 className="text-xs font-heading font-bold text-white">ATS & Persona Alignment</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Upload your resume to generate hyper-realistic personalized behavioral inquiries.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Card (7 cols) */}
        <div className="lg:col-span-7">
          <div className="squircle-card p-6 sm:p-8 bg-nvg-surface/90 border border-white/10 backdrop-blur-2xl shadow-2xl relative">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-heading font-extrabold text-white">Create Candidate Profile</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-body">Set up your credentials and target companies</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-nvg-lime !text-black flex items-center justify-center font-heading font-extrabold text-sm">
                ✦
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span>{error}</span>
              </div>
            )}

            {/* Social OAuth Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => handleOAuthSignUp("google")}
                disabled={loading || oauthLoading !== null}
                className="py-3 px-3.5 rounded-full bg-nvg-off-black border border-white/15 hover:border-white/30 text-white font-heading font-bold text-xs transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
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

              <button
                type="button"
                onClick={() => handleOAuthSignUp("github")}
                disabled={loading || oauthLoading !== null}
                className="py-3 px-3.5 rounded-full bg-nvg-off-black border border-white/15 hover:border-white/30 text-white font-heading font-bold text-xs transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                {oauthLoading === "github" ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Github className="w-4 h-4 text-white" />
                )}
                <span>Sign up with GitHub</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center mb-5">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-nvg-surface px-3 text-[10px] text-gray-500 uppercase tracking-widest font-heading font-bold">
                Or with details
              </span>
              <div className="border-t border-white/10 w-full" />
            </div>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-heading font-bold text-gray-300 mb-1 uppercase tracking-wider">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-nvg-off-black border border-white/10 rounded-2xl py-2.5 pl-10 pr-3 text-white placeholder-gray-500 focus:outline-none focus:border-nvg-lime text-xs transition-colors"
                      placeholder="e.g. Maya Patel"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-heading font-bold text-gray-300 mb-1 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-nvg-off-black border border-white/10 rounded-2xl py-2.5 pl-10 pr-3 text-white placeholder-gray-500 focus:outline-none focus:border-nvg-lime text-xs transition-colors"
                      placeholder="candidate@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-heading font-bold text-gray-300 uppercase tracking-wider">
                    Password
                  </label>
                  {password.length > 0 && (
                    <span className="text-[10px] font-heading font-bold text-gray-400">
                      Strength:{" "}
                      <span
                        className={
                          passStrength <= 2
                            ? "text-red-400"
                            : passStrength <= 3
                            ? "text-nvg-yellow"
                            : "text-nvg-lime"
                        }
                      >
                        {passStrength <= 2 ? "Weak" : passStrength <= 3 ? "Medium" : "Strong"}
                      </span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-nvg-off-black border border-white/10 rounded-2xl py-2.5 pl-10 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-nvg-lime text-xs transition-colors"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Target Role */}
              <div>
                <label className="block text-xs font-heading font-bold text-gray-300 mb-1 uppercase tracking-wider">
                  Target Role Track
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full bg-nvg-off-black border border-white/10 rounded-2xl py-2.5 pl-10 pr-8 text-white focus:outline-none focus:border-nvg-lime text-xs appearance-none transition-colors"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r} className="bg-nvg-off-black text-white">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Experience Level */}
              <div>
                <label className="block text-xs font-heading font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                  Seniority Level
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {EXPERIENCE_LEVELS.map((tier) => {
                    const isSelected = experienceLevel === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setExperienceLevel(tier.id)}
                        className={`p-2.5 rounded-2xl text-left border transition-all ${
                          isSelected
                            ? "bg-nvg-lime/20 border-nvg-lime text-white"
                            : "bg-nvg-off-black/60 border-white/5 text-gray-400 hover:text-white"
                        }`}
                      >
                        <div className="text-xs font-heading font-bold">{tier.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{tier.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Companies */}
              <div>
                <label className="block text-xs font-heading font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                  Target Companies
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TARGET_COMPANIES_LIST.map((comp) => {
                    const active = selectedCompanies.includes(comp);
                    return (
                      <button
                        key={comp}
                        type="button"
                        onClick={() => toggleCompany(comp)}
                        className={`text-xs px-3 py-1 rounded-full border transition-all font-heading font-bold ${
                          active
                            ? "bg-nvg-purple text-white border-nvg-purple"
                            : "bg-nvg-off-black/60 border-white/10 text-gray-400 hover:text-white"
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
                  className="rounded bg-nvg-off-black border-white/20 text-nvg-lime focus:ring-nvg-lime w-4 h-4 cursor-pointer"
                />
                <label htmlFor="terms" className="text-xs text-gray-400 cursor-pointer">
                  I agree to Preppr&apos;s Terms of Service and Privacy Policy.
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || oauthLoading !== null}
                className="w-full py-4 rounded-full bg-nvg-lime hover:brightness-105 !text-black font-heading font-extrabold text-sm shadow-neo-lime transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="text-black font-extrabold">Create Account</span>
                    <ArrowRight className="w-4 h-4 text-black" />
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
                  className="font-heading font-bold text-nvg-orange hover:underline transition-colors"
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
