# PATTERNS: narrative/events -- Design Philosophy

Events are where the invisible becomes visible. The physics engine runs in numbers -- energy, tension, thresholds. Citizens hold beliefs they never voice until asked. Moments accumulate salience silently. None of this is perceptible to the visitor walking through Venice. The events module is the translation layer: when a Moment flips, the world must change in ways the visitor can see, hear, and feel.

This is not a notification system. There is no toast popup saying "Political Uprising in Dorsoduro!" The visitor sees citizens gathering in a piazza. They hear raised voices. The fog thickens. The ambient music shifts. A market stall closes its shutters. The event is observable, not announced.

---

## Pattern 1: Events Are Observable, Not Announced

The zero-UI principle from `02_PATTERNS_Venezia.md` applies absolutely to events. There is no event log. There is no notification. There is no minimap with event markers. The visitor learns about events the way a 15th century Venetian would: by being there, by hearing about it from a citizen, or by seeing its aftermath.

An economic crisis at Rialto manifests as:
- Market stalls close (meshes removed or shuttered)
- Merchants stand idle instead of calling out prices
- Citizens in the area express anxiety in conversation
- Ambient audio shifts: the usual market bustle drops to murmurs and occasional shouts
- Fog increases subtly in the district

A celebration at San Marco manifests as:
- Citizens gather in the piazza (population density increases)
- Music plays (spatial audio source at the gathering point)
- Lanterns are lit if nighttime
- Citizens greet the visitor more warmly (trust threshold for greeting decreases temporarily)

The event system does not render effects directly. It emits event descriptors that other modules consume: atmosphere (fog, light, particles), citizens/population (movement, gathering, behavior), voice/spatial (ambient audio shifts), world/districts (prop state changes).

**Consequence for implementation:** The events module is a router, not a renderer. It classifies the event, determines affected area and citizens, computes severity, and broadcasts instructions to consuming modules. Each consumer decides how to manifest the instruction within its own constraints.

---

## Pattern 2: Event Classification Determines Response

Every Moment that flips has a `category` property. The category determines which response template activates:

| Category | Trigger Pattern | Spatial Effect | Citizen Effect | Audio Effect |
|----------|----------------|----------------|----------------|--------------|
| `economic_crisis` | Trade collapse, market failure, guild bankruptcy | Market stalls close, goods disappear | Merchants idle, worried posture, increased conversation about money | Quiet market, worried murmurs |
| `political_uprising` | Governance tension breaks, faction revolt | Citizens gather at political center | Shouting, agitated movement, citizen grouping by faction | Raised voices, crowd noise |
| `celebration` | Positive moment (festival, victory, wedding) | Decorations, lights, gathered citizens | Dancing, greeting, open posture | Music, laughter, bells |
| `personal_tragedy` | Individual citizen crisis (death, ruin, exile) | Stillness radiating from affected citizen | Nearby citizens approach or avoid, affected citizen changes posture | Silence spreading outward |
| `guild_dispute` | Trade guild conflict | Affected workshops close | Guild members congregate, non-members avoid area | Arguments, tool sounds stop |
| `trade_disruption` | Supply chain break, embargo, piracy | Ships absent from canal, warehouses empty | Dock workers idle, merchants anxious | Harbor sounds diminish |

Each category maps to a response template with parametric severity. Severity is derived from the Moment's salience at the time of flip (how far above threshold it went). Low severity is a ripple. High severity is a tsunami.

**Severity scale:**

```
0.0 - 0.3  MINOR    Local effect. One block. A few citizens affected.
                     Atmosphere barely shifts. Dissipates in 1 hour.
0.3 - 0.6  NOTABLE  District effect. Dozens of citizens adjust behavior.
                     Noticeable atmosphere change. Persists for 3-6 hours.
0.6 - 0.9  MAJOR    Multi-district. Most citizens aware. Atmosphere transforms.
                     Persists for 12-24 hours. Changes citizen conversation for days.
0.9 - 1.0  CRISIS   City-wide. Every citizen affected. World feels fundamentally
                     different. Persists until resolved by another event.
```

---

## Pattern 3: News Propagation Through Social Graph

Events do not become instantly known to all citizens. A citizen on the far side of Venice does not know about a market crisis in Rialto until someone tells them. News travels through the social graph at a realistic pace.

