from rag_service import semantic_search

def detect_similar_features(feature_name):
    results = semantic_search(feature_name)

    features = []

    for score, document in results:
        features.append(document)

    return features