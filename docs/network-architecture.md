# Cities of Light — Quest-Native Multiplayer Architecture

> Networking spec for Unity + Photon Fusion + Photon Voice.
> Server-authoritative world, AI citizens server-side, compressed state to clients.

---

## 1. Network Topology

```
                        ┌─────────────────────────┐
                        │    Photon Cloud Region   │
                        │   (Fusion Shared Mode)   │
                        │                          │
                        │  ┌───────────────────┐   │
                        │  │   Session Master   │   │
                        │  │  (StateAuthority)  │   │
                        │  │                    │   │
                        │  │  World State       │   │
                        │  │  Island Registry   │   │
                        │  │  AI Tick Runner    │   │
                        │  │  Voice Router      │   │
                        │  └───────┬───────────┘   │
                        │          │                │
                        │    ┌─────┴─────┐          │
                        │    │  Interest  │          │
                        │    │  Manager   │          │
                        │    └─────┬─────┘          │
                        │     ┌────┼────┐           │
                        │     │    │    │           │
                        └─────┼────┼────┼───────────┘
                              │    │    │
                    ┌─────────┘    │    └─────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ Quest 3   │  │ Quest 3   │  │ Desktop  │
              │ Client A  │  │ Client B  │  │ Spectator│
              │           │  │           │  │          │
              │ Island:   │  │ Island:   │  │ Roaming  │
              │ The Agora │  │ The Garden│  │ overview │
              └──────────┘  └──────────┘  └──────────┘
```

### Architecture: Photon Fusion Shared Mode

**Why Shared Mode (not Host/Client):**
- No player is host — avoids single-point-of-failure when a Quest goes to sleep
- Photon Cloud handles relay; `StateAuthority` objects live on the cloud plugin
- AI citizens need a persistent tick source — can't depend on a player being "host"

**Dedicated Server Plugin (Photon custom plugin or Fusion Dedicated Server):**
- Runs the AI citizen tick loop (5s wander, proximity speech triggers)
- Owns all `NetworkObject` instances with `StateAuthority` for world state
- Clients have `InputAuthority` only for their own avatar
- Plugin connects to external LLM endpoint (your existing Express server) via HTTP for AI speech

### Interest Management

Each island is an **Area of Interest (AOI) group**. Clients only receive state updates for:
1. **Their current island** — full fidelity (positions at 10Hz, hands at 30Hz, voice)
2. **Adjacent islands** (from `waypoints[]`) — low-fidelity (positions at 2Hz, no hands, no voice)
3. **Distant islands** — zero updates (only population count)

This cuts bandwidth ~70% vs. naive broadcast.

```
Interest Groups:
  island        → Full state    (10Hz pos, 30Hz hands, voice, AI speech)
  island:lod1   → Reduced state (2Hz pos, no hands, no voice)
  island:count  → Metadata only (citizen count per island)
```

### Connection Flow

```
Client Boot
  │
  ├─► Photon: ConnectToRegion("us") → Session join
  │
  ├─► Fusion: SpawnPlayer(avatar) with InputAuthority
  │
  ├─► Server: AssignIsland(startIsland="island") → subscribe to AOI group
  │
  ├─► Voice: JoinVoiceChannel(islandId) → spatial voice group
  │
  └─► State: Receive initial snapshot (island objects, AI positions, permissions)
```

---

## 2. World State Model

### Networked State Objects (Fusion `[Networked]` properties)

