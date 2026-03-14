# IMPLEMENTATION -- Server

> Concrete Express.js setup, WebSocket configuration, route definitions,
> middleware stack, process management, and modifications needed for Venezia.
> Reference source: `src/server/index.js`, `src/server/voice.js`,
> `src/server/ai-citizens.js`, `src/server/rooms.js`.

---

## 1. npm Dependencies

```json
{
  "dependencies": {
    "express": "^4.21.0",
    "ws": "^8.18.0",
    "openai": "^6.18.0",
    "@anthropic-ai/sdk": "^0.74.0",
    "dotenv": "^17.2.4",
    "three": "^0.170.0"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

The `ws` package provides the WebSocket server. Express handles HTTP routes.
Three.js is listed as a dependency because `src/shared/zones.js` is imported
by both client and server. The `@vitejs/plugin-basic-ssl` dev dependency
generates self-signed certs for local Quest development.

No additional packages are currently used for rate limiting, compression,
or health checks. These are planned additions.

---

## 2. Express Application Setup

### 2.1 Imports and Initialization

```javascript
// src/server/index.js
import { WebSocketServer } from 'ws';
import express from 'express';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer as createHttpsServer } from 'https';
import OpenAI from 'openai';

import { perceptionRoutes } from './perception.js';
import { processVoice, processVoiceStreaming, speakToWorld, speakAsAICitizen } from './voice.js';
import { processBiographyVoice } from './biography-voice.js';
import { ZONES, detectNearestZone } from '../shared/zones.js';
import { AICitizenManager } from './ai-citizens.js';
import { RoomManager } from './rooms.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8800;
```

### 2.2 JSON Body Parser

```javascript
const app = express();
app.use(express.json({ limit: '10mb' }));
```

The 10MB limit accommodates perception frame uploads (base64 images from
the Marco camera) and voice audio messages (typically 50KB-500KB base64).

### 2.3 Security Headers Middleware

```javascript
app.use((req, res, next) => {
  // WebXR + mic + camera through tunnels/iframes
  res.setHeader('Permissions-Policy',
    'xr-spatial-tracking=(*), microphone=(*), camera=(*)');
  // COOP/COEP for SharedArrayBuffer (improves audio perf on Quest)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});
```

These headers are required for:
- `xr-spatial-tracking`: WebXR API access
- `microphone`: getUserMedia for voice capture
- `Cross-Origin-Opener-Policy` + `Cross-Origin-Embedder-Policy`: enables
  `SharedArrayBuffer` which improves Web Audio API performance on Quest 3

---

## 3. Route Definitions

### 3.1 State Snapshot

```javascript
app.get('/state', (req, res) => {
  res.json({
    citizens: Object.fromEntries(citizens),
    connections: connections.size,
    uptime: process.uptime(),
  });
});
```

Used by deployment health checks and the profiling overlay.

### 3.2 Perception Endpoint

```javascript
app.get('/perception/:citizenId', (req, res) => {
  const citizen = citizens.get(req.params.citizenId);
  if (!citizen) {
    return res.status(404).json({ error: 'Citizen not found' });
  }
  const visible = [];
  for (const [id, c] of citizens) {
    if (id === req.params.citizenId) continue;
    visible.push({
      id,
      name: c.name,
      position: c.position,
      distance: Math.sqrt(
        (c.position.x - citizen.position.x) ** 2 +
        (c.position.y - citizen.position.y) ** 2 +
        (c.position.z - citizen.position.z) ** 2
      ),
    });
  }
  res.json({ self: citizen, visible, timestamp: Date.now() });
});
```

### 3.3 Zone Definitions

```javascript
app.get('/api/zones', (req, res) => {
  res.json({ zones: ZONES });
});
```

### 3.4 Room Management (HTTP)

```javascript
app.get('/api/rooms', (req, res) => {
  res.json({ rooms: roomManager.listRooms() });
});

app.post('/api/rooms', (req, res) => {
  const { name, maxPlayers } = req.body || {};
  const room = roomManager.createRoom(name, { maxPlayers });
  res.json({ code: room.code, name: room.name });
});
```

### 3.5 Voice Injection Endpoint

```javascript
app.post('/speak', async (req, res) => {
  const { text, speaker, session_id } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const send = (obj) => broadcast(obj);
  try {
    await speakToWorld(text, send, { speaker, session_id });
    res.json({ ok: true, text: text.substring(0, 100) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

This endpoint allows external systems (orchestrator sessions, Telegram bridge)
to speak into the VR world. The text is converted to TTS and broadcast to
all connected WebSocket clients.

### 3.6 FastAPI Services Proxy

```javascript
const SERVICES_URL = process.env.CITIES_SERVICES_URL || 'http://localhost:8900';

app.use('/services', async (req, res) => {
  try {
    const url = `${SERVICES_URL}${req.url}`;
    const fetchOpts = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOpts.body = JSON.stringify(req.body);
    }
    const resp = await fetch(url, fetchOpts);
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (e) {
    res.status(503).json({
      error: 'services_unavailable',
      message: 'FastAPI services not running. Start with: uvicorn services.app:app --port 8900',
    });
  }
});
```

### 3.7 Static File Serving

```javascript
// Vault media (video files for memorial playback)
const vaultDir = join(__dirname, '..', '..', 'data', 'vault');
if (existsSync(vaultDir)) {
  app.use('/vault-media', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  }, express.static(vaultDir));
}

// Production client build
const distDir = join(__dirname, '..', '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
}
```

The `Cross-Origin-Resource-Policy: same-origin` header on vault media is
required because `Cross-Origin-Embedder-Policy: require-corp` is set globally.
Without CORP, the browser blocks media loads.

---

## 4. HTTP and HTTPS Servers

### 4.1 HTTP Server (Primary)

```javascript
const server = createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cities of Light HTTP: http://localhost:${PORT}`);
});
```

### 4.2 HTTPS Server (Local Quest Development)

```javascript
const HTTPS_PORT = 8443;
let httpsServer = null;

const certPath = '/tmp/cities-cert.pem';
const keyPath = '/tmp/cities-key.pem';
if (existsSync(certPath) && existsSync(keyPath)) {
  const sslOpts = {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
  httpsServer = createHttpsServer(sslOpts, app);
}

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`Cities of Light HTTPS: https://localhost:${HTTPS_PORT}`);
    // Log local network IPs for Quest access
    import('os').then(os => {
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            console.log(`  Quest URL: https://${net.address}:${HTTPS_PORT}`);
          }
        }
      }
    });
  });
}
```

Self-signed certificates are stored at `/tmp/cities-cert.pem` and
`/tmp/cities-key.pem`. Generated via the `@vitejs/plugin-basic-ssl`
Vite plugin during development, or manually with:

```bash
openssl req -x509 -newkey rsa:2048 -keyout /tmp/cities-key.pem \
  -out /tmp/cities-cert.pem -days 365 -nodes \
  -subj '/CN=localhost'
