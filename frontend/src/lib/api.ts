import type { LeetCodeProblem } from "./leetcodeProblems";
import type { VisionTelemetry } from "./vision/visionTypes";

export const API_BASE = "/api/backend";

export interface CandidateProfile {
  candidate_name?: string;
  email?: string;
  phone?: string;
  experience_years?: number | string;
  skills?: string[];
  past_roles?: any[];
  suggested_interview_questions?: string[];
  experience?: any[];
  education?: any[];
  projects?: any[];
  [key: string]: any;
}

export interface CodeReviewResponse {
  session_id?: string;
  ai_response: string;
  time_complexity: string;
  space_complexity: string;
  correctness_score: number;
  verdict: string;
  edge_cases_missed: string[];
  optimizations: string[];
}

/** Helper for JSON requests */
async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Request failed with status ${response.status}`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) {
        errorMsg = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return response.json();
}

// ----------------- Auth API -----------------

export async function loginCandidate(email: string, name: string) {
  return apiRequest<any>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, name }),
  });
}

export async function registerCandidate(data: {
  name: string;
  email: string;
  password?: string;
  target_role?: string;
  targetRole?: string;
  experience_level?: string;
  experienceLevel?: string;
  target_companies?: string[];
  targetCompanies?: string[];
  [key: string]: any;
}) {
  return apiRequest<any>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      target_role: data.target_role || data.targetRole || "Software Engineer",
      experience_level: data.experience_level || data.experienceLevel || "Mid-level (2-4 yrs)",
      target_companies: data.target_companies || data.targetCompanies || [],
    }),
  });
}

export async function oauthLogin(
  provider: string,
  tokenOrPayload: string | Record<string, any>
) {
  let body: Record<string, any> = { provider };
  if (typeof tokenOrPayload === "string") {
    body.id_token = tokenOrPayload;
    body.access_token = tokenOrPayload;
  } else {
    body = {
      provider,
      ...tokenOrPayload,
      access_token: tokenOrPayload.accessToken || tokenOrPayload.access_token,
      id_token: tokenOrPayload.idToken || tokenOrPayload.id_token,
    };
  }
  return apiRequest<any>("/api/auth/oauth", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ----------------- Dashboard API -----------------

export async function getDashboardSummary(userId?: string | number | null) {
  if (!userId) return { average_overall_score: 0, average_wpm: 0, total_interviews_completed: 0 };
  return apiRequest<any>(`/api/dashboard/summary/${userId}`);
}

export async function getDashboardHistory(userId?: string | number | null) {
  if (!userId) return { total_sessions: 0, sessions: [] };
  return apiRequest<any>(`/api/dashboard/history/${userId}`);
}

// ----------------- Setup & Companies/Roles API -----------------

export async function getCompanies() {
  return apiRequest<any[]>("/api/companies");
}

export async function getRoles(companyId?: string) {
  const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  return apiRequest<any[]>(`/api/roles${query}`);
}

// ----------------- Interview Session API -----------------

export async function createInterviewSession(payload: {
  user_id: string | number;
  company_name: string;
  role_name: string;
  difficulty: string;
  duration: number;
  role_category?: string;
  [key: string]: any;
}) {
  return apiRequest<any>("/api/interviews", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      user_id: String(payload.user_id),
    }),
  });
}

export async function getInterviewState(sessionId: string) {
  return apiRequest<any>(`/api/interviews/${sessionId}`);
}

export async function submitAnswerTurn(
  sessionId: string,
  arg2:
    | string
    | {
        transcript: string;
        duration_seconds?: number;
        audio_telemetry?: Record<string, any>;
      },
  arg3?: number | Record<string, any> | VisionTelemetry | null,
  arg4?: Record<string, any> | VisionTelemetry | null,
  arg5?: VisionTelemetry | null
) {
  let transcript = "";
  let duration_seconds = 30.0;
  let audio_telemetry: Record<string, any> | undefined = undefined;
  let vision_telemetry: VisionTelemetry | null | undefined = undefined;

  if (typeof arg2 === "string") {
    transcript = arg2;
    if (typeof arg3 === "number") duration_seconds = arg3;
    if (typeof arg4 === "object" && arg4 !== null) audio_telemetry = arg4 as Record<string, any>;
    if (typeof arg5 === "object") vision_telemetry = arg5;
  } else {
    transcript = arg2.transcript;
    duration_seconds = arg2.duration_seconds || 30.0;
    audio_telemetry = arg2.audio_telemetry;
    if (typeof arg3 === "object") vision_telemetry = arg3 as VisionTelemetry;
  }

  return apiRequest<any>(`/api/interviews/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify({
      transcript,
      duration_seconds,
      audio_telemetry,
      vision_telemetry: vision_telemetry || undefined,
    }),
  });
}

