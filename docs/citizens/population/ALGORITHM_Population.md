# Citizens/Population -- Algorithm: Managing 152 Citizens at 72fps

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
BEHAVIORS:       ./BEHAVIORS_Population.md
PATTERNS:        ./PATTERNS_Population.md
THIS:            ALGORITHM_Population.md (you are here)
SYNC:            ./SYNC_Population.md

IMPL:            src/client/citizens/citizen-manager.js (planned)
                 src/server/venice-state.js (planned)
```

---

## OVERVIEW

The server owns ground truth (schedules, positions, moods, activities). The client owns tier assignment, spawn/despawn, and rendering coordination. Communication is tier-stratified WebSocket (FULL: 33ms, ACTIVE: 500ms, AMBIENT: 2s, HIDDEN: never). Every procedure below is specified at a level sufficient for direct implementation.

---

## DATA STRUCTURES

### CitizenPopulationState (client-side, one per citizen)

```
CitizenPopulationState {
  citizenId:         string
  serverPosition:    { x, y, z }        // last from server
  serverHeading:     number              // radians
  interpolatedPos:   { x, y, z }        // display position (lerped each frame)
  interpolatedHead:  number

  activity:          string              // from server: "working"|"trading"|"idle"|...
  mood:              string
  moodValence:       number              // -1.0 to +1.0
  socialClass:       string              // "Nobili"|"Cittadini"|"Popolani"|"Facchini"|"Forestieri"
  isOutdoors:        boolean
  isAlive:           boolean

  tier:              HIDDEN|AMBIENT|ACTIVE|FULL
  prevTier:          HIDDEN|AMBIENT|ACTIVE|FULL
  desiredTier:       HIDDEN|AMBIENT|ACTIVE|FULL
  compositeScore:    number              // 0.0-1.0
  effectiveDistance:  number              // meters
  tierStableFrames:  number              // frames at current tier (hysteresis)

  transitionT:       number              // 0.0-1.0 crossfade progress
  transitionDir:     "up"|"down"|null

  lastServerUpdate:  number              // timestamp
  lastTierRecalc:    number              // timestamp
  scheduleSlot:      ScheduleEntry|null
  eventOverride:     EventOverride|null
}
```

### TierAssignment (ephemeral, per scoring pass)

```
TierAssignment {
  citizenId:        string
  compositeScore:   number         // 0.0-1.0, higher = closer tier
  rawDistance:       number         // meters to visitor
  distanceFactor:   number         // 0.0-1.0
  relationFactor:   number         // 0.0-1.0
  activityFactor:   number         // 0.0-1.0
  desiredTier:      TierLevel      // from thresholds
  finalTier:        TierLevel      // after hysteresis + budget
}
```

### ScheduleEntry (server-side, from Airtable ACTIVITIES)

```
ScheduleEntry {
  citizenId:        string
  startHour:        number         // 0-23 world time
  endHour:          number         // 0-23 (wraps midnight if start > end)
  activity:         string
  location:         { x, y, z }    // world-space destination
  districtId:       string
  indoors:          boolean        // true = not renderable
  priority:         number         // 0.0-1.0, feeds tier scoring
  groupId:          string|null    // citizens with same groupId cluster
}
```

### DensityTarget (per district, per time slot)

```
DensityTarget {
  districtId:       string
  timeSlot:         "dawn"|"morning"|"midday"|"afternoon"|"evening"|"night"
  targetCount:      number
  minCount:         number
  maxCount:         number
  classMix:         { Nobili, Cittadini, Popolani, Facchini, Forestieri }  // fractions, sum 1.0
}
```

### EventOverride (temporary, applied during world events)

```
EventOverride {
  eventId:          string
  eventType:        "gathering"|"dispersal"|"procession"|"crisis"
  targetPosition:   { x, y, z }
  startTime:        number         // timestamp
  duration:         number         // seconds world time
  priority:         number         // overrides schedule if higher
  movementSpeed:    number         // multiplier: 1.0 normal, 2.0 running
  holdAtTarget:     boolean        // true = stay after arriving
}
```

### PopulationManagerState (singleton, client-side)

```
PopulationManagerState {
  citizens:         Map<string, CitizenPopulationState>   // all 152
  visitorPosition:  { x, y, z }
  worldTimeHour:    number           // 0.0-24.0
  currentTimeSlot:  string
  tierCounts:       { FULL, ACTIVE, AMBIENT, HIDDEN }
  frameBudget:      { maxFull:20, maxActive:60, maxAmbient:120,
                      maxTierChanges:3, maxSpawns:5,           // per frame
                      tierChangesUsed:0, spawnsUsed:0 }
  scoringCursor:    number           // round-robin index
  frameNumber:      number
}
```

---

## ALGORITHM: Composite Tier Score

### Constants

```
W_DISTANCE = 0.60    W_RELATIONSHIP = 0.25    W_ACTIVITY = 0.15
MAX_RENDER_DIST         = 200.0   // meters
RELATIONSHIP_DIST_BONUS = 5.0     // known citizens "feel" 5m closer
ACTIVITY_DIST_BONUS     = 3.0     // important activities "feel" 3m closer
SESSION_INTERACTION_BOOST = 0.3   // added if spoken to this session
```

### Procedure: computeTierScore

```
FUNCTION computeTierScore(citizen, visitorPos, sessionInteractions) -> TierAssignment:

  dx = citizen.serverPosition.x - visitorPos.x
  dy = citizen.serverPosition.y - visitorPos.y
  dz = citizen.serverPosition.z - visitorPos.z
  rawDistance = sqrt(dx*dx + dy*dy + dz*dz)

  // Early exit beyond render range + hysteresis headroom
  IF rawDistance > MAX_RENDER_DIST + 20:
    RETURN { citizenId, compositeScore: 0, rawDistance, all factors: 0, desiredTier: HIDDEN }

  // Distance factor: 1.0 at 0m, 0.0 at 200m
  distanceFactor = clamp(1.0 - rawDistance / MAX_RENDER_DIST, 0, 1)

  // Relationship factor: trust + session bonus
  trustScore = getRelationshipTrust(citizen.citizenId)   // 0.0-1.0
  sessionBonus = IF citizen.citizenId IN sessionInteractions THEN 0.3 ELSE 0.0
  relationFactor = clamp(trustScore + sessionBonus, 0, 1)

  // Activity factor: from schedule priority or default lookup
  IF citizen.scheduleSlot != null:
    activityFactor = citizen.scheduleSlot.priority
  ELSE:
    activityFactor = ACTIVITY_PRIORITY[citizen.activity]
    // "trading":0.8  "working":0.6  "socializing":0.5  "patrolling":0.5
    // "praying":0.4  "eating":0.3   "walking":0.2      "idle":0.1  "resting":0.05
  IF NOT citizen.isOutdoors:
    activityFactor = 0.0

  // Composite score
  compositeScore = W_DISTANCE * distanceFactor
                 + W_RELATIONSHIP * relationFactor
                 + W_ACTIVITY * activityFactor

  // Effective distance (reduced by relationship and activity bonuses)
  effectiveDistance = max(rawDistance - relationFactor*5.0 - activityFactor*3.0, 0)

  // Desired tier from effective distance
  IF NOT citizen.isAlive OR NOT citizen.isOutdoors:
    desiredTier = HIDDEN
  ELSE IF effectiveDistance < 20:   desiredTier = FULL
  ELSE IF effectiveDistance < 80:   desiredTier = ACTIVE
  ELSE IF effectiveDistance < 200:  desiredTier = AMBIENT
  ELSE:                             desiredTier = HIDDEN

  RETURN { citizenId, compositeScore, rawDistance, distanceFactor,
           relationFactor, activityFactor, desiredTier, finalTier: desiredTier }
