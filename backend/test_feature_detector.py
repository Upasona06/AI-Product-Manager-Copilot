from feature_detector import detect_similar_features

query = "login authentication"

features = detect_similar_features(query)

print("Similar Features:")

for feature in features:
    print("-", feature)