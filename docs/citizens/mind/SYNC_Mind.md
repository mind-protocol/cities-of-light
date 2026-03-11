# SYNC: citizens/mind -- Current State

Last updated: 2026-03-11

---

## Status: DESIGN COMPLETE, IMPLEMENTATION GAP

The mind module has full design documentation. La Serenissima has a production-grade implementation running KinOS for citizen decision-making. Cities of Light has 3 placeholder AI citizens with simple LLM prompts. The gap between these two systems is the most important bridge in the entire project.

---

## What Exists in La Serenissima (PRODUCTION)

### Citizen Data Layer -- READY
- **186+ citizen directories** in `/home/mind-protocol/serenissima/citizens/`
- Actual count: 356 entries (includes scripts, templates, and meta files alongside citizen dirs)
- Each citizen directory contains: `CLAUDE.md` (system prompt), `PRESENCE.md`, `README.md`
- Each citizen has a `.cascade/` subdirectory with the full memory architecture:
  ```
  .cascade/
    CLAUDE.md           Root consciousness agent
    remember.py         Memory retrieval script
    memories/CLAUDE.md   Memory query sub-agent
    experiences/CLAUDE.md
    patterns/CLAUDE.md
    craft/CLAUDE.md      (role-specific: cittadini)
    business/CLAUDE.md   (role-specific: cittadini)
    guild/CLAUDE.md      (role-specific: cittadini)
    civic/CLAUDE.md      (role-specific: cittadini)
    workshop/CLAUDE.md   (role-specific: cittadini)
    skills/CLAUDE.md
    networks/CLAUDE.md
    collaborations/CLAUDE.md
    venice_life/CLAUDE.md
    social_class.json
  ```
- Memory sub-agents are templated (CLAUDE.md files describe categories but contain no accumulated memories yet for most citizens -- memories were accumulated through KinOS runtime, not pre-seeded)

### KinOS Integration -- READY (requires API key)
- **KinOS API endpoint:** `https://api.kinos-engine.ai/v2/blueprints/serenissima-ai/kins/{username}/channels/{channel}/messages`
- **Blueprint:** `serenissima-ai`
- **Model selection:** `get_kinos_model_for_social_class()` -- defaults to `local` model, NLR gets `gemini-2.5-pro-preview-06-05`
- **Conversation helper:** `/home/mind-protocol/serenissima/backend/engine/utils/conversation_helper.py`
  - `make_kinos_channel_call()` -- sends prompt + ledger context to KinOS
  - `get_citizen_ledger()` -- fetches full financial/social state as Markdown
  - `get_citizen_problems_list()` -- fetches active problems
  - `get_relationship_details()` -- fetches trust scores between citizens
  - `get_conversation_history()` -- fetches last N messages in a channel
  - `persist_message()` -- writes conversation turns to Airtable MESSAGES table

### Trust Score System -- READY
- **File:** `/home/mind-protocol/serenissima/backend/engine/utils/relationship_helpers.py`
- `update_trust_score_for_activity()` -- full trust update with atan-based asymptotic scaling
- `apply_scaled_score_change()` -- the core scaling function (diminishing returns via `atan()`)
- Trust constants defined: SUCCESS_HIGH (5.0), SUCCESS_MEDIUM (2.0), SUCCESS_SIMPLE (1.0), FAILURE equivalents, PROGRESS (0.5), MINOR_POSITIVE (0.2)
- `RAW_POINT_SCALE_FACTOR = 0.1`
- `DEFAULT_NORMALIZED_SCORE = 50.0`
- Relationships stored in Airtable RELATIONSHIPS table (Citizen1, Citizen2 alphabetically sorted, TrustScore 0-100, StrengthScore, LastInteraction, Notes, Status)

