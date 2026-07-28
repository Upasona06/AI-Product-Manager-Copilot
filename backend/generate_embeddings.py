import json
import os
from embedding_service import generate_embedding

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KB_DIR = os.path.join(BASE_DIR, "knowledge_base")

DOC_FILE = os.path.join(KB_DIR, "documents.json")
EMBED_FILE = os.path.join(KB_DIR, "embeddings.json")

with open(DOC_FILE, "r", encoding="utf-8") as f:
    documents = json.load(f)

embeddings = []

for doc in documents:
    embeddings.append(generate_embedding(doc))

with open(EMBED_FILE, "w", encoding="utf-8") as f:
    json.dump(embeddings, f)

print("Embeddings Generated Successfully!")