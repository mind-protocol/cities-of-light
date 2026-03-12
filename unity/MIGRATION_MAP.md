# Migration Map: Web Prototype → Unity

Docs only. No runtime changes. No scope expansion.

---

## 1. `src/shared/zones.js` → `ZoneManager.cs`

**Purpose**: Zone definitions (id, name, position, fog, light) + nearest-zone detection.

**Unity equivalent**: `ZoneManager.cs` — already exists, already works.

**Reuse**: Yes. Logic is 1:1 ported. Zone struct matches. `GetNearestZone` uses squared distance (better than web version which uses sqrt). Fog lerp, light lerp, teleport — all present.

**Data structures that survive**:
| JS field | C# field | Notes |
|---|---|---|
| `id` | `id` | string, identical |
| `name` | `displayName` | renamed |
| `position.x/z` | `center` | Vector3, y=0 |
| `ambient.fogColor` | `fogColor` | hex→Color |
| `ambient.fogDensity` | `fogDensity` | float, identical |
| `ambient.lightColor` | `lightColor` | hex→Color |
| `ambient.lightIntensity` | `lightIntensity` | float, identical |

**Not ported (not needed tonight)**:
- `loreName`, `mode`, `seed`, `terrain.*`, `particleColor`, `particleType`, `waypoints[]`

**Unity type**: MonoBehaviour (scene singleton). Correct as-is. Not a ScriptableObject — zone data is small, hardcoded, inspector-editable.

---

## 2. `src/client/sculpture.js` → NEW `Sculpture.cs`

**Purpose**: Geometric art anchor on The Archive. Procedural mesh (icosahedron core + dodecahedron shell + torus ring + pedestal + column). Proximity-triggered inscription plaque. Slow rotation + emissive pulse.

**Unity equivalent**: Does not exist yet. Needs `Sculpture.cs` MonoBehaviour.

**Reuse**: Partial.
- Proximity logic (distance check, plaque show/hide): direct port.
- Rotation/pulse animation: direct port (`Transform.Rotate`, material `_EmissionColor` lerp).
- Procedural mesh: **do not port**. Use Unity primitives (Sphere for core, Sphere for shell scaled, Torus not a primitive — use a thin Cylinder ring or skip). Or just place a prefab.
- Canvas-based plaque: replace with `TextMeshPro` on a world-space Canvas or a `TextMeshPro` 3D label.

**Data structures that survive**:
| JS field | C# field |
|---|---|
| `name` | `string name` |
| `inscription` | `string inscription` |
| `color` (hex) | `Color emissiveColor` |
| `shape` ('citizen') | `enum SculptureShape` |
| `isNearby` | `bool isNearby` |
| proximity radius (4m) | `float proximityRadius = 4f` |

**Unity type**: MonoBehaviour on a prefab.
- Core/shell/ring/pedestal/column = child GameObjects with MeshRenderer.
- Plaque = child `TextMeshPro` (world-space), toggled by proximity.
- Config fields exposed in Inspector.

**Tonight's minimum**: Empty GameObject at (-27, 0, -27) with a capsule + emissive material + TMP inscription. No custom mesh.

---

## 3. `src/client/wearable-display.js` → NEW `WearableDisplay.cs`

**Purpose**: Pedestal with rotating collectible on The Agora. Proximity prompt, grip-to-collect, local state only.

**Unity equivalent**: Does not exist yet. Needs `WearableDisplay.cs` MonoBehaviour.

**Reuse**: Partial.
- Proximity + collect logic: direct port.
- Rotation + float bob: direct port (`Mathf.Sin` bob, `Transform.Rotate`).
- Pedestal geometry: use Unity primitives (3 Cylinders). Direct.
- Crown/mask/wings geometry: **do not port procedurally**. Use primitives or skip detail.
- Canvas label/prompt: replace with `TextMeshPro`.

**Data structures that survive**:
| JS field | C# field |
|---|---|
| `name` | `string name` |
| `description` | `string description` |
| `color` (hex) | `Color accentColor` |
| `type` ('crown'/'mask'/'wings') | `enum WearableType` |
| `collected` | `bool collected` |
| `isNearby` | `bool isNearby` |
| proximity radius (2.5m) | `float proximityRadius = 2.5f` |

