# IMPLEMENTATION: economy/sync -- Code Architecture

Where the sync code lives. How `serenissima-sync.js` fetches from Airtable, builds an in-memory cache, computes diffs, and broadcasts via WebSocket. The `venice-state.js` cache manager. Rate limit handling. Pagination. Environment variables. npm packages. JS interfaces for every data structure.

---

## File Structure

```
cities-of-light/src/server/
  ├── index.js                  ← Express + WS server (existing, modified)
  ├── serenissima-sync.js       ← NEW: Airtable fetch loop, diff engine
  ├── venice-state.js           ← NEW: In-memory cache manager
  ├── citizen-router.js         ← NEW: Conversation routing (reads from cache)
  ├── physics-bridge.js         ← NEW: Blood Ledger bridge (reads from cache)
  ├── ai-citizens.js            ← Existing: AI citizen manager
  ├── voice.js                  ← Existing: voice processing
  └── rooms.js                  ← Existing: room management
```

---

## npm Dependencies

```json
{
  "dependencies": {
    "airtable": "^0.12.2"
  }
}
```

Install:

```bash
cd /home/mind-protocol/cities-of-light
npm install airtable
```

The `airtable` npm package provides paginated list fetching, automatic rate limit retry, and field selection. It wraps the Airtable REST API (`https://api.airtable.com/v0/`).

---

## Environment Variables

```bash
# Required
AIRTABLE_API_KEY=pat...                  # Airtable Personal Access Token
AIRTABLE_BASE_ID=appkLmnbsEFAZM5rB      # Serenissima Airtable base

# Optional (with defaults)
AIRTABLE_SYNC_INTERVAL_MS=900000         # 15 minutes between syncs
AIRTABLE_MAX_CONSECUTIVE_FAILURES=5      # Freeze after N failures
AIRTABLE_RATE_LIMIT_DELAY_MS=200         # 200ms between API calls (5 req/sec)
```

Load in `serenissima-sync.js`:

```javascript
import 'dotenv/config';

const AIRTABLE_API_KEY       = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID       = process.env.AIRTABLE_BASE_ID;
const SYNC_INTERVAL_MS       = parseInt(process.env.AIRTABLE_SYNC_INTERVAL_MS || '900000');
const MAX_CONSECUTIVE_FAILS  = parseInt(process.env.AIRTABLE_MAX_CONSECUTIVE_FAILURES || '5');
const RATE_LIMIT_DELAY_MS    = parseInt(process.env.AIRTABLE_RATE_LIMIT_DELAY_MS || '200');
```

---

## venice-state.js -- Cache Manager

### Cache Interface

```javascript
// cities-of-light/src/server/venice-state.js

/**
 * @typedef {Object} CachedCitizen
 * @property {string} id              - Airtable record ID
 * @property {string} citizenId       - Custom CitizenId field
 * @property {string} username        - Username (unique)
 * @property {string} name            - Display name
 * @property {string} socialClass     - Nobili|Mercatores|Cittadini|Popolani|Facchini|...
 * @property {{lat: number, lng: number}|null} position
 * @property {number} ducats
 * @property {number} wealth
 * @property {number} influence
 * @property {string|null} home       - BuildingId of home
 * @property {string|null} work       - BuildingId of workplace
 * @property {string|null} occupation
 * @property {number} hungerLevel     - 0-100
 * @property {number} dailyIncome
 * @property {number} dailyExpenses
 * @property {string|null} updatedAt  - ISO timestamp
 * @property {string} lastSync        - ISO timestamp of when this record was fetched
 */

/**
 * @typedef {Object} CachedBuilding
 * @property {string} id
 * @property {string} buildingId
 * @property {string} buildingType
 * @property {string} name
 * @property {string|null} owner
 * @property {string|null} runBy
 * @property {string|null} occupant
 * @property {string|null} category
 * @property {{lat: number, lng: number}|null} position
 * @property {number} rentPrice
 * @property {number} storageCapacity
 * @property {string} lastSync
 */

/**
 * @typedef {Object} CachedContract
 * @property {string} id
 * @property {string} contractId
 * @property {string} type
 * @property {string} status
 * @property {string|null} seller
 * @property {string|null} buyer
 * @property {string|null} sellerBuilding
 * @property {string|null} resourceType
 * @property {number} pricePerResource
 * @property {number} targetAmount
 * @property {number} filledAmount
 * @property {string|null} createdAt
 * @property {string|null} endAt
 * @property {string} lastSync
 */

/**
 * @typedef {Object} CachedActivity
 * @property {string} id
 * @property {string} activityId
 * @property {string|null} citizen
 * @property {string|null} citizenId
 * @property {string} type
 * @property {string} status
 * @property {string|null} fromBuilding
 * @property {string|null} toBuilding
 * @property {string|null} resourceType
 * @property {Array<{lat: number, lng: number}>|null} path
 * @property {string|null} startDate
 * @property {string|null} endDate
 * @property {string} lastSync
 */

/**
 * @typedef {Object} CachedRelationship
 * @property {string} id
 * @property {string|null} citizen1
 * @property {string|null} citizen2
 * @property {number} trustScore
 * @property {string|null} relationshipType
 * @property {number} interactionCount
 * @property {string} lastSync
 */

/**
 * @typedef {Object} CachedGrievance
 * @property {string} id
 * @property {string|null} title
 * @property {string|null} description
 * @property {string|null} category      - economic|social|criminal|infrastructure
 * @property {string|null} status        - filed|gathering|threshold|deliberating|accepted|rejected|expired|enacted
 * @property {string|null} citizen       - Username of filer
 * @property {number} supportCount
 * @property {string|null} createdAt
 * @property {string} lastSync
 */

/**
 * @typedef {Object} VeniceCache
 * @property {Map<string, CachedCitizen>} citizens         - key: CitizenId
 * @property {Map<string, CachedBuilding>} buildings       - key: BuildingId
 * @property {Map<string, CachedContract>} contracts       - key: ContractId
 * @property {Map<string, CachedActivity>} activities      - key: ActivityId
 * @property {Map<string, CachedRelationship>} relationships - key: Airtable record ID
 * @property {Map<string, CachedGrievance>} grievances     - key: Airtable record ID
 * @property {string|null} lastSyncTime  - ISO timestamp
 * @property {boolean} syncInProgress
 * @property {Set<string>} stale_tables  - Tables that failed on last sync
 */
```

