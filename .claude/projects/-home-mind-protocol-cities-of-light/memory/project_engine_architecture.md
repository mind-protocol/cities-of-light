---
name: Engine Architecture — Three-Repo Pattern
description: Cities of Light is a reusable XR engine. Blood Ledger dependency removed. Three concerns: engine (cities-of-light), AI substrate (manemus), world data (per-world repos). Venezia is first world.
type: project
---

Decided 2026-03-12: Cities of Light becomes a reusable multi-world XR engine.

**Three-repo pattern:**
- **Cities of Light** = engine (rendering, navigation, voice, networking)
- **Manemus** = AI substrate (how AIs perceive and act in worlds)
- **World repos** = universe-specific data (citizens, lore, economy, physics config)

**Key decisions:**
- Blood Ledger dependency **completely removed** — ngram physics stays as standalone dep, but BL repo/agents (Narrator, WorldBuilder, WorldRunner) are gone
- Engine uses "entity" not "citizen" (world-agnostic)
- WorldManifest JSON is the contract between engine and world repos
- Lumina Prime is the hub world with portals to other worlds
- App name: "Cities of Light" (plural = multiple worlds). Lumina Prime is one city.
- Venezia is the first world to implement

**Why:** Reusability enables N worlds (Venezia, Contre-Terre, etc.) without rebuilding the engine each time.

**How to apply:** All engine code must be world-agnostic. Venice-specific content goes in the Venezia world repo, not in src/engine/. Check invariant I1 in VALIDATION_Engine.md.
