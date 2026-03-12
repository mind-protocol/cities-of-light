# ESTIMATION: Implementation Sequence -- Venezia

Ordered build plan. Each module entry specifies dependencies, parallelization opportunities, context budget, and behavior scope. Build order follows DAG constraints with highest-value behaviors first.

---

## Build Sequence

```yaml
# ──────────────────────────────────────────────────────────────────────
# PHASE 1: FOUNDATION (POC weeks 1-2)
# No dependencies. These modules bootstrap the project.
# ──────────────────────────────────────────────────────────────────────

- order: 1
  module: economy/sync
  milestone_target: POC
  context_budget: M
  complexity: 3
  connectivity: 12
  roi: 4
  roi_justification: >
    Invisible plumbing that 6 modules read from; without sync cache, citizens have no state and the world is empty.
  estimated_loc: 1200
  estimated_sessions: 4
  depends_on: []
  parallel_with: [2, 3]
  compaction_strategy: >
    Isolate Airtable client, cache layer, and diff engine into separate files.
    Each file < 400 LOC. Diff engine is pure function (snapshot_old, snapshot_new) → events.
    Cache is a Map. No cross-file state. Compact after cache + diff are stable.
  behaviors_included:
    - B-invisible-sync     # Sync runs silently, no visitor awareness
    - B-position-changes   # Citizen positions arrive via sync, interpolated on client
    - B-data-freshness     # 15-minute window, citizen speech covers staleness
  behaviors_deferred:
    - B-activity-changes      # Alpha: requires embodiment tier system
    - B-building-stall-updates # Beta: requires economy simulation
    - B-diff-events           # Beta: full diff events need simulation + governance
    - B-sync-failure          # Alpha: graceful freeze under Airtable outage
    - B-sync-seams            # Alpha: seam management polish

- order: 2
  module: infra/server
  milestone_target: POC
  context_budget: L
  complexity: 4
  connectivity: 15
  roi: 5
  roi_justification: >
    Everything breaks without it; 15 modules depend on server for WebSocket, routing, and state distribution.
  estimated_loc: 2000
  estimated_sessions: 6
  depends_on: []
  parallel_with: [1, 3]
  compaction_strategy: >
    Express server, WebSocket manager, and citizen router as separate modules.
    WebSocket manager handles connection lifecycle only. Citizen router maps
    visitor messages to citizen handlers. Server orchestrator wires them.
    Compact after WebSocket manager is stable (it rarely changes once working).
  behaviors_included:
    - B1   # Connection: WebSocket auto-connect, initial state burst
    - B6   # Session persistence: citizen memory, visitor identity across reconnect
  behaviors_deferred:
    - B2   # Alpha: real-time updates (population + events)
    - B3   # Alpha: reconnection (brief drop, extended disconnect)
    - B4   # GA: multiple visitors
    - B5   # Alpha: rate limiting (natural pace, spam drop)
    - B7   # Alpha: error states visible to visitor
    - B8   # Alpha: anti-behaviors quality floor
    - B9   # Alpha: testable scenarios

- order: 3
  module: world/districts
  milestone_target: POC
  context_budget: XL
  complexity: 5
  connectivity: 8
  roi: 5
  roi_justification: >
    The physical space; without Venice geometry there is nowhere to be, no districts, no navigation, no spatial presence.
  estimated_loc: 3500
  estimated_sessions: 10
  depends_on: []
  parallel_with: [1, 2]
  compaction_strategy: >
    District base class + Rialto implementation. Geometry, materials, props,
    water plane, collision mesh as separate concerns. Each district is a
    self-contained file inheriting from base. POC builds only Rialto.
    Alpha adds 6 more districts -- each is a session. Compact base class
    after Rialto is proven.
  behaviors_included:
    - B1   # Arriving in Venice: dock spawn, no UI, no tutorial
    - B7   # Water: basic canal with reflections, surface animation
  behaviors_deferred:
    - B2   # Alpha: all 7 district feels (density, sound, light, props)
    - B3   # Alpha: district transitions (fog gate, audio crossfade)
    - B4   # Alpha: time-of-day effects on buildings
    - B5   # Beta: weather effects on buildings
    - B6   # Beta: economy reflected in architecture

# ──────────────────────────────────────────────────────────────────────
# PHASE 2: CORE INTERACTION (POC weeks 2-3)
# Depends on server + sync. The voice-to-mind pipeline.
# ──────────────────────────────────────────────────────────────────────

- order: 4
  module: voice/pipeline
  milestone_target: POC
  context_budget: L
  complexity: 4
  connectivity: 6
  roi: 5
  roi_justification: >
    The interaction channel; no voice pipeline means no experience — visitors cannot speak to or hear citizens.
  estimated_loc: 1800
  estimated_sessions: 5
  depends_on: [2]
  parallel_with: [5, 6]
  compaction_strategy: >
    STT module (Whisper), LLM module (Claude API call), TTS module (ElevenLabs),
    pipeline orchestrator. Each stage is a pure async function: bytes → text,
    text → text, text → audio. Pipeline orchestrator chains them. Compact
    individual stages once proven; orchestrator stays editable.
  behaviors_included:
    - B-normal-flow        # Push-to-talk → STT → LLM → TTS → spatial playback
    - B-response-character # Per-citizen voice personality, language match
    - B-proximity-range    # 15m conversation range, distance rolloff
    - B-error-handling     # STT fail silent, LLM fail apologetic, TTS fail text
    - B-audio-quality      # Capture format, HRTF, rolloff parameters
  behaviors_deferred:
    - B-multiple-citizens  # Alpha: multi-citizen voice management
    - B-streaming          # Alpha: chunked TTS, subtitle at LLM completion
    - B-biography-voice    # GA: donor memorial interaction
    - B-session-invocations # GA: Nicolas-specific Claude Code trigger
    - B-stream-audience    # GA: spectator mode, listen-only

- order: 5
  module: citizens/mind
  milestone_target: POC
  context_budget: L
  complexity: 5
  connectivity: 10
  roi: 5
  roi_justification: >
    THE differentiator; citizens are NPCs without mind — trust, mood, memory, and personality make them alive.
  estimated_loc: 2200
  estimated_sessions: 7
  depends_on: [1]
  parallel_with: [4, 6]
  compaction_strategy: >
    Context assembler (5 sources → prompt), trust engine (atan scaling),
    mood computer (6 emotions from Airtable state), memory manager
    (.cascade/ read/write), response validator (anti-patterns). Each is
    a standalone module. Context assembler is the hub -- it calls the
    others. Compact trust engine and mood computer first (pure math,
    stable early). Memory manager and context assembler stay editable
    longest.
  behaviors_included:
    - B1   # First word: approach, mood-dependent greeting, return recognition
    - B2   # Trust shapes everything: 7 levels, disclosure gating
    - B3   # Mood changes everything: 6 emotions, complex combinations
    - B6   # Conversation mechanics: proximity start, natural speech, citizen-end
  behaviors_deferred:
    - B4   # Alpha: volunteer vs. withhold (needs events, grievances, relationships)
    - B5   # Alpha: multi-visit relationship arcs (needs trust persistence + graph)
    - B7   # Beta: edge behaviors (interrupted, overwhelm, breaking news)

- order: 6
  module: voice/spatial
  milestone_target: POC
  context_budget: S
  complexity: 3
  connectivity: 5
  roi: 3
  roi_justification: >
    HRTF positioning is core to spatial truth; without it voices are flat and placeless, breaking immersion.
  estimated_loc: 800
  estimated_sessions: 2
  depends_on: [4]
  parallel_with: [5]
  compaction_strategy: >
    HRTF audio context manager + citizen voice source positioner. POC scope
    is small: Web Audio API AudioContext, PannerNode per citizen voice,
    HRTF model. Compact immediately after POC validation. Alpha/Beta add
    ambient layers, reverb, occlusion as new files (not modifying core).
  behaviors_included:
    - B1   # Citizen voice positioning: HRTF, directional, distance attenuation
  behaviors_deferred:
    - B2   # Alpha: district ambient soundscapes
    - B3   # Alpha: district audio transitions (crossfade)
    - B4   # Beta: reverb and acoustic space
    - B5   # Beta: sound occlusion
    - B6   # Alpha: audio priority (32 source cap)
    - B7   # Alpha: time-of-day audio
    - B8   # Beta: weather audio
    - B9   # Alpha: anti-behaviors quality floor
    - B10  # Beta: testable scenarios

# ──────────────────────────────────────────────────────────────────────
# PHASE 3: NARRATIVE FOUNDATION (POC weeks 3-4)
# Depends on sync (citizen data) and mind (context injection).
# ──────────────────────────────────────────────────────────────────────

- order: 7
  module: narrative/graph
  milestone_target: POC
  context_budget: M
  complexity: 4
  connectivity: 9
  roi: 4
  roi_justification: >
    Beliefs make citizens authentic; without the graph, citizens have no opinions, no tensions, no identity.
  estimated_loc: 1500
  estimated_sessions: 5
  depends_on: [1, 5]
  parallel_with: [8]
  compaction_strategy: >
    FalkorDB client wrapper, graph schema (Character/Narrative/Moment/Place
    nodes + BELIEVES/TENSION/SUPPORTS edges), seed script (Airtable → graph),
    query module (citizen beliefs, tensions, narratives). Client wrapper
    is stable early — compact it. Schema definition is reference — compact.
    Seed script and query module stay editable through Alpha (they grow
    as more data flows).
  behaviors_included:
    - B1   # Citizens speak their beliefs (confidence-weighted, consistent)
    - B5   # What the visitor never sees (no graph viz, no debug data)
  behaviors_deferred:
    - B2   # Alpha: shared narratives chorus effect (152 citizens)
    - B3   # Alpha: belief consistency under pressure
    - B4   # Alpha: graph changes surface as behavior shifts
    - B6   # Beta: social clusters audible
    - B7   # Alpha: testable observations
    - B8   # Beta: visitor influence on the graph

- order: 8
  module: narrative/physics
  milestone_target: POC
  context_budget: M
  complexity: 5
  connectivity: 7
  roi: 4
  roi_justification: >
    Drama emerges from physics not scripts; without it the world is static and nothing ever changes on its own.
  estimated_loc: 1400
  estimated_sessions: 5
  depends_on: [7]
  parallel_with: []
  compaction_strategy: >
    Physics tick (5-minute loop), energy generator (economic injection),
    decay engine, tension accumulator, moment flip detector. The tick
    is the orchestrator — it calls the others in sequence. Each engine
    is a pure function on graph state. Compact decay engine and energy
    generator after calibration (they are math, not logic). Tick
    orchestrator and moment flip stay editable (tuning-heavy).
  behaviors_included:
    - B1   # Tension building over time (gradual escalation)
    - B2   # Moment flips (at least 1 in 30 minutes for POC)
    - B3   # Decay: the world forgets (energy decay, space for new stories)
    - B5   # The 5-minute tick creates drama without scripting
    - B9   # What the visitor never perceives (no energy values, no tick pulse)
  behaviors_deferred:
    - B4   # Alpha: energy flow (popular beliefs gaining, backflow)
    - B6   # Alpha: economic injection felt (trade deals → mood shift)
    - B7   # Alpha: daily rhythm (night reduces generation)
    - B8   # Alpha: testable observations (quantitative at full scale)

# ──────────────────────────────────────────────────────────────────────
# PHASE 4: EMBODIMENT + POPULATION (Alpha weeks 5-7)
# Depends on districts (geometry), sync (positions), mind (state).
# ──────────────────────────────────────────────────────────────────────

- order: 9
  module: citizens/embodiment
  milestone_target: Alpha
  context_budget: XL
  complexity: 5
  connectivity: 8
  roi: 3
  roi_justification: >
    Visual presence for citizens; capsule fallback works for POC but embodiment makes the world feel inhabited.
  estimated_loc: 3000
  estimated_sessions: 9
  depends_on: [3, 1, 5]
  parallel_with: [10]
  compaction_strategy: >
    Base citizen mesh + 5 class variants (Nobili/Cittadini/Popolani/Facchini/
    Forestieri), animation state machine (idle/walk/work/talk/rest/pray),
    tier renderer (FULL=skeletal+morph, ACTIVE=skeletal, AMBIENT=billboard),
    mood-to-pose mapper. Class variants share base mesh — compact base
    after 2 variants proven. Animation state machine is self-contained.
    Tier renderer is the most complex (3 render paths) — keep editable
    through Beta.
  behaviors_included:
    - B1   # Social class readable from clothing at distance
    - B2   # Mood expressed through body (posture, facial, gestures per tier)
    - B3   # Activity shapes animation (work/walk/eat/socialize/rest/pray)
    - B4   # Tier transitions are smooth (cross-fade, hysteresis, no pop-in)
    - B5   # Night citizens (darkness, lamplight, silhouettes)
    - B6   # Conversation partner awareness (turn, eye track, lip sync)
  behaviors_deferred:
    - B7   # Beta: gender and age variation (mesh selection, parametric)

- order: 10
  module: citizens/population
  milestone_target: Alpha
  context_budget: L
  complexity: 4
  connectivity: 9
  roi: 3
  roi_justification: >
    Scale from 3 to 152 citizens; without population management the city feels like a ghost town.
  estimated_loc: 1800
  estimated_sessions: 6
  depends_on: [9, 1]
  parallel_with: [11]
  compaction_strategy: >
    Tier assignment engine (scoring + hysteresis + budget), spawn/despawn
    manager (district-based, edge-of-perception), schedule interpreter
    (24h daily schedule → position + activity), off-screen simulator
    (30s tick for HIDDEN citizens). Tier assignment is the critical path —
    it touches frame budget. Keep it editable. Spawn/despawn and schedule
    interpreter are stable once working — compact them.
  behaviors_included:
    - B1   # Tier transitions invisible (cross-fade, pose preservation)
    - B2   # Crowd density follows the clock (morning/midday/evening/night)
    - B3   # District boundaries have population gradients
    - B4   # Citizens appear/disappear at edges of perception
    - B5   # 152 citizens feel like a living city
    - B6   # Off-screen citizens continue their lives
  behaviors_deferred:
    - B7   # Beta: population responds to world events (gathering, dispersal)

# ──────────────────────────────────────────────────────────────────────
# PHASE 5: WORLD EXPANSION (Alpha weeks 6-8)
# Districts expand from 1 → 7. Atmosphere and navigation mature.
# ──────────────────────────────────────────────────────────────────────

- order: 11
  module: world/districts (expansion)
  milestone_target: Alpha
  context_budget: XL
  complexity: 4
  connectivity: 8
  roi: 5
  roi_justification: >
    Expands Venice from 1 district to 7; without it the world is a single room, not a city.
  estimated_loc: 4200
  estimated_sessions: 7
  depends_on: [3]
  parallel_with: [12, 13]
  compaction_strategy: >
    6 new district files (San Marco, Castello, Dorsoduro, Cannaregio,
    Santa Croce, San Polo) each inheriting from base class. Each district
    is an independent session. Compact Rialto base class before starting.
    Districts can be built in parallel by separate sessions.
  behaviors_included:
    - B2   # The feel of each district (7 distinct identities)
    - B3   # District transitions (fog gate, audio crossfade, blended architecture)
    - B4   # Time-of-day effects on buildings
  behaviors_deferred:
    - B5   # Beta: weather effects on buildings
    - B6   # Beta: economy reflected in architecture

- order: 12
  module: world/atmosphere
  milestone_target: Alpha
  context_budget: M
  complexity: 3
  connectivity: 7
  roi: 2
  roi_justification: >
    Beautiful but not core; the world functions without atmospheric effects, they add polish not structure.
  estimated_loc: 1600
  estimated_sessions: 5
  depends_on: [3]
  parallel_with: [11, 13]
  compaction_strategy: >
    Sky/light manager (day/night cycle, 96min, 5 phases), fog system
    (ground + atmospheric + haze), district mood tint (aggregate citizen
    mood → color shift), event atmosphere reactor (tension → visual cues).
    Sky/light is math-heavy and stable — compact after calibration.
    Fog system is tuning-sensitive — keep editable. District mood tint
    depends on population aggregation (connectivity to citizens/population).
  behaviors_included:
    - B1   # Day/night cycle progression (96min, 5 phases)
    - B2   # Fog behavior (ground fog, atmospheric fog, haze)
    - B3   # District mood shifts (despair/unease/content/euphoria)
    - B6   # Atmosphere during world events (tension building, crisis)
  behaviors_deferred:
    - B4   # Beta: biometric tint (Garmin stress → atmosphere)
    - B5   # Beta: ambient particles (per-district, mood modulation)
    - B7   # Beta: seasonal light and catch-up

- order: 13
  module: world/navigation
  milestone_target: Alpha
  context_budget: M
  complexity: 3
  connectivity: 5
  roi: 3
  roi_justification: >
    Movement through space; without navigation the visitor is stationary, unable to explore or reach citizens.
  estimated_loc: 1500
  estimated_sessions: 4
  depends_on: [3]
  parallel_with: [11, 12]
  compaction_strategy: >
    Input manager (desktop WASD already in POC), VR locomotion controller
    (continuous + snap turn + teleport arc), district transition trigger
    (fog gate + audio crossfade + hysteresis), gondola ride system
    (boarding, camera lock, scenic route, disembark). Desktop input is
    POC — compact. VR locomotion is self-contained — compact after Quest 3
    testing. Gondola is a one-off system — compact immediately.
  behaviors_included:
    - B1   # Desktop movement (already in POC, refinement)
    - B2   # VR movement (continuous locomotion, snap turn, teleport)
    - B3   # District transitions (fog gate, audio crossfade, hysteresis)
    - B4   # Gondola ride experience
    - B5   # Bridge crossing (elevation, observation point, threshold)
    - B6   # Water as barrier (already in POC, refinement)
    - B7   # Attempting the impossible (already in POC, refinement)
    - B8   # Speed perception and collision feedback
    - B9   # VR comfort (vignette, teleport fade, snap only)
  behaviors_deferred: []

# ──────────────────────────────────────────────────────────────────────
# PHASE 6: LIVENESS + SCALE (Alpha weeks 8-10)
# Full event system, expanded graph, performance for Quest 3.
# ──────────────────────────────────────────────────────────────────────

- order: 14
  module: narrative/events
  milestone_target: Alpha
  context_budget: M
  complexity: 4
  connectivity: 8
  roi: 3
  roi_justification: >
    Events make the world dynamic; without them Venice is calm and repetitive, nothing surprising ever happens.
  estimated_loc: 1600
  estimated_sessions: 5
  depends_on: [8, 10, 12]
  parallel_with: [15]
  compaction_strategy: >
    Event descriptor (category, severity, radius, affected citizens),
    lifecycle manager (EMERGING → ACTIVE → SETTLING → AFTERMATH → RESOLVED),
    atmosphere consumer (fog/light/particle changes), citizen behavior
    consumer (activity overrides, mood shifts), concurrent cap (3 max,
    severity preemption). Descriptor and lifecycle are stable — compact.
    Consumers are tuning targets — keep editable.
  behaviors_included:
    - B1   # Event types (6 categories, severity-based radius)
    - B3   # Citizen reactions (proximity, belief alignment, class perspective)
    - B4   # Atmosphere changes during events (4-phase lifecycle)
    - B7   # Maximum concurrent events (3 cap, severity preemption)
  behaviors_deferred:
    - B2   # Beta: event propagation (trust-chain, distortion)
    - B5   # Beta: Forestiere news (foreign news at docks)
    - B6   # Beta: event aftermath scars
    - B8   # Beta: testable observations (full suite)

- order: 15
  module: narrative/graph (expansion)
  milestone_target: Alpha
  context_budget: M
  complexity: 3
  connectivity: 9
  roi: 4
  roi_justification: >
    Scales beliefs to 152 citizens with propagation and chorus effects; without it only POC citizens have inner life.
  estimated_loc: 800
  estimated_sessions: 3
  depends_on: [7]
  parallel_with: [14]
  compaction_strategy: >
    Expand seed script to all 152 citizens. Add belief propagation engine
    (trust-weighted spread). Add chorus effect detector (shared narrative
    surfacing). These are additive — they don't modify the POC graph module,
    they extend it. Compact seed script after full seeding verified.
  behaviors_included:
    - B2   # Shared narratives chorus effect (152-citizen scale)
    - B3   # Belief consistency under pressure
    - B4   # Graph changes surface as behavior shifts
    - B7   # Testable observations
  behaviors_deferred:
    - B6   # Beta: social clusters audible
    - B8   # Beta: visitor influence on the graph

- order: 16
  module: narrative/physics (expansion)
  milestone_target: Alpha
  context_budget: S
  complexity: 3
  connectivity: 7
  roi: 4
  roi_justification: >
    Full energy flow and economic injection; without it drama stays shallow and economy has no narrative impact.
  estimated_loc: 500
  estimated_sessions: 2
  depends_on: [8, 1, 12]
  parallel_with: [14]
  compaction_strategy: >
    Add full energy flow (popular beliefs gaining, unpopular dying,
    backflow to citizens), economic injection pipeline (trade diff events
    → energy injection into graph), daily rhythm modifier (night reduces
    generation, morning ramps), quantitative test harness. Extends
    existing physics tick — does not replace it.
  behaviors_included:
    - B4   # Energy flow (popular gaining, unpopular dying, backflow)
    - B6   # Economic injection felt (trade deals → mood shift)
    - B7   # Daily rhythm (night reduces, morning ramps)
    - B8   # Testable observations (quantitative at scale)
  behaviors_deferred: []

- order: 17
  module: infra/performance
  milestone_target: Alpha
  context_budget: M
  complexity: 4
  connectivity: 6
  roi: 2
  roi_justification: >
    Optimization is premature before content exists; the world runs without LOD and adaptive quality at small scale.
  estimated_loc: 1400
  estimated_sessions: 4
  depends_on: [9, 10, 11]
  parallel_with: []
  compaction_strategy: >
    Frame time monitor (per-frame budget tracking), adaptive quality
    controller (4 tiers: Ultra→High→Medium→Low), building LOD manager
    (4-level LOD, distance-based), frustum culler. Frame monitor is
    the decision maker — keep editable. LOD manager and frustum culler
    are pure geometry ops — compact after testing on Quest 3.
  behaviors_included:
    - B1   # Building LOD transitions (4-level, alpha blend)
    - B2   # Citizen tier transitions (FULL/ACTIVE/AMBIENT detail)
    - B3   # Adaptive quality: automatic degradation (4-tier)
    - B5   # Anti-behaviors: no pop-in, stutter, loading, FPS counter
    - B6   # Audio and network performance (32 source cap, 20Hz broadcast)
  behaviors_deferred:
    - B4   # GA: thermal throttling on Quest 3 (3ms margin)
    - B7   # GA: testable scenarios (sustained 72fps, thermal endurance)

- order: 18
  module: infra/server (expansion)
  milestone_target: Alpha
  context_budget: M
  complexity: 3
  connectivity: 15
  roi: 5
  roi_justification: >
    Reconnection, rate limiting, and real-time broadcast; without these the server drops visitors on any hiccup.
  estimated_loc: 1000
  estimated_sessions: 3
  depends_on: [2, 10, 14]
  parallel_with: []
  compaction_strategy: >
    Add reconnection handler, rate limiter, real-time broadcast (citizen
    updates at tier-appropriate frequencies: FULL 30Hz, ACTIVE 2Hz,
    AMBIENT 0.5Hz). These extend the POC server, not replace it.
    Rate limiter is a middleware — compact immediately. Broadcast
    frequency manager is performance-critical — keep editable.
  behaviors_included:
    - B2   # Real-time updates: citizen movement, events, state changes
    - B3   # Reconnection: brief drop, extended disconnect, server restart
    - B5   # Rate limiting: natural pace, rapid speech queue, spam drop
    - B7   # Error states visible to visitor (empty city, slow voice)
    - B8   # Anti-behaviors quality floor
    - B9   # Testable scenarios
  behaviors_deferred:
    - B4   # GA: multiple visitors (solo V1)

- order: 19
  module: voice/spatial (expansion)
  milestone_target: Alpha
  context_budget: M
  complexity: 3
  connectivity: 5
  roi: 3
  roi_justification: >
    District soundscapes and audio priority; without them Venice is silent between conversations, breaking presence.
  estimated_loc: 1200
  estimated_sessions: 3
  depends_on: [6, 11, 12]
  parallel_with: [18]
  compaction_strategy: >
    District ambient soundscape system (per-district audio identity),
    audio priority manager (nearest 32 sources, distance-weighted),
    time-of-day audio (dawn bells, day bustle, night silence),
    district transition crossfader. Each is additive to the POC spatial
    module. Ambient soundscapes are asset-heavy but code-light — compact
    after loading system is stable.
  behaviors_included:
    - B2   # District ambient soundscapes
    - B3   # District audio transitions (crossfade)
    - B6   # Audio priority (nearest clear, farthest texture, crowd merge)
    - B7   # Time-of-day audio (dawn/day/dusk/night)
    - B9   # Anti-behaviors quality floor
  behaviors_deferred:
    - B4   # Beta: reverb and acoustic space
    - B5   # Beta: sound occlusion
    - B8   # Beta: weather audio
    - B10  # Beta: testable scenarios

- order: 20
  module: citizens/mind (expansion)
  milestone_target: Alpha
  context_budget: M
  complexity: 4
  connectivity: 10
  roi: 5
  roi_justification: >
    Beliefs, events, and volunteer/withhold logic; without these citizens repeat shallow greetings and never deepen.
  estimated_loc: 800
  estimated_sessions: 3
  depends_on: [5, 7, 14]
  parallel_with: [19]
  compaction_strategy: >
    Expand context assembler: add [WHAT YOU BELIEVE] section from graph,
    add [RECENT EVENTS] section from event system, add volunteer/withhold
    logic (trust-gated disclosure of events, grievances, relationships).
    Multi-visit arc tracker (trust trajectory across sessions). These
    extend existing modules, not replace them.
  behaviors_included:
    - B4   # What citizens volunteer vs. withhold
    - B5   # Multi-visit relationship arcs (slow thaw, fast bond)
  behaviors_deferred:
    - B7   # Beta: edge behaviors (interrupted, overwhelm, breaking news)

- order: 21
  module: voice/pipeline (expansion)
  milestone_target: Alpha
  context_budget: S
  complexity: 3
  connectivity: 6
  roi: 5
  roi_justification: >
    Multi-citizen voices and streaming TTS; without these only one citizen speaks and latency feels broken.
  estimated_loc: 600
  estimated_sessions: 2
  depends_on: [4, 10]
  parallel_with: [20]
  compaction_strategy: >
    Add multi-citizen voice manager (cooldown between citizens, nearest
    responds, ambient conversations queued). Add streaming TTS (chunked
    audio delivery, subtitle at LLM completion). Both are additive to
    the POC pipeline.
  behaviors_included:
    - B-multiple-citizens  # Multi-citizen voice management
    - B-streaming          # Chunked TTS, reduced perceived latency
  behaviors_deferred:
    - B-biography-voice    # GA
    - B-session-invocations # GA
    - B-stream-audience    # GA

- order: 22
  module: economy/sync (expansion)
  milestone_target: Alpha
  context_budget: S
  complexity: 2
  connectivity: 12
  roi: 4
  roi_justification: >
    Sync failure handling and seam management; without these Airtable outages crash the world visibly.
  estimated_loc: 500
  estimated_sessions: 2
  depends_on: [1, 9]
  parallel_with: [21]
  compaction_strategy: >
    Add sync failure handler (stale cache detection, atomic swap, recovery
    burst). Add sync seam manager (path walking for position jumps, fade
    transitions for activity changes). Small additions to existing sync
    module.
  behaviors_included:
    - B-activity-changes   # Activity change triggers animation transition
    - B-sync-failure       # Graceful world freeze on Airtable outage
    - B-sync-seams         # Seam management (path walking, fade)
  behaviors_deferred:
    - B-building-stall-updates # Beta: requires economy simulation
    - B-diff-events           # Beta: requires simulation + governance

# ──────────────────────────────────────────────────────────────────────
# PHASE 7: DEPTH (Beta weeks 11-18)
# Economy simulation, governance, full audio, weather, event depth.
# ──────────────────────────────────────────────────────────────────────

- order: 23
  module: economy/simulation
  milestone_target: Beta
  context_budget: XL
  complexity: 5
  connectivity: 8
  roi: 2
  roi_justification: >
    Serenissima runs the economy externally; simulation adds local depth but the world functions without it.
  estimated_loc: 3500
  estimated_sessions: 10
  depends_on: [1, 10]
  parallel_with: [24]
  compaction_strategy: >
    Activity processor (daily wage/expense cycle), production engine
    (resource transformation, building output), trade engine (contracts,
    supply/demand, price computation), stratagem executor (undercutting,
    lockout, monopoly), market dynamics (boom/bust detection, bankruptcy
    threshold). Activity processor is the core loop — keep editable.
    Production and trade engines are algorithmic — compact after
    calibration. Stratagem executor is novel — keep editable through GA.
  behaviors_included:
    - B-economy-moved      # Economy runs autonomously 24/7
    - B-citizens-working   # Citizens at workplaces (now with simulation data)
    - B-market-activity    # Stalls, goods, trade disruption effects
    - B-price-changes      # Supply/demand price dynamics, citizen complaints
    - B-resource-scarcity  # Empty stalls, halted construction, cascades
    - B-wealth-inequality  # Visual class contrast (enhanced with simulation)
    - B-stratagems         # Undercutting, lockout, monopoly
    - B-boom-bust          # Gradual boom/bust transitions
    - B-bankruptcy         # Citizen relocated, stall empty, clothing degraded
    - B-galley             # Galley arrivals, dock activity, disruption cascades
  behaviors_deferred: []

- order: 24
  module: economy/governance
  milestone_target: Beta
  context_budget: L
  complexity: 4
  connectivity: 6
  roi: 2
  roi_justification: >
    Political depth adds narrative richness but is deferred; citizens function without councils and grievances.
  estimated_loc: 2200
  estimated_sessions: 7
  depends_on: [23, 10, 7]
  parallel_with: [25]
  compaction_strategy: >
    Grievance engine (filing, support accumulation, threshold detection),
    council system (formation, deliberation, vote computation), outcome
    applier (tax/price/wage/trade modifications), enforcement deployer
    (guard spawning, decree tracking, expiry cleanup), Doge system
    (role assignment, succession). Grievance engine and council are
    tightly coupled — keep together and editable. Outcome applier is
    a dispatch table — compact after all outcome types verified.
  behaviors_included:
    - B-grievance-scenes    # Citizen posts notice, crowd gathers
    - B-council-gatherings  # Influence citizens converge, deliberation
    - B-political-movements # Aligned grievances, escalation
    - B-guard-enforcement   # Guards stationed, inspection, black market
    - B-governance-outcomes # Notices, economic effects, construction
    - B-doge-system         # Persistent role, succession, deference
    - B-visitor-position    # Forestiero, indirect influence only
  behaviors_deferred: []

- order: 25
  module: narrative/events (expansion)
  milestone_target: Beta
  context_budget: M
  complexity: 4
  connectivity: 8
  roi: 3
  roi_justification: >
    Trust-chain propagation and aftermath scars; without these events vanish instantly instead of rippling through the city.
  estimated_loc: 1200
  estimated_sessions: 4
  depends_on: [14, 7]
  parallel_with: [24]
  compaction_strategy: >
    Add trust-chain propagation engine (hop-count decay, distortion at
    each hop, confidence thresholds). Add Forestiere news injector
    (dock arrival, foreign narrative injection). Add aftermath system
    (scar persistence: closed stalls, changed relationships, narrative
    wounds). Propagation engine is graph-algorithmic — compact after
    testing. Forestiere and aftermath are content-driven — keep editable.
  behaviors_included:
    - B2   # Event propagation (trust-chain, distortion, time-delayed)
    - B5   # Forestiere news (foreign news arrives at docks)
    - B6   # Event aftermath scars (physical, social, narrative)
    - B8   # Testable observations (full suite)
  behaviors_deferred: []

- order: 26
  module: world/atmosphere (expansion)
  milestone_target: Beta
  context_budget: M
  complexity: 3
  connectivity: 7
  roi: 2
  roi_justification: >
    Weather, biometric tint, and particles; beautiful additions but the world is fully functional without them.
  estimated_loc: 1000
  estimated_sessions: 3
  depends_on: [12]
  parallel_with: [27, 28]
  compaction_strategy: >
    Add weather system (fog/rain/overcast state machine, material
    response), biometric tint (Garmin stress → subtle atmosphere shift),
    ambient particle system (per-district type, mood modulation),
    seasonal light (perpetual spring default, catch-up on return).
    Weather is visual polish — compact after art direction sign-off.
    Biometric tint is a small modifier — compact immediately.
  behaviors_included:
    - B4   # Biometric tint (Garmin stress modulates atmosphere)
    - B5   # Ambient particles (per-district, mood modulation)
    - B7   # Seasonal light and catch-up
  behaviors_deferred: []

- order: 27
  module: voice/spatial (full)
  milestone_target: Beta
  context_budget: M
  complexity: 4
  connectivity: 5
  roi: 3
  roi_justification: >
    Reverb, occlusion, and weather audio; without these the soundscape is flat and doesn't respond to architecture.
  estimated_loc: 1200
  estimated_sessions: 4
  depends_on: [19, 3]
  parallel_with: [26, 28]
  compaction_strategy: >
    Add reverb zone system (calle tight → piazza diffuse, crossfade
    between zones), occlusion engine (raycast or zone-based, muffled
    through archways), weather audio (rain on surfaces, directional
    wind). Reverb and occlusion are geometry-dependent — keep editable
    until district geometry is finalized. Weather audio follows
    weather system from atmosphere expansion.
  behaviors_included:
    - B4   # Reverb and acoustic space (calle/piazza/interior)
    - B5   # Sound occlusion (buildings block, archways muffle)
    - B8   # Weather audio (rain, wind, storm)
    - B10  # Testable scenarios (full suite)
  behaviors_deferred: []

- order: 28
  module: world/districts (depth)
  milestone_target: Beta
  context_budget: M
  complexity: 3
  connectivity: 8
  roi: 5
  roi_justification: >
    Weather response and economy-driven architecture; without these buildings are static props that never reflect the world state.
  estimated_loc: 800
  estimated_sessions: 3
  depends_on: [11, 23]
  parallel_with: [26, 27]
  compaction_strategy: >
    Add weather material response (wet surfaces, rain streaks, puddles),
    economy-driven architecture changes (prosperity/bankruptcy visual
    states on buildings). These modify existing district material
    systems — extend, don't replace.
  behaviors_included:
    - B5   # Weather effects on buildings
    - B6   # Economy reflected in architecture
  behaviors_deferred: []

- order: 29
  module: economy/sync (full)
  milestone_target: Beta
  context_budget: S
  complexity: 2
  connectivity: 12
  roi: 4
  roi_justification: >
    Full diff events and building updates; without these the sync layer misses promotions, bankruptcies, and stall changes.
  estimated_loc: 500
  estimated_sessions: 2
  depends_on: [22, 23, 24]
  parallel_with: [28]
  compaction_strategy: >
    Add full diff events (promotion, ownership change, contract creation,
    grievance filed, bankruptcy declared). Add building/stall update sync
    (signage, goods inventory). Small additions to existing sync module.
  behaviors_included:
    - B-building-stall-updates # Signage, goods change between glances
    - B-diff-events           # Observable world changes from simulation
  behaviors_deferred: []

- order: 30
  module: citizens/mind (full)
  milestone_target: Beta
  context_budget: M
  complexity: 4
  connectivity: 10
  roi: 5
  roi_justification: >
    Edge behaviors — interrupted, overwhelmed, breaking news; without these citizens are unflappable robots in crisis.
  estimated_loc: 600
  estimated_sessions: 2
  depends_on: [20, 14, 24]
  parallel_with: [29]
  compaction_strategy: >
    Add edge behaviors: interrupted mid-activity (event interrupts
    conversation), emotional overwhelm (high-intensity mood blocks
    rational response), breaking news (event awareness mid-sentence).
    These are context additions to the mind system, not structural changes.
  behaviors_included:
    - B7   # Edge behaviors (interrupted, overwhelm, breaking news)
  behaviors_deferred: []

- order: 31
  module: narrative/graph (full)
  milestone_target: Beta
  context_budget: S
  complexity: 3
  connectivity: 9
  roi: 4
  roi_justification: >
    Social clusters and visitor influence; without these the graph is read-only and visitors have zero narrative impact.
  estimated_loc: 600
  estimated_sessions: 2
  depends_on: [15, 19]
  parallel_with: [30]
  compaction_strategy: >
    Add social cluster detection (proximity-based cluster surfacing in
    spatial audio). Add visitor influence mechanics (attention as energy
    injection, bounded influence on beliefs). Small additions to graph
    query and physics modules.
  behaviors_included:
    - B6   # Social clusters audible (proximity, cross-references)
    - B8   # Visitor influence on the graph (attention as energy)
  behaviors_deferred: []

- order: 32
  module: citizens/population (full)
  milestone_target: Beta
  context_budget: S
  complexity: 3
  connectivity: 9
  roi: 3
  roi_justification: >
    Population responds to events with gathering and dispersal; without it crowds ignore fires and festivals alike.
  estimated_loc: 500
  estimated_sessions: 2
  depends_on: [10, 14]
  parallel_with: [31]
  compaction_strategy: >
    Add event response system: gathering behavior (citizens converge
    toward event center, staggered by distance), dispersal (citizens
    flee from event epicenter), redistribution (density shifts in
    response to event severity). Extends spawn/despawn manager.
  behaviors_included:
    - B7   # Population responds to world events (gathering, dispersal)
  behaviors_deferred: []

- order: 33
  module: citizens/embodiment (full)
  milestone_target: Beta
  context_budget: M
  complexity: 3
  connectivity: 8
  roi: 3
  roi_justification: >
    Gender and age variation; without it all citizens share the same silhouette, breaking visual diversity.
  estimated_loc: 800
  estimated_sessions: 3
  depends_on: [9]
  parallel_with: [32]
  compaction_strategy: >
    Add gender and age variation system: multiple base meshes per class,
    parametric height/build variation, age-appropriate speed and posture
    modifiers. Asset-heavy but code-light.
  behaviors_included:
    - B7   # Gender and age variation (mesh selection, parametric)
  behaviors_deferred: []

# ──────────────────────────────────────────────────────────────────────
# PHASE 8: PRODUCTION (GA weeks 19-22)
# Deployment, thermal management, multi-platform, polish.
# ──────────────────────────────────────────────────────────────────────

- order: 34
  module: infra/deployment
  milestone_target: GA
  context_budget: L
  complexity: 3
  connectivity: 4
  roi: 2
  roi_justification: >
    Production only; HTTPS, CDN, and progressive loading matter for launch but not for building the experience.
  estimated_loc: 1500
  estimated_sessions: 5
  depends_on: [2, 17]
  parallel_with: [35]
  compaction_strategy: >
    HTTPS configuration (TLS cert, auto-renewal), domain routing,
    progressive loading system (scene assembly without loading screen),
    rolling restart handler (server update without visitor disconnection),
    CDN for static assets, mobile browser graceful degradation.
    HTTPS and domain are one-time config — compact immediately.
    Progressive loading is performance-critical — keep editable.
  behaviors_included:
    - B1   # One URL to enter the world (no download, no install)
    - B2   # HTTPS (TLS for WebXR, mic, auto-renewal)
    - B3   # Load time: progressive assembly, no loading screen
    - B4   # Offline behavior: connection lost graceful freeze
    - B5   # Updates without disruption (rolling restart)
    - B6   # Geographic latency (voice absorbed into thinking time)
    - B7   # Entry points: VR, desktop, mobile
    - B8   # Anti-behaviors (no install prompts, no app store)
    - B9   # Testable scenarios (zero-friction entry, cert monitoring)
  behaviors_deferred: []

- order: 35
  module: infra/performance (full)
  milestone_target: GA
  context_budget: M
  complexity: 4
  connectivity: 6
  roi: 2
  roi_justification: >
    Thermal throttling and sustained perf testing; hardware-specific optimization only needed for Quest 3 launch.
  estimated_loc: 800
  estimated_sessions: 3
  depends_on: [17]
  parallel_with: [34]
  compaction_strategy: >
    Add thermal throttle manager (Quest 3 thermal sensor reading, 3ms
    frame margin preservation, progressive quality reduction before
    thermal shutdown). Add sustained performance test harness (45-minute
    automated benchmark, memory leak detection, GC pause monitoring).
    Thermal manager is hardware-specific — keep editable until Quest 3
    hardware testing is complete.
  behaviors_included:
    - B4   # Thermal throttling on Quest 3 (3ms margin, graceful)
    - B7   # Testable scenarios (sustained 72fps, thermal endurance)
  behaviors_deferred: []

- order: 36
  module: infra/server (full)
  milestone_target: GA
  context_budget: S
  complexity: 3
  connectivity: 15
  roi: 5
  roi_justification: >
    Multi-visitor support; without it Venice is a single-player experience, blocking any shared or public demo.
  estimated_loc: 600
  estimated_sessions: 2
  depends_on: [18]
  parallel_with: [34, 35]
  compaction_strategy: >
    Add multi-visitor support: visitor isolation, shared world state,
    per-visitor citizen conversation locks. This is the last server
    feature — compact everything else first.
  behaviors_included:
    - B4   # Multiple visitors (solo V1, future multi-visitor)
  behaviors_deferred: []

- order: 37
  module: voice/pipeline (full)
  milestone_target: GA
  context_budget: M
  complexity: 3
  connectivity: 6
  roi: 5
  roi_justification: >
    Biography voices, session invocations, and spectator mode; these unlock memorial interactions and public streaming.
  estimated_loc: 1000
  estimated_sessions: 3
  depends_on: [21]
  parallel_with: [36]
  compaction_strategy: >
    Add biography voice system (memorial interaction, consent pipeline,
    donor-specific voice models). Add session invocations (Nicolas-specific
    Claude Code trigger from voice). Add stream audience mode (spectator
    listen-only, WebRTC broadcast). These are isolated features with
    no cross-module dependencies.
  behaviors_included:
    - B-biography-voice    # Donor memorial interaction
    - B-session-invocations # Nicolas-specific Claude Code trigger
    - B-stream-audience    # Spectator mode, listen-only
  behaviors_deferred: []

# ──────────────────────────────────────────────────────────────────────
# NOTE ON ROI AND PHYSICALIZED PRIORITY
# ──────────────────────────────────────────────────────────────────────
#
# The ROI scores above are manual bridge estimates. They represent what
# value each module delivers and what is lost while it doesn't exist.
#
# This ordering uses DAG_constraint × ROI_weight: within the same
# dependency level, higher ROI modules are built first.
#
# TARGET: When the knowledge graph is operational, these scores will be
# replaced by physicalized priority — energy flow through the graph
# determines what has the most tension (most blocked narratives) and
# therefore what should be built next. No human or AI scoring needed.
#
# Until then, this sequence is the best available bridge.
# ──────────────────────────────────────────────────────────────────────
```

