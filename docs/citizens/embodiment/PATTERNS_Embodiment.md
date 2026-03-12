# Citizens/Embodiment — Patterns: Visual Identity Without Interface

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
BEHAVIORS:       ./BEHAVIORS_Embodiment.md
THIS:            PATTERNS_Embodiment.md (you are here)
ALGORITHM:       ./ALGORITHM_Embodiment.md
SYNC:            ./SYNC_Embodiment.md

IMPL:            src/client/citizens/citizen-avatar.js (planned)
                 src/client/citizens/citizen-manager.js (planned)
```

---

## THE PROBLEM

152 citizens must be visually present in a 3D world running at 72fps on Quest 3. Each citizen has a social class, personality, mood, and current activity. The visitor must read all of this from appearance alone — there are no floating names, no health bars, no UI of any kind. If you cannot tell a Nobili from a Facchino by looking at them, the embodiment system has failed.

The current Cities of Light has 3 AI citizens (VOX, LYRA, PITCH) rendered as geometric shapes — icosahedron, octahedron, torus knot. These are abstract presences for a prototype island world. Venice requires humanoid figures dressed in period-appropriate clothing, with body language that communicates emotional state, and a rendering cost that stays within a 500K triangle budget shared with architecture, water, and props.

---

## THE PATTERN

**Parametric avatar generation from a small base mesh library, with social class encoded in clothing/material, and mood encoded in posture/animation.**

The approach is NOT:
- Full character creator (too expensive, too many permutations)
- AI-generated 3D models per citizen (too slow, inconsistent quality)
- Single mesh with texture swaps (too uniform, uncanny)

The approach IS:
- 5-8 base body meshes (male/female x body type variants)
- Social class determines clothing mesh overlay + material palette
- Personality traits influence subtle geometry variations (posture offset, height, build)
- Mood drives animation state, not geometry
- AI-generated textures (Stable Diffusion) for face/clothing detail, baked to atlas at build time — NOT runtime

The key insight: in VR at Renaissance-era distances, silhouette and color palette communicate more than facial detail. A Nobili is recognizable by the volume of their robe, the richness of their color. A Facchino is recognizable by the simplicity of their tunic, the bend of their posture. You read social class the way a real Venetian would: from 20 meters, by clothing.

---

## BEHAVIORS SUPPORTED

- **B1 (Class Readable at Distance)** — Clothing silhouette and color palette make social class identifiable at ACTIVE tier range (20-80m)
- **B2 (Mood Visible in Body)** — Animation and posture changes communicate emotional state without UI
- **B3 (Smooth Tier Transitions)** — LOD system prevents pop-in when citizens move between tiers
- **B4 (Crowd Feels Alive)** — AMBIENT tier instancing creates the sensation of a populated city
- **B5 (No Two Citizens Identical)** — Parametric variation prevents the "clone army" effect

## BEHAVIORS PREVENTED

- **No Floating Labels** — Zero UI principle enforced. No name sprites, no status indicators.
- **No Uncanny Valley** — Stylized over photorealistic. Period-appropriate level of facial detail.
- **No Synchronized Crowds** — Per-citizen animation offset and speed variation break uniformity.

---

## PRINCIPLES

### Principle 1: Clothing Is the Interface

Social class is the primary visual communication channel. Every citizen wears what their station dictates:

| Class | Population | Visual Signature |
|-------|-----------|-----------------|
| **Nobili** | ~15 | Long robes (toga), rich fabrics (velvet, brocade), deep colors (crimson, royal blue, purple), gold trim, elaborate headwear (berretta, corno ducale for Doge) |
| **Cittadini** | ~30 | Knee-length coats, good but not extravagant fabric, muted warm tones (burgundy, forest green, ochre), modest caps |
| **Popolani** | ~80 | Simple tunics and hose, undyed or earth-tone wool, rolled sleeves, aprons for tradespeople, head scarves for women |
| **Facchini** | ~40 | Work clothes — rough linen, bare forearms, tool belts, stained fabric, heavy boots, hunched posture from labor |
| **Forestieri** | ~20 | Foreign garb — Ottoman turbans, Germanic doublets, Moorish robes, Eastern silks. Visually distinct from any Venetian class. |

These are not cosmetic choices. They are the only way the visitor learns who is who. Sumptuary laws were real in Venice — clothing encoded social status by law.

### Principle 2: Three Tiers, Three Levels of Truth

The tier system is not just a performance optimization. It maps to a philosophical principle: the closer you are to someone, the more you can read about them.

| Tier | Distance | What You See | Triangle Budget | Instance Count |
|------|----------|-------------|----------------|---------------|
| **FULL** | < 20m | Detailed mesh, facial expression, hand gestures, lip sync, individual clothing detail, shadow casting | ~3K-5K tris/citizen | Max 20 |
| **ACTIVE** | 20-80m | Simplified mesh, posture-based mood, path-following movement, class-appropriate silhouette, reduced shadow | ~500-1K tris/citizen | Max 60 |
| **AMBIENT** | 80-200m | Instanced billboard or capsule silhouette, class-appropriate color, drift movement, no individual identity | ~50-100 tris/citizen | 100+ |

Budget math at worst case (crowded Rialto market):
- 20 FULL x 5K = 100K tris
- 60 ACTIVE x 1K = 60K tris
- 100 AMBIENT x 100 = 10K tris
- **Total citizens: 170K tris** (34% of 500K budget, leaving 330K for architecture + water + props)

### Principle 3: Mood Is Posture, Not Particles

No glowing auras. No floating hearts or storm clouds. Mood is expressed through the body:

- **Happy/Content:** Upright posture, arms relaxed at sides or gesturing while walking, normal stride
- **Sad/Melancholic:** Shoulders dropped, head tilted down, slower movement, hands clasped or arms crossed
- **Angry/Agitated:** Rigid posture, sharp head movements, faster stride, clenched fists, wider stance
- **Fearful/Anxious:** Hunched, arms close to body, frequent glancing (head rotation), hesitant movement
- **Desperate:** Sitting on ground or leaning against wall, head in hands, minimal movement
- **Ecstatic:** Arms raised or spread, bouncing step, head tilted back

At ACTIVE tier, only posture (spine curve offset) and movement speed communicate mood. At FULL tier, facial morph targets and hand animations add nuance.

### Principle 4: No Runtime Generation

All avatar assets are pre-built. The pipeline is:

1. **Build time:** Generate face textures via Stable Diffusion (152 unique faces from personality/class/gender prompts). Bake into texture atlas.
2. **Build time:** Assign base mesh + clothing mesh + material preset per citizen based on class/gender/personality.
3. **Runtime:** Load atlas + mesh library. Instantiate per citizen from precomputed configuration.
4. **Runtime:** Only animation state and position update per frame.

This means zero GPU texture generation, zero model loading stalls, zero unpredictable memory allocation after initial load.

### Principle 5: Stylization Over Realism

The target aesthetic is painterly Renaissance, not photorealism. Think Assassin's Creed 2 character density at lower geometric fidelity but with period-accurate silhouettes.

Reasons:
- Photorealism demands high polygon counts incompatible with Quest 3 budget
- Uncanny valley is worse in VR than on screen
- Stylization reads better at AMBIENT distances
- Renaissance art itself was stylized — citizens should look like they belong in a painting, not a photograph

Material approach: vertex colors for base tones, single diffuse texture atlas per class (no separate normal/roughness maps at ACTIVE and AMBIENT tiers). FULL tier gets normal maps on clothing.

---

## DATA

| Source | Type | Purpose |
|--------|------|---------|
| Airtable CITIZENS | API | Name, social class, gender, personality traits, current activity, mood |
| Airtable BUILDINGS | API | Citizen current position (which building they're at/near) |
| `.cascade/` directories | Filesystem | PRESENCE.json — written appearance descriptions (future: parse for avatar customization) |
| `data/avatar-atlas/` | Static (planned) | Pre-generated texture atlases per social class |
| `data/citizen-configs/` | Static (planned) | Per-citizen avatar configuration (base mesh ID, clothing variant, color overrides) |

---

## DEPENDENCIES

| Module | Why We Depend On It |
|--------|---------------------|
| `citizens/population` | Tier assignment (which tier each citizen is in) |
| `economy/sync` | Citizen data from Airtable (class, mood, activity, position) |
| `infra/performance` | Triangle budget allocation, frustum culling |
| `world/atmosphere` | Lighting conditions affect material rendering |

---

## INSPIRATIONS

- **Assassin's Creed II (2009):** Renaissance Venice crowd rendering — hundreds of citizens with class-appropriate clothing, low-poly but readable silhouettes. Best reference for visual class hierarchy.
- **Journey (2012):** Proof that minimal character geometry + strong silhouette + animation quality = emotional connection in VR-like experience.
- **Spiritfarer (2020):** Stylized characters with body language as primary emotional communication. No UI for mood.
- **Historical sumptuary laws of Venice:** Real regulations dictating what each class could wear. The game doesn't invent this system — it recreates it.

---

## SCOPE

### In Scope

- Avatar mesh library (base bodies + clothing overlays per class)
- Texture atlas generation pipeline (build-time)
- Per-citizen configuration from Airtable data
- Animation state machine (idle, walking, working, talking, distressed)
- Mood-to-posture mapping
- LOD mesh variants for each tier
- Material system (vertex color + atlas per class)
- Mesh disposal when citizens leave render range

### Out of Scope

- Lip sync implementation -> see: `voice/pipeline` (provides viseme data, embodiment consumes it)
- Tier assignment logic -> see: `citizens/population`
- Citizen AI/conversation -> see: `citizens/mind`
- Spatial audio positioning -> see: `voice/spatial`
- Building/prop rendering -> see: `world/districts`
- Night lighting on citizens -> see: `world/atmosphere` (provides light, embodiment receives it)