### Cache Creation and Access

```javascript
// cities-of-light/src/server/venice-state.js

/** @type {VeniceCache} */
let cache = createEmptyCache();

/**
 * Create an empty cache with all six Map containers.
 * @returns {VeniceCache}
 */
export function createEmptyCache() {
  return {
    citizens:       new Map(),
    buildings:      new Map(),
    contracts:      new Map(),
    activities:     new Map(),
    relationships:  new Map(),
    grievances:     new Map(),
    lastSyncTime:   null,
    syncInProgress: false,
    stale_tables:   new Set(),
  };
}

/**
 * Get the current cache. All readers call this.
 * @returns {VeniceCache}
 */
export function getCache() {
  return cache;
}

/**
 * Atomic cache swap. Replaces the cache pointer in a single assignment.
 * JavaScript's single-threaded event loop guarantees no reader sees
 * a partially constructed cache.
 *
 * @param {VeniceCache} newCache
 * @returns {VeniceCache} The old cache (for diff computation)
 */
export function swapCache(newCache) {
  const oldCache = cache;
  cache = newCache;
  return oldCache;
}
```

### Cache Query Functions

```javascript
// cities-of-light/src/server/venice-state.js

/**
 * @param {string} citizenId
 * @returns {CachedCitizen|null}
 */
export function getCitizen(citizenId) {
  return cache.citizens.get(citizenId) || null;
}

/**
 * Get all citizens within a geographic bounding box.
 * @param {{minLat: number, maxLat: number, minLng: number, maxLng: number}} bounds
 * @returns {CachedCitizen[]}
 */
export function getCitizensInBounds(bounds) {
  const results = [];
  for (const [, citizen] of cache.citizens) {
    if (citizen.position
        && citizen.position.lat >= bounds.minLat
        && citizen.position.lat <= bounds.maxLat
        && citizen.position.lng >= bounds.minLng
        && citizen.position.lng <= bounds.maxLng) {
      results.push(citizen);
    }
  }
  return results;
}

/**
 * Get the current non-completed activity for a citizen.
 * @param {string} citizenId
 * @returns {CachedActivity|null}
 */
export function getCitizenActivity(citizenId) {
  for (const [, activity] of cache.activities) {
    if (activity.citizenId === citizenId
        && activity.status !== 'processed'
        && activity.status !== 'failed') {
      return activity;
    }
  }
  return null;
}

/**
 * Get trust score between two citizens.
 * @param {string} citizen1 - Username
 * @param {string} citizen2 - Username
 * @returns {number} Trust score (default 50)
 */
export function getTrustBetween(citizen1, citizen2) {
  for (const [, rel] of cache.relationships) {
    if ((rel.citizen1 === citizen1 && rel.citizen2 === citizen2)
        || (rel.citizen1 === citizen2 && rel.citizen2 === citizen1)) {
      return rel.trustScore;
    }
  }
  return 50; // Default neutral trust
}

/**
 * Get all grievances with status "filed" or "gathering".
 * @returns {CachedGrievance[]}
 */
export function getActiveGrievances() {
  const results = [];
  for (const [, grievance] of cache.grievances) {
    if (grievance.status === 'filed' || grievance.status === 'gathering') {
      results.push(grievance);
    }
  }
  return results;
}

/**
 * @returns {number} Minutes since last successful sync, or Infinity if never synced.
 */
export function getCacheAgeMinutes() {
  if (!cache.lastSyncTime) return Infinity;
  return Math.floor((Date.now() - Date.parse(cache.lastSyncTime)) / 60000);
}

/**
 * @returns {string} Human-readable cache summary.
 */
export function cacheSummary() {
  return `citizens=${cache.citizens.size}`
    + ` buildings=${cache.buildings.size}`
    + ` contracts=${cache.contracts.size}`
    + ` activities=${cache.activities.size}`
    + ` relationships=${cache.relationships.size}`
    + ` grievances=${cache.grievances.size}`
    + ` stale=${Array.from(cache.stale_tables).join(',')}`;
}
```

