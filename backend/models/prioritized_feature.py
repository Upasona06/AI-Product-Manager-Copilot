"""
models/prioritized_feature.py — SQLAlchemy model for the prioritized_features table
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, CheckConstraint, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database.db import db


class PrioritizedFeature(db.Model):
    __tablename__ = "prioritized_features"

    __table_args__ = (
        CheckConstraint(
            "priority_class IN ('High', 'Medium', 'Low')",
            name="chk_priority_class",
        ),
        CheckConstraint(
            "moscow_category IN ('Must Have', 'Should Have', 'Could Have', 'Won''t Have')",
            name="chk_moscow_category",
        ),
    )

    # ------------------------------------------------------------------
    # Primary & Foreign Keys
    # ------------------------------------------------------------------
    prioritization_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    processed_feedback_id = Column(
        UUID(as_uuid=True),
        db.ForeignKey("processed_feedback.processed_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # ------------------------------------------------------------------
    # Details & Core Text
    # ------------------------------------------------------------------
    feature_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # ------------------------------------------------------------------
    # Calculated Prioritization Metrics
    # ------------------------------------------------------------------
    impact_score = Column(Float, nullable=False)
    effort_score = Column(Float, nullable=False)
    risk_score = Column(Float, nullable=False)
    customer_value_score = Column(Float, nullable=False)
    roi_score = Column(Float, nullable=False)
    priority_score = Column(Float, nullable=False)
    priority_class = Column(String(50), nullable=False)  # High, Medium, Low

    # ------------------------------------------------------------------
    # RICE Framework Metrics
    # ------------------------------------------------------------------
    rice_reach = Column(Integer, nullable=False, default=1)
    rice_impact = Column(Float, nullable=False)
    rice_confidence = Column(Float, nullable=False, default=100.0)  # Percentage (e.g. 50.0 to 100.0)
    rice_effort = Column(Float, nullable=False)
    rice_score = Column(Float, nullable=False)

    # ------------------------------------------------------------------
    # MoSCoW Framework
    # ------------------------------------------------------------------
    moscow_category = Column(String(50), nullable=False)  # Must Have, Should Have, etc.

    # ------------------------------------------------------------------
    # AI Business Recommendation
    # ------------------------------------------------------------------
    business_recommendation = Column(Text, nullable=False)

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
    # Relationships
    # ------------------------------------------------------------------
    processed_feedback = relationship(
        "ProcessedFeedback",
        backref=db.backref(
            "prioritization",
            uselist=False,
            cascade="all, delete-orphan",
        ),
    )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def to_dict(self):
        return {
            "prioritization_id": str(self.prioritization_id),
            "processed_feedback_id": str(self.processed_feedback_id),
            "feature_name": self.feature_name,
            "description": self.description,
            "impact_score": self.impact_score,
            "effort_score": self.effort_score,
            "risk_score": self.risk_score,
            "customer_value_score": self.customer_value_score,
            "roi_score": self.roi_score,
            "priority_score": self.priority_score,
            "priority_class": self.priority_class,
            "rice_reach": self.rice_reach,
            "rice_impact": self.rice_impact,
            "rice_confidence": self.rice_confidence,
            "rice_effort": self.rice_effort,
            "rice_score": self.rice_score,
            "moscow_category": self.moscow_category,
            "business_recommendation": self.business_recommendation,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<PrioritizedFeature {self.prioritization_id} score={self.priority_score} class={self.priority_class}>"
