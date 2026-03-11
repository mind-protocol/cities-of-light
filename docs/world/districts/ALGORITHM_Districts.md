# ALGORITHM: world/districts — How It Works

Pseudocode for every generation subsystem. No code — procedural descriptions with data flows.

---

## A1. Coordinate Mapping: Airtable Geo to World Space

Serenissima stores building/citizen positions as real Venice lat/lng. We project them into Three.js world coordinates.

```
CONSTANTS:
  VENICE_LAT_MIN = 45.4250
  VENICE_LAT_MAX = 45.4480
  VENICE_LNG_MIN = 12.3080
  VENICE_LNG_MAX = 12.3680

  WORLD_WIDTH  = 800   # Three.js units along X axis
  WORLD_DEPTH  = 600   # Three.js units along Z axis
  WORLD_Y      = 0.5   # Default ground height (above water at y=0)

FUNCTION geo_to_world(lat, lng):
  # Linear projection. Venice is small enough that Mercator distortion is negligible.
  x = (lng - VENICE_LNG_MIN) / (VENICE_LNG_MAX - VENICE_LNG_MIN) * WORLD_WIDTH
  z = (1 - (lat - VENICE_LAT_MIN) / (VENICE_LAT_MAX - VENICE_LAT_MIN)) * WORLD_DEPTH
  # Flip Z: higher latitude = lower Z (north is "forward" into the screen)
  RETURN { x, y: WORLD_Y, z }

FUNCTION world_to_geo(x, z):
  lng = (x / WORLD_WIDTH) * (VENICE_LNG_MAX - VENICE_LNG_MIN) + VENICE_LNG_MIN
  lat = (1 - z / WORLD_DEPTH) * (VENICE_LAT_MAX - VENICE_LAT_MIN) + VENICE_LAT_MIN
  RETURN { lat, lng }
```

Scale: 1 Three.js unit ~ 0.075m real (at WORLD_WIDTH=800 for ~600m of Venice). This is too compressed. Adjusted scale:

```
ADJUSTED:
  # Venice centro storico is roughly 1.5km x 1.2km
  # At 1 unit = 1 meter, we'd need a 1500x1200 world
  # That's fine for Three.js. Buildings are ~10-15m wide = 10-15 units.
  WORLD_SCALE = 1.0   # 1 unit = 1 meter

  WORLD_WIDTH  = 1500
  WORLD_DEPTH  = 1200

  # With this scale, a citizen walking at 1.4 m/s takes ~17 minutes to cross the city.
  # That's realistic for Venice on foot.
```

---

## A2. District Definition

Each district is a polygon in world space defining its boundary. Buildings, canals, and props inside the polygon belong to that district.

```
DISTRICT_DEFINITIONS = {
  "rialto": {
    id: "rialto",
    name: "Rialto",
    center: geo_to_world(45.4381, 12.3358),
    boundary: [                              # Convex polygon, world coords
      geo_to_world(45.4405, 12.3305),
      geo_to_world(45.4405, 12.3420),
      geo_to_world(45.4355, 12.3420),
      geo_to_world(45.4355, 12.3305),
    ],
    config: {
      building_height_range: [8, 16],        # meters (3-5 stories)
      building_decoration: 0.3,              # 0=plain, 1=ornate
      street_width: 2.5,                     # meters
      canal_width_range: [5, 10],            # meters
      prop_types: ["market_stall", "crate", "barrel", "awning", "rope_coil"],
      material_palette: ["ochre", "faded_red", "grey_stone", "worn_plaster"],
      fog_tint: 0x8a7a60,
      ambient_density: 0.8,                  # citizen crowd density factor
    }
  },

  "san_marco": {
    center: geo_to_world(45.4340, 12.3388),
    config: {
      building_height_range: [12, 22],
      building_decoration: 0.9,
      street_width: 5.0,
      canal_width_range: [15, 30],
      prop_types: ["column", "bench", "well_head", "flagpole", "guard_post"],
      material_palette: ["white_marble", "pale_gold", "rose_marble"],
      fog_tint: 0xc0b090,
      ambient_density: 0.4,
    }
  },

  # ... castello, dorsoduro, cannaregio, santa_croce, certosa similarly defined
}
```

---

## A3. Canal Generation (Bezier Curves)

Canals are the skeleton. Everything else fits around them.

### Grand Canal

