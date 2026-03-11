# PATTERNS: world/atmosphere — Design Philosophy

## Responsibility

Make Venice feel alive through non-citizen environmental systems. Day/night cycle, weather (fog, rain), district mood (ambient shifts from citizen mood aggregate), ambient particles, and biometric integration (Garmin stress data tinting the world). The atmosphere is the emotional backdrop of the world. Citizens populate it; atmosphere colors it.

The atmosphere system is the primary channel through which the visitor perceives time, tension, and collective emotion — without a single UI element. A tense district feels tense because the light is wrong. A prosperous morning feels warm because the fog lifts gold. The visitor never reads a mood meter. They feel it.

---

## Decision 1: Accelerated Day/Night, Not Real-Time

Real-time day/night does not work. Visitors arrive at 2pm and leave at 2:30pm. In real time, the light would not visibly change. Venice at night — the lanterns, the reflections on dark water, the emptied piazzas — is too important to gate behind a clock.

The day/night cycle runs at **1 hour = 4 real minutes**. A full 24-hour cycle takes 96 minutes. A typical 30-minute session spans roughly 7 in-world hours. The visitor sees sunrise, noon heat, golden hour, and dusk within a single session if they stay long enough.

The cycle drives:

- **Sun position** — azimuth and elevation via the existing Preetham Sky model. Sunrise at east, arc overhead, set at west.
- **Directional light color** — warm orange at dawn/dusk, white-blue at noon, deep amber at sunset.
- **Hemisphere light balance** — sky color shifts from indigo (night) through pale blue (day) to orange (evening). Ground color shifts from dark stone (night) to warm sandstone (day).
- **Shadow length and softness** — long soft shadows at dawn/dusk, short hard shadows at noon.
- **Window glow** — emissive intensity on building windows increases from dusk through night. Warm interior light visible from the fondamenta.
- **Star visibility** — star opacity fades in from sunset to full night, fades out at dawn. Reuses the existing star system from `scene.js`.

The cycle is **continuous, not stepped**. No sudden transitions. Every parameter lerps smoothly. The visitor should never notice a "switch" — only realize, minutes later, that the light has changed.

Catch-up behavior: when the visitor returns after absence, the world clock advances to current simulation time. No abrupt jump — fast-forward the cycle at 10x speed for a few seconds until synced.

---

## Decision 2: Venetian Fog as Primary Weather

Venice is defined by fog. Not rain, not snow — fog. The acqua alta mist rolling in from the lagoon at dawn. The midday haze softening distant campanili. The evening fog that erases the horizon and turns lantern light into halos.

Fog is the **only weather system for V1**. Rain and storms are out of scope.

Fog has three layers:

| Layer | Height | Behavior | Visual |
|---|---|---|---|
| **Ground fog** | 0-2m | Fills canals and low fondamenta. Thickens at dawn, thins by noon, returns at dusk. | Particle system: slow horizontal drift, per-particle opacity fade. |
| **Atmospheric fog** | Scene-wide | `THREE.FogExp2` density modulation. Reduces far visibility. | Existing fog system from `zone-ambient.js`, but density now varies with time and weather state. |
| **High haze** | Cloud layer | Softens sun. Reduces shadow contrast. | Modify cloud layer opacity from `scene.js`. Thicker haze = softer light. |

Fog density is driven by three inputs:

1. **Time of day** — thickest at dawn (5:00-7:00), thins through morning, minimal at noon, returns at dusk (18:00-20:00), moderate through night.
2. **Narrative tension** — when the Blood Ledger physics tick reports high aggregate tension in a district, fog thickens there. Tension makes the world literally harder to see through.
3. **Biometric stress** (optional) — if the visitor's Garmin data reports elevated stress, a subtle fog tint shift occurs. Not a gameplay mechanic; a resonance.

The fog color is NOT white. Venetian fog is **warm**: golden at dawn, blue-grey at noon, amber at dusk, deep blue at night. The fog color tracks the sun color with a slight lag, creating the haze-through-light effect that defines Venice's visual identity.

---

## Decision 3: District Mood from Citizen Aggregate

Each district has an ambient mood derived from the aggregate emotional state of its citizens. This is the bridge between the economy/narrative layer and the atmosphere system.

