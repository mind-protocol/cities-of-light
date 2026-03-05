# PREFLIGHT — Quest 3 Build

---

## 12-STEP CHECKLIST

```
 1. [ ] Unity Hub → install 2022.3 LTS + Android Build Support (SDK/NDK/JDK)
 2. [ ] New project → 3D (URP) template → name "CitiesOfLight"
 3. [ ] File → Build Settings → Android → Switch Platform
 4. [ ] Install 6 packages (see PACKAGES below)
 5. [ ] Accept "Enable new Input System?" → YES (editor restarts)
 6. [ ] Accept "Import TMP Essential Resources?" → YES
 7. [ ] Create Quest3_URP asset + apply all SETTINGS below
 8. [ ] CRITICAL: Project Settings → Graphics → Always Included Shaders → add "Universal Render Pipeline/Lit"
 9. [ ] Copy 8 .cs files into Assets/_Project/Scripts/ — wait for compile
10. [ ] Scene: keep Directional Light, add XR Origin (right-click → XR → XR Origin), add empty "Managers" (3 components), add empty "Bootstrap" (1 component), wire 2 refs
11. [ ] Save scene as Assets/_Project/Scenes/MainScene → Build Settings → Add Open Scenes
12. [ ] USB-C to Quest → accept debug prompt → Build And Run
```

---

## PACKAGES

Window → Package Manager → + → Add by name:

```
com.unity.xr.management              4.4.0
com.unity.xr.openxr                  1.9.1
com.unity.xr.hands                   1.4.0
com.unity.xr.interaction.toolkit     2.5.4
com.unity.inputsystem                1.7.0
```

**Meta XR Core SDK** (pick ONE method):

**A) Asset Store (simplest):**
Package Manager → top-left dropdown → My Assets → search "Meta XR Core SDK" → Install

**B) Scoped Registry:**
Edit `Packages/manifest.json`, add before `"dependencies"`:
```json
"scopedRegistries": [{
  "name": "Meta XR SDK",
  "url": "https://npm.developer.oculus.com",
  "scopes": ["com.meta.xr"]
}],
```
Then Package Manager → + → Add by name → `com.meta.xr.sdk.core`

Do NOT install: Oculus XR Plugin, Photon, Netcode, anything else.

---

## SETTINGS

### XR Plug-in Management → Android tab (robot icon)
```
☑ OpenXR
  ⚙ Interaction Profiles: Oculus Touch Controller Profile
  ⚙ Features:
    ☑ Meta Quest Feature
    ☑ Hand Tracking Subsystem
    ☑ Meta Hand Tracking Aim
  Render Mode: Multi-Pass
```

### Player → Android tab
```
Package Name:          ai.mindprotocol.citiesoflight
Minimum API Level:     29
Scripting Backend:     IL2CPP
Target Architectures:  ARM64 only
Auto Graphics API:     OFF
Graphics APIs:         Vulkan only (remove OpenGLES3)
Color Space:           Linear
Active Input:          Input System Package (New)
```

### Quest3_URP asset (Create → Rendering → URP Asset with Universal Renderer)
```
Rendering Path:        Forward
SRP Batcher:           ON
HDR:                   OFF
MSAA:                  4x
Main Light Shadows:    ON, Resolution 512
Additional Lights:     Per Object 2, Shadows OFF
Shadow Distance:       20
Cascade Count:         1
```

### Assign Quest3_URP in TWO places
```
Project Settings → Graphics → Scriptable Render Pipeline Settings → Quest3_URP
Project Settings → Quality → Render Pipeline Asset → Quest3_URP
```

### Quality
```
Single level, VSync: Don't Sync
```

### Graphics → Always Included Shaders (CRITICAL)
```
+ Universal Render Pipeline/Lit
+ Universal Render Pipeline/Unlit
```

### Build Settings
```
Platform: Android
Texture Compression: ASTC
Compression Method: LZ4
Development Build: ON
Build App Bundle: OFF
Scene 0: MainScene
```

---

## TOP 5 FAILURES + EXACT RECOVERY

### 1. Pink/magenta geometry on Quest

**Cause:** `Shader.Find("Universal Render Pipeline/Lit")` returns null because Unity stripped the shader from the APK. All our materials are created in code at runtime — Unity doesn't see a reference and strips it.

**Fix:**
```
Project Settings → Graphics → Always Included Shaders
  → + → Universal Render Pipeline/Lit
  → + → Universal Render Pipeline/Unlit
Rebuild.
```

### 2. Black screen or instant crash on launch

**Cause:** Quest3_URP not assigned, or assigned in only one of the two required places.

**Fix:**
```
Check BOTH of these point to the same Quest3_URP asset:
  Project Settings → Graphics → Scriptable Render Pipeline Settings
  Project Settings → Quality → Render Pipeline Asset
Rebuild.

Still black? Add OpenGLES3 back as fallback after Vulkan in Graphics APIs.
Rebuild.
```

### 3. No hands visible (controllers work but hands don't)

**Cause:** One of the three required OpenXR hand features not enabled on the Android tab. Or enabled on the wrong tab (Standalone instead of Android).

**Fix:**
```
Project Settings → XR Plug-in Management → ANDROID tab (robot icon) → OpenXR ⚙:
  ☑ Hand Tracking Subsystem
  ☑ Meta Hand Tracking Aim
  ☑ Meta Quest Feature
All three checked? Also verify on Quest:
  Settings → Movement Tracking → Hand and Body Tracking → ON
Put controllers DOWN — Quest won't track hands while holding controllers.
Rebuild.
```

### 4. Gradle build fails

**Cause:** Wrong architecture, scripting backend, or missing Android SDK.

**Fix:**
```
Check each:
  [ ] Player → Scripting Backend: IL2CPP (not Mono)
  [ ] Player → Target Architectures: ARM64 only (uncheck ARMv7, x86)
  [ ] Player → Minimum API Level: 29
  [ ] Player → Graphics APIs: Vulkan (remove Auto)
  [ ] Preferences → External Tools → Android SDK/NDK paths not empty
      (empty? Unity Hub → Installs → your version → Add Modules → Android)
  [ ] Delete Library/ and Temp/ folders if all above is correct
Rebuild.
```

### 5. "adb devices" shows empty or "unauthorized"

**Cause:** USB debugging not accepted on headset, or charge-only cable.

**Fix:**
```
1. Use a DATA-capable USB-C cable
2. Quest → Settings → System → Developer Mode → ON
3. Quest → Settings → System → Developer → USB Connection Dialog → ON
4. Unplug → replug cable
5. Put on Quest → accept "Allow USB debugging" → check "Always allow"
6. On PC:
   adb kill-server
   adb start-server
   adb devices
Should show: XXXXXXXX    device
```

---

## ADB COMMANDS

```bash
adb devices                                    # verify
adb install -r CitiesOfLight.apk               # install
adb shell am start -n ai.mindprotocol.citiesoflight/com.unity3d.player.UnityPlayerActivity  # launch
adb logcat -s Unity:V                          # logs
adb shell am force-stop ai.mindprotocol.citiesoflight   # kill
```

---

## DONE WHEN

Headset on → The Island → hands visible → walk to glowing beacon → The Archive (blue fog) → walk to beacon → The Agora (gold fog).
