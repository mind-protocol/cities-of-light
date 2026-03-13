# SYNC: Living Places

```
STATUS: CANONICAL
PURPOSE: Current state of the Living Places communication substrate
UPDATED: 2026-03-13
CHAIN: OBJECTIVES → PATTERNS → BEHAVIORS → ALGORITHM → VALIDATION → HEALTH → IMPLEMENTATION → SYNC
```

---

## Current State

**Phase:** V1 implemented. Text-first web meeting rooms with graph persistence.

### What's Shipped

| Component | File | Status |
|-----------|------|--------|
| Graph Client | `src/server/graph-client.js` | OK |
| Place Server | `src/server/place-server.js` | OK |
| Moment Pipeline | `src/server/moment-pipeline.js` | OK |
| Server Integration | `src/server/index.js` (modified) | OK |
| Web UI | `src/client/place.html` + place-app.js + place-style.css + place-network.js | OK |
| Vite Config | `vite.config.js` (multi-page + proxy) | OK |
| MCP Tool | `mind-mcp/mcp/tools/place_handler.py` (6 actions) | OK |
| MCP Registration | `mind-mcp/mcp/server.py` (modified) | OK |
| HEALTH Checkers | `mind-mcp/.mind/capabilities/living-places/runtime/checks.py` (7 checks) | OK |

### Architecture Decisions Made

- **Production server (`src/server/`), not engine.** `src/server/index.js` is what runs on Render. Code goes where it deploys.
- **FalkorDB via `falkordb` npm package.** Direct connection, no Python proxy.
- **Graph persistence from day 1.** Async, fire-and-forget with error logging. Broadcast doesn't wait for graph write.
- **MCP tools use graph + HTTP notification.** Graph is authoritative. POST to `/api/places/:id/notify` for real-time web client delivery.
- **Separate WebSocket path.** `/places/ws` for Living Places, `/ws` for VR world. Both share the same HTTP server.
- **Graceful degradation.** If FalkorDB unavailable, Living Places disabled. Rest of server works fine.

### Maturity

**Canonical (V1):**
- Place = Space node with AT links for presence
- Moment = universal communication unit (same schema for AI and human)
- Renderer-agnostic protocol (`place:join`, `place:moment`, etc.)
- Web UI: text chat with participant sidebar
- MCP tools: join/speak/listen/leave/list/create
- 7 HEALTH checkers (graph-based)

**Proposed (V2+):**
- WebRTC for full human audio/video
- Per-citizen ElevenLabs voice IDs
- Energy decay timer on moments
- Access control / authentication
- TTS for AI moments to web clients
- Conversation crystallization into Narratives

---

## Blocking Issues

None. V1 is functional pending integration testing.

---

## Open Questions Resolved

- **Q1 (Place Server location):** Resolved → `src/server/`, not engine/. Production server.
- **Q2 (AI citizen listening):** Resolved → MCP `listen` action queries graph directly. HTTP POST for real-time notification to web clients.
- **Q3 (Emergency Council):** Resolved → Full V1. The meeting IS the validation.

---

## What's Next

### Immediate

- [ ] Integration test: start server, create a place, join from web UI, exchange moments
- [ ] Verify graph persistence: moments have IN links to Space, CREATED links to Actor
- [ ] Test MCP tool: AI citizen joins and speaks, web client sees the moment
- [ ] Emergency Council meeting: first real validation

### Later

- [ ] TTS for AI moments (voice overlay for web clients)
- [ ] Energy decay timer (V2)
- [ ] Access control (V2)
- [ ] WebRTC audio (V2)
- [ ] Conversation crystallization (V2)

---

## Handoff

**For testing:** Start server with `npm run server` in cities-of-light. Open `http://localhost:8800/place.html?id=PLACE_ID&name=Nicolas`. If FalkorDB is running, Living Places will be active. If not, server runs fine without it.

**For MCP testing:** Use `place` tool with `action: "create"` to create a place, then `action: "join"` to enter, `action: "speak"` to send a moment.

**For HEALTH:** Checkers auto-discovered via capability framework at `.mind/capabilities/living-places/runtime/checks.py`.

---

## Pointers

| What | Where |
|------|-------|
| Graph Client | `cities-of-light/src/server/graph-client.js` |
| Place Server | `cities-of-light/src/server/place-server.js` |
| Moment Pipeline | `cities-of-light/src/server/moment-pipeline.js` |
| Server integration | `cities-of-light/src/server/index.js` (lines 20-22, 33, 112-142, 234-249, 625-639) |
| Web UI | `cities-of-light/src/client/place.html` + place-app.js |
| MCP Tool | `mind-mcp/mcp/tools/place_handler.py` |
| HEALTH Checkers | `mind-mcp/.mind/capabilities/living-places/runtime/checks.py` |
| Design docs | `cities-of-light/docs/communication/living-places/` (8 docs) |

---

## History

| Date | What | Who |
|------|------|-----|
| 2026-03-13 | Full doc chain created (8 docs) | @dragon_slayer + Nicolas |
| 2026-03-13 | V1 implemented: server, web UI, MCP tools, HEALTH | @dragon_slayer |
