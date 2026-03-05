# Cities of Light — Quest 3 Native Build Guide

> Get an APK on the headset tonight. 3 zones, hand tracking, URP.

---

## 1. Package List

Unity **2022.3 LTS** (6000-series NOT stable enough for Quest yet — use 2022.3.x).

### Package Manager (Window → Package Manager → + Add by name)

```
com.unity.xr.openxr                    1.9.1
com.unity.xr.hands                     1.4.1
com.unity.xr.interaction.toolkit       2.5.4
com.unity.xr.management                4.4.0
com.unity.render-pipelines.universal   14.0.11
```

### Meta Packages (Add via .tgz or OpenUPM)

Download from https://developer.oculus.com/downloads/package/meta-xr-sdk-all-in-one/ :

```
com.meta.xr.sdk.core                   68.0.3
com.meta.xr.sdk.interaction            68.0.3
```

Or: from Meta's scoped registry, add to `Packages/manifest.json`:
```json
"scopedRegistries": [
  {
    "name": "Meta XR SDK",
    "url": "https://npm.developer.oculus.com",
    "scopes": ["com.meta.xr"]
  }
]
```

### Do NOT install
- Oculus XR Plugin (legacy, conflicts with OpenXR)
- XR Hands Meta Aim (it's a feature in OpenXR settings, not a package)
- Any Photon packages (not tonight)
- Any networking (not tonight)

---

## 2. Unity Project Settings

### 2a. XR Plug-in Management (Project Settings → XR Plug-in Management)

**Android tab:**
```
☑ OpenXR

OpenXR → Interaction Profiles:
  ☑ Meta Quest Touch Pro Controller Profile
  ☑ Hand Interaction Profile

OpenXR → Features:
  ☑ Meta Quest Feature
  ☑ Hand Tracking Subsystem
  ☑ Meta Hand Tracking Aim              ← this is what you asked for
  ☑ Hand Common Poses and Interactions
```

### 2b. Player Settings (Project Settings → Player → Android)

```
Company Name:         MindProtocol
Product Name:         Cities of Light
Package Name:         ai.mindprotocol.citiesoflight
Version:              0.1.0
Minimum API Level:    Android 10.0 (API 29)
Target API Level:     Automatic (highest)
Scripting Backend:    IL2CPP
Target Architectures: ☑ ARM64  ☐ ARMv7
Api Compatibility:    .NET Standard 2.1
Install Location:     Automatic
Active Input:         Both (old + new)
```

**Other Settings:**
```
Color Space:              Linear
Auto Graphics API:        ☐ (uncheck)
Graphics APIs:            Vulkan only (remove OpenGLES)
Multithreaded Rendering:  ☑
Static Batching:          ☑
Dynamic Batching:         ☐
GPU Skinning:             ☑
```

**Resolution and Presentation:**
```
Default Orientation:      Landscape Left
Optimized Frame Pacing:   ☑
```

### 2c. Quality Settings (Project Settings → Quality)

Delete all levels except one. Name it `Quest`:

```
Rendering:
  Render Pipeline Asset:  QuestURP (see §2d)
  VSync Count:            Don't Sync

Textures:
  Global Mipmap Limit:    Half Resolution
  Anisotropic Textures:   Per Texture

Shadows:
  Shadowmask Mode:        Distance Shadowmask
  Shadow Resolution:      Medium
  Shadow Distance:        30
  Shadow Cascades:        No Cascades
```

### 2d. URP Asset (Create → Rendering → URP Asset + Renderer)

Name: `QuestURP` / `QuestURPRenderer`

**QuestURP (Pipeline Asset):**
```
Rendering:
  SRP Batcher:            ☑
  Dynamic Batching:       ☐

Quality:
  HDR:                    ☐ (off — saves bandwidth on Quest)
  MSAA:                   4x
  Render Scale:           1.0

Lighting:
  Main Light:             Per Pixel
  Additional Lights:      Per Vertex
  Max Additional Lights:  2

Shadows:
  Max Distance:           30
  Cascade Count:          1
  Shadow Resolution:      1024
  Soft Shadows:           ☐

Post-processing:          ☐ (off tonight)
```

**QuestURPRenderer (Renderer Asset):**
```
Rendering Path:           Forward
Depth Priming:            Disabled
Accurate G-buffer:        ☐
Native Render Pass:       ☑ (Vulkan optimization)

Renderer Features:        (none tonight)
```

### 2e. Foveated Rendering (OXRSettings or via script)

In `OpenXR → Meta Quest Feature` settings:
```
Foveation Level:          High
Dynamic Foveation:        ☑
```

Or set at runtime (more reliable):
```csharp
// FoveationSetup.cs — attach to any GameObject in the boot scene
using UnityEngine;
using UnityEngine.XR;

public class FoveationSetup : MonoBehaviour
{
    void Start()
    {
        var displays = new System.Collections.Generic.List<XRDisplaySubsystem>();
        SubsystemManager.GetSubsystems(displays);
        if (displays.Count > 0)
        {
            displays[0].foveatedRenderingLevel = 3; // 0=none,1=low,2=med,3=high
            displays[0].foveatedRenderingFlags =
                XRDisplaySubsystem.FoveatedRenderingFlags.GazeBased;
            Debug.Log("Foveated rendering: HIGH + gaze-based");
        }
    }
}
```

### 2f. Android Manifest (Plugins/Android/AndroidManifest.xml)

Unity auto-generates this, but verify these are present. If missing, create `Assets/Plugins/Android/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="ai.mindprotocol.citiesoflight">

  <uses-feature android:name="android.hardware.vr.headtracking" android:required="true" />
  <uses-feature android:name="oculus.software.handtracking" android:required="false" />
  <uses-permission android:name="com.oculus.permission.HAND_TRACKING" />

  <application android:allowBackup="false">
    <meta-data android:name="com.oculus.handtracking.frequency" android:value="HIGH" />
    <meta-data android:name="com.oculus.handtracking.version" android:value="V2.0" />
    <meta-data android:name="com.oculus.supportedDevices" android:value="quest3" />
  </application>
</manifest>
```

---

## 3. Scene Hierarchy

One scene: `Assets/Scenes/World.unity`

```
World (Scene)
│
├── [XR] ─────────────────────────────────────────────
│   ├── XR Origin (XR Origin component)
│   │   ├── Camera Offset
│   │   │   ├── Main Camera          (Camera + TrackedPoseDriver)
│   │   │   ├── Left Hand            (XR Controller + XR Hand)
│   │   │   │   └── LeftHandVisual   (XR Hand Mesh Controller)
│   │   │   ├── Right Hand           (XR Controller + XR Hand)
│   │   │   │   └── RightHandVisual  (XR Hand Mesh Controller)
│   │   │   ├── Left Controller       (XR Controller, active when no hands)
│   │   │   │   └── ControllerModel  (Quest 3 controller mesh)
│   │   │   └── Right Controller      (XR Controller, active when no hands)
│   │   │       └── ControllerModel
│   │   └── Locomotion System        (Teleport + Continuous Move)
│   │       ├── Teleportation Provider
│   │       └── Continuous Move Provider
│   └── XR Interaction Manager
│
├── [ENVIRONMENT] ────────────────────────────────────
│   ├── Directional Light            (Warm, shadows on)
│   ├── Sky                          (Gradient skybox material)
│   │
│   ├── Island_TheIsland             (pos 0,0,0)
│   │   ├── Ground                   (Plane 40×40, sand material)
│   │   ├── Water                    (Plane 60×60, y=-0.1, blue transparent)
│   │   ├── Palms                    (3-5 cylinders + cones)
│   │   ├── Rocks                    (3-4 scaled cubes, rotated)
│   │   ├── SpawnPoint               (empty, y=1.0)
│   │   └── WaypointToArchive        (Cylinder beacon, glowing blue)
│   │       └── Label (TextMeshPro: "The Archive →")
│   │
│   ├── Island_TheArchive            (pos -30,0,-25)   ← matches zones.js
│   │   ├── Ground                   (Plane 40×40, dark blue-grey material)
│   │   ├── Water                    (Plane 60×60, y=-0.1, deep blue)
│   │   ├── Crystals                 (5-8 elongated cubes, emissive cyan)
│   │   ├── SpawnPoint               (empty, y=1.0)
│   │   └── WaypointToIsland         (Cylinder beacon, glowing gold)
│   │       └── Label (TextMeshPro: "The Island →")
│   │
│   ├── Island_TheAgora              (pos -20,0,40)    ← matches zones.js
│   │   ├── Ground                   (Plane 40×40, marble-white material)
│   │   ├── Water                    (Plane 60×60, y=-0.1)
│   │   ├── Columns                  (8-12 tall cylinders, marble material)
│   │   ├── SpawnPoint               (empty, y=1.0)
│   │   └── WaypointToIsland         (Cylinder beacon, glowing gold)
│   │       └── Label (TextMeshPro: "The Island →")
│   │
│   └── Ocean                        (Large plane y=-0.3, dark blue, beneath everything)
│
├── [SYSTEMS] ────────────────────────────────────────
│   ├── ZoneManager                  (ZoneManager.cs)
│   ├── FoveationSetup               (FoveationSetup.cs)
│   └── EventSystem                  (XR UI Input Module)
│
└── [UI] ─────────────────────────────────────────────
    └── ZoneLabel                    (World-space Canvas, TextMeshPro)
```

### Key Scripts

**ZoneManager.cs** — the only real script besides FoveationSetup:

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

    public Zone[] zones;
    public Transform player;       // XR Origin transform
    public Light directionalLight;
    public TMP_Text zoneLabel;

    // Waypoint teleport
    public float waypointActivateDistance = 3f;

    private int _currentZone = -1;
    private Color _targetFogColor;
    private float _targetFogDensity;
    private Color _targetLightColor;

    void Start()
    {
        // Start on The Island
        TeleportToZone(0);
    }

    void Update()
    {
        // Detect current zone by distance
        float minDist = float.MaxValue;
        int closest = 0;
        Vector3 playerPos = player.position;

        for (int i = 0; i < zones.Length; i++)
        {
            float dist = Vector3.Distance(
                new Vector3(playerPos.x, 0, playerPos.z),
                new Vector3(zones[i].center.x, 0, zones[i].center.z)
            );
            if (dist < minDist)
            {
                minDist = dist;
                closest = i;
            }
        }

        if (closest != _currentZone)
        {
            _currentZone = closest;
            _targetFogColor = zones[closest].fogColor;
            _targetFogDensity = zones[closest].fogDensity;
            _targetLightColor = zones[closest].lightColor;
            zoneLabel.text = zones[closest].displayName;
        }

        // Smooth ambient transition
        RenderSettings.fogColor = Color.Lerp(
            RenderSettings.fogColor, _targetFogColor, 2f * Time.deltaTime);
        RenderSettings.fogDensity = Mathf.Lerp(
            RenderSettings.fogDensity, _targetFogDensity, 2f * Time.deltaTime);
        directionalLight.color = Color.Lerp(
            directionalLight.color, _targetLightColor, 2f * Time.deltaTime);
    }

    public void TeleportToZone(int index)
    {
        if (index < 0 || index >= zones.Length) return;
        player.position = zones[index].spawnPoint.position;
        _currentZone = index;

        // Instant set (no lerp on first load)
        RenderSettings.fogColor = zones[index].fogColor;
        RenderSettings.fogDensity = zones[index].fogDensity;
        directionalLight.color = zones[index].lightColor;
        zoneLabel.text = zones[index].displayName;
    }
}
```

**WaypointTrigger.cs** — attach to each waypoint beacon:

```csharp
using UnityEngine;