---

## Parallel Track Map

Three independent tracks can run simultaneously through most of the build:

```
TRACK A (World)          TRACK B (Citizens+Voice)      TRACK C (Narrative)
──────────────────       ────────────────────────       ──────────────────
[3] districts            [4] voice/pipeline             [7] narrative/graph
        |                [6] voice/spatial                      |
        |                [5] citizens/mind              [8] narrative/physics
        |                        |                             |
[11] districts(exp)      [9] citizens/embodiment        [14] narrative/events
[12] atmosphere          [10] citizens/population       [15] graph(exp)
[13] navigation          [21] voice/pipeline(exp)       [16] physics(exp)
        |                [20] mind(exp)                        |
[26] atmosphere(exp)     [19] voice/spatial(exp)        [25] events(exp)
[28] districts(depth)    [33] embodiment(full)          [31] graph(full)
        |                [32] population(full)                 |
[27] voice/spatial(full) [30] mind(full)                       |
```

**Cross-track sync points:**
- Track B [9] embodiment depends on Track A [3] districts (geometry for citizen placement)
- Track C [14] events depends on Track B [10] population + Track A [12] atmosphere
- Track A [28] districts(depth) depends on module [23] economy/simulation
- Economy ([23], [24]) is a fourth track that starts at Beta and feeds all three

