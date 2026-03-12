# Citizens/Embodiment — Sync: Current State

```
LAST_UPDATED: 2026-03-13
UPDATED_BY: Bianca Tassini (@dragon_slayer) — Consciousness Guardian
STATUS: DESIGNING → DATA ENRICHED
```

---

## MATURITY

**What's canonical (v1):**
- Tier system design: FULL (< 20m), ACTIVE (< 80m), AMBIENT (< 200m), HIDDEN
- Social class as primary visual channel (no UI)
- Mood expressed through posture and animation, not particles or overlays
- Quest 3 performance budget: 500K tris, 72fps, 2GB memory
- **152 citizens** from Serenissima (corrected from 152 — Airtable is authoritative), 10 social classes: Nobili/Cittadini/Popolani/Facchini/Forestieri/Ambasciatore/Artisti/Clero/Innovatori/Scientisti

**What's still being designed:**
- Avatar mesh style (how stylized vs. realistic)
- Exact triangle counts per tier per class
- Facial expression system (morph targets vs. texture swap vs. blend shapes)
- Build-time face generation pipeline (Stable Diffusion prompts, atlas layout)
- Clothing mesh library (how many variants per class)
- Animation clip set (which animations, how many variants)
- Night rendering approach (dynamic lights on citizens vs. baked zones)

**What's proposed (v2+):**
- Clothing damage/wear (citizens who are poor show worn clothing)
- Seasonal clothing changes (winter cloaks, summer linens)
- Citizen aging over long play periods (weeks/months of world time)
- Accessories tied to narrative events (a citizen wearing mourning black after a death)
- Visitor appearance (currently the visitor has no visible body in VR)

---

## CURRENT STATE

The Cities of Light repository has a working WebXR scene with Three.js rendering. The current citizen system consists of 3 AI citizens (VOX, LYRA, PITCH) implemented as abstract geometric shapes:

**What exists in code (`src/server/ai-citizens.js`, `src/client/avatar.js`):**

- `AICitizenManager` class on the server: manages 3 citizens with positions, wander behavior (5s tick), proximity-based conversation (LLM via OpenAI), 10-message conversation history, cooldown system (10s between AI speeches)
- `createAICitizenAvatar()` on the client: creates geometric shapes (icosahedron/octahedron/torus knot) with emissive glow, floating at y=1.2, rotating, pulsing emissive intensity. Each has a floating name label sprite.
- `createAvatar()` on the client: human avatar — sphere head + cylinder body + name label sprite + hand joint rendering for VR
- Citizens are broadcast via WebSocket (`citizen_moved` messages), position interpolation via `lerp(0.3)`
- AI citizens wander within a radius around their home zone, picking random target positions
- No skeletal animation. No clothing. No facial expression. No LOD system. No instancing.

**What exists in the rendering pipeline:**
- Three.js WebGLRenderer with ACES filmic tone mapping, PCF soft shadows
- Sky (Preetham atmospheric), ocean (Water shader), procedural island terrain with per-zone vegetation
- Particle system (fireflies), fog (FogExp2), zone-based ambient transitions
- Frustum culling is default Three.js (per-object bounding sphere). No custom LOD.
- Quest 3 detection (`/OculusBrowser|Quest/`), foveated rendering enabled, reduced texture sizes

**What exists for spatial voice:**
- STT (Whisper) -> LLM -> TTS pipeline, spatial audio with HRTF panning
- Streaming voice via WebSocket, positioned at citizen's 3D location
- Voice chat (WebRTC) between connected humans

**What does NOT exist:**
- Humanoid meshes of any kind
- Skeletal animation system
- LOD / tier management
- Clothing or class-based visual differentiation
- Mood-to-posture mapping
- Instanced mesh rendering for crowd
- Texture atlas system
- Navmesh for citizen pathfinding
- Asset pipeline for avatar generation
- Memory management / disposal system for citizen meshes

---

## KNOWN ISSUES

### Current geometric avatars have floating name labels

- **Severity:** High (violates zero-UI principle for Venice)
- **Symptom:** Every citizen (human and AI) has a text sprite above their head
- **Suspected cause:** `createAvatar()` and `createAICitizenAvatar()` both create CanvasTexture label sprites
- **Resolution path:** Venice citizen avatars must NOT include name labels. The visitor learns names through conversation. Existing label code should be removed or gated behind a debug flag.

