# IMPLEMENTATION: economy/simulation -- Code Architecture

Where the simulation code lives. Which Python files to import or adapt. How Venezia observes the economy without controlling it. Cron and daemon setup for reactivation. API endpoints exposed. File paths in both repos.

---

## Principle: Observe, Don't Control

Venezia reads from the Serenissima simulation. It never writes to it. The economic simulation runs independently in the `serenissima` repo as a Python backend. Venezia consumes its outputs via Airtable reads and filesystem reads to render the economy in 3D. The simulation ticks on its own schedule; Venezia syncs on its own.

```
serenissima/backend/engine/     ← SIMULATION ENGINE (Python, writes to Airtable)
cities-of-light/src/server/     ← VENEZIA SERVER (Node.js, reads from Airtable)

Direction of data:
  serenissima writes → Airtable ← cities-of-light reads
  serenissima writes → .cascade/ filesystem ← cities-of-light reads
```

---

## Serenissima Backend File Map

### Entry Points

```
serenissima/backend/app/main.py              ← FastAPI app, imports scheduler, registers routes
serenissima/backend/app/scheduler.py         ← Master scheduler loop (run_scheduled_tasks)
serenissima/backend/engine/createActivities.py   ← Phase 2: idle citizen → activity dispatch
serenissima/backend/engine/processActivities.py  ← Phase 1: concluded activity → processor
serenissima/backend/engine/processStratagems.py  ← Phase 3: active stratagem → processor
```

### Scheduler Architecture

`scheduler.py` drives the simulation tick cycle. It runs as a background thread started by `main.py` via `start_scheduler_background()`. Each tick spawns subprocess calls to the activity scripts.

```python
# serenissima/backend/app/scheduler.py
def run_scheduled_tasks(forced_hour: Optional[int] = None):
    """
    Infinite loop. Runs activity creation and processing scripts
    on a 5-minute interval. Checks Venice time for day/night phases.
    """
    from backend.engine.utils.activity_helpers import VENICE_TIMEZONE

    while True:
        now_venice = datetime.now(timezone.utc).astimezone(VENICE_TIMEZONE)
        # Subprocess calls to:
        #   engine/createActivities.py
        #   engine/processActivities.py
        #   engine/processStratagems.py
        #   engine/createimportactivities.py
        #   engine/createmarketgalley.py
        #   engine/daily/gradient_mill_production.py
        #   reports/createReports.py
        time.sleep(300)  # 5-minute interval
```

Scripts that respect `--hour` override (for testing/debugging):

```python
# serenissima/backend/app/scheduler.py, module level
SCRIPTS_RESPECTING_FORCED_HOUR = [
    "engine/createActivities.py",
    "engine/processActivities.py",
    "engine/createimportactivities.py",
    "engine/createmarketgalley.py",
    "relevancies/gatherInformation.py",
    "engine/processStratagems.py",
    "reports/createReports.py",
    "engine/emergency_food_distribution_charity_contracts.py",
    "engine/daily/gradient_mill_production.py",
]
```

### Activity Processor Registry

95 processor files in `serenissima/backend/engine/activity_processors/`. Each file exports a single function that takes `(tables, activity_record, building_type_defs, resource_defs)` and returns `bool`.

Key processors for Venezia rendering:

| Processor File | Activity Type | Venezia Visual |
|---|---|---|
| `production_processor.py` | `production` | Citizen at workshop, smoke/sparks |
| `eat_processor.py` | `eat` | Citizen at table, food model |
| `rest_processor.py` | `rest` | Citizen at home, lights dim |
| `deliver_resource_batch_processor.py` | `deliver_resource_batch` | Citizen walking with cargo |
| `leave_venice_processor.py` | `leave_venice` | Citizen walks to dock, boards galley |
| `construct_building_processor.py` | `construct_building` | Scaffolding, worker animation |
| `drink_at_inn_activity_processor.py` | `drink_at_inn` | Citizen at inn, mug prop |
| `attend_theater_performance_processor.py` | `attend_theater_performance` | Citizen at theater, seated |
| `pray_processor.py` | `pray` | Citizen at church, kneeling |
| `talk_publicly_processor.py` | `talk_publicly` | Citizen in piazza, gesture animation |
| `spread_rumor_activity_processor.py` | `spread_rumor` | Citizens whispering, proximity check |
| `support_grievance_processor.py` | `support_grievance` | Citizen near Doge's Palace |
| `process_work_on_art.py` | `work_on_art` | Citizen at easel/chisel animation |
| `fishing_processor.py` | `fishing` | Citizen at docks, fishing rod prop |

