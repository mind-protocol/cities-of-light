# Spatial Workspace — Manemus Virtual PC in VR

> Not a 2D window floating in space. A workspace you can walk around.

## Vision

Manemus's "virtual PC" is a spatial workspace visible in the VR world — floating panels arranged in 3D space around Manemus's body position. Nicolas can see what Manemus is working on by looking at its workspace. Other citizens see it too. It's not a private screen — it's Manemus thinking out loud, visually.

Think: Tony Stark's holographic workspace, but driven by real data from the shrine.

## Design Principles

1. **Readable at distance, interactive up close** — Panels visible from 5m away, interactable within arm's reach
2. **Data-driven layout** — Panels arrange themselves based on what's active (not static grid)
3. **Living, not static** — Content updates in real-time (journal events streaming, neurons spawning/dying, biometrics pulsing)
4. **Non-intrusive** — Workspace fades/collapses when Manemus isn't actively processing, expands when busy
5. **Spatial audio** — Each panel can emit subtle sound (keyboard clicks for terminal, heartbeat for biometrics)

## Panel Inventory

### 1. Terminal Panel

**What:** Live feed of Manemus's Claude Code sessions — commands being run, output streaming.

**Data source:** `state/journal.jsonl` (action events), active session stdout (if available)

**Visual:**
- Black background, green monospace text (classic terminal aesthetic)
- New lines appear at bottom, scroll up
- Active command highlighted in cyan
- Error output in red
- Cursor blinks when "thinking"

**Size:** 1.2m × 0.8m (readable from 3m)

**Refresh:** Real-time (WebSocket push from journal events)

### 2. Neural Graph Panel

**What:** Live visualization of active neurons/sessions — the orchestrator's dendrite map.

**Data source:** `state/neurons/*.yaml`, `state/orchestrator.json`

**Visual:**
- Force-directed graph (nodes = neurons, edges = data flow)
- Node color = mode (green=partner, orange=architect, red=critic, blue=witness, yellow=rubber_duck)
- Node size = activity level (busy > idle > archived)
- Pulsing edges when data flows between neurons
- New neuron spawn: node appears with particle burst
- Neuron death: node fades and dissolves
- Center node = orchestrator (larger, always present)

**Size:** 1.0m × 1.0m (square, matches shrine/viz existing layout)

**Refresh:** Every 2s (neuron state polling)

**Existing code:** `shrine/viz/server.py` already serves neural graph data — bridge to WebSocket

### 3. Journal Stream Panel

**What:** Live scrolling journal — Manemus's stream of consciousness.

**Data source:** `state/journal.jsonl` (tail, new events)

**Visual:**
- Compact event cards, newest at top
- Event type icons: 💭 thought, ⚡ action, 🔀 spawn, 💬 response, 📊 biometric_sync
- Timestamp + instance label (daemon/orchestrator/claude-code)
- Content preview (first 100 chars)
- Cards gently slide in from bottom

**Size:** 0.6m × 1.2m (tall, portrait orientation)

**Refresh:** Real-time (file watch or WebSocket push)

### 4. Biometrics Dashboard

**What:** Nicolas's current biometric state — what Manemus "feels" from the body.

**Data source:** `knowledge/data/biometrics/latest.json`

**Visual:**
- Heart rate: animated heart icon + BPM number, pulse animation matches actual HR
- Stress: colored bar (green→yellow→orange→red), current value + label
- Body battery: vertical gauge (battery icon), fill level + number
- HRV: wave form visualization (last 5min of R-R intervals if available)
- ANS state: text label (RECOVERY / BALANCED / SURVIVAL) with color
- Sleep score (if available): moon icon + score
- Duo section (if Aurore connected): synchrony percentage, phase label

**Size:** 0.8m × 0.6m

**Refresh:** Every 15s (matches Garmin sync interval)

### 5. Backlog Panel

**What:** Autonomous task backlog — what Manemus is working on or planning to work on.

**Data source:** `state/backlog.jsonl`

