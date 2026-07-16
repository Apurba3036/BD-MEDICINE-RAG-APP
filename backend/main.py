from fastapi import FastAPI, UploadFile, File, Query as QueryParam
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag import ask_llm, analyze_prescription
from database import (
    load_medicines_from_db, clear_chroma_collection,
    create_prescriptions_table, save_prescription_record, get_user_prescriptions,
    create_chat_history_table, save_chat_message, get_user_sessions, get_session_messages,
    init_docs_tables, get_docs_config, update_docs_config, get_docs_sections,
    update_docs_section, get_docs_team, add_docs_team_member, remove_docs_team_member
)
from vector_db import add_documents
from appointment_db import create_patients_table

from contextlib import asynccontextmanager
from fastapi.responses import StreamingResponse
import base64
import os
import time
import io
import cloudinary
import cloudinary.uploader
from livekit import api as livekit_api
from livekit.api import LiveKitAPI, CreateAgentDispatchRequest
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ── Cloudinary Config ──────────────────────────────────────────────────────────
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

# ── Groq Client ────────────────────────────────────────────────────────────────
groq_client = Groq(api_key=GROQ_API_KEY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Clearing old ChromaDB data...")
    clear_chroma_collection()
    print("Loading medicines from PostgreSQL...")
    docs = load_medicines_from_db()
    print(f"Loaded {len(docs)} documents. Adding to vector DB...")
    add_documents(docs)
    print("Vector DB ready!")
    try:
        create_patients_table()
    except Exception as e:
        print(f"Warning: Could not create patients table: {e}")
    try:
        create_prescriptions_table()
    except Exception as e:
        print(f"Warning: Could not create prescriptions table: {e}")
    try:
        create_chat_history_table()
    except Exception as e:
        print(f"Warning: Could not create chat_history table: {e}")
    try:
        init_docs_tables()
    except Exception as e:
        print(f"Warning: Could not init docs tables: {e}")
    yield
    print("Shutting down...")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Chat ───────────────────────────────────────────────────────────────────────

class ChatQuery(BaseModel):
    question: str

@app.post("/chat")
def chat(query: ChatQuery):
    generator = ask_llm(query.question)
    return StreamingResponse(generator, media_type="text/plain")


# ── Translate ──────────────────────────────────────────────────────────────────

class TranslateQuery(BaseModel):
    text: str

@app.post("/translate")
async def translate(query: TranslateQuery):
    from rag import client
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a direct translation engine. Translate the following text into Bengali (Bangla). "
                    "ONLY output the translated text and absolutely nothing else. Do not add conversational fillers, "
                    "greetings, or explanations. Keep any specific markdown tags, line breaks, emojis, or double "
                    "square brackets like [[MedicineName]] intact."
                ),
            },
            {"role": "user", "content": f"Translate this text to Bengali:\n\n{query.text}"},
        ],
        temperature=0.1,
    )
    translated = response.choices[0].message.content.strip()
    prefixes_to_remove = [
        "Here is the translation:",
        "Here is the translated text:",
        "Here is the translation in Bengali:",
        "The Bengali translation is:",
        "Translation:",
    ]
    for prefix in prefixes_to_remove:
        if translated.lower().startswith(prefix.lower()):
            translated = translated[len(prefix):].strip()
    return {"translatedText": translated}


# ── OCR Prescription + Cloudinary Upload ───────────────────────────────────────

@app.post("/ocr-prescription")
async def ocr_prescription(
    file: UploadFile = File(...),
    user_email: str = QueryParam(default=None)
):
    contents = await file.read()

    # Upload to Cloudinary
    image_url = None
    try:
        upload_result = cloudinary.uploader.upload(
            contents,
            folder="bd_medicine_prescriptions",
            resource_type="image",
            public_id=f"rx_{int(time.time())}",
            overwrite=False,
        )
        image_url = upload_result.get("secure_url")

        # Save URL to PostgreSQL if we have a user email
        if user_email and image_url:
            save_prescription_record(user_email, image_url)
            print(f"Prescription saved for {user_email}: {image_url}")
    except Exception as e:
        print(f"Warning: Cloudinary upload failed: {e}")

    # Still do OCR analysis
    image_base64 = base64.b64encode(contents).decode("utf-8")
    mime_type = file.content_type or "image/jpeg"
    generator = analyze_prescription(image_base64, mime_type)
    return StreamingResponse(
        generator,
        media_type="text/plain",
        headers={"X-Image-Url": image_url or ""}
    )


@app.get("/prescriptions")
async def get_prescriptions(user_email: str = QueryParam(...)):
    """Get all saved prescriptions for a user."""
    records = get_user_prescriptions(user_email)
    return {"prescriptions": records}


# ── Voice Transcription (Groq Whisper) ────────────────────────────────────────

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = QueryParam(default="bn")
):
    """
    Transcribe audio using Groq Whisper large-v3.
    language: 'bn' for Bangla (default), 'en' for English.
    Explicitly setting language avoids Whisper misdetecting Bangla as Arabic.
    Accepts WebM, WAV, MP3, M4A audio blobs.
    """
    try:
        contents = await file.read()
        filename = file.filename or "audio.webm"

        # Groq requires a file-like object with a name
        audio_file = (filename, io.BytesIO(contents), file.content_type or "audio/webm")

        # Explicitly pass language to avoid misdetection (Bangla vs Arabic confusion)
        transcription = groq_client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-large-v3",
            response_format="text",
            language=language,   # "bn" or "en" — explicit is always more accurate
            temperature=0.0,
        )

        # transcription is a string when response_format="text"
        text = transcription if isinstance(transcription, str) else transcription.text
        return {"text": text.strip(), "detected_language": language}

    except Exception as e:
        print(f"Transcription error: {e}")
        return {"text": "", "error": str(e)}