```
FUNCTION generate_grand_canal():
  # The Grand Canal is an S-curve through Venice. Defined as a cubic Bezier path.
  # 4 control points traced from Venice's actual Grand Canal shape.

  control_points = [
    geo_to_world(45.4445, 12.3190),   # Northwest entry (Piazzale Roma area)
    geo_to_world(45.4400, 12.3300),   # First bend (near train station)
    geo_to_world(45.4360, 12.3380),   # Rialto Bridge area (center)
    geo_to_world(45.4310, 12.3450),   # Southeast exit (toward San Marco basin)
  ]

  path = new CubicBezierCurve3(control_points)
  canal_width = 30    # meters at widest

  # Sample path at N points
  N = 100
  samples = []
  FOR i = 0 TO N:
    t = i / N
    point = path.getPointAt(t)
    tangent = path.getTangentAt(t)
    normal = { x: -tangent.z, z: tangent.x }  # perpendicular in XZ plane

    # Width varies slightly along the canal
    width = canal_width * (0.8 + 0.2 * sin(t * PI * 3))

    samples.PUSH({
      center: point,
      left:  point + normal * width/2,
      right: point - normal * width/2,
    })

  RETURN samples
```

### Major Canals (Per District)

```
FUNCTION generate_district_canals(district):
  canals = []
  seed = hash(district.id)

  # Each district gets 2-3 major canals branching off the Grand Canal
  # or running parallel to it.
  branch_count = 2 + (seed % 2)

  FOR i = 0 TO branch_count:
    # Start point: a random position on the district's Grand Canal edge
    start = random_point_on_boundary(district, "grand_canal_side", seed + i)

    # End point: somewhere inside the district, toward the far edge
    end = district.center + random_offset(seed + i * 7, district.config.canal_width_range[1] * 3)

    # Midpoint with offset for curve
    mid = lerp(start, end, 0.5) + perpendicular_offset(start, end, seed + i * 13)

    path = new QuadraticBezierCurve3(start, mid, end)
    width = random_in_range(district.config.canal_width_range, seed + i * 17)

    canals.PUSH({ path, width, district: district.id })

  RETURN canals
```

### Minor Canals (Rii)

```
FUNCTION generate_minor_canals(district, major_canals):
  rii = []
  seed = hash(district.id + "_rii")

  # Minor canals connect major canals or dead-end into building blocks
  rii_count = 4 + (seed % 4)

  FOR i = 0 TO rii_count:
    # Pick two major canal edges to connect, or one edge + a dead end
    type = (seed + i) % 3   # 0=connects two canals, 1=connects canal to boundary, 2=dead end

    IF type == 0:
      start = random_point_on_canal(major_canals[i % len(major_canals)], seed + i)
      end = random_point_on_canal(major_canals[(i+1) % len(major_canals)], seed + i + 1)
    ELSE IF type == 1:
      start = random_point_on_canal(major_canals[i % len(major_canals)], seed + i)
      end = random_point_on_boundary(district, "any", seed + i + 1)
    ELSE:
      start = random_point_on_canal(major_canals[i % len(major_canals)], seed + i)
      end = start + random_direction(seed + i) * random_in_range([20, 60], seed + i)

    path = new LineCurve3(start, end)   # Rii are mostly straight
    width = random_in_range([4, 8], seed + i * 23)

    rii.PUSH({ path, width, district: district.id })

  RETURN rii
```

---

## A4. Canal → Geometry

