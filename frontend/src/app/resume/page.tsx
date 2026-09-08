"use client";

import { useEffect, useState } from "react";
import { uploadResumeChunks, getCandidateProfile } from "@/lib/api";
import { FileText, Upload, CheckCircle2, Cpu, Code, Briefcase, GraduationCap, Sparkles } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";

export default function ResumePage() {
  const { user } = useAuth();
  const [userId, setUserId] = useState("user_101");
  const [resumeText, setResumeText] = useState(
    "Senior Software Engineer with 5+ years of experience building distributed microservices using Python, FastAPI, React, and PostgreSQL. Architected low-latency streaming platforms using LiveKit WebRTC and Redis."
  );
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const savedId = user?.user_id || localStorage.getItem("preppr_user_id") || "user_101";
    setUserId(savedId);
    fetchProfile(savedId);
  }, [user]);

  async function fetchProfile(id: string) {
    try {
      const data = await getCandidateProfile(id);
      setProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setStatusMsg("");

    try {
      // Split raw resume text into semantic paragraph chunks
      const chunks = resumeText
        .split("\n\n")
        .map((c) => c.trim())
        .filter((c) => c.length > 10);

      const payloadChunks = chunks.length > 0 ? chunks : [resumeText];

      const res = await uploadResumeChunks(userId, payloadChunks);
      setStatusMsg(`Successfully embedded ${res.chunks_processed} chunks into pgvector!`);
      fetchProfile(userId);
    } catch (err: any) {
      setStatusMsg("Error indexing resume chunks.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ProtectedRoute title="Resume & Profile RAG" description="Sign in to upload your resume, manage ATS parsing, and generate customized interview questions.">
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

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                Paste Resume Text Content
              </label>
              <textarea
                rows={8}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                className="w-full bg-dark-800 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-xs font-mono leading-relaxed"
                placeholder="Paste work experience, projects, and technical skills..."
              />
            </div>

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

        {/* Right Column: Parsed Candidate JSON Profile */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-400" /> Extracted Candidate Profile JSON
          </h2>

          {profile ? (
            <div className="space-y-6 text-sm">
              {/* Skills */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Code className="w-4 h-4 text-brand-400" /> Detected Technical Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.skills?.map((skill: string, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Work Experience */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-cyan-400" /> Experience Highlights
                </h3>
                {profile.experience?.map((exp: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-dark-800/60 border border-white/5">
                    <div className="flex justify-between text-xs font-bold text-white mb-1">
                      <span>{exp.role}</span>
                      <span className="text-gray-400">{exp.company}</span>
                    </div>
                    <p className="text-xs text-gray-400">{exp.highlights?.[0]}</p>
                  </div>
                ))}
              </div>

              {/* Education */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-emerald-400" /> Education
                </h3>
                {profile.education?.map((edu: any, i: number) => (
                  <div key={i} className="text-xs text-gray-300">
                    <span className="font-semibold text-white">{edu.degree}</span> – {edu.institution} ({edu.year})
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-xs">No profile parsed yet. Submit resume text above.</p>
          )}
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
