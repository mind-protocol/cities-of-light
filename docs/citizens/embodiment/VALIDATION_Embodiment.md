# Citizens/Embodiment -- Validation: Health Checks for the Visual Identity System

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
PATTERNS:        ./PATTERNS_Embodiment.md
ALGORITHM:       ./ALGORITHM_Embodiment.md
THIS:            VALIDATION_Embodiment.md (you are here)
PARENT:          ../../../docs/05_VALIDATION_Venezia.md
```

---

## INVARIANTS (must ALWAYS hold)

### INV-E1: Class Always Readable from Clothing

Every citizen's `CitizenConfig.clothingId` must begin with the lowercase form of their `socialClass`. A Nobili wearing `popolani_male_tunic_01` is a critical failure. Clothing is the only interface -- if it lies, the world is unreadable.

```
FOR each citizen C:
  ASSERT C.config.clothingId.startsWith(C.config.socialClass.toLowerCase())
  ELSE FAIL("Class-clothing mismatch: {C.id} is {C.socialClass} wearing {C.clothingId}")
```

### INV-E2: No Floating Names Ever

Zero text overlays, name sprites, health bars, or UI elements attached to any citizen mesh. The scene graph for any citizen Group must contain no `THREE.Sprite` with text, no `CSS2DObject`, no `troika-three-text`. Exception: accessibility mode, gated behind `config.accessibility.classIndicators === true`, off by default.

### INV-E3: Tier Render Matches Assignment

After transition completes (`transitionT >= 1.0`): FULL citizens have `meshFull` visible and non-null. ACTIVE citizens have `meshActive` visible and non-null. AMBIENT citizens have an active instance slot. HIDDEN citizens have no visible mesh and no instance.

### INV-E4: No Synchronized Animation

All 186 `animPhaseOffset` values must be uniformly distributed across [0.0, 1.0]. Minimum pairwise distance > 0.005. Two FULL-tier citizens in the same frame must never be at the same animation phase.

### INV-E5: Parametric Uniqueness

No two citizens share the same `baseMeshId + clothingId + colorPrimary + colorSecondary + heightScale + buildScale` combination. Hash all 6 fields, assert no collision across 186 citizens.

---

## HEALTH CHECKS

### HC-E1: Triangle Budget Per Citizen Per Tier

| Tier | Max Tris/Citizen | Alert Threshold | Critical |
|------|-----------------|-----------------|----------|
| FULL | 5,000 | > 5,500 | > 6,000 |
| ACTIVE | 1,000 | > 1,100 | > 1,200 |
| AMBIENT | 100 | > 110 | > 150 |

Total citizen triangles must stay under 170K (34% of 500K budget). Check every 10 seconds in debug mode via `renderer.info.triangles` delta.

### HC-E2: Animation Frame Rate

| Tier | Metric | Minimum | Target |
|------|--------|---------|--------|
| FULL | `AnimationMixer.update()` calls/sec | 30 | 60 |
| ACTIVE | Posture offset updates/sec | 10 | 30 |
| AMBIENT | Instance matrix updates/sec | 0.5 | 1.0 |

### HC-E3: LOD Transition Smoothness

During any tier transition: opacity must change monotonically (no frame-to-frame jumps > 0.15 at 60fps). Both old and new meshes coexist during crossfade (`opacity_old + opacity_new` in [0.8, 1.2]). Transition must complete within 120% of target duration:

| Transition | Target | Max Allowed |
|------------|--------|-------------|
| AMBIENT -> ACTIVE | 0.5s | 0.6s |
| ACTIVE -> FULL | 0.3s | 0.36s |
| FULL -> ACTIVE | 0.4s | 0.48s |
| ACTIVE -> AMBIENT | 0.5s | 0.6s |

### HC-E4: Mesh Disposal Latency

Higher-tier meshes must be disposed within 5 seconds of transition to a lower tier. No stale `meshFull` on a citizen who has been ACTIVE for > 6 seconds. No stale `meshActive` on an AMBIENT citizen for > 6 seconds.

### HC-E5: Face Atlas UV Integrity

All 186 `faceAtlasUV` coordinates must map to unique, non-overlapping 256x256 slots within the 4096x4096 atlas (14x14 grid = 196 slots). No duplicate slots. No out-of-bounds references.

### HC-E6: Material Memory Footprint

| Asset | Expected | Maximum | Alert At |
|-------|----------|---------|----------|
| Face atlas (4096x4096 RGBA) | 64MB | 64MB | -- |
| Class atlases (5 x 2048x2048) | 80MB | 100MB | 90MB |
| Geometry (all LODs) | 20MB | 30MB | 25MB |
| **Total** | **164MB** | **194MB** | **180MB** |

---

## ACCEPTANCE CRITERIA

**AC-E1: Class Identification.** Tester identifies social class from appearance: >= 90% accuracy at FULL range, >= 70% at ACTIVE range. 20 randomized screenshots per tier, 5 class options.

**AC-E2: Crowd Liveliness.** 60-second recording of Rialto at midday with 30+ citizens. No two FULL-tier citizens performing the same gesture at the same animation phase in any frame.

**AC-E3: Visual Continuity.** Walk from 100m to 5m toward a citizen. Zero perceptible pop-in. Citizen detail increases continuously, never switches abruptly.

**AC-E4: Performance Under Load.** Maximum density (20 FULL + 60 ACTIVE + 100 AMBIENT): Quest 3 >= 72fps (P50), no drops below 60fps (P99). Desktop mid-range >= 90fps.

**AC-E5: Mood Readability.** Tester identifies positive vs. negative mood from posture/animation alone (no UI, no dialogue) with >= 75% accuracy across 20 clips.

---

## ANTI-PATTERNS

### AP-E1: Synchronized Animation
**Symptom:** Citizens move in lockstep -- arms swing together, heads turn simultaneously.
**Detection:** Any pair of visible FULL-tier citizens with `abs(phaseOffset difference) < 0.05`.
**Fix:** Verify `animPhaseOffset` applied in `sampleAnimation()` as `elapsed + offset * clipDuration`.

### AP-E2: Identical Citizens (Clone Army)
**Symptom:** Two citizens visually indistinguishable at ACTIVE range.
**Detection:** INV-E5 automated check plus visual spot-check of 10+ citizen scenes.
**Fix:** Widen `hashVariation()` range. Ensure >= 2 clothing variants per class/gender.

### AP-E3: Uncanny Valley
**Symptom:** Citizens feel robotic or unsettling. >= 2 of 5 testers use "creepy" or "dead."
**Detection:** Qualitative user testing with post-session keyword survey.
**Fix:** Reduce face texture realism (painterly over photorealistic). Add blink animation (random 2-6s interval). Apply jaw morph during speech even without full viseme data.

### AP-E4: Pop-In
**Symptom:** Citizen appearance changes abruptly -- capsule snaps to humanoid, mesh materializes.
**Detection:** HC-E3 metrics plus manual 5-minute walk-through. Target: zero pop-in events.
**Fix:** Verify crossfade active during transitions. Widen hysteresis bands. Start mesh preloading at 90% of tier boundary distance. Increase `maxTierChanges` from 3 to 5 if transitions queue.

### AP-E5: Class Color Bleeding
**Symptom:** Facchino in rich crimson. Nobili in undyed brown. Sumptuary law boundaries violated.
**Detection:** Verify each citizen's `colorPrimary` falls within `CLASS_PALETTES[socialClass]` HSL range (hue +/- 15deg, saturation +/- 0.15, lightness +/- 0.15).
**Fix:** Clamp `hashVariation()` to palette HSL bounding box. Nobili: S > 0.5, L < 0.5. Facchini: S < 0.4, L 0.3-0.6.

---

## DATA INTEGRITY

```
DI-E1: Airtable Class -> Mesh Mapping (daily)
  FOR each citizen: assert SocialClass valid, config exists,
  config.socialClass == Airtable.SocialClass, baseMeshId and clothingId in MeshLibrary.

DI-E2: Mesh Library Completeness (daily)
  FOR each referenced baseMeshId: geometry vertex count > 0,
  skeleton >= 20 bones, has "idle" and "walking" animations.

DI-E3: Clothing-Skeleton Compatibility (daily)
  FOR each clothingId: bone names are subset of corresponding base mesh skeleton.

DI-E4: Face Atlas Coverage (daily)
  Atlas is 4096x4096. Exactly 186 unique UV slots occupied.

DI-E5: Animation Clip Inventory (daily)
  Required clips: idle, walking, working, eating, socializing, resting,
  praying, talking, distressed. Assert all exist for each base mesh.

DI-E6: LOD Chain Integrity (on build)
  ACTIVE LOD triangle count is 20-35% of FULL for each base mesh.

DI-E7: Config Completeness (on build)
  FOR each citizen: heightScale in [0.9, 1.1], buildScale in [0.85, 1.15],
  walkSpeedMult in [0.85, 1.15], animPhaseOffset in [0.0, 1.0],
  colorPrimary != 0x000000, colorSecondary != 0x000000.
```
