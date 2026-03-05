# Quest 3 Build — Tonight

**Unity 2022.3 LTS. No networking. No AI. No backend. Just get inside.**

---

## 1. PACKAGE LIST

Install via Unity Hub with the project, or Window > Package Manager > Add by name:

| Package | Name (for Add by Name) | Version |
|---------|----------------------|---------|
| OpenXR Plugin | `com.unity.xr.openxr` | 1.9.1 or 1.10.0 |
| XR Hands | `com.unity.xr.hands` | 1.3.0 or 1.4.0 |
| XR Interaction Toolkit | `com.unity.xr.interaction.toolkit` | 2.5.4 |
| XR Plugin Management | `com.unity.xr.management` | 4.4.0 |
| Input System | `com.unity.inputsystem` | 1.7.0 |
| TextMeshPro | `com.unity.textmeshpro` | 3.0.6 (pre-installed) |

**Meta OpenXR package** — Add by git URL in Package Manager:
```
https://github.com/oculus-samples/Unity-FirstHand.git?path=Packages/com.meta.xr.sdk.core
```
OR search **"Meta XR Core SDK"** in the Asset Store tab (Package Manager top-left dropdown).

When prompted "Enable the new Input System?" → YES → editor restarts.
When prompted "Import TMP Essential Resources?" → YES.

**Total: 6 packages + Meta XR Core SDK.**

---

## 2. PROJECT SETTINGS — EXACT VALUES

### Edit > Project Settings > XR Plug-in Management

**Android tab** (robot icon):
- [x] **OpenXR**

Click the gear ⚙ next to OpenXR (Android row):

**Interaction Profiles** (click +):
- Oculus Touch Controller Profile

**OpenXR Feature Groups** — enable these:
- [x] **Meta Quest Feature**
- [x] **Hand Tracking Subsystem** (under Hand Tracking)
- [x] **Meta Hand Tracking Aim** (under Hand Tracking)

**Rendering:**
- Render Mode: **Multi-Pass** (safer; switch to Single Pass Instanced later if stable)

### Edit > Project Settings > Player > Android tab

| Setting | Value |
|---------|-------|
| Company Name | MindProtocol |
| Product Name | Cities of Light |
| Package Name | `ai.mindprotocol.citiesoflight` |
| Version | 0.1.0 |
| Minimum API Level | **Android 10.0 (API level 29)** |
| Target API Level | Automatic (highest) |
| Scripting Backend | **IL2CPP** |
| API Compatibility Level | .NET Standard 2.1 |
| Target Architectures | **ARM64 only** (uncheck everything else) |
| Active Input Handling | **Input System Package (New)** |

**Other Settings > Graphics:**
- Graphics APIs: **Vulkan** only (remove OpenGLES3 if present)
- If Vulkan causes issues on build, add OpenGLES3 back as fallback
- Color Space: **Linear**

### Edit > Project Settings > Quality

Delete all levels except one. Name it `Quest3`.

| Setting | Value |
|---------|-------|
| Rendering > Render Pipeline Asset | Quest3_URP (create below) |
| Anti Aliasing | 4x |
| Shadow Resolution | Low (512) |
| Shadow Distance | 20 |
| Shadow Cascades | No Cascades |
| VSync Count | Don't Sync |
| Texture Quality | Full Res |

### Create URP Asset

1. Project window: right-click > Create > Rendering > URP Asset (with Universal Renderer)
2. Name it `Quest3_URP` (this also creates `Quest3_URP_Renderer`)
3. Select `Quest3_URP`, set in Inspector:

| Setting | Value |
|---------|-------|
| Rendering Path | Forward (not Forward+, which is 2023+) |
| Depth Texture | ON |
| Opaque Texture | OFF |
| SRP Batcher | ON |
| Dynamic Batching | OFF |
| HDR | OFF |
| MSAA | 4x |
| Main Light > Cast Shadows | ON |
| Main Light > Shadow Resolution | 512 |
| Additional Lights > Per Object Limit | 2 |
| Additional Lights > Cast Shadows | OFF |
| Shadow Distance | 20 |
| Cascade Count | 1 |

4. **Assign the URP Asset:**
   - Edit > Project Settings > Graphics > Scriptable Render Pipeline Settings → drag `Quest3_URP`
   - Edit > Project Settings > Quality > Rendering > Render Pipeline Asset → drag `Quest3_URP`

### Edit > Project Settings > Graphics

- Foveated Rendering: if the field appears, set to **Enabled**
  (In 2022.3, foveated rendering is controlled via OpenXR feature toggle + runtime script)

---

## 3. SCENE HIERARCHY

One scene: `Assets/_Project/Scenes/MainScene.unity`

```
MainScene
│
├── Directional Light          [Light component, Soft Shadows ON, Intensity 1.2]
│
├── XR Origin (XR Rig)         [Right-click Hierarchy → XR → XR Origin (XR Rig)]
│   └── Camera Offset
│       ├── Main Camera        [auto-created, has Camera + TrackedPoseDriver]
│       ├── LeftHand Controller [auto-created, has XR Controller]
│       └── RightHand Controller [auto-created, has XR Controller]
│
├── Managers                   [Empty GameObject]
│   ├── [ZoneManager]          ← component: ZoneManager.cs
│   ├── [FoveationSetup]       ← component: FoveationSetup.cs
│   └── [XRHandSetup]          ← component: XRHandSetup.cs
│
└── Bootstrap                  [Empty GameObject]
    └── [BootstrapScene]       ← component: BootstrapScene.cs
```

