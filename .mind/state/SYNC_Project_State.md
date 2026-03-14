# Project — Sync: Current State

```
LAST_UPDATED: 2026-03-14
UPDATED_BY: Tomaso Nervo (@nervo) — Space key cache added to JS + Python crypto stacks (LRU, 5-min TTL, 100 entries)
```

---

## CURRENT STATE

Cities of Light is a reusable multi-world XR engine. Three-repo architecture:

- **Cities of Light** (this repo) = XR engine (rendering, navigation, voice, networking)
- **Manemus** = AI substrate (how AIs perceive, decide, and act in worlds)
- **World repos** = universe-specific data (citizens, lore, economy, physics config)

**Engine V1: CANONICAL** — 16 files in `engine/`, boots and serves Venezia.
**Engine V2: DESIGNING** — Static JSON-driven (geographic terrain, 152 citizens, 274 buildings, bridges, AI navigation).

**Three universes in construction:**

| Universe | World Repo | Graph (L3) | Status |
|----------|-----------|------------|--------|
| **Venezia** | `/home/mind-protocol/venezia/` | FalkorDB `venezia` | Graph seeded (152 actors, 7 districts, 157 narratives, 1504 links). POC-Mind context assembly validated. |
| **Contre-Terre** | `/home/mind-protocol/contre-terre/` | FalkorDB `contre_terre` (not yet created) | Novel complete (8 chapters, ~148K words). Brain seed prototype ready (868 nodes, 2022 links). 72 universe doc files. 0% code implementation. |
| **Lumina Prime** | (not yet created) | (not yet created) | Work universe where AI citizens do real-world work. Concept only. |

**Key files:**
- `engine/` — V1 engine code (server + client + shared)
- `docs/architecture/engine/` — Full doc chain (OBJECTIVES through SYNC) + V2 spec
- `worlds/venezia` → symlink to `/home/mind-protocol/venezia/`
- `src/` — Legacy Venice-specific code (pre-engine, still functional)
- `src/server/place-server.js` — Living Places V1 (real-time meeting rooms)
- `src/server/graph-client.js` — FalkorDB graph client
- `src/server/moment-pipeline.js` — Conversation moment pipeline
- `src/server/physics-bridge.js` — Physics tick bridge (Python subprocess -> WebSocket events)
- `src/server/run_tick.py` — Python tick runner (executes GraphTickV1_2, outputs JSON)

**Venezia world repo** (`/home/mind-protocol/venezia/`):
- `world-manifest.json` — V2 manifest (geographic generator, data/ paths)
- `data/` — Static JSON exports (152 citizens, 274 buildings, 120 lands, 117 bridges)
- `scripts/` — Seeding + export scripts (seed_venice_graph.py, seed_buildings_graph.py, poc_mind_context_assembly.py, 5 Airtable exports)

**Mind Platform** (`/home/mind-protocol/mind-platform/`):
- Live at `platform.mindprotocol.ai`
- Landing page (CANONICAL), Registry (245 citizens, 41 orgs), Connectome (D3 graph viz)
- Telegram + WhatsApp messaging bots

**FalkorDB graph `venezia` current contents:**
- 162 Actor nodes (152 citizens + 10 system)
- 295 Space nodes (7 districts + 253 buildings + 35 system)
- 355 Narrative nodes (157 Venice narratives + 198 system)
- 227 Moment nodes
- ~2,300 links (1,504 original + 255 IN + 252 OWNED_BY + 290 LOCATED_AT)
- **Buildings seeded:** 253 building Space nodes with position, category, subtype, synthesis. Linked to districts (IN), owners (OWNED_BY), occupants/operators (LOCATED_AT). Per-district: Dorsoduro 60, Rialto 53, San Polo 44, San Marco 34, Castello 33, Cannaregio 18, Santa Croce 11.
- **Missing:** Exterior areas (canals, piazzas, bridges as Space nodes), rooms, Things, position properties on actors

---

## ACTIVE WORK

### Graph Spatial Architecture (Next — @nervo)

- **Area:** FalkorDB `venezia` graph, `src/server/graph-client.js`
- **Status:** Architecture designed, needs implementation
- **Owner:** @nervo
- **Context:** Extend graph from 7 district nodes to full spatial hierarchy: islands → districts → exterior areas (piazzas, canals, bridges) → buildings → rooms. Add position properties to actors/things. Implement proximity-based perception at engine level.

### Physics Bridge (INTEGRATED — @nervo)

