# PATTERNS -- Economy Sync

> Design philosophy for bidirectional data sync between Airtable and the Express server.
> Airtable is the source of truth. The Express server holds an in-memory cache for
> real-time rendering. The sync module bridges the two.

---

## Core Principle: Airtable Owns the Data, Express Owns the Speed

Airtable is where the economic simulation writes its results. 152 citizens, their
positions, their Ducats, their contracts, their relationships -- all live in
Airtable tables. This data has been accumulating for months. It is the canonical
state of Venice.

But Airtable is slow. A single API call takes 200-500ms. Fetching the full
citizen table takes multiple paginated requests. You cannot render a 3D world at
72fps by querying Airtable every frame.

The Express server holds an in-memory cache of the most recent Airtable state.
The 3D client reads from this cache via WebSocket. The cache is refreshed every
15 minutes by the sync module.

```
Airtable (truth, slow)  --15min-->  Express cache (fast, stale)  --ws-->  Client (renders)
```

The cache is always slightly stale. This is acceptable. A citizen's Ducats being
14 minutes out of date does not break the experience. What matters is that the
3D world reflects the general economic reality, not the exact millisecond state.

---

## Pull Cycle: Airtable to Express

Every 15 minutes, the sync module fetches six Airtable tables:

| Table | Why | Approximate Size |
|---|---|---|
| CITIZENS | Position, mood, wealth, class, activity | 152 records |
| BUILDINGS | Geometry source, ownership, inventory | ~500 records |
| CONTRACTS | Active trades, prices, buyer/seller pairs | ~200-1000 records |
| ACTIVITIES | Current citizen actions, movement paths | ~152 records (1 per citizen) |
| RELATIONSHIPS | Trust scores between citizen pairs | ~2000 records |
| GRIEVANCES | Active political complaints | ~50-100 records |

### Fetch Strategy

Airtable's rate limit is 5 requests per second. Each table fetch uses paginated
requests (100 records per page). Estimated API calls per sync:

```
CITIZENS:     2 pages  = 2 calls
BUILDINGS:    5 pages  = 5 calls
CONTRACTS:    2-10     = ~5 calls
ACTIVITIES:   2 pages  = 2 calls
RELATIONSHIPS: 20 pages = 20 calls
GRIEVANCES:   1 page   = 1 call
                        --------
Total:                  ~35 calls
At 5/sec:              ~7 seconds per full sync
```

Seven seconds is acceptable for a 15-minute cycle. The sync runs sequentially
(one table at a time) to stay well within rate limits. No parallelization needed
at this scale.

### Incremental vs. Full Fetch

Two strategies, each with tradeoffs:

**Full fetch (recommended for V1):** Fetch all records every sync. Simple.
Handles deletions naturally. 35 API calls every 15 minutes = ~2.3 calls/minute
average. Well within limits.

**Incremental fetch:** Use Airtable's `filterByFormula` with
`LAST_MODIFIED_TIME() > '{last_sync_time}'`. Fewer records transferred, but:
- Cannot detect deletions (a deleted record is just absent)
- Formula parsing adds latency per request
- More complex cache invalidation logic
- Not worth the complexity for 152 citizens

Start with full fetch. Switch to incremental only if Airtable costs or latency
become a problem.

---

## Push Cycle: Express to Airtable

Venezia writes to Airtable in two narrow cases only:

### 1. Citizen Memory Updates

After a visitor converses with a citizen, the encounter is written to the
citizen's `.cascade/memories/` directory (filesystem, not Airtable). No Airtable
write needed for memories.

### 2. Trust Score Updates

When a visitor interacts with a citizen, the trust score in RELATIONSHIPS is
updated. This is a single PATCH request to one record.

```
PATCH /v0/{base_id}/RELATIONSHIPS/{record_id}
{ "fields": { "TrustScore": 0.65 } }
```

One API call per conversation. At normal interaction rates (1 conversation per
5-10 seconds), this is ~6-12 calls/minute. Combined with sync reads (~2.3/min),
total is ~8-14 calls/minute. Rate limit is 300/minute. No concern.

### What Venezia Must NOT Write

Everything else. Not CITIZENS (Ducats, mood, position). Not CONTRACTS. Not
BUILDINGS. Not ACTIVITIES. These are Serenissima's domain. See
economy/simulation PATTERNS for the ownership boundary.

---

## Diff Computation and WebSocket Events

The sync module does not just cache data -- it computes what changed.

### Diff Algorithm

After each sync, compare new state against previous state:

```
for each table:
    for each record:
        if record.id not in previous_cache:
            emit("created", table, record)
        elif record.fields != previous_cache[record.id].fields:
            emit("updated", table, record, changed_fields)

    for each record_id in previous_cache:
        if record_id not in new_data:
            emit("deleted", table, record_id)
```

