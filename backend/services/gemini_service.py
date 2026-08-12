import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai

# Load env variables from project root .env
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
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

