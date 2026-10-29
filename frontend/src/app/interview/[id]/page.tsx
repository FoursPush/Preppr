"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getInterviewState, submitAnswerTurn, submitAudioAnswerTurn, transcribeAudio, endInterviewSession, synthesizeSpeech, getTTSStatus } from "@/lib/api";
import { useVisionMonitor } from "@/lib/vision/useVisionMonitor";
import VisionCoachOverlay from "@/components/VisionCoachOverlay";
import type { VisionTelemetry } from "@/lib/vision/visionTypes";
import {
  Mic,
  MicOff,
  Send,
  Clock,
  Square,
  Sparkles,
  BarChart3,
  AlertCircle,
  Radio,
  Volume2,
  VolumeX,
  RotateCcw,
  CheckCircle2,
  Zap,
  Video,
  VideoOff,
  Eye,
  AudioWaveform as WaveformIcon,
  Code2,
  Columns,
  MessageSquare,
  ArrowRight
} from "lucide-react";
import LiveCodingWhiteboard from "@/components/LiveCodingWhiteboard";
import { isTechRole } from "@/lib/leetcodeProblems";

export default function LiveInterviewRoom() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params.id as string) || "demo_session";

  const [sessionState, setSessionState] = useState<any>(null);
  const [history, setHistory] = useState<Array<{ role: string; text: string }>>([]);
  const [userSpeech, setUserSpeech] = useState("");
  const [loadingTurn, setLoadingTurn] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(900); // 15 mins
  const [layoutMode, setLayoutMode] = useState<"chat" | "split" | "code">("chat");
  const [interviewPhase, setInterviewPhase] = useState<"qa" | "dsa">("qa");



  // Telemetry counters
  const [liveWpm, setLiveWpm] = useState(140);
  const [liveFillers, setLiveFillers] = useState(0);

  // On-device body-language ("vision") coaching. Consent-gated, default OFF, revocable.
  const vision = useVisionMonitor();
  const [showCameraConsent, setShowCameraConsent] = useState(false);

  // Microphone MediaRecorder & Audio Visualizer State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState<number[]>(new Array(16).fill(10));
  const [autoSubmitVoice, setAutoSubmitVoice] = useState(true);

  // Interviewer Text-To-Speech (TTS) State
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingSecondsRef = useRef<number>(0);
  const isRecordingRef = useRef<boolean>(false);
  const speechRecognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // TTS playback refs
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioUrlRef = useRef<string | null>(null);
  const backendTTSRef = useRef<boolean | null>(null); // null = unknown, true/false = resolved
  const lastSpokenIndexRef = useRef<number>(-1);
  const voiceEnabledRef = useRef<boolean>(true);

  useEffect(() => {
    async function loadInitialState() {
      try {
        const state = await getInterviewState(sessionId);
        setSessionState(state);
        if (state.history && state.history.length > 0) {
          setHistory(state.history);
        } else {
          const defaultGreeting = `Welcome to your mock interview session for ${state.role_name || "your target role"}! To get started, could you please introduce yourself and walk me through your key experience?`;
          setHistory([{ role: "interviewer", text: defaultGreeting }]);
        }
      } catch (err) {
        console.warn("Using offline / fallback interview room state:", err);
        const fallbackGreeting = "Welcome to your mock interview session! To get started, could you please introduce yourself and walk me through your key experience?";
        setSessionState({
          company_name: "Mock Interview AI",
          role_name: "Software Engineer",
          difficulty: "Medium",
          duration: 15,
        });
        setHistory([{ role: "interviewer", text: fallbackGreeting }]);
      }
    }
    loadInitialState();

    // Session Countdown Timer
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Scroll to bottom when conversation history changes
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, processingAudio, loadingTurn]);

  // Clean up audio streams and speech recognition on unmount
  useEffect(() => {
    return () => {
      stopMicrophoneStream();
      stopSpeaking();
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch (e) {}
        speechRecognitionRef.current = null;
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const stopMicrophoneStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  // ---- Interviewer Text-To-Speech (TTS) ----

  const stopSpeaking = () => {
    // Stop server-side audio playback
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.src = "";
      } catch (e) {}
      ttsAudioRef.current = null;
    }
    if (ttsAudioUrlRef.current) {
      URL.revokeObjectURL(ttsAudioUrlRef.current);
      ttsAudioUrlRef.current = null;
    }
    // Stop browser speech synthesis
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setIsSpeaking(false);
  };

  const speakWithBrowser = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsSpeaking(false);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Prefer a natural English voice when one is available
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) =>
        /en(-|_)?(US|GB)/i.test(v.lang) && /natural|google|microsoft|samantha|zira|aria/i.test(v.name)
      ) || voices.find((v) => /^en/i.test(v.lang));
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Browser speech synthesis failed:", e);
      setIsSpeaking(false);
    }
  };

  const speak = async (text: string) => {
    if (!text || !voiceEnabledRef.current) return;

    // Interrupt anything currently playing
    stopSpeaking();

    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return;

    // Try server-side (OpenAI) TTS first when it is known to be available.
    if (backendTTSRef.current !== false) {
      try {
        const blob = await synthesizeSpeech(clean);
        // Voice could have been toggled off while awaiting the network response
        if (!voiceEnabledRef.current) return;
        if (blob) {
          backendTTSRef.current = true;
          const url = URL.createObjectURL(blob);
          ttsAudioUrlRef.current = url;
          const audio = new Audio(url);
          ttsAudioRef.current = audio;
          audio.onended = () => {
            setIsSpeaking(false);
            if (ttsAudioUrlRef.current) {
              URL.revokeObjectURL(ttsAudioUrlRef.current);
              ttsAudioUrlRef.current = null;
            }
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            speakWithBrowser(clean);
          };
          setIsSpeaking(true);
          await audio.play();
          return;
        }
        // 503 -> no server key; remember and fall through to browser TTS
        backendTTSRef.current = false;
      } catch (e) {
        console.warn("Server TTS failed, falling back to browser speech:", e);
      }
    }

    if (!voiceEnabledRef.current) return;
    speakWithBrowser(clean);
  };

  const toggleVoice = () => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      voiceEnabledRef.current = next;
      if (!next) {
        stopSpeaking();
      } else {
        // Avoid replaying older messages when re-enabling mid-session
        lastSpokenIndexRef.current = history.length - 1;
      }
      return next;
    });
  };

  // Resolve whether the backend has server-side TTS configured (one-shot)
  useEffect(() => {
    getTTSStatus()
      .then((s) => {
        backendTTSRef.current = !!s.backend_tts_available;
      })
      .catch(() => {
        backendTTSRef.current = null; // unknown; speak() will probe once
      });
  }, []);

  // Auto-speak the latest interviewer message as it arrives
  useEffect(() => {
    if (!voiceEnabled || history.length === 0) return;
    const lastIndex = history.length - 1;
    if (lastIndex <= lastSpokenIndexRef.current) return;
    const last = history[lastIndex];
    if (last && last.role === "interviewer" && last.text) {
      lastSpokenIndexRef.current = lastIndex;
      speak(last.text);
    } else {
      // Keep the pointer current so toggling voice on later doesn't replay this
      lastSpokenIndexRef.current = lastIndex;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, voiceEnabled]);


  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Microphone recording is not supported in this browser. Please use a modern browser like Chrome, Edge, or Firefox.");
        return;
      }

      // The candidate is about to speak — silence the interviewer immediately.
      stopSpeaking();

      // Reset live speech for fresh turn
      setUserSpeech("");

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      streamRef.current = stream;

      // Initialize Web Audio API Analyser for live frequency animation
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      // Real-time audio frequency bar visualizer loop
      const updateVisualizer = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Sample 16 frequency bands
        const bands = [];
        const step = Math.floor(dataArray.length / 16);
        for (let i = 0; i < 16; i++) {
          const val = dataArray[i * step] || 0;
          // Scale between 15% and 100% height
          bands.push(Math.max(15, Math.min(100, Math.round((val / 255) * 100))));
        }
        setAudioLevel(bands);
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();

      // Configure MediaRecorder for high-fidelity audio capture
      audioChunksRef.current = [];
      const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? { mimeType: "audio/webm;codecs=opus" }
        : MediaRecorder.isTypeSupported("audio/webm")
        ? { mimeType: "audio/webm" }
        : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250); // Collect in 250ms chunks
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          recordingSecondsRef.current = next;
          return next;
        });
      }, 1000);

      // Start Real-Time Speech Recognition in Browser
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          recognition.onresult = (event: any) => {
            let interimTranscript = "";
            let finalTranscript = "";

            for (let i = 0; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res.isFinal) {
                finalTranscript += res[0].transcript + " ";
              } else {
                interimTranscript += res[0].transcript;
              }
            }

            const currentText = (finalTranscript + interimTranscript).trim();
            if (currentText) {
              setUserSpeech(currentText);

              // Real-time telemetry calculations
              const words = currentText.split(/\s+/).filter(Boolean);
              const elapsedSeconds = Math.max(1, recordingSecondsRef.current);
              const calculatedWpm = Math.round((words.length / elapsedSeconds) * 60);
              if (calculatedWpm >= 40 && calculatedWpm <= 260) {
                setLiveWpm(calculatedWpm);
              }

              const fillerMatches = currentText.match(/\b(um|uh|like|you know|basically|actually|sort of|kind of)\b/gi);
              if (fillerMatches) {
                setLiveFillers(fillerMatches.length);
              }
            }
          };

          recognition.onerror = (e: any) => {
            console.warn("Live speech recognition event:", e.error);
          };

          recognition.onend = () => {
            // Keep listening continuously if recording is still active
            if (isRecordingRef.current && speechRecognitionRef.current) {
              try {
                speechRecognitionRef.current.start();
              } catch (e) {}
            }
          };

          speechRecognitionRef.current = recognition;
          recognition.start();
        } catch (speechErr) {
          console.warn("Could not start live speech recognition:", speechErr);
        }
      }

    } catch (err: any) {
      console.error("Microphone access error:", err);
      alert("Could not access microphone. Please check your browser microphone permissions.");
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const stopVoiceRecordingAndProcess = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    isRecordingRef.current = false;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsRecording(false);

    const mediaRecorder = mediaRecorderRef.current;
    const capturedTranscript = userSpeech.trim();
    const elapsedDuration = Math.max(2, recordingSecondsRef.current);
    // In auto-submit mode this turn is sent now, so snapshot the body-language window here.
    // In manual mode the transcript lands in the input box and the user clicks Send, so leave
    // the window running and let handleSendAnswer finalize it instead.
    const visionTelemetry = autoSubmitVoice ? vision.finalizeTurn() : null;

    mediaRecorder.onstop = async () => {
      stopMicrophoneStream();
      const mimeType = mediaRecorder.mimeType || "audio/webm";
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];

      await handleAudioSubmission(audioBlob, capturedTranscript, elapsedDuration, visionTelemetry);
    };

    mediaRecorder.stop();
  };

  const cancelVoiceRecording = () => {
    isRecordingRef.current = false;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    stopMicrophoneStream();
    setIsRecording(false);
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    audioChunksRef.current = [];
  };

  const handleAudioSubmission = async (audioBlob: Blob, capturedLiveTranscript: string, durationSeconds: number, visionTelemetry: VisionTelemetry | null = null) => {
    setProcessingAudio(true);

    try {
      if (autoSubmitVoice) {
        setLoadingTurn(true);

        // Try server-side audio turn processing first
        try {
          const res = await submitAudioAnswerTurn(sessionId, audioBlob, visionTelemetry);
          setHistory((prev) => [
            ...prev,
            { role: "candidate", text: res.transcript },
            { role: "interviewer", text: res.ai_response }
          ]);

          if (res.telemetry) {
            if (res.telemetry.wpm) setLiveWpm(Math.round(res.telemetry.wpm));
            if (res.telemetry.filler_count !== undefined) {
              setLiveFillers((prev) => prev + res.telemetry.filler_count);
            }
          }
          if (isTech && interviewPhase === "qa") {
            setTimeout(() => {
              setInterviewPhase("dsa");
              setLayoutMode("split");
            }, 800);
          }
          setUserSpeech("");
        } catch (audioErr: any) {
          // If server audio transcription is still initializing or encountered an issue,
          // seamlessly fall back to the live captured transcript from the browser
          if (capturedLiveTranscript) {
            console.warn("Falling back to live captured speech transcript:", audioErr);
            const words = capturedLiveTranscript.split(/\s+/).length;
            const fillers = (capturedLiveTranscript.match(/\b(um|uh|like|you know|basically|actually)\b/gi) || []).length;

            const res = await submitAnswerTurn(sessionId, capturedLiveTranscript, durationSeconds, {
              wpm: liveWpm || Math.round((words / durationSeconds) * 60),
              filler_count: fillers,
            }, visionTelemetry);

            setHistory((prev) => [
              ...prev,
              { role: "candidate", text: capturedLiveTranscript },
              { role: "interviewer", text: res.ai_response }
            ]);
            setUserSpeech("");
          } else {
            throw audioErr;
          }
        }
      } else {
        // If not auto-submitting, try transcribing audio or keep the live transcript in the input box
        if (!capturedLiveTranscript && audioBlob.size > 500) {
          const sttResult = await transcribeAudio(audioBlob);
          setUserSpeech(sttResult.transcript || "");
          if (sttResult.wpm) setLiveWpm(Math.round(sttResult.wpm));
          if (sttResult.filler_count) {
            setLiveFillers((prev) => prev + sttResult.filler_count);
          }
        }
      }
    } catch (err: any) {
      console.error("Audio answer submission error:", err);
      alert(err.message || "Could not process audio response. You can type your answer and send it.");
    } finally {
      setProcessingAudio(false);
      setLoadingTurn(false);
    }
  };

  const handleSendAnswer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userSpeech.trim() || loadingTurn || processingAudio) return;

    const currentText = userSpeech;
    setUserSpeech("");
    setLoadingTurn(true);

    // Optimistically update conversation history
    setHistory((prev) => [...prev, { role: "candidate", text: currentText }]);

    try {
      const words = currentText.trim().split(/\s+/).length;
      const fillers = (currentText.match(/\b(um|uh|like|you know|basically|actually)\b/gi) || []).length;
      setLiveWpm(Math.round(words / 0.5));
      setLiveFillers((prev) => prev + fillers);

      const visionTelemetry = vision.finalizeTurn();
      const res = await submitAnswerTurn(sessionId, currentText, 30.0, {
        wpm: Math.round(words / 0.5),
        filler_count: fillers,
      }, visionTelemetry);

      // Append AI response
      setHistory((prev) => [...prev, { role: "interviewer", text: res.ai_response }]);

      // For tech roles: transition from QA to the hands-on DSA coding section!
      if (isTech && interviewPhase === "qa") {
        setTimeout(() => {
          setInterviewPhase("dsa");
          setLayoutMode("split");
        }, 800);
      }
    } catch (err) {
      console.warn("Backend turn processing note, using adaptive conversational response:", err);
      // Backend unreachable — rotate through varied probes so a repeated outage
      // doesn't produce the same interviewer line every turn.
      const offlineProbes = [
        "What was the biggest technical or operational obstacle you faced there, and how did you resolve it?",
        "Can you quantify the impact of that work — any metrics, time saved, or results you measured?",
        "If you had to do that project again, what would you do differently and why?",
        "Walk me through a trade-off or tough decision you made in that situation.",
        "How did you collaborate with others on that, and what was your specific contribution?",
      ];
      const askedCount = history.filter((h) => h.role === "candidate").length;
      setHistory((prev) => [
        ...prev,
        {
          role: "interviewer",
          text: offlineProbes[askedCount % offlineProbes.length],
        },
      ]);
    } finally {
      setLoadingTurn(false);
    }
  };

  // ---- Camera coach (consent-gated) ----
  const handleToggleCamera = () => {
    if (vision.enabled) {
      vision.disable();
    } else {
      setShowCameraConsent(true);
    }
  };

  const handleEnableCamera = () => {
    setShowCameraConsent(false);
    vision.requestEnable();
  };

  const handleEndInterview = async () => {
    stopSpeaking();
    vision.disable();
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

  const isTech = isTechRole(sessionState?.role_name, sessionState?.role_category);

  const startDsaRound = () => {
    setInterviewPhase("dsa");
    setLayoutMode("split");
    const dsaAnnouncement = "Great discussion on your background! Now let's move into our hands-on Algorithmic & Problem-Solving round. I've presented a LeetCode problem in your code workspace on the right. Please review the problem description, explain your approach, and implement your solution.";
    setHistory((prev) => [
      ...prev,
      { role: "interviewer", text: dsaAnnouncement },
    ]);
    speak(dsaAnnouncement);
  };

  const handleCodeSubmitted = (candidateText: string, aiResponse: string) => {
    setHistory((prev) => [
      ...prev,
      { role: "candidate", text: candidateText },
      { role: "interviewer", text: aiResponse },
    ]);
    speak(aiResponse);
  };


  const renderChatPane = () => (
    <div className="flex flex-col flex-1 min-h-0 font-body">
      {/* Main Conversation Room */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 rounded-squircle bg-nvg-surface/80 border border-white/10 backdrop-blur-xl space-y-4 mb-3">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400 space-y-3">
            <Sparkles className="w-8 h-8 text-nvg-lime animate-spin" />
            <p className="text-sm font-heading font-bold text-white">Connecting to Preppr AI Interviewer...</p>
            <p className="text-xs text-gray-400">Preparing customized questions for your target role.</p>
          </div>
        )}
        {history.map((turn, i) => (
          <div
            key={i}
            className={`flex flex-col ${
              turn.role === "candidate" ? "items-end" : "items-start"
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-heading font-bold text-gray-400 mb-1">
              {turn.role === "candidate" ? (
                <span className="flex items-center gap-1 text-nvg-lavender">You (Candidate)</span>
              ) : (
                <span className="flex items-center gap-1.5 text-nvg-lime">
                  <span className="w-2 h-2 rounded-full bg-nvg-lime" />
                  Preppr AI Interviewer
                </span>
              )}
            </div>
            <div
              className={`p-4 md:p-5 max-w-2xl text-sm leading-relaxed ${
                turn.role === "candidate"
                  ? "bg-nvg-purple text-white rounded-[24px] rounded-tr-sm shadow-neo-purple font-body"
                  : "bg-nvg-off-black/80 border border-white/10 text-nvg-off-white rounded-[24px] rounded-tl-sm font-body"
              }`}
            >
              <div className="whitespace-pre-wrap">{turn.text}</div>
            </div>
          </div>
        ))}

        {/* Processing Audio Status Indicator */}
        {processingAudio && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-nvg-lime !text-black text-xs animate-pulse font-heading font-extrabold shadow-neo-lime">
            <Radio className="w-4 h-4 text-black animate-spin" />
            <span className="text-black font-extrabold">Transcribing and analyzing speech telemetry...</span>
          </div>
        )}

        {/* AI Thinking Status */}
        {loadingTurn && !processingAudio && (
          <div className="flex items-center gap-3 text-xs text-nvg-yellow animate-pulse font-heading font-bold">
            <Sparkles className="w-4 h-4 text-nvg-yellow" /> Preppr AI is assessing response and crafting adaptive inquiry...
          </div>
        )}

        {/* DSA Transition Callout for Tech Roles */}
        {isTech && (
          <div className="p-4 rounded-2xl bg-nvg-off-black/80 border border-white/10 backdrop-blur flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-nvg-lime !text-black flex items-center justify-center font-extrabold">
                <Code2 className="w-4 h-4 text-black" />
              </div>
              <div>
                <div className="font-heading font-bold text-white text-xs">
                  {interviewPhase === "qa"
                    ? "Phase 1: Domain and Architecture Q and A"
                    : "Phase 2: LeetCode and Algorithmic Problem Solving"}
                </div>
                <div className="text-[11px] text-gray-400 font-body">
                  {interviewPhase === "qa"
                    ? "Answer the question above, or proceed directly to your live LeetCode DSA challenge."
                    : "Review the problem description, run test cases, and submit your solution."}
                </div>
              </div>
            </div>
            {interviewPhase === "qa" && (
              <button
                type="button"
                onClick={startDsaRound}
                className="px-4 py-2 rounded-full bg-nvg-lime hover:brightness-105 !text-black font-heading font-extrabold transition-all shadow-neo-lime flex items-center gap-1.5 text-xs"
              >
                <span className="text-black font-extrabold">Proceed to DSA Challenge</span>
                <ArrowRight className="w-3.5 h-3.5 text-black" />
              </button>
            )}
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Voice Recording Modal / Active Microphone Panel */}
      {isRecording && (
        <div className="mb-3 space-y-2 animate-in fade-in slide-in-from-bottom-2">
          <div className="p-4 rounded-squircle bg-nvg-surface border border-red-500/40 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-red-500/20 animate-ping absolute" />
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white z-10">
                  <Mic className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-white font-heading font-bold text-sm flex items-center gap-2">
                  <span>Listening to Microphone...</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-mono font-bold">
                    {formatTimer(recordingSeconds)}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5 font-body">
                  Speak naturally. Words are transcribed in real time.
                </div>
              </div>
            </div>

            {/* Real-time Frequency Waveform Visualizer */}
            <div className="flex items-end gap-1 h-8 px-4 py-1 rounded-full bg-nvg-off-black border border-white/10">
              {audioLevel.map((lvl, idx) => (
                <div
                  key={idx}
                  className="w-1.5 rounded-full bg-nvg-lime transition-all duration-75"
                  style={{ height: `${lvl}%` }}
                />
              ))}
            </div>

            {/* Recording Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelVoiceRecording}
                className="px-3.5 py-2 rounded-full bg-nvg-off-black hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-heading font-bold flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                type="button"
                onClick={stopVoiceRecordingAndProcess}
                className="px-4 py-2 rounded-full bg-nvg-lime hover:bg-white text-nvg-off-black text-xs font-heading font-extrabold shadow-neo-lime flex items-center gap-1.5 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" /> Stop & Submit Answer
              </button>
            </div>
          </div>

          {/* Live Real-Time Transcript Stream Box */}
          <div className="p-3.5 rounded-2xl bg-nvg-surface border border-nvg-lime/30 backdrop-blur-xl">
            <div className="flex items-center justify-between text-[11px] text-nvg-lime font-heading font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Live Real-Time Transcript
              </span>
              <span className="text-gray-400 font-mono text-[10px]">Listening as you speak...</span>
            </div>
            <div className="text-sm text-white font-medium min-h-[2.5rem] leading-relaxed break-words font-body">
              {userSpeech ? (
                <span>
                  "{userSpeech}"
                  <span className="inline-block w-2 h-4 ml-1.5 bg-nvg-lime animate-pulse align-middle rounded-sm" />
                </span>
              ) : (
                <span className="text-gray-500 italic flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 animate-pulse text-gray-400" />
                  Start speaking into your microphone... words will appear here in real time.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Speech Visualizer & Response Input Bar */}
      <div className="p-3 md:p-4 rounded-squircle bg-nvg-surface/80 border border-white/10 backdrop-blur-xl">
        <form onSubmit={handleSendAnswer} className="flex items-center gap-3">
          {/* Microphone Action Button */}
          {!isRecording ? (
            <button
              type="button"
              onClick={startVoiceRecording}
              disabled={loadingTurn || processingAudio}
              className="px-4 py-3 rounded-full bg-nvg-orange hover:bg-white hover:text-nvg-off-black text-white font-heading font-bold text-xs shadow-neo-orange transition-all flex items-center gap-2 disabled:opacity-50"
              title="Answer with Microphone"
            >
              <Mic className="w-4 h-4 animate-pulse" />
              <span className="hidden sm:inline">Voice</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopVoiceRecordingAndProcess}
              className="px-4 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-heading font-bold text-xs shadow-md animate-pulse flex items-center gap-2"
              title="Stop Recording and Submit Answer"
            >
              <Square className="w-4 h-4 fill-current" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          )}

          {/* Text Input for Typing or Reviewing Transcript */}
          <input
            type="text"
            value={userSpeech}
            onChange={(e) => setUserSpeech(e.target.value)}
            disabled={isRecording || processingAudio || loadingTurn}
            placeholder={
              isRecording
                ? "Transcribing your speech in real time..."
                : processingAudio
                ? "Processing audio..."
                : "Type your answer or speak with microphone..."
            }
            className="flex-1 bg-nvg-off-black border border-white/10 rounded-full px-5 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nvg-lime disabled:opacity-75 font-body"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!userSpeech.trim() || loadingTurn || processingAudio || isRecording}
            className="px-5 py-3 rounded-full bg-nvg-lime hover:bg-white text-nvg-off-black font-heading font-extrabold text-sm shadow-neo-lime transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <span className="hidden sm:inline">Send</span> <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Voice Turn Controls Footer */}
        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 px-2 font-heading">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-nvg-lime">
              <Zap className="w-3 h-3 text-nvg-lime" />
              <span>Voice telemetry engine connected</span>
            </span>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-300 select-none">
            <input
              type="checkbox"
              checked={autoSubmitVoice}
              onChange={(e) => setAutoSubmitVoice(e.target.checked)}
              className="rounded bg-nvg-off-black border-white/20 text-nvg-lime focus:ring-0"
            />
            <span>Auto-submit when speaking ends</span>
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`w-full mx-auto px-4 pt-28 sm:pt-32 pb-4 flex flex-col h-screen max-h-screen transition-all font-body bg-nvg-off-black ${layoutMode === "chat" ? "max-w-6xl" : "max-w-[1700px]"}`}>
      <VisionCoachOverlay
        monitor={vision}
        showConsent={showCameraConsent}
        onEnable={handleEnableCamera}
        onDismiss={() => setShowCameraConsent(false)}
      />
      {/* Top Telemetry & Controls Bar */}
      <div className="squircle-card p-3.5 sm:p-4 bg-nvg-surface/90 border border-white/10 backdrop-blur-xl mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-nvg-lime animate-ping" />
          <div>
            <div className="font-heading font-bold text-white text-sm flex items-center gap-2">
              Live Mock Session: <span className="text-nvg-lime">{sessionState?.company_name || "Mock"} ({sessionState?.role_name || "Software Engineer"})</span>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5 font-body">
              <span className="w-2 h-2 rounded-full bg-nvg-lime" />
              <span>Acoustic Telemetry Stream Active</span>
              {isSpeaking && (
                <span className="flex items-center gap-1 text-nvg-lime ml-2 font-heading font-bold">
                  <Volume2 className="w-3 h-3 animate-pulse" /> Interviewer speaking...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Layout Switcher & DSA Mode Controls (Only for Tech / Developer Roles) */}
        {isTech && (
          <div className="flex items-center gap-2">
            {interviewPhase === "qa" && (
              <button
                type="button"
                onClick={startDsaRound}
                className="px-3.5 py-1.5 rounded-full bg-nvg-lime hover:bg-white text-nvg-off-black text-xs font-heading font-extrabold shadow-neo-lime flex items-center gap-1.5 transition-all"
                title="Transition to LeetCode DSA Solving Phase"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Begin DSA Round</span>
              </button>
            )}

            <div className="flex items-center gap-1 bg-nvg-off-black p-1 rounded-full border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setLayoutMode("chat")}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 font-heading font-bold transition-all ${
                  layoutMode === "chat"
                    ? "bg-nvg-purple text-white shadow-neo-purple"
                    : "text-gray-400 hover:text-white"
                }`}
                title="Q and A Chat View"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Q&A Chat</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInterviewPhase("dsa");
                  setLayoutMode("split");
                }}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 font-heading font-bold transition-all ${
                  layoutMode === "split"
                    ? "bg-nvg-purple text-white shadow-neo-purple"
                    : "text-gray-400 hover:text-white"
                }`}
                title="Split Screen: Chat + LeetCode DSA Workspace"
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Split DSA</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInterviewPhase("dsa");
                  setLayoutMode("code");
                }}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 font-heading font-bold transition-all ${
                  layoutMode === "code"
                    ? "bg-nvg-purple text-white shadow-neo-purple"
                    : "text-gray-400 hover:text-white"
                }`}
                title="Full Code Focus Workspace"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Code Only</span>
              </button>
            </div>
          </div>
        )}

        {/* Real-time Telemetry Badges */}
        <div className="flex items-center gap-2 md:gap-3 text-xs font-heading font-bold">
          <div className="px-3 py-1.5 rounded-full bg-nvg-off-black border border-white/10 text-gray-300 flex items-center gap-1.5" title="Interview countdown">
            <Clock className="w-3.5 h-3.5 text-nvg-yellow" /> {formatTimer(timerSeconds)}
          </div>
          <div className="px-3 py-1.5 rounded-full bg-nvg-lime/15 border border-nvg-lime/30 text-nvg-lime flex items-center gap-1.5" title="Words Per Minute">
            <BarChart3 className="w-3.5 h-3.5 text-nvg-lime" /> {liveWpm} WPM
          </div>
          <div className="px-3 py-1.5 rounded-full bg-nvg-orange/15 border border-nvg-orange/30 text-nvg-orange flex items-center gap-1.5" title="Detected Filler Words">
            <AlertCircle className="w-3.5 h-3.5 text-nvg-orange" /> {liveFillers} Fillers
          </div>
          {vision.enabled && (
            <>
              <div className="px-3 py-1.5 rounded-full bg-nvg-purple/15 border border-nvg-purple/30 text-nvg-lavender flex items-center gap-1.5" title="Eye contact">
                <Eye className="w-3.5 h-3.5 text-nvg-purple" /> {vision.badge.eyeContactPct ?? "—"}% Eye
              </div>
              <div className="px-3 py-1.5 rounded-full bg-nvg-light-blue/15 border border-nvg-light-blue/30 text-nvg-light-blue flex items-center gap-1.5" title="Posture">
                <Video className="w-3.5 h-3.5 text-nvg-light-blue" /> {vision.badge.postureStability ?? "—"} Posture
              </div>
            </>
          )}
          <button
            type="button"
            onClick={toggleVoice}
            title={voiceEnabled ? "Interviewer voice is on — click to mute" : "Interviewer voice is off — click to unmute"}
            className={`px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all ${
              voiceEnabled
                ? "bg-nvg-lime/20 border-nvg-lime text-nvg-lime"
                : "bg-nvg-off-black border-white/10 text-gray-400"
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{voiceEnabled ? "Voice On" : "Voice Off"}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleCamera}
            title={vision.enabled ? "Camera coach is on — click to turn off" : "Turn on the on-device camera coach"}
            className={`px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all ${
              vision.enabled
                ? "bg-nvg-purple/20 border-nvg-purple text-nvg-lavender"
                : "bg-nvg-off-black border-white/10 text-gray-400"
            }`}
          >
            {vision.enabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{vision.enabled ? "Camera On" : "Camera Off"}</span>
          </button>
        </div>

        {/* End Button */}
        <button
          onClick={handleEndInterview}
          className="px-4 py-2 rounded-full bg-red-500/15 hover:bg-red-500 border border-red-500/30 hover:border-red-500 text-red-300 hover:text-white text-xs font-heading font-extrabold transition-all flex items-center gap-2"
        >
          <Square className="w-3.5 h-3.5 fill-current" /> End Session
        </button>
      </div>

      {/* Main Content Area based on Layout Mode & Role Category */}
      {(!isTech || layoutMode === "chat") && renderChatPane()}

      {isTech && layoutMode === "split" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Interview Chat & Voice (5 columns) */}
          <div className="lg:col-span-5 flex flex-col h-full min-h-0">
            {renderChatPane()}
          </div>

          {/* Right Column: LeetCode DSA Workspace (7 columns) */}
          <div className="lg:col-span-7 h-full min-h-0">
            <LiveCodingWhiteboard
              sessionId={sessionId}
              roleName={sessionState?.role_name}
              companyName={sessionState?.company_name}
              difficulty={sessionState?.difficulty}
              onCodeSubmittedToChat={handleCodeSubmitted}
            />
          </div>
        </div>
      )}

      {isTech && layoutMode === "code" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <LiveCodingWhiteboard
            sessionId={sessionId}
            roleName={sessionState?.role_name}
            companyName={sessionState?.company_name}
            difficulty={sessionState?.difficulty}
            onCodeSubmittedToChat={handleCodeSubmitted}
          />
        </div>
      )}
    </div>
  );
}
