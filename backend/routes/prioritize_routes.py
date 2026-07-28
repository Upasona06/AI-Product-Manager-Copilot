"""
routes/prioritize_routes.py — Flask Blueprints for Module 6 AI Prioritization and Business Impact
"""

import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from database.db import db
from models.prioritized_feature import PrioritizedFeature
from models.processed_feedback import ProcessedFeedback
from services.prioritization_service import PrioritizationService

prioritize_bp = Blueprint("prioritize_bp", __name__)

@prioritize_bp.route("/run", methods=["POST"])
@jwt_required()
def run_prioritization():
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can run AI prioritization."
        }), 403

    data = request.get_json() or {}
    project_id_str = data.get("project_id") or claims.get("project_id")
    force_recalculate = data.get("force", False)

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

    service = PrioritizationService()
    try:
        stats = service.run_prioritization(project_id, force=force_recalculate)
        return jsonify({
            "success": True,
            "data": {
                "message": "AI prioritization completed.",
                "stats": stats
            }
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to run prioritization.",
            "details": str(e)
        }), 500


@prioritize_bp.route("/results", methods=["GET"])
@jwt_required()
def get_prioritization_results():
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can view prioritization results."
        }), 403

    project_id_str = request.args.get("project_id") or claims.get("project_id")
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

    # Query Params
    try:
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("page_size", 20))
    except ValueError:
        page = 1
        page_size = 20

    search = request.args.get("search", "").strip()
    category = request.args.get("category", "").strip()
    priority_class = request.args.get("priority_class", "").strip()
    moscow = request.args.get("moscow", "").strip()
    sort_by = request.args.get("sort_by", "priority_score").strip()
    sort_order = request.args.get("sort_order", "desc").strip()

    # Join PrioritizedFeature with ProcessedFeedback to allow project/category filters
    query = db.session.query(PrioritizedFeature).join(
        ProcessedFeedback, 
        PrioritizedFeature.processed_feedback_id == ProcessedFeedback.processed_id
    ).filter(ProcessedFeedback.project_id == project_id)

    # Search filter
    if search:
        query = query.filter(
            (PrioritizedFeature.feature_name.ilike(f"%{search}%")) |
            (PrioritizedFeature.description.ilike(f"%{search}%"))
        )

    # Category filter
    if category:
        query = query.filter(ProcessedFeedback.category == category)

    # Priority Class filter
    if priority_class:
        query = query.filter(PrioritizedFeature.priority_class == priority_class)

    # MoSCoW filter
    if moscow:
        query = query.filter(PrioritizedFeature.moscow_category == moscow)

    # Sort logic
    sort_field = PrioritizedFeature.priority_score
    if sort_by == "roi_score":
        sort_field = PrioritizedFeature.roi_score
    elif sort_by == "impact_score":
        sort_field = PrioritizedFeature.impact_score
    elif sort_by == "effort_score":
        sort_field = PrioritizedFeature.effort_score
    elif sort_by == "risk_score":
        sort_field = PrioritizedFeature.risk_score
    elif sort_by == "rice_score":
        sort_field = PrioritizedFeature.rice_score
    elif sort_by == "weight":
        sort_field = ProcessedFeedback.weight

    if sort_order == "asc":
        query = query.order_by(sort_field.asc())
    else:
        query = query.order_by(sort_field.desc())

    total = query.count()
    results = query.offset((page - 1) * page_size).limit(page_size).all()

    serialized = []
    for feat in results:
        d = feat.to_dict()
        # Decorate with related processed feedback metadata for easier UI rendering
        d["category"] = feat.processed_feedback.category
        d["weight"] = feat.processed_feedback.weight
        d["sentiment"] = feat.processed_feedback.sentiment_self_reported
        serialized.append(d)

    return jsonify({
        "success": True,
        "data": {
            "results": serialized,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    }), 200
