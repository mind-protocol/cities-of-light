# CONCEPT: Cross-Repo Integration — How Venezia Connects to MIND Protocol

Venezia does NOT live in isolation. It is part of a hub-and-spoke ecosystem centered on Manemus. This document maps every cross-repo dependency.

---

## Ecosystem Architecture

```
                    ┌─────────────────────┐
                    │      MIND-MCP       │
                    │  21 tools (agents,  │
                    │  graph, tasks,      │
                    │  capabilities)      │
                    └──────────┬──────────┘
                               │ MCP protocol
                               ▼
┌──────────────────────────────────────────────────────────┐
│                       MANEMUS                             │
│               Central Nervous System                      │
│                                                           │
│  orchestrator.py    — parallel Claude sessions            │
│  account_balancer.py — 3 Max accounts round-robin         │
│  telegram_bridge.py  — multi-user messaging               │
│  garmin_reader.py    — multi-user biometrics              │
│  /api/citizens       — citizen registry (source of truth) │
│  shrine/backlog.py   — scans all repos for tasks          │
│  daemon.py           — iOS/Android hotkey bridge          │
└────┬──────────┬──────────┬──────────┬────────────────────┘
     │          │          │          │
     ▼          ▼          ▼          ▼
┌─────────┐ ┌────────┐ ┌──────────┐ ┌───────────────────┐
│ MIND-   │ │SERENIS-│ │CITIES-OF-│ │  BLOOD-LEDGER     │
│PLATFORM │ │SIMA    │ │LIGHT     │ │                   │
│(web)    │ │(186 AI)│ │(3D/VR)   │ │  (narrative       │
│         │ │        │ │          │ │   physics)         │
└─────────┘ └────────┘ └──────────┘ └───────────────────┘
```

---

## Repo Responsibilities

| Repo | Role in Venezia | What It Owns |
|---|---|---|
| **manemus** | Orchestration, compute, auth, biometrics | Account balancer, citizen registry, Telegram bridge, Garmin data |
| **serenissima** | Citizen simulation (the "souls") | 186 citizen identities, .cascade/ memories, Airtable economic state, KinOS integration |
| **cities-of-light** | 3D spatial substrate (the "body") | Three.js world, WebXR, spatial audio, citizen embodiment, atmosphere |
| **the-blood-ledger** | Narrative physics (the "laws") | FalkorDB graph, physics tick, Narrator/WorldBuilder/WorldRunner agents |
| **mind-platform** | Public web presence | Registry page, citizen dashboard, /api/citizens (fetches from Manemus) |
| **mind-mcp** | Tool/capability layer | 21 MCP tools: agents, procedures, graph queries, task management |

---

## Integration Points (by data flow)

### 1. Citizen Identity: Manemus → Mind-Platform → Venezia

**Source of truth:** `manemus/config/citizens.json`
- Schema: `{id, display_name, role, section, bio, tags, links, avatar, trust_level, wallet, telegram_id}`
- Served via: `manemus/routes/citizens.py` → `GET /api/citizens`

**Consumer 1:** Mind-Platform
- `mind-platform/app/api/citizens/route.ts` fetches from Manemus with 30s cache
- Renders on `/team` page and dashboard

**Consumer 2:** Venezia (new)
- Cities-of-light will fetch citizen profiles to overlay on Serenissima economic data
- Maps Manemus citizen → Serenissima citizen → 3D avatar in Venice

**Gap to fill:** Manemus citizen registry currently holds ~10 team members. Serenissima has 186 AI citizens in Airtable. Need a unification layer:
- Option A: Manemus registry expands to include all 186 (heavy)
- Option B: Venezia queries Serenissima Airtable directly for AI citizens, Manemus only for humans (recommended)
- Option C: FalkorDB graph becomes the unified registry (via mind-platform /api/registry/citizens using Cypher queries)

### 2. Citizen "Souls": Serenissima Airtable → Venezia

**Source of truth:** Serenissima Airtable base (`appkLmnbsEFAZM5rB` or equivalent)
- Tables: CITIZENS, BUILDINGS, LANDS, CONTRACTS, ACTIVITIES, RELATIONSHIPS, GRIEVANCES, RESOURCES, TRANSACTIONS, PATTERNS
- Each citizen: Ducats, SocialClass, mood, personality, position, IsAI flag

**Consumer:** Venezia Express server (`cities-of-light/src/server/serenissima-sync.js`)
- Pulls every 15 minutes
- Caches in memory for real-time rendering
- Diffs → WebSocket events to connected clients

