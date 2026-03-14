/**
 * Cities of Light — Spatial State Server
 *
 * Tracks citizen positions, zone states, and bridges
 * between the WebXR world and Manemus infrastructure.
 */

import { WebSocketServer } from 'ws';
import express from 'express';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
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

// Manemus perception endpoint — returns frame for AI processing
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
  } catch {}

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

        case 'manemus_camera': {
          roomManager.broadcastFromCitizen(citizenId, {
            type: 'manemus_camera',
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

  // Log physics events
  physicsBridge.on('narrative.moment_flip', (payload) => {
    console.log(`[Physics] Moment flip: ${payload.count} moment(s) completed at tick #${payload.tick}`);
  });
  physicsBridge.on('narrative.event', (payload) => {
    console.log(`[Physics] Narrative event: ${payload.type} — ${payload.description}`);
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
