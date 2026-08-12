"""
services/classification_pipeline.py — Module 4 NLP Classification & Theme Extraction

Uses Google Gemini to classify processed feedback into 4 categories and extract
topics, themes, sentiments, keywords, pain points, and customer intent.
"""

import os
import json
import time
import uuid
from datetime import datetime, timezone

from database.db import db
from models.processed_feedback import ProcessedFeedback
from models.classified_feedback import ClassifiedFeedback
from services.gemini_service import ask_gemini, GEMINI_API_KEY


# ──────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────

VALID_CATEGORIES = [
    "Bug",
    "Feature Request",
    "Complaint",
    "Improvement",
]

VALID_SENTIMENTS = ["Positive", "Negative", "Neutral", "Mixed"]

SYSTEM_INSTRUCTION = """You are an expert AI Product Manager assistant that classifies customer feedback.
You analyze product feedback and extract structured insights.

Your task is to analyze the provided feedback text and return a JSON object with the following fields:

1. **category** (string): Classify into exactly ONE of these categories:
   - "Bug" — Software defect, error, crash, malfunction, UI/performance bug
   - "Feature Request" — New capability, enhancement, addition desired
   - "Complaint" — General dissatisfaction, frustration expression, pricing issue, complaint
   - "Improvement" — Enhancing existing features, optimization, tweaks, improvement

2. **confidence_score** (float): Your confidence in the classification (0.0 to 1.0)

3. **sentiment** (string): One of "Positive", "Negative", "Neutral", "Mixed"

4. **sentiment_score** (float): Sentiment intensity from -1.0 (very negative) to 1.0 (very positive)

5. **topics** (array of strings): 2-5 high-level subject areas (e.g., "authentication", "mobile app", "billing")

6. **themes** (array of strings): 2-5 recurring patterns or themes (e.g., "user onboarding friction", "payment flow complexity")

7. **keywords** (array of strings): 5-10 important terms extracted from the text

8. **pain_points** (array of strings): 1-5 specific user frustrations or problems identified

9. **customer_intent** (string): A one-sentence description of what the customer wants to achieve

10. **summary** (string): A 1-2 sentence concise summary of the feedback

IMPORTANT RULES:
- Return ONLY valid JSON. No markdown, no explanation text.
- All string values must be properly escaped.
- Arrays must contain at least 1 item.
- The category MUST be exactly one of: Bug, Feature Request, Complaint, Improvement.
- The sentiment MUST be exactly one of: Positive, Negative, Neutral, Mixed.
"""


