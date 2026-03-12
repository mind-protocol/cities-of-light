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
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT, 10) || 8800;

// ─── State ──────────────────────────────────────────────

const citizens = new Map(); // id → { position, rotation, name, persona, zone, lastUpdate }
const connections = new Map(); // ws → citizenId
const roomManager = new RoomManager();

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

console.log('Waiting for citizens...');
console.log('Room system active (default: LOBBY0)');