**Propagation model:**

```
t=0    (flip):     Citizens with WITNESS edges know immediately
t=15m  (1 tick):   Citizens in the same district with trust > 50 to witnesses
t=1h   (4 ticks):  Citizens in adjacent districts with trust > 30 to first-hop
t=3h   (12 ticks): All citizens in the city with trust > 20 to any informed citizen
t=6h   (24 ticks): Universal knowledge (all citizens aware)
```

Knowledge is stored as a BELIEVES edge from the citizen to a Narrative node representing the event. Confidence decreases with each hop: witnesses have confidence 1.0, first-hop 0.8, second-hop 0.6, universal 0.4. This means a citizen who heard about the crisis third-hand says "I heard there was trouble at Rialto" while a witness says "I was there when the guild master collapsed."

**Why this matters for conversation:** When a visitor asks a citizen about recent events, the citizen can only discuss events they know about (have a BELIEVES edge for). A citizen in Cannaregio may not know about something that happened in Dorsoduro 20 minutes ago. This is authentic. This is how cities work. Ignorance is not a bug.

---

## Pattern 4: Maximum Concurrent Events

The world can handle at most 3 active events simultaneously. An active event is one that has been emitted and whose effects are still visible (within its persistence duration based on severity).

Why 3? Because:
- The visitor can only pay attention to so much. A world with 7 simultaneous crises is not dramatic -- it is noise.
- The atmosphere system has limited channels. Fog, lighting, and audio can only shift along a few axes at once. Conflicting event atmospheres produce mud.
- The citizen behavior system can only apply one behavior modifier at a time. A citizen who is simultaneously celebrating, grieving, and rioting is incoherent.

**When the 4th event wants to fire:**
- If its severity is less than the lowest active event: suppress it. The Moment stays flipped but its world effects are delayed until a slot opens.
- If its severity is higher: it preempts the lowest-severity active event. That event's world effects end immediately, and the new event takes its slot.

This is a hard cap, not a soft limit. The events module maintains a priority queue of at most 3.

---

## Pattern 5: Forestiere News Injection

Venice is not isolated. Ships arrive with news from the outside world. The Forestiere news system translates real-world RSS feeds into 15th century context and injects them as new Narrative nodes.

**Pipeline:**

```
1. RSS reader pulls headlines from configured feeds (world news, economics, politics)
2. Claude API translates each headline to a 15th century Venetian context:
   "EU trade sanctions on Russia" -> "The Sultan has closed the Silk Road to Venetian merchants"
   "Tech company layoffs" -> "The glass-blowers of Murano dismiss apprentices by the dozen"
3. New Narrative node created in the graph with type "forestiere_news"
4. Energy injection: forestiere news starts at 0.5 energy (strong initial signal)
5. A randomly selected Forestiere citizen "arrives" with this news
6. News propagates from the docks outward via the social graph
```

**Frequency:** At most 1 Forestiere news injection per 24 hours. More than that turns the world into a news ticker. The outside world should be a distant rumble, not the main storyline.

**Translation quality is critical.** A bad translation breaks immersion completely. The Claude prompt must be specific: "Translate this modern headline into a plausible event that a 15th century Venetian merchant arriving by ship might report. Use the language and concerns of the period. Do not mention anything that could not exist in 1450. Keep it to one sentence."

---

## Pattern 6: 3D Effect Mapping

Each event category has a parametric 3D effect template. The events module does not execute these effects -- it emits a structured descriptor that the world and citizen modules consume.

**Event descriptor format:**

```json
{
  "event_id": "evt_001",
  "category": "economic_crisis",
  "severity": 0.65,
  "location": {"district": "Rialto", "x": 450, "z": 320},
  "radius": 150,
  "affected_citizens": ["citizen_042", "citizen_087", ...],
  "atmosphere": {
    "fog_delta": +0.03,
    "light_delta": -0.15,
    "particle_rate_delta": +10,
    "ambient_volume_delta": -0.2
  },
  "citizen_behavior": {
    "gather_point": null,
    "posture_override": "worried",
    "movement_speed_multiplier": 0.6,
    "conversation_topic_inject": "The market is failing. I have seen nothing like it."
  },
  "audio": {
    "ambient_layer": "market_distress",
    "spatial_sources": [
      {"type": "argument", "position": [440, 0, 310], "volume": 0.7}
    ]
  },
  "duration_minutes": 360,
  "created_at": "2026-03-11T14:30:00Z"
}
```

