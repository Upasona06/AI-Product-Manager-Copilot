"""
routes/user_story_routes.py — Flask Blueprint for Module 9 User Story Generation
"""

import logging
import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt

from database.db import db
from models.user_story import UserStory

logger = logging.getLogger(__name__)

user_story_bp = Blueprint("user_story_bp", __name__)


@user_story_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_user_story():
    """Generate User Stories, Acceptance Criteria, and DoD using Gemini, and save to DB."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can generate user stories."
        }), 403

    data = request.get_json() or {}
    project_id_str = data.get("project_id")
    prioritization_id_str = data.get("prioritization_id")
    feature_name = data.get("feature_name", "").strip()
    description = data.get("description", "").strip()

    if not project_id_str:
        return jsonify({
            "success": False,
            "error": "Missing project_id."
        }), 400

    if not feature_name:
        return jsonify({
            "success": False,
            "error": "Missing feature name."
        }), 400

    try:
        project_id = uuid.UUID(project_id_str)
        prioritization_id = uuid.UUID(prioritization_id_str) if prioritization_id_str else None
    except ValueError:
        return jsonify({
            "success": False,
            "error": "Invalid UUID format for project_id or prioritization_id."
        }), 400

    api_key = current_app.config.get("GEMINI_API_KEY")
    if not api_key:
        # Fallback heuristic generation if API key is not available
        story_content = (
            f"# Agile Specifications: {feature_name}\n\n"
            f"## 1. User Stories & Acceptance Criteria\n\n"
            f"### User Story 1: Basic Interaction\n"
            f"**As a** user, **I want to** interact with {feature_name} **so that** I can achieve my goal.\n\n"
            f"- **Scenario:** Successful engagement\n"
            f"  - **Given** I am logged into the platform\n"
            f"  - **When** I click on the {feature_name} component\n"
            f"  - **Then** the interface should respond immediately.\n\n"
            f"### User Story 2: Mobile Responsiveness\n"
            f"**As a** mobile user, **I want to** use {feature_name} on my phone **so that** I can work on the go.\n\n"
            f"- **Scenario:** Viewing on small screen\n"
            f"  - **Given** I am using a mobile device\n"
            f"  - **When** I load the {feature_name} module\n"
            f"  - **Then** the layout should adapt dynamically without overflow.\n\n"
            f"### User Story 3: Error Prevention\n"
            f"**As a** system administrator, **I want to** be notified of errors in {feature_name} **so that** system uptime is preserved.\n\n"
            f"- **Scenario:** Exception logging\n"
            f"  - **Given** an error occurs in the background\n"
            f"  - **When** the system fails to parse the {feature_name} data\n"
            f"  - **Then** a warning is logged and a fallback message is shown.\n\n"
            f"## 2. Definition of Done (DoD)\n"
            f"- [ ] Code has been refactored and reviewed.\n"
            f"- [ ] Unit tests pass with >= 80% coverage.\n"
            f"- [ ] Responsive design verified on desktop, tablet, and mobile.\n"
            f"- [ ] Error states handled gracefully.\n"
            f"- [ ] Feature verified by QA against acceptance criteria."
        )
    else:
        from services.gemini_service import ask_gemini

        prompt = f"""You are an expert Agile Product Manager. Your task is to write detailed User Stories, Acceptance Criteria, and a Definition of Done (DoD) for the following feature.

Feature Name: {feature_name}
Feature Description/PRD Context: {description or "No description provided."}

Please output the result in clean markdown with the following format:

# Agile Specifications: {feature_name}

## 1. User Stories & Acceptance Criteria
Format each user story using the standard "As a... I want to... So that..." format.
Underneath each user story, write at least 2 detailed Acceptance Criteria using the BDD "Given-When-Then" format.

## 2. Definition of Done (DoD)
Provide a standard 5-to-10 point checkbox list of criteria that must be satisfied before these stories can be considered complete (e.g., Code Review, Unit Testing > 80% coverage, QA verification, etc.).

