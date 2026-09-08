"use client";

import { useState, useRef, useEffect } from "react";
import { uploadPdfResume, uploadResumeChunks, getCandidateProfile, CandidateProfile } from "@/lib/api";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Code,
  Briefcase,
  User,
  Mail,
  Phone,
  HelpCircle,
  FileUp,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";

export default function ResumePage() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const extractedProfile = await uploadPdfResume(selectedFile);
      setProfile(extractedProfile);
      setSuccessMsg(`Successfully parsed resume for ${extractedProfile.candidate_name || "Candidate"}!`);
    } catch (err: any) {
      console.error("Resume Extraction Error:", err);
      setErrorMsg(err.message || "An unexpected error occurred while parsing the resume.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ProtectedRoute
      title="PDF Resume Extraction & RAG Pipeline"
      description="Upload your PDF resume to extract structured profile information and candidate interview questions."
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-cyan-400" /> PDF Resume Extraction & RAG Pipeline
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Upload your PDF resume to extract structured profile information and candidate interview questions via PyMuPDF and AI parser.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: PDF Upload Area */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-400" /> Select or Drop Resume PDF
              </h2>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? "border-brand-500 bg-brand-500/10"
                      : selectedFile
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : "border-white/20 bg-dark-800/40 hover:border-white/40"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => handleFileChange(e.target.files?.[0])}
                    className="hidden"
                  />

                  <FileUp className="w-12 h-12 mx-auto mb-3 text-brand-400" />

                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-semibold text-emerald-400">{selectedFile.name}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Ready to extract
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        Drag & drop your PDF resume here, or <span className="text-brand-400 underline">browse</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Supports PDF documents (.pdf)</p>
                    </div>
                  )}
                </div>

                {/* Error Alert */}
                {errorMsg && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Extraction Error</span>
                      <span>{errorMsg}</span>
                    </div>
                  </div>
                )}

                {/* Success Alert */}
                {successMsg && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Success</span>
                      <span>{successMsg}</span>
                    </div>
                  </div>
                )}

                {/* Submit Button with Loading State */}
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      Extracting Resume Data...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Extract Candidate Profile
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-white/5 text-xs text-gray-400 border border-white/5">
              <span className="font-semibold text-gray-300 block mb-1">How it works:</span>
              1. PyMuPDF extracts raw text from your PDF document pages.<br />
              2. The AI parser extracts your skills, experience, and generates customized interview questions.
            </div>
          </div>

          {/* Right Column: Candidate Profile Display */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-amber-400" /> Extracted Candidate Details
            </h2>

            {uploading ? (
              <div className="py-20 text-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-brand-400 mx-auto" />
                <p className="text-sm font-semibold text-white">Analyzing Resume...</p>
                <p className="text-xs text-gray-400">Extracting skills, past experience, and suggested interview questions.</p>
              </div>
            ) : profile ? (
              <div className="space-y-6 text-sm">
                {/* Candidate Info Header */}
                <div className="p-4 rounded-xl bg-dark-800/80 border border-white/10 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        {profile.candidate_name || "Name Not Specified"}
                      </h3>
                      {profile.experience_years !== null && profile.experience_years !== undefined && (
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                          {profile.experience_years} Years Experience
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-4 text-xs text-gray-300 border-t border-white/5">
                    {profile.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-brand-400" /> {profile.email}
                      </span>
                    )}
                    {profile.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" /> {profile.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Technical Skills */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-brand-400" /> Technical & Core Skills
                  </h3>
                  {profile.skills && profile.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No skills explicitly extracted.</p>
                  )}
                </div>

                {/* Past Roles */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-cyan-400" /> Previous Roles & Experience
                  </h3>
                  {profile.past_roles && profile.past_roles.length > 0 ? (
                    <div className="space-y-2">
                      {profile.past_roles.map((role, i) => (
                        <div key={i} className="p-3 rounded-lg bg-dark-800/60 border border-white/5 text-xs text-gray-200">
                          {typeof role === "string" ? role : (role as any).role || (role as any).title || JSON.stringify(role)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No previous roles extracted.</p>
                  )}
                </div>

                {/* Suggested Interview Questions */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-emerald-400" /> Suggested Interview Questions
                  </h3>
                  {profile.suggested_interview_questions && profile.suggested_interview_questions.length > 0 ? (
                    <div className="space-y-2.5">
                      {profile.suggested_interview_questions.map((question, i) => (
                        <div
                          key={i}
                          className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-gray-200 flex items-start gap-2.5"
                        >
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold shrink-0">
                            Q{i + 1}
                          </span>
                          <p className="leading-relaxed">{question}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No questions generated yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center space-y-2">
                <FileUp className="w-12 h-12 text-gray-600 mx-auto" />
                <p className="text-sm font-medium text-gray-300">No Resume Uploaded</p>
                <p className="text-xs text-gray-500">
                  Upload a PDF resume on the left to extract candidate skills and suggested interview questions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
