"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Lock, ArrowRight, ShieldCheck, Sparkles, UserPlus } from "lucide-react";

export default function ProtectedRoute({
  children,
  title = "Authentication Required",
  description = "Please sign in or create an account to access this page.",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const { user, isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-xs text-gray-400 font-medium tracking-wide">Checking authentication session...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 relative">
        <div className="w-full max-w-md p-8 rounded-3xl bg-dark-900/80 border border-white/10 backdrop-blur-2xl shadow-2xl text-center relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-brand-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 mx-auto mb-5 shadow-lg shadow-brand-500/10">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight">{title}</h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed max-w-xs mx-auto">
            {description}
          </p>

          <div className="mt-8 space-y-3">
            <Link
              href="/login"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Sign In to Continue</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <Link
              href="/register"
              className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4 text-brand-400" />
              <span>Create New Candidate Account</span>
            </Link>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure LiveKit & PostgreSQL Session Auth</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
