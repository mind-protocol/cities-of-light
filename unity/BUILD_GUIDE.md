# Cities of Light — Quest 3 First Entry

> Definition of done: Nicolas puts on Quest 3, spawns on The Island,
> sees his hands, and can teleport to The Archive and The Agora.

---

## 1. Packages

Unity **2022.3.58f1 LTS** (latest 2022.3 patch). Create with **3D (URP)** template.

Unity Hub → Installs → 2022.3 → Add Modules:
```
☑ Android Build Support
  ☑ Android SDK & NDK Tools
  ☑ OpenJDK
```

**Package Manager → Add by name** (in this order):

```
com.unity.xr.management                4.4.0
com.unity.xr.openxr                    1.12.1
com.unity.xr.hands                     1.5.0
com.unity.xr.interaction.toolkit       2.6.3
com.unity.textmeshpro                  3.0.9   (usually pre-installed)
```

After install: **XR Interaction Toolkit** will ask to import **Starter Assets** and
**Hands Interaction Demo**. Import **both** — they contain the XR Origin prefab and
hand visualizer prefabs you need.

**Meta scoped registry** — add to `Packages/manifest.json` before `"dependencies"`:

```json
"scopedRegistries": [
  {
    "name": "Meta XR SDK",
    "url": "https://npm.developer.oculus.com",
    "scopes": ["com.meta.xr"]
  }
]
```

Then add by name:
```
com.meta.xr.sdk.core                   71.0.0
```

**Do NOT install:** Oculus XR Plugin, Photon, Netcode, any networking.

---

## 2. Project Settings

Apply every setting below. If a field isn't mentioned, leave default.

### XR Plug-in Management → Android tab

```
☑ OpenXR

OpenXR → Enabled Interaction Profiles:
  + Meta Quest Touch Pro Controller Profile
  + Hand Interaction Profile

OpenXR → OpenXR Feature Groups:
  ☑ Meta Quest Feature
      → Target Devices: Quest 3
      → Foveation Level: High
      → Use Dynamic Foveation: ☑

OpenXR → All Features:
  ☑ Hand Tracking Subsystem
  ☑ Meta Hand Tracking Aim
  ☑ Hand Common Poses and Interactions
```

### Player → Android

```
Company Name:         MindProtocol
Product Name:         Cities of Light
Package Name:         ai.mindprotocol.citiesoflight
Version:              0.1.0

Other Settings:
  Color Space:              Linear
  Auto Graphics API:        ☐ OFF
  Graphics APIs:            Vulkan  (delete OpenGLES3 row)
  Multithreaded Rendering:  ☑
  Scripting Backend:        IL2CPP
  Api Compatibility:        .NET Standard 2.1
  Target Architectures:     ☑ ARM64 only
  Minimum API Level:        Android 10.0 (API 29)
  Active Input Handling:    Both
```

### Quality

Delete all levels except one. Rename it **Quest**.

```
Render Pipeline Asset:    (assign your QuestURP asset — created in next step)
VSync Count:              Don't Sync
Anisotropic Textures:     Per Texture
```

### URP Pipeline Asset

Right-click Project → Create → Rendering → URP Asset (with Universal Renderer).
Name: **QuestURP** (the renderer auto-creates as **QuestURP_Renderer**).

**QuestURP:**
```
Rendering:   SRP Batcher ☑
Quality:     HDR ☐   MSAA: 4x   Render Scale: 1.0
Lighting:    Main Light: Per Pixel   Additional Lights: Per Vertex   Max: 2
Shadows:     Max Distance: 30   Cascades: 1   Resolution: 1024   Soft Shadows: ☐
Post-proc:   ☐
```

**QuestURP_Renderer:**
```
Rendering Path:       Forward
Native Render Pass:   ☑
Renderer Features:    (none)
```

Assign **QuestURP** in:
- Quality Settings → Quest level → Render Pipeline Asset
- Graphics Settings → Scriptable Render Pipeline Settings

---

## 3. Scene Hierarchy

Create scene: `Assets/Scenes/World.unity`. Delete the default camera and light.

### Step A: XR Rig

From Project window: `Samples/XR Interaction Toolkit/2.6.3/Starter Assets/Prefabs/`
→ Drag **XR Interaction Setup** into scene. This prefab contains:

```
XR Interaction Setup
├── XR Origin (XR Rig)
│   ├── Camera Offset
│   │   ├── Main Camera
│   │   ├── Left Controller (Stabilized)
│   │   └── Right Controller (Stabilized)
│   ├── Locomotion System
│   │   ├── Teleportation Provider
│   │   ├── Snap Turn Provider
│   │   └── Continuous Move Provider
│   └── Input Action Manager
├── XR Interaction Manager
└── EventSystem
```

