"""
routes/roadmap_routes.py — Flask Blueprint for Module 10 Roadmap Planner
"""

import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from services.roadmap_service import RoadmapService

logger = logging.getLogger(__name__)

roadmap_bp = Blueprint("roadmap_bp", __name__)
roadmap_service = RoadmapService()


@roadmap_bp.route("", methods=["GET"])
@jwt_required()
def get_roadmap():
    """Retrieve all prioritized features and their roadmap positions."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can access the roadmap."
        }), 403

    project_id = request.args.get("project_id") or claims.get("project_id")
    if not project_id:
        return jsonify({
            "success": False,
            "error": "Missing project_id parameter."
        }), 400

    try:
        data = roadmap_service.get_roadmap(project_id)
        return jsonify({
            "success": True,
            "data": data
        }), 200
    except Exception as e:
        logger.error(f"Failed to fetch roadmap: {e}")
        return jsonify({
            "success": False,
            "error": f"An error occurred while fetching the roadmap: {str(e)}"
        }), 500


@roadmap_bp.route("/update", methods=["POST"])
@jwt_required()
def update_roadmap_item():
    """Update or insert a feature's position on the roadmap."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can update the roadmap."
        }), 403

    data = request.get_json() or {}
    project_id = data.get("project_id") or claims.get("project_id")
    prioritization_id = data.get("prioritization_id")
    horizon = data.get("horizon")
    milestone_name = data.get("milestone_name")
    target_date = data.get("target_date")
    notes = data.get("notes")

    if not prioritization_id or not horizon:
        return jsonify({
            "success": False,
            "error": "Missing required fields: prioritization_id and horizon are required."
        }), 400

    if horizon not in ("now", "next", "later"):
        return jsonify({
            "success": False,
            "error": "Invalid horizon value. Must be 'now', 'next', or 'later'."
        }), 400

    try:
        updated_item = roadmap_service.update_roadmap_item(
            project_id=project_id,
            prioritization_id=prioritization_id,
            horizon=horizon,
            milestone_name=milestone_name,
            target_date=target_date,
            notes=notes
        )
        return jsonify({
            "success": True,
            "data": updated_item
        }), 200
    except ValueError as ve:
        return jsonify({
            "success": False,
            "error": str(ve)
        }), 404
    except Exception as e:
        logger.error(f"Failed to update roadmap item: {e}")
        return jsonify({
            "success": False,
            "error": f"An error occurred while updating the roadmap: {str(e)}"
        }), 500


@roadmap_bp.route("/recommendations", methods=["GET"])
@jwt_required()
def get_recommendations():
    """Generate recommended milestones using AI or fallback logic."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can view roadmap recommendations."
        }), 403

    project_id = request.args.get("project_id") or claims.get("project_id")
    if not project_id:
        return jsonify({
            "success": False,
            "error": "Missing project_id parameter."
        }), 400

    try:
        milestones = roadmap_service.generate_recommendations(project_id)
        return jsonify({
            "success": True,
            "data": milestones
        }), 200
    except Exception as e:
        logger.error(f"Failed to generate milestone recommendations: {e}")
        return jsonify({
            "success": False,
            "error": f"An error occurred while generating recommendations: {str(e)}"
        }), 500


@roadmap_bp.route("/update-column", methods=["POST"])
@jwt_required()
def update_column_targets():
    """Bulk update release target details for a roadmap column/horizon."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can update roadmap columns."
        }), 403

    data = request.get_json() or {}
    project_id = data.get("project_id") or claims.get("project_id")
    horizon = data.get("horizon")
    milestone_name = data.get("milestone_name")
    target_date = data.get("target_date")
    notes = data.get("notes")

    if not horizon:
        return jsonify({
            "success": False,
            "error": "Missing required field: horizon is required."
        }), 400

    if horizon not in ("now", "next", "later"):
        return jsonify({
            "success": False,
            "error": "Invalid horizon value. Must be 'now', 'next', or 'later'."
        }), 400

    if not project_id:
        return jsonify({
            "success": False,
            "error": "Missing project_id."
        }), 400

    try:
        updated_count = roadmap_service.update_column_targets(
            project_id=project_id,
            horizon=horizon,
            milestone_name=milestone_name,
            target_date=target_date,
            notes=notes
        )
        return jsonify({
            "success": True,
            "updated_count": updated_count
        }), 200
    except Exception as e:
        logger.error(f"Failed to bulk update column targets: {e}")
        return jsonify({
            "success": False,
            "error": f"An error occurred while updating column targets: {str(e)}"
        }), 500

