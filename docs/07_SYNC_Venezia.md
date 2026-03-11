# SYNC: Venezia — Current State

Last updated: 2026-03-11

---

## Status: DESIGNING

The vision is fully documented. No implementation of the Venezia crossover has begun. All three source systems exist independently.

---

## What Exists (from source systems)

### La Serenissima (citizens)
- **Status:** 186 citizens frozen (not actively running). Data preserved in Airtable.
- **Ready:** Citizen data (names, positions, classes, ducats, personalities, memories)
- **Ready:** Economic system (contracts, activities, stratagems, land, buildings)
- **Ready:** KinOS integration for authentic decision-making
- **Ready:** Relationship graph (trust scores between citizens)
- **Ready:** Citizen memory directories (`.cascade/` per citizen)
- **Needs reactivation:** Activity processors, economy tick, stratagem execution
- **Airtable base:** Active, accessible via API

### Cities of Light (spatial substrate)
- **Status:** WebXR frontend functional with 5 island zones
- **Ready:** Three.js rendering pipeline, spatial audio, VR controls
- **Ready:** Voice pipeline (STT Whisper → LLM → TTS ElevenLabs)
- **Ready:** Express.js WebSocket server for real-time state sync
- **Ready:** AI citizen framework (3 citizens: VOX, LYRA, PITCH — placeholder)
- **Needs:** Venice district generation (replacing island zones)
- **Needs:** Citizen rendering pipeline (186 citizens, not 3)
- **Needs:** Blood Ledger integration

### Blood Ledger (narrative physics)
- **Status:** Engine designed, partially implemented. FalkorDB schema defined.
- **Ready:** Graph schema (Character, Narrative, Moment, Place nodes)
- **Ready:** Physics tick concept (energy, decay, tension → Moment flip)
- **Ready:** Agent architecture (Narrator, World Builder, World Runner)
- **Ready:** FalkorDB Docker container (port 6379)
- **Needs:** Venice-specific graph seeding (186 citizens → Character nodes)
- **Needs:** Tension seeding from Serenissima grievances
- **Needs:** Physics tick integration with Express server

---

## Documentation Chain Status

| Document | Status | Notes |
|---|---|---|
| 01_OBJECTIFS | Complete | Vision, anti-patterns, success metrics |
| 02_PATTERNS | Complete | Design philosophy, architecture decisions, scope |
| 03_BEHAVIORS | Complete | Full observable behavior specification |
| 04_ALGORITHM | Complete | Pseudocode for all systems |
| 05_VALIDATION | Complete | POC milestones with acceptance criteria |
| 06_IMPLEMENTATION | Complete | Code architecture, data flows, deployment |
| 07_SYNC (this file) | Active | Current state tracking |

---

## Next Actions (Priority Order)

### 1. POC-1: One District, Three Citizens
- [ ] Generate Rialto district geometry (canals, buildings, bridge)
- [ ] Load 3 citizens from Airtable (merchant, worker, noble)
- [ ] Implement citizen-avatar.js (basic 3D body at citizen position)
- [ ] Route visitor speech to Claude API with citizen context
- [ ] Spatial TTS playback at citizen position
- [ ] Verify: citizen states match Airtable data

### 2. Serenissima Reactivation
- [ ] Verify Airtable data integrity (186 citizens, positions, Ducats)
- [ ] Test economy tick (one cycle manually)
- [ ] Restart activity processor (cron or daemon)
- [ ] Verify citizen memory directories exist for all 186

### 3. Blood Ledger Graph Seeding
- [ ] Script to create Character nodes from Serenissima citizens
- [ ] Script to create Narrative nodes from active grievances/tensions
- [ ] Seed initial Moments (potential events ready to flip)
- [ ] Test physics tick with seeded data

---

## Open Questions

1. **Citizen voice differentiation:** How many distinct TTS voices do we need? ElevenLabs supports custom voices. Do we generate 186 unique voices or use ~20 archetypes mapped by personality/class?

2. **Visitor identity persistence:** localStorage for browser, but what about VR headset? Is there a persistent storage API on Quest 3 for WebXR apps?

3. **Serenissima reactivation cost:** Running 186 citizens 24/7 requires LLM API calls. Estimate API cost per day. Is it sustainable with current budget?

4. **Venice geometry source:** Procedural-only or do we use real Venice GIS data (OpenStreetMap) as a base and stylize it? Real data would give accurate canal layout.

5. **Night experience:** With no UI and few citizens, night could be boring. Do we accelerate time at night? Or is the emptiness intentional?

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| LLM cost for 186 citizens 24/7 | High | Tier system: only FULL-tier citizens use LLM. AMBIENT uses templates. |
| Quest 3 performance with 186 citizens | High | Aggressive LOD + tier culling. Only render what's in view. |
| Citizen responses feel generic | Critical | Validate context injection. Every response must reference actual state. |
| World feels empty between events | Medium | Ambient design: always some citizens walking, talking, working. |
| Serenissima data is stale (frozen) | Medium | Run 1 week of simulation before launching 3D world. |

---

## Handoff Notes

This document chain was created in a single session on 2026-03-11. It represents the full design specification for the Venezia crossover concept. The design synthesizes three existing systems (La Serenissima, Cities of Light, Blood Ledger) into a unified living world.

**For the implementing agent:** Start with POC-1. The most important thing to validate first is: can a visitor have a conversation with a Serenissima citizen in 3D space and feel like they're talking to a real person? Everything else depends on this.

**For Nicolas:** The vision is documented. The 7-document chain covers objectives through implementation. Review each document and flag any misalignment with your intent. Key decision needed: Venice geometry approach (procedural vs. GIS-based).