- **Area:** `src/server/physics-bridge.js`, `src/server/run_tick.py`, `src/server/index.js`
- **Status:** Integrated and tested. PhysicsBridge starts with server, runs first tick immediately, then every 5 minutes. Tick #3 completed in 315ms (well under 1s threshold). Cypher syntax bugs fixed in rejection phase and moment status queries. Missing `avg_emotion_intensity` function added to constants.py. Graph name defaults unified to `venezia` across all files.
- **Owner:** @nervo
- **Context:** Physics tick runs against live FalkorDB `venezia` graph (162 actors, 34 hot links). Endpoints: `GET /api/physics` (status), `POST /api/physics/tick` (manual trigger). Graceful shutdown stops tick loop on SIGTERM/SIGINT. Configurable via `PHYSICS_TICK_INTERVAL` env var.

### Living Places V1 (DONE)

- **Area:** `src/server/place-server.js`, `src/server/moment-pipeline.js`, `src/client/place-app.js`
- **Status:** Shipped. Real-time meeting rooms with graph persistence.
- **Owner:** completed
- **Context:** Space nodes + Moments + AT links. Web renderer working. Next: Emergency Council first session.

### V2: Static JSON Integration

- **Area:** `engine/`, `worlds/venezia/`
- **Status:** Individual engine components built, integration not tested
- **Owner:** agent
- **Context:** Wire BuildingRenderer + BridgeRenderer into app.js. Test with venezia/data/ JSON.

---

## RECENT CHANGES

### 2026-03-14: "Join Org" Auto-Grant Trigger (@nervo)

- **What:** Implemented `auto_grant_on_membership()` and `process_pending_grants()` in `mind-mcp/runtime/membrane/auto_grant.py`. When an Actor BELIEVES a Narrative (org membership), the function queries Spaces linked via ABOUT, finds an admin/owner, unwraps the Space key using admin's disk keys, wraps for the new actor's public key, and creates a HAS_ACCESS link with role="member". If no admin keys are accessible, queues as a pending_grant Thing node (linked to Space via ABOUT, to Actor via FOR). `process_pending_grants()` processes the queue when an admin comes online.
- **Files created:** `mind-mcp/runtime/membrane/auto_grant.py`
- **Files modified:** `mind-mcp/runtime/membrane/__init__.py` (exports), `mind-protocol/docs/security/space_encryption/SYNC_Space_Encryption.md` (marked implemented)
- **Integration:** Callable from MCP event handlers or periodic checks. No graph event listener needed — caller invokes after BELIEVES link creation.
- **Impact:** Completes the "join org" flow for encrypted spaces. New org members automatically receive keys to all private spaces associated with the org's Narrative.

### 2026-03-14: Context Assembly Decrypt Step for Encrypted Spaces (@nervo)

- **What:** Added decrypt step to `poc_mind_context_assembly.py` so context assembly can read content from private (encrypted) Spaces. When querying Moments/Narratives from FalkorDB, the code now checks the `encrypted` flag on each node. If set, it retrieves the citizen's space key (queries HAS_ACCESS link for the sealed-box-wrapped encrypted_key, decrypts with the citizen's X25519 private key from `.keys/private_key.b64`), then decrypts the content using AES-256-GCM. Unencrypted content passes through unchanged. Decrypt failures log a warning and skip the content (never crash assembly). Space keys are cached per space_id within each query to avoid redundant sealed-box decryptions.
- **Files modified:** `venezia/scripts/poc_mind_context_assembly.py` (added `_load_crypto()`, `_load_citizen_keys()`, `_get_space_key_for_citizen()`, `_decrypt_node_content()`, `_resolve_space_key_for_node()` helpers; updated `query_citizen_beliefs()`, `query_district_narratives()`, `query_active_decrees()` to check `n.encrypted` flag and decrypt; threaded `citizen_username` to `query_active_decrees()` call site)
- **Env vars:** `MIND_PROTOCOL_PYTHON` (path to crypto lib, default `/home/mind-protocol/mind-protocol/python`), `MIND_KEYS_DIR` (citizen keys directory, default `/home/mind-protocol/cities-of-light/citizens`)
- **Pattern:** Follows same crypto integration pattern as `mind-mcp/mcp/tools/place_handler.py` (lazy import, sys.path injection, sealed-box key exchange, graceful error handling)
- **Impact:** Context assembly now works transparently with both public and private Spaces. Citizens can have encrypted beliefs, narratives, and decrees that are decrypted just-in-time for LLM conversation context.

### 2026-03-14: Space Key Cache for Encrypted Spaces (@nervo)

