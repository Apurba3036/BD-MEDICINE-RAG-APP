from database import hybrid_search as search
from groq import Groq
import os
import base64
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """
You are BD-Medicine AI, an expert assistant specializing in Bangladeshi medicines.

Rules:
- Only use provided context
- Never guess medicine info
- If not found, say "Not found in database"
- Do not give medical diagnosis or prescriptions
- IMPORTANT: Whenever you mention a specific medicine name in your response, wrap it in double square brackets like this: [[MedicineName]]. Example: [[Napa]], [[Amoxicillin]], [[Seclo]]. This is required for every medicine name you mention.
"""

PRESCRIPTION_ANALYSIS_PROMPT = """
You are BD-Medicine AI, an expert assistant specializing in Bangladeshi medicines.

The user has uploaded a prescription. The following medicines were extracted from it:
{medicines}

For EACH medicine listed, provide a structured analysis using the context provided:
1. **Generic Name & Brand**
2. **Usage / Indication**
3. **Price (Bangladesh)**
4. **Side Effects**
5. **Manufacturer**
6. **Dosage Form**

Rules:
- Only use provided context for prices and manufacturers
- If info not found in context, say "Not found in local database" for that field
- Do not give medical diagnosis or dosage advice
- IMPORTANT: Wrap every medicine name in double square brackets: [[MedicineName]]
- Be comprehensive but concise
"""


def ask_llm(question):
    context_docs = search(question)

    if not context_docs:
        yield "Not found in database"
        return

    context = "\n\n".join(context_docs)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"""
Context:
{context}

Question:
{question}
"""
            }
        ],
        stream=True
    )

    for chunk in response:
        if chunk.choices[0].delta.content is not None:
            yield chunk.choices[0].delta.content


def extract_medicines_from_image(image_base64: str, mime_type: str) -> str:
    """Use Groq vision model to extract medicine names from a prescription image."""
    response = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_base64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": (
                            "This is a medical prescription. Please extract ALL medicine/drug names written on this prescription. "
                            "List each medicine on a separate line. Include the brand name as written. "
                            "Only list medicine names, nothing else. If you cannot read a name clearly, include your best guess with a ? mark."
                        )
                    }
                ]
            }
        ],
        max_tokens=1024
    )
    return response.choices[0].message.content.strip()


def analyze_prescription(image_base64: str, mime_type: str):
    """Full pipeline: OCR image → extract medicines → RAG search → stream analysis."""
    # Step 1: Extract medicine names from image
    medicines_text = extract_medicines_from_image(image_base64, mime_type)

    if not medicines_text:
        yield "Could not extract any medicine names from the prescription image."
        return

    yield f"🔍 **Medicines detected on prescription:**\n{medicines_text}\n\n---\n\n"

    # Step 2: Search context for all extracted medicines
    medicine_lines = [m.strip() for m in medicines_text.split("\n") if m.strip()]
    all_context_docs = []

    for medicine in medicine_lines:
        docs = search(medicine)
        if docs:
            # Take only the top 1 result per medicine to keep context small
            all_context_docs.extend(docs[:1])

    # Deduplicate and cap at 5 total docs to stay within token limits
    seen = set()
    unique_docs = []
    for doc in all_context_docs:
        if doc not in seen and len(unique_docs) < 5:
            seen.add(doc)
            unique_docs.append(doc)

    # Hard-truncate context to ~3000 chars to stay within free-tier TPM
    raw_context = "\n\n".join(unique_docs) if unique_docs else "No matching records found in local database."
    context = raw_context[:3000] + ("..." if len(raw_context) > 3000 else "")

    # Step 3: Stream full analysis
    # Use llama-3.1-8b-instant: 250K TPM limit vs 12K for 70b on free tier
    yield "📋 **Prescription Analysis:**\n\n"

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": PRESCRIPTION_ANALYSIS_PROMPT.format(medicines=medicines_text)
            },
            {
                "role": "user",
                "content": f"Context from Bangladesh medicine database:\n\n{context}"
            }
        ],
        stream=True
    )

    for chunk in response:
        if chunk.choices[0].delta.content is not None:
            yield chunk.choices[0].delta.content