```

WebXR requires HTTPS. Quest 3 connects to the dev machine's LAN IP
over HTTPS (e.g., `https://192.168.1.100:8443`).

---

## 5. WebSocket Server

### 5.1 noServer Mode with Path Filtering

```javascript
const wss = new WebSocketServer({ noServer: true });

function handleUpgrade(request, socket, head) {
  if (request.url === '/ws' || request.url.startsWith('/ws?')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
}

server.on('upgrade', handleUpgrade);
if (httpsServer) httpsServer.on('upgrade', handleUpgrade);
```

The `noServer` mode means the WebSocket server does not create its own
HTTP server. Instead, upgrade requests on `/ws` are forwarded from the
Express HTTP(S) servers. Non-`/ws` upgrade requests are destroyed.

### 5.2 Connection Handler

```javascript
wss.on('connection', (ws) => {
  let citizenId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      // Dispatch based on msg.type
      switch (msg.type) {
        case 'join':       /* ... */ break;
        case 'position':   /* ... */ break;
        case 'hands':      /* ... */ break;
        case 'voice':      /* ... */ break;
        case 'biography_voice': /* ... */ break;
        case 'teleport':   /* ... */ break;
        case 'manemus_camera': /* ... */ break;
        case 'signaling':  /* ... */ break;
        case 'create_room': /* ... */ break;
        case 'join_room':  /* ... */ break;
      }
    } catch (e) {
      console.error('Message parse error:', e.message);
    }
  });

  ws.on('close', () => {
    if (citizenId) {
      const room = roomManager.getRoomForCitizen(citizenId);
      if (room) {
        roomManager.broadcastToRoom(room, { type: 'citizen_left', citizenId }, ws);
      }
      roomManager.leaveRoom(citizenId);
      citizens.delete(citizenId);
      connections.delete(ws);
    }
  });
});
```

