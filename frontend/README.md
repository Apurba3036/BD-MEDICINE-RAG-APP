## Project Overview

This workspace contains a Bengali-first medicine assistant app with two main parts:

- A React frontend for the user experience in App.jsx and Chat.jsx
- A FastAPI backend that powers chat, OCR, translation, transcription, and document management in main.py

The project is designed to help users understand medicines, analyze prescriptions, and find local medicine buying options.

---

## Main Features

### 1. Medicine Chat Assistant
- Users can ask medicine-related questions in Bengali or English
- The backend streams AI responses through the chat endpoint
- Responses are rendered with markdown formatting in the frontend

### 2. Prescription OCR and Image Analysis
- Users can upload a prescription image
- The backend uploads the image to Cloudinary
- OCR-style medicine extraction is performed using Groq-backed AI
- The result is streamed back to the user

### 3. Medicine Search and Retrieval
- The app uses a local vector database and medicine records
- This supports retrieval-augmented generation (RAG) so answers can be grounded in a medicine database

### 4. Voice Input and Transcription
- The interface includes a microphone button
- Users can speak in Bangla or English
- Audio is transcribed through the backend using Groq Whisper
- This makes the app more natural for voice-first users

### 5. Translation Support
- Text can be translated into Bengali using a dedicated translation endpoint
- This is useful for bilingual user interaction

### 6. Pharmacy / Purchase Links
- When the AI mentions medicine names, the frontend extracts them
- It shows buy/search links to local platforms like Arogga, MedEx, Shajgoj, and Daraz

### 7. Chat History and Session Persistence
- Users can save messages to chat history
- Sessions are grouped and retrievable later
- The app lets users continue past conversations

### 8. Saved Prescriptions
- Uploaded prescriptions are stored and can be viewed later in the “My Prescriptions” area
- The interface is built to show uploaded prescription images cleanly

### 9. Docs / Pitch Deck Experience
- There is a docs page for public-facing presentation content
- It supports section navigation, markdown rendering, and Mermaid diagrams
- An admin panel allows managing docs visibility, scheduling, section content, and team members

---

## Frontend Functionalities

From the UI code in Chat.jsx, DocsPage.jsx, and DocsAdminPanel.jsx, the frontend includes:

- Login and authentication flow
- Chat interface
- Prescription upload preview
- Voice recording and transcription
- AI answer rendering with Markdown
- Contextual medicine purchase links
- Chat history viewer
- Prescriptions gallery
- Public docs page and admin-only docs editing

---

## Backend Functionalities

In main.py, the backend provides:

- Chat endpoint for AI responses
- Translation endpoint
- Prescription upload and OCR analysis endpoint
- Prescriptions retrieval API
- Audio transcription endpoint
- Chat history save and load endpoints
- Docs config and section management APIs
- Database initialization for prescriptions, chat history, and docs content

---

## Tech Stack

- Frontend: React + Vite
- Backend: FastAPI
- AI / LLM: Groq
- Vector search: ChromaDB
- Relational storage: PostgreSQL
- Media storage: Cloudinary
- Auth: Firebase

---

## In Simple Terms

This project is essentially a medical support app that helps users:

- ask medicine questions
- upload prescriptions
- get AI-based prescription understanding
- search for medicines in Bangladesh-specific context
- save conversations and prescriptions
- browse docs and admin-managed public content

