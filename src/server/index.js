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
import { processVoice, processVoiceStreaming, speakToWorld } from './voice.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8800;

// ─── State ──────────────────────────────────────────────

const citizens = new Map(); // id → { position, rotation, name, persona, lastUpdate }
const connections = new Map(); // ws → citizenId

// ─── Express (HTTP API) ─────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' })); // Large for frame uploads

// Allow WebXR, microphone, camera through tunnels/iframes
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'xr-spatial-tracking=(*), microphone=(*), camera=(*)');
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
            lastUpdate: Date.now(),
          });
          connections.set(ws, citizenId);
          console.log(`${isSpectator ? 'Spectator' : 'Citizen'} joined: ${msg.name} (${citizenId})`);

          // Send existing non-spectator citizens to the new client
          for (const [id, c] of citizens) {
            if (id === citizenId) continue;
            if (c.spectator) continue; // Don't show spectators as avatars
            ws.send(JSON.stringify({
              type: 'citizen_joined',
              citizenId: id,
              name: c.name,
              persona: c.persona,
            }));
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

            processVoiceStreaming(audioBuffer, send).catch((e) => {
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

console.log('Waiting for citizens...');
