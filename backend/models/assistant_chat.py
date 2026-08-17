"""
models/assistant_chat.py — SQLAlchemy model for the assistant_chats table
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB

from database.db import db


class AssistantChat(db.Model):
    __tablename__ = "assistant_chats"

    chat_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    project_id = Column(
        UUID(as_uuid=True),
        nullable=False,
    )
    title = Column(String(255), nullable=False, default="New Conversation")
    messages = Column(JSONB, nullable=False, default=list)

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

    def to_dict(self, include_messages=True):
        data = {
            "chat_id": str(self.chat_id),
            "project_id": str(self.project_id),
            "title": self.title,
            "message_count": len(self.messages) if self.messages else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_messages:
            data["messages"] = self.messages or []
        else:
            if self.messages and len(self.messages) > 0:
                last_msg = self.messages[-1]
                data["last_preview"] = (
                    (last_msg.get("text", "")[:90] + "...")
                    if len(last_msg.get("text", "")) > 90
                    else last_msg.get("text", "")
                )
            else:
                data["last_preview"] = ""
        return data

    def __repr__(self):
        return f"<AssistantChat {self.chat_id} title={self.title}>"