### Activity Creator Registry

91 creator files in `serenissima/backend/engine/activity_creators/`. Each exports a `try_create_*` function that returns an activity dict or `None`.

The master dispatch lives in `createActivities.py`:

```python
# serenissima/backend/engine/createActivities.py
from backend.engine.activity_creators import (
    try_create_stay_activity,
    try_create_goto_work_activity,
    try_create_goto_home_activity,
    try_create_travel_to_inn_activity,
    try_create_idle_activity,
    try_create_production_activity,
    try_create_resource_fetching_activity,
    try_create_eat_from_inventory_activity,
    try_create_eat_at_home_activity,
    try_create_eat_at_tavern_activity,
    try_create_fetch_from_galley_activity,
)
```

Priority chain is in the `determine_next_activity()` function (see ALGORITHM_Simulation.md S3).

### Stratagem Processors

Imported in `main.py`:

```python
# serenissima/backend/app/main.py
from backend.engine.stratagem_creators import (
    try_create_undercut_stratagem,
    try_create_coordinate_pricing_stratagem,
    try_create_hoard_resource_stratagem,
    try_create_political_campaign_stratagem,
    try_create_reputation_assault_stratagem,
    try_create_emergency_liquidation_stratagem,
    try_create_cultural_patronage_stratagem,
    try_create_information_network_stratagem,
    try_create_maritime_blockade_stratagem,
    try_create_canal_mugging_stratagem,
    try_create_marketplace_gossip_stratagem,
)
```

### Handler System

Handlers in `serenissima/backend/engine/handlers/` encapsulate citizen decision logic by domain:

| Handler File | Domain | Used By |
|---|---|---|
| `needs.py` | Eating, rest, survival | Activity creation priority 1-2 |
| `work.py` | Production, fetching, logistics | Activity creation priority 3 |
| `governance.py` | Rule-based grievance filing/support | Activity creation priority 4 |
| `governance_kinos.py` | KinOS-enhanced grievance filing | Activity creation priority 4 (alternative) |
| `leisure.py` | Theater, inn, art, prayer, baths | Activity creation priority 5 |
| `management.py` | Contracts, land bids, imports | Activity creation priority 6 |
| `social.py` | Messaging, rumor spreading | Social interactions |
| `inventory.py` | Storage management | Cross-cutting |
| `orchestrator.py` | Dispatch coordination | Master loop helper |

### Daily Processing Scripts

```
serenissima/backend/engine/dailywages.py                 ← process_daily_wages
serenissima/backend/engine/dailyrentpayments.py          ← process_daily_rent_payments
serenissima/backend/engine/dailyloanpayments.py          ← process_daily_loan_payments
serenissima/backend/engine/calculateIncomeAndTurnover.py ← calculate_citizen_financials
serenissima/backend/engine/citizensgetjobs.py            ← update employment assignments
serenissima/backend/engine/citizenhousingmobility.py     ← housing market moves
serenissima/backend/engine/citizenworkmobility.py        ← job market moves
serenissima/backend/engine/immigration.py                ← new citizen entry/exit
serenissima/backend/engine/househomelesscitizens.py      ← emergency housing
serenissima/backend/engine/distributeLeases.py           ← building lease management
serenissima/backend/engine/daily/gradient_mill_production.py ← automated production
```

### Shared Utilities

