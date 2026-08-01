import json
import os
import numpy as np
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KB_DIR = os.path.join(BASE_DIR, "knowledge_base")

DOC_FILE = os.path.join(KB_DIR, "documents.json")
EMBED_FILE = os.path.join(KB_DIR, "embeddings.json")


def load_documents():
    with open(DOC_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def load_embeddings():
    with open(EMBED_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def semantic_search(query):

    docs = load_documents()
    embeddings = load_embeddings()

    query_embedding = model.encode(query)

    scores = []

    for i, emb in enumerate(embeddings):
        score = np.dot(query_embedding, emb)
        scores.append((float(score), docs[i]))

    scores.sort(reverse=True)

    return scores[:5]