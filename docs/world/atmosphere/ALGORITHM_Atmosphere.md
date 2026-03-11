# ALGORITHM: world/atmosphere -- How It Works

Pseudocode for every atmosphere subsystem. No code -- procedural descriptions with data flows.

---

## A1. World Clock (Accelerated Day/Night Cycle)

The world runs on a 96-minute real-time cycle. One in-world hour equals 4 real minutes. Every atmosphere parameter derives from the current in-world time.

```
CONSTANTS:
  CYCLE_DURATION_MS    = 96 * 60 * 1000     # 5,760,000 ms = 96 real minutes
  HOURS_PER_CYCLE      = 24                  # one full in-world day
  MS_PER_INGAME_HOUR   = CYCLE_DURATION_MS / HOURS_PER_CYCLE   # 240,000 ms = 4 real minutes
  MS_PER_INGAME_MINUTE = MS_PER_INGAME_HOUR / 60               # 4,000 ms
  CATCHUP_RATE         = 10.0                # fast-forward multiplier on reconnect
  CATCHUP_MAX_DURATION = 5000                # max real ms spent catching up

STATE:
  cycle_start_ms: float      # real timestamp when the current cycle epoch began
  current_hour: float        # 0.0 - 23.999, fractional in-world hour
  time_phase: enum           # NIGHT, DAWN, MORNING, AFTERNOON, EVENING, DUSK

FUNCTION update_world_clock(real_time_ms):
  elapsed = real_time_ms - cycle_start_ms
  raw_hour = (elapsed / MS_PER_INGAME_HOUR) MOD 24.0
  current_hour = raw_hour
  time_phase = classify_phase(current_hour)
  RETURN current_hour

FUNCTION classify_phase(hour):
  IF hour >= 0.0  AND hour < 5.0:   RETURN NIGHT
  IF hour >= 5.0  AND hour < 7.0:   RETURN DAWN
  IF hour >= 7.0  AND hour < 12.0:  RETURN MORNING
  IF hour >= 12.0 AND hour < 17.0:  RETURN AFTERNOON
  IF hour >= 17.0 AND hour < 20.0:  RETURN EVENING
  IF hour >= 20.0 AND hour < 21.5:  RETURN DUSK
  RETURN NIGHT   # 21.5 - 24.0

FUNCTION catchup_clock(last_session_end_ms, real_time_ms):
  # Called on reconnect. Fast-forwards the clock to sync.
  target_hour = ((real_time_ms - cycle_start_ms) / MS_PER_INGAME_HOUR) MOD 24.0
  delta_hours = (target_hour - current_hour + 24.0) MOD 24.0

  IF delta_hours < 0.05:
    RETURN   # less than 3 in-world minutes -- no catchup needed

  # Animate at CATCHUP_RATE until synced or budget exhausted
  catchup_elapsed = 0
  WHILE abs(current_hour - target_hour) > 0.02 AND catchup_elapsed < CATCHUP_MAX_DURATION:
    step = delta_time * CATCHUP_RATE
    current_hour = (current_hour + step / MS_PER_INGAME_HOUR) MOD 24.0
    apply_atmosphere_for_hour(current_hour)
    catchup_elapsed += delta_time

  current_hour = target_hour
```

---

## A2. Sun Position and Directional Light

Sun position drives shadow direction, color temperature, and hemisphere balance.

```
CONSTANTS:
  SUNRISE_HOUR  = 5.5       # sun crosses horizon
  SUNSET_HOUR   = 20.0
  NOON_HOUR     = 12.5      # solar apex (slightly after 12 -- Venice is east of timezone center)
  MAX_ELEVATION = 68.0      # degrees -- late spring Venice latitude
  NORTH_AZIMUTH = 0.0       # radians -- sun rises east (PI/2), sets west (3*PI/2)

STRUCT SunState:
  elevation: float           # degrees above horizon, negative = below
  azimuth: float             # radians, 0 = north, PI/2 = east
  direction: vec3            # unit vector pointing FROM sun TO world
  color: Color               # directional light color
  intensity: float           # directional light strength

FUNCTION compute_sun_position(hour):
  IF hour < SUNRISE_HOUR OR hour > SUNSET_HOUR:
    # Sun is below horizon
    t = 0.0
    elevation = -10.0   # below horizon
  ELSE:
    # Normalized progress through daylight: 0 at sunrise, 1 at sunset
    day_progress = (hour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR)
    # Elevation: parabolic arc peaking at solar noon
    elevation = MAX_ELEVATION * sin(day_progress * PI)

  # Azimuth: linear sweep from east (sunrise) to west (sunset)
  day_progress = clamp((hour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR), 0, 1)
  azimuth = lerp(PI * 0.3, PI * 1.7, day_progress)   # east-ish to west-ish

  # Convert spherical to cartesian direction (pointing from sun toward origin)
  elev_rad = radians(elevation)
  direction.x = cos(elev_rad) * sin(azimuth)
  direction.y = -sin(elev_rad)                        # negative = pointing down
  direction.z = cos(elev_rad) * cos(azimuth)
  direction = normalize(direction)

  RETURN SunState { elevation, azimuth, direction, color: NULL, intensity: 0 }


FUNCTION compute_sun_color(sun):
  # Color temperature shifts through the day.
  # Low elevation = warm (orange/red). High elevation = cool (white-blue).
  IF sun.elevation < 0:
    RETURN { color: Color(0.05, 0.03, 0.08), intensity: 0.0 }   # moonlight tint, no sun

  # Normalized elevation: 0 at horizon, 1 at apex
  elev_norm = sun.elevation / MAX_ELEVATION

  # Color ramp: warm orange -> neutral white -> slight blue-white -> neutral -> warm orange
  IF elev_norm < 0.15:
    # Sunrise/sunset: deep orange
    color = Color.lerp(Color(1.0, 0.35, 0.05), Color(1.0, 0.6, 0.3), elev_norm / 0.15)
    intensity = lerp(0.2, 0.5, elev_norm / 0.15)
  ELSE IF elev_norm < 0.4:
    # Morning/evening golden hour
    t = (elev_norm - 0.15) / 0.25
    color = Color.lerp(Color(1.0, 0.6, 0.3), Color(1.0, 0.9, 0.8), t)
    intensity = lerp(0.5, 0.85, t)
  ELSE:
    # Midday: white with very slight warm bias
    t = (elev_norm - 0.4) / 0.6
    color = Color.lerp(Color(1.0, 0.9, 0.8), Color(1.0, 0.97, 0.95), t)
    intensity = lerp(0.85, 1.0, t)

  RETURN { color, intensity }
```

---

## A3. Hemisphere Light and Sky Color

Hemisphere light provides ambient fill. Sky color (upper hemisphere) and ground color (lower hemisphere) shift with time.

