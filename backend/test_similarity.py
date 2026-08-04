from rag_service import semantic_search

feature = "authentication"

results = semantic_search(feature)

print(f"\nFeatures similar to '{feature}':\n")

for score, document in results:
    print(f"{score:.4f} -> {document}")