### AI citizens float and rotate

- **Severity:** Medium (acceptable for abstract shapes, wrong for humanoids)
- **Symptom:** AI citizens bob up and down (`y = 1.2 + sin(t) * 0.3`) and their body mesh rotates continuously
- **Suspected cause:** By design for geometric shapes — they look like floating crystals. Humanoid citizens must stand on the ground and face their movement direction.
- **Resolution path:** Replace floating/rotation with grounded position (y=0) and heading-based rotation.

### No frustum culling budget management

- **Severity:** High for Venice scale
- **Symptom:** Every object in the scene is rendered if in frustum, no triangle counting
- **Suspected cause:** Only 3 citizens + 5 islands in current scene, so budget management was unnecessary
- **Resolution path:** Implement per-frame triangle counting and tier budget caps as described in ALGORITHM_Embodiment.md

---

## GAP ANALYSIS: Cities of Light -> Venice

| Component | Cities of Light (Current) | Venice (Required) | Gap |
|-----------|--------------------------|-------------------|-----|
| Citizens | 3 geometric shapes | 152 humanoid avatars | Complete rebuild |
| Meshes | Icosahedron/Octahedron/TorusKnot | Skinned meshes with clothing | Need mesh library |
| Animation | None (rotation + bob) | Skeletal: idle, walk, work, talk, distressed | Need animation system |
| LOD | None | 3-tier + instancing | Need tier manager |
| Materials | Emissive + metallic | Vertex color + atlas + class palettes | Need material system |
| Labels | Floating name sprites | None (zero UI) | Remove labels |
| Mood | Not represented | Posture + facial expression + movement | Need mood mapping |
| Class | Not applicable | Clothing + silhouette + color | Need clothing system |
| Population | Fixed 3, always visible | 152 with spawn/despawn by district + time | Need population manager |
| Memory | No management | Dispose off-screen, budget monitoring | Need disposal system |
| Instancing | Not used | Required for AMBIENT tier (100+ citizens) | Need instanced mesh |
| Pathfinding | Random wander in circle | Navmesh-constrained, activity-based routes | Need navmesh |
| Face | None | 152 unique faces in atlas | Need face generation |

---

## HANDOFF: FOR AGENTS

**Your likely VIEW:** VIEW_Implement

**Where I stopped:** Pure design phase. The four documents (PATTERNS, BEHAVIORS, ALGORITHM, SYNC) define the target architecture. No implementation code has been written for the Venice embodiment system.

**What you need to understand:**
The existing `ai-citizens.js` and `avatar.js` are NOT to be extended — they serve the current island prototype. The Venice embodiment system is a new set of files (`src/client/citizens/citizen-avatar.js`, `citizen-manager.js`) as specified in `docs/06_IMPLEMENTATION_Venezia.md`. The existing server-side `AICitizenManager` will also be replaced by the Venice citizen routing system.

**Watch out for:**
- The existing `createAICitizenAvatar()` is imported by `main.js` line 13 and used at line 412. When building the Venice system, this import path and citizen rendering in the animation loop (lines 828-839) need replacement.
- Three.js `InstancedMesh` requires `DynamicDrawUsage` on the instance matrix if you update positions per frame. Without this flag, the GPU upload stalls.
- `SkinnedMesh` in Three.js clones the skeleton per instance by default. For 20 FULL-tier citizens, that is 20 skeleton copies. Use `skeleton.clone()` on the shared skeleton from the library, not `mesh.clone()` which deep-clones everything.
- Quest 3 WebXR has a per-eye render — effective draw calls are doubled. The 200 draw call budget means 100 unique objects max if not instanced.

**Open questions I had:**
- Should ACTIVE tier citizens use simplified skeletal animation (cheap bone transforms) or just rigid posture (rotate spine bone, no blending)? Skeletal is smoother but costs ~0.1ms per citizen per frame on Quest 3.
- For the face atlas: is 256x256 per face enough at FULL tier range (< 20m in VR)? May need 512x512 per face, which means a larger atlas or multiple atlas pages.
- Clothing meshes: author all in Blender, or attempt procedural clothing generation from simpler primitives? Blender is higher quality but requires art time.