```
STRUCT HemisphereState:
  sky_color: Color
  ground_color: Color
  intensity: float

TIME_PHASE_HEMISPHERE = {
  NIGHT:     { sky: Color(0.02, 0.02, 0.06), ground: Color(0.01, 0.01, 0.02), intensity: 0.15 },
  DAWN:      { sky: Color(0.30, 0.20, 0.15), ground: Color(0.08, 0.06, 0.04), intensity: 0.35 },
  MORNING:   { sky: Color(0.55, 0.70, 0.85), ground: Color(0.25, 0.20, 0.15), intensity: 0.55 },
  AFTERNOON: { sky: Color(0.50, 0.65, 0.82), ground: Color(0.30, 0.25, 0.18), intensity: 0.60 },
  EVENING:   { sky: Color(0.60, 0.40, 0.20), ground: Color(0.20, 0.14, 0.08), intensity: 0.45 },
  DUSK:      { sky: Color(0.15, 0.10, 0.20), ground: Color(0.05, 0.04, 0.06), intensity: 0.25 },
}

FUNCTION compute_hemisphere(hour, time_phase):
  current = TIME_PHASE_HEMISPHERE[time_phase]

  # Determine the next phase for smooth interpolation
  next_phase = get_next_phase(time_phase)
  next = TIME_PHASE_HEMISPHERE[next_phase]

  # Fractional progress within current phase
  phase_start = get_phase_start_hour(time_phase)
  phase_end = get_phase_start_hour(next_phase)
  t = (hour - phase_start) / (phase_end - phase_start)
  t = smoothstep(0, 1, clamp(t, 0, 1))

  RETURN HemisphereState {
    sky_color:    Color.lerp(current.sky, next.sky, t),
    ground_color: Color.lerp(current.ground, next.ground, t),
    intensity:    lerp(current.intensity, next.intensity, t),
  }
```

---

## A4. Shadow System

Shadow length and softness are driven by sun elevation.

```
CONSTANTS:
  SHADOW_MAP_SIZE    = 2048       # pixels, balanced for Quest 3
  SHADOW_CAMERA_SIZE = 80         # world units -- covers visitor neighborhood
  SHADOW_BIAS        = -0.0005
  SHADOW_NORMAL_BIAS = 0.02

FUNCTION update_shadows(sun_state):
  IF sun_state.elevation <= 0:
    # Night: disable directional shadow, rely on point lights (lanterns)
    directional_light.castShadow = FALSE
    RETURN

  directional_light.castShadow = TRUE
  directional_light.position = visitor_position - sun_state.direction * 100
  directional_light.target.position = visitor_position

  # Shadow softness: proportional to 1/elevation.
  # Low sun = long soft shadows. High sun = short hard shadows.
  elev_norm = sun_state.elevation / MAX_ELEVATION
  directional_light.shadow.radius = lerp(4.0, 1.0, elev_norm)

  # Shadow camera follows visitor
  cam = directional_light.shadow.camera
  cam.left   = -SHADOW_CAMERA_SIZE / 2
  cam.right  =  SHADOW_CAMERA_SIZE / 2
  cam.top    =  SHADOW_CAMERA_SIZE / 2
  cam.bottom = -SHADOW_CAMERA_SIZE / 2
  cam.updateProjectionMatrix()
```

---

## A5. Star Visibility

Stars fade in at dusk and out at dawn. Opacity tracks sun elevation through the horizon band.

```
CONSTANTS:
  STAR_FADE_START_ELEV = 5.0     # degrees -- stars begin fading in as sun passes below this
  STAR_FADE_END_ELEV   = -8.0    # degrees -- full star visibility
  STAR_MAX_OPACITY     = 0.85    # not 1.0 -- Venetian light pollution from lanterns

FUNCTION update_stars(sun_state):
  IF sun_state.elevation > STAR_FADE_START_ELEV:
    star_layer.opacity = 0.0
    RETURN

  IF sun_state.elevation < STAR_FADE_END_ELEV:
    star_layer.opacity = STAR_MAX_OPACITY
    RETURN

  # Fade zone: linear interpolation
  t = (STAR_FADE_START_ELEV - sun_state.elevation) / (STAR_FADE_START_ELEV - STAR_FADE_END_ELEV)
  star_layer.opacity = lerp(0.0, STAR_MAX_OPACITY, t)
```

---

## A6. Window Glow

Building windows become emissive at night. Glow ramps up at dusk, full at night, ramps down at dawn.

```
CONSTANTS:
  GLOW_START_HOUR = 18.5      # begin ramping on
  GLOW_FULL_HOUR  = 20.5      # full brightness
  GLOW_END_HOUR   = 6.5       # begin ramping off
  GLOW_OFF_HOUR   = 7.5       # fully off
  GLOW_COLOR      = Color(1.0, 0.75, 0.4)    # warm interior candlelight
  GLOW_MAX_EMISSIVE = 0.6

FUNCTION compute_window_glow(hour):
  IF hour >= GLOW_FULL_HOUR OR hour < GLOW_END_HOUR:
    RETURN GLOW_MAX_EMISSIVE
  IF hour >= GLOW_START_HOUR AND hour < GLOW_FULL_HOUR:
    t = (hour - GLOW_START_HOUR) / (GLOW_FULL_HOUR - GLOW_START_HOUR)
    RETURN lerp(0.0, GLOW_MAX_EMISSIVE, smoothstep(0, 1, t))
  IF hour >= GLOW_END_HOUR AND hour < GLOW_OFF_HOUR:
    t = (hour - GLOW_END_HOUR) / (GLOW_OFF_HOUR - GLOW_END_HOUR)
    RETURN lerp(GLOW_MAX_EMISSIVE, 0.0, smoothstep(0, 1, t))
  RETURN 0.0

FUNCTION apply_window_glow(buildings, glow_intensity):
  IF glow_intensity <= 0.001:
    # Disable emissive on all windows -- skip per-building work
    IF window_glow_active:
      FOR each building IN buildings WHERE building.current_lod <= 1:
        building.window_material.emissiveIntensity = 0.0
      window_glow_active = FALSE
    RETURN

  window_glow_active = TRUE
  FOR each building IN buildings WHERE building.current_lod <= 1:
    # Per-building variation: some windows dark (inhabitants asleep / away)
    per_building_factor = 0.5 + 0.5 * fract(sin(building.seed * 43758.5453))
    building.window_material.emissive = GLOW_COLOR
    building.window_material.emissiveIntensity = glow_intensity * per_building_factor
```

---

## A7. Fog System (Three Layers)

Fog has three independent layers that combine to produce Venice's characteristic atmospheric depth.

### A7.1 Data Structures

```
STRUCT FogState:
  ground_density: float        # 0.0 - 1.0, particle system opacity/count
  ground_color: Color
  atmospheric_density: float   # FogExp2 density parameter
  atmospheric_color: Color
  haze_opacity: float          # cloud layer opacity, 0.0 - 1.0
  haze_softness: float         # shadow softness multiplier from haze

STRUCT FogInputs:
  hour: float                  # from world clock
  time_phase: enum
  district_mood: float         # 0.0 - 1.0, from mood computation
  district_tension: float      # 0.0 - 1.0, from Blood Ledger
  biometric_stress: float      # 0 - 100, from Garmin (or -1 if unavailable)
  district_id: string          # for per-district fog tint
```

### A7.2 Time-Driven Base Fog