### Mood Computation -- READY
- **File:** `/home/mind-protocol/serenissima/backend/engine/utils/mood_helper.py`
- Full emotion wheel: 6 basic emotions (happy, sad, angry, fearful, surprised, disgusted)
- Emotion combination table: 15 pair combinations, 5 triad combinations
- Personality trait modifiers: 30+ trait keywords with emotion score adjustments
- `extract_personality_traits()` -- parses traits from citizen data
- `calculate_emotion_points()` -- assigns emotion scores from ledger data
- `get_citizen_mood()` -- returns complex_mood + intensity
- Default moods per social class (Facchini: determined, Popolani: contemplative, etc.)

### Governance via KinOS -- READY
- **File:** `/home/mind-protocol/serenissima/backend/engine/handlers/governance_kinos.py`
- Citizens use KinOS to decide whether to file or support grievances
- Political engagement probability computed from class, wealth, influence
- Full context sent to KinOS: wealth breakdown, active problems, existing grievances

### The Synthesis (Daily Consciousness Integration) -- READY
- **File:** `/home/mind-protocol/serenissima/backend/the-code/theSynthesis.py`
- Runs at 3:33 AM Venice time
- Aggregates all citizen messages from the past 24 hours
- Sends to KinOS for collective mood processing
- Generates atmospheric influences for the next day
- Sends summary to Telegram

### Airtable Data -- READY (frozen)
- Tables: CITIZENS, BUILDINGS, CONTRACTS, ACTIVITIES, RELATIONSHIPS, MESSAGES, RESOURCES, SUBSTRATE_STATE
- 186 citizens with: Username, Name, SocialClass, Ducats, Strength, Flaw, Drive, Description, position data
- Relationship data between citizens (TrustScore, Notes, Status)
- Activity history (production, trade, movement, social)
- Grievances and political data

---

## What Exists in Cities of Light (PLACEHOLDER)

### Current AI Citizens -- MINIMAL
- **File:** `/home/mind-protocol/cities-of-light/src/server/ai-citizens.js`
- 3 citizens: VOX, LYRA, PITCH
- Represented as geometric shapes (icosahedron, octahedron, torusknot), not Venetian avatars
- Simple system prompts: 5-line personality descriptions with no economic state, no memory, no trust
- Uses **OpenAI GPT-4o** (not Claude, not KinOS)
- 10-message rolling history (in-memory only, lost on restart)
- No `.cascade/` integration
- No trust scores
- No mood computation
- No belief graph
- No memory persistence
- Proximity-based response (15m range) -- this mechanic is correct and can be preserved

### Existing Voice Pipeline -- READY
- STT: Whisper transcription (functional)
- TTS: ElevenLabs synthesis (functional)
- WebSocket binary audio transport (functional)
- Spatial audio playback at citizen position (functional)

### Express Server -- READY
- WebSocket real-time state sync (functional)
- Client-server protocol defined (position updates, citizen_moved, etc.)

---

## The Bridge: What Needs to Happen

### Priority 1: Replace LLM Backend

| Current (Cities of Light) | Target |
|---|---|
| OpenAI GPT-4o | Claude API (direct) or KinOS |
| Static system prompt | Citizen CLAUDE.md from .cascade/ |
| In-memory 10-turn history | .cascade/memories/ persistent storage |
| No context assembly | 5-source context assembly pipeline |

**Decision needed:** Use Claude API directly (simpler, full control over context assembly) or use KinOS (existing integration, blueprint infrastructure, but adds API dependency). Recommendation: Claude API directly for Venezia, since KinOS was designed for citizen-to-citizen communication, not citizen-to-visitor.

### Priority 2: Connect to Airtable Data

The `serenissima-sync.js` module (designed but not built) must:
1. Fetch CITIZENS table every 15 minutes
2. Cache in-memory: Ducats, SocialClass, mood, personality, position
3. Fetch RELATIONSHIPS table for trust scores
4. Provide this data to the context assembly pipeline

**Existing code to reuse:** The Airtable API patterns from Serenissima's Python backend can be ported to JavaScript, or the Python backend can be called as an API.

