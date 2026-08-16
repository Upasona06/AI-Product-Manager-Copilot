"""
routes/assistant_routes.py — Flask Blueprint for Module 9 AI Assistant
Now powered by Gemini Function Calling (Tool Calling).

Flow:
  1. PM sends a question
  2. Gemini decides which DB tool(s) to call
  3. We execute the tool (real DB query)
  4. Gemini receives the data and writes a rich markdown answer
"""

import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

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
    """Accept a user prompt and return the AI response using Gemini with tool calling."""
    claims = get_jwt()
    role = claims.get("role")

    if role != "product_manager":
        return jsonify({
            "success": False,
            "error": "Forbidden: Only product managers can interact with the AI Assistant."
        }), 403

    data = request.get_json() or {}
    message = (data.get("query") or data.get("message") or "").strip()
    project_id = claims.get("project_id") or data.get("project_id", "")

    if not message:
        return jsonify({
            "success": False,
            "error": "Empty query"
        }), 400

    # No Gemini key → informative fallback
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
        return jsonify({
            "success": True,
            "reply": reply_text,
            "answer": reply_text,
            "tool_used": None,
        }), 200

    try:
        # Use tool-calling if a project_id is available (enables DB queries)
        if project_id:
            reply_text = ask_gemini_with_tools(
                message=message,
                project_id=project_id,
                system_instruction=SYSTEM_INSTRUCTION,
                tool_functions=TOOL_FUNCTIONS,
            )
        else:
            # No project context — fall back to plain Gemini
            reply_text = ask_gemini(
                prompt=f"User Question: {message}\nAssistant Reply:",
                system_instruction=SYSTEM_INSTRUCTION,
            )

    except Exception as ex:
        logger.error("AI Assistant error: %s", str(ex))
        return jsonify({
            "success": False,
            "error": "Failed to generate AI response.",
            "details": str(ex)
        }), 500

    return jsonify({
        "success": True,
        "reply": reply_text,
        "answer": reply_text,
    }), 200
