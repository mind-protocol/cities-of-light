# VALIDATION -- Performance

> CRITICAL MODULE. Health checks, invariants, and acceptance criteria for Quest 3 performance.
> 14 milliseconds per frame. Every violation is visible, every leak is fatal.

---

## Invariants (must ALWAYS hold)

### I1. 72fps minimum in VR

The Quest 3 renders at 72 frames per second. Each frame has a hard budget
of 14 milliseconds. If a single frame exceeds 14ms, it is a dropped frame.
Two consecutive dropped frames cause visible judder. Five consecutive
dropped frames cause nausea. Sustained drops below 72fps is a showstopper
that blocks any release.

This invariant is absolute. No visual feature, no code path, no content
addition justifies dropping below 72fps on Quest 3 hardware. If a feature
causes frame drops, the feature is cut or simplified until it fits the
budget. No exceptions. No "we'll optimize later."

### I2. Less than 200 draw calls

The Quest 3's XR2 Gen 2 GPU batches draw calls poorly beyond approximately
200. Each draw call has fixed overhead regardless of triangle count. 200
draw calls at 100 triangles each is slower than 10 draw calls at 2000
triangles each.

Budget allocation:
- Citizens (all tiers combined): 45 draw calls
- Venice geometry (buildings, canals, bridges): 100 draw calls
- Props (stalls, boats, lanterns): 30 draw calls
- Effects (water, sky, particles): 15 draw calls
- UI/debug overlay: 10 draw calls

### I3. Less than 500K visible triangles

The XR2 Gen 2 vertex throughput limits visible geometry to approximately
500,000 triangles per frame at 72fps. This includes all citizens, all
buildings at their current LOD, all props, and all environmental geometry.

Budget allocation:
- Citizens (all tiers): 75K triangles
- Buildings (all LODs): 300K triangles
- Props: 50K triangles
- Environment (water, ground, sky): 75K triangles

### I4. Less than 512MB JavaScript heap

Beyond 512MB of JS heap, V8 garbage collection pauses become multi-millisecond
events that directly cause frame drops. The heap must stay below this ceiling
at all times, including during peak activity (crowded market with active
voice conversations and physics tick running).

### I5. Thermal stability

The Quest 3 throttles CPU and GPU clocks when thermal limits are reached.
Throttling reduces available compute by 20-40%, turning a marginal frame
budget into a broken one. The application must not drive the Quest 3 into
thermal throttling during a 30-minute session under normal conditions.

---

## Health Checks

### HC1. Frame Time Distribution

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Frame time (p50)              | < 11ms      | Median frame, healthy headroom       |
| Frame time (p90)              | < 13ms      | Most frames within budget            |
| Frame time (p95)              | < 14ms      | Budget ceiling                       |
| Frame time (p99)              | < 18ms      | Rare spikes acceptable               |
| Frame time (max, per minute)  | < 25ms      | Single worst frame per minute        |
| Consecutive dropped frames    | < 2         | 2+ consecutive drops = visible judder |
| Dropped frame rate            | < 1%        | Less than 1 in 100 frames exceeds 14ms |
| Frame time variance (std dev) | < 2ms       | Consistent frame pacing, no jitter   |

Frame time includes: JavaScript execution, scene graph traversal, GPU
rendering, audio processing, and GC pauses. Measured via
`performance.now()` delta between `requestAnimationFrame` callbacks, or
via the Quest performance overlay.

### HC2. GPU Utilization

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Draw calls per frame          | < 200       | `renderer.info.render.calls`         |
| Triangles per frame           | < 500K      | `renderer.info.render.triangles`     |
| Texture memory                | < 256MB     | Estimated from texture dimensions    |
| Shader compilations per session | < 20      | Shader compile causes frame spike    |
| GPU utilization               | < 80%       | Quest performance overlay            |
| Fill rate pressure            | monitored   | Overdraw on transparent surfaces     |

Shader compilation must happen during loading, never during gameplay.
A shader compilation during an active scene causes a 50-200ms frame spike.
All materials must be pre-warmed by rendering a throwaway frame during init.

### HC3. Thermal State

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Time to thermal warning       | > 30min     | Session length before Quest shows warning |
| Time to thermal throttle      | > 45min     | Session length before clock reduction |
| CPU clock after 30 minutes    | > 90% of max | No significant throttling            |
| GPU clock after 30 minutes    | > 90% of max | No significant throttling            |
| Device surface temperature    | < 40C       | Comfortable to wear                  |