### 5.3 Message Type Reference

| Type | Direction | Description |
|------|-----------|-------------|
| `join` | C->S | Client connects, provides name/persona/roomCode |
| `welcome` | S->C | Server confirms join with citizenId and roomCode |
| `position` | C->S | Client position/rotation update (100ms interval) |
| `citizen_moved` | S->C | Broadcast other citizen's position |
| `citizen_joined` | S->C | New citizen in room |
| `citizen_left` | S->C | Citizen disconnected |
| `citizen_zone_changed` | S->C | Citizen crossed zone boundary |
| `hands` | C->S | VR hand/controller joint data |
| `citizen_hands` | S->C | Broadcast hand data |
| `voice` | C->S | Base64 webm/opus audio from mic |
| `citizen_voice` | S->C | Raw voice broadcast to room |
| `voice_stream_start` | S->C | TTS text + metadata |
| `voice_stream_data` | S->C | TTS audio chunk |
| `voice_stream_end` | S->C | TTS stream complete |
| `ai_citizen_speak` | S->C | AI citizen text + position |
| `biography_voice` | C->S | Voice query for memorial |
| `biography_stream_*` | S->C | Biography TTS stream |
| `signaling` | C->S->C | WebRTC signaling relay |
| `voice_peers` | S->C | Peer list for WebRTC setup |
| `create_room` | C->S | Create a new room |
| `join_room` | C->S | Join existing room by code |
| `room_joined` | S->C | Room join confirmation |
| `room_error` | S->C | Room join failure |
| `teleport` | C->S | Teleport to zone |
| `manemus_camera` | C->S->C | Manemus camera position for stream |
| `server_shutdown` | S->C | Server shutting down |

---

## 6. In-Memory State

### 6.1 Global State Maps

```javascript
const citizens = new Map();    // citizenId -> CitizenState
const connections = new Map();  // WebSocket -> citizenId
const roomManager = new RoomManager();
```

### 6.2 CitizenState Shape

```javascript
{
  name: 'Nicolas',
  persona: null,           // null = human, 'ai' = AI citizen
  spectator: false,
  position: { x: 0, y: 1.7, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  zone: 'island',
  lastUpdate: 1710000000000,
  aiShape: null,           // 'icosahedron' | 'octahedron' | 'torusknot' for AI
  aiColor: null,           // hex color for AI citizens
}
```

### 6.3 Room State

Managed by `RoomManager` in `src/server/rooms.js`:

```javascript
// Room code generation — no I/O/0/1 to avoid visual confusion
const ROOM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Room shape:
{
  code: 'ABC123',
  name: 'Room ABC123',
  citizens: new Map(),  // citizenId -> { ws, name, persona, spectator }
  maxPlayers: 8,
  createdAt: Date.now(),
}
```

Default lobby code: `LOBBY0` (max 32 players).
Empty non-lobby rooms auto-delete after 30 seconds.

---

## 7. Broadcast Functions

### 7.1 Global Broadcast

```javascript
function broadcast(msg, exclude = null) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client !== exclude && client.readyState === 1) {
      client.send(data);
    }
  }
}
```

Used for AI citizen movements (shared across all rooms) and the `/speak`
endpoint (session voice injection).

### 7.2 Room-Scoped Broadcast

Via `roomManager.broadcastToRoom(room, msg, excludeWs)` and
`roomManager.broadcastFromCitizen(citizenId, msg, excludeWs)`.

Position updates, voice broadcasts, and signaling relay are all room-scoped.

### 7.3 Direct Send

Via `roomManager.sendToCitizen(citizenId, msg)` -- used for WebRTC
signaling relay to a specific target citizen.

---

## 8. Process Management

### 8.1 AI Citizen Behavior Tick (setInterval)

```javascript
const openai = new OpenAI();
const aiManager = new AICitizenManager(broadcast, openai);
// Internally: setInterval(() => this._tick(), 5000);
```

The AI citizen tick runs every 5 seconds. Each tick:
1. Picks a new wander target if idle or at current target
2. Moves citizen toward target (0.1 * moveSpeed per tick)
3. Updates facing direction (quaternion from yaw)
4. Applies float bob (sinusoidal Y offset)
5. Broadcasts `citizen_moved` globally

### 8.2 Stale Citizen Cleanup

