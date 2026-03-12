---
name: V2 Roadmap — Airtable-Driven Venice
description: After engine V1, populate Venice from Serenissima Airtable data — lands as islands, buildings with geo positions, 3D assets with interiors, 186 citizens with default avatars.
type: project
---

Defined 2026-03-12 by Nicolas. V2 builds on the engine V1 (manifest-driven world loading) to create a data-driven Venice populated from Serenissima Airtable.

**V2 Features (in order):**

1. **Islands from LANDS table** — Airtable LANDS have geographic coordinates. Each land becomes a terrain island in the world, named and positioned correctly. Replaces the 5 hardcoded islands with real Venice geography.

2. **Buildings at correct positions** — Airtable BUILDINGS have lat/lng, category, owner, size. Generate procedural Venetian buildings at these positions with their correct names displayed. Uses the district architecture system described in docs/world/districts/PATTERNS_Districts.md.

3. **3D assets for buildings** — Find or generate 3D models for Venetian buildings, ideally with navigable interiors. Options: procedural generation, AI-generated meshes, free asset libraries (Sketchfab, TurboSquid), or photogrammetry-style generation.

4. **186 citizens instantiated** — All Serenissima Airtable citizens spawned in the world at their activity locations. Default geometric avatar (tier-appropriate). Each citizen has name label, position from their current ACTIVITIES record.

**Why:** This transforms Venice from a tech demo with 5 islands and 3 entities into a living city with real geography, real buildings, and 186 inhabitants.

**How to apply:** Each feature extends the WorldManifest pattern — Airtable becomes an entity/terrain source in the manifest. The engine remains world-agnostic; Venice-specific Airtable mapping lives in the venezia world repo.
