# IMPLEMENTATION: narrative/events -- Code-Level Specification

Concrete implementation of the event system for Venezia. Event descriptor as JS object, file structure, 3D effect application via Three.js scene modifications, WebSocket event broadcast format, RSS fetching for Forestiere news, Claude API call for anachronistic translation, event store (in-memory with periodic disk dump), and the lifecycle state machine.

---

## File Structure

```
cities-of-light/
  src/
    server/
      events/
        generator.js          ← Moment flip to EventDescriptor conversion
        descriptor.js         ← EventDescriptor class and builder
        effects.js            ← Effect template table (category -> atmosphere/behavior/audio)
        lifecycle.js          ← State machine: emerging -> active -> settling -> aftermath -> resolved
        propagation.js        ← BFS news propagation through social graph
        forestiere.js         ← RSS fetch, Claude translation, narrative injection
        store.js              ← In-memory event store with periodic disk dump
        manager.js            ← Concurrent event slots, suppression queue
        tick.js               ← Master event tick (called every 5 min alongside physics)
        index.js              ← Barrel export
    client/
      atmosphere/
        event-renderer.js     ← Three.js scene modifications from event descriptors
```

---

## Dependencies

```json
{
  "rss-parser": "^3.13.0",
  "@anthropic-ai/sdk": "^0.74.0",
  "ws": "^8.18.0",
  "three": "^0.170.0"
}
```

`rss-parser` handles RSS/Atom feed parsing. `@anthropic-ai/sdk` is already in the project for citizen conversations. `ws` is already present for WebSocket. `three` is already the 3D engine.

---

## Environment Variables

```bash
# Forestiere news
VENEZIA_FORESTIERE_ENABLED=true              # Kill switch for RSS news injection
VENEZIA_FORESTIERE_FEEDS=https://feeds.reuters.com/reuters/worldNews,https://feeds.bbci.co.uk/news/world/rss.xml
VENEZIA_FORESTIERE_INTERVAL_HOURS=24         # How often to inject news (default: daily)

# Claude API (shared with citizen conversations)
ANTHROPIC_API_KEY=sk-ant-...                 # Required for Forestiere translation

# Event store
VENEZIA_EVENT_STORE_PATH=./state/events.json # Disk persistence path
VENEZIA_EVENT_DUMP_INTERVAL_MS=60000         # How often to flush to disk (default: 1 min)
```

---

## EV-IMPL-1. Event Descriptor (`descriptor.js`)

The descriptor is the contract between the event system and all consumers. Each consumer reads only the fields it needs.

```js
// src/server/events/descriptor.js

/**
 * @typedef {Object} AtmosphereEffect
 * @property {number} fogDelta           - Change in fog density [-0.05, +0.05]
 * @property {number} lightDelta         - Change in light intensity [-0.20, +0.20]
 * @property {number} particleRateDelta  - Change in particle count [-10, +20]
 * @property {number} ambientVolumeDelta - Change in ambient volume [-0.3, +0.3]
 */

/**
 * @typedef {Object} CitizenBehavior
 * @property {string|null} gatherPoint              - Where citizens converge
 * @property {string|null} postureOverride           - Body language override
 * @property {number} movementSpeedMultiplier        - 1.0 = normal
 * @property {string|null} conversationTopicInject   - Forced conversation topic
 */

/**
 * @typedef {Object} SpatialAudioSource
 * @property {string} type      - Sound type identifier
 * @property {number[]} position - [x, y, z] world position
 * @property {number} volume    - [0.0, 1.0]
 */

/**
 * @typedef {Object} AudioEffect
 * @property {string|null} ambientLayer       - Audio layer to activate
 * @property {SpatialAudioSource[]} spatialSources - Positioned audio sources
 */

/**
 * @typedef {Object} PropagationState
 * @property {Record<string, { confidence: number, source: string, learnedAt: string, hop: number }>} awareCitizens
 * @property {Array<{ citizenId: string, sourceId: string, trust: number, hop: number, scheduledTick: number }>} propagationQueue
 * @property {number} hopsCompleted
 */

/** Valid event categories. */
export const VALID_CATEGORIES = [
  'economic_crisis',
  'political_uprising',
  'celebration',
  'personal_tragedy',
  'guild_dispute',
  'trade_disruption',
];

/** Valid lifecycle phases. */
export const LIFECYCLE_PHASES = [
  'suppressed',
  'emerging',
  'active',
  'settling',
  'aftermath',
  'resolved',
];

/**
 * The EventDescriptor is the central data object for a world event.
 * Created when a Moment flips. Consumed by atmosphere, citizen manager,
 * spatial audio, WebSocket broadcast, and the lifecycle state machine.
 */
export class EventDescriptor {
  /**
   * @param {Object} opts
   * @param {string} opts.momentId
   * @param {string} opts.category
   * @param {number} opts.severity
   * @param {string} opts.district
   * @param {{ x: number, z: number }} opts.location
   * @param {number} opts.radius
   * @param {string[]} opts.affectedCitizens
   * @param {string[]} opts.witnesses
   * @param {string} opts.description
   * @param {number} opts.tick
   */
  constructor(opts) {
    // Identity
    this.eventId = `evt_${opts.momentId}_${opts.tick}`;
    this.momentId = opts.momentId;
    this.category = opts.category;
    this.description = opts.description;

    // Spatial
    this.severity = opts.severity;
    this.district = opts.district;
    this.location = { x: opts.location.x, z: opts.location.z };
    this.radius = opts.radius;

    // Population
    this.affectedCitizens = opts.affectedCitizens || [];
    this.witnesses = opts.witnesses || [];

    // Effects (populated by buildEffects)
    /** @type {AtmosphereEffect} */
    this.atmosphere = { fogDelta: 0, lightDelta: 0, particleRateDelta: 0, ambientVolumeDelta: 0 };

    /** @type {CitizenBehavior} */
    this.citizenBehavior = {
      gatherPoint: null,
      postureOverride: null,
      movementSpeedMultiplier: 1.0,
      conversationTopicInject: null,
    };

    /** @type {AudioEffect} */
    this.audio = { ambientLayer: null, spatialSources: [] };

    // Lifecycle
    this.durationMinutes = -1; // Computed from severity
    this.createdAt = new Date().toISOString();
    this.lifecyclePhase = 'emerging';
    this.phaseStartedAt = this.createdAt;

    // Propagation
    /** @type {PropagationState} */
    this.propagation = {
      awareCitizens: {},
      propagationQueue: [],
      hopsCompleted: 0,
    };
  }

  /**
   * Serialize to plain object for JSON storage and WebSocket broadcast.
   * @returns {Object}
   */
  toJSON() {
    return {
      eventId: this.eventId,
      momentId: this.momentId,
      category: this.category,
      description: this.description,
      severity: this.severity,
      district: this.district,
      location: this.location,
      radius: this.radius,
      affectedCitizens: this.affectedCitizens,
      witnesses: this.witnesses,
      atmosphere: this.atmosphere,
      citizenBehavior: this.citizenBehavior,
      audio: this.audio,
      durationMinutes: this.durationMinutes,
      createdAt: this.createdAt,
      lifecyclePhase: this.lifecyclePhase,
      phaseStartedAt: this.phaseStartedAt,
      propagation: {
        awareCitizenCount: Object.keys(this.propagation.awareCitizens).length,
        queueSize: this.propagation.propagationQueue.length,
        hopsCompleted: this.propagation.hopsCompleted,
      },
    };
  }

  /**
   * Reconstruct from stored JSON.
   * @param {Object} data
   * @returns {EventDescriptor}
   */
  static fromJSON(data) {
    const desc = Object.create(EventDescriptor.prototype);
    Object.assign(desc, data);
    return desc;
  }
}
```