If the XRI samples don't include hand visuals, add them:
1. On **Left Controller**: Add Component → **XR Hand Tracking Events**
2. On **Right Controller**: same
3. Create child GameObjects **LeftHandVisual** / **RightHandVisual**
4. Add Component → **XR Hand Mesh Controller** to each
5. Or use `Samples/XR Hands/1.5.0/HandVisualizer/` prefabs if available

### Step B: Systems

Create empty **[Systems]** GameObject. Add children:

| GameObject | Components | Notes |
|-----------|-----------|-------|
| ZoneManager | `ZoneManager.cs` | Wire refs in inspector |
| WorldBuilder | `WorldBuilder.cs` | Generates islands at runtime |
| FoveatedRendering | `FoveationSetup.cs` | One-shot setup |
| HandControllerSwitch | `HandControllerSwitch.cs` | Auto-toggle |

### Step C: Environment (generated at runtime)

**WorldBuilder.cs** generates all geometry on `Awake()`. No manual GameObjects needed for islands, water, beacons, or decorations. Just:

1. Create empty **Directional Light** — rotation (50, -30, 0), color #FFCC88, intensity 1.5, shadows on
2. Set **Lighting Settings** (Window → Rendering → Lighting):
   - Skybox Material: None (or create a gradient — see Mat_Sky below)
   - Environment Lighting Source: Color — #4A6080
   - Fog: ☑ Exponential — Color #8FAAC0 — Density 0.008
3. Camera background: Solid Color #2A3A5A

Everything else spawns from `WorldBuilder.cs`.

### Final hierarchy after runtime:

```
World.unity
├── XR Interaction Setup        (from XRI Starter Assets prefab)
├── Directional Light
├── [Systems]
│   ├── ZoneManager
│   ├── WorldBuilder             → spawns at Awake():
│   │   ├── Ocean
│   │   ├── Island_island        (0, 0, 0)
│   │   │   ├── Ground
│   │   │   ├── Water
│   │   │   ├── Palm_0..4
│   │   │   ├── Rock_0..3
│   │   │   ├── Beacon_archive
│   │   │   └── Beacon_agora
│   │   ├── Island_archive       (-30, 0, -25)
│   │   │   ├── Ground
│   │   │   ├── Water
│   │   │   ├── Crystal_0..6
│   │   │   └── Beacon_island
│   │   └── Island_agora         (-20, 0, 40)
│   │       ├── Ground
│   │       ├── Water
│   │       ├── Column_0..9
│   │       └── Beacon_island
│   ├── FoveatedRendering
│   └── HandControllerSwitch
└── ZoneLabel (World Canvas)
```

---

## 4. Scripts

Four scripts. Drop all in `Assets/Scripts/`.

### WorldBuilder.cs

