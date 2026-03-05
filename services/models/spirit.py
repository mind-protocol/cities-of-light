"""Spirit — Mode C autonomous agent stub."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class SpiritOrigin(str, Enum):
    SYNTHETIC = "synthetic"
    MEMORIAL = "memorial"
    HYBRID = "hybrid"


class Spirit(BaseModel):
    """A spirit entity for Mode C multi-agent simulation."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    origin: SpiritOrigin = SpiritOrigin.MEMORIAL
    donor_id: Optional[str] = None
    persona_description: str = ""
    traits: list[str] = Field(default_factory=list)
    active: bool = True
    ai_disclosure: str = "This is an AI representation, not the actual person."
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
