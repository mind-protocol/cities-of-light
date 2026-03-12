# ESTIMATION: Milestone Plan -- Venezia

Milestone definitions with full feature-milestone mapping. Every behavior from every BEHAVIORS doc is assigned to a milestone with justification.

---

## Milestone Definitions

### POC -- Prove the Core Concept (Target: 4 weeks)

**Goal:** A single Venice district where a visitor can walk, approach 3 AI citizens grounded in real Serenissima data, and have spatially-positioned voice conversations that reflect each citizen's actual economic state, beliefs, and memory. The Blood Ledger physics tick runs, producing at least one observable tension break within 30 minutes.

**Modules included:**
| Module | Scope | Notes |
|--------|-------|-------|
| world/districts | Partial | Rialto only. Canal, buildings, bridge, basic props. |
| citizens/embodiment | Partial | FULL tier only. Basic class-based appearance, mood posture. No ACTIVE/AMBIENT tiers. |
| citizens/mind | Full | Context assembly, Claude API, memory persistence, trust. Core value proposition. |
| voice/pipeline | Full | STT + LLM + TTS + spatial playback. The interaction channel. |
| economy/sync | Full | Airtable pull cycle, in-memory cache, diff events. Data foundation for everything. |
| narrative/graph | Partial | FalkorDB schema, seed 20 citizens. Query for citizen context. |
| narrative/physics | Partial | 5-minute tick, energy pump, decay, tension. One Moment flip in 30min. |
| infra/server | Partial | Express + WebSocket, citizen routing, basic state management. |
| voice/spatial | Partial | HRTF positioning for citizen voice only. No ambient layers. |

**Acceptance criteria** (from POC-1 + POC-2 in VALIDATION):
- [ ] Walk through Rialto for 5 minutes without visual glitches
- [ ] Approach a citizen and have a 3-turn conversation about their actual economic situation
- [ ] Citizen's stated problems match their Airtable data (Ducats, debts, mood)
- [ ] Leave and return -- citizen remembers previous conversation
- [ ] Audio is spatially positioned (close eyes, point to speaking citizen)
- [ ] Physics tick completes without error for 1 hour continuous
- [ ] At least 1 tension break occurs, visible as behavior change in affected citizens
- [ ] A citizen spontaneously brings up a recent event without being asked

**What can be stubbed:**
- Other 6 districts (not rendered, not navigable)
- ACTIVE and AMBIENT citizen tiers (all citizens at FULL or hidden)
- Day/night cycle (fixed time of day)
- Weather system (clear sky only)
- Ambient soundscapes (citizen voice spatial audio only)
- Governance (no grievances, no councils)
- Economy simulation (Serenissima runs externally; we only sync)
- Navigation VR controls (desktop WASD only)
- Performance optimization (desktop target, not Quest 3)
- Deployment (localhost only)

**What must be real:**
- Airtable sync with real Serenissima data
- FalkorDB graph with real citizen beliefs
- Claude API with citizen-specific system prompts and context
- STT/TTS pipeline end-to-end
- Physics tick with real energy/decay/tension math
- Citizen memory persistence (filesystem .cascade/)

---

### Alpha -- Core Loop End-to-End (Target: +6 weeks)

**Goal:** All 7 districts rendered. 152 citizens managed with the full 3-tier LOD system. Day/night cycle. World events manifest visually and narratively. VR locomotion works on Quest 3. The visitor can spend 30+ minutes exploring and discovers emergent drama.

