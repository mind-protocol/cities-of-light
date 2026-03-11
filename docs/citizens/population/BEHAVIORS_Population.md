# Citizens/Population -- Behaviors: What the Visitor Sees

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
THIS:            BEHAVIORS_Population.md (you are here)
PATTERNS:        ./PATTERNS_Population.md
ALGORITHM:       ./ALGORITHM_Population.md
SYNC:            ./SYNC_Population.md
IMPL:            src/client/citizens/citizen-manager.js (planned)
                 src/server/venice-state.js (planned)
```

---

## BEHAVIORS

### B1: Tier Transitions Are Invisible

**Why:** If the visitor notices a rendering switch -- a mesh popping in, a silhouette snapping to a skeleton -- the city becomes a rendering engine. A citizen approaching must undergo continuous emergence: colored shape gains silhouette, silhouette gains posture, posture gains face.

```
GIVEN:  A citizen is at AMBIENT tier (80-200m)
WHEN:   The visitor walks toward them, crossing the 80m threshold
THEN:   Over 0.5s the colored shape cross-fades into an ACTIVE figure
AND:    Heading, position, and movement direction are preserved throughout
AND:    At no point is the citizen invisible; no frame rate hitch occurs
```

```
GIVEN:  A citizen is at ACTIVE tier (20-80m)
WHEN:   The visitor approaches, crossing the 20m threshold
THEN:   Over 0.3s the figure gains facial detail, clothing texture, and full skeletal animation
AND:    Current posture carries through (hunched ACTIVE becomes hunched FULL)
AND:    If walking, stride phase is maintained across the transition
```

```
GIVEN:  A citizen is at any tier
WHEN:   The visitor increases distance past the hysteresis band (FULL->ACTIVE at 25m, ACTIVE->AMBIENT at 85m)
THEN:   Downgrade cross-fades over 0.5s; movement direction preserved as drift direction
AND:    The citizen does not flicker between tiers at boundary distances
```

### B2: Crowd Density Follows the Clock

**Why:** If density is uniform across time and space, the city feels staffed, not alive.

```
GIVEN:  The world time is morning (6:00-9:00)
WHEN:   The visitor walks through Rialto
THEN:   20-30 citizens visible; merchants at stalls, porters carrying loads between docks and market
AND:    Density notably higher than residential districts at the same hour
```

```
GIVEN:  The world time is midday (9:00-14:00)
WHEN:   The visitor is anywhere in the city
THEN:   Peak visibility; Rialto and San Marco densest; residential districts show moderate traffic
```

```
GIVEN:  The world time is evening (18:00-22:00)
WHEN:   The visitor walks through the city
THEN:   Markets emptier; tavern streets denser; movement biased away from commercial areas
AND:    Groups of 2-3 citizens walk together (social clustering, not random scattering)
```

```
GIVEN:  The world time is night (22:00-6:00)
WHEN:   The visitor explores
THEN:   Visible population drops ~70%; remaining are guards, Facchini, tavern stragglers
AND:    Large stretches empty; a lone figure at a fondamenta is conspicuous
```

### B3: District Boundaries Have Population Gradients

**Why:** Crossing a bridge should feel like moving between neighborhoods, not loading a new level.

```
GIVEN:  The visitor walks from Rialto (high density) toward Castello (lower density)
WHEN:   They cross the boundary bridge
THEN:   Density decreases gradually over 50-80m; overlap zone shows both district populations
AND:    Social class mix shifts across the boundary; no abrupt density change at the bridge
```

### B4: Citizens Appear and Disappear at the Edges of Perception

**Why:** Citizens beyond 200m are HIDDEN. Their arrival and departure at the render boundary must feel like walking into the distance, not spawning.

```
GIVEN:  A citizen crosses the 200m threshold (HIDDEN <-> AMBIENT)
WHEN:   They are approaching or departing
THEN:   They fade in/out over 1s on a logical path (street, fondamenta, bridge) -- never in empty space
AND:    They are already walking with direction consistent with their schedule; no freeze before fade
```

```
GIVEN:  The visitor turns their head rapidly
WHEN:   Citizens at the view frustum edge enter or leave visibility
THEN:   All citizens within 200m persist; only the 200m distance boundary controls HIDDEN transitions
```

### B5: 186 Citizens Feel Like a Living City

**Why:** A real Venice had 100,000+. 186 must feel like density through smart distribution, clustering, and ambient crowd texture.

```
GIVEN:  The visitor is in any district during daytime
WHEN:   They look around
THEN:   8-15 citizens visible across tiers; no direction completely empty of human presence
AND:    AMBIENT citizens fill the background on distant bridges and fondamenta
```

```
GIVEN:  The visitor is in a commercial district during peak hours (9:00-14:00)
WHEN:   They look toward the market
THEN:   25-35 citizens visible; AMBIENT crowd texture + murmur audio makes density feel higher than count
```

### B6: Off-Screen Citizens Continue Their Lives

**Why:** Citizens exist in simulation whether or not the visitor can see them. Entering a district must feel like arriving mid-scene, not triggering a scene to begin.

```
GIVEN:  The visitor spoke to a merchant at 9:00 and returns at 14:00
WHEN:   They find the merchant again
THEN:   The merchant is at their afternoon location; mood changed from off-screen trades
AND:    If asked "how was your morning?", the merchant references real events
```

```
GIVEN:  The visitor enters a district they have not visited this session
WHEN:   Citizens become visible
THEN:   Citizens are mid-activity (mid-stride, mid-conversation, mid-work)
AND:    No citizen stands idle at a spawn point; group conversations already in progress
```

```
GIVEN:  A world event occurred in a district the visitor was not in
WHEN:   The visitor arrives afterward
THEN:   Aftermath visible (displaced citizens, altered moods); the event was not deferred
```

### B7: Population Responds to World Events

**Why:** Crowds are barometers. Static population during dynamic events breaks the contract.

```
GIVEN:  A public event (trial, festival, procession) is occurring
WHEN:   The visitor approaches the event district
THEN:   Density elevated above normal; citizens cluster facing the event, not randomly distributed
AND:    Adjacent districts show reduced population; AMBIENT citizens near the event are stationary
```

```
GIVEN:  A dangerous event (fire, violence) breaks out
WHEN:   Citizens are within 30m
THEN:   Citizens disperse over 5-10s (some flee, some freeze, some approach out of duty)
AND:    Guards move toward the event; fled citizens do not return for 10+ world minutes
AND:    Distant AMBIENT citizens show no reaction (news has not reached them)
```

```
GIVEN:  An economic crisis (food shortage, trade collapse) affects the city
WHEN:   The visitor walks affected areas over multiple days
THEN:   Market density decreases gradually; citizens cluster near scarce resources
AND:    Redistribution over hours, not minutes
```

---

## OBJECTIVES SERVED

| Behavior | Objective | Why It Matters |
|----------|-----------|----------------|
| B1 | O2 (Spatial Presence) | Seamless tier transitions preserve the feeling of a real space |
| B2 | O3 (World Liveness) | Temporal density patterns prove the city has its own rhythm |
| B3 | O2 (Spatial Presence) | Gradual boundaries prevent level-loading feel between districts |
| B4 | O2 (Spatial Presence) | Natural appear/disappear prevents spawn-point artifacts |
| B5 | O1 (Authenticity) | 186 citizens distributed correctly feel like a living population |
| B6 | O3 (World Liveness) | Off-screen continuity proves the world does not revolve around the visitor |
| B7 | O6 (Emotional Impact) | Crowd response to events creates collective drama |

---

## EDGE CASES

### E1: VR Teleportation
```
GIVEN:  The visitor teleports 30+ meters via point-and-teleport locomotion
THEN:   Tier assignments recompute immediately; compressed crossfade (0.3s); no spawn delay
```

### E2: Mass Gathering Overload
```
GIVEN:  A major event draws 50+ citizens to one location
THEN:   FULL tier capped at 20 (performance governor); relationship citizens prioritized; 72fps held
```

### E3: Visitor Stationary for 10+ Minutes
```
GIVEN:  The visitor does not move
THEN:   Population changes organically as citizens arrive and depart; no short-cycle path loops
```

### E4: World Boundary
```
GIVEN:  The visitor is near the edge of the navigable city
THEN:   AMBIENT citizens visible beyond the boundary; the world does not appear to end
```

---

## ANTI-BEHAVIORS

### A1: No Spawn Clusters
```
MUST NOT: Multiple citizens appear simultaneously at the same location
INSTEAD:  Citizens already distributed at simulation positions; HIDDEN->AMBIENT fades are individual
```

### A2: No Uniform Distribution
```
MUST NOT: Citizens be evenly spaced like a grid
INSTEAD:  Cluster at activity nodes (stalls, taverns, workshops, bridges); paths between are sparse
```

### A3: No Identical Crowd Behavior
```
MUST NOT: AMBIENT citizens all move at the same speed or direction
INSTEAD:  Speed varies +/- 20%; direction path-dependent; occasional stops (pause at a bridge)
```

### A4: No Population Teleportation
```
MUST NOT: Citizens visibly jump positions when the visitor looks away and back within 5 seconds
INSTEAD:  Citizens within expected locomotion distance (walking speed x elapsed time)
```

### A5: No Event Blindness
```
MUST NOT: Citizens continue normal schedules during a world event that would attract or repel them
INSTEAD:  Population shifts toward or away from the event within 2-5 minutes of world time
```