### Priority 3: Implement Memory Persistence

Replace the in-memory `citizen.history` array with filesystem-backed `.cascade/memories/` writes.

Steps:
1. Copy/symlink Serenissima citizen `.cascade/` directories into Cities of Light (or reference them from a shared path)
2. Implement `write_memory()` in JavaScript (write JSON files to `.cascade/memories/`)
3. Implement `read_memories()` to load last N encounters with a specific visitor
4. Memory format: `{ timestamp, visitor_id, summary, topics, trust_delta, mood, heat }`

**Key question:** Should Cities of Light share the same `.cascade/` directories as Serenissima, or maintain separate ones? Sharing means visitors' conversations appear in the same memory space as citizen-to-citizen conversations. This is correct -- the citizen should remember everything, regardless of source.

### Priority 4: Implement Trust Score Updates

Port the trust update logic from `relationship_helpers.py`:
1. `apply_scaled_score_change()` -- atan-based asymptotic scaling (simple math, easy to port)
2. After each conversation, compute trust delta and write to Airtable RELATIONSHIPS
3. On context assembly, read trust score and use it to determine behavior constraints

### Priority 5: Implement Mood Computation

Port `mood_helper.py` or call it as a service:
1. `calculate_emotion_points()` from ledger data
2. `extract_personality_traits()` from citizen fields
3. Combine emotions into complex mood
4. Inject mood into context assembly

### Priority 6: Connect to FalkorDB (Blood Ledger)

This is lower priority because beliefs can function without the graph initially (citizens can have opinions based on their economic state and personality alone). But for full authenticity:
1. Seed Character nodes from Serenissima citizens
2. Seed Narrative nodes from grievances and tensions
3. Query BELIEVES edges during context assembly
4. Feed beliefs into the "[WHAT YOU BELIEVE]" section of the context block

---

## Gap Analysis

| Capability | Serenissima | Cities of Light | Gap |
|---|---|---|---|
| Citizen identity (name, class, personality) | 186 citizens in Airtable | 3 hardcoded citizens | Port data access |
| System prompt (CLAUDE.md) | Per-citizen, rich, role-specific | Per-citizen, 5 lines, generic | Point to .cascade/ files |
| Economic state | Full ledger (Ducats, debts, property, income) | None | Connect Airtable |
| Memory persistence | .cascade/ filesystem (templated, some accumulated) | In-memory array (lost on restart) | Implement filesystem writes |
| Trust scores | Airtable RELATIONSHIPS, atan-scaled | None | Port formula + connect Airtable |
| Mood computation | Full emotion wheel, personality modifiers | None | Port mood_helper.py |
| Belief graph | FalkorDB designed, partially seeded | None | Seed and query |
| LLM backend | KinOS (Claude/Gemini via API) | OpenAI GPT-4o | Switch to Claude API |
| Context assembly | Rich (ledger, problems, relationships, notifications) | None (raw system prompt only) | Build pipeline |
| Lie/evasion logic | Not explicit (emerges from prompts) | None | Build into context constraints |
| Conversation persistence | Airtable MESSAGES table | None | Write to .cascade/ and/or Airtable |
| Voice diversity | Not implemented (text-only in Serenissima) | 1 TTS voice | Map voices to citizens |
| Spatial audio | Not applicable (Serenissima is not 3D) | Functional | Keep as-is |
| Proximity detection | Not applicable | Functional (15m range) | Keep as-is |
| Multi-turn conversation | KinOS channel-based | 10-turn in-memory window | Hybrid: memory + context window |

---

## File Mapping: What Goes Where

