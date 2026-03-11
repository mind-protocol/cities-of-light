# IMPLEMENTATION: narrative/graph -- Code-Level Specification

Concrete implementation of the FalkorDB graph module for Venezia. Every function signature, npm package, environment variable, Cypher query string, and error handling pattern needed to build the graph layer in Node.js.

---

## File Structure

```
cities-of-light/
  src/
    server/
      graph/
        client.js            ← FalkorDB connection, pooling, error recovery
        schema.js            ← Schema creation (idempotent), index definitions
        seed.js              ← Airtable-to-graph seeding pipeline
        queries.js           ← Read-only query functions for all consumers
        mutations.js         ← Write operations: beliefs, narratives, edges
        maintenance.js       ← Pruning, health checks, stats
        constants.js         ← Graph-related constants (IDs, thresholds)
        index.js             ← Public API barrel export
  scripts/
    seed-graph.js            ← CLI entry point for seeding
    graph-health.js          ← CLI health check / stats dump
```

---

## Dependencies

```json
{
  "falkordb": "^0.5.0",
  "airtable": "^0.12.2",
  "slugify": "^1.6.6",
  "dotenv": "^17.2.4"
}
```

Install with: `npm install falkordb airtable slugify`

The `falkordb` npm package wraps the FalkorDB Redis-compatible protocol. It provides `FalkorDB.connect()` which returns a client that can select a named graph and execute Cypher queries. This replaces the older pattern of using raw `redis` or `ioredis` with `GRAPH.QUERY` commands.

---

## Environment Variables

```bash
# Required
FALKORDB_HOST=localhost          # FalkorDB host (Docker default)
FALKORDB_PORT=6379               # FalkorDB port (Redis-compatible)
FALKORDB_GRAPH=venezia           # Graph name (separate from blood_ledger)

# Optional
FALKORDB_PASSWORD=               # If FalkorDB requires auth
FALKORDB_MAX_RETRIES=3           # Connection retry count
FALKORDB_RETRY_DELAY_MS=1000     # Delay between retries

# Seeding
AIRTABLE_API_KEY=pat...          # Airtable PAT for Serenissima base
AIRTABLE_BASE_ID=appkLmnbsEFAZM5rB  # Serenissima Airtable base
```

---

## G-IMPL-1. FalkorDB Client (`client.js`)

### Connection Setup

```js
// src/server/graph/client.js

import { FalkorDB } from 'falkordb';
import { EventEmitter } from 'events';

const DEFAULTS = {
  host: process.env.FALKORDB_HOST || 'localhost',
  port: parseInt(process.env.FALKORDB_PORT || '6379', 10),
  graph: process.env.FALKORDB_GRAPH || 'venezia',
  password: process.env.FALKORDB_PASSWORD || undefined,
  maxRetries: parseInt(process.env.FALKORDB_MAX_RETRIES || '3', 10),
  retryDelayMs: parseInt(process.env.FALKORDB_RETRY_DELAY_MS || '1000', 10),
};

/**
 * @typedef {Object} GraphClientOptions
 * @property {string} [host]
 * @property {number} [port]
 * @property {string} [graph]
 * @property {string} [password]
 * @property {number} [maxRetries]
 * @property {number} [retryDelayMs]
 */

class VeneziaGraphClient extends EventEmitter {
  /** @type {import('falkordb').FalkorDB | null} */
  _db = null;

  /** @type {import('falkordb').Graph | null} */
  _graph = null;

  /** @type {boolean} */
  _connected = false;

  /** @type {GraphClientOptions} */
  _opts;

  /** @type {number} */
  _queryCount = 0;

  /** @type {number} */
  _errorCount = 0;

  /**
   * @param {GraphClientOptions} [opts]
   */
  constructor(opts = {}) {
    super();
    this._opts = { ...DEFAULTS, ...opts };
  }

  /**
   * Connect to FalkorDB and select the venezia graph.
   * Retries on failure up to maxRetries times.
   * @returns {Promise<void>}
   */
  async connect() {
    const { host, port, password, graph, maxRetries, retryDelayMs } = this._opts;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this._db = await FalkorDB.connect({
          socket: { host, port },
          password: password || undefined,
        });

        this._graph = this._db.selectGraph(graph);
        this._connected = true;
        this._errorCount = 0;

        this.emit('connected', { host, port, graph });
        console.log(`[Graph] Connected to ${host}:${port}/${graph}`);
        return;

      } catch (err) {
        console.error(
          `[Graph] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`
        );

        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, retryDelayMs * attempt));
        }
      }
    }

    throw new Error(
      `[Graph] Failed to connect to FalkorDB at ${host}:${port} after ${maxRetries} attempts`
    );
  }

  /**
   * Execute a Cypher query with parameters.
   * Returns array of result row objects.
   *
   * @param {string} cypher - Cypher query string
   * @param {Record<string, any>} [params] - Query parameters
   * @returns {Promise<Array<Record<string, any>>>}
   */
  async query(cypher, params = {}) {
    if (!this._connected || !this._graph) {
      throw new Error('[Graph] Not connected. Call connect() first.');
    }

    this._queryCount++;

    try {
      const result = await this._graph.query(cypher, { params });
      return this._parseResult(result);

    } catch (err) {
      this._errorCount++;
      this.emit('queryError', { cypher, params, error: err.message });

      // Detect connection loss and attempt reconnect
      if (this._isConnectionError(err)) {
        console.warn('[Graph] Connection lost. Attempting reconnect...');
        this._connected = false;
        await this.connect();
        // Retry once after reconnect
        const result = await this._graph.query(cypher, { params });
        return this._parseResult(result);
      }

      throw err;
    }
  }

  /**
   * Execute a read-only query (RO). Same as query() but uses
   * GRAPH.RO_QUERY under the hood for replica-safe reads.
   *
   * @param {string} cypher
   * @param {Record<string, any>} [params]
   * @returns {Promise<Array<Record<string, any>>>}
   */
  async roQuery(cypher, params = {}) {
    if (!this._connected || !this._graph) {
      throw new Error('[Graph] Not connected. Call connect() first.');
    }

    this._queryCount++;

    try {
      const result = await this._graph.roQuery(cypher, { params });
      return this._parseResult(result);
    } catch (err) {
      this._errorCount++;
      throw err;
    }
  }

  /**
   * Close the connection.
   * @returns {Promise<void>}
   */
  async close() {
    if (this._db) {
      await this._db.close();
      this._db = null;
      this._graph = null;
      this._connected = false;
      this.emit('disconnected');
      console.log('[Graph] Disconnected.');
    }
  }

  /**
   * @returns {{ connected: boolean, queryCount: number, errorCount: number, graph: string }}
   */
  stats() {
    return {
      connected: this._connected,
      queryCount: this._queryCount,
      errorCount: this._errorCount,
      graph: this._opts.graph,
    };
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Parse FalkorDB ResultSet into plain JS objects.
   * FalkorDB returns a ResultSet with .data (array of objects)
   * or header + rows depending on the driver version.
   *
   * @param {any} result
   * @returns {Array<Record<string, any>>}
   */
  _parseResult(result) {
    if (!result || !result.data) {
      return [];
    }
    // result.data is an array of row objects with column names as keys
    return result.data.map(row => ({ ...row }));
  }

  /**
   * @param {Error} err
   * @returns {boolean}
   */
  _isConnectionError(err) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('socket closed') ||
      msg.includes('connection is closed')
    );
  }
}

// ── Singleton ─────────────────────────────────────────────────

let _instance = null;

/**
 * Get or create the singleton graph client.
 * Call connect() before using.
 *
 * @param {GraphClientOptions} [opts]
 * @returns {VeneziaGraphClient}
 */
export function getGraphClient(opts) {
  if (!_instance) {
    _instance = new VeneziaGraphClient(opts);
  }
  return _instance;
}

/**
 * Convenience: get client and ensure connected.
 *
 * @param {GraphClientOptions} [opts]
 * @returns {Promise<VeneziaGraphClient>}
 */
export async function getConnectedClient(opts) {
  const client = getGraphClient(opts);
  if (!client._connected) {
    await client.connect();
  }
  return client;
}

export { VeneziaGraphClient };
export default getGraphClient;
```

