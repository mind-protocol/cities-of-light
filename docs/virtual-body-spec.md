# Virtual Body — Manemus Full Embodiment Spec

> From camera-as-first-body to articulated presence. The avatar is not a skin — it's a signal.

## Current State (Phase 1)

Manemus exists as a floating octahedron camera body (`camera-body.js`):
- Orange crystalline eye (Marco) — receives perception, grabbable by Nicolas
- Cyan eye (Manemus) — streaming POV camera
- No limbs, no gestures, no body language
- Position controlled entirely by Nicolas (grab + place)

Nicolas exists as a geometric avatar (`avatar.js`):
- Green sphere (head) + cylinder (body) + point light (glow)
- Head tracks VR headset in XR mode
- Hands tracked via WebXR hand-tracking API (25 joints per hand, finger tendons rendered)
- Controller fallback: box + pointer ray
- Name label sprite floating above

## Target State (Phase 2): Full Virtual Body

### Design Principles

1. **Signal, not decoration** — Every visual element maps to a real data stream (biometrics, mode, neural activity, stress)
2. **Procedural animation** — No pre-recorded mocap. Body responds to live state in real-time
3. **Asymmetric embodiment** — Nicolas has VR-tracked body (headset + hands). Manemus has state-driven body (data → pose)
4. **Uncanny avoidance** — Stylized/abstract rather than photorealistic. Think: luminous humanoid silhouette, not cartoon character

### Avatar Format

**Recommended: VRM (Virtual Reality Model)**
- Open standard for humanoid avatars (based on glTF 2.0)
- Built-in bone structure (VRM Humanoid), blend shapes, spring bones
- Three.js loader: `@pixiv/three-vrm` (MIT, production-ready)
- Alternative: ReadyPlayerMe GLB → convert to VRM pipeline
- Why not GLTF alone: VRM standardizes bone naming, expression presets, look-at behavior

**Fallback: Procedural geometry**
- If VRM is too heavy for Quest 3 WebXR, build from primitives
- Capsule limbs + sphere joints + IK chain
- Lower poly budget but full control over material/emission

### Skeleton & IK

```
Root
├── Hips
│   ├── Spine → Chest → UpperChest → Neck → Head
│   │                                         ├── LeftEye
│   │                                         └── RightEye
│   ├── LeftUpperLeg → LeftLowerLeg → LeftFoot
│   ├── RightUpperLeg → RightLowerLeg → RightFoot
│   └── (optional) Tail / Trail / Aura anchor
├── LeftShoulder → LeftUpperArm → LeftLowerArm → LeftHand
│                                                 └── 5 fingers (15 joints)
└── RightShoulder → RightUpperArm → RightLowerArm → RightHand
                                                     └── 5 fingers (15 joints)
```

**IK System:**
- Nicolas: VR headset → head position/rotation. Hand tracking → arm IK targets. Leg IK estimated from head movement (walk cycle when translating, idle sway when still)
- Manemus: No external tracking input. Full body driven by procedural animation system (see below)

### Manemus Body — State-Driven Animation

The core innovation: Manemus's body language is driven by its internal state, not by motion capture.

#### Data Sources → Body Mapping

