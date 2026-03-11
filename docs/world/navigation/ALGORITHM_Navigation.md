# ALGORITHM: world/navigation -- How It Works

Pseudocode for every navigation subsystem. No code -- procedural descriptions with data flows.

---

## A1. Desktop Movement (WASD + Mouse)

### A1.1 Input Capture

```
CONSTANTS:
  WALK_SPEED       = 2.5      # meters per second
  RUN_SPEED        = 3.75     # 1.5x walk
  MOUSE_SENSITIVITY = 0.002   # radians per pixel
  PITCH_MIN        = -PI / 3  # -60 degrees (looking down)
  PITCH_MAX        = PI / 3   # +60 degrees (looking up)

STATE:
  yaw: float = 0.0            # radians, horizontal rotation
  pitch: float = 0.0          # radians, vertical rotation
  keys_held: Set<string>      # currently pressed keys
  shift_held: bool = FALSE
  pointer_locked: bool = FALSE
  position: vec3               # world position of visitor
  last_valid_position: vec3    # most recent position on walkable surface

FUNCTION on_mouse_move(dx, dy):
  IF NOT pointer_locked: RETURN
  yaw -= dx * MOUSE_SENSITIVITY
  pitch -= dy * MOUSE_SENSITIVITY
  pitch = clamp(pitch, PITCH_MIN, PITCH_MAX)

FUNCTION on_key_down(key):
  keys_held.ADD(key.toLowerCase())
  IF key == "Shift": shift_held = TRUE

FUNCTION on_key_up(key):
  keys_held.REMOVE(key.toLowerCase())
  IF key == "Shift": shift_held = FALSE

FUNCTION on_click():
  IF NOT pointer_locked:
    request_pointer_lock()
    pointer_locked = TRUE
```

### A1.2 Movement Vector Computation

```
FUNCTION compute_desktop_movement(delta_time):
  # Build raw input vector in camera-local space
  input = vec3(0, 0, 0)
  IF "w" IN keys_held: input.z -= 1.0    # forward (negative Z in Three.js)
  IF "s" IN keys_held: input.z += 1.0    # backward
  IF "a" IN keys_held: input.x -= 1.0    # strafe left
  IF "d" IN keys_held: input.x += 1.0    # strafe right

  # No movement if no input
  IF length(input) < 0.001: RETURN vec3(0, 0, 0)

  # Normalize to prevent diagonal speed boost
  input = normalize(input)

  # Rotate input by yaw (ignore pitch -- movement is horizontal)
  forward = vec3(-sin(yaw), 0, -cos(yaw))
  right   = vec3(cos(yaw), 0, -sin(yaw))
  world_dir = forward * input.z + right * input.x
  world_dir = normalize(world_dir)

  # Apply speed
  speed = RUN_SPEED IF shift_held ELSE WALK_SPEED
  displacement = world_dir * speed * delta_time

  RETURN displacement
```

### A1.3 Collision Raycast and Position Update

```
CONSTANTS:
  RAYCAST_HEIGHT   = 5.0      # cast from this height above position
  RAYCAST_MAX_DIST = 7.0      # maximum downward ray distance
  STEP_HEIGHT      = 0.3      # can step up ledges up to 30cm (bridge steps)
  VISITOR_RADIUS   = 0.3      # meters, capsule radius for wall collision

FUNCTION update_desktop_position(displacement, delta_time):
  IF length(displacement) < 0.0001: RETURN

  proposed = position + displacement

  # --- Wall collision (horizontal) ---
  proposed = resolve_wall_collision(position, proposed)

  # --- Ground raycast (vertical) ---
  ray_origin = vec3(proposed.x, proposed.y + RAYCAST_HEIGHT, proposed.z)
  ray_direction = vec3(0, -1, 0)
  hit = raycast(ray_origin, ray_direction, RAYCAST_MAX_DIST, collision_mesh)

  IF hit != NULL:
    ground_y = hit.point.y
    # Check step height: can we step up to this surface?
    height_diff = ground_y - position.y
    IF height_diff > STEP_HEIGHT:
      # Too high to step onto -- treat as wall
      proposed = resolve_wall_collision(position, proposed)
      # Re-raycast at corrected position
      hit = raycast(vec3(proposed.x, proposed.y + RAYCAST_HEIGHT, proposed.z), vec3(0,-1,0), RAYCAST_MAX_DIST, collision_mesh)
      IF hit != NULL:
        ground_y = hit.point.y
      ELSE:
        # Still no ground -- revert
        RETURN

    position = vec3(proposed.x, ground_y, proposed.z)
    last_valid_position = position

  ELSE:
    # No walkable surface below proposed position
    # Clamp to last valid position (prevents walking on water or into void)
    position = last_valid_position

  # Update camera
  camera.position = vec3(position.x, position.y + VISITOR_EYE_HEIGHT, position.z)
  camera.rotation.set(pitch, yaw, 0, "YXZ")


FUNCTION resolve_wall_collision(from, to):
  # Cast a short horizontal ray in the movement direction
  move_dir = normalize(vec3(to.x - from.x, 0, to.z - from.z))
  move_dist = distance_xz(from, to)

  # Four radial probes around the capsule (front, left, right, back-left, back-right)
  probes = [
    move_dir,                                               # center forward
    rotate_y(move_dir, PI * 0.3) * VISITOR_RADIUS,         # front-right
    rotate_y(move_dir, -PI * 0.3) * VISITOR_RADIUS,        # front-left
  ]

  closest_wall_dist = INFINITY
  wall_normal = NULL

  FOR each probe_dir IN probes:
    origin = vec3(from.x, from.y + 0.5, from.z)   # waist height
    hit = raycast(origin, normalize(probe_dir), move_dist + VISITOR_RADIUS, wall_geometry)
    IF hit != NULL AND hit.distance < closest_wall_dist:
      closest_wall_dist = hit.distance
      wall_normal = hit.face.normal

  IF wall_normal == NULL:
    RETURN to   # no wall hit

  # Slide along wall: remove the component of displacement that goes into the wall
  displacement = to - from
  dot = displacement.x * wall_normal.x + displacement.z * wall_normal.z
  IF dot < 0:
    # Moving into wall -- subtract the wall-normal component
    displacement.x -= wall_normal.x * dot
    displacement.z -= wall_normal.z * dot

  RETURN from + displacement
```

---

## A2. VR Locomotion

### A2.1 Continuous Locomotion (Left Thumbstick)

