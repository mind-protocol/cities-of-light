"""Biography router — Mode A archive query engine (MVP core).

Given a question, finds the best matching Q/A segment from the donor's
vault transcripts and returns it — no generation, pure retrieval.
"""

from __future__ import annotations

from typing import Optional

from ..audit.logger import AuditLogger
from ..consent.models import ConsentMode
from ..consent.store import ConsentStore
from ..models.media_segment import MediaSegment
from ..policy.engine import PolicyEngine
from ..vault.store import VaultStore


class BiographyResponse:
    """Result of a biography query."""

    def __init__(
        self,
        allowed: bool,
        answer: Optional[str] = None,
        segment: Optional[MediaSegment] = None,
        ai_disclosure: str = "",
        refused: bool = False,
        refusal_reason: Optional[str] = None,
    ):
        self.allowed = allowed
        self.answer = answer
        self.segment = segment
        self.ai_disclosure = ai_disclosure
        self.refused = refused
        self.refusal_reason = refusal_reason

    def to_dict(self) -> dict:
        return {
            "allowed": self.allowed,
            "answer": self.answer,
            "segment": self.segment.model_dump() if self.segment else None,
            "ai_disclosure": self.ai_disclosure,
            "refused": self.refused,
            "refusal_reason": self.refusal_reason,
        }


class BiographyRouter:
    """Mode A biography engine — retrieval-only, no generation."""

    def __init__(
        self,
        vault_store: VaultStore,
        consent_store: ConsentStore,
        policy_engine: PolicyEngine,
        audit_logger: AuditLogger,
    ):
        self.vault = vault_store
        self.consent = consent_store
        self.policy = policy_engine
        self.audit = audit_logger

    def load_segments(self, donor_id: str) -> list[MediaSegment]:
        """Load vault transcripts as MediaSegment objects."""
        transcripts = self.vault.get_transcripts(donor_id)
        segments = []
        for t in transcripts:
            segments.append(
                MediaSegment(
                    id=t.get("id", ""),
                    donor_id=donor_id,
                    question_text=t.get("question", ""),
                    answer_text=t.get("answer", ""),
                    source_asset_id=t.get("source_asset_id"),
                    start_sec=t.get("start_sec", 0),
                    end_sec=t.get("end_sec", 0),
                )
            )
        return segments

    def match_question(
        self, question: str, segments: list[MediaSegment]
    ) -> Optional[MediaSegment]:
        """Find the best matching segment by keyword overlap."""
        if not segments or not question:
            return None

        q_words = set(question.lower().split())
        best_score = 0
        best_segment = None

        for seg in segments:
            seg_words = set(seg.question_text.lower().split())
            overlap = len(q_words & seg_words)
            if overlap > best_score:
                best_score = overlap
                best_segment = seg

        return best_segment if best_score > 0 else None

    def ask(
        self,
        donor_id: str,
        question: str,
        interactant_id: str,
    ) -> BiographyResponse:
        """Ask a question to a donor's archive.

        Flow: consent check -> red line check -> match -> audit -> response.
        """
        # Policy gate
        decision = self.policy.check_access(
            donor_id=donor_id,
            mode=ConsentMode.ARCHIVE,
            interactant_id=interactant_id,
            question=question,
        )

        if not decision.allowed:
            self.audit.log_interaction(
                donor_id=donor_id,
                interactant_id=interactant_id,
                mode="archive",
                input_text=question,
                refused=True,
                refusal_reason=decision.reason,
                directive_id=decision.directive_id,
            )
            return BiographyResponse(
                allowed=False,
                refused=True,
                refusal_reason=decision.reason,
                ai_disclosure=decision.ai_disclosure,
            )

        # Load and match
        segments = self.load_segments(donor_id)
        match = self.match_question(question, segments)

        if not match:
            self.audit.log_interaction(
                donor_id=donor_id,
                interactant_id=interactant_id,
                mode="archive",
                input_text=question,
                output_text=None,
                directive_id=decision.directive_id,
            )
            return BiographyResponse(
                allowed=True,
                answer=None,
                ai_disclosure=decision.ai_disclosure,
            )

        # Found a match
        self.audit.log_interaction(
            donor_id=donor_id,
            interactant_id=interactant_id,
            mode="archive",
            input_text=question,
            output_text=match.answer_text,
            documents_retrieved=[match.id],
            directive_id=decision.directive_id,
        )

        return BiographyResponse(
            allowed=True,
            answer=match.answer_text,
            segment=match,
            ai_disclosure=decision.ai_disclosure,
        )