---

## serenissima-sync.js -- Fetch, Transform, Diff, Broadcast

### Module Structure

```javascript
// cities-of-light/src/server/serenissima-sync.js

import Airtable from 'airtable';
import 'dotenv/config';
import { createEmptyCache, swapCache, getCache, cacheSummary } from './venice-state.js';

// ─── Configuration ──────────────────────────────────────

const AIRTABLE_API_KEY       = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID       = process.env.AIRTABLE_BASE_ID;
const SYNC_INTERVAL_MS       = parseInt(process.env.AIRTABLE_SYNC_INTERVAL_MS || '900000');
const MAX_CONSECUTIVE_FAILS  = parseInt(process.env.AIRTABLE_MAX_CONSECUTIVE_FAILURES || '5');

let syncTimer = null;
let consecutiveFailures = 0;
let broadcastFn = null;  // Set by caller to push events to WebSocket clients
```

### Table Definitions

```javascript
// cities-of-light/src/server/serenissima-sync.js

/**
 * @typedef {Object} SyncTableDef
 * @property {string} name          - Internal cache key
 * @property {string} airtable      - Airtable table name
 * @property {string|null} keyField - Field used as Map key (null = use record ID)
 * @property {string[]} fields      - Fields to fetch (reduces payload)
 */

/** @type {SyncTableDef[]} */
const SYNC_TABLES = [
  {
    name:     'citizens',
    airtable: 'CITIZENS',
    keyField: 'CitizenId',
    fields:   ['CitizenId', 'Username', 'Name', 'SocialClass', 'Position',
               'Ducats', 'Wealth', 'Influence', 'Home', 'Work', 'Occupation',
               'HungerLevel', 'DailyIncome', 'DailyExpenses', 'UpdatedAt'],
  },
  {
    name:     'buildings',
    airtable: 'BUILDINGS',
    keyField: 'BuildingId',
    fields:   ['BuildingId', 'BuildingType', 'Name', 'Owner', 'RunBy',
               'Occupant', 'Category', 'Position', 'RentPrice',
               'StorageCapacity', 'Point'],
  },
  {
    name:     'contracts',
    airtable: 'CONTRACTS',
    keyField: 'ContractId',
    fields:   ['ContractId', 'Type', 'Status', 'Seller', 'Buyer',
               'SellerBuilding', 'ResourceType', 'PricePerResource',
               'TargetAmount', 'FilledAmount', 'CreatedAt', 'EndAt'],
  },
  {
    name:     'activities',
    airtable: 'ACTIVITIES',
    keyField: 'ActivityId',
    fields:   ['ActivityId', 'Citizen', 'CitizenId', 'Type', 'Status',
               'FromBuilding', 'ToBuilding', 'ResourceType', 'Path',
               'StartDate', 'EndDate'],
  },
  {
    name:     'relationships',
    airtable: 'RELATIONSHIPS',
    keyField: null,
    fields:   ['Citizen1', 'Citizen2', 'TrustScore', 'RelationshipType',
               'InteractionCount'],
  },
  {
    name:     'grievances',
    airtable: 'GRIEVANCES',
    keyField: null,
    fields:   ['Title', 'Description', 'Category', 'Status', 'Citizen',
               'SupportCount', 'CreatedAt'],
  },
];
```

### Airtable SDK Initialization

```javascript
// cities-of-light/src/server/serenissima-sync.js

/**
 * Initialize the Airtable SDK base connection.
 * The `airtable` npm package handles pagination internally via `eachPage()`.
 *
 * @returns {Airtable.Base}
 */
function initAirtableBase() {
  Airtable.configure({
    apiKey: AIRTABLE_API_KEY,
  });
  return Airtable.base(AIRTABLE_BASE_ID);
}

const base = initAirtableBase();
```

### Fetching a Single Table with Pagination and Rate Limit Retry