```

---

## ALGORITHM: Hysteresis Bands

Prevents flicker at tier boundaries. Upgrade is immediate. Downgrade requires crossing a wider threshold and holding for a minimum number of frames.

```
HYSTERESIS_BAND = { FULL: 5.0, ACTIVE: 5.0, AMBIENT: 10.0 }
  // FULL->ACTIVE at 25m, ACTIVE->AMBIENT at 85m, AMBIENT->HIDDEN at 210m
MIN_STABLE_FRAMES = 15    // ~250ms at 60fps before allowing downgrade
```

### Procedure: applyHysteresis

```
FUNCTION applyHysteresis(citizen, assignment) -> TierLevel:

  current = citizen.tier
  desired = assignment.desiredTier
  dist    = citizen.effectiveDistance

  // Conversation lock: never downgrade while talking to visitor
  IF citizen.activity == "talking":
    RETURN max(current, FULL)

  // Upgrade: apply immediately
  IF desired > current:
    citizen.tierStableFrames = 0
    RETURN desired

  // Same tier: accumulate stability
  IF desired == current:
    citizen.tierStableFrames += 1
    RETURN current

  // Downgrade: require MIN_STABLE_FRAMES + hysteresis band
  IF citizen.tierStableFrames < MIN_STABLE_FRAMES:
    RETURN current

  IF current == FULL    AND dist < 25.0:   RETURN FULL
  IF current == ACTIVE  AND dist < 85.0:   RETURN ACTIVE
  IF current == AMBIENT AND dist < 210.0:  RETURN AMBIENT

  citizen.tierStableFrames = 0
  RETURN desired
