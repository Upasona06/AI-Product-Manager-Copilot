"""
routes/__init__.py
"""
from .auth_routes import auth_bp
from .ingest_routes import ingest_bp
from .process_routes import process_bp
from .classify_routes import classify_bp
from .aggregate_routes import aggregate_bp
from .prioritize_routes import prioritize_bp
from .rag_routes import rag_bp

__all__ = [
    "auth_bp",
    "ingest_bp",
    "process_bp",
    "classify_bp",
    "aggregate_bp",
    "prioritize_bp",
    "rag_bp"
]