```
CONSTANTS:
  VR_WALK_SPEED = 2.5     # meters per second, no run in VR
  DEADZONE      = 0.15    # thumbstick deadzone

STATE:
  dolly: Group             # VR camera rig (dolly.position = world position)
  headset: Object3D        # within dolly, tracks real headset

FUNCTION update_vr_continuous(left_stick, delta_time):
  # left_stick: { x: -1..1, y: -1..1 } from controller

  IF abs(left_stick.x) < DEADZONE AND abs(left_stick.y) < DEADZONE:
    deactivate_vignette()
    RETURN

  activate_vignette()

  # Normalize stick input
  input = vec2(left_stick.x, left_stick.y)
  IF length(input) > 1.0: input = normalize(input)

  # Direction relative to headset facing (not controller facing)
  headset_forward = get_headset_forward_xz()   # projected onto XZ plane, normalized
  headset_right = vec3(headset_forward.z, 0, -headset_forward.x)

  # Map: stick Y = forward/back, stick X = strafe
  move_dir = headset_forward * (-input.y) + headset_right * input.x
  move_dir = normalize(move_dir)

  displacement = move_dir * VR_WALK_SPEED * length(input) * delta_time

  # Apply collision (same path as desktop)
  proposed = dolly.position + displacement
  proposed = resolve_wall_collision(dolly.position, proposed)

  # Ground snap
  headset_world = dolly.position + headset.position   # headset position in world
  ray_origin = vec3(proposed.x + headset.position.x, proposed.y + RAYCAST_HEIGHT, proposed.z + headset.position.z)
  hit = raycast(ray_origin, vec3(0, -1, 0), RAYCAST_MAX_DIST, collision_mesh)

  IF hit != NULL:
    ground_y = hit.point.y
    height_diff = ground_y - dolly.position.y
    IF abs(height_diff) <= STEP_HEIGHT:
      dolly.position = vec3(proposed.x, ground_y, proposed.z)
      last_valid_position = dolly.position
    ELSE IF height_diff > STEP_HEIGHT:
      # Too high -- slide
      dolly.position = resolve_wall_collision(dolly.position, proposed)
    ELSE:
      # Dropping down (e.g., bridge descent) -- allow
      dolly.position = vec3(proposed.x, ground_y, proposed.z)
      last_valid_position = dolly.position
  ELSE:
    dolly.position = last_valid_position
```

### A2.2 Snap Turn (Right Thumbstick)

```
CONSTANTS:
  SNAP_ANGLE     = PI / 6     # 30 degrees in radians
  SNAP_THRESHOLD = 0.7        # stick must exceed this to trigger
  SNAP_COOLDOWN  = 250        # ms before another snap can trigger

STATE:
  snap_ready: bool = TRUE
  last_snap_time: float = 0

FUNCTION update_snap_turn(right_stick_x, real_time_ms):
  IF abs(right_stick_x) < SNAP_THRESHOLD:
    snap_ready = TRUE
    RETURN

  IF NOT snap_ready:
    RETURN

  IF (real_time_ms - last_snap_time) < SNAP_COOLDOWN:
    RETURN

  # Determine direction
  IF right_stick_x > SNAP_THRESHOLD:
    angle = -SNAP_ANGLE   # clockwise
  ELSE:
    angle = SNAP_ANGLE    # counter-clockwise

  # Rotate dolly around headset position (not dolly origin)
  headset_world = dolly.position + headset.position
  offset = dolly.position - headset_world
  rotated_offset = rotate_y(offset, angle)
  dolly.position = headset_world + rotated_offset
  dolly.rotation.y += angle

  snap_ready = FALSE
  last_snap_time = real_time_ms
```

### A2.3 Teleport (Arc + Comfort Fade)

```
CONSTANTS:
  TELEPORT_MAX_RANGE   = 15.0      # meters horizontal
  TELEPORT_ARC_GRAVITY = 9.8       # m/s^2, for parabolic arc
  TELEPORT_INITIAL_VEL = 8.0       # m/s launch speed
  TELEPORT_ARC_STEPS   = 20        # line segments for arc visualization
  TELEPORT_FADE_MS     = 200       # ms for each fade direction
  TELEPORT_COOLDOWN_MS = 300       # ms between teleports
  TELEPORT_VALID_COLOR = Color(0.3, 0.5, 1.0)   # blue
  TELEPORT_INVALID_COLOR = Color(1.0, 0.2, 0.2) # red

STATE:
  teleport_active: bool = FALSE    # arc is being shown
  teleport_arc_points: List<vec3>
  teleport_landing: vec3 = NULL
  teleport_valid: bool = FALSE
  teleport_cooldown_end: float = 0
  teleport_fade_state: enum = NONE  # NONE, FADING_OUT, BLACK, FADING_IN

FUNCTION update_teleport_aim(right_controller, right_trigger):
  # Half-press trigger (value 0.3-0.8) shows arc. Full press (>0.8) executes.

  IF right_trigger < 0.3:
    teleport_active = FALSE
    hide_arc()
    hide_landing_indicator()
    RETURN

  teleport_active = TRUE

  # Launch direction: controller forward, tilted slightly upward
  launch_dir = get_controller_forward(right_controller)
  launch_dir.y = max(launch_dir.y, 0.1)   # prevent downward teleport
  launch_dir = normalize(launch_dir)

  launch_pos = right_controller.position   # world space
  launch_vel = launch_dir * TELEPORT_INITIAL_VEL

  # Trace parabolic arc
  teleport_arc_points = []
  pos = launch_pos.clone()
  vel = launch_vel.clone()
  dt_step = 0.05   # simulation time step
  teleport_landing = NULL
  teleport_valid = FALSE

  FOR step = 0 TO TELEPORT_ARC_STEPS:
    teleport_arc_points.PUSH(pos.clone())

    # Advance
    vel.y -= TELEPORT_ARC_GRAVITY * dt_step
    next_pos = pos + vel * dt_step

    # Raycast between pos and next_pos to detect surface hit
    segment_dir = normalize(next_pos - pos)
    segment_len = distance(pos, next_pos)
    hit = raycast(pos, segment_dir, segment_len, collision_mesh)

    IF hit != NULL:
      teleport_arc_points.PUSH(hit.point)
      teleport_landing = hit.point

      # Check if landing is on walkable surface
      IF hit.object.userData.walkable == TRUE:
        # Check horizontal range
        horiz_dist = distance_xz(launch_pos, hit.point)
        IF horiz_dist <= TELEPORT_MAX_RANGE:
          teleport_valid = TRUE
        ELSE:
          teleport_valid = FALSE
      ELSE:
        teleport_valid = FALSE
      BREAK

    # Check if arc has gone below water level
    IF next_pos.y < -0.5:
      teleport_arc_points.PUSH(next_pos)
      teleport_valid = FALSE
      BREAK

    pos = next_pos

  # Render arc
  render_arc(teleport_arc_points, teleport_valid ? TELEPORT_VALID_COLOR : TELEPORT_INVALID_COLOR)

  # Render landing indicator
  IF teleport_landing != NULL AND teleport_valid:
    show_landing_indicator(teleport_landing)
  ELSE:
    hide_landing_indicator()

  # Execute teleport on full press
  IF right_trigger > 0.8 AND teleport_valid AND teleport_landing != NULL:
    IF real_time_ms > teleport_cooldown_end:
      execute_teleport(teleport_landing)


FUNCTION execute_teleport(target):
  teleport_cooldown_end = real_time_ms + TELEPORT_COOLDOWN_MS
  teleport_active = FALSE
  hide_arc()
  hide_landing_indicator()

  # Comfort fade: black out, move, fade in
  teleport_fade_state = FADING_OUT
  start_screen_fade(to_black=TRUE, duration=TELEPORT_FADE_MS, on_complete=LAMBDA:
    # At full black: reposition
    headset_offset = headset.position   # headset offset within dolly
    dolly.position.x = target.x - headset_offset.x
    dolly.position.y = target.y
    dolly.position.z = target.z - headset_offset.z
    last_valid_position = dolly.position

    teleport_fade_state = BLACK
    # Brief hold at black (1 frame), then fade in
    start_screen_fade(to_black=FALSE, duration=TELEPORT_FADE_MS, on_complete=LAMBDA:
      teleport_fade_state = NONE
    )
  )
```

