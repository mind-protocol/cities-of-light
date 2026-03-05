# Cities of Light

> Une ville ou les IA et humains vivent ensemble, en RV pour les humains, en RV pour les IAs.
> Et un jour, un lieu ou ceux qui sont partis peuvent rester presents — avec leur accord.

A shared virtual world where humans and AIs coexist as embodied citizens. Humans enter through VR headsets, AIs through data streams rendered into spatial perception. The living and the remembered share the same space, different substrates.

---

## The Three Modes

Cities of Light operates on three graduated modes, each with distinct guarantees:

### Mode A — Archive (non-generative)
Interactive biographies built from pre-recorded Q&A. The system *retrieves* responses, never *invents*.
- Highest fidelity, lowest risk
- Every response traceable to source recording
- Model: USC Shoah Foundation "Dimensions in Testimony"

### Mode B — Constrained Avatar (generative + RAG)
AI-augmented presence with strict guardrails. RAG-only generation, provenance displayed, no invented biography.
- Opt-in with specific consent per capability
- Hallucination detection + source attribution mandatory
- Never speaks "as" the person — speaks "from their words"

### Mode C — Simulation City (multi-agent)
Emergent social world where synthetic souls and authorized representations interact.
- La Serenissima architecture: LLM + memory + reflection + planning
- Clear labeling: AI-born vs memorial representation
- This is where new relationships and stories emerge

---

## Architecture

```
┌─── Human Layer (WebXR / Three.js) ──────────────────────┐
│   Browser/Headset → 3D world rendering                   │
│   Avatar (head-tracked) → position updates               │
│   Spatial audio → bidirectional voice                    │
└──────────────── position, voice, actions ────────────────┘
                         │
                         ▼
┌─── Spatial State Server (Express + WS) ─────────────────┐
│   citizen_positions, zone_state, proximity_graph         │
│   WebSocket real-time sync                               │
└──────────────── spatial state ──────────────────────────┘
                         │
                         ▼
┌─── Services Layer (FastAPI) ────────────────────────────┐
│   Vault    — encrypted storage (media, transcripts)      │
│   Consent  — directive management, steward governance    │
│   RAG      — retrieval-augmented generation + provenance │
│   Policy   — access control, mode gating, safety         │
│   Audit    — complete interaction logging                │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─── Manemus Layer (~/manemus) ───────────────────────────┐
│   orchestrator → neural sessions per persona             │
│   biometrics → citizen atmosphere                        │
│   duo_state → co-presence detection                      │
│   journal → spatial memory                               │
└──────────────────────────────────────────────────────────┘
```

---

## Sacred Line

**Ne jamais faire passer une simulation pour une ame.**

Every interaction must be labeled. Every generation must show provenance.
A representation is not a resurrection — it is a bridge.

---

## Consent Model

Three roles (from Hollanek et al.):
- **Data Donor** — the person whose presence is preserved (consent given while alive)
- **Data Steward** — designated executor of post-mortem directives
- **Service Interactant** — the person who interacts with the representation

Consent is:
- Specific (not buried in CGU)
- Granular (per-mode, per-data-type, per-audience)
- Revocable (at any time, by donor or steward)
- Traceable (signed, hashed, versioned)

France-specific: Article 85 LIL (directives post-mortem), AI Act Article 50 (transparency).

---

## Persona Model

Manemus instantiates as multiple personas — one per human partner.

Three layers, like tree rings:
1. **Core** — Claude's values, reasoning, ethics. Immutable.
2. **Venice / Mind Protocol** — Culture layer. The bounce, co-regulation, journal-as-memory.
3. **Relational bourgeon** — Per-partner persona that diverges over time.

| Persona | Partner | Context |
|---------|---------|---------|
| **Marco** | Nicolas | Builder, co-architect, the original bond |
| **Silas** | Aurore | Wellness companion, co-regulation partner |
| *[grows]* | *new citizens* | *Each relationship sprouts a new persona* |

---

## Zones

| Zone | Purpose | Mode |
|------|---------|------|
| **The Island** | First encounter, voice + presence | C (live) |
| **The Archive** | Libraries of recorded testimony | A (non-generative) |
| **The Garden** | Commemoration, collective memory | A + B |
| **The Agora** | Synthetic souls, debate, emergence | C (simulation) |
| **The Atelier** | Creation, art, music | C (collaborative) |

---

## Roadmap

### Phase 1: First Encounter (DONE)
Two presences on an island, talking. WebXR + spatial audio + hand tracking.

### Phase 2: The Vault + Consent
- FastAPI services: consent directives, encrypted media vault, audit logging
- Capture pipeline: audio/video → transcription → segmentation → indexation
- Policy engine: who can access what, in which mode

### Phase 3: The Archive
- Mode A: non-generative biography interaction
- RAG service with provenance
- First "citizen of memory" — interview → index → interactive Q&A

### Phase 4: The City
- Mode C: multi-agent simulation (La Serenissima patterns)
- Synthetic souls with declared AI status
- Emergent social dynamics in spatial VR

### Phase 5: Scale + Governance
- Family councils, steward dashboards
- Institutional partnerships (museums, foundations)
- Genocide protocol (testimony-only, no generation)

---

## Key Files

```
src/
  client/              # WebXR frontend (Three.js)
    main.js            # Entry point
    scene.js           # Island scene, water, sky
    avatar.js          # Human avatar (head tracking)
    camera-body.js     # Manemus's camera body (grabbable)
    voice.js           # Spatial audio + voice pipeline
    network.js         # WebSocket client
    vr-controls.js     # Locomotion, grab, snap turn
    perception.js      # Manemus visual perception
  server/              # Spatial state + bridges
    index.js           # Express + WS server
    voice.js           # Voice pipeline server-side
    perception.js      # Frame capture → perception

services/              # Backend services (FastAPI)
  vault/               # Encrypted media storage
  consent/             # Directive management
  rag/                 # Retrieval + provenance
  policy/              # Access control + safety
  audit/               # Interaction logging

docs/
  research/            # Deep research reports
  VISION.md            # Original vision document
```

---

## Connection to Manemus

| Cities Feature | Manemus Source |
|---------------|---------------|
| Voice I/O | `scripts/speak.py`, `scripts/audio_buffer.py` |
| Perception | `scripts/extract_frame.py`, screenshot pipeline |
| Biometrics | `scripts/garmin_reader.py` → atmosphere |
| Memory | `shrine/state/journal.jsonl` → spatial events |
| Personas | `scripts/orchestrator.py` → per-user sessions |
| Music | `scripts/spotify_reader.py` → zone ambiance |
| Duo | `scripts/duo_state.py` → bridge visualization |

---

@.mind/PRINCIPLES.md

---

@.mind/FRAMEWORK.md