```python
# serenissima/backend/engine/utils/activity_helpers.py
# Exports:
VENICE_TIMEZONE          # pytz timezone for Europe/Rome
LogColors                # ANSI color constants for logging
log_header               # Formatted section headers
_escape_airtable_value   # Airtable formula escaping
_get_building_position_coords  # Building → {lat, lng}
_calculate_distance_meters     # Haversine between two positions
get_resource_types_from_api    # Fetch resource definitions
get_building_types_from_api    # Fetch building type definitions
```

### Consciousness Layer

```
serenissima/backend/the-code/theSynthesis.py
```

Runs at 3:33 AM Venice time. Aggregates all citizen emotional/behavioral data from the past day. Calls KinOS API to generate collective consciousness report. Updates atmosphere parameters for the next day.

```python
# serenissima/backend/the-code/theSynthesis.py
# KinOS API call:
KINOS_BASE_URL = "https://api.kinos-engine.ai/v2/blueprints/serenissima-ai"
# Endpoint: POST {KINOS_BASE_URL}/{citizen_username}/kins/{channel}/messages
# Channel: "governance" for governance decisions, "synthesis" for daily synthesis
```

---

## Airtable Schema (Source of Truth)

Base ID: `appkLmnbsEFAZM5rB` (or as configured in `AIRTABLE_BASE_ID`)

### Tables Relevant to Simulation

| Table | Primary Key | Approx Records | Write Frequency |
|---|---|---|---|
| CITIZENS | CitizenId | 186 | Every tick (position, ducats, hunger) |
| BUILDINGS | BuildingId | ~500 | Daily (ownership, rent) |
| CONTRACTS | ContractId | ~500 | Every tick (fill amounts, prices) |
| ACTIVITIES | ActivityId | ~186 active | Every tick (create/process/fail) |
| RESOURCES | ResourceId | ~2000 | Every tick (inventory changes) |
| TRANSACTIONS | TransactionId | Growing | Every tick (financial transfers) |
| RELATIONSHIPS | Airtable ID | ~2000 | On interaction |
| GRIEVANCES | GrievanceId | ~100 | On governance events |
| STRATAGEMS | StratagemId | ~50 active | Every tick |
| LANDS | LandId | ~100 | On purchase/transfer |
| PATTERNS | PatternId | ~50 | Daily (theSynthesis) |

### Airtable SDK Usage (Python Side)

```python
# serenissima uses pyairtable
from pyairtable import Api, Table

api = Api(os.getenv("AIRTABLE_API_KEY"))
citizens_table = api.table(os.getenv("AIRTABLE_BASE_ID"), "CITIZENS")

# Read all citizens
all_citizens = citizens_table.all()

# Read with formula filter
idle = citizens_table.all(
    formula="AND({Status} != 'processed', {Status} != 'failed')"
)

# Update a record
citizens_table.update(record_id, {"Ducats": new_amount})

# Create a record
citizens_table.create({"CitizenId": "cit_xxx", "Name": "Marco", ...})
```

---

## Venezia Integration: How the Express Server Reads Simulation State

### serenissima-sync.js (Not Yet Created)

This file will live at `cities-of-light/src/server/serenissima-sync.js`. It reads Airtable on a 15-minute interval using the `airtable` npm package (to be added). See `IMPLEMENTATION_Sync.md` for full details.

### venice-state.js (Not Yet Created)

This file will live at `cities-of-light/src/server/venice-state.js`. It holds the in-memory cache as a set of `Map` objects. The sync module writes to it; the 3D client reads from it via WebSocket events.

### What Venezia Reads From the Simulation

