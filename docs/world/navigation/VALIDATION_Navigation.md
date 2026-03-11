# VALIDATION: world/navigation — What Must Be True

Health checks, invariants, acceptance criteria, and data integrity rules for the navigation system. Every check is testable. Every threshold is a number.

---

## Invariants (must ALWAYS hold)

### NI1. Visitor Never Falls Through Ground

- The visitor's Y position is always >= the nearest walkable surface Y minus 0.1m tolerance. If the visitor is below this threshold, the fall recovery system must trigger within 1 frame.
- Fall recovery resets the visitor to the nearest valid walkable surface. "Nearest" is computed in XZ plane. Recovery never places the visitor on water.
- The downward raycast fires every frame without exception. No code path skips the collision check (no "fast mode" that disables raycasting).
- On teleport: the landing position is validated BEFORE the teleport executes. If the arc endpoint has no collision mesh below it, the teleport is rejected (arc turns red, no movement).

### NI2. Water Always Blocks

- No visitor movement (walk, run, teleport, gondola disembark) can place the visitor on a position where no collision mesh exists within 2m below.
- Canal edges are enforced by the absence of walkable geometry, not by invisible walls. The fondamenta ends; the visitor slides along the edge.
- Edge sliding is smooth. The visitor's velocity is projected along the fondamenta edge direction. No dead stop, no bounce.
- Teleport cannot land on water. The arc collision check tests against the walkable collision mesh only. Water surface geometry is excluded from teleport validation.

### NI3. All Districts Always Reachable

- A connected path of walkable surfaces (fondamenta + bridges) exists between every pair of districts. Verified at world load by graph traversal.
- No bridge destruction, fondamenta removal, or dynamic geometry change may break inter-district connectivity at runtime. (V1 has no destructible geometry, but the invariant is stated for future-proofing.)
- Gondola routes provide an alternate path but are not required for connectivity. Walking alone must suffice.

### NI4. Movement Speed Bounds

- Walk speed is always 2.5 m/s (+/- 0.1 tolerance). No code path modifies walk speed at runtime.
- Desktop run speed is always 3.75 m/s (+/- 0.1 tolerance). VR has no run mode.
- Gondola speed is always 4.0 m/s (+/- 0.2 tolerance) along the spline.
- Teleport is instantaneous in position change. The comfort fade takes exactly 400ms (200ms fade to black + 200ms fade from black, +/- 50ms).
- No speed value may be negative, zero, or > 10 m/s. Any value outside [0.1, 10.0] indicates a bug.

### NI5. VR Comfort Non-Negotiable

- Snap turn is always 30 degrees. No smooth turn in V1. No code path allows smooth turn.
- Movement vignette is always active during continuous locomotion in VR. Peripheral darkening reaches 30% opacity within 200ms of thumbstick push.
- Teleport fade-to-black cannot be disabled. Every teleport has the 400ms fade sequence.
- Teleport cooldown is 300ms. No teleport can execute within 300ms of a previous teleport landing.

### NI6. No Jump, No Climb, No Fly

- The visitor's Y position changes only when walking on a bridge arch (gradual incline), falling and recovering, or entering/exiting a gondola. No jump input exists. No vertical velocity is ever applied to the visitor except gravity for fall recovery.
- Maximum visitor Y above water: the peak of the tallest bridge arch (~3m above water = ~2.2m above fondamenta). If visitor Y exceeds 4.0m above water level, something is wrong -- trigger fall recovery.

---

## Health Checks (runtime monitoring)

### HC1. Collision Raycast Response Time

| Metric | Threshold | Action if exceeded |
|---|---|---|
| Downward raycast time per frame | < 0.2ms | Simplify collision mesh (reduce vertex count) |
| Raycast miss rate (no hit within 2m) | < 1% of frames during normal walking | Verify collision mesh covers all fondamenta |
| Edge-slide computation | < 0.1ms | Simplify edge detection geometry |
| Teleport arc collision (20 samples along arc) | < 0.5ms per teleport attempt | Reduce arc sample count to 12 |
| Total navigation update per frame | < 1.0ms | Profile and optimize hottest path |

Measure raycast time every 60 frames. If average exceeds threshold over a 5-second window, log visitor position and collision mesh stats.

### HC2. Teleport Arc Rendering

| Metric | Threshold |
|---|---|
| Arc line segment count | 20 segments |
| Arc update rate | Every frame while trigger is half-pressed |
| Arc color switch latency (valid/invalid) | < 1 frame after surface detection changes |
| Landing indicator visibility | Circle visible on valid surface within 1 frame of arc endpoint computation |
| Arc maximum horizontal range | 15m. Arc extends no further regardless of controller angle. |