Each consuming module reads only the fields it cares about. The atmosphere module reads `atmosphere`. The citizen manager reads `citizen_behavior` and `affected_citizens`. The spatial audio system reads `audio`. No module needs to understand the full descriptor.

---

## Pattern 7: Events Create Narrative, Not Just Effects

A flipped Moment is not just a visual event. It reshapes the narrative graph. The events module is responsible for triggering the Narrator agent to generate consequences:

```
WHEN moment flips:
  1. Emit 3D event descriptor (immediate visual/audio effects)
  2. Invoke Narrator agent with moment context
  3. Narrator generates consequences:
     - New Narrative nodes (the aftermath, the reaction)
     - New TENSION edges (the event created new disagreements)
     - Modified BELIEVES edges (some citizens change their minds)
     - New Moment seeds (the aftermath has its own breaking points)
  4. Write consequences to graph
  5. Emit "narrative_update" so citizen context caches refresh
```

The Narrator is called asynchronously. The 3D effects are immediate (the world must react now), but the narrative consequences can take a few seconds to generate via Claude API. This means the visual manifestation of an event slightly precedes its narrative impact -- which is realistic. You see the crowd gathering before you understand why.

---

## Pattern 8: Event Lifecycle

Events are not instantaneous. They have a lifecycle:

```
EMERGING   (0-5 min):   Early signs. Atmosphere shifting. A few citizens changing behavior.
ACTIVE     (5-60 min):  Full manifestation. All effects applied. Citizens reacting.
SETTLING   (1-6 hours): Effects gradually fading. Citizens returning to routines.
                        Conversation references persist.
AFTERMATH  (6-24 hours): No visual effects. Citizens still discuss it. New tensions from it
                         are active in the graph. The event is now history.
RESOLVED   (24+ hours):  Event fully absorbed into narrative state. Only exists as
                         citizen memories and graph consequences.
```

The transition between phases is time-based (using the tick clock), not state-based. An event that was MAJOR spends more time in each phase than a MINOR one. The persistence duration from the severity scale determines total lifecycle length.

During EMERGING, effects are applied at 50% intensity. During SETTLING, they fade linearly to 0. This prevents jarring on/off transitions. The world eases into and out of events.

---

## Design Anti-Patterns

1. **The notification.** Never display event information as text, popup, or HUD element. The visitor discovers events by being present or by asking citizens. If the visitor misses an event because they were in another district, that is authentic. They hear about it later, second-hand, through the social graph.

2. **The spectacle.** Events are not cutscenes. The visitor does not lose control. The world shifts around them while they remain free to move, speak, and ignore. A political uprising is happening in the background, not in their face.

3. **The reset button.** Events do not undo when they end. A market crisis that closes stalls does not reopen them automatically when the event resolves. The stalls reopen when the economic simulation restores trade flow (which may take days). Events have permanent consequences.

4. **The random event.** No events are generated randomly. Every event is a Moment that flipped through physics. If the world needs more events, the solution is more energy injection or more tension in the graph, not a random event generator.

5. **The event bus overload.** Do not emit events on every physics tick for "ambient changes." Events are discrete, significant, narratively meaningful occurrences. The atmosphere system handles continuous ambient shifts based on aggregate mood and tension. Events are the punctuation, not the prose.

---

## Key Files

| What | Where |
|------|-------|
| Event emission point | `src/server/physics-bridge.js` (to be written) |
| Atmosphere consumer | `src/client/atmosphere/district-mood.js` (to be written) |
| Citizen behavior consumer | `src/client/citizens/citizen-manager.js` (to be written) |
| Audio consumer | `src/client/voice-chat.js` (extend existing) |
| Narrator agent | `/home/mind-protocol/the-blood-ledger/agents/narrator/` |
| Event propagation | `src/server/event-propagation.js` (to be written) |
| Venezia algorithm (event broadcast) | `docs/04_ALGORITHM_Venezia.md` section A5 |
| Physics patterns | `docs/narrative/physics/PATTERNS_Physics.md` |
| Graph patterns | `docs/narrative/graph/PATTERNS_Graph.md` |