**Modules included (additions to POC):**
| Module | Scope | Notes |
|--------|-------|-------|
| world/districts | Full | All 7 districts with distinct character. |
| world/atmosphere | Partial | Day/night cycle, basic fog, district mood tint. No biometric, no weather. |
| world/navigation | Full | Desktop WASD + VR continuous locomotion + teleport + snap turn. District transitions. |
| citizens/embodiment | Full | 3-tier system (FULL/ACTIVE/AMBIENT). Smooth transitions. Class-based appearance. |
| citizens/population | Full | Tier assignment, spawn/despawn, crowd density, daily rhythms. |
| narrative/graph | Full | All 152 citizens seeded. Belief propagation. Chorus effect. |
| narrative/physics | Full | Full physics with homeostasis, moment cooldowns. 1-3 flips per hour target. |
| narrative/events | Partial | Event types manifest in citizen behavior and atmosphere. No Forestiere news. |
| infra/server | Full | WebSocket broadcast, reconnection, rate limiting, session persistence. |
| infra/performance | Partial | Tier-based culling, frustum culling, adaptive quality (3 tiers). No thermal management. |
| voice/spatial | Partial | HRTF citizen voice + basic district ambient soundscapes. No occlusion, no reverb zones. |

**Acceptance criteria** (from POC-3 + POC-4 + extended):
- [ ] Frame rate stays above 72fps with all citizens loaded (Quest 3)
- [ ] Transition between tiers is smooth (no pop-in)
- [ ] Walking through a crowded market (30+ visible citizens) feels alive
- [ ] Memory usage stays under 2GB
- [ ] Full day/night cycle completes in ~96 real minutes
- [ ] District fog/lighting shifts measurably when citizen mood changes
- [ ] Two citizens observed discussing the same event independently
- [ ] Gondola ride functional along one route
- [ ] VR comfort settings work (vignette, snap turn, teleport fade)

**What can be stubbed:**
- Weather (clear only)
- Biometric tint (Garmin integration)
- Economy simulation (still external)
- Governance layer
- Ambient particles (optional polish)
- Sound occlusion
- Reverb zones
- Forestiere news injection
- Multi-visitor support
- Deployment hardening (dev server acceptable)

---

### Beta -- Full Feature Set (Target: +8 weeks)

**Goal:** Every documented behavior implemented. Economy simulation running server-side. Governance layer active. Full spatial audio with occlusion and reverb. Weather system. Biometric tint. Forestiere news. The world is feature-complete but not yet performance-tuned for sustained Quest 3 sessions.

**Modules included (additions to Alpha):**
| Module | Scope | Notes |
|--------|-------|-------|
| world/atmosphere | Full | Weather, biometric tint, seasonal light, ambient particles, event atmosphere. |
| economy/simulation | Full | Activity processor, production, trade, stratagems, market dynamics. |
| economy/governance | Full | Grievances, councils, political movements, Doge system, guard enforcement. |
| narrative/events | Full | All event types, propagation with distortion, Forestiere news, aftermath scars. |
| voice/spatial | Full | Occlusion, reverb zones, ambient layers, weather audio, audio priority. |
| infra/performance | Partial | Thermal management awareness. Not yet fully tuned. |

**Acceptance criteria:**
- [ ] Weather effects (fog, rain) render and affect atmosphere
- [ ] Biometric tint active when Garmin linked, invisible otherwise
- [ ] Grievance filing observable as 3D scene
- [ ] Council formation visible, outcome affects economy
- [ ] Sound occlusion testable (voice blocked by building)
- [ ] Reverb varies between narrow calle and open piazza
- [ ] Forestiere news arrives at docks, propagates through social graph
- [ ] Event scars persist (closed stalls remain closed until economy restores)
- [ ] Stratagems produce visible social consequences
- [ ] Night audio is minimal (water, wind, footsteps only)

**What can be stubbed:**
- Multi-visitor WebRTC
- Stream mode
- Thermal endurance optimization
- Deployment monitoring
- CDN for static assets

---

### GA -- Production Ready (Target: +4 weeks)

**Goal:** Production deployment on HTTPS domain. Sustained 72fps on Quest 3 for 45+ minutes. Monitoring and alerting. Automated certificate renewal. Graceful degradation under load. Geographic latency absorbed. The experience is ready for external visitors.

**Modules included (additions to Beta):**
| Module | Scope | Notes |
|--------|-------|-------|
| infra/performance | Full | Thermal management, sustained 72fps validation, memory leak prevention. |
| infra/deployment | Full | HTTPS, domain, monitoring, automated certificate renewal, rolling restarts. |

