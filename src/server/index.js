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
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8800;

// ─── State ──────────────────────────────────────────────

const citizens = new Map(); // id → { position, rotation, name, persona, zone, lastUpdate }
const connections = new Map(); // ws → citizenId

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
          console.log(`${isSpectator ? 'Spectator' : 'Citizen'} joined: ${msg.name} (${citizenId})`);

          // Send existing non-spectator citizens to the new client
          for (const [id, c] of citizens) {
            if (id === citizenId) continue;
            if (c.spectator) continue; // Don't show spectators as avatars
            const joinMsg = {
              type: 'citizen_joined',
              citizenId: id,
              name: c.name,
              persona: c.persona,
            };
            // Include AI citizen display data
            if (c.persona === 'ai') {
              joinMsg.aiShape = c.aiShape;
              joinMsg.aiColor = c.aiColor;
            }
            ws.send(JSON.stringify(joinMsg));
            // Also send their last known position
            ws.send(JSON.stringify({
              type: 'citizen_moved',
              citizenId: id,
              position: c.position,
              rotation: c.rotation,
            }));
          }

          // Send assigned citizenId back to the joining client
          ws.send(JSON.stringify({
            type: 'welcome',
            citizenId,
          }));

          // Send AI citizens to the new client
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

          // Broadcast join to all others (spectators don't create avatars)
          if (!isSpectator) {
            broadcast({
              type: 'citizen_joined',
              citizenId,
              name: msg.name,
              persona: msg.persona,
            }, ws);
          }
          break;
        }

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
              broadcast({
                type: 'citizen_zone_changed',
                citizenId,
                oldZone,
                newZone: zone.id,
              });
            }

            // Broadcast position to all others
            broadcast({
              type: 'citizen_moved',
              citizenId,
              position: msg.position,
              rotation: msg.rotation,
            }, ws);
          }
          break;
        }

        case 'manemus_camera': {
          // Broadcast Manemus streaming camera position to all clients (for stream mode)
          broadcast({
            type: 'manemus_camera',
            position: msg.position,
            rotation: msg.rotation,
          }, ws); // Exclude sender
          break;
        }

        case 'hands': {
          // Relay hand/controller joint data to all other clients
          if (!citizenId) break;
          broadcast({
            type: 'citizen_hands',
            citizenId,
            hands: msg.hands,
          }, ws);
          break;
        }

        case 'biography_voice': {
          // Biography voice query — STT → consent check → archive match → TTS
          if (msg.audio && msg.donorId) {
            const audioBuffer = Buffer.from(msg.audio, 'base64');
            console.log(`📜 Biography voice from ${citizenId} for ${msg.donorId} (${audioBuffer.length} bytes)`);
            const send = (obj) => broadcast(obj);
            processBiographyVoice(audioBuffer, msg.donorId, citizenId, send).catch((e) => {
              console.error('Biography voice error:', e.message);
            });
          }
          break;
        }

        case 'teleport': {
          // Fast-travel to target zone
          if (!citizenId || !msg.targetZone) break;
          const citizen = citizens.get(citizenId);
          const targetZone = ZONES.find(z => z.id === msg.targetZone);
          if (citizen && targetZone) {
            citizen.position = { x: targetZone.position.x, y: 1.7, z: targetZone.position.z };
            citizen.zone = targetZone.id;
            broadcast({
              type: 'citizen_moved',
              citizenId,
              position: citizen.position,
              rotation: citizen.rotation,
            });
          }
          break;
        }

        case 'voice': {
          // Voice message → STT → Claude → streaming TTS
          if (msg.audio) {
            const audioBuffer = Buffer.from(msg.audio, 'base64');
            console.log(`🎤 Voice from ${citizenId} (${audioBuffer.length} bytes)`);

            // Broadcast raw voice to all OTHER clients (stream hears Nicolas speak)
            const citizen = citizens.get(citizenId);
            broadcast({
              type: 'citizen_voice',
              citizenId,
              name: citizen?.name || 'Unknown',
              audio: msg.audio, // base64 webm/opus
            }, ws); // exclude sender

            // Stream TTS chunks to ALL clients (VR + stream viewers)
            const send = (obj) => broadcast(obj);

            // Main voice pipeline (Manemus responds)
            processVoiceStreaming(audioBuffer, send).then(async (result) => {
              if (!result?.transcription || !citizen) return;

              // Check AI citizen proximity — they may also respond
              const aiResult = await aiManager.checkProximityAndRespond(
                result.transcription,
                citizen.position,
                citizen.name || 'Someone',
              );
              if (aiResult) {
                // TTS the AI citizen's response and broadcast with position
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
      citizens.delete(citizenId);
      connections.delete(ws);
      console.log(`Citizen left: ${citizenId}`);
      broadcast({ type: 'citizen_left', citizenId });
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

const openai = new OpenAI();
const aiManager = new AICitizenManager(broadcast, openai);

console.log('Waiting for citizens...');
