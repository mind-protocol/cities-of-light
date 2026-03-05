"""MediaSegment — atomic Q/A pair, the building block of Mode A."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class MediaSegment(BaseModel):
    """A single question-answer pair tied to a donor recording."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    donor_id: str
    question_text: str
    answer_text: str
    media_ref: Optional[str] = None
    media_type: Optional[str] = None  # "audio", "video"
    duration_sec: Optional[float] = None
    start_sec: Optional[float] = None
    end_sec: Optional[float] = None
    tags: list[str] = Field(default_factory=list)
    language: str = "fr"
    embedding: Optional[list[float]] = None
    source_asset_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    validated: bool = False
    validator_id: Optional[str] = None