---

## EV-IMPL-2. Effect Templates (`effects.js`)

Maps event category and severity to concrete atmosphere, citizen behavior, and audio changes. All values are functions of severity.

```js
// src/server/events/effects.js

/**
 * Effect template table. Each category defines parametric functions
 * that scale with severity [0.0, 1.0].
 *
 * Mirrors ALGORITHM_Events.md E3 EFFECT_TEMPLATES.
 */
export const EFFECT_TEMPLATES = {
  economic_crisis: {
    atmosphere: {
      fogDelta:           (s) => +0.03 * s,
      lightDelta:         (s) => -0.15 * s,
      particleRateDelta:  (s) => +10 * s,
      ambientVolumeDelta: (s) => -0.2 * s,
    },
    citizenBehavior: {
      gatherPoint:     null,
      postureOverride: 'worried',
      movementSpeed:   (s) => 1.0 - 0.4 * s,
      topic:           'The market is failing. I have seen nothing like it.',
    },
    audio: {
      ambientLayer: 'market_distress',
      sources: [
        { type: 'argument',       offset: [0, 0, 0],     volume: (s) => 0.5 * s },
        { type: 'worried_murmur', offset: [-10, 0, 5],   volume: (s) => 0.3 * s },
      ],
    },
  },

  political_uprising: {
    atmosphere: {
      fogDelta:           (s) => +0.02 * s,
      lightDelta:         (s) => -0.10 * s,
      particleRateDelta:  (s) => +20 * s,
      ambientVolumeDelta: (s) => +0.3 * s,
    },
    citizenBehavior: {
      gatherPoint:     'district_center',
      postureOverride: 'agitated',
      movementSpeed:   (s) => 1.0 + 0.3 * s,
      topic:           'Something must change. This cannot continue.',
    },
    audio: {
      ambientLayer: 'crowd_unrest',
      sources: [
        { type: 'chanting', offset: [0, 0, 0],    volume: (s) => 0.8 * s },
        { type: 'shouting', offset: [10, 0, 0],   volume: (s) => 0.6 * s },
        { type: 'stamping', offset: [-5, 0, -5],  volume: (s) => 0.4 * s },
      ],
    },
  },

  celebration: {
    atmosphere: {
      fogDelta:           (s) => -0.03 * s,
      lightDelta:         (s) => +0.20 * s,
      particleRateDelta:  (s) => +15 * s,
      ambientVolumeDelta: (s) => +0.3 * s,
    },
    citizenBehavior: {
      gatherPoint:     'district_center',
      postureOverride: 'celebratory',
      movementSpeed:   (s) => 1.0 - 0.2 * s,
      topic:           'What a day! Even strangers are welcome tonight.',
    },
    audio: {
      ambientLayer: 'festival',
      sources: [
        { type: 'music',           offset: [0, 0, 0],    volume: (s) => 0.7 * s },
        { type: 'laughter',        offset: [-5, 0, 5],   volume: (s) => 0.5 * s },
        { type: 'glasses_clinking', offset: [5, 0, -3],  volume: (s) => 0.3 * s },
      ],
    },
  },

  personal_tragedy: {
    atmosphere: {
      fogDelta:           (s) => +0.01 * s,
      lightDelta:         (s) => -0.05 * s,
      particleRateDelta:  (_s) => 0,
      ambientVolumeDelta: (s) => -0.3 * s,
    },
    citizenBehavior: {
      gatherPoint:     null,
      postureOverride: 'solemn',
      movementSpeed:   (s) => 1.0 - 0.5 * s,
      topic:           'Something terrible happened. I cannot speak of it.',
    },
    audio: {
      ambientLayer: 'silence',
      sources: [],
    },
  },

  guild_dispute: {
    atmosphere: {
      fogDelta:           (s) => +0.01 * s,
      lightDelta:         (s) => -0.05 * s,
      particleRateDelta:  (s) => +5 * s,
      ambientVolumeDelta: (s) => -0.1 * s,
    },
    citizenBehavior: {
      gatherPoint:     'guild_hall',
      postureOverride: 'tense',
      movementSpeed:   (s) => 1.0 - 0.3 * s,
      topic:           'The guild is tearing itself apart.',
    },
    audio: {
      ambientLayer: 'argument',
      sources: [
        { type: 'heated_debate', offset: [0, 0, 0], volume: (s) => 0.6 * s },
      ],
    },
  },

  trade_disruption: {
    atmosphere: {
      fogDelta:           (s) => +0.02 * s,
      lightDelta:         (s) => -0.10 * s,
      particleRateDelta:  (s) => +5 * s,
      ambientVolumeDelta: (s) => -0.15 * s,
    },
    citizenBehavior: {
      gatherPoint:     null,
      postureOverride: 'idle',
      movementSpeed:   (s) => 1.0 - 0.5 * s,
      topic:           'No ships for three days. Some say pirates. Some say politics.',
    },
    audio: {
      ambientLayer: 'harbor_quiet',
      sources: [],
    },
  },
};

/**
 * Build concrete effect values from a template and severity.
 * Evaluates all parametric functions with the given severity.
 *
 * @param {string} category - Event category
 * @param {number} severity - [0.0, 1.0]
 * @param {{ x: number, z: number }} location - Event center in world coords
 * @returns {{ atmosphere: Object, citizenBehavior: Object, audio: Object }}
 */
export function buildEffects(category, severity, location) {
  const template = EFFECT_TEMPLATES[category];
  if (!template) {
    console.warn(`[Effects] No template for category: ${category}. Using defaults.`);
    return {
      atmosphere: { fogDelta: 0, lightDelta: 0, particleRateDelta: 0, ambientVolumeDelta: 0 },
      citizenBehavior: {
        gatherPoint: null,
        postureOverride: null,
        movementSpeedMultiplier: 1.0,
        conversationTopicInject: null,
      },
      audio: { ambientLayer: null, spatialSources: [] },
    };
  }

  // Evaluate atmosphere
  const atmosphere = {
    fogDelta:           template.atmosphere.fogDelta(severity),
    lightDelta:         template.atmosphere.lightDelta(severity),
    particleRateDelta:  template.atmosphere.particleRateDelta(severity),
    ambientVolumeDelta: template.atmosphere.ambientVolumeDelta(severity),
  };

  // Evaluate citizen behavior
  const citizenBehavior = {
    gatherPoint:              template.citizenBehavior.gatherPoint,
    postureOverride:          template.citizenBehavior.postureOverride,
    movementSpeedMultiplier:  template.citizenBehavior.movementSpeed(severity),
    conversationTopicInject:  template.citizenBehavior.topic,
  };

  // Evaluate audio with absolute positions
  const spatialSources = (template.audio.sources || []).map(src => ({
    type: src.type,
    position: [
      location.x + src.offset[0],
      src.offset[1],
      location.z + src.offset[2],
    ],
    volume: src.volume(severity),
  }));

  const audio = {
    ambientLayer: template.audio.ambientLayer,
    spatialSources,
  };

  return { atmosphere, citizenBehavior, audio };
}
```

---

## EV-IMPL-3. Event Generator (`generator.js`)

Converts a flipped Moment into a full EventDescriptor. Called by the physics emit phase.