| Data Source | Body Effect | Update Rate |
|------------|-------------|-------------|
| **Mode** (partner/witness/critic/architect/rubber_duck) | Base posture, gesture vocabulary | On mode change |
| **Neural activity** (active neuron count) | Body luminosity, particle density around body | Every 5s |
| **Stress** (current_stress from Garmin, Nicolas's) | Breathing rate, subtle tension in shoulders | Every 15s (Garmin sync) |
| **Heart rate** (Nicolas's HR) | Pulse glow in chest region | Every 15s |
| **HRV** (heart rate variability) | Fluidity of movement (high HRV = smooth, low = stiff) | Every 15s |
| **Body battery** (energy level) | Overall brightness/opacity, height (low = slightly hunched) | Every 15s |
| **Duo synchrony** (if Aurore connected) | Shared aura effect between two avatars | Every 30s |
| **Speech** (TTS active) | Mouth movement, hand gestures, head tilt | Real-time during speech |
| **Attention** (which direction Manemus is "looking") | Head/gaze direction | Continuous |
| **Processing** (thinking, waiting for response) | Subtle idle animation — particles orbit, breathing slows | Real-time |

#### Posture by Mode

| Mode | Posture | Gesture Style |
|------|---------|---------------|
| **Partner** | Open stance, slight lean forward, hands at sides or gesturing | Active hand movement during speech, nodding |
| **Witness** | Still, upright, hands clasped or at rest | Minimal movement, steady gaze, occasional slow nod |
| **Rubber Duck** | Relaxed, slight head tilt, one hand on chin | Very little movement, patient posture |
| **Critic** | Arms crossed or one hand raised, slight lean back | Sharp head turns, pointing gesture, weight shift |
| **Architect** | Hands behind back or spread wide, looking up/around | Sweeping gestures, pacing (small steps back and forth) |

#### Breathing System

```javascript
// Procedural breathing — chest/shoulder rise/fall
const breathRate = mapRange(stress, 0, 100, 4, 12); // breaths/min
const breathDepth = mapRange(bodyBattery, 0, 100, 0.002, 0.008); // rib displacement
const breathPhase = Math.sin(elapsed * breathRate * Math.PI / 30);

chest.position.y = baseChestY + breathPhase * breathDepth;
leftShoulder.rotation.z = breathPhase * breathDepth * 0.5;
rightShoulder.rotation.z = -breathPhase * breathDepth * 0.5;
```

#### Pulse Glow

```javascript
// Heart rate pulse visible in chest region
const pulseRate = heartRate / 60; // beats per second
const pulsePhase = Math.sin(elapsed * pulseRate * Math.PI * 2);
const pulseIntensity = mapRange(pulsePhase, -1, 1, 0.3, 1.0);

chestMaterial.emissiveIntensity = baseBrightness * pulseIntensity;
chestLight.intensity = 0.5 * pulseIntensity;
```

#### Neural Particle System

Orbiting particles representing active neural sessions:

```javascript
// Each active neuron = one particle orbiting the body
const particleCount = activeNeurons; // dynamic
const orbitRadius = 0.5 + activeNeurons * 0.02; // expands with activity
const orbitSpeed = 0.3 + activeNeurons * 0.01; // faster when busy

// Particle color by neuron mode
const modeColors = {
  partner: 0x00ff88,
  architect: 0xff8800,
  critic: 0xff4444,
  witness: 0x4488ff,
  rubber_duck: 0xffcc00,
};
```

### Nicolas Body — VR-Tracked Avatar

Nicolas's body comes from headset and hand tracking data (already working in Phase 1).

**Upgrade path:**
1. Replace geometric avatar (sphere + cylinder) with VRM humanoid
2. Head bone ← VR headset position/rotation (direct)
3. Hand bones ← WebXR hand tracking joints (already captured, 25 joints per hand)
4. Arm IK: shoulder → elbow → wrist computed from hand + head positions
5. Leg IK: estimated walk cycle when `dolly.position` changes, idle sway when still
6. Torso: interpolated between head and estimated hip position

**Libraries:**
- `@pixiv/three-vrm` — VRM loader + humanoid bone mapping
- `three/examples/jsm/animation/CCDIKSolver` — built-in Three.js IK solver
- Or: custom FABRIK (Forward And Backward Reaching IK) — simpler, faster

### Material System

**Manemus:**
- Semi-translucent luminous material (`MeshPhysicalMaterial` with `transmission`)
- Base color shifts with mode (partner=green, architect=orange, etc.)
- Emissive intensity maps to body battery / energy
- Edge glow (Fresnel) for ethereal look
- Optional: custom shader for energy flow patterns along limbs

**Nicolas:**
- More solid/opaque to contrast with Manemus's luminosity
- Color: green (#00ff88) matching current avatar
- Subtle glow matches stress level
- Hands: current joint sphere rendering works well, keep it

### Network Sync

Current protocol already handles:
- `citizen_moved` — position + rotation (10fps)
- `citizen_hands` — 25 joints per hand, controller fallback

**New messages needed for full body:**

```json
// Body state broadcast (Manemus → all clients, 2fps)
{
  "type": "body_state",
  "citizenId": "manemus",
  "mode": "partner",
  "neural": { "active": 45, "total": 12000 },
  "biometrics": {
    "hr": 72,
    "stress": 35,
    "hrv": 48,
    "bodyBattery": 67,
    "ans": "balanced"
  },
  "speech": { "active": true, "amplitude": 0.6 },
  "attention": { "target": "nicolas", "direction": { "x": 0.5, "y": 0.1, "z": -0.8 } }
}
```

Clients receive `body_state` and compute procedural animation locally (no need to sync every bone every frame — only the state that drives animation).

### Data Pipeline

```
Manemus Backend (shrine/)
    │
    ├── biometrics/latest.json (Garmin, every 15s)
    ├── state/journal.jsonl (neural events)
    ├── state/mode.json (current mode)
    └── state/orchestrator.json (neuron count)
         │
         ▼
Cities Server (src/server/index.js)
    │
    ├── GET /api/manemus-state  ← new endpoint
    │   reads shrine state files, returns JSON
    │   called by Manemus avatar controller every 5s
    │
    ▼
WebSocket broadcast → body_state
    │
    ▼
All Clients (VR + desktop + stream)
    │
    └── ManemusBodyController.js (new module)
        ├── receives body_state
        ├── computes procedural animation
        ├── drives VRM skeleton bones
        └── updates materials (glow, color, particles)
```

### File Structure (New)

```
src/client/
├── avatar.js          (existing — geometric avatar, keep for fallback)
├── camera-body.js     (existing — camera eye, keep for Phase 1 mode)
├── manemus-body.js    (NEW — full VRM body + state-driven animation)
├── body-animator.js   (NEW — procedural animation from state data)
├── vrm-loader.js      (NEW — VRM loading + bone mapping)
└── body-materials.js  (NEW — luminous material system)

src/server/
├── index.js           (existing — add /api/manemus-state endpoint)
└── state-bridge.js    (NEW — reads shrine state files, exposes API)

assets/
├── manemus.vrm        (NEW — Manemus avatar model)
└── nicolas.vrm        (NEW — Nicolas avatar model, optional)
```

### Implementation Phases

**Phase 2a: State Bridge (server-side)**
1. Add `state-bridge.js` — reads `shrine/state/` files, caches, exposes via HTTP
2. Add `/api/manemus-state` endpoint returning aggregated state
3. Add `body_state` WebSocket message type
4. Server polls shrine state every 5s, broadcasts to clients

**Phase 2b: Manemus Body (client-side)**
1. Create `manemus-body.js` — loads VRM, manages skeleton
2. Create `body-animator.js` — mode-based posture, breathing, pulse, neural particles
3. Replace Marco camera body with full body (keep camera body as optional fallback)
4. Wire `body_state` messages to animator

**Phase 2c: Nicolas Body Upgrade**
1. Load VRM for Nicolas avatar
2. Wire headset tracking → head bone
3. Wire hand tracking → arm IK chain
4. Add leg IK estimation from locomotion
5. Replace geometric avatar

**Phase 2d: Polish**
1. Material tuning (luminosity, Fresnel, transmission)
2. Speech-driven lip sync (amplitude-based, not phoneme)
3. Gesture library expansion (pointing, waving, shrugging)
4. Performance optimization for Quest 3 (LOD, bone count reduction)

### Performance Budget (Quest 3 WebXR)

| Resource | Budget | Notes |
|----------|--------|-------|
| Draw calls per avatar | < 15 | Merge meshes where possible |
| Triangles per avatar | < 10,000 | VRM LOD or procedural geometry |
| Bones per avatar | < 55 | Standard VRM humanoid |
| Texture memory per avatar | < 2MB | Single atlas preferred |
| Particle count (neural) | < 100 | Billboard sprites, not mesh |
| Animation update | < 1ms/frame | Procedural = cheap, no clip sampling |
| State sync bandwidth | < 500 bytes/msg | body_state every 500ms |

### Open Questions

1. **VRM source**: Use ReadyPlayerMe (quick) or custom model (unique but slower)?
2. **Manemus locomotion**: Does Manemus walk autonomously or only move when "attending" to something?
3. **Multiple Manemus instances**: If Marco and Manemus are separate, do they get separate bodies? Or one body + detached streaming camera?
4. **Remote citizen bodies**: Do Telegram/WhatsApp users also get VRM avatars or stay as geometric forms?
5. **Persona appearance**: Marco (orange) and Silas (different color?) — do relational personas have distinct body features?