If the arc renders but the landing indicator does not appear on valid surfaces, the collision layer mask is filtering out walkable geometry. Verify the raycast layer includes the collision mesh layer.

### HC3. Gondola Spline Integrity

| Metric | Threshold | Notes |
|---|---|---|
| Spline sample interval | 0.5m between sample points | Ensures smooth movement along canal |
| Maximum curvature at any sample | < 45 degrees change over 2m | Prevents sharp turns that cause nausea |
| Spline height above water | 0.1m (+/- 0.05m) at all samples | Gondola hull floats, does not clip water |
| Spline clearance from canal walls | > 1.0m at all samples | Gondola does not clip fondamenta |
| Spline endpoint on dock fondamenta | Within 2.0m of dock trigger volume center | Visitor can disembark to walkable surface |
| Total spline length range | 50m-500m per route | Ride duration: 12-125 seconds at 4 m/s |

Validate all gondola splines at world load. A spline that fails any check must not be available for boarding.

### HC4. District Transition Smoothness

| Metric | Threshold |
|---|---|
| Boundary detection latency | < 1 frame after visitor enters new district polygon |
| Fog gate duration | 3 seconds (+/- 0.5s) |
| Audio crossfade duration | 2 seconds (+/- 0.3s) |
| Atmosphere parameter lerp | 2 seconds to reach 90% of target |
| Hysteresis distance | 10m (no reverse transition within 10m of boundary) |
| Boundary oscillation | 0 transitions in 5 seconds when standing still at boundary |

If the visitor triggers > 3 district transitions in 10 seconds, hysteresis is broken. Log and clamp to prevent rapid transitions.

### HC5. Frame Rate During Navigation Events

| Event | Max frame time spike | Platform |
|---|---|---|
| Teleport (including fade) | < 16ms per frame | Quest 3 |
| Gondola boarding | < 20ms (one-time setup) | Quest 3 |
| District transition | < 16ms per frame | Quest 3 |
| LOD transitions during movement | < 16ms per frame | Quest 3 |

No navigation event may cause a frame drop below 72fps on Quest 3 (13.9ms frame budget). A single frame may spike to 20ms during gondola boarding (setup cost), but consecutive frames must not.

### HC6. Input Responsiveness

| Input | Maximum response latency |
|---|---|
| WASD key press to movement start | < 1 frame (16ms at 60fps) |
| Thumbstick push to movement start | < 1 frame |
| Snap turn input to rotation complete | < 1 frame |
| Teleport trigger to fade start | < 2 frames (33ms) |
| Mouse move to camera rotation | < 1 frame |
| Gondola board trigger to camera attach | < 500ms |

If input-to-response exceeds threshold, the navigation update is not running every frame. Check that `update(delta)` is called from the render loop without interruption.

---

## Acceptance Criteria (gate conditions per POC milestone)

### POC-1 Gate: Desktop Navigation

- [ ] WASD moves the visitor along fondamenta at 2.5 m/s
- [ ] Mouse look rotates camera smoothly. Pitch clamped to prevent flip.
- [ ] Shift increases speed to 3.75 m/s on desktop
- [ ] Visitor cannot walk into canals. Edge sliding along fondamenta works.
- [ ] Visitor can walk across at least one bridge. Y position follows arch profile.
- [ ] Collision raycast fires every frame. No frame drops below 60fps during navigation.
- [ ] Pointer lock activates on click. ESC releases pointer lock.

### POC-2 Gate: VR Navigation

- [ ] Left thumbstick continuous locomotion at 2.5 m/s relative to headset facing
- [ ] Right thumbstick snap turn: exactly 30 degrees per snap, no drift
- [ ] Arc teleport: parabolic arc renders on half-press, blue on valid surface, red on water/invalid
- [ ] Teleport landing places visitor on collision mesh within 0.1m vertical accuracy
- [ ] Teleport fade: 200ms to black, 200ms from black. No visible frame during the black period.
- [ ] Teleport cooldown: 300ms between teleports
- [ ] Teleport range capped at 15m. Arc does not extend further.
- [ ] Movement vignette activates during thumbstick locomotion. Peripheral darkens to 30%.
- [ ] Fall recovery: deliberately teleport to edge case positions (bridge edges, canal corners). Visitor never falls through.
- [ ] 10 minutes of VR navigation without nausea reported by tester

### POC-3 Gate: District Transitions

