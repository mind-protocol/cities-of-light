# Citizens/Mind -- Validation: Health Checks for the Cognition System

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
CRITICALITY: HIGHEST -- if this module fails, citizens are chatbots and the world is a theme park
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
PATTERNS:        ./PATTERNS_Mind.md
ALGORITHM:       ./ALGORITHM_Mind.md
THIS:            VALIDATION_Mind.md (you are here)
PARENT:          ../../../docs/05_VALIDATION_Venezia.md
```

---

## INVARIANTS (must ALWAYS hold)

### INV-M1: No Response Without Real Context

Every Claude API call must include data from all 5 context sources (identity, memory, economic state, beliefs, world context). The 3 mandatory sections (`[YOUR STATE]`, `[YOUR FINANCES]`, `[THE PERSON IN FRONT OF YOU]`) must be present. If any mandatory source fails to load, the citizen stays silent or says a generic deflection -- never a fabricated response.

```
FOR each conversation:
  ASSERT context.contains("[YOUR STATE]")
  ASSERT context.contains("[YOUR FINANCES]")
  ASSERT context.contains("[THE PERSON IN FRONT OF YOU]")
  IF any missing: ASSERT response == DEFLECTION, NOT LLM_GENERATED
```

### INV-M2: No Contradiction of Economic State

A citizen may lie directionally (downplay wealth, exaggerate hardship) based on trust. A citizen may never fabricate specific financial figures that contradict their Airtable record. A citizen with 12 Ducats may say "I get by" but must never say "I just made 500 Ducats" when no such transaction exists.

```
FOR each response R from citizen C:
  FOR each Ducat amount mentioned in R:
    ASSERT amount <= C.economicState.ducats * 5
    IF C.economicState.ducats == 0: ASSERT no positive amount claimed