```csharp
using UnityEngine;
using TMPro;

public class WorldBuilder : MonoBehaviour
{
    public ZoneManager zoneManager;
    public Transform xrOrigin;
    public Light directionalLight;
    public TMP_Text zoneLabel;

    void Awake()
    {
        BuildWorld();
    }

    void BuildWorld()
    {
        // ── Zone data (matches zones.js) ────────────────────
        var zones = new[] {
            new ZoneDef("island",  "The Island",  new Vector3(0, 0, 0),
                new Color(0.56f,0.67f,0.75f), 0.008f, new Color(1f,0.8f,0.53f)),
            new ZoneDef("archive", "The Archive", new Vector3(-30, 0, -25),
                new Color(0.1f,0.17f,0.29f), 0.015f, new Color(0.27f,0.53f,1f)),
            new ZoneDef("agora",   "The Agora",   new Vector3(-20, 0, 40),
                new Color(0.5f,0.47f,0.4f), 0.006f, new Color(1f,0.8f,0.4f)),
        };

        // ── Materials ───────────────────────────────────────
        var matSand    = MakeMat(new Color(0.83f,0.72f,0.59f), 0.2f);
        var matDark    = MakeMat(new Color(0.1f,0.16f,0.29f), 0.4f, new Color(0.07f,0.13f,0.27f), 0.3f);
        var matMarble  = MakeMat(new Color(0.91f,0.88f,0.82f), 0.6f);
        var matWater   = MakeTransparent(new Color(0.13f,0.38f,0.63f,0.4f), 0.9f);
        var matOcean   = MakeTransparent(new Color(0.08f,0.15f,0.3f,0.6f), 0.85f);
        var matCrystal = MakeTransparent(new Color(0.27f,0.53f,1f,0.7f), 0.7f, new Color(0.27f,0.53f,1f), 1.5f);
        var matBeacon  = MakeMat(new Color(1f,0.8f,0.27f), 0.3f, new Color(1f,0.8f,0.27f), 2f);
        var matPalm    = MakeMat(new Color(0.35f,0.25f,0.15f), 0.3f);
        var matLeaf    = MakeMat(new Color(0.2f,0.5f,0.15f), 0.4f);
        var matColumn  = MakeMat(new Color(0.85f,0.82f,0.75f), 0.5f);

        // ── Ocean ───────────────────────────────────────────
        var ocean = MakePlane("Ocean", transform, Vector3.down * 0.5f, 300f, matOcean);

        // ── Build each island ───────────────────────────────
        var zoneEntries = new ZoneManager.Zone[zones.Length];

        for (int i = 0; i < zones.Length; i++)
        {
            var z = zones[i];
            var island = new GameObject($"Island_{z.id}");
            island.transform.SetParent(transform);
            island.transform.position = z.center;

            // Ground
            Material groundMat = z.id == "island" ? matSand
                               : z.id == "archive" ? matDark
                               : matMarble;
            MakePlane("Ground", island.transform, Vector3.zero, 40f, groundMat);

            // Local water ring
            MakePlane("Water", island.transform, Vector3.down * 0.1f, 60f, matWater);

            // Spawn point
            var spawn = new GameObject("SpawnPoint");
            spawn.transform.SetParent(island.transform);
            spawn.transform.localPosition = new Vector3(0, 1f, 0);

            // ── Decorations ─────────────────────────────────
            if (z.id == "island")
            {
                // Palm trees
                for (int p = 0; p < 5; p++)
                {
                    float angle = p * 72f * Mathf.Deg2Rad;
                    float r = 8f + Random.Range(0f, 4f);
                    Vector3 pos = new Vector3(Mathf.Cos(angle) * r, 0, Mathf.Sin(angle) * r);
                    BuildPalm($"Palm_{p}", island.transform, pos, matPalm, matLeaf);
                }
                // Rocks
                for (int r = 0; r < 4; r++)
                {
                    float angle = (r * 90f + 45f) * Mathf.Deg2Rad;
                    float dist = 6f + Random.Range(0f, 3f);
                    Vector3 pos = new Vector3(Mathf.Cos(angle) * dist, 0.3f, Mathf.Sin(angle) * dist);
                    var rock = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    rock.name = $"Rock_{r}";
                    rock.transform.SetParent(island.transform);
                    rock.transform.localPosition = pos;
                    rock.transform.localScale = new Vector3(
                        Random.Range(0.5f, 1.5f), Random.Range(0.3f, 0.8f), Random.Range(0.5f, 1.5f));
                    rock.transform.localRotation = Quaternion.Euler(
                        Random.Range(-15f, 15f), Random.Range(0f, 360f), Random.Range(-15f, 15f));
                    rock.GetComponent<Renderer>().material = matSand;
                }
                // Beacons: to archive and agora
                BuildBeacon("Beacon_archive", island.transform,
                    new Vector3(-10, 0, -8), matBeacon, "The Archive →", 1, z.id);
                BuildBeacon("Beacon_agora", island.transform,
                    new Vector3(-7, 0, 12), matBeacon, "The Agora →", 2, z.id);
            }
            else if (z.id == "archive")
            {
                // Crystals
                for (int c = 0; c < 7; c++)
                {
                    float angle = c * (360f / 7f) * Mathf.Deg2Rad;
                    float dist = 5f + Random.Range(0f, 5f);
                    Vector3 pos = new Vector3(Mathf.Cos(angle) * dist, 0, Mathf.Sin(angle) * dist);
                    var crystal = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    crystal.name = $"Crystal_{c}";
                    crystal.transform.SetParent(island.transform);
                    crystal.transform.localPosition = pos + Vector3.up * Random.Range(0.5f, 2f);
                    crystal.transform.localScale = new Vector3(0.3f, Random.Range(1f, 3f), 0.3f);
                    crystal.transform.localRotation = Quaternion.Euler(
                        Random.Range(-20f, 20f), Random.Range(0f, 360f), Random.Range(-20f, 20f));
                    crystal.GetComponent<Renderer>().material = matCrystal;
                }
                // Beacon: to island
                BuildBeacon("Beacon_island", island.transform,
                    new Vector3(10, 0, 8), matBeacon, "The Island →", 0, z.id);
            }
            else if (z.id == "agora")
            {
                // Columns
                for (int c = 0; c < 10; c++)
                {
                    float angle = c * 36f * Mathf.Deg2Rad;
                    float dist = 7f + (c % 2 == 0 ? 0f : 3f);
                    Vector3 pos = new Vector3(Mathf.Cos(angle) * dist, 2f, Mathf.Sin(angle) * dist);
                    var col = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    col.name = $"Column_{c}";
                    col.transform.SetParent(island.transform);
                    col.transform.localPosition = pos;
                    col.transform.localScale = new Vector3(0.4f, 4f, 0.4f);
                    col.GetComponent<Renderer>().material = matColumn;
                }
                // Beacon: to island
                BuildBeacon("Beacon_island", island.transform,
                    new Vector3(7, 0, -12), matBeacon, "The Island →", 0, z.id);
            }

            // ── Zone entry ──────────────────────────────────
            zoneEntries[i] = new ZoneManager.Zone
            {
                id = z.id,
                displayName = z.displayName,
                center = z.center,
                spawnPoint = spawn.transform,
                islandRoot = island,
                fogColor = z.fogColor,
                fogDensity = z.fogDensity,
                lightColor = z.lightColor,
            };
        }

        // ── Wire ZoneManager ────────────────────────────────
        zoneManager.zones = zoneEntries;
        zoneManager.player = xrOrigin;
        zoneManager.directionalLight = directionalLight;
        zoneManager.zoneLabel = zoneLabel;
        zoneManager.Init();
    }

    // ── Helpers ─────────────────────────────────────────────

    struct ZoneDef
    {
        public string id, displayName;
        public Vector3 center;
        public Color fogColor;
        public float fogDensity;
        public Color lightColor;
        public ZoneDef(string id, string name, Vector3 c, Color fog, float fogD, Color light)
        { this.id=id; displayName=name; center=c; fogColor=fog; fogDensity=fogD; lightColor=light; }
    }

    GameObject MakePlane(string n, Transform parent, Vector3 pos, float size, Material mat)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Plane);
        go.name = n;
        go.transform.SetParent(parent);
        go.transform.localPosition = pos;
        go.transform.localScale = Vector3.one * (size / 10f); // Unity plane is 10×10
        go.GetComponent<Renderer>().material = mat;
        Destroy(go.GetComponent<Collider>()); // no collision on water/ocean
        if (n == "Ground")
        {
            // Re-add collider on ground for teleport/standing
            go.AddComponent<MeshCollider>();
        }
        return go;
    }

    void BuildPalm(string n, Transform parent, Vector3 pos, Material trunk, Material leaf)
    {
        var palm = new GameObject(n);
        palm.transform.SetParent(parent);
        palm.transform.localPosition = pos;

        // Trunk
        var t = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        t.transform.SetParent(palm.transform);
        t.transform.localPosition = new Vector3(0, 2.5f, 0);
        t.transform.localScale = new Vector3(0.2f, 2.5f, 0.2f);
        t.GetComponent<Renderer>().material = trunk;

        // Leaf canopy (flattened sphere)
        var l = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        l.transform.SetParent(palm.transform);
        l.transform.localPosition = new Vector3(0, 5.2f, 0);
        l.transform.localScale = new Vector3(2.5f, 0.8f, 2.5f);
        l.GetComponent<Renderer>().material = leaf;
    }

    void BuildBeacon(string name, Transform parent, Vector3 localPos, Material mat,
                     string label, int targetZoneIndex, string fromZone)
    {
        var beacon = new GameObject(name);
        beacon.transform.SetParent(parent);
        beacon.transform.localPosition = localPos;

        // Pillar
        var pillar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        pillar.transform.SetParent(beacon.transform);
        pillar.transform.localPosition = new Vector3(0, 1.5f, 0);
        pillar.transform.localScale = new Vector3(0.3f, 1.5f, 0.3f);
        pillar.GetComponent<Renderer>().material = mat;

        // Glow ring
        var ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        ring.transform.SetParent(beacon.transform);
        ring.transform.localPosition = new Vector3(0, 0.05f, 0);
        ring.transform.localScale = new Vector3(2f, 0.05f, 2f);
        ring.GetComponent<Renderer>().material = mat;

        // Point light
        var lightGO = new GameObject("Light");
        lightGO.transform.SetParent(beacon.transform);
        lightGO.transform.localPosition = new Vector3(0, 3.2f, 0);
        var light = lightGO.AddComponent<Light>();
        light.type = LightType.Point;
        light.color = mat.color;
        light.intensity = 2f;
        light.range = 8f;

        // Trigger collider (sphere, for proximity detection)
        var trigger = beacon.AddComponent<SphereCollider>();
        trigger.isTrigger = true;
        trigger.radius = 2.5f;
        trigger.center = new Vector3(0, 1f, 0);

        // Waypoint script
        var wp = beacon.AddComponent<WaypointTrigger>();
        wp.zoneManager = zoneManager;
        wp.targetZoneIndex = targetZoneIndex;

        // Label (TextMesh — simpler than TMP for runtime creation)
        var labelGO = new GameObject("Label");
        labelGO.transform.SetParent(beacon.transform);
        labelGO.transform.localPosition = new Vector3(0, 3.5f, 0);
        var tm = labelGO.AddComponent<TextMesh>();
        tm.text = label;
        tm.characterSize = 0.15f;
        tm.anchor = TextAnchor.MiddleCenter;
        tm.alignment = TextAlignment.Center;
        tm.color = mat.color;
        tm.fontSize = 48;
        // Billboard behavior handled by BeaconLabel
        labelGO.AddComponent<BeaconLabel>();
    }

    Material MakeMat(Color color, float smooth, Color emission = default, float emissionIntensity = 0f)
    {
        var mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        mat.color = color;
        mat.SetFloat("_Smoothness", smooth);
        if (emissionIntensity > 0f)
        {
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", emission * emissionIntensity);
            mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
        }
        return mat;
    }

    Material MakeTransparent(Color color, float smooth, Color emission = default, float emissionIntensity = 0f)
    {
        var mat = MakeMat(color, smooth, emission, emissionIntensity);
        mat.SetFloat("_Surface", 1); // Transparent
        mat.SetFloat("_Blend", 0);   // Alpha
        mat.SetFloat("_AlphaClip", 0);
        mat.SetFloat("_SrcBlend", 5); // SrcAlpha
        mat.SetFloat("_DstBlend", 10); // OneMinusSrcAlpha
        mat.SetFloat("_ZWrite", 0);
        mat.renderQueue = 3000;
        mat.SetOverrideTag("RenderType", "Transparent");
        return mat;
    }
}
```

