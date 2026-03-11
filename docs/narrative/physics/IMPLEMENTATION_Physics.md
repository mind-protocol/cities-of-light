# IMPLEMENTATION: narrative/physics -- Code-Level Specification

Concrete implementation of the narrative physics engine for Venezia. The physics-bridge.js file structure, tick runner, Blood Ledger code reuse strategy, FalkorDB transaction patterns for atomic ticks, constants configuration, logging, and integration with the Express server process.

---

## File Structure

```
cities-of-light/
  src/
    server/
      physics/
        physics-bridge.js     ← Main entry: tick runner, lifecycle, integration
        tick.js               ← The 6-phase tick implementation
        pump.js               ← Phase 1: energy generation
        route.js              ← Phase 2: energy flow (SUPPORTS, TENSION, FEEDS)
        decay.js              ← Phase 3: narrative forgetting
        flip.js               ← Phase 4: Moment detection and flip
        inject.js             ← Phase 5: economic energy injection
        emit.js               ← Phase 6: event emission (delegates to events module)
        homeostasis.js        ← Post-tick pressure balancing
        constants.js          ← All physics constants (Venice-calibrated)
        state.js              ← Tick state persistence (cooldowns, flip history)
        index.js              ← Barrel export
```

---

## Dependencies

No new npm packages beyond what the graph module requires. The physics module operates entirely through graph queries.

```json
{
  "falkordb": "^0.5.0"
}
```

The physics module imports from the graph module:

```js
import { getConnectedClient } from '../graph/client.js';
```

---

## Environment Variables

```bash
# Physics-specific
VENEZIA_TICK_INTERVAL_MS=300000        # 5 minutes in milliseconds (default)
VENEZIA_PHYSICS_ENABLED=true           # Kill switch for physics tick
VENEZIA_PHYSICS_LOG_LEVEL=info         # debug | info | warn | error

# Economic injection (written by serenissima-sync.js)
VENEZIA_ECON_DELTAS_PATH=./state/econ_deltas.json  # Path to economic delta file
```

---

## PH-IMPL-1. Blood Ledger Code Reuse Strategy

### What We Reuse (Conceptually)

The Blood Ledger engine (at `/home/mind-protocol/the-blood-ledger/engine/` proxying to `/home/mind-protocol/ngram/engine/`) is written in Python. Venezia's physics runs in Node.js inside the Express server process. Direct code import is not possible. Instead, we reuse the **algorithms and constants**, not the code.

### Mapping from Blood Ledger Python to Venezia Node.js

| Blood Ledger (Python) | Venezia (Node.js) | Reuse Type |
|---|---|---|
| `ngram/engine/physics/constants.py` | `src/server/physics/constants.js` | Constants transcribed, Venice-calibrated |
| `ngram/engine/physics/tick_v1_2.py` | `src/server/physics/tick.js` | Algorithm ported, same 6-phase structure |
| `ngram/engine/physics/graph/graph_queries.py` | `src/server/graph/queries.js` | Cypher queries reused verbatim |
| `ngram/engine/physics/graph/graph_ops.py` | `src/server/graph/mutations.js` | Mutation patterns ported |
| `ngram/engine/infrastructure/tempo/tempo_controller.py` | `src/server/physics/physics-bridge.js` | Tick scheduling pattern adapted |

### What We Do NOT Reuse

- **Database adapter layer** (`ngram/engine/infrastructure/database`): Venezia uses FalkorDB-only, no Neo4j support needed.
- **Embedding system** (`ngram/engine/physics/embeddings.py`): Not needed for Venice -- topic overlap uses keyword matching.
- **Playthrough management** (`ngram/engine/playthroughs/`): Venice has a single persistent graph, not multiple playthroughs.
- **Canon system** (`ngram/engine/infrastructure/canon/`): Replaced by the events module's lifecycle system.
- **Agent orchestration** (`ngram/engine/infrastructure/orchestration/`): Venice uses its own event + citizen-router architecture.

### Key Architectural Difference

Blood Ledger's `TempoController` (Python, async) manages game speed modes (pause, 1x, 2x, 3x) and surfaces Moments to a single player. Venice has no speed modes -- the physics tick runs continuously at fixed 5-minute intervals with no pause. Moments flip into events that affect all connected VR clients simultaneously.

---

## PH-IMPL-2. Constants Configuration (`constants.js`)

All constants from ALGORITHM_Physics.md P1, transcribed to JS with Venice calibrations.

