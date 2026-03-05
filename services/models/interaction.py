"""Interaction record — first-class log entry with provenance."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class Interaction(BaseModel):
    """A single interaction between a visitor and a donor's representation."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    donor_id: str
    interactant_id: str
    mode: str  # "archive", "avatar", "agent"
    question: str
    response_segment_id: Optional[str] = None
    response_text: Optional[str] = None
    consent_directive_id: Optional[str] = None
    red_lines_applied: list[str] = Field(default_factory=list)
    refused: bool = False
    refusal_reason: Optional[str] = None
    zone: Optional[str] = None  # "archive", "garden", "agora"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ai_act_label: Optional[str] = None
