"""Tests for consent directive management."""

import tempfile
from pathlib import Path

import pytest

from services.consent.models import (
    AudienceScope,
    ConsentDirective,
    ConsentMode,
    DataType,
    RedLine,
)
from services.consent.store import ConsentStore


@pytest.fixture
def store(tmp_path):
    return ConsentStore(tmp_path / "directives.jsonl")


def _make_directive(**overrides):
    defaults = dict(
        donor_id="donor-1",
        donor_name="Marie Curie",
        modes=[ConsentMode.ARCHIVE],
        data_types=[DataType.TEXT, DataType.VOICE],
        audience=AudienceScope.FAMILY_ONLY,
        authorized_family=["eve-1"],
    )
    defaults.update(overrides)
    return ConsentDirective(**defaults)


def test_create_and_get(store):
    d = _make_directive()
    created = store.create(d)
    assert created.id == d.id
    assert store.get(d.id) is not None
    assert store.get(d.id).donor_name == "Marie Curie"


def test_consent_allowed(store):
    store.create(_make_directive())
    result = store.check_consent("donor-1", ConsentMode.ARCHIVE, interactant_id="eve-1")
    assert result.allowed is True


def test_consent_denied_no_directive(store):
    result = store.check_consent("donor-999", ConsentMode.ARCHIVE)
    assert result.allowed is False
    assert "No active" in result.reason


def test_consent_denied_wrong_mode(store):
    store.create(_make_directive(modes=[ConsentMode.ARCHIVE]))
    result = store.check_consent("donor-1", ConsentMode.SIMULATION_AGENT, interactant_id="eve-1")
    assert result.allowed is False


def test_revoke(store):
    d = _make_directive()
    store.create(d)
    revoked = store.revoke(d.id, by="donor")
    assert revoked.revoked is True
    # After revoke, consent check should fail
    result = store.check_consent("donor-1", ConsentMode.ARCHIVE, interactant_id="eve-1")
    assert result.allowed is False


def test_red_lines_returned(store):
    rl = RedLine(category="topic", description="politics", severity="hard")
    store.create(_make_directive(red_lines=[rl]))
    result = store.check_consent("donor-1", ConsentMode.ARCHIVE, interactant_id="eve-1")
    assert result.allowed is True
    assert len(result.red_lines) == 1
    assert result.red_lines[0].description == "politics"