**Acceptance criteria:**
- [ ] 3 test users spend > 30 minutes without prompting (POC-4 criteria)
- [ ] At least 1 test user names 3+ citizens from memory
- [ ] At least 1 test user reports unexpected emotional reaction
- [ ] Test users describe experience as "a place" not "a program"
- [ ] Test users return for a second session voluntarily
- [ ] Zero-friction entry: URL to standing in Venice under 30 seconds on Quest 3
- [ ] Desktop parity: citizens respond with voice on desktop Chrome
- [ ] Sustained 72fps for 45 minutes on Quest 3 (thermal endurance)
- [ ] FPS never drops below 72 for more than a single frame during district walking
- [ ] Draw calls under 200, triangles under 500K in crowded market
- [ ] TLS certificate auto-renewal configured and verified
- [ ] Server restart causes < 30s pause, no data loss
- [ ] Voice round-trip under 3s (EU/NA), under 4s (Asia)
- [ ] Mobile browser: scene renders without crash, 30fps minimum

---

## Feature-Milestone Mapping

Every behavior from every BEHAVIORS doc, assigned to a milestone.

### world/districts

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | Arriving in Venice (dock spawn, no UI) | POC | First experience. Must work from day 1. POC builds Rialto only. |
| B2 | The Feel of Each District (7 districts) | Alpha | POC has Rialto only. Alpha adds all 7 with distinct density, sound, light, props, building style, and citizen distribution. |
| B3 | District Transitions (fog gate, audio crossfade, blended architecture) | Alpha | Requires multiple districts. District transitions are the Alpha locomotion feature. |
| B4 | Time-of-Day Effects on Buildings (dawn/morning/afternoon/evening/night) | Alpha | Depends on day/night cycle from world/atmosphere. Buildings respond to light. |
| B5 | Weather Effects on Buildings (clear/overcast/fog/rain material changes) | Beta | Weather system is Beta scope. Building material response follows. |
| B6 | Economy Reflected in Architecture (prosperity/bankruptcy visual changes) | Beta | Requires economy/simulation running server-side to produce meaningful economic variation. |
| B7 | Water in Districts (reflections, color variation, boats, surface animation) | POC | Water is fundamental to Venice. POC needs basic canal with water. Boat props and per-district color variation extend through Alpha. |

### world/atmosphere

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | Day/Night Cycle Progression (96min cycle, 5 phases) | Alpha | Too complex for POC (fixed time). Alpha's core liveness feature. |
| B2 | Fog Behavior (ground fog, atmospheric fog, haze, tint variation) | Alpha | Basic fog in Alpha for district mood. Full fog behavior (golden dawn tint, haze layer) in Alpha. |
| B3 | District Mood Shifts (despair/unease/content/euphoria atmosphere) | Alpha | Requires citizens/population (mood aggregate) and economy/sync (15min cycle). Core liveness. |
| B4 | Biometric Tint (Garmin stress modulates atmosphere) | Beta | Garmin integration is polish. Atmosphere must work without it first. |
| B5 | Ambient Particles (per-district particle type, mood modulation) | Beta | Visual polish. Not required for core loop. |
| B6 | Atmosphere During World Events (tension building, crisis shift, aftermath) | Alpha | Atmosphere response to events is part of the Alpha liveness story. |
| B7 | Seasonal Light and Catch-Up (perpetual spring, fast-forward on return) | Beta | Catch-up on return is polish. Perpetual spring is the default (no work needed until seasons). |

