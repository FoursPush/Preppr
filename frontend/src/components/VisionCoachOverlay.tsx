"use client";

import { useState } from "react";
import { Video, VideoOff, Eye, Loader2, ShieldCheck, Minus, Maximize2, X } from "lucide-react";
import type { VisionMonitor } from "@/lib/vision/useVisionMonitor";

interface Props {
  monitor: VisionMonitor;
  showConsent: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

function postureLabel(v: number | null): string {
  if (v == null) return "—";
  if (v >= 70) return "Steady";
  if (v >= 45) return "Shifting";
  return "Restless";
}

export default function VisionCoachOverlay({ monitor, showConsent, onEnable, onDismiss }: Props) {
  const { enabled, status, badge, videoRef, disable } = monitor;
  const [minimized, setMinimized] = useState(false);

  const starting = status === "requesting" || status === "loading";
  const showTile = enabled || starting;

  return (
    <>
      {/* Floating self-view. The <video> stays mounted so the hook's ref persists; the tile is
          shown only while starting or active (no detection runs when idle). Mirrored for a
          natural selfie view — MediaPipe runs on the true, un-mirrored pixels. */}
      <div
        className={`fixed right-4 top-24 z-30 transition-opacity ${showTile && !minimized ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden={!showTile || minimized}
      >
        <div className="w-56 rounded-2xl overflow-hidden border border-white/15 bg-dark-900/90 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
              <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              Camera coach
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimized(true)} title="Minimize" className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={disable} title="Turn off camera" className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="relative bg-black aspect-[4/3]">
            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
            {starting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-brand-300 text-[11px]">
                <Loader2 className="w-5 h-5 animate-spin" />
                {status === "requesting" ? "Requesting camera…" : "Warming up coach…"}
              </div>
            )}
            {enabled && !starting && !badge.faceVisible && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-amber-200 text-[11px] text-center px-3">
                Center yourself in the frame
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-2.5 py-2 text-[11px]">
            <span className="flex items-center gap-1 text-violet-200">
              <Eye className="w-3.5 h-3.5" /> {badge.eyeContactPct ?? "—"}% eye
            </span>
            <span className="text-fuchsia-200">{postureLabel(badge.postureStability)} posture</span>
          </div>
          <div className="px-2.5 pb-2 text-[9px] text-gray-500 leading-tight">
            On your device only · summary numbers saved · practice feedback, not a judgment
          </div>
        </div>
      </div>

      {/* Minimized pill — keeps the coach running while out of the way */}
      {showTile && minimized && (
        <button
          onClick={() => setMinimized(false)}
          title="Expand camera coach"
          className="fixed right-4 top-24 z-30 flex items-center gap-2 px-3 py-2 rounded-xl bg-dark-900/90 border border-white/15 backdrop-blur-xl shadow-xl text-[11px] text-white hover:bg-dark-800 transition-all"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          <Eye className="w-3.5 h-3.5 text-violet-300" /> {badge.eyeContactPct ?? "—"}%
          <Maximize2 className="w-3 h-3 text-gray-400" />
        </button>
      )}
      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="max-w-md w-full p-6 rounded-2xl bg-dark-900 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 text-brand-300 mb-3">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="font-bold text-white">Turn on the camera coach?</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Preppr can use your camera to coach your delivery — eye contact, posture, and expressions.
              Video is processed <span className="text-white font-semibold">entirely on your device</span> and
              never uploaded; only summary numbers (like &ldquo;78% eye contact&rdquo;) are saved to your report.
              You can turn it off anytime.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This is practice feedback to help you improve — not a judgment of you.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button onClick={onDismiss} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-semibold transition-all">
                Not now
              </button>
              <button onClick={onEnable} className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-sm font-bold flex items-center gap-2 transition-all">
                <Video className="w-4 h-4" /> Enable camera
              </button>
            </div>
          </div>
        </div>
      )}
      {(status === "denied" || status === "error" || status === "unsupported") && (
        <div className="fixed bottom-24 right-4 z-40 max-w-xs p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
          <VideoOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {status === "denied"
              ? "Camera permission was blocked. The interview continues without the camera coach — enable it in your browser's site settings to use it."
              : status === "unsupported"
              ? "This browser doesn't support camera capture. The interview continues without the camera coach."
              : "Couldn't start the camera coach. The interview continues normally; you can try again."}
          </span>
        </div>
      )}
    </>
  );
}
