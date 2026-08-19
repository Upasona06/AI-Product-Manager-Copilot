import sys
import time

print("Starting import check...")

modules = [
    ("os", lambda: __import__("os")),
    ("dotenv", lambda: __import__("dotenv")),
    ("flask", lambda: __import__("flask")),
    ("flask_jwt_extended", lambda: __import__("flask_jwt_extended")),
    ("flask_cors", lambda: __import__("flask_cors")),
    ("config", lambda: __import__("config")),
    ("database.db", lambda: __import__("database.db")),
    ("routes.auth_routes", lambda: __import__("routes.auth_routes")),
    ("routes.ingest_routes", lambda: __import__("routes.ingest_routes")),
    ("routes.process_routes", lambda: __import__("routes.process_routes")),
    ("routes.classify_routes", lambda: __import__("routes.classify_routes")),
    ("routes.aggregate_routes", lambda: __import__("routes.aggregate_routes")),
    ("routes.prioritize_routes", lambda: __import__("routes.prioritize_routes")),
    ("routes.prd_routes", lambda: __import__("routes.prd_routes")),
    ("routes.assistant_routes", lambda: __import__("routes.assistant_routes")),
    ("routes.roadmap_routes", lambda: __import__("routes.roadmap_routes")),
    ("routes.report_routes", lambda: __import__("routes.report_routes")),
]

for name, imp_fn in modules:
    t0 = time.time()
    imp_fn()
    t1 = time.time()
    print(f"Imported {name} in {t1 - t0:.4f} seconds")

print("All imports finished!")
