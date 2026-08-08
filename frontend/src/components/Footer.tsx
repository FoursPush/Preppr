export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-dark-900/50 py-8 text-center text-xs text-gray-500">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>© 2026 Preppr – AI-Powered Real-Time Voice & Text Interview Trainer.</p>
        <p className="flex items-center gap-4">
          <span className="text-gray-400">FastAPI</span> • 
          <span className="text-gray-400">Next.js 14</span> • 
          <span className="text-gray-400">pgvector RAG</span> • 
          <span className="text-gray-400">LiveKit WebRTC</span>
        </p>
      </div>
    </footer>
  );
}
