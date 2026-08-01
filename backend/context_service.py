from rag_service import semantic_search

def retrieve_context(query):
    results = semantic_search(query)

    context = []

    for score, document in results:
        context.append(document)

    return context