**Hub modules** (highest connectivity, most cross-cutting):
- `infra/server` (connectivity: 15) -- everything connects through it
- `economy/sync` (connectivity: 12) -- data foundation for all modules
- `citizens/mind` (connectivity: 10) -- consumes from graph, sync, events, memory
- `narrative/graph` (connectivity: 9) -- referenced by mind, physics, events, population
- `citizens/population` (connectivity: 9) -- referenced by events, embodiment, atmosphere, server

---

## Session Estimates by Milestone

| Milestone | Modules | Sessions | LOC Estimate | Elapsed Weeks |
|-----------|---------|----------|-------------|---------------|
| POC       | 8 modules (orders 1-8)    | 44 sessions | ~14,400 LOC | 4 weeks |
| Alpha     | 14 modules (orders 9-22)  | 53 sessions | ~17,900 LOC | +6 weeks (week 10) |
| Beta      | 11 modules (orders 23-33) | 42 sessions | ~12,900 LOC | +8 weeks (week 18) |
| GA        | 4 modules (orders 34-37)  | 13 sessions | ~3,900 LOC  | +4 weeks (week 22) |
| **Total** | **37 build steps**        | **152 sessions** | **~49,100 LOC** | **22 weeks** |

Note: "sessions" = Claude Code context windows with focused scope. Parallel tracks reduce wall-clock time. At 2-3 sessions/day with 2 parallel tracks, the POC is achievable in 4 weeks.

