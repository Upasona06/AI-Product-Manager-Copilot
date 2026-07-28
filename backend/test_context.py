from context_service import retrieve_context

query = "login authentication"

context = retrieve_context(query)

print("Retrieved Context:")
for item in context:
    print("-", item)