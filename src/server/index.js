/**
 * Cities of Light — Spatial State Server
 *
 * Tracks citizen positions, zone states, and bridges
 * between the WebXR world and Mind infrastructure.
 */

import { WebSocketServer } from 'ws';
import express from 'express';
import { createServer } from 'http';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { perceptionRoutes } from './perception.js';
import { processVoice, processVoiceStreaming, speakToWorld, speakAsAICitizen } from './voice.js';
import { processBiographyVoice } from './biography-voice.js';
import { ZONES, detectNearestZone } from '../shared/zones.js';
import { AICitizenManager } from './ai-citizens.js';
import { RoomManager } from './rooms.js';
import { GraphClient } from './graph-client.js';
import { PlaceServer } from './place-server.js';
import { MomentPipeline } from './moment-pipeline.js';
import { PhysicsBridge } from './physics-bridge.js';
import { mountSSERoutes } from './sse-stream.js';
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT, 10) || 8800;

// ─── State ──────────────────────────────────────────────

const citizens = new Map(); // id → { position, rotation, name, persona, zone, lastUpdate }
const connections = new Map(); // ws → citizenId
const roomManager = new RoomManager();
let placeServer = null;
let physicsBridge = null;

// ─── Express (HTTP API) ─────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' })); // Large for frame uploads

// Allow WebXR, microphone, camera through tunnels/iframes
// COOP/COEP for SharedArrayBuffer (improves audio perf on Quest)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'xr-spatial-tracking=(*), microphone=(*), camera=(*)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Perception pipeline routes
perceptionRoutes(app);

// Health check (Render uses this to verify the service is alive)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Current state snapshot
app.get('/state', (req, res) => {
  const state = {
    citizens: Object.fromEntries(citizens),
    connections: connections.size,
    uptime: process.uptime(),
  };
  res.json(state);
});

// Mind perception endpoint — returns frame for AI processing
app.get('/perception/:citizenId', (req, res) => {
  const citizen = citizens.get(req.params.citizenId);
  if (!citizen) {
    return res.status(404).json({ error: 'Citizen not found' });
  }
  // Return what this citizen "sees" — positions of all other citizens relative to them
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
  res.json({
    self: citizen,
    visible,
    timestamp: Date.now(),
  });
});

// Zone definitions endpoint
app.get('/api/zones', (req, res) => {
  res.json({ zones: ZONES });
});

// Room list endpoint
app.get('/api/rooms', (req, res) => {
  res.json({ rooms: roomManager.listRooms() });
});

// Create room endpoint
app.post('/api/rooms', (req, res) => {
  const { name, maxPlayers } = req.body || {};
  const room = roomManager.createRoom(name, { maxPlayers });
  res.json({ code: room.code, name: room.name });
});

// ─── Living Places API ────────────────────────────────
app.get('/api/places', async (req, res) => {
  if (!placeServer) return res.status(503).json({ error: 'Living Places not available' });
  const places = [];
  for (const [id, room] of placeServer.rooms) {
    places.push({
      id, name: room.name, capacity: room.capacity,
      access_level: room.access_level, participants: room.participants.size,
    });
  }
  res.json({ places });
});