Thermal management is achieved by staying below 80% sustained GPU utilization.
The 20% headroom absorbs thermal load over extended sessions. Running at
95% GPU means thermal throttle within 10-15 minutes.

### HC4. Memory Growth Rate

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| JS heap at session start      | < 200MB     | Baseline after init and first render |
| JS heap after 10 minutes      | < 250MB     | Normal growth from runtime state     |
| JS heap after 30 minutes      | < 300MB     | Plateau expected, not linear growth  |
| JS heap after 60 minutes      | < 350MB     | Must plateau, not grow indefinitely  |
| Growth rate (minutes 10-30)   | < 2.5MB/min | Acceptable allocation rate           |
| Growth rate (minutes 30-60)   | < 1MB/min   | Must slow as caches stabilize        |
| ArrayBuffer allocations       | tracked     | Audio buffers are the largest risk   |
| Three.js geometry count       | stable      | Should not grow after initial load   |
| Three.js texture count        | stable      | Should not grow after initial load   |

### HC5. GC Pause Duration

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Minor GC pause (p50)          | < 0.5ms     | Young generation collection          |
| Minor GC pause (p95)          | < 1ms       | Infrequent longer pauses             |
| Major GC pause (p50)          | < 2ms       | Old generation collection            |
| Major GC pause (p95)          | < 4ms       | Must stay within frame budget slack  |
| Major GC pause (max)          | < 8ms       | Worst case still leaves 6ms for rendering |
| GC frequency                  | < 5/second  | Too frequent = too many allocations  |
| GC-caused frame drops per min | < 1         | GC should rarely cause visible impact |

Reduce GC pressure by: pre-allocating vectors (reuse `Vector3` instances
instead of creating new ones per frame), pooling audio buffers, avoiding
string concatenation in hot paths.

---

## Acceptance Criteria

### AC1. 30-Minute Session Without Frame Drops Below 72fps (Primary)

The single most important acceptance test. Performed on Quest 3 hardware.

1. Enter the world. Walk through Rialto market (highest citizen density).
2. Have 5 voice conversations with citizens (triggers STT + LLM + TTS pipeline).
3. Walk to San Marco piazza (different district, ambient transition).
4. Stand in the piazza for 5 minutes observing ambient citizen activity.
5. Walk through 2 narrow calli (triggers LOD transitions, reverb changes).
6. Return to Rialto. Observe the same market scene after 25 minutes.

Pass criteria:
- Frame rate never drops below 72fps for more than 2 consecutive frames
- No visible judder or stutter at any point
- No thermal throttle warning from Quest 3
- Memory usage at minute 30 is < 300MB JS heap
- Performance at minute 30 is indistinguishable from minute 1

Measurement: Quest performance overlay recording + `renderer.info` logged
every 5 seconds to a rolling buffer.

### AC2. Market Stress Test (Automated)

The highest-load scenario: Rialto market with maximum visible citizens.

1. Position the camera in the center of Rialto market.
2. Ensure 20 FULL-tier + 60 ACTIVE-tier + 96 AMBIENT-tier citizens are loaded.
3. Run for 60 seconds without visitor input.
4. Log frame time, draw calls, triangle count, and memory every frame.

Pass criteria:
- Mean frame time < 12ms (headroom for voice pipeline)
- Draw calls < 180 (headroom for effects)
- Triangles < 400K (headroom for LOD fluctuation)
- No frame exceeds 16ms (2ms over budget is the maximum acceptable spike)

### AC3. LOD Transition Smoothness (Manual)

1. Walk toward a group of distant buildings (LOD3 silhouette).
2. Continue walking. Buildings transition LOD3 -> LOD2 -> LOD1 -> LOD0.
3. Observe for pop-in (geometry or texture suddenly appearing).

Pass criteria:
- Cross-fade (alpha blend over 3 frames) visible during every transition
- No geometry pop-in (no frame where a building suddenly gains detail)
- No frame drop during LOD transition
- Walking away reverses the transition smoothly

### AC4. Citizen Tier Transition (Manual)

1. Walk toward a distant citizen (AMBIENT tier: capsule silhouette).
2. Continue approaching. Citizen transitions AMBIENT -> ACTIVE -> FULL.
3. Observe for pop-in, animation glitches, or frame drops.

Pass criteria:
- Tier transition is visually smooth (no instant geometry swap)
- No frame drop during transition
- Citizen animation is appropriate for new tier immediately after transition
- Walking away reverses the transition without artifacts

### AC5. Memory Stability (60-Minute Soak)