```js
// src/server/events/generator.js

import { getConnectedClient } from '../graph/client.js';
import { EventDescriptor, VALID_CATEGORIES } from './descriptor.js';
import { buildEffects } from './effects.js';
import { registerEvent } from './manager.js';
import { startPropagation } from './propagation.js';

// District center positions (world units).
// Must match the positions in graph/seed.js.
const DISTRICT_CENTERS = {
  Rialto:      { x: 0,    z: 0 },
  San_Marco:   { x: 50,   z: 40 },
  Dorsoduro:   { x: -30,  z: 60 },
  Cannaregio:  { x: -20,  z: -50 },
  Castello:    { x: 80,   z: -10 },
  San_Polo:    { x: -40,  z: 10 },
  Santa_Croce: { x: -60,  z: -20 },
  Giudecca:    { x: -10,  z: 100 },
};

/**
 * Generate a full EventDescriptor from a flipped Moment.
 * This is the entry point called by physics/emit.js.
 *
 * Mirrors ALGORITHM_Events.md E1 generate_event_from_flip.
 *
 * @param {Object} moment - From phaseFlip: { id, description, category, severity, district, tick }
 * @returns {Promise<EventDescriptor>}
 */
export async function generateEventFromFlip(moment) {
  const client = await getConnectedClient();

  // Step 1: Validate category
  let category = moment.category;
  if (!VALID_CATEGORIES.includes(category)) {
    category = await classifyFromContext(client, moment.id);
  }

  // Step 2: Determine location and radius
  const district = moment.district || 'Rialto';
  const location = DISTRICT_CENTERS[district] || DISTRICT_CENTERS.Rialto;
  const radius = computeEventRadius(moment.severity);

  // Step 3: Determine affected citizens
  const affected = await getCitizensInRadius(client, district);
  const witnesses = await getMomentWitnesses(client, moment.id);

  // Step 4: Build descriptor
  const descriptor = new EventDescriptor({
    momentId: moment.id,
    category,
    severity: moment.severity,
    district,
    location,
    radius,
    affectedCitizens: affected.map(c => c.id),
    witnesses: witnesses.map(c => c.id),
    description: moment.description,
    tick: moment.tick,
  });

  // Step 5: Build effects from template
  const effects = buildEffects(category, moment.severity, location);
  descriptor.atmosphere = effects.atmosphere;
  descriptor.citizenBehavior = effects.citizenBehavior;
  descriptor.audio = effects.audio;

  // Step 6: Compute duration from severity
  descriptor.durationMinutes = computeTotalDuration(moment.severity);

  // Step 7: Register in event manager (handles slot management)
  registerEvent(descriptor);

  // Step 8: Start news propagation
  startPropagation(descriptor.eventId, witnesses.map(c => c.id), moment.tick);

  console.log(
    `[Events] Generated: ${descriptor.eventId} (${category}, severity=${moment.severity.toFixed(2)}, ` +
    `district=${district}, affected=${affected.length}, witnesses=${witnesses.length})`
  );

  return descriptor;
}

/**
 * Compute effect radius in world units from severity.
 * Minor events affect only immediate area. Crises affect entire district.
 *
 * @param {number} severity
 * @returns {number}
 */
function computeEventRadius(severity) {
  // severity 0.0 -> radius 20 (single piazza)
  // severity 0.5 -> radius 50 (half district)
  // severity 1.0 -> radius 100 (full district)
  return Math.round(20 + 80 * severity);
}

/**
 * Compute total event duration in minutes from severity.
 *
 * @param {number} severity
 * @returns {number}
 */
function computeTotalDuration(severity) {
  // Emerging (5) + Active + Settling + Aftermath
  const active = lerp(30, 360, severity);
  const settling = lerp(30, 360, severity);
  const aftermath = lerp(360, 1440, severity);
  return 5 + active + settling + aftermath;
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t - [0, 1]
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Fallback classification from feeding narrative types.
 *
 * @param {import('../graph/client.js').VeneziaGraphClient} client
 * @param {string} momentId
 * @returns {Promise<string>}
 */
async function classifyFromContext(client, momentId) {
  const rows = await client.roQuery(
    `MATCH (n:Narrative)-[:FEEDS]->(m:Moment {id: $mid})
     RETURN collect(DISTINCT n.type) AS types`,
    { mid: momentId }
  );

  const types = rows[0]?.types || [];

  if (types.includes('debt') && types.includes('grievance')) return 'economic_crisis';
  if (types.includes('grudge') && types.includes('grievance')) return 'political_uprising';
  if (types.includes('alliance')) return 'celebration';
  if (types.includes('grudge') && types.length === 1) return 'personal_tragedy';
  if (types.includes('belief') && types.includes('alliance')) return 'guild_dispute';
  if (types.includes('forestiere_news')) return 'trade_disruption';

  return 'economic_crisis'; // Default
}

/**
 * Get all citizens in a district (proxy for "in radius").
 *
 * @param {import('../graph/client.js').VeneziaGraphClient} client
 * @param {string} district
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
async function getCitizensInRadius(client, district) {
  return client.roQuery(
    `MATCH (c:Character {district: $dist, alive: true})
     RETURN c.id AS id, c.name AS name`,
    { dist: district }
  );
}

/**
 * Get citizens who have WITNESS edges to a Moment.
 * If no explicit witnesses, use citizens connected through FEEDS narratives.
 *
 * @param {import('../graph/client.js').VeneziaGraphClient} client
 * @param {string} momentId
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
async function getMomentWitnesses(client, momentId) {
  // Check for explicit WITNESS edges
  let witnesses = await client.roQuery(
    `MATCH (c:Character)-[:WITNESS]->(m:Moment {id: $mid})
     RETURN c.id AS id, c.name AS name`,
    { mid: momentId }
  );

  if (witnesses.length > 0) return witnesses;

  // Fallback: citizens who believe the feeding narratives (top 5 by confidence)
  witnesses = await client.roQuery(
    `MATCH (c:Character)-[b:BELIEVES]->(n:Narrative)-[:FEEDS]->(m:Moment {id: $mid})
     RETURN DISTINCT c.id AS id, c.name AS name
     ORDER BY b.confidence DESC
     LIMIT 5`,
    { mid: momentId }
  );

  return witnesses;
}
```

---

## EV-IMPL-4. Event Store (`store.js`)

In-memory store with periodic disk dump. Events are queried by phase, district, and ID. The store survives process restarts through the dump file.