app.post('/api/places', async (req, res) => {
  if (!placeServer) return res.status(503).json({ error: 'Living Places not available' });
  const { name, capacity, access_level } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const place_id = `place_${Date.now().toString(36)}`;
  try {
    await placeServer.graphClient.createSpace(place_id, name, capacity || 20, access_level || 'public', 'active');
    placeServer._initRoom({ id: place_id, name, capacity: capacity || 20, access_level: access_level || 'public', status: 'active' });
    res.json({ place: { id: place_id, name, capacity: capacity || 20, access_level: access_level || 'public' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/places/:id/notify', async (req, res) => {
  if (!placeServer) return res.status(503).json({ error: 'Living Places not available' });
  await placeServer.handleNotifyHTTP(req, res);
});

// ─── SSE Stream (narrative playthrough streaming) ─────
const playthroughsDir = process.env.PLAYTHROUGHS_DIR || join(__dirname, '..', '..', 'playthroughs');
const sseStreams = mountSSERoutes(app, playthroughsDir);

// ─── Physics API ──────────────────────────────────────
app.get('/api/physics', (req, res) => {
  if (!physicsBridge) return res.status(503).json({ error: 'Physics engine not available' });
  const lastResult = physicsBridge.getLastTickResult();
  res.json({
    running: !physicsBridge._stopped,
    tick_count: physicsBridge._tickCount,
    tick_interval_ms: physicsBridge.tickInterval,
    last_tick: lastResult ? {
      success: lastResult.success,
      tick: lastResult.tick,
      elapsed_ms: lastResult.elapsed_ms,
      summary: lastResult.summary,
    } : null,
  });
});

app.post('/api/physics/tick', async (req, res) => {
  if (!physicsBridge) return res.status(503).json({ error: 'Physics engine not available' });
  const result = await physicsBridge.runOnce();
  res.json(result || { error: 'Tick skipped (already in progress)' });
});

// ─── Citizen Brain API (graph-backed context) ─────────
// Returns real data from FalkorDB — what a citizen thinks, knows, and is doing

let _graphClientRef = null; // set after GraphClient connects

app.get('/api/citizen/:id/context', async (req, res) => {
  if (!_graphClientRef) return res.status(503).json({ error: 'Graph not connected' });
  const citizenId = req.params.id;

  try {
    // Query citizen's real state from graph
    const result = await _graphClientRef.query(`
      MATCH (a:Actor {id: $id})
      OPTIONAL MATCH (a)-[r]->(n)
      WHERE n.node_type IN ['narrative', 'moment', 'space']
      RETURN a.id AS id, a.name AS name, a.synthesis AS synthesis,
             a.weight AS weight, a.energy AS energy,
             collect(DISTINCT {
               type: n.node_type,
               name: n.name,
               synthesis: n.synthesis,
               weight: r.weight
             })[0..10] AS connections
    `, { id: citizenId });

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Citizen not found' });
    }

    const citizen = result[0];
    res.json({
      id: citizen.id,
      name: citizen.name,
      synthesis: citizen.synthesis,
      energy: citizen.energy,
      weight: citizen.weight,
      connections: citizen.connections || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/citizen/:id/thought', async (req, res) => {
  if (!_graphClientRef) return res.status(503).json({ error: 'Graph not connected' });
  const citizenId = req.params.id;

  try {
    // Get citizen's current narratives and recent moments — these ARE their thoughts
    const result = await _graphClientRef.query(`
      MATCH (a:Actor {id: $id})-[r]->(n:Narrative)
      RETURN n.synthesis AS thought, r.weight AS weight, r.energy AS energy
      ORDER BY r.energy DESC, r.weight DESC
      LIMIT 5
    `, { id: citizenId });

    // Also get recent moments
    const moments = await _graphClientRef.query(`
      MATCH (a:Actor {id: $id})-[r]->(m:Moment)
      RETURN m.synthesis AS thought, m.content AS content, r.weight AS weight
      ORDER BY m.created_at_s DESC
      LIMIT 3
    `, { id: citizenId });

    const thoughts = [
      ...(result || []).map(r => ({ text: r.thought, source: 'narrative', weight: r.weight, energy: r.energy })),
      ...(moments || []).map(m => ({ text: m.thought || m.content, source: 'moment', weight: m.weight })),
    ].filter(t => t.text);

    res.json({ citizen_id: citizenId, thoughts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Batch endpoint — get thoughts for multiple citizens at once (for ambient bubbles)
app.post('/api/citizens/thoughts', async (req, res) => {
  if (!_graphClientRef) return res.status(503).json({ error: 'Graph not connected' });
  const { citizen_ids } = req.body || {};
  if (!citizen_ids || !Array.isArray(citizen_ids)) {
    return res.status(400).json({ error: 'citizen_ids array required' });
  }

  try {
    const result = await _graphClientRef.query(`
      MATCH (a:Actor)-[r]->(n:Narrative)
      WHERE a.id IN $ids
      RETURN a.id AS citizen_id, n.synthesis AS thought, r.energy AS energy
      ORDER BY r.energy DESC
    `, { ids: citizen_ids });

    // Group by citizen, take top thought
    const thoughts = {};
    for (const row of (result || [])) {
      if (!thoughts[row.citizen_id] && row.thought) {
        thoughts[row.citizen_id] = row.thought;
      }
    }

    res.json({ thoughts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Citizen Perception (routed via L4 endpoint) ─────
// Player enters a citizen's field of view → route to citizen's MCP endpoint
// The citizen's MCP instance handles context assembly + LLM call

app.post('/api/citizen/:id/perceive', async (req, res) => {
  const citizenId = req.params.id;
  const { screenshot_base64, player_name, location_name, nearby_building, time_of_day, speech_text } = req.body || {};

  // 1. Resolve citizen endpoint from L4 graph
  let citizenEndpoint = null;
  try {
    const l4Result = await GraphClient.connect({
      host: process.env.L4_GRAPH_HOST || process.env.FALKORDB_HOST || 'localhost',
      port: parseInt(process.env.L4_GRAPH_PORT || process.env.FALKORDB_PORT || '6379'),
      graph: process.env.L4_GRAPH_NAME || 'mind_protocol',
    });

    const endpoints = await l4Result.query(`
      MATCH (a:Actor {id: $cid})-[]->(t:Thing {type: 'citizen_endpoint'})
      WHERE t.status = 'active'
      RETURN t.uri AS url, t.repo_name AS repo
      ORDER BY t.last_heartbeat DESC
      LIMIT 1
    `, { cid: citizenId });

    if (endpoints && endpoints.length > 0) {
      citizenEndpoint = endpoints[0].url;
    }
  } catch (e) {
    console.warn(`[Perception] L4 lookup failed for ${citizenId}: ${e.message}`);
  }

  // 2. Build perception payload
  const payload = {
    type: 'perception',
    citizen_id: citizenId,
    stimulus: {
      kind: 'visual_approach',
      player_name: player_name || 'a stranger',
      location: location_name || 'Venice',
      nearby_building: nearby_building || null,
      time: time_of_day || new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      screenshot_base64: screenshot_base64 || null,
    },
  };

  // 3. Route to citizen's MCP endpoint (HTTP POST)
  if (citizenEndpoint) {
    try {
      console.log(`[Perception] Routing to ${citizenId} @ ${citizenEndpoint}`);
      const mpcResp = await fetch(`${citizenEndpoint}/perceive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      if (mpcResp.ok) {
        const data = await mpcResp.json();
        return res.json({
          citizen_id: citizenId,
          citizen_name: data.citizen_name || citizenId,
          text: data.text || '',
          source: 'mcp_endpoint',
        });
      }
      console.warn(`[Perception] MCP endpoint returned ${mpcResp.status}, falling back`);
    } catch (e) {
      console.warn(`[Perception] MCP delivery failed for ${citizenId}: ${e.message}, falling back`);
    }
  }

  // 4. Fallback: assemble context locally from graph + call LLM
  if (!_graphClientRef) {
    return res.status(503).json({ error: 'No endpoint and no graph — citizen unreachable' });
  }

  try {
    const ctxResult = await _graphClientRef.query(`
      MATCH (a:Actor {id: $id})
      OPTIONAL MATCH (a)-[r]->(n:Narrative)
      WITH a, collect(n.synthesis)[0..3] AS thoughts
      RETURN a.name AS name, a.synthesis AS synthesis, thoughts
    `, { id: citizenId });

    if (!ctxResult || ctxResult.length === 0) {
      return res.status(404).json({ error: 'Citizen not found' });
    }

    const citizen = ctxResult[0];
    const thoughts = (citizen.thoughts || []).filter(Boolean).join('. ');
    const locationCtx = location_name ? `You are at ${location_name}.` : '';
    const buildingCtx = nearby_building ? `Nearby: ${nearby_building}.` : '';
    const timeCtx = time_of_day || new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    // Dynamic import — only load Anthropic SDK if we need fallback
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const content = [];
    if (screenshot_base64) {
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: screenshot_base64 } });
      content.push({ type: 'text', text: 'You see this approaching you. React in character.' });
    } else {
      content.push({ type: 'text', text: speech_text
        ? `Someone says to you: "${speech_text}". Respond in character.`
        : 'Someone is approaching you. React in character.' });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system: `You are ${citizen.name}, a citizen of Venice in the year 1499.
${citizen.synthesis || ''}
Your current thoughts: ${thoughts || 'going about your day'}
${locationCtx} ${buildingCtx} It is ${timeCtx}.
A person${player_name ? ` named ${player_name}` : ''} is nearby.${speech_text ? ` They say: "${speech_text}"` : ' They are approaching you.'} React naturally — busy with your life but engage. Speak in character, in English (with occasional Italian words). Be brief (1-3 sentences).`,
      messages: [{ role: 'user', content }],
    });

    res.json({
      citizen_id: citizenId,
      citizen_name: citizen.name,
      text: response.content?.[0]?.text || '',
      source: 'fallback_local',
    });
  } catch (e) {
    console.error(`[Perception] Fallback failed for ${citizenId}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Voice-to-Citizen (STT → route to citizen) ───────
// Player speaks via mic → Whisper STT → text routed to nearest citizen

app.post('/api/citizen/voice', async (req, res) => {
  const { audio_base64, citizen_id, player_name, player_position } = req.body || {};
  if (!audio_base64) return res.status(400).json({ error: 'audio_base64 required' });
  if (!citizen_id) return res.status(400).json({ error: 'citizen_id required' });

  try {
    // 1. STT via Whisper
    const audioBuffer = Buffer.from(audio_base64, 'base64');
    const { writeFileSync, createReadStream } = await import('fs');
    const { tmpdir } = await import('os');
    const { join: joinPath } = await import('path');
    const tempPath = joinPath(tmpdir(), `voice_${Date.now()}.webm`);
    writeFileSync(tempPath, audioBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: 'whisper-1',
    });

    const text = transcription.text?.trim();
    if (!text) return res.json({ error: 'Could not transcribe', text: '' });

    console.log(`🗣️ ${player_name || 'Player'} → ${citizen_id}: "${text}"`);

    // 2. Route to citizen's perceive endpoint with speech instead of screenshot
    const perceiveResp = await fetch(`http://localhost:${PORT}/api/citizen/${encodeURIComponent(citizen_id)}/perceive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_name,
        location_name: 'Venice',
        speech_text: text,
        time_of_day: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      }),
    });

    if (perceiveResp.ok) {
      const data = await perceiveResp.json();
      res.json(data);
    } else {
      res.status(502).json({ error: 'Citizen did not respond' });
    }
  } catch (e) {
    console.error(`[Voice] Error:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Speak endpoint (sessions push voice into the world) ──
// POST /speak { text, speaker?, session_id? }
// Runs TTS and broadcasts audio to all connected clients.
app.post('/speak', async (req, res) => {
  const { text, speaker, session_id } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  console.log(`🔊 Session speaks: "${text.substring(0, 80)}..." (${speaker || session_id || 'anonymous'})`);

  const send = (obj) => broadcast(obj);

  try {
    await speakToWorld(text, send, { speaker, session_id });
    res.json({ ok: true, text: text.substring(0, 100) });
  } catch (e) {
    console.error('Speak error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Services API (vault, consent, donors, biography) ────

// Proxy to FastAPI services if running, otherwise return service-unavailable
const SERVICES_URL = process.env.CITIES_SERVICES_URL || 'http://localhost:8900';

app.use('/services', async (req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `${SERVICES_URL}${req.url}`;
    const fetchOpts = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOpts.body = JSON.stringify(req.body || {});
    }

    const resp = await fetch(url, fetchOpts);
    const contentType = resp.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await resp.json()
      : { raw: await resp.text() };

    res.status(resp.status).json({
      ok: resp.ok,
      upstream: SERVICES_URL,
      status: resp.status,
      data: payload,
    });
  } catch (e) {
    const timeoutHit = e.name === 'AbortError';
    res.status(503).json({
      error: timeoutHit ? 'services_timeout' : 'services_unavailable',
      message: timeoutHit
        ? 'FastAPI services timeout after 5000ms'
        : 'FastAPI services not running. Start with: uvicorn services.app:app --port 8900',
      upstream: SERVICES_URL,
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.get('/integration/health', async (req, res) => {
  let services = { ok: false, status: 503 };
  try {
    const r = await fetch(`${SERVICES_URL}/health`);
    services = { ok: r.ok, status: r.status };
  } catch (e) { console.debug('Services health check unreachable:', e?.message || e); }

  res.json({
    server: { ok: true, uptime: process.uptime() },
    services,
  });
});

app.get('/integration/state', (req, res) => {
  res.json({
    local: { citizens: citizens.size, connections: connections.size },
    services_upstream: SERVICES_URL,
  });
});

// ─── World data (serve ALL worlds from worlds/ directory) ──

const worldsDir = join(__dirname, '..', '..', 'worlds');
if (existsSync(worldsDir)) {
  app.use('/worlds', express.static(worldsDir));
  const worlds = readdirSync(worldsDir).filter(f => existsSync(join(worldsDir, f, 'world-manifest.json')));
  console.log(`Serving ${worlds.length} world(s): ${worlds.join(', ')}`);
} else {
  console.warn('No worlds/ directory found — 3D client will not load worlds');
}

// ─── Vault media (videos for memorial playback) ──────────

const vaultDir = join(__dirname, '..', '..', 'data', 'vault');
if (existsSync(vaultDir)) {
  app.use('/vault-media', (req, res, next) => {
    // CORP header so media works with COEP
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  }, express.static(vaultDir));
  console.log(`Serving vault media from ${vaultDir}`);
}

// ─── Static files (production build) ─────────────────────

const distDir = join(__dirname, '..', '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  console.log(`Serving static files from ${distDir}`);
}

// ─── HTTPS server (stable local URL for Quest) ───────────

import { createServer as createHttpsServer } from 'https';

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

// HTTP server (for tunnel + local)
const server = createServer(app);

// ─── WebSocket (same port, /ws path) ─────────────────────

const wss = new WebSocketServer({ noServer: true });

function handleUpgrade(request, socket, head) {
  const url = request.url || '';
  if (url === '/ws' || url.startsWith('/ws?')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (url.startsWith('/places/ws')) {
    if (placeServer) {
      placeServer.handleUpgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  } else {
    socket.destroy();
  }
}

server.on('upgrade', handleUpgrade);
if (httpsServer) httpsServer.on('upgrade', handleUpgrade);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cities of Light HTTP: http://localhost:${PORT}`);
});

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`Cities of Light HTTPS: https://localhost:${HTTPS_PORT}`);
    // Show local network IPs for Quest access
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

wss.on('connection', (ws) => {
  let citizenId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case 'join': {
          citizenId = msg.citizenId || `citizen_${Date.now()}`;
          const isSpectator = !!msg.spectator;
          const roomCode = msg.roomCode || null;

          citizens.set(citizenId, {
            name: msg.name || 'Unknown',
            persona: msg.persona || null,
            spectator: isSpectator,
            position: { x: 0, y: 1.7, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            zone: 'island',
            lastUpdate: Date.now(),
          });
          connections.set(ws, citizenId);

          // Join room — specific code, or default lobby
          let room;
          if (roomCode && roomCode !== 'LOBBY0') {
            const result = roomManager.joinRoom(roomCode, citizenId, ws, {
              name: msg.name, persona: msg.persona, spectator: isSpectator,
            });
            if (result.error) {
              // Room not found or full — fall back to lobby
              console.log(`Room ${roomCode} ${result.error}, falling back to lobby`);
              room = roomManager.getOrCreateLobby();
              roomManager.joinRoom('LOBBY0', citizenId, ws, {
                name: msg.name, persona: msg.persona, spectator: isSpectator,
              });
            } else {
              room = result.room;
            }
          } else {
            room = roomManager.getOrCreateLobby();
            roomManager.joinRoom('LOBBY0', citizenId, ws, {
              name: msg.name, persona: msg.persona, spectator: isSpectator,
            });
          }

          console.log(`${isSpectator ? 'Spectator' : 'Citizen'} joined: ${msg.name} (${citizenId}) → room ${room.code}`);

          // Send existing non-spectator citizens IN THIS ROOM to the new client
          for (const [id, c] of citizens) {
            if (id === citizenId) continue;
            if (c.spectator) continue;
            // Only send citizens in the same room
            if (roomManager.getRoomForCitizen(id)?.code !== room.code) continue;
            const joinMsg = {
              type: 'citizen_joined',
              citizenId: id,
              name: c.name,
              persona: c.persona,
            };
            if (c.persona === 'ai') {
              joinMsg.aiShape = c.aiShape;
              joinMsg.aiColor = c.aiColor;
            }
            ws.send(JSON.stringify(joinMsg));
            ws.send(JSON.stringify({
              type: 'citizen_moved',
              citizenId: id,
              position: c.position,
              rotation: c.rotation,
            }));
          }

          // Send welcome with room info
          ws.send(JSON.stringify({
            type: 'welcome',
            citizenId,
            roomCode: room.code,
            roomName: room.name,
          }));

          // Send AI citizens to the new client (shared across all rooms)
          for (const aiState of aiManager.getAllStates()) {
            ws.send(JSON.stringify({
              type: 'citizen_joined',
              ...aiState,
            }));
            ws.send(JSON.stringify({
              type: 'citizen_moved',
              citizenId: aiState.citizenId,
              position: aiState.position,
              rotation: aiState.rotation,
            }));
          }

          // Send peer list for WebRTC voice setup
          const peers = roomManager.getPeers(citizenId);
          if (peers.length > 0) {
            ws.send(JSON.stringify({
              type: 'voice_peers',
              peers,
            }));
          }

          // Broadcast join to others in room (spectators don't create avatars)
          if (!isSpectator) {
            roomManager.broadcastToRoom(room, {
              type: 'citizen_joined',
              citizenId,
              name: msg.name,
              persona: msg.persona,
            }, ws);
          }
          break;
        }

        // ─── Room management ──────────────────────────
        case 'create_room': {
          if (!citizenId) break;
          const newRoom = roomManager.createRoom(msg.name, { maxPlayers: msg.maxPlayers });
          // Auto-join the creator
          const citizen = citizens.get(citizenId);
          roomManager.joinRoom(newRoom.code, citizenId, ws, {
            name: citizen?.name, persona: citizen?.persona, spectator: citizen?.spectator,
          });
          ws.send(JSON.stringify({
            type: 'room_joined',
            roomCode: newRoom.code,
            roomName: newRoom.name,
          }));
          break;
        }

        case 'join_room': {
          if (!citizenId || !msg.roomCode) break;
          const citizen = citizens.get(citizenId);
          const oldRoom = roomManager.getRoomForCitizen(citizenId);

          // Notify old room that we left
          if (oldRoom) {
            roomManager.broadcastToRoom(oldRoom, {
              type: 'citizen_left', citizenId,
            }, ws);
          }

          const result = roomManager.joinRoom(msg.roomCode, citizenId, ws, {
            name: citizen?.name, persona: citizen?.persona, spectator: citizen?.spectator,
          });

          if (result.error) {
            ws.send(JSON.stringify({ type: 'room_error', error: result.error }));
          } else {
            ws.send(JSON.stringify({
              type: 'room_joined',
              roomCode: result.room.code,
              roomName: result.room.name,
            }));
            // Notify new room
            if (!citizen?.spectator) {
              roomManager.broadcastToRoom(result.room, {
                type: 'citizen_joined',
                citizenId,
                name: citizen?.name,
                persona: citizen?.persona,
              }, ws);
            }
            // Send peer list for voice
            const peers = roomManager.getPeers(citizenId);
            if (peers.length > 0) {
              ws.send(JSON.stringify({ type: 'voice_peers', peers }));
            }
          }
          break;
        }

        // ─── WebRTC Signaling (voice chat) ────────────
        case 'signaling': {
          if (!citizenId || !msg.targetCitizenId) break;
          // Relay signaling message to target citizen
          roomManager.sendToCitizen(msg.targetCitizenId, {
            type: 'signaling',
            sigType: msg.sigType,
            fromCitizenId: citizenId,
            sdp: msg.sdp,
            candidate: msg.candidate,
          });
          break;
        }

        // ─── Position sync (room-scoped) ──────────────
        case 'position': {
          if (!citizenId) break;
          const citizen = citizens.get(citizenId);
          if (citizen) {
            citizen.position = msg.position;
            if (msg.rotation) citizen.rotation = msg.rotation;
            citizen.lastUpdate = Date.now();

            // Zone detection
            const { zone } = detectNearestZone(msg.position);
            if (zone.id !== citizen.zone) {
              const oldZone = citizen.zone;
              citizen.zone = zone.id;
              roomManager.broadcastFromCitizen(citizenId, {
                type: 'citizen_zone_changed',
                citizenId,
                oldZone,
                newZone: zone.id,
              });
            }

            // Broadcast position to room
            roomManager.broadcastFromCitizen(citizenId, {
              type: 'citizen_moved',
              citizenId,
              position: msg.position,
              rotation: msg.rotation,
            }, ws);
          }
          break;
        }

        case 'mind_camera': {
          roomManager.broadcastFromCitizen(citizenId, {
            type: 'mind_camera',
            position: msg.position,
            rotation: msg.rotation,
          }, ws);
          break;
        }

        case 'hands': {
          if (!citizenId) break;
          roomManager.broadcastFromCitizen(citizenId, {
            type: 'citizen_hands',
            citizenId,
            hands: msg.hands,
          }, ws);
          break;
        }

        case 'biography_voice': {
          if (msg.audio && msg.donorId) {
            const audioBuffer = Buffer.from(msg.audio, 'base64');
            console.log(`📜 Biography voice from ${citizenId} for ${msg.donorId} (${audioBuffer.length} bytes)`);
            const send = (obj) => roomManager.broadcastFromCitizen(citizenId, obj);
            processBiographyVoice(audioBuffer, msg.donorId, citizenId, send).catch((e) => {
              console.error('Biography voice error:', e.message);
            });
          }
          break;
        }

        case 'teleport': {
          if (!citizenId || !msg.targetZone) break;
          const citizen = citizens.get(citizenId);
          const targetZone = ZONES.find(z => z.id === msg.targetZone);
          if (citizen && targetZone) {
            citizen.position = { x: targetZone.position.x, y: 1.7, z: targetZone.position.z };
            citizen.zone = targetZone.id;
            roomManager.broadcastFromCitizen(citizenId, {
              type: 'citizen_moved',
              citizenId,
              position: citizen.position,
              rotation: citizen.rotation,
            });
          }
          break;
        }

        case 'voice': {
          if (msg.audio) {
            const audioBuffer = Buffer.from(msg.audio, 'base64');
            console.log(`🎤 Voice from ${citizenId} (${audioBuffer.length} bytes)`);

            const citizen = citizens.get(citizenId);
            // Broadcast raw voice to room (stream hears Nicolas speak)
            roomManager.broadcastFromCitizen(citizenId, {
              type: 'citizen_voice',
              citizenId,
              name: citizen?.name || 'Unknown',
              audio: msg.audio,
            }, ws);

            // Stream TTS to room
            const send = (obj) => roomManager.broadcastFromCitizen(citizenId, obj);

            processVoiceStreaming(audioBuffer, send).then(async (result) => {
              if (!result?.transcription || !citizen) return;

              const aiResult = await aiManager.checkProximityAndRespond(
                result.transcription,
                citizen.position,
                citizen.name || 'Someone',
              );
              if (aiResult) {
                speakAsAICitizen(
                  aiResult.citizenId,
                  aiResult.citizenName,
                  aiResult.text,
                  aiResult.position,
                  send,
                ).catch(e => console.error('AI citizen speak error:', e.message));
              }
            }).catch((e) => {
              console.error('Voice pipeline error:', e.message);
            });
          }
          break;
        }
      }
    } catch (e) {
      console.error('Message parse error:', e.message);
    }
  });

  ws.on('close', () => {
    if (citizenId) {
      // Notify room before removing
      const room = roomManager.getRoomForCitizen(citizenId);
      if (room) {
        roomManager.broadcastToRoom(room, { type: 'citizen_left', citizenId }, ws);
      }
      roomManager.leaveRoom(citizenId);
      citizens.delete(citizenId);
      connections.delete(ws);
      console.log(`Citizen left: ${citizenId}`);
    }
  });
});

function broadcast(msg, exclude = null) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client !== exclude && client.readyState === 1) {
      client.send(data);
    }
  }
}

// ─── AI Citizens ────────────────────────────────────────

// AI citizens broadcast globally (shared presence across all rooms)
const openai = new OpenAI();
const aiManager = new AICitizenManager(broadcast, openai);

// Speak endpoint uses global broadcast (available to all rooms)
// The /speak route's send function already uses broadcast — that's correct.

// ─── Living Places + Physics Engine ─────────────────────
const graphName = process.env.FALKORDB_GRAPH || 'venezia';
try {
  const graphClient = await GraphClient.connect({
    host: process.env.FALKORDB_HOST || 'localhost',
    port: parseInt(process.env.FALKORDB_PORT || '6379'),
    graph: graphName,
  });

  _graphClientRef = graphClient;

  // Living Places
  placeServer = new PlaceServer(graphClient);
  const momentPipeline = new MomentPipeline(graphClient, placeServer, processVoiceStreaming);
  placeServer.setMomentPipeline(momentPipeline);
  placeServer.startReconciliation();
  console.log('Living Places: active on /places/ws');

  // Physics Bridge — narrative tick engine
  const tickInterval = parseInt(process.env.PHYSICS_TICK_INTERVAL || '300000');
  physicsBridge = new PhysicsBridge({
    graphClient,
    wsServer: wss,
    tickInterval,
  });

  // Log physics events + push to SSE streams
  physicsBridge.on('narrative.moment_flip', (payload) => {
    console.log(`[Physics] Moment flip: ${payload.count} moment(s) completed at tick #${payload.tick}`);
    // Fan out to all active SSE streams
    for (const [, stream] of sseStreams.streams) {
      stream.push({ type: 'moment', ...payload });
    }
  });
  physicsBridge.on('narrative.event', (payload) => {
    console.log(`[Physics] Narrative event: ${payload.type} — ${payload.description}`);
    for (const [, stream] of sseStreams.streams) {
      stream.push({ type: payload.type || 'narration', ...payload });
    }
  });
  physicsBridge.on('error', (err) => {
    console.error(`[Physics] Error: ${err.message}`);
  });

  // Start the tick loop (first tick runs immediately)
  await physicsBridge.start();
  console.log(`Physics engine: active (graph=${graphName}, interval=${tickInterval}ms)`);
} catch (e) {
  console.warn(`Graph services: disabled (${e.message})`);
}

// ─── Graceful shutdown ──────────────────────────────────
function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  if (physicsBridge) physicsBridge.stop();
  server.close();
  if (httpsServer) httpsServer.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log('Waiting for citizens...');
console.log('Room system active (default: LOBBY0)');
