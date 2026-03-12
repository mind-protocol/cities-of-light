# VALIDATION: economy/sync -- What Must Be True

**CRITICAL MODULE.** The sync layer is the only bridge between Airtable (source of truth) and the 3D world. If sync fails, the world freezes. If sync drifts, citizens lie about their own state. If sync corrupts, the rendering shows a Venice that does not exist. Every check here is load-bearing.

---

## Invariants (must ALWAYS hold)

### INV-Y1. Cache Never Older Than 30 Minutes

The in-memory cache is acceptable at 15 minutes stale (one sync interval). At 30 minutes, two consecutive syncs have failed. The world is no longer reflecting reality.

```
ASSERT: At any time T:
  age_minutes(cache) <= 30

  IF age_minutes(cache) > 30:
    Log CRITICAL alert
    Flag cache as degraded in health endpoint
    Client should display stale-data indicator
```

The 30-minute hard limit is twice the sync interval. One missed sync is tolerable (Airtable hiccup). Two consecutive misses means the pipeline is broken.

### INV-Y2. All Six Tables Synced

A complete sync must fetch all six tables: CITIZENS, BUILDINGS, CONTRACTS, ACTIVITIES, RELATIONSHIPS, GRIEVANCES. Partial syncs create cross-reference failures -- a citizen references a building not in cache, a contract references a citizen not in cache.

```
ASSERT: After every successful sync:
  cache.citizens.size > 0
  cache.buildings.size > 0
  cache.contracts.size >= 0      (can be empty if no active trades)
  cache.activities.size > 0
  cache.relationships.size > 0
  cache.grievances.size >= 0     (can be empty if no active grievances)
  cache.stale_tables.size == 0
```

CITIZENS and ACTIVITIES are critical tables. If either fails, `perform_full_sync()` returns `success: false` and the old cache is preserved. Non-critical table failures are logged but the sync still succeeds.

### INV-Y3. No Partial Sync State

During a sync cycle, the cache must present either the old complete state or the new complete state. Never a mix. This is enforced by the atomic pointer swap in `swap_cache()`.

```
ASSERT: At no point does a reader see:
  cache.citizens from sync N
  AND cache.buildings from sync N-1

Enforcement: single-assignment swap (server_state.cache = new_cache)
Verification: timestamp on each table's records must be from the same sync cycle
```

JavaScript's single-threaded event loop guarantees this for in-process readers. The risk arises if the cache is serialized to disk or shared across processes. Do not do either.

### INV-Y4. Sync Cycles Do Not Overlap

Only one sync may run at a time. Overlapping syncs would double API call rate (risking 429s) and create race conditions on the cache pointer.

```
ASSERT: At any time:
  count(active_sync_cycles) <= 1

Enforcement: cache.syncInProgress flag
  IF syncInProgress == true at cycle start:
    Skip this cycle, log warning
    ASSERT: this skip happens < 3 times consecutively (else sync is permanently blocked)
```

### INV-Y5. Write Boundary Enforcement

The sync module reads six tables and writes to exactly one: RELATIONSHIPS (TrustScore updates only). Any Airtable write to CITIZENS, BUILDINGS, CONTRACTS, ACTIVITIES, or GRIEVANCES from Venezia code is a boundary violation.

```
ASSERT: All Airtable PATCH/POST calls from the Express server target only:
  Table: RELATIONSHIPS
  Fields: TrustScore, InteractionCount

Any write to other tables: CRITICAL violation, log and block
```

---

## Health Checks

### HC-Y1. Sync Cycle Duration

A full sync fetches ~35 API pages at 200ms intervals. Theoretical duration: ~7 seconds. With network variance: up to 15 seconds. With 429 retries: up to 60 seconds.

```
CHECK: sync_cycle_duration
  HEALTHY: < 15 seconds
  WARN   at: 15-30 seconds (network latency or Airtable slowdown)
  ALERT  at: 30-60 seconds (likely hitting 429 retries)
  CRITICAL at: > 60 seconds (sync may overlap with next cycle)
```

Log the duration of every sync cycle. Track the 95th percentile over the last 24 hours.

### HC-Y2. Airtable API Response Time

Individual API call latency. Airtable typically responds in 200-500ms. Degradation signals upcoming rate limiting or outage.

```
CHECK: airtable_response_time_ms (per call, averaged per sync)
  HEALTHY: < 500ms average
  WARN   at: 500-1000ms average
  ALERT  at: > 1000ms average (Airtable is struggling)

CHECK: airtable_429_count per sync
  HEALTHY: 0
  WARN   at: 1-2 (transient, retry handled it)
  ALERT  at: 3 (max retries hit, table fetch aborted)
```

### HC-Y3. Diff Event Rate

The number of changes detected per sync indicates simulation activity. Zero changes over multiple syncs means either the simulation is frozen (expected when paused) or the diff engine is broken.

