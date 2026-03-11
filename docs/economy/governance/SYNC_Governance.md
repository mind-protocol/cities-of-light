# SYNC -- Governance

> Current state of the governance system across Serenissima and Venezia.
> The simulation-side logic exists. The 3D representation does not.

---

## What Exists in Serenissima

### Governance Handlers

Two implementations in `backend/engine/handlers/`:

| File | Status | Approach |
|---|---|---|
| `governance.py` | Complete | Rule-based. Probability-driven engagement. Template grievances. |
| `governance_kinos.py` | Complete | KinOS-enhanced. AI-generated grievance content and decisions. |

Both handlers share the same precondition logic:
- Check `is_night` (no governance at night)
- Calculate engagement probability from social class, wealth, influence
- Check proximity to Doge's Palace (citizen must be nearby)
- Check liquid wealth (minimum fee buffer required)
- Random roll against engagement probability

The KinOS handler adds:
- Context assembly for KinOS API call (citizen state, existing grievances)
- KinOS decision: file, support, or disengage
- KinOS-generated grievance title, description, and category
- Fallback to rule-based if API key is missing

### Activity Creators and Processors

| File | Status | Function |
|---|---|---|
| `activity_creators/file_grievance_activity_creator.py` | Complete | Creates file_grievance activity with category, title, description |
| `activity_creators/support_grievance_activity_creator.py` | Complete | Creates support_grievance activity with grievance_id and fee |
| `activity_processors/file_grievance_processor.py` | Complete | Writes new grievance record to GRIEVANCES Airtable table |
| `activity_processors/support_grievance_processor.py` | Complete | Increments support count on existing grievance, deducts fee |

### Stratagem Processors (Governance-Adjacent)

| File | Status | Relevance |
|---|---|---|
| `stratagem_processors/political_campaign_stratagem_processor.py` | Complete | Spend Ducats to increase political influence |
| `stratagem_processors/printing_propaganda_stratagem_processor.py` | Complete | Amplify political message via printing press |
| `stratagem_processors/organize_gathering_stratagem_processor.py` | Complete | Create social events that build faction support |
| `stratagem_processors/reputation_assault_stratagem_processor.py` | Complete | Damage a political opponent's standing |

### Airtable Data

The GRIEVANCES table in Airtable contains:

| Field | Type | Description |
|---|---|---|
| GrievanceId | Text | Unique identifier |
| Title | Text | Short description of the complaint |
| Description | Long text | Full grievance text |
| Category | Single select | economic, labor, trade, governance, social |
| FiledBy | Link to CITIZENS | Citizen who filed |
| SupportCount | Number | How many citizens support this |
| Supporters | Link to CITIZENS | List of supporting citizens |
| Status | Single select | active, resolved, rejected, expired |
| CreatedAt | DateTime | When filed |
| ResolvedAt | DateTime | When resolved (if applicable) |
| Outcome | Long text | Council decision text (if resolved) |

Approximately 50-100 grievance records exist from the last simulation run.
Most are in `active` or `expired` status (the council deliberation system
was not fully implemented before the freeze).

---

## What Exists in Cities of Light

Nothing governance-specific. The Express server has no governance routes,
no governance state, no governance rendering.

The general infrastructure that governance will use:
- WebSocket broadcast (`index.js`, `rooms.js`) -- for governance event push
- AI citizen system (`ai-citizens.js`) -- will need to be extended for
  governance-aware behavior (citizens near the palace talk about politics)
- District generation (`venice/district-generator.js`) -- Doge's Palace
  needs to exist as a landmark building

---

## What Must Be Built

### In Serenissima (Simulation Side)

| Component | Status | What's Needed |
|---|---|---|
| Council deliberation | Partially designed | Logic for council formation, member selection, voting, outcome generation |
| Grievance threshold | Configured | Support count threshold that triggers council formation |
| Policy enforcement | Not built | Mechanism for governance outcomes to affect economic simulation (tax changes, trade restrictions) |
| Grievance expiry | Not built | Decay logic for grievances that never reach threshold |

The council deliberation system was designed but not fully implemented before
the simulation was frozen. This is the primary gap on the Serenissima side.

