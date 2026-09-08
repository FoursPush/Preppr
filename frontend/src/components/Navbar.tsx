"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Mic, BarChart3, FileText, Sparkles, LogOut, User, PlusCircle } from "lucide-react";

export default function Navbar() {
  const { user, isLoggedIn, isLoading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-dark-900/80 border-b border-white/10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white flex items-center gap-1.5">
            Preppr <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300">AI</span>
          </span>
        </Link>

        {/* Center Nav Links - ONLY shown when logged in */}
        {!isLoading && isLoggedIn && (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
            <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-500" /> Dashboard
            </Link>
            <Link href="/resume" className="hover:text-white transition-colors flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" /> Resume & Profile
            </Link>
            <Link href="/interview/setup" className="hover:text-white transition-colors flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Start Mock
            </Link>
          </nav>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="w-20 h-8 rounded-lg bg-white/5 animate-pulse" />
          ) : isLoggedIn && user ? (
            /* Logged In View */
            <div className="flex items-center gap-3">
              <Link
                href="/interview/setup"
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-lg shadow-md shadow-brand-500/20 transition-all transform hover:-translate-y-0.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New Interview</span>
              </Link>

              {/* User Profile Pill */}
              <div className="flex items-center gap-2 pl-2 sm:border-l border-white/10">
                <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-300 font-bold text-xs uppercase overflow-hidden">
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name.charAt(0) || "U"
                  )}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">{user.name}</div>
                  <div className="text-[10px] text-gray-400 truncate max-w-[120px]">{user.role || "Candidate"}</div>
                </div>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Not Logged In View - ONLY show Get Started and Sign In */
            <div className="flex items-center gap-2.5">
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-xs sm:text-sm font-medium text-gray-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" /> Sign In
              </Link>
              <Link
                href="/register"
                className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-lg shadow-md shadow-brand-500/20 transition-all transform hover:-translate-y-0.5"
              >
                Get Started Free
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
