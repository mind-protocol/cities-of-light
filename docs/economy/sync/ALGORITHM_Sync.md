# ALGORITHM: economy/sync -- How It Works

Pseudocode for every procedure in the sync module. Six Airtable tables are fetched on a 15-minute cycle. Data is transformed into an in-memory cache. Diffs are computed and broadcast via WebSocket. Push writes are limited to trust scores. Error handling freezes the world gracefully. Nothing is hand-waved.

---

## Y1. The Master Sync Loop

The sync loop is the heartbeat of the Venezia Express server. It runs independently of the simulation engine, pulling state from Airtable and making it available to the 3D client in real time.

```
FUNCTION sync_loop():
  # Configuration
  SYNC_INTERVAL_MS = env.AIRTABLE_SYNC_INTERVAL_MS OR 900000  # 15 minutes
  AIRTABLE_API_KEY = env.AIRTABLE_API_KEY
  AIRTABLE_BASE_ID = env.AIRTABLE_BASE_ID

  # State
  current_cache = create_empty_cache()
  consecutive_failures = 0
  MAX_CONSECUTIVE_FAILURES = 5

  # Initial sync on startup
  log("Sync loop starting. Performing initial full sync.")
  initial_result = perform_full_sync(current_cache, AIRTABLE_API_KEY, AIRTABLE_BASE_ID)
  IF initial_result.success:
    current_cache = initial_result.new_cache
    log("Initial sync complete. " + cache_summary(current_cache))
  ELSE:
    log("WARNING: Initial sync failed. Starting with empty cache.")

  # Recurring sync
  WHILE server_is_running:
    sleep(SYNC_INTERVAL_MS)

    result = perform_full_sync(current_cache, AIRTABLE_API_KEY, AIRTABLE_BASE_ID)

    IF result.success:
      old_cache = current_cache
      current_cache = result.new_cache           # Atomic pointer swap
      diff = compute_diff(old_cache, current_cache)
      broadcast_diff(diff)
      consecutive_failures = 0
      log("Sync complete. Changes: " + diff.summary())
    ELSE:
      consecutive_failures += 1
      log("Sync failed (" + consecutive_failures + "/" + MAX_CONSECUTIVE_FAILURES
          + "). Serving stale cache.")
      IF consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
        log("ALERT: " + MAX_CONSECUTIVE_FAILURES + " consecutive sync failures. "
            + "Cache is " + age_minutes(current_cache) + " minutes stale.")
```

---

## Y2. Pull Cycle -- Fetching Six Airtable Tables

### Table Definitions

```
SYNC_TABLES = [
  {
    name:        "citizens",
    airtable:    "CITIZENS",
    key_field:   "CitizenId",
    fields:      ["CitizenId", "Username", "Name", "SocialClass", "Position",
                  "Ducats", "Wealth", "Influence", "Home", "Work", "Occupation",
                  "HungerLevel", "DailyIncome", "DailyExpenses", "UpdatedAt"],
    approx_records: 152,
    approx_pages:   2,
  },
  {
    name:        "buildings",
    airtable:    "BUILDINGS",
    key_field:   "BuildingId",
    fields:      ["BuildingId", "BuildingType", "Name", "Owner", "RunBy",
                  "Occupant", "Category", "Position", "RentPrice",
                  "StorageCapacity", "Point"],
    approx_records: 500,
    approx_pages:   5,
  },
  {
    name:        "contracts",
    airtable:    "CONTRACTS",
    key_field:   "ContractId",
    fields:      ["ContractId", "Type", "Status", "Seller", "Buyer",
                  "SellerBuilding", "ResourceType", "PricePerResource",
                  "TargetAmount", "FilledAmount", "CreatedAt", "EndAt"],
    approx_records: 500,
    approx_pages:   5,
  },
  {
    name:        "activities",
    airtable:    "ACTIVITIES",
    key_field:   "ActivityId",
    fields:      ["ActivityId", "Citizen", "CitizenId", "Type", "Status",
                  "FromBuilding", "ToBuilding", "ResourceType", "Path",
                  "StartDate", "EndDate"],
    approx_records: 152,
    approx_pages:   2,
  },
  {
    name:        "relationships",
    airtable:    "RELATIONSHIPS",
    key_field:   null,               # Uses Airtable record ID as key
    fields:      ["Citizen1", "Citizen2", "TrustScore", "RelationshipType",
                  "InteractionCount"],
    approx_records: 2000,
    approx_pages:   20,
  },
  {
    name:        "grievances",
    airtable:    "GRIEVANCES",
    key_field:   null,
    fields:      ["Title", "Description", "Category", "Status", "Citizen",
                  "SupportCount", "CreatedAt"],
    approx_records: 100,
    approx_pages:   1,
  }
]

# Total estimated API calls: 2 + 5 + 5 + 2 + 20 + 1 = 35 calls
# At 5 req/sec: ~7 seconds per full sync
```

