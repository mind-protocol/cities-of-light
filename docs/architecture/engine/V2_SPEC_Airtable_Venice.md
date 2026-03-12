# V2 SPEC: Airtable-Driven Venice

```
STATUS: DESIGNING
DEPENDS_ON: V1 engine (CANONICAL)
DECIDED: 2026-03-12 by Nicolas (NLR)
```

---

## Goal

Transform Venezia from a 5-island demo with 3 entities into a **living Venice** with real geography, named buildings, 152 citizens, and bridges — all driven from the Serenissima Airtable database.

---

## Features (in delivery order)

### F1: Islands from LANDS Table

**What:** Each Airtable LAND record becomes a terrain island in the world, positioned using its real WGS84 coordinates and polygon boundary.

**Data source:** Serenissima Airtable `LANDS` table

| Field | Type | Use |
|-------|------|-----|
| `Name` | string | Island display name |
| `EnglishName` | string | English label |
| `Category` | string | "Island", "Public Area", etc. |
| `Position` | JSON `{lat, lng}` | Center point (WGS84) |
| `Polygon` | record link → POLYGONS | Boundary geometry |

**POLYGONS table:**

| Field | Type | Use |
|-------|------|-----|
| `buildingPoints` | JSON array | `[{lat, lng}, ...]` — boundary vertices |
| `bridgePoints` | JSON array | Bridge connection points |
| `canalPoints` | JSON array | Canal edges |
| `center` | JSON `{lat, lng}` | Centroid |

**Coordinate transform:**
- WGS84 → local XZ: Pick a reference point (center of Venice ≈ 45.4375°N, 12.3358°E)
- `x = (lng - ref_lng) * cos(ref_lat) * 111320` (meters east)
- `z = -(lat - ref_lat) * 110540` (meters north, negated for Z-forward)
- Scale: 1 world unit = 1 meter

**Engine changes:**
- New terrain generator: `"geographic"` in manifest
- Takes polygon boundaries, generates mesh per island
- Polygon → extruded shape (island surface at y=0.5, slopes to water at edges)
- Water plane at y=0

**Manifest change:**
```json
{
  "terrain": {
    "generator": "geographic",
    "reference_point": { "lat": 45.4375, "lng": 12.3358 },
    "water_level": 0,
    "island_height": 1.5,
    "ocean": true,
    "sky_model": "preetham",
    "sun": { "elevation": 12, "azimuth": 220 }
  },
  "lands": {
    "source": "airtable",
    "base_id": "appXXXXXXXX",
    "table": "LANDS",
    "polygon_table": "POLYGONS"
  }
}
```

**Alternative (static export):** Pre-export Airtable data to `lands.json` in the Venezia repo. Avoids runtime Airtable dependency.

```json
{
  "lands": {
    "source": "local",
    "path": "data/lands.json"
  }
}
```

**Recommended approach:** Static export. Airtable data changes slowly (geography is fixed). Export once, commit to repo, re-export when data changes.

---

### F2: Buildings at Correct Positions

**What:** Each Airtable BUILDING record becomes a 3D building at its real geographic position with its name displayed.

**Data source:** Serenissima Airtable `BUILDINGS` table

| Field | Type | Use |
|-------|------|-----|
| `Name` | string | Building display name (e.g., "Palazzo Ducale") |
| `EnglishName` | string | English name |
| `Category` | enum | "Palace", "Church", "Bridge", "Market", "Workshop", etc. |
| `Type` | enum | "Residential", "Government", "Religious", "Commercial" |
| `Size` | number | Building footprint size |
| `Position` | JSON `{lat, lng}` | WGS84 coordinates |
| `Point` | string | `"building_45.437908_12.337258"` |
| `ImageUrl` | URL | Reference image |
| `Owner` | link → CITIZENS | Building owner |
| `Land` | link → LANDS | Which island this is on |

**Engine changes:**
- New manifest section: `buildings`
- BuildingManager (server-side): loads building data, serves to clients
- Building renderer (client-side): places 3D buildings at XZ positions
- Name label system: floating text above each building
- Default building mesh: procedural Venetian building (cube + pitched roof, category-dependent color)

**Building categories → mesh style:**