```js
// src/server/events/store.js

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { EventDescriptor } from './descriptor.js';

const STORE_PATH = process.env.VENEZIA_EVENT_STORE_PATH || './state/events.json';
const DUMP_INTERVAL_MS = parseInt(
  process.env.VENEZIA_EVENT_DUMP_INTERVAL_MS || '60000',
  10
);

/**
 * In-memory event store. All active events are held in a Map.
 * Periodic dump writes to disk for crash recovery.
 */
class EventStore {
  /** @type {Map<string, EventDescriptor>} */
  _events = new Map();

  /** @type {NodeJS.Timeout | null} */
  _dumpInterval = null;

  /** @type {boolean} */
  _dirty = false;

  constructor() {
    this._loadFromDisk();
    this._startDumpLoop();
  }

  /**
   * Store or update an event.
   * @param {EventDescriptor} descriptor
   */
  set(descriptor) {
    this._events.set(descriptor.eventId, descriptor);
    this._dirty = true;
  }

  /**
   * Get an event by ID.
   * @param {string} eventId
   * @returns {EventDescriptor | undefined}
   */
  get(eventId) {
    return this._events.get(eventId);
  }

  /**
   * Delete an event (after archival).
   * @param {string} eventId
   */
  delete(eventId) {
    this._events.delete(eventId);
    this._dirty = true;
  }

  /**
   * Get all events in specific lifecycle phases.
   * @param {string[]} phases - e.g., ['emerging', 'active']
   * @returns {EventDescriptor[]}
   */
  getByPhase(phases) {
    const results = [];
    for (const event of this._events.values()) {
      if (phases.includes(event.lifecyclePhase)) {
        results.push(event);
      }
    }
    return results;
  }

  /**
   * Get all events affecting a specific district.
   * @param {string} district
   * @returns {EventDescriptor[]}
   */
  getByDistrict(district) {
    const results = [];
    for (const event of this._events.values()) {
      if (event.district === district) {
        results.push(event);
      }
    }
    return results;
  }

  /**
   * Get count of events in active phases (emerging + active).
   * Used by concurrent event slot management.
   * @returns {number}
   */
  getActiveCount() {
    return this.getByPhase(['emerging', 'active']).length;
  }

  /**
   * Get all events as array (for diagnostics).
   * @returns {EventDescriptor[]}
   */
  getAll() {
    return Array.from(this._events.values());
  }

  /**
   * Force an immediate disk dump.
   */
  flush() {
    this._dumpToDisk();
  }

  /**
   * Stop the dump loop (for graceful shutdown).
   */
  stop() {
    if (this._dumpInterval) {
      clearInterval(this._dumpInterval);
      this._dumpInterval = null;
    }
    // Final flush
    this._dumpToDisk();
  }

  // ── Private ──────────────────────────────────────────────

  _loadFromDisk() {
    try {
      const raw = readFileSync(STORE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        for (const item of data) {
          const desc = EventDescriptor.fromJSON(item);
          this._events.set(desc.eventId, desc);
        }
        console.log(`[EventStore] Loaded ${this._events.size} events from disk.`);
      }
    } catch {
      // File does not exist or is corrupted. Start fresh.
      console.log('[EventStore] No existing event data. Starting fresh.');
    }
  }

  _dumpToDisk() {
    if (!this._dirty) return;

    try {
      mkdirSync(dirname(STORE_PATH), { recursive: true });
      const data = Array.from(this._events.values()).map(e =>
        e.toJSON ? e.toJSON() : e
      );
      writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
      this._dirty = false;
    } catch (err) {
      console.error(`[EventStore] Dump failed: ${err.message}`);
    }
  }

  _startDumpLoop() {
    this._dumpInterval = setInterval(() => this._dumpToDisk(), DUMP_INTERVAL_MS);
    // Unref so the timer does not prevent process exit
    if (this._dumpInterval.unref) {
      this._dumpInterval.unref();
    }
  }
}

// Singleton
let _instance = null;

/**
 * @returns {EventStore}
 */
export function getEventStore() {
  if (!_instance) {
    _instance = new EventStore();
  }
  return _instance;
}

export { EventStore };
```

---

## EV-IMPL-5. Lifecycle State Machine (`lifecycle.js`)

```js
// src/server/events/lifecycle.js

import { getEventStore } from './store.js';

/**
 * Phase durations scaled by severity (in minutes).
 *
 * Mirrors ALGORITHM_Events.md E6 compute_phase_durations.
 *
 * @param {number} severity
 * @returns {{ emerging: number, active: number, settling: number, aftermath: number }}
 */
export function computePhaseDurations(severity) {
  return {
    emerging:  5,                                         // Always 5 minutes
    active:    lerp(30, 360, severity),                   // 30 min to 6 hours
    settling:  lerp(30, 360, severity),                   // 30 min to 6 hours
    aftermath: lerp(360, 1440, severity),                 // 6 hours to 24 hours
  };
}

/**
 * Get the current effect intensity multiplier [0.0, 1.0]
 * based on lifecycle phase and progress within that phase.
 *
 * @param {import('./descriptor.js').EventDescriptor} event
 * @returns {number}
 */
export function getLifecycleIntensity(event) {
  const phase = event.lifecyclePhase;
  const phaseAgeMinutes = minutesSince(event.phaseStartedAt);
  const durations = computePhaseDurations(event.severity);

  switch (phase) {
    case 'emerging':   return 0.5;
    case 'active':     return 1.0;
    case 'settling': {
      const progress = Math.max(0, Math.min(1, phaseAgeMinutes / durations.settling));
      return 1.0 - progress;
    }
    case 'aftermath':  return 0.0;
    case 'resolved':   return 0.0;
    case 'suppressed': return 0.0;
    default:           return 0.0;
  }
}

/**
 * Advance the lifecycle of a single event.
 * Called every event tick (5 minutes).
 *
 * Mirrors ALGORITHM_Events.md E6 advance_lifecycle.
 *
 * @param {string} eventId
 * @param {(msg: Object) => void} broadcast - WebSocket broadcast function
 * @returns {{ transitioned: boolean, newPhase: string | null }}
 */
export function advanceLifecycle(eventId, broadcast) {
  const store = getEventStore();
  const event = store.get(eventId);
  if (!event) return { transitioned: false, newPhase: null };

  const phase = event.lifecyclePhase;
  const phaseAgeMinutes = minutesSince(event.phaseStartedAt);
  const durations = computePhaseDurations(event.severity);

  let newPhase = null;

  if (phase === 'emerging' && phaseAgeMinutes >= durations.emerging) {
    newPhase = 'active';
  } else if (phase === 'active' && phaseAgeMinutes >= durations.active) {
    // Crisis events (severity >= 0.9) have indefinite active phase
    if (event.severity < 0.9) {
      newPhase = 'settling';
    }
  } else if (phase === 'settling' && phaseAgeMinutes >= durations.settling) {
    newPhase = 'aftermath';
  } else if (phase === 'aftermath' && phaseAgeMinutes >= durations.aftermath) {
    newPhase = 'resolved';
  }

  if (newPhase) {
    const oldPhase = event.lifecyclePhase;
    event.lifecyclePhase = newPhase;
    event.phaseStartedAt = new Date().toISOString();
    store.set(event);

    // Broadcast phase transition
    broadcast({
      type: 'event_phase_change',
      data: {
        eventId: event.eventId,
        oldPhase,
        newPhase,
        severity: event.severity,
        district: event.district,
      },
    });

    console.log(`[Lifecycle] ${eventId}: ${oldPhase} -> ${newPhase}`);
    return { transitioned: true, newPhase };
  }

  return { transitioned: false, newPhase: null };
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * @param {string} isoTimestamp
 * @returns {number} Minutes elapsed since the timestamp
 */
function minutesSince(isoTimestamp) {
  if (!isoTimestamp) return 0;
  const elapsed = Date.now() - new Date(isoTimestamp).getTime();
  return elapsed / (1000 * 60);
}
```

---

## EV-IMPL-6. Concurrent Event Manager (`manager.js`)

