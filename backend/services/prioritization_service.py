"""
services/prioritization_service.py — Module 6 Prioritization & Business Impact Service
Calculates Impact, Effort, Risk, ROI, RICE, and MoSCoW priorities, and generates recommendations.
"""

import os
import json
import urllib.request
import urllib.error
import traceback
from database.db import db
from models.processed_feedback import ProcessedFeedback
from models.prioritized_feature import PrioritizedFeature

class PrioritizationService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")

    def run_prioritization(self, project_id, force=False) -> dict:
        """
        Runs the prioritization pipeline for a given project.
        By default, it prioritizes unprocessed ProcessedFeedback records.
        If force=True, it re-runs prioritization for all records.
        """
        stats = {
            "processed": 0,
            "skipped": 0,
            "failed": 0,
            "errors": []
        }

        # Fetch processed feedback records for the project
        query = ProcessedFeedback.query.filter_by(project_id=project_id, processing_status="processed")
        records = query.all()

        if not records:
            return stats

        for record in records:
            try:
                # Check if this record is already prioritized
                existing = PrioritizedFeature.query.filter_by(processed_feedback_id=record.processed_id).first()
                if existing and not force:
                    stats["skipped"] += 1
                    continue

                # Run prioritization evaluation
                result = self._evaluate_record(record)
                if not result:
                    stats["failed"] += 1
                    stats["errors"].append(f"Evaluation returned None for record {record.processed_id}")
                    continue

                # Calculate dependent scoring values
                impact = result["impact_score"]
                effort = result["effort_score"]
                risk = result["risk_score"]
                confidence = result["confidence_score"]
                weight = record.weight or 1

                # 1. RICE calculations
                rice_reach = weight
                rice_impact = impact
                rice_confidence = confidence
                rice_effort = effort
                # RICE = (Reach * Impact * Confidence) / Effort. Scale confidence to 0.0-1.0
                rice_score = round((rice_reach * rice_impact * (rice_confidence / 100.0)) / max(0.1, rice_effort), 2)

                # 2. Customer Value Score = Impact * logarithmic scale of weight
                # Gives weight a positive but sub-linear influence so high weights don't overly dominate
                import math
                customer_value_score = round(impact * (1.0 + math.log(weight, 2)), 2)

                # 3. ROI Score = Customer Value / Effort
                roi_score = round(customer_value_score / max(0.1, effort), 2)

                # 4. Overall Priority Score: Factors in Risk
                # Risk acts as a dampener (higher risk = lower priority score)
                priority_score = round(rice_score / (0.5 * risk + 0.5), 2)

                # 5. Classify Priority Class
                if priority_score >= 5.0:
                    priority_class = "High"
                elif priority_score >= 1.5:
                    priority_class = "Medium"
                else:
                    priority_class = "Low"

                # Prepare fields for database insertion/update
                feature_name = record.original_subject
                description = record.original_description

                if existing:
                    # Update
                    existing.feature_name = feature_name
                    existing.description = description
                    existing.impact_score = impact
                    existing.effort_score = effort
                    existing.risk_score = risk
                    existing.customer_value_score = customer_value_score
                    existing.roi_score = roi_score
                    existing.priority_score = priority_score
                    existing.priority_class = priority_class
                    existing.rice_reach = rice_reach
                    existing.rice_impact = rice_impact
                    existing.rice_confidence = rice_confidence
                    existing.rice_effort = rice_effort
                    existing.rice_score = rice_score
                    existing.moscow_category = result["moscow_category"]
                    existing.business_recommendation = result["business_recommendation"]
                else:
                    # Insert
                    new_feat = PrioritizedFeature(
                        processed_feedback_id=record.processed_id,
                        feature_name=feature_name,
                        description=description,
                        impact_score=impact,
                        effort_score=effort,
                        risk_score=risk,
                        customer_value_score=customer_value_score,
                        roi_score=roi_score,
                        priority_score=priority_score,
                        priority_class=priority_class,
                        rice_reach=rice_reach,
                        rice_impact=rice_impact,
                        rice_confidence=rice_confidence,
                        rice_effort=rice_effort,
                        rice_score=rice_score,
                        moscow_category=result["moscow_category"],
                        business_recommendation=result["business_recommendation"]
                    )
                    db.session.add(new_feat)

                stats["processed"] += 1

            except Exception as e:
                db.session.rollback()
                stats["failed"] += 1
                error_msg = f"Failed to process record {record.processed_id}: {str(e)}\n{traceback.format_exc()}"
                print(error_msg)
                stats["errors"].append(error_msg)

        if stats["processed"] > 0:
            db.session.commit()

        return stats

    def _evaluate_record(self, record: ProcessedFeedback) -> dict:
        """
        Evaluates a processed feedback record.
        Tries to call Gemini API if key is present, otherwise falls back to heuristics.
        """
        if self.api_key:
            res = self._call_gemini_api(record)
            if res:
                return res
            # If API fails, fall back to heuristic
            print("Gemini API call failed. Falling back to heuristic prioritizer.")
            
        return self._evaluate_heuristically(record)

    def _call_gemini_api(self, record: ProcessedFeedback) -> dict:
        """
        Calls Gemini 1.5 Flash API to get structured prioritizations.
        """
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
        
        prompt = f"""You are an expert product manager and business analyst.
Analyze the following feature request or customer feedback:
Title: {record.original_subject}
Description: {record.original_description}
Category: {record.category}
Frequency weight (number of user requests): {record.weight or 1}
Initial priority: {record.priority or 'Medium'}

Evaluate this feedback item and calculate the following metrics:
1. impact_score (float from 1.0 to 10.0, where 1.0 is minimal user value and 10.0 is critical/transformative value)
2. effort_score (float from 1.0 to 10.0, where 1.0 is negligible coding and 10.0 is massive cross-team architectural work)
3. risk_score (float from 1.0 to 10.0, where 1.0 is zero risk and 10.0 is high risk of regressions, data loss, security bugs, or churn)
4. confidence_score (float from 50.0 to 100.0, representing certainty in the estimates)
5. moscow_category (must be one of: 'Must Have', 'Should Have', 'Could Have', 'Won\'t Have')
6. business_recommendation (2-3 sentences of professional product management advice explaining this prioritization and execution recommendations)

Return ONLY a raw JSON object with precisely these keys: "impact_score", "effort_score", "risk_score", "confidence_score", "moscow_category", "business_recommendation". Do not wrap it in markdown code blocks.
"""
        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        
        try:
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                url,
                data=data,
                headers={'Content-Type': 'application/json'}
            )
            
            with urllib.request.urlopen(req, timeout=12) as response:
                res_data = response.read().decode('utf-8')
                res_json = json.loads(res_data)
                
                text_response = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
                parsed = json.loads(text_response)
                
                # Validation of schema
                required_keys = ["impact_score", "effort_score", "risk_score", "confidence_score", "moscow_category", "business_recommendation"]
                if all(k in parsed for k in required_keys):
                    # Ensure MoSCoW category is correct
                    m_cat = parsed["moscow_category"]
                    if m_cat not in ("Must Have", "Should Have", "Could Have", "Won't Have"):
                        parsed["moscow_category"] = "Could Have"
                    
                    # Convert to appropriate types
                    parsed["impact_score"] = min(10.0, max(1.0, float(parsed["impact_score"])))
                    parsed["effort_score"] = min(10.0, max(1.0, float(parsed["effort_score"])))
                    parsed["risk_score"] = min(10.0, max(1.0, float(parsed["risk_score"])))
                    parsed["confidence_score"] = min(100.0, max(50.0, float(parsed["confidence_score"])))
                    return parsed
                else:
                    print(f"Missing keys in Gemini JSON response: {parsed}")
                    return None
        except Exception as e:
            print(f"Failed to communicate with Gemini API: {str(e)}")
            return None

    def _evaluate_heuristically(self, record: ProcessedFeedback) -> dict:
        """
        Rule-based heuristic evaluator to calculate prioritization parameters.
        Includes a string hash variance component to keep results realistic and distinct.
        """
        subject = record.original_subject or ""
        description = record.original_description or ""
        category = record.category or "General"
        priority = record.priority or "Medium"
        weight = record.weight or 1

        # Use text characteristics to add stable variance
        text_seed = subject + description
        char_sum = sum(ord(c) for c in text_seed)
        variance = ((char_sum % 11) - 5) / 5.0  # Stable value between -1.0 and +1.0

        # Baseline definitions
        impact = 5.0
        effort = 5.0
        risk = 4.0
        confidence = 80.0
        moscow = "Could Have"

        # Categorized rules
        if category == "Bug":
            if priority == "Critical":
                impact = 9.5
                effort = 3.5
                risk = 3.0
                confidence = 95.0
                moscow = "Must Have"
            elif priority == "High":
                impact = 8.0
                effort = 3.0
                risk = 2.0
                confidence = 90.0
                moscow = "Must Have"
            elif priority == "Medium":
                impact = 6.0
                effort = 2.5
                risk = 2.0
                confidence = 85.0
                moscow = "Should Have"
            else:
                impact = 4.0
                effort = 2.0
                risk = 1.5
                confidence = 80.0
                moscow = "Could Have"
        elif category == "Feature Request":
            if priority == "Critical":
                impact = 9.0
                effort = 7.5
                risk = 6.0
                confidence = 85.0
                moscow = "Must Have"
            elif priority == "High":
                impact = 7.5
                effort = 6.0
                risk = 5.0
                confidence = 80.0
                moscow = "Should Have"
            elif priority == "Medium":
                impact = 5.5
                effort = 4.5
                risk = 4.0
                confidence = 75.0
                moscow = "Should Have"
            else:
                impact = 4.0
                effort = 3.5
                risk = 3.0
                confidence = 70.0
                moscow = "Could Have"
        elif category == "Improvement":
            if priority in ("Critical", "High"):
                impact = 7.0
                effort = 5.0
                risk = 3.0
                confidence = 90.0
                moscow = "Should Have"
            elif priority == "Medium":
                impact = 5.0
                effort = 3.5
                risk = 2.5
                confidence = 85.0
                moscow = "Could Have"
            else:
                impact = 3.5
                effort = 2.5
                risk = 2.0
                confidence = 80.0
                moscow = "Could Have"
        else: # General or Complaint
            if priority == "Critical":
                impact = 8.0
                effort = 5.0
                risk = 5.0
                confidence = 80.0
                moscow = "Must Have"
            elif priority == "High":
                impact = 6.5
                effort = 4.0
                risk = 4.0
                confidence = 80.0
                moscow = "Should Have"
            else:
                impact = 4.5
                effort = 3.0
                risk = 3.0
                confidence = 75.0
                moscow = "Could Have"

        # Apply variances
        impact = min(10.0, max(1.0, impact + variance))
        effort = min(10.0, max(1.0, effort + variance * 0.4))
        risk = min(10.0, max(1.0, risk + variance * 0.3))
        confidence = min(100.0, max(50.0, confidence + variance * 5.0))

        # Adjust for customer demand/weight
        weight_bonus = min(2.5, (weight - 1) * 0.25)
        impact = min(10.0, impact + weight_bonus)

        # Dynamic MoSCoW adjustments based on weight
        if weight >= 5 and moscow == "Could Have":
            moscow = "Should Have"
        if weight >= 10 and moscow in ("Should Have", "Could Have"):
            moscow = "Must Have"

        # Formulate business recommendations
        rec = f"AI recommendation (heuristic fallback): This {category.lower()} has high viability "
        if moscow == "Must Have":
            rec += f"and is marked as a Must Have due to critical status or high user demand (weight {weight}). Focus immediate resources to ship this."
        elif moscow == "Should Have":
            rec += f"and is classified as a Should Have with an impact score of {impact:.1f}/10. Implement in the upcoming release cycle."
        elif moscow == "Could Have":
            rec += f"and is classified as a Could Have, requiring {effort:.1f}/10 effort. Schedule this in future backlogs depending on dev bandwidth."
        else:
            rec += f"and is classified as Won't Have. Postpone implementation until resources or objectives realign."

        return {
            "impact_score": round(impact, 1),
            "effort_score": round(effort, 1),
            "risk_score": round(risk, 1),
            "confidence_score": round(confidence, 1),
            "moscow_category": moscow,
            "business_recommendation": rec
        }