```javascript
// cities-of-light/src/server/venice-state.js (planned)

// Venezia reads these fields per citizen:
const CITIZEN_FIELDS_FOR_RENDERING = [
  "CitizenId",        // Unique ID, map to 3D avatar
  "Username",         // Display name / conversation routing
  "Name",             // Full name for UI
  "SocialClass",      // Determines clothing, behavior tier
  "Position",         // "lat,lng" string → 3D world coords
  "Ducats",           // Wealth indicator → visual props
  "Occupation",       // Determines work animations
  "HungerLevel",      // Affects mood expression
  "DailyIncome",      // Economic health indicator
  "DailyExpenses",    // Economic health indicator
];

// Venezia reads these fields per activity:
const ACTIVITY_FIELDS_FOR_RENDERING = [
  "ActivityId",       // Unique ID
  "Citizen",          // Who is doing this
  "CitizenId",        // Custom ID for citizen lookup
  "Type",             // Determines animation (production, eat, pray, ...)
  "Status",           // created/in_progress/processed/failed
  "FromBuilding",     // Source location (for path rendering)
  "ToBuilding",       // Destination (for path rendering)
  "Path",             // JSON array of {lat, lng} → walking path
  "StartDate",        // When animation begins
  "EndDate",          // When animation ends
];
```

### Activity Type to Animation Mapping

```javascript
// cities-of-light/src/client/citizens/citizen-manager.js (planned)

const ACTIVITY_ANIMATIONS = {
  // Survival
  "eat":              { anim: "sitting_eat",   props: ["food_bowl"] },
  "rest":             { anim: "sleeping",      props: [] },
  "goto_home":        { anim: "walking",       props: [] },
  "goto_work":        { anim: "walking",       props: [] },

  // Production
  "production":       { anim: "working",       props: ["workshop_tool"] },
  "fishing":          { anim: "fishing",       props: ["fishing_rod"] },
  "construct_building": { anim: "hammering",   props: ["scaffold"] },

  // Trade
  "fetch_resource":           { anim: "walking_cargo",  props: ["cargo_bundle"] },
  "deliver_resource_batch":   { anim: "walking_cargo",  props: ["cargo_bundle"] },
  "deliver_resource_to_buyer":{ anim: "walking_cargo",  props: ["cargo_bundle"] },
  "pickup_from_galley":       { anim: "walking_cargo",  props: ["cargo_crate"] },

  // Leisure
  "drink_at_inn":             { anim: "sitting_drink",  props: ["mug"] },
  "attend_theater_performance":{ anim: "sitting_watch", props: [] },
  "work_on_art":              { anim: "painting",       props: ["easel"] },
  "read_book":                { anim: "sitting_read",   props: ["book"] },
  "pray":                     { anim: "kneeling",       props: [] },
  "use_public_bath":          { anim: "idle_relaxed",   props: [] },

  // Social
  "talk_publicly":            { anim: "talking",        props: [] },
  "spread_rumor":             { anim: "whispering",     props: [] },
  "send_message":             { anim: "writing",        props: ["paper"] },

  // Governance
  "file_grievance":           { anim: "presenting",     props: ["scroll"] },
  "support_grievance":        { anim: "rally",          props: [] },

  // Default
  "idle":                     { anim: "standing_idle",  props: [] },
};
```

---

## Simulation Reactivation: Cron and Daemon Setup

### Current Production Setup (Serenissima)

The simulation runs on Render as a web service. The FastAPI app starts the scheduler as a background thread on boot.

```python
# serenissima/backend/app/main.py
@app.on_event("startup")
async def startup_event():
    start_scheduler_background()
```

`start_scheduler_background()` spawns `run_scheduled_tasks()` in a daemon thread that loops indefinitely.

### Reactivation After Downtime

When the Render service restarts (deploy, crash, or scale event):

1. FastAPI startup event fires
2. Scheduler thread starts
3. First tick runs immediately (no warm-up delay)
4. Idle citizens get new activities
5. Concluded activities get processed

No cron is involved. The scheduler is self-contained within the Python process.

### Venezia Daemon Setup (Planned)

For the cities-of-light Express server:

```bash
# systemd service file: /etc/systemd/user/venezia-server.service
[Unit]
Description=Venezia Spatial State Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/mind-protocol/cities-of-light
ExecStart=/usr/bin/node src/server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=AIRTABLE_API_KEY=pat...
Environment=AIRTABLE_BASE_ID=app...
Environment=ANTHROPIC_API_KEY=sk-ant-...
Environment=ELEVENLABS_API_KEY=...

[Install]
WantedBy=default.target
```

