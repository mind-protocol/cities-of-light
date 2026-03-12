# VALIDATION: architecture/engine — Invariants

## I1: Engine Contains Zero World-Specific Content

No file in `engine/` or `src/` may contain:
- Citizen names, personalities, or prompts
- Venice district names, lore, or history
- Economic rules, resource types, or governance logic
- Hardcoded zone coordinates tied to a specific world
- Hardcoded FalkorDB graph names

**Test:** `grep -r "venezia\|serenissima\|venice\|ducats\|nobili\|rialto\|dorsoduro" engine/ src/` returns zero matches (excluding comments referencing this invariant).

**Why:** If world-specific content leaks into the engine, it stops being reusable. This is the fundamental architectural invariant.

## I2: WorldManifest Is the Single Point of Configuration

Every world-specific parameter enters the engine through the manifest. There are no environment variables, config files, or hardcoded defaults that bypass the manifest for world content.

**Test:** Engine starts with ONLY a manifest path as input. No world-specific env vars required.

**Exception:** API keys (ANTHROPIC_API_KEY, ELEVENLABS_API_KEY) are engine-level config, not world-specific. They go in `.env`, not in the manifest.

## I3: Entity Tier Budget Is Respected

At no point does the engine render more FULL-tier entities than `tier_config.FULL.max` or more ACTIVE-tier entities than `tier_config.ACTIVE.max`.

**Test:** `entity_manager.count_by_tier()` never exceeds manifest limits. Assertion runs every frame.

## I4: Physics Bridge Is Optional

The engine runs without a physics engine. If `manifest.physics.engine == "none"`, no physics tick occurs, no graph is queried, no events are generated. The world is static but navigable.

**Test:** Load a manifest with `"engine": "none"`. World renders, entities spawn, voice works. No errors.

## I5: Manemus Is Optional

The engine runs without Manemus. If Manemus is unreachable:
- AI entities exist but don't act (idle animation)
- No frame captures are sent
- No AI actions are received
- Human visitors navigate and interact with FULL-tier entities via voice pipeline (using prompts from world repo directly)

**Test:** Start engine with Manemus endpoint unreachable. World runs. No crashes. AI entities visible but idle.

## I6: Client Protocol Is Stable

The WebSocket message format does not change between engine versions without a protocol version bump. Clients negotiate protocol version on connect. Old clients gracefully degrade on new servers.

**Test:** Connect a client speaking protocol v1 to a server speaking v2. Client receives only v1 messages. No crashes.

## I7: Portal Transitions Preserve Identity

When a visitor transitions through a portal, their identity (avatar, visitor state, relationship history) persists. The visitor is the same person in Venice as in Contre-Terre.

**Test:** Enter world A, establish visitor state. Portal to world B. Portal back to A. Visitor state is identical.

---

@mind:TODO Write automated tests for I1 (grep-based CI check)
@mind:TODO Define WorldManifest JSON Schema for I2 validation
@mind:TODO Define WebSocket protocol version format for I6
