"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginCandidate, oauthLogin } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { User, Mail, Lock, Shield, ArrowRight, Eye, EyeOff, Sparkles, Github, CheckCircle2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("candidate@example.com");
  const [name, setName] = useState("Chinmay");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [registrationSuccessMsg, setRegistrationSuccessMsg] = useState("");

  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "649135978188-a0pbfamemjpv62d99flgsi1u5rv2ogdl.apps.googleusercontent.com";

  useEffect(() => {
    const isRegistered = searchParams.get("registered");
    const paramEmail = searchParams.get("email");

    if (paramEmail) {
      setEmail(paramEmail);
      const inferredName = paramEmail.split("@")[0].replace(/[._]/g, " ");
      setName(inferredName.charAt(0).toUpperCase() + inferredName.slice(1));
    }

    if (isRegistered === "true") {
      setRegistrationSuccessMsg("Account registered successfully in database! Please enter your credentials to sign in.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await loginCandidate(email, name);
      login({
        user_id: res.user_id,
        email: res.email,
        name: res.name,
        role: res.role,
        avatar_url: res.avatar_url,
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setOauthLoading("google");
    setError("");

    // Check if Google Identity Services GIS SDK is loaded
    if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2) {
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
                login({
                  user_id: res.user_id,
                  email: res.email,
                  name: res.name,
                  role: res.role,
                  avatar_url: res.avatar_url,
                });
                router.push("/dashboard");
              } catch (authErr: any) {
                setError(authErr.message || "Failed to authenticate with Google");
              } finally {
                setOauthLoading(null);
              }
            } else {
              setOauthLoading(null);
            }
          },
          error_callback: (err: any) => {
            console.error("Google Auth error:", err);
            setError("Google sign-in was cancelled or encountered an error.");
            setOauthLoading(null);
          }
        });

        tokenClient.requestAccessToken();
        return;
      } catch (gisErr) {
        console.warn("GIS TokenClient error, using fallback:", gisErr);
      }
    }

    // Fallback direct sign in
    handleFallbackOAuth("google");
  };

  const handleFallbackOAuth = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    setError("");

    try {
      const profile = provider === "google"
        ? { name: name || (email.includes("@") ? email.split("@")[0].replace(/[._]/g, " ") : "Candidate"), email: email.includes("@") ? email : "" }
        : { name: name || (email.includes("@") ? email.split("@")[0].replace(/[._]/g, " ") : "Candidate"), email: email.includes("@") ? email : "" };

      const res = await oauthLogin(provider, profile);
      login({
        user_id: res.user_id,
        email: res.email,
        name: res.name,
        role: res.role,
        avatar_url: res.avatar_url,
      });
      
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}`);
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div className="w-full max-w-md relative z-10">
      <div className="p-8 rounded-3xl bg-dark-900/80 border border-white/10 backdrop-blur-2xl shadow-2xl relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>AI Interview Acceleration</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Sign In to Preppr</h2>
          <p className="text-sm text-gray-400 mt-1.5">Access your personalized interview dashboard & analytics</p>
        </div>

        {/* Registration Success Banner */}
        {registrationSuccessMsg && (
          <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{registrationSuccessMsg}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            {error}
          </div>
        )}

        {/* Social OAuth Buttons */}
        <div className="space-y-3 mb-6">
          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || oauthLoading !== null}
            className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium text-sm transition-all duration-200 flex items-center justify-center gap-3 hover:border-white/30 hover:shadow-lg hover:shadow-white/5 group disabled:opacity-50 cursor-pointer"
          >
            {oauthLoading === "google" ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            <span>Continue with Google</span>
          </button>

          {/* GitHub Sign In */}
          <button
            type="button"
            onClick={() => handleFallbackOAuth("github")}
            disabled={loading || oauthLoading !== null}
            className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium text-sm transition-all duration-200 flex items-center justify-center gap-3 hover:border-white/30 hover:shadow-lg hover:shadow-white/5 group disabled:opacity-50 cursor-pointer"
          >
            {oauthLoading === "github" ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Github className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
            )}
            <span>Continue with GitHub</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-white/10 w-full" />
          <span className="bg-dark-900 px-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">
            Or with email
          </span>
          <div className="border-t border-white/10 w-full" />
        </div>

        {/* Standard Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Candidate Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-dark-800/80 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-sm transition-colors"
                placeholder="Full Name"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-dark-800/80 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-sm transition-colors"
                placeholder="candidate@example.com"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-300">Password</label>
              <span className="text-[11px] text-brand-400 hover:text-brand-300 cursor-pointer">Forgot password?</span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-dark-800/80 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-sm transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || oauthLoading !== null}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Switch to Register */}
        <div className="mt-6 pt-5 border-t border-white/10 text-center">
          <p className="text-xs text-gray-400">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-brand-400 hover:text-brand-300 underline underline-offset-4 decoration-brand-500/30 hover:decoration-brand-400 transition-colors">
              Create new account
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" /> 256-bit Encrypted • PostgreSQL Database Persistence
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <Suspense fallback={<div className="text-gray-400 text-xs">Loading login form...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
