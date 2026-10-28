"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Mic, BarChart3, FileText, Sparkles, LogOut, Plus, ArrowUpRight } from "lucide-react";

export default function Navbar() {
  const { user, isLoggedIn, isLoading, logout } = useAuth();

  return (
    <header className="fixed top-5 sm:top-6 inset-x-0 z-50 flex justify-center px-4 sm:px-6 pointer-events-none">
      <nav className="pointer-events-auto flex items-center gap-2 sm:gap-4 md:gap-5 bg-nvg-surface/95 border border-white/15 rounded-full px-3.5 sm:px-5 py-2.5 sm:py-3 shadow-2xl backdrop-blur-2xl transition-all">
        {/* Left Brand Badge (NVG8 Orange Pill) */}
        <Link href="/" className="flex items-center gap-2.5 group pr-1 sm:pr-2">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-nvg-orange flex items-center justify-center text-white font-extrabold shadow-neo-sm group-hover:rotate-12 transition-transform">
            <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <span className="font-heading font-extrabold text-base sm:text-lg tracking-tight text-white hidden xs:inline-block">
            Preppr<span className="text-white/60 text-xs sm:text-sm ml-0.5">.ai</span>
          </span>
        </Link>

        {/* Center Nav Links */}
        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-heading font-bold text-gray-300">
          <Link
            href="/interview/setup"
            className="px-3 sm:px-4 py-2 rounded-full hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-nvg-yellow" />
            <span className="hidden sm:inline">Mock</span> Setup
          </Link>

          <Link
            href="/resume"
            className="px-3 sm:px-4 py-2 rounded-full hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-nvg-purple" />
            <span>Resume RAG</span>
          </Link>

          {isLoggedIn && (
            <Link
              href="/dashboard"
              className="px-3 sm:px-4 py-2 rounded-full hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4 text-nvg-yellow" />
              <span>Dashboard</span>
            </Link>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-white/15">
          {isLoading ? (
            <div className="w-20 h-9 rounded-full bg-white/10 animate-pulse" />
          ) : isLoggedIn && user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/interview/setup"
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-nvg-lime !text-black font-heading font-extrabold text-xs sm:text-sm shadow-neo-lime hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3] text-black" />
                <span className="hidden sm:inline">Start</span> Practice
              </Link>

              {/* User Avatar */}
              <div
                title={`${user.name} (${user.email})`}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-nvg-purple text-white flex items-center justify-center text-xs sm:text-sm font-bold uppercase overflow-hidden border border-white/20 shadow-sm"
              >
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0) || "U"
                )}
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 rounded-full text-gray-400 hover:text-red-400 hover:bg-white/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/login"
                className="px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-heading font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-nvg-lime !text-black font-heading font-extrabold text-xs sm:text-sm shadow-neo-lime hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span>Sign Up</span>
                <ArrowUpRight className="w-4 h-4 stroke-[2.5] text-black" />
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