### Blood Ledger Comparison

The Blood Ledger engine uses `GraphQueries` (Python, `engine/physics/graph/graph_queries.py`) which wraps a database adapter selected via `engine/infrastructure/database`. The adapter handles FalkorDB vs Neo4j. Venezia simplifies this to FalkorDB-only because there is no Neo4j requirement, and uses Node.js instead of Python. The singleton pattern replaces Blood Ledger's per-instance construction pattern where each consumer creates its own `GraphQueries(graph_name=..., host=..., port=...)`.

---

## G-IMPL-2. Schema Creation (`schema.js`)

```js
// src/server/graph/schema.js

import { getConnectedClient } from './client.js';

/**
 * All index creation statements. FalkorDB CREATE INDEX is idempotent --
 * running it on an existing index is a no-op with a warning, not an error.
 *
 * @type {string[]}
 */
const INDEX_STATEMENTS = [
  // Character indices
  'CREATE INDEX FOR (c:Character) ON (c.id)',
  'CREATE INDEX FOR (c:Character) ON (c.name)',
  'CREATE INDEX FOR (c:Character) ON (c.district)',
  'CREATE INDEX FOR (c:Character) ON (c.class)',

  // Narrative indices
  'CREATE INDEX FOR (n:Narrative) ON (n.id)',
  'CREATE INDEX FOR (n:Narrative) ON (n.type)',
  'CREATE INDEX FOR (n:Narrative) ON (n.source)',

  // Place indices
  'CREATE INDEX FOR (p:Place) ON (p.id)',
  'CREATE INDEX FOR (p:Place) ON (p.district)',

  // Moment indices
  'CREATE INDEX FOR (m:Moment) ON (m.id)',
  'CREATE INDEX FOR (m:Moment) ON (m.flipped)',
  'CREATE INDEX FOR (m:Moment) ON (m.category)',
];

/**
 * Create all indices for the venezia graph.
 * Safe to call multiple times. Each CREATE INDEX is idempotent.
 *
 * @returns {Promise<{ created: number, errors: string[] }>}
 */
export async function createSchema() {
  const client = await getConnectedClient();
  let created = 0;
  const errors = [];

  for (const stmt of INDEX_STATEMENTS) {
    try {
      await client.query(stmt);
      created++;
    } catch (err) {
      // FalkorDB returns an error if index already exists in some versions.
      // Treat "already indexed" as success.
      if (err.message && err.message.includes('already indexed')) {
        created++;
      } else {
        errors.push(`${stmt}: ${err.message}`);
        console.error(`[Schema] Failed: ${stmt} -- ${err.message}`);
      }
    }
  }

  console.log(`[Schema] ${created}/${INDEX_STATEMENTS.length} indices ready. Errors: ${errors.length}`);
  return { created, errors };
}

/**
 * Drop the entire graph and recreate schema.
 * DESTRUCTIVE -- use only for development reset.
 *
 * @returns {Promise<void>}
 */
export async function resetGraph() {
  const client = await getConnectedClient();
  try {
    await client.query('MATCH (n) DETACH DELETE n');
    console.log('[Schema] All nodes and edges deleted.');
  } catch (err) {
    // Graph may not exist yet -- that is fine.
    console.warn(`[Schema] Reset warning: ${err.message}`);
  }
  await createSchema();
}

/**
 * Return node and edge counts for health monitoring.
 *
 * @returns {Promise<{ characters: number, narratives: number, places: number, moments: number, edges: number }>}
 */
export async function getGraphStats() {
  const client = await getConnectedClient();

  const [characters] = await client.roQuery(
    'MATCH (c:Character) RETURN count(c) AS count'
  );
  const [narratives] = await client.roQuery(
    'MATCH (n:Narrative) RETURN count(n) AS count'
  );
  const [places] = await client.roQuery(
    'MATCH (p:Place) RETURN count(p) AS count'
  );
  const [moments] = await client.roQuery(
    'MATCH (m:Moment) RETURN count(m) AS count'
  );
  const [edges] = await client.roQuery(
    'MATCH ()-[r]->() RETURN count(r) AS count'
  );

  return {
    characters: characters?.count ?? 0,
    narratives: narratives?.count ?? 0,
    places: places?.count ?? 0,
    moments: moments?.count ?? 0,
    edges: edges?.count ?? 0,
  };
}
```

---

## G-IMPL-3. Seeding Pipeline (`seed.js`)

The seeding script runs once to populate the graph from Airtable. After seeding, the graph evolves through physics only. Re-seeding is safe because all node creation uses MERGE (upsert).

