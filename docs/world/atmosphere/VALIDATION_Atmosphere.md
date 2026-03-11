# VALIDATION: world/atmosphere — What Must Be True

Health checks, invariants, acceptance criteria, and data integrity rules for the atmosphere system. Every check is testable. Every threshold is a number.

---

## Invariants (must ALWAYS hold)

### AI1. Time Always Advances

- The world clock must advance every frame. `worldTime` at frame N+1 > `worldTime` at frame N. No stalled clock.
- The day/night cycle completes every 96 real minutes (1 hour in-world = 4 real minutes). Measured: 24 in-world hours elapsed in 96 +/- 2 real minutes.
- Time never moves backward. No mechanism exists to rewind the clock. Catch-up after absence fast-forwards at 10x, never rewinds.
- Sun position is a pure function of `worldTime`. Same `worldTime` always produces the same sun azimuth and elevation.

### AI2. Fog Never Blocks Completely

- Fog density never exceeds a maximum that renders all geometry invisible. At maximum fog (dawn, high tension, high stress combined), the visitor must see geometry within 15m.
- `FogExp2` density is capped at 0.045 (visibility floor ~22m at 1% opacity threshold). No code path may set density above this cap.
- Ground fog particle opacity is capped at 0.7. Particles never form an opaque wall.
- Fog gate during district transitions thickens fog for at most 3 seconds. After 3 seconds, fog returns to the target district's baseline.

### AI3. Mood Always Computed, Never Hardcoded

- `district.moodAggregate` is derived from citizen mood values on every Airtable sync cycle. No district mood is a constant or a default that persists beyond one sync cycle.
- If a district has zero citizens (all citizens moved elsewhere), its mood defaults to 0.5 (neutral), not 0.0 or 1.0.
- Citizen tier weighting is applied: FULL = 3x, ACTIVE = 1x, AMBIENT = 0.5x. No equal-weight averaging.
- Mood aggregate is always in range [0.0, 1.0]. Values outside this range are clamped before use.

### AI4. Biometric Data Is Never Visible to Others

- The client never receives raw biometric values (stress, heart rate, HRV). The client receives atmosphere parameters (fog density, light color, particle speed) that have already been computed server-side.
- No log file, network payload, or debug overlay on the client contains the visitor's stress level.
- If biometric integration is disabled (no Garmin link, no consent, or stale data), the atmosphere system produces identical output to having stress = 0. No error state, no fallback indicator.

### AI5. Smooth Transitions Only

- No atmosphere parameter changes instantaneously. All changes use lerp with a minimum transition time of 0.5 seconds.
- District mood drives atmosphere via a 60-second lerp toward target. No step function.
- Time-of-day parameters (sun color, fog density, sky uniforms) are continuous functions of `worldTime`. No lookup tables with < 12 entries (to avoid visible stepping).
- District boundary atmosphere crossfade takes 2 seconds minimum. No instant swap on boundary crossing.

### AI6. Atmosphere Weight Budget

- Time-of-day contributes 50% of atmosphere parameters.
- District mood contributes 30% of atmosphere parameters.
- Biometric stress contributes at most 20% of atmosphere parameters.
- These weights are constants. No code path allows biometric influence to exceed 20%.

---

## Health Checks (runtime monitoring)

### HC1. Frame Budget

| Operation | Budget | Alert threshold |
|---|---|---|
| Fog density lerp | 0.01ms | > 0.05ms |
| Light color lerp | 0.02ms | > 0.1ms |
| Particle update (500 particles) | 0.3ms | > 0.4ms |
| Sun position calculation | 0.02ms | > 0.05ms |
| Sky uniform update | 0.01ms | > 0.05ms |
| District mood blend | 0.05ms | > 0.1ms (only on zone change or every 60 frames) |
| Biometric tint lerp | 0.01ms | > 0.05ms |
| **Total atmosphere update** | **< 0.5ms** | **> 0.5ms triggers alert** |

