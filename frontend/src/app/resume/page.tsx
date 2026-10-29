"use client";

import { useEffect, useState, useRef } from "react";
import { getCandidateProfile, CandidateProfile, uploadPdfResume } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  FileText,
  Upload,
  CheckCircle2,
  Cpu,
  Code,
  Briefcase,
  GraduationCap,
  Sparkles,
  User,
  Mail,
  Phone,
  Folder,
  HelpCircle,
  Award,
  ArrowRight,
  Database,
  Layers,
  ShieldCheck,
  Loader2,
} from "lucide-react";

export default function ResumePage() {
  const { user } = useAuth();
  const currentUserId = user?.user_id || (typeof window !== "undefined" ? localStorage.getItem("preppr_user_id") : null) || "user_101";

  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadExisting() {
      try {
        const data = await getCandidateProfile(currentUserId);
        if (data && (data.skills?.length || data.candidate_name || data.projects?.length || data.past_roles?.length || data.experience?.length)) {
          setProfile(data);
        }
      } catch (err) {
        // No existing profile on file, fine for fresh user
      }
    }
    loadExisting();
  }, [currentUserId]);

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setErrorMsg("Only PDF files (.pdf) are supported.");
      setSelectedFile(null);
      return;
    }

    setErrorMsg(null);
    setStatusMsg(null);
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setErrorMsg("Please choose or drop a PDF resume first.");
      return;
    }

    setUploading(true);
    setStatusMsg(null);
    setErrorMsg(null);

    try {
      const uploadData = await uploadPdfResume(selectedFile, currentUserId);
      setStatusMsg("Successfully parsed, chunked, and embedded into pgvector!");
      setProfile(uploadData);
    } catch (err: any) {
      console.error("Resume Extraction Error:", err);
      setErrorMsg(err.message || "An unexpected error occurred while parsing the resume.");
    } finally {
      setUploading(false);
    }
  };

  const skillColorVariants = [
    "bg-nvg-purple/20 text-nvg-lavender border-nvg-purple/40",
    "bg-nvg-lime/20 text-nvg-lime border-nvg-lime/40",
    "bg-nvg-orange/20 text-nvg-orange border-nvg-orange/40",
    "bg-nvg-yellow/20 text-nvg-yellow border-nvg-yellow/40",
    "bg-nvg-light-blue/20 text-nvg-light-blue border-nvg-light-blue/40",
  ];

  return (
    <div className="min-h-screen bg-nvg-off-black text-nvg-off-white font-body pt-32 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Editorial Header */}
        <div className="squircle-card p-8 sm:p-10 bg-nvg-surface/80 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-nvg-lime/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-nvg-purple/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-nvg-lime/20 border border-nvg-lime/40 text-nvg-lime text-xs font-bold uppercase tracking-wider mb-4">
              <Database className="w-3.5 h-3.5" />
              <span>pgvector RAG Extraction</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-white">
              Resume <span className="text-nvg-lime">Intelligence</span>.
            </h1>
            <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-3xl font-body leading-relaxed">
              Upload your PDF resume to extract key competencies, construct dense pgvector embeddings, and empower the interview agent with rich context from your career milestones.
            </p>
          </div>
        </div>

        {/* Bento Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Upload & Architecture Box (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="squircle-card p-6 sm:p-8 bg-nvg-surface/70 border border-white/10">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <span className="text-xs font-heading font-bold text-nvg-lime uppercase tracking-wider block">
                    Upload Center
                  </span>
                  <h2 className="text-xl font-heading font-bold text-white mt-1">Select Resume PDF</h2>
                </div>
                <div className="w-9 h-9 rounded-full bg-nvg-lime text-nvg-off-black flex items-center justify-center font-heading font-black text-sm">
                  PDF
                </div>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-squircle p-8 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? "border-nvg-lime bg-nvg-lime/10"
                      : "border-white/15 bg-nvg-off-black/50 hover:border-nvg-lime/50 hover:bg-white/5"
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={(e) => handleFileChange(e.target.files?.[0])}
                  />
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-nvg-lime">
                    <Upload className="w-6 h-6" />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="text-nvg-lime font-heading font-bold text-base">{selectedFile.name}</p>
                      <p className="text-gray-400 text-xs mt-1">{(selectedFile.size / 1024).toFixed(1)} KB · Ready to index</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-white font-heading font-bold text-base mb-1">Click to browse or drop resume</p>
                      <p className="text-gray-400 text-xs">Single-page or multi-page PDF up to 10MB</p>
                    </>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                {statusMsg && (
                  <div className="p-3.5 rounded-2xl bg-nvg-green/15 border border-nvg-green/30 text-nvg-lime text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-nvg-green flex-shrink-0" />
                    <span>{statusMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-4 rounded-full bg-nvg-lime hover:bg-white text-nvg-off-black font-heading font-extrabold text-sm shadow-neo-lime transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Chunking & Vectorizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Index into pgvector RAG</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Architecture Explainer Card */}
            <div className="squircle-card p-6 bg-nvg-surface/50 border border-white/5">
              <h3 className="font-heading font-bold text-sm text-white mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-nvg-purple" /> How RAG Enhancement Works
              </h3>
              <ul className="space-y-2.5 text-xs text-gray-400 font-body leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-nvg-purple mt-1.5 flex-shrink-0" />
                  <span><strong>Recursive Parsing:</strong> PDF text is chunked into 300-token semantic blocks with sliding window context.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-nvg-orange mt-1.5 flex-shrink-0" />
                  <span><strong>Vector Embeddings:</strong> Text-embedding-3 vectors are stored in PostgreSQL with the pgvector cosine index.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-nvg-lime mt-1.5 flex-shrink-0" />
                  <span><strong>Targeted Interrogation:</strong> When you answer behavioral questions, the agent queries matching work history chunks for real-time verification.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Parsed Candidate Details (7 cols) */}
          <div className="lg:col-span-7">
            <div className="squircle-card p-6 sm:p-8 bg-nvg-surface/70 border border-white/10 min-h-full">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-xs font-heading font-bold text-nvg-yellow uppercase tracking-wider block">
                    Persona Profile
                  </span>
                  <h2 className="text-xl font-heading font-bold text-white mt-1">Extracted Candidate Profile</h2>
                </div>
                {profile && (
                  <span className="px-3 py-1 rounded-full bg-nvg-green/20 border border-nvg-green/40 text-nvg-green text-xs font-heading font-bold">
                    Active in Memory
                  </span>
                )}
              </div>

              {profile ? (
                <div className="space-y-6">
                  {/* Candidate Primary Card */}
                  <div className="p-5 rounded-2xl bg-nvg-off-black/60 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-heading font-extrabold text-white">
                        {profile.candidate_name || "Extracted Candidate"}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-2">
                        {profile.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-nvg-light-blue" />
                            <span>{profile.email}</span>
                          </div>
                        )}
                        {profile.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-nvg-lime" />
                            <span>{profile.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-4 py-2 rounded-xl bg-nvg-lime/15 border border-nvg-lime/30 text-nvg-lime text-center self-start sm:self-auto">
                      <span className="block text-xl font-heading font-extrabold">{profile.experience_years || 0}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider">Years Exp</span>
                    </div>
                  </div>

                  {/* Skills Grid */}
                  <div>
                    <h4 className="text-xs font-heading font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Code className="w-4 h-4 text-nvg-purple" /> Extracted Skill Taxonomy
                    </h4>
                    {profile.skills && profile.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {profile.skills.map((skill: any, i: number) => {
                          const skillLabel = typeof skill === "object" && skill !== null ? (skill.name || JSON.stringify(skill)) : String(skill);
                          const variant = skillColorVariants[i % skillColorVariants.length];
                          return (
                            <span
                              key={i}
                              className={`px-3 py-1.5 rounded-full border text-xs font-heading font-bold transition-transform hover:scale-105 ${variant}`}
                            >
                              {skillLabel}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-xs">No explicit skills extracted from text.</p>
                    )}
                  </div>

                  {/* Previous Roles & Experience */}
                  {((profile.past_roles && profile.past_roles.length > 0) || (profile.experience && profile.experience.length > 0)) && (
                    <div>
                      <h4 className="text-xs font-heading font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-nvg-orange" /> Past Experience & Roles
                      </h4>
                      <div className="space-y-2.5">
                        {(profile.past_roles?.length ? profile.past_roles : profile.experience || []).map((roleItem: any, i: number) => {
                          const isObj = typeof roleItem === "object" && roleItem !== null;
                          const roleTitle = isObj ? (roleItem.role || roleItem.title || roleItem.position || "Role") : String(roleItem);
                          const roleCompany = isObj ? (roleItem.company || roleItem.organization) : null;
                          const roleDuration = isObj ? roleItem.duration : null;
                          const highlights = isObj && Array.isArray(roleItem.highlights) ? roleItem.highlights : [];

                          return (
                            <div key={i} className="p-3.5 rounded-2xl bg-nvg-off-black/50 border border-white/5 text-gray-200 text-xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-nvg-orange flex-shrink-0" />
                                  <span className="font-heading font-bold text-white">{roleTitle}</span>
                                  {roleCompany && <span className="text-gray-400">at {roleCompany}</span>}
                                </div>
                                {roleDuration && <span className="text-[10px] text-gray-500 font-mono">{roleDuration}</span>}
                              </div>
                              {highlights.length > 0 && (
                                <ul className="mt-2 pl-4 list-disc space-y-1 text-gray-400 text-[11px]">
                                  {highlights.map((h: any, hIdx: number) => (
                                    <li key={hIdx}>{typeof h === "object" ? JSON.stringify(h) : String(h)}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Projects */}
                  {profile.projects && profile.projects.length > 0 && (
                    <div>
                      <h4 className="text-xs font-heading font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Folder className="w-4 h-4 text-nvg-yellow" /> Noteworthy Projects
                      </h4>
                      <div className="space-y-2.5">
                        {profile.projects.map((proj: any, i: number) => {
                          const isObj = typeof proj === "object" && proj !== null;
                          const title = isObj ? (proj.title || proj.name || "Project") : String(proj);
                          const desc = isObj ? proj.description : null;

                          return (
                            <div key={i} className="p-3.5 rounded-2xl bg-nvg-off-black/50 border border-white/5 text-gray-300 text-xs">
                              <div className="font-heading font-bold text-white text-xs flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-nvg-yellow flex-shrink-0" />
                                <span>{title}</span>
                              </div>
                              {desc && (
                                <p className="text-gray-400 text-[11px] mt-1 leading-relaxed pl-3.5 font-body">
                                  {desc}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {profile.education && profile.education.length > 0 && (
                    <div>
                      <h4 className="text-xs font-heading font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-nvg-light-blue" /> Education & Academic Background
                      </h4>
                      <div className="space-y-2.5">
                        {profile.education.map((edu: any, i: number) => {
                          const isObj = typeof edu === "object" && edu !== null;
                          const degree = isObj ? (edu.degree || edu.title || "Degree") : String(edu);
                          const inst = isObj ? edu.institution : null;
                          const year = isObj ? edu.year : null;

                          return (
                            <div key={i} className="p-3.5 rounded-2xl bg-nvg-off-black/50 border border-white/5 text-gray-300 text-xs flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-nvg-light-blue flex-shrink-0" />
                                <span className="font-heading font-bold text-white">{degree}</span>
                                {inst && <span className="text-gray-400">· {inst}</span>}
                              </div>
                              {year && <span className="text-[10px] text-gray-500 font-mono">{year}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Suggested Questions */}
                  {profile.suggested_interview_questions && profile.suggested_interview_questions.length > 0 && (
                    <div>
                      <h4 className="text-xs font-heading font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-nvg-lime" /> Tailored Behavioral Rubric Questions
                      </h4>
                      <div className="space-y-2.5">
                        {profile.suggested_interview_questions.map((q: any, i: number) => {
                          const qText = typeof q === "object" && q !== null ? (q.question || q.text || JSON.stringify(q)) : String(q);
                          return (
                            <div key={i} className="p-4 rounded-2xl bg-nvg-lime/10 border border-nvg-lime/25 text-gray-200 text-xs leading-relaxed flex items-start gap-3">
                              <span className="px-2 py-0.5 rounded-md bg-nvg-lime text-nvg-off-black font-heading font-bold text-[10px] mt-0.5">
                                Q{i + 1}
                              </span>
                              <span className="font-body">{qText}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-squircle bg-nvg-off-black/30 flex flex-col items-center justify-center p-6">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 mb-4">
                    <User className="w-8 h-8" />
                  </div>
                  <h4 className="font-heading font-bold text-white text-base">No profile vectorized yet</h4>
                  <p className="text-gray-400 text-xs max-w-sm mt-1.5 font-body">
                    Upload your PDF resume on the left to inspect parsed competencies, experience timeline, and generated inquiry rubrics.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