```js
// src/server/events/manager.js

import { getEventStore } from './store.js';
import { MAX_CONCURRENT_ACTIVE_MOMENTS } from '../physics/constants.js';

/** @type {Array<{ eventId: string, severity: number }>} */
let _suppressedQueue = [];

/**
 * Register a new event. Handles concurrent slot management.
 * If all slots are full, the event is either suppressed or preempts the weakest.
 *
 * Mirrors ALGORITHM_Events.md E7 register_event.
 *
 * @param {import('./descriptor.js').EventDescriptor} descriptor
 */
export function registerEvent(descriptor) {
  const store = getEventStore();
  const activeCount = store.getActiveCount();

  if (activeCount >= MAX_CONCURRENT_ACTIVE_MOMENTS) {
    // Find weakest active event
    const active = store.getByPhase(['emerging', 'active']);
    active.sort((a, b) => a.severity - b.severity);
    const weakest = active[0];

    if (weakest && descriptor.severity > weakest.severity) {
      // Preempt: force weakest to settling
      preemptEvent(weakest.eventId);
    } else {
      // Suppress: queue for later activation
      descriptor.lifecyclePhase = 'suppressed';
      store.set(descriptor);
      _suppressedQueue.push({
        eventId: descriptor.eventId,
        severity: descriptor.severity,
      });
      _suppressedQueue.sort((a, b) => b.severity - a.severity);
      console.log(`[Manager] Event ${descriptor.eventId} suppressed (${activeCount} active)`);
      return;
    }
  }

  descriptor.lifecyclePhase = 'emerging';
  descriptor.phaseStartedAt = new Date().toISOString();
  store.set(descriptor);
}

/**
 * Force an active event to skip to settling phase.
 *
 * @param {string} eventId
 */
export function preemptEvent(eventId) {
  const store = getEventStore();
  const event = store.get(eventId);
  if (!event) return;

  event.lifecyclePhase = 'settling';
  event.phaseStartedAt = new Date().toISOString();
  store.set(event);

  console.log(`[Manager] Preempted event ${eventId} (severity=${event.severity.toFixed(2)})`);
}

/**
 * Check if suppressed events can be activated.
 * Called every event tick.
 */
export function checkSuppressedQueue() {
  if (_suppressedQueue.length === 0) return;

  const store = getEventStore();
  const activeCount = store.getActiveCount();

  if (activeCount >= MAX_CONCURRENT_ACTIVE_MOMENTS) return;

  // Activate highest-severity suppressed event
  const next = _suppressedQueue.shift();
  if (!next) return;

  const event = store.get(next.eventId);
  if (!event) return;

  // Check if still relevant (not older than 2 hours)
  const ageMs = Date.now() - new Date(event.createdAt).getTime();
  if (ageMs > 2 * 60 * 60 * 1000) {
    // Too old. Skip to resolved.
    event.lifecyclePhase = 'resolved';
    store.set(event);
    console.log(`[Manager] Expired suppressed event ${next.eventId}`);
    return;
  }

  event.lifecyclePhase = 'emerging';
  event.phaseStartedAt = new Date().toISOString();
  store.set(event);
  console.log(`[Manager] Activated suppressed event ${next.eventId}`);
}

/**
 * Get active events (for status endpoint).
 * @returns {Array<Object>}
 */
export function getActiveEvents() {
  return getEventStore()
    .getByPhase(['emerging', 'active'])
    .map(e => e.toJSON())
    .sort((a, b) => b.severity - a.severity);
}
```

---

## EV-IMPL-7. News Propagation (`propagation.js`)

BFS propagation through the social graph. News travels hop-by-hop, constrained by trust and geography.

```js
// src/server/events/propagation.js

import { getConnectedClient } from '../graph/client.js';
import { getCitizenTrustNetwork } from '../graph/queries.js';
import { createOrUpdateBelief, createNarrative } from '../graph/mutations.js';
import { getEventStore } from './store.js';
import { areDistrictsAdjacent } from '../graph/constants.js';

/**
 * Confidence degradation per hop.
 */
const HOP_CONFIDENCE_DECAY = {
  0: 1.0,   // Witness: total confidence
  1: 0.8,   // Same district, trusted source
  2: 0.6,   // Adjacent district
  3: 0.4,   // Two districts away
  4: 0.3,   // City-wide (heard it third-hand)
};

/**
 * Initialize propagation state for a new event.
 * Witnesses are the seed nodes.
 *
 * Mirrors ALGORITHM_Events.md E4 start_propagation.
 *
 * @param {string} eventId
 * @param {string[]} witnessIds
 * @param {number} currentTick
 */
export function startPropagation(eventId, witnessIds, currentTick) {
  const store = getEventStore();
  const event = store.get(eventId);
  if (!event) return;

  // Seed: witnesses know immediately at confidence 1.0
  for (const wid of witnessIds) {
    event.propagation.awareCitizens[wid] = {
      confidence: 1.0,
      source: 'witness',
      learnedAt: new Date().toISOString(),
      hop: 0,
    };
  }

  // First propagation front will be built on the first propagation tick.
  // We do not query the trust network here to keep event creation fast.

  store.set(event);
}

/**
 * Advance propagation by one tick.
 * Processes the propagation queue and generates new awareness.
 *
 * Mirrors ALGORITHM_Events.md E4 propagation_tick.
 *
 * @param {string} eventId
 * @param {number} currentTick
 * @returns {Promise<{ newlyAware: number, totalAware: number, queueSize: number, hops: number }>}
 */
export async function propagationTick(eventId, currentTick) {
  const store = getEventStore();
  const event = store.get(eventId);
  if (!event) return { newlyAware: 0, totalAware: 0, queueSize: 0, hops: 0 };

  const client = await getConnectedClient();
  const prop = event.propagation;
  const newlyAware = [];

  // If queue is empty and we have witnesses, build initial front
  if (prop.propagationQueue.length === 0 && Object.keys(prop.awareCitizens).length > 0) {
    await _buildInitialFront(event, currentTick);
  }

  // Process entries scheduled for this tick or earlier
  const ready = prop.propagationQueue.filter(q => q.scheduledTick <= currentTick);
  prop.propagationQueue = prop.propagationQueue.filter(q => q.scheduledTick > currentTick);

  for (const entry of ready) {
    const { citizenId, sourceId, trust, hop } = entry;

    // Skip if already aware
    if (prop.awareCitizens[citizenId]) continue;

    // Compute confidence
    const baseConfidence = HOP_CONFIDENCE_DECAY[hop] ?? 0.2;
    const trustFactor = trust / 100.0;
    const confidence = baseConfidence * trustFactor;

    if (confidence < 0.1) continue;

    // Citizen becomes aware
    prop.awareCitizens[citizenId] = {
      confidence,
      source: 'hearsay',
      sourceId,
      learnedAt: new Date().toISOString(),
      hop,
    };
    newlyAware.push(citizenId);

    // Create BELIEVES edge for the event narrative
    const eventNarrId = `narr_event_${event.eventId}`;
    await _ensureEventNarrative(eventNarrId, event);
    await createOrUpdateBelief(citizenId, eventNarrId, confidence, 'hearsay');
  }

  // Advance BFS: newly aware citizens propagate to their networks
  for (const citizenId of newlyAware) {
    const citizenHop = prop.awareCitizens[citizenId].hop;
    const citizenDistrict = await _getCitizenDistrict(client, citizenId);
    const neighbors = await getCitizenTrustNetwork(citizenId, 20);

    for (const neighbor of neighbors) {
      if (prop.awareCitizens[neighbor.citizenId]) continue;

      // Determine delay based on geographic distance
      let delayTicks;
      if (neighbor.district === citizenDistrict) {
        delayTicks = 1;                              // Same district: 5 minutes
      } else if (areDistrictsAdjacent(citizenDistrict, neighbor.district)) {
        delayTicks = 4;                              // Adjacent: ~20 minutes
      } else {
        delayTicks = 12;                             // Distant: ~1 hour
      }

      prop.propagationQueue.push({
        citizenId: neighbor.citizenId,
        sourceId: citizenId,
        trust: neighbor.trust,
        hop: citizenHop + 1,
        scheduledTick: currentTick + delayTicks,
      });
    }
  }

  // Update hop count
  if (newlyAware.length > 0) {
    const maxHop = Math.max(
      prop.hopsCompleted,
      ...newlyAware.map(c => prop.awareCitizens[c].hop)
    );
    prop.hopsCompleted = maxHop;
  }

  store.set(event);

  return {
    newlyAware: newlyAware.length,
    totalAware: Object.keys(prop.awareCitizens).length,
    queueSize: prop.propagationQueue.length,
    hops: prop.hopsCompleted,
  };
}

// ── Private helpers ─────────────────────────────────────────

async function _buildInitialFront(event, currentTick) {
  const prop = event.propagation;
  const witnessIds = Object.keys(prop.awareCitizens);
  const client = await getConnectedClient();

  for (const wid of witnessIds) {
    const district = await _getCitizenDistrict(client, wid);
    const neighbors = await getCitizenTrustNetwork(wid, 50);

    for (const neighbor of neighbors) {
      if (prop.awareCitizens[neighbor.citizenId]) continue;
      if (neighbor.district === district) {
        prop.propagationQueue.push({
          citizenId: neighbor.citizenId,
          sourceId: wid,
          trust: neighbor.trust,
          hop: 1,
          scheduledTick: currentTick + 1,
        });
      }
    }
  }
}

async function _ensureEventNarrative(narrativeId, event) {
  const client = await getConnectedClient();
  const existing = await client.roQuery(
    `MATCH (n:Narrative {id: $nid}) RETURN n.id AS id`,
    { nid: narrativeId }
  );

  if (existing.length > 0) return;

  await createNarrative({
    id: narrativeId,
    content: event.description,
    truth: 1.0,
    energy: 0.5,
    weight: 1.0,
    type: 'event_aftermath',
    source: 'event',
  });
}

async function _getCitizenDistrict(client, citizenId) {
  const rows = await client.roQuery(
    `MATCH (c:Character {id: $cid}) RETURN c.district AS district`,
    { cid: citizenId }
  );
  return rows[0]?.district ?? 'unknown';
}
```

