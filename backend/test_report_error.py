import os
import sys
import uuid

# Mock out heavy imports
from unittest.mock import MagicMock
sys.modules['sentence_transformers'] = MagicMock()
sys.modules['spacy'] = MagicMock()
sys.modules['transformers'] = MagicMock()

import nltk
nltk.download = lambda *args, **kwargs: True

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'))

from app import create_app
from services.report_service import ReportService

def main():
    app = create_app()
    with app.app_context():
        service = ReportService()
        # Find first project ID in the database from ProcessedFeedback
        from models.processed_feedback import ProcessedFeedback
        first_fb = ProcessedFeedback.query.first()
        if not first_fb:
            print("No feedback found in DB, using default UUID")
            project_id = uuid.UUID("550e8400-e29b-41d4-a716-446655440000")
        else:
            project_id = first_fb.project_id
            print("Found project ID in DB:", project_id)

        try:
            print("Generating report...")
            report = service.generate_report(
                project_id=project_id,
                title="Test Report Generation",
                report_type="executive_summary"
            )
            print("SUCCESS! Generated report:", report["report_id"])
        except Exception as e:
            import traceback
            print("FAILED with exception:")
            traceback.print_exc()

if __name__ == "__main__":
    main()