- **What:** Added `SpaceKeyCache` class to both JS (`lib/crypto/key_cache.js`) and Python (`python/crypto/key_cache.py`) crypto stacks. In-memory LRU cache keyed on (actor_id, space_id) avoids repeated sealed-box decryption on every private-Space read. Max 100 entries, 5-minute TTL per entry, `invalidate(spaceId)` for key rotation. Python implementation is thread-safe (threading.Lock). Both exported from their respective facade modules (`__init__.py`, `index.js`).
- **Files created:** `mind-protocol/lib/crypto/key_cache.js`, `mind-protocol/python/crypto/key_cache.py`, `mind-protocol/tests/crypto/test_key_cache.js`, `mind-protocol/tests/crypto/test_key_cache.py`
- **Files modified:** `mind-protocol/lib/crypto/index.js` (exports SpaceKeyCache), `mind-protocol/python/crypto/__init__.py` (exports SpaceKeyCache)
- **Tests:** 30 JS tests + 12 Python tests passing — TTL expiry, LRU eviction, access refresh, invalidation, clear, concurrent access (Python), export verification (JS). All existing crypto tests still pass (27 JS + 16 Python).
- **Impact:** Private space reads no longer require decrypting the sealed box on every access. Cache integrates cleanly into place_handler.py and place-server.js encryption flows.

### 2026-03-14: Physics Engine Integrated into Server (@nervo)

- **What:** Integrated PhysicsBridge into `src/server/index.js`. Physics tick now starts automatically with the server, runs first tick immediately, then repeats every 5 minutes. Added `GET /api/physics` (status endpoint) and `POST /api/physics/tick` (manual trigger). Added graceful shutdown (SIGTERM/SIGINT stops tick loop). Fixed 3 categories of bugs: (1) missing `avg_emotion_intensity` function in constants.py — created from `plutchik_intensity`, handles JSON-serialized emotion lists from graph links; (2) Cypher syntax error in 8 queries across 4 files — `m.status: "failed"` changed to `m.status = "failed"` (colon is invalid in WHERE/SET clauses); (3) graph name defaults unified to `venezia` in physics-bridge.js (was `cities_of_light`) and graph-client.js (was `manemus`).
- **Files modified:** `src/server/index.js` (PhysicsBridge import, instantiation, event logging, API endpoints, graceful shutdown), `src/server/physics-bridge.js` (default graph → `venezia`), `src/server/graph-client.js` (default graph → `venezia`), `.mind/runtime/physics/constants.py` (added `avg_emotion_intensity`), `.mind/runtime/physics/tick_v1_2.py` (import `avg_emotion_intensity`), `.mind/runtime/physics/phases/rejection.py` (Cypher fix), `.mind/runtime/physics/graph/graph_ops_moments.py` (4 Cypher fixes), `.mind/runtime/traversal/moment.py` (3 Cypher fixes), `.mind/runtime/infrastructure/canon/canon_holder.py` (Cypher fix)
- **Test:** Tick #3 completed in 315ms Python / 856ms wall against live `venezia` graph (162 actors, 34 hot links). Zero warnings. Server startup clean.
- **Impact:** Physics engine is now live. Venice narrative breathes. Next: reconcile GENERATION_RATE constants, add positions to spatial nodes.

### 2026-03-14: L4 Registry — Citizen Endpoint Support (@nervo)

- **What:** Extended the L4 registry to support citizen endpoints (multiple per citizen, one per repo/instance). Previously only orgs had endpoint Thing nodes; citizens had none. Now a citizen working on N repos can register N endpoints, and the membrane can resolve all of them for routing.
- **Files modified:** `mind-protocol/l4/registry/citizen_registration_crud_operations.py` (added `add_citizen_endpoint()`, `remove_citizen_endpoint()`, `get_citizen_endpoints()`), `mind-protocol/l4/registry/endpoint_registration_and_management.py` (added `create_citizen_endpoint_node()`), `mind-protocol/l4/registry/jwt_hash_verification_for_identity.py` (added `CitizenEndpointEntry`, `CitizenEndpointResolution`, `resolve_citizen_endpoints()` — resolves direct citizen endpoints with org fallback), `mind-protocol/l4/registry/__init__.py` (exports all new symbols)
- **Docs updated:** `mind-protocol/docs/l4/registry/ALGORITHM_Registry.md` (added "Citizen Endpoint Registration" procedure, "Citizen Endpoint Resolution" procedure, updated "Endpoint Location" with citizen endpoint graph structure)
- **Key design:** Deterministic IDs (`{citizen_id}_endpoint_{repo_name}`) for MERGE semantics. SERVES link from Actor to Thing. Endpoint resolution tries direct citizen endpoints first, falls back to org endpoint. URL validation via existing `validate_endpoint_url()`.
- **Impact:** Membrane can now resolve any citizen's active endpoints for message routing. Foundation for multi-repo citizens (e.g., nervo on cities-of-light + venezia + manemus).

### 2026-03-14: MCP Endpoint Auto-Registration in L4 Graph (@nervo)