```

---

## ALGORITHM: Budget Enforcement

After hysteresis, cap citizens per tier. Citizens compete by composite score.

### Procedure: enforceBudget

```
FUNCTION enforceBudget(assignments, budget) -> void:
  // Mutates finalTier in each assignment.

  fullCandidates   = [a FOR a IN assignments WHERE a.finalTier == FULL]
  activeCandidates = [a FOR a IN assignments WHERE a.finalTier == ACTIVE]

  sortDescending(fullCandidates, by: compositeScore)
  sortDescending(activeCandidates, by: compositeScore)

  // Demote excess FULL to ACTIVE
  IF length(fullCandidates) > budget.maxFull:
    FOR i = budget.maxFull TO length(fullCandidates) - 1:
      fullCandidates[i].finalTier = ACTIVE
      activeCandidates.append(fullCandidates[i])
    sortDescending(activeCandidates, by: compositeScore)

  // Demote excess ACTIVE to AMBIENT
  IF length(activeCandidates) > budget.maxActive:
    FOR i = budget.maxActive TO length(activeCandidates) - 1:
      activeCandidates[i].finalTier = AMBIENT

  // Demote excess AMBIENT to HIDDEN (only under memory pressure)
  ambientCandidates = [a FOR a IN assignments WHERE a.finalTier == AMBIENT]
  IF length(ambientCandidates) > budget.maxAmbient:
    sortDescending(ambientCandidates, by: compositeScore)
    FOR i = budget.maxAmbient TO length(ambientCandidates) - 1:
      ambientCandidates[i].finalTier = HIDDEN
```

---

## ALGORITHM: Spawn/Despawn Lifecycle

Tier transitions use crossfade. Both old and new representations coexist during the transition. Multi-step jumps (HIDDEN->ACTIVE) chain through intermediates one step per frame.

### Constants

```
TRANSITION_DURATION = {
  HIDDEN_TO_AMBIENT:  0.8s,   AMBIENT_TO_HIDDEN:  1.0s,
  AMBIENT_TO_ACTIVE:  0.5s,   ACTIVE_TO_AMBIENT:  0.5s,
  ACTIVE_TO_FULL:     0.3s,   FULL_TO_ACTIVE:     0.4s
}
```

### Procedure: initiateTransition

```
FUNCTION initiateTransition(citizen, newTier, budget) -> boolean:

  // Check per-frame budget
  IF newTier == AMBIENT AND citizen.tier == HIDDEN:
    IF budget.spawnsUsed >= budget.maxSpawns: RETURN false
    budget.spawnsUsed += 1
  ELSE:
    IF budget.tierChangesUsed >= budget.maxTierChanges: RETURN false
    budget.tierChangesUsed += 1

  // Multi-step jump: only advance one tier at a time
  IF abs(newTier - citizen.tier) > 1:
    newTier = citizen.tier + sign(newTier - citizen.tier)

  citizen.prevTier      = citizen.tier
  citizen.tier          = newTier
  citizen.transitionT   = 0.0
  citizen.transitionDir = IF newTier > citizen.prevTier THEN "up" ELSE "down"
  citizen.tierStableFrames = 0

  embodiment.prepareTier(citizen.citizenId, newTier)
  RETURN true