### Full Sync Procedure

```
FUNCTION perform_full_sync(current_cache, api_key, base_id):
  new_cache = create_empty_cache()
  table_results = {}

  FOR table_def IN SYNC_TABLES:
    result = fetch_table_with_rate_limit(api_key, base_id, table_def)

    IF result.success:
      table_results[table_def.name] = result.records
    ELSE:
      # Partial failure: use stale data for this table
      log("WARNING: Failed to fetch " + table_def.airtable
          + ". Using stale data.")
      table_results[table_def.name] = current_cache[table_def.name].values()
      new_cache.stale_tables.add(table_def.name)

  # Transform fetched records into cache maps
  FOR table_name, records IN table_results.items():
    table_def = find_table_def(table_name)
    FOR record IN records:
      cache_key = extract_cache_key(record, table_def)
      transformed = transform_record(record, table_def)
      new_cache[table_name].set(cache_key, transformed)

  new_cache.lastSyncTime = new Date().toISOString()
  new_cache.syncInProgress = false

  # Determine overall success: at least citizens and activities must succeed
  critical_tables_ok = (
    "citizens" NOT IN new_cache.stale_tables
    AND "activities" NOT IN new_cache.stale_tables
  )

  RETURN {
    success: critical_tables_ok,
    new_cache: new_cache
  }
```

### Airtable Fetch with Rate Limit Management

```
FUNCTION fetch_table_with_rate_limit(api_key, base_id, table_def):
  RATE_LIMIT_DELAY_MS = 200    # 5 req/sec = 200ms between requests
  MAX_RETRY_ON_429 = 3

  all_records = []
  offset = null
  consecutive_429 = 0

  LOOP:
    # Build request
    url = "https://api.airtable.com/v0/" + base_id + "/" + table_def.airtable
    headers = { Authorization: "Bearer " + api_key }
    params = {
      pageSize: 100,
      fields:   table_def.fields
    }
    IF offset IS NOT None:
      params.offset = offset

    # Rate limit: wait between requests
    sleep(RATE_LIMIT_DELAY_MS)

    # Execute request
    response = http_get(url, headers, params)

    IF response.status == 200:
      consecutive_429 = 0
      body = parse_json(response.body)
      all_records.extend(body.records)

      IF body.offset IS NOT None:
        offset = body.offset
        CONTINUE    # Fetch next page
      ELSE:
        BREAK       # All pages fetched

    ELSE IF response.status == 429:
      consecutive_429 += 1
      IF consecutive_429 > MAX_RETRY_ON_429:
        log("ERROR: 3 consecutive 429s fetching " + table_def.airtable
            + ". Aborting this table.")
        RETURN { success: false, records: [] }

      retry_after = parse_int(response.headers["Retry-After"]) OR 30
      log("Rate limited on " + table_def.airtable
          + ". Waiting " + retry_after + "s.")
      sleep(retry_after * 1000)
      CONTINUE      # Retry same page

    ELSE:
      log("ERROR: HTTP " + response.status + " fetching " + table_def.airtable)
      RETURN { success: false, records: [] }

  RETURN { success: true, records: all_records }
```

---

## Y3. Data Transformation -- Airtable Records to Cache Schema

Each Airtable record is transformed from Airtable's `{ id, fields, createdTime }` envelope into a flat, typed cache object optimized for rendering lookups.

