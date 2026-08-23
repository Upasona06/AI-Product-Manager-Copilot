import os
import json
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load env variables from backend/.env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
print("Gemini Key Loaded:", bool(GEMINI_API_KEY))

# Initialize the Gemini client (new SDK)
gemini_model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


def ask_gemini(prompt, system_instruction=None, json_mode=False):
    """
    Query Gemini AI with the given prompt using the new google-genai SDK.
    """
    if not GEMINI_API_KEY or not client:
        raise ValueError("GEMINI_API_KEY missing")

    config = {}
    if system_instruction:
        config["system_instruction"] = system_instruction
    if json_mode:
        config["response_mime_type"] = "application/json"

    response = client.models.generate_content(
        model=gemini_model_name,
        contents=prompt,
        config=config if config else None
    )

    return response.text


# ---------------------------------------------------------------------------
# Tool Schemas — declared once, reused for every assistant call
# ---------------------------------------------------------------------------

ASSISTANT_TOOL_DECLARATIONS = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="get_top_feature_requests",
            description=(
                "Fetch the top N most-requested features for the project from the database. "
                "Use this when the user asks about top features, most requested features, "
                "popular feature requests, or what users want most."
            ),
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "project_id": types.Schema(
                        type=types.Type.STRING,
                        description="The UUID of the project to query."
                    ),
                    "limit": types.Schema(
                        type=types.Type.INTEGER,
                        description="Number of top features to return (default 5)."
                    ),
                },
                required=["project_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_feedback_summary",
            description=(
                "Get a full summary of customer feedback including category breakdown "
                "(Bug, Feature Request, Improvement, Complaint) and sentiment distribution "
                "(Positive, Negative, Neutral). Use this for 'summarize feedback', "
                "'feedback overview', or 'what is the feedback breakdown' questions."
            ),
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "project_id": types.Schema(
                        type=types.Type.STRING,
                        description="The UUID of the project to query."
                    ),
                },
                required=["project_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_prioritized_backlog",
            description=(
                "Fetch the prioritized product backlog with RICE scores and MoSCoW categories "
                "from the database. Use this when the user asks to prioritize backlog, "
                "show RICE scores, list high priority features, or what to build next."
            ),
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "project_id": types.Schema(
                        type=types.Type.STRING,
                        description="The UUID of the project to query."
                    ),
                    "limit": types.Schema(
                        type=types.Type.INTEGER,
                        description="Max number of backlog items to return (default 10)."
                    ),
                },
                required=["project_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_project_statistics",
            description=(
                "Get high-level pipeline statistics for the project: total raw feedback, "
                "processed, classified, aggregated, and prioritized feature counts. "
                "Use this for 'how many feedbacks', 'project stats', 'dashboard summary', "
                "or 'pipeline status' questions."
            ),
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "project_id": types.Schema(
                        type=types.Type.STRING,
                        description="The UUID of the project to query."
                    ),
                },
                required=["project_id"],
            ),
        ),
    ]
)



def _select_tools_for_message(message: str, all_tool_names: list) -> list:
    """
    Keyword-based heuristic to decide which tools to pre-call for a given message.
    Returns a list of tool names relevant to the question.
    """
    msg = message.lower()
    selected = []

    # Always include project stats for context
    if "get_project_statistics" in all_tool_names:
        selected.append("get_project_statistics")

    feature_keywords = ["feature", "request", "top", "most wanted", "popular", "what do users want", "wish list"]
    if any(k in msg for k in feature_keywords) and "get_top_feature_requests" in all_tool_names:
        selected.append("get_top_feature_requests")

    summary_keywords = ["summar", "overview", "breakdown", "feedback", "categor", "sentiment", "bug", "complaint", "improvement"]
    if any(k in msg for k in summary_keywords) and "get_feedback_summary" in all_tool_names:
        selected.append("get_feedback_summary")

    backlog_keywords = ["prioriti", "backlog", "rice", "moscow", "must have", "should have", "sprint", "what to build", "roadmap", "next", "impact", "effort"]
    if any(k in msg for k in backlog_keywords) and "get_prioritized_backlog" in all_tool_names:
        selected.append("get_prioritized_backlog")

    # Deduplicate while preserving order
    return list(dict.fromkeys(selected))


def ask_gemini_with_tools(message: str, project_id: str, system_instruction: str, tool_functions: dict) -> str:
    """
    Context-injection approach: pre-fetch real DB data using keyword matching,
    inject it into the Gemini prompt, then get a data-driven answer.

    This is more reliable than relying on Gemini's function_calling_config
    since it works across all model versions and guarantees real data is used.

    Args:
        message: The user's question/prompt.
        project_id: Project UUID passed to all tool functions.
        system_instruction: System prompt for the assistant persona.
        tool_functions: Dict mapping function name -> callable.

    Returns:
        Final markdown-formatted answer string from Gemini.
    """
    if not GEMINI_API_KEY or not client:
        raise ValueError("GEMINI_API_KEY missing")

    import json

    # Step 1: Decide which tools are relevant for this question
    tools_to_call = _select_tools_for_message(message, list(tool_functions.keys()))
    print(f"[Tool Calling] Selected tools for query: {tools_to_call}")

    # Step 2: Execute each relevant tool and collect live DB data
    context_data = {}
    for tool_name in tools_to_call:
        try:
            result = tool_functions[tool_name](project_id=project_id)
            context_data[tool_name] = result
            print(f"[Tool Calling] Executed: {tool_name} -> {len(str(result))} chars")
        except Exception as exc:
            context_data[tool_name] = {"error": str(exc)}
            print(f"[Tool Calling] Error in {tool_name}: {exc}")

    # Step 3: Build enriched prompt with real data injected
    if context_data:
        data_json = json.dumps(context_data, indent=2, default=str)
        enriched_prompt = (
            f"User Question: {message}\n\n"
            f"--- LIVE DATABASE DATA (project_id: {project_id}) ---\n"
            f"The following JSON contains REAL data fetched from the database right now.\n"
            f"You MUST use this data in your answer. Use the actual numbers, feature names, "
            f"and scores. Do NOT invent statistics.\n\n"
            f"```json\n{data_json}\n```\n\n"
            f"--- END OF DATABASE DATA ---\n\n"
            f"Now answer the user's question using the real data above. "
            f"Format your answer in clean Markdown with headers, tables, and bullet points."
        )
    else:
        # No data found — ask Gemini to respond helpfully
        enriched_prompt = (
            f"User Question: {message}\n\n"
            f"Note: No relevant data was found in the database for project {project_id}. "
            f"Tell the user which pipeline step they need to run first to generate data "
            f"(e.g., Run NLP Processing, then AI Classification, then Aggregation, then Prioritization). "
            f"Be specific and actionable."
        )

    # Step 4: Get Gemini's final answer
    response = client.models.generate_content(
        model=gemini_model_name,
        contents=enriched_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
        ),
    )

    return response.text