```js
// src/server/physics/constants.js

/**
 * Physics constants for the Venezia narrative engine.
 *
 * Venice-calibrated values differ from Blood Ledger defaults due to
 * the citizen count (186 vs ~15) and the persistent world model.
 *
 * Blood Ledger reference: ngram/engine/physics/constants.py
 * Algorithm reference:    docs/narrative/physics/ALGORITHM_Physics.md P1
 */

// ── Timing ──────────────────────────────────────────────────

/** Tick interval in minutes. Sacred. Do not change. */
export const TICK_INTERVAL_MINUTES = 5;

/** Tick interval in milliseconds (derived). */
export const TICK_INTERVAL_MS = parseInt(
  process.env.VENEZIA_TICK_INTERVAL_MS || String(TICK_INTERVAL_MINUTES * 60 * 1000),
  10
);

// ── Decay ───────────────────────────────────────────────────

/** Base decay rate per tick. */
export const DECAY_RATE = 0.02;

/** Floor during low-pressure recovery. */
export const DECAY_RATE_MIN = 0.005;

/** Ceiling during runaway dampening. */
export const DECAY_RATE_MAX = 0.1;

/** Core types decay at 1/4 rate. */
export const CORE_DECAY_MULTIPLIER = 0.25;

/** Venice-specific persistent narrative types (Blood Ledger uses oath, blood, debt). */
export const CORE_TYPES = ['debt', 'grudge', 'oath', 'alliance'];

/** Narratives never decay below this weight. */
export const MIN_WEIGHT = 0.01;

// ── Energy Generation ───────────────────────────────────────

/**
 * Per-character energy pump rate.
 * Lower than Blood Ledger (0.5) because Venice has 186 citizens vs ~15.
 * Total energy injected per tick: ~186 * 0.3 = ~56 units (vs Blood Ledger's ~7.5).
 */
export const GENERATION_RATE = 0.3;

// ── Routing ─────────────────────────────────────────────────

/** Energy flow through SUPPORTS edges. */
export const ROUTE_FACTOR_SUPPORTS = 0.20;

/** Energy accumulation on TENSION edges. */
export const ROUTE_FACTOR_TENSION = 0.30;

/** Moment energy absorption rate from feeding narratives. */
export const DRAW_RATE = 0.3;

/** Excess energy return to characters. */
export const BACKFLOW_RATE = 0.1;

/** Link cooling: drain to connected nodes. */
export const LINK_DRAIN_RATE = 0.3;

/** Link cooling: energy converts to weight. */
export const LINK_TO_WEIGHT_RATE = 0.1;

/** Links below this energy are excluded from physics. */
export const COLD_THRESHOLD = 0.01;

/** Max links processed per node. */
export const TOP_N_LINKS = 20;

// ── Moment Flipping ─────────────────────────────────────────

/** Default Moment flip threshold (Venice: higher due to more citizens). */
export const DEFAULT_BREAKING_POINT = 3.0;

/** Moment threshold bounds. */
export const MOMENT_THRESHOLD_MIN = 2.0;
export const MOMENT_THRESHOLD_MAX = 6.0;

/** Ticks after flip before same-district flip allowed. */
export const COOLDOWN_TICKS = 3;

/** Hard cap on simultaneously active events. */
export const MAX_CONCURRENT_ACTIVE_MOMENTS = 3;

/** New moments after a flip get higher thresholds. */
export const THRESHOLD_ESCALATION_FACTOR = 1.5;

// ── Homeostasis ─────────────────────────────────────────────

/** Pressure floor for homeostasis. */
export const CRITICALITY_TARGET_MIN = 0.4;

/** Pressure ceiling for homeostasis. */
export const CRITICALITY_TARGET_MAX = 0.6;

/** At least one narrative should be this hot. */
export const CRITICALITY_HOT_THRESHOLD = 0.7;

// ── Economic Injection ──────────────────────────────────────

/** Ducats delta to energy conversion factor. */
export const ECONOMIC_ENERGY_FACTOR = 0.001;

/** Mood delta to belief energy boost. */
export const MOOD_ENERGY_FACTOR = 0.1;

// ── Time-of-Day Modifiers ───────────────────────────────────

/** Generation rate reduction at night (0:00-5:00). */
export const NIGHT_GENERATION_MULTIPLIER = 0.3;

/** Generation rate boost at dawn (5:00-7:00). */
export const DAWN_GENERATION_MULTIPLIER = 1.2;

/** Visitor attention boost when discussing a belief. */
export const VISITOR_ATTENTION_BOOST = 0.02;

// ── Time-of-Day Mapping ────────────────────────────────────

/**
 * Get the generation multiplier for a given hour.
 *
 * @param {number} hour - 0-23
 * @returns {number}
 */
export function getTimeMultiplier(hour) {
  if (hour >= 0 && hour < 5)   return NIGHT_GENERATION_MULTIPLIER;  // 0.3
  if (hour >= 5 && hour < 7)   return DAWN_GENERATION_MULTIPLIER;   // 1.2
  if (hour >= 7 && hour < 12)  return 1.0;                          // morning
  if (hour >= 12 && hour < 14) return 0.9;                          // siesta
  if (hour >= 14 && hour < 18) return 1.0;                          // afternoon
  if (hour >= 18 && hour < 22) return 0.8;                          // evening
  return NIGHT_GENERATION_MULTIPLIER;                                // 22-24
}
```

---

## PH-IMPL-3. The Master Tick (`tick.js`)

Orchestrates the 6 phases in strict order. Each phase reads graph state, computes deltas, writes new state. Mirrors ALGORITHM_Physics.md P2.

