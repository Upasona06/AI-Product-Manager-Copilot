"""
models/user_story.py — SQLAlchemy model for the user_stories table
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID

from database.db import db


class UserStory(db.Model):
    __tablename__ = "user_stories"

    story_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    project_id = Column(
        UUID(as_uuid=True),
        nullable=False,
    )
    prioritization_id = Column(
        UUID(as_uuid=True),
        db.ForeignKey("prioritized_features.prioritization_id", ondelete="SET NULL"),
        nullable=True,
    )
    feature_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    story_content = Column(Text, nullable=False)

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

    def to_dict(self):
        return {
            "story_id": str(self.story_id),
            "project_id": str(self.project_id),
            "prioritization_id": str(self.prioritization_id) if self.prioritization_id else None,
            "feature_name": self.feature_name,
            "description": self.description,
            "story_content": self.story_content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<UserStory {self.story_id} feature={self.feature_name}>"
