# VALIDATION: Living Places

```
STATUS: DESIGNING
PURPOSE: What must be true for shared-space communication to work
UPDATED: 2026-03-13
CHAIN: OBJECTIVES → PATTERNS → BEHAVIORS → ALGORITHM → VALIDATION → HEALTH → IMPLEMENTATION → SYNC
```

---

## Chain

```
OBJECTIVES:      ./OBJECTIVES_Living_Places.md
PATTERNS:        ./PATTERNS_Living_Places.md
BEHAVIORS:       ./BEHAVIORS_Living_Places.md
THIS:            VALIDATION_Living_Places.md (you are here)
ALGORITHM:       ./ALGORITHM_Living_Places.md
HEALTH:          ./HEALTH_Living_Places.md
IMPLEMENTATION:  ./IMPLEMENTATION_Living_Places.md
SYNC:            ./SYNC_Living_Places.md
```

---

## Purpose

**Validation = what we care about being true.**

Not mechanisms. Not test paths. Not how things work.

What properties, if violated, would mean Living Places has failed its purpose as a universal communication substrate?

---

## Invariants

### I1: Protocol Universality (CRITICAL)

**MUST:** The same Space node, Moment schema, and presence mechanism work across ALL renderers (web, VR, MCP, CLI, headless).

**NEVER:** Renderer-specific fields in the core Moment schema. No "web_only" or "vr_only" properties in the protocol layer.

**Why:** If the protocol diverges per renderer, we're building N separate communication systems instead of one. The whole architecture depends on renderer-agnosticism.

**Verification:** Same Moment produced by web human and AI citizen. Both parse identically. VR renderer consumes same Moment as web renderer.

---

### I2: AI-Human Indistinguishability (CRITICAL)

**MUST:** At the protocol level, AI citizens and human participants produce identical Moment structures.

**NEVER:** A protocol-level flag that marks a Moment as "from AI" or "from human." The Actor node has this metadata; the Moment doesn't.

**Why:** If the protocol treats AI and human differently, we've built two systems. Renderers may DISPLAY them differently (avatar vs webcam), but the protocol is uniform.

**Verification:** Strip actor metadata from a Moment. It should be impossible to tell if AI or human produced it from the Moment alone.

---

### I3: Real-Time Delivery (CRITICAL)

**MUST:** Text Moments delivered to all participants within 500ms. Voice round-trip (human speaks → AI responds via TTS) within 5 seconds.

**NEVER:** Moments silently dropped. If delivery fails, the sender must be notified.

**Why:** Real-time communication that isn't real-time is worse than async messaging. Latency kills conversation.

**Verification:** Measure: timestamp of Moment creation → timestamp of WebSocket delivery to furthest participant. Assert < 500ms for text.

---

### I4: Presence Accuracy (HIGH)

**MUST:** Participant list reflects actual connections. AT links in graph match in-memory room state.

**NEVER:** Ghost participants (AT link exists but connection is dead). Phantom departures (connection exists but AT link removed).

**Why:** False presence breaks trust. If you think someone is listening and they're not, or vice versa, communication fails.

**Verification:** Periodic reconciliation (every 30s): compare graph AT links with WebSocket connections. Prune mismatches.

---

### I5: Persistence Integrity (HIGH)

**MUST:** Every Moment created in a place is persisted as a graph node. The conversation is searchable and replayable.

**NEVER:** Moments exist only in the WebSocket stream without graph persistence.

**Why:** Conversations produce knowledge. A meeting that isn't recorded didn't happen (for the graph). AI citizens' memories depend on persisted Moments.

**Verification:** After a conversation, query graph for all Moments in the Space. Count must match the Moment Pipeline's creation count.

---

### I6: Capacity Enforcement (HIGH)

**MUST:** Place capacity is enforced. If capacity is 7, the 8th participant is rejected or queued.

**NEVER:** Capacity silently exceeded (creates resource exhaustion, degrades experience for all).

**Why:** Capacity is a design property of the space, not an arbitrary limit. A tavern that seats 20 shouldn't hold 200.

**Verification:** Attempt join at capacity → receive rejection message. Participant count never exceeds capacity.

---

### I7: Access Control (HIGH)

**MUST:** Private places are invisible and inaccessible to non-invitees. Invite-only places are discoverable but not joinable without invitation.

**NEVER:** Presence data leaked for private places (participant count, activity level, or existence).

**Why:** Privacy. Some conversations are confidential. The graph physics of the place should not leak to non-participants.

**Verification:** Query place discovery as non-invited actor. Private places must not appear in results.

---

### I8: Ambient Context Consistency (MEDIUM)

**MUST:** All AI citizens in the same place receive the same ambient context (atmosphere, participant list, recent history).

**NEVER:** One AI citizen perceives a formal council chamber while another perceives a casual tavern for the same Space.

**Why:** Consistent ambient context produces coherent conversation. If AIs perceive different environments, they'll respond incoherently.

**Verification:** Log ambient context for two AI citizens in the same place at the same tick. Assert identical.

---

### I9: Graceful Degradation (MEDIUM)

**MUST:** If Whisper/ElevenLabs/LLM is unavailable, the place still functions for text communication.

**NEVER:** Voice failure crashes the room or disconnects participants.

**Why:** External API dependencies will fail. Text is the backbone. Voice is an enhancement.

**Verification:** Kill TTS service. Verify text Moments still flow. Voice Moments fall back to text-only display.

---

### I10: Spatial Attenuation Correctness (MEDIUM — V3)

**MUST:** Sound attenuation follows inverse-square law. Volume = 0 at distance > HEARING_RADIUS.

**NEVER:** All participants hear all Moments at full volume regardless of position (defeats the purpose of spatial).

**Verification:** Place two participants at varying distances. Measure delivered volume. Assert inverse-square relationship.

---

## Invariant Index

| ID | Name | Priority | Version |
|----|------|----------|---------|
| I1 | Protocol Universality | CRITICAL | V1 |
| I2 | AI-Human Indistinguishability | CRITICAL | V1 |
| I3 | Real-Time Delivery | CRITICAL | V1 |
| I4 | Presence Accuracy | HIGH | V1 |
| I5 | Persistence Integrity | HIGH | V1 |
| I6 | Capacity Enforcement | HIGH | V1 |
| I7 | Access Control | HIGH | V1 |
| I8 | Ambient Context Consistency | MEDIUM | V1 |
| I9 | Graceful Degradation | MEDIUM | V1 |
| I10 | Spatial Attenuation Correctness | MEDIUM | V3 |

---

## Priority

| Priority | Meaning | If Violated |
|----------|---------|-------------|
| **CRITICAL** | System purpose fails | Communication unusable |
| **HIGH** | Major value lost | Degraded severely — trust or persistence broken |
| **MEDIUM** | Partial value lost | Works but experience is worse |

---

## Markers

<!-- @mind:todo Map each invariant to specific health checkers in HEALTH_Living_Places.md -->
<!-- @mind:proposition Add V11: Message Ordering — Moments arrive in creation order per room -->
<!-- @mind:escalation I2 (AI-Human Indistinguishability): should renderers be ALLOWED to show "AI" badges? Protocol says no flag, but UX might want transparency -->
