# VALIDATION: Venezia — What Must Be True

Invariants, proof-of-concept milestones, and acceptance criteria. Each milestone is a testable gate.

---

## Invariants (must ALWAYS hold)

### I1. Citizen authenticity
- No citizen response may be generated without querying their actual memory and economic state
- No citizen may say something that contradicts their stored beliefs (graph BELIEVES edges)
- No citizen's mood may be set manually — it must be computed from their situation
- No citizen may be "reset" — memory is append-only

### I2. World continuity
- The world state must advance even when no visitor is connected
- No event may be retroactively undone (what happened, happened)
- Time only moves forward
- Citizen positions must reflect their scheduled activity, not be randomly placed

### I3. Zero UI
- No text overlay may appear on screen during normal operation
- No floating labels, names, health bars, or indicators
- Exception: accessibility mode (configurable, off by default)
- No tutorial screens — the world teaches through experience

### I4. Spatial truth
- All audio must be spatially positioned (3D HRTF)
- A citizen's voice must come from their 3D position
- Sounds attenuate with distance
- You cannot hear a conversation happening 50 meters away

### I5. Economic reality
- If a citizen says grain is expensive, the grain price in the simulation must actually be high
- If a citizen says they are poor, their Ducats balance must reflect poverty
- No "flavor text" that contradicts simulation state

---

## POC Milestones

### POC-1: One District, Three Citizens (Target: 2 weeks)

**What:**
- Rialto district rendered in 3D (procedural canal, buildings, bridge)
- 3 Serenissima citizens loaded (1 merchant, 1 worker, 1 noble)
- Citizens walk predetermined paths based on their activity schedule
- Visitor can approach and speak to any citizen
- Citizen responds from their actual Serenissima state via KinOS/Claude

**Success criteria:**
- [ ] Walk through Rialto for 5 minutes without visual glitches
- [ ] Approach a citizen and have a 3-turn conversation about their actual economic situation
- [ ] Citizen's stated problems match their Airtable data (Ducats, debts, mood)
- [ ] Leave and return — citizen remembers previous conversation
- [ ] Audio is spatially positioned (test: close eyes, point to speaking citizen)

**Verification method:** Manual playtest by Nicolas. Record session. Cross-reference citizen statements with Airtable data.

### POC-2: World Liveness (Target: +2 weeks)

**What:**
- Blood Ledger physics tick running every 5 minutes
- Graph seeded with 20 citizens and their active narratives/tensions
- At least one Moment flip must occur within a 30-minute session
- World atmosphere changes in response to district mood

**Success criteria:**
- [ ] Physics tick completes without error for 1 hour continuous
- [ ] At least 1 tension break occurs, visible as behavior change in affected citizens
- [ ] District fog/lighting shifts measurably when citizen mood changes
- [ ] A citizen spontaneously brings up a recent event without being asked
- [ ] Two citizens observed discussing the same event independently

**Verification method:** Automated logging of physics tick + manual observation.

### POC-3: Population Scale (Target: +3 weeks)

**What:**
- All 152 Serenissima citizens loaded into the world
- Tiered rendering: 20 FULL + 60 ACTIVE + 100+ AMBIENT
- Performance maintained at 72fps (VR minimum) on Quest 3

**Success criteria:**
- [ ] Frame rate stays above 72fps with all citizens loaded
- [ ] Transition between tiers (approaching/leaving) is smooth (no pop-in)
- [ ] Walking through a crowded market (30+ visible citizens) feels alive, not laggy
- [ ] Ambient citizens provide believable crowd texture (movement, murmur)
- [ ] Memory usage stays under 2GB (Quest 3 constraint)

**Verification method:** FPS counter + memory profiler on Quest 3 hardware.

### POC-4: Emotional Impact (Target: +2 weeks)

**What:**
- Full day/night cycle with atmospheric changes
- Citizens have daily rhythms observable over a full in-world day
- At least 3 pre-seeded high-tension narratives ready to break
- Spatial audio polished (ambient layers + citizen voices + events)

**Success criteria:**
- [ ] 3 test users spend > 30 minutes in the world without prompting
- [ ] At least 1 test user can name 3+ citizens and describe their situations from memory
- [ ] At least 1 test user reports an unexpected emotional reaction
- [ ] Test users describe the experience as "a place" not "a program"
- [ ] Test users return for a second session voluntarily

**Verification method:** User testing with post-session interview. No guidance given during session.

---

## Anti-Patterns to Detect

### AP1: Chatbot Drift
**Symptom:** Citizen responses become generic, not grounded in their state
**Detection:** Compare citizen's spoken claims against Airtable data. If > 30% mismatch, context injection is broken.
**Fix:** Verify KinOS context builder includes actual economic state, not just personality.

### AP2: Dead World
**Symptom:** Citizens standing still, no ambient activity, silence
**Detection:** Monitor citizen movement logs. If < 50% of citizens moved in the last hour, activity scheduler is broken.
**Fix:** Verify economy tick is running, activity processor is dispatching.

### AP3: Performance Cliff
**Symptom:** Frame rate drops below 72fps, especially in markets
**Detection:** Automated FPS monitoring with district location logging.
**Fix:** Reduce ACTIVE tier radius, cull more aggressively, lower ambient citizen count.

### AP4: Memory Leak
**Symptom:** Experience degrades over session length (> 1 hour)
**Detection:** Monitor JS heap size over time.
**Fix:** Dispose Three.js geometries/materials for citizens leaving tier range.

### AP5: Uncanny Valley
**Symptom:** Citizens feel robotic — synchronized movement, identical gestures, unnatural pauses
**Detection:** User feedback ("they all move the same")
**Fix:** Add per-citizen randomization: movement speed variance, gesture timing jitter, idle animation variety.

---

## Data Integrity Checks

```
DAILY:
  - All 152 citizens have valid position in Airtable → assert no nulls
  - All FULL-tier citizens have .cascade/ directory with > 0 memory files
  - Blood Ledger graph has > 0 active tensions (world is not dead)
  - Economy tick has run in last 30 minutes (check timestamp)
  - Physics tick has run in last 10 minutes (check timestamp)

ON VISITOR CONNECT:
  - WebSocket connection established within 3 seconds
  - First citizen rendered within 5 seconds of entering district
  - Spatial audio system initialized (test tone at known position)
  - STT pipeline responsive (test with silence → should return empty, not error)
```