```
FUNCTION build_canal_geometry(canal_samples, water_y = 0):
  # Canal is a ribbon of water between two fondamenta (walkways)

  # 1. Water surface
  water_vertices = []
  water_indices = []
  FOR i = 0 TO len(canal_samples) - 1:
    s = canal_samples[i]
    water_vertices.PUSH(s.left.x,  water_y, s.left.z)
    water_vertices.PUSH(s.right.x, water_y, s.right.z)
    IF i > 0:
      # Quad between this sample and previous
      base = (i - 1) * 2
      water_indices.PUSH(base, base+1, base+2)
      water_indices.PUSH(base+1, base+3, base+2)

  water_mesh = new Mesh(BufferGeometry(water_vertices, water_indices), water_material)

  # 2. Canal walls (vertical faces from water to fondamenta height)
  FONDAMENTA_HEIGHT = 0.8  # meters above water
  wall_vertices = []
  FOR side IN ["left", "right"]:
    FOR i = 0 TO len(canal_samples) - 1:
      s = canal_samples[i]
      pos = s[side]
      # Bottom (water level)
      wall_vertices.PUSH(pos.x, water_y, pos.z)
      # Top (fondamenta level)
      wall_vertices.PUSH(pos.x, water_y + FONDAMENTA_HEIGHT, pos.z)
    # Generate triangle strip for this wall side

  # 3. Fondamenta (walkable surface along canal edge)
  FONDAMENTA_WIDTH = 3.0  # meters
  FOR side IN ["left", "right"]:
    fondamenta_vertices = []
    FOR i = 0 TO len(canal_samples) - 1:
      s = canal_samples[i]
      inner_edge = s[side]   # canal edge
      # Outer edge extends away from the canal
      direction = normalize(s.center - s[side]) if side == "left" else normalize(s[side] - s.center)
      outer_edge = inner_edge + direction * FONDAMENTA_WIDTH

      fondamenta_vertices.PUSH(inner_edge.x, FONDAMENTA_HEIGHT, inner_edge.z)
      fondamenta_vertices.PUSH(outer_edge.x,  FONDAMENTA_HEIGHT, outer_edge.z)

    fondamenta_mesh = new Mesh(BufferGeometry(fondamenta_vertices), stone_material)
    fondamenta_mesh.userData.walkable = TRUE

  RETURN { water: water_mesh, walls: wall_meshes, fondamenta: fondamenta_meshes }
```

---

## A5. Building Placement from Airtable Data

```
FUNCTION place_buildings(airtable_buildings, districts, canals):
  placed = []

  FOR each building_record IN airtable_buildings:
    pos = geo_to_world(building_record.lat, building_record.lng)
    district = find_containing_district(pos, districts)
    IF district == NULL: SKIP  # Outside Venice bounds

    # Check if position overlaps a canal
    IF is_inside_canal(pos, canals):
      # Snap to nearest fondamenta edge
      pos = snap_to_fondamenta(pos, canals)

    # Determine building parameters from Airtable data + district config
    params = {
      footprint_width:  building_size_to_width(building_record.size_tier),
      footprint_depth:  building_size_to_depth(building_record.size_tier),
      stories:          district.config.building_height_range,
      category:         building_record.category,   # home, business, transport, storage, maritime
      decoration:       district.config.building_decoration * owner_wealth_factor(building_record),
      seed:             hash(building_record.id),
      palette:          district.config.material_palette,
    }

    mesh = generate_venetian_building(params)
    mesh.position.copy(pos)

    # Orient building to face nearest canal or street
    facing = nearest_canal_direction(pos, canals) || nearest_street_direction(pos, placed)
    mesh.rotation.y = atan2(facing.x, facing.z)

    placed.PUSH({ mesh, record: building_record, district: district.id })

  RETURN placed


FUNCTION building_size_to_width(size_tier):
  SWITCH size_tier:
    "small":  RETURN random_in_range([5, 8])
    "medium": RETURN random_in_range([8, 12])
    "large":  RETURN random_in_range([12, 18])


FUNCTION owner_wealth_factor(building_record):
  # Wealthier owners = more decorated buildings
  IF building_record.owner == NULL: RETURN 0.5
  owner_ducats = lookup_citizen_ducats(building_record.owner)
  RETURN clamp(owner_ducats / 10000, 0.1, 1.0)
```

---

## A6. Procedural Building Generation

