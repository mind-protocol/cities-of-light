"""Cities of Light — FastAPI backend.

Services:
- /consent  — directive management, consent checks
- /vault    — encrypted media storage
- /audit    — interaction logging
- /policy   — access control + safety (coming)
- /rag      — retrieval + provenance (coming)
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .audit.logger import AuditLogger
from .consent.models import (
    AudienceScope,
    ConsentCheck,
    ConsentDirective,
    ConsentMode,
    DataType,
    DirectiveType,
    RedLine,
    Steward,
)
from .consent.store import ConsentStore
from .biography.router import BiographyRouter
from .models.donor import Donor
from .models.store import JSONLStore
from .policy.engine import PolicyEngine
from .vault.store import VaultStore

# ── Paths ─────────────────────────────────────────────────

DATA_DIR = Path(__file__).parent.parent / "data"
CONSENT_PATH = DATA_DIR / "consent" / "directives.jsonl"
VAULT_PATH = DATA_DIR / "vault"
AUDIT_PATH = DATA_DIR / "audit" / "interactions.jsonl"

# ── App ───────────────────────────────────────────────────

app = FastAPI(
    title="Cities of Light",
    description="Backend services for the Cities of Light VR universe",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Stores ────────────────────────────────────────────────

DONOR_PATH = DATA_DIR / "donors.jsonl"

consent_store = ConsentStore(CONSENT_PATH)
vault_store = VaultStore(VAULT_PATH)
audit_logger = AuditLogger(AUDIT_PATH)
donor_store = JSONLStore(DONOR_PATH, Donor)
policy_engine = PolicyEngine(consent_store)
biography_router = BiographyRouter(vault_store, consent_store, policy_engine, audit_logger)


# ── Health ────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "cities-of-light",
        "directives_count": len(consent_store.list_all()),
        "donors_count": len(donor_store.list_all()),
    }


# ── Consent endpoints ────────────────────────────────────


class CreateDirectiveRequest(BaseModel):
    donor_id: str
    donor_name: str
    directive_type: DirectiveType = DirectiveType.PARTICULAR
    modes: list[ConsentMode]
    data_types: list[DataType]
    audience: AudienceScope = AudienceScope.FAMILY_ONLY
    authorized_family: list[str] = []
    red_lines: list[RedLine] = []
    steward: Optional[Steward] = None
    auto_retire_months: Optional[int] = None
    digital_funeral_requested: bool = False


@app.post("/consent/directives")
def create_directive(req: CreateDirectiveRequest):
    """Create a new consent directive."""
    directive = ConsentDirective(**req.model_dump())
    created = consent_store.create(directive)
    return {"ok": True, "directive": created.model_dump()}


@app.get("/consent/directives/{directive_id}")
def get_directive(directive_id: str):
    """Get a specific directive."""
    d = consent_store.get(directive_id)
    if not d:
        raise HTTPException(404, "Directive not found")
    return d.model_dump()


@app.get("/consent/donors/{donor_id}/directives")
def get_donor_directives(donor_id: str):
    """Get all active directives for a donor."""
    directives = consent_store.get_for_donor(donor_id)
    return [d.model_dump() for d in directives]


@app.post("/consent/directives/{directive_id}/revoke")
def revoke_directive(directive_id: str, by: str = "donor"):
    """Revoke a consent directive."""
    d = consent_store.revoke(directive_id, by=by)
    if not d:
        raise HTTPException(404, "Directive not found")
    return {"ok": True, "revoked": True, "directive": d.model_dump()}


class ConsentCheckRequest(BaseModel):
    donor_id: str
    mode: ConsentMode
    interactant_id: Optional[str] = None


@app.post("/consent/check")
def check_consent(req: ConsentCheckRequest):
    """Check if an interaction is authorized.

    This is the critical gate — called before every interaction.
    """
    result = consent_store.check_consent(
        donor_id=req.donor_id,
        mode=req.mode,
        interactant_id=req.interactant_id,
    )
    return result.model_dump()


# ── Vault endpoints ──────────────────────────────────────

@app.get("/vault/{donor_id}/assets")
def list_assets(donor_id: str):
    """List all assets for a donor."""
    assets = vault_store.list_assets(donor_id)
    return [a.model_dump() for a in assets]


@app.get("/vault/{donor_id}/transcripts")
def list_transcripts(donor_id: str):
    """List all Q&A transcripts for a donor."""
    return vault_store.get_transcripts(donor_id)


# ── Audit endpoints ──────────────────────────────────────

@app.get("/audit/{donor_id}")
def get_audit_log(donor_id: str, limit: int = 100):
    """Get audit log entries for a donor."""
    entries = audit_logger.get_entries(donor_id=donor_id, limit=limit)
    return [e.model_dump() for e in entries]


# ── Donor endpoints ──────────────────────────────────────


class CreateDonorRequest(BaseModel):
    name: str
    date_of_birth: Optional[str] = None
    date_of_death: Optional[str] = None
    languages: list[str] = ["fr"]
    steward_id: Optional[str] = None
    metadata: dict = {}


@app.post("/donors")
def create_donor(req: CreateDonorRequest):
    """Register a new data donor."""
    donor = Donor(**req.model_dump())
    created = donor_store.create(donor)
    return {"ok": True, "donor": created.model_dump()}


@app.get("/donors")
def list_donors():
    """List all registered donors."""
    return [d.model_dump() for d in donor_store.list_all()]


@app.get("/donors/{donor_id}")
def get_donor(donor_id: str):
    """Get a specific donor."""
    d = donor_store.get(donor_id)
    if not d:
        raise HTTPException(404, "Donor not found")
    return d.model_dump()


@app.post("/donors/{donor_id}/consent")
def create_donor_consent(donor_id: str, req: CreateDirectiveRequest):
    """Convenience: create a consent directive for a specific donor."""
    donor = donor_store.get(donor_id)
    if not donor:
        raise HTTPException(404, "Donor not found")
    directive = ConsentDirective(donor_id=donor_id, **req.model_dump(exclude={"donor_id"}))
    created = consent_store.create(directive)
    return {"ok": True, "directive": created.model_dump()}


# ── Biography endpoints (Mode A) ─────────────────────────


@app.get("/donors/{donor_id}/biography")
def query_biography(donor_id: str, q: str = "", interactant_id: str = "anonymous"):
    """Mode A: query a donor's archived biography."""
    donor = donor_store.get(donor_id)
    if not donor:
        raise HTTPException(404, "Donor not found")
    if not q:
        raise HTTPException(400, "Query parameter 'q' is required")
    result = biography_router.ask(donor_id, q, interactant_id)
    return result.to_dict()
