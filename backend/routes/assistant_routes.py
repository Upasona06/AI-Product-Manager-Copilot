"""
routes/assistant_routes.py — Flask Blueprint for Module 9 AI Assistant
Now with persistent chat session history and Gemini Tool Calling.

Flow:
  1. PM sends a question (with optional chat_id)
  2. Gemini decides which DB tool(s) to call
  3. We execute the tool (real DB query)
  4. Gemini receives the data and writes a rich markdown answer
  5. The entire conversation is saved/updated in the PostgreSQL assistant_chats table
"""

import logging
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from database.db import db
from models.assistant_chat import AssistantChat
from services.gemini_service import GEMINI_API_KEY, ask_gemini, ask_gemini_with_tools
from services.assistant_tools import TOOL_FUNCTIONS

logger = logging.getLogger(__name__)

assistant_bp = Blueprint("assistant_bp", __name__)

# System persona for the assistant
SYSTEM_INSTRUCTION = (
    "You are an expert AI Product Manager Assistant embedded inside the PM Copilot SaaS platform. "
    "You have access to live tools that query the project's real customer feedback database. "
    "ALWAYS use the available tools to fetch real data before answering questions about features, "
    "feedback, backlog, or statistics. Never make up numbers or percentages. "
    "Format all responses in clean, structured Markdown with headers, bullet points, and tables "
    "where appropriate. Be concise, actionable, and data-driven."
)