```
FUNCTION transform_record(airtable_record, table_def):
  fields = airtable_record.fields
  transformed = {}

  SWITCH table_def.name:

    CASE "citizens":
      position = parse_position_string(fields.Position)  # "45.43,12.33" -> {lat, lng}
      transformed = {
        id:            airtable_record.id,
        citizenId:     fields.CitizenId,
        username:      fields.Username,
        name:          fields.Name,
        socialClass:   fields.SocialClass OR "Popolani",
        position:      position,
        ducats:        fields.Ducats OR 0,
        wealth:        fields.Wealth OR 0,
        influence:     fields.Influence OR 0,
        home:          fields.Home,
        work:          fields.Work,
        occupation:    fields.Occupation,
        hungerLevel:   fields.HungerLevel OR 50,
        dailyIncome:   fields.DailyIncome OR 0,
        dailyExpenses: fields.DailyExpenses OR 0,
        updatedAt:     fields.UpdatedAt,
        lastSync:      new Date().toISOString(),
      }

    CASE "buildings":
      point = parse_geojson_point(fields.Point)  # GeoJSON -> {lat, lng}
      transformed = {
        id:              airtable_record.id,
        buildingId:      fields.BuildingId,
        buildingType:    fields.BuildingType,
        name:            fields.Name,
        owner:           fields.Owner,
        runBy:           fields.RunBy,
        occupant:        fields.Occupant,
        category:        fields.Category,
        position:        point,
        rentPrice:       fields.RentPrice OR 0,
        storageCapacity: fields.StorageCapacity OR 0,
        lastSync:        new Date().toISOString(),
      }

    CASE "contracts":
      transformed = {
        id:               airtable_record.id,
        contractId:       fields.ContractId,
        type:             fields.Type,
        status:           fields.Status,
        seller:           fields.Seller,
        buyer:            fields.Buyer,
        sellerBuilding:   fields.SellerBuilding,
        resourceType:     fields.ResourceType,
        pricePerResource: fields.PricePerResource OR 0,
        targetAmount:     fields.TargetAmount OR 0,
        filledAmount:     fields.FilledAmount OR 0,
        createdAt:        fields.CreatedAt,
        endAt:            fields.EndAt,
        lastSync:         new Date().toISOString(),
      }

    CASE "activities":
      path = parse_json_safe(fields.Path)  # JSON string -> array of {lat, lng}
      transformed = {
        id:           airtable_record.id,
        activityId:   fields.ActivityId,
        citizen:      fields.Citizen,
        citizenId:    fields.CitizenId,
        type:         fields.Type,
        status:       fields.Status,
        fromBuilding: fields.FromBuilding,
        toBuilding:   fields.ToBuilding,
        resourceType: fields.ResourceType,
        path:         path,
        startDate:    fields.StartDate,
        endDate:      fields.EndDate,
        lastSync:     new Date().toISOString(),
      }

    CASE "relationships":
      transformed = {
        id:               airtable_record.id,
        citizen1:         fields.Citizen1,
        citizen2:         fields.Citizen2,
        trustScore:       fields.TrustScore OR 50,
        relationshipType: fields.RelationshipType,
        interactionCount: fields.InteractionCount OR 0,
        lastSync:         new Date().toISOString(),
      }

    CASE "grievances":
      transformed = {
        id:           airtable_record.id,
        title:        fields.Title,
        description:  fields.Description,
        category:     fields.Category,
        status:       fields.Status,
        citizen:      fields.Citizen,
        supportCount: fields.SupportCount OR 0,
        createdAt:    fields.CreatedAt,
        lastSync:     new Date().toISOString(),
      }

  RETURN transformed


FUNCTION parse_position_string(position_str):
  # "45.4371,12.3358" -> { lat: 45.4371, lng: 12.3358 }
  IF position_str IS None OR position_str == "":
    RETURN null
  parts = position_str.split(",")
  IF len(parts) != 2:
    RETURN null
  RETURN {
    lat: parseFloat(parts[0].trim()),
    lng: parseFloat(parts[1].trim())
  }


FUNCTION extract_cache_key(record, table_def):
  IF table_def.key_field IS NOT None:
    RETURN record.fields[table_def.key_field] OR record.id
  ELSE:
    RETURN record.id
```

---

## Y4. Diff Computation -- Detecting Changes Between Sync Cycles

The diff engine compares the previous cache against the new cache. It produces a list of change events that the WebSocket layer broadcasts to connected clients.