```csharp
// ─── World Root ─────────────────────────────────────────
[Networked] public struct WorldState : INetworkStruct
{
    public int           Tick;            // Server tick counter
    public float         ServerTime;      // Monotonic seconds
    public int           TotalCitizens;   // Global population
    public NetworkBool   EventActive;     // World-wide event flag
}

// ─── Island State ───────────────────────────────────────
[Networked] public struct IslandState : INetworkStruct
{
    public NetworkString<_16> IslandId;        // "island", "archive", "garden", "agora", "bassel"
    public NetworkString<_32> OwnerPlayerId;   // PlayerRef or empty
    public byte               PermissionFlags; // See §3
    public byte               CitizenCount;    // Current occupants
    public byte               AICitizenCount;  // AI citizens present
    public float              AtmosphereStress;// Aggregate biometric mood (0-1)
    public int                Seed;            // Procedural gen seed
    public NetworkBool        Locked;          // Owner can lock island
}

// ─── Citizen (Human) ────────────────────────────────────
[Networked] public struct CitizenState : INetworkStruct
{
    public PlayerRef              Owner;
    public NetworkString<_16>     Name;
    public NetworkString<_16>     CurrentIsland;
    public Vector3                Position;      // Quantized, see below
    public Quaternion             Rotation;      // Compressed smallest-three
    public byte                   VoiceChannel;  // Current voice group
    public NetworkBool            IsSpectator;
    public byte                   AnimState;     // 0=idle, 1=walk, 2=talk, 3=teleporting
}

// ─── Citizen (AI) ───────────────────────────────────────
[Networked] public struct AICitizenState : INetworkStruct
{
    public NetworkString<_16>     CitizenId;     // "vox", "lyra", "pitch"
    public NetworkString<_16>     CurrentIsland;
    public Vector3                Position;
    public Quaternion             Rotation;
    public byte                   Shape;         // 0=icosahedron, 1=octahedron, 2=torusknot
    public int                    Color;         // Packed RGBA
    public byte                   Action;        // 0=idle, 1=wandering, 2=speaking
    public float                  BobPhase;      // Vertical oscillation phase
    public NetworkString<_64>     LastUtterance;  // For subtitle display
}
```

### Compression Budget

| Data | Raw | Compressed | Method |
|------|-----|-----------|--------|
| Position | 12B (3×float) | 6B | Half-float (±500m range, 1.5cm precision) |
| Rotation | 16B (quaternion) | 4B | Smallest-three, 10-bit per component |
| Hands (25 joints×2) | 600B | 150B | Delta from last frame + half-float |
| Voice (20ms frame) | 640B | 80B | Opus @ 32kbps |

**Per-citizen bandwidth (same island):** ~2.4 KB/s at 10Hz position
**Per-citizen bandwidth (adjacent island):** ~0.12 KB/s at 2Hz, positions only
**Quest 3 total budget:** <50 KB/s upload, <200 KB/s download (comfortable on Wi-Fi 6)

### State Persistence

Photon Fusion state is ephemeral (lives during session). Persistent world state stored externally:

```
┌──────────────┐     HTTP/REST      ┌──────────────────┐
│ Fusion Plugin │ ◄──────────────► │  Persistence API  │
│ (in-session)  │                   │  (your Express    │
│               │    on disconnect  │   server or       │
│  IslandState  │ ─── save ──────► │   Supabase)       │
│  Ownership    │                   │                   │
│  AI memory    │ ◄── load ──────  │  Tables:          │
│               │    on session     │   islands         │
│               │    start          │   ownership       │
└──────────────┘                   │   ai_memory       │
                                   │   spatial_events  │
                                   └──────────────────┘
```

**What persists across sessions:**
- Island ownership + permission flags
- AI citizen conversation histories (10-turn windows)
- Spatial events (who visited where, what was said)
- Island customization state (if owners can modify terrain)

**What resets:**
- Citizen positions (respawn at home island)
- AI citizen positions (respawn at home zone center)
- Voice channel assignments
- Transient animations

---

## 3. Island Ownership Schema

### Permission Model

```
PermissionFlags (byte):
  bit 0: PUBLIC_ENTER     — anyone can enter (default on)
  bit 1: PUBLIC_SPEAK      — anyone can speak (default on)
  bit 2: PUBLIC_BUILD      — anyone can place objects (default off)
  bit 3: INVITE_ONLY       — only allowlisted players enter
  bit 4: AI_RESIDENTS      — AI citizens can wander here (default on)
  bit 5: VOICE_MODERATED   — owner must approve voice (default off)
  bit 6: RESERVED
  bit 7: RESERVED
```

### Ownership Lifecycle

```
                claim (first visitor)
  UNCLAIMED ──────────────────────────► OWNED
                                          │
                          ┌───────────────┤
                          │               │
                   transfer(newOwner) lock/unlock
                          │               │
                          ▼               ▼
                       OWNED          LOCKED
                    (new owner)    (no entry without
                                    allowlist)
                          │
                     abandon()
                          │
                          ▼
                      UNCLAIMED
```

### Data Model (Persistence)

