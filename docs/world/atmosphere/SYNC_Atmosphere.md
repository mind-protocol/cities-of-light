# SYNC: world/atmosphere — Current State

Last updated: 2026-03-11

---

## Status: NOT BUILT

No atmosphere system exists. The current Cities of Light codebase has a static golden-hour sky, fixed fog, and zone-based ambient transitions. There is no day/night cycle, no weather, no mood-driven atmosphere, no biometric integration. Everything described in PATTERNS_Atmosphere.md must be built from scratch, though several existing subsystems provide a strong foundation.

---

## What Exists Now

### Static Sky and Lighting (current, working)

- `src/client/scene.js` — Preetham Sky model with fixed sun position (`SUN_ELEVATION = 12`, `SUN_AZIMUTH = 220`, permanent golden hour). DirectionalLight at fixed intensity (2.5) and color (0xffcc88). Shadow map sized for a 100x100 area.
- Sky uniforms are hardcoded: turbidity=4, rayleigh=1.5, mie=0.005, mieDirectionalG=0.85.
- PMREM environment map generated once from the sky at startup. Not regenerated.
- Stars: 400-800 points at fixed opacity (0.4). No time-based visibility.
- Clouds: two procedural planes at heights 80 and 120. Fixed opacity (0.5, 0.3). No dynamic modulation.

### Zone Ambient System (current, working)

- `src/client/zone-ambient.js` — `ZoneAmbient` class. Detects nearest zone each frame, lerps fog color, fog density, particle color, and hemisphere light color toward zone-specific targets. Lerp factor 0.02/frame (~2s transition at 60fps).
- Targets are static: defined per zone in `src/shared/zones.js` as `ambient.fogColor`, `ambient.fogDensity`, `ambient.particleColor`, `ambient.lightColor`.
- Zone change fires `onZoneChanged` callback (used for audio crossfade).
- Fog type: `THREE.FogExp2` (exponential fog), density per zone.

### Particles (current, basic)

- `scene.js` creates a single `THREE.Points` object for stars. No ambient district particles exist.
- Particle material uses `PointsMaterial` with vertex colors and size attenuation. Reusable pattern for district particles.

### Relevant Patterns (reusable for atmosphere)

| Existing | Reuse For |
|---|---|
| `Sky` + Preetham model | Dynamic sky: modulate sun position, turbidity, rayleigh per time-of-day |
| `ZoneAmbient` lerp framework | District mood transitions: same lerp pattern, but targets become dynamic |
| `FogExp2` on scene | Atmospheric fog layer: modulate density from time + mood + biometric |
| `PointsMaterial` with vertex colors | District particle systems: per-particle color, instanced |
| `buildClouds()` procedural texture | Haze layer: modulate opacity dynamically |
| Star system | Night sky: modulate opacity based on time-of-day |
| PMREM environment map | Regenerate on major lighting changes (dawn/dusk transitions) |
| Quest 3 detection (`_isQuest`) | Reduce particle count, fog resolution on Quest 3 |

### What Does NOT Exist

- Day/night cycle (accelerated clock, sun position animation)
- Dynamic sky uniform modulation (turbidity, rayleigh, mie changing over time)
- Dynamic directional light color/intensity tied to sun position
- Hemisphere light modulation tied to time-of-day
- Window emissive glow system (night-time building windows)
- Ground fog particle layer (canal-level mist)
- Fog density driven by narrative tension or biometric stress
- District mood aggregate computation
- Per-district particle systems (dust, moisture, forge ash)
- Biometric integration pipeline (Garmin stress to server to atmosphere params)
- `src/client/atmosphere/` directory (planned, empty)
- `src/client/atmosphere/day-night.js` (planned, does not exist)
- `src/client/atmosphere/weather.js` (planned, does not exist)
- `src/client/atmosphere/district-mood.js` (planned, does not exist)
- Server-side mood aggregate in `venice-state.js` (planned, does not exist)

---

## Dependencies (What Must Exist Before Atmosphere Can Work)

### Hard Dependencies (blocks atmosphere rendering)

1. **World clock** — The atmosphere system needs an accelerated clock. This does not depend on any other module. It can be implemented as a standalone utility (`atmosphere/day-night.js`) that exports `getWorldTime()` returning hours (0-24) and a normalized day phase (0.0-1.0).

