# HEALTH: architecture/engine — Runtime Verification

## H1: Manifest Loaded

**Signal:** `engine.manifest != null && engine.manifest.name != ""`
**Check:** On startup and after each portal transition.
**Healthy:** Manifest parsed, validated against schema, all required fields present.
**Degraded:** Manifest loaded but optional fields missing (physics, AI config).
**Critical:** No manifest loaded or schema validation failed.

## H2: Entity Source Connected

**Signal:** `entity_manager.source_connected == true`
**Check:** Every sync interval (default 15 minutes).
**Healthy:** Last sync succeeded, entities populated.
**Degraded:** Last sync failed, using cached entities from previous sync.
**Critical:** No entities ever loaded (first sync failed).

## H3: Voice Pipeline Operational

**Signal:** `voice_pipeline.stt_ok && voice_pipeline.tts_ok`
**Check:** On first voice interaction, then every 5 minutes.
**Healthy:** STT and TTS respond within latency budget.
**Degraded:** One of STT/TTS failing (text fallback active).
**Critical:** Both STT and TTS unavailable.

## H4: Physics Bridge Ticking

**Signal:** `physics_bridge.last_tick_age < 2 * tick_interval`
**Check:** Continuously.
**Healthy:** Ticks complete on schedule.
**Degraded:** Tick took longer than interval (falling behind).
**Critical:** No tick in 2x interval (bridge may be dead).
**N/A:** When `manifest.physics.engine == "none"`.

## H5: Manemus Connection

**Signal:** `ai_gateway.connected == true`
**Check:** Every 30 seconds (heartbeat).
**Healthy:** Bidirectional communication active, AI entities acting.
**Degraded:** Connection lost, AI entities in idle state, reconnecting.
**Critical:** N/A — Manemus is optional (I5). Degraded is the worst state.

## H6: World-Specific Content Leak

**Signal:** `grep_engine_for_world_terms() == 0`
**Check:** CI/CD pipeline, pre-commit hook.
**Healthy:** Zero matches for world-specific terms in engine code.
**Critical:** Any match means I1 invariant violated.

---

@mind:TODO Implement health dashboard endpoint: GET /health returning all signals
@mind:TODO Wire H6 into CI pipeline