```sql
CREATE TABLE island_ownership (
    island_id       TEXT PRIMARY KEY,  -- "island", "archive", etc.
    owner_id        TEXT,              -- Photon PlayerRef or platform user ID
    owner_name      TEXT,
    claimed_at      TIMESTAMP,
    permission_flags SMALLINT DEFAULT 0b00010011,  -- PUBLIC_ENTER + PUBLIC_SPEAK + AI_RESIDENTS
    allowlist       TEXT[],            -- Player IDs for INVITE_ONLY
    metadata        JSONB              -- Custom island name, description, etc.
);
```

### Default Island Assignments

| Island | Default State | Reasoning |
|--------|--------------|-----------|
| The Island | Nicolas (pre-claimed) | Origin island, founder's home |
| Bassel | Memorial (unclaimed, permanent) | In memory of Bassel — cannot be claimed |
| The Archive | UNCLAIMED | Contemplation space, first-come |
| The Garden | UNCLAIMED | Growth space, first-come |
| The Agora | PUBLIC (no ownership) | Gathering square — always open, never lockable |

**Bassel's island** is special: `MEMORIAL` flag (not in the byte — stored in metadata). No claiming, no locking. AI citizens can visit. Visitors can leave spatial memories (voice recordings anchored to coordinates).

### Permission Enforcement

```
Client sends: EnterIsland(islandId)
  │
  Server checks:
  ├─► island.Locked && !allowlist.contains(player) → REJECT "Island locked"
  ├─► island.INVITE_ONLY && !allowlist.contains(player) → REJECT "Invite only"
  ├─► island.CitizenCount >= MAX_PER_ISLAND (20) → REJECT "Island full"
  └─► ALLOW → subscribe to AOI group, move player
```

---

## 4. AI Embodiment Protocol

### Server-Side AI Loop

AI citizens run entirely on the server plugin. Clients only see the networked state — they never run AI logic.

```
┌─────────────────────────────────────────────────────┐
│              Fusion Server Plugin                     │
│                                                       │
│  ┌─────────────┐     ┌──────────────────────────┐    │
│  │ AI Tick      │     │  External LLM Endpoint   │    │
│  │ (FixedUpdate │     │  POST /ai/respond         │    │
│  │  every 5s)   │────►│  { citizen, transcript,   │    │
│  │              │     │    context, position }     │    │
│  │  Wander      │◄────│  → { text, emotion,       │    │
│  │  Proximity   │     │       action }             │    │
│  │  Speech      │     └──────────────────────────┘    │
│  └──────┬──────┘                                      │
│         │                                             │
│         │  Updates [Networked] AICitizenState          │
│         │  (position, rotation, action, utterance)     │
│         │                                             │
│         │  Fusion auto-replicates to clients           │
│         ▼                                             │
│  ┌─────────────┐                                      │
│  │ TTS Trigger  │──► Voice Channel injection           │
│  │ (via Photon  │    (AI speech → spatial audio        │
│  │  Voice API)  │     at citizen's position)           │
│  └─────────────┘                                      │
└─────────────────────────────────────────────────────┘
```

### AI Citizen State Machine

```
            ┌──────────┐
     ┌──────│  IDLE    │◄──── cooldown expired, no humans nearby
     │      └────┬─────┘
     │           │ tick (5s)
     │           ▼
     │      ┌──────────┐
     │      │ WANDERING │◄──── pick target within wanderRadius
     │      └────┬─────┘      lerp position 0.1×moveSpeed/tick
     │           │
     │           │ human speaks within 15m
     │           ▼
     │      ┌──────────┐
     │      │ LISTENING │──── buffer transcription
     │      └────┬─────┘
     │           │ LLM response received
     │           ▼
     │      ┌──────────┐
     └──────│ SPEAKING  │──── TTS plays, subtitle broadcast
            └──────────┘     10s cooldown starts
```

### AI → Client Rendering Contract

Server sends **only** the `AICitizenState` struct. Client is responsible for:

```csharp
// Client-side AI citizen renderer (no AI logic here)
void RenderAICitizen(AICitizenState state)
{
    // 1. Geometry: instantiate shape from state.Shape enum
    // 2. Material: emissive color from state.Color, pulse on state.Action==SPEAKING
    // 3. Position: smooth interpolation toward state.Position (client-side lerp)
    // 4. Bob: sin(Time + state.BobPhase) * 0.3 on Y axis
    // 5. Rotation: slow spin (0.5 rad/s body, -0.3 ring)
    // 6. Subtitle: if state.LastUtterance changed, show floating text
    // 7. Glow ring: opacity pulse when SPEAKING
}
```

