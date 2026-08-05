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


# ------------------------------------------------------------------
# POST /api/rag/generate-prd — Generate a PRD for a feature
# ------------------------------------------------------------------
@rag_bp.route("/generate-prd", methods=["POST"])
@jwt_required()
def generate_prd():
    """Accept a feature name/ID, retrieve context from RAG, and generate a PRD using Gemini."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can generate PRDs."
        }), 403

    data = request.get_json() or {}
    feature_name = data.get("feature_name", "").strip()
    description = data.get("description", "").strip()
    project_id_str = data.get("project_id") or claims.get("project_id")

    if not feature_name:
        return jsonify({
            "success": False,
            "error": "Missing feature name."
        }), 400

    # Retrieve context from vector db
    try:
        rag_service = _get_rag_service()
        # Semantic search using feature name + description as query
        search_query = f"{feature_name} {description}".strip()
        search_results = rag_service.semantic_search(
            query=search_query,
            top_k=5,
            project_id=uuid.UUID(project_id_str) if project_id_str else None
        )
        context_docs = [r["document_preview"] for r in search_results.get("results", [])]
        context_str = "\n".join(context_docs)
    except Exception as e:
        logger.warning("RAG Search failed during PRD generation, proceeding with empty context: %s", str(e))
        context_str = ""

    # Call Gemini API to generate the PRD content
    api_key = current_app.config.get("GEMINI_API_KEY")
    if not api_key:
        # Return fallback heuristic PRD if API key is not available
        prd_text = f"# PRD: {feature_name}\n\n## 1. Problem Statement\n{description or 'No description provided.'}\n\n## 2. Goals\n- Goal 1: Implement the feature efficiently.\n- Goal 2: Meet user expectations based on feedback.\n\n## 3. Functional Requirements\n- Requirement 1: User should be able to interact with the feature.\n- Requirement 2: System should log usage statistics.\n\n## 4. Non-Functional Requirements\n- Latency: Response time should be < 500ms.\n- Security: Secure data transmission via HTTPS.\n\n## 5. Risks & Mitigation\n- Risk: Potential delay in deployment. Mitigation: Agile sprints.\n\n## 6. Success Metrics\n- Adoption rate > 50% in first month."
    else:
        import urllib.request
        import json
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        
        prompt = f"""You are an expert product manager. Write a comprehensive Product Requirement Document (PRD) for the following feature.
Feature Name: {feature_name}
Description: {description}

Here is the related customer feedback and context retrieved from our knowledge base:
{context_str}

Format the PRD using clean markdown with the following sections:
1. Executive Summary
2. Problem Statement & User Value
3. Goals & Out of Scope
4. Functional Requirements (list at least 3 detailed requirements)
5. Non-functional Requirements (performance, security, usability, etc.)
6. Risks & Mitigation Strategies
7. Success Metrics & KPIs

Do not include any other conversational text or markdown blocks besides the document markdown itself.
"""
        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        }
        try:
            req_data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                res_body = json.loads(response.read().decode('utf-8'))
                prd_text = res_body["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as ex:
            logger.error("Gemini API call failed for PRD generation: %s", str(ex))
            return jsonify({
                "success": False,
                "error": "Failed to generate PRD using Gemini API.",
                "details": str(ex)
            }), 500

    return jsonify({
        "success": True,
        "prd": prd_text
    }), 200
