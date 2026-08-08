"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getInterviewState, submitAnswerTurn, endInterviewSession } from "@/lib/api";
import { Mic, MicOff, Send, Clock, Volume2, Square, Sparkles, BarChart3, AlertCircle, ArrowRight } from "lucide-react";

export default function LiveInterviewRoom() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params.id as string) || "demo_session";

  const [sessionState, setSessionState] = useState<any>(null);
  const [history, setHistory] = useState<Array<{ role: string; text: string }>>([]);
  const [userSpeech, setUserSpeech] = useState("");
  const [isMicActive, setIsMicActive] = useState(false);
  const [loadingTurn, setLoadingTurn] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(900); // 15 mins

  // Live telemetry counters
  const [liveWpm, setLiveWpm] = useState(145);
  const [liveFillers, setLiveFillers] = useState(0);

  useEffect(() => {
    async function loadInitialState() {
      try {
        const state = await getInterviewState(sessionId);
        setSessionState(state);
        setHistory(state.history || []);
      } catch (err) {
        console.error("Error loading interview state:", err);
      }
    }
    loadInitialState();

    // Timer interval
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleSendAnswer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userSpeech.trim() || loadingTurn) return;

    const currentText = userSpeech;
    setUserSpeech("");
    setLoadingTurn(true);

    // Optimistically update conversation history
    setHistory((prev) => [...prev, { role: "candidate", text: currentText }]);

    try {
      // Compute telemetry locally for feedback badge
      const words = currentText.trim().split(/\s+/).length;
      const fillers = (currentText.match(/\b(um|uh|like|you know)\b/gi) || []).length;
      setLiveWpm(Math.round((words / 0.5)));
      setLiveFillers((prev) => prev + fillers);

      const res = await submitAnswerTurn(sessionId, currentText, 30.0, {
        wpm: Math.round((words / 0.5)),
        filler_count: fillers,
      });

      // Append AI response
      setHistory((prev) => [...prev, { role: "interviewer", text: res.ai_response }]);
    } catch (err) {
      console.error("Error sending answer turn:", err);
    } finally {
      setLoadingTurn(false);
    }
  };

  const handleEndInterview = async () => {
    try {
      await endInterviewSession(sessionId);
      router.push(`/reports/${sessionId}`);
    } catch (err) {
      router.push(`/reports/${sessionId}`);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-5rem)]">
      {/* Top Telemetry & Controls Bar */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-bold text-white text-sm">
            Live AI Session: <span className="text-brand-300">{sessionState?.company_name || "Amazon"} ({sessionState?.role_name || "Backend Engineer"})</span>
          </span>
        </div>

        {/* Real-time Telemetry Badges */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="px-3 py-1.5 rounded-lg bg-dark-800 border border-white/10 text-gray-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> {formatTimer(timerSeconds)}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-300 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-brand-400" /> {liveWpm} WPM
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-cyan-400" /> {liveFillers} Fillers
          </div>
        </div>

        {/* End Button */}
        <button
          onClick={handleEndInterview}
          className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold transition-all flex items-center gap-2"
        >
          <Square className="w-3.5 h-3.5 fill-current" /> End Session & View Rubric
        </button>
      </div>

      {/* Main Conversation Room */}
      <div className="flex-1 overflow-y-auto p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-4 mb-4">
        {history.map((turn, i) => (
          <div
            key={i}
            className={`flex flex-col ${
              turn.role === "candidate" ? "items-end" : "items-start"
            }`}
          >
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              {turn.role === "candidate" ? (
                <>You (Candidate)</>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Preppr AI Interviewer
                </>
              )}
            </div>
            <div
              className={`p-4 rounded-2xl max-w-2xl text-sm leading-relaxed ${
                turn.role === "candidate"
                  ? "bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-tr-none shadow-lg shadow-brand-500/10"
                  : "bg-dark-800 border border-white/10 text-gray-100 rounded-tl-none"
              }`}
            >
              {turn.text}
            </div>
          </div>
        ))}

        {loadingTurn && (
          <div className="flex items-center gap-3 text-xs text-brand-400 animate-pulse">
            <Sparkles className="w-4 h-4" /> Preppr AI is assessing STAR structure & crafting follow-up...
          </div>
        )}
      </div>

      {/* Speech Visualizer & Response Input */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <form onSubmit={handleSendAnswer} className="flex items-center gap-3">
          {/* Mic Toggle */}
          <button
            type="button"
            onClick={() => setIsMicActive(!isMicActive)}
            className={`p-3.5 rounded-xl border transition-all ${
              isMicActive
                ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
                : "bg-dark-800 border-white/10 text-gray-300 hover:text-white"
            }`}
            title={isMicActive ? "Mute Microphone" : "Enable Microphone"}
          >
            {isMicActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={userSpeech}
            onChange={(e) => setUserSpeech(e.target.value)}
            placeholder={
              isMicActive
                ? "Listening to speech... (or type your response)"
                : "Type your answer or project experience..."
            }
            className="flex-1 bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!userSpeech.trim() || loadingTurn}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
          >
            Send Answer <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
