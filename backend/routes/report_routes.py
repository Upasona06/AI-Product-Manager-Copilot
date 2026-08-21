"""
routes/report_routes.py — Flask Blueprint for Module 10 Report Generator
"""

import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from services.report_service import ReportService

logger = logging.getLogger(__name__)

report_bp = Blueprint("report_bp", __name__)
report_service = ReportService()


@report_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_report():
    """Generate and save a new executive summary or product strategy report."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can generate reports."
        }), 403

    data = request.get_json() or {}
    project_id = data.get("project_id") or claims.get("project_id")
    title = data.get("title", "").strip()
    report_type = data.get("report_type")

    if not title or not report_type:
        return jsonify({
            "success": False,
            "error": "Missing required fields: title and report_type are required."
        }), 400

    if report_type not in ("executive_summary", "product_strategy"):
        return jsonify({
            "success": False,
            "error": "Invalid report_type. Must be 'executive_summary' or 'product_strategy'."
        }), 400

    if not project_id:
        return jsonify({
            "success": False,
            "error": "Missing project_id."
        }), 400

    try:
        new_report = report_service.generate_report(
            project_id=project_id,
            title=title,
            report_type=report_type
        )
        return jsonify({
            "success": True,
            "data": new_report
        }), 201
    except Exception as e:
        logger.error(f"Failed to generate report: {e}")
        return jsonify({
            "success": False,
            "error": f"An error occurred while generating report: {str(e)}"
        }), 500


@report_bp.route("", methods=["GET"])
@jwt_required()
def get_reports():
    """Retrieve all saved reports for the project."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can access reports."
        }), 403

    project_id = request.args.get("project_id") or claims.get("project_id")
    if not project_id:
        return jsonify({
            "success": False,
            "error": "Missing project_id parameter."
        }), 400

    try:
        data = report_service.get_all_reports(project_id)
        return jsonify({
            "success": True,
            "data": data
        }), 200
    except Exception as e:
        logger.error(f"Failed to list reports: {e}")
        return jsonify({
            "success": False,
            "error": f"An error occurred while listing reports: {str(e)}"
        }), 500


@report_bp.route("/<report_id>", methods=["GET"])
@jwt_required()
def get_report_detail(report_id):
    """Retrieve details and markdown content of a specific report."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can access reports."
        }), 403

    try:
        report = report_service.get_report_by_id(report_id)
        if not report:
            return jsonify({
                "success": False,
                "error": "Report not found."
            }), 404
        return jsonify({
            "success": True,
            "data": report
        }), 200
    except Exception as e:
        logger.error(f"Failed to fetch report detail: {e}")
        return jsonify({
            "success": False,
            "error": f"An error occurred while fetching report details: {str(e)}"
        }), 500


@report_bp.route("/<report_id>", methods=["DELETE"])
@jwt_required()
def delete_report(report_id):
    """Delete a specific report."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can delete reports."
        }), 403

    try:
        success = report_service.delete_report(report_id)
        if not success:
            return jsonify({
                "success": False,
                "error": "Report not found."
            }), 404
        return jsonify({
            "success": True,
            "message": "Report deleted successfully."
        }), 200
    except Exception as e:
        logger.error(f"Failed to delete report: {e}")
        return jsonify({
            "success": False,
            "error": f"An error occurred while deleting the report: {str(e)}"
        }), 500
