import { useState, useRef, useEffect, useCallback } from "react";
import { askBotStream, uploadPrescription, translateText, saveMessage, transcribeAudio } from "./api";
import { useAuth } from "./AuthContext";
import { auth, signOut } from "./firebase";
import {
  Pill, Send, Sparkles, Activity, Search, ShieldPlus,
  Copy, Check, ImagePlus, X, ExternalLink, ShoppingCart, FileImage, Languages, LogOut,
  CalendarPlus, Mic, MicOff, History, FileText, LayoutDashboard, Loader2
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import HealthTipsView from './HealthTipsView';
import UsefulLinksView from './UsefulLinksView';
import AppointmentView from './AppointmentView';
import ChatHistoryView from './ChatHistoryView';
import PrescriptionsView from './PrescriptionsView';

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const BUY_PLATFORMS = [
  {
    id: "arogga", name: "Arogga", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", hover: "hover:bg-emerald-100",
    url: (m) => `https://www.arogga.com/search?q=${encodeURIComponent(m)}&_product_type=all&_search=${encodeURIComponent(m)}`,
    emoji: "💊"
  },
  {
    id: "medex", name: "MedEx", text: "text-red-700", bg: "bg-red-50", border: "border-red-200", hover: "hover:bg-red-100",
    url: (m) => `https://medex.com.bd/search?search=${encodeURIComponent(m)}`,
    emoji: "🏥"
  },
  {
    id: "shajgoj", name: "Shajgoj", text: "text-pink-700", bg: "bg-pink-50", border: "border-pink-200", hover: "hover:bg-pink-100",
    url: (m) => `https://www.shajgoj.com/blog?search=${encodeURIComponent(m)}`,
    emoji: "🌿"
  },
  {
    id: "daraz", name: "Daraz Health", text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", hover: "hover:bg-orange-100",
    url: (m) => `https://www.daraz.com.bd/catalog/?q=${encodeURIComponent(m)}`,
    emoji: "🛒"
  }
];

function extractMedicines(text) {
  const matches = [...text.matchAll(/\[\[(.+?)\]\]/g)];
  return [...new Set(matches.map(m => m[1].trim()))];
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RenderBotContent({ text }) {
  const processedText = text.replace(/\[\[(.+?)\]\]/g, '`MED:$1`');
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
        a: ({node, ...props}) => <a className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
        li: ({node, ...props}) => <li className="mb-1" {...props} />,
        h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2 mt-4" {...props} />,
        h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2 mt-3" {...props} />,
        h3: ({node, ...props}) => <h3 className="text-md font-bold mb-1 mt-2" {...props} />,
        code({ node, className, children, ...props }) {
          const content = String(children).trim();
          const match = content.match(/^MED:(.+)$/);
          if (match) return <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-1.5 py-0.5 text-sm font-semibold mx-0.5">{match[1]}</span>;
          const isInline = !className;
          return <code className={`${isInline ? 'bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-sm' : 'block bg-slate-800 text-slate-50 p-3 rounded-lg overflow-x-auto text-sm my-2'}`} {...props}>{children}</code>;
        }
      }}
    >
      {processedText}
    </ReactMarkdown>
  );
}