---

## Risk Assessment

### R1: Context Overflow

**Risk:** Modules exceed Claude Code context window mid-implementation.

| Module | Context Budget | LOC Estimate | Risk Level |
|--------|---------------|-------------|------------|
| world/districts | XL | 3,500 + 4,200 | HIGH |
| citizens/embodiment | XL | 3,000 | MEDIUM |
| economy/simulation | XL | 3,500 | HIGH |
| infra/server | L | 2,000 + 1,000 + 600 | MEDIUM |
| citizens/mind | L | 2,200 + 800 + 600 | MEDIUM |

**Mitigation:** XL modules must be split into multiple files from the start (not refactored later). Each session targets a single file. Compaction strategy in each module entry defines what can be frozen between sessions.

**Early warning:** If a module's primary file exceeds 500 LOC before its first compaction point, split immediately.

### R2: Complexity Cliff

**Risk:** A module is more complex than estimated, blocking downstream modules.

| Module | Complexity | Why It Could Be Worse |
|--------|-----------|----------------------|
| narrative/physics (5) | Calibrating energy/decay/tension to produce 1-3 flips/hour is empirical, not algorithmic. May require many tuning iterations. |
| citizens/embodiment (5) | Three render paths (FULL skeletal+morph, ACTIVE skeletal, AMBIENT billboard) with cross-fade transitions. Shader complexity unknown until Quest 3 testing. |
| citizens/mind (5) | Context assembly from 5 sources + response validation against economic state. Claude API prompt engineering is iterative. |
| economy/simulation (5) | Full economic simulation with production, trade, stratagems, market dynamics. Emergent behavior is hard to predict. |