### world/navigation

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | Desktop Movement (WASD, mouse, shift run, diagonal normalization) | POC | Primary input for POC testing. Must work from day 1. |
| B2 | VR Movement (continuous locomotion, snap turn, teleport with arc) | Alpha | VR is the target platform. Alpha is when Quest 3 becomes primary. |
| B3 | District Transitions (fog gate, audio crossfade, hysteresis) | Alpha | Requires multiple districts. Maps to same milestone as districts/B3. |
| B4 | Gondola Ride Experience (boarding, scenic ride, disembarking) | Alpha | Unique navigation feature. Requires canal routes, gondolier prop, camera lock. |
| B5 | Bridge Crossing (elevation change, observation point, threshold feeling) | Alpha | Bridges are district thresholds. Must feel right when districts exist. |
| B6 | Water as Barrier (canal edge, sliding, fall prevention) | POC | Collision with canal edges is fundamental geometry. POC needs this to prevent falling into water. |
| B7 | Attempting the Impossible (buildings not enterable, no jump, wall sliding) | POC | Basic collision. Walls are walls. Required for any walkable space. |
| B8 | Speed Perception and Collision Feedback (parallax, silent collision) | Alpha | Perception tuning requires multiple space types (alleys vs piazzas). |
| B9 | VR Comfort (vignette, teleport fade, height calibration, snap only) | Alpha | VR comfort is mandatory for Quest 3. Implements with VR movement. |

### citizens/embodiment

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | Social Class Readable From Clothing at Distance | Alpha | Class-based appearance at ACTIVE/AMBIENT tier requires the full tier system. POC uses FULL only. |
| B2 | Mood Expressed Through Body (posture, facial, gestures per tier) | Alpha | FULL tier mood expression in POC is basic. Full tier-differentiated mood expression (posture at ACTIVE, drift at AMBIENT) is Alpha. |
| B3 | Activity Shapes Animation (work/walk/eat/socialize/rest/pray per tier) | Alpha | Activity-specific animation across all tiers. POC has idle + walk only. |
| B4 | Tier Transitions Are Smooth (cross-fade, hysteresis, no pop-in) | Alpha | The tier system itself is Alpha. Smooth transitions are its core requirement. |
| B5 | Night Citizens (darkness, lamplight, silhouettes, population reduction) | Alpha | Depends on day/night cycle. Night changes how citizens render. |
| B6 | Conversation Partner Awareness (turn toward, eye track, lip sync, gestures) | POC | When the visitor speaks to a citizen, the citizen must physically respond. Core conversation experience. |
| B7 | Gender and Age Variation (mesh selection, speed variation, parametric variation) | Beta | Visual diversity polish. POC/Alpha can use fewer base models. |

### citizens/mind

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | The First Word (approach, mood-dependent greeting, return recognition) | POC | The core interaction. Citizens respond based on mood and history. This IS the POC. |
| B2 | Trust Shapes Everything (7 trust levels, disclosure gating) | POC | Trust system drives conversation quality. Must be real from the start. |
| B3 | Mood Changes Everything (6 emotion computation, complex mood combinations) | POC | Mood = citizen authenticity. Computed from real Airtable state. |
| B4 | What Citizens Volunteer vs. Withhold (preoccupation, disclosure rules) | Alpha | Requires richer context (events, grievances, relationships) to fully express volunteer/withhold behavior. |
| B5 | Multi-Visit Relationship Arcs (slow thaw, fast bond, deterioration, indirect) | Alpha | Requires trust persistence across sessions and social graph propagation. POC proves single-session trust. Alpha proves multi-visit arcs. |
| B6 | Conversation Mechanics (proximity start, natural speech, citizen-initiated end) | POC | How conversations work. Fundamental to the voice pipeline integration. |
| B7 | Edge Behaviors (interrupted mid-activity, emotional overwhelm, breaking news) | Beta | Edge cases and depth behaviors. Require the full event system and complex mood model. |

### citizens/population

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | Tier Transitions Are Invisible (cross-fade, pose preservation, no hitch) | Alpha | The tier system is Alpha. This is its quality bar. |
| B2 | Crowd Density Follows the Clock (morning/midday/evening/night variation) | Alpha | Requires day/night cycle. Density patterns prove world liveness. |
| B3 | District Boundaries Have Population Gradients | Alpha | Requires multiple districts. Gradients prevent level-loading feel. |
| B4 | Citizens Appear and Disappear at Edges of Perception (HIDDEN fade) | Alpha | Part of the 200m render boundary system. |
| B5 | 152 Citizens Feel Like a Living City (smart distribution, ambient texture) | Alpha | This IS Alpha's population scale goal (POC-3 from VALIDATION). |
| B6 | Off-Screen Citizens Continue Their Lives (arrive mid-scene, aftermath visible) | Alpha | World continuity (Invariant I2). Citizens exist in simulation always. |
| B7 | Population Responds to World Events (gathering, dispersal, redistribution) | Beta | Requires full event system (narrative/events). Complex crowd dynamics. |

