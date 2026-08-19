"""
test_roadmap.py — Integration test for Module 10 Roadmap Planner endpoints (Unittest version)
"""

import os
import sys
import uuid
import json
import unittest
from dotenv import load_dotenv
load_dotenv()
from unittest.mock import MagicMock

sys.modules['sentence_transformers'] = MagicMock()
sys.modules['spacy'] = MagicMock()
sys.modules['transformers'] = MagicMock()

import nltk
nltk.download = lambda *args, **kwargs: True

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from database.db import db
from models.user import User
from models.prioritized_feature import PrioritizedFeature
from models.roadmap_item import RoadmapItem
from flask_jwt_extended import create_access_token


class RoadmapTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

        # Get or create a default PM user for token generation
        self.pm = User.query.filter_by(role="product_manager").first()
        if not self.pm:
            self.pm = User(
                email="test_pm@company.com",
                password_hash="mocked",
                full_name="Test Product Manager",
                role="product_manager",
                project_id=uuid.UUID("550e8400-e29b-41d4-a716-446655440000"),
                is_active=True
            )
            db.session.add(self.pm)
            db.session.commit()

        # Seed mock database entries for test coverage
        from models.raw_feedback import RawFeedback
        from models.processed_feedback import ProcessedFeedback
        from models.prioritized_feature import PrioritizedFeature
        
        # Verify if a prioritized feature exists for self.pm.project_id
        features = (
            db.session.query(PrioritizedFeature)
            .join(ProcessedFeedback)
            .filter(ProcessedFeedback.project_id == self.pm.project_id)
            .all()
        )
        
        if not features:
            # 1. Create RawFeedback
            rf = RawFeedback(
                feedback_id=uuid.uuid4(),
                project_id=self.pm.project_id,
                user_id=self.pm.user_id,
                source="text_form",
                submitted_by_role="product_manager",
                subject="Implement SSO Authentication",
                description="Users want single sign-on using Google and Okta.",
                priority="High",
                category="Feature Request",
                processing_status="processed",
                weight=1
            )
            db.session.add(rf)
            db.session.commit()
            
            # 2. Create ProcessedFeedback
            pf_rec = ProcessedFeedback(
                processed_id=uuid.uuid4(),
                raw_feedback_id=rf.feedback_id,
                project_id=self.pm.project_id,
                user_id=self.pm.user_id,
                source="text_form",
                submitted_by_role="product_manager",
                original_subject="Implement SSO Authentication",
                original_description="Users want single sign-on using Google and Okta.",
                clean_text="implement sso authentication google okta",
                standardized_text="implement sso authentication google okta",
                tokens=["implement", "sso", "authentication"],
                lemmas=["implement", "sso", "authentication"],
                priority="High",
                category="Feature Request",
                duplicate_group_id=uuid.uuid4(),
                weight=1,
                word_count=5,
                char_count=30,
                token_count=3,
                lemma_count=3,
                processing_status="processed"
            )
            db.session.add(pf_rec)
            db.session.commit()
            
            # 3. Create PrioritizedFeature
            self.prioritized = PrioritizedFeature(
                prioritization_id=uuid.uuid4(),
                processed_feedback_id=pf_rec.processed_id,
                feature_name="Implement SSO Authentication",
                description="Users want single sign-on using Google and Okta.",
                impact_score=5.0,
                effort_score=3.0,
                risk_score=2.0,
                customer_value_score=5.0,
                roi_score=1.67,
                priority_score=4.5,
                priority_class="High",
                rice_reach=1,
                rice_impact=5.0,
                rice_confidence=100.0,
                rice_effort=3.0,
                rice_score=1.67,
                moscow_category="Must Have",
                business_recommendation="High impact and critical for enterprise customers."
            )
            db.session.add(self.prioritized)
            db.session.commit()
        else:
            self.prioritized = features[0]

        self.token = create_access_token(
            identity=str(self.pm.user_id),
            additional_claims={
                "role": self.pm.role,
                "project_id": str(self.pm.project_id)
            }
        )
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        db.session.rollback()
        self.ctx.pop()

    def test_1_get_roadmap_endpoint(self):
        """Test retrieving roadmap items."""
        res = self.client.get("/api/roadmap", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        res_data = res.get_json()
        self.assertTrue(res_data["success"])
        self.assertIsInstance(res_data["data"], list)

    def test_2_update_roadmap_item(self):
        """Test adding/updating a feature on the roadmap."""
        pf = self.prioritized
        prioritization_id = str(pf.prioritization_id)
        project_id = str(self.pm.project_id)

        # Save to 'next' column
        payload = {
            "project_id": project_id,
            "prioritization_id": prioritization_id,
            "horizon": "next",
            "milestone_name": "Phase 2 Core",
            "target_date": "Q2 2026",
            "notes": "Testing roadmap persistence"
        }

        res = self.client.post("/api/roadmap/update", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        res_data = res.get_json()
        self.assertTrue(res_data["success"])
        self.assertEqual(res_data["data"]["horizon"], "next")
        self.assertEqual(res_data["data"]["milestone_name"], "Phase 2 Core")

        # Retrieve and verify it is returned in get_roadmap
        res_get = self.client.get(f"/api/roadmap?project_id={project_id}", headers=self.headers)
        self.assertEqual(res_get.status_code, 200)
        get_data = res_get.get_json()
        found = False
        for f in get_data["data"]:
            if f["prioritization_id"] == prioritization_id:
                self.assertEqual(f["horizon"], "next")
                self.assertEqual(f["roadmap_item"]["milestone_name"], "Phase 2 Core")
                found = True
                break
        self.assertTrue(found)

    def test_3_milestone_recommendations(self):
        """Test retrieving recommended milestones."""
        project_id = str(self.pm.project_id)
        res = self.client.get(f"/api/roadmap/recommendations?project_id={project_id}", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        res_data = res.get_json()
        self.assertTrue(res_data["success"])
        self.assertEqual(len(res_data["data"]), 3)
        self.assertIn("name", res_data["data"][0])
        self.assertIn("goal", res_data["data"][0])
        self.assertIn("feature_ids", res_data["data"][0])


if __name__ == "__main__":
    unittest.main()
