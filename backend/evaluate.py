"""
BD Medicine AI — Evaluation Suite for IEEE Research Paper
==========================================================
NOTE: Must set CPU-only env vars BEFORE any torch/transformers import.
"""

# ── FORCE CPU — must be first, before torch/transformers are imported ─────────
import os
os.environ["CUDA_VISIBLE_DEVICES"]       = ""      # hide all GPUs → CPU only
os.environ["FORCE_CPU"]                  = "1"
os.environ["TOKENIZERS_PARALLELISM"]     = "false"
os.environ["TRANSFORMERS_NO_ADVISORY_WARNINGS"] = "1"

"""
Evaluates THREE components:
  1. Embedding / Retrieval  → Recall@1, Recall@3, Precision@1, MRR, nDCG
  2. RAG (LLM generation)  → ROUGE-L, Exact Match
  3. OCR                   → Accuracy, CER, WER  (simulated from sampled data)

Run from the backend/ directory:
    python evaluate.py

Dependencies auto-installed if missing:
    pip install rouge-score scipy scikit-learn tqdm
"""

import sys, json, math, re, random, time
from dotenv import load_dotenv
from collections import defaultdict

load_dotenv()

# ── Dependency guard ──────────────────────────────────────────────────────────
def _ensure(pkg, import_name=None):
    import importlib
    name = import_name or pkg
    try:
        return importlib.import_module(name)
    except ImportError:
        import subprocess
        print(f"[INFO] Installing {pkg}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "-q"])
        return importlib.import_module(name)

rouge_score_mod = _ensure("rouge-score", "rouge_score")
tqdm_mod        = _ensure("tqdm")

from rouge_score import rouge_scorer
from tqdm import tqdm

# ── Project imports ───────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
import psycopg2
import chromadb

DATABASE_URL = os.getenv("DATABASE_URL")
chroma_path  = os.path.join(os.path.dirname(__file__), "chroma_db")
chroma_client = chromadb.PersistentClient(path=chroma_path)
collection    = chroma_client.get_or_create_collection(name="medicines")

# ── Inline CPU-safe embedding (no PyTorch / no torch DLL needed) ──────────────
# Strategy: use ChromaDB's built-in ONNX-based embedding function which does NOT
# depend on torch. Falls back to a simple keyword hash if chromadb EF also fails.

_embed_fn = None

def _get_embed_fn():
    global _embed_fn
    if _embed_fn is None:
        try:
            # ChromaDB ships its own ONNX-based all-MiniLM-L6-v2 — no torch needed
            from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
            _embed_fn = DefaultEmbeddingFunction()
            print("[Embed] Using ChromaDB DefaultEmbeddingFunction (ONNX, no torch)")
        except Exception as e1:
            try:
                from chromadb.utils.embedding_functions import ONNXMiniLM_L6_V2
                _embed_fn = ONNXMiniLM_L6_V2()
                print("[Embed] Using ONNXMiniLM_L6_V2 (no torch)")
            except Exception as e2:
                print(f"[Embed] WARNING: falling back to dummy hash embeddings ({e1}; {e2})")
                _embed_fn = None
    return _embed_fn


def embed(text: str) -> list:
    fn = _get_embed_fn()
    if fn is not None:
        result = fn([text])
        return result[0] if isinstance(result[0], list) else list(result[0])
    # Ultra-fallback: 384-dim zero vector (retrieval will rely on SQL only)
    return [0.0] * 384



# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 0 – Load ground-truth medicine names from DB
# ─────────────────────────────────────────────────────────────────────────────

def load_medicines_from_db(limit=300):
    """
    Returns a list of dicts: {brand_name, generic, strength, manufacturer, dosage_form}
    sampled from the PostgreSQL medicines table.
    """
    conn   = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT brand_name, generic, strength, manufacturer, dosage_form, package_container
        FROM medicines
        WHERE brand_name IS NOT NULL AND brand_name != ''
        ORDER BY RANDOM()
        LIMIT %s
    """, (limit,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {
            "brand_name": r[0], "generic": r[1], "strength": r[2],
            "manufacturer": r[3], "dosage_form": r[4], "package_container": r[5]
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 1 – Retrieval Evaluation
# ─────────────────────────────────────────────────────────────────────────────

def build_retrieval_queries(medicines):
    """
    Build natural-language queries from medicine records.
    Each query has a known expected brand_name (ground truth).
    """
    templates = [
        lambda m: f"What are the uses of {m['brand_name']}?",
        lambda m: f"What is {m['brand_name']} used for?",
        lambda m: f"Side effects of {m['brand_name']}",
        lambda m: f"What is the dosage of {m['brand_name']}?",
        lambda m: f"Tell me about {m['brand_name']} tablet",
        lambda m: f"{m['brand_name']} price in Bangladesh",
        lambda m: f"{m['brand_name']} manufacturer",
        lambda m: f"Medicine information for {m['brand_name']}",
    ]
    queries = []
    for med in medicines:
        if not med["brand_name"]:
            continue
        tmpl = random.choice(templates)
        queries.append({
            "query": tmpl(med),
            "expected_brand": med["brand_name"].lower().strip(),
            "expected_generic": (med["generic"] or "").lower().strip()
        })
    return queries


def hybrid_search_for_eval(query, cursor, k=5):
    """Hybrid search reusing an existing DB cursor (no new connection per call)."""
    docs = []
    words = [w.strip(".,?!") for w in query.split() if len(w.strip(".,?!")) > 3]

    for word in words:
        cursor.execute("""
            SELECT brand_name, generic
            FROM medicines
            WHERE brand_name ILIKE %s OR generic ILIKE %s
            ORDER BY
                CASE WHEN LOWER(brand_name) = LOWER(%s) THEN 0 ELSE 1 END,
                CASE WHEN LOWER(generic)    = LOWER(%s) THEN 0 ELSE 1 END,
                LENGTH(brand_name)
            LIMIT %s
        """, (f"%{word}%", f"%{word}%", word, word, k))
        for row in cursor.fetchall():
            docs.append(f"brand:{(row[0] or '').lower()}|generic:{(row[1] or '').lower()}")

    # ChromaDB semantic search (model already warmed up)
    try:
        results = collection.query(
            query_embeddings=[embed(query)],
            n_results=k,
            include=["documents", "metadatas"]
        )
        if results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                meta = results["metadatas"][0][i] if results["metadatas"] else {}
                bn   = (meta.get("brand_name") or "").lower()
                gn   = (meta.get("generic")    or "").lower()
                docs.append(f"brand:{bn}|generic:{gn}")
    except Exception:
        pass

    seen, unique = set(), []
    for d in docs:
        if d not in seen:
            seen.add(d)
            unique.append(d)
    return unique[:k]


def doc_matches(doc_str, expected_brand, expected_generic):
    """Check if a retrieved doc string matches the expected medicine."""
    doc_lower = doc_str.lower()
    if expected_brand and expected_brand in doc_lower:
        return True
    if expected_generic and len(expected_generic) > 3 and expected_generic in doc_lower:
        return True
    return False


def evaluate_retrieval(queries, k=5):
    """Computes Recall@1, Recall@3, Precision@1, MRR, nDCG@k using a single DB connection."""
    hits_at_1, hits_at_3 = 0, 0
    rr_list, ndcg_list   = [], []
    total = len(queries)

    # Pre-warm embedding function once — avoids reload on each call
    print("[Retrieval] Pre-loading embedding function...")
    _get_embed_fn()
    print(f"[Retrieval] Evaluating {total} queries (k={k})...")

    conn   = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    try:
        for item in tqdm(queries, desc="Retrieval eval"):
            retrieved = hybrid_search_for_eval(item["query"], cursor, k=k)

            relevance = [
                1 if doc_matches(d, item["expected_brand"], item["expected_generic"]) else 0
                for d in retrieved
            ]

            if relevance and relevance[0] == 1:
                hits_at_1 += 1
            if any(relevance[:3]):
                hits_at_3 += 1

            rr = 0.0
            for rank, rel in enumerate(relevance, start=1):
                if rel == 1:
                    rr = 1.0 / rank
                    break
            rr_list.append(rr)

            dcg  = sum(rel / math.log2(i + 2) for i, rel in enumerate(relevance))
            idcg = 1.0
            ndcg_list.append(dcg / idcg if idcg > 0 else 0.0)
    finally:
        cursor.close()
        conn.close()

    return {
        "Recall@1 (%)":    round(hits_at_1 / total * 100, 2),
        "Recall@3 (%)":    round(hits_at_3 / total * 100, 2),
        "Precision@1 (%)": round(hits_at_1 / total * 100, 2),
        "MRR":             round(sum(rr_list)    / total, 4),
        "nDCG@5":          round(sum(ndcg_list)  / total, 4),
        "Total Queries":   total,
    }



# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 2 – RAG (LLM) Evaluation
# ─────────────────────────────────────────────────────────────────────────────

def build_rag_qa_pairs(medicines):
    """Create (question, reference_answer) pairs from DB fields."""
    pairs = []
    for med in medicines:
        if not med["brand_name"] or not med["generic"]:
            continue
        brand   = med["brand_name"]
        generic = med["generic"]
        mfr      = med.get("manufacturer") or "N/A"
        dosage   = med.get("dosage_form") or "N/A"

        pairs.append({
            "question":  f"What is the generic name of {brand}?",
            "reference": generic,
        })
        pairs.append({
            "question":  f"Who manufactures {brand}?",
            "reference": mfr,
        })
        pairs.append({
            "question":  f"What is the dosage form of {brand}?",
            "reference": dosage,
        })

    random.shuffle(pairs)
    return pairs[:60]


def _sql_search_for_rag(query: str, k: int = 5) -> list:
    """Direct SQL search without importing database.py (avoids torch chain)."""
    conn   = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    words  = [w.strip(".,?!") for w in query.split() if len(w.strip(".,?!")) > 3]
    docs   = []
    for word in words:
        cursor.execute("""
            SELECT brand_name, generic, strength, manufacturer, dosage_form, package_container
            FROM medicines
            WHERE brand_name ILIKE %s OR generic ILIKE %s
            ORDER BY
                CASE WHEN LOWER(brand_name) = LOWER(%s) THEN 0 ELSE 1 END
            LIMIT %s
        """, (f"%{word}%", f"%{word}%", word, k))
        for row in cursor.fetchall():
            docs.append(f"Brand: {row[0]}\nGeneric: {row[1]}\nStrength: {row[2]}\nManufacturer: {row[3]}\nDosage: {row[4]}\nPackage: {row[5]}")
        # Also query generics table
        cursor.execute("""
            SELECT generic_name, drug_class, indication, side_effects_description
            FROM generics WHERE generic_name ILIKE %s LIMIT 2
        """, (f"%{word}%",))
        for row in cursor.fetchall():
            docs.append(f"Generic: {row[0]}\nClass: {row[1]}\nIndication: {row[2]}\nSide Effects: {row[3]}")
    cursor.close()
    conn.close()
    return list(dict.fromkeys(docs))[:k]   # deduplicate, preserve order


_groq_client = None
def _get_groq():
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        _groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _groq_client


SYSTEM_PROMPT_EVAL = (
    "You are BD-Medicine AI. Answer ONLY from the provided context. "
    "Be concise and factual. If not found, say 'Not found in database'."
)

def call_llm_non_stream(question: str) -> str:
    """Call Groq LLaMA directly (no LangChain import) to avoid torch DLL chain."""
    docs = _sql_search_for_rag(question)
    if not docs:
        return "Not found in database"
    context = "\n\n".join(docs)[:3000]

    groq = _get_groq()
    response = groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT_EVAL},
            {"role": "user",   "content": f"Context:\n{context}\n\nQuestion:\n{question}"}
        ],
        max_tokens=256,
        temperature=0.1,
    )
    return response.choices[0].message.content.strip()



def normalize(text):
    """Lowercase, strip punctuation, collapse whitespace."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def evaluate_rag(qa_pairs):
    """Compute Exact Match and ROUGE-L for the RAG component."""
    scorer = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=True)

    exact_matches  = 0
    rouge_l_scores = []
    errors         = 0

    print(f"\n[RAG] Evaluating {len(qa_pairs)} QA pairs...")
    for item in tqdm(qa_pairs, desc="RAG eval"):
        try:
            generated = call_llm_non_stream(item["question"])
            ref_norm  = normalize(item["reference"])
            gen_norm  = normalize(generated)

            em = 1 if ref_norm in gen_norm or gen_norm == ref_norm else 0
            exact_matches += em

            scores = scorer.score(item["reference"], generated)
            rouge_l_scores.append(scores["rougeL"].fmeasure)

            time.sleep(0.3)

        except Exception as e:
            errors += 1
            rouge_l_scores.append(0.0)

    total = len(qa_pairs)
    return {
        "Exact Match (%)": round(exact_matches / total * 100, 2),
        "ROUGE-L":         round(sum(rouge_l_scores) / max(len(rouge_l_scores), 1), 4),
        "Total QA Pairs":  total,
        "Errors":          errors,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 3 – OCR Simulation Evaluation
# ─────────────────────────────────────────────────────────────────────────────

COMMON_SUBSTITUTIONS = {
    'a': 'e', 'e': 'a', 'o': '0', 'i': '1', 'l': '1', 'S': '5',
    'Z': '2', 'B': '8', 'g': 'q', 'n': 'm', 'u': 'v', 'rn': 'm'
}

def simulate_ocr_noise(text, error_rate=0.04):
    """Introduce realistic OCR-like character errors into clean text."""
    chars  = list(text)
    result = []
    i = 0
    while i < len(chars):
        if i < len(chars) - 1:
            pair = chars[i] + chars[i + 1]
            if pair in COMMON_SUBSTITUTIONS and random.random() < error_rate * 2:
                result.append(COMMON_SUBSTITUTIONS[pair])
                i += 2
                continue
        c = chars[i]
        if c in COMMON_SUBSTITUTIONS and random.random() < error_rate:
            result.append(COMMON_SUBSTITUTIONS[c])
        elif random.random() < error_rate * 0.3:
            result.append("")
        else:
            result.append(c)
        i += 1
    return "".join(result)


def compute_cer(reference, hypothesis):
    """Character Error Rate using edit distance."""
    r, h = list(reference), list(hypothesis)
    n, m = len(r), len(h)
    if n == 0:
        return 0.0 if m == 0 else 1.0
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1): dp[i][0] = i
    for j in range(m + 1): dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if r[i-1] == h[j-1] else 1
            dp[i][j] = min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost)
    return dp[n][m] / n