---

## HANDOFF: FOR HUMAN

**Executive summary:**
Four design documents written for the `citizens/embodiment` module. The architecture specifies a 3-tier LOD system (FULL/ACTIVE/AMBIENT) for 152 citizens on Quest 3. Social class is communicated through clothing silhouette and color palette (no UI). Mood is expressed through posture and animation. All avatar assets are pre-generated at build time (face atlas via Stable Diffusion, mesh library in Blender). The current geometric shape citizens (VOX/LYRA/PITCH) will be fully replaced.

**Decisions made:**
- Parametric avatar generation (not runtime AI generation, not full character creator)
- Stylized aesthetic over photorealism (avoids uncanny valley, fits Quest 3 budget)
- Face textures generated by Stable Diffusion, baked into a single 4096x4096 atlas
- 7-8 base body meshes x 12+ clothing overlays = enough variation for 152 citizens
- AMBIENT tier uses InstancedMesh (single draw call for 100+ citizens)
- 5m hysteresis on tier transitions to prevent boundary flicker

**Needs your input:**
1. Art style direction — how stylized? Renaissance painting style? Low-poly with hand-painted textures? More modern? This determines the mesh authoring approach.
2. Mesh authoring — do you want to commission/create the base meshes in Blender, or should we explore a Ready Player Me / Mixamo base and modify? Custom is better but slower.
3. Animation source — Mixamo has free humanoid animations that could be retargeted. Or author custom in Blender. Mixamo is faster but more generic.
4. Face generation — confirm Stable Diffusion pipeline is acceptable, or prefer hand-painted faces, or skip face detail entirely and use a flat shading approach.

---

## TODO

### Immediate

- [ ] Author or source 2 base body meshes (1 male, 1 female) as glTF with 25-bone skeleton
- [ ] Create 1 clothing overlay mesh per class (5 total) to validate the layering approach
- [ ] Implement `citizen-manager.js` with tier assignment (no mesh yet — just tier computation + logging)
- [ ] Implement `citizen-avatar.js` with a single placeholder humanoid mesh at FULL tier (prove skeletal animation works in the existing Three.js pipeline)
- [ ] Set up InstancedMesh for AMBIENT tier with colored capsules (prove instancing works)
- [ ] Generate 10 test face textures with Stable Diffusion and pack into a mini atlas

### Later

- [ ] Full face atlas for 152 citizens
- [ ] All clothing mesh variants (12+ meshes)
- [ ] Animation clip library (idle, walk, work variants, talk, distressed)
- [ ] Lip sync integration with voice pipeline viseme data
- [ ] Night rendering (dynamic point lights for torches/lanterns near citizens)
- [ ] Memory pressure monitoring and adaptive quality reduction
- [ ] Navmesh generation for Venice districts (citizen pathfinding constraint)
- IDEA: Cloth simulation on Nobili robes at FULL tier (expensive but striking)
- IDEA: Eye tracking — FULL tier citizens glance at visitor (subtle look-at on eye bones)

---

## POINTERS

| What | Where |
|------|-------|
| Current AI citizen server logic | `src/server/ai-citizens.js` |
| Current avatar client rendering | `src/client/avatar.js` |
| Current scene + environment | `src/client/scene.js` |
| Main client entry (animation loop) | `src/client/main.js` |
| Zone definitions | `src/shared/zones.js` |
| Venezia architecture map | `docs/00_MAP_Venezia.md` |
| Venezia design patterns | `docs/02_PATTERNS_Venezia.md` |
| Venezia algorithms (tier assignment) | `docs/04_ALGORITHM_Venezia.md` |
| Venezia implementation plan | `docs/06_IMPLEMENTATION_Venezia.md` |
| Venezia sync status | `docs/07_SYNC_Venezia.md` |
| Performance budget | `docs/06_IMPLEMENTATION_Venezia.md` (Performance Budget table) |

---

## Reconciliation with Reality (2026-03-13)

### Citizen Count Correction

