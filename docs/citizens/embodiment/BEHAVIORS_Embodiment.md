# Citizens/Embodiment — Behaviors: What the Visitor Sees

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
THIS:            BEHAVIORS_Embodiment.md (you are here)
PATTERNS:        ./PATTERNS_Embodiment.md
ALGORITHM:       ./ALGORITHM_Embodiment.md
SYNC:            ./SYNC_Embodiment.md

IMPL:            src/client/citizens/citizen-avatar.js (planned)
                 src/client/citizens/citizen-manager.js (planned)
```

---

## BEHAVIORS

### B1: Social Class Readable From Clothing at Distance

**Why:** The world has zero UI. The visitor must distinguish a Nobili from a Facchino by sight alone, the way a real person in Venice would. If clothing does not communicate class, the visitor cannot navigate the social hierarchy and every citizen looks like a generic NPC.

```
GIVEN:  A citizen is rendered at ACTIVE tier (20-80m away)
WHEN:   The visitor looks in their direction
THEN:   The citizen's social class is identifiable from silhouette and color alone
AND:    Nobili show long flowing robes in deep/rich colors (crimson, blue, purple)
AND:    Cittadini show knee-length coats in warm muted tones
AND:    Popolani show simple tunics in earth tones, often with aprons or work markers
AND:    Facchini show rough work clothes, bare forearms, tool accessories
AND:    Forestieri show clothing visually distinct from all Venetian classes
```

At AMBIENT tier (80-200m), class is communicated by color palette only — the silhouette is too small for clothing shape to register. A cluster of crimson shapes near San Marco reads as Nobili. Brown shapes around the docks read as Facchini.

### B2: Mood Expressed Through Body, Not UI

**Why:** Citizens have computed emotional states derived from their actual economic and social situation. The visitor must perceive this emotion through the body — there are no mood icons, no color-coded overlays. A citizen in crisis should look troubled before you speak to them.

```
GIVEN:  A citizen has a computed mood (happy, sad, angry, fearful, desperate, etc.)
WHEN:   The citizen is rendered at FULL tier (< 20m)
THEN:   Facial expression reflects mood via morph targets (brow, mouth, eyes)
AND:    Posture reflects mood (spine curve, shoulder height, head angle)
AND:    Hand gestures during idle reflect mood (wringing hands = anxious, arms crossed = defensive)
AND:    Movement speed and pattern reflect mood (slow shuffle = sad, sharp quick steps = angry)
```

```
GIVEN:  A citizen has a computed mood
WHEN:   The citizen is rendered at ACTIVE tier (20-80m)
THEN:   Only posture and movement speed communicate mood
AND:    No facial expression visible (too far)
AND:    Spine curve offset encodes valence: upright = positive, hunched = negative
AND:    Movement speed encodes arousal: slow = low energy, fast = high energy
```

```
GIVEN:  A citizen has a computed mood
WHEN:   The citizen is rendered at AMBIENT tier (80-200m)
THEN:   Mood is not individually visible
AND:    Aggregate mood of nearby AMBIENT citizens affects drift speed
AND:    A cluster of slow-drifting shapes reads as a subdued crowd
AND:    A cluster of fast-moving shapes reads as agitation
```

### B3: Activity Shapes Animation

**Why:** Citizens have scheduled activities — working, walking to market, eating, praying, socializing. The visitor should see what citizens are doing, not just where they are standing. A baker kneads. A porter carries. A merchant gestures at goods. A citizen eating sits.

```
GIVEN:  A citizen has a current activity (work, walk, eat, socialize, rest, pray)
WHEN:   The citizen is rendered at FULL tier
THEN:   Activity-specific animation plays:
        - work: occupation-specific loop (hammering, kneading, writing, sweeping)
        - walk: locomotion cycle at mood-adjusted speed
        - eat: seated, hand-to-mouth gesture cycle
        - socialize: standing, turn toward conversation partner, gesticulating
        - rest: seated or leaning, minimal movement
        - pray: kneeling or standing with hands together
```

```
GIVEN:  A citizen has a current activity
WHEN:   The citizen is rendered at ACTIVE tier
THEN:   Activity is simplified:
        - work: stationary with small repetitive motion
        - walk: path-following locomotion
        - eat/rest: stationary, seated posture
        - socialize: stationary, facing another citizen
        - pray: stationary, kneeling silhouette