**Mitigation:** Complexity-5 modules get 2x session estimates built in. If a complexity-5 module blocks, its dependents can proceed with mocked interfaces. Mock contract: module exports typed interface on day 1, implementation follows.

### R3: Hub Fragility

**Risk:** A hub module (high connectivity) has a bug that cascades to all consumers.

| Hub Module | Connectivity | Consumers |
|-----------|-------------|----------|
| infra/server | 15 | Every module that sends/receives data |
| economy/sync | 12 | mind, embodiment, population, events, atmosphere, governance, simulation |
| citizens/mind | 10 | voice/pipeline, narrative/graph, narrative/events, economy/governance |
| narrative/graph | 9 | mind, physics, events, population, governance |
| citizens/population | 9 | embodiment, events, atmosphere, server, performance |

**Mitigation:** Hub modules are built first (orders 1-2) and stabilized before dependents start. Hub interfaces are defined as TypeScript types or Python dataclasses before implementation. Breaking changes to a hub interface require updating all consumers in the same session.

**Critical rule:** `economy/sync` and `infra/server` must not change their public interfaces after Alpha without a migration plan.

### R4: External Dependency

**Risk:** External services are unavailable, rate-limited, or change their API.

| Dependency | Used By | Failure Impact | Fallback |
|-----------|---------|---------------|----------|
| Serenissima Airtable | economy/sync | No citizen data | Stale cache (INV-Y3: serve last good snapshot) |
| Claude API (Anthropic) | citizens/mind | No conversations | Generic deflection phrases (INV-M1) |
| ElevenLabs TTS | voice/pipeline | No citizen voice | Text subtitle fallback (B-error-handling) |
| Whisper STT | voice/pipeline | Can't hear visitor | Push-to-type fallback |
| FalkorDB | narrative/graph | No beliefs, no physics | Graceful skip: citizens speak without belief context |
| Garmin API | world/atmosphere | No biometric tint | Atmosphere works without it (optional by design) |

