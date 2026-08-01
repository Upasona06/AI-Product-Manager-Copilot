from rag_service import semantic_search

query = "login authentication"

results = semantic_search(query)

print("Semantic Search Results:\n")

for score, document in results:
    print(f"{score:.4f} -> {document}")