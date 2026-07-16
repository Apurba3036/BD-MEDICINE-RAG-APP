import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    # Shift order indexes down
    cursor.execute('UPDATE docs_sections SET order_index = order_index + 1 WHERE order_index >= 5')

    # Insert LiveKit Section
    cursor.execute('''
        INSERT INTO docs_sections (section_id, title, content, order_index)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (section_id) DO NOTHING
    ''', ("voice_agent", "5. AI Voice Receptionist (Asha)", "### Asha: Bengali AI Voice Agent\nPowered by **LiveKit** and **Google Gemini Realtime**, Asha acts as a virtual hospital receptionist. \n- Auto-detects returning patients via VIN.\n- Collects symptoms verbally in fluent Bengali.\n- Routes patients to the correct hospital department automatically.\n\nCode resides in `backend/livekit_agent.py`.", 5))

    # Update Architecture Section
    cursor.execute('''
        UPDATE docs_sections 
        SET content = %s, title = '6. Architecture Diagram'
        WHERE section_id = 'architecture'
    ''', ("```mermaid\ngraph TD;\n    UI[Frontend: React/Vite] --> API[Backend: FastAPI];\n    API --> DB[(PostgreSQL + Neon)];\n    API --> Cloudinary[Image Storage];\n    API --> LLM[Groq LLM + Whisper];\n    API --> Vector[(ChromaDB Rag)];\n    API --> LiveKit[LiveKit Voice Agent];\n```",))
    
    cursor.execute("UPDATE docs_sections SET title = '7. API Documentation' WHERE section_id = 'api_docs'")
    cursor.execute("UPDATE docs_sections SET title = '8. Roadmap' WHERE section_id = 'roadmap'")

    conn.commit()
    cursor.close()
    conn.close()
    print("LiveKit docs inserted into live database successfully.")
except Exception as e:
    print(f"Error: {e}")