@assistant_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat_assistant():
    """Accept a user prompt, return AI response using Gemini tool calling, and persist to chat history."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can interact with the AI Assistant."
        }), 403

    data = request.get_json() or {}
    message = (data.get("query") or data.get("message") or "").strip()
    project_id_str = claims.get("project_id") or data.get("project_id", "")
    chat_id_str = data.get("chat_id")
    file_attachment = data.get("file")

    if not message:
        return jsonify({
            "success": False,
            "error": "Empty query"
        }), 400

    try:
        project_id = uuid.UUID(str(project_id_str)) if project_id_str else None
    except ValueError:
        project_id = None

    # Fallback response if no Gemini key
    if not GEMINI_API_KEY:
        reply_text = (
            "I am running in local fallback mode because no `GEMINI_API_KEY` is configured.\n\n"
            "Please set `GEMINI_API_KEY` in the project `.env` file to enable full AI responses.\n\n"
            "**Available questions I can answer with real data once connected:**\n"
            "- *What are the top feature requests?*\n"
            "- *Summarize customer feedback*\n"
            "- *Prioritize my backlog*\n"
            "- *Show project statistics*"
        )
    else:
        try:
            # Use tool-calling if a project_id is available (enables live DB queries)
            if project_id:
                reply_text = ask_gemini_with_tools(
                    message=message,
                    project_id=str(project_id),
                    system_instruction=SYSTEM_INSTRUCTION,
                    tool_functions=TOOL_FUNCTIONS,
                )
            else:
                # No project context — fallback to plain Gemini
                reply_text = ask_gemini(
                    prompt=f"User Question: {message}\nAssistant Reply:",
                    system_instruction=SYSTEM_INSTRUCTION,
                )
        except Exception as ex:
            logger.error("AI Assistant generation error: %s", str(ex))
            return jsonify({
                "success": False,
                "error": "Failed to generate AI response.",
                "details": str(ex)
            }), 500

    # Build timestamps & message structures
    now_time = datetime.now(timezone.utc).strftime("%I:%M %p")
    user_msg = {
        "id": f"user-{uuid.uuid4().hex[:8]}",
        "sender": "user",
        "text": message,
        "file": file_attachment,
        "timestamp": now_time
    }
    ai_msg = {
        "id": f"ai-{uuid.uuid4().hex[:8]}",
        "sender": "ai",
        "text": reply_text,
        "timestamp": now_time
    }

    # Persist session to database if project_id is known
    saved_chat = None
    if project_id:
        try:
            if chat_id_str:
                try:
                    chat_uuid = uuid.UUID(str(chat_id_str))
                    saved_chat = AssistantChat.query.filter_by(chat_id=chat_uuid, project_id=project_id).first()
                except ValueError:
                    saved_chat = None

            if saved_chat:
                # Append to existing chat
                current_msgs = list(saved_chat.messages or [])
                current_msgs.extend([user_msg, ai_msg])
                saved_chat.messages = current_msgs
                saved_chat.updated_at = datetime.now(timezone.utc)
            else:
                # Create a new chat session
                title = message[:55] + ("..." if len(message) > 55 else "")
                welcome_msg = {
                    "id": "welcome",
                    "sender": "ai",
                    "text": "Hello! I'm your AI Product Manager Assistant. I can help analyze customer feedback, prioritize features, estimate business impact, generate product insights, and answer product management questions.",
                    "timestamp": now_time
                }
                saved_chat = AssistantChat(
                    project_id=project_id,
                    title=title or "New Conversation",
                    messages=[welcome_msg, user_msg, ai_msg]
                )
                db.session.add(saved_chat)

            db.session.commit()
        except Exception as ex:
            db.session.rollback()
            logger.error("Failed to save assistant chat to DB: %s", str(ex))

    return jsonify({
        "success": True,
        "reply": reply_text,
        "answer": reply_text,
        "chat_id": str(saved_chat.chat_id) if saved_chat else None,
        "title": saved_chat.title if saved_chat else "Conversation",
        "messages": saved_chat.messages if saved_chat else [user_msg, ai_msg]
    }), 200


@assistant_bp.route("/history", methods=["GET"])
@jwt_required()
def list_chat_history():
    """Fetch all saved chat sessions for the current project."""
    claims = get_jwt()
    project_id_str = request.args.get("project_id") or claims.get("project_id")

    if not project_id_str:
        return jsonify({
            "success": False,
            "error": "Missing project_id query parameter."
        }), 400

    try:
        project_id = uuid.UUID(str(project_id_str))
    except ValueError:
        return jsonify({
            "success": False,
            "error": "Invalid project_id UUID format."
        }), 400

    try:
        chats = AssistantChat.query.filter_by(project_id=project_id).order_by(AssistantChat.updated_at.desc()).all()
        return jsonify({
            "success": True,
            "chats": [c.to_dict(include_messages=False) for c in chats]
        }), 200
    except Exception as ex:
        logger.error("Failed to list chat history: %s", str(ex))
        return jsonify({
            "success": False,
            "error": "Database error while fetching chat history.",
            "details": str(ex)
        }), 500


@assistant_bp.route("/history/<uuid:chat_id>", methods=["GET"])
@jwt_required()
def get_chat_session(chat_id):
    """Retrieve full message history for a specific chat session."""
    claims = get_jwt()
    project_id_str = request.args.get("project_id") or claims.get("project_id")

    try:
        chat = AssistantChat.query.get(chat_id)
        if not chat:
            return jsonify({
                "success": False,
                "error": "Chat session not found."
            }), 404

        # If project_id check
        if project_id_str:
            try:
                proj_uuid = uuid.UUID(str(project_id_str))
                if chat.project_id != proj_uuid:
                    return jsonify({
                        "success": False,
                        "error": "Forbidden: Chat session does not belong to this project."
                    }), 403
            except ValueError:
                pass

        return jsonify({
            "success": True,
            "chat": chat.to_dict(include_messages=True)
        }), 200
    except Exception as ex:
        logger.error("Failed to retrieve chat session: %s", str(ex))
        return jsonify({
            "success": False,
            "error": "Database error while fetching chat session.",
            "details": str(ex)
        }), 500


@assistant_bp.route("/history/<uuid:chat_id>", methods=["DELETE"])
@jwt_required()
def delete_chat_session(chat_id):
    """Delete a specific chat session from the database."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can delete chat history."
        }), 403

    try:
        chat = AssistantChat.query.get(chat_id)
        if not chat:
            return jsonify({
                "success": False,
                "error": "Chat session not found."
            }), 404

        db.session.delete(chat)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Chat session deleted successfully."
        }), 200
    except Exception as ex:
        db.session.rollback()
        logger.error("Failed to delete chat session: %s", str(ex))
        return jsonify({
            "success": False,
            "error": "Database error while deleting chat session.",
            "details": str(ex)
        }), 500


@assistant_bp.route("/history/clear", methods=["POST", "DELETE"])
@jwt_required()
def clear_all_chat_history():
    """Clear all chat sessions for a project."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can clear chat history."
        }), 403

    data = request.get_json() or {}
    project_id_str = data.get("project_id") or request.args.get("project_id") or claims.get("project_id")

    if not project_id_str:
        return jsonify({
            "success": False,
            "error": "Missing project_id."
        }), 400

    try:
        project_id = uuid.UUID(str(project_id_str))
        AssistantChat.query.filter_by(project_id=project_id).delete()
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "All chat history cleared successfully."
        }), 200
    except Exception as ex:
        db.session.rollback()
        logger.error("Failed to clear chat history: %s", str(ex))
        return jsonify({
            "success": False,
            "error": "Database error while clearing chat history.",
            "details": str(ex)
        }), 500