### narrative/graph

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | Citizens Speak Their Beliefs (confidence-weighted, consistent) | POC | Beliefs injected into citizen context for conversation. Core authenticity. |
| B2 | Shared Narratives Create the Sound of a City (chorus effect) | Alpha | Requires multiple citizens seeded with shared narratives. 152-citizen scale. |
| B3 | Belief Consistency Under Pressure (pushback, contradiction discomfort) | Alpha | Requires trust system and multi-turn conversations across sessions. |
| B4 | Graph Changes Surface as Behavior Shifts (gradual drift, sudden post-event) | Alpha | Requires physics tick running long enough to produce observable drift. |
| B5 | What the Visitor Never Sees (no graph viz, no debug data, no labels) | POC | Anti-behavior. Must be true from POC. No system data leaks. |
| B6 | Social Clusters Are Audible, Not Visible (proximity, cross-references, tension avoidance) | Beta | Requires full population system + spatial audio to observe cluster effects. |
| B7 | Testable Observations (consistency, propagation, decay, tension tests) | Alpha | Graph tests become meaningful when full population is seeded. |
| B8 | Visitor Influence on the Graph (attention as energy, limits of influence) | Beta | Subtle mechanic. Requires well-calibrated physics. Polish-tier feature. |

### narrative/physics

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | Tension Building Over Time (gradual escalation across ticks) | POC | Core physics behavior. Must be observable in POC. |
| B2 | Moment Flips (economic crisis, political uprising, celebration manifestation) | POC | At least one flip in 30 minutes is POC-2 acceptance criteria. |
| B3 | Decay -- The World Forgets (energy decay, grudge persistence, space for new stories) | POC | Decay prevents runaway accumulation. Must run from day 1. |
| B4 | Energy Flow (popular beliefs gaining, unpopular dying, backflow to citizens) | Alpha | Full energy routing requires 152 citizens and complex graph. |
| B5 | The 5-Minute Tick Creates Drama Without Scripting (invisible tick, emergent pacing) | POC | The tick IS the physics. It runs in POC with 20 seeded citizens. |
| B6 | Economic Injection Is Felt (trade deals → mood shift, supply disruption → frustration) | Alpha | Requires economy/sync diff events feeding the graph. |
| B7 | The Daily Rhythm (night reduces generation, morning ramps up) | Alpha | Depends on day/night cycle. |
| B8 | Testable Observations (tension build rate, decay rate, moment flip, homeostasis) | Alpha | Quantitative tests require calibrated physics at full scale. |
| B9 | What the Visitor Never Perceives (no energy values, no tick pulse) | POC | Anti-behavior. Must be true from POC. |

### narrative/events

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | Event Types (economic crisis, political uprising, celebration, personal tragedy, guild dispute, trade disruption) | Alpha | POC has basic tension break. Alpha adds typed events with distinct manifestations. |
| B2 | How Events Propagate (time-delayed, trust-chain, distortion) | Beta | Complex social propagation with rumor distortion. Requires full social graph. |
| B3 | Citizen Reactions to Events (proximity, belief alignment, class perspective) | Alpha | Differentiated reactions prove citizen authenticity during events. |
| B4 | Atmosphere Changes During Events (emergence, active, settling, aftermath phases) | Alpha | Atmosphere response to events. Part of Alpha's liveness story. |
| B5 | Forestiere News (foreign news arrives at docks, propagates) | Beta | Novel content injection. Requires event propagation system. |
| B6 | Event Aftermath -- Scars on the World (physical, social, narrative scars) | Beta | Persistence of event consequences. Requires stable economy simulation. |
| B7 | Maximum Concurrent Events (3 cap, severity preemption) | Alpha | Prevents event spam. Simple cap with clear rule. |
| B8 | Testable Observations (manifestation, propagation timing, distortion, lifecycle) | Beta | Full test suite requires all event features. |