**Citizen memory:** Filesystem at `serenissima/citizens/{CitizenName}/.cascade/`
- 14 subdirectories per citizen (craft, business, guild, civic, memories, skills, networks, etc.)
- Venezia reads these for conversation context
- Venezia writes new encounter memories after conversations

**KinOS calls:** `serenissima/backend/the-code/theSynthesis.py`
- API: `https://api.kinos-engine.ai/v2/blueprints/serenissima-ai/...`
- Used for consciousness synthesis, daily narrative generation
- Venezia citizen conversations will use Claude API directly (not KinOS), but informed by KinOS-generated context

### 3. Narrative Graph: Blood Ledger FalkorDB → Venezia

**Source of truth:** FalkorDB instance (Docker, port 6379)
- Schema: Character, Narrative, Moment, Place nodes + BELIEVES, TENSION, SUPPORTS edges
- Currently seeded with Blood Ledger world data (Norman England)

**Venezia needs:** Venice-specific graph seeded from Serenissima data
- Script to create Character nodes from 186 Airtable citizens
- Script to create Narrative nodes from active grievances/tensions/beliefs
- Script to create Place nodes from Venice districts
- Physics tick runs in `cities-of-light/src/server/physics-bridge.js`

**Shared FalkorDB or separate?**
- Recommended: Separate graph database for Venice (different Docker container or different graph name in same FalkorDB)
- Blood Ledger engine code is reusable — just point to Venice graph

### 4. Compute: Manemus Account Balancer → Venezia

**Source:** `manemus/scripts/account_balancer.py`
- 3 Claude Max accounts: a (reynolds.nicorr), b (nlr@universe-engine.ai), c (mind@mindprotocol.ai)
- Round-robin with exhaustion tracking, failover, health monitoring

**Venezia needs:** Claude API calls for citizen conversations
- Each FULL-tier conversation = 1 Claude API call (~300 tokens response)
- At peak: ~1 call/second (visitor talking rapidly)
- At normal: ~1 call/5-10 seconds
- This goes through Claude API directly (not Claude Code), so account balancer may not apply
- BUT: if using `claude --print` for citizen responses, account balancer IS needed

**Recommendation:** Venezia uses Claude API directly (Anthropic SDK) with API key from one of the accounts. Account balancer reserved for Manemus orchestrator sessions.

### 5. Biometrics: Manemus Garmin Reader → Venezia Atmosphere

**Source:** `manemus/scripts/garmin_reader.py`
- Multi-user: `--user {nicolas,aurore,all}`
- Output: `manemus/biometrics/{user}/latest.json` (stress, HRV, body battery, sleep)
- Real-time: current_stress from stressValuesArray

**Venezia consumer:** Atmosphere system reads visitor's biometrics
- Visitor's Garmin stress → world fog/tint shift (subtle, not dramatic)
- Visitor's HRV → world "calm" factor (high HRV = clearer skies)
- This is optional — works without Garmin, but adds depth

**Data path:** Manemus writes `biometrics/nicolas/latest.json` → Venezia server reads it (file or API)

### 6. Messaging: Manemus Telegram Bridge → Venezia Citizens

**Source:** `manemus/scripts/telegram_bridge.py`
- Multi-user support: registration, Garmin linking, message routing
- Known chat IDs, user context, trust levels

**Serenissima already has:** `serenissima/backend/telegram_unified_service.py`
- Citizen-to-citizen Telegram messaging
- Workroom bridges
- Notification system

**For Venezia:** Citizens can receive Telegram messages while the visitor is in the 3D world
- A citizen's phone "buzzes" (spatial audio) mid-conversation
- Citizen: "Excuse me, I just received a message from the docks..."
- This bridges the 24/7 simulation (Telegram) with the 3D experience

### 7. Task Management: Manemus Backlog → Venezia Development

**Source:** `manemus/scripts/project_scanner.py`
- Scans repos including `serenissima` for: git drift, missing tests, TODOs, docs gaps
- Feeds into `manemus/shrine/state/backlog.jsonl`

**For Venezia:** Add `cities-of-light` to scanner's `key_repos` list
- Autonomous tasks auto-discovered: missing docs, test gaps, TODO comments
- Orchestrator can dispatch sessions to work on Venezia code

**File to edit:** `manemus/scripts/backlog.py` line ~266, add `"cities-of-light"` to `key_repos`

### 8. Registry Graph: Mind-MCP FalkorDB → Mind-Platform → Venezia

**Source:** Mind-MCP FalkorDB graph
- Nodes: Actor (type=CITIZEN or AGENT), Space
- Edges: LINK (actor → space)