```

### Procedure: updateTransition

```
FUNCTION updateTransition(citizen, deltaTime) -> void:
  IF citizen.transitionDir == null: RETURN

  key = tierTransitionKey(citizen.prevTier, citizen.tier)
  duration = TRANSITION_DURATION[key]

  citizen.transitionT += deltaTime / duration
  t = smoothstep(0, 1, clamp(citizen.transitionT, 0, 1))

  // Drive crossfade: t=0 old visible, t=1 new visible
  embodiment.setCrossfade(citizen.citizenId, citizen.prevTier, citizen.tier, t)

  IF citizen.transitionT >= 1.0:
    citizen.transitionT   = 1.0
    citizen.transitionDir = null
    citizen.prevTier      = citizen.tier
    embodiment.finishTransition(citizen.citizenId, citizen.tier)
```

---

## ALGORITHM: Daily Schedule System

### Procedure: resolveSchedule (server-side)

```
FUNCTION resolveSchedule(citizenId, worldTimeHour, scheduleTable) -> ScheduleEntry:
  // scheduleTable: sorted by startHour

  FOR each entry IN scheduleTable:
    // Normal range
    IF entry.startHour <= entry.endHour:
      IF worldTimeHour >= entry.startHour AND worldTimeHour < entry.endHour:
        RETURN entry
    // Midnight wrap (e.g., 22-6)
    ELSE:
      IF worldTimeHour >= entry.startHour OR worldTimeHour < entry.endHour:
        RETURN entry

  // Fallback: idle at home, indoors
  RETURN ScheduleEntry { citizenId, 0, 24, "resting", homePos, homeDistrict, true, 0.0, null }
```

### Procedure: updateCitizenFromSchedule (server-side, per tick)

```
FUNCTION updateCitizenFromSchedule(citizen, schedule, tickDelta) -> void:
  citizen.scheduleSlot = schedule
  citizen.isOutdoors = NOT schedule.indoors

  IF NOT citizen.isOutdoors:
    citizen.serverPosition = schedule.location
    citizen.activity = schedule.activity
    RETURN

  dx = schedule.location.x - citizen.serverPosition.x
  dz = schedule.location.z - citizen.serverPosition.z
  dist = sqrt(dx*dx + dz*dz)

  walkSpeed = CLASS_WALK_SPEED[citizen.socialClass]
  // Nobili: 0.9  Cittadini: 1.1  Popolani: 1.2  Facchini: 1.4  Forestieri: 1.0
  maxStep = walkSpeed * tickDelta

  IF dist > 1.0:
    factor = min(maxStep / dist, 1.0)
    citizen.serverPosition.x += dx * factor
    citizen.serverPosition.z += dz * factor
    citizen.serverHeading = atan2(dx, dz)
    citizen.activity = "walking"
  ELSE:
    citizen.serverPosition = schedule.location
    citizen.activity = schedule.activity