### economy/simulation

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B-economy-moved | The Economy Moved While You Were Gone (autonomous 24/7 changes) | Beta | Server-side simulation running continuously. |
| B-citizens-working | Citizens Going to Work (dawn departure, position at workplace) | Alpha | Citizen positioning from Airtable activity data. Sync is Alpha. |
| B-market-activity | Market Activity and Trading (stalls, goods, trade disruption effects) | Beta | Requires economy simulation producing real trade events. |
| B-price-changes | Price Changes and Citizen Complaints (supply/demand, price inference from behavior) | Beta | Price dynamics require running simulation. |
| B-resource-scarcity | Resource Scarcity (empty stalls, halted construction, cascading effects) | Beta | Scarcity cascades require simulation depth. |
| B-wealth-inequality | Wealth Inequality (visual class contrast, divergent perspectives) | Alpha | Observable from Airtable wealth data via sync. No simulation needed. |
| B-stratagems | Stratagems Playing Out (undercutting, lockout, monopoly, reputation visible consequences) | Beta | Stratagems are simulation-driven competitive moves. |
| B-boom-bust | Economic Cycles: Boom and Bust (gradual transitions across visits) | Beta | Emergent from sustained simulation. |
| B-bankruptcy | Bankruptcy (citizen relocated, stall empty, clothing degraded) | Beta | Bankruptcy state from simulation. |
| B-galley | Galley Arrivals and Departures (dock activity, disruption cascades) | Beta | Galley system requires simulation trade routes. |

### economy/sync

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B-invisible-sync | Sync Is Invisible Infrastructure (no lag, no teleport) | POC | Sync runs from POC. Must be invisible from the start. |
| B-position-changes | Citizen Position Changes (walk to new position, no teleport) | POC | Basic sync delivery. Interpolated walking on client. |
| B-activity-changes | Citizen Activity Changes (production to walking, natural transition) | Alpha | Activity-specific animation requires embodiment tier system. |
| B-building-stall-updates | Building and Stall Updates (signage, goods change between glances) | Beta | Requires economy simulation producing ownership/inventory changes. |
| B-data-freshness | Data Freshness: 15-Minute Window (citizen speech covers staleness) | POC | Linguistic softness in citizen prompts. Context assembly handles this. |
| B-diff-events | Diff Events: Observable World Changes (promotion, ownership, contracts, grievance, bankruptcy) | Beta | Full diff events require economy simulation and governance. |
| B-sync-failure | Sync Failure: Graceful World Freeze (stale cache, atomic swap, recovery burst) | Alpha | Robustness. World must handle Airtable outages by Alpha. |
| B-sync-seams | Sync Seams: Where Visitor Might Notice (outdated info, position jump, stall pop) | Alpha | Seam management (path walking, fade transitions) is Alpha polish. |

### economy/governance

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B-grievance-scenes | Grievance Scenes (citizen posts on notice board, crowd gathers) | Beta | Governance is Beta scope. |
| B-council-gatherings | Council Gatherings (influence citizens converge, deliberation audible) | Beta | Requires grievance threshold system. |
| B-political-movements | Political Movements (aligned grievances, escalation, guard posting) | Beta | Requires multiple active grievances. Complex emergence. |
| B-guard-enforcement | Guard Enforcement (stationed, inspection, black market murmurs) | Beta | Governance outcomes producing enforcement. |
| B-governance-outcomes | Governance Outcomes in the World (notices, economic effects, construction) | Beta | Downstream effects of council decisions. |
| B-doge-system | The Doge System (persistent role, succession, citizen deference) | Beta | Political hierarchy. Requires governance infrastructure. |
| B-visitor-position | The Visitor's Political Position (Forestiero, indirect influence only) | Beta | Contextual response gating. Requires governance context. |

