/**
 * Place Server — Living Places real-time meeting room management.
 * Handles WebSocket connections for the `/places/ws` upgrade path.
 * Each place is a Space node in FalkorDB with in-memory participant tracking.
 */

import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

export class PlaceServer {
  constructor(graphClient) {
    this.graphClient = graphClient;
    this.momentPipeline = null;
    this.rooms = new Map();        // space_id → RoomState
    this.connections = new Map();   // ws → { actor_id, space_id, name, renderer }
    this.wss = new WebSocketServer({ noServer: true });
    this._reconcileInterval = null;

    this.wss.on('connection', (ws) => this._handleConnection(ws));
  }

  setMomentPipeline(pipeline) { this.momentPipeline = pipeline; }

  handleUpgrade(request, socket, head) {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request);
    });
  }

  _handleConnection(ws) {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        this._handleMessage(ws, msg);
      } catch (e) {
        this._sendError(ws, `Parse error: ${e.message}`);
      }
    });

    ws.on('close', () => this._handleDisconnect(ws));
  }

  async _handleMessage(ws, msg) {
    switch (msg.type) {
      case 'place:join':
        await this._handleJoin(ws, msg);
        break;
      case 'place:leave':
        await this._handleLeave(ws, msg);
        break;
      case 'place:moment':
        if (this.momentPipeline) {
          const conn = this.connections.get(ws);
          if (!conn) { this._sendError(ws, 'Not joined'); return; }
          await this.momentPipeline.handleInput(conn.actor_id, conn.space_id, msg.content, msg.kind || 'text', 'text');
        }
        break;
      case 'place:voice':
        if (this.momentPipeline) {
          const conn = this.connections.get(ws);
          if (!conn) { this._sendError(ws, 'Not joined'); return; }
          await this.momentPipeline.handleVoiceInput(conn.actor_id, conn.space_id, msg.audio);
        }
        break;
      case 'place:discover':
        await this._handleDiscover(ws);
        break;
      case 'place:create':
        await this._handleCreate(ws, msg);
        break;
      default:
        this._sendError(ws, `Unknown message type: ${msg.type}`);
    }
  }

  // JOIN: validate, create AT link, send state+history, broadcast presence
  async _handleJoin(ws, msg) {
    const { place_id, name, renderer = 'web' } = msg;
    if (!place_id) { this._sendError(ws, 'place_id required'); return; }

    // Leave current room if any
    const existing = this.connections.get(ws);
    if (existing) {
      await this._leaveRoom(existing.actor_id, existing.space_id, ws);
    }

    // Generate actor_id for web clients (MCP tools provide their own via graph)
    const actor_id = msg.actor_id || `human_${randomUUID().slice(0, 8)}`;

    // Get or load room state
    let room = this.rooms.get(place_id);
    if (!room) {
      // Try loading from graph
      const space = await this.graphClient.getSpace(place_id);
      if (!space) { this._sendError(ws, `Place not found: ${place_id}`); return; }
      room = this._initRoom(space);
    }

    // Check capacity
    if (room.capacity && room.participants.size >= room.capacity) {
      this._sendError(ws, 'Place is full');
      return;
    }

    // Track connection and participant
    this.connections.set(ws, { actor_id, space_id: place_id, name, renderer });
    room.participants.set(actor_id, { ws, name, renderer, joined_at: new Date().toISOString() });

    // Create AT link in graph (async, don't block)
    this.graphClient.createLink(actor_id, place_id, 'AT', {
      renderer, joined_at: new Date().toISOString(),
    }).catch(e => console.error(`Graph AT link error: ${e.message}`));

    // Send place state to the joining client
    ws.send(JSON.stringify({
      type: 'place:state',
      place: {
        id: room.space_id,
        name: room.name,
        capacity: room.capacity,
        participants: this._serializeParticipants(room),
      },
    }));

    // Send moment history
    ws.send(JSON.stringify({
      type: 'place:history',
      moments: room.momentBuffer.slice(-50),
    }));

    // Broadcast join to others
    this.broadcastToRoom(place_id, {
      type: 'place:presence',
      actor_id,
      name,
      renderer,
      action: 'joined',
      participants: this._serializeParticipants(room),
    }, ws);

    console.log(`Place: ${name} (${actor_id}) joined ${room.name} [${room.participants.size}/${room.capacity || '∞'}]`);
  }

  async _handleLeave(ws, msg) {
    const conn = this.connections.get(ws);
    if (!conn) return;
    await this._leaveRoom(conn.actor_id, conn.space_id, ws);
  }

  async _leaveRoom(actorId, spaceId, ws) {
    const room = this.rooms.get(spaceId);
    if (room) {
      room.participants.delete(actorId);

      // Broadcast leave
      this.broadcastToRoom(spaceId, {
        type: 'place:presence',
        actor_id: actorId,
        action: 'left',
        participants: this._serializeParticipants(room),
      });

      // Auto-archive empty non-system rooms after 60s
      if (room.participants.size === 0) {
        setTimeout(() => {
          const r = this.rooms.get(spaceId);
          if (r && r.participants.size === 0) {
            this.rooms.delete(spaceId);
            console.log(`Place archived (empty): ${spaceId}`);
          }
        }, 60000);
      }
    }

    // Remove AT link in graph (async)
    this.graphClient.removeLink(actorId, spaceId, 'AT')
      .catch(e => console.error(`Graph AT remove error: ${e.message}`));

    this.connections.delete(ws);
  }

  async _handleCreate(ws, msg) {
    const { name, capacity, access_level = 'public' } = msg;
    if (!name) { this._sendError(ws, 'name required'); return; }

    const place_id = `place_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    // Create in graph
    await this.graphClient.createSpace(place_id, name, capacity || 20, access_level, 'active');

    // Init in-memory
    this._initRoom({ id: place_id, name, capacity: capacity || 20, access_level, status: 'active' });

    ws.send(JSON.stringify({
      type: 'place:created',
      place: { id: place_id, name, capacity: capacity || 20, access_level },
    }));

    console.log(`Place created: ${name} (${place_id})`);
  }

  async _handleDiscover(ws) {
    // In-memory rooms first, supplement with graph
    const places = [];
    for (const [id, room] of this.rooms) {
      places.push({
        id, name: room.name, capacity: room.capacity,
        access_level: room.access_level,
        participants: room.participants.size,
      });
    }
    // Also check graph for places not loaded in memory
    try {
      const graphPlaces = await this.graphClient.listActivePlaces();
      for (const gp of graphPlaces) {
        if (!this.rooms.has(gp.id)) {
          places.push(gp);
        }
      }
    } catch (e) {
      console.error(`Graph discover error: ${e.message}`);
    }
    ws.send(JSON.stringify({ type: 'place:places', places }));
  }

  _handleDisconnect(ws) {
    const conn = this.connections.get(ws);
    if (conn) {
      this._leaveRoom(conn.actor_id, conn.space_id, ws);
      console.log(`Place: ${conn.name} (${conn.actor_id}) disconnected`);
    }
  }

  // ─── Broadcast ─────────────────────────────────────────

  broadcastToRoom(spaceId, msg, excludeWs = null) {
    const room = this.rooms.get(spaceId);
    if (!room) return;
    const data = JSON.stringify(msg);
    for (const [, participant] of room.participants) {
      if (participant.ws !== excludeWs && participant.ws.readyState === 1) {
        participant.ws.send(data);
      }
    }
  }

  // ─── HTTP Notify (from MCP tools) ─────────────────────

  /** Handle POST /api/places/:id/notify — called by MCP tools after graph write */
  async handleNotifyHTTP(req, res) {
    const placeId = req.params.id;
    const { event, moment_id, actor_id, content, name, action } = req.body || {};

    if (event === 'moment_created') {
      // MCP tool created a moment in graph — broadcast to web clients
      const room = this.rooms.get(placeId);
      if (room) {
        const moment = {
          id: moment_id,
          author: actor_id,
          content,
          kind: 'text',
          source: 'mcp',
          timestamp: new Date().toISOString(),
          energy: 1.0,
        };
        room.momentBuffer.push(moment);
        if (room.momentBuffer.length > 100) room.momentBuffer.splice(0, room.momentBuffer.length - 100);
        this.broadcastToRoom(placeId, { type: 'place:moment', moment });
      }
      res.json({ ok: true });
    } else if (event === 'presence_changed') {
      // MCP tool joined/left — update in-memory and broadcast
      const room = this.rooms.get(placeId);
      if (room) {
        if (action === 'joined') {
          room.participants.set(actor_id, { ws: null, name: name || actor_id, renderer: 'mcp', joined_at: new Date().toISOString() });
        } else if (action === 'left') {
          room.participants.delete(actor_id);
        }
        this.broadcastToRoom(placeId, {
          type: 'place:presence',
          actor_id, name, action,
          participants: this._serializeParticipants(room),
        });
      }
      res.json({ ok: true });
    } else {
      res.status(400).json({ error: `Unknown event: ${event}` });
    }
  }

  // ─── Presence Reconciliation ───────────────────────────

  startReconciliation() {
    this._reconcileInterval = setInterval(() => this._reconcile(), 30000);
  }

  async _reconcile() {
    for (const [spaceId, room] of this.rooms) {
      // Prune dead WebSocket connections
      for (const [actorId, p] of room.participants) {
        if (p.ws && p.ws.readyState !== 1) {
          room.participants.delete(actorId);
          this.graphClient.removeLink(actorId, spaceId, 'AT').catch(() => {});
          console.log(`Place reconcile: pruned dead connection ${actorId} from ${spaceId}`);
        }
      }
    }
  }

  stopReconciliation() {
    if (this._reconcileInterval) clearInterval(this._reconcileInterval);
  }

  // ─── Helpers ───────────────────────────────────────────

  _initRoom(space) {
    const room = {
      space_id: space.id,
      name: space.name,
      capacity: space.capacity,
      access_level: space.access_level || 'public',
      participants: new Map(),
      momentBuffer: [],
      status: space.status || 'active',
    };
    this.rooms.set(space.id, room);
    return room;
  }

  _serializeParticipants(room) {
    const list = [];
    for (const [id, p] of room.participants) {
      list.push({ actor_id: id, name: p.name, renderer: p.renderer });
    }
    return list;
  }

  _sendError(ws, message) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'place:error', message }));
    }
  }
}