```javascript
// cities-of-light/src/server/serenissima-sync.js

/**
 * Fetch all records from one Airtable table.
 * Uses the `airtable` npm package's `eachPage()` which handles pagination
 * automatically. Rate limit 429 responses are retried with exponential backoff.
 *
 * @param {SyncTableDef} tableDef
 * @returns {Promise<{success: boolean, records: Airtable.Record[]}>}
 */
async function fetchTable(tableDef) {
  const MAX_RETRY_ON_429 = 3;
  let consecutive429 = 0;

  return new Promise((resolve) => {
    const allRecords = [];

    const selectOptions = {
      fields: tableDef.fields,
      pageSize: 100,
    };

    // Use a wrapper to handle 429 retries
    function attemptFetch() {
      base(tableDef.airtable)
        .select(selectOptions)
        .eachPage(
          function page(records, fetchNextPage) {
            consecutive429 = 0; // Reset on success
            for (const record of records) {
              allRecords.push(record);
            }
            fetchNextPage();
          },
          function done(err) {
            if (err) {
              // Check for 429 rate limit
              if (err.statusCode === 429) {
                consecutive429++;
                if (consecutive429 > MAX_RETRY_ON_429) {
                  console.error(
                    `[Sync] ${tableDef.airtable}: 3 consecutive 429s. Aborting.`
                  );
                  resolve({ success: false, records: [] });
                  return;
                }
                const retryAfter = parseInt(err.headers?.['retry-after'] || '30');
                console.warn(
                  `[Sync] ${tableDef.airtable}: rate limited. Waiting ${retryAfter}s.`
                );
                setTimeout(() => attemptFetch(), retryAfter * 1000);
                return;
              }

              console.error(`[Sync] ${tableDef.airtable}: error: ${err.message}`);
              resolve({ success: false, records: [] });
              return;
            }

            resolve({ success: true, records: allRecords });
          }
        );
    }

    attemptFetch();
  });
}
```

### Alternative: Raw HTTP Fetch with Manual Pagination

If the `airtable` npm package introduces unwanted overhead or the project prefers fewer dependencies, here is the raw `fetch`-based implementation:

```javascript
// cities-of-light/src/server/serenissima-sync.js (alternative)

const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const RATE_LIMIT_DELAY_MS = 200; // 5 req/sec

/**
 * Sleep helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single Airtable table using raw HTTP with manual pagination.
 *
 * @param {SyncTableDef} tableDef
 * @returns {Promise<{success: boolean, records: Object[]}>}
 */
async function fetchTableRaw(tableDef) {
  const MAX_RETRY_ON_429 = 3;
  let consecutive429 = 0;
  const allRecords = [];
  let offset = null;

  while (true) {
    await sleep(RATE_LIMIT_DELAY_MS);

    const url = new URL(
      `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableDef.airtable)}`
    );
    url.searchParams.set('pageSize', '100');
    for (const field of tableDef.fields) {
      url.searchParams.append('fields[]', field);
    }
    if (offset) {
      url.searchParams.set('offset', offset);
    }

    let response;
    try {
      response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      });
    } catch (networkErr) {
      console.error(`[Sync] ${tableDef.airtable}: network error: ${networkErr.message}`);
      return { success: false, records: [] };
    }

    if (response.status === 200) {
      consecutive429 = 0;
      const body = await response.json();
      allRecords.push(...body.records);

      if (body.offset) {
        offset = body.offset;
        continue; // Next page
      } else {
        break; // All pages fetched
      }
    }

    if (response.status === 429) {
      consecutive429++;
      if (consecutive429 > MAX_RETRY_ON_429) {
        console.error(`[Sync] ${tableDef.airtable}: 3 consecutive 429s. Aborting.`);
        return { success: false, records: [] };
      }
      const retryAfter = parseInt(response.headers.get('retry-after') || '30');
      console.warn(`[Sync] ${tableDef.airtable}: rate limited. Waiting ${retryAfter}s.`);
      await sleep(retryAfter * 1000);
      continue; // Retry same page
    }

    // Other HTTP errors
    console.error(`[Sync] ${tableDef.airtable}: HTTP ${response.status}`);
    return { success: false, records: [] };
  }

  return { success: true, records: allRecords };
}
```

### Record Transformation

