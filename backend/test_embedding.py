from embedding_service import generate_embedding

text = "AI Product Manager"

embedding = generate_embedding(text)

print("Embedding Length:", len(embedding))
print(embedding[:10])