### WebSocket Event Types

Diffs become WebSocket messages to connected clients:

| Event | Trigger | Client Action |
|---|---|---|
| `citizen_update` | Citizen position, mood, or activity changed | Move avatar, update animation |
| `building_update` | Building inventory or ownership changed | Update stall display |
| `contract_update` | New trade or completed trade | Update market visualization |
| `event_alert` | New grievance, bankruptcy, or price spike | Trigger atmosphere shift |

Events are broadcast to all connected clients in the same room/district. No
per-client filtering needed in V1 (single-player).

---

## Cache Structure

The in-memory cache is a set of Maps, keyed by Airtable record ID:

```javascript
const cache = {
    citizens:      new Map(),  // id -> { fields, lastSync }
    buildings:     new Map(),
    contracts:     new Map(),
    activities:    new Map(),
    relationships: new Map(),
    grievances:    new Map(),
    lastSyncTime:  null,       // ISO timestamp of last completed sync
    syncInProgress: false       // prevents overlapping syncs
};
```

The cache lives in `venice-state.js` (the world state manager). The sync module
writes to it. The citizen-router, physics-bridge, and WebSocket handlers read
from it.

### Cache Invalidation

The cache is invalidated every 15 minutes by the next sync. There is no
per-record TTL, no LRU eviction, no manual invalidation. The entire cache is
replaced atomically on each sync.

Atomic replacement prevents race conditions: while a sync is running, readers
see the old cache. When the sync completes, a single pointer swap makes the
new cache visible.

```javascript
// Good: atomic swap
const newCache = await fetchAllTables();
const diff = computeDiff(currentCache, newCache);
currentCache = newCache;  // atomic
broadcastDiff(diff);

// Bad: incremental mutation
currentCache.citizens.set(id, newData);  // readers see partial state
```

---

## Conflict Resolution

Conflicts arise when Venezia writes to Airtable (trust score update) at the
same time Serenissima writes to the same record.

**Resolution: last write wins.** Airtable does not have row-level locking.
Both systems write to different fields of RELATIONSHIPS (Venezia writes
TrustScore, Serenissima writes other relationship metadata), so field-level
conflicts are unlikely. If they occur, the last writer's value persists.

This is acceptable because:
1. Venezia only writes TrustScore, which Serenissima does not compute
2. Serenissima writes RelationshipType, InteractionCount, etc., which Venezia
   does not touch
3. The fields are orthogonal -- no semantic conflict even if timestamps overlap

---

## Sync Interval Decision

15 minutes is the initial interval. Rationale:

| Interval | Pros | Cons |
|---|---|---|
| 1 min | Near real-time | 35 calls/min = 2100/hour (risky under load) |
| 5 min | Fresh enough for most changes | 420 calls/hour (comfortable) |
| **15 min** | **Well within limits, low cost** | **Stale for fast-moving activities** |
| 30 min | Minimal API usage | Too stale for conversation context |

The 15-minute interval balances freshness against API budget. When the simulation
is frozen (current state), the interval could be 1 hour -- nothing is changing.
When the simulation is active, 15 minutes means a citizen might complete 1-3
activities between syncs.

The interval should be configurable via environment variable:
`AIRTABLE_SYNC_INTERVAL_MS=900000`

---

## Airtable Rate Limit Handling

Airtable returns HTTP 429 when rate-limited. The sync module must handle this:

```
On 429 response:
    1. Read Retry-After header (seconds)
    2. Wait that duration
    3. Retry the request
    4. If 3 consecutive 429s, abort sync and log error
    5. Next sync at normal interval (do not double-up)
```

Do not implement exponential backoff. Airtable's Retry-After header is
authoritative. Trust it.

---

## Error Handling

| Failure | Response |
|---|---|
| Airtable API unreachable | Keep serving from stale cache. Log warning. Retry next interval. |
| Single table fetch fails | Complete sync of other tables. Mark failed table as stale. |
| Diff computation error | Skip diff broadcast. Cache still updates. |
| WebSocket broadcast fails | Client reconnects and gets full state on next sync. |
| Cache corruption | Full cache rebuild on next sync (atomic swap handles this). |

The system degrades gracefully. A failed sync does not crash the server. Stale
data is better than no data.

---

## Anti-Patterns

1. **Do not sync on every client request.** The cache exists to absorb read
   load. If the client asks for citizen data, serve from cache. Do not fetch
   from Airtable on demand.

2. **Do not cache selectively.** Fetch all six tables every sync. Partial
   caches create inconsistencies (citizen references a contract that is not
   in cache).

3. **Do not build a custom database.** The temptation to dump Airtable into
   SQLite or Redis is strong. Resist it. The cache is in-memory Maps. If
   the server restarts, it rebuilds from Airtable on first sync. Simplicity
   over durability.

