# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


# Architecture Diagram (Detailed)

> **Note:** The LangChain integration for the backend RAG pipeline is currently in the development phase.

## 🏗️ High-Level Architecture

\`\`\`mermaid
graph TB
    subgraph "Client Layer"
        Web[React Web App]
        Mobile[Mobile App<br/>React Native - Planned]
    end
    
    subgraph "API Gateway"
        Gateway[FastAPI Server]
        Auth[Firebase Auth]
    end
    
    subgraph "Medicine Chatbot Module"
        OCR[OCR Service<br/>Groq Vision]
        RAG[RAG Pipeline<br/>LangChain + ChromaDB + PostgreSQL]
        LLM[LLM Service<br/>Groq Llama]
        Translate[Translation<br/>Llama 3.1]
        Transcribe[Transcription<br/>Groq Whisper]
    end
    
    subgraph "HealthEcho Voice Module"
        LiveKit[LiveKit Server]
        Agent[Asha Python Agent]
        Gemini[Google Gemini<br/>Realtime API]
        PatientDB[Patient Database<br/>PostgreSQL]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Neon)]
        Chroma[(ChromaDB<br/>Vector Search)]
        Cloudinary[Cloudinary<br/>Image Storage]
    end
    
    subgraph "External Services"
        Pharmacies[Pharmacy APIs<br/>Arogga, MedEx, etc.]
        Firebase[Firebase<br/>Auth & Hosting]
    end
    
    Web --> Gateway
    Mobile --> Gateway
    Gateway --> Auth
    
    Gateway --> OCR
    Gateway --> RAG
    Gateway --> LLM
    Gateway --> Translate
    Gateway --> Transcribe
    
    Web -.->|WebRTC| LiveKit
    LiveKit --> Agent
    Agent --> Gemini
    Agent --> PatientDB
    
    OCR --> Cloudinary
    RAG --> Chroma
    RAG --> PG
    LLM --> Pharmacies
    PatientDB --> PG
    
    Gateway --> PG
    Gateway --> Firebase
\`\`\`

## 💊 Medicine Chatbot Architecture

\`\`\`mermaid
sequenceDiagram
    participant User
    participant React
    participant FastAPI
    participant LangChain
    participant Groq
    participant ChromaDB
    participant PostgreSQL
    participant Cloudinary
    
    User->>React: Upload prescription
    React->>FastAPI: POST /ocr-prescription
    FastAPI->>Cloudinary: Upload image
    Cloudinary-->>FastAPI: Image URL
    FastAPI->>Groq: Extract medicine names
    Groq-->>FastAPI: Medicine list
    FastAPI->>ChromaDB: Search for each medicine
    ChromaDB-->>FastAPI: Medicine details
    FastAPI->>PostgreSQL: Search for generics
    PostgreSQL-->>FastAPI: Generic details
    FastAPI->>LangChain: Generate analysis via LCEL
    LangChain->>Groq: Query LLM
    Groq-->>LangChain: Stream response
    LangChain-->>FastAPI: Stream response
    
    FastAPI-->>React: Streamed analysis
    React-->>User: Display results
\`\`\`

## 🎙️ HealthEcho Voice Agent Architecture

\`\`\`mermaid
sequenceDiagram
    participant User
    participant React
    participant FastAPI
    participant LiveKit
    participant Agent
    participant Gemini
    participant PostgreSQL
    
    User->>React: Click "Start Appointment"
    React->>FastAPI: GET /livekit-token
    FastAPI->>LiveKit: Create room
    FastAPI->>LiveKit: Dispatch agent
    LiveKit-->>FastAPI: Token
    FastAPI-->>React: Token + Room URL
    React->>LiveKit: Connect to room
    LiveKit->>Agent: Initialize session
    Agent->>Gemini: Start realtime session
    
    User->>LiveKit: Speak in Bengali
    LiveKit->>Agent: Stream audio
    Agent->>Gemini: Forward audio
    Gemini-->>Agent: Text + Audio response
    Agent->>PostgreSQL: lookup_patient(vin)
    PostgreSQL-->>Agent: Patient data
    Agent->>PostgreSQL: create_patient/update
    PostgreSQL-->>Agent: Confirmation
    Agent->>LiveKit: Stream response
    LiveKit-->>User: Play audio
\`\`\`

## 🗄️ Database Schema

\`\`\`mermaid
erDiagram
    medicines ||--o{ generics : "has"
    medicines ||--o{ manufacturers : "made by"
    generics ||--o{ indications : "treats"
    generics ||--o{ drug_classes : "belongs to"
    
    patients {
        int id PK
        string vin UK
        string name
        int age
        string phone
        string email
        text problem
        string department
        jsonb visit_history
        timestamp created_at
    }
    
    prescriptions {
        int id PK
        text user_email
        text image_url
        timestamp uploaded_at
    }
    
    chat_history {
        int id PK
        text user_email
        text session_id
        text role
        text content
        timestamp created_at
    }
    
    docs_config {
        int id PK
        boolean is_public
        timestamp scheduled_start
        timestamp scheduled_end
    }
    
    docs_sections {
        int id PK
        string section_id UK
        string title
        text content
        int order_index
    }
    
    docs_team {
        int id PK
        string name
        string role
        string email
        text image_url
        int order_index
    }
\`\`\`

## 🔧 Component Details

### Frontend Architecture

**Technology Stack**:
- React 18+ with Vite
- Lucide React for icons
- React Markdown for content rendering
- Firebase SDK for authentication
- LiveKit Client SDK for voice

**Key Components**:
- **App.jsx**: Main application router
- **Chat.jsx**: Medicine chatbot interface
- **AppointmentView.jsx**: Voice appointment interface
- **DocsPage.jsx**: Documentation page
- **DocsAdminPanel.jsx**: Admin panel for docs
- **AuthContext.jsx**: Authentication state management

### Backend Architecture

**Technology Stack**:
- FastAPI with Uvicorn
- PostgreSQL with psycopg2
- ChromaDB for vector search
- SentenceTransformers for embeddings
- Groq SDK for LLM services
- LiveKit Agents Framework

**API Endpoints**:

**Chatbot Endpoints**:
- \`POST /chat\`: RAG-powered medicine queries
- \`POST /ocr-prescription\`: Prescription image analysis
- \`POST /transcribe\`: Audio transcription
- \`POST /translate\`: Bengali translation
- \`POST /save-message\`: Save chat to history
- \`GET /chat-history\`: Retrieve user sessions
- \`GET /chat-session/{id}\`: Get session messages
- \`GET /prescriptions\`: Get user prescriptions

**Voice Agent Endpoints**:
- \`POST /livekit-token\`: Generate LiveKit token
- \`GET /livekit-token\`: Health check

**Docs Endpoints**:
- \`GET /api/docs/config\`: Get docs configuration
- \`GET /api/docs/content\`: Get docs content
- \`POST /api/docs/admin/config\`: Update config (admin)
- \`POST /api/docs/admin/section\`: Update section (admin)
- \`POST /api/docs/admin/team\`: Add team member (admin)

## 🔒 Security Architecture

**Authentication Flow**:
1. User signs in with Firebase
2. Firebase returns JWT token
3. Token stored in browser
4. Token sent with API requests
5. Backend validates token
6. User context established

**Authorization Flow**:
1. User requests protected resource
2. Backend checks user role
3. Admin checks against ADMIN_EMAIL
4. Resource access granted/denied

**Data Protection**:
- TLS 1.3 for all connections
- Data encryption at rest (planned)
- HIPAA-compliant practices
- Local data hosting (Bangladesh)
- Audit logging (planned)