```js
// src/server/graph/seed.js

import Airtable from 'airtable';
import slugify from 'slugify';
import { getConnectedClient } from './client.js';
import { createSchema } from './schema.js';
import {
  CLASS_WEIGHTS,
  CATEGORY_NARRATIVE_TYPES,
  BASE_THRESHOLDS,
} from './constants.js';

/**
 * @typedef {Object} SeedStats
 * @property {number} characters
 * @property {number} narratives
 * @property {number} places
 * @property {number} moments
 * @property {number} believesEdges
 * @property {number} tensionEdges
 * @property {number} feedsEdges
 * @property {number} atEdges
 */

/**
 * Seed the venezia graph from Airtable Serenissima data.
 *
 * @param {Object} [opts]
 * @param {string} [opts.apiKey]   - Airtable PAT (defaults to env)
 * @param {string} [opts.baseId]   - Airtable base ID (defaults to env)
 * @returns {Promise<SeedStats>}
 */
export async function seedVeniceGraph(opts = {}) {
  const apiKey = opts.apiKey || process.env.AIRTABLE_API_KEY;
  const baseId = opts.baseId || process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error('[Seed] AIRTABLE_API_KEY and AIRTABLE_BASE_ID required');
  }

  const client = await getConnectedClient();
  const base = new Airtable({ apiKey }).base(baseId);

  const stats = {
    characters: 0,
    narratives: 0,
    places: 0,
    moments: 0,
    believesEdges: 0,
    tensionEdges: 0,
    feedsEdges: 0,
    atEdges: 0,
  };

  // ── Step 0: Schema ──────────────────────────────────────
  await createSchema();

  // ── Step 1: Fetch Airtable data ─────────────────────────
  console.log('[Seed] Fetching Airtable data...');

  const citizens = await fetchAllRecords(base, 'CITIZENS');
  const relationships = await fetchAllRecords(base, 'RELATIONSHIPS');

  console.log(`[Seed] Fetched ${citizens.length} citizens, ${relationships.length} relationships`);

  // ── Step 2: Seed Place nodes ────────────────────────────
  const districts = extractDistrictsFromCitizens(citizens);

  for (const district of districts) {
    const placeId = 'place_' + makeSlug(district.name);
    await client.query(
      `MERGE (p:Place {id: $placeId})
       SET p.name       = $name,
           p.district   = $districtName,
           p.position_x = $posX,
           p.position_z = $posZ`,
      {
        placeId,
        name: district.name,
        districtName: district.name,
        posX: district.posX,
        posZ: district.posZ,
      }
    );
    stats.places++;
  }

  console.log(`[Seed] ${stats.places} Place nodes created`);

  // ── Step 3: Seed Character nodes ────────────────────────
  for (const citizen of citizens) {
    const charId = 'char_' + makeSlug(citizen.fields.Username || citizen.fields.Name);
    const weight = computeInitialWeight(citizen);

    await client.query(
      `MERGE (c:Character {id: $charId})
       SET c.name     = $name,
           c.energy   = 0.5,
           c.weight   = $weight,
           c.class    = $socialClass,
           c.mood     = 'neutral',
           c.district = $district,
           c.ducats   = $ducats,
           c.alive    = true`,
      {
        charId,
        name: citizen.fields.Name || 'Unknown',
        weight,
        socialClass: citizen.fields.SocialClass || 'Popolani',
        district: citizen.fields.HomeDistrict || 'Rialto',
        ducats: citizen.fields.Ducats || 0,
      }
    );
    stats.characters++;

    // AT edge: character -> home district
    const homePlaceId = 'place_' + makeSlug(citizen.fields.HomeDistrict || 'Rialto');
    await client.query(
      `MATCH (c:Character {id: $charId}), (p:Place {id: $placeId})
       MERGE (c)-[:AT {since: $now}]->(p)`,
      { charId, placeId: homePlaceId, now: new Date().toISOString() }
    );
    stats.atEdges++;
  }

  console.log(`[Seed] ${stats.characters} Character nodes created`);

  // ── Step 4: Seed Narrative nodes from grievances ────────
  for (const citizen of citizens) {
    const charId = 'char_' + makeSlug(citizen.fields.Username || citizen.fields.Name);
    const grievances = extractGrievances(citizen, relationships);

    for (const grievance of grievances) {
      const narrId = generateNarrativeId(grievance, charId);

      await client.query(
        `MERGE (n:Narrative {id: $narrId})
         SET n.content = $content,
             n.truth   = $truth,
             n.energy  = 0.3,
             n.weight  = 0.5,
             n.type    = $type,
             n.source  = 'seed'`,
        {
          narrId,
          content: grievance.description,
          truth: grievance.truthValue,
          type: grievance.type,
        }
      );
      stats.narratives++;

      // BELIEVES edge
      await client.query(
        `MATCH (c:Character {id: $charId}), (n:Narrative {id: $narrId})
         MERGE (c)-[:BELIEVES {
           confidence: $confidence,
           source: 'seed',
           heard_at: $now
         }]->(n)`,
        {
          charId,
          narrId,
          confidence: grievance.initialConfidence,
          now: new Date().toISOString(),
        }
      );
      stats.believesEdges++;
    }
  }

  console.log(`[Seed] ${stats.narratives} Narrative nodes, ${stats.believesEdges} BELIEVES edges`);

  // ── Step 5: Seed TENSION edges ──────────────────────────
  stats.tensionEdges = await seedTensions(client);
  console.log(`[Seed] ${stats.tensionEdges} TENSION edges`);

  // ── Step 6: Seed Moment nodes ───────────────────────────
  const momentResult = await seedMoments(client);
  stats.moments = momentResult.moments;
  stats.feedsEdges = momentResult.feeds;
  console.log(`[Seed] ${stats.moments} Moment nodes, ${stats.feedsEdges} FEEDS edges`);

  console.log('[Seed] Complete.', stats);
  return stats;
}


// ── Helpers ─────────────────────────────────────────────────

/**
 * Fetch all records from an Airtable table with automatic pagination.
 *
 * @param {import('airtable').Base} base
 * @param {string} tableName
 * @returns {Promise<Array<import('airtable').Record>>}
 */
async function fetchAllRecords(base, tableName) {
  const records = [];
  await base(tableName)
    .select({ pageSize: 100 })
    .eachPage((page, next) => {
      records.push(...page);
      next();
    });
  return records;
}

/**
 * @param {string} text
 * @returns {string}
 */
function makeSlug(text) {
  return slugify(text || 'unknown', { lower: true, strict: true });
}

/**
 * Compute initial narrative weight for a citizen.
 * Mirrors ALGORITHM_Graph.md G2 compute_initial_weight.
 *
 * @param {import('airtable').Record} citizen
 * @returns {number}
 */
function computeInitialWeight(citizen) {
  let base = 1.0;

  const socialClass = citizen.fields.SocialClass || 'Popolani';
  base *= CLASS_WEIGHTS[socialClass] ?? 1.0;

  const ducats = citizen.fields.Ducats || 0;
  if (ducats > 0) {
    base *= 1.0 + Math.log10(ducats) / 10.0;
  }

  return Math.max(0.3, Math.min(3.0, base));
}

/**
 * Extract distinct districts from citizen home districts.
 * Assigns approximate 3D positions using a predefined Venice layout.
 *
 * @param {Array} citizens
 * @returns {Array<{ name: string, posX: number, posZ: number }>}
 */
function extractDistrictsFromCitizens(citizens) {
  // Predefined Venice district positions (world units).
  // Origin (0,0) is Rialto bridge. +X is east, +Z is south.
  const DISTRICT_POSITIONS = {
    'Rialto':      { posX: 0,    posZ: 0 },
    'San Marco':   { posX: 50,   posZ: 40 },
    'San_Marco':   { posX: 50,   posZ: 40 },
    'Dorsoduro':   { posX: -30,  posZ: 60 },
    'Cannaregio':  { posX: -20,  posZ: -50 },
    'Castello':    { posX: 80,   posZ: -10 },
    'San Polo':    { posX: -40,  posZ: 10 },
    'San_Polo':    { posX: -40,  posZ: 10 },
    'Santa Croce': { posX: -60,  posZ: -20 },
    'Santa_Croce': { posX: -60,  posZ: -20 },
    'Giudecca':    { posX: -10,  posZ: 100 },
  };

  const seen = new Set();
  const districts = [];

  for (const citizen of citizens) {
    const name = citizen.fields.HomeDistrict;
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const pos = DISTRICT_POSITIONS[name] || { posX: 0, posZ: 0 };
    districts.push({ name, ...pos });
  }

  return districts;
}

/**
 * Extract grievances from a citizen's data and relationships.
 * Mirrors ALGORITHM_Graph.md G2 extract_grievances.
 *
 * @param {import('airtable').Record} citizen
 * @param {Array} allRelationships
 * @returns {Array<{ description: string, type: string, truthValue: number, initialConfidence: number }>}
 */
function extractGrievances(citizen, allRelationships) {
  const grievances = [];
  const citizenId = citizen.id;

  // Flaw-based grievance
  if (citizen.fields.Flaw) {
    grievances.push({
      description: inferGrievanceFromFlaw(
        citizen.fields.Flaw,
        citizen.fields.SocialClass
      ),
      type: 'grievance',
      truthValue: 0.5,
      initialConfidence: 0.7,
    });
  }

  // Relationship-derived grievances (low trust)
  const citizenRels = allRelationships.filter(
    r =>
      r.fields.Citizen1 === citizenId ||
      r.fields.Citizen2 === citizenId
  );

  for (const rel of citizenRels) {
    if ((rel.fields.Trust ?? 50) < 20) {
      const otherField =
        rel.fields.Citizen1 === citizenId
          ? rel.fields.Citizen2Name
          : rel.fields.Citizen1Name;
      grievances.push({
        description: `distrust toward ${otherField || 'a fellow citizen'}`,
        type: 'grudge',
        truthValue: 0.8,
        initialConfidence: 0.9,
      });
    }
  }

  // Class-based systemic grievances
  const socialClass = citizen.fields.SocialClass || 'Popolani';
  const ducats = citizen.fields.Ducats || 0;

  if (['Popolani', 'Facchini'].includes(socialClass) && ducats < 50) {
    grievances.push({
      description: 'the wealthy exploit the poor of Venice',
      type: 'grievance',
      truthValue: 0.6,
      initialConfidence: 0.6,
    });
  }

  if (socialClass === 'Nobili') {
    grievances.push({
      description: 'the common people do not understand the burden of governance',
      type: 'belief',
      truthValue: 0.3,
      initialConfidence: 0.5,
    });
  }

  return grievances;
}

/**
 * @param {string} flaw
 * @param {string} socialClass
 * @returns {string}
 */
function inferGrievanceFromFlaw(flaw, socialClass) {
  const lowerFlaw = (flaw || '').toLowerCase();
  if (lowerFlaw.includes('greed') || lowerFlaw.includes('avarice')) {
    return 'the taxes imposed by the Signoria are unjust';
  }
  if (lowerFlaw.includes('pride') || lowerFlaw.includes('arrogance')) {
    return `the ${socialClass === 'Nobili' ? 'merchants' : 'nobles'} show no respect`;
  }
  if (lowerFlaw.includes('wrath') || lowerFlaw.includes('anger')) {
    return 'someone has wronged me and will answer for it';
  }
  if (lowerFlaw.includes('jealous') || lowerFlaw.includes('envy')) {
    return 'others have what they do not deserve';
  }
  // Default
  return `dissatisfaction with the state of affairs in Venice`;
}

/**
 * @param {{ description: string, type: string }} grievance
 * @param {string} charId
 * @returns {string}
 */
function generateNarrativeId(grievance, charId) {
  const typeSlug = makeSlug(grievance.type);
  const contentHash = simpleHash(grievance.description);
  return `narr_${typeSlug}_${charId}_${contentHash}`;
}

/**
 * @param {string} str
 * @returns {string}
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
}

/**
 * Seed TENSION edges between narratives from opposing social classes.
 * Mirrors ALGORITHM_Graph.md G2 seed_initial_tensions.
 *
 * @param {VeneziaGraphClient} client
 * @returns {Promise<number>}
 */
async function seedTensions(client) {
  let count = 0;

  // Strategy 1: Class-based contradictions
  const nobiliNarr = await client.roQuery(
    `MATCH (c:Character {class: 'Nobili'})-[:BELIEVES]->(n:Narrative)
     RETURN DISTINCT n.id AS id, n.content AS content`
  );

  const workerNarr = await client.roQuery(
    `MATCH (c:Character)-[:BELIEVES]->(n:Narrative)
     WHERE c.class IN ['Popolani', 'Facchini']
     RETURN DISTINCT n.id AS id, n.content AS content`
  );

  for (const n1 of nobiliNarr) {
    for (const n2 of workerNarr) {
      if (n1.id === n2.id) continue;
      if (topicsOverlap(n1.content, n2.content)) {
        await client.query(
          `MATCH (n1:Narrative {id: $id1}), (n2:Narrative {id: $id2})
           MERGE (n1)-[:TENSION {strength: 0.3}]-(n2)`,
          { id1: n1.id, id2: n2.id }
        );
        count++;
      }
    }
  }

  // Strategy 2: District-level within-district contradictions
  const districtRows = await client.roQuery(
    `MATCH (p:Place) RETURN DISTINCT p.district AS d`
  );

  for (const row of districtRows) {
    const distNarr = await client.roQuery(
      `MATCH (c:Character {district: $dist})-[:BELIEVES]->(n:Narrative)
       RETURN n.id AS id, n.content AS content, c.class AS believerClass`,
      { dist: row.d }
    );

    // Find pairs with different believer classes and overlapping topics
    for (let i = 0; i < distNarr.length; i++) {
      for (let j = i + 1; j < distNarr.length; j++) {
        if (
          distNarr[i].believerClass !== distNarr[j].believerClass &&
          distNarr[i].id !== distNarr[j].id &&
          topicsOverlap(distNarr[i].content, distNarr[j].content)
        ) {
          await client.query(
            `MATCH (n1:Narrative {id: $id1}), (n2:Narrative {id: $id2})
             MERGE (n1)-[:TENSION {strength: 0.2}]-(n2)`,
            { id1: distNarr[i].id, id2: distNarr[j].id }
          );
          count++;
        }
      }
    }
  }

  return count;
}

/**
 * Simple topic overlap detection using keyword matching.
 * Returns true if two narrative descriptions share governance/wealth/labor keywords.
 *
 * @param {string} contentA
 * @param {string} contentB
 * @returns {boolean}
 */
function topicsOverlap(contentA, contentB) {
  const TOPIC_CLUSTERS = [
    ['tax', 'tithe', 'ducat', 'wealth', 'poor', 'rich', 'exploit', 'unjust'],
    ['govern', 'signoria', 'council', 'law', 'rule', 'noble', 'power', 'burden'],
    ['guild', 'trade', 'merchant', 'labor', 'work', 'craft', 'market'],
    ['respect', 'honor', 'dignity', 'pride', 'arrogance', 'trust'],
  ];

  const a = (contentA || '').toLowerCase();
  const b = (contentB || '').toLowerCase();

  for (const cluster of TOPIC_CLUSTERS) {
    const aHit = cluster.some(kw => a.includes(kw));
    const bHit = cluster.some(kw => b.includes(kw));
    if (aHit && bHit) return true;
  }

  return false;
}

/**
 * Seed initial Moment nodes from observed tension clusters.
 * Mirrors ALGORITHM_Graph.md G2 seed_initial_moments.
 *
 * @param {VeneziaGraphClient} client
 * @returns {Promise<{ moments: number, feeds: number }>}
 */
async function seedMoments(client) {
  let momentCount = 0;
  let feedCount = 0;

  const districtRows = await client.roQuery(
    `MATCH (p:Place) RETURN DISTINCT p.district AS d`
  );

  for (const row of districtRows) {
    const tensions = await client.roQuery(
      `MATCH (c1:Character {district: $dist})-[:BELIEVES]->(n1:Narrative)
             -[t:TENSION]-(n2:Narrative)<-[:BELIEVES]-(c2:Character {district: $dist})
       RETURN count(DISTINCT t) AS tensionCount,
              collect(DISTINCT n1.type) AS types,
              sum(t.strength) AS totalStrength`,
      { dist: row.d }
    );

    if (!tensions[0] || tensions[0].tensionCount === 0) continue;

    const { types, totalStrength } = tensions[0];
    const categories = determineMomentCategories(types, totalStrength);

    for (const category of categories) {
      const momentId = `mom_${makeSlug(row.d)}_${category}_${momentCount}`;
      const threshold = computeMomentThreshold(category, totalStrength);

      await client.query(
        `MERGE (m:Moment {id: $momentId})
         SET m.description = $description,
             m.threshold   = $threshold,
             m.flipped     = false,
             m.category    = $category,
             m.energy      = 0.0,
             m.weight      = 1.0`,
        {
          momentId,
          description: generateMomentDescription(category, row.d),
          threshold,
          category,
        }
      );
      momentCount++;

      // Connect feeding narratives
      const relevantTypes = CATEGORY_NARRATIVE_TYPES[category] || ['grievance', 'belief'];
      const feedingNarr = await client.roQuery(
        `MATCH (n:Narrative)<-[:BELIEVES]-(c:Character {district: $dist})
         WHERE n.type IN $relevantTypes
         RETURN DISTINCT n.id AS id
         LIMIT 5`,
        { dist: row.d, relevantTypes }
      );

      for (const narr of feedingNarr) {
        await client.query(
          `MATCH (n:Narrative {id: $narrId}), (m:Moment {id: $momentId})
           MERGE (n)-[:FEEDS {factor: 0.5}]->(m)`,
          { narrId: narr.id, momentId }
        );
        feedCount++;
      }
    }
  }

  return { moments: momentCount, feeds: feedCount };
}

/**
 * @param {string[]} types
 * @param {number} totalStrength
 * @returns {string[]}
 */
function determineMomentCategories(types, totalStrength) {
  const categories = [];

  if (types.includes('debt') || types.includes('grievance')) {
    categories.push('economic_crisis');
  }
  if (types.includes('grudge') && types.includes('grievance')) {
    categories.push('political_uprising');
  }
  if (types.includes('alliance')) {
    categories.push('celebration');
  }
  if (categories.length === 0) {
    categories.push('guild_dispute');
  }

  // At most 2 moments per district at seeding
  return categories.slice(0, 2);
}

/**
 * @param {string} category
 * @param {number} existingTensionStrength
 * @returns {number}
 */
function computeMomentThreshold(category, existingTensionStrength) {
  let base = BASE_THRESHOLDS[category] ?? 3.0;

  if (existingTensionStrength > 2.0) {
    base *= 1.0 + (existingTensionStrength - 2.0) * 0.2;
  }

  return Math.max(2.0, Math.min(6.0, base));
}

/**
 * @param {string} category
 * @param {string} district
 * @returns {string}
 */
function generateMomentDescription(category, district) {
  const TEMPLATES = {
    economic_crisis: `An economic crisis builds in ${district}. Merchants close shops; debts go unpaid.`,
    political_uprising: `Political unrest simmers in ${district}. The people grow restless.`,
    celebration: `A celebration is brewing in ${district}. Spirits lift.`,
    personal_tragedy: `A personal tragedy unfolds quietly in ${district}.`,
    guild_dispute: `The guilds of ${district} turn against each other over trade rights.`,
    trade_disruption: `Trade routes through ${district} face disruption.`,
  };

  return TEMPLATES[category] || `Something stirs in ${district}.`;
}
```