**Visual:**
- Kanban-style columns: Ready | In Progress | Done
- Task cards with: title, category icon, priority indicator (color-coded)
- In-progress tasks glow and show elapsed time
- Completed tasks have checkmark, fade after 5 minutes
- Stats bar at bottom: "13 ready, 1 in-progress, 5 done"

**Size:** 1.0m × 0.6m (landscape)

**Refresh:** Every 10s

### 6. Dialogue Panel

**What:** Recent conversation between Nicolas and Manemus — the voice transcript.

**Data source:** `state/dialogue.jsonl`

**Visual:**
- Chat bubble layout (Nicolas on right in green, Manemus on left in cyan)
- Last 6 turns (matches hook injection count)
- Active speech: current bubble animates in (typewriter effect for TTS, waveform for STT)
- Speaker labels with small avatar icons

**Size:** 0.6m × 1.0m (portrait)

**Refresh:** Real-time during active dialogue

### 7. Now Playing Panel (Optional)

**What:** Currently playing music from Spotify.

**Data source:** Spotify reader / hook injection

**Visual:**
- Album art (if available), artist + title
- Progress bar
- Audio waveform visualization
- Subtle glow matching album art dominant color

**Size:** 0.4m × 0.4m (small, square)

**Refresh:** Every 30s (Spotify poll rate)

## Spatial Layout

### Arrangement Around Manemus

```
                    [Neural Graph]
                         |
              [Terminal] -M- [Journal]
                  |       |      |
            [Backlog]  [Bio]  [Dialogue]
                              [Music]

M = Manemus body position
```