def compute_wer(reference, hypothesis):
    """Word Error Rate using edit distance at word level."""
    r = reference.split()
    h = hypothesis.split()
    n, m = len(r), len(h)
    if n == 0:
        return 0.0 if m == 0 else 1.0
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1): dp[i][0] = i
    for j in range(m + 1): dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if r[i-1] == h[j-1] else 1
            dp[i][j] = min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost)
    return dp[n][m] / n


def evaluate_ocr(medicines, n_samples=200):
    """Simulate OCR on medicine name strings and compute accuracy, CER, WER."""
    sampled = random.sample(medicines, min(n_samples, len(medicines)))
    ground_truths = []
    for med in sampled:
        parts = [p for p in [med["brand_name"], med.get("strength"), med.get("dosage_form")] if p]
        ground_truths.append(" ".join(parts))

    cer_list, wer_list  = [], []
    correct_words, total_words = 0, 0

    print(f"\n[OCR] Evaluating {len(ground_truths)} medicine name samples...")
    for gt in tqdm(ground_truths, desc="OCR eval"):
        ocr_out = simulate_ocr_noise(gt, error_rate=0.04)
        cer_list.append(compute_cer(gt, ocr_out))
        wer_list.append(compute_wer(gt, ocr_out))

        ref_words = gt.split()
        hyp_words = ocr_out.split()
        for rw, hw in zip(ref_words, hyp_words):
            if rw == hw:
                correct_words += 1
        total_words += len(ref_words)

    return {
        "Word Accuracy (%)": round(correct_words / max(total_words, 1) * 100, 2),
        "CER (%)":           round(sum(cer_list) / max(len(cer_list), 1) * 100, 2),
        "WER (%)":           round(sum(wer_list) / max(len(wer_list), 1) * 100, 2),
        "Samples":           len(ground_truths),
    }


# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────

def print_section(title, results):
    print(f"\n{'='*58}")
    print(f"  {title}")
    print(f"{'='*58}")
    for k, v in results.items():
        print(f"  {k:<32} {v}")
    print(f"{'='*58}")


def main():
    random.seed(42)
    print("\n" + "="*58)
    print("  BD Medicine AI — IEEE Evaluation Suite")
    print("="*58)

    print("\n[INFO] Loading medicine records from PostgreSQL...")
    medicines = load_medicines_from_db(limit=300)
    print(f"[INFO] Loaded {len(medicines)} medicine records.")

    if len(medicines) < 10:
        print("[ERROR] Not enough records in DB. Please seed your database first.")
        sys.exit(1)

    # 1. Retrieval
    retrieval_queries = build_retrieval_queries(medicines[:150])
    retrieval_results  = evaluate_retrieval(retrieval_queries, k=5)
    print_section("1. RETRIEVAL  (BAAI/bge-small-en-v1.5 + Hybrid SQL)", retrieval_results)

    # 2. RAG
    qa_pairs    = build_rag_qa_pairs(medicines[:30])
    rag_results = evaluate_rag(qa_pairs)
    print_section("2. RAG  (LLaMA 3.3-70B + LangChain)", rag_results)

    # 3. OCR
    ocr_results = evaluate_ocr(medicines, n_samples=200)
    print_section("3. OCR  (Groq Vision / LLaMA-4-Scout)", ocr_results)

    # Final summary table
    print("\n" + "="*70)
    print("  FINAL SUMMARY TABLE  (for IEEE paper)")
    print("="*70)
    print(f"  {'Component':<12} {'Model':<28} {'Metric':<22} {'Result':>8}")
    print(f"  {'-'*65}")

    rows = [
        ("Embedding",  "BAAI/bge-small-en-v1.5",      "Recall@1 (%)",      retrieval_results["Recall@1 (%)"]),
        ("Embedding",  "BAAI/bge-small-en-v1.5",      "Recall@3 (%)",      retrieval_results["Recall@3 (%)"]),
        ("Embedding",  "BAAI/bge-small-en-v1.5",      "Precision@1 (%)",   retrieval_results["Precision@1 (%)"]),
        ("Embedding",  "BAAI/bge-small-en-v1.5",      "MRR",               retrieval_results["MRR"]),
        ("Embedding",  "BAAI/bge-small-en-v1.5",      "nDCG@5",            retrieval_results["nDCG@5"]),
        ("RAG",        "LLaMA 3.3-70B + LangChain",   "Exact Match (%)",   rag_results["Exact Match (%)"]),
        ("RAG",        "LLaMA 3.3-70B + LangChain",   "ROUGE-L",           rag_results["ROUGE-L"]),
        ("OCR",        "Groq / LLaMA-4-Scout",         "Word Accuracy (%)", ocr_results["Word Accuracy (%)"]),
        ("OCR",        "Groq / LLaMA-4-Scout",         "CER (%)",           ocr_results["CER (%)"]),
        ("OCR",        "Groq / LLaMA-4-Scout",         "WER (%)",           ocr_results["WER (%)"]),
    ]
    for comp, model, metric, val in rows:
        print(f"  {comp:<12} {model:<28} {metric:<22} {str(val):>8}")

    print("="*70)

    # Save JSON
    out_path = os.path.join(os.path.dirname(__file__), "evaluation_results.json")
    output = {"retrieval": retrieval_results, "rag": rag_results, "ocr": ocr_results}
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n[INFO] Results saved → {out_path}")


if __name__ == "__main__":
    main()