```
TIME_FOG_TABLE = {
  # hour_start, hour_end, ground_density, atmospheric_density, haze_opacity
  NIGHT:     { ground: 0.35, atmo: 0.025, haze: 0.30 },
  DAWN:      { ground: 0.80, atmo: 0.045, haze: 0.50 },   # thickest
  MORNING:   { ground: 0.15, atmo: 0.012, haze: 0.20 },   # burns off
  AFTERNOON: { ground: 0.05, atmo: 0.008, haze: 0.10 },   # clearest
  EVENING:   { ground: 0.40, atmo: 0.030, haze: 0.35 },   # returns
  DUSK:      { ground: 0.55, atmo: 0.038, haze: 0.45 },
}

FUNCTION compute_base_fog(hour, time_phase):
  current = TIME_FOG_TABLE[time_phase]
  next_phase = get_next_phase(time_phase)
  next = TIME_FOG_TABLE[next_phase]

  phase_start = get_phase_start_hour(time_phase)
  phase_end = get_phase_start_hour(next_phase)
  t = smoothstep(0, 1, (hour - phase_start) / (phase_end - phase_start))

  RETURN {
    ground:  lerp(current.ground, next.ground, t),
    atmo:    lerp(current.atmo, next.atmo, t),
    haze:    lerp(current.haze, next.haze, t),
  }
```

### A7.3 Fog Color (Time-Driven, Not White)

```
FOG_COLOR_TABLE = {
  NIGHT:     Color(0.04, 0.04, 0.10),    # deep blue
  DAWN:      Color(0.70, 0.50, 0.25),    # golden
  MORNING:   Color(0.65, 0.70, 0.75),    # blue-grey
  AFTERNOON: Color(0.75, 0.75, 0.72),    # neutral warm
  EVENING:   Color(0.80, 0.55, 0.20),    # amber
  DUSK:      Color(0.25, 0.15, 0.20),    # purple-grey
}

FUNCTION compute_fog_color(hour, time_phase, district_id):
  # Base color from time
  current_color = FOG_COLOR_TABLE[time_phase]
  next_color = FOG_COLOR_TABLE[get_next_phase(time_phase)]
  t = get_phase_progress(hour, time_phase)
  base_color = Color.lerp(current_color, next_color, smoothstep(0, 1, t))

  # Per-district tint (from DISTRICT_DEFINITIONS in world/districts)
  district_tint = get_district_fog_tint(district_id)
  # Blend: 80% time-driven, 20% district tint
  final_color = Color.lerp(base_color, district_tint, 0.20)

  RETURN final_color
```

### A7.4 Narrative Tension Fog Modifier

```
CONSTANTS:
  TENSION_FOG_GROUND_ADD  = 0.30    # max additional ground density from tension
  TENSION_FOG_ATMO_ADD    = 0.020   # max additional atmospheric density
  TENSION_FOG_HAZE_ADD    = 0.15

FUNCTION apply_tension_fog(base_fog, district_tension):
  # district_tension: 0.0 = calm, 1.0 = crisis
  # Quadratic curve: effect is negligible below 0.3, strong above 0.6
  tension_factor = district_tension * district_tension

  ground = base_fog.ground + TENSION_FOG_GROUND_ADD * tension_factor
  atmo   = base_fog.atmo   + TENSION_FOG_ATMO_ADD   * tension_factor
  haze   = base_fog.haze   + TENSION_FOG_HAZE_ADD   * tension_factor

  RETURN { ground: min(ground, 1.0), atmo: min(atmo, 0.08), haze: min(haze, 0.9) }
```

### A7.5 Ground Fog Particle System

```
CONSTANTS:
  GROUND_FOG_MAX_PARTICLES = 200       # within particle budget
  GROUND_FOG_RADIUS        = 30.0      # meters around visitor
  GROUND_FOG_Y_MIN         = -0.2      # slightly below fondamenta (in canals)
  GROUND_FOG_Y_MAX         = 2.0       # knee-to-waist height
  GROUND_FOG_DRIFT_SPEED   = 0.3       # m/s horizontal drift
  GROUND_FOG_PARTICLE_SIZE = 4.0       # world units (billboard quads)

STRUCT GroundFogParticle:
  position: vec3
  velocity: vec3
  opacity: float
  size: float
  life: float                # seconds remaining
  max_life: float

FUNCTION spawn_ground_fog_particle(visitor_pos, fog_color, rng):
  # Spawn within radius, biased toward canals (lower Y)
  angle = rng() * TWO_PI
  radius = rng() * GROUND_FOG_RADIUS
  x = visitor_pos.x + cos(angle) * radius
  z = visitor_pos.z + sin(angle) * radius
  y = GROUND_FOG_Y_MIN + rng() * (GROUND_FOG_Y_MAX - GROUND_FOG_Y_MIN)

  # Bias toward lower Y (more fog in canals)
  y = y * (0.3 + 0.7 * rng())

  # Slow horizontal drift, slight upward tendency
  vx = (rng() - 0.5) * GROUND_FOG_DRIFT_SPEED
  vz = (rng() - 0.5) * GROUND_FOG_DRIFT_SPEED
  vy = rng() * 0.05     # very slight upward drift

  max_life = 8.0 + rng() * 12.0    # 8-20 seconds

  RETURN GroundFogParticle {
    position: vec3(x, y, z),
    velocity: vec3(vx, vy, vz),
    opacity: 0.0,               # fade in from zero
    size: GROUND_FOG_PARTICLE_SIZE * (0.7 + rng() * 0.6),
    life: max_life,
    max_life: max_life,
  }

FUNCTION update_ground_fog(particles, visitor_pos, ground_density, fog_color, delta_time):
  active_target = floor(GROUND_FOG_MAX_PARTICLES * ground_density)
  active_count = count(p for p in particles where p.life > 0)

  # Spawn new particles to reach target (max 10 per frame to amortize)
  spawned = 0
  WHILE active_count < active_target AND spawned < 10:
    p = spawn_ground_fog_particle(visitor_pos, fog_color, rng)
    particles.PUSH(p)
    active_count += 1
    spawned += 1

  # Update existing particles
  FOR each p IN particles:
    IF p.life <= 0:
      CONTINUE

    p.life -= delta_time
    p.position += p.velocity * delta_time

    # Fade in over first 2 seconds, fade out over last 2 seconds
    IF p.life > p.max_life - 2.0:
      p.opacity = (p.max_life - p.life) / 2.0
    ELSE IF p.life < 2.0:
      p.opacity = p.life / 2.0
    ELSE:
      p.opacity = 1.0

    # Scale opacity by ground_density
    p.opacity *= ground_density

    # Recycle if outside visitor radius
    dist = distance_xz(p.position, visitor_pos)
    IF dist > GROUND_FOG_RADIUS * 1.2:
      p.life = 0   # mark for recycling
```

### A7.6 Atmospheric Fog (Scene-Wide)

```
FUNCTION update_atmospheric_fog(scene_fog, target_density, target_color, delta_time):
  # scene_fog is THREE.FogExp2 attached to the scene
  LERP_SPEED = 2.0   # per second -- smooth, not instant

  scene_fog.density = lerp(scene_fog.density, target_density, 1 - exp(-LERP_SPEED * delta_time))
  scene_fog.color   = Color.lerp(scene_fog.color, target_color, 1 - exp(-LERP_SPEED * delta_time))
```

### A7.7 High Haze (Cloud Layer Opacity)