### voice/pipeline

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B-normal-flow | The Normal Flow (push-to-talk, STT, LLM, TTS, spatial playback) | POC | The interaction channel. Must work from day 1. |
| B-response-character | Response Length and Character (per-citizen voice personality, language match) | POC | Citizens must sound distinct. Part of the core experience. |
| B-proximity-range | Proximity and Range (15m conversation range, distance rolloff) | POC | Spatial constraint on conversation. |
| B-multiple-citizens | Multiple Citizens Talking (cooldown, nearest responds, ambient conversations future) | Alpha | Multi-citizen voice management requires population system. |
| B-error-handling | When Things Go Wrong (STT fail silent, LLM fail apologetic, TTS fail text fallback) | POC | Graceful degradation from day 1. No error dialogs. |
| B-streaming | The Streaming Experience (chunked TTS, subtitle at LLM completion) | Alpha | Streaming optimization reduces perceived latency. |
| B-biography-voice | Biography Voice (memorial interaction, consent pipeline) | GA | Donor feature. Not core Venice experience. |
| B-session-invocations | Session Invocations from Voice (Nicolas-specific Claude Code trigger) | GA | Meta feature for Nicolas only. |
| B-audio-quality | Audio Quality Characteristics (capture format, HRTF, rolloff parameters) | POC | Audio format and spatial model defined at pipeline creation. |
| B-stream-audience | What the Stream Audience Sees (spectator mode, listen-only) | GA | Distribution feature. Post-launch. |

### voice/spatial

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | Citizen Voice Positioning (HRTF, directional, distance attenuation) | POC | Spatial voice is POC acceptance criteria. "Close eyes, point to speaker." |
| B2 | District Ambient Soundscapes (per-district sonic identity) | Alpha | Requires multiple districts. District identity through sound. |
| B3 | District Transitions (audio crossfade over bridge, no seam) | Alpha | Paired with navigation district transitions. |
| B4 | Reverb and Acoustic Space (calle tight, piazza diffuse, crossfade) | Beta | Reverb zones require geometry analysis. Polish feature. |
| B5 | Occlusion (sound blocked by buildings, muffled through archways) | Beta | Requires raycast or zone-based occlusion. Complex spatial audio. |
| B6 | Audio Priority (nearest clear, farthest texture, crowd merge) | Alpha | Required for 152-citizen scale. Max 32 sources. |
| B7 | Time-of-Day Audio (dawn bells, day bustle, dusk taverns, night silence) | Alpha | Paired with day/night cycle. |
| B8 | Weather Audio (rain on surfaces, directional wind, storm) | Beta | Paired with weather system. |
| B9 | What the Visitor Should Never Experience (flat audio, silence, pop-in, reverb mismatch, clipping) | Alpha | Anti-behaviors. Quality floor established at Alpha. |
| B10 | Testable Scenarios (directional accuracy, distance perception, district ID, occlusion, night) | Beta | Full test suite requires all spatial audio features. |