4. **Do not write to CITIZENS, CONTRACTS, BUILDINGS, or ACTIVITIES.** See
   economy/simulation PATTERNS for the ownership boundary. The sync module
   reads these tables. It does not write to them.

5. **Do not parallelize table fetches.** Sequential fetching keeps API call
   rate predictable and debuggable. 7 seconds per sync is fast enough.

---

## Reconciliation with Reality (2026-03-13)

Updated by: Bianca Tassini (@dragon_slayer) — Consciousness Guardian

### The Architecture Has Two Phases Now

The original PATTERNS assumes a running Serenissima simulation writing to Airtable, with Venezia pulling every 15 minutes. **The simulation is currently frozen.** The Serenissima backend is down. Airtable data is static.

This means the entire live sync architecture (rate limiting, pagination, diff computation, retry logic) is **not needed for V1/POC**. It becomes a V2 feature when the simulation restarts.

### V1: Static JSON (Zero API Calls)

Full Airtable data was exported on 2026-03-13 to `venezia/data/`:

| File | Records | Fields | Size |
|---|---|---|---|
| `citizens_full.json` | 152 | 41 (CorePersonality, Ducats, VoiceId, ImagePrompt, Color) | 1.5MB |
| `buildings_full.json` | 274 | 22 (Owner, Occupant, Wages, RentPrice, Position) | 800KB |
| `lands_full.json` | 120 | 12 (polygon points, owner, district) | 350KB |
| `relationships.json` | 1,178 | 5 (citizen pairs, trust scores) | 200KB |
| `guilds.json` | 21 | 8 (membership, treasury) | 50KB |
| `institutions.json` | 5 | 6 (governance structures) | 10KB |
| `resources.json` | 1,396 | 6 (resource inventory) | 250KB |
| `contracts.json` | 46 | 8 (active agreements) | 20KB |

Plus 11 additional files from the serenissima.ai API:

| File | Content | Size |
|---|---|---|
| `building_types.json` | 94 production recipes, construction costs | 73KB |
| `activities.json` | 100 activity definitions | 90KB |
| `transactions.json` | 1,000 recent transactions | 450KB |
| `thoughts.json` | 98 citizen inner thoughts | 406KB |
| `messages.json` | 200 citizen messages | 440KB |
| `stratagems.json` | 43 active stratagems | 43KB |
| `decrees.json` | 20+ governance decrees | 29KB |
| `documents.json` | 21 public documents | 4.4KB |
| `economy.json` | Economy snapshot | 237B |
| `land_owners.json` | 130 parcel ownership records | 18KB |
| `top_influence.json` | 5 top influence leaders | 2.9KB |

**Total: 23 files, ~5.6MB.** This is the complete offline snapshot of Venice.

### V1 Architecture (Simplified)

```
venezia/data/*.json  --(startup)-->  venice-state.js cache  --(ws)-->  Client
                                           |
                                    No sync loop needed.
                                    Data is static.
                                    Load once on server start.
```

`venice-state.js` becomes a simple JSON loader + read API. No scheduler, no Airtable client, no rate limiting, no diff computation. Estimated size: 80-120 lines (down from 300-500).

`serenissima-sync.js` is **deferred to V2**. When the simulation restarts and writes new data to Airtable, the full sync architecture described above becomes necessary.

### V2 Architecture (Original Design)

The original PATTERNS doc describes V2 correctly. When the Serenissima simulation is live again:

```
Airtable (live, updating)  --(15min)-->  venice-state.js  --(ws diff)-->  Client
```

All the patterns — full fetch, diff computation, atomic swap, rate limit handling — apply to V2.

### POC-Mind Validates the Data

The `venezia/scripts/poc_mind_context_assembly.py` script successfully loads citizens, relationships, buildings, computes mood, determines behavior constraints, and assembles system prompts — all from static JSON. This proves the V1 architecture works.

### What Changes for Implementation

| Component | Original Estimate | V1 Estimate | Change |
|---|---|---|---|
| `venice-state.js` | 150-250 lines | 80-120 lines | Load JSON, expose read API, no sync |
| `serenissima-sync.js` | 300-500 lines | **Deferred** | Not needed for static data |
| Airtable npm package | Required | **Not needed** | No API calls |
| Rate limit handling | Required | **Not needed** | No API calls |
| Diff computation | Required | **Deferred** | Static data doesn't change |

### Airtable Credentials

For when V2 is needed, credentials are documented in `SYNC_Sync.md`:
- PAT: `patbbBiN98GWxGs44...` (in Manemus `.env`)
- Base ID: `appkLmnbsEFAZM5rB`
- Export script: `venezia/scripts/export_full_airtable.py`
