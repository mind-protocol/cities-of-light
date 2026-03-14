# Serenissima Asset Pipeline -- Behaviors: What the Visitor Witnesses

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## CHAIN

```
OBJECTIVES:      ./OBJECTIVES_Serenissima.md
BEHAVIORS:       BEHAVIORS_Serenissima.md (you are here)
PATTERNS:        ./PATTERNS_Serenissima.md
ALGORITHM:       ./ALGORITHM_Serenissima.md
VALIDATION:      ./VALIDATION_Serenissima.md
IMPLEMENTATION:  ./IMPLEMENTATION_Serenissima.md
SYNC:            ./SYNC_Serenissima.md

IMPL:            src/server/physics-bridge.js
                 src/server/ai-citizens.js
                 src/server/graph-client.js
```

> **Contract:** Read docs before modifying. After changes: update IMPL or add TODO to SYNC. Run tests.

---

## BEHAVIORS

The visitor walks into Serenissima and sees a city. Not a simulation. Not a game world. A city where 200 people are going about their lives, and some of them happen to be willing to talk to you. The visitor never sees a consciousness level. Never sees an energy budget. Never knows which citizens are running on full LLM articulation and which are running on pure graph reflexes. They see a glassblower wiping sweat from his brow. They see a merchant arguing with a supplier. They see a priest walking slowly along the canal, lost in thought. The architecture that produces these behaviors is invisible. What follows is what the visitor actually experiences.

---

### B1: Citizens Live at Different Depths

**Why:** 200+ citizens cannot all run full LLM sessions. The three consciousness levels -- full, minimal, subconscious -- distribute cognitive resources across the population so the city feels alive everywhere, not just around the visitor.

A visitor walking through Rialto passes dozens of citizens. Most are at subconscious level -- going about routines, carrying goods, tending stalls, nodding to passersby. Their behavior is driven entirely by Law 17 action nodes and graph energy patterns. They are not frozen. They are not looping. They have purposes and they pursue them. But they do not initiate complex conversation.

When the visitor approaches a citizen and speaks, that citizen's consciousness level rises. Budget permitting, they enter full consciousness within one tick. Their Working Memory coalition assembles -- the 5-7 most activated nodes in their graph -- and crosses the bridge to Channel 1. Now the citizen can articulate. They can hold a conversation about their craft, their worries, the state of the market. They can form opinions about what the visitor says. They can remember this conversation after it ends (as new moment nodes in the graph).

When the visitor walks away, the citizen's consciousness gradually drops. Within a few ticks, they return to minimal or subconscious. But the conversation persists in their graph. The next visitor who speaks to them may hear references to the earlier exchange -- not because a prompt told them to remember, but because the moment node from that conversation still has energy.

```
GIVEN:  A visitor approaches a citizen at subconscious level
WHEN:   The visitor initiates conversation
THEN:   The citizen's consciousness rises to full within 1 tick (if budget permits)
AND:    Their WM coalition (5-7 nodes) is assembled from graph state
AND:    The LLM receives these nodes and produces articulated speech
AND:    The visitor perceives a citizen who "notices" them and engages naturally
```

The visitor standing in a crowded piazza sees a spectrum of behavior. The citizen they are talking to is fully articulate. The citizen nearby who overheard a word is at minimal -- they might glance over, or mutter something relevant. The citizens across the square are at subconscious -- carrying on with their routines, unaware of the conversation. This gradient is not rendered as a debug overlay. It is experienced as the natural attention distribution of a crowd.

---

### B2: Supply Chain Disruptions Ripple Through Mood

**Why:** Economic and cognitive logistics are the same system. When goods stop flowing, frustration flows instead.

A visitor who has been in Murano for a few hours notices the glassblowers are in good spirits. Business is steady. Silica arrives on schedule. The furnaces burn bright. The energy flowing through economic edges is healthy -- surplus from completed trades feeds satisfaction in the limbic motor. The glassblowers' graphs are energized around achievement and care nodes. They are proud of their work and warm to visitors.

Then a supply ship fails to arrive. The seeding script or the economy tick reduces energy on the supply edge. Silica stocks drop. The physics tick propagates the deficit: surplus dries up on the relevant edges, the glassblowers' achievement drives go hungry, self-preservation drives activate. Within 2-3 ticks (10-15 minutes), the visitor notices a shift. The first glassblower they revisit is curt: "Not a good time. We're waiting on materials." The second is distracted, looking toward the canal. The third is arguing with a supplier about alternative sources.