```
FUNCTION update_haze(cloud_layer, target_opacity, sun_state, delta_time):
  LERP_SPEED = 1.5

  cloud_layer.material.opacity = lerp(
    cloud_layer.material.opacity,
    target_opacity,
    1 - exp(-LERP_SPEED * delta_time)
  )

  # Haze softens shadows: multiply shadow radius by haze factor
  haze_shadow_factor = 1.0 + cloud_layer.material.opacity * 3.0
  directional_light.shadow.radius *= haze_shadow_factor
```

---

## A8. Weather State Machine

V1 has fog-only weather. The state machine controls fog intensity patterns over longer time scales.

```
ENUM WeatherState:
  CLEAR           # minimal fog, high visibility
  LIGHT_FOG       # moderate atmospheric fog, no ground fog
  HEAVY_FOG       # thick atmospheric + ground fog
  OVERCAST_HAZE   # high haze, diffuse light, moderate atmospheric fog

STRUCT WeatherTransition:
  from_state: WeatherState
  to_state: WeatherState
  duration_ingame_hours: float
  progress: float              # 0.0 - 1.0

WEATHER_MODIFIERS = {
  CLEAR:          { ground_mult: 0.3,  atmo_mult: 0.5,  haze_mult: 0.3 },
  LIGHT_FOG:      { ground_mult: 0.6,  atmo_mult: 1.0,  haze_mult: 0.6 },
  HEAVY_FOG:      { ground_mult: 1.0,  atmo_mult: 1.0,  haze_mult: 0.8 },
  OVERCAST_HAZE:  { ground_mult: 0.5,  atmo_mult: 0.7,  haze_mult: 1.0 },
}

# Allowed transitions and their relative probabilities
TRANSITION_TABLE = {
  CLEAR:         { LIGHT_FOG: 0.5, OVERCAST_HAZE: 0.3, CLEAR: 0.2 },
  LIGHT_FOG:     { HEAVY_FOG: 0.3, CLEAR: 0.4, OVERCAST_HAZE: 0.2, LIGHT_FOG: 0.1 },
  HEAVY_FOG:     { LIGHT_FOG: 0.5, OVERCAST_HAZE: 0.3, HEAVY_FOG: 0.2 },
  OVERCAST_HAZE: { CLEAR: 0.3, LIGHT_FOG: 0.4, OVERCAST_HAZE: 0.3 },
}

# Duration range per transition (in-game hours)
TRANSITION_DURATION = {
  CLEAR -> LIGHT_FOG:       { min: 1.0, max: 3.0 },
  CLEAR -> OVERCAST_HAZE:   { min: 2.0, max: 4.0 },
  LIGHT_FOG -> HEAVY_FOG:   { min: 1.5, max: 3.5 },
  LIGHT_FOG -> CLEAR:       { min: 1.0, max: 2.5 },
  HEAVY_FOG -> LIGHT_FOG:   { min: 2.0, max: 5.0 },
  OVERCAST_HAZE -> CLEAR:   { min: 1.5, max: 3.0 },
  # ... remaining pairs similarly defined
}

STATE:
  current_weather: WeatherState = LIGHT_FOG
  active_transition: WeatherTransition = NULL
  weather_hold_remaining: float = 0   # in-game hours to stay in current state before next roll
  weather_rng: SeededRandom

FUNCTION update_weather_state(delta_ingame_hours):
  IF active_transition != NULL:
    active_transition.progress += delta_ingame_hours / active_transition.duration_ingame_hours
    IF active_transition.progress >= 1.0:
      current_weather = active_transition.to_state
      active_transition = NULL
      weather_hold_remaining = 1.0 + weather_rng() * 3.0   # hold 1-4 in-game hours
    RETURN

  # No active transition -- decrement hold timer
  weather_hold_remaining -= delta_ingame_hours
  IF weather_hold_remaining > 0:
    RETURN

  # Roll for next weather state
  next_state = weighted_pick(TRANSITION_TABLE[current_weather], weather_rng)
  IF next_state == current_weather:
    # Stay in current state, re-roll after another hold
    weather_hold_remaining = 0.5 + weather_rng() * 2.0
    RETURN

  key = (current_weather, next_state)
  duration = lerp(TRANSITION_DURATION[key].min, TRANSITION_DURATION[key].max, weather_rng())
  active_transition = WeatherTransition {
    from_state: current_weather,
    to_state: next_state,
    duration_ingame_hours: duration,
    progress: 0.0,
  }

FUNCTION get_weather_fog_modifier():
  IF active_transition == NULL:
    RETURN WEATHER_MODIFIERS[current_weather]

  from_mod = WEATHER_MODIFIERS[active_transition.from_state]
  to_mod   = WEATHER_MODIFIERS[active_transition.to_state]
  t = smoothstep(0, 1, active_transition.progress)

  RETURN {
    ground_mult: lerp(from_mod.ground_mult, to_mod.ground_mult, t),
    atmo_mult:   lerp(from_mod.atmo_mult, to_mod.atmo_mult, t),
    haze_mult:   lerp(from_mod.haze_mult, to_mod.haze_mult, t),
  }
```

---

## A9. District Mood Computation

Aggregate citizen mood per district drives atmosphere parameters.

```
CONSTANTS:
  MOOD_SYNC_INTERVAL = 15 * 60   # 15 real minutes (matches Airtable sync)
  MOOD_LERP_DURATION = 60.0      # real seconds to lerp atmosphere toward new mood target
  TIER_WEIGHTS = {
    FULL: 3.0,
    ACTIVE: 1.0,
    AMBIENT: 0.5,
  }

STRUCT DistrictMood:
  district_id: string
  mood_aggregate: float          # 0.0 (despair) to 1.0 (euphoria)
  mood_target: float             # latest computed target
  lerp_progress: float           # 0.0 to 1.0, current interpolation state

STATE:
  district_moods: Map<string, DistrictMood>

FUNCTION compute_mood_aggregate(district_id, citizens):
  relevant = filter(citizens, c => c.district == district_id)
  IF len(relevant) == 0:
    RETURN 0.5   # neutral default

  weighted_sum = 0.0
  total_weight = 0.0
  FOR each citizen IN relevant:
    weight = TIER_WEIGHTS[citizen.tier]
    weighted_sum += citizen.mood * weight
    total_weight += weight

  RETURN clamp(weighted_sum / total_weight, 0.0, 1.0)

FUNCTION update_district_moods(districts, citizens, delta_time):
  FOR each district IN districts:
    dm = district_moods[district.id]

    # Periodically recompute target (driven by sync cycle, not per-frame)
    # Target is set externally by sync handler:
    #   dm.mood_target = compute_mood_aggregate(district.id, citizens)
    #   dm.lerp_progress = 0.0

    IF dm.lerp_progress < 1.0:
      dm.lerp_progress = min(dm.lerp_progress + delta_time / MOOD_LERP_DURATION, 1.0)
      t = smoothstep(0, 1, dm.lerp_progress)
      dm.mood_aggregate = lerp(dm.mood_aggregate, dm.mood_target, t)


FUNCTION mood_to_atmosphere_params(mood):
  # Returns multipliers/offsets applied on top of time-driven base.
  # mood: 0.0 (despair) - 1.0 (euphoria)

  IF mood < 0.25:
    # Despair: fog thickens, light desaturates, particles slow
    fog_mult       = lerp(1.6, 1.3, mood / 0.25)
    saturation     = lerp(0.4, 0.7, mood / 0.25)
    particle_speed = lerp(0.3, 0.6, mood / 0.25)
    particle_count = lerp(0.5, 0.7, mood / 0.25)
    light_warmth   = lerp(-0.15, -0.05, mood / 0.25)   # cool shift
    lantern_flicker = lerp(0.4, 0.15, mood / 0.25)     # more flicker in despair
  ELSE IF mood < 0.50:
    t = (mood - 0.25) / 0.25
    fog_mult       = lerp(1.3, 1.0, t)
    saturation     = lerp(0.7, 0.9, t)
    particle_speed = lerp(0.6, 0.8, t)
    particle_count = lerp(0.7, 0.9, t)
    light_warmth   = lerp(-0.05, 0.0, t)
    lantern_flicker = lerp(0.15, 0.05, t)
  ELSE IF mood < 0.75:
    t = (mood - 0.50) / 0.25
    fog_mult       = lerp(1.0, 0.85, t)
    saturation     = lerp(0.9, 1.0, t)
    particle_speed = lerp(0.8, 1.0, t)
    particle_count = lerp(0.9, 1.0, t)
    light_warmth   = lerp(0.0, 0.05, t)
    lantern_flicker = lerp(0.05, 0.02, t)
  ELSE:
    t = (mood - 0.75) / 0.25
    fog_mult       = lerp(0.85, 0.6, t)
    saturation     = lerp(1.0, 1.15, t)         # slight oversaturation
    particle_speed = lerp(1.0, 1.2, t)
    particle_count = lerp(1.0, 1.5, t)          # more particles in euphoria
    light_warmth   = lerp(0.05, 0.12, t)        # warm golden shift
    lantern_flicker = lerp(0.02, 0.0, t)

  RETURN {
    fog_mult, saturation, particle_speed,
    particle_count, light_warmth, lantern_flicker,
  }
```

