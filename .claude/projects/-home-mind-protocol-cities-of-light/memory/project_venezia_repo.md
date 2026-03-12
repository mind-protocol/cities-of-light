---
name: Venezia World Repo — Separate from Serenissima
description: Venezia gets its own world repo (not added to Serenissima). Serenissima remains the citizen simulation engine, Venezia is the world definition for Cities of Light.
type: project
---

Decided 2026-03-12: Venezia is a NEW repo, separate from Serenissima.

**Why separate from Serenissima:**
- Serenissima is a citizen simulation engine (economy, AI, Airtable, KinOS). It runs 24/7 independently.
- Venezia is a world definition (terrain, zones, prompts, graph seeds, manifest). It's consumed by Cities of Light.
- Mixing them conflates "the citizens" with "the world they inhabit." Citizens could inhabit a different world; a world could host different citizens.

**Venezia repo will contain:**
- `world-manifest.json` — engine contract
- `citizens/` — CLAUDE.md prompts, voice configs, .cascade/ memories (or symlinks to serenissima)
- `lore/` — Venice history, social classes, districts
- `economy/` — rules, resources, governance config
- `physics/` — graph seeds, constants, event templates
- `prompts/` — base templates
- `assets/` — terrain config, sounds, textures

**How to apply:** When creating the venezia repo, ensure it references Serenissima for citizen data (Airtable sync) but owns the world definition independently.