```
FUNCTION compute_diff(old_cache, new_cache):
  diff = {
    created: [],
    updated: [],
    deleted: [],
    summary_counts: {}
  }

  FOR table_name IN SYNC_TABLES.map(t => t.name):
    old_map = old_cache[table_name]
    new_map = new_cache[table_name]
    table_created = 0
    table_updated = 0
    table_deleted = 0

    # Detect created and updated records
    FOR [key, new_record] IN new_map.entries():
      old_record = old_map.get(key)

      IF old_record IS None:
        # New record: did not exist in previous cache
        diff.created.push({
          table:  table_name,
          key:    key,
          record: new_record,
        })
        table_created += 1

      ELSE:
        # Existing record: check for field changes
        changed_fields = detect_field_changes(old_record, new_record, table_name)
        IF len(changed_fields) > 0:
          diff.updated.push({
            table:          table_name,
            key:            key,
            record:         new_record,
            changed_fields: changed_fields,
            previous:       extract_previous_values(old_record, changed_fields),
          })
          table_updated += 1

    # Detect deleted records
    FOR [key, old_record] IN old_map.entries():
      IF NOT new_map.has(key):
        diff.deleted.push({
          table:  table_name,
          key:    key,
          record: old_record,
        })
        table_deleted += 1

    diff.summary_counts[table_name] = {
      created: table_created,
      updated: table_updated,
      deleted: table_deleted,
    }

  RETURN diff


FUNCTION detect_field_changes(old_record, new_record, table_name):
  # Compare all fields except metadata (lastSync)
  SKIP_FIELDS = ["lastSync"]
  changed = []

  FOR field IN Object.keys(new_record):
    IF field IN SKIP_FIELDS:
      CONTINUE
    IF NOT deep_equal(old_record[field], new_record[field]):
      changed.push(field)

  RETURN changed


FUNCTION extract_previous_values(old_record, changed_fields):
  previous = {}
  FOR field IN changed_fields:
    previous[field] = old_record[field]
  RETURN previous
```

### Significant Change Detection

Not all changes warrant a WebSocket broadcast. Minor field updates (e.g., lastSync timestamp) are filtered out. Only changes that affect the 3D rendering or conversation context are broadcast.

```
SIGNIFICANT_FIELDS = {
  "citizens":      ["position", "socialClass", "ducats", "occupation",
                    "hungerLevel", "home", "work"],
  "buildings":     ["owner", "runBy", "occupant", "category"],
  "contracts":     ["status", "pricePerResource", "targetAmount", "filledAmount"],
  "activities":    ["type", "status", "fromBuilding", "toBuilding", "path"],
  "relationships": ["trustScore", "relationshipType"],
  "grievances":    ["status", "supportCount"],
}

FUNCTION has_significant_changes(change_event):
  table = change_event.table
  significant = SIGNIFICANT_FIELDS.get(table, [])
  RETURN any(field IN significant FOR field IN change_event.changed_fields)
```

---

## Y5. WebSocket Broadcast -- Pushing Changes to Connected Clients

### Event Type Mapping

```
FUNCTION broadcast_diff(diff):
  FOR event IN diff.created:
    IF NOT has_significant_changes_for_creation(event):
      CONTINUE
    ws_event = map_to_ws_event(event, "created")
    broadcast_to_room(ws_event, get_district(event.record))

  FOR event IN diff.updated:
    IF NOT has_significant_changes(event):
      CONTINUE
    ws_event = map_to_ws_event(event, "updated")
    broadcast_to_room(ws_event, get_district(event.record))

  FOR event IN diff.deleted:
    ws_event = map_to_ws_event(event, "deleted")
    broadcast_to_room(ws_event, get_district(event.record))


FUNCTION map_to_ws_event(change_event, change_type):
  table = change_event.table
  record = change_event.record

  SWITCH table:
    CASE "citizens":
      RETURN {
        type:     "citizen_update",
        action:   change_type,
        citizen:  {
          id:          record.citizenId,
          username:    record.username,
          name:        record.name,
          position:    record.position,
          activity:    lookup_current_activity(record.citizenId),
          socialClass: record.socialClass,
          ducats:      record.ducats,
        },
        changed:  change_event.changed_fields,
        previous: change_event.previous,
      }

    CASE "buildings":
      RETURN {
        type:     "building_update",
        action:   change_type,
        building: {
          id:           record.buildingId,
          buildingType: record.buildingType,
          owner:        record.owner,
          occupant:     record.occupant,
          position:     record.position,
        },
        changed:  change_event.changed_fields,
      }

    CASE "contracts":
      RETURN {
        type:     "contract_update",
        action:   change_type,
        contract: {
          id:           record.contractId,
          contractType: record.type,
          status:       record.status,
          seller:       record.seller,
          resourceType: record.resourceType,
          price:        record.pricePerResource,
        },
        changed:  change_event.changed_fields,
      }

    CASE "grievances":
      RETURN {
        type:       "event_alert",
        alertType:  "governance",
        grievance:  {
          id:           record.id,
          title:        record.title,
          category:     record.category,
          status:       record.status,
          supportCount: record.supportCount,
          citizen:      record.citizen,
        },
        changed:    change_event.changed_fields,
      }

    CASE "activities":
      RETURN {
        type:     "citizen_update",
        action:   "activity_changed",
        activity: {
          id:           record.activityId,
          citizen:      record.citizen,
          activityType: record.type,
          status:       record.status,
          path:         record.path,
          fromBuilding: record.fromBuilding,
          toBuilding:   record.toBuilding,
        },
      }

    DEFAULT:
      RETURN {
        type:    "data_update",
        table:   table,
        action:  change_type,
        record:  record,
      }
```