Not yet implemented in the current codebase. Planned:

```javascript
// Every 60 seconds, remove citizens who disconnected without close
setInterval(() => {
  const staleThreshold = Date.now() - 120000;  // 2 minutes
  for (const [id, citizen] of citizens) {
    if (citizen.persona === 'ai') continue;
    if (citizen.lastUpdate < staleThreshold) {
      for (const [ws, wsId] of connections) {
        if (wsId === id) {
          ws.terminate();
          break;
        }
      }
      // Handle disconnect
    }
  }
}, 60000);
```

### 8.3 Voice Pipeline (Async)

Voice processing runs asynchronously without blocking the WebSocket:

```javascript
case 'voice': {
  // Step 1: Broadcast raw voice to room (immediate)
  roomManager.broadcastFromCitizen(citizenId, {
    type: 'citizen_voice', citizenId, name: citizen?.name, audio: msg.audio,
  }, ws);

  // Step 2: Process through STT -> LLM -> TTS (async, non-blocking)
  const send = (obj) => roomManager.broadcastFromCitizen(citizenId, obj);
  processVoiceStreaming(audioBuffer, send).then(async (result) => {
    if (!result?.transcription || !citizen) return;

    // Step 3: Check AI citizen proximity and respond
    const aiResult = await aiManager.checkProximityAndRespond(
      result.transcription, citizen.position, citizen.name || 'Someone',
    );
    if (aiResult) {
      speakAsAICitizen(aiResult.citizenId, aiResult.citizenName,
        aiResult.text, aiResult.position, send);
    }
  });
}
```

---

## 9. Zone Detection

### 9.1 Position to Zone Resolution

```javascript
// src/shared/zones.js — detectNearestZone()
// Used by both client (ZoneAmbient) and server (position handler)

import { detectNearestZone } from '../shared/zones.js';

// In position handler:
const { zone } = detectNearestZone(msg.position);
if (zone.id !== citizen.zone) {
  const oldZone = citizen.zone;
  citizen.zone = zone.id;
  roomManager.broadcastFromCitizen(citizenId, {
    type: 'citizen_zone_changed',
    citizenId, oldZone, newZone: zone.id,
  });
}
```

Zone detection runs on every position update. The `detectNearestZone`
function computes 2D distance (XZ plane) to each zone center and returns
the nearest one.

---

## 10. Venezia Extension: New Server Modules

### 10.1 venice-state.js (World State Manager)

```javascript
// New: in-memory cache of Airtable-synced Venice world state

export class VeniceState {
  constructor() {
    this.citizens = new Map();     // Airtable CITIZENS records
    this.buildings = new Map();    // Airtable BUILDINGS records
    this.contracts = new Map();    // Active CONTRACTS
    this.relationships = new Map(); // Trust scores
    this.lastSync = 0;
    this.changeEvents = [];        // Diff since last sync
  }

  /**
   * Replace full state from Airtable sync.
   * Computes diff and generates change events.
   */
  applySync(data) {
    const events = [];

    for (const [id, newCitizen] of data.citizens) {
      const old = this.citizens.get(id);
      if (!old) {
        events.push({ type: 'citizen_appeared', citizenId: id, data: newCitizen });
      } else if (old.mood !== newCitizen.mood) {
        events.push({ type: 'mood_changed', citizenId: id,
          from: old.mood, to: newCitizen.mood });
      }
      this.citizens.set(id, newCitizen);
    }

    this.changeEvents = events;
    this.lastSync = Date.now();
    return events;
  }
}
```

### 10.2 serenissima-sync.js (Airtable Sync)

```javascript
// New: pulls citizen data, buildings, contracts from Airtable every 15 minutes

export class SerenissimaSync {
  constructor(veniceState, airtableApiKey, baseId) {
    this.state = veniceState;
    this.apiKey = airtableApiKey;
    this.baseId = baseId;
    this._interval = null;
  }

  start(intervalMs = 900000) {  // 15 minutes
    this.sync();
    this._interval = setInterval(() => this.sync(), intervalMs);
  }

  async sync() {
    const tables = ['Citizens', 'Buildings', 'Contracts', 'Activities', 'Relationships'];
    const data = {};

    for (const table of tables) {
      data[table] = await this._fetchTable(table);
      await this._sleep(200);  // Airtable rate limit: 5 req/s
    }

    const events = this.state.applySync(data);
    return events;
  }

  async _fetchTable(tableName) {
    // Paginate through all records
    const records = [];
    let offset = null;
    do {
      const url = `https://api.airtable.com/v0/${this.baseId}/${tableName}` +
        (offset ? `?offset=${offset}` : '');
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      const data = await resp.json();
      records.push(...data.records);
      offset = data.offset;
    } while (offset);
    return records;
  }
}
```

### 10.3 citizen-router.js (Conversation Routing)

```javascript
// New: routes visitor speech to the nearest citizen with full context assembly

