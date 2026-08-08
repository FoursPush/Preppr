"use client";

import Link from "next/link";
import { Mic, BarChart3, FileText, User, Sparkles } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-dark-900/80 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white flex items-center gap-1.5">
            Preppr <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300">AI</span>
          </span>
        </Link>

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

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-gray-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors flex items-center gap-2"
          >
            <User className="w-4 h-4" /> Sign In
          </Link>
          <Link
            href="/interview/setup"
            className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-lg shadow-md shadow-brand-500/20 transition-all transform hover:-translate-y-0.5"
          >
            New Interview
          </Link>
        </div>
      </div>
    </header>
  );
}