### Room-Based Broadcasting

```
FUNCTION broadcast_to_room(ws_event, district):
  # In V1 (single-player): broadcast to all connected clients
  # In V2 (multi-player): broadcast only to clients in the same district

  FOR client IN websocket_server.connected_clients:
    IF client.ready_state == OPEN:
      client.send(JSON.stringify(ws_event))


FUNCTION get_district(record):
  # Determine which district a record belongs to based on position
  IF record.position IS NOT None:
    RETURN find_district_for_position(record.position)
  RETURN "global"  # Broadcast to all districts if no position
```

---

## Y6. Push Cycle -- Writing Back to Airtable

Venezia writes to Airtable in exactly two cases. All other tables are read-only.

### Trust Score Update

```
FUNCTION push_trust_score_update(citizen1_username, citizen2_username,
                                  new_trust_score, interaction_type):
  # Find the relationship record
  formula = OR(
    AND({Citizen1} = citizen1_username, {Citizen2} = citizen2_username),
    AND({Citizen1} = citizen2_username, {Citizen2} = citizen1_username)
  )
  records = airtable.table(BASE_ID, "RELATIONSHIPS").all(formula=formula)

  IF len(records) > 0:
    # Update existing relationship
    record = records[0]
    airtable.table(BASE_ID, "RELATIONSHIPS").update(record.id, {
      TrustScore:       new_trust_score,
      InteractionCount: (record.fields.InteractionCount OR 0) + 1,
    })
  ELSE:
    # Create new relationship record
    airtable.table(BASE_ID, "RELATIONSHIPS").create({
      Citizen1:         citizen1_username,
      Citizen2:         citizen2_username,
      TrustScore:       new_trust_score,
      RelationshipType: "visitor_encounter",
      InteractionCount: 1,
    })

  # Queue a local cache update so the diff picks it up on next sync
  queue_local_cache_update("relationships", {
    citizen1:    citizen1_username,
    citizen2:    citizen2_username,
    trustScore:  new_trust_score,
  })

  RETURN True
```

### Memory Write (Filesystem, Not Airtable)

```
FUNCTION push_memory_update(citizen_cascade_path, visitor_id, memory_entry):
  # Memories are written to the citizen's .cascade/memories/ directory.
  # This is a filesystem write, NOT an Airtable write.

  filepath = citizen_cascade_path + "/memories/" + memory_entry.timestamp + ".json"
  write_json_file(filepath, memory_entry)

  # Update the citizen's memory index
  index_path = citizen_cascade_path + "/memories/index.json"
  index = read_json_file(index_path) OR []
  index.push({
    file:      filepath,
    visitor:   visitor_id,
    timestamp: memory_entry.timestamp,
    heat:      memory_entry.heat,
    summary:   memory_entry.summary.substring(0, 100),
  })
  write_json_file(index_path, index)

  RETURN filepath
```

---

## Y7. Cache Structure

### In-Memory Cache Object

```
CACHE = {
  citizens:       new Map(),    # key: CitizenId      -> transformed citizen record
  buildings:      new Map(),    # key: BuildingId      -> transformed building record
  contracts:      new Map(),    # key: ContractId      -> transformed contract record
  activities:     new Map(),    # key: ActivityId      -> transformed activity record
  relationships:  new Map(),    # key: airtable_id     -> transformed relationship record
  grievances:     new Map(),    # key: airtable_id     -> transformed grievance record
  lastSyncTime:   null,         # ISO timestamp of last successful sync completion
  syncInProgress: false,        # Guard against overlapping syncs
  stale_tables:   new Set(),    # Tables that failed to fetch on last sync
}
```

### Cache Creation