2. **Scene references** — The atmosphere system needs access to the Sky, DirectionalLight, HemisphereLight, FogExp2, star Points, and cloud meshes created by `scene.js`. Either `createEnvironment()` returns these (it already returns `{ group, water, sky, sunLight }`) or atmosphere hooks into them after scene creation.

### Soft Dependencies (atmosphere works without these, but is incomplete)

3. **District definitions** (`world/districts`) — Without district boundaries, per-district particles and mood transitions have no spatial reference. Atmosphere can run in global mode (single mood, single particle type) without districts.

4. **Citizen mood data** (`economy/sync` + `venice-state.js`) — Without Airtable sync, there is no mood aggregate. Atmosphere falls back to time-of-day only. This is fine for POC.

5. **Narrative tension** (`narrative/physics`) — Without the Blood Ledger physics tick, fog density is not modulated by tension. Falls back to time-of-day fog curves. Fine for POC.

6. **Biometric pipeline** (`garmin_reader.py` + server route) — Without Garmin data, biometric tint is simply absent. No fallback needed; it is opt-in by design.

7. **Building window meshes** (`world/districts`) — Window emissive glow at night requires buildings with window geometry that accepts emissive intensity changes. Without buildings, no window glow.

---

## Build Order

### Step 1: Accelerated Clock + Sun Animation
- `WorldClock` class in `atmosphere/day-night.js`. Rate: 1 real second = 15 simulated seconds (96-minute full cycle).
- Compute sun azimuth/elevation from simulated hour. Update `Sky` uniforms + `DirectionalLight`.

### Step 2: Light and Fog Time Curves
- Keyframe curves for: light color, light intensity, hemisphere colors, fog density, fog color, star opacity, cloud opacity.
- Interpolate per frame from `WorldClock` hour.

### Step 3: Ground Fog Particles
- `atmosphere/weather.js`. 200-300 particles within 30m, height 0-2m, slow horizontal drift. Density from time-of-day curve.

### Step 4: District Mood Integration
- `atmosphere/district-mood.js`. Update atmosphere targets on district change based on mood aggregate. Initially hardcoded per district.

### Step 5: Per-District Particles
- Swap particle type on district enter/exit. Shared instanced buffer, different color/behavior parameters.

### Step 6: Biometric Integration
- Server route: `GET /api/atmosphere/biometric` returns `{ stress: 0-100 }`. Client polls every 30s. Stale data (>30min) = disabled.

### Step 7: Window Glow (requires districts)
- Window emissive intensity from 0 (noon) to 0.4 (night). Per-building variation based on occupancy.

### Step 8: Integration + ZoneAmbient Migration
- New atmosphere subsumes `ZoneAmbient`. Wire narrative tension into fog. PMREM regeneration on dawn/dusk only. Quest 3 budget: < 0.5ms/frame.

---

## Open Questions

### Q1: PMREM environment map regeneration frequency
PMREM generation costs ~8ms. Recommendation: regenerate on phase transitions only (dawn, noon, dusk, night) for desktop. Never regenerate on Quest 3.

### Q2: Fog interaction with building LOD
Fog at distance hides LOD2 billboard artifacts. Recommendation: fog density minimum ensures ~50% visibility drop at 120m (LOD1-to-LOD2 boundary).

### Q3: Night darkness on Quest 3
Very dark scenes cause LCD banding. Recommendation: hemisphere light intensity never below 0.05. Night is atmospheric, not pitch black.

### Q4: Biometric perception
Should visitors know biometric data influences the world? Conflicts with zero-UI. Decision deferred to V2.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Dynamic sky causes PMREM regeneration stalls | Medium | Regenerate on phase transitions only. Skip on Quest 3. |
| Fog particles exceed GPU budget on Quest 3 | Medium | Cap at 150 particles on Quest 3 (vs 300 desktop). Reduce spawn radius to 20m. |
| District mood changes feel arbitrary without visible citizen behavior | Medium | Atmosphere changes are slow (60s lerp). Combined with citizen posture/animation, the cause-effect should feel natural. |
| Biometric integration feels gimmicky or creepy | Low | Effect is intentionally subtle (max 20% atmosphere weight). Most visitors will not notice. Privacy-safe: no data on client. |
| Night is too dark for VR comfort | High | Test on Quest 3 early. Set ambient floor. Increase lantern light radius. Moon as backup fill light. |
| Too many lerp targets create jittery atmosphere | Medium | All lerps use the same 0.02/frame factor. Inputs update at different rates (time=per-frame, mood=60s, biometric=30s). No competing oscillations. |
