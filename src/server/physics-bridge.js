/**
 * Physics Bridge — connects the Python physics tick engine to the Express.js server.
 *
 * Thin translation layer: Python engine -> JSON -> JavaScript -> WebSocket events.
 * Spawns a Python subprocess per tick, captures JSON stdout, emits events.
 *
 * DOCS: docs/narrative/physics/IMPLEMENTATION_Physics.md
 *
 * Co-Authored-By: Tomaso Nervo (@nervo) <nervo@mindprotocol.ai>
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Default tick interval: 5 minutes (Venice-calibrated, matches TICK_INTERVAL_MINUTES)
const DEFAULT_TICK_INTERVAL = 300_000;

// Maximum time to wait for a tick to complete before killing the process
const TICK_TIMEOUT = 30_000;

// Tension change threshold — only emit events for significant changes
const TENSION_SIGNIFICANCE_THRESHOLD = 0.1;

export class PhysicsBridge extends EventEmitter {
  /**
   * @param {Object} options
   * @param {Object} options.graphClient - GraphClient instance (for connection config)
   * @param {Object} options.wsServer   - WebSocketServer instance (for broadcasting)
   * @param {number} [options.tickInterval=300000] - Tick interval in ms
   * @param {string} [options.pythonPath='python3']  - Path to Python interpreter
   * @param {string} [options.playerId='player']     - Player actor ID for proximity
   */
  constructor(options = {}) {
    super();
    this.graphClient = options.graphClient || null;
    this.wsServer = options.wsServer || null;
    this.tickInterval = options.tickInterval || DEFAULT_TICK_INTERVAL;
    this.pythonPath = options.pythonPath || 'python3';
    this.playerId = options.playerId || 'player';

    this._intervalHandle = null;
    this._running = false;     // true while a tick subprocess is active
    this._stopped = true;      // true when the loop is not active
    this._lastResult = null;
    this._tickCount = 0;
    this._scriptPath = join(__dirname, 'run_tick.py');

    // FalkorDB connection config — read from env or graphClient
    this._dbHost = process.env.FALKORDB_HOST || 'localhost';
    this._dbPort = process.env.FALKORDB_PORT || '6379';
    this._dbGraph = process.env.FALKORDB_GRAPH || 'venezia';
  }

  // ─── Lifecycle ─────────────────────────────────────────

  /**
   * Start the tick loop. Runs the first tick immediately, then at interval.
   */
  async start() {
    if (!this._stopped) {
      console.warn('[PhysicsBridge] Already running');
      return;
    }

    this._stopped = false;
    console.log(`[PhysicsBridge] Starting tick loop (interval: ${this.tickInterval}ms)`);
    this.emit('start');

    // Run first tick immediately
    await this.runOnce();

    // Schedule subsequent ticks
    this._intervalHandle = setInterval(() => {
      this.runOnce().catch((err) => {
        console.error('[PhysicsBridge] Scheduled tick error:', err.message);
      });
    }, this.tickInterval);
  }

  /**
   * Stop the tick loop. Does not kill an in-progress tick.
   */
  stop() {
    if (this._stopped) return;

    this._stopped = true;
    if (this._intervalHandle) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = null;
    }
    console.log('[PhysicsBridge] Tick loop stopped');
    this.emit('stop');
  }

  /**
   * Run a single tick. Skips if a tick is already in progress (never concurrent).
   * @returns {Promise<Object|null>} Tick result or null if skipped/failed
   */
  async runOnce() {
    // Guard: never run two ticks simultaneously
    if (this._running) {
      console.warn('[PhysicsBridge] Tick already in progress, skipping');
      return null;
    }

    this._running = true;
    const tickStart = Date.now();

    try {
      const result = await this._spawnTick();
      const wallMs = Date.now() - tickStart;

      this._lastResult = result;
      this._tickCount++;

      if (result.success) {
        // Log tick summary
        const s = result.summary || {};
        console.log(
          `[PhysicsBridge] Tick #${result.tick} complete ` +
          `(${result.elapsed_ms}ms python, ${wallMs}ms wall) ` +
          `actors=${s.actors_updated} moments_active=${s.moments_active} ` +
          `completed=${s.moments_completed} energy=${s.energy_generated}`
        );

        // Warn if tick exceeded 1 second
        if (result.elapsed_ms > 1000) {
          console.warn(`[PhysicsBridge] SLOW TICK: ${result.elapsed_ms}ms (threshold: 1000ms)`);
        }

        // Emit events
        this._emitTickEvents(result);
      } else {
        // Tick failed — fail loud
        console.error(`[PhysicsBridge] Tick FAILED: ${result.error} (${result.error_type})`);
        this.emit('error', new Error(result.error));
        this._broadcastEvent('physics.tick_error', {
          error: result.error,
          error_type: result.error_type,
          tick: result.tick,
        });
      }

      return result;
    } catch (err) {
      // Subprocess or parse failure — fail loud
      console.error('[PhysicsBridge] Tick execution error:', err.message);
      this.emit('error', err);
      this._broadcastEvent('physics.tick_error', {
        error: err.message,
        tick: this._tickCount,
      });
      return null;
    } finally {
      this._running = false;
    }
  }

  /**
   * Get the result of the last completed tick.
   * @returns {Object|null}
   */
  getLastTickResult() {
    return this._lastResult;
  }

  // ─── Internal: Subprocess ──────────────────────────────

  /**
   * Spawn the Python tick runner and capture its JSON output.
   * @returns {Promise<Object>} Parsed JSON from the subprocess stdout
   */
  _spawnTick() {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        FALKORDB_HOST: this._dbHost,
        FALKORDB_PORT: String(this._dbPort),
        FALKORDB_GRAPH: this._dbGraph,
        TICK_PLAYER_ID: this.playerId,
        DATABASE_BACKEND: 'falkordb',
      };

      const proc = spawn(this.pythonPath, [this._scriptPath], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: TICK_TIMEOUT,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        // Log stderr (Python logging goes here)
        if (stderr.trim()) {
          for (const line of stderr.trim().split('\n')) {
            console.log(`[PhysicsBridge:py] ${line}`);
          }
        }

        if (code !== 0 && code !== null) {
          return reject(new Error(
            `Python tick exited with code ${code}: ${stderr.trim().split('\n').pop() || 'unknown error'}`
          ));
        }

        // Parse JSON from stdout
        const trimmed = stdout.trim();
        if (!trimmed) {
          return reject(new Error('Python tick produced no output'));
        }

        try {
          const result = JSON.parse(trimmed);
          resolve(result);
        } catch (parseErr) {
          reject(new Error(`Failed to parse tick output: ${parseErr.message}\nRaw: ${trimmed.slice(0, 500)}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn Python process: ${err.message}`));
      });
    });
  }

  // ─── Internal: Event Emission ──────────────────────────

  /**
   * Emit all relevant events after a successful tick.
   * @param {Object} result - Parsed tick result from run_tick.py
   */
  _emitTickEvents(result) {
    const summary = result.summary || {};
    const events = result.events || {};

    // 1. physics.tick_complete — always emitted on success
    const tickCompletePayload = {
      tick: result.tick,
      elapsed_ms: result.elapsed_ms,
      ...summary,
    };
    this.emit('physics.tick_complete', tickCompletePayload);
    this._broadcastEvent('physics.tick_complete', tickCompletePayload);

    // 2. narrative.moment_flip — if any moments completed (threshold crossed)
    const flips = events.moment_flips || [];
    if (flips.length > 0) {
      const flipPayload = {
        tick: result.tick,
        count: flips.length,
        moments: flips,
      };
      this.emit('narrative.moment_flip', flipPayload);
      this._broadcastEvent('narrative.moment_flip', flipPayload);
    }

    // 3. citizen.tension_changed — if significant tension changes detected
    const tensions = events.tension_changes || [];
    if (tensions.length > 0) {
      const tensionPayload = {
        tick: result.tick,
        count: tensions.length,
        changes: tensions,
      };
      this.emit('citizen.tension_changed', tensionPayload);
      this._broadcastEvent('citizen.tension_changed', tensionPayload);
    }

    // 4. narrative.event — if emergent narrative events detected
    const narrativeEvents = events.narrative_events || [];
    if (narrativeEvents.length > 0) {
      for (const evt of narrativeEvents) {
        const eventPayload = {
          tick: result.tick,
          ...evt,
        };
        this.emit('narrative.event', eventPayload);
        this._broadcastEvent('narrative.event', eventPayload);
      }
    }
  }

  /**
   * Broadcast an event to all connected WebSocket clients.
   * @param {string} eventType - Event type name
   * @param {Object} payload   - Event payload
   */
  _broadcastEvent(eventType, payload) {
    if (!this.wsServer) return;

    const msg = JSON.stringify({
      type: eventType,
      timestamp: Date.now(),
      ...payload,
    });

    for (const client of this.wsServer.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(msg);
      }
    }
  }
}