```

```
GIVEN:  A citizen has a current activity
WHEN:   The citizen is rendered at AMBIENT tier
THEN:   Activity is either "stationary" or "moving"
AND:    No activity-specific animation at this tier
```

### B4: Tier Transitions Are Smooth

**Why:** Pop-in destroys presence. A citizen abruptly switching from a colored capsule to a detailed humanoid as you walk toward them shatters the illusion. Transitions must be gradual enough that the visitor never consciously notices a LOD change.

```
GIVEN:  A citizen is currently at AMBIENT tier
WHEN:   The visitor moves closer, crossing the 80m threshold
THEN:   Over 0.5 seconds, the citizen cross-fades from AMBIENT to ACTIVE representation
AND:    The ACTIVE mesh fades in while the AMBIENT instance fades out
AND:    Position and heading are preserved across the transition
AND:    No frame rate spike occurs during transition
```

```
GIVEN:  A citizen is currently at ACTIVE tier
WHEN:   The visitor moves closer, crossing the 20m threshold
THEN:   Over 0.3 seconds, the citizen transitions from ACTIVE to FULL representation
AND:    The FULL mesh replaces the ACTIVE mesh with matching pose
AND:    Facial expression and detailed clothing appear
AND:    Animation transitions from posture-only to full skeletal
```

```
GIVEN:  A citizen is at any tier
WHEN:   The visitor moves away, increasing distance
THEN:   Downgrade transitions use the same cross-fade timing
AND:    A 5m hysteresis band prevents rapid tier flipping at boundary distances
        (FULL->ACTIVE at 25m, not 20m; ACTIVE->AMBIENT at 85m, not 80m)