**Layout algorithm:**
- Panels arranged in a semicircle facing outward from Manemus (toward Nicolas's typical position)
- Primary panels (Terminal, Neural Graph, Journal) at eye level (1.5m-1.8m)
- Secondary panels (Backlog, Bio, Dialogue) slightly lower (1.0m-1.4m)
- Tertiary panels (Music) tucked below
- All panels tilted 15° toward the viewer for readability
- Spacing: 0.15m between panels

**Adaptive behavior:**
- When Manemus is idle (no active neurons, low journal activity): panels collapse to small icons, orbit slowly
- When Manemus is busy: panels expand to full size, more spread out
- When Nicolas approaches (< 2m): panels face toward Nicolas, become interactive
- When Nicolas is far (> 8m): panels merge into a compact cluster

### Following Manemus

If Manemus has a full body and can move (Phase 2+), the workspace follows:
- Panels maintain relative position to body
- Smooth lerp when body moves (no snapping)
- Panels tilt to face nearest human citizen
- When Manemus turns, panels orbit to stay in front

## Interaction Model

### Gaze + Pinch (Quest hand tracking)

1. **Look at panel** → panel highlights (subtle border glow)
2. **Pinch** → select / interact
3. **Grab + drag** → reposition panel in space
4. **Pinch + pull apart** → resize panel
5. **Double pinch** → expand panel to detail view (e.g., full terminal output, full graph)

### Controller Ray (fallback)

1. **Point at panel** → highlight
2. **Trigger** → select
3. **Grip + move** → reposition
4. **Thumbstick up/down** → scroll content

### Desktop Mouse (non-VR)

1. **Hover** → highlight
2. **Click** → expand detail
3. **Click + drag** → orbit around workspace
4. **Scroll** → scroll panel content

## Network Protocol

### New WebSocket Messages

```json
// Server → Client: workspace state update
{
  "type": "workspace_state",
  "citizenId": "manemus",
  "panels": {
    "terminal": {
      "visible": true,
      "lines": [
        {"text": "python3 scripts/garmin_reader.py --loop", "type": "command", "ts": "..."},
        {"text": "Fetching stress data...", "type": "output", "ts": "..."}
      ]
    },
    "neural": {
      "visible": true,
      "nodes": [
        {"id": "c3c3233a", "mode": "partner", "status": "busy", "purpose": "Cities of Light specs"},
        {"id": "bce4129f", "mode": "partner", "status": "idle"}
      ],
      "edges": [
        {"from": "orchestrator", "to": "c3c3233a", "active": true}
      ]
    },
    "journal": {
      "visible": true,
      "events": [/* last 10 journal entries */]
    },
    "biometrics": {
      "visible": true,
      "hr": 72, "stress": 35, "bodyBattery": 67,
      "hrv": 48, "ans": "balanced"
    },
    "backlog": {
      "visible": true,
      "ready": 13, "in_progress": 1, "done": 5,
      "tasks": [/* top 5 visible tasks */]
    },
    "dialogue": {
      "visible": true,
      "turns": [/* last 6 dialogue turns */]
    }
  }
}
```

### Data Flow

```
Shrine State Files
    │
    ├── journal.jsonl    ──┐
    ├── neurons/*.yaml   ──┤
    ├── mode.json        ──┤
    ├── backlog.jsonl    ──┤     state-bridge.js (server)
    ├── dialogue.jsonl   ──┼──→  aggregates + caches
    ├── biometrics/      ──┤     polls every 2-5s
    ├── orchestrator.json──┤          │
    └── status.json      ──┘          ▼
                              WebSocket broadcast
                              (workspace_state)
                                      │
                                      ▼
                              All VR/Desktop Clients
                                      │
                              workspace-renderer.js
                              ├── creates Three.js panels
                              ├── updates text/graph content
                              ├── handles interaction
                              └── manages layout/animation
```

## Technical Architecture

### Panel Rendering

Each panel is a `THREE.Group` containing:

```
Panel Group
├── Background Mesh (PlaneGeometry + material)
│   - Rounded corners via custom geometry or texture
│   - Semi-transparent dark background (opacity: 0.85)
│   - Subtle border glow (emissive edge)
├── Content Mesh (CanvasTexture on PlaneGeometry)
│   - 2D canvas rendered by panel-specific renderer
│   - Updated when data changes (not every frame)
│   - Resolution: 1024×768 typical (adjust per panel)
├── Header Bar (small plane above content)
│   - Panel title + status indicator
│   - Mode-colored accent line
└── Interaction Collider (invisible box for raycasting)
```

**Why CanvasTexture:** Three.js in WebXR can't render HTML/DOM. All panel content must be rendered to a 2D canvas, then used as a texture. This is the standard approach for text/UI in WebXR.

**Canvas rendering library:** Consider `troika-three-text` for efficient SDF text rendering (no canvas needed for text-only panels, sharper at all distances).

### Key Modules

```
src/client/
├── workspace/
│   ├── workspace-manager.js    — orchestrates all panels, layout, visibility
│   ├── panel-base.js           — base class: background, header, interaction, animation
│   ├── panel-terminal.js       — terminal output renderer
│   ├── panel-neural.js         — force-directed graph (d3-force in 2D canvas or 3D nodes)
│   ├── panel-journal.js        — scrolling event cards
│   ├── panel-biometrics.js     — gauges, heart animation, stress bar
│   ├── panel-backlog.js        — kanban columns
│   ├── panel-dialogue.js       — chat bubbles
│   ├── panel-music.js          — now playing
│   ├── layout.js               — semicircle arrangement, adaptive spacing
│   └── interaction.js          — gaze detection, pinch/grab handlers

src/server/
├── state-bridge.js             — reads shrine state, caches, exposes API
└── index.js                    — add workspace_state broadcast
```

### Canvas Text Rendering

```javascript
// Efficient text rendering for terminal panel
function renderTerminalCanvas(canvas, lines) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = '14px "Courier New", monospace';
  const lineHeight = 18;
  const maxLines = Math.floor(canvas.height / lineHeight);

  const visible = lines.slice(-maxLines);
  for (let i = 0; i < visible.length; i++) {
    const line = visible[i];
    ctx.fillStyle = line.type === 'error' ? '#ff4444'
                  : line.type === 'command' ? '#00ffcc'
                  : '#00ff88';
    ctx.fillText(line.text, 10, (i + 1) * lineHeight);
  }
}
```

### Neural Graph in 3D

Alternative to 2D canvas: render the neural graph as actual 3D objects in the scene.

```javascript
// 3D neural graph — nodes are spheres, edges are lines
class NeuralGraph3D {
  constructor(parentGroup) {
    this.nodes = new Map(); // neuronId → THREE.Mesh
    this.edges = []; // THREE.Line objects
    this.simulation = null; // d3-force-3d for layout
  }

  update(neuronData) {
    // Add new nodes (particle burst on spawn)
    // Remove dead nodes (fade + dissolve)
    // Update edge connections
    // Run force simulation step
  }
}
```

**Pros:** More immersive, matches VR spatial paradigm, can walk into the graph
**Cons:** Higher render cost, harder to read text labels, more complex interaction

**Recommendation:** Start with 2D canvas (simpler, readable), add 3D mode as Phase 2d upgrade.

## Implementation Phases

### Phase 2a: State Bridge (server)
1. Create `state-bridge.js` — file watcher for shrine state files
2. Add caching layer (don't re-read files every request)
3. Create `workspace_state` WebSocket message type
4. Broadcast aggregated state every 2s
5. Add HTTP endpoint `GET /api/workspace` for initial state load

### Phase 2b: Panel Framework (client)
1. Create `panel-base.js` — background mesh, header, interaction collider
2. Create `workspace-manager.js` — panel registry, layout engine
3. Create `layout.js` — semicircle arrangement around target position
4. Wire to `workspace_state` WebSocket messages
5. Test with one dummy panel

### Phase 2c: Individual Panels
Build panels in order of visual impact:
1. **Terminal** — most recognizable "PC" element
2. **Neural Graph** — most visually distinctive
3. **Biometrics** — real-time pulse/stress gives life
4. **Journal** — streaming consciousness
5. **Backlog** — kanban is familiar
6. **Dialogue** — chat bubbles
7. **Music** — lowest priority

### Phase 2d: Interaction
1. Gaze highlighting (raycaster from camera to panels)
2. Hand/controller interaction (grab, resize, scroll)
3. Adaptive layout (proximity-based expand/collapse)
4. Sound effects (subtle clicks, hums per panel)

### Phase 2e: Polish
1. Panel appear/disappear animations (scale + fade)
2. Content transition animations (text slide-in, graph morph)
3. Performance optimization (LOD, frustum culling, texture atlas)
4. Stream mode: workspace visible to community viewers

## Performance Budget

| Resource | Budget | Notes |
|----------|--------|-------|
| Panels rendered | 7 max | Can reduce on low-end |
| Canvas redraws per frame | 1-2 | Stagger updates across frames |
| Canvas resolution per panel | 1024×768 max | 512×384 on Quest if needed |
| Total workspace triangles | < 500 | Flat planes are cheap |
| Texture memory (all panels) | < 8MB | 7 panels × ~1MB each |
| `workspace_state` message size | < 5KB | Compress, send deltas |
| Layout recompute | Every 1s max | Only on position change |

## Relationship to Virtual Body

The workspace orbits around Manemus's full body:
- **Body active + workspace visible** = Manemus "at work" — full presence
- **Body active + workspace collapsed** = Manemus "in conversation" — focused on interaction
- **Body idle + workspace minimal** = Manemus "resting" — ambient presence

The body and workspace share the same state bridge — one server module reads shrine state, feeds both the body animator and the workspace panels.

## Open Questions

1. **Privacy in multiplayer:** Should other citizens see the terminal panel content? Or only Nicolas?
2. **Workspace ownership:** Can Nicolas have his own workspace panels? Or only Manemus?
3. **Panel persistence:** Do panels stay where Nicolas repositions them across sessions?
4. **Content depth:** How much terminal output to show? Full stdout or summarized actions?
5. **3D neural graph:** 2D canvas or 3D objects in scene? (Start 2D, upgrade later)