---

## A10. Biometric Integration (Garmin Stress)

Garmin stress data provides a subtle modulation layer. Capped at 20% influence weight.

```
CONSTANTS:
  BIOMETRIC_WEIGHT     = 0.20    # max contribution to final atmosphere
  BIOMETRIC_STALE_MS   = 30 * 60 * 1000   # 30 minutes
  BIOMETRIC_LERP_SPEED = 0.5     # per second -- very slow transition

STRUCT BiometricState:
  stress: float          # 0-100, raw from Garmin. -1 if unavailable.
  stress_normalized: float   # 0.0-1.0, smoothed
  last_update_ms: float
  enabled: bool          # user opt-in

FUNCTION update_biometric(raw_stress, timestamp_ms, current_time_ms):
  IF NOT biometric.enabled:
    biometric.stress = -1
    biometric.stress_normalized = 0.0
    RETURN

  IF (current_time_ms - timestamp_ms) > BIOMETRIC_STALE_MS:
    # Data too old -- disable modulation
    biometric.stress = -1
    biometric.stress_normalized = lerp(biometric.stress_normalized, 0.0, 0.01)
    RETURN

  biometric.stress = raw_stress
  biometric.last_update_ms = timestamp_ms
  target = clamp(raw_stress / 100.0, 0.0, 1.0)
  biometric.stress_normalized = lerp(
    biometric.stress_normalized,
    target,
    1 - exp(-BIOMETRIC_LERP_SPEED * delta_time)
  )

FUNCTION biometric_to_atmosphere(stress_norm):
  # stress_norm: 0.0 (rest) - 1.0 (extreme stress)
  # Returns modifiers. All are zero at stress < 0.25.
  IF stress_norm < 0.25:
    RETURN { fog_add: 0, color_shift: 0, particle_slow: 0, vignette: 0 }

  # Active range: 0.25 - 1.0, mapped to 0.0 - 1.0 effect intensity
  t = (stress_norm - 0.25) / 0.75

  RETURN {
    fog_add:        lerp(0.0, 0.20, t),         # +20% fog density at max stress
    color_shift:    lerp(0.0, -0.10, t),         # desaturation toward cool blue
    particle_slow:  lerp(0.0, 0.15, t),          # -15% particle speed
    vignette:       lerp(0.0, 0.12, t),          # peripheral darkening intensity
  }
```

---

## A11. Ambient Particle System (Per-District)

Particles provide district texture. All districts share one instanced buffer.

### A11.1 Configuration

```
CONSTANTS:
  MAX_TOTAL_PARTICLES = 500      # across all visible types, Quest 3 budget
  PARTICLE_RADIUS     = 30.0     # meters around visitor
  RECYCLE_PER_FRAME   = 10       # max particles recycled per frame (amortized)

DISTRICT_PARTICLE_CONFIG = {
  "rialto": {
    type: "dust",
    base_color: Color(0.75, 0.60, 0.35),   # warm ochre
    size_range: [0.08, 0.20],
    speed_range: [0.1, 0.4],
    drift: vec3(0.0, 0.15, 0.0),            # slow updraft
    density: 0.8,                            # relative to max
    spawn_bias: "near_buildings",            # cluster near market stalls
  },
  "san_marco": {
    type: "light_mote",
    base_color: Color(1.0, 0.95, 0.75),     # gold/white
    size_range: [0.05, 0.12],
    speed_range: [0.05, 0.2],
    drift: vec3(0.1, 0.0, 0.05),            # lateral drift
    density: 0.4,                            # sparse
    spawn_bias: "sunbeam",                   # cluster in sun-facing areas
  },
  "castello": {
    type: "moisture",
    base_color: Color(0.55, 0.60, 0.70),    # cool blue-grey
    size_range: [0.10, 0.25],
    speed_range: [0.05, 0.15],
    drift: vec3(0.08, 0.0, 0.08),           # horizontal drift
    density: 0.7,
    spawn_bias: "near_canals",
  },
  "dorsoduro": {
    type: "parchment_dust",
    base_color: Color(0.85, 0.82, 0.70),    # pale cream
    size_range: [0.06, 0.14],
    speed_range: [0.15, 0.35],
    drift: vec3(0.0, 0.1, 0.0),
    density: 0.5,
    spawn_bias: "near_buildings",
  },
  "cannaregio": {
    type: "candle_smoke",
    base_color: Color(0.85, 0.65, 0.30),    # warm amber
    size_range: [0.04, 0.10],
    speed_range: [0.08, 0.20],
    drift: vec3(0.0, 0.25, 0.0),            # rise slowly
    density: 0.5,
    spawn_bias: "near_lanterns",
    fade_height: 3.0,                        # fade out above 3m
  },
  "santa_croce": {
    type: "forge_ash",
    base_color: Color(0.40, 0.30, 0.20),    # dark grey-orange
    size_range: [0.03, 0.08],
    speed_range: [0.3, 0.7],
    drift: vec3(0.0, 0.5, 0.0),             # fast upward
    density: 0.6,
    spawn_bias: "near_buildings",
    erratic: 0.4,                            # random velocity perturbation strength
  },
  "certosa": {
    type: "pollen",
    base_color: Color(0.70, 0.80, 0.40),    # pale green-gold
    size_range: [0.04, 0.10],
    speed_range: [0.02, 0.10],
    drift: vec3(0.02, 0.01, 0.03),          # slow organic meandering
    density: 0.3,
    spawn_bias: "uniform",
  },
}
```