```
FUNCTION create_empty_cache():
  RETURN {
    citizens:       new Map(),
    buildings:      new Map(),
    contracts:      new Map(),
    activities:     new Map(),
    relationships:  new Map(),
    grievances:     new Map(),
    lastSyncTime:   null,
    syncInProgress: false,
    stale_tables:   new Set(),
  }
```

### Atomic Swap Procedure

```
FUNCTION swap_cache(server_state, new_cache):
  # The swap is a single assignment. JavaScript's single-threaded event loop
  # guarantees that no reader sees a partially constructed cache.

  # Before swap: all readers see old cache
  old_cache = server_state.cache

  # The swap: one pointer assignment
  server_state.cache = new_cache

  # After swap: all readers see new cache
  # Old cache is eligible for garbage collection

  RETURN old_cache  # Returned for diff computation
```

### Staleness Detection

```
FUNCTION cache_is_stale(cache, threshold_minutes):
  IF cache.lastSyncTime IS None:
    RETURN True

  age_ms = Date.now() - Date.parse(cache.lastSyncTime)
  age_minutes = age_ms / (1000 * 60)

  RETURN age_minutes > threshold_minutes


FUNCTION age_minutes(cache):
  IF cache.lastSyncTime IS None:
    RETURN Infinity
  age_ms = Date.now() - Date.parse(cache.lastSyncTime)
  RETURN Math.floor(age_ms / (1000 * 60))


FUNCTION cache_summary(cache):
  RETURN (
    "citizens=" + cache.citizens.size
    + " buildings=" + cache.buildings.size
    + " contracts=" + cache.contracts.size
    + " activities=" + cache.activities.size
    + " relationships=" + cache.relationships.size
    + " grievances=" + cache.grievances.size
    + " stale=" + Array.from(cache.stale_tables).join(",")
  )
```

---

## Y8. Cache Query Functions

The 3D client, citizen router, and physics bridge all read from cache through these query functions. They never query Airtable directly.

```
FUNCTION get_citizen_from_cache(cache, citizen_id):
  RETURN cache.citizens.get(citizen_id) OR null


FUNCTION get_citizens_in_district(cache, district_bounds):
  # district_bounds = { minLat, maxLat, minLng, maxLng }
  results = []
  FOR [id, citizen] IN cache.citizens.entries():
    IF citizen.position IS NOT None
       AND citizen.position.lat >= district_bounds.minLat
       AND citizen.position.lat <= district_bounds.maxLat
       AND citizen.position.lng >= district_bounds.minLng
       AND citizen.position.lng <= district_bounds.maxLng:
      results.push(citizen)
  RETURN results


FUNCTION get_active_contracts_for_resource(cache, resource_type):
  results = []
  FOR [id, contract] IN cache.contracts.entries():
    IF contract.status == "active"
       AND contract.resourceType == resource_type:
      results.push(contract)
  RETURN results


FUNCTION get_citizen_activity(cache, citizen_id):
  FOR [id, activity] IN cache.activities.entries():
    IF activity.citizenId == citizen_id
       AND activity.status != "processed"
       AND activity.status != "failed":
      RETURN activity
  RETURN null


FUNCTION get_trust_between(cache, citizen1, citizen2):
  FOR [id, rel] IN cache.relationships.entries():
    IF (rel.citizen1 == citizen1 AND rel.citizen2 == citizen2)
       OR (rel.citizen1 == citizen2 AND rel.citizen2 == citizen1):
      RETURN rel.trustScore
  RETURN 50  # Default neutral trust


FUNCTION get_active_grievances(cache):
  results = []
  FOR [id, grievance] IN cache.grievances.entries():
    IF grievance.status == "filed":
      results.push(grievance)
  RETURN results


FUNCTION get_buildings_by_type(cache, building_type):
  results = []
  FOR [id, building] IN cache.buildings.entries():
    IF building.buildingType == building_type:
      results.push(building)
  RETURN results
```

---

## Y9. Error Handling -- Graceful Degradation

### Error Response Matrix

