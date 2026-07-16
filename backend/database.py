import psycopg2
import os
import chromadb
from embeddings import embed
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
chroma_path = os.path.join(os.path.dirname(__file__), "chroma_db")

client = chromadb.PersistentClient(path=chroma_path)
collection = client.get_or_create_collection(name="medicines")

def load_medicines_from_db():
    """Load medicines from PostgreSQL for ChromaDB indexing."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # Fetch medicines from database with unique identifier
    cursor.execute('''
        SELECT brand_name, generic, strength, manufacturer, dosage_form, package_container
        FROM medicines
        LIMIT 1000
    ''')
    
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    docs = []
    for idx, row in enumerate(rows):
        brand_name, generic, strength, manufacturer, dosage_form, package_container = row
        text = f"""
        Brand: {brand_name}
        Generic: {generic}
        Strength: {strength}
        Manufacturer: {manufacturer}
        Dosage: {dosage_form}
        Price/Package: {package_container}
        """
        
        # Use index to ensure unique IDs
        doc_id = f"{idx}_{brand_name}_{generic}".replace(" ", "_").lower()
        
        docs.append({
            "id": doc_id,
            "text": text,
            "metadata": {
                "brand_name": str(brand_name) if brand_name else "",
                "generic": str(generic) if generic else "",
                "strength": str(strength) if strength else "",
                "manufacturer": str(manufacturer) if manufacturer else "",
                "dosage_form": str(dosage_form) if dosage_form else ""
            }
        })
    
    return docs

def clear_chroma_collection():
    """Clear the ChromaDB collection to avoid duplicate ID conflicts."""
    try:
        collection.delete()
        print("Medicines loaded successfully.")
    except Exception as e:
        print(f"Error loading medicines: {e}")

# ── DOCS SYSTEM: Schema & Init ────────────────────────────────────────────────
def init_docs_tables():
    """Create tables and seed initial data for the live /docs system."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()

        # 1. Configuration Table (Singleton)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS docs_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                is_public BOOLEAN DEFAULT FALSE,
                scheduled_start TIMESTAMP,
                scheduled_end TIMESTAMP
            )
        ''')

        # 2. Sections Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS docs_sections (
                id SERIAL PRIMARY KEY,
                section_id VARCHAR(100) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                order_index INTEGER NOT NULL
            )
        ''')

        # 3. Team Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS docs_team (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                role VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                image_url TEXT,
                order_index INTEGER DEFAULT 0
            )
        ''')

        # Seed Config
        cursor.execute('SELECT COUNT(*) FROM docs_config')
        if cursor.fetchone()[0] == 0:
            cursor.execute('''
                INSERT INTO docs_config (id, is_public, scheduled_start, scheduled_end)
                VALUES (1, TRUE, '2026-06-10 00:00:00', '2026-06-14 23:59:59')
            ''')

        # Seed Default YC Sections
        cursor.execute('SELECT COUNT(*) FROM docs_sections')
        if cursor.fetchone()[0] == 0:
            default_sections = [
                ("problem", "1. Problem", "The healthcare system in BD lacks accessible, localized AI tools for understanding complex medical data and prescriptions.", 1),
                ("solution", "2. Solution", "A highly contextual AI chatbot and prescription OCR system trained on BD medical datasets, delivering accurate, localized answers.", 2),
                ("market", "3. Market Opportunity", "Over 160M population in BD with increasing digital adoption. The digital health market is growing at a 20% CAGR.", 3),
                ("product", "4. Product Overview", "Users upload prescriptions, get text transcripts via Whisper Voice input, and chat about medicine dosages, prices, and side effects.", 4),
                ("voice_agent", "5. AI Voice Receptionist (Asha)", "### Asha: Bengali AI Voice Agent\nPowered by **LiveKit** and **Google Gemini Realtime**, Asha acts as a virtual hospital receptionist. \n- Auto-detects returning patients via VIN.\n- Collects symptoms verbally in fluent Bengali.\n- Routes patients to the correct hospital department automatically.\n\nCode resides in `backend/livekit_agent.py`.", 5),
                ("architecture", "6. Architecture Diagram", "```mermaid\ngraph TD;\n    UI[Frontend: React/Vite] --> API[Backend: FastAPI];\n    API --> DB[(PostgreSQL + Neon)];\n    API --> Cloudinary[Image Storage];\n    API --> LLM[Groq LLM + Whisper];\n    API --> Vector[(ChromaDB Rag)];\n    API --> LiveKit[LiveKit Voice Agent];\n```", 6),
                ("api_docs", "7. API Documentation", "### Exposed Endpoints\n- `POST /chat` - Standard RAG chat\n- `POST /ocr-prescription` - Image to text\n- `POST /transcribe` - Audio to text", 7),
                ("roadmap", "8. Roadmap", "- **Q3**: Launch mobile app wrap\n- **Q4**: Integrate direct pharmacy ordering", 8),
            ]
            cursor.executemany('''
                INSERT INTO docs_sections (section_id, title, content, order_index)
                VALUES (%s, %s, %s, %s)
            ''', default_sections)

        conn.commit()
        cursor.close()
        conn.close()
        print("Docs tables initialized and seeded successfully.")
    except Exception as e:
        print(f"Error initializing docs tables: {e}")

# ── Prescriptions Table ────────────────────────────────────────────────────────

def create_prescriptions_table():
    """Create prescriptions table to store Cloudinary image URLs per user."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prescriptions (
            id SERIAL PRIMARY KEY,
            user_email TEXT NOT NULL,
            image_url TEXT NOT NULL,
            uploaded_at TIMESTAMPTZ DEFAULT NOW()
        )
    ''')
    conn.commit()
    cursor.close()
    conn.close()
    print("Prescriptions table ready.")

