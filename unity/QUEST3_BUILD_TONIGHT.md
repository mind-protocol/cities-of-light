# Quest 3 Build — Tonight

Minimum viable: 3 zones, hand tracking, controller fallback, foveated rendering, APK on headset.

---

## 1. Create Unity Project (Windows)

```
Unity Hub → New Project → "3D (URP)" template → Unity 6 LTS (6000.1.x)
Project name: CitiesOfLight
Location: C:\Users\reyno\Projects\
```

After project opens, close the sample scene.

---

## 2. Package List

Window → Package Manager → Add by name, one at a time:

```
com.unity.xr.openxr
com.unity.xr.hands
com.unity.xr.interaction.toolkit
com.unity.inputsystem
com.unity.xr.management
```

Then add Meta's packages — Add by git URL:

```
https://github.com/oculus-samples/Unity-Movement.git?path=/Packages/com.meta.xr.sdk#v72.0.0
```

OR simpler — download Meta XR All-in-One SDK from Asset Store (search "Meta XR SDK" in Package Manager → Unity Registry).

**Minimum required Meta packages:**
- Meta XR Core SDK
- Meta XR Interaction SDK (for hand tracking aim)

After install, accept any "Enable the new Input System" dialogs → YES, restart editor.

---

## 3. Project Settings (Edit → Project Settings)

### XR Plug-in Management
- [x] OpenXR (Android tab)
- Under OpenXR → Android:
  - Interaction Profiles: Add "Meta Quest Touch Pro Controller Profile"
  - OpenXR Features → Enable ALL of these:
    - [x] Meta Quest Feature
    - [x] Hand Tracking Subsystem
    - [x] Meta Hand Tracking Aim
    - [x] Foveated Rendering (set to **High Top**)
  - Render Mode: Multi-Pass (safer) or Single Pass Instanced (faster, try if no visual bugs)

### Player Settings (Android tab)
- Company Name: MindProtocol
- Product Name: Cities of Light
- Package Name: `ai.mindprotocol.citiesoflight`
- Minimum API Level: **32** (Android 12L — Quest 3 minimum)
- Target API Level: **Highest installed**
- Scripting Backend: **IL2CPP**
- Target Architectures: **ARM64** only (uncheck ARMv7)
- Graphics APIs: **Vulkan** only (remove OpenGLES)
- Color Space: **Linear**
- Active Input Handling: **Input System Package (New)**

### Quality Settings
- Delete all quality levels except one. Name it "Quest3".
- Anti Aliasing: **4x Multi Sampling**
- Shadow Resolution: **512** (low)
- Shadow Distance: **20**
- Shadow Cascades: **No Cascades**
- Texture Quality: **Full**
- VSync Count: **Don't Sync** (Quest handles vsync)

### URP Asset Settings (find the URP-HighFidelity-Renderer or create new)
Better: Create new URP asset:
1. Right-click Project → Create → Rendering → URP Asset (with Universal Renderer)
2. Name: `Quest3_URP`
3. Assign in Project Settings → Graphics → Scriptable Render Pipeline Settings
4. Also assign in Quality Settings → Rendering → Render Pipeline Asset

**Quest3_URP settings:**
- Rendering Path: **Forward+**
- MSAA: **4x**
- HDR: **OFF**
- Main Light: Shadow Resolution **512**
- Additional Lights: Per-Object limit **2**, Shadow Resolution **256**
- Shadow Distance: **20**
- Cascade Count: **1**
- Depth Texture: ON
- Opaque Texture: OFF (save bandwidth)
- SRP Batcher: ON
- Dynamic Batching: OFF (SRP Batcher is better)

---

## 4. Scene Hierarchy

One scene: `MainScene.unity`

```
MainScene
├── XR Origin (XR Rig)
│   ├── Camera Offset
│   │   ├── Main Camera [Camera, TrackedPoseDriver, AudioListener]
│   │   ├── Left Hand [XRController, XRHandTrackingEvents, HandVisualizer]
│   │   └── Right Hand [XRController, XRHandTrackingEvents, HandVisualizer]
│   └── Locomotion System [LocomotionProvider - optional snap turn]
│
├── Environment
│   ├── Directional Light [Light, shadows on, intensity 1.2]
│   ├── Ocean [Plane 200x200, blue material, y=-0.5]
│   ├── Skybox [set in Lighting Settings]
│   ├── Zone_Island [ZoneRoot: terrain mesh + palms + rocks]
│   ├── Zone_Archive [ZoneRoot: terrain mesh + crystals]
│   └── Zone_Agora [ZoneRoot: terrain mesh + columns]
│
├── Managers
│   ├── ZoneManager [ZoneManager.cs]
│   ├── XRSetup [XRHandSetup.cs - runtime hand tracking init]
│   └── FoveationSetup [FoveationSetup.cs]
│
└── UI
    └── ZoneLabel [Canvas + TextMeshPro - current zone name]
```

---

## 5. Build Settings

File → Build Settings:
- Platform: **Android** (Switch Platform if needed — takes a few minutes)
- Scenes in Build: `MainScene` (index 0)
- Texture Compression: **ASTC**
- ETC2 Fallback: **None**
- Build App Bundle: **OFF** (APK for sideloading)
- Run Device: Your Quest (must be connected via USB or Wi-Fi ADB)
- Development Build: **ON** (for tonight, faster iteration)
- Script Debugging: OFF
- Compression Method: **LZ4**

Build → choose output path → `CitiesOfLight.apk`

---

## 6. ADB Install + Run

### One-time Quest setup:
1. Quest 3 → Settings → System → Developer → Enable **USB Connection Dialog**
2. Connect Quest to PC via USB-C
3. Put on headset → Accept "Allow USB debugging" dialog

### Install:
```bash
# Check device connected
adb devices

# Install APK (fresh)
adb install CitiesOfLight.apk

# Or update existing
adb install -r CitiesOfLight.apk

# Launch from headset: Library → Unknown Sources → Cities of Light
```

### Quick iteration loop:
```bash
# Build in Unity (Ctrl+B), then:
adb install -r "C:\Users\reyno\Projects\CitiesOfLight\Builds\CitiesOfLight.apk"

# Force launch without headset navigation:
adb shell am start -n ai.mindprotocol.citiesoflight/com.unity3d.player.UnityPlayerActivity

# View logs:
adb logcat -s Unity:V
```

### Wireless ADB (no cable after first pair):
```bash
# On Quest: Settings → System → Developer → Wireless debugging → Pair
# Note the IP:port and pairing code
adb pair <IP>:<PAIR_PORT> <PAIRING_CODE>
adb connect <IP>:<CONNECT_PORT>
```

---

## 7. Gotchas — Read Before Building

1. **"No XR device found"**: Check XR Plug-in Management → Android tab → OpenXR is checked
2. **Black screen on Quest**: Vulkan + Linear color space required. If black, check Player Settings
3. **Hands not showing**: Meta Hand Tracking Aim must be enabled in OpenXR features
4. **Controller not working**: Need "Meta Quest Touch Pro Controller Profile" in OpenXR Interaction Profiles
5. **60fps not 90fps**: In OVRManager or via script: `OVRPlugin.systemDisplayFrequency = 90f;` or use the FoveationSetup script
6. **APK too large**: Delete unused URP samples, TextMeshPro examples. Target <50MB
7. **Gradle build fails**: Check Minimum API 32, IL2CPP selected, ARM64 only
