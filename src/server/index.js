/**
 * Cities of Light — Spatial State Server
 *
 * Tracks citizen positions, zone states, and bridges
 * between the WebXR world and Manemus infrastructure.
 */

import { WebSocketServer } from 'ws';
import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { perceptionRoutes } from './perception.js';
import { processVoice } from './voice.js';

const PORT = 8800;
const WS_PORT = 8801;

// ─── State ──────────────────────────────────────────────

const citizens = new Map(); // id → { position, rotation, name, persona, lastUpdate }
const connections = new Map(); // ws → citizenId

// ─── Express (HTTP API) ─────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' })); // Large for frame uploads

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

app.listen(PORT, () => {
  console.log(`Cities of Light API: http://localhost:${PORT}`);
});

// ─── WebSocket (real-time sync) ─────────────────────────

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  let citizenId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case 'join': {
          citizenId = msg.citizenId || `citizen_${Date.now()}`;
          citizens.set(citizenId, {
            name: msg.name || 'Unknown',
            persona: msg.persona || null,
            position: { x: 0, y: 1.7, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            lastUpdate: Date.now(),
          });
          connections.set(ws, citizenId);
          console.log(`Citizen joined: ${msg.name} (${citizenId})`);

          // Broadcast join to all
          broadcast({
            type: 'citizen_joined',
            citizenId,
            name: msg.name,
            persona: msg.persona,
          });
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

        case 'voice': {
          // Voice message → STT → Claude → TTS pipeline
          if (msg.audio) {
            const audioBuffer = Buffer.from(msg.audio, 'base64');
            console.log(`🎤 Voice from ${citizenId} (${audioBuffer.length} bytes)`);

            processVoice(audioBuffer).then((result) => {
              if (!result) return;

              // Send response back to the speaking citizen
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({
                  type: 'voice_response',
                  transcription: result.transcription,
                  response: result.response,
                  audio: result.audio,
                  format: result.format,
                  latency: result.latency,
                }));
              }

              console.log(`🔊 Response sent (${result.latency}ms round-trip)`);
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

console.log(`Cities of Light WebSocket: ws://localhost:${WS_PORT}`);
console.log('Waiting for citizens...');