public class WaypointTrigger : MonoBehaviour
{
    public ZoneManager zoneManager;
    public int targetZoneIndex;

    private float _holdTime;
    private bool _inRange;

    void Update()
    {
        if (!_inRange) return;

        // Check if either hand/controller is gripping
        // For tonight: just use proximity + time (stand near for 2s)
        _holdTime += Time.deltaTime;
        if (_holdTime >= 2f)
        {
            zoneManager.TeleportToZone(targetZoneIndex);
            _holdTime = 0f;
        }
    }

    void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("Player"))
        {
            _inRange = true;
            _holdTime = 0f;
        }
    }

    void OnTriggerExit(Collider other)
    {
        if (other.CompareTag("Player"))
        {
            _inRange = false;
            _holdTime = 0f;
        }
    }
}
```

**HandControllerSwitch.cs** — auto-switch hand/controller visuals:

```csharp
using UnityEngine;
using UnityEngine.XR.Hands;

public class HandControllerSwitch : MonoBehaviour
{
    public GameObject leftHandVisual;
    public GameObject rightHandVisual;
    public GameObject leftControllerVisual;
    public GameObject rightControllerVisual;

    private XRHandSubsystem _handSubsystem;

    void Update()
    {
        if (_handSubsystem == null)
        {
            var subsystems = new System.Collections.Generic.List<XRHandSubsystem>();
            SubsystemManager.GetSubsystems(subsystems);
            if (subsystems.Count > 0) _handSubsystem = subsystems[0];
            return;
        }

        bool leftTracked = _handSubsystem.leftHand.isTracked;
        bool rightTracked = _handSubsystem.rightHand.isTracked;

        leftHandVisual.SetActive(leftTracked);
        leftControllerVisual.SetActive(!leftTracked);
        rightHandVisual.SetActive(rightTracked);
        rightControllerVisual.SetActive(!rightTracked);
    }
}
```

### Materials (create 6, all URP/Lit)

```
Mat_Sand          Albedo: #D4B896  Smoothness: 0.2
Mat_DarkBlue      Albedo: #1A2A4A  Smoothness: 0.4  Emission: #112244 @ 0.3
Mat_Marble        Albedo: #E8E0D0  Smoothness: 0.6
Mat_Water         Albedo: #2060A0  Alpha: 0.4  Smoothness: 0.9  Surface: Transparent
Mat_Crystal       Albedo: #4488FF  Alpha: 0.7  Emission: #4488FF @ 1.5  Surface: Transparent
Mat_Beacon        Albedo: #FFCC44  Emission: #FFCC44 @ 2.0
```

---

## 4. Build Settings

### Build Settings (File → Build Settings)

```
Platform:               Android  (Switch Platform if needed — takes a few minutes)
Texture Compression:    ASTC
ETC2 Fallback:          32-bit
Build System:           Gradle
Export Project:         ☐
Compression Method:     LZ4HC
Scenes In Build:
  0: Scenes/World         ☑