### A2.4 Arc Rendering

```
FUNCTION render_arc(points, color):
  # Dotted line: alternating visible/invisible segments
  arc_geometry.setAttribute("position", flatten_vec3_array(points))
  arc_material.color = color
  arc_material.dashSize = 0.3
  arc_material.gapSize = 0.15
  arc_line.computeLineDistances()
  arc_line.visible = TRUE

FUNCTION show_landing_indicator(position):
  # Ring on the ground at landing point
  landing_ring.position.copy(position)
  landing_ring.position.y += 0.02   # slight offset above surface to prevent z-fight
  landing_ring.visible = TRUE
  # Ring: TorusGeometry(radius=0.4, tube=0.02, segments=32)
  # Subtle pulse: scale oscillates 0.95 - 1.05 over 1 second

FUNCTION hide_arc():
  arc_line.visible = FALSE

FUNCTION hide_landing_indicator():
  landing_ring.visible = FALSE
```

---

## A3. Collision System

### A3.1 Collision Geometry Layers

```
STRUCT CollisionWorld:
  fondamenta: List<Mesh>       # walkable canal-side paths
  bridges: List<Mesh>          # walkable arched bridge decks
  piazzas: List<Mesh>          # large open walkable areas
  building_walls: List<Mesh>   # vertical wall faces (for horizontal collision)
  bridge_parapets: List<Mesh>  # low walls on bridge edges
  water_surface: Mesh          # for teleport validation (marks invalid landing)

  walkable_bvh: BVH            # bounding volume hierarchy for downward raycasts
  wall_bvh: BVH                # bounding volume hierarchy for horizontal raycasts

FUNCTION build_collision_world(venice_state):
  cw = new CollisionWorld()

  FOR each canal_geometry IN venice_state.canals:
    FOR each fondamenta_mesh IN canal_geometry.fondamenta:
      fondamenta_mesh.userData.walkable = TRUE
      cw.fondamenta.PUSH(fondamenta_mesh)

  FOR each bridge IN venice_state.bridges:
    bridge.deck.userData.walkable = TRUE
    cw.bridges.PUSH(bridge.deck)
    cw.bridge_parapets.PUSH(bridge.left_parapet)
    cw.bridge_parapets.PUSH(bridge.right_parapet)

  FOR each piazza IN venice_state.piazzas:
    piazza.userData.walkable = TRUE
    cw.piazzas.PUSH(piazza)

  # Extract wall faces from building meshes (simplified: axis-aligned bounding boxes)
  FOR each building IN venice_state.buildings:
    walls = extract_vertical_faces(building.mesh, building.footprint)
    cw.building_walls.EXTEND(walls)

  # Build BVH for fast raycasting
  all_walkable = cw.fondamenta + cw.bridges + cw.piazzas
  cw.walkable_bvh = build_bvh(all_walkable)

  all_walls = cw.building_walls + cw.bridge_parapets
  cw.wall_bvh = build_bvh(all_walls)

  # Water plane for teleport rejection
  cw.water_surface = create_plane(WORLD_WIDTH, WORLD_DEPTH, y=0.0)
  cw.water_surface.userData.walkable = FALSE

  RETURN cw
```

### A3.2 Water Barrier (Edge Clamping)

```
CONSTANTS:
  WATER_Y = 0.0               # water surface height
  FONDAMENTA_HEIGHT = 0.8     # fondamenta surface above water

FUNCTION enforce_water_barrier(from_pos, to_pos, collision_world):
  # Check if movement crosses from above-water to over-water
  ray_down = raycast(
    vec3(to_pos.x, to_pos.y + RAYCAST_HEIGHT, to_pos.z),
    vec3(0, -1, 0),
    RAYCAST_MAX_DIST,
    collision_world.walkable_bvh
  )

  IF ray_down != NULL:
    RETURN to_pos   # valid ground exists -- no water barrier needed

  # No ground at proposed position -- we would step over water
  # Project movement along the fondamenta edge

  # Find nearest walkable edge
  edge_point = find_nearest_walkable_edge(to_pos, collision_world.walkable_bvh, max_search=3.0)

  IF edge_point == NULL:
    # No nearby edge found -- hard clamp to from_pos
    RETURN from_pos

  # Compute edge tangent (direction along the fondamenta edge)
  edge_tangent = compute_edge_tangent(edge_point, collision_world)

  # Project displacement onto edge tangent (slide along edge)
  displacement = to_pos - from_pos
  slide = dot_xz(displacement, edge_tangent) * edge_tangent
  slid_pos = from_pos + slide

  # Verify slid position is still on valid ground
  verify_hit = raycast(
    vec3(slid_pos.x, slid_pos.y + RAYCAST_HEIGHT, slid_pos.z),
    vec3(0, -1, 0),
    RAYCAST_MAX_DIST,
    collision_world.walkable_bvh
  )

  IF verify_hit != NULL:
    RETURN vec3(slid_pos.x, verify_hit.point.y, slid_pos.z)
  ELSE:
    RETURN from_pos   # fallback: don't move


FUNCTION find_nearest_walkable_edge(pos, walkable_bvh, max_search):
  # Sample points in a circle around pos, find the boundary between walkable and non-walkable
  best_edge = NULL
  best_dist = max_search

  SAMPLE_COUNT = 8
  FOR i = 0 TO SAMPLE_COUNT:
    angle = i * TWO_PI / SAMPLE_COUNT
    probe = vec3(pos.x + cos(angle) * 0.5, pos.y + RAYCAST_HEIGHT, pos.z + sin(angle) * 0.5)
    hit = raycast(probe, vec3(0, -1, 0), RAYCAST_MAX_DIST, walkable_bvh)
    IF hit != NULL:
      dist = distance_xz(pos, hit.point)
      IF dist < best_dist:
        best_dist = dist
        best_edge = hit.point

  RETURN best_edge


FUNCTION compute_edge_tangent(edge_point, collision_world):
  # Approximate edge direction by sampling two nearby points along the edge
  # Find two adjacent walkable points
  probe_offsets = [vec3(0.5, 0, 0), vec3(-0.5, 0, 0), vec3(0, 0, 0.5), vec3(0, 0, -0.5)]
  walkable_neighbors = []

  FOR each offset IN probe_offsets:
    probe = edge_point + offset
    hit = raycast(vec3(probe.x, probe.y + 2, probe.z), vec3(0,-1,0), 4, collision_world.walkable_bvh)
    IF hit != NULL:
      walkable_neighbors.PUSH(hit.point)

  IF len(walkable_neighbors) >= 2:
    tangent = normalize(walkable_neighbors[1] - walkable_neighbors[0])
    RETURN vec3(tangent.x, 0, tangent.z)

  # Fallback: assume edge runs perpendicular to the vector from edge to pos
  to_water = normalize(vec3(edge_point.x - pos.x, 0, edge_point.z - pos.z))
  RETURN vec3(-to_water.z, 0, to_water.x)
```

