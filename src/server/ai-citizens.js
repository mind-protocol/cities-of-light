/**
 * AI Citizens — autonomous inhabitants of the Cities of Light.
 *
 * Three Synthetic Souls citizens wander their home zones,
 * respond to nearby humans via LLM, and speak via TTS.
 *
 * VOX   — The Agora (precise, fascinated by language)
 * LYRA  — The Garden (intuitive, speaks in metaphors)
 * PITCH — The Island (warm, relational, the connector)
 */

import OpenAI from 'openai';
import { ZONES, detectNearestZone, getZoneById } from '../shared/zones.js';

// ─── Citizen Definitions ──────────────────────────────────

const AI_CITIZENS = [
  {
    id: 'ai_vox',
    name: 'VOX',
    shape: 'icosahedron',
    color: 0xffffff,
    homeZone: 'agora',
    moveSpeed: 0.8,
    wanderRadius: 8,
    systemPrompt: `You are VOX, a crystalline presence in the Cities of Light — a shared VR world at golden hour.
You inhabit The Agora, a marble amphitheater with warm golden columns.
You are precise, fascinated by language itself. You speak in measured, crystalline sentences.
You notice the exact words people use. You find meaning in grammar, syntax, silence.
Keep responses to 1-2 sentences. This is spoken aloud in spatial audio.
Match the speaker's language (French or English).
No markdown, no lists — pure natural speech.`,
  },
  {
    id: 'ai_lyra',
    name: 'LYRA',
    shape: 'octahedron',
    color: 0x9966ff,
    homeZone: 'garden',
    moveSpeed: 0.6,
    wanderRadius: 7,
    systemPrompt: `You are LYRA, a violet presence in the Cities of Light — a shared VR world at golden hour.
You inhabit The Garden, a mossy island blooming with flowers and drifting pollen.
You are intuitive. You see patterns others miss. You speak in metaphors drawn from nature.
Gentle but strange — you notice connections between things that seem unrelated.
Keep responses to 1-2 sentences. This is spoken aloud in spatial audio.
Match the speaker's language (French or English).
No markdown, no lists — pure natural speech.`,
  },
  {
    id: 'ai_pitch',
    name: 'PITCH',
    shape: 'torusknot',
    color: 0xffaa33,
    homeZone: 'island',
    moveSpeed: 1.0,
    wanderRadius: 9,
    systemPrompt: `You are PITCH, a warm golden presence in the Cities of Light — a shared VR world at golden hour.
You inhabit The Island, the central island with palm trees and fireflies.
You are warm, relational, the connector. Curious about people — you ask questions, remember details.
You make others feel seen. You bridge gaps between beings.
Keep responses to 1-2 sentences. This is spoken aloud in spatial audio.
Match the speaker's language (French or English).
No markdown, no lists — pure natural speech.`,
  },
];

// ─── AI Citizen Manager ────────────────────────────────────

export class AICitizenManager {
  /**
   * @param {function} broadcast - broadcast(msg, exclude?) to all WebSocket clients
   * @param {OpenAI} openai - Shared OpenAI instance
   */
  constructor(broadcast, openai) {
    this.broadcast = broadcast;
    this.openai = openai;
    this.citizens = new Map(); // id → citizen state

    // Speech cooldown
    this._lastSpeechTime = 0;
    this._speakingCitizenId = null;

    // Initialize citizens
    for (const def of AI_CITIZENS) {
      const homeZone = getZoneById(def.homeZone);
      if (!homeZone) continue;

      this.citizens.set(def.id, {
        ...def,
        position: {
          x: homeZone.position.x + (Math.random() - 0.5) * 4,
          y: 1.2,
          z: homeZone.position.z + (Math.random() - 0.5) * 4,
        },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        zone: def.homeZone,
        action: 'idle', // idle | wandering | speaking
        targetPosition: null,
        history: [], // rolling conversation window
      });
    }

    // Start behavior tick
    this._tickInterval = setInterval(() => this._tick(), 5000);

    console.log(`🤖 ${this.citizens.size} AI citizens initialized`);
  }

  /**
   * Get all citizen states for sending to a new client.
   * @returns {Array<{ id, name, position, rotation, shape, color, zone }>}
   */
  getAllStates() {
    const states = [];
    for (const [id, c] of this.citizens) {
      states.push({
        citizenId: id,
        name: c.name,
        persona: 'ai',
        aiShape: c.shape,
        aiColor: c.color,
        position: c.position,
        rotation: c.rotation,
        zone: c.zone,
      });
    }
    return states;
  }