### ZoneManager.cs

```csharp
using UnityEngine;
using TMPro;

public class ZoneManager : MonoBehaviour
{
    [System.Serializable]
    public struct Zone
    {
        public string id;
        public string displayName;
        public Vector3 center;
        public Transform spawnPoint;
        public GameObject islandRoot;
        public Color fogColor;
        public float fogDensity;
        public Color lightColor;
    }

    [HideInInspector] public Zone[] zones;
    [HideInInspector] public Transform player;
    [HideInInspector] public Light directionalLight;
    [HideInInspector] public TMP_Text zoneLabel;

    private int _currentZone = -1;
    private Color _targetFogColor;
    private float _targetFogDensity;
    private Color _targetLightColor;

    // Called by WorldBuilder after zones are set
    public void Init()
    {
        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.Exponential;
        TeleportToZone(0);
    }

    void Update()
    {
        if (zones == null || zones.Length == 0 || player == null) return;

        // Detect current zone by XZ distance
        float minDist = float.MaxValue;
        int closest = 0;
        Vector3 pp = player.position;

        for (int i = 0; i < zones.Length; i++)
        {
            float dx = pp.x - zones[i].center.x;
            float dz = pp.z - zones[i].center.z;
            float dist = dx * dx + dz * dz; // sqr is fine for comparison
            if (dist < minDist) { minDist = dist; closest = i; }
        }

        if (closest != _currentZone)
        {
            _currentZone = closest;
            _targetFogColor = zones[closest].fogColor;
            _targetFogDensity = zones[closest].fogDensity;
            _targetLightColor = zones[closest].lightColor;
            if (zoneLabel) zoneLabel.text = zones[closest].displayName;
            Debug.Log($"Zone: {zones[closest].displayName}");
        }

        // Smooth lerp
        float t = 2f * Time.deltaTime;
        RenderSettings.fogColor = Color.Lerp(RenderSettings.fogColor, _targetFogColor, t);
        RenderSettings.fogDensity = Mathf.Lerp(RenderSettings.fogDensity, _targetFogDensity, t);
        if (directionalLight)
            directionalLight.color = Color.Lerp(directionalLight.color, _targetLightColor, t);
    }

    public void TeleportToZone(int index)
    {
        if (zones == null || index < 0 || index >= zones.Length) return;
        if (player) player.position = zones[index].spawnPoint.position;
        _currentZone = index;

        RenderSettings.fogColor = zones[index].fogColor;
        RenderSettings.fogDensity = zones[index].fogDensity;
        if (directionalLight) directionalLight.color = zones[index].lightColor;
        if (zoneLabel) zoneLabel.text = zones[index].displayName;
    }
}
```