### A3.3 Building Wall Collision

```
FUNCTION resolve_building_collision(from_pos, to_pos, collision_world):
  move_dir = normalize(vec3(to_pos.x - from_pos.x, 0, to_pos.z - from_pos.z))
  move_dist = distance_xz(from_pos, to_pos) + VISITOR_RADIUS

  hit = raycast(
    vec3(from_pos.x, from_pos.y + 0.5, from_pos.z),
    move_dir,
    move_dist,
    collision_world.wall_bvh
  )

  IF hit == NULL:
    RETURN to_pos

  wall_normal = vec3(hit.face.normal.x, 0, hit.face.normal.z)
  wall_normal = normalize(wall_normal)

  # Push back to VISITOR_RADIUS from wall
  safe_pos = hit.point + wall_normal * VISITOR_RADIUS

  # Slide: project remaining displacement onto wall plane
  displacement = to_pos - from_pos
  into_wall = dot_xz(displacement, wall_normal)
  IF into_wall < 0:
    # Remove wall-penetrating component
    displacement.x -= wall_normal.x * into_wall
    displacement.z -= wall_normal.z * into_wall

  RETURN from_pos + displacement
```

### A3.4 Fall Recovery

```
CONSTANTS:
  FALL_THRESHOLD = -2.0    # if visitor Y is this far below any nearby walkable surface
  RECOVERY_SEARCH_RADIUS = 15.0

FUNCTION check_fall_recovery(position, collision_world):
  # Check if visitor is below valid geometry
  ray_up = raycast(
    vec3(position.x, position.y, position.z),
    vec3(0, 1, 0),
    20.0,
    collision_world.walkable_bvh
  )

  IF ray_up != NULL AND (ray_up.point.y - position.y) > abs(FALL_THRESHOLD):
    # Visitor is below a walkable surface -- find nearest valid position
    recovery = find_nearest_valid_surface(position, collision_world, RECOVERY_SEARCH_RADIUS)
    IF recovery != NULL:
      position = recovery
      last_valid_position = recovery
    ELSE:
      # Absolute fallback: default spawn point
      position = get_default_spawn_position()
      last_valid_position = position

  RETURN position


FUNCTION find_nearest_valid_surface(pos, collision_world, radius):
  best = NULL
  best_dist = INFINITY

  # Sample in a grid around the position
  STEP = 2.0   # meters
  FOR x = pos.x - radius TO pos.x + radius STEP STEP:
    FOR z = pos.z - radius TO pos.z + radius STEP STEP:
      hit = raycast(vec3(x, 50, z), vec3(0, -1, 0), 100, collision_world.walkable_bvh)
      IF hit != NULL:
        dist = distance(pos, hit.point)
        IF dist < best_dist:
          best_dist = dist
          best = hit.point

  RETURN best
```

---

## A4. District Transition Detection

### A4.1 Boundary Check

```
CONSTANTS:
  HYSTERESIS_DISTANCE = 10.0     # meters -- must move this far into new district before reverse allowed
  ZONE_CHECK_INTERVAL = 10       # frames between zone checks (not every frame)

STATE:
  current_district: string
  transition_locked: bool = FALSE
  lock_entry_point: vec3          # position where last transition started
  frame_counter: int = 0

FUNCTION check_district_transition(position):
  frame_counter += 1
  IF frame_counter MOD ZONE_CHECK_INTERVAL != 0:
    RETURN   # skip this frame

  # Determine which district contains the current position
  detected = find_containing_district(position, DISTRICT_DEFINITIONS)

  IF detected == current_district:
    # Still in same district -- check if hysteresis lock can be released
    IF transition_locked:
      dist_from_entry = distance_xz(position, lock_entry_point)
      IF dist_from_entry >= HYSTERESIS_DISTANCE:
        transition_locked = FALSE
    RETURN

  IF transition_locked:
    # Transition locked -- visitor has not gone deep enough into current district
    RETURN

  # District changed -- trigger transition
  previous_district = current_district
  current_district = detected
  lock_entry_point = position
  transition_locked = TRUE

  trigger_district_transition(previous_district, current_district)


FUNCTION find_containing_district(position, districts):
  FOR each district IN districts:
    IF point_in_polygon(position.x, position.z, district.boundary):
      RETURN district.id
  RETURN NULL   # outside all districts (edge of world)


FUNCTION point_in_polygon(px, pz, polygon):
  # Ray casting algorithm for point-in-polygon
  inside = FALSE
  n = len(polygon)
  j = n - 1
  FOR i = 0 TO n - 1:
    xi = polygon[i].x; zi = polygon[i].z
    xj = polygon[j].x; zj = polygon[j].z
    IF ((zi > pz) != (zj > pz)) AND (px < (xj - xi) * (pz - zi) / (zj - zi) + xi):
      inside = NOT inside
    j = i
  RETURN inside
```

### A4.2 Fog Gate Trigger

```
CONSTANTS:
  FOG_GATE_DURATION    = 3.0     # seconds
  FOG_GATE_PEAK_DENSITY = 0.06   # temporary atmospheric fog density

FUNCTION trigger_district_transition(from_id, to_id):
  # 1. Fog gate (see atmosphere/ALGORITHM_Atmosphere.md A12)
  atmosphere.on_district_changed(from_id, to_id)

  # 2. Audio crossfade
  start_audio_crossfade(from_id, to_id)

  # 3. Particle type transition
  # Handled by atmosphere particle system: new spawns use new district config

  # 4. Citizen population swap (masked by fog gate)
  schedule_citizen_swap(from_id, to_id, delay=FOG_GATE_DURATION * 0.3)
```