```

### Build command

```
File → Build Settings → Build
Output: CitiesOfLight.apk
```

Or via CLI (faster for iteration):
```powershell
# From Unity install dir (Windows)
"C:\Program Files\Unity\Hub\Editor\2022.3.XXf1\Editor\Unity.exe" ^
  -batchmode -quit -nographics ^
  -projectPath "C:\Users\reyno\Unity\CitiesOfLight" ^
  -executeMethod BuildScript.Build ^
  -buildTarget Android ^
  -logFile build.log
```

With `Assets/Editor/BuildScript.cs`:
```csharp
using UnityEditor;
using UnityEditor.Build.Reporting;

public class BuildScript
{
    public static void Build()
    {
        var options = new BuildPlayerOptions
        {
            scenes = new[] { "Assets/Scenes/World.unity" },
            locationPathName = "Build/CitiesOfLight.apk",
            target = BuildTarget.Android,
            options = BuildOptions.CompressWithLz4HC
        };
        BuildReport report = BuildPipeline.BuildPlayer(options);
        if (report.summary.result != BuildResult.Succeeded)
            throw new System.Exception("Build failed: " + report.summary.totalErrors + " errors");
    }
}
```

---

## 5. ADB Install and Run

### Prerequisites

```bash
# Install ADB (if not present)
# Windows: comes with Android SDK Platform-Tools
# Or: scoop install adb  /  choco install adb