```javascript
// cities-of-light/src/server/serenissima-sync.js

/**
 * Parse a position string "45.4371,12.3358" into {lat, lng}.
 * @param {string|null|undefined} posStr
 * @returns {{lat: number, lng: number}|null}
 */
function parsePosition(posStr) {
  if (!posStr || typeof posStr !== 'string') return null;
  const parts = posStr.split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

/**
 * Parse a GeoJSON Point into {lat, lng}.
 * Airtable stores some positions as GeoJSON: {"type":"Point","coordinates":[lng,lat]}
 * @param {string|Object|null|undefined} point
 * @returns {{lat: number, lng: number}|null}
 */
function parseGeoJsonPoint(point) {
  if (!point) return null;
  let obj = point;
  if (typeof point === 'string') {
    try { obj = JSON.parse(point); } catch { return null; }
  }
  if (obj.type === 'Point' && Array.isArray(obj.coordinates)) {
    return { lat: obj.coordinates[1], lng: obj.coordinates[0] };
  }
  return null;
}

/**
 * Safely parse a JSON string. Returns null on failure.
 * @param {string|null|undefined} jsonStr
 * @returns {*|null}
 */
function safeJsonParse(jsonStr) {
  if (!jsonStr || typeof jsonStr !== 'string') return null;
  try { return JSON.parse(jsonStr); } catch { return null; }
}

/**
 * Transform an Airtable record into a cache-friendly flat object.
 * The Airtable SDK returns records as { id, fields, _table }.
 * The raw API returns { id, fields, createdTime }.
 *
 * @param {Object} record  - Airtable record (SDK or raw)
 * @param {SyncTableDef} tableDef
 * @returns {Object} Transformed cache record
 */
function transformRecord(record, tableDef) {
  // Handle both SDK records (record.get('Field')) and raw records (record.fields.Field)
  const f = record.fields || {};
  const get = (field) => {
    if (typeof record.get === 'function') return record.get(field);
    return f[field];
  };
  const now = new Date().toISOString();

  switch (tableDef.name) {
    case 'citizens':
      return {
        id:            record.id,
        citizenId:     get('CitizenId'),
        username:      get('Username'),
        name:          get('Name'),
        socialClass:   get('SocialClass') || 'Popolani',
        position:      parsePosition(get('Position')),
        ducats:        get('Ducats') || 0,
        wealth:        get('Wealth') || 0,
        influence:     get('Influence') || 0,
        home:          get('Home'),
        work:          get('Work'),
        occupation:    get('Occupation'),
        hungerLevel:   get('HungerLevel') || 50,
        dailyIncome:   get('DailyIncome') || 0,
        dailyExpenses: get('DailyExpenses') || 0,
        updatedAt:     get('UpdatedAt'),
        lastSync:      now,
      };

    case 'buildings':
      return {
        id:              record.id,
        buildingId:      get('BuildingId'),
        buildingType:    get('BuildingType'),
        name:            get('Name'),
        owner:           get('Owner'),
        runBy:           get('RunBy'),
        occupant:        get('Occupant'),
        category:        get('Category'),
        position:        parseGeoJsonPoint(get('Point')) || parsePosition(get('Position')),
        rentPrice:       get('RentPrice') || 0,
        storageCapacity: get('StorageCapacity') || 0,
        lastSync:        now,
      };

    case 'contracts':
      return {
        id:               record.id,
        contractId:       get('ContractId'),
        type:             get('Type'),
        status:           get('Status'),
        seller:           get('Seller'),
        buyer:            get('Buyer'),
        sellerBuilding:   get('SellerBuilding'),
        resourceType:     get('ResourceType'),
        pricePerResource: get('PricePerResource') || 0,
        targetAmount:     get('TargetAmount') || 0,
        filledAmount:     get('FilledAmount') || 0,
        createdAt:        get('CreatedAt'),
        endAt:            get('EndAt'),
        lastSync:         now,
      };

    case 'activities':
      return {
        id:           record.id,
        activityId:   get('ActivityId'),
        citizen:      get('Citizen'),
        citizenId:    get('CitizenId'),
        type:         get('Type'),
        status:       get('Status'),
        fromBuilding: get('FromBuilding'),
        toBuilding:   get('ToBuilding'),
        resourceType: get('ResourceType'),
        path:         safeJsonParse(get('Path')),
        startDate:    get('StartDate'),
        endDate:      get('EndDate'),
        lastSync:     now,
      };

    case 'relationships':
      return {
        id:               record.id,
        citizen1:         get('Citizen1'),
        citizen2:         get('Citizen2'),
        trustScore:       get('TrustScore') || 50,
        relationshipType: get('RelationshipType'),
        interactionCount: get('InteractionCount') || 0,
        lastSync:         now,
      };

    case 'grievances':
      return {
        id:           record.id,
        title:        get('Title'),
        description:  get('Description'),
        category:     get('Category'),
        status:       get('Status'),
        citizen:      get('Citizen'),
        supportCount: get('SupportCount') || 0,
        createdAt:    get('CreatedAt'),
        lastSync:     now,
      };

    default:
      return { id: record.id, ...f, lastSync: now };
  }
}

/**
 * Extract the cache key for a record.
 * If tableDef.keyField is set, use that field's value.
 * Otherwise, use the Airtable record ID.
 *
 * @param {Object} record
 * @param {SyncTableDef} tableDef
 * @returns {string}
 */
function extractCacheKey(record, tableDef) {
  if (tableDef.keyField) {
    const f = record.fields || {};
    const val = (typeof record.get === 'function')
      ? record.get(tableDef.keyField)
      : f[tableDef.keyField];
    return val || record.id;
  }
  return record.id;
}
```

### Full Sync Procedure