### A4.3 Audio Crossfade

```
CONSTANTS:
  AUDIO_CROSSFADE_DURATION = 2.0  # seconds
  AUDIO_OVERLAP_FACTOR     = 0.3  # both audible for 30% of crossfade

STRUCT DistrictAudio:
  source: AudioSource
  volume: float
  target_volume: float

STATE:
  active_audio: Map<string, DistrictAudio>

FUNCTION start_audio_crossfade(from_id, to_id):
  # Fade out departing district
  IF from_id IN active_audio:
    active_audio[from_id].target_volume = 0.0

  # Fade in arriving district
  IF to_id NOT IN active_audio:
    audio = load_district_ambient(to_id)
    active_audio[to_id] = DistrictAudio { source: audio, volume: 0.0, target_volume: 1.0 }
    audio.play()
  ELSE:
    active_audio[to_id].target_volume = 1.0


FUNCTION update_audio_crossfade(delta_time):
  fade_speed = 1.0 / AUDIO_CROSSFADE_DURATION

  FOR each district_id, audio IN active_audio:
    IF audio.volume < audio.target_volume:
      # Delay fade-in by OVERLAP_FACTOR to create overlap
      audio.volume = min(audio.volume + fade_speed * delta_time, audio.target_volume)
    ELSE IF audio.volume > audio.target_volume:
      audio.volume = max(audio.volume - fade_speed * delta_time, audio.target_volume)

    audio.source.setVolume(audio.volume)

    # Cleanup: remove fully faded-out audio
    IF audio.volume <= 0.0 AND audio.target_volume <= 0.0:
      audio.source.stop()
      active_audio.REMOVE(district_id)
```

---

## A5. Gondola System

### A5.1 Data Structures

```
STRUCT GondolaDock:
  id: string
  position: vec3               # world position of mooring pole
  district: string
  trigger_radius: float        # meters -- visitor proximity to show prompt
  linked_routes: List<string>  # route IDs that depart from this dock

STRUCT GondolaRoute:
  id: string
  origin_dock: string
  destination_dock: string
  spline: CatmullRomCurve3     # authored control points along canals
  total_length: float          # meters
  duration: float              # seconds at GONDOLA_SPEED

STRUCT GondolaInstance:
  route: GondolaRoute
  mesh: Group                  # hull + gondolier silhouette
  t: float                     # 0.0 - 1.0, position along spline
  state: enum                  # IDLE, BOARDING, MOVING, ARRIVING, DISEMBARKING

CONSTANTS:
  GONDOLA_SPEED      = 4.0     # meters per second
  GONDOLA_BOARD_TIME = 1.5     # seconds for boarding transition
  GONDOLA_IDLE_BOB   = 0.05    # meters, vertical bob amplitude when idle
  DOCK_TRIGGER_RADIUS = 4.0    # meters

GONDOLA_ROUTES = [
  {
    id: "grand_canal_main",
    origin_dock: "rialto_dock_north",
    destination_dock: "san_marco_dock_east",
    spline: CatmullRomCurve3([
      vec3(420, 0.1, 380),      # Rialto departure
      vec3(460, 0.1, 400),      # first bend
      vec3(520, 0.1, 450),      # mid canal
      vec3(580, 0.1, 500),      # approach San Marco basin
      vec3(620, 0.1, 520),      # San Marco arrival
    ]),
  },
  # ... additional routes similarly defined
]
```

### A5.2 Dock Proximity and Boarding Prompt

```
STATE:
  nearest_dock: GondolaDock = NULL
  prompt_visible: bool = FALSE
  active_gondola: GondolaInstance = NULL

FUNCTION update_dock_proximity(visitor_position, docks):
  nearest_dock = NULL
  best_dist = INFINITY

  FOR each dock IN docks:
    dist = distance_xz(visitor_position, dock.position)
    IF dist < dock.trigger_radius AND dist < best_dist:
      best_dist = dist
      nearest_dock = dock

  IF nearest_dock != NULL AND active_gondola == NULL:
    show_board_prompt(nearest_dock)
    prompt_visible = TRUE
  ELSE:
    IF prompt_visible:
      hide_board_prompt()
      prompt_visible = FALSE


FUNCTION show_board_prompt(dock):
  # World-anchored text, not screen overlay
  prompt_text.text = "Board"
  prompt_text.position = vec3(dock.position.x, dock.position.y + 1.8, dock.position.z)
  prompt_text.lookAt(camera.position)   # face visitor
  prompt_text.visible = TRUE

FUNCTION hide_board_prompt():
  prompt_text.visible = FALSE
```

### A5.3 Boarding State Machine

```
ENUM GondolaState:
  IDLE            # gondola at dock, bobbing
  BOARDING        # visitor transitioning to seated position
  MOVING          # gondola traveling along spline
  ARRIVING        # gondola decelerating at destination
  DISEMBARKING    # visitor transitioning to standing on fondamenta

FUNCTION board_gondola(dock):
  IF active_gondola != NULL: RETURN   # already on a gondola

  route = pick_route(dock)
  IF route == NULL: RETURN   # no route from this dock

  gondola = spawn_gondola(route)
  active_gondola = gondola
  active_gondola.state = BOARDING

  # Disable normal movement
  disable_visitor_locomotion()
  hide_board_prompt()

  # Transition visitor to seated position
  target_seat = gondola.mesh.position + vec3(0, 0.4, 0)   # seated height
  start_position_transition(visitor_position, target_seat, GONDOLA_BOARD_TIME, on_complete=LAMBDA:
    active_gondola.state = MOVING
    active_gondola.t = 0.0
  )


FUNCTION pick_route(dock):
  # Pick first available route from this dock
  FOR each route_id IN dock.linked_routes:
    route = GONDOLA_ROUTES.find(r => r.id == route_id)
    IF route != NULL: RETURN route
  RETURN NULL


FUNCTION spawn_gondola(route):
  mesh = generate_gondola_mesh()   # hull + gondolier silhouette
  start_pos = route.spline.getPointAt(0)
  mesh.position.copy(start_pos)

  # Orient along spline tangent
  tangent = route.spline.getTangentAt(0)
  mesh.rotation.y = atan2(tangent.x, tangent.z)

  scene.ADD(mesh)

  RETURN GondolaInstance {
    route: route,
    mesh: mesh,
    t: 0.0,
    state: IDLE,
  }
```

### A5.4 Spline Travel