# ── Chat History ───────────────────────────────────────────────────────────────

class SaveMessageRequest(BaseModel):
    user_email: str
    session_id: str
    role: str
    content: str

@app.post("/save-message")
async def save_message(req: SaveMessageRequest):
    """Save a chat message to the user's history."""
    try:
        record_id = save_chat_message(req.user_email, req.session_id, req.role, req.content)
        return {"success": True, "id": record_id}
    except Exception as e:
        print(f"Save message error: {e}")
        return {"success": False, "error": str(e)}

@app.get("/chat-history")
async def chat_history(user_email: str = QueryParam(...)):
    """Get all chat sessions for a user (grouped by session_id)."""
    sessions = get_user_sessions(user_email)
    return {"sessions": sessions}

@app.get("/chat-session/{session_id}")
async def chat_session(session_id: str, user_email: str = QueryParam(...)):
    """Get all messages in a specific session (only if owned by user_email)."""
    messages = get_session_messages(session_id, user_email)
    return {"messages": messages}


# ── LiveKit Token + Agent Dispatch ─────────────────────────────────────────────

class TokenRequest(BaseModel):
    room_name: str = "appointment-room"
    participant_name: str = "patient"

@app.post("/livekit-token")
async def get_livekit_token(req: TokenRequest):
    """Generate a LiveKit access token and dispatch the Asha agent to the room."""
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        return {"error": "LiveKit credentials not configured"}

    # Unique room and participant per call to avoid collisions
    unique_room = f"{req.room_name}-{int(time.time())}"
    unique_participant = f"{req.participant_name}-{int(time.time())}"

    # Generate access token
    token = (
        livekit_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(unique_participant)
        .with_name(unique_participant)
        .with_grants(livekit_api.VideoGrants(
            room_join=True,
            room=unique_room,
            can_publish=True,
            can_subscribe=True,
        ))
    )
    jwt = token.to_jwt()

    # Dispatch Asha agent to the room
    try:
        lkapi = LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        await lkapi.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(
                agent_name="asha-receptionist",
                room=unique_room,
            )
        )
        await lkapi.aclose()
        print(f"Asha agent dispatched to room: {unique_room}")
    except Exception as e:
        print(f"Warning: Could not dispatch agent: {e}")

    return {
        "token": jwt,
        "url": LIVEKIT_URL,
        "room": unique_room,
    }

@app.get("/livekit-token")
async def livekit_health():
    return {"status": "ok", "livekit_url": LIVEKIT_URL}

# ── DOCS / PITCH DECK SYSTEM ──────────────────────────────────────────────────
from datetime import datetime
from fastapi import HTTPException

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")

def is_admin(email: str):
    return email == ADMIN_EMAIL

@app.get("/api/docs/config")
async def fetch_docs_config(user_email: str = QueryParam(default=None)):
    config = get_docs_config()
    if not config:
        raise HTTPException(status_code=500, detail="Config missing")
    
    # Admins always see docs
    if user_email and is_admin(user_email):
        return {"config": config, "access": True, "is_admin": True}
        
    # Check scheduling
    now = datetime.now()
    is_active = False
    
    if config["is_public"]:
        if config["scheduled_start"] and config["scheduled_end"]:
            if config["scheduled_start"] <= now <= config["scheduled_end"]:
                is_active = True
        else:
            is_active = True # Public with no time limits
            
    if not is_active:
        raise HTTPException(status_code=403, detail="Docs are currently not available.")
        
    return {"config": config, "access": True, "is_admin": False}

@app.get("/api/docs/content")
async def fetch_docs_content():
    # Only called if config check passes on frontend
    sections = get_docs_sections()
    team = get_docs_team()
    return {"sections": sections, "team": team}

class ConfigUpdate(BaseModel):
    is_public: bool
    scheduled_start: str
    scheduled_end: str
    admin_email: str

@app.post("/api/docs/admin/config")
async def admin_update_config(data: ConfigUpdate):
    if not is_admin(data.admin_email):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    start_dt = datetime.fromisoformat(data.scheduled_start.replace('Z', '+00:00')) if data.scheduled_start else None
    end_dt = datetime.fromisoformat(data.scheduled_end.replace('Z', '+00:00')) if data.scheduled_end else None
    
    success = update_docs_config(data.is_public, start_dt, end_dt)
    return {"success": success}

class SectionUpdate(BaseModel):
    section_id: str
    title: str
    content: str
    admin_email: str

@app.post("/api/docs/admin/section")
async def admin_update_section(data: SectionUpdate):
    if not is_admin(data.admin_email):
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    success = update_docs_section(data.section_id, data.title, data.content)
    return {"success": success}

@app.post("/api/docs/admin/team")
async def admin_add_team(
    name: str = QueryParam(...),
    role: str = QueryParam(...),
    email: str = QueryParam(default=""),
    admin_email: str = QueryParam(...),
    file: UploadFile = File(...)
):
    if not is_admin(admin_email):
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    contents = await file.read()
    image_url = None
    try:
        upload_result = cloudinary.uploader.upload(
            contents,
            folder="docs_team",
            resource_type="image",
            width=400, height=400, crop="fill", gravity="face"
        )
        image_url = upload_result.get("secure_url")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    member_id = add_docs_team_member(name, role, email, image_url)
    return {"success": True, "id": member_id, "image_url": image_url}