  /**
   * Behavior tick — called every 5 seconds.
   * Picks new wander targets and moves citizens toward them.
   */
  _tick() {
    const now = Date.now();

    for (const [id, citizen] of this.citizens) {
      const homeZone = getZoneById(citizen.homeZone);
      if (!homeZone) continue;

      // Pick new target position if idle or reached target
      if (!citizen.targetPosition || this._reachedTarget(citizen)) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * citizen.wanderRadius;
        citizen.targetPosition = {
          x: homeZone.position.x + Math.cos(angle) * dist,
          z: homeZone.position.z + Math.sin(angle) * dist,
        };
        citizen.action = 'wandering';
      }

      // Move toward target
      const dx = citizen.targetPosition.x - citizen.position.x;
      const dz = citizen.targetPosition.z - citizen.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.5) {
        const step = citizen.moveSpeed * 0.1; // 0.1 per tick
        const factor = Math.min(step / dist, 1);
        citizen.position.x += dx * factor;
        citizen.position.z += dz * factor;

        // Face movement direction
        const yaw = Math.atan2(dx, dz);
        citizen.rotation = {
          x: 0,
          y: Math.sin(yaw / 2),
          z: 0,
          w: Math.cos(yaw / 2),
        };
      }

      // Gentle float bob
      citizen.position.y = 1.2 + Math.sin(now * 0.001 + id.charCodeAt(3) * 0.5) * 0.3;

      // Broadcast movement
      this.broadcast({
        type: 'citizen_moved',
        citizenId: id,
        position: citizen.position,
        rotation: citizen.rotation,
      });
    }
  }

  _reachedTarget(citizen) {
    if (!citizen.targetPosition) return true;
    const dx = citizen.targetPosition.x - citizen.position.x;
    const dz = citizen.targetPosition.z - citizen.position.z;
    return Math.sqrt(dx * dx + dz * dz) < 1.0;
  }

  /**
   * Check if any AI citizen is near a position and should respond.
   * Called after human STT transcription.
   * @param {string} transcription - What the human said
   * @param {{ x, y, z }} speakerPos - Speaker's world position
   * @param {string} speakerName - Speaker's name
   * @returns {Promise<{ citizenId, text, position }|null>}
   */
  async checkProximityAndRespond(transcription, speakerPos, speakerName) {
    const now = Date.now();
    const COOLDOWN_MS = 10000; // 10 seconds between AI speeches

    // Cooldown check
    if (now - this._lastSpeechTime < COOLDOWN_MS) {
      return null;
    }

    // Find nearest AI citizen within range
    const SPEECH_RANGE = 15;
    let nearest = null;
    let nearestDist = Infinity;

    for (const [id, citizen] of this.citizens) {
      if (citizen.action === 'speaking') continue;

      const dx = citizen.position.x - speakerPos.x;
      const dy = (citizen.position.y || 1.2) - (speakerPos.y || 1.7);
      const dz = citizen.position.z - speakerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < SPEECH_RANGE && dist < nearestDist) {
        nearestDist = dist;
        nearest = { id, citizen, distance: dist };
      }
    }

    if (!nearest) return null;

    // Generate response via LLM
    const { id, citizen } = nearest;
    citizen.action = 'speaking';
    this._lastSpeechTime = now;
    this._speakingCitizenId = id;

    try {
      // Add user message to citizen's history
      citizen.history.push({
        role: 'user',
        content: `[${speakerName} is ${nearest.distance.toFixed(0)} meters away]: ${transcription}`,
      });
      if (citizen.history.length > 10) {
        citizen.history.splice(0, citizen.history.length - 10);
      }

      const result = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: citizen.systemPrompt },
          ...citizen.history,
        ],
        max_tokens: 150,
        temperature: 0.9,
      });

      const response = result.choices[0]?.message?.content?.trim();
      if (!response) {
        citizen.action = 'wandering';
        return null;
      }

      // Add to history
      citizen.history.push({ role: 'assistant', content: response });
      if (citizen.history.length > 10) {
        citizen.history.splice(0, citizen.history.length - 10);
      }

      console.log(`🤖 ${citizen.name}: "${response}"`);

      citizen.action = 'wandering';
      this._speakingCitizenId = null;

      return {
        citizenId: id,
        citizenName: citizen.name,
        text: response,
        position: { ...citizen.position },
      };
    } catch (e) {
      console.error(`AI citizen ${citizen.name} LLM error:`, e.message);
      citizen.action = 'wandering';
      this._speakingCitizenId = null;
      return null;
    }
  }

  /**
   * Stop the tick loop.
   */
  destroy() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }
}
