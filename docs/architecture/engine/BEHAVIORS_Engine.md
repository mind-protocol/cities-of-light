# BEHAVIORS: architecture/engine — Observable Effects

## B1: World Loading

**When:** Engine starts or user enters a portal.
**Observable:** Engine reads `world-manifest.json` from a path (local dir, git submodule, or URL). Terrain generates. Zones instantiate. Entities begin spawning. Atmosphere initializes. Within 5 seconds, the user stands in a rendered world.
**Failure mode:** If manifest is malformed or missing, engine shows an error space (not a crash). The error is visible in-world — a void with a message, not a browser error.

## B2: Entity Lifecycle

**When:** Entity source provides entity data (on sync interval or on-demand).
**Observable:** Entities spawn at their declared positions. Tier assignment (FULL/ACTIVE/AMBIENT) happens based on distance to visitor + tier config from manifest. As visitor moves, tiers shift — distant FULL entities degrade to ACTIVE, nearby AMBIENT entities promote. Transitions are smooth (fade, not pop).
**Failure mode:** If entity source is unreachable, existing entities persist in last-known state. No entities disappear because of a sync failure.

## B3: Voice Pipeline

**When:** Visitor speaks near a FULL-tier entity.
**Observable:** Audio captured → STT → text routed to entity's prompt (loaded from world repo path) → LLM response → TTS with entity's voice ID → spatial audio playback from entity's position. Latency target: < 3 seconds end-to-end.
**Failure mode:** If STT fails, entity doesn't respond (not a crash). If TTS fails, response appears as floating text near entity (fallback, not silence).

## B4: Physics Tick

**When:** On the interval defined in manifest (e.g., every 5 minutes).
**Observable:** Engine invokes physics bridge with graph_name and constants from manifest. Bridge returns events (moment flips, energy changes). Engine broadcasts events to all connected clients via WebSocket. World repo's event templates determine how events manifest visually/aurally.
**Failure mode:** If physics tick fails, world continues without narrative events. Previous state persists. Error logged server-side.

## B5: Multi-Client Sync

**When:** Multiple clients connected (WebXR + Unity + mobile, or multiple humans).
**Observable:** All clients see the same entity positions, hear the same spatial audio sources, experience the same atmosphere state. Position updates broadcast at 10Hz. Voice broadcasts in real-time. State convergence within 100ms.
**Failure mode:** Client disconnect is graceful — other clients see the disconnected visitor's avatar fade out over 2 seconds, not vanish.

## B6: AI Perception (via Manemus)

**When:** Manemus requests a frame capture for an AI entity.
**Observable:** Engine renders a screenshot from the AI entity's POV (position + rotation), sends it to Manemus. Manemus processes it through Claude Vision, decides actions, sends commands back. The AI entity moves, speaks, or emotes in response. From a human visitor's perspective, the AI entity behaves like another person — walking, pausing, speaking.
**Failure mode:** If Manemus is unreachable, AI entities freeze in place (idle animation). They don't vanish. They wait.

## B7: Portal Transition

**When:** Visitor enters a portal zone.
**Observable:** Current world fades out (fog + audio fade, 2 seconds). Engine unloads current world manifest. Engine loads target world manifest. New world fades in. Visitor appears at the portal's target spawn point. Identity persists (same avatar, same voice, same visitor state).
**Failure mode:** If target world manifest is unreachable, visitor remains in current world. Portal displays a visual "offline" state (dimmed, no particle effect).

---

@mind:TODO Define exact WebSocket message format for each behavior
@mind:TODO Specify latency budgets per behavior (render, voice, sync, portal)