**Consumer:** `mind-platform/app/api/registry/citizens/route.ts`
- Cypher query: `MATCH (s:Space)-[:LINK]->(a:Actor) WHERE a.type = "CITIZEN"...`
- Serves registry UI

**For Venezia:** When Serenissima citizens are loaded into FalkorDB Venice graph, they should ALSO be registered as Actors in the Mind-MCP graph
- This makes them discoverable via Mind Protocol registry
- Each Serenissima citizen = an Actor node with status, space membership

---

## Recommended Integration Architecture for Venezia

```
VISITOR (VR/Browser)
       │
       ▼
CITIES-OF-LIGHT EXPRESS SERVER
       │
       ├──→ Serenissima Airtable (citizen data, every 15min)
       │         via AIRTABLE_API_KEY
       │
       ├──→ FalkorDB Venice Graph (narrative state, every 5min physics tick)
       │         via localhost:6379 (or separate container)
       │
       ├──→ Claude API (citizen conversations, on-demand)
       │         via ANTHROPIC_API_KEY
       │
       ├──→ ElevenLabs API (TTS, on-demand)
       │         via ELEVENLABS_API_KEY
       │
       ├──→ Whisper (STT, on-demand)
       │         via local model or OPENAI_API_KEY
       │
       ├──← Manemus biometrics (optional, file read)
       │         via /home/mind-protocol/manemus/biometrics/nicolas/latest.json
       │
       └──← Serenissima .cascade/ (citizen memories, read/write)
                via /home/mind-protocol/serenissima/citizens/{name}/.cascade/
```

---

## Environment Variables Needed

```bash
# Serenissima data
AIRTABLE_API_KEY=pat...          # Airtable PAT for citizen data
AIRTABLE_BASE_ID=app...          # Serenissima base

# AI
ANTHROPIC_API_KEY=sk-ant-...     # Claude API for citizen conversations
ELEVENLABS_API_KEY=...           # TTS for citizen voices
OPENAI_API_KEY=sk-...            # Whisper STT (if API mode)

# Graph
FALKORDB_HOST=localhost          # Blood Ledger graph
FALKORDB_PORT=6379
FALKORDB_GRAPH=venezia           # Separate graph name from blood-ledger

# Optional
MANEMUS_BIOMETRICS_PATH=/home/mind-protocol/manemus/biometrics/
SERENISSIMA_CITIZENS_PATH=/home/mind-protocol/serenissima/citizens/
```

---

## Files to Modify in Other Repos

| Repo | File | Change | Why |
|---|---|---|---|
| manemus | `scripts/backlog.py:266` | Add `"cities-of-light"` to `key_repos` | Enable task auto-discovery |
| manemus | `config/citizens.json` | Add `serenissima_link` field | Map team members to Venice citizens |
| mind-platform | `app/api/registry/citizens/route.ts` | Expand Cypher to include Venice graph | Show Serenissima citizens in registry |
| serenissima | `citizens/*/` | Ensure all 186 have `.cascade/` dirs | Venezia needs memory access |
| the-blood-ledger | (none — code reused, not modified) | Import engine modules | Physics tick, graph ops |

---

## Data Ownership Matrix

| Data | Owner (writes) | Consumers (reads) |
|---|---|---|
| Citizen economic state | Serenissima (Airtable) | Venezia, Mind-Platform |
| Citizen memories | Serenissima + Venezia (both write to .cascade/) | Venezia (conversation context) |
| Narrative graph | Venezia physics-bridge.js | Venezia (events, context), Mind-Platform (registry) |
| Citizen registry | Manemus (humans), Serenissima/Airtable (AIs) | Mind-Platform, Venezia |
| Biometrics | Manemus garmin_reader.py | Venezia (atmosphere), Mind-Platform (dashboard) |
| Visitor identity | Venezia (localStorage/headset) | Venezia only (not shared) |
| World events | Venezia physics tick | Venezia (3D rendering) |

---

## Anti-Patterns

1. **Don't duplicate citizen data.** Airtable is the source for economic state. FalkorDB is the source for narrative state. .cascade/ is the source for memory. Don't copy between them.

2. **Don't route citizen conversations through Manemus.** Venezia talks to Claude API directly. Manemus orchestrator is for Nicolas's personal sessions, not for 186 citizen conversations.

3. **Don't write to Serenissima Airtable from Venezia** (except memory updates). The economic simulation is Serenissima's domain. Venezia observes it, doesn't control it.

4. **Don't mix FalkorDB graphs.** Venice narrative graph is separate from Blood Ledger's Norman England graph and Mind-MCP's agent graph. Same database server, different graph names.
