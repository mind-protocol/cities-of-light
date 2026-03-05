"""Donor entity — the person whose presence is preserved."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class DonorStatus(str, Enum):
    ALIVE = "alive"
    DECEASED = "deceased"
    RETIRED = "retired"


class Donor(BaseModel):
    """A data donor — the person at the centre of the preservation."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    date_of_birth: Optional[str] = None
    date_of_death: Optional[str] = None
    status: DonorStatus = DonorStatus.ALIVE
    languages: list[str] = Field(default_factory=lambda: ["fr"])
    steward_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict = Field(default_factory=dict)