### CLI Entry Point (`scripts/seed-graph.js`)

```js
#!/usr/bin/env node
// scripts/seed-graph.js

import 'dotenv/config';
import { seedVeniceGraph } from '../src/server/graph/seed.js';
import { getGraphStats } from '../src/server/graph/schema.js';
import { getGraphClient } from '../src/server/graph/client.js';

async function main() {
  const command = process.argv[2] || 'seed';

  try {
    if (command === 'seed') {
      console.log('Seeding Venice graph from Airtable...');
      const stats = await seedVeniceGraph();
      console.log('Seed complete:', JSON.stringify(stats, null, 2));

    } else if (command === 'stats') {
      const stats = await getGraphStats();
      console.log('Graph stats:', JSON.stringify(stats, null, 2));

    } else if (command === 'reset') {
      const { resetGraph } = await import('../src/server/graph/schema.js');
      console.log('WARNING: This will delete all graph data.');
      await resetGraph();
      console.log('Graph reset and schema recreated.');

    } else {
      console.log('Usage: node scripts/seed-graph.js [seed|stats|reset]');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    const client = getGraphClient();
    await client.close();
  }
}

main();
```

---

## G-IMPL-4. Query Functions (`queries.js`)

Read-only functions consumed by citizen-router.js, physics-bridge.js, and the event system.