### WaypointTrigger.cs

```csharp
using UnityEngine;

public class WaypointTrigger : MonoBehaviour
{
    [HideInInspector] public ZoneManager zoneManager;
    [HideInInspector] public int targetZoneIndex;

    private float _holdTime;
    private bool _inRange;
    private Renderer _ringRenderer;

    void Start()
    {
        // Find the ring (the flat cylinder) for pulse animation
        foreach (Transform child in transform)
        {
            if (child.localScale.y < 0.1f) // the flat one
            {
                _ringRenderer = child.GetComponent<Renderer>();
                break;
            }
        }
    }

    void Update()
    {
        // Pulse the ring
        if (_ringRenderer)
        {
            float pulse = 0.5f + 0.5f * Mathf.Sin(Time.time * 2f);
            Color c = _ringRenderer.material.color;
            c.a = 0.3f + pulse * 0.5f;
            _ringRenderer.material.color = c;
        }

        if (!_inRange) return;

        _holdTime += Time.deltaTime;

        // Visual feedback: ring brightens as hold progresses
        if (_ringRenderer)
        {
            float progress = Mathf.Clamp01(_holdTime / 2f);
            _ringRenderer.material.SetColor("_EmissionColor",
                _ringRenderer.material.color * (1f + progress * 4f));
        }

        if (_holdTime >= 2f)
        {
            zoneManager.TeleportToZone(targetZoneIndex);
            _holdTime = 0f;
            _inRange = false;
        }
    }

    void OnTriggerEnter(Collider other)
    {
        // XR Origin's CharacterController or any collider on the rig
        _inRange = true;
        _holdTime = 0f;
    }

    void OnTriggerExit(Collider other)
    {
        _inRange = false;
        _holdTime = 0f;
    }
}
```