### AI Citizens Per-Zone

| Citizen | Home Zone | Wander Radius | Speed | Personality Kernel |
|---------|-----------|---------------|-------|--------------------|
| VOX | The Agora | 8m | 0.8 | Language, syntax, precision |
| LYRA | The Garden | 7m | 0.6 | Patterns, metaphor, nature |
| PITCH | The Island | 9m | 1.0 | Connection, questions, warmth |

AI citizens **can** follow a human across islands (triggered by sustained conversation >3 turns), but always drift back to home zone when idle for >60s.

### Cross-Island AI Migration

```
Human on Garden speaks to PITCH (home: Island)
  │
  If conversation.turns >= 3 AND human teleports to Garden:
    PITCH.targetIsland = "garden"
    PITCH walks to nearest waypoint → teleport transition
    PITCH.CurrentIsland = "garden"
    PITCH subscribes to Garden AOI group
    │
  If idle for 60s (no conversation):
    PITCH.targetIsland = "island" (home)
    PITCH walks to waypoint → teleport home
```

---

## 5. Voice Channel Design

### Architecture: Photon Voice 2 with Spatial Audio

```
┌───────────────────────────────────────────────────┐
│                  Voice Topology                     │
│                                                     │
│  Per-Island Voice Group (spatial)                   │
│  ┌──────────────────────────────────┐               │
│  │  Island: "agora"                 │               │
│  │                                  │               │
│  │   [Nicolas] ◄──3D──► [VOX]      │               │
│  │       │                          │               │
│  │       ├──3D──► [Other Human]     │               │
│  │       │                          │               │
│  │   Spatial falloff: 15m           │               │
│  │   Codec: Opus 32kbps             │               │
│  │   Frame: 20ms                    │               │
│  │   HRTF: Quest native             │               │
│  └──────────────────────────────────┘               │
│                                                     │
│  Cross-Island Whisper Channel (non-spatial)          │
│  ┌──────────────────────────────────┐               │
│  │  Direct P2P between friends      │               │
│  │  Opus 24kbps mono                │               │
│  │  Distance-independent            │               │
│  └──────────────────────────────────┘               │
└───────────────────────────────────────────────────┘
```

### Channel Assignment

```
Voice Group IDs:
  0 = island      (spatial, 3D)
  1 = bassel      (spatial, 3D)
  2 = archive     (spatial, 3D)
  3 = garden      (spatial, 3D)
  4 = agora       (spatial, 3D)
  100+ = whisper  (direct, mono, non-spatial)
```

### Spatial Voice Parameters

```csharp
public class SpatialVoiceConfig
{
    public float MaxDistance     = 15f;    // Full attenuation at 15m
    public float MinDistance     = 1f;     // No attenuation within 1m
    public float RolloffFactor  = 1.5f;   // Inverse-square with mild falloff
    public bool  UseHRTF        = true;   // Quest native HRTF
    public int   SampleRate     = 24000;  // 24kHz sufficient for voice
    public int   FrameSize      = 480;    // 20ms at 24kHz
    public int   Bitrate        = 32000;  // 32kbps Opus
}
```

### AI Citizen Voice Injection

AI citizens don't have a microphone — they inject synthesized audio into the voice stream:

```
AI Speech Pipeline:
  1. Server: LLM generates text response
  2. Server: POST to TTS endpoint (ElevenLabs / OpenAI TTS)
  3. Server: Receive PCM audio stream
  4. Server: Encode to Opus frames (match Photon Voice format)
  5. Server: Inject frames into island voice group
     with source position = AI citizen's world position
  6. Clients: Receive as spatial audio from AI's location
```

**Key constraint:** AI voice injection requires a **server-side Photon Voice sender**. This is a virtual AudioSource registered in the voice group, positioned at the AI citizen's coordinates. Photon Voice 2 supports this via `VoiceConnection.CreateLocalVoice()` on the server plugin.

### Voice During Teleport

```
Player teleports Island → Garden:
  Frame 0:  Leave voice group 0 (island)
  Frame 1:  Teleport transition (1s fade-to-black, no voice)
  Frame 2:  Join voice group 3 (garden)
  Frame 3:  Spatial audio active in new zone

Voice is MUTED during the 1s transition to prevent:
  - Hearing island voices at garden distances
  - Audio pops from sudden position change
```

### Voice Moderation (Owner Controls)

