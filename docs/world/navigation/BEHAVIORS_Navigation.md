# BEHAVIORS: world/navigation -- Observable Effects

What the visitor experiences when they move through Venice. How movement feels on desktop and in VR. What happens at district boundaries, on gondolas, on bridges, and at the edges of walkable space. Described from the outside. No implementation details, only observable behavior.

---

## B1. Desktop Movement

- **WASD** moves the visitor relative to camera facing. Walk speed: 2.5 m/s -- slightly faster than real walking but slow enough to notice a doorway, a window, a cat on warm stone.
- **Mouse** controls look direction. Horizontal = yaw, vertical = pitch (clamped, no flipping). Pointer lock on click.
- **Shift** increases speed to 3.75 m/s (1.5x). Immediate on press, immediate on release. Citizens may react to running ("Why the hurry, Forestiere?").
- **Space** is unbound. There is no jump. Venice has no verticality reachable by jumping.
- Diagonal movement (W+A, W+D) is not faster than cardinal movement. Speed is normalized.

```
GIVEN the visitor presses W+A simultaneously
WHEN walking on a flat fondamenta
THEN speed is the same as W alone, direction is diagonal forward-left

GIVEN the visitor holds Shift while pressing W
WHEN on a wide fondamenta
THEN speed increases to 1.5x immediately
  AND returns to walk speed immediately on Shift release
```

---

## B2. VR Movement

### Continuous Locomotion

- Left thumbstick moves the visitor relative to headset facing. Speed: 2.5 m/s. No run in VR -- fast continuous movement causes nausea.
- During locomotion, a comfort vignette darkens peripheral vision to approximately 30% opacity at the edges. Fades out over 200ms when the stick is released.

### Snap Turn

- Right thumbstick snaps rotation 30 degrees per input. Instantaneous -- no smooth animation. One push, one snap. Holding the stick does not auto-repeat.

### Teleport

