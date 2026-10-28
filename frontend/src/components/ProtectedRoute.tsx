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
      <div className="min-h-[70vh] bg-nvg-off-black flex items-center justify-center font-body">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-nvg-lime/30 border-t-nvg-lime rounded-full animate-spin" />
          <p className="text-xs text-gray-400 font-medium tracking-wide">Validating authentication session...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-[80vh] bg-nvg-off-black flex items-center justify-center px-4 py-16 relative font-body">
        <div className="w-full max-w-md squircle-card p-8 sm:p-10 bg-nvg-surface border border-white/10 backdrop-blur-2xl shadow-2xl text-center relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-nvg-lime/15 rounded-full blur-2xl pointer-events-none" />

          <div className="w-16 h-16 rounded-full bg-nvg-lime !text-black flex items-center justify-center mx-auto mb-5 shadow-neo-lime font-bold">
            <Lock className="w-8 h-8 text-black" />
          </div>

          <h2 className="text-2xl font-heading font-extrabold text-white tracking-tight">{title}</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-2 leading-relaxed max-w-xs mx-auto font-body">
            {description}
          </p>

          <div className="mt-8 space-y-3">
            <Link
              href="/login"
              className="w-full py-4 px-4 rounded-full bg-nvg-lime hover:brightness-105 !text-black font-heading font-extrabold text-sm shadow-neo-lime transition-all flex items-center justify-center gap-2"
            >
              <span className="text-black font-extrabold">Sign In to Continue</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </Link>

            <Link
              href="/register"
              className="w-full py-3.5 px-4 rounded-full bg-nvg-off-black border border-white/10 hover:border-white/25 text-gray-200 hover:text-white font-heading font-bold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4 text-nvg-yellow" />
              <span>Create Candidate Account</span>
            </Link>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-center gap-2 text-[10px] text-gray-500 font-heading uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-nvg-green" />
            <span>Encrypted PostgreSQL Session Auth</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