### In Venezia (Rendering Side)

| Component | Status | What's Needed |
|---|---|---|
| Governance event detection | Not built | Scan synced GRIEVANCES for state changes (new filings, threshold reached, resolved) |
| Crowd simulation | Not built | Move citizens toward Doge's Palace during political events |
| Notice board system | Not built | 3D text props showing governance outcomes at designated locations |
| Guard NPC spawning | Not built | Enforcement citizens at relevant buildings when policy restricts activity |
| Political conversation context | Not built | Inject active grievances into citizen LLM prompts for relevant conversations |
| Atmosphere integration | Not built | District mood shifts during political tension |
| Narrative graph integration | Not built | Create Tension/Moment nodes in FalkorDB from governance events |

---

## Data Flow

```
Serenissima simulation tick
    |
    v
governance.py / governance_kinos.py  (citizen decides to engage)
    |
    v
file_grievance_activity_creator.py   (or support_grievance)
    |
    v
file_grievance_processor.py          (writes to Airtable GRIEVANCES)
    |
    v
Airtable GRIEVANCES table            (source of truth)
    |
    v  (every 15 min via economy/sync)
serenissima-sync.js                  (fetches GRIEVANCES)
    |
    v
venice-state.js cache                (in-memory, queryable)
    |
    +--> citizen-router.js           (political context in conversations)
    +--> physics-bridge.js           (Tension nodes in FalkorDB)
    +--> WebSocket broadcast         (governance events to client)
          |
          +--> crowd simulation      (citizen movement toward palace)
          +--> notice board display  (3D text at Rialto / palace)
          +--> atmosphere shift      (district mood changes)
```

---

## Integration Sequence

Governance is Phase 4 (Polish) in the build order. It depends on most other
systems being functional first.

```
Prerequisites:
  - economy/sync working (GRIEVANCES table accessible)
  - citizens/population working (citizens can move to locations)
  - narrative/graph working (FalkorDB accepts Tension nodes)
  - world/districts working (Doge's Palace exists as a building)

Build order:
  1. Add GRIEVANCES to sync module fetch list
  2. Add governance event detection in venice-state.js
  3. Inject grievance context into citizen conversation prompts
  4. Build crowd movement toward palace during political events
  5. Build notice board 3D props
  6. Build narrative graph integration (grievances -> Tension nodes)
  7. Build guard NPC system (only after policy enforcement exists in Serenissima)
```

Steps 1-3 are data plumbing (1-2 days). Steps 4-6 are rendering work (3-5
days). Step 7 depends on Serenissima implementing policy enforcement.

---

## Open Questions

1. **Council deliberation implementation.** Serenissima's council system was
   not finished before the freeze. Should it be completed as rule-based (fast,
   cheap) or KinOS-enhanced (creative, costly)? The choice affects how rich
   the governance outcomes feel to the Venezia visitor.

2. **Threshold tuning.** What support count triggers council formation? Too
   low and councils form constantly. Too high and grievances expire before
   reaching threshold. Needs calibration against the active population (186
   citizens, but engagement probability varies by class).

3. **Grievance visibility to the visitor.** Should the visitor be able to read
   posted notices (3D text)? Or only hear about grievances through citizen
   conversation? Text breaks the "no UI" principle but is historically
   authentic (posted notices were a real Venetian governance mechanism).
   Recommendation: short notice text (1-2 lines) on physical boards is
   acceptable -- it is a world object, not a UI element.

4. **Political crisis events.** What happens when a major grievance is rejected
   but tension keeps building? The Blood Ledger physics engine can detect this
   (Moment flip from accumulated tension). But what does a political crisis look
   like in the 3D world? Riots? Curfew? Guards everywhere? This needs design
   work before implementation.

5. **Visitor influence path.** The PATTERNS doc says the visitor cannot directly
   influence governance. But indirectly (through conversation), a visitor could
   convince a citizen to file or support a grievance. Should this be an explicit
   mechanic (citizen decides based on conversation), or emergent (the LLM
   decides whether the conversation was persuasive)? Recommendation: emergent.
   Let the LLM handle it. Do not build a persuasion system.