```js
// src/server/graph/queries.js

import { getConnectedClient } from './client.js';

/**
 * Get top active beliefs for a citizen, ranked by salience.
 * Consumed by: citizen-router.js (conversation context assembly).
 *
 * @param {string} citizenId - Character node ID (e.g., "char_elena_rossi")
 * @param {Object} [opts]
 * @param {number} [opts.minEnergy=0.05]
 * @param {number} [opts.limit=5]
 * @returns {Promise<Array<{ narrativeId: string, content: string, type: string, energy: number, confidence: number, salience: number }>>}
 */
export async function getCitizenBeliefs(citizenId, opts = {}) {
  const minEnergy = opts.minEnergy ?? 0.05;
  const limit = opts.limit ?? 5;
  const client = await getConnectedClient();

  const rows = await client.roQuery(
    `MATCH (c:Character {id: $citizenId})-[b:BELIEVES]->(n:Narrative)
     WHERE n.energy > $minEnergy
     RETURN n.id          AS narrativeId,
            n.content     AS content,
            n.type        AS type,
            n.energy      AS energy,
            b.confidence  AS confidence,
            n.energy * b.confidence AS salience
     ORDER BY salience DESC
     LIMIT $limit`,
    { citizenId, minEnergy, limit }
  );

  return rows;
}

/**
 * Get hottest tensions, optionally filtered by district.
 * Consumed by: physics-bridge.js, atmosphere system.
 *
 * @param {Object} [opts]
 * @param {string} [opts.district]
 * @param {number} [opts.minStrength=0.1]
 * @param {number} [opts.limit=10]
 * @returns {Promise<Array<{ narrativeAId: string, narrativeAContent: string, narrativeBId: string, narrativeBContent: string, strength: number }>>}
 */
export async function getActiveTensions(opts = {}) {
  const minStrength = opts.minStrength ?? 0.1;
  const limit = opts.limit ?? 10;
  const client = await getConnectedClient();

  let cypher;
  let params;

  if (opts.district) {
    cypher = `
      MATCH (c1:Character {district: $district})-[:BELIEVES]->(n1:Narrative)
            -[t:TENSION]-(n2:Narrative)<-[:BELIEVES]-(c2:Character {district: $district})
      WHERE t.strength > $minStrength
      RETURN DISTINCT n1.id      AS narrativeAId,
             n1.content           AS narrativeAContent,
             n2.id                AS narrativeBId,
             n2.content           AS narrativeBContent,
             t.strength           AS strength,
             count(DISTINCT c1)   AS believersA,
             count(DISTINCT c2)   AS believersB
      ORDER BY t.strength DESC
      LIMIT $limit`;
    params = { district: opts.district, minStrength, limit };
  } else {
    cypher = `
      MATCH (n1:Narrative)-[t:TENSION]-(n2:Narrative)
      WHERE t.strength > $minStrength
      RETURN n1.id      AS narrativeAId,
             n1.content AS narrativeAContent,
             n2.id      AS narrativeBId,
             n2.content AS narrativeBContent,
             t.strength AS strength
      ORDER BY t.strength DESC
      LIMIT $limit`;
    params = { minStrength, limit };
  }

  return client.roQuery(cypher, params);
}

/**
 * Get most energetic narratives in a district.
 * Consumed by: atmosphere system, ambient conversation topics.
 *
 * @param {string} district
 * @param {Object} [opts]
 * @param {number} [opts.minEnergy=0.05]
 * @param {number} [opts.limit=10]
 * @returns {Promise<Array<{ id: string, content: string, type: string, energy: number, weight: number, believerCount: number, avgConfidence: number }>>}
 */
export async function getDistrictNarratives(district, opts = {}) {
  const minEnergy = opts.minEnergy ?? 0.05;
  const limit = opts.limit ?? 10;
  const client = await getConnectedClient();

  return client.roQuery(
    `MATCH (c:Character {district: $district})-[b:BELIEVES]->(n:Narrative)
     WHERE n.energy > $minEnergy
     RETURN n.id              AS id,
            n.content         AS content,
            n.type            AS type,
            n.energy          AS energy,
            n.weight          AS weight,
            count(DISTINCT c) AS believerCount,
            avg(b.confidence) AS avgConfidence
     ORDER BY n.energy * count(DISTINCT c) DESC
     LIMIT $limit`,
    { district, minEnergy, limit }
  );
}

/**
 * Get unflipped Moments a citizen is connected to, ranked by proximity to flip.
 * Consumed by: citizen-router.js (anxious citizen near a breaking point).
 *
 * @param {string} citizenId
 * @param {number} [limit=3]
 * @returns {Promise<Array<{ momentId: string, description: string, category: string, salience: number, threshold: number, proximityRatio: number }>>}
 */
export async function getCitizenMomentProximity(citizenId, limit = 3) {
  const client = await getConnectedClient();

  return client.roQuery(
    `MATCH (c:Character {id: $citizenId})-[:BELIEVES]->(n:Narrative)
           -[:FEEDS]->(m:Moment {flipped: false})
     RETURN DISTINCT m.id          AS momentId,
            m.description          AS description,
            m.category             AS category,
            m.threshold            AS threshold,
            m.energy               AS energy,
            m.weight               AS weight,
            m.energy * m.weight    AS salience,
            m.energy * m.weight / m.threshold AS proximityRatio
     ORDER BY proximityRatio DESC
     LIMIT $limit`,
    { citizenId, limit }
  );
}

/**
 * Get all citizens who believe a specific narrative.
 * Consumed by: news propagation, event consequences.
 *
 * @param {string} narrativeId
 * @returns {Promise<Array<{ citizenId: string, citizenName: string, socialClass: string, district: string, confidence: number, source: string }>>}
 */
export async function getNarrativeBelievers(narrativeId) {
  const client = await getConnectedClient();

  return client.roQuery(
    `MATCH (c:Character)-[b:BELIEVES]->(n:Narrative {id: $narrId})
     RETURN c.id         AS citizenId,
            c.name       AS citizenName,
            c.class      AS socialClass,
            c.district   AS district,
            b.confidence AS confidence,
            b.source     AS source
     ORDER BY b.confidence DESC`,
    { narrId: narrativeId }
  );
}

/**
 * Get scalar tension level for a district [0.0, 1.0].
 * Consumed by: atmosphere computation, citizen mood modifier.
 *
 * @param {string} district
 * @returns {Promise<number>}
 */
export async function getDistrictTensionLevel(district) {
  const client = await getConnectedClient();

  const rows = await client.roQuery(
    `MATCH (c1:Character {district: $dist})-[:BELIEVES]->(n1:Narrative)
           -[t:TENSION]-(n2:Narrative)
     RETURN sum(t.strength) AS totalTension,
            count(DISTINCT t) AS tensionCount`,
    { dist: district }
  );

  if (!rows[0] || rows[0].tensionCount === 0) return 0.0;

  const total = rows[0].totalTension;
  // Normalize to [0, 1] with sigmoid-like function
  return Math.max(0.0, Math.min(1.0, total / (total + 5.0)));
}

/**
 * Get citizen trust network for news propagation BFS.
 * Derived from shared belief overlap.
 *
 * @param {string} citizenId
 * @param {number} [minTrust=20]
 * @returns {Promise<Array<{ citizenId: string, citizenName: string, district: string, trust: number, sharedBeliefs: number }>>}
 */
export async function getCitizenTrustNetwork(citizenId, minTrust = 20) {
  const client = await getConnectedClient();

  const rows = await client.roQuery(
    `MATCH (c1:Character {id: $cid})-[:BELIEVES]->(n:Narrative)
           <-[:BELIEVES]-(c2:Character)
     WHERE c2.id <> $cid
     RETURN c2.id          AS citizenId,
            c2.name        AS citizenName,
            c2.district    AS district,
            count(n)       AS sharedBeliefs,
            avg(n.energy)  AS avgSharedEnergy
     ORDER BY sharedBeliefs DESC`,
    { cid: citizenId }
  );

  return rows
    .map(row => {
      const implicitTrust = Math.min(100, row.sharedBeliefs * 15 + 5);
      return {
        citizenId: row.citizenId,
        citizenName: row.citizenName,
        district: row.district,
        trust: implicitTrust,
        sharedBeliefs: row.sharedBeliefs,
      };
    })
    .filter(row => row.trust >= minTrust);
}

/**
 * Get a single character by ID.
 *
 * @param {string} characterId
 * @returns {Promise<Record<string, any> | null>}
 */
export async function getCharacter(characterId) {
  const client = await getConnectedClient();
  const rows = await client.roQuery(
    `MATCH (c:Character {id: $id})
     RETURN c.id AS id, c.name AS name, c.energy AS energy,
            c.weight AS weight, c.class AS class, c.mood AS mood,
            c.district AS district, c.ducats AS ducats, c.alive AS alive`,
    { id: characterId }
  );
  return rows[0] || null;
}

/**
 * Get all characters at a specific place.
 *
 * @param {string} placeId
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function getCharactersAt(placeId) {
  const client = await getConnectedClient();
  return client.roQuery(
    `MATCH (c:Character)-[:AT]->(p:Place {id: $placeId})
     RETURN c.id AS id, c.name AS name, c.class AS class,
            c.mood AS mood, c.energy AS energy`,
    { placeId }
  );
}
```