### FoveationSetup.cs

```csharp
using UnityEngine;
using UnityEngine.XR;
using System.Collections;

public class FoveationSetup : MonoBehaviour
{
    IEnumerator Start()
    {
        // Wait a frame for XR to initialize
        yield return null;
        yield return null;

        var displays = new System.Collections.Generic.List<XRDisplaySubsystem>();
        SubsystemManager.GetSubsystems(displays);
        if (displays.Count > 0)
        {
            displays[0].foveatedRenderingLevel = 3;
            displays[0].foveatedRenderingFlags =
                XRDisplaySubsystem.FoveatedRenderingFlags.GazeBased;
            Debug.Log("[CoL] Foveated rendering: HIGH + gaze-based");
        }
        else
        {
            Debug.LogWarning("[CoL] No XR display found for foveation");
        }

        // Set refresh rate to 90Hz if available
        Unity.XR.Oculus.Performance.TrySetDisplayRefreshRate(90f);
    }
}
```

### HandControllerSwitch.cs

```csharp
using UnityEngine;
using UnityEngine.XR.Hands;

public class HandControllerSwitch : MonoBehaviour
{
    public GameObject leftHandVisual;
    public GameObject rightHandVisual;
    public GameObject leftControllerVisual;
    public GameObject rightControllerVisual;

    private XRHandSubsystem _sub;

    void Update()
    {
        if (_sub == null)
        {
            var list = new System.Collections.Generic.List<XRHandSubsystem>();
            SubsystemManager.GetSubsystems(list);
            if (list.Count > 0) _sub = list[0];
            else return;
        }

        bool lh = _sub.leftHand.isTracked;
        bool rh = _sub.rightHand.isTracked;

        if (leftHandVisual) leftHandVisual.SetActive(lh);
        if (leftControllerVisual) leftControllerVisual.SetActive(!lh);
        if (rightHandVisual) rightHandVisual.SetActive(rh);
        if (rightControllerVisual) rightControllerVisual.SetActive(!rh);
    }
}
```

### BeaconLabel.cs

```csharp
using UnityEngine;

public class BeaconLabel : MonoBehaviour
{
    void Update()
    {
        // Billboard: always face camera
        if (Camera.main)
            transform.rotation = Quaternion.LookRotation(
                transform.position - Camera.main.transform.position);
    }
}
```

---

## 5. Build Settings

```
File → Build Settings:
  Platform:             Android  (click Switch Platform if not already)
  Texture Compression:  ASTC
  ETC2 Fallback:        32-bit
  Compression Method:   LZ4HC
  Scenes In Build:
    ☑ Assets/Scenes/World.unity   [0]
```