Enable and start:

```bash
systemctl --user enable venezia-server.service
systemctl --user start venezia-server.service
```

### Sync Loop Lifecycle (in the Express Process)

```javascript
// cities-of-light/src/server/index.js (planned addition)
import { startSyncLoop, stopSyncLoop } from './serenissima-sync.js';

// On server start:
const server = createServer(app);
server.listen(PORT, () => {
  console.log(`Venezia server on port ${PORT}`);
  startSyncLoop();  // Begins 15-minute Airtable sync
});

// On graceful shutdown:
process.on('SIGTERM', () => {
  stopSyncLoop();
  server.close();
});
```

---

## API Endpoints

### Serenissima Backend (Already Running)

| Method | Path | Purpose | Used by Venezia |
|---|---|---|---|
| GET | `/api/citizens` | All citizens with economic data | No (use Airtable direct) |
| GET | `/api/buildings` | All buildings with types | No (use Airtable direct) |
| GET | `/api/contracts` | Active contracts | No (use Airtable direct) |
| GET | `/api/resources/{resource_type}` | Resource definitions | Yes (building recipes) |
| GET | `/api/building-types` | Building type definitions | Yes (building models) |
| GET | `/api/transport` | Path routing between points | Yes (citizen walk paths) |
| POST | `/api/activities` | Create manual activity | No (Venezia is read-only) |

### Venezia Express Server (cities-of-light)

Existing endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/state` | Full world state snapshot |
| POST | `/perception` | Frame analysis pipeline |
| WS | `/` | WebSocket for real-time updates |

Planned additions:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/citizens` | Cached citizens from Airtable |
| GET | `/api/citizens/:id` | Single citizen with activity |
| GET | `/api/buildings` | Cached buildings from Airtable |
| GET | `/api/contracts` | Cached active contracts |
| GET | `/api/grievances` | Cached active grievances |
| GET | `/api/sync/status` | Last sync time, cache age, staleness |
| POST | `/api/citizens/:id/speak` | Trigger citizen conversation |

### REST Endpoint Implementation (Planned)

```javascript
// cities-of-light/src/server/index.js (planned additions)
import { getCache } from './venice-state.js';

// Citizen list from cache
app.get('/api/citizens', (req, res) => {
  const cache = getCache();
  if (!cache || !cache.citizens) {
    return res.status(503).json({ error: 'Cache not ready' });
  }
  const citizens = Array.from(cache.citizens.values());
  res.json({ citizens, syncTime: cache.lastSyncTime });
});

// Single citizen with current activity
app.get('/api/citizens/:id', (req, res) => {
  const cache = getCache();
  const citizen = cache.citizens.get(req.params.id);
  if (!citizen) {
    return res.status(404).json({ error: 'Citizen not found' });
  }
  // Look up current activity
  let currentActivity = null;
  for (const [, activity] of cache.activities.entries()) {
    if (activity.citizenId === req.params.id
        && activity.status !== 'processed'
        && activity.status !== 'failed') {
      currentActivity = activity;
      break;
    }
  }
  res.json({ citizen, activity: currentActivity });
});

// Sync status
app.get('/api/sync/status', (req, res) => {
  const cache = getCache();
  const ageMs = cache.lastSyncTime
    ? Date.now() - Date.parse(cache.lastSyncTime)
    : null;
  res.json({
    lastSyncTime: cache.lastSyncTime,
    ageMinutes: ageMs ? Math.floor(ageMs / 60000) : null,
    citizenCount: cache.citizens.size,
    buildingCount: cache.buildings.size,
    contractCount: cache.contracts.size,
    activityCount: cache.activities.size,
    staleTables: Array.from(cache.stale_tables || []),
  });
});
```

---

## Citizen Memory: .cascade/ Filesystem

### Directory Structure Per Citizen