The mood aggregate is computed server-side (in `venice-state.js`) on each Airtable sync cycle. For each district:

1. Collect all citizens whose current position is within the district boundary.
2. Average their `mood` values (0.0 = despair, 1.0 = euphoria).
3. Weight by citizen tier: FULL citizens contribute 3x, ACTIVE 1x, AMBIENT 0.5x. This prevents ambient filler citizens from washing out the signal from meaningful characters.
4. The result is a single float per district: `district.moodAggregate` (0.0-1.0).

The mood aggregate drives per-district atmosphere parameters:

| Mood Range | Atmosphere Effect |
|---|---|
| **0.0-0.25** (despair) | Fog thickens. Light desaturates toward grey. Particle drift slows. Ambient audio pitch drops slightly. Lanterns flicker. |
| **0.25-0.50** (uneasy) | Subtle fog increase. Light slightly cooled (blue shift). Normal particle speed. |
| **0.50-0.75** (content) | Clear air. Warm golden light. Particles drift gently upward. Standard Venice beauty. |
| **0.75-1.0** (euphoria) | Light intensifies — saturated gold. Particles multiply and glow. Warm wind sound. Almost festival-like. Rare state. |

These transitions are **gradual**. The mood aggregate changes on a 15-minute sync cycle. The atmosphere system lerps toward the new target over 60 seconds. The visitor experiences a slow emotional drift in the environment, not a sudden mood swing.

District boundaries create atmosphere edges. When the visitor walks from a content Rialto into a despairing Castello, the fog thickens and the light cools as they cross the boundary. The transition uses the same lerp mechanism as `ZoneAmbient` — ~2 seconds of smooth interpolation.

---

## Decision 4: Ambient Particles as Texture, Not Decoration

Particles are not sparkles. They are the dust motes in a shaft of light through a window. The moisture droplets catching lantern glow. The ash from a smith's forge in Santa Croce. They make the air visible and give the world volume.

Particle types per district:

| District | Particle Type | Color | Behavior |
|---|---|---|---|
| **Rialto** | Dust/spice | Warm ochre | Dense near market stalls, slow updraft |
| **San Marco** | Light motes | Gold/white | Sparse, catch sunbeams, drift laterally |
| **Castello** | Moisture | Cool blue-grey | Dense near canals, slow horizontal drift |
| **Dorsoduro** | Parchment dust | Pale cream | Near notice boards, swirl in clusters |
| **Cannaregio** | Candle smoke | Warm amber | Thin wisps, rise slowly, fade at 3m |
| **Santa Croce** | Forge ash | Dark grey-orange | Near workshops, fast rise, erratic |
| **Certosa** | Pollen/seeds | Pale green-gold | Slow drift, wide spacing, organic paths |

All particles share ONE geometry buffer (instanced `Points`). The existing `PointsMaterial` from `scene.js` is extended with per-particle color and size variation. Maximum 500 particles visible at once (within Quest 3 budget). Particles are spawned within a 30m radius of the visitor and recycled when they exit this radius.

Particle behavior responds to mood aggregate: low mood slows particles and desaturates their color. High mood increases count and brightens emission.

---

## Decision 5: Biometric Integration — Garmin Stress as World Tint

This is the most distinctive feature. The visitor's real physiological state modulates the world's appearance.

If the visitor has linked their Garmin device (via the existing `garmin_reader.py` pipeline), their current stress level is available server-side. The atmosphere system receives this as a single value: `visitor.stress` (0-100).

The biometric effect is **subtle**. It is NOT a gameplay mechanic. The visitor should not be able to tell whether the world changed because of their stress or because of the narrative. The two signals blend.

| Stress Level | Atmosphere Modulation |
|---|---|
| **0-25** (rest) | No change. World at baseline. |
| **26-50** (low) | Negligible. Perhaps 2% warmer fog tint. |
| **51-75** (high) | Fog density +10%. Light color shifts 5% toward cool blue. Particle speed decreases 15%. |
| **76-100** (very high) | Fog density +20%. Light desaturates 10%. Subtle peripheral darkening (post-processing vignette). World feels slightly oppressive. |

Critical constraints:

