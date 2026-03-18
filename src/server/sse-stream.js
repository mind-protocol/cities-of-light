/**
 * SSE Stream — Server-Sent Events endpoint for narrative playthrough streaming.
 *
 * Tails `playthroughs/{id}/stream.jsonl` and emits each line as an SSE event.
 * Supports `Last-Event-ID` for catch-up after reconnection.
 *
 * JSONL format per line:
 *   { "type": "...", "text": "...", "speaker": "...", "tone": "...",
 *     "tick": 0, "timestamp": "...", "clickables": {} }
 *
 * SSE event types:
 *   - narration:  narrator prose
 *   - dialogue:   character speech (speaker field populated)
 *   - moment:     moment activation / completion / decay
 *   - tick:       physics tick summary
 *   - ping:       keepalive (every 30s)
 *
 * DOCS: docs/feedback/IMPLEMENTATION_Feedback.md
 *
 * Co-Authored-By: Tomaso Nervo (@nervo) <nervo@mindprotocol.ai>
 */

import { createReadStream, existsSync, statSync, watchFile, unwatchFile } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';

// Keepalive interval (30s) — clients should set EventSource reconnect to ~5s
const KEEPALIVE_MS = 30_000;

// Max lines to buffer for catch-up replay
const MAX_REPLAY_LINES = 500;

/**
 * SSEStream — manages SSE connections for a single playthrough.
 *
 * Each playthrough has one SSEStream instance, shared across all connected
 * clients. The stream watches the JSONL file and fans out to all subscribers.
 */
export class SSEStream {
  /**
   * @param {string} playthroughId
   * @param {string} playthroughsDir — base directory for playthroughs
   */
  constructor(playthroughId, playthroughsDir) {
    this.playthroughId = playthroughId;
    this.streamPath = join(playthroughsDir, playthroughId, 'stream.jsonl');
    this.clients = new Set();       // Set<{ res, keepaliveTimer }>
    this.lineBuffer = [];           // circular buffer of { id, line } for replay
    this.nextEventId = 1;
    this._watchingFile = false;
    this._lastFileSize = 0;
  }

  /** Number of connected SSE clients. */
  get clientCount() { return this.clients.size; }

  /**
   * Add an SSE client (Express response object).
   *
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   */
  addClient(req, res) {
    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Catch-up: replay events after Last-Event-ID
    const lastId = parseInt(req.headers['last-event-id'], 10);
    if (lastId > 0 && this.lineBuffer.length > 0) {
      const replayFrom = this.lineBuffer.findIndex(e => e.id > lastId);
      if (replayFrom >= 0) {
        for (let i = replayFrom; i < this.lineBuffer.length; i++) {
          const entry = this.lineBuffer[i];
          this._sendEvent(res, entry.id, entry.parsed);
        }
      }
    }

    // Connected event
    this._sendRaw(res, 'event: connected\n');
    this._sendRaw(res, `data: ${JSON.stringify({ playthrough_id: this.playthroughId })}\n\n`);

    // Keepalive timer
    const keepaliveTimer = setInterval(() => {
      this._sendRaw(res, 'event: ping\ndata: {}\n\n');
    }, KEEPALIVE_MS);

    const client = { res, keepaliveTimer };
    this.clients.add(client);

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(keepaliveTimer);
      this.clients.delete(client);
    });

    // Start watching the file if not already
    if (!this._watchingFile) {
      this._startWatching();
    }
  }

  /**
   * Push an event programmatically (e.g. from physics bridge or place server).
   * Bypasses file tailing — directly fans out to all connected clients.
   *
   * @param {Object} eventData — must have at least { type }
   */
  push(eventData) {
    const id = this.nextEventId++;
    const parsed = eventData;
    this._bufferEvent(id, parsed);

    for (const client of this.clients) {
      this._sendEvent(client.res, id, parsed);
    }
  }

  /** Stop watching and disconnect all clients. */
  destroy() {
    this._stopWatching();
    for (const client of this.clients) {
      clearInterval(client.keepaliveTimer);
      client.res.end();
    }
    this.clients.clear();
    this.lineBuffer.length = 0;
  }

  // ─── Internal ─────────────────────────────────────────

  _startWatching() {
    if (!existsSync(this.streamPath)) return;

    this._watchingFile = true;
    this._lastFileSize = statSync(this.streamPath).size;

    // Read existing lines for replay buffer
    this._readExistingLines();

    // Watch for file changes (poll-based, works across platforms)
    watchFile(this.streamPath, { interval: 500 }, (curr, prev) => {
      if (curr.size > this._lastFileSize) {
        this._readNewLines(this._lastFileSize, curr.size);
        this._lastFileSize = curr.size;
      } else if (curr.size < this._lastFileSize) {
        // File was truncated (rotation) — re-read from start
        this._lastFileSize = 0;
        this.lineBuffer.length = 0;
        this.nextEventId = 1;
        this._readNewLines(0, curr.size);
        this._lastFileSize = curr.size;
      }
    });
  }

  _stopWatching() {
    if (this._watchingFile) {
      unwatchFile(this.streamPath);
      this._watchingFile = false;
    }
  }

  _readExistingLines() {
    if (!existsSync(this.streamPath)) return;

    const rl = createInterface({
      input: createReadStream(this.streamPath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!line.trim()) return;
      const parsed = this._parseLine(line);
      if (parsed) {
        const id = this.nextEventId++;
        this._bufferEvent(id, parsed);
      }
    });
  }

  _readNewLines(startByte, endByte) {
    if (!existsSync(this.streamPath)) return;
    if (startByte >= endByte) return;

    const rl = createInterface({
      input: createReadStream(this.streamPath, {
        encoding: 'utf-8',
        start: startByte,
        end: endByte - 1,
      }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!line.trim()) return;
      const parsed = this._parseLine(line);
      if (parsed) {
        const id = this.nextEventId++;
        this._bufferEvent(id, parsed);

        // Fan out to all connected clients
        for (const client of this.clients) {
          this._sendEvent(client.res, id, parsed);
        }
      }
    });
  }

  _parseLine(line) {
    try {
      return JSON.parse(line);
    } catch {
      console.warn(`[SSE] Malformed JSONL line in ${this.playthroughId}: ${line.slice(0, 80)}`);
      return null;
    }
  }

  _bufferEvent(id, parsed) {
    this.lineBuffer.push({ id, parsed });
    if (this.lineBuffer.length > MAX_REPLAY_LINES) {
      this.lineBuffer.shift();
    }
  }

  _sendEvent(res, id, data) {
    const eventType = data.type || 'narration';
    const payload = JSON.stringify(data);
    this._sendRaw(res, `id: ${id}\nevent: ${eventType}\ndata: ${payload}\n\n`);
  }

  _sendRaw(res, text) {
    try {
      if (!res.writableEnded) {
        res.write(text);
      }
    } catch {
      // Client disconnected — cleanup will happen via req.on('close')
    }
  }
}