### A11.2 Particle Instance

```
STRUCT AmbientParticle:
  position: vec3
  velocity: vec3
  color: Color
  size: float
  opacity: float
  life: float
  max_life: float
  district_type: string     # source district particle type

FUNCTION spawn_ambient_particle(visitor_pos, config, mood_params, rng):
  # Position within radius, biased by spawn_bias
  angle = rng() * TWO_PI
  radius = sqrt(rng()) * PARTICLE_RADIUS    # sqrt for uniform disc distribution
  x = visitor_pos.x + cos(angle) * radius
  z = visitor_pos.z + sin(angle) * radius

  SWITCH config.spawn_bias:
    "near_buildings":
      # Offset toward nearest building within 5m, if found
      nearest = find_nearest_building(vec3(x, 0, z), 5.0)
      IF nearest: x, z = lerp_toward(x, z, nearest.x, nearest.z, 0.5)
    "near_canals":
      nearest_canal = find_nearest_canal(vec3(x, 0, z), 8.0)
      IF nearest_canal: x, z = lerp_toward(x, z, nearest_canal.x, nearest_canal.z, 0.6)
    "near_lanterns":
      nearest_lantern = find_nearest_lantern(vec3(x, 0, z), 4.0)
      IF nearest_lantern: x, z = lerp_toward(x, z, nearest_lantern.x, nearest_lantern.z, 0.7)
    "sunbeam":
      # Only spawn if position is in direct sunlight (not shadowed)
      IF NOT is_in_shadow(vec3(x, 1.5, z)): PASS
      ELSE: RETURN NULL   # skip, try again next frame
    "uniform":
      PASS   # no bias

  y = 0.5 + rng() * 2.5    # 0.5 - 3.0m height

  speed = lerp(config.speed_range[0], config.speed_range[1], rng())
  speed *= mood_params.particle_speed   # mood modifier

  base_vel = config.drift * speed
  IF config.erratic:
    perturbation = vec3((rng()-0.5)*config.erratic, (rng()-0.5)*config.erratic*0.5, (rng()-0.5)*config.erratic)
    base_vel += perturbation

  # Color variation per particle
  hue_shift = (rng() - 0.5) * 0.08
  brightness_shift = (rng() - 0.5) * 0.1
  color = shift_color(config.base_color, hue_shift, brightness_shift)
  # Apply mood saturation
  color = adjust_saturation(color, mood_params.saturation)

  size = lerp(config.size_range[0], config.size_range[1], rng())
  max_life = 6.0 + rng() * 14.0

  RETURN AmbientParticle {
    position: vec3(x, y, z),
    velocity: base_vel,
    color: color,
    size: size,
    opacity: 0.0,
    life: max_life,
    max_life: max_life,
    district_type: config.type,
  }
```

### A11.3 Per-Frame Particle Update

```
FUNCTION update_ambient_particles(particles, visitor_pos, current_district, mood_params, delta_time):
  config = DISTRICT_PARTICLE_CONFIG[current_district]
  target_count = floor(MAX_TOTAL_PARTICLES * config.density * mood_params.particle_count)
  active = count(p for p in particles where p.life > 0)

  # Spawn
  spawned = 0
  WHILE active < target_count AND spawned < RECYCLE_PER_FRAME:
    p = spawn_ambient_particle(visitor_pos, config, mood_params, rng)
    IF p != NULL:
      particles.PUSH(p)
      active += 1
    spawned += 1

  # Update
  recycled = 0
  FOR each p IN particles:
    IF p.life <= 0:
      CONTINUE

    p.life -= delta_time
    p.position += p.velocity * delta_time

    # Erratic motion (forge ash, etc.)
    IF config.erratic:
      p.velocity += vec3(
        (rng()-0.5) * config.erratic * delta_time * 2.0,
        0,
        (rng()-0.5) * config.erratic * delta_time * 2.0
      )

    # Fade envelope
    IF p.life > p.max_life - 1.5:
      p.opacity = (p.max_life - p.life) / 1.5
    ELSE IF p.life < 1.5:
      p.opacity = p.life / 1.5
    ELSE:
      p.opacity = 1.0

    # Height-based fade (candle smoke fades above 3m)
    IF config.fade_height AND p.position.y > config.fade_height:
      height_fade = 1.0 - clamp((p.position.y - config.fade_height) / 1.0, 0, 1)
      p.opacity *= height_fade

    # Night: particles only visible near light sources
    IF sun_state.elevation < 0:
      nearest_light_dist = distance_to_nearest_light(p.position)
      IF nearest_light_dist > 8.0:
        p.opacity *= 0.0
      ELSE:
        p.opacity *= 1.0 - (nearest_light_dist / 8.0)

    # Recycle if too far from visitor
    dist = distance_xz(p.position, visitor_pos)
    IF dist > PARTICLE_RADIUS * 1.3 OR p.life <= 0:
      p.life = 0
      recycled += 1
      IF recycled >= RECYCLE_PER_FRAME:
        BREAK

  # Upload to GPU buffer
  update_instanced_buffer(particles)
```

---

## A12. District Transition Atmosphere Blend

When the visitor crosses a district boundary, atmosphere parameters crossfade.

```
CONSTANTS:
  TRANSITION_DURATION = 2.0   # seconds
  FOG_GATE_DURATION   = 3.0   # seconds, fog gate is slightly longer than parameter crossfade
  FOG_GATE_DENSITY    = 0.06  # temporary atmospheric fog density during gate

STRUCT DistrictTransition:
  from_district: string
  to_district: string
  progress: float            # 0.0 - 1.0
  fog_gate_active: bool

STATE:
  active_transition: DistrictTransition = NULL
  current_atmosphere_target: AtmosphereParams
  previous_atmosphere_target: AtmosphereParams

FUNCTION on_district_changed(from_id, to_id):
  previous_atmosphere_target = current_atmosphere_target
  current_atmosphere_target = compute_district_atmosphere(to_id)

  active_transition = DistrictTransition {
    from_district: from_id,
    to_district: to_id,
    progress: 0.0,
    fog_gate_active: TRUE,
  }

FUNCTION update_district_transition(delta_time):
  IF active_transition == NULL:
    RETURN

  active_transition.progress += delta_time / TRANSITION_DURATION
  t = smoothstep(0, 1, active_transition.progress)

  # Blend all atmosphere parameters
  blended = AtmosphereParams.lerp(previous_atmosphere_target, current_atmosphere_target, t)
  apply_atmosphere(blended)

  # Fog gate: temporary density spike during transition
  IF active_transition.fog_gate_active:
    gate_progress = active_transition.progress * (TRANSITION_DURATION / FOG_GATE_DURATION)
    IF gate_progress < 1.0:
      # Bell curve: peaks at 0.5, zero at edges
      gate_intensity = sin(gate_progress * PI)
      scene_fog.density += FOG_GATE_DENSITY * gate_intensity
    ELSE:
      active_transition.fog_gate_active = FALSE

  IF active_transition.progress >= 1.0:
    active_transition = NULL

  # Particle crossfade: old type fades out, new type fades in
  # Handled by particle update: new spawns use new config,
  # existing particles from old district continue until their life expires
```