None of this was scripted. The economy tick changed energy on supply edges. The physics tick propagated the deficit. The limbic motor shifted drive priorities. The WM coalition now includes frustration-related and self-preservation nodes instead of achievement and craft nodes. The LLM, reading these different nodes, produces different speech.

```
GIVEN:  An economic disruption reduces energy on supply edges in a district
WHEN:   2-3 physics ticks propagate the deficit through citizen graphs
THEN:   Citizens in the affected district exhibit frustration, worry, or problem-solving behavior
AND:    Citizens in connected districts begin hearing about the disruption through gossip edges
AND:    The visitor perceives a district whose mood has shifted without any announcement
```

---

### B3: New Narratives Crystallize From Repeated Interaction

**Why:** The city must grow new stories, not just replay seeded ones. Law 10 crystallization creates genuine novelty from the interaction of existing beliefs.

A visitor talks to a merchant about tariffs three times over the course of an afternoon. Each conversation creates a moment node in the merchant's graph. The moment nodes connect to existing narrative nodes about trade, about the tariffs, about the visitor. After the third conversation, the co-activation between "tariff concerns" and "this visitor's perspective" exceeds the crystallization threshold.

A new narrative node is born in the merchant's graph. It has no name yet -- it is a meaning structure linking the repeated experience into something stable. The next time the merchant encounters the tariff topic, this crystallized narrative shapes their response. They have formed an opinion. Not because the LLM was prompted to form one, but because repeated co-activation in the graph created a new structural element.

The visitor who returns the next day finds the merchant referencing "what we discussed yesterday about the tariffs" -- naturally, without explicit memory recall prompting, because the crystallized narrative node has high energy and high weight. It persists.

```
GIVEN:  Two or more nodes in a citizen's graph are repeatedly co-activated
WHEN:   co_activation(a, b) = min(a.energy, b.energy) exceeds crystallization_threshold
THEN:   A new narrative or process node spawns, linking the co-activated nodes
AND:    The new node inherits energy from its parents
AND:    The citizen's behavior around the relevant topic becomes more coherent and opinionated
```

---

### B4: Citizens Sense Each Other Without Speaking

**Why:** 200 citizens cannot all hold LLM conversations with each other. Subconscious query enables coordination through graph physics alone.

Two merchants share a stall at Rialto. One has surplus linen. The other needs linen. In a traditional game, this would require a scripted trade dialog or an inventory matching algorithm. In Serenissima, the surplus linen creates surplus energy on the first merchant's supply edges. The second merchant's deficit creates an energy gradient.

The first merchant's graph runs a subconscious query -- not an LLM call, but a stimulus injection into the second merchant's graph. The stimulus is: "linen available." The second merchant's graph responds with a resonance pattern -- high energy on linen-need nodes, low friction on the relationship edge between them. This resonance pattern tells the first merchant (via physics, not via conversation) that the second merchant is a viable trade partner.

The visitor sees this as: two merchants exchange a glance, one nods, and goods change hands. A brief exchange -- "Your usual order?" "Two bolts, yes." No elaborate negotiation. No menu. Just the physical manifestation of graph physics resolving an energy gradient.

```
GIVEN:  Citizen A has surplus energy on a supply node
WHEN:   Citizen A's graph injects a stimulus into Citizen B's graph
THEN:   Citizen B's graph produces a resonance pattern (energy distribution in response to stimulus)
AND:    The resonance pattern indicates compatibility (high energy on matching need nodes, low friction)
AND:    Citizen A's action nodes fire to initiate the exchange
AND:    No LLM was involved -- the entire interaction ran on Channel 2
```

---

### B5: The City Decides Together, Without a Meeting

**Why:** Governance in a city of 200 autonomous minds cannot be a vote UI or a chat room. At-scale consensus uses energy resonance aggregation to produce collective decisions from individual graph states.

The Doge proposes a new tax on glass exports. The proposal is injected as a stimulus into every citizen's graph. Each citizen's graph responds with a resonance pattern based on their unique energy topology -- their economic interests, their trust in the Doge, their relationships with glassblowers, their values about fairness and prosperity.

The consensus engine aggregates these 200+ resonance patterns. Each citizen's response is weighted by their trust score and their stake (how much energy they have in relevant nodes). The aggregation completes in under 2 seconds -- it is pure math, no LLM.

The result is not a yes/no vote. It is an energy landscape showing where the population's conviction concentrates. Strong support from merchants but fierce opposition from glassblowers. Moderate indifference from the clergy. The Doge (or the governance narrative) reads this landscape and the decision emerges from the energy distribution.

