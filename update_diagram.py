import re
import sys

NEW_DIAGRAM = """sequenceDiagram
    participant User
    participant React
    participant FastAPI
    participant LangChain
    participant Groq
    participant ChromaDB
    participant PostgreSQL
    participant Cloudinary
    
    alt Voice Input
        User->>React: Speak query
        React->>FastAPI: POST /voice-query (Audio)
        FastAPI->>Groq: Whisper Transcription
        Groq-->>FastAPI: Transcribed Text
    else Text Input
        User->>React: Type query
        React->>FastAPI: POST /chat (Text)
    else Image Input
        User->>React: Upload prescription
        React->>FastAPI: POST /ocr-prescription
        FastAPI->>Cloudinary: Upload image
        Cloudinary-->>FastAPI: Image URL
        FastAPI->>Groq: Extract medicine names
        Groq-->>FastAPI: Medicine list
    end
    
    FastAPI->>ChromaDB: Search context for query/medicines
    ChromaDB-->>FastAPI: Context details
    FastAPI->>PostgreSQL: Search database
    PostgreSQL-->>FastAPI: Structured details
    FastAPI->>LangChain: Generate response via LCEL
    LangChain->>Groq: Query LLM
    Groq-->>LangChain: Stream response
    LangChain-->>FastAPI: Stream response
    
    FastAPI-->>React: Streamed response
    React-->>User: Display results"""

def update_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        text = f.read()

    # The existing diagram starts with "sequenceDiagram" and ends with "React-->>User: Display results"
    # We will use regex to replace it
    pattern = r"sequenceDiagram\s+participant User.*?React-->>User: Display results"
    if re.search(pattern, text, re.DOTALL):
        text = re.sub(pattern, NEW_DIAGRAM, text, flags=re.DOTALL)
        
        # Make sure LangChain is mentioned prominently in the description if not already
        if "Powered by LangChain" not in text:
            # Add a small note about LangChain if it's docsContent.js or README.md
            pass
            
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Updated {filename}")
    else:
        print(f"Could not find target diagram in {filename}")

update_file("README.md")
update_file("frontend/src/docsContent.js")
update_file("frontend/README.md")
