"""
models/roadmap_item.py — SQLAlchemy model for the roadmap_items table
Module 10: Roadmap Planning & Milestone Recommendation
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, ForeignKey, CheckConstraint, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database.db import db


class RoadmapItem(db.Model):
    __tablename__ = "roadmap_items"

    __table_args__ = (
        CheckConstraint(
            "horizon IN ('now', 'next', 'later')",
            name="chk_roadmap_horizon",
        ),
    )

    # ------------------------------------------------------------------
    # Primary & Foreign Keys
    # ------------------------------------------------------------------
    roadmap_item_id = Column(
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
    prioritization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prioritized_features.prioritization_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # ------------------------------------------------------------------
    # Core Roadmap Attributes
    # ------------------------------------------------------------------
    horizon = Column(String(50), nullable=False, default="now")  # now, next, later
    milestone_name = Column(String(255), nullable=True)
    target_date = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

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
    prioritized_feature = relationship(
        "PrioritizedFeature",
        backref=db.backref(
            "roadmap_item",
            uselist=False,
            cascade="all, delete-orphan",
        ),
    )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def to_dict(self):
        return {
            "roadmap_item_id": str(self.roadmap_item_id),
            "project_id": str(self.project_id),
            "prioritization_id": str(self.prioritization_id),
            "horizon": self.horizon,
            "milestone_name": self.milestone_name,
            "target_date": self.target_date,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<RoadmapItem {self.roadmap_item_id} horizon={self.horizon} milestone={self.milestone_name}>"