---

## EV-IMPL-8. Forestiere News Pipeline (`forestiere.js`)

RSS fetching, Claude translation to 15th century Venetian context, and injection into the graph.

```js
// src/server/events/forestiere.js

import Parser from 'rss-parser';
import Anthropic from '@anthropic-ai/sdk';
import { getConnectedClient } from '../graph/client.js';
import { createNarrative, createOrUpdateBelief, moveCharacter } from '../graph/mutations.js';
import { startPropagation } from './propagation.js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const STATE_FILE = './state/forestiere_last_injection.json';

const DEFAULT_FEEDS = [
  'https://feeds.reuters.com/reuters/worldNews',
  'https://feeds.reuters.com/reuters/businessNews',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
];

const HIGH_SCORE_KEYWORDS = [
  'trade', 'sanctions', 'war', 'conflict', 'embargo',
  'economy', 'crisis', 'alliance', 'treaty', 'famine',
  'plague', 'storm', 'shipwreck', 'piracy', 'rebellion',
  'election', 'overthrow', 'tax', 'tariff', 'debt',
];

const LOW_SCORE_KEYWORDS = [
  'tech', 'software', 'AI', 'app', 'social media',
  'film', 'movie', 'celebrity', 'sport', 'game',
  'vaccine', 'satellite', 'internet', 'crypto',
];

/**
 * Run the daily Forestiere news tick.
 * Fetches RSS, selects a headline, translates it via Claude API,
 * and injects it into the graph as a forestiere_news Narrative.
 *
 * Mirrors ALGORITHM_Events.md E5 forestiere_news_tick.
 *
 * @param {number} [currentTick] - For propagation scheduling
 * @returns {Promise<Object|null>} Injection result or null if already injected today
 */
export async function forestiereNewsTick(currentTick = 0) {
  if (process.env.VENEZIA_FORESTIERE_ENABLED === 'false') {
    return null;
  }

  // Step 1: Check if already injected today
  const lastInjection = loadLastInjection();
  if (lastInjection) {
    const lastDate = new Date(lastInjection.timestamp).toDateString();
    const today = new Date().toDateString();
    if (lastDate === today) {
      return null; // Already injected today
    }
  }

  // Step 2: Fetch RSS headlines
  const feedUrls = (process.env.VENEZIA_FORESTIERE_FEEDS || '')
    .split(',')
    .filter(Boolean);
  const feeds = feedUrls.length > 0 ? feedUrls : DEFAULT_FEEDS;

  const parser = new Parser({
    timeout: 10000,
    headers: { 'User-Agent': 'Venezia/1.0 (cities-of-light)' },
  });

  const headlines = [];

  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const entry of (feed.items || []).slice(0, 5)) {
        headlines.push({
          title: entry.title || '',
          summary: (entry.contentSnippet || entry.content || '').slice(0, 200),
          source: url,
        });
      }
    } catch (err) {
      console.warn(`[Forestiere] Failed to fetch ${url}: ${err.message}`);
    }
  }

  if (headlines.length === 0) {
    console.warn('[Forestiere] No headlines fetched from any feed.');
    return null;
  }

  // Step 3: Select the most translatable headline
  const selected = selectMostTranslatable(headlines);

  // Step 4: Translate via Claude API
  const translated = await translateHeadline(selected);
  if (!translated) {
    console.error('[Forestiere] Translation failed.');
    return null;
  }

  // Step 5: Inject into graph
  const client = await getConnectedClient();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const contentHash = Math.abs(hashCode(translated)).toString(36).slice(0, 4);
  const narrId = `narr_forestiere_${dateStr}_${contentHash}`;

  await createNarrative({
    id: narrId,
    content: translated,
    truth: 0.5,
    energy: 0.5,
    weight: 0.5,
    type: 'forestiere_news',
    source: 'forestiere',
  });

  // Step 6: Select a Forestiere carrier
  let carrierId = await selectCarrier(client);

  // Carrier believes the news at 0.9 confidence
  await createOrUpdateBelief(carrierId, narrId, 0.9, 'personal');

  // Move carrier to docks
  const dockPlace = await client.roQuery(
    `MATCH (p:Place)
     WHERE p.name CONTAINS 'dock' OR p.name CONTAINS 'port' OR p.name CONTAINS 'Rialto'
     RETURN p.id AS id
     LIMIT 1`
  );
  if (dockPlace[0]) {
    await moveCharacter(carrierId, dockPlace[0].id);
  }

  // Step 7: Start propagation from carrier
  startPropagation(`news_${narrId}`, [carrierId], currentTick);

  // Step 8: Record injection
  const record = {
    timestamp: new Date().toISOString(),
    narrativeId: narrId,
    content: translated,
    originalHeadline: selected.title,
    carrier: carrierId,
  };
  saveLastInjection(record);

  console.log(`[Forestiere] Injected: "${translated}" (from: "${selected.title}") carrier: ${carrierId}`);
  return record;
}

/**
 * Score headlines by how well they translate to 15th century context.
 * Prefer geopolitics, trade, conflict. Avoid technology, entertainment.
 *
 * @param {Array<{ title: string, summary: string, source: string }>} headlines
 * @returns {{ title: string, summary: string, source: string }}
 */
function selectMostTranslatable(headlines) {
  let best = headlines[0];
  let bestScore = -Infinity;

  for (const headline of headlines) {
    const text = (headline.title + ' ' + headline.summary).toLowerCase();
    let score = 0;

    for (const kw of HIGH_SCORE_KEYWORDS) {
      if (text.includes(kw)) score += 1;
    }
    for (const kw of LOW_SCORE_KEYWORDS) {
      if (text.includes(kw)) score -= 2;
    }

    if (score > bestScore) {
      bestScore = score;
      best = headline;
    }
  }

  return best;
}

/**
 * Translate a modern headline to 15th century Venetian dock gossip via Claude.
 *
 * @param {{ title: string, summary: string }} headline
 * @returns {Promise<string|null>}
 */
async function translateHeadline(headline) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[Forestiere] ANTHROPIC_API_KEY not set. Cannot translate.');
    return null;
  }

  const anthropic = new Anthropic({ apiKey });

  const prompt = `Translate this modern news headline into a plausible event that a 15th century Venetian merchant arriving by ship might report.

Modern headline: "${headline.title}"
Summary: "${headline.summary}"

Rules:
- Use the language and concerns of 15th century Venice.
- Reference real places of the era: Constantinople, Genoa, the Levant, the Silk Road, the Holy Land, Egypt, Flanders.
- Do not mention anything that could not exist in 1450.
- Keep it to one sentence.
- It should feel like something overheard at the docks.