export async function submitAudioAnswerTurn(
  sessionId: string,
  audioBlob: Blob,
  visionTelemetry?: VisionTelemetry | null
) {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  if (visionTelemetry) {
    formData.append("vision_telemetry", JSON.stringify(visionTelemetry));
  }

  const response = await fetch(`${API_BASE}/api/interviews/${sessionId}/answer-audio`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorMsg = `Audio turn failed with status ${response.status}`;
    try {
      const err = await response.json();
      if (err.detail) errorMsg = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function transcribeAudio(audioBlob: Blob): Promise<{
  transcript: string;
  wpm: number;
  filler_count: number;
}> {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");

  const response = await fetch(`${API_BASE}/api/v1/stt/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorMsg = `Transcription failed with status ${response.status}`;
    try {
      const err = await response.json();
      if (err.detail) errorMsg = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function endInterviewSession(sessionId: string) {
  return apiRequest<any>(`/api/interviews/${sessionId}/end`, {
    method: "POST",
  });
}

// ----------------- TTS (Text-To-Speech) API -----------------

export async function getTTSStatus() {
  return apiRequest<any>("/api/v1/tts/status");
}

export async function synthesizeSpeech(text: string, voice?: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/api/v1/tts/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    let errorMsg = `TTS synthesis failed with status ${response.status}`;
    try {
      const err = await response.json();
      if (err.detail) errorMsg = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return response.blob();
}

// ----------------- Reports & Evaluation API -----------------

export async function getInterviewEvaluation(sessionId: string) {
  return apiRequest<any>(`/api/interviews/${sessionId}/evaluation`);
}

export async function generatePDFReport(sessionId: string, payload?: any) {
  return apiRequest<any>(`/api/reports/${sessionId}/generate`, {
    method: "POST",
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

export function getPDFReportDownloadUrl(sessionId: string): string {
  return `${API_BASE}/api/reports/${sessionId}`;
}

// ----------------- Resume API -----------------

export async function uploadPdfResume(file: File, userId?: string | number): Promise<CandidateProfile> {
  const formData = new FormData();
  formData.append("file", file);
  if (userId) {
    formData.append("user_id", String(userId));
  }

  const response = await fetch(`${API_BASE}/api/v1/resume/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorMsg = `Upload failed with status ${response.status}`;
    try {
      const err = await response.json();
      if (err.detail) errorMsg = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
    } catch (_) {}
    throw new Error(errorMsg);
  }

  const result = await response.json();
  return result.data || result;
}

export async function uploadResumeChunks(userId: string | number, textChunks: string[]) {
  return apiRequest<any>("/api/resumes/upload", {
    method: "POST",
    body: JSON.stringify({
      user_id: String(userId),
      text_chunks: textChunks,
    }),
  });
}

export async function getCandidateProfile(userId?: string | number) {
  const uid = userId ? String(userId) : "user_101";
  return apiRequest<any>(`/api/resumes/profile?user_id=${encodeURIComponent(uid)}`);
}

// ----------------- DSA / Live Coding API -----------------

export async function fetchDynamicDSAProblem(
  sessionId: string,
  options?: { difficulty?: string; companyName?: string; roleName?: string }
): Promise<LeetCodeProblem> {
  const query = options?.difficulty ? `?difficulty=${encodeURIComponent(options.difficulty)}` : "";
  return apiRequest<LeetCodeProblem>(`/api/interviews/${sessionId}/dsa-challenge${query}`);
}

export async function runCodeSnippet(
  code: string,
  language: string,
  testCases?: any
): Promise<{ success: boolean; output: string; execution_time_ms: number | null }> {
  const res = await apiRequest<any>("/api/interviews/run-code", {
    method: "POST",
    body: JSON.stringify({ code, language, test_cases: testCases }),
  });
  return {
    success: res.success,
    output: res.output,
    execution_time_ms: res.execution_time_ms ?? null,
  };
}

export async function submitCodeForReview(
  sessionId: string,
  payload: {
    code: string;
    language: string;
    problemTitle?: string;
    candidateNotes?: string;
  }
): Promise<CodeReviewResponse> {
  const res = await apiRequest<any>(`/api/interviews/${sessionId}/review-code`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    ...res,
    edge_cases_missed: res.edge_cases_missed || [],
    optimizations: res.optimizations || [],
  };
}
