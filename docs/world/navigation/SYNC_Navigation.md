# SYNC: world/navigation — Current State

Last updated: 2026-03-11

---

## Status: NOT BUILT

No Venice-specific navigation exists. The current Cities of Light codebase has basic WebXR locomotion (continuous thumbstick, snap turn, grab) and desktop pointer lock, designed for open island terrain. Venice navigation — collision, canal boundaries, district transitions, gondola transport, teleport — must be built on top of the existing VR controls.

---

## What Exists Now

### VR Controls (current, working)

- `src/client/vr-controls.js` — `VRControls` class. Handles:
  - **Continuous locomotion** — left thumbstick moves the dolly group in the headset's forward direction. Speed: 3.0 m/s (hardcoded, needs adjustment to 2.5 m/s for Venice).
  - **Snap turn** — right thumbstick, 30-degree increments. Dead zone at 0.3, trigger at 0.6. Works correctly.
  - **Grab** — grip button (controllers) and pinch (hand tracking). Nearest grabbable within 1.5m range. Object follows source position and rotation.
  - **Hand tracking** — XRHandModelFactory with spheres model. Pinch detection at 3cm threshold. 25 joint names exported for network sync.
  - **Push-to-talk** — A button (right controller, `buttons[4]`). Fires `onPushToTalkStart` / `onPushToTalkEnd` callbacks.
  - **Dolly rig** — `THREE.Group` containing the camera. All locomotion moves the dolly. Standard pattern for WebXR room-scale.
  - **Gamepad axis handling** — auto-detects 2-axis vs 4-axis layouts. Fallback from axes[2,3] to axes[0,1] if primary is dead.

### Desktop Controls (current, minimal)

- `src/client/main.js` — pointer lock on canvas click. WASD key event listeners (assumed, standard pattern). Camera rotation via mouse delta. Not encapsulated in a class; inline in the main loop.

### Zone Detection (current, working)

- `src/shared/zones.js` — `detectNearestZone(pos)` returns `{ zone, distance }`. Used by `ZoneAmbient` for ambient transitions.
- `src/client/zone-ambient.js` — `onZoneChanged(oldZone, newZone)` callback fires on zone change. Currently used for fog/light/particle transitions. Navigation district transitions should hook into this or a parallel detection system.

### Relevant Patterns (reusable for Venice navigation)

| Existing | Reuse For |
|---|---|
| `VRControls` dolly rig | All VR locomotion moves the dolly. Teleport = reposition dolly. |
| `_locomotion()` method | Continuous movement. Add collision check after position update. |
| `_snapTurn()` method | Keep as-is. 30-degree snap turn is correct for Venice. |
| Grab system | Gondola boarding could reuse trigger-volume detection pattern. |
| Push-to-talk (A button) | Conflicts with teleport activation. Need to resolve input mapping. |
| `detectNearestZone()` | District boundary detection for transitions. Extend with hysteresis. |
| `onZoneChanged` callback | Trigger fog gates and audio crossfade on district transition. |
| Pointer lock (desktop) | Keep. Add WASD speed normalization and collision. |
| Quest 3 detection (`_isQuest`) | Disable run mode in VR. Reduce teleport arc segments on Quest 3. |

### What Does NOT Exist

- Teleport system (arc rendering, landing validation, comfort fade)
- Collision detection against fondamenta/bridge/piazza geometry
- Canal edge clamping (prevent walking on water)
- Fall recovery (reset to valid surface)
- District transition fog gates
- District transition audio crossfade (callback exists, no fog gate implementation)
- Transition hysteresis (prevent flickering at boundaries)
- Gondola system (docks, boarding, spline following, disembark)
- Gondola mesh (hull, pole, gondolier silhouette)
- Gondola canal spline routes
- Desktop run mode (Shift key)
- Desktop `DesktopControls` class (currently inline)
- VR comfort vignette (peripheral darkening during movement)
- Movement speed adjustment from 3.0 to 2.5 m/s
- `src/client/venice/transitions.js` (planned, does not exist)
- Collision geometry from district generator (depends on `world/districts`)

---

## Dependencies (What Must Exist Before Navigation Can Work)

### Hard Dependencies (blocks Venice navigation)

1. **Collision geometry** (`world/districts`) — Without walkable surface meshes (fondamenta, bridges, piazzas), collision detection has nothing to test against. Navigation falls back to a flat plane at y=0. Sufficient for testing locomotion and teleport but not for canal boundaries or bridge elevation.

2. **District boundaries** (`src/shared/districts.js`) — Without district boundary polygons, district transitions have no trigger. Navigation works as open-world movement without transition effects.