```js
// src/server/physics/tick.js

import { phasePump } from './pump.js';
import { phaseRoute } from './route.js';
import { phaseDecay, computeEffectiveDecay } from './decay.js';
import { phaseFlip } from './flip.js';
import { phaseInject } from './inject.js';
import { phaseEmit } from './emit.js';
import { homeostasisCheck } from './homeostasis.js';
import { getTimeMultiplier } from './constants.js';

/**
 * @typedef {Object} TickResult
 * @property {number} tickNumber
 * @property {number} energyGenerated
 * @property {number} energyRouted
 * @property {number} energyDecayed
 * @property {number} tensionDelta
 * @property {Array<Object>} momentsFlipped
 * @property {number} energyInjected
 * @property {Array<Object>} eventsEmitted
 * @property {string|null} homeostasisAction
 * @property {number} durationMs
 */

/**
 * Execute one physics tick. The heartbeat of the world.
 *
 * Called by physics-bridge.js every TICK_INTERVAL_MS.
 * Six phases, strict order. No intermediate state persists between phases.
 *
 * @param {number} currentTick - Sequential tick number
 * @param {number} [hourOfDay] - 0-23, defaults to current Venice time
 * @returns {Promise<TickResult>}
 */
export async function physicsTick(currentTick, hourOfDay) {
  const startTime = Date.now();

  // Default to current hour in CET (Venice timezone)
  if (hourOfDay === undefined) {
    const now = new Date();
    // Venice is UTC+1 (CET) or UTC+2 (CEST)
    const venetianHour = new Date(
      now.toLocaleString('en-US', { timeZone: 'Europe/Rome' })
    ).getHours();
    hourOfDay = venetianHour;
  }

  const generationMultiplier = getTimeMultiplier(hourOfDay);

  const result = {
    tickNumber: currentTick,
    energyGenerated: 0,
    energyRouted: 0,
    energyDecayed: 0,
    tensionDelta: 0,
    momentsFlipped: [],
    energyInjected: 0,
    eventsEmitted: [],
    homeostasisAction: null,
    durationMs: 0,
  };

  // ── PHASE 1: PUMP ──────────────────────────────────────
  // Characters pump energy into narratives they believe.
  result.energyGenerated = await phasePump(generationMultiplier);

  // ── PHASE 2: ROUTE ─────────────────────────────────────
  // Energy flows through SUPPORTS and TENSION edges.
  const routeResult = await phaseRoute();
  result.energyRouted = routeResult.totalRouted;
  result.tensionDelta = routeResult.tensionDelta;

  // ── PHASE 3: DECAY ─────────────────────────────────────
  // All nodes lose energy. Core types lose less.
  const effectiveDecay = await computeEffectiveDecay();
  result.energyDecayed = await phaseDecay(effectiveDecay);

  // ── PHASE 4: FLIP ──────────────────────────────────────
  // Check unflipped Moments. Flip if salience > threshold.
  result.momentsFlipped = await phaseFlip(currentTick);

  // ── PHASE 5: INJECT ────────────────────────────────────
  // Economic data injects energy into the graph.
  result.energyInjected = await phaseInject();

  // ── PHASE 6: EMIT ──────────────────────────────────────
  // Flipped Moments become events. Delegates to events module.
  result.eventsEmitted = await phaseEmit(result.momentsFlipped);

  // ── POST-TICK: HOMEOSTASIS ─────────────────────────────
  result.homeostasisAction = await homeostasisCheck();

  result.durationMs = Date.now() - startTime;

  return result;
}
```

---

## PH-IMPL-4. Phase 1: Pump (`pump.js`)

```js
// src/server/physics/pump.js

import { getConnectedClient } from '../graph/client.js';
import { GENERATION_RATE, COLD_THRESHOLD } from './constants.js';

/**
 * Phase 1: Energy generation (pump).
 * Characters pump energy into narratives they believe.
 *
 * Mirrors ALGORITHM_Physics.md P3 phase_pump.
 *
 * @param {number} generationMultiplier - Time-of-day modifier
 * @returns {Promise<number>} Total energy generated
 */
export async function phasePump(generationMultiplier) {
  const client = await getConnectedClient();
  let totalGenerated = 0;

  // Fetch all alive characters
  const characters = await client.roQuery(
    `MATCH (c:Character {alive: true})
     RETURN c.id     AS id,
            c.weight AS weight,
            c.energy AS energy,
            c.class  AS class,
            c.ducats AS ducats`
  );

  for (const char of characters) {
    const charWeight = char.weight ?? 1.0;
    const ducats = char.ducats ?? 0;

    // Wealth factor: logarithmic, prevents runaway
    const wealthFactor = computeWealthFactor(ducats);
    const charGeneration = charWeight * GENERATION_RATE * generationMultiplier * wealthFactor;

    // Fetch this character's beliefs
    const beliefs = await client.roQuery(
      `MATCH (c:Character {id: $cid})-[b:BELIEVES]->(n:Narrative)
       WHERE n.energy IS NOT NULL
       RETURN n.id AS narrativeId,
              b.confidence AS confidence,
              n.energy AS currentEnergy`,
      { cid: char.id }
    );

    if (beliefs.length === 0) continue;

    const totalConfidence = beliefs.reduce((sum, b) => sum + (b.confidence ?? 0), 0);
    if (totalConfidence === 0) continue;

    // Distribute energy across beliefs, weighted by confidence
    for (const belief of beliefs) {
      const fraction = (belief.confidence ?? 0) / totalConfidence;
      const energyPumped = charGeneration * fraction;

      await client.query(
        `MATCH (n:Narrative {id: $nid})
         SET n.energy = n.energy + $delta`,
        { nid: belief.narrativeId, delta: energyPumped }
      );

      totalGenerated += energyPumped;
    }
  }

  return totalGenerated;
}

/**
 * Logarithmic wealth factor.
 *   0 ducats   -> 0.5
 *   100 ducats -> 1.0
 *   1000 ducats -> 1.5
 *   10000 ducats -> 2.0
 *
 * @param {number} ducats
 * @returns {number}
 */
function computeWealthFactor(ducats) {
  if (!ducats || ducats <= 0) return 0.5;
  return 0.5 + Math.log10(Math.max(1, ducats)) / 4.0;
}
```

---

## PH-IMPL-5. Phase 2: Route (`route.js`)