| Category | Color | Shape | Height multiplier |
|----------|-------|-------|-------------------|
| Palace | 0xD4A574 | Wide rectangular | 1.5× |
| Church | 0xE8D5B7 | Cross-plan + dome | 2.0× |
| Market | 0xC4956A | Open-sided + awning | 0.8× |
| Workshop | 0xB8860B | Compact + chimney | 1.0× |
| Residential | 0xD2B48C | Narrow tall | 1.2× |
| Government | 0xC0C0C0 | Grand + columns | 1.8× |

**Manifest addition:**
```json
{
  "buildings": {
    "source": "local",
    "path": "data/buildings.json",
    "name_labels": true,
    "label_height": 3.0,
    "default_style": "venetian-procedural"
  }
}
```

---

### F3: 3D Assets for Buildings

**What:** Replace procedural building meshes with actual 3D models. Ideally with navigable interiors.

**Approach (priority order):**
1. **Procedural Venetian buildings** (V2.0) — parameterized by category, size, and style. Good enough to ship.
2. **Free asset libraries** (V2.1) — Sketchfab, TurboSquid. Search for "Venetian palace", "Italian church", etc. GLB/GLTF format.
3. **AI-generated meshes** (V2.2) — Use AI 3D generation (Meshy, Tripo3D, etc.) to generate category-specific buildings.
4. **Photogrammetry** (V2.3) — Use real Venice photogrammetry data (Google Earth tiles, OpenStreetMap 3D).

**Engine support:**
- GLTFLoader already available in Three.js
- Manifest building entry gets optional `model_path` field
- If `model_path` present → load GLTF. If absent → procedural fallback.

---

### F4: 152 Citizens Instantiated

**What:** All Serenissima Airtable citizens spawned in the world at their activity locations. Default geometric avatar per social class.

**Data source:** Serenissima Airtable `CITIZENS` table

| Field | Type | Use |
|-------|------|-----|
| `Username` | string | Citizen ID |
| `FirstName` | string | Display name part 1 |
| `LastName` | string | Display name part 2 |
| `SocialClass` | enum | "Nobili", "Cittadini", "Popolani", "Facchini", "Forestieri" |
| `Ducats` | number | Wealth |
| `ImageUrl` | URL | Portrait |
| `Position` | JSON `{lat, lng}` | Current location |
| `CurrentBuilding` | link → BUILDINGS | Where they are now |
| `CorePersonality` | text | Character personality |
| `Occupation` | string | What they do |

**ACTIVITIES table** (for position updates):

| Field | Type | Use |
|-------|------|-----|
| `Citizen` | link → CITIZENS | Who |
| `FromBuilding` / `ToBuilding` | link → BUILDINGS | Route |
| `Path` | JSON array | Waypoints `[{lat, lng}, ...]` |
| `StartedAt` / `EndedAt` | datetime | When |
| `Status` | enum | "in_progress", "completed" |

**Avatar by social class:**

| Class | Shape | Color | Size |
|-------|-------|-------|------|
| Nobili | Octahedron | 0xFFD700 (gold) | 1.2 |
| Cittadini | Icosahedron | 0xC0C0C0 (silver) | 1.0 |
| Popolani | Dodecahedron | 0xCD853F (peru) | 0.9 |
| Facchini | Cube | 0x8B7355 (brown) | 0.8 |
| Forestieri | Sphere | 0x87CEEB (sky blue) | 0.7 |

**Manifest:**
```json
{
  "entities": {
    "source": "local",
    "path": "data/citizens.json",
    "tier_config": {
      "FULL": { "max": 20, "radius": 15, "voice": true, "llm": true },
      "ACTIVE": { "max": 60, "radius": 50, "voice": "proximity", "llm": false },
      "AMBIENT": { "max": 200, "radius": 200, "voice": false, "llm": false }
    }
  }
}
```

**Position source:** Initially from `citizens.json` (static export). Future: live sync from Serenissima ACTIVITIES table for real-time movement.

---

### F5: Bridges

**What:** Create bridge meshes connecting islands where `bridgePoints` in POLYGONS data indicate connections.

**Data source:** POLYGONS table `bridgePoints` arrays. Each polygon has bridge connection points at its edges. Two polygons sharing a bridgePoint direction create a bridge.

**Engine changes:**
- New manifest section: `bridges`
- Bridge renderer: arch mesh connecting two points
- Walkable surface on bridge (collision plane)

**Manifest:**
```json
{
  "bridges": {
    "source": "local",
    "path": "data/bridges.json",
    "style": "venetian-arch",
    "width": 3,
    "rail_height": 1.0
  }
}
```