```
serenissima/citizens/{CitizenName}/.cascade/
  ├── business/          ← Trade decisions, contract history
  ├── civic/             ← Governance participation records
  ├── craft/             ← Production skills, recipes learned
  ├── guild/             ← Guild memberships, rank history
  ├── memories/          ← Encounter memories (Venezia writes here)
  │   ├── index.json     ← Memory index with timestamps, heat scores
  │   ├── 2025-07-15T10:00:00Z.json  ← Individual memory file
  │   └── ...
  ├── networks/          ← Relationship summaries
  ├── personality/       ← Base traits, temperament
  └── skills/            ← Learned abilities, proficiency levels
```

### Reading Citizen Memory in Venezia

```javascript
// cities-of-light/src/server/citizen-router.js (planned)
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CITIZENS_PATH = process.env.SERENISSIMA_CITIZENS_PATH
  || '/home/mind-protocol/serenissima/citizens';

function loadCitizenMemories(citizenName, visitorId, limit = 10) {
  const memDir = join(CITIZENS_PATH, citizenName, '.cascade', 'memories');
  const indexPath = join(memDir, 'index.json');

  if (!existsSync(indexPath)) return [];

  const index = JSON.parse(readFileSync(indexPath, 'utf8'));

  // Filter to this visitor, sort by recency
  const visitorMemories = index
    .filter(m => m.visitor === visitorId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);

  // Load full memory content
  return visitorMemories.map(m => {
    const filePath = join(memDir, `${m.timestamp}.json`);
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    }
    return { summary: m.summary, timestamp: m.timestamp };
  });
}
```

### Writing Encounter Memory After Conversation

```javascript
// cities-of-light/src/server/citizen-router.js (planned)
import { writeFileSync, mkdirSync } from 'fs';

function writeEncounterMemory(citizenName, visitorId, conversation) {
  const memDir = join(CITIZENS_PATH, citizenName, '.cascade', 'memories');
  mkdirSync(memDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const memory = {
    timestamp,
    visitor: visitorId,
    heat: calculateMemoryHeat(conversation),
    summary: conversation.summary,
    visitorSaid: conversation.visitorText,
    citizenSaid: conversation.citizenText,
    location: conversation.district,
    mood: conversation.citizenMood,
  };

  // Write memory file
  const filePath = join(memDir, `${timestamp}.json`);
  writeFileSync(filePath, JSON.stringify(memory, null, 2));

  // Update index
  const indexPath = join(memDir, 'index.json');
  const index = existsSync(indexPath)
    ? JSON.parse(readFileSync(indexPath, 'utf8'))
    : [];
  index.push({
    file: filePath,
    visitor: visitorId,
    timestamp,
    heat: memory.heat,
    summary: memory.summary.substring(0, 100),
  });
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

function calculateMemoryHeat(conversation) {
  // Heat = how memorable this encounter is (0-100)
  let heat = 20; // Base: any conversation is somewhat memorable
  if (conversation.turnCount > 5) heat += 20;  // Long conversation
  if (conversation.emotionDelta > 0.3) heat += 30; // Strong emotion shift
  if (conversation.topicGovernance) heat += 15; // Political discussion
  if (conversation.topicPersonal) heat += 15; // Personal revelation
  return Math.min(heat, 100);
}
```

---

## Environment Variables

### Serenissima (Python Backend)

```bash
# serenissima/.env
AIRTABLE_API_KEY=pat...              # Airtable Personal Access Token
AIRTABLE_BASE_ID=appkLmnbsEFAZM5rB  # Serenissima base
API_BASE_URL=https://api.serenissima.ai  # Self-referencing API base
TRANSPORT_API_URL=https://api.serenissima.ai/api/transport  # Path routing
KINOS_API_KEY=...                     # KinOS consciousness engine
```

### Venezia (Node.js Server)