**Mitigation:** Every external dependency has a documented fallback in the BEHAVIORS docs. Implement fallbacks alongside the happy path, not after. Test with dependencies killed during Alpha.

### R5: Performance Uncertainty

**Risk:** Quest 3 frame budget (14ms) is not achievable with all systems active.

| System | Frame Budget | Risk |
|--------|-------------|------|
| Three.js scene render | 8ms | LOW -- known quantities with building LOD and frustum culling |
| Population update (152 citizens) | 1ms | MEDIUM -- amortized scoring + interpolation must hit target |
| Physics tick (5-min) | 0ms per-frame (async) | LOW -- runs on server, not in render loop |
| Voice pipeline | 0ms per-frame (async) | LOW -- runs on server |
| Atmosphere update | 0.5ms | LOW -- uniform updates, no per-pixel work |
| WebSocket receive + apply | 1ms | MEDIUM -- 152 citizen updates at varying frequencies |
| Spatial audio update | 0.5ms | LOW -- Web Audio API handles mixing |
| **Total** | **~11ms** | **3ms margin** -- adequate if estimates hold |

**Mitigation:** Profile on Quest 3 hardware starting at Alpha (order 17, infra/performance). Do not wait until GA. The 3ms margin disappears if any system overshoots. Population update (1ms for 152 citizens) is the tightest budget -- profile it every sprint.