```

### Procedure: buildDailySchedule (server-side, once per world-day)

Maps Airtable ACTIVITIES rows to ScheduleEntry array. Each row provides Start Hour, End Hour, Activity Type, Lat/Lng (converted via `geoToWorld`), District, Indoor flag, Importance (0-10 scaled to 0.0-1.0), Group ID. Sort by startHour ascending, then `fillScheduleGaps` inserts "resting at home" entries for uncovered hours.

---

## ALGORITHM: Crowd Density Management

Time slots: dawn(5-7, 0.30), morning(7-10, 0.70), midday(10-14, 1.00), afternoon(14-18, 0.85), evening(18-22, 0.60), night(22-5, 0.15). The globalScale multiplies density targets.

### Procedure: rebalanceDistrictPopulation (server-side, every 5 minutes)

```
FUNCTION rebalanceDistrictPopulation(citizens, densityTargets, timeSlot) -> void:

  // Count actual outdoor citizens per district
  actual = Map<districtId, count>
  FOR each citizen WHERE citizen.isOutdoors AND citizen.isAlive:
    actual[citizen.scheduleSlot.districtId] += 1

  // Compute deficit per district
  deficits = Map<districtId, { deficit, target }>
  FOR each districtId, targets IN densityTargets:
    target = findTargetForSlot(targets, timeSlot)
    deficits[districtId] = { deficit: target.targetCount - (actual[districtId] OR 0), target }

  surplus  = [d FOR d IN deficits WHERE d.deficit < -3]
  shortage = [d FOR d IN deficits WHERE d.deficit > 3]
  IF length(shortage) == 0 OR length(surplus) == 0: RETURN

  sortDescending(shortage, by: deficit)    // biggest need first
  sortAscending(surplus, by: deficit)      // biggest excess first

  FOR each need IN shortage:
    FOR each excess IN surplus:
      IF need.deficit <= 0 OR excess.deficit >= -1: CONTINUE

      // Find moveable low-priority citizens in surplus district
      candidates = getCitizensInDistrict(excess.districtId)
      candidates = [c WHERE c.scheduleSlot.priority < 0.5 AND c.eventOverride == null]
      sortAscending(candidates, by: scheduleSlot.priority)

      toMove = min(need.deficit, abs(excess.deficit) - 1, length(candidates))
      FOR i = 0 TO toMove - 1:
        c = candidates[i]
        c.scheduleSlot = ScheduleEntry {
          citizenId: c.citizenId, startHour: now(), endHour: now()+2,
          activity: "walking", location: randomActivityNode(need.districtId),
          districtId: need.districtId, indoors: false, priority: 0.2, groupId: null
        }
        need.deficit -= 1
        excess.deficit += 1
```

---

## ALGORITHM: Off-Screen Simulation

### Procedure: offScreenTick (server-side, every 30 seconds)

```
FUNCTION offScreenTick(citizens, worldTimeHour, tickDelta) -> void:
  FOR each citizen IN citizens:
    schedule = resolveSchedule(citizen.citizenId, worldTimeHour, citizen.scheduleTable)
    updateCitizenFromSchedule(citizen, schedule, tickDelta)

    // Mood drift toward class baseline
    baseline = CLASS_BASELINE_MOOD[citizen.socialClass]
    citizen.moodValence += (baseline - citizen.moodValence) * 0.05 * tickDelta

    // Apply queued economic events
    IF citizen.lastEconomicEvent != null:
      citizen.moodValence = clamp(citizen.moodValence + citizen.lastEconomicEvent.moodImpact, -1, 1)
      citizen.lastEconomicEvent = null
```

### Procedure: prepareDistrictState (on district entry)

```
FUNCTION prepareDistrictState(districtId, worldTimeHour) -> void:
  // Ensure all citizens in the district are at correct mid-activity positions
  // before the first WebSocket broadcast to a newly arrived visitor.

  FOR each citizen IN getCitizensInDistrict(districtId):
    schedule = resolveSchedule(citizen.citizenId, worldTimeHour, citizen.scheduleTable)
    elapsedInSlot = (worldTimeHour - schedule.startHour + 24) % 24
    walkTime = distance(citizen.serverPosition, schedule.location) / CLASS_WALK_SPEED[citizen.socialClass]

    IF elapsedInSlot > walkTime:
      citizen.serverPosition = schedule.location   // should have arrived
      citizen.activity = schedule.activity
    // ELSE: still en route, off-screen tick position is correct

    citizen.scheduleSlot = schedule
    citizen.isOutdoors = NOT schedule.indoors