```
FUNCTION generate_venetian_building(params):
  { footprint_width, footprint_depth, stories, category, decoration, seed, palette } = params
  building = new Group()
  rng = seeded_random(seed)

  # Height
  story_height = 3.2 + rng() * 0.5   # 3.2-3.7m per story
  num_stories = random_int_in_range(stories, rng)
  total_height = num_stories * story_height

  # Base color from palette
  color_name = palette[floor(rng() * len(palette))]
  base_color = PALETTE_COLORS[color_name]
  # Slight per-building hue/brightness shift
  color = shift_color(base_color, rng() * 0.1 - 0.05, rng() * 0.1 - 0.05)

  # GROUND FLOOR
  IF category == "business" OR category == "storage":
    # Open arches (warehouse style)
    arch_count = floor(footprint_width / 3)
    FOR i = 0 TO arch_count:
      arch = generate_arch(width=2.5, height=3.0, depth=0.4)
      arch.position.x = (i - arch_count/2) * 3.0
      building.ADD(arch)
    # Solid wall between arches
    ground_wall = generate_wall_with_openings(footprint_width, story_height, arch_count, 2.5)
  ELSE:
    # Residential: solid wall with single door
    ground_wall = generate_solid_wall(footprint_width, story_height)
    door = generate_door(width=1.2, height=2.4, arched=rng() > 0.5)
    door.position.x = (rng() - 0.5) * footprint_width * 0.3  # Off-center
    building.ADD(door)

  ground_wall.material.color = darken(color, 0.15)  # Ground floor is darker (shadow/dirt)
  building.ADD(ground_wall)

  # UPPER FLOORS
  FOR floor_idx = 1 TO num_stories:
    floor_group = new Group()
    floor_group.position.y = floor_idx * story_height

    # Wall
    wall = generate_solid_wall(footprint_width, story_height)
    wall.material.color = color

    # Windows
    windows_per_floor = floor(footprint_width / 2.5)
    window_style = pick_window_style(decoration, rng)  # arched, rectangular, pointed, bifora

    FOR w = 0 TO windows_per_floor:
      window = generate_window(window_style, width=1.0, height=1.6)
      window.position.x = (w - windows_per_floor/2) * 2.5
      window.position.y = story_height * 0.5
      floor_group.ADD(window)

    # Optional balcony (higher decoration = more likely)
    IF rng() < decoration * 0.4 AND floor_idx > 1:
      balcony = generate_balcony(width=2.0, depth=0.6)
      balcony.position.y = story_height * 0.3
      floor_group.ADD(balcony)

    # Optional stringcourse (horizontal stone band between floors)
    IF decoration > 0.3:
      stringcourse = generate_box(footprint_width + 0.1, 0.15, 0.1)
      stringcourse.position.y = 0
      floor_group.ADD(stringcourse)

    building.ADD(floor_group)

  # ROOF
  # Venetian roofs are typically flat with chimney pots
  roof = generate_flat_roof(footprint_width, footprint_depth)
  roof.position.y = total_height
  building.ADD(roof)

  chimney_count = 1 + floor(rng() * 3)
  FOR c = 0 TO chimney_count:
    chimney = generate_chimney_pot()  # Distinctive Venetian truncated cone shape
    chimney.position.set(
      (rng() - 0.5) * footprint_width * 0.6,
      total_height + 0.8,
      (rng() - 0.5) * footprint_depth * 0.6
    )
    building.ADD(chimney)

  # DEPTH (sides + back — simplified boxes, no windows)
  sides = generate_building_sides(footprint_width, footprint_depth, total_height, color)
  building.ADD(sides)

  RETURN building
```

### Window Styles

```
FUNCTION generate_window(style, width, height):
  SWITCH style:
    "rectangular":
      frame = generate_box(width, height, 0.05)
      # Dark interior
      glass = generate_plane(width - 0.1, height - 0.1)
      glass.material = dark_glass_material
      RETURN group(frame, glass)

    "arched":
      # Rectangle with semicircle on top (Venetian standard)
      frame = generate_arch_shape(width, height, arch_ratio=0.3)
      glass = generate_arch_shape(width - 0.1, height - 0.1, arch_ratio=0.3)
      glass.material = dark_glass_material
      RETURN group(frame, glass)

    "pointed":
      # Gothic pointed arch (San Marco style)
      frame = generate_pointed_arch(width, height, peak_ratio=0.15)
      glass = generate_pointed_arch(width - 0.1, height - 0.1)
      glass.material = dark_glass_material
      RETURN group(frame, glass)

    "bifora":
      # Double window with central column (wealthy buildings)
      left_window = generate_window("arched", width * 0.45, height)
      right_window = generate_window("arched", width * 0.45, height)
      column = generate_cylinder(radius=0.04, height=height * 0.8)
      right_window.position.x = width * 0.5
      column.position.x = width * 0.25
      RETURN group(left_window, column, right_window)
```

---

## A7. Bridge Generation

Bridges connect fondamenta segments across canals.

