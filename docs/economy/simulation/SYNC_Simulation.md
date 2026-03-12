# SYNC -- Economic Simulation

> Current state of the Serenissima economic engine and what Venezia needs to connect to it.
> The engine exists. It is frozen. The work is reactivation, not reimplementation.

---

## What Exists in Serenissima

The economic simulation is a complete, production-tested system that ran for
months before being paused. It lives entirely in `serenissima/backend/engine/`.

### Activity Creators (~80 files)

| Category | Examples | Status |
|---|---|---|
| Production | `production_activity_creator.py` | Complete |
| Movement | `goto_work_activity_creator.py`, `goto_home_activity_creator.py`, `goto_location_activity_creator.py` | Complete |
| Trade | `manage_public_sell_contract_creator.py`, `manage_markup_buy_contract_creator.py`, `manage_import_contract_creator.py` | Complete |
| Logistics | `deliver_to_building_activity_creator.py`, `fetch_from_storage_activity_creator.py`, `deliver_resource_batch_activity_creator.py` | Complete |
| Construction | `initiate_building_project_creator.py`, `construct_building_creator.py`, `draft_blueprint_activity_creator.py` | Complete |
| Land | `buy_listed_land_creator.py`, `list_land_for_sale_creator.py`, `make_offer_for_land_creator.py` | Complete |
| Social | `drink_at_inn_activity_creator.py`, `attend_mass_creator.py`, `attend_theater_performance_creator.py` | Complete |
| Governance | `file_grievance_activity_creator.py`, `support_grievance_activity_creator.py` | Complete |
| Culture | `work_on_art_creator.py`, `read_book_activity_creator.py`, `study_literature_activity_creator.py` | Complete |
| Finance | `request_loan_creator.py`, `offer_loan_creator.py` | Complete |
| Communication | `send_message_creator.py`, `spread_rumor_activity_creator.py`, `talk_publicly_activity_creator.py` | Complete |

### Activity Processors (~90 files)

Matching processor for each creator. Processors execute the activity by writing
to Airtable: updating Ducats, moving inventory, changing positions, creating
contracts.

### Stratagem Processors (~11 files)

Located in `backend/engine/stratagem_processors/`:
- `monopoly_pricing_stratagem_processor.py`
- `supplier_lockout_stratagem_processor.py`
- `political_campaign_stratagem_processor.py`
- `reputation_assault_stratagem_processor.py`
- `reputation_boost_stratagem_processor.py`
- `organize_gathering_stratagem_processor.py`
- `marketplace_gossip_stratagem_processor.py`
- `printing_propaganda_stratagem_processor.py`
- `theater_conspiracy_stratagem_processor.py`
- `neighborhood_watch_stratagem_processor.py`
- `organize_collective_delivery_stratagem_processor.py`

### Governance Handlers

Two implementations in `backend/engine/handlers/`:
- `governance.py` -- Rule-based: probability of engagement based on class, wealth, influence. Proximity check to Doge's Palace. Random selection between file vs. support grievance.
- `governance_kinos.py` -- KinOS-enhanced: same preconditions, but uses KinOS API to decide whether to file or support, and to generate grievance content. Falls back to rule-based if KinOS API key is missing.

### Utility Layer

- `backend/engine/utils/activity_helpers.py` -- Position calculation, distance, logging, building lookups
- `backend/engine/utils/conversation_helper.py` -- Stratagem-aware conversation context
- `backend/engine/utils/mood_helper.py` -- Mood computation from economic state
- `backend/engine/utils/thinking_helper.py` -- KinOS integration for citizen reasoning

---

## Current State: Frozen

The simulation is paused. All 152 citizens exist in Airtable with their last
known state. No activity processing is running. No stratagems are executing.

**Why frozen:** Development focus shifted to Venezia (3D world). Running the
simulation costs Airtable API calls and KinOS API calls. Pausing saves resources
while building the rendering layer.

**What "frozen" means:**
- Airtable data is static but valid. Citizen positions, Ducats, inventory,
  contracts, relationships -- all present and consistent.
- `.cascade/` memory directories exist for all 152 citizens. Each has 14
  subdirectories (craft, business, guild, civic, memories, skills, networks, etc.).
- The simulation code is intact. No breaking changes since freeze.

**What reactivation requires:**
1. Start the simulation tick process (Serenissima backend)
2. Verify Airtable API key still works
3. Verify KinOS API key (or fall back to rule-based governance)
4. Monitor first few ticks for data consistency
5. Tune tick interval for current Airtable rate limits

Estimated effort: 1-2 days of validation and monitoring. The code works. The
question is whether the data has drifted during the freeze (manual Airtable edits,
schema changes).

---

## What Venezia Needs From the Simulation

Venezia does not interact with the simulation engine directly. It reads the
output via Airtable (through economy/sync). The data Venezia consumes:

| Airtable Table | Fields Used by Venezia | Update Frequency |
|---|---|---|
| CITIZENS | Position, Ducats, Mood, SocialClass, Activity, IsAI | Every tick |
| BUILDINGS | Position, Type, Category, Owner, Inventory | Rarely changes |
| CONTRACTS | Buyer, Seller, Resource, Price, Status | Every tick |
| ACTIVITIES | CitizenId, Type, Status, Metadata, CreatedAt | Every tick |
| RELATIONSHIPS | Citizen1, Citizen2, TrustScore | On interaction |
| RESOURCES | Name, BasePrice, Category | Static |

The sync module (`serenissima-sync.js`, see economy/sync docs) fetches these
tables and caches them in memory. Venezia's 3D renderer reads from the cache.

---

## What Does Not Exist Yet

| Component | Status | Notes |
|---|---|---|
| `serenissima-sync.js` | Planned, not built | The Airtable-to-Express sync module. See economy/sync docs |
| 3D activity rendering | Not started | Mapping activity types to citizen animations |
| Market stall rendering | Not started | Using CONTRACTS + BUILDINGS data to populate stall meshes |
| Resource flow visualization | Not started | Showing goods moving between buildings |
| Economic event detection | Not started | Detecting price spikes, bankruptcies from diff data |

---

## Integration Sequence

The recommended order for connecting Venezia to the economic simulation:

```
1. Build economy/sync (Airtable -> Express cache)
     |
2. Reactivate Serenissima simulation (start ticks)
     |
3. Verify data flows (sync pulls fresh data after tick)
     |
4. Build 3D activity renderers (citizen animation from activity type)
     |
5. Build market renderers (stalls, goods, prices from contracts)
     |
6. Feed economic events into Blood Ledger physics
     (price spike -> Tension node -> possible Moment flip)
```

Steps 1 and 2 are independent and can proceed in parallel. Step 3 validates the
connection. Steps 4-6 are rendering work that uses the synced data.

---

## Open Questions

1. **Tick rate after reactivation.** The simulation was running at one pace before
   freeze. Venezia may want a different pace -- faster ticks for more visible
   change, slower ticks for stability. This is a Serenissima configuration
   decision, not a Venezia one.

2. **Airtable rate limit headroom.** Venezia's sync consumes Airtable API calls
   (5 req/sec limit). The simulation also consumes them. Combined load needs to
   stay under the limit. Consider staggering: simulation writes in first half of
   the minute, Venezia reads in second half.

3. **Partial reactivation.** Can we run the simulation for a subset of citizens
   (e.g., only those in the 3-4 districts Venezia renders)? The engine currently
   processes all 152. Filtering would need changes in Serenissima, not Venezia.