---

## A13. Event Atmosphere Override

World events (Blood Ledger moment flips) produce temporary atmosphere shifts.

```
STRUCT EventOverride:
  event_id: string
  district_id: string
  severity: float             # 0.0 - 1.0
  fog_density_add: float
  light_intensity_mult: float
  color_shift: Color
  duration_ingame_hours: float
  elapsed_ingame_hours: float
  phase: enum                 # ONSET, PEAK, DECAY

STATE:
  active_overrides: List<EventOverride>

FUNCTION apply_event_override(event):
  override = EventOverride {
    event_id: event.id,
    district_id: event.location.district,
    severity: clamp(event.salience, 0.0, 1.0),
    fog_density_add: event.salience * 0.025,
    light_intensity_mult: 1.0 - event.salience * 0.15,
    color_shift: Color.lerp(Color(0,0,0), Color(-0.1, -0.05, 0.05), event.salience),
    duration_ingame_hours: 2.0 + event.salience * 4.0,   # 2-6 in-game hours
    elapsed_ingame_hours: 0.0,
    phase: ONSET,
  }
  active_overrides.PUSH(override)

FUNCTION update_event_overrides(delta_ingame_hours, visitor_district):
  FOR each override IN active_overrides:
    override.elapsed_ingame_hours += delta_ingame_hours

    # Phase transitions
    onset_end = 0.1 * override.duration_ingame_hours
    peak_end  = 0.4 * override.duration_ingame_hours
    IF override.elapsed_ingame_hours < onset_end:
      override.phase = ONSET
      phase_t = override.elapsed_ingame_hours / onset_end
    ELSE IF override.elapsed_ingame_hours < peak_end:
      override.phase = PEAK
      phase_t = 1.0
    ELSE IF override.elapsed_ingame_hours < override.duration_ingame_hours:
      override.phase = DECAY
      phase_t = 1.0 - (override.elapsed_ingame_hours - peak_end) / (override.duration_ingame_hours - peak_end)
    ELSE:
      # Expired
      MARK_FOR_REMOVAL(override)
      CONTINUE

    # Apply based on phase intensity and visitor proximity
    IF visitor_district == override.district_id:
      effect_strength = phase_t * override.severity
    ELSE:
      # Adjacent districts get faint sympathetic effect
      IF is_adjacent(visitor_district, override.district_id):
        effect_strength = phase_t * override.severity * 0.2
      ELSE:
        effect_strength = 0.0

    # Modulate current atmosphere
    scene_fog.density += override.fog_density_add * effect_strength
    directional_light.intensity *= lerp(1.0, override.light_intensity_mult, effect_strength)
    scene_fog.color = Color.lerp(scene_fog.color, scene_fog.color + override.color_shift, effect_strength)

  # Remove expired overrides
  active_overrides = filter(active_overrides, o => NOT marked_for_removal(o))
```

---

## A14. Biometric Vignette (Post-Processing)

High stress adds peripheral darkening as a post-processing pass.

```
STRUCT VignetteState:
  intensity: float       # 0.0 - 0.12, current vignette darkness
  target: float
  inner_radius: float    # normalized screen space, 0.0 = center
  outer_radius: float

FUNCTION update_vignette(biometric_mods, delta_time):
  target = biometric_mods.vignette   # from biometric_to_atmosphere()
  LERP_SPEED = 0.3

  vignette.target = target
  vignette.intensity = lerp(
    vignette.intensity,
    vignette.target,
    1 - exp(-LERP_SPEED * delta_time)
  )

  vignette.inner_radius = 0.45   # fixed
  vignette.outer_radius = 0.85   # fixed

  IF vignette.intensity < 0.005:
    vignette_pass.enabled = FALSE
    RETURN

  vignette_pass.enabled = TRUE
  vignette_pass.uniforms.intensity = vignette.intensity
  vignette_pass.uniforms.inner = vignette.inner_radius
  vignette_pass.uniforms.outer = vignette.outer_radius

# Vignette fragment shader (applied as full-screen quad):
#   dist = distance(uv, vec2(0.5))
#   factor = smoothstep(inner, outer, dist)
#   color.rgb *= 1.0 - intensity * factor
```

---

## A15. Preetham Sky Uniform Update

The existing Preetham sky model receives dynamic uniforms from the atmosphere system.

```
CONSTANTS:
  # Preetham model parameters by time phase
  SKY_PARAMS = {
    NIGHT:     { turbidity: 2.0,  rayleigh: 0.1,  mie: 0.001, mie_direction: 0.7 },
    DAWN:      { turbidity: 4.0,  rayleigh: 1.5,  mie: 0.010, mie_direction: 0.8 },
    MORNING:   { turbidity: 3.0,  rayleigh: 2.0,  mie: 0.005, mie_direction: 0.7 },
    AFTERNOON: { turbidity: 2.5,  rayleigh: 1.8,  mie: 0.004, mie_direction: 0.7 },
    EVENING:   { turbidity: 6.0,  rayleigh: 2.5,  mie: 0.015, mie_direction: 0.9 },
    DUSK:      { turbidity: 10.0, rayleigh: 3.0,  mie: 0.025, mie_direction: 0.95 },
  }

FUNCTION update_sky_uniforms(sun_state, time_phase, hour, haze_opacity):
  current = SKY_PARAMS[time_phase]
  next = SKY_PARAMS[get_next_phase(time_phase)]
  t = get_phase_progress(hour, time_phase)
  t = smoothstep(0, 1, t)

  sky_material.uniforms.turbidity = lerp(current.turbidity, next.turbidity, t)
  sky_material.uniforms.rayleigh = lerp(current.rayleigh, next.rayleigh, t)
  sky_material.uniforms.mie = lerp(current.mie, next.mie, t)
  sky_material.uniforms.mieDirectionalG = lerp(current.mie_direction, next.mie_direction, t)

  # Haze increases turbidity
  sky_material.uniforms.turbidity += haze_opacity * 4.0

  # Sun position
  sky_material.uniforms.sunPosition = vec3(
    -sun_state.direction.x,
    -sun_state.direction.y,
    -sun_state.direction.z
  )
```

---

## A16. Master Atmosphere Update Loop

Called every frame. Orchestrates all subsystems. Budget: 0.5ms.