```
CHECK: diff_event_count per sync
  HEALTHY: > 0 when simulation is active
  WARN   at: 0 for 3 consecutive syncs while simulation is known to be running
  ALERT  at: 0 for 5 consecutive syncs (diff engine may be comparing identical caches)

CHECK: diff_event_count per sync (upper bound)
  WARN   at: > 500 events (bulk state change, verify this is intentional)
  ALERT  at: > 1000 events (possible cache corruption causing false diffs)
```

### HC-Y4. Cache Size

Cache record counts should be relatively stable. The citizen count is fixed at 152. Building count is ~500. Large deviations indicate data corruption or Airtable schema changes.

```
CHECK: cache.citizens.size
  EXPECTED: 152 (exact)
  WARN   at: deviation > 5 from expected
  ALERT  at: deviation > 20 or size == 0

CHECK: cache.buildings.size
  EXPECTED: ~500
  WARN   at: < 400 or > 600
  ALERT  at: < 200 or > 1000

CHECK: cache.relationships.size
  EXPECTED: ~2000
  WARN   at: < 1500 or > 3000
  ALERT  at: < 500 (data loss) or > 5000 (duplication)
```

### HC-Y5. WebSocket Broadcast Latency

After a sync completes and diffs are computed, the WebSocket broadcast must reach connected clients promptly. Delays mean clients see stale state even after a successful sync.

```
CHECK: ws_broadcast_duration (time from diff computation to last client ACK)
  HEALTHY: < 100ms for up to 10 connected clients
  WARN   at: > 500ms
  ALERT  at: > 2000ms (clients are receiving data too late to animate smoothly)

CHECK: ws_connected_clients
  INFO: log count per sync
  WARN   at: > 50 concurrent clients (consider broadcast throttling)
```

### HC-Y6. Consecutive Sync Failures

Track how many syncs fail in a row. The algorithm aborts a table fetch after 3 consecutive 429s. The master loop logs an alert after 5 consecutive full-sync failures.

```
CHECK: consecutive_sync_failures
  HEALTHY: 0
  WARN   at: 1-2
  ALERT  at: 3-4
  CRITICAL at: >= 5 (cache is stale beyond 75 minutes, world is frozen)
```

---

## Acceptance Criteria

### AC-Y1. Basic Sync Cycle

The sync module must complete a full cycle and populate the cache.

- [ ] All 6 tables fetched from Airtable without errors
- [ ] Cache contains 152 citizens, ~500 buildings, and >0 activities
- [ ] `cache.lastSyncTime` is set to a timestamp within the last 60 seconds
- [ ] `cache.stale_tables` is empty
- [ ] `cache.syncInProgress` is false after completion

### AC-Y2. Diff Detection Accuracy

Changes between sync cycles must be detected and broadcast.

- [ ] Manually modify a citizen's Ducats in Airtable. Next sync detects the change
- [ ] Manually add a new contract in Airtable. Next sync emits a `contract_update` with action `created`
- [ ] Manually delete a grievance in Airtable. Next sync emits an event with action `deleted`
- [ ] Modify a non-significant field (e.g., `updatedAt`). Verify it is NOT broadcast (filtered by `SIGNIFICANT_FIELDS`)

### AC-Y3. Failure Recovery

The sync module must survive Airtable outages gracefully.

- [ ] Simulate Airtable downtime (invalid API key). Cache continues serving stale data
- [ ] Restore Airtable access. Next sync succeeds and cache updates
- [ ] After recovery, diff correctly reflects all changes accumulated during downtime
- [ ] Client receives full state on reconnect (not just the diff)

### AC-Y4. Rate Limit Handling

The sync must respect Airtable's 5 req/sec limit.

- [ ] Monitor outbound API calls: no burst exceeds 5 calls in any 1-second window
- [ ] Trigger a 429 response (by reducing rate limit delay). Sync retries after Retry-After
- [ ] After 3 consecutive 429s on one table, that table is marked stale but sync continues
- [ ] Total API calls per hour stays under 200 (sync reads + trust writes)

### AC-Y5. Cache Consistency Under Load

Simultaneous reads during a sync must not produce inconsistent data.

- [ ] During an active sync, client requests for citizen data return complete records (not partial)
- [ ] The atomic swap occurs in a single event loop tick (no async between old cache deref and new cache assignment)
- [ ] 10 concurrent WebSocket clients all receive the same diff payload after sync

---

## Anti-Patterns

### AP-Y1. Sync Drift -- Cache Diverges From Airtable

**Symptom:** Citizens in the 3D world are at positions that do not match their Airtable records. A merchant claims to have 5000 Ducats but Airtable shows 500. The cache and the truth have diverged.

**Detection:** Periodic spot-check: pick 5 random citizens, fetch their Airtable records directly (outside the sync), compare against cache values. If any field diverges, the cache is drifting.

**Root Cause:** Transform function bug (`transform_record()` misparses a field), incremental cache mutation happening outside the atomic swap, or a stale table being served as fresh because `stale_tables` tracking is broken.

**Mitigation:** Run the spot-check every 30 minutes as a canary. If drift is detected, force a full cache rebuild. Add checksums to the transform output: `sha256(JSON.stringify(transformed))` compared between direct fetch and cache.

### AP-Y2. Rate Limit Exhaustion

