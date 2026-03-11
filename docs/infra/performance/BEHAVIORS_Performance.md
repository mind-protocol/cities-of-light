# BEHAVIORS -- Performance

> What the visitor experiences when performance systems are working. What they
> experience when those systems fail. Written from inside the headset.

---

## The Baseline: 72fps Feels Like Nothing

The visitor puts on the Quest 3. They enter Venice. They look around, walk
through streets, turn their head. Nothing stutters. Nothing lags. The world
tracks their head perfectly.

This is the baseline. The moment the visitor notices the rendering -- a
stutter, a hitch, a late frame -- the illusion breaks. In VR, a single
dropped frame is felt in the stomach before it is seen by the eyes. Two
consecutive dropped frames cause discomfort. Five cause nausea.

72fps is not a target. It is a hard floor.

---

## B1. LOD Transitions: Buildings Simplify at Distance

### What the Visitor Sees

| Distance      | Building Detail                                         |
|---------------|---------------------------------------------------------|
| Under 20m     | Full facade: windows, balconies, doorways, cornices     |
| 20-50m        | Simplified: flat facade with texture suggesting detail  |
| 50-100m       | Box with textured sides                                 |
| Beyond 100m   | Merged silhouette skyline (one mesh per district)       |

GIVEN the visitor walks toward a building from 60 meters
THEN detail increases gradually. The transition uses alpha blending over
2-3 frames. At walking speed, the LOD change happens in peripheral vision
and is never consciously noticed.

GIVEN the visitor stares directly at a building at the LOD boundary and
walks forward and backward across it
THEN even in this adversarial case, the transition appears as a soft focus
shift, not a geometric snap.

---

## B2. Citizen Tier Transitions

### FULL Tier (Close, Under ~15 Meters)

The citizen is rendered with full detail: body geometry with clothing,
facial expression, lip sync during speech, skeletal animation, shadow cast
on the ground. The visitor can read emotion from posture and face.

### ACTIVE Tier (Medium, 15-30 Meters)

Simplified body shape. Clothing color visible but no fine detail. No facial
expression. Posture conveyed through pre-set morphs. No shadow. The visitor
recognizes a person and can tell if they are standing, walking, or sitting.
They cannot tell if the person is smiling. This matches natural human vision
at that distance.

### AMBIENT Tier (Distant, Beyond 30 Meters)

A simple capsule or billboard with a drift animation. No individual identity
visible. The visitor sees "people are over there." 80 AMBIENT citizens in a
distant piazza render as a mass suggesting a crowd, at negligible cost.

### Transitions

GIVEN a citizen walks from 35m toward the visitor, crossing the AMBIENT-to-
ACTIVE boundary
THEN detail increases over a 300ms fade. The capsule blends into the
medium-detail body. No "level of detail pop." The visitor sees a person
gradually becoming clearer, which matches how real vision works.

GIVEN the visitor rapidly turns 180 degrees, facing a citizen at 12m who
was previously behind them
THEN the citizen is already at FULL detail when the gaze settles. Tier
reassignment runs every 500ms, and transitions are masked by head motion.

---

## B3. Adaptive Quality: Automatic Degradation

There is no quality menu. No settings screen. The system measures frame time
continuously and adjusts automatically. The visitor never chooses.

| Frame Time | What Happens                                          |
|------------|-------------------------------------------------------|
| Under 14ms | Normal operation. Full budgets.                       |
| 14-18ms    | FULL citizen count drops from 20 to 10. Barely noticeable -- slightly less facial detail on citizens at 12-15m. |
| 18-22ms    | Render resolution drops to 75%. Image softens slightly, as if glasses need cleaning. Citizen detail unchanged. |
| Over 22ms  | Emergency: all citizens forced to AMBIENT. Props hidden. Buildings at LOD2 minimum. Prevents nausea. Not acceptable long-term. |

### Recovery

