/**
 * Room Manager — WebSocket-backed room system for Cities of Light.
 *
 * Web equivalent of Photon Fusion Shared Mode:
 * - Room create / join / leave
 * - Room-scoped broadcast (only citizens in same room hear each other)
 * - WebRTC signaling relay for peer-to-peer spatial voice
 * - AI citizens shared across all rooms (server-authoritative)
 */

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 confusion
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();       // code → Room
    this.citizenRoom = new Map(); // citizenId → code
  }

  createRoom(name, options = {}) {
    const code = generateCode();
    const room = {
      code,
      name: name || `Room ${code}`,
      citizens: new Map(), // citizenId → { ws, name, persona, spectator }
      maxPlayers: options.maxPlayers || 8,
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    console.log(`Room created: ${room.name} (${code})`);
    return room;
  }

  /** Ensure the default lobby exists and return it. */
  getOrCreateLobby() {
    // Lobby uses fixed code 'LOBBY0'
    if (!this.rooms.has('LOBBY0')) {
      const lobby = {
        code: 'LOBBY0',
        name: 'Lobby',
        citizens: new Map(),
        maxPlayers: 32, // lobby can hold more
        createdAt: Date.now(),
      };
      this.rooms.set('LOBBY0', lobby);
    }
    return this.rooms.get('LOBBY0');
  }

  joinRoom(code, citizenId, ws, citizenData) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'room_not_found' };
    if (room.citizens.size >= room.maxPlayers) return { error: 'room_full' };

    // Leave current room first
    this.leaveRoom(citizenId);

    room.citizens.set(citizenId, { ws, ...citizenData });
    this.citizenRoom.set(citizenId, code);
    return { ok: true, room };
  }

  leaveRoom(citizenId) {
    const code = this.citizenRoom.get(citizenId);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (room) {
      room.citizens.delete(citizenId);
      // Auto-destroy non-lobby rooms after 30s if empty
      if (room.citizens.size === 0 && code !== 'LOBBY0') {
        setTimeout(() => {
          const r = this.rooms.get(code);
          if (r && r.citizens.size === 0) {
            this.rooms.delete(code);
            console.log(`Room destroyed (empty): ${code}`);
          }
        }, 30000);
      }
    }
    this.citizenRoom.delete(citizenId);
    return { code, room };
  }

  getRoomForCitizen(citizenId) {
    const code = this.citizenRoom.get(citizenId);
    return code ? this.rooms.get(code) : null;
  }

  /** Broadcast to all citizens in the same room. */
  broadcastToRoom(room, msg, excludeWs = null) {
    const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
    for (const [, citizen] of room.citizens) {
      if (citizen.ws !== excludeWs && citizen.ws.readyState === 1) {
        citizen.ws.send(data);
      }
    }
  }

  /** Broadcast to a specific citizen's room. */
  broadcastFromCitizen(citizenId, msg, excludeWs = null) {
    const room = this.getRoomForCitizen(citizenId);
    if (room) this.broadcastToRoom(room, msg, excludeWs);
  }

  /** Send to a specific citizen by ID. */
  sendToCitizen(citizenId, msg) {
    const code = this.citizenRoom.get(citizenId);
    if (!code) return false;
    const room = this.rooms.get(code);
    if (!room) return false;
    const citizen = room.citizens.get(citizenId);
    if (citizen && citizen.ws.readyState === 1) {
      citizen.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
      return true;
    }
    return false;
  }

  /** List all rooms with citizen counts. */
  listRooms() {
    const list = [];
    for (const [code, room] of this.rooms) {
      list.push({
        code,
        name: room.name,
        citizens: room.citizens.size,
        maxPlayers: room.maxPlayers,
      });
    }
    return list;
  }

  /** Get peer list for a citizen (other citizens in same room, for WebRTC). */
  getPeers(citizenId) {
    const room = this.getRoomForCitizen(citizenId);
    if (!room) return [];
    const peers = [];
    for (const [id, c] of room.citizens) {
      if (id !== citizenId && !c.spectator) {
        peers.push({ citizenId: id, name: c.name });
      }
    }
    return peers;
  }
}