import Anthropic from '@anthropic-ai/sdk';

export class CitizenRouter {
  constructor(veniceState, anthropic) {
    this.state = veniceState;
    this.anthropic = anthropic;
    this.conversationCache = new Map();  // citizenId -> last 10 turns
  }

  async routeSpeech(transcription, visitorPosition, visitorName) {
    // 1. Find nearest FULL-tier citizen facing visitor
    const target = this._selectTarget(visitorPosition);
    if (!target) return null;

    // 2. Assemble context
    const context = this._assembleContext(target, visitorName, transcription);

    // 3. Call Claude
    const msg = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: target.systemPrompt,
      messages: context,
    });

    return {
      citizenId: target.id,
      citizenName: target.name,
      text: msg.content[0].text,
      position: target.position,
    };
  }
}
```

### 10.4 physics-bridge.js (Blood Ledger Integration)

```javascript
// New: runs physics ticks via FalkorDB graph queries

export class PhysicsBridge {
  constructor(falkordbClient, veniceState) {
    this.db = falkordbClient;
    this.state = veniceState;
    this._interval = null;
  }

  start(intervalMs = 300000) {  // 5 minutes
    this._interval = setInterval(() => this.tick(), intervalMs);
  }

  async tick() {
    // Sync citizen data to graph
    for (const [id, citizen] of this.state.citizens) {
      await this.db.graph('venezia').query(
        `MERGE (c:Character {id: $id})
         SET c.energy = $energy, c.weight = $weight`,
        { id, energy: citizen.activity_level, weight: citizen.ducats }
      );
    }

    // Run physics tick
    // Check for Moment flips -> world events
  }
}
```

---

## 11. Graceful Shutdown

### 11.1 Current Implementation

The current `index.js` does not implement graceful shutdown. The process
exits immediately on SIGTERM/SIGINT (Node.js default behavior).

### 11.2 Planned Implementation

```javascript
function initGracefulShutdown(httpServer, httpsServer, wss, aiManager) {
  let shuttingDown = false;

  const handleSignal = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down...`);

    // Stop accepting new connections
    httpServer.close();
    if (httpsServer) httpsServer.close();

    // Notify all clients
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'server_shutdown',
          message: 'Server restarting, reconnect in a few seconds',
        }));
      }
    }

    // Wait 1s for messages to flush, then close
    setTimeout(() => {
      for (const client of wss.clients) {
        client.close(1001, 'Server shutting down');
      }
      aiManager.destroy();
      process.exit(0);
    }, 1000);

    // Force exit after 5s
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGTERM', handleSignal);
  process.on('SIGINT', handleSignal);
}
```

---

## 12. Planned Middleware Additions

### 12.1 HTTP Rate Limiting

```javascript
// npm install express-rate-limit
import rateLimit from 'express-rate-limit';

app.use('/speak', rateLimit({ windowMs: 5000, max: 1 }));
app.use('/state', rateLimit({ windowMs: 1000, max: 1 }));
app.use('/api/', rateLimit({ windowMs: 1000, max: 10 }));
```

### 12.2 Health Check Endpoint

```javascript
app.get('/health', async (req, res) => {
  const checks = {
    express: {
      status: 'healthy',
      uptime: process.uptime(),
      connections: connections.size,
      citizens: citizens.size,
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };

  // FalkorDB ping (when implemented)
  // Airtable connectivity probe (when implemented)

  const overallStatus = 'healthy';
  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
});
```

### 12.3 CORS Configuration

Currently, CORS is not explicitly configured. The `Cross-Origin-*` headers
serve a different purpose (SharedArrayBuffer enablement). For production
with a separate domain:

```javascript
import cors from 'cors';

app.use(cors({
  origin: [
    'https://venezia.mindprotocol.ai',
    'https://citiesoflight.ai',
    /^https:\/\/.*\.mindprotocol\.ai$/,
  ],
  methods: ['GET', 'POST'],
  credentials: true,
}));
```

### 12.4 WebSocket Heartbeat

```javascript
const HEARTBEAT_INTERVAL = 30000;

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws._isAlive === false) {
      ws.terminate();
      continue;
    }
    ws._isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL);

wss.on('connection', (ws) => {
  ws._isAlive = true;
  ws.on('pong', () => { ws._isAlive = true; });
});
```

---

## 13. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | none | Whisper STT + GPT-4o + fallback TTS |
| `ELEVENLABS_API_KEY` | No | none | Primary TTS provider |
| `ELEVENLABS_VOICE_ID` | No | `pNInz6obpgDQGcFmaJgB` | Default ElevenLabs voice |
| `CITIES_SERVICES_URL` | No | `http://localhost:8900` | FastAPI biography/consent backend |
| `HOME` | Yes | system | Used to locate manemus paths |
| `NODE_ENV` | No | none | `production` disables dev features |
| `FALKORDB_URL` | No | `redis://localhost:6379` | FalkorDB connection (planned) |
| `AIRTABLE_PAT` | No | none | Airtable Personal Access Token (planned) |
| `AIRTABLE_BASE_ID` | No | none | Serenissima Airtable base (planned) |

---

## 14. File Map

```
src/server/
  index.js              ← Express + WebSocket server (THIS FILE)
  voice.js              ← STT -> GPT-4o -> TTS pipeline
  biography-voice.js    ← Memorial biography voice queries
  ai-citizens.js        ← AI citizen behavior + LLM responses
  rooms.js              ← Room creation, join, leave, broadcast
  perception.js         ← Marco camera frame upload routes
  venice-state.js       ← NEW: Airtable world state cache
  citizen-router.js     ← NEW: Citizen conversation routing
  physics-bridge.js     ← NEW: FalkorDB physics tick runner
  serenissima-sync.js   ← NEW: Airtable data sync (15min)
```

## Canonical Server Entrypoint (2026-03-14)

Cities of Light now exposes a single canonical Node entrypoint:

- `src/server/canonical_server_entrypoint_router.js`

Runtime mode is selected by `CITIES_SERVER_MODE`:

- `legacy` (default) → boots `src/server/index.js`
- `engine` → boots `engine/index.js` and requires `WORLD_MANIFEST`

Fail-loud contract:

- `CITIES_SERVER_MODE=engine` without `WORLD_MANIFEST` throws immediately.
- Unsupported `CITIES_SERVER_MODE` throws immediately.
- No silent fallback from `engine` to `legacy` is allowed.

### WS/API compatibility matrix

| Capability | Legacy (`src/server/index.js`) | Engine (`engine/server/state-server.js` via `engine/index.js`) |
|---|---|---|
| WS endpoint | `/ws` | `/ws` |
| HTTP health | `/health` | `/health` |
| State snapshot | `/state` | `/api/entities` + WS `state_snapshot` |
| Rooms API | `/api/rooms` | Not implemented (world-agnostic baseline) |
| Places API | `/api/places` | Not implemented (world-agnostic baseline) |
| Services proxy (`/services`) | Present | Not present by default |
| Voice HTTP | `/speak` (+ legacy voice routes) | `/voice` |
| Voice WS | Legacy `voice` messages | `voice_data` stream messages |

Migration note:
- Canonical process entrypoint is unified, but feature parity is intentionally explicit and incomplete.
- Consumers should treat room/place endpoints as legacy-only until parity work lands in engine mode.

## Full Stack Sprint Delivery (2026-03-14, batch 2-10)

- Services bridge hardening implemented in `src/server/index.js` with timeout + structured upstream error semantics.
- Integration probe endpoints added: `/integration/health`, `/integration/state`.
- Engine bootstrap reproducibility runner added: `scripts/bootstrap_engine_with_venezia_manifest_validation_runner.sh`.
- Engine manifest validation upgraded to fail-loud in `engine/index.js`.
- Narrative physics bridge wired in `engine/server/narrative_graph_seed_and_tick_bridge.js`.
- Geographic projection utilities added for exact world-space placement.
- Geographic terrain now includes explicit water plane and strict projection contract.
- Voice pipeline now supports class-based voice routing and enriched citizen context.
- Entity manager now writes memory nodes (`memory_nodes.jsonl`) and applies spawn/despawn lifecycle via tiers.

