import { useState, useEffect, useCallback, useRef } from "react";
import {
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  LocalAudioTrack,
  createLocalAudioTrack,
} from "livekit-client";
import {
  Mic, MicOff, PhoneOff, PhoneCall, User, Calendar,
  Activity, CheckCircle2, Clock, Stethoscope, Hash, Loader2
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "";

// ── Audio Visualizer ─────────────────────────────────────────────────────────
function AudioVisualizer({ isActive, isSpeaking }) {
  const bars = 20;
  return (
    <div className="flex items-end justify-center gap-1 h-12 mb-6">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-300 ${
            isActive 
              ? (isSpeaking ? "bg-indigo-600 animate-[pulseHeight_0.5s_ease-in-out_infinite_alternate]" : "bg-violet-500 animate-[pulseHeight_1s_ease-in-out_infinite_alternate]") 
              : "bg-slate-200 h-1"
          }`}
          style={{
            animationDelay: `${(i * 0.05).toFixed(2)}s`,
            animationDuration: `${0.6 + Math.random() * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Status Pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const configs = {
    idle: { label: "প্রস্তুত", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" },
    connecting: { label: "সংযুক্ত হচ্ছে...", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
    connected: { label: "সংযুক্ত", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
    speaking: { label: "আশা বলছেন...", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500" },
    listening: { label: "শুনছে", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500" },
    disconnected: { label: "বিচ্ছিন্ন", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
    error: { label: "সমস্যা হয়েছে", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  };
  const cfg = configs[status] || configs.idle;
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text} ${cfg.border} shadow-sm`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </div>
  );
}

// ── Patient Info Card ─────────────────────────────────────────────────────────
function PatientCard({ info }) {
  if (!info.vin && !info.name) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mt-8 w-full max-w-sm mx-auto animate-fade-in">
      <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center gap-2">
        <User size={16} className="text-slate-500" />
        <span className="text-sm font-bold text-slate-700">রোগীর তথ্য</span>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {info.vin && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <Hash size={14} />
              <span>VIN:</span>
            </div>
            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{info.vin}</span>
          </div>
        )}
        {info.name && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <User size={14} />
              <span>নাম:</span>
            </div>
            <span className="font-semibold text-slate-800">{info.name}</span>
          </div>
        )}
        {info.department && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <Stethoscope size={14} />
              <span>বিভাগ:</span>
            </div>
            <span className="font-semibold text-slate-800">{info.department}</span>
          </div>
        )}
        {info.savedAt && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 mt-2 justify-center font-medium">
            <CheckCircle2 size={14} />
            <span>সংরক্ষিত</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Transcript Panel ──────────────────────────────────────────────────────────
function TranscriptPanel({ lines }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="flex-1 bg-white border-l border-slate-200 flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <Activity size={16} className="text-indigo-500" />
        <span className="font-bold text-slate-700">কথোপকথন</span>
      </div>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {lines.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-medium">
            কল শুরু হলে কথোপকথন এখানে দেখাবে...
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={`flex flex-col gap-1 max-w-[85%] animate-fade-in ${line.role === 'agent' ? 'mr-auto' : 'ml-auto'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${line.role === 'agent' ? 'text-indigo-500 ml-1' : 'text-slate-400 mr-1 text-right'}`}>
                {line.role === "agent" ? "আশা" : "আপনি"}
              </span>
              <div className={`px-4 py-3 rounded-2xl text-[15px] shadow-sm ${
                line.role === 'agent' 
                  ? 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm' 
                  : 'bg-indigo-600 text-white rounded-tr-sm'
              }`}>
                {line.text}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ── Main AppointmentView ──────────────────────────────────────────────────────
export default function AppointmentView() {
  const [callStatus, setCallStatus] = useState("idle");
  const [transcript, setTranscript] = useState([]);
  const [patientInfo, setPatientInfo] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [error, setError] = useState(null);

  const roomRef = useRef(null);
  const localTrackRef = useRef(null);

  // Parse agent transcript for patient info updates
  const parsePatientInfo = useCallback((text) => {
    const vinMatch = text.match(/VIN\d{6}/i);
    const nameMatch = text.match(/নাম[:\s]+([^\n,।]+)/);
    const deptMatch = text.match(/বিভাগ[:\s]+([^\n,।(]+)/);
    const savedMatch = /সংরক্ষিত|saved|তৈরি হয়েছে/.test(text);

    setPatientInfo(prev => ({
      ...prev,
      ...(vinMatch ? { vin: vinMatch[0].toUpperCase() } : {}),
      ...(nameMatch ? { name: nameMatch[1].trim() } : {}),
      ...(deptMatch ? { department: deptMatch[1].trim() } : {}),
      ...(savedMatch ? { savedAt: new Date().toLocaleTimeString("bn-BD") } : {}),
    }));
  }, []);

  const addTranscript = useCallback((role, text) => {
    setTranscript(prev => [...prev, { role, text }]);
    if (role === "agent") parsePatientInfo(text);
  }, [parsePatientInfo]);

  // Start the call
  const startCall = useCallback(async () => {
    setError(null);
    setCallStatus("connecting");
    setTranscript([]);
    setPatientInfo({});

    try {
      // 1. Get LiveKit token from our backend
      const res = await fetch(`${API_BASE}/livekit-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_name: `appointment-${Date.now()}`,
          participant_name: `patient-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const data = await res.json();
      if (!data.token) throw new Error("Token generation failed");

      // 2. Create and connect to LiveKit room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // Handle room events
      room.on(RoomEvent.Connected, () => {
        setCallStatus("connected");
        addTranscript("agent", "আস্সালামুআলাইকুম! আমি আশা, এই হাসপাতালের AI রিসেপশনিস্ট। আপনাকে স্বাগতম।");
      });

      room.on(RoomEvent.Disconnected, () => {
        setCallStatus("disconnected");
        setAgentSpeaking(false);
      });

      // Listen for agent audio tracks (remote participant = the agent)
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioEl = track.attach();
          audioEl.autoplay = true;
          audioEl.style.display = "none";
          document.body.appendChild(audioEl);

          track.on(TrackEvent.Muted, () => setAgentSpeaking(false));
          track.on(TrackEvent.Unmuted, () => setAgentSpeaking(true));
          setAgentSpeaking(true);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
        setAgentSpeaking(false);
      });

      // Handle data messages (transcript from agent)
      room.on(RoomEvent.DataReceived, (data) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(data));
          if (msg.type === "transcript") {
            addTranscript(msg.role || "agent", msg.text || "");
          }
        } catch (_) {}
      });

      // 3. Connect to room
      await room.connect(data.url || LIVEKIT_URL, data.token);

      // 4. Publish local audio
      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      localTrackRef.current = audioTrack;
      await room.localParticipant.publishTrack(audioTrack);
      setCallStatus("connected");

    } catch (err) {
      console.error("Call error:", err);
      setError(err.message || "কল শুরু করতে সমস্যা হয়েছে।");
      setCallStatus("error");
    }
  }, [addTranscript]);

  // End the call
  const endCall = useCallback(async () => {
    if (localTrackRef.current) {
      localTrackRef.current.stop();
      localTrackRef.current = null;
    }
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setCallStatus("idle");
    setAgentSpeaking(false);
    setIsMuted(false);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (!localTrackRef.current) return;
    if (isMuted) {
      await localTrackRef.current.unmute();
    } else {
      await localTrackRef.current.mute();
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { endCall(); };
  }, [endCall]);

  const isInCall = ["connected", "speaking", "listening"].includes(callStatus) || 
                   callStatus === "connected";

  return (
    <div className="flex flex-col h-full font-sans bg-slate-50">
      {/* Header */}
      <header className="px-8 py-5 border-b border-slate-200/60 bg-white/60 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-amber-500/20">
            <Calendar size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">HealthEcho</h2>
            <p className="text-sm text-slate-500 mt-0.5 font-medium">A Bangla-Native Real-time AI Assistant for Health Workers</p>
          </div>
        </div>
        <StatusPill status={callStatus} />
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - voice UI */}
        <div className="w-full md:w-[45%] lg:w-[40%] flex flex-col items-center justify-center p-8 overflow-y-auto relative">
          
          {/* Agent avatar */}
          <div className="relative mb-6">
            <div className={`absolute inset-0 rounded-full border-2 transition-all duration-300 ${
              agentSpeaking 
                ? 'border-indigo-500 scale-110 animate-pulse' 
                : isInCall ? 'border-violet-400 scale-105' : 'border-transparent'
            }`} />
            {agentSpeaking && (
              <div className="absolute -inset-2 rounded-full border-2 border-violet-400 opacity-50 scale-125 animate-ping" style={{ animationDuration: '2s' }} />
            )}
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-100 relative z-10 text-4xl">
              👩‍⚕️
            </div>
          </div>

          <h3 className="text-2xl font-bold text-slate-800 mb-1">আশা</h3>
          <p className="text-sm font-semibold tracking-wide text-slate-400 uppercase mb-8">AI রিসেপশনিস্ট</p>

          {/* Audio Visualizer */}
          <AudioVisualizer
            isActive={isInCall}
            isSpeaking={agentSpeaking}
          />

          {/* Error banner */}
          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 px-4 py-3 rounded-xl mb-6 text-sm font-medium text-center w-full max-w-sm animate-fade-in shadow-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Call controls */}
          <div className="mt-4 mb-8">
            {!isInCall && callStatus !== "connecting" ? (
              <button
                className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-105 hover:shadow-indigo-600/40 transition-all duration-300"
                onClick={startCall}
                disabled={callStatus === "connecting"}
              >
                <PhoneCall size={24} />
                <span>কল শুরু করুন</span>
              </button>
            ) : callStatus === "connecting" ? (
              <button className="flex items-center gap-3 px-8 py-4 bg-amber-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-amber-500/30 cursor-not-allowed opacity-90 transition-all" disabled>
                <Loader2 size={24} className="animate-spin" />
                <span>সংযুক্ত হচ্ছে...</span>
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${isMuted ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
                  onClick={toggleMute}
                  title={isMuted ? "মাইক চালু করুন" : "মাইক বন্ধ করুন"}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <button
                  className="flex items-center gap-2 px-6 py-4 bg-red-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-red-500/30 hover:bg-red-600 hover:scale-105 transition-all duration-300"
                  onClick={endCall}
                >
                  <PhoneOff size={24} />
                  <span>কল শেষ করুন</span>
                </button>
              </div>
            )}
          </div>

          {/* How it works */}
          {callStatus === "idle" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-sm animate-fade-in">
              <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Activity size={16} className="text-indigo-500" /> কিভাবে কাজ করে
              </h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                  <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">১</span> 
                  "কল শুরু করুন" বাটনে ক্লিক করুন
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                  <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">২</span> 
                  আশার সাথে বাংলায় কথা বলুন
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                  <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">৩</span> 
                  আপনার তথ্য ও সমস্যা জানান
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                  <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">৪</span> 
                  VIN নম্বর পান ও সংরক্ষণ করুন
                </li>
              </ul>
            </div>
          )}

          {/* Patient info card */}
          <PatientCard info={patientInfo} />
          
          {/* Tips while in call */}
          {isInCall && (
            <div className="absolute bottom-6 left-8 right-8 text-center text-xs font-medium text-slate-400 flex items-center justify-center gap-1.5 animate-fade-in">
              <Clock size={14} />
              <span>আশা আপনার তথ্য ডাটাবেসে সংরক্ষণ করবে এবং সঠিক বিভাগ সুপারিশ করবে।</span>
            </div>
          )}
        </div>

        {/* Right panel - transcript */}
        <TranscriptPanel lines={transcript} />
      </div>
    </div>
  );
}