```js
// src/server/physics/route.js

import { getConnectedClient } from '../graph/client.js';
import {
  ROUTE_FACTOR_SUPPORTS,
  ROUTE_FACTOR_TENSION,
  DRAW_RATE,
  COLD_THRESHOLD,
} from './constants.js';

/**
 * Phase 2: Energy routing through SUPPORTS, TENSION, and FEEDS edges.
 *
 * Mirrors ALGORITHM_Physics.md P4 phase_route.
 *
 * @returns {Promise<{ totalRouted: number, tensionDelta: number }>}
 */
export async function phaseRoute() {
  const client = await getConnectedClient();
  let totalRouted = 0;
  let tensionDelta = 0;

  // ── SUPPORTS routing ────────────────────────────────────
  const supports = await client.roQuery(
    `MATCH (n1:Narrative)-[s:SUPPORTS]->(n2:Narrative)
     WHERE n1.energy > $cold
     RETURN n1.id     AS sourceId,
            n1.energy AS sourceEnergy,
            n2.id     AS targetId,
            n2.energy AS targetEnergy,
            s.factor  AS factor`,
    { cold: COLD_THRESHOLD }
  );

  for (const edge of supports) {
    const factor = edge.factor ?? ROUTE_FACTOR_SUPPORTS;
    const flow = edge.sourceEnergy * factor;

    // Reception factor: diminishing returns for heavier targets
    const sqrtTarget = Math.sqrt((edge.targetEnergy ?? 0) + 1.0);
    const received = flow * sqrtTarget / (sqrtTarget + 1.0);

    await client.query(
      `MATCH (n1:Narrative {id: $src}), (n2:Narrative {id: $tgt})
       SET n1.energy = n1.energy - $flow,
           n2.energy = n2.energy + $received`,
      { src: edge.sourceId, tgt: edge.targetId, flow, received }
    );

    totalRouted += flow;
  }

  // ── TENSION accumulation ────────────────────────────────
  const tensions = await client.roQuery(
    `MATCH (n1:Narrative)-[t:TENSION]-(n2:Narrative)
     WHERE n1.energy > $cold OR n2.energy > $cold
     RETURN n1.id       AS idA,
            n1.energy   AS energyA,
            n2.id       AS idB,
            n2.energy   AS energyB,
            t.strength  AS strength`,
    { cold: COLD_THRESHOLD }
  );

  // Deduplicate bidirectional edges
  const seenEdges = new Set();

  for (const edge of tensions) {
    const key = [edge.idA, edge.idB].sort().join('::');
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);

    const delta = ((edge.energyA ?? 0) + (edge.energyB ?? 0)) * ROUTE_FACTOR_TENSION;
    const newStrength = (edge.strength ?? 0) + delta;

    await client.query(
      `MATCH (n1:Narrative {id: $idA})-[t:TENSION]-(n2:Narrative {id: $idB})
       SET t.strength = $newStrength`,
      { idA: edge.idA, idB: edge.idB, newStrength }
    );

    tensionDelta += delta;
  }

  // ── TENSION to Moment transfer (FEEDS) ──────────────────
  const feeds = await client.roQuery(
    `MATCH (n:Narrative)-[f:FEEDS]->(m:Moment {flipped: false})
     WHERE n.energy > $cold
     RETURN n.id      AS narrativeId,
            n.energy  AS narrativeEnergy,
            m.id      AS momentId,
            m.energy  AS momentEnergy,
            f.factor  AS factor`,
    { cold: COLD_THRESHOLD }
  );

  for (const feed of feeds) {
    const factor = feed.factor ?? 0.5;
    const absorption = (feed.narrativeEnergy ?? 0) * DRAW_RATE * factor;

    await client.query(
      `MATCH (n:Narrative {id: $nid}), (m:Moment {id: $mid})
       SET n.energy = n.energy - $drain,
           m.energy = m.energy + $absorbed`,
      {
        nid: feed.narrativeId,
        mid: feed.momentId,
        drain: absorption * 0.5,    // Narrative loses half
        absorbed: absorption,        // Moment gains full
      }
    );

    totalRouted += absorption;
  }

  return { totalRouted, tensionDelta };
}
```

---

## PH-IMPL-6. Phase 3: Decay (`decay.js`)

```js
// src/server/physics/decay.js

import { getConnectedClient } from '../graph/client.js';
import {
  DECAY_RATE,
  DECAY_RATE_MIN,
  DECAY_RATE_MAX,
  CORE_TYPES,
  CORE_DECAY_MULTIPLIER,
  MIN_WEIGHT,
  CRITICALITY_TARGET_MIN,
  CRITICALITY_TARGET_MAX,
} from './constants.js';

/**
 * Phase 3: Narrative forgetting.
 * All nodes lose energy each tick. Core types lose less.
 *
 * Mirrors ALGORITHM_Physics.md P5 phase_decay.
 *
 * @param {number} effectiveDecayRate - Homeostasis-adjusted rate
 * @returns {Promise<number>} Total energy decayed
 */
export async function phaseDecay(effectiveDecayRate) {
  const client = await getConnectedClient();
  let totalDecayed = 0;

  // Standard narratives
  const stdResult = await client.query(
    `MATCH (n:Narrative)
     WHERE n.energy > 0.001
       AND NOT n.type IN $coreTypes
     SET n.energy = n.energy * (1.0 - $rate)
     RETURN sum(n.energy * $rate / (1.0 - $rate)) AS totalDecayed`,
    { rate: effectiveDecayRate, coreTypes: CORE_TYPES }
  );
  totalDecayed += stdResult[0]?.totalDecayed ?? 0;

  // Core type narratives (slow decay)
  const coreRate = effectiveDecayRate * CORE_DECAY_MULTIPLIER;
  const coreResult = await client.query(
    `MATCH (n:Narrative)
     WHERE n.energy > 0.001
       AND n.type IN $coreTypes
     SET n.energy = n.energy * (1.0 - $rate)
     RETURN sum(n.energy * $rate / (1.0 - $rate)) AS totalDecayed`,
    { rate: coreRate, coreTypes: CORE_TYPES }
  );
  totalDecayed += coreResult[0]?.totalDecayed ?? 0;

  // Character energy decay
  const charResult = await client.query(
    `MATCH (c:Character)
     WHERE c.energy > 0.01
     SET c.energy = c.energy * (1.0 - $rate)
     RETURN sum(c.energy * $rate / (1.0 - $rate)) AS totalDecayed`,
    { rate: effectiveDecayRate }
  );
  totalDecayed += charResult[0]?.totalDecayed ?? 0;

  // Weight floor enforcement
  await client.query(
    `MATCH (n:Narrative)
     WHERE n.weight < $minWeight
     SET n.weight = $minWeight`,
    { minWeight: MIN_WEIGHT }
  );

  return totalDecayed;
}

/**
 * Compute effective decay rate adjusted by system pressure.
 * If pressure is high, increase decay. If low, decrease.
 *
 * Mirrors ALGORITHM_Physics.md P5 compute_effective_decay.
 *
 * @returns {Promise<number>}
 */
export async function computeEffectiveDecay() {
  const avgPressure = await computeAveragePressure();

  if (avgPressure > CRITICALITY_TARGET_MAX) {
    const overshoot = avgPressure - CRITICALITY_TARGET_MAX;
    const adjustment = overshoot * 2.0;
    return Math.min(DECAY_RATE + adjustment, DECAY_RATE_MAX);
  }

  if (avgPressure < CRITICALITY_TARGET_MIN) {
    const undershoot = CRITICALITY_TARGET_MIN - avgPressure;
    const adjustment = undershoot * 1.0;
    return Math.max(DECAY_RATE - adjustment, DECAY_RATE_MIN);
  }

  return DECAY_RATE;
}

/**
 * Average pressure = mean of (moment_salience / moment_threshold)
 * across all unflipped moments.
 *
 * @returns {Promise<number>}
 */
async function computeAveragePressure() {
  const client = await getConnectedClient();

  const rows = await client.roQuery(
    `MATCH (m:Moment {flipped: false})
     WHERE m.threshold > 0
     RETURN avg(m.energy * m.weight / m.threshold) AS avgPressure,
            max(m.energy * m.weight / m.threshold) AS maxPressure,
            count(m) AS momentCount`
  );

  if (!rows[0] || rows[0].momentCount === 0) return 0.0;
  return rows[0].avgPressure ?? 0.0;
}
```