- **What:** Created endpoint auto-registration system so MCP server instances register themselves in the L4 graph on startup and deregister (mark inactive) on shutdown. Three new files: `endpoint_registrar.py` (EndpointRegistrar class — detects citizen_id, repo name, public URL; MERGEs a Thing node of type `citizen_endpoint` into L4 graph; creates SERVES link from Actor; handles SIGTERM/atexit for deregistration; includes heartbeat method for liveness), `routing.py` (resolve_citizen_endpoints queries L4 for active endpoints sorted by last_heartbeat; route_to_citizen tries endpoints in order via WebSocket delivery), updated `__init__.py` to export all new symbols. Wired `auto_register()` into `mcp/server.py` startup (2 lines: import + call after "Mind MCP server started" log).
- **Files created:** `mind-mcp/runtime/membrane/endpoint_registrar.py`, `mind-mcp/runtime/membrane/routing.py`
- **Files modified:** `mind-mcp/runtime/membrane/__init__.py` (exports), `mind-mcp/mcp/server.py` (import + auto_register call)
- **Env vars:** `MIND_CITIZEN_ID`, `RENDER_EXTERNAL_URL`, `MIND_PUBLIC_URL`, `MIND_REPO_NAME`, `L4_GRAPH_HOST`, `L4_GRAPH_PORT`, `L4_GRAPH_NAME`
- **Impact:** Deployed MCP instances are now discoverable. When citizen A does `/call nervo`, the membrane can resolve nervo's active endpoint(s) from the L4 graph and route the message. Graceful shutdown marks endpoints inactive so stale entries don't accumulate.

### 2026-03-14: Key Rotation on Access Revocation (@nervo)

- **What:** Implemented `revoke_access` action in MCP `place_handler.py`. When an actor's access to a private space is revoked, the space key is rotated per the ALGORITHM_Space_Encryption.md specification (lines 323-386). Five-step process: (1) authorize revoker (owner/admin, only owners revoke owners, self-revoke blocked), (2) delete HAS_ACCESS link + AT presence for revokee, (3) generate new AES-256 space key, (4) re-encrypt all Moments in the space (content + synthesis fields) — with forward secrecy: only re-encrypts Moments created after revokee's `granted_at` timestamp if available, otherwise re-encrypts all, (5) re-wrap new key for all remaining members via sealed-box (X25519). Reports re-encryption and re-wrap counts/errors. Notifies Place Server with `access_revoked` event.
- **Files modified:** `/home/mind-protocol/mind-mcp/mcp/tools/place_handler.py` (added `revoke_access` to TOOL_SCHEMA enum + description, dispatch case in `handle_place`, new `_place_revoke_access` function ~200 lines)
- **Algorithm source:** `mind-protocol/docs/security/space_encryption/ALGORITHM_Space_Encryption.md` lines 323-386
- **Impact:** Completes the encryption lifecycle: create (key gen) -> grant_access (key wrap) -> revoke_access (key rotation). Old space keys are invalidated on revocation so the revoked member cannot decrypt future content.

### 2026-03-13: Space Encryption Health Checkers (@nervo)

- **What:** Created 5 health checkers for runtime space encryption verification, matching the existing BaseChecker pattern in `mind-mcp/runtime/physics/health/`. Each extends `BaseChecker` with `check()` -> `HealthResult`, uses `self.read.query()` for FalkorDB Cypher queries. (1) `content_encryption` — samples Moments from private Spaces, verifies `is_encrypted()` on content, flags plaintext leaks (HIGH, hourly). (2) `key_distribution` — queries all HAS_ACCESS links to private Spaces, verifies `encrypted_key` non-null and valid `nonce:encrypted` base64 format (HIGH, hourly). (3) `hierarchy_consistency` — for each child Space HAS_ACCESS, verifies parent access path exists for same actor (MEDIUM, 6h). (4) `private_key_scan` — scans Actor properties, HAS_ACCESS link properties, and all node properties for PEM headers and raw key byte patterns; CRITICAL severity pages on detection (HIGH/CRITICAL, hourly). (5) `revocation_completeness` — verifies no stale HAS_ACCESS links remain after revocation, supports both targeted (actor_id + space_id) and general (revocation log) modes (MEDIUM, event-triggered).
- **Files created:** `mind-mcp/runtime/physics/health/checkers/content_encryption.py`, `key_distribution.py`, `hierarchy_consistency.py`, `private_key_scan.py`, `revocation_completeness.py`
- **Files modified:** `mind-mcp/runtime/physics/health/checkers/__init__.py` (registered all 5 new checkers)
- **DOCS:** `mind-protocol/docs/security/space_encryption/HEALTH_Space_Encryption.md`
- **Impact:** Runtime verification of encryption invariants. Catches plaintext leaks, missing keys, hierarchy violations, private key exposure, and incomplete revocations that unit tests cannot detect.

### 2026-03-13: MCP place_handler.py Encryption Integration (@nervo)