```javascript
// cities-of-light/src/server/serenissima-sync.js

/**
 * Perform a full sync of all six tables.
 * Builds a new cache, swaps it in, computes diff, broadcasts.
 *
 * @returns {Promise<boolean>} True if sync succeeded
 */
async function performFullSync() {
  const currentCache = getCache();

  if (currentCache.syncInProgress) {
    console.warn('[Sync] Sync already in progress. Skipping.');
    return false;
  }

  const newCache = createEmptyCache();
  newCache.syncInProgress = true;

  const tableResults = {};

  for (const tableDef of SYNC_TABLES) {
    const result = await fetchTable(tableDef);

    if (result.success) {
      tableResults[tableDef.name] = result.records;
    } else {
      // Partial failure: reuse stale data
      console.warn(`[Sync] Failed to fetch ${tableDef.airtable}. Using stale data.`);
      tableResults[tableDef.name] = Array.from(
        currentCache[tableDef.name]?.values() || []
      );
      newCache.stale_tables.add(tableDef.name);
    }
  }

  // Transform and populate new cache
  for (const tableDef of SYNC_TABLES) {
    const records = tableResults[tableDef.name] || [];
    for (const record of records) {
      // Check if record is already transformed (stale data from Map.values())
      const isAlreadyTransformed = typeof record.lastSync === 'string';
      const transformed = isAlreadyTransformed
        ? record
        : transformRecord(record, tableDef);
      const key = isAlreadyTransformed
        ? (transformed.citizenId || transformed.buildingId || transformed.contractId
           || transformed.activityId || transformed.id)
        : extractCacheKey(record, tableDef);
      newCache[tableDef.name].set(key, transformed);
    }
  }

  newCache.lastSyncTime = new Date().toISOString();
  newCache.syncInProgress = false;

  // Critical tables check: citizens and activities must succeed
  const criticalOk =
    !newCache.stale_tables.has('citizens') &&
    !newCache.stale_tables.has('activities');

  if (!criticalOk) {
    console.error('[Sync] Critical tables failed. Keeping old cache.');
    return false;
  }

  // Atomic swap
  const oldCache = swapCache(newCache);

  // Compute and broadcast diff
  const diff = computeDiff(oldCache, newCache);
  broadcastDiff(diff);

  console.log(`[Sync] Complete. ${cacheSummary()}`);
  return true;
}
```

### Diff Computation

```javascript
// cities-of-light/src/server/serenissima-sync.js

/**
 * @typedef {Object} ChangeEvent
 * @property {string} table
 * @property {string} key
 * @property {Object} record
 * @property {string[]} [changed_fields]
 * @property {Object} [previous]
 */

/**
 * @typedef {Object} SyncDiff
 * @property {ChangeEvent[]} created
 * @property {ChangeEvent[]} updated
 * @property {ChangeEvent[]} deleted
 * @property {Object<string, {created: number, updated: number, deleted: number}>} summary
 */

/** Fields to skip when comparing records. */
const SKIP_FIELDS = new Set(['lastSync']);

/** Fields that are worth broadcasting (affect rendering or conversation). */
const SIGNIFICANT_FIELDS = {
  citizens:      new Set(['position', 'socialClass', 'ducats', 'occupation',
                          'hungerLevel', 'home', 'work']),
  buildings:     new Set(['owner', 'runBy', 'occupant', 'category']),
  contracts:     new Set(['status', 'pricePerResource', 'targetAmount', 'filledAmount']),
  activities:    new Set(['type', 'status', 'fromBuilding', 'toBuilding', 'path']),
  relationships: new Set(['trustScore', 'relationshipType']),
  grievances:    new Set(['status', 'supportCount']),
};

/**
 * Deep equality check for two values.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Detect which fields changed between two records.
 * @param {Object} oldRecord
 * @param {Object} newRecord
 * @returns {string[]}
 */
function detectFieldChanges(oldRecord, newRecord) {
  const changed = [];
  for (const field of Object.keys(newRecord)) {
    if (SKIP_FIELDS.has(field)) continue;
    if (!deepEqual(oldRecord[field], newRecord[field])) {
      changed.push(field);
    }
  }
  return changed;
}

/**
 * Compute a diff between old and new cache.
 *
 * @param {VeniceCache} oldCache
 * @param {VeniceCache} newCache
 * @returns {SyncDiff}
 */
function computeDiff(oldCache, newCache) {
  /** @type {SyncDiff} */
  const diff = { created: [], updated: [], deleted: [], summary: {} };

  for (const tableDef of SYNC_TABLES) {
    const tableName = tableDef.name;
    const oldMap = oldCache[tableName] || new Map();
    const newMap = newCache[tableName] || new Map();
    let created = 0, updated = 0, deleted = 0;

    // Created and updated
    for (const [key, newRecord] of newMap) {
      const oldRecord = oldMap.get(key);
      if (!oldRecord) {
        diff.created.push({ table: tableName, key, record: newRecord });
        created++;
      } else {
        const changedFields = detectFieldChanges(oldRecord, newRecord);
        if (changedFields.length > 0) {
          const previous = {};
          for (const f of changedFields) previous[f] = oldRecord[f];
          diff.updated.push({
            table: tableName,
            key,
            record: newRecord,
            changed_fields: changedFields,
            previous,
          });
          updated++;
        }
      }
    }

    // Deleted
    for (const [key, oldRecord] of oldMap) {
      if (!newMap.has(key)) {
        diff.deleted.push({ table: tableName, key, record: oldRecord });
        deleted++;
      }
    }

    diff.summary[tableName] = { created, updated, deleted };
  }

  return diff;
}
```

### Significant Change Filtering

