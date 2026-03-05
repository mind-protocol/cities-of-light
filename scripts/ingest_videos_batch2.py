#!/usr/bin/env python3
"""Ingest batch 2 of Nicolas's video memories into the vault.

Skips files already present (by filename match in manifest).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.vault.store import VaultStore

DATA_DIR = Path(__file__).parent.parent / "data"
VAULT_PATH = DATA_DIR / "vault"
vault_store = VaultStore(VAULT_PATH)

DONOR_ID = "nicolas-reynolds"

# Check what's already in the vault
existing = vault_store.list_assets(DONOR_ID)
existing_filenames = {a.filename for a in existing}
print(f"Vault already has {len(existing_filenames)} assets for {DONOR_ID}")

# All 29 videos Nicolas shared (some overlap with batch 1)
VIDEOS = [
    ("Memorial to the Tiananmen Massacre - Made in Virtual Reality.mp4", {
        "title": "Memorial to the Tiananmen Massacre",
        "description": "VR memorial sculpture for the Tiananmen Square massacre. Political art in virtual reality.",
    }),
    ("Here is the story of how we are using #AugmentedReality against #censorship & government oppress.mp4", {
        "title": "AR Against Censorship",
        "description": "Using augmented reality as a tool against censorship and government oppression. Documentary.",
    }),
    ("Cha & Hub sur les Berges du Rhône.mp4", {
        "title": "Cha & Hub sur les Berges du Rhône",
        "description": "Charlotte & Hubert on the banks of the Rhône, Lyon",
    }),
    ("Tour Eiffeil.mp4", {
        "title": "Tour Eiffel",
        "description": "Eiffel Tower moment, Paris",
    }),
    ("Defacing Banksy.mp4", {
        "title": "Defacing Banksy",
        "description": "Street art encounter — Banksy piece",
    }),
    ("Here Comes The Sun.mp4", {
        "title": "Here Comes The Sun",
        "description": "Personal moment — sunlight",
    }),
    ("Penfret.mp4", {
        "title": "Penfret",
        "description": "Island of Penfret, Glenan archipelago, Brittany",
    }),
    ("Citizens of Light - Framed paintings.mp4", {
        "title": "Citizens of Light — Framed Paintings",
        "description": "Framed 3D paintings exhibited as Citizens of Light. Digital art showcase.",
    }),
    ("Framed paintings for the Metaverse.mp4", {
        "title": "Framed Paintings for the Metaverse",
        "description": "Creating framed digital paintings for metaverse exhibition spaces.",
    }),
    ("The Universal Exposition of Augmented Reality, soon in Paris.mp4", {
        "title": "Universal Exposition of Augmented Reality",
        "description": "Preview of an augmented reality exposition planned for Paris.",
    }),
    ("Augmented Reality Art - Couple.mp4", {
        "title": "Augmented Reality Art — Couple",
        "description": "AR art piece featuring a couple. Mixed reality creation.",
    }),
    ("From Europe to Asia_ Painting Venice.mp4", {
        "title": "From Europe to Asia: Painting Venice",
        "description": "Digital painting journey from Europe to Asia, featuring Venice.",
    }),
    ("We are building a city in the Metaverse_ our vision.mp4", {
        "title": "Building a City in the Metaverse — Our Vision",
        "description": "Manifesto video for the Cities of Light metaverse project. Vision statement.",
    }),
    ("1 000 000 $ to build a City in the Metaverse!.mp4", {
        "title": "$1,000,000 to Build a City in the Metaverse",
        "description": "Fundraising pitch and ambition — building Cities of Light.",
    }),
    ("I pitched my startup in the Metaverse - to Shark Tank Judges!.mp4", {
        "title": "Pitched My Startup in the Metaverse — Shark Tank",
        "description": "Pitching Cities of Light / OVR to Shark Tank judges inside VR.",
    }),
    ("Paiting in VR - On rollerblades!.mp4", {
        "title": "Painting in VR on Rollerblades",
        "description": "VR painting session while rollerblading. Physical + digital art fusion.",
    }),
    ("Travelling across Russia in winter -- to make digital sculptures.mp4", {
        "title": "Travelling Across Russia — Digital Sculptures",
        "description": "Winter journey across Russia creating digital sculptures. Art + travel.",
    }),
    ("The Metaversal Exposition - Builders update 1.mp4", {
        "title": "Metaversal Exposition — Builders Update 1",
        "description": "First builders update for the Metaversal Exposition project.",
    }),
    ("Zero Gravity - 3D Sculpture.mp4", {
        "title": "Zero Gravity — 3D Sculpture",
        "description": "3D sculpture inspired by zero gravity. Digital art piece.",
    }),
    ("Closer - Rone.mp4", {
        "title": "Closer — Rone",
        "description": "Art piece inspired by or featuring Rone's work. Digital/VR creation.",
    }),
    ("Making Augmented Reality Avatars - Metaverse.mp4", {
        "title": "Making AR Avatars for the Metaverse",
        "description": "Process of creating augmented reality avatars for metaverse use.",
    }),
    ("Framed 3D Paintings in Spatial.io.mp4", {
        "title": "Framed 3D Paintings in Spatial.io",
        "description": "Exhibiting framed 3D paintings in the Spatial.io metaverse platform.",
    }),
    ("AR Capture of the Pillar of Shame statue - Augmented Reality in Hong Kong.mp4", {
        "title": "AR Capture of the Pillar of Shame — Hong Kong",
        "description": "Augmented reality preservation of the Pillar of Shame statue. Political art, digital preservation of censored monument.",
    }),
    ("My VR Desktop setup.mp4", {
        "title": "My VR Desktop Setup",
        "description": "Personal VR workspace and desktop configuration. Behind the scenes.",
    }),
    ("Painting Mountains - In Augmented Reality.mp4", {
        "title": "Painting Mountains in Augmented Reality",
        "description": "AR painting session — mountain landscapes in mixed reality.",
    }),
    ("Phuket's beach golden Temple.mp4", {
        "title": "Phuket Beach Golden Temple",
        "description": "Digital art at Phuket beach golden temple. Travel + creation.",
    }),
    ("Augmented Reality statue on the Ponts des Arts - Paris.mp4", {
        "title": "AR Statue on Pont des Arts — Paris",
        "description": "Augmented reality sculpture placed on the Pont des Arts bridge, Paris.",
    }),
    ("Making Digital sculptures - in a Church (Virtual Reality).mp4", {
        "title": "Digital Sculptures in a Church — VR",
        "description": "Creating digital sculptures inside a church using virtual reality.",
    }),
    ("OVR - Display avatars! (Import 3D assets from Sketchfab using the Builder).mp4", {
        "title": "OVR — Display Avatars from Sketchfab",
        "description": "Tutorial/demo: importing 3D assets from Sketchfab into OVR Builder.",
    }),
    ("Penfret - Lester paints the world.mp4", {
        "title": "Penfret — Lester Paints the World",
        "description": "Extended Penfret piece — Lester (Nicolas) painting the world. Island art creation.",
    }),
]

SRC_DIR = Path("/mnt/c/Users/reyno/Videos")

ingested = 0
skipped_exists = 0
skipped_missing = 0

for filename, meta in VIDEOS:
    if filename in existing_filenames:
        print(f"  SKIP (exists): {filename}")
        skipped_exists += 1
        continue

    src = SRC_DIR / filename
    if not src.exists():
        print(f"  SKIP (not found): {filename}")
        skipped_missing += 1
        continue

    size_mb = src.stat().st_size / (1024 * 1024)
    asset = vault_store.store_file(DONOR_ID, src, asset_type="video", metadata=meta)
    print(f"  INGESTED: {meta['title']} ({size_mb:.1f} MB) -> {asset.id}")
    ingested += 1

# Summary
total = vault_store.list_assets(DONOR_ID)
print(f"\n--- Summary ---")
print(f"Ingested: {ingested} new videos")
print(f"Skipped (already in vault): {skipped_exists}")
print(f"Skipped (file not found): {skipped_missing}")
print(f"Total vault assets: {len(total)}")
