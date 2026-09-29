"use client";

import { useEffect, useState, useRef } from "react";
import { uploadResumeChunks, getCandidateProfile, CandidateProfile, uploadPdfResume } from "@/lib/api";
import { FileText, Upload, CheckCircle2, Cpu, Code, Briefcase, GraduationCap, Sparkles, User, Mail, Phone, Folder, HelpCircle, Award } from "lucide-react";

export default function ResumePage() {
  const [userId, setUserId] = useState("user_101");
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async (id: string) => {
    try {
      const data = await getCandidateProfile(id);
      setProfile(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setErrorMsg("Only PDF files (.pdf) are supported.");
      setSelectedFile(null);
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
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
      setErrorMsg("Please select a PDF resume file to upload.");
      return;
    }

    setUploading(true);
    setStatusMsg("");
    setErrorMsg(null);

    try {
      const uploadData = await uploadPdfResume(selectedFile, userId);
      setStatusMsg("Successfully parsed and indexed PDF resume!");
      setProfile(uploadData);
    } catch (err: any) {
      console.error("Resume Extraction Error:", err);
      setErrorMsg(err.message || "An unexpected error occurred while parsing the resume.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <FileText className="w-8 h-8 text-cyan-400" /> Resume & Persona RAG Processing
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Upload your resume to extract skills and store vector embeddings in pgvector for personalized mock interview questions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Upload Form */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand-400" /> Upload & Index Resume Content
          </h2>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                isDragOver ? "border-brand-500 bg-brand-500/10" : "border-white/20 bg-dark-800 hover:border-brand-400 hover:bg-dark-700"
              }`}
            >
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
              <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragOver ? "text-brand-400" : "text-gray-400"}`} />
              {selectedFile ? (
                <p className="text-brand-300 font-semibold text-sm">{selectedFile.name}</p>
              ) : (
                <>
                  <p className="text-white font-semibold text-sm mb-1">Click to upload or drag and drop</p>
                  <p className="text-gray-400 text-xs">PDF format only (Max 5MB)</p>
                </>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {errorMsg}
              </div>
            )}

            {statusMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {statusMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {uploading ? "Chunking & Embedding..." : <><Sparkles className="w-4 h-4" /> Index into pgvector RAG</>}
            </button>
          </form>
        </div>

        {/* Right Column: Parsed Candidate Details */}
        <div className="p-6 rounded-2xl bg-[#1a1d27] border border-white/5 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <User className="w-6 h-6 text-yellow-500" /> Extracted Candidate Details
          </h2>

          {profile ? (
            <div className="space-y-8 text-sm">
              {/* Profile Card */}
              <div className="p-5 rounded-xl bg-[#1f2330] border border-white/5 shadow-sm">
                <h3 className="text-xl font-extrabold text-white mb-2">{profile.candidate_name || "Unknown Candidate"}</h3>
                <div className="inline-block px-3 py-1 rounded-full bg-cyan-900/40 border border-cyan-800 text-cyan-400 text-xs font-bold mb-4">
                  {profile.experience_years || 0} Years Experience
                </div>
                
                <div className="h-px bg-white/5 w-full mb-4"></div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-gray-300 text-sm">
                  {profile.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" /> {profile.email}
                    </div>
                  )}
                  {profile.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-500" /> {profile.phone}
                    </div>
                  )}
                </div>
              </div>

              {/* Skills */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Code className="w-5 h-5 text-gray-400" /> TECHNICAL & CORE SKILLS
                </h3>
                {profile.skills && profile.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5">
                    {profile.skills.map((skill: string, i: number) => (
                      <span
                        key={i}
                        className="px-3.5 py-1.5 rounded-lg bg-[#232736] border border-[#303649] text-gray-200 text-sm font-medium hover:bg-[#2a2f42] transition-colors"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No skills extracted.</p>
                )}
              </div>

              {/* Work Experience */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-cyan-400" /> PREVIOUS ROLES & EXPERIENCE
                </h3>
                {profile.past_roles && profile.past_roles.length > 0 ? (
                  <div className="space-y-3">
                    {profile.past_roles.map((role: string, i: number) => (
                      <div key={i} className="p-4 rounded-lg bg-[#1f2330] border border-[#2a2f42] text-gray-200 text-sm font-medium shadow-sm">
                        {role}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No previous roles extracted.</p>
                )}
              </div>

              {/* Projects */}
              {profile.projects && profile.projects.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Folder className="w-5 h-5 text-purple-400" /> PROJECTS
                  </h3>
                  <div className="space-y-3">
                    {profile.projects.map((proj: string, i: number) => (
                      <div key={i} className="p-4 rounded-lg bg-[#1f2330] border border-[#2a2f42] text-gray-200 text-sm shadow-sm">
                        {proj}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {profile.education && profile.education.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-amber-500" /> EDUCATION
                  </h3>
                  <div className="space-y-3">
                    {profile.education.map((edu: string, i: number) => (
                      <div key={i} className="p-4 rounded-lg bg-[#1f2330] border border-[#2a2f42] text-gray-200 text-sm shadow-sm">
                        {edu}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {profile.certifications && profile.certifications.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Award className="w-5 h-5 text-pink-500" /> CERTIFICATIONS
                  </h3>
                  <div className="space-y-3">
                    {profile.certifications.map((cert: string, i: number) => (
                      <div key={i} className="p-4 rounded-lg bg-[#1f2330] border border-[#2a2f42] text-gray-200 text-sm shadow-sm">
                        {cert}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Interview Questions */}
              {profile.suggested_interview_questions && profile.suggested_interview_questions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-emerald-500" /> SUGGESTED INTERVIEW QUESTIONS
                  </h3>
                  <div className="space-y-3">
                    {profile.suggested_interview_questions.map((question: string, i: number) => (
                      <div key={i} className="flex gap-4 p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-gray-200 text-sm">
                        <span className="shrink-0 bg-emerald-900/80 text-emerald-400 font-bold px-2 py-1 rounded text-xs h-fit mt-0.5">
                          Q{i + 1}
                        </span>
                        <p className="leading-relaxed font-medium">{question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-white/5 rounded-xl bg-[#1f2330]">
               <User className="w-12 h-12 text-gray-600 mb-4" />
               <p className="text-gray-400 text-sm">No profile parsed yet.<br/>Upload a PDF resume above to extract candidate details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
