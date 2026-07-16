import chromadb
from embeddings import embed
import os

db_path = os.path.join(os.path.dirname(__file__), "chroma_db")
client = chromadb.PersistentClient(path=db_path)

collection = client.get_or_create_collection(
    name="medicines"
)

def add_documents(docs):
    # ChromaDB requires batches if size is too large, but for now we'll do it in chunks of 5000
    batch_size = 5000
    for i in range(0, len(docs), batch_size):
        batch = docs[i:i + batch_size]
        
        # Avoid duplicate additions by checking existing IDs
        existing_ids = collection.get(ids=[doc["id"] for doc in batch])["ids"]
        
        new_batch = [doc for doc in batch if doc["id"] not in existing_ids]
        
        if new_batch:
            print(f"Adding batch of {len(new_batch)} documents to vector DB...")
            collection.add(
                ids=[doc["id"] for doc in new_batch],
                documents=[doc["text"] for doc in new_batch],
                embeddings=[embed(doc["text"]) for doc in new_batch],
                metadatas=[doc["metadata"] for doc in new_batch]
            )

def search(query, k=5):
    results = collection.query(
        query_embeddings=[embed(query)],
        n_results=k
    )
    
    if not results["documents"] or len(results["documents"][0]) == 0:
        return []

    return results["documents"][0]
