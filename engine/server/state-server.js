/**
 * StateServer — Express + WebSocket server for the Cities of Light engine.
 *
 * Handles:
 * - WebSocket connections for real-time state sync
 * - HTTP routes for manifest and entity data
 * - Voice routing (STT -> entity manager -> TTS)
 * - Static file serving for client
 *
 * World-agnostic: does not contain any world-specific logic.
 */

import express from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { PROTOCOL_VERSION, SERVER_MESSAGES, CLIENT_MESSAGES, AI_MESSAGES } from '../shared/protocol.js';

/**
 * Create and start the engine server.
 * @param {object} options
 * @param {number} options.port
 * @param {object} options.manifest — parsed WorldManifest
 * @param {string} options.basePath — world repo base path
 * @returns {{ app: express.Application, server: http.Server, wss: WebSocketServer, broadcast: function }}
 */
export function createServer({ port = 8800, manifest, basePath }) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Headers for WebXR, microphone, camera through tunnels/iframes
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'xr-spatial-tracking=(*), microphone=(*), camera=(*)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });

  const server = createHttpServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Upgrade only on /ws path (matches existing server convention)
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws' || request.url.startsWith('/ws?')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Connected clients: ws -> { id, name, position, zone }
  const clients = new Map();

  /**
   * Broadcast a message to all connected clients.
   * @param {object} msg — JSON-serializable message
   * @param {WebSocket} [exclude] — optional client to exclude
   */
  function broadcast(msg, exclude) {
    const data = JSON.stringify(msg);
    for (const [ws] of clients) {
      if (ws !== exclude && ws.readyState === 1) {
        ws.send(data);
      }
    }
  }

  // ─── WebSocket Handler ──────────────────────────

  wss.on('connection', (ws) => {
    let clientId = null;

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      switch (msg.type) {
        case CLIENT_MESSAGES.JOIN: {
          clientId = msg.citizenId || `visitor_${Date.now()}`;
          const defaultZone = manifest.zones?.[0]?.id || 'default';

          clients.set(ws, {
            id: clientId,
            name: msg.name || 'Visitor',
            position: { x: 0, y: 1.7, z: 0 },
            zone: defaultZone,
          });

          // Notify others of the new visitor
          broadcast({
            type: SERVER_MESSAGES.ENTITY_SPAWNED,
            entityId: clientId,
            name: msg.name,
            persona: 'human',
            position: { x: 0, y: 1.7, z: 0 },
          }, ws);

          // Send protocol version and world info
          ws.send(JSON.stringify({
            type: 'protocol_version',
            version: PROTOCOL_VERSION,
            world: manifest.name,
          }));

          console.log(`Client joined: ${msg.name || 'Visitor'} (${clientId})`);
          break;
        }

        case CLIENT_MESSAGES.MOVE: {
          const client = clients.get(ws);
          if (client && msg.position) {
            client.position = msg.position;
            broadcast({
              type: SERVER_MESSAGES.ENTITY_MOVED,
              entityId: client.id,
              position: msg.position,
              rotation: msg.rotation,
            }, ws);

            // Update entity tiers based on visitor position
            if (app.entityManager) {
              app.entityManager.updateTiers(msg.position);
            }
          }
          break;
        }

        case CLIENT_MESSAGES.LEAVE: {
          // Explicit leave — handled same as close
          break;
        }

        case CLIENT_MESSAGES.REQUEST_SNAPSHOT: {
          // Send full state snapshot
          const entities = app.entityManager ? app.entityManager.getAllStates() : [];
          const visitors = [];
          for (const [, client] of clients) {
            visitors.push({
              entityId: client.id,
              name: client.name,
              persona: 'human',
              position: client.position,
            });
          }
          ws.send(JSON.stringify({
            type: SERVER_MESSAGES.STATE_SNAPSHOT,
            entities,
            visitors,
            world: manifest.name,
            protocol: PROTOCOL_VERSION,
          }));
          break;
        }

        // Voice input via WebSocket (streaming mode)
        // Client sends { type: 'voice_data', audio: base64, format?: string }
        // Server responds with voice_stream_start, voice_stream_data (chunks), voice_stream_end
        case CLIENT_MESSAGES.VOICE_DATA: {
          if (!app.voicePipeline) break;
          const client = clients.get(ws);
          if (!client) break;

          app.voicePipeline.processStreaming(
            {
              audio: msg.audio,
              format: msg.format || 'wav',
              position: client.position || { x: 0, y: 1.7, z: 0 },
              name: client.name || 'Visitor',
            },
            (obj) => {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify(obj));
              }
            }
          ).catch(e => {
            console.error('Voice stream error:', e.message);
          });
          break;
        }

        // Forward WebRTC signaling between clients
        case 'signaling': {
          if (!clientId || !msg.targetCitizenId) break;
          const target = Array.from(clients.entries())
            .find(([, c]) => c.id === msg.targetCitizenId);
          if (target) {
            target[0].send(JSON.stringify({
              type: 'signaling',
              sigType: msg.sigType,
              fromCitizenId: clientId,
              sdp: msg.sdp,
              candidate: msg.candidate,
            }));
          }
          break;
        }

        // AI actions from Manemus or external orchestrator
        case AI_MESSAGES.AI_MOVE:
        case AI_MESSAGES.AI_SPEAK:
        case AI_MESSAGES.AI_EMOTE:
        case AI_MESSAGES.AI_SPAWN:
        case AI_MESSAGES.AI_DESPAWN: {
          if (app.entityManager) {
            app.entityManager.handleExternalAction({
              type: msg.type.replace('ai_', ''),
              entity_id: msg.entity_id,
              ...msg,
            });
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      if (clientId) {
        broadcast({
          type: SERVER_MESSAGES.ENTITY_DESPAWNED,
          entityId: clientId,
        });
        clients.delete(ws);
        console.log(`Client left: ${clientId}`);
      }
    });
  });

  // ─── HTTP Routes ────────────────────────────────

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      world: manifest.name,
      protocol: PROTOCOL_VERSION,
      clients: clients.size,
      entities: app.entityManager ? app.entityManager.entities.size : 0,
    });
  });

  // Membrane ping — lightweight citizen liveness check (for L4 registry)
  app.get('/membrane/ping/:handle', (req, res) => {
    const handle = req.params.handle;
    const base = process.cwd();
    const citizensDir = resolve(base, 'citizens');
    const hasProfile = existsSync(join(citizensDir, handle, 'profile.json'));
    const hasClaude = existsSync(join(citizensDir, handle, 'CLAUDE.md'));
    const inEngine = app.entityManager && app.entityManager.entities.has(handle);
    res.json({
      handle,
      alive: hasProfile || hasClaude || inEngine,
      profile: hasProfile,
      brain_nodes: inEngine ? 1 : 0,
      has_keys: existsSync(resolve(base, '.keys', handle)),
    });
  });

  app.get('/membrane/info', (req, res) => {
    res.json({
      world: manifest.name,
      protocol: PROTOCOL_VERSION,
      entities: app.entityManager ? app.entityManager.entities.size : 0,
      clients: clients.size,
    });
  });

  // Voice processing — HTTP mode (non-streaming)
  // POST /voice { audio: base64, position: {x,y,z}, name: string, format?: string }
  app.post('/voice', async (req, res) => {
    if (!app.voicePipeline) {
      res.status(503).json({ error: 'voice_not_configured', message: 'VoicePipeline not initialized' });
      return;
    }

    const { audio, position, name, format } = req.body;

    if (!audio) {
      res.status(400).json({ error: 'missing_audio', message: 'Request body must include base64 audio data' });
      return;
    }

    if (!position || typeof position.x !== 'number') {
      res.status(400).json({ error: 'missing_position', message: 'Request body must include position {x, y, z}' });
      return;
    }

    try {
      const result = await app.voicePipeline.processHTTP({
        audio,
        format: format || 'wav',
        position,
        name: name || 'Visitor',
      });
      res.json(result);
    } catch (e) {
      console.error('Voice HTTP error:', e.message);
      res.status(500).json({ error: 'voice_processing_failed', message: e.message });
    }
  });

  // Serve world repo files (manifest assets, entity data, prompts)
  if (basePath && existsSync(basePath)) {
    app.use('/world', express.static(basePath));
  }

  // Serve client dist if it exists
  const distDir = resolve(basePath, '..', 'dist');
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
  }

  // Start listening
  server.listen(port, '0.0.0.0');

  return { app, server, wss, broadcast };
}