**Hard constraints from VALIDATION docs:**
- P50 frame time: < 13.9ms (72fps)
- P99 frame time: < 16.7ms (60fps)
- Zero frames > 33.3ms (30fps)
- Population update P95: < 1.0ms
- Triangle count: < 500K
- Draw calls: < 200
- Heap: < 2GB (memory pressure at 1.5GB, emergency at 1.8GB)

### R6: Integration Risk (Cross-Repo)

**Risk:** Cross-repo data flows break silently.

| Integration | Risk | Detection |
|------------|------|-----------|
| Airtable -> Venezia sync | Schema drift: Serenissima adds/renames fields | Sync health check: all expected fields present, alert on unknown fields |
| .cascade/ memory read/write | Path format changes, concurrent writes from Serenissima | File locking, path validation, memory file immutability (INV-M3) |
| FalkorDB Venice graph | Graph schema diverges from Blood Ledger engine expectations | Schema validation on startup: assert all required node/edge types exist |
| Manemus biometrics | File format changes, stale data (> 30min) | Freshness check: skip biometric tint if data > 30min old |

**Mitigation:** Define integration contracts as JSON Schema or TypeScript interfaces in a shared `/contracts/` directory. Version the contracts. Break detection: CI test that fetches from each external source and validates against contract.

---