---

## G-IMPL-5. Mutation Functions (`mutations.js`)

Write operations called by physics-bridge.js, event propagation, and the Narrator.

```js
// src/server/graph/mutations.js

import { getConnectedClient } from './client.js';

/**
 * Create or update a BELIEVES edge between a citizen and a narrative.
 * Uses asymptotic confidence update (harder to strengthen near 1.0).
 * Mirrors ALGORITHM_Graph.md G4.
 *
 * @param {string} citizenId
 * @param {string} narrativeId
 * @param {number} confidence - [0.0, 1.0]
 * @param {string} source - 'personal' | 'witness' | 'hearsay' | 'news' | 'seed'
 * @returns {Promise<{ citizenId: string, narrativeId: string, confidence: number, isNew: boolean }>}
 */
export async function createOrUpdateBelief(citizenId, narrativeId, confidence, source) {
  const client = await getConnectedClient();

  // Check existing
  const existing = await client.roQuery(
    `MATCH (c:Character {id: $cid})-[b:BELIEVES]->(n:Narrative {id: $nid})
     RETURN b.confidence AS confidence, b.source AS source`,
    { cid: citizenId, nid: narrativeId }
  );

  if (existing.length > 0) {
    // Asymptotic update
    const oldConf = existing[0].confidence;
    let finalConf;

    if (confidence > oldConf) {
      const room = 1.0 - oldConf;
      const delta = (confidence - oldConf) * room * 0.5;
      finalConf = oldConf + delta;
    } else {
      const room = oldConf;
      const delta = (oldConf - confidence) * room * 0.3;
      finalConf = oldConf - delta;
    }

    finalConf = Math.max(0.01, Math.min(1.0, finalConf));

    await client.query(
      `MATCH (c:Character {id: $cid})-[b:BELIEVES]->(n:Narrative {id: $nid})
       SET b.confidence = $conf, b.heard_at = $now`,
      { cid: citizenId, nid: narrativeId, conf: finalConf, now: new Date().toISOString() }
    );

    return { citizenId, narrativeId, confidence: finalConf, isNew: false };
  }

  // Create new
  await client.query(
    `MATCH (c:Character {id: $cid}), (n:Narrative {id: $nid})
     CREATE (c)-[:BELIEVES {
       confidence: $conf,
       source: $source,
       heard_at: $now
     }]->(n)`,
    { cid: citizenId, nid: narrativeId, conf: confidence, source, now: new Date().toISOString() }
  );

  // Boost narrative energy slightly for new believer
  await client.query(
    `MATCH (n:Narrative {id: $nid})
     SET n.energy = n.energy + 0.05`,
    { nid: narrativeId }
  );

  return { citizenId, narrativeId, confidence, isNew: true };
}

/**
 * Create a new Narrative node.
 *
 * @param {Object} props
 * @param {string} props.id
 * @param {string} props.content
 * @param {number} [props.truth=0.5]
 * @param {number} [props.energy=0.3]
 * @param {number} [props.weight=0.5]
 * @param {string} [props.type='belief']
 * @param {string} [props.source='physics']
 * @returns {Promise<void>}
 */
export async function createNarrative(props) {
  const client = await getConnectedClient();
  await client.query(
    `MERGE (n:Narrative {id: $id})
     SET n.content = $content,
         n.truth   = $truth,
         n.energy  = $energy,
         n.weight  = $weight,
         n.type    = $type,
         n.source  = $source`,
    {
      id: props.id,
      content: props.content,
      truth: props.truth ?? 0.5,
      energy: props.energy ?? 0.3,
      weight: props.weight ?? 0.5,
      type: props.type ?? 'belief',
      source: props.source ?? 'physics',
    }
  );
}

/**
 * Move a character to a new place.
 * Deletes old AT edge, creates new one.
 *
 * @param {string} characterId
 * @param {string} placeId
 * @returns {Promise<void>}
 */
export async function moveCharacter(characterId, placeId) {
  const client = await getConnectedClient();

  // Remove existing AT edge
  await client.query(
    `MATCH (c:Character {id: $cid})-[a:AT]->()
     DELETE a`,
    { cid: characterId }
  );

  // Create new AT edge
  await client.query(
    `MATCH (c:Character {id: $cid}), (p:Place {id: $pid})
     CREATE (c)-[:AT {since: $now}]->(p)`,
    { cid: characterId, pid: placeId, now: new Date().toISOString() }
  );
}

/**
 * Update character properties from economic sync.
 *
 * @param {string} characterId
 * @param {Object} updates
 * @param {number} [updates.ducats]
 * @param {string} [updates.mood]
 * @param {number} [updates.energy]
 * @returns {Promise<void>}
 */
export async function updateCharacter(characterId, updates) {
  const client = await getConnectedClient();
  const setClauses = [];
  const params = { cid: characterId };

  if (updates.ducats !== undefined) {
    setClauses.push('c.ducats = $ducats');
    params.ducats = updates.ducats;
  }
  if (updates.mood !== undefined) {
    setClauses.push('c.mood = $mood');
    params.mood = updates.mood;
  }
  if (updates.energy !== undefined) {
    setClauses.push('c.energy = $energy');
    params.energy = updates.energy;
  }

  if (setClauses.length === 0) return;

  await client.query(
    `MATCH (c:Character {id: $cid})
     SET ${setClauses.join(', ')}`,
    params
  );
}

/**
 * Flip a Moment: set flipped=true, record severity, drain feeding narratives.
 * Called by physics-bridge.js during the FLIP phase.
 *
 * @param {string} momentId
 * @param {number} severity
 * @param {number} tick
 * @returns {Promise<void>}
 */
export async function flipMoment(momentId, severity, tick) {
  const client = await getConnectedClient();

  await client.query(
    `MATCH (m:Moment {id: $mid})
     SET m.flipped  = true,
         m.severity = $severity,
         m.flip_tick = $tick,
         m.energy   = 0.0`,
    { mid: momentId, severity, tick }
  );

  // Drain feeding narratives
  await client.query(
    `MATCH (n:Narrative)-[:FEEDS]->(m:Moment {id: $mid})
     SET n.energy = n.energy * 0.5`,
    { mid: momentId }
  );
}
```