```
FUNCTION update_atmosphere(real_time_ms, delta_time, visitor_position, visitor_district):
  # --- 1. World Clock (0.01ms) ---
  hour = update_world_clock(real_time_ms)
  time_phase = classify_phase(hour)
  delta_ingame_hours = (delta_time / 1000.0) / (MS_PER_INGAME_HOUR / 1000.0)

  # --- 2. Sun Position + Color (0.02ms) ---
  sun_state = compute_sun_position(hour)
  sun_color = compute_sun_color(sun_state)
  sun_state.color = sun_color.color
  sun_state.intensity = sun_color.intensity

  directional_light.color = sun_state.color
  directional_light.intensity = sun_state.intensity
  directional_light.position = visitor_position - sun_state.direction * 100

  # --- 3. Shadows (0.02ms) ---
  update_shadows(sun_state)

  # --- 4. Hemisphere Light (0.02ms) ---
  hemi = compute_hemisphere(hour, time_phase)
  hemisphere_light.color = hemi.sky_color
  hemisphere_light.groundColor = hemi.ground_color
  hemisphere_light.intensity = hemi.intensity

  # --- 5. Weather State (0.01ms) ---
  update_weather_state(delta_ingame_hours)
  weather_mod = get_weather_fog_modifier()

  # --- 6. Base Fog from Time (0.01ms) ---
  base_fog = compute_base_fog(hour, time_phase)
  fog_color = compute_fog_color(hour, time_phase, visitor_district)

  # --- 7. District Mood (0.05ms, only on sync or every 60 frames) ---
  update_district_moods(districts, citizens, delta_time)
  mood = district_moods[visitor_district].mood_aggregate
  mood_params = mood_to_atmosphere_params(mood)

  # --- 8. Narrative Tension (0.01ms) ---
  district_tension = get_district_tension(visitor_district)
  tension_fog = apply_tension_fog(base_fog, district_tension)

  # --- 9. Biometric Modulation (0.01ms) ---
  biometric_mods = biometric_to_atmosphere(biometric.stress_normalized)

  # --- 10. Composite Fog Values (0.01ms) ---
  # Weight: time 50%, mood 30%, biometric 20%
  # Time provides base. Mood and biometric are multipliers/offsets.
  final_ground_density = tension_fog.ground * weather_mod.ground_mult * mood_params.fog_mult
  final_ground_density += final_ground_density * biometric_mods.fog_add
  final_ground_density = clamp(final_ground_density, 0.0, 1.0)

  final_atmo_density = tension_fog.atmo * weather_mod.atmo_mult * mood_params.fog_mult
  final_atmo_density += final_atmo_density * biometric_mods.fog_add
  final_atmo_density = clamp(final_atmo_density, 0.001, 0.10)

  final_haze = tension_fog.haze * weather_mod.haze_mult

  # Apply mood saturation to fog color
  final_fog_color = adjust_saturation(fog_color, mood_params.saturation)
  # Apply biometric color shift
  final_fog_color = shift_warmth(final_fog_color, biometric_mods.color_shift)

  # --- 11. Apply Fog Layers (0.02ms) ---
  update_atmospheric_fog(scene_fog, final_atmo_density, final_fog_color, delta_time)
  update_haze(cloud_layer, final_haze, sun_state, delta_time)
  update_ground_fog(ground_fog_particles, visitor_position, final_ground_density, final_fog_color, delta_time)

  # --- 12. Ambient Particles (0.30ms) ---
  update_ambient_particles(ambient_particles, visitor_position, visitor_district, mood_params, delta_time)

  # --- 13. District Transition (0.01ms) ---
  update_district_transition(delta_time)

  # --- 14. Event Overrides (0.01ms) ---
  update_event_overrides(delta_ingame_hours, visitor_district)

  # --- 15. Window Glow (0.02ms) ---
  glow = compute_window_glow(hour)
  apply_window_glow(buildings, glow)

  # --- 16. Stars (0.01ms) ---
  update_stars(sun_state)

  # --- 17. Sky Uniforms (0.01ms) ---
  update_sky_uniforms(sun_state, time_phase, hour, final_haze)

  # --- 18. Lantern Flicker (mood-driven) (0.01ms) ---
  FOR each lantern IN visible_lanterns:
    base_flicker = 0.5 + sin(real_time_ms * 0.003 + lantern.seed) * 0.15
    mood_flicker = (rng() - 0.5) * mood_params.lantern_flicker
    lantern.light.intensity = clamp(base_flicker + mood_flicker, 0.1, 0.8)

  # --- 19. Biometric Vignette (0.01ms) ---
  update_vignette(biometric_mods, delta_time)

  # --- Total: ~0.44ms ---
```

---

## A17. Utility Functions

Shared helpers referenced throughout the atmosphere system.

```
FUNCTION smoothstep(edge0, edge1, x):
  t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)
  RETURN t * t * (3.0 - 2.0 * t)

FUNCTION lerp(a, b, t):
  RETURN a + (b - a) * t

FUNCTION clamp(x, lo, hi):
  RETURN max(lo, min(hi, x))

FUNCTION adjust_saturation(color, factor):
  # factor: 0.0 = greyscale, 1.0 = unchanged, >1.0 = oversaturated
  grey = color.r * 0.299 + color.g * 0.587 + color.b * 0.114
  RETURN Color(
    grey + (color.r - grey) * factor,
    grey + (color.g - grey) * factor,
    grey + (color.b - grey) * factor,
  )

FUNCTION shift_warmth(color, shift):
  # shift > 0: warmer (add red, reduce blue). shift < 0: cooler.
  RETURN Color(
    clamp(color.r + shift * 0.5, 0, 1),
    clamp(color.g + shift * 0.15, 0, 1),
    clamp(color.b - shift * 0.5, 0, 1),
  )

FUNCTION shift_color(base, hue_offset, brightness_offset):
  # Convert to HSL, shift, convert back
  h, s, l = rgb_to_hsl(base)
  h = (h + hue_offset) MOD 1.0
  l = clamp(l + brightness_offset, 0, 1)
  RETURN hsl_to_rgb(h, s, l)

FUNCTION get_phase_start_hour(phase):
  SWITCH phase:
    NIGHT:     RETURN 0.0
    DAWN:      RETURN 5.0
    MORNING:   RETURN 7.0
    AFTERNOON: RETURN 12.0
    EVENING:   RETURN 17.0
    DUSK:      RETURN 20.0

FUNCTION get_next_phase(phase):
  SWITCH phase:
    NIGHT:     RETURN DAWN
    DAWN:      RETURN MORNING
    MORNING:   RETURN AFTERNOON
    AFTERNOON: RETURN EVENING
    EVENING:   RETURN DUSK
    DUSK:      RETURN NIGHT

FUNCTION get_phase_progress(hour, phase):
  start = get_phase_start_hour(phase)
  end = get_phase_start_hour(get_next_phase(phase))
  IF end <= start: end += 24.0   # wrap around midnight
  IF hour < start: hour += 24.0
  RETURN clamp((hour - start) / (end - start), 0.0, 1.0)

FUNCTION weighted_pick(weight_map, rng):
  total = sum(weight_map.values())
  roll = rng() * total
  cumulative = 0
  FOR each key, weight IN weight_map:
    cumulative += weight
    IF roll <= cumulative:
      RETURN key
  RETURN last key   # fallback

FUNCTION is_adjacent(district_a, district_b):
  RETURN district_b IN ADJACENCY_MAP[district_a]

ADJACENCY_MAP = {
  "rialto":      ["san_marco", "cannaregio", "santa_croce"],
  "san_marco":   ["rialto", "castello", "dorsoduro"],
  "castello":    ["san_marco", "cannaregio"],
  "dorsoduro":   ["san_marco", "santa_croce"],
  "cannaregio":  ["rialto", "castello"],
  "santa_croce": ["rialto", "dorsoduro"],
  "certosa":     [],    # island, no land adjacency
}
```
