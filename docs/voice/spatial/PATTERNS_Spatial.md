# PATTERNS -- Spatial Audio

> Design philosophy for audio spatialization in Venezia.
> Sound is geography. If you close your eyes, you should know where you are.

---

## Core Principle: Audio Is the World's Texture

Venice is a city of echoes. Water slapping against stone. Bells from campanili
drifting across the lagoon. Crowd murmur funneled through narrow calli. The
visitor learns the city through sound before they learn it through sight.

Spatial audio is not decoration. It is the primary mechanism by which the world
communicates depth, distance, and district identity. A flat-mixed Venice is a
dead Venice.

```
Visitor turns head  -->  soundscape shifts  -->  brain builds spatial map
Visitor enters calle -->  reverb tightens    -->  brain feels enclosure
Visitor nears Rialto -->  market roar grows  -->  brain anticipates crowd
```

---

## The Three Audio Layers

Every sound in Venezia belongs to exactly one of three layers. Each layer has
its own processing chain, its own priority, and its own spatial treatment.

### Layer 1: Voice (Citizens Speaking)

The foreground. Citizen TTS responses, ambient citizen-to-citizen conversations.
Each voice is positioned at the citizen's exact 3D location. HRTF panning makes
the voice come from the right direction. Distance attenuation makes far citizens
faint, near citizens present.

- One PannerNode per active voice source
- HRTF panning model (binaural on headphones, fallback to equalpower on speakers)
- Inverse distance model, refDistance=1m, maxDistance=50m, rolloffFactor=1.5
- Direct citizen responses: full volume at their position
- Ambient citizen chatter: -6dB gain reduction (background texture, not foreground)

### Layer 2: District Ambient

The middle ground. Continuous loops that define the sonic identity of each
district. These never stop. They crossfade as the visitor moves between areas.

Each district has a signature ambient profile:

| District     | Primary            | Secondary          | Accent              |
|-------------|--------------------|--------------------|---------------------|
| Rialto      | Market crowd roar  | Water lapping      | Merchant calls      |
| San Marco   | Piazza echo        | Pigeons             | Distant bells       |
| Dorsoduro   | Quiet water        | Wind through trees | Gondolier singing   |
| Cannaregio  | Residential hum    | Footsteps on stone | Children playing    |
| Murano      | Furnace rumble     | Glass clinking     | Heat hiss           |

Ambient layers are not point sources. They are zone-wide envelopes rendered
through stereo panning with subtle positional bias (water sounds come from canal
direction, market sounds come from stall clusters).

- 2-4 simultaneous audio loops per district
- Crossfade duration: 3 seconds when transitioning districts
- Volume keyed to district density: crowded districts are louder
- Time-of-day modulation: night districts are quieter, wind is more prominent

### Layer 3: Events and Effects

The punctuation. One-shot sounds triggered by narrative events, citizen actions,
or environmental occurrences. A bell tolling. A glass breaking. A crowd gasping
at a public accusation. Thunder.

- Point-sourced: positioned at the event's 3D location
- Duration: 1-10 seconds typically
- Priority: can temporarily duck ambient layer by -3dB
- Reverb matches the current district profile

---

## Priority System

Quest 3 handles up to 32 simultaneous Web Audio sources before performance
degrades. The priority system ensures the most important sounds survive when
the budget is tight.

### Priority Tiers

```
Tier 0: CRITICAL (max 2 sources)
  - The citizen currently responding to the visitor
  - Narrative event audio (bell toll, crowd reaction)

Tier 1: FOREGROUND (max 6 sources)
  - FULL-tier citizens within 10m speaking to each other
  - Event sound effects in the visitor's district

Tier 2: ACTIVE (max 8 sources)
  - ACTIVE-tier citizen ambient chatter within 20m
  - District accent sounds (merchant calls, singing)

Tier 3: AMBIENT (max 16 sources)
  - District ambient loops (water, wind, crowd)
  - Distant bells, weather sounds
```

**Total budget: 32 sources.** When a new sound requests a slot and the budget
is full, the lowest-priority sound with the greatest distance from the visitor
is stopped. No sound in a higher tier is ever displaced by a lower tier.

### The Priority Queue

```
on_new_audio_request(source, tier, position):
    if active_sources.count < 32:
        activate(source)
        return

    // Budget full — find a victim
    candidates = active_sources.filter(s => s.tier >= tier)
    if candidates.empty:
        drop(source)  // Cannot displace higher priority
        return

    victim = candidates.sort_by(distance_to_visitor).last()
    deactivate(victim)  // Fade out over 200ms
    activate(source)
```

---

## HRTF and Panning

All positioned audio uses the Web Audio API PannerNode with HRTF model. This
is the only spatialization technology available in the browser that produces
convincing binaural output on headphones (which Quest 3 always uses).

### PannerNode Configuration (per source)