- [ ] Walking across a district boundary triggers fog gate (thicker fog for ~3 seconds)
- [ ] Audio crossfade: old district ambient fades out, new fades in, over 2 seconds
- [ ] Atmosphere shift visible within 3 seconds of crossing boundary
- [ ] Hysteresis: standing at boundary does not cause repeated transitions
- [ ] Walking from Rialto to every other district possible without interruption or loading
- [ ] All 7 districts reachable by walking (connectivity verified at load)

### POC-4 Gate: Gondola Transport

- [ ] Approach a dock, see a gondola, board with E (desktop) or trigger (VR)
- [ ] Camera attaches to gondola. Visitor can look around but not move relative to boat.
- [ ] Gondola follows canal spline at 4 m/s. No clipping through canal walls or bridges.
- [ ] Gondola hull floats at correct water height. No sinking, no hovering.
- [ ] Ride from Rialto to San Marco takes 30-90 seconds. Scenery visible on both sides.
- [ ] Disembark at destination dock. Visitor placed on walkable fondamenta.
- [ ] Gondola ride does not cause nausea in VR (tested with 3 users)
- [ ] No frame drops below 72fps during gondola ride

---

## Anti-Patterns to Detect

### AP1. Wall Clipping

**Symptom:** Visitor passes through building facades, canal walls, or bridge parapets.
**Detection:** Log visitor position every frame. If the XZ position falls inside any building bounding box, the visitor has clipped into a building. If Y < 0.3m above water and the visitor is not on a bridge descent, they are clipping into a canal wall.
**Fix:** Buildings have no collision geometry by design. Clipping through building facades means fondamenta geometry extends into the building footprint, allowing the visitor to walk to the wall and beyond. Fix: trim fondamenta width so it ends 0.3m before the building facade. Or: add thin collision planes along building facades facing walkable surfaces.

### AP2. Stuck in Geometry

**Symptom:** Visitor cannot move. All directional inputs result in no position change. The visitor is trapped between fondamenta edges, bridge parapets, or building corners.
**Detection:** If visitor input magnitude > 0 but position change < 0.01m/frame for > 2 seconds, the visitor is stuck.
**Fix:** Edge sliding may produce a zero-length slide vector when the visitor is in a convex corner (two edges meeting at less than 90 degrees). Fix: detect zero slide vector and apply a small escape impulse perpendicular to the visitor's facing direction. Or: widen the fondamenta at corners to prevent sub-body-width passages.

### AP3. VR Nausea Triggers

**Symptom:** Visitor reports dizziness, discomfort, or nausea during or after a VR session.
**Detection:** Post-session questionnaire. Automated: detect rapid Y-position changes (> 0.5m in < 0.5s, excluding teleport), detect high angular velocity (> 90 deg/s continuous rotation, excluding snap turn), detect frame rate drops below 60fps for > 1 second.
**Fix:**
- Rapid Y change: check bridge collision mesh for sharp steps. Smooth bridge geometry to ramp, not staircase.
- Angular velocity: check that smooth turn is not enabled. Verify snap turn is instantaneous (1 frame), not animated.
- Frame drops: profile the frame. Likely LOD or particle budget exceeded. See VALIDATION_Districts.md HC3 and VALIDATION_Atmosphere.md HC1.
- Gondola nausea: ensure gondola spline has no sharp turns (< 45 deg over 2m). Reduce gondola speed from 4.0 to 3.0 m/s if nausea persists.

### AP4. Teleport Exploits

**Symptom:** Visitor teleports to locations they should not reach: rooftops, across districts in one jump, inside buildings.
**Detection:** After each teleport, verify: landing Y is within 0.5m of the collision mesh Y at that XZ, landing XZ is within 15m horizontal of pre-teleport XZ, landing is not inside any building bounding box.
**Fix:** Verify teleport arc collision tests against the walkable collision mesh only (layer mask). Verify maximum range (15m) is enforced as a horizontal distance clamp on the arc endpoint. Verify building interiors have no collision mesh (no walkable surface inside buildings).

### AP5. Gondola Derailment

**Symptom:** Gondola leaves the canal. Gondola clips through bridges. Gondola stops mid-route. Visitor remains attached to a stuck gondola.
**Detection:** During gondola ride, check position every frame: is gondola XZ within 1.5x canal width of the spline? Is gondola Y within 0.1m of water level? If gondola position deviates, the spline is misconfigured or the following algorithm failed.
**Fix:** Validate splines at load (see HC3). If a gondola deviates at runtime, force-snap it back to the nearest spline point. If the gondola stops (spline parameter stops advancing), trigger automatic disembark at current position (place visitor on nearest fondamenta).