GIVEN frame time drops below 14ms for 5 consecutive seconds
THEN the system steps back one tier. Recovery is slower than degradation
(5 seconds vs immediate) to prevent oscillation. The visitor does not see
a notification. Quality improves gradually.

---

## B4. Thermal Throttling on Quest 3

After 20-40 minutes of continuous rendering, the Quest 3 may reduce clock
speeds to prevent overheating. GPU performance drops 10-30%. The application
has no control over this.

### What the Visitor Experiences

The adaptive quality system detects rising frame times and begins
degradation. The visitor experiences gradual simplification. If they take a
5-minute break, performance recovers.

### The Critical Margin

The rendering target uses 11ms of the 14ms budget. The 3ms margin absorbs:
- Garbage collection spikes (1-2ms)
- Thermal throttling (1-3ms effective loss)
- Unexpected complexity (a crowd gathers, citizen count spikes)

The visitor should never feel thermal throttling as a performance cliff.
The scene is designed for sustained use, not peak performance.

---

## B5. What the Visitor Should Never See

**Pop-in.** A building snapping from invisible to visible. A citizen
appearing from nothing. All transitions use distance-based fading or LOD
blending. Sudden appearance is a bug.

**Stutter.** A single frame at 28ms (double budget) is felt as a physical
lurch. The inner ear disagrees with the eyes. Two consecutive dropped frames
cause mild nausea. Frame time must never exceed 14ms for two consecutive
frames. This is the absolute contract.

**Loading screens.** Walking from Rialto to San Marco. Teleporting to Murano.
Entering a building. No loading gates anywhere. A loading screen in VR
breaks presence more completely than any visual artifact.

**Frame rate counter.** No FPS display by default. The performance overlay
exists for development (double-tap left controller or Shift+P) but is hidden
in the visitor experience.

**Visible LOD boundaries.** The visitor should not identify the exact distance
where buildings simplify or citizens change tier. If a line is visible where
detail changes, the LOD distances or transition speed is wrong.

---

## B6. Audio and Network Performance

### Audio

GIVEN 40 citizens are producing sound within range
THEN only 32 audio sources are active. The farthest 8 are silently culled.
The visitor does not hear audio cutting in and out.

Audio processing runs on a separate thread. The visitor never experiences
visual stuttering caused by audio complexity.

### Network

Position broadcast is throttled to 20Hz per visitor. With 5 visitors, total
bandwidth stays under 50KB/s. Client-side interpolation fills gaps --
movement appears smooth.

Voice round-trip (capture, STT, LLM, TTS, playback) takes 1.5-2.5 seconds.
Designed to feel like a natural thinking pause, not latency. An additional
150ms of network latency (intercontinental) is absorbed into the pause. The
visitor perceives a slightly more thoughtful citizen, not lag.

---

## B7. Testable Scenarios

### Sustained 72fps
1. Walk through all five districts, 2 minutes each, including crowded areas.
2. Toggle performance overlay (double-tap left controller).
3. PASS: FPS never drops below 72 for more than a single frame.

### LOD Invisibility
1. Walk slowly toward a building from 100 meters, watching continuously.
2. PASS: You cannot identify the exact moment detail increases.

### Citizen Tier Transition
1. Watch a citizen approach from 40 meters.
2. PASS: Neither AMBIENT-to-ACTIVE nor ACTIVE-to-FULL transition is visible
   as a discrete pop. Detail grows naturally with proximity.

### Thermal Endurance
1. Remain in headset for 45 minutes, walking continuously.
2. PASS: No perceptible frame drops at the 30-minute mark.
3. PASS: If adaptive quality degrades, the transition is smooth.

### Crowd Stress Test
1. Stand in Rialto market center at midday (maximum citizen density).
2. PASS: Draw calls under 200. Triangles under 500K. FPS at 72.

### Adaptive Quality Recovery
1. Trigger Tier 2 degradation. Remove constraint. Wait 10 seconds.
2. PASS: Resolution returns to native. No visible snap. Recovery takes
   5 seconds of stability.
