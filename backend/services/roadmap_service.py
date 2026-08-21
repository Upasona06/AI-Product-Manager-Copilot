"""
services/roadmap_service.py — Module 10 Roadmap & Milestone Recommendation Service
"""

import os
import json
import uuid
import logging
from database.db import db
from models.processed_feedback import ProcessedFeedback
from models.prioritized_feature import PrioritizedFeature
from models.roadmap_item import RoadmapItem
from services.gemini_service import ask_gemini

logger = logging.getLogger(__name__)

class RoadmapService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")

    def get_roadmap(self, project_id) -> list:
        """
        Retrieves all prioritized features and joins with their roadmap item.
        Default horizon to 'now' if not yet mapped on the roadmap.
        """
        # Fetch prioritized features for the project via joined load
        features = (
            db.session.query(PrioritizedFeature)
            .join(ProcessedFeedback)
            .filter(ProcessedFeedback.project_id == project_id)
            .all()
        )

        roadmap_list = []
        for feature in features:
            f_dict = feature.to_dict()
            
            # Find associated roadmap item
            item = RoadmapItem.query.filter_by(prioritization_id=feature.prioritization_id).first()
            if item:
                f_dict["roadmap_item"] = item.to_dict()
                f_dict["horizon"] = item.horizon
            else:
                # Default values for unmapped items
                f_dict["roadmap_item"] = None
                f_dict["horizon"] = "now"  # Default column
                
            roadmap_list.append(f_dict)
            
        return roadmap_list

    def update_roadmap_item(self, project_id, prioritization_id, horizon, milestone_name=None, target_date=None, notes=None) -> dict:
        """
        Upserts a RoadmapItem position for a given feature.
        """
        # Verify the prioritization feature exists
        feature = PrioritizedFeature.query.filter_by(prioritization_id=prioritization_id).first()
        if not feature:
            raise ValueError(f"Prioritized feature {prioritization_id} not found.")

        item = RoadmapItem.query.filter_by(prioritization_id=prioritization_id).first()
        
        if item:
            # Update existing
            item.horizon = horizon
            if milestone_name is not None:
                item.milestone_name = milestone_name
            if target_date is not None:
                item.target_date = target_date
            if notes is not None:
                item.notes = notes
        else:
            # Create new
            item = RoadmapItem(
                project_id=uuid.UUID(str(project_id)) if isinstance(project_id, str) else project_id,
                prioritization_id=uuid.UUID(str(prioritization_id)) if isinstance(prioritization_id, str) else prioritization_id,
                horizon=horizon,
                milestone_name=milestone_name or "",
                target_date=target_date or "",
                notes=notes or ""
            )
            db.session.add(item)
            
        db.session.commit()
        return item.to_dict()

    def generate_recommendations(self, project_id) -> list:
        """
        Generates recommended milestones and groups prioritized features.
        Utilizes Gemini AI if API key is active; falls back to deterministic MoSCoW sorting otherwise.
        """
        features = (
            db.session.query(PrioritizedFeature)
            .join(ProcessedFeedback)
            .filter(ProcessedFeedback.project_id == project_id)
            .all()
        )

        if not features:
            return []

        # Convert to dictionary representation for analysis
        feature_data_list = []
        for f in features:
            feature_data_list.append({
                "id": str(f.prioritization_id),
                "name": f.feature_name,
                "description": f.description or "",
                "moscow": f.moscow_category,
                "priority_class": f.priority_class,
                "priority_score": f.priority_score,
                "impact": f.impact_score,
                "effort": f.effort_score,
                "risk": f.risk_score
            })

        if self.api_key:
            try:
                system_instruction = (
                    "You are an expert product strategy assistant. Your goal is to group a list of "
                    "prioritized features into 3 logical milestones (e.g. MVP, Core Releases, Enhancements) "
                    "and provide recommended target dates, target goals, and the list of feature IDs for each milestone. "
                    "You must return a raw JSON list containing precisely 3 milestone objects."
                )
                
                prompt = f"""Group the following prioritized features into 3 distinct milestone releases:
Features list:
{json.dumps(feature_data_list, indent=2)}

Format the output strictly as a JSON array of 3 objects, where each object has these fields:
- "name": (e.g. "Milestone 1: MVP Launch")
- "goal": (e.g. "Deliver core account and payment capabilities to early adopters")
- "target_date": (e.g. "Q1 2026" or "1-2 Months")
- "description": (Brief rationale explaining the milestone composition)
- "feature_ids": (Array of strings matching the "id" field of features in the list)

Do not return any conversational text, markdown blocks, or leading/trailing comments. Return only valid JSON.
"""
                response_text = ask_gemini(prompt, system_instruction=system_instruction, json_mode=True)
                
                # Sanitize response in case it contains backticks or markdown decorators
                sanitized_text = response_text.strip()
                if sanitized_text.startswith("```json"):
                    sanitized_text = sanitized_text[7:]
                if sanitized_text.startswith("```"):
                    sanitized_text = sanitized_text[3:]
                if sanitized_text.endswith("```"):
                    sanitized_text = sanitized_text[:-3]
                sanitized_text = sanitized_text.strip()

                milestones = json.loads(sanitized_text)
                return milestones
            except Exception as e:
                logger.error(f"Gemini API milestone generation failed: {e}. Falling back to heuristic.")
                # Fall through to heuristic if AI fails

        # --- HEURISTIC FALLBACK ALGORITHM ---
        # Group 1: MVP (Must Haves & top high priority Should Haves)
        mvp_ids = []
        # Group 2: Core Enhancements (Should Haves & high priority Could Haves)
        core_ids = []
        # Group 3: Future Horizons (Remaining Could Haves & Won't Haves)
        future_ids = []

        # Sort by priority score descending
        sorted_features = sorted(feature_data_list, key=lambda x: x["priority_score"], reverse=True)

        for f in sorted_features:
            moscow = f["moscow"]
            score = f["priority_score"]
            
            if moscow == "Must Have" or (moscow == "Should Have" and score >= 4.0):
                mvp_ids.append(f["id"])
            elif moscow == "Should Have" or (moscow == "Could Have" and score >= 2.0):
                core_ids.append(f["id"])
            else:
                future_ids.append(f["id"])

        # Guarantee at least some items in each list if lists are empty and others are full
        if not mvp_ids and sorted_features:
            mvp_ids = [f["id"] for f in sorted_features[:max(1, len(sorted_features)//3)]]
            remaining = sorted_features[len(mvp_ids):]
            core_ids = [f["id"] for f in remaining[:len(remaining)//2]]
            future_ids = [f["id"] for f in remaining[len(core_ids):]]

        return [
            {
                "name": "Milestone 1: MVP Foundation",
                "goal": "Establish the foundational workflows and high-impact requirements to launch the core product value.",
                "target_date": "Next 1-2 Months (Now)",
                "description": "Contains high priority 'Must Have' features critical for system operation and immediate customer satisfaction.",
                "feature_ids": mvp_ids
            },
            {
                "name": "Milestone 2: Core Enhancements",
                "goal": "Expand core functionality to improve user experience, operational support, and system robustness.",
                "target_date": "Next 3-6 Months (Next)",
                "description": "Comprises 'Should Have' features that provide substantial business value and expand the product footprint.",
                "feature_ids": core_ids
            },
            {
                "name": "Milestone 3: Future Horizons",
                "goal": "Introduce nice-to-have capabilities, optimizations, and long-term features to maximize product value.",
                "target_date": "6+ Months (Later)",
                "description": "Includes 'Could Have' and lower priority features scheduled for long-term refinement and optimization.",
                "feature_ids": future_ids
            }
        ]

    def update_column_targets(self, project_id, horizon, milestone_name, target_date, notes) -> int:
        """
        Updates target milestone_name, target_date, and notes for all features in a given horizon.
        """
        features = (
            db.session.query(PrioritizedFeature)
            .join(ProcessedFeedback)
            .filter(ProcessedFeedback.project_id == project_id)
            .all()
        )

        updated_count = 0
        proj_uuid = uuid.UUID(str(project_id)) if isinstance(project_id, str) else project_id
        
        for feature in features:
            item = RoadmapItem.query.filter_by(prioritization_id=feature.prioritization_id).first()
            
            # If the feature matches the targeted horizon (or is unmapped and target horizon is 'now')
            if (item and item.horizon == horizon) or (not item and horizon == 'now'):
                if not item:
                    item = RoadmapItem(
                        project_id=proj_uuid,
                        prioritization_id=feature.prioritization_id,
                        horizon=horizon,
                        milestone_name=milestone_name or "",
                        target_date=target_date or "",
                        notes=notes or ""
                    )
                    db.session.add(item)
                else:
                    item.milestone_name = milestone_name or ""
                    item.target_date = target_date or ""
                    item.notes = notes or ""
                updated_count += 1
                
        db.session.commit()
        return updated_count