---

## PH-IMPL-7. Phase 4: Flip (`flip.js`)

```js
// src/server/physics/flip.js

import { getConnectedClient } from '../graph/client.js';
import { flipMoment } from '../graph/mutations.js';
import {
  COOLDOWN_TICKS,
  MAX_CONCURRENT_ACTIVE_MOMENTS,
} from './constants.js';
import { loadRecentFlips, saveRecentFlips } from './state.js';

/**
 * Phase 4: Moment detection and flip.
 * Check all unflipped Moments. If salience > threshold, flip irreversibly.
 *
 * Mirrors ALGORITHM_Physics.md P6 phase_flip.
 *
 * @param {number} currentTick
 * @returns {Promise<Array<{ id: string, description: string, category: string, severity: number, district: string, tick: number }>>}
 */
export async function phaseFlip(currentTick) {
  const client = await getConnectedClient();
  const flipped = [];

  const recentFlips = loadRecentFlips();
  let activeEventCount = await countActiveEvents(client);

  // Fetch candidates: unflipped moments near threshold (80%+)
  const candidates = await client.roQuery(
    `MATCH (m:Moment {flipped: false})
     WHERE m.energy * m.weight > m.threshold * 0.8
     RETURN m.id          AS id,
            m.description AS description,
            m.category    AS category,
            m.threshold   AS threshold,
            m.energy      AS energy,
            m.weight      AS weight,
            m.energy * m.weight AS salience
     ORDER BY m.energy * m.weight DESC`
  );

  for (const moment of candidates) {
    // Check: salience exceeds threshold
    if (moment.salience <= moment.threshold) continue;

    // Check: district cooldown
    const district = await getMomentDistrict(client, moment.id);
    if (recentFlips[district] !== undefined) {
      if (currentTick - recentFlips[district] < COOLDOWN_TICKS) continue;
    }

    // Check: concurrent event limit
    if (activeEventCount >= MAX_CONCURRENT_ACTIVE_MOMENTS) {
      continue; // Suppressed. Could add preemption logic here.
    }

    // ── FLIP ──────────────────────────────────────────────
    const severity = computeSeverity(moment.salience, moment.threshold);

    await flipMoment(moment.id, severity, currentTick);

    flipped.push({
      id: moment.id,
      description: moment.description,
      category: moment.category,
      severity,
      district,
      tick: currentTick,
    });

    recentFlips[district] = currentTick;
    activeEventCount++;
  }

  saveRecentFlips(recentFlips);
  return flipped;
}

/**
 * Compute severity from salience/threshold ratio.
 * Logarithmic mapping: just above threshold = ~0.1, 5x threshold = 1.0.
 *
 * @param {number} salience
 * @param {number} threshold
 * @returns {number}
 */
function computeSeverity(salience, threshold) {
  const ratio = salience / threshold;
  const severity = Math.log2(ratio) / Math.log2(5.0);
  return Math.max(0.0, Math.min(1.0, severity));
}

/**
 * Determine which district a Moment belongs to.
 *
 * @param {import('../graph/client.js').VeneziaGraphClient} client
 * @param {string} momentId
 * @returns {Promise<string>}
 */
async function getMomentDistrict(client, momentId) {
  const rows = await client.roQuery(
    `MATCH (c:Character)-[:BELIEVES]->(n:Narrative)-[:FEEDS]->(m:Moment {id: $mid})
     RETURN c.district AS district, count(c) AS cnt
     ORDER BY cnt DESC
     LIMIT 1`,
    { mid: momentId }
  );

  return rows[0]?.district ?? 'unknown';
}

/**
 * Count currently active (unresolved) events.
 *
 * @param {import('../graph/client.js').VeneziaGraphClient} client
 * @returns {Promise<number>}
 */
async function countActiveEvents(client) {
  const rows = await client.roQuery(
    `MATCH (m:Moment {flipped: true})
     WHERE NOT exists(m.resolved) OR m.resolved = false
     RETURN count(m) AS cnt`
  );
  return rows[0]?.cnt ?? 0;
}
```

---

## PH-IMPL-8. Phase 5: Inject (`inject.js`)