```

---

## ALGORITHM: Population Response to Events

### Procedure: handleGatheringEvent

```
FUNCTION handleGatheringEvent(event, citizens) -> void:
  // event: { id, position, radius, districtId, importance: 0-1, duration }

  affected = getCitizensInDistrict(event.districtId)
  IF event.importance > 0.7:
    FOR each adj IN getAdjacentDistricts(event.districtId):
      FOR each c IN getCitizensInDistrict(adj):
        IF c.scheduleSlot.priority < event.importance:
          affected.append(c)

  FOR each citizen IN affected:
    IF citizen.eventOverride != null AND citizen.eventOverride.priority >= event.importance:
      CONTINUE

    angle = random() * 2 * PI
    dist  = 3.0 + random() * event.radius
    citizen.eventOverride = EventOverride {
      eventId: event.id, eventType: "gathering",
      targetPosition: { x: event.position.x + cos(angle)*dist, z: event.position.z + sin(angle)*dist },
      startTime: now(), duration: event.duration, priority: event.importance,
      movementSpeed: 1.0 + event.importance * 0.5, holdAtTarget: true
    }
```

### Procedure: handleDispersalEvent

```
FUNCTION handleDispersalEvent(event, citizens) -> void:
  // event: { id, position, dangerRadius, districtId, severity, duration }

  FOR each citizen IN citizens:
    dist = distance(citizen.serverPosition, event.position)
    IF dist > event.dangerRadius: CONTINUE

    fleeAngle = atan2(citizen.serverPosition.z - event.position.z,
                      citizen.serverPosition.x - event.position.x)

    // Guards and patrolling Facchini approach instead of fleeing
    IF citizen.socialClass == "Facchini" AND citizen.activity == "patrolling":
      fleeAngle += PI
      speed = 1.5
    ELSE:
      fleeAngle += (random() - 0.5) * 0.8    // scatter spread
      speed = 1.5 + (1.0 - dist / event.dangerRadius)

    fleeDist = event.dangerRadius + 10.0 + random() * 20.0
    citizen.eventOverride = EventOverride {
      eventId: event.id, eventType: "dispersal",
      targetPosition: { x: citizen.serverPosition.x + cos(fleeAngle)*fleeDist,
                        z: citizen.serverPosition.z + sin(fleeAngle)*fleeDist },
      startTime: now(), duration: event.duration, priority: event.severity,
      movementSpeed: speed, holdAtTarget: false
    }
```

### Procedure: expireEventOverrides (every 30 seconds)

```
FUNCTION expireEventOverrides(citizens) -> void:
  FOR each citizen IN citizens:
    IF citizen.eventOverride != null AND elapsed(citizen.eventOverride.startTime) >= citizen.eventOverride.duration:
      citizen.eventOverride = null
