# VALIDATION -- Spatial Audio

> Health checks, invariants, and acceptance criteria for audio spatialization.
> If you close your eyes and cannot point to the speaking citizen, this module has failed.

---

## Invariants (must ALWAYS hold)

### I1. All citizen voices are spatially positioned

Every citizen voice -- whether a direct response to the visitor, ambient
chatter between AI citizens, or a narrative event announcement -- must
play through a PannerNode with HRTF model at the citizen's exact 3D
position. Flat stereo playback of any citizen voice is a bug. No exceptions.

Verification: every audio source node in the Web Audio graph must have
a connected PannerNode with `panningModel = 'HRTF'`. A voice source
connected directly to `AudioContext.destination` bypasses spatialization
and violates this invariant.

### I2. Distance attenuation is monotonic

A citizen 5 meters away is always louder than the same citizen at 10 meters.
A citizen at 10 meters is always louder than at 20 meters. The attenuation
curve never inverts, never plateaus within the audible range (1-50m), and
never produces a louder signal at greater distance.

Model: `distanceModel = 'inverse'`, `refDistance = 1`, `maxDistance = 50`,
`rolloffFactor = 1.5`. The inverse distance formula guarantees monotonic
decay: `gain = refDistance / (refDistance + rolloffFactor * (distance - refDistance))`.

### I3. Maximum 32 active audio sources

The Web Audio API on Quest 3 degrades beyond 32 simultaneous spatial
sources. The priority system enforces this ceiling at all times. No code
path may create a 33rd source without first deactivating an existing one.

Budget allocation:
- Tier 0 (CRITICAL): max 2 sources
- Tier 1 (FOREGROUND): max 6 sources
- Tier 2 (ACTIVE): max 8 sources
- Tier 3 (AMBIENT): max 16 sources

If a new source requests activation and the budget is full, the lowest-priority
source at the greatest distance from the visitor is deactivated. Higher-tier
sources are never displaced by lower-tier sources.

### I4. District ambient never goes silent

Even when no citizens are present, the district ambient layer plays. Water
laps in canal districts. Wind blows in open piazzas. Silence in a populated
Venice is a bug. The only valid silence is outside the city bounds.

### I5. Reverb matches the acoustic space

A voice in a narrow calle uses a short, tight impulse response (RT60 ~0.8s).
A voice in San Marco piazza uses a long, diffuse impulse response (RT60 ~2.5s).
A church interior uses a cavernous response (RT60 ~4.0s). The active
ConvolverNode must always correspond to the visitor's current district type.
A cathedral reverb on a narrow street is a spatial audio lie.

---

## Health Checks

### HC1. Audio Source Count

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Active source count           | <= 32       | Count of non-stopped AudioBufferSourceNodes + MediaStreamSourceNodes |
| Peak source count per session | <= 32       | Maximum observed in any single frame  |
| Source creation rate           | < 10/sec    | New sources per second (sustained)   |
| Source disposal rate           | matches creation | Sources must be stopped and disconnected when done |
| Orphaned sources              | 0           | Sources with no connected output or ended playback not yet disposed |

### HC2. HRTF Positioning Accuracy

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| PannerNode position freshness | < 500ms     | Time since last position update for each active source |
| Position sync error           | < 0.5m      | Difference between panner position and citizen's rendered position |
| Listener update frequency     | 72Hz        | AudioListener position/orientation updated every frame |
| Listener orientation accuracy | < 5 degrees | Forward/up vectors match camera/headset transform |
| HRTF model active             | 100%        | All PannerNodes use `panningModel = 'HRTF'`, never `equalpower` |

### HC3. Ambient Layer Levels

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Ambient loops active          | 2-4 per district | Each district has primary, secondary, and optional accent layers |
| Ambient volume (relative)     | -12dB to -6dB below voice | Ambient never masks citizen speech |
| Crossfade duration            | 3 seconds   | District transition ambient blend    |
| Ambient gap                   | 0ms         | No silence between ambient loops (seamless loop points) |
| Time-of-day modulation active | yes         | Night districts quieter than day districts |

### HC4. Reverb Response

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Active ConvolverNode count    | 1           | Only one reverb profile active at a time |
| Reverb crossfade duration     | 2 seconds   | Transition between district reverb profiles |
| Wet/dry ratio (voice)         | 80/20       | Speech remains intelligible through reverb |
| Wet/dry ratio (ambient)       | 50/50       | Ambient blends into environment      |
| Wet/dry ratio (events)        | 30/70       | Events feel dramatic and spatial     |
| IR file loaded                | 100%        | ConvolverNode buffer is non-null for every district type |

### HC5. Occlusion

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Zone lookup latency           | < 0.01ms    | O(1) connectivity table lookup       |
| Same-zone attenuation         | 0dB         | No occlusion within the same zone    |
| Adjacent-zone attenuation     | -6dB + LP 2kHz | Muffled but audible through one zone boundary |
| 2+ zone separation            | full cull   | Source deactivated entirely           |
| Zone assignment freshness     | < 500ms     | Visitor's current zone updated at least every 500ms |