// ─── Express Route Factory ──────────────────────────────────

/**
 * Mount SSE stream routes on an Express app.
 *
 * Registers:
 *   GET /api/stream/:playthroughId — SSE endpoint for narrative stream
 *
 * @param {import('express').Express} app
 * @param {string} playthroughsDir — base directory for playthroughs
 * @returns {{ getStream: (id: string) => SSEStream|undefined, streams: Map<string, SSEStream> }}
 */
export function mountSSERoutes(app, playthroughsDir) {
  /** @type {Map<string, SSEStream>} */
  const streams = new Map();

  /**
   * Get or create an SSEStream for a playthrough.
   * @param {string} playthroughId
   * @returns {SSEStream}
   */
  function getOrCreateStream(playthroughId) {
    let stream = streams.get(playthroughId);
    if (!stream) {
      stream = new SSEStream(playthroughId, playthroughsDir);
      streams.set(playthroughId, stream);
    }
    return stream;
  }

  // SSE endpoint — client connects with EventSource('/api/stream/{id}')
  app.get('/api/stream/:playthroughId', (req, res) => {
    const { playthroughId } = req.params;

    // Validate playthrough exists
    const streamPath = join(playthroughsDir, playthroughId, 'stream.jsonl');
    if (!existsSync(join(playthroughsDir, playthroughId))) {
      return res.status(404).json({ error: `Playthrough not found: ${playthroughId}` });
    }

    const stream = getOrCreateStream(playthroughId);
    stream.addClient(req, res);

    console.log(`[SSE] Client connected to ${playthroughId} (${stream.clientCount} total)`);
  });

  // POST endpoint — push events programmatically (from physics bridge, narrator, etc.)
  app.post('/api/stream/:playthroughId/push', (req, res) => {
    const { playthroughId } = req.params;
    const stream = streams.get(playthroughId);

    if (!stream || stream.clientCount === 0) {
      return res.json({ ok: true, delivered: 0 });
    }

    const event = req.body;
    if (!event || !event.type) {
      return res.status(400).json({ error: 'Event must have a type field' });
    }

    stream.push(event);
    res.json({ ok: true, delivered: stream.clientCount });
  });

  return {
    getStream: (id) => streams.get(id),
    getOrCreateStream,
    streams,
  };
}