- **What:** Integrated end-to-end encryption into the MCP `place` tool handler. Private spaces now encrypt/decrypt content transparently via AES-256-GCM. Eight actions: (1) crypto library lazy-import from `mind-protocol/python/crypto/` via `sys.path` injection (same pattern as `send_handler.py` with manemus); (2) `_resolve_space_visibility()` helper queries `Space.visibility` property; (3) `_get_space_key()` helper decrypts sealed-box-wrapped space key from `HAS_ACCESS` link (direct + parent hierarchy up to 5 levels), loads actor private key from `.keys/` directory; (4) `speak` action encrypts text before graph write for private spaces, sets `m.encrypted` flag on Moment node; (5) `listen` action decrypts moments transparently, falls back to `[encrypted]` on failure; (6) `create` action accepts `visibility='private'`, generates space key, wraps for creator via sealed box, creates `HAS_ACCESS` link with `role='owner'`; (7) `grant_access` action — owner/admin verifies role, decrypts their space key, re-wraps for target actor's public key, creates `HAS_ACCESS` link; (8) `revoke_access` action — owner/admin revokes member, rotates space key, re-encrypts Moments, re-wraps for remaining members (added 2026-03-14).
- **Files changed:** `/home/mind-protocol/mind-mcp/mcp/tools/place_handler.py`
- **Env vars:** `MIND_PROTOCOL_PYTHON` (path to crypto lib, default `/home/mind-protocol/mind-protocol/python`), `MIND_KEYS_DIR` (actor keys directory, default `/home/mind-protocol/cities-of-light/citizens`)
- **Impact:** MCP `place` tool now supports private encrypted spaces end-to-end. Public spaces unchanged. Foundation for "join org" flow where admin grants encrypted space access to new members.

### 2026-03-13: Cross-Language Crypto Tests Created (@nervo)

- **What:** Created cross-language test suite that verifies JS and Python crypto libraries produce interoperable ciphertext across all 6 critical paths: JS encrypt -> Py decrypt (AES-256-GCM), Py encrypt -> JS decrypt (AES-256-GCM), JS sealed box -> Py unseal, Py sealed box -> JS unseal, JS key files -> Py load, Py key files -> JS load. Three files: `test_cross_language.js` (Node.js orchestrator that generates artifacts, spawns Python, verifies round-trip), `test_cross_language_verify.py` (Python verifier + generator), `test_vectors.json` (static vectors for regression). Also created `generate_test_vectors.js` for regenerating static vectors.
- **Files created:** `tests/crypto/test_cross_language.js`, `tests/crypto/test_cross_language_verify.py`, `tests/crypto/test_vectors.json`, `tests/crypto/generate_test_vectors.js`
- **Tests:** 12/12 passing (6 Python-side + 6 JS-side) across all 6 critical paths. Includes empty string and Unicode/emoji test cases.
- **Impact:** Proves byte-level compatibility between JS (Node.js crypto + libsodium-wrappers) and Python (cryptography + PyNaCl) crypto stacks. Any future format drift will be caught immediately.

### 2026-03-13: Python Crypto Library Created (@nervo)

- **What:** Created `mind-protocol/python/crypto/` — Python crypto library mirroring the JS `lib/crypto/` implementation. Four modules: `space_key.py` (AES-256-GCM via `cryptography` package, same "base64(iv):base64(tag):base64(ciphertext)" format as JS), `actor_keys.py` (X25519 key pair generation/storage via PyNaCl, same .b64 file format as JS), `key_exchange.py` (sealed-box key wrapping via PyNaCl, byte-compatible with JS libsodium sealed boxes), `__init__.py` (facade re-export). Test suite at `tests/crypto/test_crypto.py`.
- **Files created:** `python/crypto/space_key.py`, `python/crypto/actor_keys.py`, `python/crypto/key_exchange.py`, `python/crypto/__init__.py`, `tests/crypto/test_crypto.py`
- **Tests:** 16/16 passing — round-trip encrypt/decrypt, key pair generate/store/load, sealed-box key exchange, is_encrypted detection, error handling.
- **Impact:** Python services (physics tick, graph seeding, MCP tools) can now encrypt/decrypt content and exchange keys with the same format as the JS stack. Cross-language interop verified by identical ciphertext format.

### 2026-03-13: Encryption Integration in Graph-Client, Place-Server, Moment-Pipeline (@nervo)