```javascript
panner.panningModel = 'HRTF';
panner.distanceModel = 'inverse';
panner.refDistance = 1;       // Full volume at 1m
panner.maxDistance = 50;      // Inaudible beyond 50m
panner.rolloffFactor = 1.5;  // Moderate falloff curve
panner.coneInnerAngle = 360; // Omnidirectional (citizens speak in all directions)
panner.coneOuterAngle = 360;
```

### Listener Update

The AudioContext listener must be updated every frame from the camera/headset
transform. Both position and orientation (forward + up vectors) are required
for correct HRTF rendering. The existing `SpatialVoice.updateListener()` and
`VoiceChat.updatePositions()` already do this correctly.

### Resonance Audio: Rejected

Google's Resonance Audio SDK provides room modeling, early reflections, and
ambisonics. It was considered and rejected:

- **Unmaintained** since 2021. No active development, no bug fixes.
- **WASM dependency** adds ~300KB to the client bundle.
- **Web Audio API HRTF** is built into every browser, zero dependency, GPU-accelerated on Quest.
- **Room modeling** can be approximated with ConvolverNode reverb presets (see below).

The marginal quality improvement does not justify the maintenance risk and bundle cost.

---

## Reverb Per District

Venice's acoustic character changes dramatically between a wide piazza and a
narrow calle. Reverb communicates this to the visitor's ears.

### Implementation: ConvolverNode with Impulse Responses

Each district type maps to a pre-recorded impulse response (IR):

| District Type    | IR Character                    | RT60    |
|------------------|---------------------------------|---------|
| Open piazza      | Long, diffuse, bright           | ~2.5s   |
| Narrow calle     | Short, tight, colored           | ~0.8s   |
| Canal-side       | Medium, wet (water reflections) | ~1.5s   |
| Indoor (church)  | Very long, dark, cavernous      | ~4.0s   |
| Bridge           | Open above, reflective below    | ~1.2s   |

One ConvolverNode per district type. The visitor's current district determines
which ConvolverNode is active. On district transition, crossfade between
reverb profiles over 2 seconds (matching the ambient crossfade).

All voice audio routes through the active ConvolverNode via a wet/dry mix:
- Direct speech: 80% dry, 20% wet (intelligibility first)
- Ambient chatter: 50% dry, 50% wet (blends into environment)
- Event sounds: 30% dry, 70% wet (dramatic, spatial)

### IR Source

Free IR libraries (OpenAIR, EchoThief) provide real-world impulse responses.
Select 5 IRs that match the district archetypes. Total asset size: ~500KB
(16-bit, 44.1kHz, mono, 2-4 seconds each).

---

## Occlusion

Sound does not pass through stone walls. A citizen on the other side of a
building should be muffled or inaudible.

### Zone-Based Occlusion (Chosen)

Raycast occlusion (casting rays from listener to each source, testing
intersection with building geometry) is correct but expensive. On Quest 3, each
raycast against the Venice mesh costs ~0.1ms. With 32 audio sources, that is
3.2ms per frame -- 23% of the frame budget consumed by audio occlusion alone.

Zone-based occlusion is the alternative:

- Venice is divided into **acoustic zones** (aligned with walkable areas:
  piazzas, calli, canal edges, bridges, interiors).
- Each zone has a **connectivity graph**: which zones can "hear" each other
  directly, which are separated by walls.
- If the visitor and a sound source are in the same zone: no occlusion.
- If they are in adjacent connected zones: -6dB attenuation + low-pass at 2kHz.
- If separated by 2+ zone boundaries: source is culled entirely.

This is a lookup table, not a per-frame computation. Zone membership is already
computed for the zone-ambient system. Cost: O(1) per source.

### Raycast Occlusion: Deferred

If zone-based occlusion proves too coarse (sounds leaking through walls in
obvious ways), a single-ray occlusion pass can be added as a refinement:

- Cast one ray per FOREGROUND source per frame (max 6 rays)
- Use a simplified collision mesh (bounding boxes, not full geometry)
- Cost: ~0.6ms total, acceptable

This is a Phase 4 polish item. Zone-based occlusion ships first.

---

## The Non-Negotiables

1. **Every citizen voice is spatially positioned.** Flat stereo playback is
   never acceptable. The PannerNode is mandatory for all speech audio.

2. **District ambient never goes silent.** Even if all citizens leave, the
   water still laps, the wind still blows. Silence means a bug.

3. **Priority system enforces the 32-source budget.** No source is created
   without checking the budget. Exceeding it causes audio glitches on Quest.

4. **Reverb matches the space.** A voice in a narrow calle must not sound like
   it is in a cathedral. The ConvolverNode switches with the district.

5. **Occlusion is zone-based first, raycast never.** Performance over
   perfection. The visitor will not notice zone-boundary artifacts if the
   zones are well-authored. They will notice 72fps dropping to 50fps.