```
ERROR_RESPONSES = {
  "airtable_unreachable": {
    action:       "serve_stale_cache",
    log_level:    "warning",
    retry:        "next_interval",
    client_effect: "none (world looks slightly static)"
  },
  "single_table_fetch_fails": {
    action:       "complete_other_tables, mark_failed_table_stale",
    log_level:    "warning",
    retry:        "next_interval",
    client_effect: "data for that domain may be slightly old"
  },
  "rate_limited_429": {
    action:       "read_retry_after, wait, retry_up_to_3_times",
    log_level:    "info",
    retry:        "immediate_with_backoff",
    client_effect: "sync takes longer but completes"
  },
  "diff_computation_error": {
    action:       "skip_diff_broadcast, cache_still_updates",
    log_level:    "error",
    retry:        "next_interval",
    client_effect: "no smooth transitions this cycle, next cycle corrects"
  },
  "websocket_broadcast_fails": {
    action:       "client_reconnects_on_next_sync",
    log_level:    "warning",
    retry:        "none (client-initiated)",
    client_effect: "brief stale period until reconnect"
  },
  "cache_corruption": {
    action:       "full_rebuild_on_next_sync (atomic swap handles this)",
    log_level:    "error",
    retry:        "next_interval",
    client_effect: "one cycle of stale data, then recovers"
  }
}
```

### Graceful Freeze Procedure

```
FUNCTION handle_airtable_down(current_cache, error):
  # Do NOT crash. Do NOT clear the cache. Do NOT notify the client.
  # The world simply stops changing.

  log("WARNING: Airtable unreachable. Error: " + error.message)
  log("Serving stale cache. Age: " + age_minutes(current_cache) + " minutes.")

  # The cache pointer remains unchanged.
  # All client reads continue to work.
  # Citizens stay at their last known positions.
  # Activities remain in their last known state.
  # The 3D world looks like a quiet moment -- not a failure.

  # When Airtable comes back, the next sync picks up all accumulated changes.
  # The diff will be large. The world "wakes up."

  RETURN  # Nothing to do. The cache survives by doing nothing.
```

### Client Reconnection After Outage

```
FUNCTION handle_client_reconnect(client, cache):
  # When a client reconnects (after websocket drop or page reload),
  # send the full current state, not a diff.

  full_state = {
    type:       "full_state",
    citizens:   Array.from(cache.citizens.values()),
    buildings:  Array.from(cache.buildings.values()),
    contracts:  Array.from(cache.contracts.values()),
    activities: Array.from(cache.activities.values()),
    grievances: Array.from(cache.grievances.values()),
    syncTime:   cache.lastSyncTime,
  }

  client.send(JSON.stringify(full_state))
  log("Sent full state to reconnected client. "
      + cache.citizens.size + " citizens, "
      + cache.buildings.size + " buildings.")
```

---

## Y10. Timing and Sequence Diagram

```
SEQUENCE: One Complete Sync Cycle

  T+0s     sync_loop wakes up
  T+0.2s   fetch CITIZENS page 1        (API call 1)
  T+0.4s   fetch CITIZENS page 2        (API call 2)
  T+0.6s   fetch BUILDINGS page 1       (API call 3)
  T+0.8s   fetch BUILDINGS page 2       (API call 4)
  T+1.0s   fetch BUILDINGS page 3       (API call 5)
  T+1.2s   fetch BUILDINGS page 4       (API call 6)
  T+1.4s   fetch BUILDINGS page 5       (API call 7)
  T+1.6s   fetch CONTRACTS page 1       (API call 8)
  ...       (5 pages)                    (API calls 9-12)
  T+2.4s   fetch ACTIVITIES page 1      (API call 13)
  T+2.6s   fetch ACTIVITIES page 2      (API call 14)
  T+2.8s   fetch RELATIONSHIPS page 1   (API call 15)
  ...       (20 pages)                   (API calls 16-34)
  T+6.8s   fetch GRIEVANCES page 1      (API call 35)
  T+7.0s   all tables fetched

  T+7.0s   transform all records         (~50ms for 3000 records)
  T+7.05s  swap cache                    (atomic, <1ms)
  T+7.05s  compute diff                  (~20ms)
  T+7.07s  broadcast diff via WebSocket  (~5ms per connected client)
  T+7.1s   sync cycle complete

  Total wall time: ~7 seconds
  Next sync in: 15 minutes - 7 seconds = 14 minutes 53 seconds
```

### API Call Budget

```
BUDGET PER HOUR:
  Sync reads:    35 calls * 4 syncs/hour = 140 calls/hour
  Trust writes:  ~12 calls/hour (1 conversation every 5 minutes)
  Total:         ~152 calls/hour
  Airtable limit: 18,000 calls/hour (300/minute)
  Utilization:   0.84%

  Conclusion: No rate limit concern at current scale.
```