Measure atmosphere update time every 60 frames. If average exceeds 0.5ms over a 5-second window, log the breakdown by operation.

### HC2. Particle Count

| Metric | Threshold | Action if exceeded |
|---|---|---|
| Active particles | <= 500 | Reduce spawn rate until count drops below 450 |
| Particles spawned per frame | <= 10 | Queue excess spawns for next frame |
| Particles recycled per frame | <= 10 | Amortize: if > 50 need recycling, spread over 5 frames |
| Particle buffer size (vertices) | < 32KB | Verify instanced Points geometry is not duplicated |

If particle count exceeds 500 for > 3 seconds, reduce the spawn radius from 30m to 20m until count stabilizes.

### HC3. Light Intensity

| Parameter | Minimum | Maximum | Notes |
|---|---|---|---|
| Directional light intensity | 0.05 (deep night) | 1.5 (noon) | Never zero (moonlight exists). Never > 1.5 (clipping). |
| Hemisphere light sky intensity | 0.02 | 0.8 | |
| Hemisphere light ground intensity | 0.01 | 0.3 | |
| Window emissive intensity | 0.0 (day) | 0.6 (night) | Must be 0.0 when sun elevation > 10 degrees. |
| Lantern point light intensity | 0.3 | 0.8 | Flicker range. Should not go below 0.3 (visible minimum). |
| Lantern point light range | 6m | 10m | Must illuminate at least the fondamenta width. |

Verify once per second that all light values are within their min/max range. Log if any value is out of bounds.

### HC4. Fog Density Range

| Condition | Fog density (FogExp2) | Visibility floor |
|---|---|---|
| Clear noon, neutral mood, no stress | 0.005-0.010 | > 200m |
| Dawn/dusk, neutral mood | 0.015-0.025 | ~60-80m |
| High tension district, dawn | 0.025-0.035 | ~40-55m |
| Maximum (dawn + max tension + max stress) | <= 0.045 | >= 22m |
| Fog gate (district transition, peak) | <= 0.050 for <= 3 seconds | >= 18m (temporary) |

Log fog density once per second. Alert if density exceeds 0.045 outside of a fog gate transition.

### HC5. Sky Continuity

- Sky uniforms (turbidity, rayleigh, mie coefficients) must change continuously. If any sky uniform is unchanged for > 5 seconds while `worldTime` is advancing, the sky update is stalled.
- Sun elevation must cross 0 (horizon) exactly twice per 96-minute cycle: once at dawn, once at dusk. If sun stays below horizon for > 52 real minutes (13 in-world hours) or above for > 68 real minutes (17 in-world hours), the sun model is misconfigured.
- Star opacity must be 0.0 when sun elevation > 5 degrees and > 0.5 when sun elevation < -10 degrees. Interpolation between these thresholds.

### HC6. Mood Aggregate Freshness

- `district.moodAggregate` must have been updated within the last 20 minutes (slightly longer than the 15-minute Airtable sync). If stale, log warning and use previous valid value.
- If mood aggregate has not updated for > 30 minutes, fall back to 0.5 (neutral) for all districts. Log error.
- Mood aggregate values should vary between districts. If all 7 districts have identical mood (tolerance: 0.01), this indicates the computation is returning a default, not real data.

---

## Acceptance Criteria (gate conditions per POC milestone)

### POC-1 Gate: Day/Night Works

- [ ] Sun moves across the sky over a 96-minute real-time cycle
- [ ] Directional light color shifts: orange at dawn, white at noon, amber at sunset, dim blue at night
- [ ] Shadows rotate with the sun. Long at dawn/dusk, short at noon.
- [ ] Stars appear at night and fade at dawn
- [ ] Window emissive glow activates at dusk and deactivates at dawn
- [ ] Standing still for 10 real minutes, the visitor perceives visible light change (testable: take screenshots at t=0 and t=10min, compare)