Do not include any other conversational text or markdown blocks besides the document markdown itself.
"""
        try:
            story_content = ask_gemini(prompt)
        except Exception as ex:
            logger.error("Gemini API call failed for user story generation: %s", str(ex))
            story_content = (
                f"# User Stories & Acceptance Criteria: {feature_name}\n\n"
                f"## 1. User Stories\n\n"
                f"### Story 1: User Workflow Initiation\n"
                f"**As a** registered user,\n"
                f"**I want to** access and utilize {feature_name},\n"
                f"**So that** I can achieve my task quickly without errors.\n\n"
                f"**Acceptance Criteria (Gherkin format):**\n"
                f"- **Scenario**: User accesses the feature\n"
                f"  - **Given** I am logged into the application\n"
                f"  - **When** I navigate to the {feature_name} section\n"
                f"  - **Then** the interface loads with all inputs ready\n\n"
                f"### Story 2: Feedback & Validation\n"
                f"**As a** system user,\n"
                f"**I want to** receive immediate feedback upon performing actions,\n"
                f"**So that** I know the system successfully processed my request.\n\n"
                f"**Acceptance Criteria (Gherkin format):**\n"
                f"- **Scenario**: Action completion\n"
                f"  - **Given** I have submitted valid inputs\n"
                f"  - **When** I click submit\n"
                f"  - **Then** a success confirmation message is displayed\n\n"
                f"## 2. Definition of Done (DoD)\n"
                f"- [ ] Feature code written according to coding standards\n"
                f"- [ ] Unit tests pass with > 80% coverage\n"
                f"- [ ] Peer code review completed and approved\n"
                f"- [ ] UI tested on multiple screen resolutions\n"
                f"- [ ] API endpoints verified with automated integration tests\n"
                f"- [ ] Documentation updated"
            )

    try:
        # Save to database
        new_story = UserStory(
            project_id=project_id,
            prioritization_id=prioritization_id,
            feature_name=feature_name,
            description=description,
            story_content=story_content
        )
        db.session.add(new_story)
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        logger.error("Failed to save user story: %s", str(ex))
        return jsonify({
            "success": False,
            "error": "Database error while saving user stories.",
            "details": str(ex)
        }), 500

    return jsonify({
        "success": True,
        "story": new_story.to_dict()
    }), 201


@user_story_bp.route("/list", methods=["GET"])
@jwt_required()
def list_user_stories():
    """Fetch all saved user stories for a project."""
    project_id_str = request.args.get("project_id")
    if not project_id_str:
        return jsonify({
            "success": False,
            "error": "Missing project_id query parameter."
        }), 400

    try:
        project_id = uuid.UUID(project_id_str)
    except ValueError:
        return jsonify({
            "success": False,
            "error": "Invalid UUID format for project_id."
        }), 400

    try:
        stories = UserStory.query.filter_by(project_id=project_id).order_by(UserStory.created_at.desc()).all()
        return jsonify({
            "success": True,
            "stories": [s.to_dict() for s in stories]
        }), 200
    except Exception as ex:
        logger.error("Failed to list user stories: %s", str(ex))
        return jsonify({
            "success": False,
            "error": "Database error while fetching user stories.",
            "details": str(ex)
        }), 500


@user_story_bp.route("/<uuid:story_id>", methods=["DELETE"])
@jwt_required()
def delete_user_story(story_id):
    """Delete a user story by ID."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can delete user stories."
        }), 403

    try:
        story = UserStory.query.get(story_id)
        if not story:
            return jsonify({
                "success": False,
                "error": "User story not found."
            }), 404

        db.session.delete(story)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "User story deleted successfully."
        }), 200
    except Exception as ex:
        db.session.rollback()
        logger.error("Failed to delete user story: %s", str(ex))
        return jsonify({
            "success": False,
            "error": "Database error while deleting user story.",
            "details": str(ex)
        }), 500
