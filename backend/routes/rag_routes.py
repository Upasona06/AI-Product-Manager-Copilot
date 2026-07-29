"""
routes/rag_routes.py — Flask Blueprint for Module 7 Knowledge Base & RAG Engine
Endpoints: POST /index, POST /search, GET /stats
"""

import uuid
import logging
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity

from services.rag_service import RAGService

logger = logging.getLogger(__name__)

rag_bp = Blueprint("rag_bp", __name__)

# Module-level singleton to avoid re-initializing on every request
_rag_service_instance = None


def _get_rag_service() -> RAGService:
    """Lazy-initialize and return the RAG service singleton."""
    global _rag_service_instance
    if _rag_service_instance is None:
        _rag_service_instance = RAGService(current_app.config)
    return _rag_service_instance


# ------------------------------------------------------------------
# POST /api/rag/index — Index feedback into ChromaDB
# ------------------------------------------------------------------
@rag_bp.route("/index", methods=["POST"])
@jwt_required()
def index_feedback():
    """Generate embeddings and store all processed feedback in ChromaDB."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can index the knowledge base."
        }), 403

    data = request.get_json() or {}
    project_id_str = data.get("project_id") or claims.get("project_id")

    if not project_id_str:
        return jsonify({
            "success": False,
            "error": "Missing project_id."
        }), 400

    try:
        project_id = uuid.UUID(project_id_str)
    except ValueError:
        return jsonify({
            "success": False,
            "error": "Invalid project_id format."
        }), 400

    try:
        rag_service = _get_rag_service()
        stats = rag_service.index_all_feedback(project_id)

        logger.info(
            "RAG Index: Completed for project %s — indexed=%d, skipped=%d, errors=%d",
            str(project_id), stats.get("total_indexed", 0),
            stats.get("total_skipped", 0), stats.get("total_errors", 0),
        )

        return jsonify({
            "success": True,
            "data": {
                "message": "Knowledge base indexing completed.",
                "stats": stats,
            }
        }), 200

    except RuntimeError as e:
        logger.warning("RAG Index: Runtime error — %s", str(e))
        return jsonify({
            "success": False,
            "error": str(e),
        }), 409  # Conflict (e.g., already indexing)

    except Exception as e:
        logger.error("RAG Index: Unexpected error — %s", str(e), exc_info=True)
        return jsonify({
            "success": False,
            "error": "Failed to index knowledge base.",
            "details": str(e),
        }), 500


# ------------------------------------------------------------------
# POST /api/rag/search — Semantic search
# ------------------------------------------------------------------
@rag_bp.route("/search", methods=["POST"])
@jwt_required()
def semantic_search():
    """Accept a natural language query and return most relevant results with similarity scores."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can search the knowledge base."
        }), 403

    data = request.get_json() or {}
    query = data.get("query", "").strip()
    top_k = data.get("top_k")
    project_id_str = data.get("project_id") or claims.get("project_id")

    if not query:
        return jsonify({
            "success": False,
            "error": "Missing search query."
        }), 400

    # Parse optional project_id filter
    project_id = None
    if project_id_str:
        try:
            project_id = uuid.UUID(project_id_str)
        except ValueError:
            return jsonify({
                "success": False,
                "error": "Invalid project_id format."
            }), 400

    # Parse optional top_k
    if top_k is not None:
        try:
            top_k = int(top_k)
            if top_k < 1 or top_k > 100:
                top_k = None
        except (ValueError, TypeError):
            top_k = None

    try:
        rag_service = _get_rag_service()
        search_results = rag_service.semantic_search(
            query=query,
            top_k=top_k,
            project_id=project_id,
        )

        logger.info(
            "RAG Search: query='%s' returned %d results",
            query[:50], search_results.get("total_results", 0),
        )

        return jsonify({
            "success": True,
            "data": search_results,
        }), 200

    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e),
        }), 400

    except Exception as e:
        logger.error("RAG Search: Unexpected error — %s", str(e), exc_info=True)
        return jsonify({
            "success": False,
            "error": "Semantic search failed.",
            "details": str(e),
        }), 500


# ------------------------------------------------------------------
# GET /api/rag/stats — Knowledge base statistics
# ------------------------------------------------------------------
@rag_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    """Return total indexed documents, embedding model, vector database, and indexing status."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can view knowledge base stats."
        }), 403

    try:
        rag_service = _get_rag_service()
        stats = rag_service.get_stats()

        return jsonify({
            "success": True,
            "data": stats,
        }), 200

    except Exception as e:
        logger.error("RAG Stats: Unexpected error — %s", str(e), exc_info=True)
        return jsonify({
            "success": False,
            "error": "Failed to retrieve knowledge base statistics.",
            "details": str(e),
        }), 500