---

## Acceptance Criteria

### AC1. Close Eyes Test (Manual, Primary)

The definitive test for spatial audio. Performed on Quest 3 with headphones.

1. Stand in Rialto market. 3 citizens visible within 15 meters.
2. Close eyes (or use a blindfold over the headset lenses).
3. A citizen speaks. Point to where you hear the voice.
4. Open eyes. Verify the pointing direction matches the citizen's position
   within 30 degrees of arc.
5. Repeat 10 times with different citizens at different positions.

Pass criteria: 8 out of 10 correct direction identification. If the visitor
consistently points wrong, HRTF panning, listener orientation, or panner
position is broken.

### AC2. Distance Perception (Manual)

1. Stand at a fixed position. A citizen at 3 meters speaks.
2. Note the perceived volume.
3. The same citizen moves to 10 meters and speaks the same phrase.
4. Note the perceived volume.
5. The citizen moves to 25 meters and speaks.
6. Note the perceived volume.

Pass criteria: each distance is perceptibly quieter than the previous.
The 25-meter voice is faint but audible. Beyond 30 meters, the voice
should be nearly inaudible without straining.

### AC3. District Transition (Manual)

1. Stand in Rialto (market sounds, crowd roar).
2. Walk toward Dorsoduro (quiet water, wind through trees).
3. During the walk, observe the ambient soundscape transition.
4. The Rialto ambience fades over ~3 seconds. Dorsoduro ambience fades in.
5. No silence gap between the two. No abrupt cut.

Pass criteria: smooth 3-second crossfade. Both ambient layers overlap
during the transition. Reverb profile shifts to match the new district.

### AC4. Priority System Under Load (Automated)

1. Spawn 40 simultaneous audio sources (exceeding the 32 budget).
2. Verify that only 32 are active at any moment.
3. Verify that the 8 deactivated sources are the lowest-priority, most
   distant ones.
4. Move the visitor closer to a deactivated source.
5. Verify that it activates, displacing a now-further source.

Pass criteria: source count never exceeds 32. Priority ordering is correct.
No audio glitches during activation/deactivation transitions (200ms fade).

### AC5. Thirty-Minute Immersion (Manual)

1. Enter the world. Walk through three districts over 30 minutes.
2. Have at least 5 voice conversations with citizens.
3. Observe ambient layers, reverb changes, distance attenuation throughout.

Pass criteria:
- No audio dropout or silence gap longer than 100ms (excluding valid silence)
- No mono audio leaking (all sound is spatially positioned)
- No volume spikes or sudden changes (except citizen speech initiation)
- Ambient soundscape feels continuous and district-appropriate for the entire session
- No audible reverb artifacts (metallic ringing, pre-echo, comb filtering)

---

## Anti-Patterns

### AP1. Mono Audio Leaking

**Symptom:** A citizen's voice sounds "in your head" rather than coming
from a position in space. The sound is centered, equal in both ears
regardless of head orientation.

**Detection:** Rotate head 90 degrees while a citizen speaks. If the
sound does not shift to one ear, spatialization is not active for that source.

**Root cause:** Audio source connected directly to `AudioContext.destination`
instead of through a PannerNode. Or PannerNode `panningModel` set to
`equalpower` instead of `HRTF`. Or listener orientation not being updated
(forward/up vectors stale).

**Fix:** Audit every code path that creates an audio source. Verify
PannerNode is in the chain. Add a runtime check: if any source's output
connects to destination without passing through a panner, log an error.

### AP2. Ambient Too Loud

**Symptom:** Market crowd roar drowns out the citizen responding to the
visitor. Visitor cannot understand what the citizen is saying.

**Detection:** Measure ambient layer gain relative to voice layer. If
ambient exceeds -6dB relative to direct voice, ambient is too loud.

**Root cause:** Ambient volume not scaled relative to voice priority.
District density multiplier set too high. Time-of-day modulation not
applied (daytime volume on a nighttime scene).

**Fix:** Enforce voice-to-ambient ratio of at least 6dB. Duck ambient
by an additional -3dB when a citizen is actively responding to the visitor.
Apply district density scaling with a hard cap.

### AP3. Reverb Artifacts

**Symptom:** Metallic ringing, pre-echo, or comb filtering on citizen
voices. Voices sound like they are in a bathroom rather than a Venetian
piazza.

**Detection:** Listen for unnatural coloration on voice playback.
Compare with dry (no reverb) playback of the same audio.

**Root cause:** Impulse response too long for the district type (4-second
cathedral IR applied to a narrow calle). Wet/dry ratio too high for voice
(> 30% wet). IR sample rate mismatch with AudioContext sample rate. IR
contains a DC offset or clipping.

**Fix:** Validate IR files: correct sample rate (44100Hz), no DC offset,
normalized peak at -3dBFS. Enforce wet/dry ratios per source type. Never
use an IR with RT60 longer than the district specification.