Output only the translated sentence.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content?.[0]?.text?.trim();
    return text || null;
  } catch (err) {
    console.error(`[Forestiere] Claude API call failed: ${err.message}`);
    return null;
  }
}

/**
 * Select a Forestiere citizen to carry the news.
 * Falls back to a dock worker, then any citizen.
 *
 * @param {import('../graph/client.js').VeneziaGraphClient} client
 * @returns {Promise<string>}
 */
async function selectCarrier(client) {
  // Try Forestieri class
  const forestieri = await client.roQuery(
    `MATCH (c:Character {class: 'Forestieri'})
     RETURN c.id AS id, c.name AS name`
  );

  if (forestieri.length > 0) {
    const idx = Math.floor(Math.random() * forestieri.length);
    return forestieri[idx].id;
  }

  // Fallback: dock worker
  const dockWorker = await client.roQuery(
    `MATCH (c:Character)-[:AT]->(p:Place)
     WHERE p.name CONTAINS 'dock' OR p.name CONTAINS 'port'
     RETURN c.id AS id
     LIMIT 1`
  );

  if (dockWorker.length > 0) return dockWorker[0].id;

  // Last resort: any citizen
  const any = await client.roQuery(
    `MATCH (c:Character) RETURN c.id AS id LIMIT 1`
  );
  return any[0]?.id ?? 'char_unknown';
}

// ── State persistence ──────────────────────────────────────