```javascript
// cities-of-light/src/server/serenissima-sync.js

/**
 * Check if a change event contains fields that affect the 3D world.
 * @param {ChangeEvent} event
 * @returns {boolean}
 */
function hasSignificantChanges(event) {
  const significant = SIGNIFICANT_FIELDS[event.table];
  if (!significant) return true; // Unknown table: broadcast anyway
  if (!event.changed_fields) return true; // Created/deleted: always significant
  return event.changed_fields.some((f) => significant.has(f));
}
```

### WebSocket Broadcast

```javascript
// cities-of-light/src/server/serenissima-sync.js

/**
 * Map a change event to a WebSocket message for the 3D client.
 * @param {ChangeEvent} event
 * @param {string} action  - "created"|"updated"|"deleted"
 * @returns {Object} WebSocket event payload
 */
function mapToWsEvent(event, action) {
  const { table, record } = event;

  switch (table) {
    case 'citizens':
      return {
        type:     'citizen_update',
        action,
        citizen:  {
          id:          record.citizenId,
          username:    record.username,
          name:        record.name,
          position:    record.position,
          socialClass: record.socialClass,
          ducats:      record.ducats,
        },
        changed:  event.changed_fields,
        previous: event.previous,
      };

    case 'buildings':
      return {
        type:     'building_update',
        action,
        building: {
          id:           record.buildingId,
          buildingType: record.buildingType,
          owner:        record.owner,
          occupant:     record.occupant,
          position:     record.position,
        },
        changed:  event.changed_fields,
      };

    case 'contracts':
      return {
        type:     'contract_update',
        action,
        contract: {
          id:           record.contractId,
          contractType: record.type,
          status:       record.status,
          seller:       record.seller,
          resourceType: record.resourceType,
          price:        record.pricePerResource,
        },
        changed:  event.changed_fields,
      };

    case 'activities':
      return {
        type:     'citizen_update',
        action:   'activity_changed',
        activity: {
          id:           record.activityId,
          citizen:      record.citizen,
          activityType: record.type,
          status:       record.status,
          path:         record.path,
          fromBuilding: record.fromBuilding,
          toBuilding:   record.toBuilding,
        },
      };

    case 'grievances':
      return {
        type:       'event_alert',
        alertType:  'governance',
        grievance:  {
          id:           record.id,
          title:        record.title,
          category:     record.category,
          status:       record.status,
          supportCount: record.supportCount,
          citizen:      record.citizen,
        },
        changed:    event.changed_fields,
      };

    default:
      return {
        type:    'data_update',
        table,
        action,
        record,
      };
  }
}

/**
 * Broadcast all significant changes to connected WebSocket clients.
 * @param {SyncDiff} diff
 */
function broadcastDiff(diff) {
  if (!broadcastFn) return;

  for (const event of diff.created) {
    const wsEvent = mapToWsEvent(event, 'created');
    broadcastFn(wsEvent);
  }

  for (const event of diff.updated) {
    if (!hasSignificantChanges(event)) continue;
    const wsEvent = mapToWsEvent(event, 'updated');
    broadcastFn(wsEvent);
  }

  for (const event of diff.deleted) {
    const wsEvent = mapToWsEvent(event, 'deleted');
    broadcastFn(wsEvent);
  }
}
```

### Sync Loop Lifecycle

```javascript
// cities-of-light/src/server/serenissima-sync.js

/**
 * Start the sync loop. Runs initial sync, then schedules recurring syncs.
 * @param {function(Object): void} broadcast - Function to broadcast to all WS clients
 */
export async function startSyncLoop(broadcast) {
  broadcastFn = broadcast;

  // Validate configuration
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('[Sync] AIRTABLE_API_KEY and AIRTABLE_BASE_ID are required.');
    return;
  }

  // Initial sync
  console.log('[Sync] Performing initial full sync...');
  const ok = await performFullSync();
  if (ok) {
    console.log(`[Sync] Initial sync complete. ${cacheSummary()}`);
  } else {
    console.warn('[Sync] Initial sync failed. Starting with empty cache.');
  }

  // Recurring sync
  syncTimer = setInterval(async () => {
    const success = await performFullSync();

    if (success) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
      console.warn(
        `[Sync] Failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILS}).`
      );
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILS) {
        const cache = getCache();
        const ageMin = cache.lastSyncTime
          ? Math.floor((Date.now() - Date.parse(cache.lastSyncTime)) / 60000)
          : 'never';
        console.error(
          `[Sync] ALERT: ${MAX_CONSECUTIVE_FAILS} consecutive failures. `
          + `Cache is ${ageMin} minutes stale.`
        );
      }
    }
  }, SYNC_INTERVAL_MS);

  console.log(`[Sync] Loop started. Interval: ${SYNC_INTERVAL_MS / 1000}s`);
}

/**
 * Stop the sync loop. Called on graceful shutdown.
 */
export function stopSyncLoop() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('[Sync] Loop stopped.');
  }
}
```

### Integration with Express Server