## Critical Path

The longest dependency chain determines minimum build time:

```
[1] economy/sync (4 sessions)
  -> [5] citizens/mind (7 sessions)
    -> [7] narrative/graph (5 sessions)
      -> [8] narrative/physics (5 sessions)
        -> [14] narrative/events (5 sessions)
          -> [25] events expansion (4 sessions)
            -> total: 30 sessions on critical path
```

At 2 sessions/day, the critical path is ~15 working days (3 weeks). This fits within the 4-week POC + 6-week Alpha window because the critical path spans both milestones.

**Parallelism opportunity:** While the critical path runs, Track A (world/districts, atmosphere, navigation) can proceed independently. Track A has no dependency on the narrative chain until events need atmosphere integration (order 14).

---

## Compaction Schedule

When to compact (freeze and summarize) completed modules to free context:

| After Order | Compact These | Freed Context |
|-------------|--------------|--------------|
| 3 | economy/sync cache layer, Airtable client | ~300 LOC |
| 6 | voice/spatial POC (HRTF positioner) | ~400 LOC |
| 8 | narrative/physics decay engine, energy generator | ~500 LOC |
| 11 | world/districts base class, Rialto district | ~1500 LOC |
| 13 | world/navigation desktop input, VR locomotion, gondola | ~1000 LOC |
| 17 | infra/performance frustum culler, LOD manager | ~600 LOC |
| 21 | voice/pipeline STT + TTS modules (stable by now) | ~800 LOC |
| 23 | economy/simulation production + trade engines | ~1500 LOC |
| 29 | economy/sync (fully complete) | ~500 LOC |

**Rule:** A module is compactable when (a) its downstream consumers are coded against its interface, and (b) no behavior assigned to a future milestone modifies it.
