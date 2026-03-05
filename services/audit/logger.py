"""Audit logger — records every interaction for reproducibility and review.

Logs: prompt, documents retrieved, consent rules applied, output, refusal reason.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class AuditEntry(BaseModel):
    """A single auditable interaction."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Who
    donor_id: str
    interactant_id: str
    directive_id: Optional[str] = None

    # What
    mode: str                          # "archive", "avatar", "agent"
    action: str                        # "query", "view", "interact"
    input_text: Optional[str] = None   # what the interactant asked/said

    # How (provenance)
    documents_retrieved: list[str] = Field(default_factory=list)  # transcript IDs
    consent_rules_applied: list[str] = Field(default_factory=list)
    red_lines_checked: list[str] = Field(default_factory=list)

    # Result
    output_text: Optional[str] = None  # what was returned
    refused: bool = False
    refusal_reason: Optional[str] = None

    # Context
    zone: Optional[str] = None         # "archive", "garden", "agora", etc.
    session_id: Optional[str] = None


class AuditLogger:
    """Append-only audit log."""

    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def log(self, entry: AuditEntry) -> None:
        """Append an audit entry."""
        with open(self.path, "a") as f:
            f.write(entry.model_dump_json() + "\n")

    def log_interaction(
        self,
        donor_id: str,
        interactant_id: str,
        mode: str,
        input_text: str,
        output_text: Optional[str] = None,
        refused: bool = False,
        refusal_reason: Optional[str] = None,
        **kwargs,
    ) -> AuditEntry:
        """Convenience method to log an interaction."""
        entry = AuditEntry(
            donor_id=donor_id,
            interactant_id=interactant_id,
            mode=mode,
            action="query",
            input_text=input_text,
            output_text=output_text,
            refused=refused,
            refusal_reason=refusal_reason,
            **kwargs,
        )
        self.log(entry)
        return entry

    def get_entries(
        self,
        donor_id: Optional[str] = None,
        limit: int = 100,
    ) -> list[AuditEntry]:
        """Read audit entries, optionally filtered by donor."""
        if not self.path.exists():
            return []
        entries = []
        for line in self.path.read_text().splitlines():
            if not line.strip():
                continue
            try:
                entry = AuditEntry(**json.loads(line))
                if donor_id and entry.donor_id != donor_id:
                    continue
                entries.append(entry)
            except (json.JSONDecodeError, Exception):
                continue
        return entries[-limit:]