Build: **File → Build And Run** (with Quest connected via USB) — or Build → manual adb.

---

## 6. ADB Install / Launch

```bash
# ── Prereqs ──────────────────────────────────────────
# Quest 3: Developer Mode ON (Meta phone app → Settings → Developer)
# USB-C cable connected
# Accept "Allow USB debugging" prompt inside headset

# Verify connection
adb devices
# Expected: 2GXXXXXXXXXX    device

# ── Install ──────────────────────────────────────────
adb install -r CitiesOfLight.apk
# Expected: Success

# ── Launch ───────────────────────────────────────────
adb shell am start -n ai.mindprotocol.citiesoflight/com.unity3d.player.UnityPlayerActivity

# ── Watch logs ───────────────────────────────────────
adb logcat -s Unity:V | grep -E "\[CoL\]|Error|Exception"

# ── One-liner: reinstall + launch + logs ─────────────
adb install -r CitiesOfLight.apk && adb shell am start -n ai.mindprotocol.citiesoflight/com.unity3d.player.UnityPlayerActivity && adb logcat -s Unity:V

# ── Wireless (optional) ─────────────────────────────
adb tcpip 5555 && adb connect <QUEST_IP>:5555

# ── Kill app ─────────────────────────────────────────
adb shell am force-stop ai.mindprotocol.citiesoflight

# ── Uninstall ────────────────────────────────────────
adb uninstall ai.mindprotocol.citiesoflight

# ── Find app on Quest ────────────────────────────────
# App Library → Unknown Sources → Cities of Light
```

---

## 7. Failure Checklist

If the build doesn't run, work through this list top to bottom.

### F1: Build fails — Gradle error

```
Symptom:  "Gradle build failed" in Unity console
Fix:
  1. Edit → Preferences → External Tools → verify Android SDK/NDK paths populated
  2. Player Settings → Min API Level must be 29+ (not 23)
  3. If "namespace UnityEngine.XR.Hands not found":
     → Package Manager → verify com.unity.xr.hands is installed
  4. If IL2CPP errors: verify ARM64 only, no ARMv7
  5. Delete Library/ and Temp/ folders, rebuild
```

### F2: APK installs but app immediately crashes

```
Symptom:  Black screen for 1s then back to Quest home
Fix:
  1. adb logcat -s Unity:V | grep -i error
  2. Most common: missing Render Pipeline Asset
     → Quality Settings → verify QuestURP asset is assigned
     → Graphics Settings → verify QuestURP asset is assigned
  3. If "NullReferenceException" in WorldBuilder:
     → Verify WorldBuilder has ZoneManager, XR Origin, Light refs wired
  4. If "Shader not found: Universal Render Pipeline/Lit":
     → Edit → Project Settings → Graphics → Always Include Shaders
     → Add "Universal Render Pipeline/Lit"
     → OR: Edit → Project Settings → Graphics → Shader Stripping
        → Strip Unused → ☐ OFF (brute force, adds 10MB but guarantees shaders)
```

### F3: App launches but shows black or grey void

```
Symptom:  Headset shows empty room / passthrough / grey
Fix:
  1. No OpenXR plugin for Android:
     → Project Settings → XR Plug-in Management → Android tab → ☑ OpenXR
  2. Missing Meta Quest Feature:
     → OpenXR → Features → ☑ Meta Quest Feature → Target: Quest 3
  3. Camera not tracking:
     → Main Camera must have TrackedPoseDriver component
     → (XRI Starter Assets prefab has this — if you built manually, add it)
  4. Scene has no geometry near origin:
     → Verify WorldBuilder.cs is attached AND has refs wired
     → Check Console for Awake() errors
```

### F4: Hands not visible

```
Symptom:  App runs, islands visible, but no hand meshes
Fix:
  1. OpenXR → Features → verify ALL of:
     ☑ Hand Tracking Subsystem
     ☑ Meta Hand Tracking Aim
     ☑ Hand Common Poses and Interactions
  2. Quest 3 Settings → Movement Tracking → Hand Tracking → ON
  3. If using XRI prefab: verify Left/Right Controller objects have
     XR Hand Tracking Events component
  4. If hands show in editor but not on Quest:
     → Manifest issue. Add AndroidManifest.xml:
        <uses-permission android:name="com.oculus.permission.HAND_TRACKING"/>
        <meta-data android:name="com.oculus.handtracking.frequency" android:value="HIGH"/>
  5. If nothing works: put controllers down for 3 seconds.
     Quest auto-switches when it stops detecting controllers in your hands.
```