```bash
# cities-of-light/.env
AIRTABLE_API_KEY=pat...              # Same PAT, read-only usage
AIRTABLE_BASE_ID=appkLmnbsEFAZM5rB  # Same base
AIRTABLE_SYNC_INTERVAL_MS=900000     # 15 minutes (default)
ANTHROPIC_API_KEY=sk-ant-...         # Claude API for citizen conversations
ELEVENLABS_API_KEY=...               # TTS for citizen voices
OPENAI_API_KEY=sk-...                # Whisper STT
SERENISSIMA_CITIZENS_PATH=/home/mind-protocol/serenissima/citizens
FALKORDB_HOST=localhost
FALKORDB_PORT=6379
FALKORDB_GRAPH=venezia
```

---

## npm Dependencies (Planned Additions)

```json
{
  "dependencies": {
    "airtable": "^0.12.2",
    "falkordb": "^0.3.0"
  }
}
```

Install:

```bash
cd /home/mind-protocol/cities-of-light
npm install airtable falkordb
```

---

## Files to Create

| File | Purpose | Priority |
|---|---|---|
| `src/server/serenissima-sync.js` | Airtable sync loop | P0 |
| `src/server/venice-state.js` | In-memory cache manager | P0 |
| `src/server/citizen-router.js` | Citizen conversation routing | P1 |
| `src/server/physics-bridge.js` | Blood Ledger physics tick | P2 |
| `src/shared/districts.js` | Venice district definitions | P1 |
| `src/client/citizens/citizen-manager.js` | Citizen rendering/LOD | P1 |
| `src/client/citizens/citizen-avatar.js` | 3D avatar construction | P2 |

### Files to Modify

| File | Change | Why |
|---|---|---|
| `src/server/index.js` | Import sync loop, add REST endpoints | Entry point integration |
| `package.json` | Add `airtable`, `falkordb` dependencies | Data access |
| `.env` | Add Airtable, AI, graph credentials | Configuration |

---

## Simulation Flow: What Happens in One Tick

```
SERENISSIMA (every 5 minutes):                    VENEZIA (every 15 minutes):

1. processActivities.py                           1. serenissima-sync.js
   └─ concluded activities → processors              └─ fetch 6 Airtable tables
      └─ ducats transfer, resource move               └─ transform records
      └─ position update                               └─ swap cache (atomic)
      └─ activity marked "processed"                   └─ compute diff
                                                       └─ broadcast to clients
2. createActivities.py
   └─ idle citizens → determine_next_activity     2. Client receives diff
      └─ priority chain: eat > sleep > work           └─ update citizen positions
      └─ activity written to Airtable                 └─ change animations
                                                       └─ show/hide props
3. processStratagems.py                               └─ update district mood
   └─ active stratagems → processors
      └─ price adjustments, trust changes         3. Visitor speaks to citizen
      └─ relationship updates                        └─ citizen-router.js
                                                     └─ load cache + memories
4. Daily scripts (once per Venice day)               └─ Claude API call
   └─ wages, rent, loans, maintenance               └─ write encounter memory
   └─ social class recalculation                     └─ TTS → WebSocket binary
   └─ influence updates
```

---

## Testing Strategy

### Simulation Health Check (Python)

```bash
# Verify the simulation is producing activities
cd /home/mind-protocol/serenissima
python -c "
from pyairtable import Api
import os
api = Api(os.getenv('AIRTABLE_API_KEY'))
t = api.table(os.getenv('AIRTABLE_BASE_ID'), 'ACTIVITIES')
active = t.all(formula=\"{Status} = 'created'\")
print(f'Active activities: {len(active)}')
"
```

### Sync Health Check (Node.js)

```bash
# Verify the cache is populated
curl http://localhost:8800/api/sync/status
# Expected: {"lastSyncTime":"2026-...","ageMinutes":3,"citizenCount":186,...}
```

### End-to-End Test

```bash
# 1. Check a specific citizen's state through the Venezia API
curl http://localhost:8800/api/citizens/cit_marco_polo
# Expected: citizen object with current activity

# 2. Verify the 3D client receives updates
# Open browser console, connect WebSocket, listen for citizen_update events
```