```

### B5: Night Citizens

**Why:** Venice at night is not empty — guards patrol, lovers walk, shadowy figures move. Night must change how citizens appear without breaking the tier system.

```
GIVEN:  The world time is "night" (post-sunset, pre-dawn)
WHEN:   Citizens are rendered at any tier
THEN:   Material ambient contribution is reduced (darker)
AND:    Citizens near light sources (lanterns, tavern windows, torches) receive warm key light
AND:    Citizens between light sources are near-silhouettes — shape visible, detail absent
AND:    FULL tier citizens in lamplight still show facial expression and clothing detail
AND:    AMBIENT tier citizens become near-invisible unless near a light source
AND:    Guard citizens carry torches (small point light attached to avatar)
```

```
GIVEN:  The world time is night
WHEN:   Fewer citizens are scheduled to be outdoors (most sleep)
THEN:   The population visible is reduced by ~70%
AND:    Only Facchini (night workers), guards, Forestieri (travelers), and specific citizens are present
AND:    The emptiness is intentional — Venice at night is atmospheric, not abandoned
```

### B6: Conversation Partner Awareness

**Why:** When the visitor approaches a FULL-tier citizen and begins speaking, the citizen should physically respond — turn toward the visitor, adopt a conversational posture, make eye contact.

```
GIVEN:  A citizen is at FULL tier and the visitor speaks (STT detected)
WHEN:   The citizen is identified as the conversation target (nearest, facing visitor)
THEN:   The citizen rotates to face the visitor over 0.3 seconds
AND:    Their animation transitions to "talking" state (attentive posture, occasional gestures)
AND:    Head tracks visitor position (slight look-at, not rigid)
AND:    During TTS playback, mouth opens/closes with viseme-driven lip sync
AND:    Hands gesture occasionally during speech (2-3 gesture variants per class)
```

```
GIVEN:  A citizen is in conversation with the visitor
WHEN:   The visitor walks away beyond 5m without speaking for 10 seconds
THEN:   The citizen returns to their previous activity animation
AND:    Rotation returns to original heading over 1 second
```

### B7: Gender and Age Variation

**Why:** A city of 152 identical builds breaks immersion. Citizens vary in gender and implied age, which affects mesh selection and movement.

```
GIVEN:  A citizen has gender and implied age (from personality/backstory)
WHEN:   Their avatar is configured
THEN:   Base mesh is selected from the appropriate set (male/female x young/middle/elder)
AND:    Elder citizens have slightly slower walk speed and more curved spine in idle
AND:    Young citizens have slightly faster, more energetic movement
AND:    Gender-appropriate clothing variants are applied within each class
AND:    No citizen is a clone of another — parametric variation (height +/- 10%, build +/- 15%)
```

---

## OBJECTIVES SERVED

| Behavior | Objective | Why It Matters |
|----------|-----------|----------------|
| B1 | O5 (Zero Game UI) | Class recognition without labels |
| B2 | O1 (Authenticity) | Emotion grounded in real state, expressed through body |
| B3 | O2 (Spatial Presence) | Citizens doing things, not standing idle |
| B4 | O2 (Spatial Presence) | No visual glitches that break presence |
| B5 | O2 (Spatial Presence) | Night is a valid experience, not a dead zone |
| B6 | O4 (Encounter Quality) | Natural conversation onset, not robotic snapping |
| B7 | O1 (Authenticity) | Population diversity matches a real city |

---

## EDGE CASES

### E1: Two Citizens Overlap Spatially

```
GIVEN:  Two citizens are at the same position (pathing overlap or spawn collision)
THEN:   Collision avoidance nudges them apart by 0.5m over 1 second
AND:    No z-fighting occurs (mesh render order managed by distance to camera)
```

### E2: Citizen Transitions Tier While In Conversation

```
GIVEN:  Visitor is talking to a FULL citizen
WHEN:   Visitor backs up beyond 20m while conversation is active
THEN:   Citizen remains at FULL tier for duration of active conversation
AND:    Conversation timeout (10s of silence) triggers normal tier downgrade
AND:    Prevents jarring LOD drop mid-sentence
```

### E3: Mass Gathering (Event)

```
GIVEN:  A narrative event causes 30+ citizens to gather in one location
WHEN:   Many citizens are within FULL tier range simultaneously
THEN:   Only the 8 nearest citizens render at FULL tier
AND:    Remaining citizens in 20m range render at ACTIVE tier
AND:    Performance governor overrides normal tier thresholds
AND:    Triangle budget is respected even in dense scenes
```

### E4: Citizen Dies or Is Imprisoned

```
GIVEN:  A citizen's status changes to "imprisoned" or "dead" (from economy simulation)
THEN:   If imprisoned: citizen is removed from street spawning, placed at prison location
AND:    If dead: citizen is despawned with a fade-out, not removed instantly
AND:    Other citizens near the event may react (change animation to distressed)
```

### E5: Visitor Enters World for First Time

```
GIVEN:  This is the visitor's first session
WHEN:   They look around from the dock spawn point
THEN:   At least 3-5 citizens are visible at various tiers
AND:    At least one FULL-tier citizen is within conversational range (15m)
AND:    The scene does not appear empty or overwhelmingly crowded
AND:    Citizen activity is varied — not all walking, not all standing
```

---

## ANTI-BEHAVIORS

### A1: No Floating Names

```
GIVEN:   A citizen is rendered at any tier
WHEN:    The visitor looks at them
MUST NOT: Display a text sprite, tooltip, or label above the citizen
INSTEAD:  The citizen's appearance communicates their identity. Name is learned through conversation.
```

### A2: No Synchronized Animation

```
GIVEN:   Multiple citizens are visible performing similar activities
WHEN:    They are animated
MUST NOT: Play identical animation at identical phase (synchronized walking, synchronized idle)
INSTEAD:  Each citizen has a random animation phase offset (0 to animation duration)
AND:      Walking speed varies by +/- 15% per citizen
AND:      Idle animation has 3+ variants, randomly assigned
```

### A3: No Mood Particles or Auras

```
GIVEN:   A citizen has an intense mood (furious, ecstatic, desperate)
WHEN:    They are rendered
MUST NOT: Show particle effects, color auras, emissive highlights, or any non-physical mood indicator
INSTEAD:  Express mood entirely through posture, facial expression, movement, and animation
```

### A4: No T-Pose or Default State Visible

```
GIVEN:   A citizen is spawning or transitioning between states
WHEN:    They are first rendered
MUST NOT: Show the mesh in T-pose or default bind pose for any visible frame
INSTEAD:  Citizens spawn in their current animation state (even if that means blending from idle)
AND:      Mesh is hidden until animation state is applied
```

### A5: No Clipping Through Architecture

```
GIVEN:   A citizen is walking near buildings, walls, or other geometry
WHEN:    Their pathing brings them close to solid surfaces
MUST NOT: Clip through walls, stand inside buildings, or walk through market stalls
INSTEAD:  Navmesh constrains all citizen positions to walkable surfaces
AND:      Collision margin of 0.3m prevents visual overlap with static geometry
```