If `VOICE_MODERATED` flag is set on an island:
```
New citizen enters moderated island:
  → Joins voice group in LISTEN-ONLY mode
  → Owner gets notification: "[Name] wants to speak"
  → Owner approves → citizen switched to SEND+RECEIVE
  → Owner denies → citizen stays listen-only
```

---

## 6. Failure Modes

### F1: Quest Goes to Sleep Mid-Session

```
Trigger:  User removes headset, Quest enters standby
Impact:   Player's NetworkObject goes stale
Response:
  - Fusion: 10s timeout → PlayerLeft callback
  - Server: Citizen marked AWAY, avatar fades to ghost (50% opacity)
  - 60s timeout → Citizen despawned, position saved to persistence
  - On resume: if within 120s, restore position. Otherwise, respawn at home island.
```

### F2: Photon Cloud Region Failure

```
Trigger:  Photon region becomes unreachable
Impact:   All clients in region lose connection
Response:
  - Clients: Fusion auto-reconnect with region fallback (us → eu → asia)
  - Reconnect: re-download full state snapshot from new region's session
  - AI citizens: server plugin restarts tick loop, reloads last persisted state
  - Voice: Photon Voice auto-migrates to same fallback region
Risk:     ~5s blackout. World state may roll back to last persistence checkpoint.
Mitigation: Checkpoint every 30s (not just on disconnect).
```

### F3: AI LLM Endpoint Timeout

```
Trigger:  External LLM API (GPT-4o) takes >5s or errors
Impact:   AI citizen "freezes" in LISTENING state
Response:
  - 5s timeout → AI citizen plays fallback idle animation
  - 3 consecutive failures → AI citizen enters DORMANT state (stops responding)
  - Fallback chain: GPT-4o → Claude haiku → canned response pool
  - Canned responses per citizen (10 pre-written lines matching personality)
  - Recovery: next successful LLM call exits DORMANT
```

### F4: TTS Endpoint Failure

```
Trigger:  ElevenLabs / OpenAI TTS unavailable
Impact:   AI citizen has text but no voice
Response:
  - Display subtitle only (LastUtterance field still updates)
  - Client renders speech bubble with text
  - Fallback: local on-device TTS (Quest 3 has system TTS API)
  - Quality degrades but conversation continues
```

### F5: Island at Capacity (20 citizens)

```
Trigger:  21st player tries to enter island
Impact:   Entry denied
Response:
  - Client receives REJECT with reason "Island full"
  - UI shows: "The [Island Name] is full (20/20). Try again or visit another island."
  - Offer teleport to least-populated island
  - Queue system (optional): wait list, notify when slot opens
```

### F6: Ownership Dispute (Concurrent Claims)

```
Trigger:  Two players claim unclaimed island on same server tick
Impact:   Race condition on ownership
Response:
  - Server-authoritative: first `ClaimIsland` RPC processed wins
  - Fusion tick ordering is deterministic — no true race
  - Second claimant gets: "This island was just claimed by [Name]"
  - Mitigation: 1s claim animation gives server time to replicate
```

### F7: Desync (Client Prediction Divergence)

```
Trigger:  Client predicts position that server rejects (e.g., teleport through locked island)
Impact:   Player appears to "rubber-band"
Response:
  - Fusion built-in: server state overwrites client prediction
  - Smooth correction: lerp to server position over 200ms (not snap)
  - If >5m divergence: instant snap + screen flash (indicates major desync)
  - Log desync events for anti-cheat analysis
```

### F8: Network Partition Between Islands

```
Trigger:  One AOI group's updates stop arriving
Impact:   Adjacent island appears frozen
Response:
  - Client: if no updates from adjacent island for 5s, show "shimmer" effect
  - After 15s: hide adjacent island citizens (assume stale)
  - Reconnect: request full snapshot for that AOI group
  - Local island unaffected (separate interest group)
```

---

## 7. Rollback-Safe Implementation Order

Each phase is independently deployable and testable. No phase depends on a later phase. Each phase has a **rollback procedure** that reverts to the previous working state.

```
Phase 1          Phase 2          Phase 3          Phase 4          Phase 5
Single Island    Multi-Island     AI Citizens      Voice            Ownership
───────────►     ───────────►     ───────────►     ───────────►     ───────────►
  2 weeks          2 weeks          2 weeks          1 week           1 week

  Rollback:        Rollback:        Rollback:        Rollback:        Rollback:
  N/A (baseline)   Disable AOI,     Remove AI        Disable Voice,   Remove ownership
                   single group     spawner,         text-only chat   checks, all
                                    clients ignore                    islands public
                                    AI state
```