```
FUNCTION generate_bridges(canals, fondamenta_network):
  bridges = []

  FOR each canal IN canals:
    # Determine bridge positions: every 60-120m along the canal
    canal_length = canal.path.getLength()
    bridge_spacing = random_in_range([60, 120], hash(canal.id))
    num_bridges = floor(canal_length / bridge_spacing)

    FOR i = 0 TO num_bridges:
      t = (i + 0.5) / (num_bridges + 1)  # Avoid placing at very start/end
      center = canal.path.getPointAt(t)
      tangent = canal.path.getTangentAt(t)
      # Bridge runs perpendicular to canal
      direction = { x: -tangent.z, z: tangent.x }

      bridge = generate_bridge_mesh(
        span = canal.width + 2.0,   # Overhang the fondamenta slightly
        width = 2.5,                # Pedestrian width
        arch_height = canal.width * 0.3,  # Arch proportional to canal width
        direction = direction
      )

      bridge.position.copy(center)
      bridge.position.y = FONDAMENTA_HEIGHT
      bridge.userData.walkable = TRUE
      bridges.PUSH(bridge)

  RETURN bridges


FUNCTION generate_bridge_mesh(span, width, arch_height, direction):
  # Venetian bridge: stone arch with steps on both sides

  # Arch curve (parabolic, not semicircular — Venetian bridges are lower)
  arch_points = []
  STEPS = 20
  FOR i = 0 TO STEPS:
    t = i / STEPS
    x = (t - 0.5) * span
    y = arch_height * (1 - (2*t - 1)^2)   # Parabola peaking at center
    arch_points.PUSH({ x, y })

  # Extrude arch curve along bridge width to create the deck
  deck_geometry = extrude_along_width(arch_points, width)

  # Side walls (low parapets)
  parapet_height = 0.7
  left_parapet = extrude_along_width(arch_points, 0.15)
  # Offset parapet up by parapet_height at each point
  right_parapet = same, offset in width direction

  # Steps: subdivide the incline portions into step geometry
  step_count = floor(arch_height / 0.18)  # ~18cm rise per step
  FOR each incline side (approach, departure):
    FOR s = 0 TO step_count:
      step = generate_box(width, 0.18, span / step_count / 2)
      # Position on the incline

  mesh = merge_geometries(deck, left_parapet, right_parapet, steps)
  mesh.material = stone_material  # Same as fondamenta
  orient_to_direction(mesh, direction)

  RETURN mesh
```

---

## A8. Procedural Gap-Fill

Airtable buildings don't cover every buildable lot. Empty space between placed buildings and canals looks wrong. Gap-fill adds procedural buildings.

```
FUNCTION fill_building_gaps(district, placed_buildings, canals):
  # 1. Create a 2D occupancy grid for the district
  CELL_SIZE = 5  # meters
  grid = new OccupancyGrid(district.boundary, CELL_SIZE)

  # Mark occupied cells
  FOR each building IN placed_buildings:
    grid.mark_occupied(building.footprint)
  FOR each canal IN canals:
    grid.mark_water(canal.ribbon)

  # 2. Find empty rectangular regions
  empty_lots = grid.find_empty_rectangles(min_width=5, min_depth=8, max_width=15, max_depth=20)

  # 3. Generate gap-fill buildings
  fill_buildings = []
  FOR each lot IN empty_lots:
    seed = hash(lot.x, lot.z)
    params = {
      footprint_width: lot.width,
      footprint_depth: lot.depth,
      stories: district.config.building_height_range,
      category: "home",       # Gap-fill buildings are residential
      decoration: district.config.building_decoration * 0.5,  # Less ornate
      seed: seed,
      palette: district.config.material_palette,
    }
    mesh = generate_venetian_building(params)
    mesh.position.set(lot.center.x, FONDAMENTA_HEIGHT, lot.center.z)
    fill_buildings.PUSH(mesh)

  RETURN fill_buildings
```

---

## A9. Prop Scattering

