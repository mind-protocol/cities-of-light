# BEHAVIORS: world/atmosphere -- Observable Effects

What the visitor sees, hears, and feels as the atmosphere changes around them. Described from the outside. No implementation details, only observable behavior. All effects are continuous and blended -- the visitor never sees a discrete switch.

---

## B1. Day/Night Cycle Progression

The world has an accelerated day/night cycle. One full cycle takes approximately 96 real minutes. The visitor experiences time through light, shadow, sound, and citizen activity -- never through a clock or UI element.

### Dawn (05:00-07:00 in-world)

- Eastern sky lightens from deep indigo to pale orange. Fog is at its thickest -- ground mist fills canals and fondamenta below knee height.
- Shadows are long and soft, stretching westward. Stars fade out gradually by 06:30.
- Sound: the city is quiet. Water dominates. A bell marks the hour.

### Morning (07:00-12:00)

- Full sunlight from the east. Hard shadows in narrow streets -- alternating strips of sun and shade.
- Fog lifts. Ground mist burns off by 08:00. Atmospheric haze minimal by 10:00.
- Window glow is off. Sound layer thickens: market calls, conversation, footsteps.

### Afternoon (12:00-17:00)

- Sun overhead, shifting west. Shadows short at noon, lengthening eastward. Light at its whitest at noon, warming to gold by 15:00.
- Maximum visibility. Distant campanili sharp against the sky.

### Evening (17:00-20:00)

- Golden hour. West-facing facades glow amber. Grand Canal surface turns gold.
- Lanterns light sequentially -- Cannaregio first, spreading outward. Each lantern activates individually.
- Window glow returns. Stars appear in the eastern sky by 19:30. Market sounds recede; tavern sounds rise.

### Night (20:00-05:00)

- Deep blue-black sky with visible stars. Only lanterns, window glow, moonlight on water, and guard torches provide light.
- Building facades are silhouettes. Canal water reflects lantern light as shimmering highlights.
- Sound: water dominant. Footsteps echo. Distant voices carry further.

```
GIVEN the visitor is in the world at dawn
WHEN 4 real minutes pass (1 in-world hour)
THEN the sun position has moved visibly along its arc
  AND no discrete lighting change was perceived -- only gradual drift

GIVEN the visitor is outdoors at 19:00 in-world time
WHEN they observe the district
THEN lanterns in Cannaregio are lit before lanterns in Rialto

GIVEN the visitor is watching the sky at dusk (18:30-19:30)
WHEN stars begin to appear
THEN each star fades in gradually -- none pop into existence
```

---

## B2. Fog Behavior

Fog is the primary weather system. It is not white -- Venetian fog is tinted: golden at dawn, blue-grey at noon, amber at dusk, deep blue at night.

- **Ground fog** (0-2m): fills canals and fondamenta. Thickest at dawn and dusk, thin at midday. Drifts slowly. In VR, visible around the visitor's feet near water.
- **Atmospheric fog**: reduces distant visibility. Buildings beyond 40m become silhouettes during heavy fog. In narrow streets the effect is claustrophobic; in piazzas, disorienting.
- **Haze layer**: high-altitude softening of sunlight. Shadows lose hard edges. Sun disc has a halo.

Fog density fluctuates subtly -- never perfectly static, never abruptly changing.

```
GIVEN the visitor is on a fondamenta at dawn
WHEN they look toward the canal
THEN ground fog partially obscures the water surface with warm golden tint

GIVEN the visitor is in a narrow alley during heavy fog
WHEN they look forward
THEN buildings beyond 40m are invisible, at 20m partially obscured, within 5m fully visible
```

---

## B3. District Mood Shifts

Each district has an ambient mood from the aggregate emotional state of its citizens. The visitor perceives this as environmental atmosphere, not data.

- **Despair (0.0-0.25)**: fog thickens, light desaturates toward grey, particles slow, lanterns flicker, ambient audio pitch drops. The district feels subdued.
- **Unease (0.25-0.50)**: subtle fog increase, light cools with a blue shift, particle colors slightly desaturated.
- **Content (0.50-0.75)**: baseline Venice. Clear air, warm golden light, gentle particle drift. The district feels right.
- **Euphoria (0.75-1.0)**: light intensifies to saturated gold, particles multiply and glow, wind carries distant music. Rare, almost festival-like.

Transitions are gradual. Mood aggregates change on a 15-minute sync cycle; atmosphere lerps toward the new target over 60 seconds. District boundaries blend the two atmospheres -- no hard edges.