### Phase 1: Single-Island Fusion Prototype

**Goal:** One island, basic multiplayer, no AI, no voice.

```
[ ] Unity project setup (URP, Quest 3 target, Fusion SDK)
[ ] NetworkRunner + Fusion SharedMode session join
[ ] Player prefab: NetworkObject + NetworkTransform + XR Rig
[ ] Hand tracking sync: [Networked] joint arrays (25×2 hands)
[ ] Spawn on The Island (position 0,0)
[ ] Remote avatar rendering (head + body + name label)
[ ] Disconnect handling (10s timeout → despawn)
[ ] Basic lobby UI (enter name → join)
```

**Rollback:** This IS the baseline. No rollback needed.
**Test:** Two Quest 3 headsets on same Wi-Fi, see each other, positions sync.

### Phase 2: Multi-Island + AOI + Teleport

**Goal:** All 5 islands rendered, interest management, waypoint teleport.

```
[ ] Import zone definitions (port src/shared/zones.js → ScriptableObject)
[ ] Procedural island generation (port buildCompleteIsland per zone config)
[ ] Zone-specific vegetation (crystals/columns/flowers/palms)
[ ] Zone ambient system (fog lerp, particle systems, hemisphere light)
[ ] AOI interest groups per island (Fusion AreaOfInterest)
[ ] Waypoint beacons (emissive pillars at zone.waypoints positions)
[ ] Teleport interaction (grip beacon → fade → move → subscribe new AOI)
[ ] Adjacent island LOD (2Hz updates, silhouette rendering)
[ ] Server: zone tracking (detectNearestZone on position update)
[ ] Server: teleport validation (permission check before allowing move)
```

**Rollback:** Remove AOI grouping, load only island_0 island. Single `NetworkAreaOfInterestGroup`.
**Test:** Teleport between all 5 islands. Verify citizens on other islands invisible when distant, visible when adjacent.

### Phase 3: AI Citizens

**Goal:** VOX, LYRA, PITCH wander their zones and respond to speech.

```
[ ] AICitizenState NetworkObject (server-authoritative)
[ ] Server plugin: AI tick loop (5s wander, position broadcast)
[ ] Server plugin: HTTP bridge to LLM endpoint (/ai/respond)
[ ] Client: AI citizen renderer (shape geometry, emissive material, bob, spin)
[ ] Client: subtitle display on LastUtterance change
[ ] Server: proximity detection (15m range, check after STT)
[ ] Server: LLM call with citizen personality + conversation history
[ ] Server: 10s speech cooldown, one-at-a-time queue
[ ] Server: fallback chain (GPT-4o → Claude haiku → canned)
[ ] Client: speaking animation (glow pulse, ring expansion)
```

**Rollback:** Server stops spawning AI `NetworkObject`s. Clients already ignore unknown objects. Zero client changes needed.
**Test:** Stand near VOX in The Agora, speak. Verify subtitle appears, AI responds within 3s.

### Phase 4: Spatial Voice

**Goal:** Positional voice chat per island, AI voice injection.

```
[ ] Photon Voice 2 integration (VoiceConnection + Recorder + Speaker)
[ ] Per-island voice groups (channel ID = island index)
[ ] Spatial audio config (HRTF, 15m falloff, 32kbps Opus)
[ ] Voice channel switch on teleport (leave old, join new, 1s mute gap)
[ ] Server: AI voice injection (virtual AudioSource per AI citizen)
[ ] Server: TTS → Opus encode → inject into voice group at AI position
[ ] Client: voice activity indicator on avatars (glow pulse when speaking)
[ ] Fallback: if Voice connection fails, text-only mode (subtitle overlay)
```

**Rollback:** Disable `VoiceConnection.Connect()`. All communication via text subtitles (already working from Phase 3). Voice is additive.
**Test:** Two players on same island hear each other spatially. AI citizen voice comes from correct 3D position.

### Phase 5: Island Ownership + Permissions

**Goal:** Claim islands, set permissions, allowlists.