```
FUNCTION scatter_props(district, fondamenta_segments, placed_buildings):
  props = []

  FOR each segment IN fondamenta_segments:
    # Walk along the fondamenta and place district-appropriate props
    segment_length = segment.getLength()
    spacing = 8 + hash(segment.id) * 8  # 8-16m between props

    FOR t = 0 TO 1 STEP (spacing / segment_length):
      pos = segment.getPointAt(t)
      prop_type = pick_weighted(district.config.prop_types, hash(pos.x, pos.z))

      SWITCH prop_type:
        "market_stall":
          # Only near business buildings
          nearest_business = find_nearest_building(pos, placed_buildings, category="business")
          IF nearest_business AND distance(pos, nearest_business) < 10:
            stall = generate_market_stall(nearest_business.record.current_goods)
            stall.position.copy(pos)
            props.PUSH(stall)

        "lantern":
          lantern = generate_lantern()   # Cylinder + point light
          lantern.position.set(pos.x, FONDAMENTA_HEIGHT + 2.5, pos.z)
          props.PUSH(lantern)

        "crate":
          crate = generate_crate()       # Box with wood material
          crate.position.copy(pos)
          crate.position.y = FONDAMENTA_HEIGHT
          crate.rotation.y = hash(pos.x * 7, pos.z * 13) * PI * 2
          props.PUSH(crate)

        "boat":
          # Place in canal, not on fondamenta
          canal_pos = nearest_canal_surface(pos)
          IF canal_pos:
            boat = generate_gondola()
            boat.position.copy(canal_pos)
            boat.position.y = 0.1  # Slightly above water
            props.PUSH(boat)

  RETURN props
```

### Prop Geometry (Minimal)

```
FUNCTION generate_market_stall(goods_type):
  # 3 boxes + 1 cloth plane. Total: ~50 triangles
  stall = new Group()
  # Table: flat box
  table = generate_box(2.0, 0.8, 1.0)
  table.material = wood_material
  stall.ADD(table)
  # Legs: 4 thin cylinders
  FOR corner IN [(-0.9, -0.4), (0.9, -0.4), (-0.9, 0.4), (0.9, 0.4)]:
    leg = generate_cylinder(0.03, 0.8)
    leg.position.set(corner[0], 0.4, corner[1])
    stall.ADD(leg)
  # Awning: tilted plane
  awning = generate_plane(2.2, 1.2)
  awning.material = cloth_material(color_for_goods(goods_type))
  awning.position.set(0, 1.6, -0.3)
  awning.rotation.x = -0.3
  stall.ADD(awning)
  # Goods: small boxes or spheres on table
  goods = generate_goods_display(goods_type)  # 3-5 small meshes
  stall.ADD(goods)
  RETURN stall

FUNCTION generate_gondola():
  # Hull: elongated half-ellipsoid. ~100 triangles.
  hull_shape = new Shape()
  hull_shape.ellipse(0, 0, 5.0, 0.7, 0, TWO_PI)
  hull_geom = new ExtrudeGeometry(hull_shape, { depth: 0.4, bevelEnabled: false })
  # Squash bottom half
  # Add ferro (iron prow ornament): flat triangular shape at front
  # Add forcola (oarlock): small cylinder at rear
  RETURN group(hull, ferro, forcola)

FUNCTION generate_lantern():
  # Housing: octagonal prism. Candle: emissive cylinder. ~30 triangles.
  housing = new CylinderGeometry(0.12, 0.12, 0.3, 8)
  housing.material = iron_material
  candle = new CylinderGeometry(0.03, 0.03, 0.15, 4)
  candle.material = emissive_warm_material
  light = new PointLight(0xffaa44, 0.6, 8)  # Warm glow, 8m radius
  bracket = generate_box(0.04, 0.5, 0.04)   # Wall mount arm
  RETURN group(bracket, housing, candle, light)
```

---

## A10. LOD System

```
FUNCTION update_building_lod(buildings, visitor_position):
  FOR each building IN buildings:
    dist = distance_xz(building.position, visitor_position)

    IF dist < 40:
      target_lod = 0
    ELSE IF dist < 120:
      target_lod = 1
    ELSE IF dist < 300:
      target_lod = 2
    ELSE:
      target_lod = -1  # Hidden

    IF building.current_lod != target_lod:
      transition_building_lod(building, target_lod)


FUNCTION transition_building_lod(building, target_lod):
  # Remove current mesh from scene
  IF building.mesh:
    building.mesh.visible = FALSE
    # Don't dispose yet — cache for quick switch back

  IF target_lod == -1:
    RETURN  # Just hide

  # Generate or retrieve cached LOD mesh
  IF building.lod_cache[target_lod] == NULL:
    SWITCH target_lod:
      0: building.lod_cache[0] = building.full_mesh           # Already generated
      1: building.lod_cache[1] = generate_lod1(building)      # Simplified box
      2: building.lod_cache[2] = generate_lod2(building)      # Billboard/silhouette

  building.mesh = building.lod_cache[target_lod]
  building.mesh.visible = TRUE
  building.current_lod = target_lod


FUNCTION generate_lod1(building):
  # Simplified: correct footprint box + flat color + window grid texture
  box = generate_box(building.footprint_width, building.total_height, building.footprint_depth)
  box.material = new MeshStandardMaterial({
    color: building.base_color,
    map: window_grid_texture,    # From shared atlas
    roughness: 0.85,
  })
  box.position.copy(building.position)
  box.position.y += building.total_height / 2
  RETURN box


FUNCTION generate_lod2(building):
  # Minimal: flat vertical plane with building silhouette
  # OR: just the roofline as a thin box
  plane = generate_plane(building.footprint_width, building.total_height)
  plane.material = new MeshBasicMaterial({
    color: darken(building.base_color, 0.3),
    transparent: true,
    opacity: 0.7,
  })
  # Billboard: always face camera
  plane.userData.billboard = TRUE
  plane.position.copy(building.position)
  plane.position.y += building.total_height / 2
  RETURN plane
```