# Verify Quest 3 connected via USB-C
adb devices
# Should show: 2GXXXXXXXXXX    device
# If "unauthorized": put on headset, accept USB debugging prompt
```

### Enable Developer Mode on Quest 3

1. Meta app (phone) → Devices → Quest 3 → Settings → Developer Mode → ON
2. Reboot Quest 3
3. On first USB connect: accept "Allow USB debugging" inside headset

### Install

```bash
# Uninstall old version (if exists)
adb uninstall ai.mindprotocol.citiesoflight 2>/dev/null

# Install APK
adb install CitiesOfLight.apk

# Output: Success
```

### Launch

```bash
# Start the app
adb shell am start -n ai.mindprotocol.citiesoflight/com.unity3d.player.UnityPlayerActivity

# Or: find it in Quest 3 → App Library → Unknown Sources → Cities of Light
```

### Debug (live logs)

```bash
# Filter Unity logs
adb logcat -s Unity:V ActivityManager:I

# Watch for:
#   "Foveated rendering: HIGH + gaze-based"
#   "Setting up XR..."
#   Any red errors
```

### Quick iteration loop

```bash
# Build → install → launch → watch logs (one command)
adb install -r CitiesOfLight.apk && \
adb shell am start -n ai.mindprotocol.citiesoflight/com.unity3d.player.UnityPlayerActivity && \
adb logcat -s Unity:V | head -50
```

### Wireless ADB (untethered testing)

```bash
# While USB is connected:
adb tcpip 5555

# Disconnect USB cable, then:
adb connect <QUEST_IP>:5555

# Find Quest IP: Settings → Wi-Fi → Connected network → IP address
# Now all adb commands work wirelessly
```

---

## Checklist Before Build

```
☐ Unity 2022.3 LTS installed
☐ Android Build Support module installed (Unity Hub → Installs → Add Modules)
☐ Android SDK + NDK installed (Unity Hub handles this)
☐ OpenXR plugin enabled for Android
☐ Meta Quest Feature enabled in OpenXR
☐ Hand Tracking Subsystem enabled
☐ Meta Hand Tracking Aim enabled
☐ IL2CPP + ARM64 set
☐ Vulkan only (no OpenGLES)
☐ Linear color space
☐ QuestURP pipeline asset assigned in Quality settings
☐ QuestURPRenderer assigned in QuestURP asset
☐ Single scene in build: World
☐ Quest 3 in developer mode
☐ USB debugging accepted on headset
```

---

## What This Gets You

- 3 floating islands at the correct positions from zones.js
- Walk between them (teleport locomotion or continuous move)
- Waypoint beacons to jump between zones (stand near for 2s)
- Hand tracking with automatic controller fallback
- Foveated rendering (High + gaze-based)
- Fog/light transitions between zones
- Zone name display
- ~5K triangles total (placeholder geometry)
- Runs at 72fps (nothing to stress the GPU)

## What This Does NOT Have (not tonight)

- Networking / multiplayer
- AI citizens
- Voice
- Procedural terrain (flat planes tonight)
- Video gallery playback
- Proper art assets
- Skybox (just gradient)