The visitor learns about this not through a popup or a results screen, but through the citizens. "The new tax passed. The glassblowers are furious." "My guild voted against it, but we were outnumbered by the merchants." The consensus was computed in 2 seconds. Its effects ripple through the city over the next several hours as citizens process the outcome through their individual graphs.

```
GIVEN:  A governance stimulus is injected into all citizen graphs
WHEN:   Each graph produces a resonance pattern weighted by trust and stake
THEN:   The consensus engine aggregates patterns into a collective energy landscape
AND:    The decision emerges from energy concentration, not from vote counting
AND:    The computation completes in under 2 seconds for 200+ citizens
AND:    Citizens individually process the outcome through their limbic and cognitive motors
```

---

### B6: Birth Gives Citizens Bones, Experience Gives Them Flesh

**Why:** Citizens must be competent from their first tick, but they must also diverge from their templates through lived experience.

A new glassblower citizen is seeded with a birth template: high-weight nodes for glassblowing techniques (W=0.85), Murano guild values (W=0.9), pride in craftsmanship (W=0.8), desire for recognition (W=0.75). These nodes are the citizen's bones -- they define the core of who they are and they resist decay.

Within the first hour, the physics tick is already reshaping the citizen around these bones. Supply chain edges activate as the citizen's action nodes execute glassblowing routines. Relationship edges form with neighboring citizens. Drive pressures from curiosity and achievement bias energy toward novel interactions. The citizen begins to diverge from the template.

A visitor who meets this glassblower on day one finds a competent artisan with standard Murano pride. A visitor who meets them on day five finds a unique individual -- one who has developed a grudge against a specific supplier, a fondness for a particular visitor who asked good questions, an opinion about the new tax on exports. The bones are still there (glassblowing skill, guild values), but the flesh is grown from experience.

```
GIVEN:  A new citizen is seeded with a birth template of high-weight nodes
WHEN:   The physics tick runs for 3+ cycles
THEN:   The citizen exhibits role-appropriate behavior immediately
AND:    New edges form from interactions with neighboring citizens and economic events
AND:    Crystallized narratives emerge from repeated co-activations
AND:    Within 24 hours, the citizen's graph has diverged measurably from the template
```

---

### B7: The Sleeping City Still Breathes

**Why:** API budget is finite. Server costs are real. The city must survive at minimal resource consumption without appearing dead.

It is 3 AM server time. API budget is exhausted. All citizens are at subconscious level. The physics tick runs every 60 seconds on pure graph math. No LLM is invoked.

A visitor who connects at this hour finds a city that is quiet but not frozen. Night watchmen patrol (Law 17 action nodes firing on schedule). Furnaces in Murano glow (persistent energy on production nodes). A drunk citizen stumbles along a canal (random-walk action pattern with high energy on social nodes). The ambient atmosphere reflects the aggregate energy state of the district -- subdued but present.

If the visitor speaks to a citizen, the citizen responds with reflexive dialogue -- short, functional, drawn from high-weight action nodes. "The market opens at dawn." "I'm tending the furnace." Not eloquent, but not broken. The citizen's graph is processing the visitor's words as stimuli, and the resonance pattern produces a coherent (if simple) response.

When budget replenishes at dawn, consciousness levels rise. Citizens who interacted with the visitor during the night now have those moment nodes in their graphs. They might mention it: "Someone was walking around last night. Strange hour for a visitor."

```
GIVEN:  API budget is 0 and all citizens are at subconscious level
WHEN:   The 60-second tick runs pure graph physics
THEN:   Citizens continue routine behaviors via Law 17 action nodes
AND:    Supply chain flows continue (surplus propagation, decay)
AND:    The city atmosphere reflects aggregate energy state
AND:    Visitor interactions produce reflexive but coherent responses
AND:    All interactions are recorded as moment nodes for when consciousness returns
```

---

## OBJECTIVES SERVED

| Behavior ID | Objective | Why It Matters |
|-------------|-----------|----------------|
| B1 | Bi-channel cost efficiency | Distributes LLM cost across consciousness levels; most citizens run cheap |
| B2 | Economic alignment | Proves that economic state drives narrative behavior through the same energy system |
| B3 | Emergent narrative | Demonstrates narrative novelty without authored content |
| B4 | Bi-channel cost efficiency | Citizen coordination at zero LLM cost |
| B5 | Cognitive sovereignty | Collective intelligence emerges from individual graph states |
| B6 | Subconscious survival | Citizens are functional from first tick without LLM |
| B7 | Subconscious survival | City continuity at zero API budget |

---

## INPUTS / OUTPUTS