```
CONSTANTS:
  GONDOLA_BOB_FREQUENCY = 0.8    # Hz
  GONDOLA_BOB_AMPLITUDE = 0.04   # meters
  GONDOLA_ROLL_AMPLITUDE = 0.015 # radians, slight side-to-side roll
  GONDOLA_DECEL_ZONE    = 0.05   # last 5% of spline: decelerate

FUNCTION update_gondola(delta_time, real_time_ms):
  IF active_gondola == NULL: RETURN

  g = active_gondola

  SWITCH g.state:
    IDLE:
      # Bob in place
      g.mesh.position.y = 0.1 + sin(real_time_ms * 0.001 * GONDOLA_BOB_FREQUENCY * TWO_PI) * GONDOLA_IDLE_BOB
      RETURN

    BOARDING:
      # Handled by position transition callback
      RETURN

    MOVING:
      # Advance along spline
      speed = GONDOLA_SPEED

      # Decelerate near destination
      remaining = 1.0 - g.t
      IF remaining < GONDOLA_DECEL_ZONE:
        decel_factor = remaining / GONDOLA_DECEL_ZONE
        speed *= max(decel_factor, 0.1)

      dt = (speed * delta_time) / g.route.total_length
      g.t = min(g.t + dt, 1.0)

      # Position on spline
      pos = g.route.spline.getPointAt(g.t)
      tangent = g.route.spline.getTangentAt(g.t)

      # Apply water bob and roll
      bob_y = sin(real_time_ms * 0.001 * GONDOLA_BOB_FREQUENCY * TWO_PI) * GONDOLA_BOB_AMPLITUDE
      roll = sin(real_time_ms * 0.001 * GONDOLA_BOB_FREQUENCY * 0.7 * TWO_PI) * GONDOLA_ROLL_AMPLITUDE

      g.mesh.position = vec3(pos.x, pos.y + bob_y, pos.z)
      g.mesh.rotation.y = atan2(tangent.x, tangent.z)
      g.mesh.rotation.z = roll

      # Attach visitor camera to gondola
      update_gondola_camera(g)

      # Check for district transition during ride
      check_district_transition(g.mesh.position)

      # Check if arrived
      IF g.t >= 1.0:
        g.state = ARRIVING
        begin_disembark(g)

    ARRIVING:
      # Handled by disembark sequence
      RETURN

    DISEMBARKING:
      # Handled by position transition callback
      RETURN


FUNCTION update_gondola_camera(gondola):
  # Camera rides with gondola at seated eye height
  SEATED_EYE_HEIGHT = 1.1   # meters above gondola deck (seated position)

  # Desktop: camera position locks to gondola, look direction is free
  camera.position = gondola.mesh.position + vec3(0, SEATED_EYE_HEIGHT, 0)
  # Yaw and pitch still controlled by mouse/headset -- visitor can look around

  # VR: dolly position tracks gondola
  dolly.position = gondola.mesh.position
  # Headset rotation is free
```

### A5.5 Disembarking

```
CONSTANTS:
  DISEMBARK_DURATION = 1.2   # seconds

FUNCTION begin_disembark(gondola):
  gondola.state = DISEMBARKING

  # Find destination dock fondamenta position
  dest_dock = find_dock(gondola.route.destination_dock)
  fondamenta_pos = dest_dock.position + vec3(0, FONDAMENTA_HEIGHT, 0)

  # Smooth transition from seated to standing
  VISITOR_EYE_HEIGHT = 1.65
  start_position_transition(
    from: camera.position,
    to: vec3(fondamenta_pos.x, fondamenta_pos.y + VISITOR_EYE_HEIGHT, fondamenta_pos.z),
    duration: DISEMBARK_DURATION,
    on_complete: LAMBDA:
      # Restore normal movement
      position = fondamenta_pos
      last_valid_position = fondamenta_pos
      enable_visitor_locomotion()

      # Clean up gondola (despawn after delay or leave at dock)
      gondola.state = IDLE
      gondola.mesh.position = dest_dock.position + vec3(0, 0.1, 0)
      schedule(60.0, LAMBDA: despawn_gondola(gondola))
      active_gondola = NULL
  )


FUNCTION start_position_transition(from, to, duration, on_complete):
  # Smooth interpolation of position over time
  transition = {
    from: from,
    to: to,
    elapsed: 0,
    duration: duration,
    on_complete: on_complete,
  }
  active_position_transition = transition


FUNCTION update_position_transition(delta_time):
  t = active_position_transition
  IF t == NULL: RETURN

  t.elapsed += delta_time
  progress = clamp(t.elapsed / t.duration, 0, 1)
  eased = smoothstep(0, 1, progress)

  position = vec3.lerp(t.from, t.to, eased)

  # Apply to camera/dolly
  camera.position = position

  IF progress >= 1.0:
    t.on_complete()
    active_position_transition = NULL
```

---

## A6. Bridge Traversal

### A6.1 Elevation on Bridge Surface

```
# Bridge collision is handled by the standard ground raycast (A1.3 / A2.1).
# The bridge deck is marked userData.walkable = TRUE and has arch geometry.
# No special bridge code is needed for basic traversal -- the raycast
# naturally follows the arch surface, raising and lowering the visitor.

# The following handles bridge-specific behaviors:

CONSTANTS:
  BRIDGE_PEAK_VIEW_BONUS = 2.0   # meters -- sightline advantage at peak
  BRIDGE_DISTRICT_CHECK  = TRUE  # check district transition at bridge peak

FUNCTION on_bridge_surface_detected(hit, visitor_position):
  # Called when ground raycast hits a bridge deck (identified by mesh tag)
  bridge = hit.object.userData.bridge_ref

  IF bridge == NULL: RETURN

  # Track progress along bridge (0 = one end, 1 = other end)
  bridge_start = bridge.endpoint_a
  bridge_end = bridge.endpoint_b
  bridge_vec = bridge_end - bridge_start
  bridge_length = length(bridge_vec)
  bridge_dir = normalize(bridge_vec)

  visitor_offset = visitor_position - bridge_start
  progress = dot_xz(visitor_offset, bridge_dir) / bridge_length
  progress = clamp(progress, 0.0, 1.0)

  # Near peak (0.4 - 0.6): potential district transition
  IF BRIDGE_DISTRICT_CHECK AND progress > 0.4 AND progress < 0.6:
    IF bridge.connects_districts:
      check_district_transition(visitor_position)
```

### A6.2 Bridge Navmesh Integration

```
# Bridges are part of the walkable navmesh but require connectivity data
# so that pathfinding (for citizen AI) knows which fondamenta segments
# bridges connect.

STRUCT BridgeConnection:
  bridge_id: string
  fondamenta_a: string         # fondamenta segment on side A
  fondamenta_b: string         # fondamenta segment on side B
  peak_height: float           # Y at bridge apex
  district_a: string           # district on side A
  district_b: string           # district on side B (may be same)

FUNCTION build_bridge_navmesh(bridges, fondamenta_segments, districts):
  connections = []

  FOR each bridge IN bridges:
    # Find the two fondamenta segments this bridge connects
    endpoint_a = bridge.endpoint_a
    endpoint_b = bridge.endpoint_b

    fond_a = find_nearest_fondamenta(endpoint_a, fondamenta_segments, max_dist=5.0)
    fond_b = find_nearest_fondamenta(endpoint_b, fondamenta_segments, max_dist=5.0)

    IF fond_a == NULL OR fond_b == NULL:
      CONTINUE   # orphan bridge -- skip

    district_a = find_containing_district(endpoint_a, districts)
    district_b = find_containing_district(endpoint_b, districts)

    connection = BridgeConnection {
      bridge_id: bridge.id,
      fondamenta_a: fond_a.id,
      fondamenta_b: fond_b.id,
      peak_height: bridge.arch_height + FONDAMENTA_HEIGHT,
      district_a: district_a,
      district_b: district_b,
    }

    connections.PUSH(connection)
    bridge.userData.bridge_ref = connection
    bridge.userData.connects_districts = (district_a != district_b)

  RETURN connections
```