```js
// src/server/physics/inject.js

import { readFile } from 'fs/promises';
import { getConnectedClient } from '../graph/client.js';
import { ECONOMIC_ENERGY_FACTOR, MOOD_ENERGY_FACTOR } from './constants.js';

const ECON_DELTAS_PATH = process.env.VENEZIA_ECON_DELTAS_PATH || './state/econ_deltas.json';

/**
 * Phase 5: Economic energy injection.
 * Reads economic deltas written by serenissima-sync.js and
 * translates them into graph energy changes.
 *
 * Mirrors ALGORITHM_Physics.md P7 phase_inject.
 *
 * @returns {Promise<number>} Total energy injected
 */
export async function phaseInject() {
  let deltas;

  try {
    const raw = await readFile(ECON_DELTAS_PATH, 'utf-8');
    deltas = JSON.parse(raw);
  } catch {
    // No economic data available this tick. Normal if sync hasn't run.
    return 0;
  }

  if (!Array.isArray(deltas) || deltas.length === 0) return 0;

  const client = await getConnectedClient();
  let totalInjected = 0;

  for (const delta of deltas) {
    const { citizenUsername, ducatsDelta, moodDelta } = delta;
    if (!citizenUsername) continue;

    const charId = 'char_' + citizenUsername.toLowerCase().replace(/\s+/g, '_');

    // Ducats delta -> energy injection into citizen's beliefs
    if (ducatsDelta && Math.abs(ducatsDelta) > 0) {
      const energyDelta = Math.abs(ducatsDelta) * ECONOMIC_ENERGY_FACTOR;
      const sign = ducatsDelta > 0 ? 1 : -1;

      // Positive ducats: boost positive beliefs (alliance, belief).
      // Negative ducats: boost negative beliefs (grievance, grudge, debt).
      const targetTypes = sign > 0
        ? ['alliance', 'belief']
        : ['grievance', 'grudge', 'debt'];

      await client.query(
        `MATCH (c:Character {id: $cid})-[:BELIEVES]->(n:Narrative)
         WHERE n.type IN $types
         SET n.energy = n.energy + $delta`,
        { cid: charId, types: targetTypes, delta: energyDelta }
      );

      totalInjected += energyDelta;
    }

    // Mood delta -> boost belief energy proportionally
    if (moodDelta && Math.abs(moodDelta) > 0) {
      const moodEnergy = Math.abs(moodDelta) * MOOD_ENERGY_FACTOR;

      await client.query(
        `MATCH (c:Character {id: $cid})-[:BELIEVES]->(n:Narrative)
         SET n.energy = n.energy + $delta`,
        { cid: charId, delta: moodEnergy }
      );

      totalInjected += moodEnergy;
    }
  }

  // Clear deltas file after processing (consumed once)
  try {
    const { writeFile } = await import('fs/promises');
    await writeFile(ECON_DELTAS_PATH, '[]', 'utf-8');
  } catch {
    // Non-fatal: deltas may be re-processed next tick
  }

  return totalInjected;
}
```

---

## PH-IMPL-9. Phase 6: Emit (`emit.js`)

```js
// src/server/physics/emit.js

/**
 * Phase 6: Event emission.
 * Delegates flipped Moments to the events module for lifecycle management.
 *
 * This is the bridge between physics and events. The physics module
 * only detects flips. The events module handles everything else:
 * descriptors, 3D effects, propagation, lifecycle.
 *
 * @param {Array<Object>} flippedMoments - Output from phaseFlip
 * @returns {Promise<Array<Object>>} Event descriptors created
 */
export async function phaseEmit(flippedMoments) {
  if (!flippedMoments || flippedMoments.length === 0) return [];

  // Dynamic import to avoid circular dependency
  // The events module is defined in src/server/events/
  const { generateEventFromFlip } = await import('../events/generator.js');

  const events = [];

  for (const moment of flippedMoments) {
    try {
      const descriptor = await generateEventFromFlip(moment);
      events.push(descriptor);
    } catch (err) {
      console.error(`[Physics] Failed to emit event for moment ${moment.id}: ${err.message}`);
    }
  }

  return events;
}
```

---

## PH-IMPL-10. Homeostasis (`homeostasis.js`)

```js
// src/server/physics/homeostasis.js

import { getConnectedClient } from '../graph/client.js';
import {
  CRITICALITY_TARGET_MIN,
  CRITICALITY_TARGET_MAX,
  CRITICALITY_HOT_THRESHOLD,
  GENERATION_RATE,
} from './constants.js';

/**
 * Post-tick homeostasis check.
 * Ensures the system stays in a narratively interesting range.
 *
 * Mirrors ALGORITHM_Physics.md homeostasis_check.
 *
 * @returns {Promise<string|null>} Action taken, or null
 */
export async function homeostasisCheck() {
  const client = await getConnectedClient();

  // Check average pressure
  const rows = await client.roQuery(
    `MATCH (m:Moment {flipped: false})
     WHERE m.threshold > 0
     RETURN avg(m.energy * m.weight / m.threshold) AS avgPressure,
            max(m.energy * m.weight / m.threshold) AS maxPressure,
            count(m) AS momentCount`
  );

  if (!rows[0] || rows[0].momentCount === 0) return null;

  const { avgPressure, maxPressure } = rows[0];

  // Check: is the system too cold?
  if (avgPressure < CRITICALITY_TARGET_MIN && maxPressure < CRITICALITY_HOT_THRESHOLD) {
    // Inject a small energy boost to prevent stagnation.
    // Boost the highest-energy narrative slightly.
    await client.query(
      `MATCH (n:Narrative)
       WHERE n.energy > 0.01
       WITH n ORDER BY n.energy DESC LIMIT 5
       SET n.energy = n.energy * 1.1`
    );
    return 'boosted_top_5_narratives';
  }

  // System is in range or hot. Decay adjustment handles the rest.
  return null;
}
```

---

## PH-IMPL-11. Tick State Persistence (`state.js`)