```
[ ] Persistence API: island_ownership table (Supabase or Express endpoint)
[ ] Server: load ownership on session start, save on change
[ ] Claim interaction: approach unclaimed island beacon → hold grip 3s → claimed
[ ] Owner panel UI (wrist menu): toggle permission flags
[ ] Server: permission enforcement on EnterIsland RPC
[ ] Locked island: force field visual (translucent dome, reject message)
[ ] Allowlist management: owner can invite by player name
[ ] Bassel island: MEMORIAL flag, cannot be claimed
[ ] The Agora: PUBLIC flag, cannot be owned
[ ] Voice moderation: owner toggles, new entrants listen-only until approved
```

**Rollback:** Remove permission checks from `EnterIsland`. All islands revert to public. Ownership data stays in DB but is ignored.
**Test:** Claim The Garden, lock it, verify another player cannot enter. Unlock, verify they can.

---

## Appendix A: Transport Between Islands

### Three Transport Modes

```
1. TELEPORT (instant)
   Trigger: Grip waypoint beacon for 1s
   Visual:  Screen fade to black (0.5s) → reposition → fade in (0.5s)
   Network: Leave AOI group → server validates → join new AOI group
   Voice:   Mute during transition

2. BOAT (scenic, 15-20s)
   Trigger: Step onto dock platform at island shore
   Visual:  Auto-pilot boat follows spline between islands
   Network: Player in TRANSIT state — visible to both origin + destination islands
   Voice:   Connected to neither island group (silence during travel)
   Purpose: Immersion, scenic route, lets player see the archipelago

3. BRIDGE (walking, specific pairs)
   Trigger: Walk onto bridge connecting adjacent islands
   Visual:  Physical bridge geometry (glowing translucent path)
   Network: Player subscribes to BOTH islands' AOI during crossing
   Voice:   Crossfade between island voice groups (50m blend zone)
   Pairs:   Island↔Agora, Garden↔Archive (short distances only)
```

### Boat Spline System

```
Dock at Island shore
  │
  Player steps on → boat spawns
  │
  Bezier spline: origin dock → midpoint (elevated, ocean view) → dest dock
  │
  Player locked to boat transform (no locomotion)
  Camera free-look enabled
  │
  Arrival: boat docks → player steps off → boat despawns
  │
  Network: origin island sends citizen_transit(dest)
           dest island receives citizen_arriving(origin)
```

---

## Appendix B: Message Types (Fusion RPCs + Networked State)

```
Client → Server RPCs:
  JoinSession(name, persona)          → spawn player, assign island
  ClaimIsland(islandId)               → attempt ownership
  SetPermission(islandId, flags)      → owner only
  RequestTeleport(targetIsland)       → permission check + move
  RequestBoat(targetIsland)           → spawn boat + spline
  SendVoiceTranscript(audioBase64)    → STT pipeline trigger

Server → Client (via [Networked] state changes):
  WorldState.*                        → tick, server time, event flags
  IslandState.*                       → ownership, permissions, population
  CitizenState.*                      → positions, rotations, anim states
  AICitizenState.*                    → AI positions, actions, utterances

Server → Client RPCs:
  RPC_TeleportConfirm(targetIsland, spawnPos)
  RPC_PermissionDenied(islandId, reason)
  RPC_AISpeak(citizenId, audioClipId, subtitleText)
  RPC_WorldEvent(eventType, data)
```

---

## Appendix C: Quest 3 Performance Budget

| Component | Triangles | Draw Calls | Notes |
|-----------|-----------|------------|-------|
| Current island (full detail) | 15K | 12 | Terrain + vegetation + shore |
| Adjacent islands (LOD1) | 2K × 2 | 4 | Simplified silhouette |
| Distant islands (LOD2) | 200 × 2 | 2 | Billboard sprites |
| Water plane | 2K | 1 | Single quad + shader |
| Sky + stars | 1K | 2 | Skybox + particle |
| AI citizens (3) | 600 | 6 | Shape + ring + light |
| Waypoint beacons (4 per island) | 1.6K | 4 | Cylinder + ring |
| Human avatars (up to 10 same island) | 5K | 20 | Head + body + hands |
| Particles (zone ambient) | points | 1 | GPU instanced |
| **Total** | **~30K** | **~52** | Target: <100K tri, <100 DC |

**Headroom:** 70K triangles and 48 draw calls of budget remaining for future content (buildings, objects, decorations).

**Frame target:** 72fps (Quest 3 native), 90fps stretch goal with ASW.
