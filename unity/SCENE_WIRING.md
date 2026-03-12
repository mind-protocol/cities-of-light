# SCENE WIRING

---

## EDITOR GAMEOBJECTS (you create 3, keep 1)

```
Directional Light            ← already in scene, keep it
XR Origin (XR Rig)           ← right-click Hierarchy → XR → XR Origin (XR Rig)
Managers                     ← Create Empty, rename to "Managers"
Bootstrap                    ← Create Empty, rename to "Bootstrap"
```

Delete everything else (default Camera, etc).

---

## COMPONENTS TO ATTACH

### On "Managers" GameObject:

| # | Add Component | Script |
|---|---------------|--------|
| 1 | ZoneManager | `ZoneManager.cs` |
| 2 | FoveationSetup | `FoveationSetup.cs` |
| 3 | XRHandSetup | `XRHandSetup.cs` |

### On "Bootstrap" GameObject:

| # | Add Component | Script |
|---|---------------|--------|
| 4 | BootstrapScene | `BootstrapScene.cs` |

---

## INSPECTOR DRAGS (2 mandatory, rest is auto)

### ZoneManager (on Managers):

| Field | Drag This | Required |
|-------|-----------|----------|
| **Xr Origin** | `XR Origin (XR Rig)` from Hierarchy | **YES** |
| **Directional Light** | `Directional Light` from Hierarchy | **YES** |
| Zone Label | leave empty | no |
| Lerp Speed | 2 (default) | no |
| Zones | pre-filled (3 zones in code) | no |

### BootstrapScene (on Bootstrap):

| Field | Drag This | Required |
|-------|-----------|----------|
| Zone Manager | leave empty | no — auto-finds via `FindObjectOfType` |
| Xr Origin | leave empty | no — auto-finds via `GameObject.Find("XR Origin (XR Rig)")` |

### FoveationSetup (on Managers):

No public fields. Just attach.

### XRHandSetup (on Managers):

| Field | Drag This | Required |
|-------|-----------|----------|
| Left Hand Visual | leave empty | no |
| Right Hand Visual | leave empty | no |
| Left Controller Visual | leave empty | no |
| Right Controller Visual | leave empty | no |

---

## CRITICAL NAME

The XR Origin GameObject **must** be named exactly:

```
XR Origin (XR Rig)
```

This is the default name Unity creates. Do not rename it. `BootstrapScene.cs` line 21 does `GameObject.Find("XR Origin (XR Rig)")`.

---

## WHAT GETS BUILT AT RUNTIME (do NOT create these)

`BootstrapScene.Awake()` creates everything below automatically:

```
Ocean                   Plane 300x300 at y=-0.5, blue material, OceanSimple bobbing

Zone_Island             position (0, 0, 0)      — sand terrain, 8 palm trees
Zone_Archive            position (-30, 0, -25)   — dark terrain, 10 glowing crystals
Zone_Agora              position (-20, 0, 40)    — marble terrain, 8 stone columns

Beacon_archive          on Island shore facing Archive    — blue glow pillar, label "The Archive"
Beacon_agora            on Island shore facing Agora      — gold glow pillar, label "The Agora"
Beacon_island           on Archive shore facing Island    — amber glow pillar, label "The Island"
Beacon_island           on Agora shore facing Island      — amber glow pillar, label "The Island"
```

Each beacon has a `TeleportBeacon` component. Walk within 2.5m → teleport.

Each island has an `IslandBuilder` component. Terrain mesh + vegetation generated procedurally from seed.

---

## LIGHTING SETTINGS

Window → Rendering → Lighting → Environment tab:

```
Skybox Material:              Default-Skybox
Environment Lighting Source:  Color
Ambient Color:                #1a2a3a
Intensity:                    1.0
```

---

## DIRECTIONAL LIGHT SETTINGS

Select `Directional Light` in Hierarchy:

```
Rotation:       (50, -30, 0)
Color:          #FFCC88 (warm amber — ZoneManager overrides at runtime)
Intensity:      1.2
Shadow Type:    Soft Shadows
```

---

## FINAL HIERARCHY (what you should see)

```
MainScene
├── Directional Light
├── XR Origin (XR Rig)
│   └── Camera Offset
│       ├── Main Camera
│       ├── LeftHand Controller
│       └── RightHand Controller
├── Managers              [ZoneManager + FoveationSetup + XRHandSetup]
└── Bootstrap             [BootstrapScene]
```

4 root objects. 2 Inspector drags. Save. Build.