**Runtime-generated (by BootstrapScene.cs):**
```
Ocean                          [Plane 300x300, blue material, y=-0.5]
Zone_Island                    [Procedural terrain + 8 palms at 0,0,0]
Zone_Archive                   [Procedural terrain + 10 crystals at -30,0,-25]
Zone_Agora                     [Procedural terrain + 8 columns at -20,0,40]
Beacon_archive                 [Glowing pillar on Island shore → Archive]
Beacon_agora                   [Glowing pillar on Island shore → Agora]
Beacon_island (×2)             [Glowing pillars on Archive/Agora shores → Island]
```

**Wire up in Inspector:**
- ZoneManager: drag `XR Origin (XR Rig)` → `Xr Origin` slot, drag `Directional Light` → `Directional Light` slot

**Lighting Settings** (Window > Rendering > Lighting):
- Skybox Material: Default-Skybox
- Environment Lighting > Source: Color → `#1a2a3a` (dark blue)
- Environment Lighting > Intensity: 1.0

---

## 4. SCRIPTS — ALL 7

Already in `unity/Assets/_Project/Scripts/`:

| Script | Role | Lines |
|--------|------|-------|
| `BootstrapScene.cs` | Builds ocean + 3 islands + 4 beacons at Awake | 92 |
| `IslandBuilder.cs` | Procedural terrain mesh + vegetation per zone type | 264 |
| `ZoneManager.cs` | Nearest-zone detection + fog/light lerp | 165 |
| `TeleportBeacon.cs` | Glowing pillar + proximity teleport (2.5m trigger) | 90 |
| `FoveationSetup.cs` | Requests 90Hz + foveation at Start | 45 |
| `XRHandSetup.cs` | Monitors hand subsystem, logs tracking state | 69 |
| `Billboard.cs` | Makes beacon labels face camera | 24 |
| `OceanSimple.cs` | Gentle Y-axis bob animation | 20 |

**No other scripts needed.** No networking, no AI, no backend.

---

## 5. BUILD SETTINGS

File > Build Settings:

| Setting | Value |
|---------|-------|
| Platform | **Android** (click Switch Platform) |
| Scenes In Build | `_Project/Scenes/MainScene` (index 0, checkbox ON) |
| Texture Compression | **ASTC** |
| ETC2 Fallback | 32-bit |
| Build App Bundle | **OFF** (we want .apk) |
| Development Build | **ON** (for tonight) |
| Autoconnect Profiler | OFF |
| Script Debugging | OFF |
| Compression Method | **LZ4** |

**Build:** File > Build Settings > Build > save as `CitiesOfLight.apk`
**Or:** Build And Run (auto-installs if Quest connected via USB)

---

## 6. ADB INSTALL + LAUNCH

### Prerequisites
```bash
# Verify adb sees Quest (USB-C connected, debugging accepted on headset)
adb devices
# Should show: XXXXXXXX    device
```

### Install
```bash
# First install
adb install CitiesOfLight.apk

# Update (keep data)
adb install -r CitiesOfLight.apk
```

### Launch from PC (skip headset menu navigation)
```bash
adb shell am start -n ai.mindprotocol.citiesoflight/com.unity3d.player.UnityPlayerActivity
```

### Find on Quest manually
Quest 3 → App Library → dropdown "All" → filter **Unknown Sources** → Cities of Light

### Watch logs
```bash
adb logcat -s Unity:V ActivityManager:I
```

### Wireless ADB (optional, for cable-free iteration)
```bash
# Quest: Settings > System > Developer > Wireless debugging > Pair device
adb pair <IP>:<PAIR_PORT> <PAIRING_CODE>
adb connect <IP>:<ADB_PORT>
```

---

## 7. FAILURE CHECKLIST

| Symptom | Cause | Fix |
|---------|-------|-----|
| **Gradle build fails** | Wrong architecture / API | Confirm: IL2CPP, ARM64 only, min API 29 |
| **"No XR display found"** | OpenXR not enabled for Android | Project Settings > XR Plug-in Management > Android tab > check OpenXR |
| **Black screen on Quest** | Wrong graphics API or color space | Player Settings: Vulkan + Linear. If still black: add OpenGLES3 as fallback |
| **No hands visible** | Hand Tracking Subsystem not enabled | OpenXR Features > enable Hand Tracking Subsystem + Meta Hand Tracking Aim |
| **Controllers don't work** | Missing interaction profile | OpenXR > Interaction Profiles > add Oculus Touch Controller Profile |
| **60fps not 90fps** | Default refresh rate is 72Hz | FoveationSetup.cs handles this. Also: Quest Settings > Display > 90Hz |
| **App not in Unknown Sources** | Package name mismatch | Verify `ai.mindprotocol.citiesoflight` in Player Settings |
| **Shader pink/magenta** | URP asset not assigned | Assign Quest3_URP in both Graphics AND Quality settings |
| **"TMP not initialized"** | TMP resources not imported | Window > TextMeshPro > Import TMP Essential Resources |
| **Build takes 20+ min** | First IL2CPP build is slow | Normal. Second build: ~2 min. Don't abort. |
| **APK > 100MB** | Unused assets | Delete Samples~, TMP Examples. Check nothing large imported |
| **XR Origin at wrong height** | Floor level calibration | In Quest: Settings > Guardian > Reset Floor Level |
| **Can't find beacons** | Beacons at island edges (11m from center) | Walk toward any shore edge, look for glowing pillars |
| **Teleport not triggering** | Must be within 2.5m of beacon | Walk closer. Check adb logcat for `[Zone] Teleported` |

---

## DEFINITION OF DONE

Nicolas puts on Quest 3 → spawns on The Island → sees his hands → walks to a glowing beacon → teleports to The Archive → fog turns blue → walks to beacon → teleports to The Agora → fog turns golden.

**That's it. Ship it.**