```js
// src/server/physics/state.js

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const STATE_DIR = process.env.VENEZIA_STATE_DIR || './state';
const FLIPS_FILE = join(STATE_DIR, 'recent_flips.json');

/**
 * Load recent flip timestamps per district.
 * @returns {Record<string, number>}
 */
export function loadRecentFlips() {
  try {
    return JSON.parse(readFileSync(FLIPS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Save recent flip timestamps.
 * @param {Record<string, number>} flips
 */
export function saveRecentFlips(flips) {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(FLIPS_FILE, JSON.stringify(flips, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[State] Failed to save recent flips: ${err.message}`);
  }
}

/**
 * Load the current tick number.
 * @returns {number}
 */
export function loadTickNumber() {
  try {
    const data = JSON.parse(readFileSync(join(STATE_DIR, 'tick.json'), 'utf-8'));
    return data.tick || 0;
  } catch {
    return 0;
  }
}

/**
 * Save the current tick number.
 * @param {number} tick
 */
export function saveTickNumber(tick) {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(join(STATE_DIR, 'tick.json'), JSON.stringify({ tick }), 'utf-8');
  } catch (err) {
    console.error(`[State] Failed to save tick number: ${err.message}`);
  }
}
```

---

## PH-IMPL-12. Physics Bridge (`physics-bridge.js`)

The main entry point. Manages the tick loop lifecycle, integrates with the Express server, and provides status for monitoring.

```js
// src/server/physics/physics-bridge.js

import { physicsTick } from './tick.js';
import { TICK_INTERVAL_MS } from './constants.js';
import { loadTickNumber, saveTickNumber } from './state.js';

/**
 * @typedef {Object} PhysicsBridgeState
 * @property {boolean} running
 * @property {number} tickCount
 * @property {number} lastTickDurationMs
 * @property {string|null} lastTickTime
 * @property {Array<string>} recentFlips
 * @property {number} totalEnergyGenerated
 * @property {number} consecutiveErrors
 */

class PhysicsBridge {
  /** @type {NodeJS.Timeout | null} */
  _intervalHandle = null;

  /** @type {boolean} */
  _running = false;

  /** @type {boolean} */
  _tickInProgress = false;

  /** @type {number} */
  _tickCount = 0;

  /** @type {number} */
  _lastTickDurationMs = 0;

  /** @type {string|null} */
  _lastTickTime = null;

  /** @type {Array<string>} */
  _recentFlips = [];

  /** @type {number} */
  _totalEnergyGenerated = 0;

  /** @type {number} */
  _consecutiveErrors = 0;

  /** @type {((event: Object) => void) | null} */
  _onEvent = null;

  /** @type {((result: Object) => void) | null} */
  _onTickComplete = null;

  /**
   * Start the physics tick loop.
   *
   * @param {Object} [opts]
   * @param {(event: Object) => void} [opts.onEvent] - Called when events are emitted
   * @param {(result: Object) => void} [opts.onTickComplete] - Called after each tick
   */
  start(opts = {}) {
    if (this._running) {
      console.warn('[Physics] Already running.');
      return;
    }

    if (process.env.VENEZIA_PHYSICS_ENABLED === 'false') {
      console.log('[Physics] Disabled via VENEZIA_PHYSICS_ENABLED=false');
      return;
    }

    this._onEvent = opts.onEvent || null;
    this._onTickComplete = opts.onTickComplete || null;
    this._tickCount = loadTickNumber();
    this._running = true;

    console.log(
      `[Physics] Starting tick loop. Interval: ${TICK_INTERVAL_MS}ms. ` +
      `Resuming from tick ${this._tickCount}.`
    );

    // Run first tick immediately, then at interval
    this._runTick();
    this._intervalHandle = setInterval(() => this._runTick(), TICK_INTERVAL_MS);
  }

  /**
   * Stop the tick loop gracefully.
   * Waits for current tick to complete if one is in progress.
   *
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this._running) return;

    this._running = false;

    if (this._intervalHandle) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = null;
    }

    // Wait for in-progress tick
    if (this._tickInProgress) {
      console.log('[Physics] Waiting for current tick to complete...');
      let waited = 0;
      while (this._tickInProgress && waited < 30000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
      }
    }

    console.log('[Physics] Stopped.');
  }

  /**
   * Get current status for monitoring / health endpoint.
   *
   * @returns {PhysicsBridgeState}
   */
  getStatus() {
    return {
      running: this._running,
      tickCount: this._tickCount,
      lastTickDurationMs: this._lastTickDurationMs,
      lastTickTime: this._lastTickTime,
      recentFlips: this._recentFlips.slice(-10),
      totalEnergyGenerated: Math.round(this._totalEnergyGenerated * 100) / 100,
      consecutiveErrors: this._consecutiveErrors,
    };
  }

  /**
   * Force an immediate tick (for testing or manual intervention).
   *
   * @returns {Promise<Object>} TickResult
   */
  async forceTick() {
    return this._runTick();
  }

  // ── Private ──────────────────────────────────────────────