1. Run the experience on Quest 3 for 60 minutes.
2. Walk through all districts. Have 20+ voice conversations.
3. Trigger at least 3 physics ticks and 1 Airtable sync cycle.
4. Log memory usage every 30 seconds.

Pass criteria:
- JS heap < 350MB at minute 60
- Memory growth between minute 30 and minute 60 is < 30MB
- No out-of-memory crash or Quest low-memory warning
- Three.js geometry count at minute 60 equals geometry count at minute 5
  (plus or minus 10 for tier transitions in progress)

---

## Anti-Patterns

### AP1. Memory Leak

**Symptom:** Frame rate degrades gradually over session length. JS heap
grows linearly. Eventually the experience crashes or Quest shows a
low-memory warning.

**Detection:** Plot JS heap over time. Linear growth that does not plateau
after 10 minutes is a leak. Growth > 3MB/minute sustained is a red flag.

**Root cause categories:**
- Three.js geometries/materials not disposed when citizens leave tier range
- Audio buffers (ArrayBuffer from TTS) not dereferenced after playback
- Event listeners added on every frame (addEventListener in render loop)
- Conversation history arrays growing without trim
- Closures capturing large objects in setInterval/setTimeout callbacks

**Fix:** Audit disposal paths for every object type:
- Citizens leaving FULL -> ACTIVE: dispose geometry, material, skeleton
- Citizens leaving ACTIVE -> AMBIENT: dispose simplified mesh
- Audio sources after playback: stop, disconnect entire node chain, dereference buffer
- Run `renderer.info.memory` logging every 10 seconds. If geometry count
  grows without corresponding citizen tier changes, a leak exists.

### AP2. Thermal Throttle Spiral

**Symptom:** Experience starts at 72fps. After 15-20 minutes, drops to
60fps, then 50fps, then stays there. Removing visual load does not
restore 72fps immediately.

**Detection:** Monitor Quest performance overlay. If GPU clock drops
below 80% of maximum, thermal throttling is active. If reducing scene
complexity does not restore frame rate within 30 seconds, the device
is in thermal protection mode.

**Root cause:** Sustained GPU utilization > 85% generates heat faster
than the Quest's passive cooling dissipates it. The GPU throttles to
protect itself. Once throttled, the lower clock speed cannot maintain
72fps, causing the scene to stutter, which causes reprojection, which
causes additional GPU load. Spiral.

**Fix:** Keep sustained GPU utilization below 80%. This is achieved by:
- Aggressive LOD distances (force LOD2 at 30m instead of 50m)
- Reduce ACTIVE citizen count from 60 to 40
- Lower pixel ratio from 1.0 to 0.9 (barely perceptible, significant GPU savings)
- Disable shadow casting on ACTIVE-tier citizens
If adaptive quality is implemented, thermal throttle should trigger the
first quality reduction tier within 30 seconds of detection.

### AP3. LOD Thrashing

**Symptom:** A building or citizen near a LOD boundary rapidly switches
between two LOD levels, causing visible flickering and wasted GPU work
(geometry uploaded, disposed, uploaded, disposed).

**Detection:** Log LOD transitions per object. If any object transitions
more than 4 times in 10 seconds, it is thrashing.

**Root cause:** The visitor is positioned at exactly the LOD transition
distance. Small camera movements (head tracking jitter) cause the
distance to oscillate above and below the threshold.

**Fix:** Hysteresis on LOD transitions. Use different thresholds for
LOD upgrade and downgrade:
- Upgrade (higher detail): trigger at distance - 2m
- Downgrade (lower detail): trigger at distance + 2m
This 4-meter dead zone prevents oscillation from normal head movement.

### AP4. Culling Failure

**Symptom:** Draw call count and triangle count are higher than expected.
Frame time is above budget even with few visible citizens.

**Detection:** Compare `renderer.info.render.triangles` against expected
visible triangles (based on camera position and citizen/building distances).
If actual exceeds expected by > 30%, culling is failing.

**Root cause:** `frustumCulled` set to `false` on objects that should be
culled. Distance culling not running (interval timer broken). Instanced
meshes with `frustumCulled = false` (InstancedMesh requires manual
bounding sphere for culling). Batched geometry with oversized bounding
box (entire district renders when only one building is visible).

**Fix:** Ensure all objects have `frustumCulled = true` (default in
Three.js, but verify). InstancedMesh: compute tight bounding sphere from
instance positions. Batched geometry: split batches by sub-district so
frustum culling can reject parts independently. Log culling efficiency:
`(total objects - rendered objects) / total objects`. Target: > 50% culled
in any given frame (Venice's narrow streets mean most of the city is
behind the camera).