### POC-2 Gate: Fog and Mood

- [ ] Fog thickens at dawn and thins by noon, observable without instrumentation
- [ ] Ground fog particles drift along canals at dawn. Particles recycle correctly (no particle count growth)
- [ ] Walking between two districts with different mood aggregates produces visible atmosphere change (fog density, light tint)
- [ ] District mood transition takes ~2 seconds (not instant, not > 5 seconds)
- [ ] Fog gate triggers at district boundary: brief thickening, then clear to new district baseline
- [ ] Fog never makes navigation impossible. At maximum fog, geometry visible within 15m.
- [ ] Total atmosphere update < 0.5ms measured on Quest 3

### POC-3 Gate: Biometric Integration

- [ ] With Garmin stress at 0-25, no visible atmosphere change from biometric channel
- [ ] With Garmin stress at 76-100, subtle fog increase and light desaturation visible (A/B comparison)
- [ ] Biometric modulation blends with time-of-day and mood. Not a separate visual layer.
- [ ] With no Garmin data (opt-out or stale), atmosphere is identical to stress=0. No error indication.
- [ ] Client network payloads contain fog density and light color, NOT raw stress values
- [ ] Biometric contribution verifiably <= 20% of total atmosphere parameter range

### POC-4 Gate: Emotional Coherence

- [ ] 3 test users can distinguish "tense" from "calm" districts by atmosphere alone (no citizen interaction)
- [ ] Test users report the world "feels alive" and "changes over time" in post-session interview
- [ ] No test user reports sudden or jarring atmosphere changes
- [ ] A full day/night cycle (96 minutes) plays without visual artifacts: no light flicker, no fog jump, no sky seam
- [ ] Particle system runs for 60 minutes without count growth or performance degradation

---

## Anti-Patterns to Detect

### AP1. Stuck Weather

**Symptom:** Fog density, light color, or particle behavior does not change over a 10-minute observation period despite worldTime advancing.
**Detection:** Log atmosphere parameters every 60 seconds. If fog density, sun elevation, and light color are all unchanged (tolerance: 0.001) over 5 consecutive readings, the atmosphere update loop is broken.
**Fix:** Verify `update_atmosphere()` is called every frame. Check that `worldTime` input is not a constant. Check that lerp targets are being updated from district mood and time-of-day functions.

### AP2. Mood Desync from Citizens

**Symptom:** A district with mostly happy citizens (high Ducats, no debts, positive narratives) feels dark and oppressive. Or: a district in economic crisis feels bright and warm.
**Detection:** On each Airtable sync, compare `district.moodAggregate` against the raw citizen mood average. If the delta exceeds 0.2, the weighting or citizen-to-district assignment is wrong. Cross-reference: verify citizens are assigned to the district they are physically located in, not their home district.
**Fix:** Check `find_containing_district()` in mood computation. Verify FULL/ACTIVE/AMBIENT tier weights are applied. Verify mood values from Airtable are in [0.0, 1.0] range (not 0-100 or a string).

### AP3. Biometric Data Stale

**Symptom:** Atmosphere continues to show high-stress modulation hours after the visitor's stress returned to normal.
**Detection:** Check biometric data timestamp on every atmosphere update. If `last_garmin_sync > 30 minutes ago`, biometric modulation must be zeroed. Log if biometric influence is > 0 with stale data.
**Fix:** Verify staleness check compares against current time, not session start time. Verify the zero-out path sets stress influence to 0.0, not just stops updating (difference: the latter leaves the last value in place).

### AP4. Fog Oscillation

**Symptom:** Fog density flickers rapidly. Visible as "breathing" or "pulsing" fog.
**Detection:** Log fog density at 10Hz. If density changes direction (increasing -> decreasing or vice versa) more than 4 times per second, the lerp targets are oscillating.
**Fix:** Likely cause: two systems fighting over fog density (e.g., time-of-day target and mood target alternating as the primary driver). Fix: combine all fog inputs into a single target before lerping. Do not lerp toward multiple targets in sequence within the same frame.

