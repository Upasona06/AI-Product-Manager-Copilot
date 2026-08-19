"""
test_reports.py — Integration test for Module 10 Strategy Report endpoints (Unittest version)
"""

import os
import sys
import uuid
import json
import unittest
from dotenv import load_dotenv
load_dotenv()
from unittest.mock import MagicMock

# Mock out heavy imports so tests run fast
sys.modules['sentence_transformers'] = MagicMock()
sys.modules['spacy'] = MagicMock()
sys.modules['transformers'] = MagicMock()

import nltk
nltk.download = lambda *args, **kwargs: True

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from database.db import db
from models.user import User
from models.product_report import ProductReport
from flask_jwt_extended import create_access_token


class ReportsTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

        # Disable API Key to force quick heuristic compile in tests
        from services.report_service import ReportService
        self.original_key = os.environ.get("GEMINI_API_KEY")
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]

        # Setup database test records
        self.project_id = uuid.UUID("770e8400-e29b-41d4-a716-446655440000")
        
        # Get or create a default PM user for token generation
        self.pm = User.query.filter_by(role="product_manager").first()
        if not self.pm:
            self.pm = User(
                email="test_pm_reports@company.com",
                password_hash="mocked",
                full_name="Test PM Reports",
                role="product_manager",
                project_id=self.project_id,
                is_active=True
            )
            db.session.add(self.pm)
            db.session.commit()
            
        # Set project ID on the user just in case
        self.pm.project_id = self.project_id
        db.session.commit()

        # Generate access token with proper identity and claims
        self.token = create_access_token(
            identity=str(self.pm.user_id),
            additional_claims={"role": "product_manager", "project_id": str(self.project_id)}
        )
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def tearDown(self):
        # Restore environment
        if self.original_key:
            os.environ["GEMINI_API_KEY"] = self.original_key
            
        # Clean up any created reports in test
        ProductReport.query.filter_by(project_id=self.project_id).delete()
        db.session.commit()
        
        self.ctx.pop()

    def test_generate_and_get_reports(self):
        """Test generating a report, listing reports, and fetching its details."""
        # 1. Generate report
        post_data = {
            "project_id": str(self.project_id),
            "title": "Q3 2026 Strategy",
            "report_type": "product_strategy"
        }
        
        response = self.client.post("/api/reports/generate", data=json.dumps(post_data), headers=self.headers)
        self.assertEqual(response.status_code, 201)
        res_json = json.loads(response.data)
        self.assertTrue(res_json["success"])
        self.assertIn("report_id", res_json["data"])
        self.assertEqual(res_json["data"]["title"], "Q3 2026 Strategy")
        
        report_id = res_json["data"]["report_id"]

        # 2. Get list of reports for this project
        list_response = self.client.get(f"/api/reports?project_id={self.project_id}", headers=self.headers)
        self.assertEqual(list_response.status_code, 200)
        list_json = json.loads(list_response.data)
        self.assertTrue(list_json["success"])
        self.assertGreaterEqual(len(list_json["data"]), 1)
        
        # 3. Get details of generated report
        detail_response = self.client.get(f"/api/reports/{report_id}", headers=self.headers)
        self.assertEqual(detail_response.status_code, 200)
        detail_json = json.loads(detail_response.data)
        self.assertTrue(detail_json["success"])
        self.assertEqual(detail_json["data"]["report_id"], report_id)
        self.assertIn("Horizon Execution Strategy", detail_json["data"]["content"])

    def test_delete_report(self):
        """Test deleting a report."""
        # Create a report record directly
        report = ProductReport(
            project_id=self.project_id,
            title="Temp Executive Summary",
            report_type="executive_summary",
            content="Mock report content"
        )
        db.session.add(report)
        db.session.commit()
        report_id = str(report.report_id)

        # Verify it exists
        self.assertIsNotNone(ProductReport.query.get(report_id))

        # Delete it via endpoint
        del_response = self.client.delete(f"/api/reports/{report_id}", headers=self.headers)
        self.assertEqual(del_response.status_code, 200)
        del_json = json.loads(del_response.data)
        self.assertTrue(del_json["success"])

        # Verify it is removed
        self.assertIsNone(ProductReport.query.get(report_id))


if __name__ == "__main__":
    unittest.main()