  async _runTick() {
    if (this._tickInProgress) {
      console.warn('[Physics] Tick already in progress. Skipping.');
      return null;
    }

    this._tickInProgress = true;
    this._tickCount++;

    try {
      const result = await physicsTick(this._tickCount);

      // Update state
      this._lastTickDurationMs = result.durationMs;
      this._lastTickTime = new Date().toISOString();
      this._totalEnergyGenerated += result.energyGenerated;
      this._consecutiveErrors = 0;

      // Record flips
      for (const flip of result.momentsFlipped) {
        this._recentFlips.push(`${flip.id} (${flip.category}) @ tick ${this._tickCount}`);
      }

      // Persist tick number
      saveTickNumber(this._tickCount);

      // Log
      const logLevel = process.env.VENEZIA_PHYSICS_LOG_LEVEL || 'info';
      if (logLevel === 'debug' || result.momentsFlipped.length > 0) {
        console.log(
          `[Physics] Tick ${this._tickCount}: ` +
          `gen=${result.energyGenerated.toFixed(2)} ` +
          `routed=${result.energyRouted.toFixed(2)} ` +
          `decayed=${result.energyDecayed.toFixed(2)} ` +
          `tension=${result.tensionDelta.toFixed(2)} ` +
          `injected=${result.energyInjected.toFixed(2)} ` +
          `flips=${result.momentsFlipped.length} ` +
          `events=${result.eventsEmitted.length} ` +
          `(${result.durationMs}ms)`
        );
      }

      // Emit events to subscribers (WebSocket broadcast, etc.)
      if (result.eventsEmitted.length > 0 && this._onEvent) {
        for (const event of result.eventsEmitted) {
          this._onEvent(event);
        }
      }

      if (this._onTickComplete) {
        this._onTickComplete(result);
      }

      return result;

    } catch (err) {
      this._consecutiveErrors++;
      console.error(
        `[Physics] Tick ${this._tickCount} failed (${this._consecutiveErrors} consecutive): ${err.message}`
      );

      // After 5 consecutive errors, extend interval to avoid hammering FalkorDB
      if (this._consecutiveErrors >= 5 && this._intervalHandle) {
        clearInterval(this._intervalHandle);
        const backoffMs = TICK_INTERVAL_MS * 2;
        console.warn(`[Physics] Entering backoff mode. Next tick in ${backoffMs}ms`);
        this._intervalHandle = setInterval(() => this._runTick(), backoffMs);
      }

      return null;

    } finally {
      this._tickInProgress = false;
    }
  }
}

// ── Singleton ──────────────────────────────────────────────

let _instance = null;

/**
 * Get or create the singleton PhysicsBridge.
 * @returns {PhysicsBridge}
 */
export function getPhysicsBridge() {
  if (!_instance) {
    _instance = new PhysicsBridge();
  }
  return _instance;
}

export { PhysicsBridge };
export default getPhysicsBridge;
```

---

## PH-IMPL-13. Express Server Integration

The physics bridge starts when the Express server starts and stops on SIGTERM.

```js
// In src/server/index.js:

import { getPhysicsBridge } from './physics/physics-bridge.js';
import { broadcastToClients } from './websocket.js';

// After Express listen():
const physics = getPhysicsBridge();
physics.start({
  onEvent: (event) => {
    // Broadcast event to all connected VR/web clients
    broadcastToClients({
      type: 'world_event',
      data: event,
    });
  },
  onTickComplete: (result) => {
    // Optional: broadcast tick summary for debug overlay
    if (process.env.VENEZIA_DEBUG_OVERLAY === 'true') {
      broadcastToClients({
        type: 'physics_tick',
        data: {
          tick: result.tickNumber,
          energy: result.energyGenerated,
          flips: result.momentsFlipped.length,
          durationMs: result.durationMs,
        },
      });
    }
  },
});

// Health endpoint
app.get('/api/physics/status', (req, res) => {
  res.json(physics.getStatus());
});

// Manual tick (admin only)
app.post('/api/physics/force-tick', async (req, res) => {
  const result = await physics.forceTick();
  res.json(result);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await physics.stop();
  process.exit(0);
});
```

---

## PH-IMPL-14. FalkorDB Transaction Patterns

FalkorDB does not support multi-statement transactions. Each Cypher query executes atomically. The 6-phase tick uses individual queries, not a transaction block. This means a crash mid-tick leaves partial state.

### Mitigation Strategies

1. **Idempotent phases.** Each phase reads current state and writes deltas. Running a phase twice produces slightly inflated energy values, not corruption.

2. **Tick number persistence.** The tick number is saved after all 6 phases complete. If the process crashes mid-tick, the next startup re-runs the same tick number, which is safe due to idempotent phases.

3. **Moment flip is irreversible.** Once `m.flipped = true` is set, re-running the flip phase skips that moment. The flip is the only truly irreversible operation.

4. **Query batching.** For the pump phase (186 characters, each with N beliefs), queries could be batched. The current implementation runs individual queries per character for clarity. If performance requires it, batch all character pump deltas into a single query:

```js
// Batched pump (optimization, not initial implementation):
await client.query(
  `MATCH (c:Character {alive: true})-[b:BELIEVES]->(n:Narrative)
   WITH c, n, b,
        c.weight * $genRate * $multiplier *
        (CASE WHEN c.ducats > 0 THEN 0.5 + log10(c.ducats) / 4.0 ELSE 0.5 END)
        AS charGen,
        sum(b.confidence) OVER (PARTITION BY c) AS totalConf
   WHERE totalConf > 0
   SET n.energy = n.energy + charGen * b.confidence / totalConf`,
  { genRate: GENERATION_RATE, multiplier: generationMultiplier }
);
```

Note: FalkorDB's Cypher dialect may not support all windowing functions. Test before using the batched approach.

---

## PH-IMPL-15. Logging Configuration

```js
// Logging levels controlled by VENEZIA_PHYSICS_LOG_LEVEL:
//   debug  - Every tick, every phase result, every query
//   info   - Ticks with flips, startup/shutdown, errors
//   warn   - Backoff mode, reconnection attempts
//   error  - Tick failures, connection failures

// All physics log lines prefixed with [Physics] for grep filtering:
//   grep "\[Physics\]" logs/venezia.log
```

---

## PH-IMPL-16. Barrel Export (`index.js`)

```js
// src/server/physics/index.js

export { physicsTick } from './tick.js';
export { getPhysicsBridge, PhysicsBridge } from './physics-bridge.js';
export {
  TICK_INTERVAL_MINUTES,
  TICK_INTERVAL_MS,
  DECAY_RATE,
  GENERATION_RATE,
  CORE_TYPES,
  COOLDOWN_TICKS,
  MAX_CONCURRENT_ACTIVE_MOMENTS,
  getTimeMultiplier,
} from './constants.js';
export { loadTickNumber, saveTickNumber } from './state.js';
```