```javascript
// cities-of-light/src/server/index.js (modifications)

import { startSyncLoop, stopSyncLoop } from './serenissima-sync.js';
import { getCache, getCacheAgeMinutes, cacheSummary } from './venice-state.js';

// After WebSocket server is created:
const wss = new WebSocketServer({ server });

// Broadcast helper: sends JSON to all connected clients
function broadcastToAll(event) {
  const data = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(data);
    }
  }
}

// Start sync loop after server is listening
server.listen(PORT, () => {
  console.log(`Venezia server on port ${PORT}`);
  startSyncLoop(broadcastToAll);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  stopSyncLoop();
  wss.close();
  server.close();
});

// Client reconnection: send full state
wss.on('connection', (ws) => {
  const cache = getCache();
  if (cache.lastSyncTime) {
    ws.send(JSON.stringify({
      type:       'full_state',
      citizens:   Array.from(cache.citizens.values()),
      buildings:  Array.from(cache.buildings.values()),
      contracts:  Array.from(cache.contracts.values()),
      activities: Array.from(cache.activities.values()),
      grievances: Array.from(cache.grievances.values()),
      syncTime:   cache.lastSyncTime,
    }));
  }
});
```

---

## Push Writes: Trust Score Updates

Venezia writes to Airtable in exactly one case: updating trust scores after visitor-citizen conversations.

```javascript
// cities-of-light/src/server/serenissima-sync.js

/**
 * Update a trust score in Airtable RELATIONSHIPS table.
 * This is the only write operation Venezia performs on Airtable.
 *
 * @param {string} citizen1 - Username
 * @param {string} citizen2 - Username (visitor mapped to username)
 * @param {number} newTrustScore
 * @returns {Promise<boolean>}
 */
export async function pushTrustScoreUpdate(citizen1, citizen2, newTrustScore) {
  try {
    // Search for existing relationship
    const formula = `OR(AND({Citizen1}="${citizen1}",{Citizen2}="${citizen2}"),`
                  + `AND({Citizen1}="${citizen2}",{Citizen2}="${citizen1}"))`;

    const records = await new Promise((resolve, reject) => {
      const results = [];
      base('RELATIONSHIPS')
        .select({ filterByFormula: formula, maxRecords: 1 })
        .eachPage(
          (recs, next) => { results.push(...recs); next(); },
          (err) => err ? reject(err) : resolve(results)
        );
    });

    if (records.length > 0) {
      // Update existing
      const record = records[0];
      const currentCount = record.get('InteractionCount') || 0;
      await base('RELATIONSHIPS').update(record.id, {
        TrustScore:       newTrustScore,
        InteractionCount: currentCount + 1,
      });
    } else {
      // Create new relationship
      await base('RELATIONSHIPS').create({
        Citizen1:         citizen1,
        Citizen2:         citizen2,
        TrustScore:       newTrustScore,
        RelationshipType: 'visitor_encounter',
        InteractionCount: 1,
      });
    }

    return true;
  } catch (err) {
    console.error(`[Sync] Failed to update trust score: ${err.message}`);
    return false;
  }
}
```

---

## Error Handling

### Error Response Matrix

| Error | Action | Client Effect |
|---|---|---|
| Airtable unreachable | Serve stale cache | World looks slightly static |
| Single table fails | Complete others, mark stale | That domain may be old |
| 429 rate limit | Read Retry-After, wait, retry 3x | Sync takes longer |
| Diff computation error | Skip broadcast, cache still updates | No transitions this cycle |
| WebSocket broadcast fails | Client reconnects next cycle | Brief stale period |
| Cache corruption | Full rebuild on next sync | One cycle of stale data |

### Graceful Freeze

When Airtable is unreachable, the cache pointer stays unchanged. All client reads continue to work. Citizens stay at their last known positions. Activities remain in their last known state. The 3D world looks like a quiet moment, not a failure. When Airtable comes back, the next sync picks up all accumulated changes. The diff will be large. The world "wakes up."

---

## Timing Budget

```
SEQUENCE: One Complete Sync Cycle

  T+0s     sync_loop fires
  T+0.2s   fetch CITIZENS page 1-2    (~2 API calls)
  T+0.8s   fetch BUILDINGS page 1-5   (~5 API calls)
  T+1.8s   fetch CONTRACTS page 1-5   (~5 API calls)
  T+2.8s   fetch ACTIVITIES page 1-2  (~2 API calls)
  T+3.2s   fetch RELATIONSHIPS page 1-20 (~20 API calls)
  T+7.2s   fetch GRIEVANCES page 1    (~1 API call)
  T+7.4s   transform ~3000 records    (~50ms)
  T+7.45s  swap cache                 (<1ms, atomic)
  T+7.45s  compute diff               (~20ms)
  T+7.47s  broadcast diff via WS      (~5ms per client)
  T+7.5s   sync complete

  Total wall time: ~7.5 seconds
  Total API calls: ~35
  Next sync in: 14 minutes 52 seconds
```

### API Budget Per Hour

```
Sync reads:   35 calls x 4 syncs/hour = 140 calls/hour
Trust writes:  ~12 calls/hour (1 conversation every 5 minutes)
Total:         ~152 calls/hour
Airtable limit: 18,000 calls/hour (300/minute)
Utilization:   0.84%
```