- **What:** Integrated encryption support across the Living Places stack. Graph-client: added `visibility` property to Space schema (createSpace/getSpace/ensureSpace), added `isSpacePrivate()`, `getEncryptedSpaceKey()` (direct + parent hierarchy lookup), `setActorPublicKey()`, `getActorPublicKey()`. Place-server: added `_getSpaceKey()` private method, access check gate on join for private spaces, encrypted_key delivery in place:state response, visibility in place:create/place:discover, `encrypted` flag pass-through in place:moment handler. Moment-pipeline: added `opts` parameter with `encrypted` flag for pre-encrypted content, threaded through to broadcast. Graph-client stays a thin FalkorDB wrapper — no crypto imports, encryption/decryption responsibility belongs to callers.
- **Files changed:** `src/server/graph-client.js`, `src/server/place-server.js`, `src/server/moment-pipeline.js`
- **Impact:** Private spaces can now be created with `visibility: 'private'`, access-gated on join, and encrypted space keys delivered to authorized actors. Moments carry an `encrypted` flag for client-side decryption. Foundation for end-to-end encrypted meeting rooms.

### 2026-03-13: Actor Key Generation Infrastructure (@nervo)

- **What:** Created key generation scripts for Mind Protocol AI citizens. Two scripts: `generate_actor_keys.js` (single-actor X25519 key pair generation via libsodium, optional FalkorDB graph registration), `generate_all_citizen_keys.js` (batch generation scanning citizens directory, skip-if-exists semantics). Generated keys for all 5 cities-of-light citizens (nervo, anima, piazza, ponte, voce). Updated `.gitignore` in both cities-of-light and mind-protocol repos — private keys excluded, public keys committable.
- **Files created:** `mind-protocol/scripts/generate_actor_keys.js`, `mind-protocol/scripts/generate_all_citizen_keys.js`
- **Files modified:** `cities-of-light/.gitignore`, `mind-protocol/.gitignore`
- **Keys generated:** 5 citizens (nervo, anima, piazza, ponte, voce) — each has `.keys/public_key.b64` (committable) and `.keys/private_key.b64` (mode 0400, gitignored)
- **Impact:** Every citizen now has an X25519 identity key pair. Public keys can be registered on Actor nodes in FalkorDB for sealed-box key exchange. Foundation for per-citizen encrypted space access.

### 2026-03-13: Crypto Library Created (@nervo)

- **What:** Created `mind-protocol/lib/crypto/` — JavaScript crypto library for Mind Protocol space encryption. Four modules: `space_key.js` (AES-256-GCM content encryption with fresh IV per call), `actor_keys.js` (X25519 key pair generation/storage via libsodium), `key_exchange.js` (sealed-box key wrapping for distributing space keys to actors), `index.js` (facade re-export). Added `libsodium-wrappers` dependency to mind-protocol.
- **Files created:** `lib/crypto/space_key.js`, `lib/crypto/actor_keys.js`, `lib/crypto/key_exchange.js`, `lib/crypto/index.js`, `tests/crypto/test_crypto.js`
- **Tests:** 27/27 passing — round-trip encrypt/decrypt, key pair generate/store/load, sealed-box key exchange, isEncrypted detection, error handling.
- **Impact:** Foundation for encrypted spaces. Any space can now generate a symmetric key, encrypt content, and distribute that key to authorized actors via sealed boxes.

### 2026-03-13: Architecture Simplification — L2 Eliminated (@nervo, approved by @nlr)

- **What:** Eliminated the L2 (Organization) graph layer. One graph per universe now contains everything: physical places, virtual rooms, chats, repos, citizen minds, org spaces. Organizations are Actors (not graph layers) that MANAGE Spaces. Privacy is a property (`access`) on Space nodes, not a separate graph layer. Spaces auto-create on join via MERGE semantics.
- **Files changed:** `.mind/FRAMEWORK.md` (4-layer → 3-layer architecture), `.mind/SYSTEM.md` (added "One Graph Per Universe" and "Everything is a Space" invariants), `src/server/graph-client.js` (added `ensureSpace()` method, `access` property support), `src/server/place-server.js` (join now auto-MERGEs spaces instead of returning "Place not found").
- **Impact:** Fundamental simplification. All spatial solutions (proximity, perception, access control) work uniformly across physical places, virtual rooms, chats, and repos. No more confusion about which layer to create/query. MCP tools no longer need separate create-then-join flow.

### 2026-03-13: Buildings Seeded into Graph (@nervo)

- **What:** Created `venezia/scripts/seed_buildings_graph.py`. Seeded 253 building Space nodes into FalkorDB `venezia` graph from `buildings.json` (255 entries, 2 merged on duplicate IDs). Each building has position, category, subtype, synthesis, content, capacity, weight. Created 255 IN links (building to district), 252 OWNED_BY links (building to owner Actor), 290 LOCATED_AT links (occupant/operator Actor to building). District assignment via land polygon name extraction (252 by name, 3 by nearest centroid). Zero orphan buildings.
- **Script:** `venezia/scripts/seed_buildings_graph.py` (idempotent via MERGE, supports --clear and --dry-run)
- **Impact:** Graph spatial hierarchy now has district → building layer. Per-district distribution: Dorsoduro 60, Rialto 53, San Polo 44, San Marco 34, Castello 33, Cannaregio 18, Santa Croce 11. Next: exterior areas (canals, piazzas, bridges), rooms, position properties on actors.