---

## G-IMPL-6. Constants (`constants.js`)

```js
// src/server/graph/constants.js

/**
 * Social class -> initial narrative weight multiplier.
 * Mirrors ALGORITHM_Graph.md compute_initial_weight.
 */
export const CLASS_WEIGHTS = {
  Nobili:     1.5,
  Cittadini:  1.2,
  Popolani:   1.0,
  Facchini:   0.8,
  Forestieri: 0.6,
};

/**
 * Maps event categories to narrative types that feed them.
 * Mirrors ALGORITHM_Graph.md CATEGORY_NARRATIVE_TYPES.
 */
export const CATEGORY_NARRATIVE_TYPES = {
  economic_crisis:     ['grievance', 'debt', 'belief'],
  political_uprising:  ['grievance', 'grudge', 'belief'],
  celebration:         ['alliance', 'belief'],
  personal_tragedy:    ['grudge', 'debt'],
  guild_dispute:       ['grievance', 'belief', 'alliance'],
  trade_disruption:    ['belief', 'debt', 'forestiere_news'],
};

/**
 * Base moment flip thresholds per category.
 * Venice thresholds are higher than Blood Ledger (186 citizens vs ~15).
 */
export const BASE_THRESHOLDS = {
  economic_crisis:     3.0,
  political_uprising:  4.0,
  celebration:         2.0,
  personal_tragedy:    2.5,
  guild_dispute:       2.5,
  trade_disruption:    3.5,
};

/**
 * Venice district adjacency map.
 * Used by news propagation delay computation.
 */
export const DISTRICT_ADJACENCY = {
  San_Marco:   ['Rialto', 'Dorsoduro', 'Castello'],
  Rialto:      ['San_Marco', 'Cannaregio', 'San_Polo'],
  Dorsoduro:   ['San_Marco', 'San_Polo', 'Giudecca'],
  Cannaregio:  ['Rialto', 'Castello'],
  Castello:    ['San_Marco', 'Cannaregio'],
  San_Polo:    ['Rialto', 'Dorsoduro', 'Santa_Croce'],
  Santa_Croce: ['San_Polo', 'Cannaregio'],
  Giudecca:    ['Dorsoduro'],
};

/**
 * Check if two districts are adjacent.
 *
 * @param {string} districtA
 * @param {string} districtB
 * @returns {boolean}
 */
export function areDistrictsAdjacent(districtA, districtB) {
  return (DISTRICT_ADJACENCY[districtA] || []).includes(districtB);
}
```

