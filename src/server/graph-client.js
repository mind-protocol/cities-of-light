/**
 * Graph Client — FalkorDB wrapper for Living Places.
 *
 * Thin layer over the `falkordb` npm package. Provides typed methods
 * for Space, Moment, and link operations used by the Place Server
 * and Moment Pipeline.
 *
 * Uses Mind Protocol schema: Space (label), Moment (label), Actor (label),
 * single `:link` relationship type with semantic properties.
 */

import { FalkorDB } from 'falkordb';
import { randomUUID } from 'crypto';

export class GraphClient {
  constructor(graph) {
    this._graph = graph;
  }

  /**
   * Connect to FalkorDB and select a graph.
   * @param {{ host?: string, port?: number, graph?: string }} opts
   * @returns {Promise<GraphClient>}
   */
  static async connect({ host = 'localhost', port = 6379, graph = 'manemus' } = {}) {
    const db = await FalkorDB.connect({
      socket: { host, port },
    });
    const g = db.selectGraph(graph);
    return new GraphClient(g);
  }

  // ─── Space (Place) Operations ──────────────────────────

  /**
   * Create or update a Space node (idempotent via MERGE).
   */
  async createSpace(id, name, capacity, accessLevel, status = 'active') {
    const synthesis = `${name}. Meeting room. Capacity: ${capacity}. Access: ${accessLevel}.`;
    const now = new Date().toISOString();
    const nowS = Math.floor(Date.now() / 1000);

    await this._graph.query(
      `MERGE (s:Space {id: $id})
       SET s.type = 'place',
           s.name = $name,
           s.capacity = $capacity,
           s.access_level = $access_level,
           s.status = $status,
           s.synthesis = $synthesis,
           s.created_at = COALESCE(s.created_at, $now),
           s.created_at_s = COALESCE(s.created_at_s, $now_s)`,
      { params: { id, name, capacity, access_level: accessLevel, status, synthesis, now, now_s: nowS } },
    );
    return { id, name, capacity, accessLevel, status, synthesis };
  }

  /**
   * Get a Space node by ID.
   * @returns {{ id, name, capacity, access_level, status } | null}
   */
  async getSpace(spaceId) {
    const result = await this._graph.roQuery(
      `MATCH (s:Space {id: $id}) RETURN s.id, s.name, s.capacity, s.access_level, s.status`,
      { params: { id: spaceId } },
    );
    if (!result.data || result.data.length === 0) return null;
    const row = result.data[0];
    return { id: row['s.id'], name: row['s.name'], capacity: row['s.capacity'], access_level: row['s.access_level'], status: row['s.status'] };
  }

  /**
   * Update Space status.
   */
  async updateSpaceStatus(spaceId, status) {
    await this._graph.query(
      `MATCH (s:Space {id: $id}) SET s.status = $status`,
      { params: { id: spaceId, status } },
    );
  }

  /**
   * List active places with participant counts.
   */
  async listActivePlaces() {
    const result = await this._graph.roQuery(
      `MATCH (s:Space {type: 'place', status: 'active'})
       OPTIONAL MATCH (a)-[:link {type: 'AT'}]->(s)
       RETURN s.id, s.name, s.capacity, s.access_level, count(a) as participants`,
    );
    if (!result.data) return [];
    return result.data.map(row => ({
      id: row['s.id'], name: row['s.name'], capacity: row['s.capacity'], access_level: row['s.access_level'], participants: row['participants'],
    }));
  }

  // ─── Moment Operations ────────────────────────────────