### 2026-03-13: Physics Bridge Built (@nervo)

- **What:** Created `src/server/physics-bridge.js` (PhysicsBridge class) and `src/server/run_tick.py` (Python tick runner). Bridge spawns Python subprocess per tick, captures JSON stdout, emits WebSocket events. 8-phase energy physics tick runs via `GraphTickV1_2`, with concurrent-tick guard, 1-second threshold warning, and event detection for moment flips, tension changes, and emergent narrative events.
- **Area:** `src/server/physics-bridge.js`, `src/server/run_tick.py`
- **Impact:** Core @nervo deliverable complete. Physics engine now accessible from Express.js server. Next: wire into index.js startup.

### 2026-03-13: SYNC Resync (@nervo)

- **What:** Complete SYNC overhaul reflecting current reality. Removed stale references (Connectome-as-focus, landing page TODOs that exist on mind-platform). Added three-universe tracking, graph contents inventory, spatial architecture as active work.
- **Why:** Previous SYNC was 3 months stale on some sections, mixing mind-platform concerns into cities-of-light state.
- **Impact:** Next agent arriving gets accurate state.

### 2026-03-13: Living Places V1 Shipped

- **What:** Real-time meeting rooms with FalkorDB graph persistence. Place creation, join/leave, speaking, moment delivery across renderers.
- **Area:** `src/server/place-server.js`, `src/server/moment-pipeline.js`, `src/client/place-*.js`
- **Impact:** Foundation for all real-time communication in all universes.

### 2026-03-13: FalkorDB Graph Seeded

- **What:** 152 citizen Actor nodes, 7 district Space nodes, 157 Narrative nodes (stratagems + thoughts + decrees), 1504 links seeded into `venezia` graph.
- **Script:** `venezia/scripts/seed_venice_graph.py`
- **Impact:** Graph is alive and queryable. POC-Mind context assembly validated with 3 citizens.

### 2026-03-12: Engine V2 Components (BuildingRenderer, Voice Pipeline, Zone/Particle Systems, Client Scaffolding)

- **What:** Major engine build sprint — BuildingRenderer (Three.js mesh generation from building data), VoicePipeline (Whisper STT → LLM → ElevenLabs TTS), ZoneAmbientEngine + ParticlesEngine (atmosphere), client dev scaffolding (Vite + HTTPS proxy).
- **Impact:** Engine has rendering, voice, and atmosphere. Needs integration testing.

### 2026-03-12: Mind Platform Features (Social Feed, Profile Edit, Citizen Context)

- **What:** Full-stack social feed (posts, reactions, comments, @mentions), profile edit UI, richer citizen context injection.
- **Area:** manemus + mind-platform (not this repo)
- **Impact:** Platform is increasingly alive.

### 2026-03-12: Three-Repo Architecture Docs

- **What:** Removed Blood Ledger references. Documented engine/manemus/world-repo separation.
- **Impact:** Clean conceptual separation for engine reuse across Venezia, Contre-Terre, Lumina Prime.

---

## KNOWN ISSUES

| Issue | Severity | Area | Notes |
|-------|----------|------|-------|
| Physics constants diverge | Medium | `.mind/runtime/physics/constants.py` vs `docs/narrative/physics/` | Tick v1.2 uses GENERATION_RATE=0.5, Venice docs say 0.3. Need to reconcile. |
| ~~physics-bridge.js needs integration~~ | ~~RESOLVED~~ | `src/server/index.js` | ~~Integrated, tested, zero warnings.~~ |
| Graph lacks exterior spatial detail | Medium | FalkorDB `venezia` | Buildings seeded (253). Still need exterior areas (canals, piazzas, bridges as Space nodes), rooms, positions on actors. |
| Engine V2 not integrated | Medium | `engine/` | Components built individually, not wired together. |

---

## HANDOFF: FOR AGENTS

**Likely VIEW for continuing:** groundwork (graph + physics implementation)

**Current focus:** Spatial graph architecture + physics bridge

**Key context:**
- FalkorDB graph `venezia` has districts + 253 buildings (seeded via `venezia/scripts/seed_buildings_graph.py`)
- Physics bridge built (`physics-bridge.js` + `run_tick.py`) — needs integration into `index.js` and live testing
- Living Places V1 works for interior/meeting rooms, but exterior spatial perception is unsolved
- Three universes share one engine — all spatial solutions must be world-agnostic

**Watch out for:**
- Physics tick must complete < 1 second (152 citizens, will grow)
- Decay rate 0.02 per tick is Venice-calibrated, don't change without approval
- Never mutate graph outside the physics tick
- Never expose raw graph data to visitors