```

---

## ALGORITHM: Master Population Update Loop

Runs every frame on the client. Amortizes scoring across frames (20 citizens/frame, full cycle every ~10 frames at 152 citizens).

### Constants

```
SCORING_BUDGET_PER_FRAME = 20
POSITION_LERP_FACTOR     = 0.12
HEADING_LERP_FACTOR      = 0.15
```

### Procedure: populationUpdate (per frame)

```
FUNCTION populationUpdate(deltaTime, visitorPos) -> void:
  state = PopulationManagerState
  state.frameNumber += 1
  state.visitorPosition = visitorPos
  state.frameBudget.tierChangesUsed = 0
  state.frameBudget.spawnsUsed = 0

  citizenArray = state.citizens.valuesAsArray()

  // --- Phase 1: Amortized Scoring ---
  batch = []
  FOR i = 0 TO SCORING_BUDGET_PER_FRAME - 1:
    idx = (state.scoringCursor + i) % length(citizenArray)
    citizen = citizenArray[idx]
    a = computeTierScore(citizen, visitorPos, getSessionInteractions())
    citizen.compositeScore   = a.compositeScore
    citizen.effectiveDistance = max(a.rawDistance - a.relationFactor*5 - a.activityFactor*3, 0)
    citizen.desiredTier      = a.desiredTier
    batch.append(a)
  state.scoringCursor = (state.scoringCursor + SCORING_BUDGET_PER_FRAME) % length(citizenArray)

  // --- Phase 2: Hysteresis (batch only) ---
  FOR each a IN batch:
    a.finalTier = applyHysteresis(state.citizens.get(a.citizenId), a)

  // --- Phase 3: Full Budget Enforcement (once per scoring cycle) ---
  IF state.scoringCursor < SCORING_BUDGET_PER_FRAME:    // wrapped = full cycle done
    allAssignments = buildAllAssignments(citizenArray)
    FOR each a IN allAssignments:
      a.finalTier = applyHysteresis(state.citizens.get(a.citizenId), a)
    enforceBudget(allAssignments, state.frameBudget)
    FOR each a IN allAssignments:
      c = state.citizens.get(a.citizenId)
      IF a.finalTier != c.tier:
        initiateTransition(c, a.finalTier, state.frameBudget)
    state.tierCounts = countTiers(citizenArray)
  ELSE:
    FOR each a IN batch:
      c = state.citizens.get(a.citizenId)
      IF a.finalTier != c.tier:
        initiateTransition(c, a.finalTier, state.frameBudget)

  // --- Phase 4: Transition Updates ---
  FOR each citizen IN citizenArray:
    IF citizen.transitionDir != null:
      updateTransition(citizen, deltaTime)

  // --- Phase 5: Position Interpolation ---
  FOR each citizen IN citizenArray WHERE citizen.tier != HIDDEN:
    citizen.interpolatedPos.x += (citizen.serverPosition.x - citizen.interpolatedPos.x) * POSITION_LERP_FACTOR
    citizen.interpolatedPos.y += (citizen.serverPosition.y - citizen.interpolatedPos.y) * POSITION_LERP_FACTOR
    citizen.interpolatedPos.z += (citizen.serverPosition.z - citizen.interpolatedPos.z) * POSITION_LERP_FACTOR
    headDiff = wrapAngle(citizen.serverHeading - citizen.interpolatedHead)
    citizen.interpolatedHead += headDiff * HEADING_LERP_FACTOR
    embodiment.setPosition(citizen.citizenId, citizen.interpolatedPos, citizen.interpolatedHead)

  // --- Phase 6: Time Slot Check ---
  newSlot = resolveTimeSlot(state.worldTimeHour)
  IF newSlot != state.currentTimeSlot:
    state.currentTimeSlot = newSlot
    sendToServer("time_slot_changed", { slot: newSlot })
```

---

## DATA FLOW

```
Airtable (CITIZENS, ACTIVITIES, RELATIONSHIPS)
  | every 15 min via economy/sync
  v
Server: venice-state.js
  | buildDailySchedule(), resolveSchedule(), offScreenTick() (30s)
  | rebalanceDistrictPopulation() (5 min), event handlers
  |
  | WebSocket: citizen_state_batch (tier-stratified frequency)
  v
Client: citizen-manager.js
  | populationUpdate() every frame:
  |   scoring (20/frame) -> hysteresis -> budget -> transitions -> interpolation
  v
Client: citizens/embodiment
  | prepareTier(), setCrossfade(), setPosition(), finishTransition()
  v
Three.js -> GPU -> 72fps
```

---

## COMPLEXITY

**Per frame (client):** Scoring O(20), budget O(N log N) once/500ms, transitions O(T<10), interpolation O(V<=180). Total: < 0.5ms.
**Per tick (server):** Off-screen O(152)/30s < 5ms. Density O(N*D)/5min < 10ms. Events O(N), rare.
**Space:** Client ~100KB (152 states). Server ~300KB (152 schedules).

---

## INTERACTIONS

| Module | What We Call | What We Get |
|--------|--------------|-------------|
| `citizens/embodiment` | `prepareTier`, `setCrossfade`, `setPosition`, `finishTransition` | Mesh allocation, crossfade, transform, disposal |
| `economy/sync` | `getCitizenSchedule`, `getRelationshipTrust` | Schedule entries, trust 0.0-1.0 |
| `world/districts` | `getAdjacentDistricts`, `getDistrictActivityNodes` | Adjacency, crowd waypoints |
| `narrative/events` | `onWorldEvent(callback)` | Gathering/dispersal triggers |
| `infra/performance` | `getFrameBudget()` | Adaptive tier caps under pressure |