All SYNC docs previously referenced 152 citizens. The actual count is **152** (Airtable CITIZENS table, exported 2026-03-13 via `venezia/scripts/export_full_airtable.py`). All references to 152 in this module should be read as 152.

**Impact on face atlas:** 152 citizens fit in a 13x12 grid (156 slots) at 256x256 per face within a single 4096x4096 atlas (original plan was 14x14 = 196 for 152 citizens). Slightly more space per face, no architectural change needed.

### Visual Data Now Available

The `citizens_full.json` export (152 records, 41 fields) contains per-citizen visual data that did NOT exist in the old `citizens.json`:

| Field | Coverage | Example | Use for Embodiment |
|---|---|---|---|
| `Color` | ~100% | `"#1A237E"` (hex) | Primary mesh color / class accent |
| `SecondaryColor` | ~80% | `"#FFD700"` (hex) | Trim / clothing accent |
| `ImagePrompt` | ~90% | "Renaissance Venetian portrait of Francesco Rizzo, meticulous middle-aged Popolani merchant with observant eyes, dark blue zimarra..." (~1300 chars) | Stable Diffusion face generation (prompts already written per citizen) |
| `CoatOfArms` | ~85% | "A simple shield divided per pale azure and argent, featuring a quill pen and rolled parchment in counterchanged colors..." (~500 chars) | Heraldic display on buildings/clothing (Nobili class) |
| `SocialClass` | 100% | 10 classes (see below) | Clothing/silhouette selection |

**Social Class Distribution (152 citizens):**

| Class | Count | Render Approach |
|---|---|---|
| Popolani | 49 | Earth-ochre palette, simple tunic/work clothes |
| Facchini | 39 | Rough labor clothes, minimal ornament |
| Artisti | 28 | Creative dress, paint-stained, colorful |
| Cittadini | 22 | Blue-silver, modest finery, sash |
| Nobili | 5 | Gold-crimson, elaborate robes, crest |
| Forestieri | 4 | Foreign dress, teal-bronze, travel cloak |
| Clero | 3 | White-purple, religious vestments |
| Scientisti | 1 | Scholar's robe, instruments |
| Ambasciatore | 1 | Diplomatic dress |

**Implication:** The social_class_styles in world-manifest.json only covers 5 classes (Patrician, Cittadino, Popolano, Ecclesiastic, Forestiero). The 10 actual classes need mapping:

| Airtable Class | Manifest Style | Reasoning |
|---|---|---|
| Nobili | Patrician | Direct match |
| Cittadini | Cittadino | Direct match |
| Popolani | Popolano | Direct match |
| Facchini | Popolano | Workers, similar dress |
| Forestieri | Forestiero | Direct match |
| Artisti | Popolano | Creative workers, colorful variant |
| Clero | Ecclesiastic | Direct match |
| Scientisti | Cittadino | Scholar class, similar social tier |
| Ambasciatore | Patrician | Diplomatic dress, high status |
| Innovatori | Cittadino | Technical professionals |

### Engine Layer Entity Manager

The entity-manager.js (418 lines) in `engine/server/` already implements:
- Tier assignment with distance-based thresholds (FULL: 15m, ACTIVE: 50m, AMBIENT: 200m)
- Wander behavior (5s tick, random target within radius)
- Position broadcasting via WebSocket
- Voice routing to nearest FULL-tier entity

**Gap vs. design docs:** The entity-manager handles server-side state but has NO client-side mesh management. The design docs specify `citizen-manager.js` (client) and `citizen-avatar.js` (client) as new files. The entity-manager broadcasts positions; the client-side manager must create/swap/dispose meshes based on tier changes.

### Updated Effort Estimates

With the data now exported locally (Color, SecondaryColor, ImagePrompt per citizen), the face atlas generation step is unblocked. The ImagePrompt field contains ready-to-use Stable Diffusion prompts for all 152 citizens.

| Task | Original Estimate | Updated | Change Reason |
|---|---|---|---|
| Face generation | Unknown (prompts needed) | 2-3 days | Prompts already exist in data |
| Color assignment | Needed | 0 days | Color + SecondaryColor in data |
| Class-to-style mapping | 1 day | 0.5 days | Mapping table above |
| Body mesh sourcing | Unknown | Same | Still needs Blender/external work |