### AP5. Night Without Lights

**Symptom:** The world goes nearly black at night. Lanterns, window emissives, and moonlight are missing or too dim.
**Detection:** At night (sun elevation < -5 degrees), verify: lantern point light intensity >= 0.3, window emissive intensity >= 0.2, hemisphere light sky intensity >= 0.02 (moonlight). If any condition fails, the night lighting is broken.
**Fix:** Check night light activation is tied to sun elevation, not worldTime hour (which could drift from sun position). Verify lantern flicker function has a floor (0.3, not 0.0). Verify window emissive material `emissiveIntensity` is set, not just `emissive` color.

### AP6. Particle Performance Spiral

**Symptom:** Frame rate drops correlated with particle count growing unboundedly.
**Detection:** Monitor particle count every second. If count > 500 and increasing for > 5 seconds, the recycle system is failing.
**Fix:** Verify particles are recycled when they exit the 30m spawn radius. Verify the per-frame recycle cap (10) is not preventing cleanup when the visitor moves quickly. Increase recycle cap to 20 during movement, or teleport all particles when visitor teleports.

### AP7. Sunrise Strobe

**Symptom:** Rapid light color changes at dawn/dusk. Visible as flickering between orange and blue.
**Detection:** Sample directional light color at 10Hz during sunrise (sun elevation 0-10 degrees). If hue changes by > 30 degrees between consecutive samples, the color interpolation has discontinuities.
**Fix:** Check color interpolation method. RGB lerp between orange and white passes through grey (desaturated). Use HSL lerp or a color ramp texture to ensure smooth hue transition through the sunrise spectrum.

---

## Data Integrity Checks

### Source Data (Server -> Client Atmosphere Parameters)

```
ON EVERY ATMOSPHERE SYNC (received from server):
  - Assert: moodAggregate is present for all 7 districts
  - Assert: each moodAggregate is in [0.0, 1.0]
  - Assert: worldTime is a valid number > 0 and > previous worldTime
  - Assert: if biometric data present, stress is in [0, 100] (integer)
  - Assert: no raw biometric fields (heart_rate, hrv, sleep) present in client payload
  - Warn: if all moodAggregate values are identical (likely default/error)
  - Warn: if worldTime delta from last sync > 30 minutes (long gap, catch-up needed)
```

### Atmosphere Parameter Ranges

```
ON EVERY FRAME (spot-check every 60 frames):
  - Assert: fog.density in [0.001, 0.050]
  - Assert: directionalLight.intensity in [0.05, 1.5]
  - Assert: directionalLight.color components each in [0.0, 1.0]
  - Assert: hemisphereLight.intensity in [0.01, 0.8]
  - Assert: sun.elevation in [-90, 90] degrees
  - Assert: sun.azimuth in [0, 360] degrees
  - Assert: particle_count in [0, 500]
  - Assert: star.opacity in [0.0, 1.0]
  - Log anomaly if any parameter is at its min or max for > 5 minutes
```

### Cross-System Consistency

```
ON AIRTABLE SYNC (every 15 minutes):
  - Verify: district mood aggregate changed for at least 1 district (world is alive)
  - Verify: citizen count per district > 0 for at least 5 of 7 districts
  - Verify: total citizens contributing to mood > 50 (enough signal)
  - Verify: FULL-tier citizen count > 0 in at least 3 districts (weighting meaningful)
  - Verify: biometric data timestamp < 30 minutes ago (or biometric influence is 0.0)

AFTER 96-MINUTE CYCLE COMPLETES:
  - Verify: sun completed full arc (elevation crossed 0 twice)
  - Verify: window emissives activated and deactivated at least once
  - Verify: star opacity reached > 0.8 at least once (night occurred)
  - Verify: fog density peaked at dawn and minimum near noon
```