- Right controller trigger activates a parabolic arc. Arc is a thin dotted line: blue on valid surface, red on invalid (water, outside walkable area), hidden when pointing at sky.
- Landing indicator: subtle circle on the valid surface.
- On full press: 200ms fade to black, reposition, 200ms fade from black. Total: 400ms. 300ms cooldown before next teleport.
- Teleport and continuous locomotion coexist. They are not separate modes.
- Maximum range: approximately 15 meters (limited naturally by the arc's gravity).

```
GIVEN the visitor pushes the left thumbstick forward in VR
WHEN they begin moving
THEN peripheral vision darkens (vignette active)
  AND on stick release, vignette fades out over 200ms

GIVEN the visitor pushes right thumbstick right
WHEN the snap completes
THEN view has rotated exactly 30 degrees clockwise, instantaneously

GIVEN the visitor aims the teleport arc at canal water
WHEN they observe the arc
THEN arc and indicator are red
  AND pressing trigger does not teleport

GIVEN the visitor has just teleported
WHEN they attempt teleport within 300ms
THEN the second teleport does not activate
```

---

## B3. District Transitions

Walking between districts is seamless. No loading screen, no black fade, no boundary marker.

- **Fog gate**: at district boundaries, fog density increases for approximately 3 seconds. The visitor walks through thicker fog, then emerges into the new district's atmosphere. The fog masks citizen population changes and LOD transitions.
- **Audio crossfade**: ambient sound of the departing district fades out over 2 seconds while the arriving district fades in. The crossfade overlaps -- both are faintly audible for a moment, preventing silence.
- **Atmosphere shift**: fog color, light tint, and particle type transition over approximately 2 seconds.
- **Hysteresis**: once a transition begins, the visitor must move at least 10 meters into the new district before a reverse transition can trigger. Pacing at a boundary does not cause flickering.

```
GIVEN the visitor walks from Rialto toward Cannaregio
WHEN they cross the district boundary
THEN fog increases for approximately 3 seconds
  AND Rialto audio fades out while Cannaregio audio fades in over 2 seconds
  AND particle type transitions gradually
  AND no loading indicator or text appears

GIVEN the visitor just crossed into Cannaregio
WHEN they turn around and walk 5 meters back
THEN no reverse transition triggers -- they remain in Cannaregio atmosphere

GIVEN the visitor has walked 12 meters into Cannaregio and turns back
WHEN they approach the boundary
THEN a reverse transition triggers with the same fog gate and crossfade
```

---

## B4. Gondola Ride Experience

Gondolas are scenic transport along canal routes. The visitor is a passenger, not a pilot.

- **Boarding**: the visitor approaches a dock (marked by a mooring pole). A small world-anchored "Board" prompt appears. Desktop: press E. VR: point and trigger. No route selection menu.
- **The ride**: visitor's position locks to the gondola at seated height -- near water level. They can look around but cannot move relative to the boat. Speed: 4.0 m/s. A gondolier poles from the stern but does not speak. Duration: 30-90 seconds depending on route.
- **The vantage**: buildings pass on both sides, viewed from below. Citizens on fondamenta are visible from a new angle. Water reflections are close. District transitions occur during the ride with normal fog gates and crossfades.
- **Disembarking**: gondola stops at destination dock. Visitor is placed on the fondamenta at standing height automatically.

```
GIVEN the visitor approaches a gondola dock
WHEN they enter trigger proximity
THEN a "Board" prompt appears anchored in 3D space (not screen overlay)

GIVEN the visitor boards the gondola
WHEN the ride begins
THEN viewpoint lowers to seated height
  AND they can look around but cannot walk or strafe

GIVEN the gondola reaches its destination
WHEN it stops
THEN the visitor is placed on fondamenta at standing height
  AND they can move freely immediately
```

---

## B5. Bridge Crossing

Bridges are the only way to cross canals on foot. They are arched -- the visitor walks up, crosses the peak, and descends.

- The elevation change is subtle but perceptible. In VR, eye height rises and falls with the bridge surface.
- At the peak, the visitor has a briefly elevated view along the canal -- a natural observation point.
- Major district transitions are placed at bridges. The fog gate may coincide with the bridge peak, making the crossing feel like a threshold between two worlds.

```
GIVEN the visitor walks onto a bridge
WHEN they ascend the arch
THEN viewpoint rises smoothly
  AND at the peak they have wider sightline along the canal

GIVEN the bridge connects two districts
WHEN the visitor crosses the peak
THEN a district transition begins (fog gate, audio crossfade, atmosphere shift)
```

---

## B6. Water as Barrier

Water is impassable. The visitor cannot swim, wade, or walk on water.

- At the canal edge, the fondamenta ends. If the visitor walks toward the water, they stop at the edge. No invisible wall, no warning sound, no bounce. The stone ends; the water begins.
- Diagonal approach: the component toward water is absorbed, the component along the fondamenta continues. The result is sliding along the edge.
- Fall prevention: if a glitch places the visitor below valid geometry, they are immediately reset to the nearest valid surface. No falling through the void.

```
GIVEN the visitor walks toward a canal edge
WHEN they reach the fondamenta boundary
THEN they stop -- no barrier sound, bounce, or visual effect

GIVEN the visitor walks diagonally toward the canal
WHEN the edge is reached
THEN lateral movement toward water is absorbed
  AND forward movement along the fondamenta continues (edge sliding)

GIVEN the visitor is somehow placed below valid geometry
WHEN the invalid position is detected
THEN they are immediately reset to the nearest valid surface
```

---

## B7. Attempting the Impossible

### Walking into buildings

- Buildings are not enterable in V1. The visitor reaches the wall and stops. No collision sound, no "Access Denied" message. The door is closed. The wall is solid. This is how a city works.

### Jumping off bridges

- There is no jump. Bridge parapets have collision. The visitor follows the bridge deck until they walk off either end.

### Clipping through walls

- Pushing against a wall at an angle causes sliding: perpendicular component absorbed, parallel component continues.
- In VR, if the visitor physically leans their head past a wall, the view may briefly clip into geometry. The virtual position does not change.

```
GIVEN the visitor walks into a building facade
WHEN they reach the wall
THEN forward movement stops with no sound or visual feedback
  AND they can turn and walk in any valid direction

GIVEN the visitor is on a bridge
WHEN they attempt to move off the side
THEN parapet collision stops them -- they remain on the deck

GIVEN the visitor walks into a wall at 45 degrees
WHEN they contact the surface
THEN they slide along the wall in the parallel direction
```

---

## B8. Speed Perception and Collision Feedback

Speed is constant (2.5 m/s walk, 3.75 m/s run, 4.0 m/s gondola) but feels different depending on surroundings:

- **Narrow alleys** (2-3m wide): feels fast. Walls pass close, strong parallax. Architectural detail trackable.
- **Open piazzas**: feels slow. Far side is distant, weak parallax. The visitor feels barely moving.
- **Canal-side fondamenta**: medium. Building wall on one side (close parallax), open canal on the other (distant parallax). Natural balance.
- **Gondola from water**: 4.0 m/s feels brisk because the viewpoint is low and the water surface is close.

Collision is silent and invisible everywhere. Walking into a wall, reaching a canal edge, hitting a bridge parapet -- movement stops or redirects with zero feedback. No sound, no visual effect, no haptic vibration in VR controllers. Venice is not a game level. Walls are walls.

```
GIVEN the visitor walks through a 3m alley then crosses San Marco piazza at the same speed
WHEN they compare the two experiences
THEN the alley felt faster due to close parallax
  AND the piazza felt slower due to distant parallax
  AND actual speed was identical

GIVEN the visitor collides with any surface
WHEN the collision occurs
THEN no sound, visual effect, or haptic feedback fires
  AND movement is stopped or redirected silently
```

---

## B9. VR Comfort

- **Vignette**: active during continuous locomotion. Peripheral darkening at ~30% opacity. Fades in on stick push, out over 200ms on release. Not active during teleport or gondola rides.
- **Teleport fade**: always active, cannot be disabled. 200ms black, reposition, 200ms fade-in. Prevents the brain from interpreting position change as movement.
- **Height calibration**: standing eye height captured from headset at session start. Virtual camera matches real height. If the visitor sits in reality, their viewpoint lowers.
- **No smooth turn**: snap only (30 degrees). Smooth turning causes nausea in many users.
- **No run**: VR speed is fixed at 2.5 m/s. No acceleration option.

```
GIVEN the visitor begins continuous locomotion in VR
WHEN the thumbstick is pushed
THEN peripheral vision darkens within 200ms
  AND center of vision remains fully clear

GIVEN the visitor teleports
WHEN the transition activates
THEN view fades to full black, repositions, fades back in (~400ms total)

GIVEN the visitor is standing at session start
WHEN height calibrates
THEN virtual eye height matches physical eye height
  AND fondamenta, buildings, and citizens appear at correct relative scale
```