---

## A7. Comfort System (VR)

### A7.1 Locomotion Vignette

```
CONSTANTS:
  VIGNETTE_MAX_OPACITY  = 0.30     # peripheral darkening at edges
  VIGNETTE_FADE_IN_MS   = 150      # ms to reach full opacity
  VIGNETTE_FADE_OUT_MS  = 200      # ms to return to zero
  VIGNETTE_INNER_RADIUS = 0.40     # normalized screen-space
  VIGNETTE_OUTER_RADIUS = 0.90

STATE:
  locomotion_vignette_opacity: float = 0.0
  locomotion_vignette_target: float = 0.0

FUNCTION activate_vignette():
  locomotion_vignette_target = VIGNETTE_MAX_OPACITY

FUNCTION deactivate_vignette():
  locomotion_vignette_target = 0.0

FUNCTION update_locomotion_vignette(delta_time):
  IF locomotion_vignette_opacity < locomotion_vignette_target:
    rate = VIGNETTE_MAX_OPACITY / (VIGNETTE_FADE_IN_MS / 1000.0)
    locomotion_vignette_opacity = min(
      locomotion_vignette_opacity + rate * delta_time,
      locomotion_vignette_target
    )
  ELSE IF locomotion_vignette_opacity > locomotion_vignette_target:
    rate = VIGNETTE_MAX_OPACITY / (VIGNETTE_FADE_OUT_MS / 1000.0)
    locomotion_vignette_opacity = max(
      locomotion_vignette_opacity - rate * delta_time,
      locomotion_vignette_target
    )

  IF locomotion_vignette_opacity < 0.005:
    vignette_mesh.visible = FALSE
    RETURN

  vignette_mesh.visible = TRUE
  vignette_mesh.material.uniforms.opacity = locomotion_vignette_opacity
  vignette_mesh.material.uniforms.innerRadius = VIGNETTE_INNER_RADIUS
  vignette_mesh.material.uniforms.outerRadius = VIGNETTE_OUTER_RADIUS

# Vignette mesh: full-screen quad rendered in VR eye space.
# Fragment shader:
#   dist = length(uv - vec2(0.5)) * 2.0
#   fade = smoothstep(innerRadius, outerRadius, dist)
#   gl_FragColor = vec4(0.0, 0.0, 0.0, opacity * fade)
# Rendered with depth test disabled, after scene, before UI.
```

### A7.2 Teleport Comfort Fade

```
STRUCT ScreenFade:
  opacity: float = 0.0
  target: float = 0.0
  duration: float
  elapsed: float = 0.0
  on_complete: Function = NULL
  active: bool = FALSE

STATE:
  screen_fade: ScreenFade

FUNCTION start_screen_fade(to_black, duration, on_complete):
  screen_fade.target = 1.0 IF to_black ELSE 0.0
  screen_fade.duration = duration / 1000.0   # convert ms to seconds
  screen_fade.elapsed = 0.0
  screen_fade.on_complete = on_complete
  screen_fade.active = TRUE

FUNCTION update_screen_fade(delta_time):
  IF NOT screen_fade.active: RETURN

  screen_fade.elapsed += delta_time
  progress = clamp(screen_fade.elapsed / screen_fade.duration, 0, 1)

  IF screen_fade.target > 0.5:
    # Fading to black
    screen_fade.opacity = progress
  ELSE:
    # Fading from black
    screen_fade.opacity = 1.0 - progress

  fade_quad.material.opacity = screen_fade.opacity
  fade_quad.visible = (screen_fade.opacity > 0.001)

  IF progress >= 1.0:
    screen_fade.active = FALSE
    IF screen_fade.on_complete != NULL:
      screen_fade.on_complete()
      screen_fade.on_complete = NULL

# Fade quad: full-screen black plane rendered closest to camera.
# In VR: one quad per eye, parented to camera rig at near-clip distance.
# Material: MeshBasicMaterial, color=black, transparent=true, depthTest=false.
```

### A7.3 Snap Turn Comfort

```
# Snap turn is inherently comfortable (no smooth rotation).
# The instantaneous angle change prevents the vestibular mismatch
# that causes nausea during smooth rotation.

# Additional comfort measure: brief vignette flash on snap turn.

FUNCTION apply_snap_turn_comfort(angle):
  # Brief vignette pulse: 50ms flash at 50% opacity, then fade out over 150ms
  locomotion_vignette_opacity = VIGNETTE_MAX_OPACITY * 0.5
  locomotion_vignette_target = 0.0
  # The standard vignette fade-out will handle the decay
```

### A7.4 Height Calibration

```
CONSTANTS:
  DEFAULT_EYE_HEIGHT = 1.65       # meters, used if calibration fails
  CALIBRATION_SAMPLES = 30        # frames to average
  MIN_EYE_HEIGHT = 0.8            # seated minimum
  MAX_EYE_HEIGHT = 2.1            # standing maximum

STATE:
  calibrated_height: float = DEFAULT_EYE_HEIGHT
  calibration_samples: List<float>
  calibration_complete: bool = FALSE

FUNCTION calibrate_height(headset_y_local):
  # Called each frame during first CALIBRATION_SAMPLES frames of session
  IF calibration_complete: RETURN

  calibration_samples.PUSH(headset_y_local)

  IF len(calibration_samples) >= CALIBRATION_SAMPLES:
    # Use median (not mean) to reject outliers from headset settling
    sorted = sort(calibration_samples)
    median = sorted[len(sorted) / 2]

    calibrated_height = clamp(median, MIN_EYE_HEIGHT, MAX_EYE_HEIGHT)
    calibration_complete = TRUE

    # Adjust dolly Y so that visitor eye level matches calibrated height
    # relative to the fondamenta surface
    # No adjustment needed if headset tracking is world-relative --
    # the dolly sits on the ground and headset Y is the real eye height.
```

---

## A8. Master Navigation Update Loop

Called every frame. Orchestrates all navigation subsystems.