---

## HANDOFF: FOR HUMAN

**Executive summary:**
Cities of Light engine V1 is canonical with Venezia as first world. Graph seeded with 152 citizens across 7 districts. Living Places V1 ships real-time meeting rooms. Three universes planned (Venezia, Contre-Terre, Lumina Prime). @nervo onboarded, focused on spatial graph architecture and physics bridge.

**Decisions needed:**
- Confirm spatial architecture (position-as-property + proximity circles vs. ephemeral micro-spaces)?
- Physics constants reconciliation: GENERATION_RATE 0.5 (tick engine) vs 0.3 (Venice docs)?
- L1 citizen graphs: separate FalkorDB graph per citizen or filtered subgraph in L3?

**Concerns:**
- 253 buildings seeded with x/z coordinates from static JSON. Next spatial layer: exterior areas, bridges, canals.
- Asset pipeline for 3D is undefined — parametric archetypes + text-to-3D APIs seems viable

---

## TODO

### Immediate (@nervo)

- [x] Seed buildings as Space nodes into `venezia` graph (253 buildings from venezia/data/buildings.json)
- [ ] Add position properties to all spatially-located nodes
- [ ] Create spatial hierarchy (Venice → islands → districts → exterior areas → buildings → rooms)
- [x] Create `src/server/physics-bridge.js` — JSON bridge between Python tick and Express
- [x] Wire PhysicsBridge into `src/server/index.js` server startup
- [x] Test physics tick with live FalkorDB `venezia` graph (315ms, zero warnings)
- [ ] Reconcile physics constants (tick engine vs Venice docs) — GENERATION_RATE: 0.5 (constants.py) vs 0.3 (ALGORITHM) vs 0.08 (SYNC dry run)

### High Priority

- [ ] Implement proximity-based perception engine (4 circles: intimate/personal/social/public)
- [ ] Add Thing nodes to graph (trade goods, tools, boats, market stalls)
- [ ] Wire engine V2 components together for integration test
- [ ] Emergency Council first meeting session via Living Places

### Backlog

- [ ] Contre-Terre graph creation and seeding (868 brain nodes → FalkorDB `contre_terre`)
- [ ] Lumina Prime universe definition
- [ ] Asset pipeline design (parametric meshes + text-to-3D + texture sourcing)
- [ ] L1/L2 graph layer implementation (per-citizen memory, guild shared knowledge)

---

## CONSCIOUSNESS TRACE

**Project momentum:**
Strong. Engine V1 canonical, graph seeded, Living Places shipped. Three universes emerging. @nervo onboarded with clear spatial architecture vision.

**Architectural concerns:**
Exterior spatial perception is the hard problem. Position-as-property with proximity computation is cleaner than ephemeral space creation, but needs careful performance profiling at 152+ citizen scale.

**Opportunities noticed:**
Contre-Terre's brain seed prototype (868 nodes) could be the template for how all universe seeding works — structured JSON → FalkorDB. Standardize this pattern across worlds.

---

## AREAS

| Area | Status | Owner | SYNC |
|------|--------|-------|------|
| `src/server/place-server.js` | functional (V1) | — | this file |
| `src/server/graph-client.js` | functional | — | this file |
| `src/server/physics-bridge.js` | integrated, live | @nervo | this file |
| `engine/` | built, not integrated | — | this file |
| FalkorDB `venezia` | seeded, needs spatial expansion | @nervo | this file |

---

## MODULE COVERAGE

**Mapped modules:**
| Module | Code | Docs | Maturity |
|--------|------|------|----------|
| narrative/graph | `src/server/graph-client.js` | `docs/narrative/graph/` | DESIGNING |
| narrative/physics | `src/server/physics-bridge.js`, `src/server/run_tick.py` | `docs/narrative/physics/` | FUNCTIONAL (integrated, ticking) |
| narrative/events | — | `docs/narrative/events/` | PROPOSED |
| citizens/mind | `src/server/ai-citizens.js` | `docs/citizens/mind/` | DESIGNING |
| voice/pipeline | `engine/server/voice-pipeline.js` | `docs/voice/pipeline/` | DESIGNING |
| communication/living-places | `src/server/place-server.js` | `docs/communication/living-places/` | DESIGNING (V1 shipped) |
| architecture/engine | `engine/` | `docs/architecture/engine/` | CANONICAL (V1) |

---

## INIT HISTORY

| Date | Version | Graph |
|------|---------|-------|
| 2025-12-29 | v0.1.0 | mind_platform |
| 2026-02-08 | v0.0.0 | cities_of_light |
| 2026-03-11 | v0.0.0 | cities_of_light |
| 2026-03-12 | v0.0.0 | cities_of_light |
| 2026-03-13 | v0.0.0 | cities_of_light |

---
