"""
models/product_report.py — SQLAlchemy model for the product_reports table
Module 10 / Milestone 4: Product Strategy & Executive Summary Generator
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, CheckConstraint, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID

from database.db import db


class ProductReport(db.Model):
    __tablename__ = "product_reports"

    __table_args__ = (
        CheckConstraint(
            "report_type IN ('executive_summary', 'product_strategy')",
            name="chk_report_type",
        ),
    )

    # ------------------------------------------------------------------
    # Primary Key & Project Association
    # ------------------------------------------------------------------
    report_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    project_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------
    # Report Metadata & Content
    # ------------------------------------------------------------------
    title = Column(String(255), nullable=False)
    report_type = Column(String(100), nullable=False)  # executive_summary, product_strategy
    content = Column(Text, nullable=False)

    # ------------------------------------------------------------------
    # Timestamps
    # ------------------------------------------------------------------
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def to_dict(self):
        return {
            "report_id": str(self.report_id),
            "project_id": str(self.project_id),
            "title": self.title,
            "report_type": self.report_type,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<ProductReport {self.report_id} type={self.report_type} title='{self.title}'>"