---

## A11. Master Generation Pipeline

```
FUNCTION generate_venice(airtable_data):
  # Called once on world load. Generates all static geometry.

  # 1. Define districts
  districts = load_district_definitions()

  # 2. Generate canal network
  grand_canal = generate_grand_canal()
  district_canals = {}
  FOR each district IN districts:
    major = generate_district_canals(district)
    minor = generate_minor_canals(district, major)
    district_canals[district.id] = { major, minor }

  all_canals = [grand_canal] + flatten(district_canals.values())

  # 3. Build canal geometry (water + walls + fondamenta)
  canal_meshes = []
  FOR each canal IN all_canals:
    samples = sample_canal_path(canal)
    geometry = build_canal_geometry(samples)
    canal_meshes.PUSH(geometry)

  # 4. Place buildings from Airtable
  placed_buildings = place_buildings(airtable_data.buildings, districts, all_canals)

  # 5. Fill gaps with procedural buildings
  FOR each district IN districts:
    district_buildings = filter(placed_buildings, b => b.district == district.id)
    district_canal_list = district_canals[district.id]
    gap_fill = fill_building_gaps(district, district_buildings, district_canal_list)
    placed_buildings.EXTEND(gap_fill)

  # 6. Generate bridges
  bridges = generate_bridges(all_canals, fondamenta_network)

  # 7. Scatter props
  FOR each district IN districts:
    fondamenta = get_fondamenta_for_district(district, canal_meshes)
    district_buildings = filter(placed_buildings, b => b.district == district.id)
    district_props = scatter_props(district, fondamenta, district_buildings)

  # 8. Build collision geometry (fondamenta + bridge surfaces)
  walkable_surfaces = extract_walkable(canal_meshes, bridges)
  collision_mesh = merge_walkable_surfaces(walkable_surfaces)

  # 9. Initialize LOD for all buildings
  FOR each building IN placed_buildings:
    building.current_lod = -1  # Start hidden, LOD system will activate on first frame

  RETURN {
    canals: canal_meshes,
    buildings: placed_buildings,
    bridges: bridges,
    props: all_props,
    collision: collision_mesh,
    districts: districts,
  }
```

---

## A12. Per-Frame Update

```
FUNCTION update_districts(venice_state, visitor_position, elapsed_time):
  # 1. LOD updates (every frame, but only process N buildings per frame to spread cost)
  BUILDINGS_PER_FRAME = 20
  start_idx = venice_state.lod_cursor
  FOR i = start_idx TO start_idx + BUILDINGS_PER_FRAME:
    idx = i % len(venice_state.buildings)
    update_building_lod(venice_state.buildings[idx], visitor_position)
  venice_state.lod_cursor = start_idx + BUILDINGS_PER_FRAME

  # 2. Water animation (every frame)
  FOR each canal_mesh IN venice_state.canals:
    canal_mesh.water.material.uniforms.time.value = elapsed_time * 0.5

  # 3. Lantern flicker (every frame, cheap)
  FOR each lantern IN venice_state.props WHERE type == "lantern":
    lantern.light.intensity = 0.5 + sin(elapsed_time * 3 + lantern.seed) * 0.15

  # 4. Boat drift (every frame, cheap)
  FOR each boat IN venice_state.props WHERE type == "boat":
    boat.position.y = 0.1 + sin(elapsed_time * 0.8 + boat.seed) * 0.05
    boat.rotation.z = sin(elapsed_time * 0.5 + boat.seed) * 0.03
```