### F5: Hands visible but controllers don't work as fallback

```
Symptom:  Hands work but picking up controllers does nothing
Fix:
  1. HandControllerSwitch.cs references not wired
     → Assign leftHandVisual, rightHandVisual, leftControllerVisual,
        rightControllerVisual in inspector
  2. If references are wired: check adb logcat for XRHandSubsystem errors
  3. Nuclear option: remove HandControllerSwitch, leave both always active.
     Controllers still work through XR Interaction Toolkit action maps.
```

### F6: Teleport beacons don't work

```
Symptom:  Stand near beacon but nothing happens after 2s
Fix:
  1. No collider on player:
     → XR Origin needs a CharacterController or CapsuleCollider (trigger volume)
     → XRI Starter Assets prefab includes this. If manual: add CharacterController
        to XR Origin root. Height: 1.8, Radius: 0.3, Center: (0, 0.9, 0)
  2. Beacon SphereCollider.isTrigger not checked:
     → WorldBuilder sets this, but verify in inspector at runtime
  3. Collider layers: ensure XR Origin and beacons are on layers that interact
     → Simplest: both on Default layer
  4. OnTriggerEnter never fires:
     → One of the two objects MUST have a Rigidbody.
     → Add Rigidbody to XR Origin: isKinematic ☑, useGravity ☐
```

### F7: Vulkan crashes on startup

```
Symptom:  Instant crash, logcat shows "Vulkan" errors
Fix:
  1. Player → Other Settings → Graphics APIs → add OpenGLES3 as fallback
     → Keep Vulkan first, GLES3 second. Unity will try Vulkan, fall back.
  2. If still crashes: remove Vulkan, use OpenGLES3 only.
     → You lose Native Render Pass optimization but it will run.
  3. After fixing: re-enable Vulkan once everything else is stable.
```

### F8: Pink/magenta materials everywhere

```
Symptom:  All geometry is bright pink
Fix:
  → Shader missing. This means URP shaders aren't included in build.
  1. Graphics Settings → Always Include Shaders → add:
     "Universal Render Pipeline/Lit"
     "Universal Render Pipeline/Unlit"
  2. Or: create one material asset in Editor using URP/Lit,
     reference it from any script. Unity will then include the shader.
  3. Alternative: set Graphics → Shader Stripping → Strip Unused to ☐
```

### F9: adb says "no devices"

```
Symptom:  adb devices shows empty list
Fix:
  1. USB cable is charge-only → use a data cable
  2. Developer Mode not enabled → Meta phone app → Devices → Developer Mode ON
  3. USB debugging not accepted → put on headset, look for popup, click Allow
  4. Windows driver missing:
     → Device Manager → look for "Quest" under USB
     → If yellow triangle: download Meta Quest ADB drivers
        https://developer.oculus.com/downloads/package/oculus-adb-drivers/
  5. Try: adb kill-server && adb start-server && adb devices
```

### F10: "INSTALL_FAILED_UPDATE_INCOMPATIBLE"

```
Symptom:  adb install says incompatible
Fix:
  adb uninstall ai.mindprotocol.citiesoflight
  adb install CitiesOfLight.apk
  (Package was signed with different key from previous build)
```

---

## Inspector Wiring Summary

After placing scripts, wire these references in the Inspector:

| Script | Field | Drag from |
|--------|-------|-----------|
| WorldBuilder | zoneManager | [Systems] → ZoneManager |
| WorldBuilder | xrOrigin | XR Interaction Setup → XR Origin |
| WorldBuilder | directionalLight | Directional Light |
| WorldBuilder | zoneLabel | ZoneLabel TMP_Text (or leave null — text appears on beacons) |
| HandControllerSwitch | leftHandVisual | Camera Offset → Left Hand → LeftHandVisual |
| HandControllerSwitch | rightHandVisual | Camera Offset → Right Hand → RightHandVisual |
| HandControllerSwitch | leftControllerVisual | Camera Offset → Left Controller |
| HandControllerSwitch | rightControllerVisual | Camera Offset → Right Controller |

**Critical:** Add a **Rigidbody** to the XR Origin root (isKinematic ☑, useGravity ☐) — required for beacon trigger detection.

---

## Time Estimate

```
Unity install (if needed):           20 min
Create project + packages:            8 min
Project settings:                     5 min
Scene setup (prefab + scripts):      10 min
Wire inspector refs:                  3 min
First build:                          5 min
adb install + test:                   2 min
Fix first issue from §7:              5 min
                                    ─────
Total:                            ~60 min
```