  /**
   * Create a Moment node.
   * @returns {{ id, content, source, kind, energy, created_at, created_at_s }}
   */
  async createMoment(content, source = 'text', kind = 'text', energy = 1.0) {
    const id = `moment_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();
    const nowS = Math.floor(Date.now() / 1000);
    // synthesis = content truncated for embedding
    const synthesis = content.length > 500 ? content.slice(0, 500) : content;

    await this._graph.query(
      `CREATE (m:Moment {
        id: $id,
        type: 'utterance',
        content: $content,
        synthesis: $synthesis,
        source: $source,
        kind: $kind,
        energy: $energy,
        created_at: $now,
        created_at_s: $now_s
      })`,
      { params: { id, content, synthesis, source, kind, energy, now, now_s: nowS } },
    );
    return { id, content, source, kind, energy, created_at: now, created_at_s: nowS };
  }

  /**
   * Get recent moments in a space, ordered by time ascending.
   * @param {string} spaceId
   * @param {number} limit
   * @param {number|null} sinceTs — Unix timestamp, or null for all
   * @returns {Array<{ id, content, source, kind, energy, created_at, created_at_s, author_id }>}
   */
  async getMomentsInSpace(spaceId, limit = 50, sinceTs = null) {
    const since = sinceTs || 0;
    const result = await this._graph.roQuery(
      `MATCH (m:Moment)-[:link {type: 'IN'}]->(s:Space {id: $space_id})
       WHERE m.created_at_s > $since
       OPTIONAL MATCH (a)-[:link {type: 'CREATED'}]->(m)
       RETURN m.id, m.content, m.source, m.kind, m.energy, m.created_at, m.created_at_s, a.id
       ORDER BY m.created_at_s ASC
       LIMIT $limit`,
      { params: { space_id: spaceId, since, limit } },
    );
    if (!result.data) return [];
    return result.data.map(row => ({
      id: row['m.id'], content: row['m.content'], source: row['m.source'], kind: row['m.kind'],
      energy: row['m.energy'], created_at: row['m.created_at'], created_at_s: row['m.created_at_s'], author_id: row['a.id'],
    }));
  }

  // ─── Link Operations ──────────────────────────────────

  /**
   * Create a link between two nodes.
   * @param {string} srcId — Source node ID
   * @param {string} tgtId — Target node ID
   * @param {string} type — Link semantic type (AT, IN, CREATED, etc.)
   * @param {Object} props — Additional link properties
   */
  async createLink(srcId, tgtId, type, props = {}) {
    const propsStr = Object.keys(props).length > 0
      ? ', ' + Object.entries(props).map(([k, v]) => `${k}: $prop_${k}`).join(', ')
      : '';
    const params = { src: srcId, tgt: tgtId, type };
    for (const [k, v] of Object.entries(props)) {
      params[`prop_${k}`] = v;
    }

    await this._graph.query(
      `MATCH (a {id: $src}), (b {id: $tgt})
       CREATE (a)-[:link {type: $type${propsStr}}]->(b)`,
      { params },
    );
  }

  /**
   * Remove a link between two nodes by type.
   */
  async removeLink(srcId, tgtId, type) {
    await this._graph.query(
      `MATCH (a {id: $src})-[r:link {type: $type}]->(b {id: $tgt}) DELETE r`,
      { params: { src: srcId, tgt: tgtId, type } },
    );
  }

  /**
   * Check if a link exists.
   * @returns {boolean}
   */
  async hasLink(srcId, tgtId, type) {
    const result = await this._graph.roQuery(
      `MATCH (a {id: $src})-[r:link {type: $type}]->(b {id: $tgt}) RETURN count(r)`,
      { params: { src: srcId, tgt: tgtId, type } },
    );
    return result.data && result.data.length > 0 && result.data[0]['count(r)'] > 0;
  }

  /**
   * Get all actors with AT links to a space.
   * @returns {Array<{ actor_id, renderer, joined_at }>}
   */
  async getPresenceInSpace(spaceId) {
    const result = await this._graph.roQuery(
      `MATCH (a)-[r:link {type: 'AT'}]->(s:Space {id: $id})
       RETURN a.id, r.renderer, r.joined_at`,
      { params: { id: spaceId } },
    );
    if (!result.data) return [];
    return result.data.map(row => ({
      actor_id: row['a.id'], renderer: row['r.renderer'], joined_at: row['r.joined_at'],
    }));
  }

  /**
   * Count actors in a space.
   * @returns {number}
   */
  async countPresence(spaceId) {
    const result = await this._graph.roQuery(
      `MATCH (a)-[:link {type: 'AT'}]->(s:Space {id: $id}) RETURN count(a)`,
      { params: { id: spaceId } },
    );
    return result.data && result.data.length > 0 ? result.data[0]['count(a)'] : 0;
  }

  /**
   * Raw Cypher query passthrough.
   */
  async query(cypher, params = {}) {
    return this._graph.query(cypher, { params });
  }

  /**
   * Raw read-only Cypher query.
   */
  async roQuery(cypher, params = {}) {
    return this._graph.roQuery(cypher, { params });
  }
}