```
GIVEN a district has mood below 0.25
WHEN the visitor enters from a content neighbor
THEN they perceive increased fog, cooler light
  AND the transition takes approximately 2 seconds of smooth interpolation

GIVEN a district mood changes from 0.6 to 0.35
WHEN the mood aggregate updates
THEN atmospheric shift is gradual over approximately 60 seconds

GIVEN two adjacent districts have different moods
WHEN the visitor stands at the boundary
THEN the atmosphere blends between the two directions without a hard edge
```

---

## B4. Biometric Tint

If the visitor has linked their Garmin device, their stress level subtly modulates the world. The effect is indistinguishable from narrative atmosphere shifts -- the visitor cannot determine whether the world changed because of their body or the story.

- **Rest (0-25)**: no modulation. Baseline world.
- **Low (26-50)**: negligible. A 2% warmer fog tint at most.
- **High (51-75)**: fog density +10%, light shifts 5% toward cool blue, particles slow 15%.
- **Very high (76-100)**: fog density +20%, light desaturates 10%, subtle peripheral darkening. The world feels oppressive.

Biometric influence is capped at 20% of total atmosphere weight. Time-of-day is 50%, district mood is 30%.

```
GIVEN the visitor has linked Garmin and stress exceeds 75
WHEN they observe the world
THEN fog is denser than time and mood alone would produce
  AND peripheral vision is slightly darkened

GIVEN Garmin data is older than 30 minutes
WHEN the atmosphere evaluates biometric input
THEN biometric modulation is disabled entirely

GIVEN the visitor has NOT linked a Garmin device
WHEN they experience the world
THEN atmosphere is driven by time-of-day and district mood only
```

---

## B5. Ambient Particles

Particles make the air visible -- dust, moisture, ash, smoke. They give Venice's air volume and texture.

- **Rialto**: warm ochre dust. Dense near market stalls, slow updraft.
- **San Marco**: gold/white light motes. Sparse, drift laterally through sunbeams.
- **Castello**: cool blue-grey moisture. Dense near canals, slow horizontal drift.
- **Dorsoduro**: pale cream parchment dust. Clusters near notice boards, swirls in eddies.
- **Cannaregio**: warm amber candle smoke. Thin wisps rising, fading at 3m.
- **Santa Croce**: dark grey-orange forge ash. Fast upward, erratic.
- **Certosa**: pale green-gold pollen. Slow, organic, meandering.

Low district mood: particles slow, desaturate. High mood: particles multiply, brighten.

```
GIVEN the visitor walks from Rialto into Cannaregio
WHEN the district transition completes
THEN particle type transitions from ochre dust to amber candle wisps
  AND both types are briefly visible during crossover

GIVEN the visitor is in any district at night
WHEN lanterns are the primary light
THEN particles near lanterns are lit; particles outside lantern range are invisible
```

---

## B6. Atmosphere During World Events

When the Blood Ledger physics tick generates tension, the atmosphere responds before citizens speak about it.

- **Tension building**: fog thickens in the affected district, light cools, particles slow, ambient sound becomes quieter. The visitor may notice the mood before hearing any dialogue.
- **Tension breaking (crisis)**: sharp atmospheric shift. Fog thickens or clears depending on event type. Light flickers once. Sound drops to near-silence, then rises with event audio.
- **Aftermath**: atmosphere remains altered for in-world hours. Recovery is slow. Adjacent districts show faint sympathetic effects.

```
GIVEN a district's tension is rising
WHEN the visitor is present
THEN fog density increases over several real minutes
  AND the increase precedes citizen dialogue about the issue

GIVEN a crisis event fires
WHEN the visitor is within the district
THEN sharp atmospheric shift within 2-3 seconds
  AND ambient sound drops to near-silence before event audio begins

GIVEN a crisis occurred 2 in-world hours ago
WHEN the visitor enters the district
THEN atmosphere is still noticeably altered, recovery in progress
```

---

## B7. Seasonal Light and Catch-Up

V1 runs in perpetual late spring. Sun arc is moderately high. Dawn and dusk are warm amber/gold. Sky is pale Mediterranean blue. Daylight spans 05:00-20:00 (15 hours). Green is visible on Certosa; the built city is stone and water.

When the visitor returns after absence, the atmosphere fast-forwards at accelerated speed for 3-5 seconds until synced. The visitor perceives a brief time-lapse: light shifts, shadows sweep, fog thickens and thins. If the visitor returns within the same in-world hour, no catch-up occurs.

```
GIVEN the visitor left during in-world day and returns at in-world night
WHEN the session begins
THEN a brief accelerated light transition resolves within 3-5 seconds
  AND no loading screen is shown

GIVEN it is noon and district mood is despair and visitor stress is very high
WHEN the visitor observes the atmosphere
THEN the scene is fundamentally bright -- noon dominates
  AND brightness has a flat, desaturated quality from mood and stress
  AND the combined effect is uncomfortable brightness, not darkness
```