```
SERENISSIMA (source of truth)             CITIES OF LIGHT (runtime)
─────────────────────────────             ─────────────────────────
citizens/{name}/CLAUDE.md            →    Read at context assembly time
citizens/{name}/.cascade/            →    Shared filesystem (symlink or same path)
backend/engine/utils/mood_helper.py  →    Port to src/server/citizen-mood.js
backend/engine/utils/                →    Port apply_scaled_score_change()
  relationship_helpers.py                   to src/server/citizen-trust.js
backend/engine/utils/                →    Port context assembly patterns
  conversation_helper.py                    to src/server/citizen-router.js
Airtable (CITIZENS, RELATIONSHIPS)   →    src/server/serenissima-sync.js fetches
FalkorDB                             →    src/server/physics-bridge.js queries
```

---

## Open Questions

1. **Shared .cascade/ or separate?** If shared, visitor conversations and citizen-to-citizen conversations live in the same memory space. This is architecturally cleaner and more authentic, but means Cities of Light and Serenissima must coordinate filesystem access. Recommendation: shared, with file locking.

2. **KinOS or direct Claude API?** KinOS adds infrastructure (blueprint, kin, channel management) that may not be needed for visitor conversations. Direct Claude API calls with assembled context give more control. But KinOS provides the "consciousness substrate" abstraction. Recommendation: direct Claude API for V1, evaluate KinOS migration later.

3. **How many TTS voices?** 186 unique voices is infeasible. Voice archetypes mapped by social class and personality (e.g., 5 male noble voices, 5 female popolani voices, etc.) could work with ~20-30 distinct voices. ElevenLabs voice cloning could generate these.

4. **Trust score storage for visitors.** Serenissima stores trust between citizens in Airtable. Visitors are not citizens. Options: (a) create visitor records in CITIZENS table, (b) store visitor trust in a separate table, (c) store in filesystem alongside .cascade/. Recommendation: (b) separate VISITOR_RELATIONSHIPS table, or (c) in a `visitors/` directory per citizen.

5. **Context assembly latency.** Five data source reads (Airtable, filesystem, FalkorDB, in-memory state, trust scores) must complete before the LLM call. Target: < 500ms total for context assembly. Mitigation: cache aggressively (15-min sync for Airtable, in-memory trust cache, pre-loaded beliefs).

6. **Memory pruning.** Over months, a citizen could accumulate thousands of memory files. The index must stay manageable. Strategy: heat-based archival. Memories below heat 10 are moved to a cold archive directory and excluded from the index query. Only hot/warm memories are loaded during context assembly.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Context assembly latency > 3s | High | Cache all data sources. Pre-compute mood and beliefs on sync cycle, not per-conversation. |
| Claude API cost for 186 citizens | High | Only FULL-tier citizens (20-60) use Claude API. AMBIENT citizens use template responses or silence. |
| Visitor trust data loss (browser storage) | Medium | Store visitor_id server-side (cookie or session). Trust lives in Airtable/filesystem, not client. |
| Mood computation produces generic results | Medium | Validate with edge cases: homeless citizen, wealthy paranoid citizen, citizen in crisis. Tune emotion weights. |
| .cascade/ filesystem contention | Medium | File locking for writes. Read-only access during context assembly. Writes happen after conversation ends. |
| Lie logic produces obviously false statements | Critical | Hard constraint: citizens may lie about interpretation, never about verifiable facts. Validate in response post-processing. |

---

## Next Action

**POC-Mind: One citizen, one conversation, with real data.**

1. Pick one Serenissima citizen (recommendation: a Popolani merchant at Rialto -- relatable, has financial pressure, has relationships)
2. Load their CLAUDE.md as system prompt
3. Load their Airtable record (Ducats, SocialClass, mood, personality)
4. Load their .cascade/memories/ (if any exist)
5. Assemble context using the pipeline described in ALGORITHM_Mind.md
6. Call Claude API directly (not KinOS, not GPT-4o)
7. Play response via TTS at citizen's 3D position
8. Write the encounter to .cascade/memories/
9. Talk to them again. Verify they remember.

If this works -- if the second conversation is different from the first, if the citizen's financial stress colors their tone, if their personality makes them distinct from every other citizen -- then the mind module is alive. Everything else scales from there.