### AP5. Shader Compilation Stall

**Symptom:** A single frame takes 100-300ms, causing a visible freeze.
Happens once, then never again for that material. Common when entering
a new district for the first time.

**Detection:** Frame time spike > 50ms with no corresponding GC pause.
Usually coincides with first use of a new material/shader combination.

**Root cause:** WebGL compiles shaders lazily on first use. The compilation
happens on the main thread and blocks the frame.

**Fix:** Pre-warm all materials during the loading screen. Render a
throwaway frame that includes one instance of every material used in
the experience. The compilation cost is paid once during load, not during
gameplay. Verify by logging draw call count during the first 10 frames --
it should match steady-state draw call count (no new materials appearing
later).

---

## Data Integrity

### Profiling Data Accuracy

```
RENDERER INFO (logged every 5 seconds):
  - renderer.info.render.calls = draw calls this frame
  - renderer.info.render.triangles = triangles this frame
  - renderer.info.memory.geometries = total geometry objects in memory
  - renderer.info.memory.textures = total texture objects in memory
  - Verify renderer.info is reset per frame (call renderer.info.reset() if using
    manual tracking). Accumulated values are meaningless.

FRAME TIMING:
  - Measured via performance.now() delta between requestAnimationFrame callbacks
  - NOT via Date.now() (insufficient precision: 1ms vs 0.1ms)
  - Exclude the first 60 frames after load (warm-up, shader compilation)
  - Log to a circular buffer of 3600 entries (60 seconds at 60Hz sample rate)
  - Do not allocate new objects in the timing code (would pollute the measurement)

MEMORY TRACKING:
  - performance.memory.usedJSHeapSize (Chrome/Quest only, not available in Firefox)
  - Sampled every 30 seconds (more frequent sampling adds GC pressure)
  - Log to the same circular buffer as frame timing
  - Track both absolute value and delta from previous sample

THERMAL STATE (Quest 3 only):
  - Not available programmatically from the browser
  - Must be observed via Quest developer performance overlay
  - Indirect signal: if frame time increases by > 20% with no scene complexity change,
    thermal throttling is likely active
```

### Performance Budget Enforcement

```
EVERY 60 FRAMES (once per second):
  - Check draw calls: if > 200, log warning with breakdown by category
    (citizens, buildings, props, effects)
  - Check triangles: if > 500K, log warning with breakdown by category
  - Check JS heap: if > 400MB, trigger aggressive LOD (force LOD2+ on all buildings)
  - Check JS heap: if > 480MB, trigger emergency mode (force AMBIENT on all citizens)
  - Check frame time p95 (over last 72 frames): if > 14ms, trigger adaptive quality

ADAPTIVE QUALITY ACTIONS (cumulative):
  Level 0 (normal):     All settings at design targets
  Level 1 (< 14ms p95): Reduce FULL citizens from 20 to 10
  Level 2 (< 18ms p95): Drop pixel ratio from 1.0 to 0.75
  Level 3 (< 22ms p95): Force all citizens to AMBIENT, disable props

HYSTERESIS:
  - Degrade: trigger immediately on threshold breach
  - Upgrade: require 5 consecutive seconds below the lower threshold
  - Never oscillate: if quality was reduced in the last 10 seconds, do not upgrade
```

### Three.js Object Lifecycle

```
ON CITIZEN TIER UPGRADE (e.g., AMBIENT -> ACTIVE):
  - Create new mesh for higher tier
  - Fade in new mesh over 300ms
  - Fade out old mesh over 300ms
  - After fade: dispose old geometry, material, skeleton
  - Verify renderer.info.memory.geometries did not increase by more than 1
    (new geometry added, old geometry disposed = net 0 or +1 during transition)

ON CITIZEN TIER DOWNGRADE (e.g., FULL -> ACTIVE):
  - Same process in reverse
  - Critical: dispose the FULL mesh's skeleton and all associated textures
  - Skeleton disposal is the most commonly missed cleanup (V8 cannot GC
    a skeleton referenced by a disposed mesh's skin property)

ON CITIZEN LEAVING RENDER RANGE:
  - Remove from scene
  - Dispose geometry, material, textures
  - Remove from tier tracking data structures
  - Verify the citizen does not appear in renderer.info counts

PERIODIC AUDIT (every 60 seconds):
  - Count geometries in renderer.info.memory.geometries
  - Compare against expected: sum of (active citizens per tier) + (static environment)
  - If actual exceeds expected by > 20: geometry leak detected. Log details.
```
