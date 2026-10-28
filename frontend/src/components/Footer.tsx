import Link from "next/link";
import { Mic, Sparkles, ArrowUpRight, Github, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-nvg-offblack text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-white/10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-nvg-orange flex items-center justify-center text-white font-extrabold shadow-sm">
                <Mic className="w-4 h-4 text-white" />
              </div>
              <span className="font-heading font-extrabold text-xl text-white tracking-tight">
                Preppr<span className="text-white/60 text-sm">.ai</span>
              </span>
            </div>
            <p className="text-xs text-gray-400 max-w-md font-body leading-relaxed">
              Real-time voice mock interviews with biometric telemetry, on-device vision coaching, adaptive STAR evaluation, and downloadable PDF plans.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-nvg-orange/15 text-nvg-orange text-xs font-bold border border-nvg-orange/30">
              LiveKit WebRTC
            </span>
            <span className="px-3 py-1 rounded-full bg-nvg-purple/15 text-nvg-purple text-xs font-bold border border-nvg-purple/30">
              Whisper STT
            </span>
            <span className="px-3 py-1 rounded-full bg-nvg-lime !text-black text-xs font-heading font-extrabold shadow-sm">
              pgvector RAG
            </span>
            <span className="px-3 py-1 rounded-full bg-nvg-yellow/15 text-nvg-yellow text-xs font-bold border border-nvg-yellow/30">
              On-Device Vision
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium">
          <p className="text-gray-500">
            © 2026 Preppr AI. Built for ambitious software engineers and candidates.
          </p>

          <div className="flex items-center gap-6">
            <Link href="/interview/setup" className="hover:text-nvg-orange transition-colors">
              Mock Interview
            </Link>
            <Link href="/resume" className="hover:text-nvg-orange transition-colors">
              Resume Persona RAG
            </Link>
            <Link href="/dashboard" className="hover:text-nvg-orange transition-colors">
              Telemetry Dashboard
            </Link>
            <a
              href="https://github.com/FoursPush/Preppr"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
