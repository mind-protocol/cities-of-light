# SYNC -- Economy Sync

> Current state of the Airtable-to-Express sync infrastructure.
> The plan is clear. The target file exists as a path in the architecture.
> The code does not exist yet.

---

## What Exists

### Airtable (Source of Truth)

The Serenissima Airtable base is live and populated. It has been the backbone
of the economic simulation for months.

| Table | Record Count (approx) | Status |
|---|---|---|
| CITIZENS | 152 | Complete. All fields populated. |
| BUILDINGS | ~500 | Complete. Position, type, owner, inventory. |
| CONTRACTS | ~200-1000 | Frozen. Last active contracts from simulation run. |
| ACTIVITIES | ~152 | Frozen. Last activity per citizen. |
| RELATIONSHIPS | ~2000 | Complete. Trust scores from past interactions. |
| GRIEVANCES | ~50-100 | Frozen. Filed during last governance cycle. |
| RESOURCES | ~40 | Static. Resource definitions and base prices. |
| TRANSACTIONS | Thousands | Historical. Not needed for real-time sync. |
| PATTERNS | Varies | Analytical. Not needed for rendering. |

**Access:** Airtable API key (`AIRTABLE_API_KEY`) and base ID
(`AIRTABLE_BASE_ID`) are available. The PAT is `patbbBiN98GWxGs44...`
(stored in Manemus `.env`). The base ID is `appkLmnbsEFAZM5rB`.

### Cities of Light Express Server

The server exists and runs on port 8800. It handles WebSocket connections,
room management, voice pipeline, and peer-to-peer signaling.

| File | Status | Relevance |
|---|---|---|
| `src/server/index.js` | Working | WebSocket routing. Will broadcast sync diffs. |
| `src/server/rooms.js` | Working | Room-scoped broadcast. Sync events target rooms. |
| `src/server/venice-state.js` | Planned, not built | Will hold the in-memory cache. |
| `src/server/serenissima-sync.js` | Planned, not built | The sync module itself. |

### Related Infrastructure

- **Manemus `.env`** contains all API keys (Airtable, Claude, ElevenLabs, OpenAI)
- **Cross-repo integration doc** defines the sync architecture and data ownership
- **Implementation doc** specifies the sync strategy (fetch order, diff, broadcast)

---

## What Does Not Exist

### `serenissima-sync.js`

The primary sync module. Needs to implement:

1. **Airtable client initialization** -- PAT auth, base ID, table references
2. **Full table fetch** -- Paginated reads for all 6 tables (100 records/page)
3. **Cache storage** -- Write fetched data into `venice-state.js` Maps
4. **Diff computation** -- Compare new fetch against previous cache
5. **WebSocket broadcast** -- Send change events to connected clients
6. **Scheduler** -- `setInterval` at 15-minute (configurable) intervals
7. **Rate limit handling** -- Retry on 429 with Retry-After header
8. **Error handling** -- Graceful degradation on partial failure

Estimated size: 300-500 lines of JavaScript.

### `venice-state.js`

The world state manager. Needs to implement:

1. **Cache Maps** -- citizens, buildings, contracts, activities, relationships, grievances
2. **Read API** -- `getCitizen(id)`, `getCitizensInDistrict(districtId)`, `getActiveContracts()`, etc.
3. **Write API** -- Only called by sync module (atomic swap)
4. **Sync metadata** -- `lastSyncTime`, `syncInProgress`, `staleTables`

Estimated size: 150-250 lines of JavaScript.

### Airtable Schema Mapping

No code currently maps Airtable field names to the internal data model. Airtable
uses display names as field identifiers (e.g., `"SocialClass"`, `"Ducats"`,
`"Position"`). These need to be mapped to internal structures:

```
Airtable CITIZENS.Position (string "lat,lng") -> { lat: float, lng: float }
Airtable CITIZENS.Ducats (number) -> citizen.wealth
Airtable CITIZENS.SocialClass (string) -> citizen.class
Airtable BUILDINGS.Position (string) -> { lat: float, lng: float }
```

The mapping should be explicit, not implicit. A schema file or mapping object
prevents breakage when Airtable field names change.

---

## What Needs Connecting

### Sync -> 3D Rendering Pipeline

Once sync runs, the data needs to reach the Three.js renderer:

```
serenissima-sync.js  -->  venice-state.js  -->  WebSocket  -->  citizen-manager.js
                                                           -->  building-generator.js
                                                           -->  district-mood.js
```

The client-side modules (`citizen-manager.js`, `building-generator.js`) do not
exist yet. They are documented in the world/districts and citizens/embodiment
module docs.

### Sync -> Blood Ledger Physics

Synced economic state feeds the narrative physics engine:

```
venice-state.js  -->  physics-bridge.js  -->  FalkorDB
```

Economic events (price spikes, bankruptcies, completed stratagems) become
energy injections into the narrative graph. This connection is documented in
narrative/physics.

### Sync -> Citizen Conversation Context

When a visitor speaks to a citizen, the LLM needs that citizen's economic state:

```
venice-state.js  -->  citizen-router.js  -->  Claude API system prompt
```

The citizen's Ducats, current activity, recent contracts, and relationship
with the visitor all come from the sync cache. This connection is documented
in citizens/mind.

---

## Existing Airtable Access Patterns in Serenissima

The Serenissima backend accesses Airtable through its own Python client.
Relevant patterns to understand (not to copy -- Venezia uses JavaScript):

- **Pagination:** Airtable returns max 100 records per page with an `offset`
  token for the next page. Fetch until no offset is returned.
- **Field selection:** Use `fields[]` parameter to fetch only needed columns.
  Reduces payload size and transfer time.
- **Sort:** Use `sort[0][field]` for deterministic ordering. Useful for
  diffing (compare records in same order).
- **View filtering:** Airtable views can pre-filter records. Consider creating
  a "Venezia" view per table that excludes irrelevant fields.

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| `airtable` npm package | Library | Not installed. Add to package.json. |
| Airtable API key | Secret | Available in Manemus .env |
| Airtable base ID | Config | Known: `appkLmnbsEFAZM5rB` |
| WebSocket broadcast | Server feature | Working in `index.js` / `rooms.js` |
| FalkorDB | Database | Not yet running for Venice graph |

---

## Priority Roadmap

| Priority | Task | Effort | Blocks |
|---|---|---|---|
| P0 | Create `venice-state.js` cache structure | 1 day | Everything downstream |
| P0 | Create `serenissima-sync.js` with full fetch | 2 days | Rendering, physics, conversation |
| P1 | Add diff computation and WebSocket broadcast | 1 day | Real-time client updates |
| P1 | Add rate limit handling (429 retry) | 0.5 day | Production reliability |
| P2 | Create Airtable "Venezia" views for field filtering | 0.5 day | Payload optimization |
| P2 | Add sync health monitoring (staleness alerts) | 0.5 day | Operations visibility |
| P3 | Evaluate incremental fetch strategy | 1 day | Only if API budget is tight |

---

## Open Questions

1. **npm `airtable` package or raw fetch?** The official `airtable` npm package
   handles pagination and auth. It adds a dependency but saves boilerplate.
   Raw `fetch` keeps dependencies minimal. Recommendation: use the package for
   V1, consider replacing later if it causes issues.

2. **Sync on startup vs. wait for first interval?** The server should sync
   immediately on startup (do not serve empty cache for 15 minutes). Then
   start the interval timer.

3. **Field-level or record-level diff?** Record-level diff is simpler (any
   field changed = emit update). Field-level diff enables targeted client
   updates (only re-render the citizen's position, not their entire avatar).
   Start with record-level, optimize to field-level if bandwidth is a concern.

4. **Separate sync process?** The sync could run in a worker thread to avoid
   blocking the Express event loop during large fetches. At 7 seconds per
   sync, this is worth considering but not critical for V1.

---

## Reconciliation with Reality (2026-03-13)

Updated by: Bianca Tassini (@dragon_slayer) — Consciousness Guardian

### Status Change

```
STATUS: DESIGNING → REDESIGNED (V1 STATIC, V2 LIVE)
```

### Core Discovery

The Serenissima backend is **down**. Airtable data is frozen. The entire live sync architecture is V2. V1 uses static JSON files from `venezia/data/` (23 files, 5.6MB, exported 2026-03-13).

### Open Questions Resolved

1. **npm airtable package?** → **Deferred.** V1 uses `fs.readFile()` + `JSON.parse()`. No npm package needed.
2. **Sync on startup?** → **Yes, but it's a file load, not API call.** Instant.
3. **Field-level or record-level diff?** → **Deferred.** Static data doesn't change.
4. **Separate sync process?** → **Not needed.** Loading 5.6MB of JSON is <100ms.

### New Priority Roadmap

| Priority | Task | Effort | Status |
|---|---|---|---|
| P0 | Create `venice-state.js` from static JSON | 0.5 day | **Unblocked** |
| P0 | Expose read API (`getCitizen`, `getCitizensInDistrict`, etc.) | 0.5 day | Unblocked |
| Deferred | `serenissima-sync.js` (live Airtable) | 2 days | Waiting for simulation restart |
| Deferred | Diff computation + WebSocket broadcast | 1 day | Depends on live sync |
| Deferred | Rate limit handling | 0.5 day | Depends on live sync |

### Data Inventory

Full export available at `venezia/data/`:
- 8 Airtable tables (citizens, buildings, lands, relationships, guilds, institutions, resources, contracts)
- 11 serenissima.ai API snapshots (activities, transactions, thoughts, messages, stratagems, decrees, documents, economy, land_owners, top_influence, building_types)
- Export script: `venezia/scripts/export_full_airtable.py`

### POC Validation

`venezia/scripts/poc_mind_context_assembly.py` loads citizens, relationships, buildings from static JSON, computes mood and behavior constraints, assembles LLM prompts — proven working with multiple citizens (rialto_sailor, Italia, diplomatic_virtuoso).