### AP4. Audio Source Leak

**Symptom:** Performance degrades over session length. Audio becomes
glitchy or distorted after 10-15 minutes. Quest 3 thermal throttling
activates.

**Detection:** Monitor active source count over time. If it grows
monotonically without reaching a plateau, sources are leaking.

**Root cause:** AudioBufferSourceNode not stopped and disconnected after
playback ends. GainNode or PannerNode not disconnected when the citizen
leaves range. MediaStreamSource from WebRTC peers not cleaned up on
disconnect.

**Fix:** Every audio source must have an `onended` handler that disconnects
the full node chain (source -> gain -> panner). Verify chain disposal on
citizen tier transition (FULL -> AMBIENT loses voice source). Run a
periodic audit (every 10 seconds) that counts nodes and reconciles against
expected active sources.

### AP5. Spatial Discontinuity on Tier Transition

**Symptom:** A citizen transitions from ACTIVE to FULL tier, and their
ambient chatter abruptly jumps in volume or position. Or a FULL citizen
transitions to ACTIVE and their last word is cut short.

**Detection:** Listen for audio pops, volume jumps, or position snaps
during tier transitions (when walking toward or away from citizens).

**Root cause:** Tier transition creates a new audio source at the new
tier's volume without crossfading from the old source. Position update
happens at the tier boundary rather than continuously.

**Fix:** Tier transitions must crossfade audio over 300ms. The old source
fades out while the new source fades in. Position is always updated from
the citizen's world position, regardless of tier. No audio cut is acceptable
during tier transition.

---

## Data Integrity

### Source Position to Citizen Position Sync

```
EVERY FRAME (72Hz):
  - For each active audio source with a linked citizen:
    - panner.positionX must equal citizen.mesh.position.x (within 0.1m tolerance)
    - panner.positionY must equal citizen.mesh.position.y (within 0.1m tolerance)
    - panner.positionZ must equal citizen.mesh.position.z (within 0.1m tolerance)
  - If delta > 0.5m for any axis: position sync is broken for that source. Log error.
  - If delta > 2m: source is playing from a stale position. Snap to correct position.

FOR THE LISTENER:
  - listener.positionX/Y/Z must match camera.getWorldPosition() within 0.01m
  - listener.forwardX/Y/Z must match camera.getWorldDirection() within 0.01 units
  - listener.upX/Y/Z must match the camera's up vector within 0.01 units
  - Stale listener (not updated for > 2 frames) = all spatialization is wrong
```

### Audio Budget Accounting

```
AT ALL TIMES:
  - Count of active sources per tier must not exceed tier maximum:
    Tier 0: <= 2
    Tier 1: <= 6
    Tier 2: <= 8
    Tier 3: <= 16
  - Total active sources <= 32
  - Every source in the active count must have:
    - A valid PannerNode with HRTF model
    - A linked citizen_id (or "ambient" / "event" tag)
    - A creation timestamp (for leak detection: sources older than 60s without
      a linked playing buffer are orphaned)

EVERY 10 SECONDS:
  - Reconcile active source count against expected count:
    expected = speaking_citizens + ambient_chatter_sources + ambient_loop_sources + event_sources
  - If actual > expected: sources are leaking. Identify and dispose orphans.
  - If actual < expected: sources failed to create. Check AudioContext state.
```

### Impulse Response Validation

```
ON LOAD (server start / asset load):
  - All 5 district-type IR files exist and decode successfully
  - Each IR sample rate matches AudioContext sample rate (44100Hz)
  - Each IR duration matches specification:
    Open piazza: 2.0-3.0s
    Narrow calle: 0.5-1.0s
    Canal-side: 1.0-2.0s
    Indoor (church): 3.0-5.0s
    Bridge: 0.8-1.5s
  - Each IR peak amplitude is between -6dBFS and 0dBFS (normalized, no clipping)
  - Total IR asset size < 1MB

ON DISTRICT TRANSITION:
  - Verify the newly activated ConvolverNode references the correct IR for the district type
  - Verify the crossfade completes within 2 seconds (start and end logged)
  - Verify the old ConvolverNode is disconnected after crossfade (not just muted)
```

### Zone Connectivity Graph

```
ON LOAD:
  - Every walkable zone has at least 1 connection to another zone
  - No disconnected subgraphs (all zones reachable from any other zone)
  - Zone boundaries do not overlap (each world position maps to exactly 1 zone)
  - Zone count matches the authored district layout

ON EVERY OCCLUSION CHECK:
  - Visitor zone is not null (visitor is always in a zone while in the city)
  - Source zone is not null (every citizen is always in a zone)
  - Zone-to-zone path length is computed correctly (0 = same, 1 = adjacent, 2+ = occluded)
  - Occlusion attenuation matches specification:
    same zone = 0dB
    adjacent = -6dB + LP 2kHz
    2+ boundaries = full cull
```
