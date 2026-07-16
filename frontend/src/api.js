const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export const askBotStream = async (question, onChunk) => {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });

  if (!response.ok) throw new Error("Network response was not ok");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let fullText = "";

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      onChunk(fullText);
    }
  }

  return fullText;
};

export const uploadPrescription = async (file, onChunk, userEmail = null) => {
  const formData = new FormData();
  formData.append("file", file);

  const url = userEmail
    ? `${API_BASE}/ocr-prescription?user_email=${encodeURIComponent(userEmail)}`
    : `${API_BASE}/ocr-prescription`;

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Failed to process prescription image");

  // Capture the Cloudinary URL from the response header
  const imageUrl = response.headers.get("X-Image-Url") || null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let fullText = "";

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      onChunk(fullText);
    }
  }

  return { text: fullText, imageUrl };
};

export const getPrescriptions = async (userEmail) => {
  const res = await fetch(`${API_BASE}/prescriptions?user_email=${encodeURIComponent(userEmail)}`);
  if (!res.ok) throw new Error("Failed to fetch prescriptions");
  const data = await res.json();
  return data.prescriptions || [];
};

export const translateText = async (text) => {
  const res = await fetch(`${API_BASE}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error("Translation failed");
  const data = await res.json();
  return data.translatedText;
};

// ── Voice Transcription ────────────────────────────────────────────────────────
export const transcribeAudio = async (audioBlob, language = "bn") => {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");

  const res = await fetch(`${API_BASE}/transcribe?language=${language}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Transcription failed");
  const data = await res.json();
  return data.text || "";
};

// ── Chat History ───────────────────────────────────────────────────────────────
export const saveMessage = async (userEmail, sessionId, role, content) => {
  try {
    await fetch(`${API_BASE}/save-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_email: userEmail, session_id: sessionId, role, content })
    });
  } catch (e) {
    console.warn("Could not save message to history:", e);
  }
};

export const getChatHistory = async (userEmail) => {
  const res = await fetch(`${API_BASE}/chat-history?user_email=${encodeURIComponent(userEmail)}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  const data = await res.json();
  return data.sessions || [];
};

export const getSessionMessages = async (sessionId, userEmail) => {
  const res = await fetch(
    `${API_BASE}/chat-session/${sessionId}?user_email=${encodeURIComponent(userEmail)}`
  );
  if (!res.ok) throw new Error("Failed to fetch session");
  const data = await res.json();
  return data.messages || [];
};

// ── Docs & Pitch Deck ────────────────────────────────────────────────────────

export const fetchDocsConfig = async (userEmail = null) => {
  const url = userEmail ? `${API_BASE}/api/docs/config?user_email=${encodeURIComponent(userEmail)}` : `${API_BASE}/api/docs/config`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 403) throw new Error("Not Available");
    throw new Error("Docs load failed");
  }
  return res.json();
};

export const fetchDocsContent = async () => {
  const res = await fetch(`${API_BASE}/api/docs/content`);
  if (!res.ok) throw new Error("Content load failed");
  return res.json();
};

export const adminUpdateConfig = async (data) => {
  const res = await fetch(`${API_BASE}/api/docs/admin/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Update failed");
  return res.json();
};

export const adminUpdateSection = async (data) => {
  const res = await fetch(`${API_BASE}/api/docs/admin/section`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Section update failed");
  return res.json();
};

export const adminUploadTeamMember = async ({ name, role, email, adminEmail, file }) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const query = new URLSearchParams({
    name, role, email: email || "", admin_email: adminEmail
  }).toString();

  const res = await fetch(`${API_BASE}/api/docs/admin/team?${query}`, {
    method: "POST",
    body: formData
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
};