**Bridge data format:**
```json
[
  {
    "id": "rialto",
    "name": "Ponte di Rialto",
    "from": { "lat": 45.438, "lng": 12.336 },
    "to": { "lat": 45.439, "lng": 12.335 },
    "style": "grand-arch",
    "width": 5
  }
]
```

---

### F6: Aerial View + Walk-to-Building (AI Navigation)

**What:** Two new protocol commands that let AI citizens decide where to go.

**aerial_view command:**
- Engine renders a top-down orthographic capture of the world
- Sends as PNG to requesting AI entity via Manemus
- Image includes: terrain, buildings with name labels, citizen dots, compass
- AI uses this image to understand spatial layout and choose destinations

**ai_walk_to command:**
- Manemus sends `{ type: 'ai_walk_to', entity_id, building_id }`
- Engine resolves `building_id` to world position (from buildings data)
- Engine pathfinds entity to building position (A* on walkable surface)
- Entity moves along path, broadcasts position updates

**Protocol additions:**
```javascript
// Manemus → Engine
AI_MESSAGES.AI_WALK_TO = 'ai_walk_to';       // { entity_id, building_id }
AI_MESSAGES.AI_REQUEST_VIEW = 'ai_request_view'; // { entity_id, view_type: 'aerial' }

// Engine → Manemus
PERCEPTION_MESSAGES.AERIAL_VIEW = 'aerial_view'; // { entity_id, image_base64, buildings_visible[] }
```

---

## Data Pipeline

```
Serenissima Airtable
      │
      ├─── LANDS + POLYGONS ──► scripts/export_lands.py ──► venezia/data/lands.json
      ├─── BUILDINGS ──────────► scripts/export_buildings.py ──► venezia/data/buildings.json
      ├─── CITIZENS ───────────► scripts/export_citizens.py ──► venezia/data/citizens.json
      └─── ACTIVITIES ─────────► scripts/export_activities.py ─► venezia/data/activities.json
                                                                        │
                                                                        ▼
                                                              venezia/world-manifest.json
                                                                        │
                                                                        ▼
                                                              engine loads on startup
```

**Export scripts** live in `scripts/` in the Venezia repo. They:
1. Connect to Serenissima Airtable via API
2. Transform data (WGS84 → local coords, field mapping)
3. Write JSON files to `data/`
4. These JSON files are committed to the repo

**Environment:** `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` in `.env`

---

## Manifest V2 Schema Additions

New top-level sections added to WorldManifest:

| Section | Purpose |
|---------|---------|
| `lands` | Geographic island data source |
| `buildings` | Building data source and rendering config |
| `bridges` | Bridge connections between islands |

New terrain generator: `"geographic"` — renders islands from polygon data instead of procedural noise.

New entity source: supports 152 citizens with social class-based avatars.

New protocol messages: `ai_walk_to`, `ai_request_view`, `aerial_view`.

---

## Implementation Order

| Phase | Feature | Effort | Depends on |
|-------|---------|--------|------------|
| V2.0 | Export scripts (lands, buildings, citizens) | Medium | Airtable access |
| V2.1 | Geographic terrain generator | High | Exported lands data |
| V2.2 | Building placement + name labels | Medium | Geographic terrain |
| V2.3 | 152 citizens spawned | Medium | Exported citizens data |
| V2.4 | Bridge meshes | Medium | Geographic terrain |
| V2.5 | Aerial view + AI walk-to | High | Buildings + pathfinding |
| V2.6 | 3D building assets | Ongoing | Building placement |

---

## Open Questions

- **Airtable API key management** — Who owns the key? Is it in Serenissima's env already?
- **Coordinate precision** — At Venice scale (~3km), is meter precision sufficient for building placement?
- **Pathfinding algorithm** — A* on nav mesh? Simple Euclidean with obstacle avoidance? Canal constraints?
- **Interior navigation** — V2 or V3? If V2, buildings need interior meshes with entry points.
- **Live position sync** — Should engine poll Serenissima ACTIVITIES for real-time citizen movement, or static export is enough?

---

@mind:TODO Export Serenissima Airtable data to Venezia repo JSON files
@mind:TODO Implement geographic terrain generator in WorldLoader
@mind:TODO Implement BuildingManager and building renderer
@mind:TODO Extend manifest schema for lands, buildings, bridges
@mind:TODO Add aerial_view + ai_walk_to to protocol
