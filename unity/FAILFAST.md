# FAILFAST

## 1. PINK MATERIALS

```
Symptom:    Everything renders pink/magenta on Quest
Cause:      Shader stripped from APK — Shader.Find() returns null at runtime
Fix:        Project Settings → Graphics → Always Included Shaders
              → + → Universal Render Pipeline/Lit
              → + → Universal Render Pipeline/Unlit
            Rebuild.
Stop when:  Terrain is sand/blue/marble colored, not pink
```

## 2. BLACK SCREEN / CRASH

```
Symptom:    App launches, black for 1s, returns to Quest home (or stays black)
Cause:      Quest3_URP asset missing from one of two required slots
Fix:        Project Settings → Graphics → Scriptable Render Pipeline Settings → Quest3_URP
            Project Settings → Quality  → Render Pipeline Asset             → Quest3_URP
            Both must be set. Missing either one = crash.
            Still black? Player → Graphics APIs → add OpenGLES3 after Vulkan.
            Rebuild.
Stop when:  Scene renders (even if wrong colors)
```

## 3. NO HANDS

```
Symptom:    World renders, controllers may work, but hands are invisible
Cause:      Hand tracking features not enabled on the ANDROID tab
Fix:        Project Settings → XR Plug-in Management → ANDROID tab (robot icon)
            → OpenXR ⚙ → Features:
              ☑ Meta Quest Feature
              ☑ Hand Tracking Subsystem
              ☑ Meta Hand Tracking Aim
            On Quest: Settings → Movement Tracking → Hand and Body Tracking → ON
            Put controllers down. Quest won't track hands while holding them.
            Rebuild.
Stop when:  Hands appear when you hold them up
```

## 4. GRADLE FAIL

```
Symptom:    "Build failed" in Unity console, red Gradle errors
Cause:      Wrong architecture, backend, or missing SDK
Fix:        Player → Scripting Backend:     IL2CPP
            Player → Target Architectures:  ARM64 only (uncheck ARMv7)
            Player → Minimum API Level:     29
            Player → Graphics APIs:         Vulkan (Auto Graphics API OFF)
            Preferences → External Tools → Android SDK/NDK paths must not be empty
              (empty? Unity Hub → Installs → Add Modules → Android Build Support)
            Rebuild.
Stop when:  APK file appears on disk
```

## 5. ADB DEVICE NOT FOUND

```
Symptom:    "adb devices" shows empty list or "unauthorized"
Cause:      USB debugging not accepted, or charge-only cable
Fix:        1. Use a DATA cable (not charge-only)
            2. Quest → Settings → System → Developer Mode → ON
            3. Unplug → replug USB-C
            4. Put on Quest → accept "Allow USB debugging" → check "Always allow"
            5. On PC:
               adb kill-server
               adb start-server
               adb devices
Stop when:  Output shows "XXXXXXXX    device" (not "unauthorized", not empty)
```