def save_prescription_record(user_email: str, image_url: str):
    """Save a prescription Cloudinary URL linked to a user email."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO prescriptions (user_email, image_url) VALUES (%s, %s) RETURNING id",
        (user_email, image_url)
    )
    record_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return record_id

def get_user_prescriptions(user_email: str):
    """Get all prescriptions for a user."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, image_url, uploaded_at FROM prescriptions WHERE user_email = %s ORDER BY uploaded_at DESC",
        (user_email,)
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [{"id": r[0], "image_url": r[1], "uploaded_at": str(r[2])} for r in rows]


# ── Chat History Table ─────────────────────────────────────────────────────────

def create_chat_history_table():
    """Create chat_history table to persist conversations per user."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_history (
            id SERIAL PRIMARY KEY,
            user_email TEXT NOT NULL,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    ''')
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_email)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id)"
    )
    conn.commit()
    cursor.close()
    conn.close()
    print("Chat history table ready.")

def save_chat_message(user_email: str, session_id: str, role: str, content: str):
    """Save a single chat message to the history."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_history (user_email, session_id, role, content) VALUES (%s, %s, %s, %s) RETURNING id",
        (user_email, session_id, role, content)
    )
    record_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return record_id

def get_user_sessions(user_email: str):
    """Get distinct chat sessions for a user with preview of first message."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT DISTINCT ON (session_id)
            session_id,
            content AS preview,
            created_at
        FROM chat_history
        WHERE user_email = %s AND role = 'user'
        ORDER BY session_id, created_at ASC
    ''', (user_email,))
    rows = cursor.fetchall()

    # Also get the latest timestamp per session for sorting
    cursor.execute('''
        SELECT session_id, MAX(created_at) as last_active
        FROM chat_history
        WHERE user_email = %s
        GROUP BY session_id
        ORDER BY last_active DESC
    ''', (user_email,))
    order_map = {r[0]: str(r[1]) for r in cursor.fetchall()}

    cursor.close()
    conn.close()

    sessions = []
    for r in rows:
        sessions.append({
            "session_id": r[0],
            "preview": r[1][:80] + "..." if len(r[1]) > 80 else r[1],
            "started_at": str(r[2]),
            "last_active": order_map.get(r[0], str(r[2]))
        })

    # Sort by last_active descending
    sessions.sort(key=lambda x: x["last_active"], reverse=True)
    return sessions

def get_session_messages(session_id: str, user_email: str):
    """Get all messages in a specific session, verified by user_email."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT role, content, created_at FROM chat_history WHERE session_id = %s AND user_email = %s ORDER BY created_at ASC",
        (session_id, user_email)
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [{"role": r[0], "content": r[1], "created_at": str(r[2])} for r in rows]


# ── Hybrid Search ──────────────────────────────────────────────────────────────

