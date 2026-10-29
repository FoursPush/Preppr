"use client";

import { useState, useRef, useEffect } from "react";
import {
  Code2,
  Play,
  Sparkles,
  Terminal,
  RotateCcw,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ListFilter,
  Lightbulb,
  ExternalLink,
  Tag,
  ArrowRight,
  Shuffle,
  RefreshCw
} from "lucide-react";
import { submitCodeForReview, runCodeSnippet, fetchDynamicDSAProblem, CodeReviewResponse } from "@/lib/api";
import { LEETCODE_PROBLEMS, LeetCodeProblem } from "@/lib/leetcodeProblems";

interface LiveCodeWorkspaceProps {
  sessionId: string;
  roleName?: string;
  companyName?: string;
  difficulty?: string;
  initialProblemId?: string;
  onCodeSubmittedToChat?: (candidateText: string, aiResponse: string) => void;
}

export default function LiveCodingWhiteboard({
  sessionId,
  roleName,
  companyName,
  difficulty = "Medium",
  initialProblemId,
  onCodeSubmittedToChat,
}: LiveCodeWorkspaceProps) {
  const [currentDifficulty, setCurrentDifficulty] = useState<string>(() => {
    const d = difficulty?.trim().toLowerCase();
    if (d === "easy") return "Easy";
    if (d === "hard") return "Hard";
    return "Medium";
  });

  // Selected problem
  const [selectedProblem, setSelectedProblem] = useState<LeetCodeProblem>(() => {
    const diff = (difficulty || "Medium").toLowerCase();
    const matched = LEETCODE_PROBLEMS.filter((p) => p.difficulty.toLowerCase() === diff);
    return matched.length > 0 ? matched[0] : LEETCODE_PROBLEMS[0];
  });

  const [activeTab, setActiveTab] = useState<"description" | "testcases" | "hints">("description");
  const [language, setLanguage] = useState<string>("python");
  const [code, setCode] = useState<string>(
    selectedProblem.starterCode[language] || selectedProblem.starterCode.python || ""
  );
  const [candidateNotes, setCandidateNotes] = useState("");

  // Loading & Dynamic Generation state
  const [isLoadingProblem, setIsLoadingProblem] = useState(false);

  // Execution & Output state
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [executionSuccess, setExecutionSuccess] = useState<boolean>(true);

  // AI Review state
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [aiReview, setAiReview] = useState<CodeReviewResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Fetch a random problem dynamically based on difficulty
  const fetchRandomProblem = async (diffToFetch?: string) => {
    const diff = diffToFetch || currentDifficulty || "Medium";
    setIsLoadingProblem(true);
    setConsoleOutput(null);
    setAiReview(null);

    try {
      const problem = await fetchDynamicDSAProblem(sessionId, {
        difficulty: diff,
        companyName,
        roleName,
      });

      if (problem && problem.title && problem.starterCode) {
        setSelectedProblem(problem);
        setCode(problem.starterCode[language] || problem.starterCode.python || "");
        return;
      }
    } catch (err) {
      console.warn("Dynamic problem API note, using difficulty-matched fallback pool:", err);
    }

    // Fallback: Pick a random problem matching opted difficulty from the pool
    const matched = LEETCODE_PROBLEMS.filter(
      (p) => p.difficulty.toLowerCase() === diff.toLowerCase()
    );
    const pool = matched.length > 0 ? matched : LEETCODE_PROBLEMS;
    const randomPick = pool[Math.floor(Math.random() * pool.length)];

    setSelectedProblem(randomPick);
    setCode(randomPick.starterCode[language] || randomPick.starterCode.python || "");
    setIsLoadingProblem(false);
  };

  // Sync with prop difficulty changes (e.g. if set in interview setup)
  useEffect(() => {
    if (difficulty) {
      const normalized = difficulty.trim().toLowerCase();
      const cap = normalized === "easy" ? "Easy" : normalized === "hard" ? "Hard" : "Medium";
      setCurrentDifficulty(cap);
      fetchRandomProblem(cap);
    }
  }, [difficulty]);

  // Switch problem manually
  const handleSelectProblem = (problem: LeetCodeProblem) => {
    setSelectedProblem(problem);
    setCode(problem.starterCode[language] || problem.starterCode.python || "");
    setConsoleOutput(null);
    setAiReview(null);
  };

  // Switch language
  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const starter = selectedProblem.starterCode[newLang];
    if (starter) {
      setCode(starter);
    }
    setConsoleOutput(null);
  };

  // Reset code to starter template
  const handleResetCode = () => {
    const starter = selectedProblem.starterCode[language] || selectedProblem.starterCode.python || "";
    setCode(starter);
    setConsoleOutput(null);
  };

  // Tab key indents 2 spaces inside textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + "  " + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
    // Ctrl/Cmd + Enter to run code
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleRunCode();
    }
  };

  // Run code locally/sandbox against problem test cases
  const handleRunCode = async () => {
    setIsRunning(true);
    setConsoleOutput("Evaluating solution against test cases in sandbox...");
    try {
      const res = await runCodeSnippet(code, language, selectedProblem.examples);
      setExecutionSuccess(res.success);
      setConsoleOutput(res.output);
      setExecutionTime(res.execution_time_ms);
    } catch (err: any) {
      setExecutionSuccess(false);
      setConsoleOutput(err.message || "Failed to execute code in sandbox.");
      setExecutionTime(0);
    } finally {
      setIsRunning(false);
    }
  };

  // Submit code to AI Interviewer
  const handleReviewCode = async () => {
    if (!code.trim()) return;
    setIsSubmittingReview(true);
    try {
      const res = await submitCodeForReview(sessionId, {
        code,
        language,
        problemTitle: `${selectedProblem.number || ""}. ${selectedProblem.title}`,
        candidateNotes: candidateNotes || `LeetCode challenge solution for ${selectedProblem.title}`,
      });
      setAiReview(res);

      if (onCodeSubmittedToChat) {
        const candidateSummary = `[Submitted Solution for LeetCode ${selectedProblem.number || ""}: ${selectedProblem.title}]\nLanguage: ${language.toUpperCase()}\n\`\`\`${language}\n${code}\n\`\`\``;
        onCodeSubmittedToChat(candidateSummary, res.ai_response);
      }
    } catch (err: any) {
      alert(err.message || "Could not submit code for AI review.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const difficultyColors = {
    Easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    Medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Hard: "bg-red-500/10 text-red-400 border-red-500/30",
  };

  const lineCount = code.split("\n").length;

  return (
    <div className="flex flex-col h-full bg-nvg-surface/90 border border-white/10 rounded-squircle overflow-hidden backdrop-blur-xl shadow-2xl relative font-body">
      {/* Top Problem & Language Bar */}
      <div className="p-3 bg-white/5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        {/* Dynamic LeetCode Challenge & Difficulty Controls */}
        <div className="flex items-center gap-2">
          {/* Difficulty Dropdown */}
          <div className="flex items-center gap-1.5 bg-dark-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs">
            <span className="text-[11px] text-gray-400 font-medium">Difficulty:</span>
            <select
              value={currentDifficulty}
              onChange={(e) => {
                const newDiff = e.target.value;
                setCurrentDifficulty(newDiff);
                fetchRandomProblem(newDiff);
              }}
              className="bg-transparent font-bold focus:outline-none cursor-pointer text-brand-300"
            >
              <option value="Easy" className="bg-dark-900 text-emerald-400">
                Easy
              </option>
              <option value="Medium" className="bg-dark-900 text-amber-400">
                Medium
              </option>
              <option value="Hard" className="bg-dark-900 text-red-400">
                Hard
              </option>
            </select>
          </div>

          {/* Random Problem Fetcher Button */}
          <button
            type="button"
            onClick={() => fetchRandomProblem(currentDifficulty)}
            disabled={isLoadingProblem}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600/30 to-indigo-600/30 hover:from-brand-600/50 hover:to-indigo-600/50 border border-brand-500/40 text-brand-200 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
            title="Fetch another random LeetCode problem matching difficulty"
          >
            <Shuffle className={`w-3.5 h-3.5 text-brand-400 ${isLoadingProblem ? "animate-spin" : ""}`} />
            <span>{isLoadingProblem ? "Generating..." : "Random Problem"}</span>
          </button>

          {/* Difficulty badge */}
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
              difficultyColors[selectedProblem.difficulty as keyof typeof difficultyColors] || difficultyColors.Medium
            }`}
          >
            {selectedProblem.difficulty}
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[11px] font-mono text-gray-400 bg-white/5 border border-white/5">
            {selectedProblem.category || "Algorithms"}
          </span>
        </div>

        {/* Language & Actions */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="bg-dark-800 border border-white/10 text-xs text-brand-300 font-mono rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="python">Python 3</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
            <option value="go">Go</option>
          </select>

          <button
            type="button"
            onClick={handleResetCode}
            title="Reset code to starter template"
            className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white border border-white/10 transition-all text-xs flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleCopyCode}
            title="Copy Code"
            className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-white border border-white/10 transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Split: Left Problem Statement & Right Editor */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
        {/* Left: Problem Details Panel (5 cols) */}
        <div className="md:col-span-5 border-r border-white/10 flex flex-col min-h-0 bg-dark-950/70 overflow-hidden">
          {/* Tab buttons */}
          <div className="flex items-center gap-2 px-3 pt-2 border-b border-white/5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("description")}
              className={`pb-2 px-2 font-medium border-b-2 transition-all ${
                activeTab === "description"
                  ? "border-brand-500 text-white font-bold"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Description
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("testcases")}
              className={`pb-2 px-2 font-medium border-b-2 transition-all flex items-center gap-1 ${
                activeTab === "testcases"
                  ? "border-brand-500 text-white font-bold"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Test Cases ({selectedProblem.examples?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("hints")}
              className={`pb-2 px-2 font-medium border-b-2 transition-all flex items-center gap-1 ${
                activeTab === "hints"
                  ? "border-brand-500 text-white font-bold"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              <Lightbulb className="w-3 h-3 text-amber-400" /> Hints ({selectedProblem.hints?.length || 0})
            </button>
          </div>

          {/* Problem Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-gray-300 leading-relaxed font-sans">
            {activeTab === "description" ? (
              <>
                {/* Title & Stats */}
                <div>
                  <h3 className="text-base font-bold text-white mb-1">
                    {selectedProblem.number ? `${selectedProblem.number}. ` : ""}{selectedProblem.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="text-gray-500">Target Level:</span>
                    <span className="text-gray-300 font-mono">{selectedProblem.difficulty}</span>
                    {selectedProblem.acceptance && (
                      <>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-500">Acceptance:</span>
                        <span className="text-gray-300 font-mono">{selectedProblem.acceptance}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Problem Statement */}
                <div className="whitespace-pre-line text-gray-200">
                  {selectedProblem.description}
                </div>

                {/* Examples */}
                {selectedProblem.examples && selectedProblem.examples.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="font-bold text-white text-xs">Examples:</div>
                    {selectedProblem.examples.map((ex, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-dark-900 border border-white/5 space-y-1 font-mono text-[11px]"
                      >
                        <div className="text-gray-400">
                          <strong className="text-gray-300">Example {i + 1}:</strong>
                        </div>
                        <div>
                          <span className="text-brand-300">Input:</span> {ex.input}
                        </div>
                        <div>
                          <span className="text-emerald-400">Output:</span> {ex.output}
                        </div>
                        {ex.explanation && (
                          <div className="text-gray-400 font-sans text-[11px] pt-1">
                            <span className="text-gray-300 font-medium">Explanation:</span> {ex.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Constraints */}
                {selectedProblem.constraints && selectedProblem.constraints.length > 0 && (
                  <div className="pt-2">
                    <div className="font-bold text-white text-xs mb-1.5">Constraints:</div>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-gray-400 font-mono">
                      {selectedProblem.constraints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : activeTab === "testcases" ? (
              /* Test Cases Tab */
              <div className="space-y-3 pt-1">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Public Validation Test Cases
                  </span>
                  <span className="text-[11px] text-gray-400 font-mono font-normal">
                    {selectedProblem.examples?.length || 0} Cases
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-normal">
                  Your code will be evaluated against these input cases when you click <strong className="text-gray-200">Run Tests</strong>.
                </p>
                {selectedProblem.examples?.map((tc, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-dark-900 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-dark-800 text-brand-300 font-mono text-[10px] font-bold border border-white/5">
                        Case {idx + 1}
                      </span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="p-2 rounded-lg bg-dark-950/80 border border-white/5 text-gray-300">
                        <span className="text-gray-500 select-none">input = </span>{tc.input}
                      </div>
                      <div className="p-2 rounded-lg bg-dark-950/80 border border-white/5 text-emerald-400">
                        <span className="text-gray-500 select-none">expected = </span>{tc.output}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Hints Tab */
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>Interview Strategy Hints</span>
                </div>
                {selectedProblem.hints && selectedProblem.hints.length > 0 ? (
                  selectedProblem.hints.map((hint, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-200/90 text-xs leading-relaxed"
                    >
                      <strong>Hint {idx + 1}:</strong> {hint}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">No hints provided for this challenge. Think about time and space trade-offs.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Code Editor & Execution Sandbox (7 cols) */}
        <div className="md:col-span-7 flex flex-col min-h-0 bg-dark-950 overflow-hidden">
          {/* Editor Header */}
          <div className="px-4 py-2 bg-dark-950/90 border-b border-white/5 flex items-center justify-between text-xs text-gray-400 font-mono">
            <span className="text-gray-300 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-brand-400" /> Solution.{language === "python" ? "py" : language === "javascript" ? "js" : language === "typescript" ? "ts" : language === "java" ? "java" : language === "cpp" ? "cpp" : "go"}
            </span>
            <span className="text-[10px] text-gray-500">
              <kbd className="px-1 py-0.5 rounded bg-dark-800 border border-white/10 text-gray-300">Tab</kbd> indent • <kbd className="px-1 py-0.5 rounded bg-dark-800 border border-white/10 text-gray-300">Ctrl+Enter</kbd> run
            </span>
          </div>

          {/* Code Area with Line Numbers */}
          <div className="flex-1 relative flex overflow-hidden bg-dark-950 font-mono text-xs">
            {/* Line Numbers */}
            <div className="w-10 select-none py-3 text-right pr-3 font-mono text-gray-600 bg-dark-950/90 border-r border-white/5 overflow-hidden">
              {Array.from({ length: Math.max(15, lineCount) }).map((_, i) => (
                <div key={i} className="leading-relaxed">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Editable Textarea */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="flex-1 p-3 bg-transparent text-gray-100 placeholder-gray-600 resize-none focus:outline-none font-mono text-xs leading-relaxed overflow-y-auto selection:bg-brand-500/30"
              placeholder="# Write your solution here..."
            />
          </div>

          {/* Action Execution Bar */}
          <div className="p-3 bg-dark-950/80 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunCode}
                disabled={isRunning}
                className="px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-gray-200 border border-white/10 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 text-emerald-400 fill-emerald-400 ${isRunning ? "animate-spin" : ""}`} />
                {isRunning ? "Running..." : "Run Tests"}
              </button>

              {executionTime !== null && (
                <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-500" /> {executionTime}ms
                </span>
              )}
            </div>

            {/* Submit Solution to Interviewer */}
            <button
              type="button"
              onClick={handleReviewCode}
              disabled={isSubmittingReview || !code.trim()}
              className="px-5 py-2.5 rounded-full bg-nvg-lime hover:brightness-105 !text-black text-xs font-heading font-extrabold shadow-neo-lime flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isSubmittingReview ? "animate-spin" : ""}`} />
              {isSubmittingReview ? "AI Analyzing Solution..." : "Submit Solution to Interviewer"}
            </button>
          </div>

          {/* Output Drawer / Terminal Console */}
          {consoleOutput !== null && (
            <div className="max-h-36 bg-dark-950 border-t border-white/10 p-3 overflow-y-auto font-mono text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/5 mb-1.5 text-[11px]">
                <span className="flex items-center gap-1.5 text-gray-400 font-semibold">
                  <Terminal className="w-3.5 h-3.5 text-brand-400" /> Output Console
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    executionSuccess ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {executionSuccess ? "Finished" : "Runtime Error"}
                </span>
              </div>
              <pre className="text-gray-300 whitespace-pre-wrap leading-relaxed text-[11px]">
                {consoleOutput}
              </pre>
            </div>
          )}

          {/* AI Code Review Telemetry Card */}
          {aiReview && (
            <div className="p-3.5 bg-gradient-to-r from-brand-950/60 to-dark-900 border-t border-brand-500/30 text-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  <span>AI Rubric Verdict:</span>
                  <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 text-[10px] border border-brand-500/30 font-semibold">
                    {aiReview.verdict}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-dark-800 text-emerald-300 border border-emerald-500/30">
                    Time: {aiReview.time_complexity}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-dark-800 text-cyan-300 border border-cyan-500/30">
                    Space: {aiReview.space_complexity}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-dark-800 text-amber-300 border border-amber-500/30 font-bold">
                    Score: {aiReview.correctness_score}/100
                  </span>
                </div>
              </div>

              {/* Edge Cases Missed */}
              {aiReview.edge_cases_missed?.length > 0 && (
                <div className="mt-1.5 text-[11px] text-amber-300/90 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Edge cases to check:</strong> {aiReview.edge_cases_missed.join(", ")}
                  </span>
                </div>
              )}

              {/* Optimization Hints */}
              {aiReview.optimizations?.length > 0 && (
                <div className="mt-1 text-[11px] text-gray-300 flex items-start gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Optimization:</strong> {aiReview.optimizations.join("; ")}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
