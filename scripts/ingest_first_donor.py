#!/usr/bin/env python3
"""Ingest Nicolas as the first donor with personal video memories + origin PDF."""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.consent.models import (
    AudienceScope,
    ConsentDirective,
    ConsentMode,
    DataType,
    RedLine,
)
from services.consent.store import ConsentStore
from services.models.donor import Donor
from services.models.store import JSONLStore
from services.vault.store import VaultStore

# ── Paths ────────────────────────────────────────────────
DATA_DIR = Path(__file__).parent.parent / "data"
DONOR_PATH = DATA_DIR / "donors.jsonl"
CONSENT_PATH = DATA_DIR / "consent" / "directives.jsonl"
VAULT_PATH = DATA_DIR / "vault"

# ── Stores ───────────────────────────────────────────────
donor_store = JSONLStore(DONOR_PATH, Donor)
consent_store = ConsentStore(CONSENT_PATH)
vault_store = VaultStore(VAULT_PATH)

# ── Nicolas: first donor ─────────────────────────────────
DONOR_ID = "nicolas-reynolds"

existing = donor_store.get(DONOR_ID)
if existing:
    print(f"Donor {DONOR_ID} already exists, skipping creation.")
    donor = existing
else:
    donor = Donor(
        id=DONOR_ID,
        name="Nicolas Reynolds",
        date_of_birth="1987-07-21",
        languages=["fr", "en", "ru"],
        metadata={
            "aliases": ["Lester", "NLR"],
            "origin_project": "The Floating Cities of Light (2022)",
            "role": "Founder, Artist",
        },
    )
    donor_store.create(donor)
    print(f"Created donor: {donor.name} ({donor.id})")

# ── Consent directive ────────────────────────────────────
existing_directives = consent_store.get_for_donor(DONOR_ID)
if existing_directives:
    print(f"Consent directive already exists for {DONOR_ID}, skipping.")
else:
    directive = ConsentDirective(
        donor_id=DONOR_ID,
        donor_name="Nicolas Reynolds",
        modes=[ConsentMode.ARCHIVE, ConsentMode.CONSTRAINED_AVATAR],
        data_types=[DataType.VIDEO, DataType.VOICE, DataType.TEXT, DataType.PHOTOS],
        audience=AudienceScope.FAMILY_ONLY,
        authorized_family=["aurore", "family"],
        red_lines=[
            RedLine(category="tone", description="mockery of the deceased", severity="hard"),
        ],
    )
    consent_store.create(directive)
    print(f"Created consent directive: modes={[m.value for m in directive.modes]}")

# ── Media files ──────────────────────────────────────────
VIDEOS = [
    ("/mnt/c/Users/reyno/Videos/Here Comes The Sun.mp4", {
        "title": "Here Comes The Sun",
        "description": "Personal moment — sunlight",
        "duration_sec": 59.9,
    }),
    ("/mnt/c/Users/reyno/Videos/Penfret.mp4", {
        "title": "Penfret",
        "description": "Island of Penfret, Glenan archipelago, Brittany",
        "duration_sec": 115.4,
    }),
    ("/mnt/c/Users/reyno/Videos/Belaya noyche.mp4", {
        "title": "Belaya Noyche",
        "description": "White Night (Белая ночь) — St. Petersburg or memory of Russia",
        "duration_sec": 8.4,
    }),
    ("/mnt/c/Users/reyno/Videos/Cha & Hub sur les Berges du Rhône.mp4", {
        "title": "Cha & Hub sur les Berges du Rhône",
        "description": "Charlotte & Hubert on the banks of the Rhône, Lyon",
        "duration_sec": 76.1,
    }),
    ("/mnt/c/Users/reyno/Videos/Tour Eiffeil.mp4", {
        "title": "Tour Eiffel",
        "description": "Eiffel Tower moment, Paris",
        "duration_sec": 33.0,
    }),
    ("/mnt/c/Users/reyno/Videos/Defacing Banksy.mp4", {
        "title": "Defacing Banksy",
        "description": "Street art encounter — Banksy piece",
        "duration_sec": 48.5,
    }),
]

PDF = (
    "/mnt/c/Users/reyno/OneDrive/Images/The floating cities of light - A new city in the Metaverse.pdf",
    {
        "title": "The Floating Cities of Light — A new city in the Metaverse",
        "description": "Original 2022 pitch deck. Team: Lester (Nicolas), Ken Maguire, Paul C. Clarke, Bassel Tabet, Lifetime High. 17 pages.",
        "type": "origin_document",
        "pages": 17,
    },
)

print(f"\n--- Ingesting media for {DONOR_ID} ---")

# Ingest videos
for video_path, meta in VIDEOS:
    p = Path(video_path)
    if not p.exists():
        print(f"  SKIP (not found): {p.name}")
        continue
    asset = vault_store.store_file(DONOR_ID, p, asset_type="video", metadata=meta)
    print(f"  VIDEO: {meta['title']} ({meta['duration_sec']}s) → {asset.id}")

# Ingest PDF
pdf_path = Path(PDF[0])
if pdf_path.exists():
    asset = vault_store.store_file(DONOR_ID, pdf_path, asset_type="document", metadata=PDF[1])
    print(f"  PDF:   {PDF[1]['title']} → {asset.id}")
else:
    print(f"  SKIP (not found): {pdf_path.name}")

# ── Summary ──────────────────────────────────────────────
assets = vault_store.list_assets(DONOR_ID)
print(f"\nDone. Vault for {DONOR_ID}: {len(assets)} assets")
for a in assets:
    print(f"  [{a.asset_type}] {a.filename} ({a.size_bytes} bytes) sha256={a.sha256[:12]}...")