def hybrid_search(query, k=5):
    docs = []
    
    # 1. SQL Search (Exact/Partial Match)
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # Extract words from query longer than 3 chars to search
    words = [w.strip('.,?!') for w in query.split() if len(w.strip('.,?!')) > 3]
    
    matched_generics = set()
    
    for word in words:
        # Search brand name or generic in medicines
        cursor.execute('''
            SELECT brand_name, generic, strength, manufacturer, dosage_form, package_container
            FROM medicines 
            WHERE brand_name ILIKE %s OR generic ILIKE %s
            ORDER BY 
                CASE WHEN LOWER(brand_name) = LOWER(%s) THEN 0 ELSE 1 END,
                CASE WHEN LOWER(generic) = LOWER(%s) THEN 0 ELSE 1 END,
                LENGTH(brand_name)
            LIMIT 10
        ''', (f"%{word}%", f"%{word}%", word, word))
        
        for row in cursor.fetchall():
            docs.append(f"Brand: {row[0]}\nGeneric: {row[1]}\nStrength: {row[2]}\nManufacturer: {row[3]}\nDosage: {row[4]}\nPrice/Package: {row[5]}")
            if row[1] and str(row[1]).strip() != 'nan':
                matched_generics.add(str(row[1]).strip())
                
        # Search directly in generics
        cursor.execute('''
            SELECT generic_name, drug_class, indication, pharmacology_description, dosage_description, side_effects_description, pregnancy_and_lactation_description
            FROM generics 
            WHERE generic_name ILIKE %s
            ORDER BY 
                CASE WHEN LOWER(generic_name) = LOWER(%s) THEN 0 ELSE 1 END
            LIMIT 3
        ''', (f"%{word}%", word))
        
        for row in cursor.fetchall():
            docs.append(f"Generic Details - Name: {row[0]}\nClass: {row[1]}\nIndication: {row[2]}\nPharmacology: {row[3]}\nDosage Instructions: {row[4]}\nSide Effects: {row[5]}\nPregnancy: {row[6]}")

        # Search manufacturers
        try:
            cursor.execute("SELECT manufacturer_name, generics_count, brand_names_count FROM manufacturers WHERE manufacturer_name ILIKE %s LIMIT 2", (f"%{word}%",))
            for row in cursor.fetchall():
                docs.append(f"Manufacturer: {row[0]}\nGenerics Count: {row[1]}\nBrand Names Count: {row[2]}")
        except:
            conn.rollback()

        # Search indications
        try:
            cursor.execute("SELECT indication_name, generics_count FROM indications WHERE indication_name ILIKE %s LIMIT 2", (f"%{word}%",))
            for row in cursor.fetchall():
                docs.append(f"Indication: {row[0]}\nGenerics Count: {row[1]}")
        except:
            conn.rollback()
        
        # Search drug classes
        try:
            cursor.execute("SELECT drug_class_name, generics_count FROM drug_classes WHERE drug_class_name ILIKE %s LIMIT 2", (f"%{word}%",))
            for row in cursor.fetchall():
                docs.append(f"Drug Class: {row[0]}\nGenerics Count: {row[1]}")
        except:
            conn.rollback()

    # Fetch detailed info for any generics matched via brand name
    for gen in list(matched_generics)[:3]: # limit to avoid huge prompts
        cursor.execute('''
            SELECT generic_name, drug_class, indication, pharmacology_description, dosage_description, side_effects_description, pregnancy_and_lactation_description
            FROM generics 
            WHERE generic_name = %s
            LIMIT 1
        ''', (gen,))
        for row in cursor.fetchall():
            docs.append(f"Generic Details - Name: {row[0]}\nClass: {row[1]}\nIndication: {row[2]}\nPharmacology: {row[3]}\nDosage Instructions: {row[4]}\nSide Effects: {row[5]}\nPregnancy: {row[6]}")

    cursor.close()
    conn.close()
    
    # 2. Semantic Search (ChromaDB)
    try:
        results = collection.query(
            query_embeddings=[embed(query)],
            n_results=k
        )
        if results["documents"] and len(results["documents"][0]) > 0:
            docs.extend(results["documents"][0])
    except Exception:
        pass
        
    # We increase the limit because LLMs can handle large context windows (Llama 3.3 handles 8k+ easily)
    return list(set(docs))[:15]

# ── DOCS SYSTEM: Queries ──────────────────────────────────────────────────────

def get_docs_config():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute('SELECT is_public, scheduled_start, scheduled_end FROM docs_config WHERE id = 1')
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if row:
            return {"is_public": row[0], "scheduled_start": row[1], "scheduled_end": row[2]}
        return None
    except Exception as e:
        print(f"Error getting docs config: {e}")
        return None

def update_docs_config(is_public: bool, start_dt, end_dt):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE docs_config 
            SET is_public = %s, scheduled_start = %s, scheduled_end = %s
            WHERE id = 1
        ''', (is_public, start_dt, end_dt))
        conn.commit()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating docs config: {e}")
        return False

def get_docs_sections():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute('SELECT id, section_id, title, content, order_index FROM docs_sections ORDER BY order_index ASC')
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return [{"id": r[0], "section_id": r[1], "title": r[2], "content": r[3], "order_index": r[4]} for r in rows]
    except Exception as e:
        print(f"Error getting docs sections: {e}")
        return []

def update_docs_section(section_id: str, title: str, content: str):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE docs_sections 
            SET title = %s, content = %s
            WHERE section_id = %s
        ''', (title, content, section_id))
        conn.commit()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating docs section: {e}")
        return False

def get_docs_team():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute('SELECT id, name, role, email, image_url, order_index FROM docs_team ORDER BY order_index ASC')
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return [{"id": r[0], "name": r[1], "role": r[2], "email": r[3], "image_url": r[4], "order_index": r[5]} for r in rows]
    except Exception as e:
        print(f"Error getting docs team: {e}")
        return []

def add_docs_team_member(name: str, role: str, email: str, image_url: str):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO docs_team (name, role, email, image_url)
            VALUES (%s, %s, %s, %s) RETURNING id
        ''', (name, role, email, image_url))
        new_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return new_id
    except Exception as e:
        print(f"Error adding docs team member: {e}")
        return None

def remove_docs_team_member(member_id: int):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM docs_team WHERE id = %s', (member_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Error removing docs team member: {e}")
        return False