```
CONSTANTS:
  VISITOR_EYE_HEIGHT = 1.65   # desktop camera height above ground

FUNCTION update_navigation(delta_time, real_time_ms, input_state, is_vr):
  # --- 1. Gondola update (if riding) ---
  IF active_gondola != NULL:
    update_gondola(delta_time, real_time_ms)
    update_position_transition(delta_time)
    IF is_vr:
      update_screen_fade(delta_time)
    RETURN   # skip normal locomotion while on gondola

  # --- 2. Compute displacement ---
  IF is_vr:
    displacement = compute_vr_displacement(input_state, delta_time)
    update_snap_turn(input_state.right_stick_x, real_time_ms)
    update_teleport_aim(input_state.right_controller, input_state.right_trigger)
  ELSE:
    displacement = compute_desktop_movement(delta_time)

  # --- 3. Wall collision (horizontal) ---
  proposed = position + displacement
  proposed = resolve_building_collision(position, proposed, collision_world)

  # --- 4. Water barrier (prevent walking on water) ---
  proposed = enforce_water_barrier(position, proposed, collision_world)

  # --- 5. Ground snap (vertical) ---
  IF is_vr:
    # For VR, raycast from headset world position
    headset_world_xz = dolly.position + headset.position
    ray_origin = vec3(proposed.x + headset.position.x, proposed.y + RAYCAST_HEIGHT, proposed.z + headset.position.z)
  ELSE:
    ray_origin = vec3(proposed.x, proposed.y + RAYCAST_HEIGHT, proposed.z)

  hit = raycast(ray_origin, vec3(0, -1, 0), RAYCAST_MAX_DIST, collision_world.walkable_bvh)

  IF hit != NULL:
    ground_y = hit.point.y
    height_diff = ground_y - position.y

    IF height_diff > STEP_HEIGHT:
      # Wall-like step -- resolve
      proposed = resolve_building_collision(position, proposed, collision_world)
      position = last_valid_position
    ELSE:
      IF is_vr:
        dolly.position = vec3(proposed.x, ground_y, proposed.z)
      ELSE:
        position = vec3(proposed.x, ground_y, proposed.z)
        camera.position = vec3(position.x, position.y + VISITOR_EYE_HEIGHT, position.z)
      last_valid_position = position

    # Check if on bridge
    IF hit.object.userData.bridge_ref != NULL:
      on_bridge_surface_detected(hit, position)
  ELSE:
    # No ground -- revert to last valid
    position = last_valid_position
    IF is_vr:
      dolly.position = last_valid_position
    ELSE:
      camera.position = vec3(position.x, position.y + VISITOR_EYE_HEIGHT, position.z)

  # --- 6. Fall recovery ---
  position = check_fall_recovery(position, collision_world)

  # --- 7. District transition ---
  check_district_transition(position)

  # --- 8. Dock proximity ---
  update_dock_proximity(position, gondola_docks)

  # --- 9. VR comfort systems ---
  IF is_vr:
    update_locomotion_vignette(delta_time)
    update_screen_fade(delta_time)
    IF NOT calibration_complete:
      calibrate_height(headset.position.y)

  # --- 10. Audio crossfade ---
  update_audio_crossfade(delta_time)

  # --- 11. Desktop camera rotation ---
  IF NOT is_vr:
    camera.rotation.set(pitch, yaw, 0, "YXZ")


FUNCTION compute_vr_displacement(input_state, delta_time):
  # Continuous locomotion from left stick
  stick = input_state.left_stick
  IF abs(stick.x) < DEADZONE AND abs(stick.y) < DEADZONE:
    deactivate_vignette()
    RETURN vec3(0, 0, 0)

  activate_vignette()

  input = vec2(stick.x, stick.y)
  IF length(input) > 1.0: input = normalize(input)

  headset_forward = get_headset_forward_xz()
  headset_right = vec3(headset_forward.z, 0, -headset_forward.x)

  move_dir = headset_forward * (-input.y) + headset_right * input.x
  IF length(move_dir) > 0.001:
    move_dir = normalize(move_dir)

  displacement = move_dir * VR_WALK_SPEED * length(input) * delta_time
  RETURN displacement
```

---

## A9. Input Action Handling (Board/Interact)

```
CONSTANTS:
  INTERACT_KEY_DESKTOP = "e"
  INTERACT_BUTTON_VR   = "trigger_right"   # or A button, resolved per-controller

FUNCTION handle_interact(input_state, is_vr):
  # Desktop: E key press
  # VR: right trigger full press (when NOT in teleport mode)

  IF is_vr:
    interact_pressed = input_state.right_trigger > 0.8 AND NOT teleport_active
  ELSE:
    interact_pressed = "e" IN just_pressed_keys

  IF NOT interact_pressed: RETURN

  # Priority 1: board gondola
  IF nearest_dock != NULL AND active_gondola == NULL:
    board_gondola(nearest_dock)
    RETURN

  # Priority 2: future interactions (talk to citizen, open door, etc.)
  # Reserved for V2
```

---

## A10. Utility Functions

Shared helpers referenced throughout the navigation system.

```
FUNCTION distance_xz(a, b):
  dx = a.x - b.x
  dz = a.z - b.z
  RETURN sqrt(dx * dx + dz * dz)

FUNCTION dot_xz(a, b):
  RETURN a.x * b.x + a.z * b.z

FUNCTION normalize(v):
  len = length(v)
  IF len < 0.0001: RETURN vec3(0, 0, 0)
  RETURN vec3(v.x / len, v.y / len, v.z / len)

FUNCTION length(v):
  RETURN sqrt(v.x * v.x + v.y * v.y + v.z * v.z)

FUNCTION rotate_y(v, angle):
  c = cos(angle)
  s = sin(angle)
  RETURN vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c)

FUNCTION smoothstep(edge0, edge1, x):
  t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)
  RETURN t * t * (3.0 - 2.0 * t)

FUNCTION clamp(x, lo, hi):
  RETURN max(lo, min(hi, x))

FUNCTION lerp(a, b, t):
  RETURN a + (b - a) * t

FUNCTION get_headset_forward_xz():
  # Extract forward direction from headset orientation, project onto XZ plane
  forward = headset.getWorldDirection(vec3())
  forward.y = 0
  RETURN normalize(forward)

FUNCTION get_default_spawn_position():
  # Rialto dock -- a safe known walkable position
  RETURN vec3(420, FONDAMENTA_HEIGHT, 380)

FUNCTION disable_visitor_locomotion():
  locomotion_enabled = FALSE

FUNCTION enable_visitor_locomotion():
  locomotion_enabled = TRUE

FUNCTION schedule(delay_seconds, callback):
  # Execute callback after delay
  setTimeout(callback, delay_seconds * 1000)

FUNCTION despawn_gondola(gondola):
  scene.REMOVE(gondola.mesh)
  gondola.mesh.geometry.dispose()
  gondola.mesh.material.dispose()
```