**Unity type**: MonoBehaviour on a prefab.
- Pedestal = 3 child Cylinders (base, column, platform).
- Wearable = child primitive (Torus→Cylinder ring for crown, Sphere for mask).
- Prompt/label = child `TextMeshPro`, opacity toggled by proximity.
- Collect interaction: XRI `XRGrabInteractable` or just grip button + proximity check.

**Tonight's minimum**: Pedestal (3 cylinders) at (-18, 0, 37) with a small gold sphere on top + TMP label. Collect on proximity + grip.

---

## 4. `src/client/ownership-ui.js` → NOT PORTED

**Purpose**: DOM overlay showing zone name, lore, owner, claim button. 2D HTML panel.

**Unity equivalent**: World-space Canvas or XR UI panel. But this file explicitly says `setVisible(false)` in VR — it's a 2D-only overlay.

**Reuse**: No. DOM manipulation has zero equivalent in Unity. The data it displays (zone name, mode) is already in `ZoneManager.cs` and shown via the `zoneLabel` TMP.

**Decision**: Skip entirely. Zone name is already displayed by `ZoneManager.zoneLabel`. Ownership is placeholder with no backend. Do not port dead UI.

---

## 5. Shared Geometry / Material Logic

### `src/client/scene.js` → `IslandBuilder.cs`

Already ported. Maps:

| Web (scene.js) | Unity (IslandBuilder.cs) |
|---|---|
| `buildIsland(seed, palette)` | `BuildTerrain()` — Perlin disc mesh |
| `buildPalmTrees(seed)` | `BuildPalms(count)` — Cylinder+Sphere |
| `buildCrystals(seed, ambient)` | `BuildCrystals(count)` — Capsule, emissive |
| `buildColumns(seed, ambient)` | `BuildColumns(count)` — Cylinder+Cube |
| `buildRockFormation(seed)` | Not ported (not critical) |
| `buildFlowers(seed, ambient)` | Not ported (Garden not in tonight's 3 zones... wait, Garden is excluded. Only Island/Archive/Agora.) |
| `PALETTES` object | Inline colors in `CreateDefaultMaterial()` |

### Materials that can be shared across zones

These should be **pre-created Material assets** in `Assets/_Project/Materials/`, not runtime `new Material()`:

| Material | Used By | URP Shader |
|---|---|---|
| `M_Sand` | Island terrain | URP/Lit, color (0.83, 0.72, 0.48) |
| `M_DarkBlue` | Archive terrain | URP/Lit, color (0.23, 0.29, 0.42) |
| `M_Marble` | Agora terrain | URP/Lit, color (0.84, 0.81, 0.75) |
| `M_Water` | All zones (shared plane) | URP/Lit, blue transparent |
| `M_Rock` | All zones (rock formations) | URP/Lit, grey, roughness 0.8 |
| `M_PalmTrunk` | Island palms | URP/Lit, brown (0.45, 0.3, 0.15) |
| `M_PalmLeaf` | Island canopy | URP/Lit, green (0.2, 0.5, 0.15) |
| `M_Crystal` | Archive crystals | URP/Lit, transparent, emissive cyan |
| `M_Column` | Agora columns | URP/Lit, marble white, smoothness 0.7 |
| `M_Emissive_Cyan` | Sculpture (Archive) | URP/Lit, emissive (0.2, 0.4, 1.0) |
| `M_Emissive_Gold` | Wearable (Agora) | URP/Lit, emissive (1.0, 0.67, 0.2) |
| `M_Pedestal` | Sculpture + Wearable | URP/Lit, stone grey (0.17, 0.17, 0.23) |

**Critical fix for tonight**: `IslandBuilder.cs` currently creates `new Material()` at runtime per crystal, per palm, per column. This is a material leak on Quest. Pre-bake these 12 materials as `.mat` assets and assign via Inspector. But that's a build-time fix, not a code change from this doc.

---

## Summary: What Needs Writing

| File | Action | Priority |
|---|---|---|
| `Sculpture.cs` | New MonoBehaviour | Tonight — minimal version |
| `WearableDisplay.cs` | New MonoBehaviour | Tonight — minimal version |
| `OwnershipUI` | Skip | Not needed in VR |
| `zones.js` | Already ported | Done (`ZoneManager.cs`) |
| `scene.js` geometry | Already ported | Done (`IslandBuilder.cs`) |
| `teleport-transition.js` | Already ported | Done (`TeleportBeacon.cs`, no fade yet) |
| 12 shared materials | Create `.mat` assets | Tonight — Inspector only, no code |
