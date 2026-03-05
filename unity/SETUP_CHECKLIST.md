# Nicolas — Do This Sequence Exactly

## Step 0: Prerequisites (5 min)
- [ ] Unity Hub installed → install Unity 6 LTS (6000.1.x) with **Android Build Support** module
- [ ] Android SDK + NDK (Unity Hub auto-installs these with Android module)
- [ ] adb works: open terminal → `adb devices` → Quest appears

## Step 1: Create Project (2 min)
1. Unity Hub → New Project
2. Template: **3D (URP)**
3. Name: `CitiesOfLight`
4. Location: `C:\Users\reyno\Projects\`
5. Create

## Step 2: Switch Platform (3 min)
1. File → Build Settings
2. Select **Android**
3. Click **Switch Platform** (waits for reimport)

## Step 3: Install Packages (5 min)
Window → Package Manager

**From Unity Registry** (dropdown top-left → "Unity Registry"):
- Search & install: `OpenXR Plugin`
- Search & install: `XR Hands`
- Search & install: `XR Interaction Toolkit` (accept samples if prompted)
- Search & install: `XR Plugin Management`

**Input System dialog appears → click YES → editor restarts.**

**Meta SDK** — Package Manager → + → Add by name:
```
com.meta.xr.sdk.core
```
(If that fails, download "Meta XR Core SDK" from Asset Store tab in Package Manager)

## Step 4: Project Settings (5 min)

Edit → Project Settings:

### XR Plug-in Management → Android tab
- [x] Check **OpenXR**
- Click the ⚙ gear next to OpenXR:
  - Interaction Profiles → + → **Meta Quest Touch Pro Controller Profile**
  - Enabled Features:
    - [x] **Meta Quest Feature**
    - [x] **Hand Tracking Subsystem**
    - [x] **Meta Hand Tracking Aim**
    - [x] **Foveated Rendering** → set level to **High Top**

### Player → Android tab
- Package Name: `ai.mindprotocol.citiesoflight`
- Minimum API Level: **32**
- Scripting Backend: **IL2CPP**
- Target Architectures: ARM64 only ✓ (uncheck x86 and ARMv7)
- Graphics APIs: remove OpenGLES3 → keep only **Vulkan**
- Color Space: **Linear**
- Active Input Handling: **Input System Package (New)**

### Quality
- Keep only 1 level
- Anti-Aliasing: **4x**
- Shadow Distance: 20

## Step 5: Copy Scripts (2 min)

1. In Unity Project window, navigate to `Assets/`
2. Create folder: `Assets/_Project/Scripts/`
3. Copy ALL `.cs` files from `cities-of-light/unity/Assets/_Project/Scripts/` into that folder
4. Wait for Unity to compile (bottom status bar)

## Step 6: Build Scene (5 min)

1. Open the default `SampleScene` (or create new scene: File → New Scene → Basic URP)
2. Delete everything except **Directional Light**

### Add XR Origin:
- Right-click Hierarchy → XR → **XR Origin (XR Rig)**
- This creates: XR Origin → Camera Offset → Main Camera + Left/Right Controller

### Add scripts to empty GameObjects:
- Create empty GO named `Managers`:
  - Add Component: **ZoneManager**
    - Drag `XR Origin (XR Rig)` into the `Xr Origin` slot
    - Drag `Directional Light` into the `Directional Light` slot
  - Add Component: **FoveationSetup**
  - Add Component: **XRHandSetup**

- Create empty GO named `Bootstrap`:
  - Add Component: **BootstrapScene**
  - It auto-finds ZoneManager and XR Origin at runtime

### Set Lighting:
- Window → Rendering → Lighting
- Environment tab:
  - Skybox Material: **Default-Skybox** (or any dark gradient)
  - Environment Lighting Source: **Color** → dark blue `#1a2a3a`

### Save Scene:
- File → Save As → `Assets/_Project/Scenes/MainScene.unity`

## Step 7: Build Settings (1 min)
1. File → Build Settings
2. Add Open Scenes → MainScene should be index 0
3. Development Build: ✓ ON
4. Texture Compression: **ASTC**
5. Compression Method: **LZ4**

## Step 8: Connect Quest + Build (5 min)
1. USB-C cable from PC to Quest 3
2. Put on Quest → Accept "Allow USB debugging"
3. Take off Quest
4. In Unity: File → Build Settings → **Build And Run**
5. Save APK as: `CitiesOfLight.apk`
6. Wait for build (~2-5 minutes first time)
7. APK auto-installs and launches on Quest

## Step 9: Find It On Quest
If Build And Run doesn't auto-launch:
- Quest → Library → Unknown Sources → **Cities of Light**

## If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| "No Android device" | `adb kill-server && adb start-server && adb devices` |
| Gradle error | Check: IL2CPP selected, ARM64 only, min API 32 |
| Black screen in headset | Check Vulkan + Linear color space in Player Settings |
| No hands | Check OpenXR features: Hand Tracking Subsystem + Meta Hand Tracking Aim |
| 60fps stuttery | FoveationSetup.cs requests 90Hz. Check foveation is "High Top" |
| Build too slow | First build is slow (IL2CPP). Second build: ~1 min |

## Manual ADB Commands
```bash
# Check connection
adb devices

# Install manually
adb install -r CitiesOfLight.apk

# Launch from PC
adb shell am start -n ai.mindprotocol.citiesoflight/com.unity3d.player.UnityPlayerActivity

# Watch logs
adb logcat -s Unity:V

# Screenshot from Quest
adb exec-out screencap -p > quest_screenshot.png
```

## Total Time: ~30 minutes from zero to headset entry
