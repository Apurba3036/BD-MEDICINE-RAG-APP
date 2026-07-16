import { useState, useEffect } from "react";
import { getChatHistory, getSessionMessages } from "./api";
import {
  History, MessageSquare, ChevronRight, ArrowLeft,
  Clock, User, Activity, Loader2, Inbox
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-BD", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ChatHistoryView({ userEmail, onLoadSession }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionMsgs, setSessionMsgs] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userEmail) return;
    setLoading(true);
    getChatHistory(userEmail)
      .then(setSessions)
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));
  }, [userEmail]);

  const openSession = async (session) => {
    setSelectedSession(session);
    setSessionLoading(true);
    try {
      const msgs = await getSessionMessages(session.session_id, userEmail);
      setSessionMsgs(msgs);
    } catch {
      setSessionMsgs([]);
    }
    setSessionLoading(false);
  };

  const handleContinue = () => {
    if (onLoadSession && sessionMsgs.length > 0) {
      onLoadSession(sessionMsgs);
    }
  };

  // ── Session Detail View ──────────────────────────────────────────────────────
  if (selectedSession) {
    return (
      <div className="flex-1 overflow-y-auto font-sans bg-slate-50 relative flex flex-col h-full animate-fade-in">
        <header className="px-8 py-5 border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              className="p-2 -ml-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              onClick={() => setSelectedSession(null)}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare size={18} className="text-indigo-500" />
                Conversation
              </h2>
              <p className="text-sm text-slate-500 mt-0.5 font-medium">{formatDate(selectedSession.started_at)}</p>
            </div>
          </div>
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md rounded-xl text-sm font-semibold transition-all"
            onClick={handleContinue} 
            title="Continue this conversation"
          >
            <span>Continue Chat</span>
            <ChevronRight size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
          {sessionLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <p className="font-medium">Loading messages…</p>
            </div>
          ) : sessionMsgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Inbox size={48} className="text-slate-300" />
              <p className="font-medium">No messages in this session.</p>
            </div>
          ) : (
            sessionMsgs.map((msg, i) => (
              <div key={i} className={`flex gap-4 max-w-4xl animate-fade-in ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                {msg.role === "bot" ? (
                  <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-md">
                    <Activity size={18} />
                  </div>
                ) : (
                  <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shadow-sm">
                    <User size={18} />
                  </div>
                )}
                <div className="flex flex-col max-w-[85%]">
                  <div className={`px-5 py-4 text-[15px] leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-sm font-medium' 
                      : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm'
                  }`}>
                    {msg.role === "bot" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium text-slate-400 mt-1.5 ${msg.role === 'user' ? 'text-right mr-1' : 'ml-1'}`}>
                    {formatDate(msg.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Sessions List View ───────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans">
      <header className="mb-10 flex items-center gap-4">
        <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center">
          <History size={28} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Chat History</h2>
          <p className="text-slate-500 font-medium mt-1">Your personal conversation archive</p>
        </div>
      </header>

      {!userEmail ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <Inbox size={32} className="text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Not logged in</h3>
          <p className="text-slate-500">Please log in to view your chat history.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="font-medium">Loading your conversations…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-red-100 shadow-sm max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4 border border-red-100">
            <Inbox size={32} className="text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Error</h3>
          <p className="text-red-500">{error}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4 border border-indigo-100">
            <MessageSquare size={32} className="text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No conversations yet</h3>
          <p className="text-slate-500">Start chatting and your history will appear here!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-4xl mx-auto pb-8">
          {sessions.map((session) => (
            <div
              key={session.session_id}
              className="group flex items-center gap-4 bg-white border border-slate-200 p-5 rounded-2xl cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all duration-200"
              onClick={() => openSession(session)}
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shrink-0 border border-slate-100">
                <MessageSquare size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-800 font-medium truncate mb-1.5 text-[15px]">{session.preview}</p>
                <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
                  <span className="flex items-center gap-1.5"><Clock size={12} /> {formatDate(session.started_at)}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span>{timeAgo(session.last_active)}</span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shrink-0">
                <ChevronRight size={18} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