### infra/server

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | Connection: Entering the World (WebSocket auto-connect, no login, initial state burst) | POC | Fundamental. Server must deliver citizen state on connect. |
| B2 | Real-Time Updates: The Living City (citizen movement, world events, state changes) | Alpha | Full real-time updates require population system and events. |
| B3 | Reconnection: Seamless Recovery (brief drop, extended disconnect, server restart) | Alpha | Robustness for sustained sessions. |
| B4 | Multiple Visitors (solo V1, future multi-visitor) | GA | Multi-visitor is post-launch. Solo is default. |
| B5 | Rate Limiting (natural pace, rapid speech queue, spam drop, LLM backpressure) | Alpha | Required for stable voice pipeline under load. |
| B6 | Session Persistence (world advanced, citizen memory, visitor identity) | POC | Citizen memory persistence is POC acceptance criteria. |
| B7 | Error States Visible to Visitor (empty city on server down, slow voice under load, stale cache) | Alpha | Graceful degradation at Alpha quality level. |
| B8 | What the Visitor Should Never Experience (connection dialogs, loading screens, others' errors, data loss) | Alpha | Anti-behaviors. Quality floor. |
| B9 | Testable Scenarios (cold start, reconnection, speech under load, return after absence, restart survival) | Alpha | Server test suite meaningful at Alpha. |

### infra/performance

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | LOD Transitions: Buildings Simplify at Distance (4-level LOD, alpha blend) | Alpha | Multi-district rendering requires building LOD. |
| B2 | Citizen Tier Transitions (FULL/ACTIVE/AMBIENT detail levels) | Alpha | Part of the tier system. |
| B3 | Adaptive Quality: Automatic Degradation (frame time monitoring, 4-tier response) | Alpha | Quest 3 requires adaptive quality. No settings menu. |
| B4 | Thermal Throttling on Quest 3 (3ms margin, graceful response) | GA | Thermal management requires sustained testing on hardware. |
| B5 | What the Visitor Should Never See (pop-in, stutter, loading screens, FPS counter, LOD boundaries) | Alpha | Anti-behaviors. Quality floor at Alpha. |
| B6 | Audio and Network Performance (32 source cap, 20Hz broadcast, voice latency absorbed) | Alpha | Performance constraints for audio and network. |
| B7 | Testable Scenarios (sustained 72fps, LOD invisibility, tier transition, thermal endurance, crowd stress, adaptive recovery) | GA | Full performance test suite at GA. |

### infra/deployment

| Behavior | Description | Milestone | Justification |
|----------|-------------|-----------|---------------|
| B1 | One URL to Enter the World (no download, no install, no account) | GA | Production URL. POC/Alpha/Beta use dev URLs. |
| B2 | HTTPS: The Invisible Requirement (TLS for WebXR, mic, auto-renewal) | GA | Production security. Dev uses self-signed or localhost. |
| B3 | Load Time: The First Seconds (progressive assembly, no loading screen) | GA | Load time optimization is deployment polish. |
| B4 | Offline Behavior (no offline mode, connection lost graceful freeze) | Alpha | Client-side graceful freeze is an Alpha concern. |
| B5 | Updates Without Disruption (server rolling restart, client backward compat) | GA | Production deployment strategy. |
| B6 | Geographic Latency (voice latency absorbed into thinking time) | GA | Global access is GA concern. |
| B7 | Entry Points: VR, Desktop, Mobile (all three platforms) | GA | Desktop in POC. VR in Alpha. Mobile graceful degradation in GA. |
| B8 | What the Visitor Should Never Experience (install prompts, app store, regional blocking, maintenance windows) | GA | Production anti-behaviors. |
| B9 | Testable Scenarios (zero-friction entry, desktop parity, mobile degradation, update continuity, cert monitoring, geographic access) | GA | Production test suite. |

---

## Milestone Summary Counts

| Milestone | Behaviors Assigned | Core Rationale |
|-----------|-------------------|----------------|
| POC | 30 | Prove a citizen conversation grounded in real data, in a spatial world, with physics-driven emergence |
| Alpha | 52 | Scale to 152 citizens, 7 districts, VR, day/night, events -- the full core loop |
| Beta | 36 | Depth: economy simulation, governance, weather, occlusion, reverb, Forestiere news, scars |
| GA | 16 | Production: deployment, monitoring, thermal endurance, multi-platform, sustained performance |

---

## Cross-Cutting Invariants (Must Hold at Every Milestone)

From VALIDATION top-level invariants:

| Invariant | POC | Alpha | Beta | GA |
|-----------|-----|-------|------|-----|
| I1. Citizen authenticity (real memory + state, no manual mood) | Yes | Yes | Yes | Yes |
| I2. World continuity (world advances offline, no retroactive undo) | Partial (physics tick only) | Yes (full) | Yes | Yes |
| I3. Zero UI (no text overlay, no labels, no tutorial) | Yes | Yes | Yes | Yes |
| I4. Spatial truth (HRTF, position-accurate, distance attenuated) | Citizen voice only | Full citizen audio | + occlusion + reverb | Full |
| I5. Economic reality (statements match simulation state) | Yes (via Airtable) | Yes | Yes (+ simulation) | Yes |
