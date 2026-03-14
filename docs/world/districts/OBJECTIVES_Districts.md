# OBJECTIVES: world/districts — What We Optimize For

STATUS: STABLE
CREATED: 2026-03-14
VERIFIED: 2026-03-14 against engine/client/ codebase

---

## CHAIN

OBJECTIVES (you are here) → [PATTERNS](./PATTERNS_Districts.md) → [BEHAVIORS](./BEHAVIORS_Districts.md) → [ALGORITHM](./ALGORITHM_Districts.md) → [VALIDATION](./VALIDATION_Districts.md) → [IMPLEMENTATION](./IMPLEMENTATION_Districts.md) → HEALTH → [SYNC](./SYNC_Districts.md)

IMPL: `engine/client/world-loader.js`, `engine/client/building-renderer.js`, `engine/client/bridge-renderer.js`

Read this chain in order. Each document builds on the previous.

---

## PRIMARY OBJECTIVES (ranked)

### O1. Venice Renders from Real Geographic Data

The 120 island polygons, 255 buildings, and 281 bridges from `venezia/data/` produce a recognizable Venice in the browser. Real island shapes, real building positions, real bridge connections. The visitor sees Venice — not a generic city, not a placeholder.

**Motivation:** The world IS the proof. If the AI citizens live in Venice, then Venice must exist and be recognizable. The data is already exported. The rendering must honor it.

### O2. 60fps in Desktop Browser, 72fps on Quest 3

Performance is not negotiable. If the world stutters, the illusion breaks. 120 islands × ExtrudeGeometry + 255 buildings + 281 bridges must render at framerate on consumer hardware.

**Motivation:** This is a landing page experience. First-time visitors on average laptops with integrated GPUs. If it's slow, they leave.

### O3. District Identity Through Architecture, Not UI

No labels, no minimap, no district name popups. The visitor knows where they are from what they see: Rialto's narrow commercial streets, San Marco's grand piazza, Castello's intimate residential lanes. Each district has a distinct visual vocabulary.

**Motivation:** Zero UI is a core design principle. The world teaches through experience, not overlay.

### O4. Walkable World with Coherent Navigation

The visitor can walk (WASD + mouse on desktop) through Venice continuously. Islands connect via bridges. No falling through geometry. No invisible walls. The fondamenta (quayside walkways) and bridges form a connected navigable graph.

**Motivation:** The visitor must be able to approach any citizen in the world. If navigation is broken, encounters are impossible.

### O5. Deterministic Generation

Same data → same world, every time. A visitor returns and recognizes their Venice. Buildings don't shift. Bridges don't move. Seed-based procedural elements (gap-fill buildings, props) are reproducible from record IDs.

**Motivation:** The world must feel persistent. Citizens reference locations ("my house near the Rialto bridge"). If the world regenerates differently each load, those references break.

---

## NON-OBJECTIVES

- **Photorealistic rendering** — Stylized is fine. Boxes with roofs are fine for V1. Feel over fidelity.
- **Interior building geometry** — V1 is exterior only. No rooms, no floor plans.
- **Destructible or animated buildings** — Buildings are static geometry.
- **Real GIS import** — We use curated polygon data, not raw OpenStreetMap.
- **Live Airtable sync** — V1 uses static JSON. No API calls during rendering.
- **Mobile support** — Desktop and Quest 3 only for V1.

---

## TRADEOFFS

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Building detail | Basic boxes + roofs | Full Venetian facades | Get rendering working first. Facade detail is enhancement, not foundation. |
| Terrain source | Real polygons (lands.json) | Procedural generation | We have the data. Using it is faster and more authentic than generating. |
| Water rendering | Implicit (plane at y=0) | Per-canal water meshes | Simpler. Canals are negative space between islands. Water plane fills gaps. |
| Navigation model | Desktop-first (WASD) | VR-first (teleport) | Most visitors arrive via web browser. VR is important but second priority. |
| Island count | All 120 at once | Stream/LOD | ExtrudeGeometry is lightweight. Load all, measure, optimize only if needed. |

---

## SUCCESS SIGNALS

1. Open browser → see Venice: 120 islands, buildings, bridges, water
2. Walk from Rialto area to San Marco area continuously without falling
3. FPS counter shows ≥ 60fps on a mid-range laptop
4. Different districts have visually different building styles
5. Returning to the same URL shows the same world
6. A non-technical person says "that looks like Venice"

---

## MARKERS

@mind:todo Complete HEALTH doc for this module