### Soft Dependencies (navigation works without these, but is incomplete)

3. **Atmosphere system** (`world/atmosphere`) — Fog gates on district transition require the atmosphere system to modulate fog density. Without it, transitions are audio-only (which is acceptable for POC).

4. **Spatial audio** (`voice/spatial`) — Audio crossfade on district transition requires the ambient audio system. Without it, transitions are visual-only. The `onZoneChanged` callback pattern is ready; the audio layer is not.

5. **Gondola mesh** — Gondola boarding requires a visible gondola at the dock. Can be a placeholder box mesh for testing. Final gondola model is a separate art task.

6. **Canal splines** (`world/districts`) — Gondola routes need authored spline paths along canals. Without them, gondolas have nowhere to go. Gondola transport is blocked until canal geometry exists.

---

## Build Order

### Step 1: Movement Speed + Desktop Controls Class
- Reduce `VRControls.moveSpeed` from 3.0 to 2.5 m/s.
- Extract desktop controls from `main.js` into `DesktopControls` class: WASD (normalized), mouse look, Shift to run (3.75 m/s).
- Both classes expose: `update(delta)`, `getPosition()`, `setPosition(vec3)`.

### Step 2: Collision System (Flat Plane Prototype)
- `CollisionSystem` class in `src/client/venice/collision.js`. Exposes `clampPosition(currentPos, proposedPos) => validPos`.
- Downward raycast from proposed position. Hit within 2m = accept. No hit = clamp to last valid position.
- Prototype with flat plane + rectangular canal cutouts. Wire into both `VRControls` and `DesktopControls` post-move.

### Step 3: VR Teleport
- Parabolic arc (20 segments, `THREE.Line`). Blue = valid landing, red = invalid.
- On trigger press: fade to black (200ms), reposition dolly, fade in (200ms). 300ms cooldown.
- Teleport on right trigger; push-to-talk stays on A button.

### Step 4: District Transitions
- `DistrictTransition` class in `src/client/venice/transitions.js`.
- Fog gate: 3x fog density for 3 seconds at boundary crossing. Hysteresis: 10m penetration required before reverse transition.
- Audio crossfade via registered callbacks.

### Step 5: Comfort Vignette
- Full-screen quad with radial gradient, parented to camera. Fades to 30% edge opacity during continuous locomotion. VR only.

### Step 6: Gondola System
- `GondolaSystem` class in `src/client/venice/gondola.js`. Docks (trigger volumes), placeholder gondola mesh, `CatmullRomCurve3` spline routes.
- Board via E (desktop) or trigger (VR). Camera parents to gondola. Spline follow at 4 m/s. Auto-disembark at destination.

### Step 7: Integration
- Wire to real district geometry, boundaries, and canal splines when `world/districts` is built.
- Profile on Quest 3: navigation systems must cost < 0.3ms/frame total.

---

## Open Questions

### Q1: Teleport button vs. push-to-talk conflict
A button is currently push-to-talk. Teleport needs a dedicated input. Recommendation: right trigger for teleport (standard VR convention), PTT stays on A. Trigger is currently unused.

### Q2: Should the visitor be able to fall into canals?
Recommendation: clamp for V1. No splash, no respawn logic. The fondamenta edge IS the world. Falling-in as a teaching moment is a V2 option.

### Q3: VR gondola boarding input
Desktop uses E key. In VR, recommendation: trigger press while standing in dock trigger volume. Unambiguous, consistent with teleport input model.

### Q4: Gondola routes — how many for V1?
Recommendation: 1 route (Grand Canal, Rialto to San Marco). Add cross-canal routes based on playtesting need.

### Q5: Bridge elevation in VR
Bridges are arched. Dolly y-position follows mesh surface, which can cause mild VR discomfort. Recommendation: gentle arches only (1m rise over 10m span). No stairs or stepped fondamenta in V1.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Collision geometry has gaps; visitor falls through | Critical | Validate every fondamenta/bridge mesh. Fall recovery resets to last valid position. |
| Continuous locomotion causes VR nausea | Medium | Vignette on by default. Speed 2.5 m/s. Teleport available as alternative. |
| Gondola ride causes nausea (passive camera motion) | Medium | Slow speed (4 m/s). Fixed forward camera. Test with VR-sensitive users. |
| District transitions feel jarring | Medium | Fog gate + 2s lerp + hysteresis prevents flickering. |
| Teleport through walls | Medium | Arc raycast tests intermediate points, not just endpoint. |
