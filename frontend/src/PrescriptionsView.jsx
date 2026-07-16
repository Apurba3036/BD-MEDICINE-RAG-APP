import { useState, useEffect } from "react";
import { getPrescriptions } from "./api";
import { FolderHeart, FileImage, Calendar, ExternalLink, Loader2, Inbox } from "lucide-react";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-BD", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export default function PrescriptionsView({ userEmail }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userEmail) return;
    setLoading(true);
    getPrescriptions(userEmail)
      .then(setPrescriptions)
      .catch(() => setError("Failed to load prescriptions."))
      .finally(() => setLoading(false));
  }, [userEmail]);

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans bg-slate-50">
      <header className="mb-10 flex items-center gap-4">
        <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center">
          <FolderHeart size={28} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Prescriptions</h2>
          <p className="text-slate-500 font-medium mt-1">Your securely stored medical documents</p>
        </div>
      </header>

      {!userEmail ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <Inbox size={32} className="text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Not logged in</h3>
          <p className="text-slate-500">Please log in to view your uploaded prescriptions.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="font-medium">Loading your documents…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-red-100 shadow-sm max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4 border border-red-100">
            <Inbox size={32} className="text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Error</h3>
          <p className="text-red-500">{error}</p>
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4 border border-indigo-100">
            <FileImage size={32} className="text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No prescriptions yet</h3>
          <p className="text-slate-500">Upload a prescription in the chat to have it saved here automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-8">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-indigo-300 transition-all duration-300 group flex flex-col">
              <div className="aspect-[3/4] w-full bg-slate-100 overflow-hidden relative border-b border-slate-100">
                <img src={rx.image_url} alt={`Prescription ${rx.id}`} loading="lazy" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/10 transition-colors pointer-events-none" />
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-100 w-fit">
                  <Calendar size={14} className="text-indigo-500" />
                  <span>{formatDate(rx.uploaded_at)}</span>
                </div>
                <a 
                  href={rx.image_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors"
                >
                  <ExternalLink size={14} /> Open Original
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