### AP6. District Transition Flicker

**Symptom:** Atmosphere flickers rapidly at district boundary. Audio alternates between two districts. Fog pumps in and out.
**Detection:** Log district transitions. If > 2 transitions occur within 5 seconds, hysteresis is failing.
**Fix:** Verify hysteresis implementation: after a transition to district B, the visitor must move > 10m into B before a transition back to A can trigger. Check that the distance is measured from the boundary, not from the transition trigger point. Check that the nearest-district calculation uses the visitor's actual position, not a lagged position from a previous frame.

### AP7. Orphaned Gondola Ride

**Symptom:** Visitor boards a gondola and the ride never ends. Or: visitor is placed at the end of the route but camera remains attached to the gondola.
**Detection:** Gondola ride has a maximum duration based on spline length / speed. If ride duration exceeds `(spline_length / 4.0) + 10 seconds`, the spline following is stalled. If camera is still attached to gondola 5 seconds after the spline parameter reached 1.0, the disembark routine failed.
**Fix:** Add a maximum ride timer. On timeout, force disembark at current gondola position (nearest fondamenta). Verify the disembark routine detaches the camera, re-enables input, and places the visitor on walkable geometry.

---

## Data Integrity Checks

### Collision Mesh Validation (at world load)

```
AFTER COLLISION MESH GENERATED:
  - Assert: collision mesh vertex count > 0
  - Assert: collision mesh has no degenerate triangles (area > 0.01 m^2)
  - Assert: all collision mesh normals point upward (Y component > 0.5). No inverted walkable surfaces.
  - Assert: no collision mesh triangle is below y=0 (water level). Walkable surfaces are above water.
  - Assert: collision mesh bounding box covers all 7 district centers (no missing districts)
  - Raycast test: from 50 randomly sampled fondamenta midpoints, cast downward. All must hit within 0.1m.
  - Raycast test: from 20 randomly sampled canal center points, cast downward. None should hit collision mesh.
  - Connectivity test: BFS from Rialto district center fondamenta node. All other districts reachable.
    (Graph nodes = fondamenta segments + bridges; edges = shared endpoints within 1.0m)
```

### Gondola Route Validation (at world load)

```
FOR EACH GONDOLA ROUTE:
  - Assert: route has >= 4 control points (minimum for meaningful spline)
  - Assert: route start point is within 3m of a dock trigger volume
  - Assert: route end point is within 3m of a dock trigger volume
  - Assert: no spline sample is inside a bridge collision mesh (gondola fits under bridges)
  - Assert: bridge clearance >= 2.0m at every bridge crossing along the route
  - Assert: spline does not exit canal boundaries at any sample point
  - Assert: spline curvature < 45 degrees change over any 2m segment
  - Assert: route length is in [50m, 500m] range
  - Assert: start and end docks are in different districts (routes serve inter-district transport)
```

### Input System Validation (on session start)

```
ON SESSION START (desktop):
  - Verify: pointer lock API available
  - Verify: keydown/keyup event listeners registered for W, A, S, D, Shift
  - Verify: mousemove listener registered
  - Verify: initial visitor position is on a collision mesh (raycast confirms)

ON SESSION START (VR):
  - Verify: XR session active with 'immersive-vr' mode
  - Verify: at least 1 input source of type 'tracked-pointer' (controller)
  - Verify: left and right controller detected
  - Verify: snap turn angle set to 30 degrees
  - Verify: teleport system initialized (arc geometry created, layer mask set)
  - Verify: vignette post-processing pass active
  - Verify: initial visitor/dolly position is on a collision mesh
```

### Cross-System Consistency

```
EVERY 60 SECONDS:
  - Verify: visitor position is above collision mesh (raycast hit within 2m below)
  - Verify: visitor position is within Venice world bounds (0 < x < 1500, 0 < z < 1200)
  - Verify: visitor Y is in range [0.5, 4.0] (above water, below max bridge height)
  - Verify: current district assignment matches the district polygon containing visitor XZ
  - Verify: movement speed matches expected mode (2.5 walk, 3.75 run, 4.0 gondola, 0 stationary)
  - If visitor is on a gondola: verify gondola position is within its route canal
  - If visitor is not on a gondola: verify visitor is not inside any canal polygon

ON DISTRICT CHANGE:
  - Verify: new district has > 0 fondamenta segments (is walkable)
  - Verify: fog gate triggered (fog density increased then returned to target)
  - Verify: audio crossfade initiated (old ambient volume decreasing, new increasing)
  - Verify: atmosphere parameters are lerping toward new district targets
```