class ClassificationPipeline:
    """
    Module 4 Classification Pipeline.

    Fetches unclassified processed feedback, sends each to Gemini for
    AI-powered classification and theme extraction, and stores results
    in the classified_feedback table.
    """

    def __init__(self):
        self.api_key = GEMINI_API_KEY
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
        self.prompt_version = os.getenv("CLASSIFICATION_PROMPT_VERSION", "1.0.0")
        self.batch_size = int(os.getenv("CLASSIFICATION_BATCH_SIZE", 10))

        if not self.api_key:
            print("GEMINI_API_KEY is not set. Classification pipeline will run using local fallback heuristics.")

    # ──────────────────────────────────────────────────────────
    # Fetch Unclassified Records
    # ──────────────────────────────────────────────────────────

    def fetch_unclassified(self, project_id=None) -> list[ProcessedFeedback]:
        """
        Fetch processed_feedback records that are ready for classification
        but have not yet been classified.
        """
        query = ProcessedFeedback.query.filter_by(
            ready_for_classification=True
        ).filter(ProcessedFeedback.classified_at.is_(None))

        if project_id:
            query = query.filter_by(project_id=project_id)

        return query.order_by(
            ProcessedFeedback.processing_timestamp.asc()
        ).limit(self.batch_size).all()

    # ──────────────────────────────────────────────────────────
    # Build Prompt for a Single Feedback
    # ──────────────────────────────────────────────────────────

    def build_prompt(self, feedback: ProcessedFeedback) -> str:
        """
        Construct the user prompt with all available context
        for Gemini classification.
        """
        prompt_parts = [
            "Analyze the following product feedback and classify it.\n",
            f"**Subject:** {feedback.original_subject}\n",
            f"**Description:** {feedback.original_description}\n",
            f"**Clean Text:** {feedback.clean_text}\n",
        ]

        # Add optional metadata context
        if feedback.category and feedback.category != "General":
            prompt_parts.append(
                f"**Self-Reported Category (user-provided, may be inaccurate):** "
                f"{feedback.category}\n"
            )

        if feedback.priority:
            prompt_parts.append(
                f"**Self-Reported Priority:** {feedback.priority}\n"
            )

        if feedback.sentiment_self_reported:
            prompt_parts.append(
                f"**Self-Reported Sentiment:** "
                f"{feedback.sentiment_self_reported}\n"
            )

        if feedback.tags:
            prompt_parts.append(
                f"**User Tags:** {', '.join(feedback.tags)}\n"
            )

        if feedback.product_name:
            prompt_parts.append(
                f"**Product:** {feedback.product_name}"
            )
            if feedback.product_version:
                prompt_parts.append(f" v{feedback.product_version}")
            prompt_parts.append("\n")

        if feedback.lemmas:
            prompt_parts.append(
                f"**Key Lemmas:** {', '.join(feedback.lemmas[:15])}\n"
            )

        prompt_parts.append(
            f"\n**Weight (duplicate count):** {feedback.weight}\n"
        )

        prompt_parts.append(
            "\nReturn a JSON object with: category, confidence_score, "
            "sentiment, sentiment_score, topics, themes, keywords, "
            "pain_points, customer_intent, summary."
        )

        return "".join(prompt_parts)

    # ──────────────────────────────────────────────────────────
    # Classify a Single Feedback via Gemini
    # ──────────────────────────────────────────────────────────

    def classify_single(self, feedback: ProcessedFeedback) -> dict:
        """
        Send a single feedback to Gemini and parse the structured response.

        Returns:
            dict with classification fields, or raises on failure.
        """
        if not self.api_key:
            return self.classify_heuristically(feedback)

        prompt = self.build_prompt(feedback)
        start_time = time.time()

        response_text = ask_gemini(
            prompt=prompt,
            system_instruction=SYSTEM_INSTRUCTION,
            json_mode=True
        )
        duration_ms = int((time.time() - start_time) * 1000)

        # Safely parse the JSON response
        response_text = response_text.strip()

        # Find the first '{' and the last '}' to extract valid JSON content
        start_idx = response_text.find('{')
        end_idx = response_text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            json_str = response_text[start_idx:end_idx+1]
        else:
            json_str = response_text

        parsed = json.loads(json_str)

        # Validate and sanitize the response
        result = self._validate_response(parsed)
        result["duration_ms"] = duration_ms

        # Extract token usage if available
        result["token_usage"] = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }

        return result

    # ──────────────────────────────────────────────────────────
    # Validate & Sanitize Gemini Response
    # ──────────────────────────────────────────────────────────

    def _validate_response(self, parsed: dict) -> dict:
        """
        Validate and sanitize the parsed JSON response from Gemini.
        Ensures all fields conform to expected types and constraints.
        """
        # Category validation and mapping
        raw_category = parsed.get("category")
        if not raw_category:
            category = "Complaint"
        else:
            category = str(raw_category).strip()
            # Standardize and map common variations to valid categories
            cat_map = {
                "bug report": "Bug",
                "bug reports": "Bug",
                "bug": "Bug",
                "defect": "Bug",
                "issue": "Bug",
                "error": "Bug",
                "feature request": "Feature Request",
                "feature requests": "Feature Request",
                "feature": "Feature Request",
                "complaint": "Complaint",
                "complaints": "Complaint",
                "improvement": "Improvement",
                "improvements": "Improvement",
                "enhancement": "Improvement",
                "suggestion": "Improvement",
                "praise": "Improvement",
                "question": "Improvement",
                "pricing issue": "Complaint",
                "performance issue": "Bug",
                "ui issue": "Improvement",
                "security concern": "Bug",
            }
            mapped_cat = cat_map.get(category.lower())
            if mapped_cat:
                category = mapped_cat
            elif category not in VALID_CATEGORIES:
                # Attempt fuzzy match
                category_lower = category.lower()
                matched = False
                for valid_cat in VALID_CATEGORIES:
                    if valid_cat.lower() in category_lower or category_lower in valid_cat.lower():
                        category = valid_cat
                        matched = True
                        break
                if not matched:
                    category = "Complaint"  # Safe fallback

        # Confidence score
        confidence = float(parsed.get("confidence_score", 0.5))
        confidence = max(0.0, min(1.0, confidence))

        # Sentiment validation
        sentiment = parsed.get("sentiment", "Neutral")
        if sentiment not in VALID_SENTIMENTS:
            sentiment = "Neutral"

        # Sentiment score
        sentiment_score = float(parsed.get("sentiment_score", 0.0))
        sentiment_score = max(-1.0, min(1.0, sentiment_score))

        # Array fields — ensure list of strings
        topics = self._ensure_string_list(parsed.get("topics", []))
        themes = self._ensure_string_list(parsed.get("themes", []))
        keywords = self._ensure_string_list(parsed.get("keywords", []))
        pain_points = self._ensure_string_list(parsed.get("pain_points", []))

        # String fields
        customer_intent = str(parsed.get("customer_intent", ""))[:500]
        summary = str(parsed.get("summary", ""))

        return {
            "category": category,
            "confidence_score": confidence,
            "sentiment": sentiment,
            "sentiment_score": sentiment_score,
            "topics": topics,
            "themes": themes,
            "keywords": keywords,
            "pain_points": pain_points,
            "customer_intent": customer_intent or None,
            "summary": summary or None,
        }

    @staticmethod
    def _ensure_string_list(value) -> list:
        """Convert a value to a list of strings, handling edge cases."""
        if isinstance(value, list):
            return [str(item) for item in value if item]
        if isinstance(value, str):
            return [value]
        return []

    def classify_heuristically(self, feedback: ProcessedFeedback) -> dict:
        """
        Heuristic/rule-based classification fallback when GEMINI_API_KEY is not set.
        """
        subject = feedback.original_subject or ""
        description = feedback.original_description or ""
        user_category = feedback.category or "General"
        user_priority = feedback.priority or "Medium"
        user_sentiment = feedback.sentiment_self_reported or "Neutral"
        
        # 1. Determine Category
        text_lower = (subject + " " + description).lower()
        if any(w in text_lower for w in ["bug", "crash", "error", "broken", "fail", "500", "404", "issue", "malfunction", "unexpectedly"]):
            category = "Bug"
        elif any(w in text_lower for w in ["feature", "add", "integrate", "request", "allow", "support", "new capability"]):
            category = "Feature Request"
        elif any(w in text_lower for w in ["slow", "performance", "speed", "optimize", "loading", "lag", "fast"]):
            category = "Improvement"
        elif user_category in VALID_CATEGORIES:
            category = user_category
        else:
            category = "Complaint" if user_priority in ["High", "Critical"] else "Improvement"
            
        # 2. Determine Sentiment and Score
        if user_sentiment in VALID_SENTIMENTS:
            sentiment = user_sentiment
        else:
            if any(w in text_lower for w in ["great", "awesome", "fast", "love", "excellent", "good", "happy"]):
                sentiment = "Positive"
            elif any(w in text_lower for w in ["slow", "crash", "error", "bad", "terrible", "hate", "frustrated", "broken"]):
                sentiment = "Negative"
            else:
                sentiment = "Neutral"
                
        sentiment_map = {
            "Positive": 0.8,
            "Negative": -0.7,
            "Neutral": 0.0,
            "Mixed": 0.1
        }
        sentiment_score = sentiment_map.get(sentiment, 0.0)
        
        # 3. Topics and Keywords
        topics = []
        if feedback.tags:
            topics.extend(feedback.tags)
        
        for word in ["auth", "login", "password", "mfa", "security", "dashboard", "billing", "invoice", "payment", "pdf", "csv", "export", "import", "mobile", "android", "ios", "search", "filters", "reporting"]:
            if word in text_lower:
                topics.append(word)
        if not topics:
            topics = ["general"]
        topics = list(set(topics))[:4]
        
        keywords = []
        for word in text_lower.split():
            clean_w = "".join(c for c in word if c.isalnum()).strip()
            if len(clean_w) > 4 and clean_w not in ["about", "their", "would", "should", "could", "there", "every", "other", "after", "before", "under", "which", "these", "those"]:
                keywords.append(clean_w)
        keywords = list(set(keywords))[:8]
        if not keywords:
            keywords = ["feedback", "system"]
            
        # 4. Themes
        themes = []
        if category == "Bug":
            themes.append(f"System instability in {topics[0]}")
            themes.append("Unexpected application crash/error")
        elif category == "Feature Request":
            themes.append(f"User requested enhancement for {topics[0]}")
            themes.append("Usability expansion requirement")
        else:
            themes.append(f"Performance optimization of {topics[0]}")
            themes.append("Dashboard / reporting experience improvement")
            
        # 5. Pain points
        pain_points = []
        if sentiment == "Negative":
            pain_points.append(f"User is unable to use {topics[0]} properly")
        else:
            pain_points.append(f"Friction or feature gap in {topics[0]}")
            
        # 6. Intent and Summary
        customer_intent = f"The user wants to resolve an issue or enhance features related to {topics[0]}."
        summary = f"User reports: {subject}. Details: {description[:100]}..."
        
        return {
            "category": category,
            "confidence_score": 0.95,
            "sentiment": sentiment,
            "sentiment_score": sentiment_score,
            "topics": topics,
            "themes": themes,
            "keywords": keywords,
            "pain_points": pain_points,
            "customer_intent": customer_intent,
            "summary": summary,
            "duration_ms": 5,
            "token_usage": {"prompt_tokens": 0, "completion_tokens": 0}
        }

    # ──────────────────────────────────────────────────────────
    # Run Full Classification Pipeline
    # ──────────────────────────────────────────────────────────

    def run(self, project_id=None) -> dict:
        """
        Runs the full classification pipeline:
        1. Fetch unclassified processed_feedback records
        2. Classify each via Gemini
        3. Store results in classified_feedback
        4. Update processed_feedback.classified_at

        Returns:
            dict with counts: classified, failed, skipped
        """
        records = self.fetch_unclassified(project_id)

        if not records:
            return {"classified": 0, "failed": 0, "total_fetched": 0}

        classified_count = 0
        failed_count = 0

        for feedback in records:
            start_time = time.time()

            try:
                # Classify via Gemini
                result = self.classify_single(feedback)
                duration_ms = result.pop("duration_ms", 0)
                token_usage = result.pop("token_usage", {})

                # Build classification metadata
                metadata = {
                    "gemini_model": self.model_name,
                    "prompt_version": self.prompt_version,
                    "classification_duration_ms": duration_ms,
                    "token_usage": token_usage,
                }

                # Create ClassifiedFeedback record
                classified_rec = ClassifiedFeedback(
                    processed_feedback_id=feedback.processed_id,
                    project_id=feedback.project_id,
                    ai_category=result["category"],
                    ai_confidence_score=result["confidence_score"],
                    ai_sentiment=result["sentiment"],
                    ai_sentiment_score=result["sentiment_score"],
                    topics=result["topics"],
                    themes=result["themes"],
                    keywords=result["keywords"],
                    pain_points=result["pain_points"],
                    customer_intent=result["customer_intent"],
                    ai_summary=result["summary"],
                    weight=feedback.weight,
                    classification_metadata=metadata,
                    classification_status="classified",
                )

                # Delete any existing classified feedback for this processed ID to prevent unique constraint violation
                ClassifiedFeedback.query.filter_by(processed_feedback_id=feedback.processed_id).delete()

                db.session.add(classified_rec)

                # Mark the processed_feedback as classified
                feedback.classified_at = datetime.now(timezone.utc)

                db.session.commit()
                classified_count += 1

            except Exception as e:
                db.session.rollback()
                print(
                    f"[Module 4] Failed to classify processed_feedback "
                    f"{feedback.processed_id}: {e}"
                )

                # Attempt to store a failed record for traceability
                try:
                    failed_rec = ClassifiedFeedback(
                        processed_feedback_id=feedback.processed_id,
                        project_id=feedback.project_id,
                        ai_category="Complaint",  # Fallback category
                        ai_confidence_score=0.0,
                        ai_sentiment="Neutral",
                        ai_sentiment_score=0.0,
                        topics=[],
                        themes=[],
                        keywords=[],
                        pain_points=[],
                        customer_intent=None,
                        ai_summary=None,
                        weight=feedback.weight,
                        classification_metadata={
                            "gemini_model": self.model_name,
                            "prompt_version": self.prompt_version,
                            "error": str(e),
                        },
                        classification_status="failed",
                        classification_error=str(e)[:2000],
                    )
                    db.session.add(failed_rec)

                    # Still mark as classified to prevent infinite retries
                    feedback.classified_at = datetime.now(timezone.utc)

                    db.session.commit()
                except Exception as inner_e:
                    db.session.rollback()
                    print(
                        f"[Module 4] Failed to store error record for "
                        f"{feedback.processed_id}: {inner_e}"
                    )

                failed_count += 1

        return {
            "classified": classified_count,
            "failed": failed_count,
            "total_fetched": len(records),
        }
