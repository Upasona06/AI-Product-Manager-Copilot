import json
import os
from sentence_transformers import SentenceTransformer

# Load embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KB_DIR = os.path.join(BASE_DIR, "knowledge_base")

DOC_FILE = os.path.join(KB_DIR, "documents.json")
EMBED_FILE = os.path.join(KB_DIR, "embeddings.json")

# Load documents
with open(DOC_FILE, "r", encoding="utf-8") as f:
    documents = json.load(f)

# Generate embeddings
embeddings = model.encode(documents).tolist()

# Save embeddings
with open(EMBED_FILE, "w", encoding="utf-8") as f:
    json.dump(embeddings, f, indent=4)

print("✅ Embeddings generated successfully!")
print(f"Total Documents: {len(documents)}")