function loadLastInjection() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveLastInjection(record) {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(record, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[Forestiere] Failed to save injection record: ${err.message}`);
  }
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}
```

---

## EV-IMPL-9. Master Event Tick (`tick.js`)

Called every 5 minutes alongside the physics tick. Advances all active event lifecycles, runs propagation, checks suppressed queue, and runs the daily Forestiere news.

```js
// src/server/events/tick.js

import { getEventStore } from './store.js';
import { advanceLifecycle, getLifecycleIntensity } from './lifecycle.js';
import { propagationTick } from './propagation.js';
import { checkSuppressedQueue } from './manager.js';
import { forestiereNewsTick } from './forestiere.js';

/**
 * @typedef {Object} EventTickResult
 * @property {number} eventsAdvanced
 * @property {number} propagationUpdates
 * @property {boolean} forestiereInjected
 */

/**
 * Master event tick. Called every 5 minutes by physics-bridge.js
 * (or independently on the same interval).
 *
 * @param {number} currentTick
 * @param {(msg: Object) => void} broadcast - WebSocket broadcast function
 * @returns {Promise<EventTickResult>}
 */
export async function eventTick(currentTick, broadcast) {
  const store = getEventStore();
  let eventsAdvanced = 0;
  let propagationUpdates = 0;

  // Step 1: Advance lifecycle of all non-resolved events
  const activePhases = ['emerging', 'active', 'settling', 'aftermath'];
  const events = store.getByPhase(activePhases);

  for (const event of events) {
    // Advance lifecycle
    const { transitioned } = advanceLifecycle(event.eventId, broadcast);
    if (transitioned) eventsAdvanced++;

    // Run propagation for events in emerging or active phase
    if (['emerging', 'active'].includes(event.lifecyclePhase)) {
      const propResult = await propagationTick(event.eventId, currentTick);
      propagationUpdates += propResult.newlyAware;
    }

    // Broadcast current effect intensity to clients
    const intensity = getLifecycleIntensity(event);
    if (intensity > 0) {
      broadcast({
        type: 'event_effects_update',
        data: {
          eventId: event.eventId,
          intensity,
          atmosphere: scaleAtmosphere(event.atmosphere, intensity),
          district: event.district,
        },
      });
    }
  }

  // Step 2: Check suppressed queue
  checkSuppressedQueue();

  // Step 3: Daily Forestiere news injection
  let forestiereInjected = false;
  try {
    const result = await forestiereNewsTick(currentTick);
    forestiereInjected = result !== null;
  } catch (err) {
    console.error(`[EventTick] Forestiere failed: ${err.message}`);
  }

  return { eventsAdvanced, propagationUpdates, forestiereInjected };
}

/**
 * Scale atmosphere effects by intensity multiplier.
 *
 * @param {Object} atmosphere
 * @param {number} intensity
 * @returns {Object}
 */
function scaleAtmosphere(atmosphere, intensity) {
  return {
    fogDelta:           (atmosphere.fogDelta || 0) * intensity,
    lightDelta:         (atmosphere.lightDelta || 0) * intensity,
    particleRateDelta:  (atmosphere.particleRateDelta || 0) * intensity,
    ambientVolumeDelta: (atmosphere.ambientVolumeDelta || 0) * intensity,
  };
}
```

---

## EV-IMPL-10. WebSocket Broadcast Format

All event-related WebSocket messages sent to connected VR/web clients.

```js
// Server -> Client WebSocket messages (JSON stringified):

// 1. New world event created
{
  type: 'world_event',
  data: {
    eventId: 'evt_mom_rialto_economic_crisis_0_42',
    category: 'economic_crisis',
    severity: 0.65,
    district: 'Rialto',
    location: { x: 0, z: 0 },
    radius: 72,
    description: 'An economic crisis builds in Rialto. Merchants close shops; debts go unpaid.',
    lifecyclePhase: 'emerging',
    atmosphere: {
      fogDelta: 0.0195,
      lightDelta: -0.0975,
      particleRateDelta: 6.5,
      ambientVolumeDelta: -0.13,
    },
    citizenBehavior: {
      gatherPoint: null,
      postureOverride: 'worried',
      movementSpeedMultiplier: 0.74,
      conversationTopicInject: 'The market is failing. I have seen nothing like it.',
    },
    audio: {
      ambientLayer: 'market_distress',
      spatialSources: [
        { type: 'argument', position: [0, 0, 0], volume: 0.325 },
        { type: 'worried_murmur', position: [-10, 0, 5], volume: 0.195 },
      ],
    },
  },
}

// 2. Event phase transition
{
  type: 'event_phase_change',
  data: {
    eventId: 'evt_mom_rialto_economic_crisis_0_42',
    oldPhase: 'emerging',
    newPhase: 'active',
    severity: 0.65,
    district: 'Rialto',
  },
}

// 3. Periodic effect intensity update (every 5 min during active events)
{
  type: 'event_effects_update',
  data: {
    eventId: 'evt_mom_rialto_economic_crisis_0_42',
    intensity: 0.73,   // Diminishing during settling phase
    atmosphere: {
      fogDelta: 0.0142,
      lightDelta: -0.0712,
      particleRateDelta: 4.745,
      ambientVolumeDelta: -0.0949,
    },
    district: 'Rialto',
  },
}

// 4. Event preempted by higher severity
{
  type: 'event_preempted',
  data: {
    eventId: 'evt_mom_dorsoduro_guild_dispute_1_38',
    category: 'guild_dispute',
    severity: 0.35,
    reason: 'preempted_by_higher_severity',
  },
}
```

---

## EV-IMPL-11. 3D Effect Application (`event-renderer.js`)

Client-side Three.js code that reads event WebSocket messages and modifies the scene.

```js
// src/client/atmosphere/event-renderer.js

import * as THREE from 'three';

/**
 * Manages Three.js scene modifications driven by world events.
 * Receives event data from WebSocket and applies atmosphere,
 * audio, and visual changes to the 3D world.
 */
export class EventRenderer {
  /** @type {THREE.Scene} */
  _scene;

  /** @type {THREE.FogExp2} */
  _fog;

  /** @type {THREE.DirectionalLight} */
  _mainLight;

  /** @type {Map<string, { particles: THREE.Points, audio: AudioBufferSourceNode[] }>} */
  _activeEffects = new Map();

  /** @type {number} */
  _baseFogDensity = 0.002;

  /** @type {number} */
  _baseLightIntensity = 1.0;

  /**
   * @param {THREE.Scene} scene
   * @param {THREE.DirectionalLight} mainLight
   */
  constructor(scene, mainLight) {
    this._scene = scene;
    this._mainLight = mainLight;

    // Initialize fog if not present
    if (!scene.fog) {
      scene.fog = new THREE.FogExp2(0x87CEEB, this._baseFogDensity);
    }
    this._fog = scene.fog;
  }

  /**
   * Handle a new world_event message.
   * Creates persistent effects that will be updated by subsequent messages.
   *
   * @param {Object} eventData - The `data` field from the world_event WebSocket message
   */
  onWorldEvent(eventData) {
    const { eventId, atmosphere, audio, location, radius } = eventData;

    // Create particle system for this event
    const particles = this._createEventParticles(
      location,
      radius,
      atmosphere.particleRateDelta
    );

    // Store active effect
    this._activeEffects.set(eventId, {
      particles,
      audio: [],
      baseAtmosphere: atmosphere,
    });

    // Apply initial atmosphere changes
    this._applyAtmosphere(atmosphere);

    console.log(`[EventRenderer] Event started: ${eventId}`);
  }

  /**
   * Handle event_effects_update message.
   * Updates intensity of existing effects (e.g., during settling fade).
   *
   * @param {Object} updateData
   */
  onEffectsUpdate(updateData) {
    const { eventId, intensity, atmosphere } = updateData;
    const effect = this._activeEffects.get(eventId);
    if (!effect) return;

    // Update atmosphere with scaled values
    this._applyAtmosphere(atmosphere);

    // Update particle visibility based on intensity
    if (effect.particles) {
      effect.particles.material.opacity = intensity;
    }
  }

  /**
   * Handle event_phase_change message.
   * Clean up effects when event enters aftermath or resolved.
   *
   * @param {Object} phaseData
   */
  onPhaseChange(phaseData) {
    const { eventId, newPhase } = phaseData;

    if (newPhase === 'aftermath' || newPhase === 'resolved') {
      this._removeEventEffects(eventId);
    }
  }

  /**
   * Call every frame in the render loop to animate event particles.
   *
   * @param {number} deltaTime - Seconds since last frame
   */
  update(deltaTime) {
    for (const [_eventId, effect] of this._activeEffects) {
      if (effect.particles) {
        // Gentle upward drift for particles (smoke, sparks, etc.)
        const positions = effect.particles.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          positions.setY(
            i,
            positions.getY(i) + deltaTime * 0.5
          );
          // Reset particles that drift too high
          if (positions.getY(i) > 10) {
            positions.setY(i, 0);
          }
        }
        positions.needsUpdate = true;
      }
    }
  }

  // ── Private ──────────────────────────────────────────────

  /**
   * Apply atmosphere deltas to the scene fog and lighting.
   *
   * @param {Object} atmosphere
   */
  _applyAtmosphere(atmosphere) {
    // Fog density
    if (this._fog instanceof THREE.FogExp2) {
      const newDensity = this._baseFogDensity + (atmosphere.fogDelta || 0);
      this._fog.density = Math.max(0, Math.min(0.05, newDensity));
    }

    // Main light intensity
    if (this._mainLight) {
      const newIntensity = this._baseLightIntensity + (atmosphere.lightDelta || 0);
      this._mainLight.intensity = Math.max(0.1, Math.min(2.0, newIntensity));
    }
  }

  /**
   * Create a particle system at the event location.
   *
   * @param {{ x: number, z: number }} location
   * @param {number} radius
   * @param {number} particleRateDelta
   * @returns {THREE.Points}
   */
  _createEventParticles(location, radius, particleRateDelta) {
    const count = Math.max(0, Math.round(particleRateDelta));
    if (count === 0) return null;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      positions[i * 3]     = location.x + Math.cos(angle) * r; // x
      positions[i * 3 + 1] = Math.random() * 5;                // y (0-5 units high)
      positions[i * 3 + 2] = location.z + Math.sin(angle) * r; // z
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xCCCCCC,
      size: 0.3,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    this._scene.add(points);
    return points;
  }

  /**
   * Remove all Three.js objects for an event.
   *
   * @param {string} eventId
   */
  _removeEventEffects(eventId) {
    const effect = this._activeEffects.get(eventId);
    if (!effect) return;

    if (effect.particles) {
      this._scene.remove(effect.particles);
      effect.particles.geometry.dispose();
      effect.particles.material.dispose();
    }

    this._activeEffects.delete(eventId);

    // Reset atmosphere to base values
    if (this._fog instanceof THREE.FogExp2) {
      this._fog.density = this._baseFogDensity;
    }
    if (this._mainLight) {
      this._mainLight.intensity = this._baseLightIntensity;
    }

    console.log(`[EventRenderer] Effects removed: ${eventId}`);
  }
}
```

---

## EV-IMPL-12. Barrel Export (`index.js`)

```js
// src/server/events/index.js

export { EventDescriptor, VALID_CATEGORIES, LIFECYCLE_PHASES } from './descriptor.js';
export { EFFECT_TEMPLATES, buildEffects } from './effects.js';
export { generateEventFromFlip } from './generator.js';
export { getEventStore } from './store.js';
export { advanceLifecycle, getLifecycleIntensity, computePhaseDurations } from './lifecycle.js';
export { startPropagation, propagationTick } from './propagation.js';
export { forestiereNewsTick } from './forestiere.js';
export { registerEvent, preemptEvent, getActiveEvents, checkSuppressedQueue } from './manager.js';
export { eventTick } from './tick.js';
```

---

## EV-IMPL-13. Integration with Physics Bridge

The event tick runs inside the physics bridge's tick cycle, after all 6 physics phases complete.

```js
// In src/server/physics/physics-bridge.js _runTick():

import { eventTick } from '../events/tick.js';

// After physicsTick() returns:
const eventResult = await eventTick(this._tickCount, (msg) => {
  // Forward to WebSocket broadcast
  if (this._onEvent) this._onEvent(msg);
});

// Include in tick log:
console.log(
  `[Physics] Tick ${this._tickCount}: ... ` +
  `events_advanced=${eventResult.eventsAdvanced} ` +
  `propagation=${eventResult.propagationUpdates} ` +
  `forestiere=${eventResult.forestiereInjected}`
);
```

---

## EV-IMPL-14. Express Health Endpoints

```js
// In src/server/index.js:

import { getActiveEvents } from './events/manager.js';
import { getEventStore } from './events/store.js';

// Active events
app.get('/api/events/active', (req, res) => {
  res.json(getActiveEvents());
});

// All events (admin/debug)
app.get('/api/events/all', (req, res) => {
  const store = getEventStore();
  res.json(store.getAll().map(e => e.toJSON ? e.toJSON() : e));
});

// Event by ID
app.get('/api/events/:eventId', (req, res) => {
  const store = getEventStore();
  const event = store.get(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event.toJSON ? event.toJSON() : event);
});
```

---

## EV-IMPL-15. Error Handling Strategy

Every event system function catches its own errors and logs them without crashing the server.

- **RSS fetch failure**: Warn and continue. No Forestiere news that day.
- **Claude API failure**: Warn and return null. No translation, no injection.
- **Graph query failure in propagation**: The propagation queue entry remains; it will be retried on the next tick.
- **Event store disk dump failure**: Non-fatal. Events exist in memory. Next dump will include them.
- **Three.js effect failure (client)**: Catches and logs. The 3D world continues rendering without the event's atmosphere changes.

The event system is a narrative overlay. Its failure degrades storytelling quality but does not affect the core 3D experience or citizen conversations.
