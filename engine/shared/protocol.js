/**
 * Cities of Light — Engine Protocol
 *
 * WebSocket message types shared between server and clients.
 * This is the communication contract for the engine.
 */

export const PROTOCOL_VERSION = '0.1.0';

// Server → Client
export const SERVER_MESSAGES = {
  WORLD_LOADED: 'world_loaded',
  ENTITY_SPAWNED: 'entity_spawned',
  ENTITY_DESPAWNED: 'entity_despawned',
  ENTITY_MOVED: 'entity_moved',
  ENTITY_SPEAK: 'entity_speak',
  ENTITY_EMOTE: 'entity_emote',
  ENTITY_TIER_CHANGED: 'entity_tier_changed',
  WORLD_EVENT: 'world_event',
  ZONE_ATMOSPHERE_UPDATE: 'zone_atmosphere_update',
  STATE_SNAPSHOT: 'state_snapshot',
};

// Client → Server
export const CLIENT_MESSAGES = {
  JOIN: 'join',
  LEAVE: 'leave',
  MOVE: 'move',
  VOICE_START: 'voice_start',
  VOICE_DATA: 'voice_data',
  VOICE_END: 'voice_end',
  REQUEST_SNAPSHOT: 'request_snapshot',
};

// Manemus → Engine (AI actions)
export const AI_MESSAGES = {
  AI_MOVE: 'ai_move',
  AI_SPEAK: 'ai_speak',
  AI_EMOTE: 'ai_emote',
  AI_SPAWN: 'ai_spawn',
  AI_DESPAWN: 'ai_despawn',
  AI_WALK_TO: 'ai_walk_to',           // { entity_id, building_id }
  AI_REQUEST_VIEW: 'ai_request_view', // { entity_id, view_type: 'aerial' }
  REQUEST_PERCEPTION: 'request_perception',
};

// Engine → Manemus (perception)
export const PERCEPTION_MESSAGES = {
  FRAME_CAPTURE: 'frame_capture',
  EVENT_STREAM: 'event_stream',
  PROXIMITY_UPDATE: 'proximity_update',
  AERIAL_VIEW: 'aerial_view', // { entity_id, image_base64, buildings_visible[] }
};