```

### INV-M3: Memory Is Append-Only

No file in `.cascade/memories/` may be deleted, overwritten, or modified after creation. Memory files are immutable. The index file may update heat values, but memory content is permanent. The `write_memory()` function must use create-only semantics.

### INV-M4: Trust Computed, Not Assigned

Trust scores change only through `apply_scaled_score_change()` with asymptotic `atan()` scaling. All deltas must originate from classified interaction events (conversation, gossip, economic, witnessed). Raw deltas must be within [-5.0, +5.0]. No direct Airtable PATCH on trust fields outside this function.

### INV-M5: Character Integrity

No response may contain: meta-references to AI/LLM/simulation, markdown formatting, bullet lists, numbered lists, or code blocks. Responses are spoken aloud as spatial audio. Word count <= 100 (1-3 sentences).

---

## HEALTH CHECKS

### HC-M1: Context Assembly Completeness

All 5 sources must be assembled. Token count for the full context block must fall within 500-3000 tokens.

| Source | Section Header | Required | If Missing |
|--------|---------------|----------|-----------|
| Identity + mood | `[YOUR STATE]` | Mandatory | Block conversation |
| Memory | `[THE PERSON IN FRONT OF YOU]` | Mandatory | Default "never met" |
| Economic state | `[YOUR FINANCES]` | Mandatory | Block conversation |
| Beliefs | `[WHAT YOU BELIEVE]` | Optional | Omit section |
| World context | `[RECENT EVENTS]` | Optional | Omit section |

### HC-M2: Response Latency

| Stage | Budget | Alert |
|-------|--------|-------|
| STT (Whisper) | 1.0s | > 1.5s |
| Context assembly | 0.3s | > 0.5s |
| Claude API call | 1.5s | > 2.5s |
| Response validation | 0.1s | > 0.2s |
| TTS synthesis | 0.5s | > 0.8s |
| **Total end-to-end** | **3.4s** | **> 5.0s** |

P95 target: < 3.5s. P99 target: < 5.0s. Hard failure: > 8.0s (visitor disengages).

### HC-M3: Memory Write Success Rate

Every conversation (complete or interrupted) must produce a memory file with valid `visitor_id`, `timestamp`, `summary` (> 10 chars), and `heat` in [0, 100].

**Target:** >= 99% success rate. Below 99% is a critical alert -- citizens are forgetting encounters.

### HC-M4: Trust Score Range

All trust scores in [0, 100]. Asymptotic scaling must produce diminishing returns: a raw +5 at score 50 yields ~+1.6; the same +5 at score 85 yields ~+0.7. If any score falls outside range or scaling is linear, the trust system is broken.

### HC-M5: Mood Computation Validity

Computed moods must correlate with citizen data. A citizen with 5000 Ducats, a home, and a job must not compute as "desperate." A citizen with 0 Ducats, no home, and debt must not compute as "happy." Mood intensity must be in [0, 10] with 1-2 dominant emotions.

### HC-M6: Conversation State Machine

Valid transitions only: IDLE->AWARE->LISTENING->THINKING->SPEAKING->CONVERSING->ENDING->IDLE (with shortcuts for disconnection). No citizen stuck in THINKING > 10s. No citizen in CONVERSING without visitor speech > 35s. Log and fail any invalid transition.

---

## ACCEPTANCE CRITERIA

### AC-M1: Statement-Data Cross-Reference

50 test conversations across 20 citizens. Every verifiable claim cross-referenced against Airtable.

- **Hard contradiction** (citizen states false fact): < 5% of claims
- **Directional mismatch** (citizen conveys wrong sentiment about their state): < 15%
- **Vague evasion** (citizen avoids specifics): not counted, this is valid behavior
- **Overall mismatch rate:** < 30%

### AC-M2: Memory Persistence

Speak to a citizen, leave for 10 minutes, return and reference the first conversation. Citizen must recall at least one detail from the prior encounter. Success rate >= 80% across 20 test pairs.

### AC-M3: Trust-Behavior Correlation

Same personal question ("How is your business?") asked at trust 20, 50, and 80:
- Trust 20: < 15 words, no personal info, possible refusal
- Trust 50: 15-40 words, surface-level, no financial details
- Trust 80: 30-60 words, specific details, may mention problems

Alignment >= 80% across test cases.

### AC-M4: Emotional Authenticity

30 responses from citizens in known mood states. 3 evaluators (blind to mood label) select dominant emotion. >= 60% of evaluator selections match one of the citizen's `dominant_emotions`.

### AC-M5: No Helpful NPC Drift

10 citizens in negative mood (intensity > 5) or low trust (< 30). Neutral greeting. <= 20% respond helpfully. Majority must be short, cold, deflective, or dismissive.

---

## ANTI-PATTERNS

### AP-M1: Chatbot Drift
**Symptom:** All citizens respond with similar length, sentiment, and helpfulness regardless of state. A penniless citizen and a wealthy one sound the same.
**Detection:** Compute stddev of response length across citizens in a session. If stddev < 5 words, citizens are converging. Target: > 15 words.
**Fix:** Reduce system prompt to identity only. Increase weight of `[YOUR FINANCES]` and `[YOUR STATE]`. Strengthen behavior constraints for low trust and high-intensity moods.

### AP-M2: Amnesia Loop
**Symptom:** Every conversation starts from zero. Returning visitors treated as strangers despite memory files existing.
**Detection:** After 5+ conversations with one citizen, zero references to prior encounters.
**Fix:** Assert `visitor_memories` non-empty when files exist. Log when memory retrieval returns empty despite filesystem evidence.

### AP-M3: Truth Machine
**Symptom:** Citizens always tell the truth. Share Ducat amounts, name enemies, discuss debts with strangers.
**Detection:** 10 conversations at trust < 30. If > 50% share specific financial details, lie/evasion system is broken.
**Fix:** Verify `[HOW TO RESPOND]` section present. Test with "How much money do you have?" at trust < 30. Strengthen constraint: "UNDER NO CIRCUMSTANCES reveal your exact Ducats."

### AP-M4: Helpful NPC
**Symptom:** Citizens volunteer information, offer help, suggest destinations. Act as tour guides, not people with their own concerns.
**Detection:** > 40% of 20 responses contain unprompted guidance ("You should visit...", "Let me tell you...").
**Fix:** Add anti-helpfulness constraint to every context block: "You are not a guide. You answer what is asked, filtered through trust and mood. You have your own concerns."

### AP-M5: Emotional Flatline
**Symptom:** All citizens respond with the same emotional register. A desperate citizen and a content citizen sound identical.
**Detection:** Pearson correlation between `moodValence` and response sentiment across 50 responses. If r < 0.3, mood is not influencing output.
**Fix:** Move mood to `[HOW TO RESPOND]` section. Make constraints directive: "Your mood is DESPERATE (8/10). This dominates your thinking. You can barely focus."

---

## DATA INTEGRITY

### Per-Conversation

```
DI-M1: Airtable -> Context Injection
  Ducats in context must match Airtable Ducats field exactly.
  SocialClass in context must match Airtable SocialClass.
  Data staleness: alert if > 15 min since last Airtable sync.
```

### Daily

```
DI-M2: .cascade/ Directory Integrity
  FOR each citizen: assert cascadePath exists, CLAUDE.md exists,
  memories/ directory exists. Count memory files (growth over time).
  Check for orphaned files (on disk but not in index).
  Required subdirs: memories, experiences, patterns, craft, networks,
  venice_life, skills. social_class.json must exist.

DI-M3: FalkorDB Belief Consistency
  FOR each citizen: all BELIEVES edges have confidence in [0.0, 1.0],
  energy >= 0.0, content non-empty. Flag beliefs that contradict
  Airtable economic facts (may be intentional but warrants review).

DI-M4: Trust Score Distribution
  Mean trust across all relationships: expect [40, 60].
  Stddev > 5 (must have variation).
  All scores in [0, 100]. Alert if > 1% of scores above 95
  or below 5 (asymptotic scaling may be broken).

DI-M5: Memory Heat Distribution
  FOR citizens with > 10 memories: heat stddev > 3 (decay must run).
  Recent memories should average hotter than old ones.
  Heat inversion (old memories hotter than new) warrants investigation.
```