---

## G-IMPL-7. Barrel Export (`index.js`)

```js
// src/server/graph/index.js

export { getGraphClient, getConnectedClient, VeneziaGraphClient } from './client.js';
export { createSchema, resetGraph, getGraphStats } from './schema.js';
export { seedVeniceGraph } from './seed.js';
export {
  getCitizenBeliefs,
  getActiveTensions,
  getDistrictNarratives,
  getCitizenMomentProximity,
  getNarrativeBelievers,
  getDistrictTensionLevel,
  getCitizenTrustNetwork,
  getCharacter,
  getCharactersAt,
} from './queries.js';
export {
  createOrUpdateBelief,
  createNarrative,
  moveCharacter,
  updateCharacter,
  flipMoment,
} from './mutations.js';
export {
  CLASS_WEIGHTS,
  CATEGORY_NARRATIVE_TYPES,
  BASE_THRESHOLDS,
  DISTRICT_ADJACENCY,
  areDistrictsAdjacent,
} from './constants.js';
```

---

## G-IMPL-8. Docker Setup for FalkorDB

FalkorDB runs as a Docker container alongside the Express server. Separate from any Blood Ledger FalkorDB instance -- different graph name within the same or different container.

### Docker Compose Fragment

```yaml
# docker-compose.yml (add to existing or create)
services:
  falkordb:
    image: falkordb/falkordb:latest
    ports:
      - "6379:6379"
    volumes:
      - falkordb_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  falkordb_data:
```

### Startup Integration

The graph client connects during Express server startup. If FalkorDB is unavailable, the server starts in degraded mode (no narrative features).

```js
// In src/server/index.js startup sequence:

import { getConnectedClient } from './graph/index.js';

async function initGraph() {
  try {
    const client = await getConnectedClient();
    const stats = await getGraphStats();
    console.log(`[Server] Graph connected. ${stats.characters} characters, ${stats.narratives} narratives`);

    if (stats.characters === 0) {
      console.warn('[Server] Graph is empty. Run: node scripts/seed-graph.js seed');
    }
  } catch (err) {
    console.error(`[Server] Graph unavailable: ${err.message}. Narrative features disabled.`);
  }
}
```

---

## G-IMPL-9. Error Handling Patterns

### Query Failure Isolation

Every query function catches errors and returns safe defaults rather than crashing the server. The graph is a narrative layer -- its failure should not prevent the 3D world from rendering.

```js
// Pattern used throughout queries.js:
export async function getCitizenBeliefs(citizenId, opts = {}) {
  try {
    // ... query logic ...
    return rows;
  } catch (err) {
    console.error(`[Graph] getCitizenBeliefs failed for ${citizenId}: ${err.message}`);
    return []; // Safe default: citizen has no beliefs
  }
}
```

### Connection Recovery

The `VeneziaGraphClient.query()` method detects connection errors and triggers a single reconnect attempt before propagating the error. This handles Docker container restarts and transient network issues without manual intervention.

### Seeding Idempotency

All seeding uses `MERGE` (Cypher upsert). Running `seed-graph.js seed` multiple times is safe. Properties are overwritten with SET, but the node identity (based on `id`) is preserved.