**Symptom:** Every sync cycle hits 429s. Tables are frequently marked stale. The cache ages beyond 30 minutes because syncs keep aborting.

**Detection:** Track 429 count per sync. If the 429 count is >0 for 5 consecutive syncs, rate limit budget is exceeded.

**Root Cause:** Trust score writes from conversation interactions are consuming too much of the 300 calls/minute budget. Or the sync interval was reduced below 5 minutes without adjusting the fetch strategy. Or an external process (Serenissima's engine) is competing for the same Airtable base.

**Mitigation:** Monitor total API calls per minute across all sources hitting the same Airtable base. If Serenissima and Venezia share a base, coordinate their call budgets. Batch trust score writes (queue them and flush every 30 seconds instead of writing per-interaction). Increase sync interval if needed.

### AP-Y3. Stale Cache Served As Fresh

**Symptom:** Health endpoint reports cache age as 0 minutes, but data is clearly old.

**Detection:** Compare `cache.lastSyncTime` against wall clock. If `lastSyncTime` advances but cached data does not change, the sync is completing but fetching identical results. Also compare `updatedAt` fields against known simulation tick times.

**Root Cause:** Airtable returning cached results during incidents. Or `perform_full_sync()` writing `lastSyncTime` even when fetches returned stale data.

**Mitigation:** Add data freshness check: if the latest `updatedAt` in cache is older than 2 tick intervals, flag as stale regardless of `lastSyncTime`.

### AP-Y4. Partial Table Failure Corrupting Cross-References

**Symptom:** Activity references a building not in cache. Contract references a missing citizen. 3D renderer places citizens at null positions.

**Detection:** Post-sync cross-reference validation: every activity's `fromBuilding`/`toBuilding` must exist in `cache.buildings`; every activity's `citizenId` must exist in `cache.citizens`; every contract's `seller` must match a citizen username.

**Root Cause:** BUILDINGS fetch failed, sync used stale building data, but ACTIVITIES fetch succeeded with references to new buildings.

**Mitigation:** If any table's staleness exceeds 2 sync intervals, promote it to critical and force a full retry before accepting the sync.

### AP-Y5. WebSocket Broadcast Storm

**Symptom:** After a long outage, first successful sync produces a massive diff overwhelming clients.

**Detection:** Count diff events before broadcasting. Threshold: 200 events.

**Mitigation:** If diff exceeds 200 events, batch into chunks of 50 with 100ms delay. For diffs >500, skip diff broadcast entirely and send `full_state` to all clients.

---

## Data Integrity

### DI-Y1. Cache Record Count Matches Airtable

After every successful sync, the number of records in each cache table must match the number of records in the corresponding Airtable table.

```
PERIODIC CHECK (every sync):
  FOR each table T:
    ASSERT: cache[T].size == airtable_record_count(T)
    Tolerance: 0 (exact match for full-fetch strategy)

  IF cache.citizens.size != 152:
    ALERT: citizen count mismatch (expected 152, got {actual})
```

For the full-fetch strategy, there is no tolerance. Every record in Airtable must appear in the cache. Missing records mean a pagination bug (offset not followed to completion) or a transform error (record skipped due to null key field).

### DI-Y2. Field Type Validation

Transformed cache records must have correct types. Sample 10 records per table every sync.

```
PERIODIC CHECK (every sync, sample 10 records per table):
  Citizens:  ducats is number, socialClass is string, hungerLevel is number [0,100],
             position is null OR {lat: number, lng: number}
  Contracts: pricePerResource, targetAmount, filledAmount are numbers;
             filledAmount <= targetAmount
  Buildings: position is null OR {lat: number, lng: number}; rentPrice is number
```

### DI-Y3. Position Format Validation

Positions are parsed from strings ("45.43,12.33") or GeoJSON. Malformed positions cause citizens and buildings to render at the origin or off-map.

```
PERIODIC CHECK (every sync):
  FOR each citizen in cache.citizens:
    IF citizen.position IS NOT null:
      ASSERT: 45.40 <= citizen.position.lat <= 45.47
      ASSERT: 12.30 <= citizen.position.lng <= 12.38

  FOR each building in cache.buildings:
    IF building.position IS NOT null:
      ASSERT: 45.40 <= building.position.lat <= 45.47
      ASSERT: 12.30 <= building.position.lng <= 12.38

  positions_null_count = count(citizens WHERE position IS null)
  WARN at: positions_null_count > 10 (>5% of citizens without positions)
  ALERT at: positions_null_count > 50 (>25%)
```

### DI-Y4. Timestamp and Diff-Cache Consistency

All `lastSync` timestamps must be from the current sync cycle (within 5000ms of `cache.lastSyncTime`). After swap, diff must be consistent with new cache: created records exist, deleted records do not, updated record fields match.

```
POST-SYNC CHECK:
  FOR event in diff.created: ASSERT cache[event.table].has(event.key)
  FOR event in diff.deleted: ASSERT NOT cache[event.table].has(event.key)
  FOR event in diff.updated: ASSERT cached fields match event.record fields
```