function SidebarBuyLinks({ medicines }) {
  if (!medicines || medicines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 text-center">
        <ShoppingCart className="text-slate-300" size={24} />
        <p className="text-xs text-slate-400">Buy links will appear here after the AI mentions medicines.</p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 pb-4">
      {medicines.map((medicine) => (
        <div key={medicine} className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg w-fit">
            <Pill size={12} />
            <span>{medicine}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {BUY_PLATFORMS.map((platform) => (
              <a
                key={platform.id}
                href={platform.url(medicine)}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold no-underline transition-all duration-200 border ${platform.bg} ${platform.border} ${platform.text} ${platform.hover}`}
                title={`Search ${medicine} on ${platform.name}`}
              >
                <span>{platform.emoji}</span>
                <span>{platform.name}</span>
                <ExternalLink size={10} className="ml-auto opacity-70" />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImagePreview({ file, onRemove }) {
  const url = URL.createObjectURL(file);
  return (
    <div className="flex items-center gap-3 bg-white border border-indigo-100 rounded-xl p-2 mb-3 shadow-sm animate-fade-in w-fit">
      <img src={url} alt="Prescription preview" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mr-2">
        <FileImage size={14} className="text-indigo-500" />
        Ready
      </span>
      <button className="p-1 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-full transition-colors" onClick={onRemove} title="Remove image">
        <X size={14} />
      </button>
    </div>
  );
}

// ── Mic Button Component ───────────────────────────────────────────────────────

function MicButton({ onTranscript, disabled, language }) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const text = await transcribeAudio(blob, language);
          if (text) onTranscript(text);
        } catch (err) {
          console.error("Transcription failed:", err);
        }
        setTranscribing(false);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err) {
      console.error("Mic access denied:", err);
      alert("Microphone access denied. Please allow mic permission in your browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleClick = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  return (
    <button
      className={`p-2 rounded-full transition-colors ${
        transcribing ? "text-indigo-400" :
        recording ? "bg-red-100 text-red-600 animate-pulse" : 
        "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
      }`}
      onClick={handleClick}
      disabled={disabled || transcribing}
      title={recording ? "Stop recording" : transcribing ? "Transcribing…" : `Voice input (${language === "bn" ? "বাংলা" : "English"})`}
    >
      {transcribing ? (
        <Loader2 className="animate-spin" size={20} />
      ) : recording ? (
        <MicOff size={20} />
      ) : (
        <Mic size={20} />
      )}
    </button>
  );
}

// ── Main Chat Component ────────────────────────────────────────────────────────

export default function Chat() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState([
    {
      role: "bot",
      content: "Hi there! I'm BD-Medicine AI 👋\n\nI specialize in Bangladeshi medicines. Ask me anything — prices, side effects, manufacturers — or **upload a prescription image** using the 📎 button and I'll analyze it for you.\n\nYou can also use the 🎤 mic button to speak in **Bangla or English**!",
      isPrescription: false
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [translatingIndex, setTranslatingIndex] = useState(null);
  const [currentStream, setCurrentStream] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [latestMedicines, setLatestMedicines] = useState([]);
  const [micLang, setMicLang] = useState("bn");
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages, currentStream]);

  const persistMessage = useCallback((role, content) => {
    if (user?.email) {
      saveMessage(user.email, sessionId, role, content);
    }
  }, [user, sessionId]);

  const send = async () => {
    if (selectedImage) { await sendPrescription(); return; }
    if (!q.trim()) return;

    const newMsg = { role: "user", content: q };
    setMessages((prev) => [...prev, newMsg]);
    persistMessage("user", q);
    setQ("");
    setLoading(true);
    setCurrentStream("");

    try {
      const finalRes = await askBotStream(newMsg.content, (chunk) => setCurrentStream(chunk));
      setMessages((prev) => [...prev, { role: "bot", content: finalRes, isPrescription: false }]);
      persistMessage("bot", finalRes);
      setCurrentStream("");
      setLatestMedicines(extractMedicines(finalRes));
    } catch (err) {
      const errMsg = "Sorry, I am currently unavailable or encountered an error.";
      setMessages((prev) => [...prev, { role: "bot", content: errMsg, isPrescription: false }]);
      setCurrentStream("");
    }
    setLoading(false);
  };

  const sendPrescription = async () => {
    const imgFile = selectedImage;
    setSelectedImage(null);

    const userMsg = {
      role: "user",
      content: q.trim() || "Please analyze this prescription.",
      prescriptionFile: imgFile,
      prescriptionUrl: URL.createObjectURL(imgFile)
    };
    setMessages((prev) => [...prev, userMsg]);
    persistMessage("user", userMsg.content + " [prescription image]");
    setQ("");
    setLoading(true);
    setCurrentStream("");

    try {
      const result = await uploadPrescription(imgFile, (chunk) => setCurrentStream(chunk), user?.email);
      const finalRes = typeof result === "string" ? result : result.text;
      const cloudinaryUrl = result?.imageUrl;

      if (cloudinaryUrl) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], cloudinaryUrl };
          return updated;
        });
      }

      setMessages((prev) => [...prev, { role: "bot", content: finalRes, isPrescription: true }]);
      persistMessage("bot", finalRes);
      setCurrentStream("");
      setLatestMedicines(extractMedicines(finalRes));
    } catch (err) {
      const errMsg = "Sorry, I could not process the prescription image. Please try again.";
      setMessages((prev) => [...prev, { role: "bot", content: errMsg, isPrescription: false }]);
      setCurrentStream("");
    }
    setLoading(false);
  };

  const handleReset = () => {
    setSessionId(generateSessionId());
    setMessages([{
      role: "bot",
      content: "Hi there! I'm BD-Medicine AI 👋\n\nI specialize in Bangladeshi medicines. Ask me anything — prices, side effects, manufacturers — or **upload a prescription image** using the 📎 button and I'll analyze it for you.\n\nYou can also use the 🎤 mic button to speak in **Bangla or English**!",
      isPrescription: false
    }]);
    setQ("");
    setCurrentStream("");
    setLoading(false);
    setSelectedImage(null);
    setLatestMedicines([]);
  };

  const handleCopy = (text, index) => {
    const clean = text.replace(/\[\[(.+?)\]\]/g, '$1');
    navigator.clipboard.writeText(clean);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedImage(file);
    e.target.value = "";
  };

  const handleTranslate = async (text, index) => {
    setTranslatingIndex(index);
    try {
      const banglaText = await translateText(text);
      setMessages(prev => {
        const newMsg = [...prev];
        newMsg[index] = { ...newMsg[index], content: banglaText };
        return newMsg;
      });
    } catch (error) {
      console.error("Failed to translate", error);
    }
    setTranslatingIndex(null);
  };

  const handleLogout = async () => {
    try { await signOut(auth); } catch (error) { console.error("Failed to logout", error); }
  };

  const handleLoadSession = (msgs) => {
    setSessionId(generateSessionId());
    const loaded = msgs.map(m => ({
      role: m.role,
      content: m.content,
      isPrescription: false
    }));
    setMessages(loaded);
    setActiveView("chat");
  };

  const NavItem = ({ id, icon: Icon, label, customClass = "" }) => (
    <button
      onClick={() => setActiveView(id)}
      className={`flex items-center gap-3 px-4 py-2.5 w-full rounded-xl transition-all font-medium text-sm text-left ${
        activeView === id 
        ? "bg-indigo-50 text-indigo-700 font-semibold" 
        : "text-slate-600 hover:bg-slate-100 hover:text-indigo-600"
      } ${customClass}`}
    >
      <Icon size={18} className={activeView === id ? "text-indigo-600" : ""} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex w-full h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-[280px] h-full bg-white border-r border-slate-200 flex flex-col p-5 shadow-sm z-10 overflow-y-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Activity size={24} />
          </div>
          <h1 className="font-bold text-lg text-slate-800 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-violet-700">BD-Medicine AI</h1>
        </div>

        <nav className="flex flex-col gap-1.5 mb-6">
          <NavItem id="chat" icon={Search} label="Medicine Search" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl transition-all font-medium text-sm text-left text-slate-600 hover:bg-slate-100 hover:text-indigo-600">
            <ImagePlus size={18} />
            <span>Upload Prescription</span>
          </button>
          <NavItem id="history" icon={History} label="Chat History" />
          <NavItem id="prescriptions" icon={FileText} label="Prescriptions" />
          <NavItem id="health-tips" icon={ShieldPlus} label="Health Tips" />
          <NavItem id="useful-links" icon={ExternalLink} label="Useful Links" />
          
          <div className="mt-2 pt-2 border-t border-slate-100">
            <NavItem id="appointment" icon={CalendarPlus} label="HealthEcho AI" customClass={activeView === 'appointment' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'text-amber-700 hover:bg-amber-50'} />
          </div>

          {user?.email === "meow@gmail.com" && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <button onClick={() => window.location.href = '/docs'} className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl transition-all font-medium text-sm text-left text-emerald-700 hover:bg-emerald-50">
                <LayoutDashboard size={18} />
                <span>Docs Admin Panel</span>
              </button>
            </div>
          )}
        </nav>

        {/* Buy Links Section */}
        <div className="flex flex-col flex-1 min-h-[200px] border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            <ShoppingCart size={14} />
            <span>Find in Pharmacies</span>
            {latestMedicines.length > 0 && (
              <span className="ml-auto bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{latestMedicines.length}</span>
            )}
          </div>
          <SidebarBuyLinks medicines={latestMedicines} />
        </div>

        <div className="mt-auto pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 border border-indigo-200">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-700 truncate">{user?.email || 'User'}</span>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600 transition-colors w-fit">
                <LogOut size={12} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col h-full bg-slate-50/50 relative">
        {activeView === "appointment" ? (
          <AppointmentView />
        ) : activeView === "health-tips" ? (
          <HealthTipsView />
        ) : activeView === "useful-links" ? (
          <UsefulLinksView />
        ) : activeView === "history" ? (
          <ChatHistoryView userEmail={user?.email} onLoadSession={handleLoadSession} />
        ) : activeView === "prescriptions" ? (
          <PrescriptionsView userEmail={user?.email} />
        ) : (
          <>
            <header className="px-8 py-5 border-b border-slate-200/60 bg-white/60 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Bangladeshi Medicine Database</h2>
                <p className="text-sm text-slate-500 mt-0.5 font-medium">Comprehensive guide · Prescription OCR · Voice Input · Pharmacy Links</p>
              </div>
              <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-semibold text-slate-700 hover:text-indigo-600 hover:border-indigo-200 hover:shadow transition-all"
              >
                <Sparkles size={16} className="text-amber-500" />
                <span>New Query</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
              {messages.map((msg, index) => (
                <div key={index} className={`flex gap-4 max-w-4xl animate-fade-in ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                  {msg.role === "bot" && (
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-md">
                      <Activity size={18} />
                    </div>
                  )}
                  <div className="flex flex-col max-w-[85%]">
                    {msg.prescriptionUrl && (
                      <div className="flex items-end gap-2 mb-2 flex-row-reverse">
                        <img src={msg.prescriptionUrl} alt="Uploaded prescription" className="max-w-[200px] max-h-[140px] rounded-xl object-cover border-2 border-indigo-100 shadow-sm" />
                        <span className="bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm">📋 Prescription</span>
                        {msg.cloudinaryUrl && (
                          <a href={msg.cloudinaryUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors shadow-sm">
                            <ExternalLink size={10} /> Saved to cloud
                          </a>
                        )}
                      </div>
                    )}

                    <div className={`px-5 py-4 text-[15px] leading-relaxed shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-sm font-medium' 
                        : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm'
                    }`}>
                      {msg.role === "bot" ? (
                        <RenderBotContent text={msg.content} />
                      ) : (
                        msg.content.split('\n').map((line, i) => (
                          <span key={i}>{line}<br /></span>
                        ))
                      )}
                    </div>

                    {msg.role === "bot" && (
                      <div className="flex items-center gap-2 mt-2 ml-1">
                        <button onClick={() => handleCopy(msg.content, index)} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-colors" title="Copy message">
                          {copiedIndex === index ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                        <button onClick={() => handleTranslate(msg.content, index)} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-colors disabled:opacity-50" title="Translate to Bangla" disabled={translatingIndex === index}>
                          {translatingIndex === index ? <span className="animate-pulse text-xs font-bold">...</span> : <Languages size={14} />}
                        </button>
                        {msg.isPrescription && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                            <FileImage size={10} /> OCR Analysis
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && currentStream && (
                <div className="flex gap-4 max-w-4xl mr-auto animate-fade-in">
                  <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-md">
                    <Activity size={18} />
                  </div>
                  <div className="flex flex-col">
                    <div className="px-5 py-4 text-[15px] leading-relaxed shadow-sm bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm">
                      <RenderBotContent text={currentStream} />
                      <span className="inline-block w-2 h-4 bg-indigo-500 ml-1 align-middle animate-blink"></span>
                    </div>
                  </div>
                </div>
              )}

              {loading && !currentStream && (
                <div className="flex gap-4 max-w-4xl mr-auto animate-fade-in">
                  <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-md">
                    <Activity size={18} />
                  </div>
                  <div className="flex flex-col">
                    <div className="px-5 py-4 bg-white border border-slate-100 rounded-2xl rounded-tl-sm flex items-center gap-1.5 shadow-sm">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-typing-dot" style={{animationDelay: '-0.32s'}}></span>
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-typing-dot" style={{animationDelay: '-0.16s'}}></span>
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-typing-dot"></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 sm:px-8 pb-6 pt-2 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
              {selectedImage && (
                <ImagePreview file={selectedImage} onRemove={() => setSelectedImage(null)} />
              )}
              
              <div className={`flex items-end gap-2 p-2 bg-white rounded-2xl border transition-all shadow-sm focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400 ${selectedImage ? 'border-indigo-300 ring-2 ring-indigo-50 shadow-md' : 'border-slate-200'}`}>
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50" title="Upload image" disabled={loading}>
                  <ImagePlus size={20} />
                </button>
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageSelect} />
                
                <MicButton onTranscript={(text) => setQ((prev) => prev ? prev + " " + text : text)} disabled={loading} language={micLang} />
                
                <button onClick={() => setMicLang(l => l === "bn" ? "en" : "bn")} className="p-2 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors h-10 w-10 flex items-center justify-center shrink-0 disabled:opacity-50" title="Toggle Mic Language" disabled={loading}>
                  {micLang === "bn" ? "বাং" : "EN"}
                </button>
                
                <textarea
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if(e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={selectedImage ? "Add a note (optional)..." : "Ask anything or 🎤 speak..."}
                  disabled={loading}
                  rows={1}
                  className="flex-1 max-h-[120px] bg-transparent resize-none py-3 px-2 outline-none text-[15px] placeholder:text-slate-400"
                  style={{ minHeight: '44px' }}
                />
                
                <button onClick={send} disabled={loading || (!q.trim() && !selectedImage)} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:shadow-md transition-all disabled:opacity-50 disabled:hover:shadow-none flex shrink-0">
                  <Send size={18} />
                </button>
              </div>
              
              <div className="text-center mt-3 text-xs text-slate-400 font-medium">
                BD-Medicine AI provides info on Bangladeshi medicines. Consult a doctor for medical advice.
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