- **Privacy**: stress data never leaves the server. The client receives atmosphere parameters, not biometric values. No one watching over the visitor's shoulder can tell their stress level from the screen.
- **Opt-in only**: biometric integration requires explicit consent. Without it, the atmosphere uses narrative/time inputs only.
- **Graceful absence**: if Garmin data is stale (>30 minutes old), biometric modulation is disabled. No stale data driving the world.
- **Blended, not dominant**: biometric influence is capped at 20% of total atmosphere weight. Time-of-day is 50%, district mood is 30%, biometric is 20%.

---

## Decision 6: No Season System for V1

Seasons affect Venice profoundly — acqua alta flooding in autumn, carnival in February, summer tourist crush, spring light. But seasons require:

- Economic impact modeling (seasonal trade routes, harvest cycles)
- Citizen behavior changes (festivals, indoor winter patterns)
- Vegetation changes (Certosa)
- Water level changes (acqua alta physics)

This is too much coupling for V1. The world runs in **perpetual late spring** — the most visually pleasant and narratively neutral season. Seasons are a V2 feature when the economic simulation has seasonal cycles to drive them.

---

## Decision 7: Atmosphere Update Budget

The atmosphere system must not exceed **0.5ms per frame** on Quest 3. Budget:

| Operation | Budget | Strategy |
|---|---|---|
| Fog density lerp | 0.01ms | Single float lerp, trivial |
| Light color lerp | 0.02ms | THREE.Color.lerp, 3 components |
| Particle update | 0.3ms | 500 particles, position += velocity, recycle check |
| Sun position | 0.02ms | Spherical coords from time, once per frame |
| Sky uniform update | 0.01ms | Set 2 uniforms on sky shader |
| District mood blend | 0.05ms | Only on zone change or every 60 frames |
| Biometric tint | 0.01ms | Single lerp target update, applied via existing fog/light path |

Total: ~0.42ms. Leaves headroom within the 14ms frame budget.

Particle recycling is amortized: recycle at most 10 particles per frame. If 50 need recycling (visitor teleported), spread over 5 frames.

---

## What Is In Scope

- Day/night cycle (accelerated, 96-minute full cycle)
- Sun position, directional light, hemisphere light modulation
- Star fade-in/fade-out tied to time
- Window emissive glow at night
- Venetian fog (ground particles + atmospheric FogExp2 + haze)
- Fog density driven by time, narrative tension, biometric stress
- District mood aggregate computation and atmosphere response
- Per-district ambient particle systems (instanced, recycled)
- Biometric integration (Garmin stress as subtle world tint)
- Cloud layer opacity modulation (haze)
- Smooth transitions on district boundary crossing

## What Is NOT In Scope

- Rain, snow, or storms (V2)
- Season system (V2)
- Acqua alta / water level changes (V2)
- Lightning / thunder (V2)
- Wind simulation affecting geometry (cloth, flags, water ripple direction)
- Dynamic skybox (painted sky changes, aurora, comets)
- Per-building interior lighting simulation
- Sound-driven atmosphere (audio reactive visuals)
- Visitor-controlled time (no "skip to night" button — the world is the interface)

---

## Relationship to Existing Code

The atmosphere system extends and replaces parts of the current `scene.js` and `zone-ambient.js`:

- `scene.js` sun position is currently **static** (`SUN_ELEVATION = 12`, `SUN_AZIMUTH = 220`). The atmosphere system makes these dynamic, driven by the accelerated clock.
- `scene.js` sky uniforms (turbidity, rayleigh, mie) are currently fixed. The atmosphere system modulates them per time-of-day.
- `zone-ambient.js` currently lerps fog color, fog density, particle color, and hemisphere light based on zone proximity. The atmosphere system subsumes this: zone transitions still drive lerp targets, but the targets themselves now vary with time, mood, and biometric state.
- The cloud layer from `scene.js` (`buildClouds()`) is preserved. Its opacity becomes a dynamic parameter driven by haze state.
- The star system from `scene.js` is preserved. Its opacity becomes time-driven (visible at night, hidden during day).
- The `Water` material from `scene.js` is not touched by atmosphere. Canal water color is a district property, not an atmosphere property.
