"""Consent directive storage — JSONL append-only log with latest-state semantics.

Same pattern as manemus backlog: append-only for auditability, latest version wins.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .models import (
    AudienceScope,
    ConsentCheck,
    ConsentDirective,
    ConsentMode,
)


class ConsentStore:
    """Manages consent directives with append-only audit trail."""

    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._directives: dict[str, ConsentDirective] = {}
        self._load()

    def _load(self) -> None:
        """Load directives from JSONL, latest version per ID wins."""
        if not self.path.exists():
            return
        for line in self.path.read_text().splitlines():
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                directive = ConsentDirective(**data)
                self._directives[directive.id] = directive
            except (json.JSONDecodeError, Exception):
                continue

    def _append(self, directive: ConsentDirective) -> None:
        """Append directive to JSONL log."""
        with open(self.path, "a") as f:
            f.write(directive.model_dump_json() + "\n")

    def create(self, directive: ConsentDirective) -> ConsentDirective:
        """Create a new consent directive."""
        directive.signature_hash = directive.compute_hash()
        self._directives[directive.id] = directive
        self._append(directive)
        return directive

    def get(self, directive_id: str) -> Optional[ConsentDirective]:
        """Get a directive by ID."""
        return self._directives.get(directive_id)

    def get_for_donor(self, donor_id: str) -> list[ConsentDirective]:
        """Get all active directives for a donor."""
        return [
            d for d in self._directives.values()
            if d.donor_id == donor_id and d.is_active()
        ]

    def revoke(self, directive_id: str, by: str = "donor") -> Optional[ConsentDirective]:
        """Revoke a directive. Returns updated directive or None."""
        directive = self._directives.get(directive_id)
        if not directive:
            return None
        directive.revoke(by=by)
        self._append(directive)
        return directive

    def update(self, directive: ConsentDirective) -> ConsentDirective:
        """Update a directive (creates new version)."""
        directive.version += 1
        directive.updated_at = datetime.now(timezone.utc)
        directive.signature_hash = directive.compute_hash()
        self._directives[directive.id] = directive
        self._append(directive)
        return directive

    def check_consent(
        self,
        donor_id: str,
        mode: ConsentMode,
        interactant_id: Optional[str] = None,
    ) -> ConsentCheck:
        """Check if an interaction is allowed under current consent directives.

        This is the critical gate — called before every interaction.
        """
        directives = self.get_for_donor(donor_id)

        if not directives:
            return ConsentCheck(
                allowed=False,
                mode=mode,
                reason="No active consent directive found for this donor",
            )

        # Find a directive that authorizes this mode
        for d in directives:
            if mode not in d.modes:
                continue

            # Check audience scope
            if d.audience == AudienceScope.FAMILY_ONLY:
                if interactant_id and interactant_id not in d.authorized_family:
                    continue

            # Found a matching directive
            return ConsentCheck(
                allowed=True,
                mode=mode,
                reason="Authorized by consent directive",
                directive_id=d.id,
                red_lines=d.red_lines,
            )

        return ConsentCheck(
            allowed=False,
            mode=mode,
            reason=f"No directive authorizes mode={mode.value} for this interactant",
        )

    def list_all(self) -> list[ConsentDirective]:
        """List all directives (active and revoked)."""
        return list(self._directives.values())