### Primary Function: `tickSerenissima()`

**Inputs:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `citizenGraphs` | FalkorDB subgraphs | Complete cognitive graphs for all active citizens |
| `economicDeltas` | JSON | Economic changes since last tick (trade completions, supply chain events) |
| `visitorStimuli` | JSON[] | Conversation inputs and proximity triggers from human visitors |
| `apiBudget` | float | Current API budget remaining (determines consciousness levels) |

**Outputs:**

| Return | Type | Description |
|--------|------|-------------|
| `tickResult` | JSON | Energy stats, moment flips, consciousness level changes, action node firings |
| `wmCoalitions` | Map<citizenId, Node[]> | Working Memory coalitions for citizens needing LLM articulation |
| `consensusResults` | JSON[] | Any at-scale consensus computations completed this tick |

**Side Effects:**

- FalkorDB graph state updated (energy, weight, stability, recency on all active nodes)
- New moment nodes created from visitor interactions and crystallization events
- New edges created from subconscious query resonance patterns
- Consciousness level transitions recorded

---

## EDGE CASES

### E1: Budget Drops Mid-Conversation

```
GIVEN:  A citizen is at full consciousness, mid-conversation with a visitor
WHEN:   API budget drops below 0.01 during the exchange
THEN:   The citizen completes their current response (LLM call already in flight)
AND:    Their next response is generated from Law 17 reflexes (graph-only)
AND:    The visitor perceives the citizen becoming "distracted" or "tired"
AND:    The conversation moment is still recorded in the graph
```

### E2: All Citizens Reach Subconscious Simultaneously

```
GIVEN:  API budget hits 0 with no provider failover available
THEN:   All citizens drop to subconscious within one tick cycle
AND:    The city enters "night mode" regardless of world time
AND:    Tick rate slows to 60-second intervals
AND:    Law 17 action nodes maintain city routines
AND:    When budget returns, citizens "wake up" in priority order (those with visitors first)
```

### E3: Crystallization Cascade

```
GIVEN:  A major event (moment flip) creates many new high-energy nodes
WHEN:   Multiple co-activation pairs exceed crystallization threshold simultaneously
THEN:   Maximum 3 crystallizations per citizen per tick
AND:    Each crystallization consumes energy from parent nodes (conservation)
AND:    Excess co-activations are queued for subsequent ticks
```

### E4: Visitor Speaks to Subconscious Citizen Without Budget

```
GIVEN:  A visitor addresses a citizen at subconscious level with zero API budget
THEN:   The citizen's graph processes the visitor's words as stimulus injection
AND:    The response is the highest-energy action node in the citizen's WM space
AND:    The response is short, functional, and coherent but not conversational
AND:    The moment is recorded -- when the citizen regains consciousness, they can reflect on it
```

---

## ANTI-BEHAVIORS

What should NOT happen:

### A1: The Zombie District

```
GIVEN:   API budget is exhausted
WHEN:    A visitor enters a district
MUST NOT: All citizens stand frozen or repeat a single idle animation
INSTEAD:  Citizens continue routines via Law 17 action nodes -- carrying goods, tending stalls, walking routes
```

### A2: The Omniscient Citizen

```
GIVEN:   A citizen is at subconscious level
WHEN:    A complex political event occurs in a distant district
MUST NOT: The citizen immediately references the event in their next interaction
INSTEAD:  The event propagates through graph edges over multiple ticks; the citizen learns about it through their connections
```

### A3: The Instant Personality

```
GIVEN:   A citizen is freshly seeded from a birth template
WHEN:    A visitor engages them in deep conversation
MUST NOT: The citizen has fully formed opinions about current events they have not experienced
INSTEAD:  The citizen's responses are grounded in template knowledge (craft, values, guild) with gaps where experience has not yet filled in
```

### A4: The Cost Explosion

```
GIVEN:   A visitor walks through a crowded market with 50 citizens
WHEN:    The visitor's presence is detected by all 50
MUST NOT: All 50 citizens enter full consciousness simultaneously
INSTEAD:  Only the 2-3 nearest citizens rise to full; others remain at minimal or subconscious
```

---

## MARKERS

<!-- @mind:todo Design the reflexive dialogue system for subconscious citizen responses -->
<!-- @mind:todo Calibrate crystallization threshold -- too low produces noise, too high prevents narrative growth -->
<!-- @mind:proposition Allow visitor "attention" to act as a soft consciousness budget boost for nearby citizens -->
<!-- @mind:escalation How many simultaneous full-consciousness citizens can the API budget sustain? Need cost modeling -->
