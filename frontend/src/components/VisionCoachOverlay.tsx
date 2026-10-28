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
      {/* Floating self-view */}
      <div
        className={`fixed right-4 top-24 z-30 transition-opacity font-body ${showTile && !minimized ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden={!showTile || minimized}
      >
        <div className="w-60 rounded-squircle overflow-hidden border border-white/15 bg-nvg-surface/90 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10">
            <span className="flex items-center gap-1.5 text-xs font-heading font-bold text-white">
              <span className={`w-2 h-2 rounded-full ${enabled ? "bg-nvg-lime animate-pulse" : "bg-nvg-yellow"}`} />
              Camera Coach
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimized(true)} title="Minimize" className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={disable} title="Turn off camera" className="p-1 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="relative bg-black aspect-[4/3]">
            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
            {starting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white text-xs font-heading font-bold">
                <Loader2 className="w-5 h-5 animate-spin text-nvg-yellow" />
                {status === "requesting" ? "Requesting camera…" : "Calibrating telemetry…"}
              </div>
            )}
            {enabled && !starting && !badge.faceVisible && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-nvg-yellow text-xs text-center px-3 font-heading font-bold">
                Center yourself in frame
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-3.5 py-2.5 text-xs font-heading font-bold">
            <span className="flex items-center gap-1.5 text-nvg-purple">
              <Eye className="w-3.5 h-3.5" /> {badge.eyeContactPct ?? "—"}% Eye
            </span>
            <span className="text-nvg-green">{postureLabel(badge.postureStability)} Posture</span>
          </div>
          <div className="px-3.5 pb-2.5 text-[10px] text-gray-500 leading-tight font-body">
            On-device vision analysis · No raw video leaves your machine
          </div>
        </div>
      </div>

      {/* Minimized pill */}
      {showTile && minimized && (
        <button
          onClick={() => setMinimized(false)}
          title="Expand camera coach"
          className="fixed right-4 top-24 z-30 flex items-center gap-2 px-3.5 py-2 rounded-full bg-nvg-surface border border-white/15 backdrop-blur-xl shadow-xl text-xs text-white hover:bg-nvg-off-black transition-all font-heading font-bold"
        >
          <span className={`w-2 h-2 rounded-full ${enabled ? "bg-nvg-green animate-pulse" : "bg-nvg-yellow"}`} />
          <Eye className="w-3.5 h-3.5 text-nvg-purple" /> {badge.eyeContactPct ?? "—"}%
          <Maximize2 className="w-3 h-3 text-gray-400" />
        </button>
      )}

      {/* Consent Modal */}
      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-body">
          <div className="max-w-md w-full p-8 rounded-squircle bg-nvg-surface border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 text-nvg-green mb-3">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="font-heading font-bold text-white text-lg">Turn on on-device camera coach?</h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-body">
              Preppr analyzes your delivery — eye contact stability, posture steadiness, and composure.
              Video frames are processed <span className="text-white font-bold">100% locally in your browser</span> and
              never uploaded over the network; only summary statistics are saved to your score report.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3 font-heading font-bold">
              <button
                onClick={onDismiss}
                className="px-5 py-2.5 rounded-full bg-nvg-off-black hover:bg-white/10 text-gray-300 text-xs transition-all"
              >
                Not now
              </button>
              <button
                onClick={onEnable}
                className="px-5 py-2.5 rounded-full bg-nvg-lime hover:brightness-105 !text-black text-xs font-extrabold shadow-neo-lime flex items-center gap-2 transition-all"
              >
                <Video className="w-4 h-4 text-black" /> Enable camera
              </button>
            </div>
          </div>
        </div>
      )}
      {(status === "denied" || status === "error" || status === "unsupported") && (
        <div className="fixed bottom-24 right-4 z-40 max-w-xs p-3.5 rounded-2xl bg-nvg-orange/15 border border-nvg-orange/30 text-nvg-orange text-xs flex items-start gap-2 font-body">
          <VideoOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {status === "denied"
              ? "Camera permission was blocked. The interview continues without the camera coach — enable it in browser settings anytime."
              : status === "unsupported"
              ? "Browser doesn't support camera capture. Interview continues without the camera coach."
              : "Couldn't start camera coach. Interview continues normally."}
          </span>
        </div>
      )}
    </>
  );
}
