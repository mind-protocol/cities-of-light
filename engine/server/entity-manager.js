/**
 * EntityManager — Server-side entity lifecycle and state management.
 *
 * World-agnostic: operates on entity descriptors loaded from
 * a WorldManifest. Does NOT know about citizens, Venice, or
 * any specific world. Uses tier config from manifest.
 *
 * Responsibilities:
 * - Load entity descriptors from manifest entity source
 * - Manage spawn/despawn based on visitor proximity
 * - Assign tiers (FULL/ACTIVE/AMBIENT) based on distance + budget
 * - Handle wander behavior (entities move around their home zones)
 * - Route voice to nearest eligible entity
 * - Broadcast state changes via WebSocket
 */

import { mkdirSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';

export class EntityManager {
  /**
   * @param {object} manifest — the parsed WorldManifest
   * @param {function} broadcast — (msg, exclude?) => void, broadcasts to all WebSocket clients
   * @param {object} options
   * @param {object} options.llmClient — LLM client (e.g., OpenAI instance) for FULL-tier voice
   */
  constructor(manifest, broadcast, options = {}) {
    this.manifest = manifest;
    this.broadcast = broadcast;
    this.llmClient = options.llmClient || null;

    // Tier config from manifest (defaults: Quest 3 WebXR draw call budget)
    // See: docs/citizens/embodiment/BUDGET_DrawCalls_Quest3.md
    this.tierConfig = manifest.entities?.tier_config || {
      FULL: { max: 5, radius: 12, voice: true, llm: true },
      ACTIVE: { max: 20, radius: 40, voice: false, llm: false },
      AMBIENT: { max: 200, radius: 150, voice: false, llm: false },
    };

    // AI config from manifest
    this.aiConfig = manifest.ai_config || {};
    this.memoryBasePath = this.aiConfig.memory_path ? resolve(this.aiConfig.memory_path) : null;

    // Entity state map: id → entity state
    this.entities = new Map();

    // Zone lookup
    this.zones = new Map();
    for (const zone of manifest.zones || []) {
      this.zones.set(zone.id, zone);
    }

    // Behavior tick
    this._tickInterval = null;
    this._speechCooldown = new Map(); // entity_id → last_speech_timestamp

    // Constants
    this.WANDER_TICK_MS = 5000;
    this.SPEECH_COOLDOWN_MS = 10000;
    this.SPEECH_RANGE = 15;
  }

  /**
   * Load entities from descriptors (already parsed from manifest source).
   * @param {Array} descriptors — entity definitions from world repo
   */
  loadEntities(descriptors) {
    for (const desc of descriptors) {
      const homeZone = this.zones.get(desc.home_zone);
      if (!homeZone) {
        console.warn(`Entity ${desc.name} references unknown zone: ${desc.home_zone}`);
        continue;
      }

      const entity = {
        // Identity (from descriptor)
        id: desc.id,
        name: desc.name,
        homeZone: desc.home_zone,
        moveSpeed: desc.move_speed || 0.8,
        wanderRadius: desc.wander_radius || 8,
        promptPath: desc.prompt_path || null,
        systemPrompt: desc.system_prompt || null,
        class: desc.class || desc.social_class || null,
        occupation: desc.occupation || null,
        economy: desc.economy || null,
        personality: desc.personality || null,

        // Avatar (from descriptor)
        avatar: desc.avatar || { shape: 'sphere', color: '0xffffff' },
        voice: desc.voice || null,

        // Runtime state
        position: {
          x: homeZone.position.x + (Math.random() - 0.5) * 4,
          y: 1.2,
          z: homeZone.position.z + (Math.random() - 0.5) * 4,
        },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        zone: desc.home_zone,
        tier: 'AMBIENT', // assigned dynamically
        action: 'idle', // idle | wandering | speaking
        targetPosition: null,
        conversationHistory: [],
        spawned: false,
      };

      this.entities.set(entity.id, entity);
    }

    console.log(`EntityManager: ${this.entities.size} entities loaded`);
  }

  /**
   * Start the behavior tick loop.
   */
  start() {
    if (this._tickInterval) return;
    this._tickInterval = setInterval(() => this._tick(), this.WANDER_TICK_MS);
    this._broadcastAllStates();
  }

  /**
   * Stop the behavior tick loop.
   */
  stop() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }

  /**
   * Get all entity states for a new client joining.
   */
  getAllStates() {
    const states = [];
    for (const [id, e] of this.entities) {
      if (!e.spawned) continue;
      states.push({
        entityId: id,
        name: e.name,
        persona: 'ai',
        avatar: e.avatar,
        position: e.position,
        rotation: e.rotation,
        zone: e.zone,
        tier: e.tier,
      });
    }
    return states;
  }

  /**
   * Update tier assignments based on visitor position.
   * Called when visitor moves significantly.
   * @param {{ x, y, z }} visitorPos
   */
  updateTiers(visitorPos) {
    const distances = [];

    for (const [id, entity] of this.entities) {
      const dx = entity.position.x - visitorPos.x;
      const dz = entity.position.z - visitorPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      distances.push({ id, entity, dist });
    }

    // Sort by distance
    distances.sort((a, b) => a.dist - b.dist);

    let fullCount = 0;
    let activeCount = 0;

    for (const { id, entity, dist } of distances) {
      let newTier;

      if (dist < this.tierConfig.FULL.radius && fullCount < this.tierConfig.FULL.max) {
        newTier = 'FULL';
        fullCount++;
      } else if (dist < this.tierConfig.ACTIVE.radius && activeCount < this.tierConfig.ACTIVE.max) {
        newTier = 'ACTIVE';
        activeCount++;
      } else {
        newTier = 'AMBIENT';
      }

      if (entity.tier !== newTier) {
        const oldTier = entity.tier;
        entity.tier = newTier;
        this.broadcast({
          type: 'entity_tier_changed',
          entityId: id,
          oldTier,
          newTier,
        });
      }

      this._applySpawnState(entity);
    }
  }

  /**
   * Check if any entity should respond to voice input.
   * @param {string} transcription — what the visitor said
   * @param {{ x, y, z }} speakerPos — visitor position
   * @param {string} speakerName — visitor name
   * @returns {Promise<{ entityId, text, position }|null>}
   */
  async handleVoiceInput(transcription, speakerPos, speakerName) {
    const now = Date.now();

    // Find nearest FULL-tier entity within speech range
    let nearest = null;
    let nearestDist = Infinity;

    for (const [id, entity] of this.entities) {
      if (entity.tier !== 'FULL') continue;
      if (entity.action === 'speaking') continue;

      // Check cooldown
      const lastSpeech = this._speechCooldown.get(id) || 0;
      if (now - lastSpeech < this.SPEECH_COOLDOWN_MS) continue;

      const dx = entity.position.x - speakerPos.x;
      const dy = (entity.position.y || 1.2) - (speakerPos.y || 1.7);
      const dz = entity.position.z - speakerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < this.SPEECH_RANGE && dist < nearestDist) {
        nearestDist = dist;
        nearest = { id, entity, distance: dist };
      }
    }

    if (!nearest || !this.llmClient) return null;

    const { id, entity } = nearest;
    entity.action = 'speaking';
    this._speechCooldown.set(id, now);

    try {
      // Build conversation context
      entity.conversationHistory.push({
        role: 'user',
        content: `[${speakerName} is ${nearestDist.toFixed(0)}m away]: ${transcription}`,
      });

      // Keep rolling window
      if (entity.conversationHistory.length > 10) {
        entity.conversationHistory.splice(0, entity.conversationHistory.length - 10);
      }

      // Get enriched system prompt context
      const identityCard = [
        `Name: ${entity.name}`,
        entity.class ? `Class: ${entity.class}` : null,
        entity.occupation ? `Occupation: ${entity.occupation}` : null,
        entity.personality ? `Personality: ${JSON.stringify(entity.personality)}` : null,
        entity.economy ? `Economy: ${JSON.stringify(entity.economy)}` : null,
      ].filter(Boolean).join('\n');

      const systemPrompt = `${entity.systemPrompt || 'You are an entity in a shared virtual world.'}\n\n${identityCard}\n\nRespond in-character with world-grounded detail.`;

      // LLM call
      const result = await this.llmClient.chat.completions.create({
        model: this.aiConfig.llm_model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...entity.conversationHistory,
        ],
        max_tokens: this.aiConfig.llm_max_tokens || 150,
        temperature: this.aiConfig.llm_temperature || 0.9,
      });

      const response = result.choices[0]?.message?.content?.trim();
      if (!response) {
        entity.action = 'wandering';
        return null;
      }

      // Add to history
      entity.conversationHistory.push({ role: 'assistant', content: response });
      if (entity.conversationHistory.length > 10) {
        entity.conversationHistory.splice(0, entity.conversationHistory.length - 10);
      }

      this._writeMemoryNode({
        entityId: id,
        speakerName,
        transcription,
        response,
        timestamp: now,
      });

      entity.action = 'wandering';

      return {
        entityId: id,
        entityName: entity.name,
        text: response,
        position: { ...entity.position },
        voiceConfig: entity.voice,
        className: entity.class,
      };
    } catch (e) {
      console.error(`Entity ${entity.name} LLM error:`, e.message);
      entity.action = 'wandering';
      return null;
    }
  }

  /**
   * Handle an external action (from Manemus or other AI orchestrator).
   * @param {object} action — { type, entity_id, ... }
   */
  handleExternalAction(action) {
    const entity = this.entities.get(action.entity_id);
    if (!entity) return;

    switch (action.type) {
      case 'move':
        entity.targetPosition = action.target;
        entity.action = 'wandering';
        break;

      case 'speak':
        this.broadcast({
          type: 'entity_speak',
          entityId: action.entity_id,
          entityName: entity.name,
          text: action.text,
          position: entity.position,
        });
        break;

      case 'emote':
        this.broadcast({
          type: 'entity_emote',
          entityId: action.entity_id,
          gesture: action.gesture,
          position: entity.position,
        });
        break;

      case 'spawn':
        entity.action = 'idle';
        this._broadcastEntityState(entity);
        break;

      case 'despawn':
        this.broadcast({
          type: 'entity_despawned',
          entityId: action.entity_id,
        });
        break;
    }
  }

  // ─── Private Methods ──────────────────────────────

  _tick() {
    const now = Date.now();

    for (const [id, entity] of this.entities) {
      if (!entity.spawned) continue;
      const homeZone = this.zones.get(entity.homeZone);
      if (!homeZone) continue;

      // Pick new wander target if needed
      if (!entity.targetPosition || this._reachedTarget(entity)) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * entity.wanderRadius;
        entity.targetPosition = {
          x: homeZone.position.x + Math.cos(angle) * dist,
          z: homeZone.position.z + Math.sin(angle) * dist,
        };
        entity.action = 'wandering';
      }

      // Move toward target
      const dx = entity.targetPosition.x - entity.position.x;
      const dz = entity.targetPosition.z - entity.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.5) {
        const step = entity.moveSpeed * 0.1;
        const factor = Math.min(step / dist, 1);
        entity.position.x += dx * factor;
        entity.position.z += dz * factor;

        // Face movement direction
        const yaw = Math.atan2(dx, dz);
        entity.rotation = {
          x: 0,
          y: Math.sin(yaw / 2),
          z: 0,
          w: Math.cos(yaw / 2),
        };
      }

      // Gentle float bob
      entity.position.y = 1.2 + Math.sin(now * 0.001 + id.charCodeAt(3) * 0.5) * 0.3;

      // Broadcast movement
      this.broadcast({
        type: 'entity_moved',
        entityId: id,
        position: entity.position,
        rotation: entity.rotation,
      });
    }
  }

  _reachedTarget(entity) {
    if (!entity.targetPosition) return true;
    const dx = entity.targetPosition.x - entity.position.x;
    const dz = entity.targetPosition.z - entity.position.z;
    return Math.sqrt(dx * dx + dz * dz) < 1.0;
  }

  _applySpawnState(entity) {
    // Spawn entities that have a tier assigned but aren't spawned yet
    if (entity.tier && !entity.spawned) {
      entity.spawned = true;
      this._broadcastEntityState(entity);
    } else if (!entity.tier && entity.spawned) {
      entity.spawned = false;
      this.broadcast({
        type: 'entity_despawned',
        entityId: entity.id,
      });
    }
  }

  _broadcastAllStates() {
    // On startup, spawn all entities (no visitor proximity yet)
    for (const [id, entity] of this.entities) {
      entity.spawned = true;
      entity.tier = entity.tier || 'AMBIENT';
      this._broadcastEntityState(entity);
    }
  }

  _broadcastEntityState(entity) {
    this.broadcast({
      type: 'entity_spawned',
      entityId: entity.id,
      name: entity.name,
      persona: 'ai',
      avatar: entity.avatar,
      position: entity.position,
      rotation: entity.rotation,
      zone: entity.zone,
      tier: entity.tier,
    });
  }

  /**
   * Destroy — clean up intervals.
   */
  destroy() {
    this.stop();
    this.entities.clear();
  }
}
