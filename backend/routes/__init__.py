"""
routes/__init__.py
"""
from .auth_routes import auth_bp
from .ingest_routes import ingest_bp
from .process_routes import process_bp
from .classify_routes import classify_bp
from .aggregate_routes import aggregate_bp
from .prioritize_routes import prioritize_bp
from .prd_routes import prd_bp
from .assistant_routes import assistant_bp
from .roadmap_routes import roadmap_bp
from .report_routes import report_bp

__all__ = [
    "auth_bp",
    "ingest_bp",
    "process_bp",
    "classify_bp",
    "aggregate_bp",
    "prioritize_bp",
    "prd_bp",
    "assistant_bp",
    "roadmap_bp",
    "report_bp"
]


