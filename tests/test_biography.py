"""Tests for Mode A biography router."""

import json
from pathlib import Path

import pytest

from services.audit.logger import AuditLogger
from services.biography.router import BiographyRouter
from services.consent.models import (
    AudienceScope,
    ConsentDirective,
    ConsentMode,
    DataType,
    RedLine,
)
from services.consent.store import ConsentStore
from services.policy.engine import PolicyEngine
from services.vault.store import VaultStore


@pytest.fixture
def setup(tmp_path):
    """Wire up all services with temp storage."""
    consent_store = ConsentStore(tmp_path / "consent" / "directives.jsonl")
    vault_store = VaultStore(tmp_path / "vault")
    audit_logger = AuditLogger(tmp_path / "audit" / "interactions.jsonl")
    policy_engine = PolicyEngine(consent_store)
    router = BiographyRouter(vault_store, consent_store, policy_engine, audit_logger)

    # Create a donor consent directive
    consent_store.create(ConsentDirective(
        donor_id="donor-1",
        donor_name="Marie Curie",
        modes=[ConsentMode.ARCHIVE],
        data_types=[DataType.TEXT],
        audience=AudienceScope.FAMILY_ONLY,
        authorized_family=["eve-1"],
    ))

    # Add some transcripts to the vault
    vault_store.store_transcript(
        donor_id="donor-1",
        question="What was your childhood like?",
        answer="I grew up in Warsaw, surrounded by books.",
        source_asset_id="asset-1",
    )
    vault_store.store_transcript(
        donor_id="donor-1",
        question="What is your favourite memory?",
        answer="Discovering radium with Pierre in our laboratory.",
        source_asset_id="asset-2",
    )

    return router, consent_store


def test_match_returns_answer(setup):
    router, _ = setup
    result = router.ask("donor-1", "Tell me about your childhood", "eve-1")
    assert result.allowed is True
    assert result.answer is not None
    assert "Warsaw" in result.answer


def test_no_match(setup):
    router, _ = setup
    result = router.ask("donor-1", "quantum physics equations", "eve-1")
    assert result.allowed is True
    assert result.answer is None


def test_consent_gate(setup):
    router, _ = setup
    # Unknown interactant (not in authorized_family)
    result = router.ask("donor-1", "childhood", "stranger-99")
    assert result.allowed is False
    assert result.refused is True


def test_red_line_blocks(setup):
    router, consent_store = setup
    # Add a directive with a red line
    consent_store.create(ConsentDirective(
        donor_id="donor-2",
        donor_name="Test Donor",
        modes=[ConsentMode.ARCHIVE],
        data_types=[DataType.TEXT],
        audience=AudienceScope.PUBLIC,
        red_lines=[RedLine(category="topic", description="politics", severity="hard")],
    ))
    result = router.ask("donor-2", "What do you think about politics", "anyone")
    assert result.allowed is False
    assert result.refused is True
    assert "Red line" in result.refusal_reason


def test_load_segments(setup):
    router, _ = setup
    segments = router.load_segments("donor-1")
    assert len(segments) == 2
    questions = {s.question_text for s in segments}
    assert "What was your childhood like?" in questions


def test_match_question_best_overlap(setup):
    router, _ = setup
    segments = router.load_segments("donor-1")
    match = router.match_question("favourite memory", segments)
    assert match is not None
    assert "radium" in match.answer_text
