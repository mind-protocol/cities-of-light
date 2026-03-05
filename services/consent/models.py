"""Consent directive models for Cities of Light.

Three roles (Hollanek et al.):
- Data Donor: the person whose presence is preserved
- Data Steward: designated executor of post-mortem directives
- Service Interactant: the person who interacts with the representation

France-specific: Article 85 LIL (directives post-mortem).
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class ConsentMode(str, Enum):
    """Which interaction mode the donor consents to."""
    ARCHIVE = "archive"            # Mode A: non-generative, retrieval only
    CONSTRAINED_AVATAR = "avatar"  # Mode B: RAG + guardrails
    SIMULATION_AGENT = "agent"     # Mode C: multi-agent city


class DataType(str, Enum):
    """Granular data types that can be individually consented."""
    VOICE = "voice"
    VIDEO = "video"
    TEXT = "text"
    PHOTOS = "photos"
    BIOMETRICS = "biometrics"


class AudienceScope(str, Enum):
    """Who can interact with the representation."""
    FAMILY_ONLY = "family_only"
    STEWARD_APPROVED = "steward_approved"
    INSTITUTION = "institution"       # museum, foundation
    PUBLIC = "public"


class DirectiveType(str, Enum):
    """French law distinction: general vs particular directives."""
    GENERAL = "general"        # registered with trusted third party
    PARTICULAR = "particular"  # registered with operator (specific consent required)


class RedLine(BaseModel):
    """Topics/people/tones the representation must never engage with."""
    category: str          # "topic", "person", "tone"
    description: str       # what to avoid
    severity: str = "hard" # "hard" = absolute ban, "soft" = warn + deflect


class Steward(BaseModel):
    """Data steward / post-mortem executor."""
    name: str
    contact_email: str
    relationship: str                          # "spouse", "child", "lawyer", etc.
    verified: bool = False
    verified_at: Optional[datetime] = None


class ConsentDirective(BaseModel):
    """A single consent directive from a data donor.

    This is the atomic unit of consent. Each directive is:
    - Specific (not buried in terms of service)
    - Granular (per mode, per data type, per audience)
    - Revocable (at any time)
    - Traceable (signed, hashed, versioned)
    """
    id: str = Field(default_factory=lambda: str(uuid4()))
    version: int = 1

    # Who
    donor_id: str                              # unique donor identifier
    donor_name: str
    directive_type: DirectiveType = DirectiveType.PARTICULAR

    # What modes are authorized
    modes: list[ConsentMode]

    # What data types are authorized
    data_types: list[DataType]

    # Who can interact
    audience: AudienceScope = AudienceScope.FAMILY_ONLY
    authorized_family: list[str] = Field(default_factory=list)

    # Red lines
    red_lines: list[RedLine] = Field(default_factory=list)

    # Steward
    steward: Optional[Steward] = None

    # Post-mortem
    auto_retire_months: Optional[int] = None   # auto-deactivate after N months of inactivity
    digital_funeral_requested: bool = False     # donor wants a ceremony on retirement

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    revoked: bool = False
    revoked_at: Optional[datetime] = None
    revoked_by: Optional[str] = None           # "donor" or steward name

    # Integrity
    signature_hash: Optional[str] = None

    def compute_hash(self) -> str:
        """Compute SHA-256 hash of the directive content for integrity verification."""
        content = json.dumps({
            "donor_id": self.donor_id,
            "modes": [m.value for m in self.modes],
            "data_types": [d.value for d in self.data_types],
            "audience": self.audience.value,
            "red_lines": [r.model_dump() for r in self.red_lines],
            "version": self.version,
            "created_at": self.created_at.isoformat(),
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()

    def revoke(self, by: str = "donor") -> None:
        """Revoke this directive."""
        self.revoked = True
        self.revoked_at = datetime.now(timezone.utc)
        self.revoked_by = by
        self.updated_at = datetime.now(timezone.utc)

    def is_active(self) -> bool:
        """Check if this directive is currently active."""
        return not self.revoked


class ConsentCheck(BaseModel):
    """Result of a consent check — can this interaction proceed?"""
    allowed: bool
    mode: ConsentMode
    reason: str
    directive_id: Optional[str] = None
    red_lines: list[RedLine] = Field(default_factory=list)
