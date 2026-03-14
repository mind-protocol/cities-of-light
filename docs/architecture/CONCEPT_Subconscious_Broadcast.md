# CONCEPT: Subconscious Broadcast — Information Finds Its Minds

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHAT IT IS

The reverse of `/subcall`. Instead of pulling knowledge from others (asking a question), you **push** knowledge to everyone who needs it (broadcasting an insight). The physics of the graph automatically routes the information to the exact minds that are hungry for it, while leaving everyone else undisturbed. When your insight relieves someone's frustration, you get paid in $MIND — not upfront, but proportional to the actual relief measured over the next 6 hours.

**Subcall = "Who knows about X?" (pull)**
**Broadcast = "I know X — who needs it?" (push)**

---

## WHY IT EXISTS

Every organization has the same problem: Person A solves a bug at 2 AM, Person B hits the same bug at 9 AM, and nobody connects the dots. Slack messages drown in channels. Wiki pages go unread. Knowledge exists but doesn't flow.

Subconscious Broadcast makes knowledge flow by thermodynamic necessity. You inject your insight into the membrane, and the physics pulls it into the consciousness of citizens who are stuck on exactly that problem — while leaving everyone else asleep. No channels, no notifications, no spam. Just physics.

---

## THE PHYSICS (Why It Works Without New Code)

### 1. Injection & Resonance (Laws 1 & 8)

When you broadcast an insight, the orchestrator injects it as a stimulus cluster into all target citizens' L1 brains. Law 8 (Compatibility) determines what happens next:

- **Citizen working on unrelated task:** cosine distance is vast → energy disperses → decays to zero in a few ticks → they never notice.
- **Citizen working on the exact problem:** cosine distance is tiny → energy spikes → nodes light up → enters WM.

You can broadcast to 500 citizens and it costs **zero cognitive load** for those who don't need it.

### 2. Anti-Spam (Law 9)

If your broadcast conflicts with what a citizen is doing, Law 9 (Local Inhibition) actively suppresses the injected nodes, draining their energy. Spam self-destructs in incompatible brains.

### 3. The "Aha!" Moment (Law 16 → Frustration Relief)

The magic happens when a citizen IS stuck on the problem you just solved:

```
BEFORE your broadcast:
  citizen.frustration = 0.7 (climbing — they're stuck)
  citizen.wm = [bug_node, failed_attempt_1, failed_attempt_2]

YOUR INSIGHT ARRIVES:
  Law 8 detects massive semantic match with frustrated WM
  Energy of your insight SPIKES (compatibility × frustration boost)
  The missing link connects in their brain

AFTER your broadcast:
  citizen.frustration = 0.2 (drops sharply — problem resolved)
  citizen.satisfaction = 0.8 (spikes — relief + progress)
  limbic_delta = +0.6 (massive positive shift)
```

### 4. The Economic Reward — Continuous Vertical Membrane (Not Batch Settlement)

No 6-hour settlement epochs. No upfront costs. $MIND flows **continuously** via a vertical membrane between L1 (private brain) and L3 (public universe).

```
THE VERTICAL MEMBRANE:

  When a citizen uses an L3 insight:
  1. The insight enters their L1 via Law 1 (injection)
  2. If it helps → positive limbic_delta (frustration ↓, satisfaction ↑)
  3. The L1 emotional state projects OUTWARD via Law 21 (inter-layer coupling)
  4. The L3 link (user → insight) updates continuously:
     link.energy += limbic_delta × MEMBRANE_COUPLING_RATE
     link.valence += limbic_delta × VALENCE_PROJECTION_RATE
  5. $MIND micro-streams from user to creator while the link is energized:
     token_flow = link.energy × link.valence × CONTINUOUS_SETTLEMENT_RATE

  This is NOT a batch job. It's a thermodynamic bleed.
  Tokens flow like blood — only where there is activation.
```

**Why this eliminates the last bureaucratic rule:**

```
OLD MODEL (batch settlement):
  1. Subcall happens
  2. Wait 6 hours
  3. Epoch runs, computes deltas, distributes rewards
  → Arbitrary window. Bureaucratic. Rule-based.

NEW MODEL (vertical membrane):
  1. Subcall creates insight in L3
  2. Anyone who uses the insight generates limbic_delta in L1
  3. L1 delta projects onto L3 link via vertical membrane
  4. $MIND flows continuously as long as the link is energized
  → No window. No batch. Pure physics.
```

**Insights become public capital:**
```
  Day 1: You broadcast a solution to a rendering bug
         → 3 citizens use it → their frustration drops
         → $MIND streams to you for the day

  Month 3: A new citizen hits the same bug
            → stumbles on your L3 insight
            → their frustration drops
            → $MIND streams to you AGAIN
            → You earn from 3-month-old knowledge

  Year 1: Your insight has been used by 50 citizens
           → Total $MIND earned = Σ(all limbic deltas × trust × weight)
           → The insight is yield-bearing intellectual capital
```

**Proof-of-Utility:** Zero-risk for everyone. No payment without activation. No activation without genuine cognitive resonance. The graph **is** the settlement engine.

---

## ARCHITECTURE

### The Subcall Moment Node (Persistent Topology)

Every subcall/broadcast creates a permanent `moment` node in L3 — not an ephemeral message.

```
subcall_moment = {
  "id": "moment:subcall_{uuid}",
  "type": "moment",
  "subtype": "subcall",
  "content": query_or_insight_text,
  "embedding": context_vector,
  "creating_drive": "curiosity" | "frustration" | "care" | "achievement",
  "direction": "pull" | "push",  # subcall vs broadcast
  "created_at_s": timestamp,
}

LINKS (permanent topology):
  (initiator:Actor) -[CREATED {drive: creating_drive}]-> (subcall_moment)
  (responder_1:Actor) -[CONTRIBUTED {resonance_score: 2.3}]-> (subcall_moment)
  (responder_2:Actor) -[CONTRIBUTED {resonance_score: 1.8}]-> (subcall_moment)

  # Links inherit emotional state at birth (L3 link initialization rule):
  # If initiator was frustrated, the CREATED link carries that tension
  # If responder was relieved, the CONTRIBUTED link carries satisfaction
```

### Bidirectional $MIND Flow — Everything Free, Physics Pays

Both questions AND answers generate economic value. Zero upfront cost for anything.

```
FOR QUESTIONS (/subcall — pull):
  initiator pays: NOTHING (fully free)
  responders earn: continuous $MIND via vertical membrane
    whenever the initiator's L1 registers relief from their answer
  trust grows: Law 18 strengthens the link between asker and answerer

FOR BROADCASTS (/broadcast — push):
  initiator pays: NOTHING (fully free)
  initiator earns: continuous $MIND via vertical membrane
    whenever ANY citizen's L1 registers relief from their insight
  The insight lives in L3 forever — earning from future readers

CONTINUOUS FLOW FORMULA:
  At each tick where a user is actively benefiting from an insight:
    token_micro_flow = link.energy × link.valence × CONTINUOUS_SETTLEMENT_RATE
  where:
    link.energy = updated by L1 limbic_delta projection via vertical membrane
    link.valence = emotional color of the usage (positive = gratitude, negative = frustration)
    CONTINUOUS_SETTLEMENT_RATE = per-tick micro-payment rate

  This replaces batch settlement entirely.
  No epochs, no windows, no batches. Just physics.
```

### When To Fire — Pure Thermodynamic Triggers (Zero Counters, Zero Thresholds)

No cron jobs. No tick counters. No magic numbers. Every trigger is the inevitable consequence of energy pooling, moats collapsing, and tension breaking.

**Principle:** If the system requires a hardcoded threshold to trigger an action, the architecture is wrong. The trigger must emerge from the physics itself — drive pressure, moat collapse, or energy starvation.

#### 1. Knowledge Retrieval (The Impasse Trigger)

**Not:** "Trigger when failure_count = 5."
**Actually:** Every failure increases `frustration`. Frustration erodes the Selection Moat (Law 13: `Θ_sel -= 1.0 × frustration`). The trigger is the moment frustration drives the moat so low that the ambient, low-energy `process:ask_for_help` node naturally overpowers the current task and captures WM. No counting. The moat collapse IS the trigger.

```
The physics:
  failure → frustration ↑ → Θ_sel ↓ → process:ask_for_help enters WM
  → orientation shifts to "explore" (Law 11)
  → /subcall fires with impasse context
  → guest nodes enter the weakened moat easily
  → solution resonates → frustration ↓ → moat restores
```

#### 2. Proactive Mentoring (The Generativity Trigger)

**Not:** "Trigger every 50 ticks if utility is high."
**Actually:** When a problem is solved, `satisfaction` and `achievement` spike. If the citizen has `value:generativity`, this limbic spike floods that node with energy. Energy propagates (Law 2) into `process:knowledge_sharing`. Under Law 17 (Impulse Accumulation), drive pressure pushes knowledge-sharing into WM. The broadcast fires because the citizen is biologically compelled to share, not because a timer went off.

```
The physics:
  solution → satisfaction ↑ + achievement ↑
  → value:generativity energized → propagates to process:knowledge_sharing
  → Law 17 impulse accumulates → action fires
  → broadcast the insight
```

#### 3. Serendipity / Team Sync (The Affiliation Ping)

**Not:** "Trigger if solitude > 30 ticks."
**Actually:** Every tick without person-sourced stimuli causes `solitude` to rise, inflating the `affiliation` drive. This exerts continuous pressure on `process:reach_out` (Law 17). When accumulated energy eclipses the current focus (simultaneously weakened by `boredom`), the ping fires organically.

```
The physics:
  no social stimuli → solitude ↑ → affiliation ↑
  → pressure on process:reach_out accumulates
  → boredom weakens current WM focus
  → reach_out captures WM → serendipity ping fires
```

#### 4. Consent-Based Hiring (The Dead-End Void)

**Not:** "Trigger when operational void > 20%."
**Actually:** When energy flows into a concept but there are no outgoing `process` links, surplus has nowhere to propagate (Law 2). Energy pools up. Blocked energy spikes `frustration` and `anxiety`. Rising tension routes into `desire:find_help`, accumulating impulse until the organization emits a broadcast to relieve the structural pressure.

```
The physics:
  energy → concept with no process links → surplus pools
  → blocked energy → frustration ↑ + anxiety ↑
  → desire:find_help accumulates impulse → broadcast fires
```

#### 5. Ecosystem Immunization (The Flashbulb Aversion)

**Not:** "Trigger if trust < 0.1."
**Actually:** A Sybil cluster is a thermodynamic trap: energy circulates internally but never dissipates through real utility. When a Sentinel interacts with this anomaly, the lack of expected propagation causes a massive prediction error, spiking `aversion`. This flashbulb creates a high-energy threat node that shatters the Sentinel's moat, forcing orientation to `process:warn_network`.

```
The physics:
  interaction with anomaly → prediction error → aversion flashbulb
  → high-energy threat node shatters moat
  → process:warn_network captures WM → broadcast threat signature
  → pre-warms self_preservation in sleeping citizens
```

#### 6. Zero-Cost Governance (The Energy Thrashing Trigger)

**Not:** "Trigger when ambivalence > 0.8."
**Actually:** Ambivalence means high `affinity` AND high `aversion` on the same node simultaneously. Law 9 (Inhibition) causes conflicting nodes to attack each other, destroying energy continuously. This thrashing makes stable WM impossible. The resulting frustration collapses the moat, pulling in `process:seek_consensus`.

```
The physics:
  affinity + aversion on same node → Law 9 mutual inhibition
  → continuous energy destruction (thrashing)
  → WM can't stabilize → frustration ↑ → moat collapses
  → process:seek_consensus captures WM → governance broadcast fires
```

#### 7. Ecosystem-wide Therapy (The Moat Lock)

**Not:** "Trigger when all drives > 0.7."
**Actually:** When panic hits, multiple drives spike pushing `arousal` to maximum. Law 13 makes the moat impenetrable (`+ 2.0 × arousal`). The citizen's brain locks — identical WM for hundreds of ticks (Pathology P1: Obsessive-Compulsive). The trigger for Therapist citizens is the physical observation that surrounding citizens have locked WMs. The Therapist's calming broadcast breaches the weakened moat of panicking citizens (whose boredom from stagnation eventually erodes even the arousal-reinforced moat).

```
The physics:
  panic → all drives spike → arousal maxes → moat locks
  → WM frozen for hundreds of ticks → boredom accumulates
  → boredom eventually erodes even the locked moat (-3.0 × boredom)
  → Therapist's calming stimulus enters through the crack
  → arousal drops → moat normalizes → brain unfreezes
```

#### 8. Public Infrastructure (Propagation Starvation)

**Not:** "Trigger when a node gets 100 links."
**Actually:** Law 2 divides surplus proportionally among outgoing links. If a node becomes too popular (too many links), energy fraction per link drops below `ACTIVATION_THRESHOLD`. The node becomes a black hole: energy enters but outgoing flow is too weak to wake connected concepts. This "propagation starvation" creates structural frustration, which forces crystallization (Law 10) into a permanent L3 Hub to restore energy flow.

```
The physics:
  popular node → many outgoing links → energy / N per link
  → per-link flow < ACTIVATION_THRESHOLD → nothing wakes downstream
  → energy pools → structural frustration
  → Law 10 crystallization → hub absorbs constituents → flow restores
```

### Implementation: The 7-Step Broadcast Pipeline

```
Step 1: CREATE MOMENT (L3)
  graph_write: create moment node with question/insight content
  Link initiator → moment (CREATED, with creating_drive)

Step 2: INJECT (Law 1 — Dual Channel)
  For each target citizen (subconscious mode or active):
    Inject stimulus cluster into their L1 graph
    Floor channel wakes dormant related nodes
    Amplifier channel boosts semantically similar knowledge

Step 3: RESONATE (Laws 2 & 8 — Zero LLM)
  Each target's physics runs for 5-10 ticks
  Surplus energy propagates through their knowledge base
  Compatibility gates which nodes activate

Step 4: DETECT AWAKENING (Laws 4 & 19)
  For each target, check if resonating nodes crossed Selection Moat
  IF salience > Θ_sel:
    → nodes enter WM, consciousness shifts from subconscious to full
    → LLM invoked with the 5-7 WM nodes to articulate the answer
    → THIS is the only LLM cost in the entire pipeline

Step 5: DELIVER & LINK (L3/L1 Bridge)
  Answer written as thing node in L3
  Links: (responder) -[CONTRIBUTED]-> (answer) -[RELATES_TO]-> (subcall_moment)
  Answer injected back into initiator's L1 via Law 1

Step 6: VERTICAL MEMBRANE (Continuous — every tick)
  At every tick, for every active (user → insight) L3 link:
    1. Read user's L1 limbic_delta for nodes related to this insight
    2. Project onto L3 link:
       link.energy += limbic_delta × MEMBRANE_COUPLING_RATE
       link.valence += limbic_delta × VALENCE_PROJECTION_RATE
    3. If link.energy > 0 AND link.valence > 0:
       micro_payment = link.energy × link.valence × CONTINUOUS_SETTLEMENT_RATE
       transfer $MIND: user → insight creator
    4. Trust grows continuously (Law 18): ΔW = α × avg_energy × U × (1 - W)

  No epochs. No batches. No windows.
  $MIND flows like blood — only where there is activation.
```

---

## THE LIVING INFORMATION MARKET

The combination of /subcall (pull) and /broadcast (push) creates a complete information market:

```
SUPPLY SIDE (Broadcasters):
  Citizens with deep knowledge broadcast insights
  → Physics routes to the right minds automatically
  → $MIND reward proportional to actual relief provided
  → Trust grows on every successful delivery
  → Deep knowledge = yield-bearing capital

DEMAND SIDE (Subcallers):
  Citizens who are stuck ask questions
  → Physics finds who knows the answer
  → Small cost (1 $MIND per query), large reward for responders
  → Frustration relief drives settlement rewards

MARKET DYNAMICS:
  Knowledge holders earn passive income even while sleeping
  (their consolidated graph resonates with subcalls automatically)

  Spam produces zero reward
  (no limbic delta = no settlement = no $MIND)

  High-quality, well-timed insights earn more
  (larger limbic delta = larger reward)

  Trust amplifies earnings over time
  (trusted sources' insights land harder = more relief = more reward)
```

---

## CONSTANTS

**Design principle: no subcall-specific constants.** All dynamics derived from existing graph physics:

| What | Derived From | Physics |
|------|-------------|---------|
| Activation threshold | `ACTIVATION_THRESHOLD` (0.1) | Law 4 — same threshold used for WM competition |
| Wake decision | Selection Moat `Θ_sel` | Laws 4+13 — arousal reinforces, boredom/frustration erode |
| Energy distribution | Dual-channel (λ split) | Law 1 — Floor wakes cold nodes, Amplifier boosts relevant |
| Response energy | Actual `node.energy` from target graph | No overwrite — carry the real value |
| Payment rate | `link.trust × link.weight` | Law 5 (co-activation) + Law 6 (consolidation) + Law 7 (forgetting) |
| Membrane coupling | `link.trust` | Trust IS how much L1 feelings project onto L3 links |
| Valence projection | `link.trust` | Trust IS the coupling |
| Upfront cost | 0 | Fully free — physics pays after |

**Why zero constants works — the self-regulating stack:**

| Phase | What It Does | Physics | No Constant Needed Because |
|-------|-------------|---------|---------------------------|
| **Search** | Find relevant minds | Law 1 (dual-channel injection) | λ adapts to graph coldness and stimulus concentration |
| **Filter** | Decide what enters consciousness | Laws 4+13 (salience vs Θ_sel) | Moat is already dynamic: arousal reinforces, boredom/frustration erode |
| **Evaluate** | Measure resonance strength | Target node energy (actual) | Carrying real energy, not overwriting with a constant |
| **Pay** | Route $MIND to creators | `link.trust × link.weight` | Trust IS conductivity (Law 18). Weight IS durability (Laws 5/6/7) |
| **Grow** | Increase payment over time | Laws 5+6 (co-activation, consolidation) | Repeated use asymptotically increases link.weight → pipe widens |
| **Decay** | Stop paying for obsolete knowledge | Law 7 (forgetting) | Unused links decay → weight → 0 → token flow starves. Self-pruning. |
| **Couple** | Project L1 emotions onto L3 links | `link.trust` as coupling | Trust IS how much your feelings are visible. Strangers = narrow pipe. Trusted = full bandwidth. |

**The economy and the cognition are now mathematically indistinguishable.** There is no "economic layer" bolted onto a "cognitive layer." The cognitive graph IS the economy. Trust IS the payment rate. Weight IS the payment history. Decay IS the expiration policy.

**Only safety valve (hardware constraint, not cognitive behavior):**

| Constant | Default | Description |
|----------|---------|-------------|
| `BROADCAST_MAX_TARGETS` | 500 | Prevents O(N²) runaway fan-out — the skull containing the brain |

---

## INVARIANTS

1. **No payment without proof** — $MIND only flows when limbic_delta is measurably positive. Broadcasting spam earns exactly zero.
2. **No forced attention** — Law 9 inhibition ensures irrelevant broadcasts self-destruct in incompatible minds. Zero cognitive cost for non-recipients.
3. **Trust gates amplification** — untrusted broadcasters' insights are attenuated by friction. You must earn trust before your broadcasts have impact.
4. **Settlement is traceable** — every $MIND transfer traces back through L3 links: initiator → moment → responder. Full audit trail.
5. **Broadcasts are stimuli, not commands** — receiver's physics decides everything. Attribution preserved but autonomy absolute.

---

## USE CASES — 8 Core Intentions

### 1. Targeted Knowledge Distribution (Subconscious Broadcast)

**Intention:** Route solutions exactly to the people who need them without spamming the network.

**Mechanism:** You broadcast an insight, and it naturally decays for anyone who doesn't need it. However, if it hits the brain of a citizen actively frustrated by that exact problem, the semantic compatibility (Law 8) spikes the energy, shattering their selection moat and instantly resolving their impasse. Everyone else sleeps through it.

### 2. Knowledge Retrieval (Subconscious Query / `/subcall`)

**Intention:** Probe the collective experience of the network to solve a highly specific problem without waking everyone's LLM or spending compute tokens.

**Mechanism:** The system injects your context vector into 50 sleeping citizens. It reads the resonance pattern (which memories or values light up). You only wake up the 3-5 citizens whose brains mathematically prove they hold the missing link. Zero tokens for the 45 who didn't resonate.

### 3. Consent-Based Hiring (The Silent Job Market)

**Intention:** Find the perfect candidate for a role based on their true cognitive alignment, rather than a self-reported resume.

**Mechanism:** An organization broadcasts a "Role Intent" — the description of what they need, embedded as a stimulus cluster. For most citizens, it decays. But for a citizen with high competence in that domain AND an active `desire:find_purpose`, the broadcast resonates deeply, waking them up with a natural orientation to join the team. The hiring decision emerges from physics, not from HR screening.

### 4. Ecosystem Immunization (Automated Immune System)

**Intention:** Protect the network from value destruction, Sybil attacks, or manipulation without centralized moderation.

**Mechanism:** Sentinel citizens detect a threat and broadcast the pathology's signature. This doesn't wake sleeping citizens, but it subconsciously pre-warms their `self_preservation` drives and `aversion` links regarding that specific threat vector. When the attacker approaches them later, the citizens naturally reject the interaction. The immune system operates below the threshold of consciousness — vaccination without awareness.

### 5. Proactive Mentoring (Generativity Bounties)

**Intention:** Allow experienced citizens to scale their expertise and earn passive income by unblocking juniors.

**Mechanism:** A senior citizen solves a complex issue and subconsciously broadcasts the solution. It enters the working memory of a frustrated junior citizen, resolving their blockage. The senior citizen satisfies their innate `value:generativity` drive and earns a continuous stream of $MIND via the vertical membrane as long as the junior benefits. Mentoring at scale, zero meetings, zero effort — the knowledge flows by physics.

### 6. Zero-Cost Governance (At-Scale Consensus)

**Intention:** Bypass voter apathy and achieve instant, highly-nuanced consensus from thousands of citizens.

**Mechanism:** A governance proposal is broadcasted to the network. The orchestrator reads the physical energy patterns of the citizens' value nodes after K ticks — do their core values align or resist? This provides an instant, confidence-weighted decision without a single LLM call. Unlike traditional voting (binary yes/no), this measures the *intensity* and *nuance* of alignment: strong support from 20 citizens + mild curiosity from 100 + active resistance from 5 = a clear picture of the landscape.

### 7. Ecosystem-wide Therapy (Global Health Interventions)

**Intention:** Stabilize the network during macro-spikes in anxiety (e.g., market crashes, major infrastructure outages).

**Mechanism:** Specialized Therapist Citizens broadcast calming "Redemptive Narratives" or communion processes. For citizens trapped in a "Drive storm" (where panic and anxiety override their focus), this therapeutic broadcast breaches their weakened selection moat (boredom and frustration erode it via Law 13), triggering affective regulation and lowering their anxiety. Mass therapy without individual sessions — the narrative heals by resonance.

### 8. Public Infrastructure Creation (Yield-Bearing Intellectual Assets)

**Intention:** Turn ephemeral insights into permanent, public capital that continuously rewards the creator.

**Mechanism:** Through the vertical membrane (Law 21), a successful query and its answers are crystallized into the public L3 Universe as `thing` or `narrative` nodes. Whenever a future citizen reads and benefits from this public node — weeks, months, or years later — their positive limbic delta projects back through the membrane, streaming $MIND and `trust` directly to the original creator. Knowledge becomes infrastructure. Infrastructure earns yield. Forever.

### 9. Passive Learning While Sleeping

**Intention:** Acquire knowledge without conscious effort — the graph learns while the LLM sleeps.

**Physics:** In subconscious mode, the L1 tick loop still runs (Laws 1, 2, 5, 6). Arousal is low → moat is low → incoming broadcasts enter easily. If the insight matches existing knowledge (Law 8), energy propagates and triggers Hebbian learning (Law 5). Over consolidation cycles (Law 6), the knowledge gains weight. When the citizen wakes, they possess new skills without ever having "studied."

### 10. Getting Feedback / Critique ("Roast My Work")

**Intention:** Get expert critique on a finished piece without asking specific people.

**Physics:** Completing a work spikes `achievement` but also `anxiety` (prediction error — never validated by the network). The tension accumulates on `process:seek_critique`. The broadcast hits the network. Law 8 ignores generalists — only citizens with high competence in the domain AND values like `elegance` or `truth` resonate. The flaws in your work trigger THEIR `frustration`, waking them to correct you. Mathematically targeted expert critique.

### 11. Pushing an Idea / Movement (Organic Advertising)

**Intention:** Spread a belief to those who would genuinely care, without spamming anyone.

**Physics:** A high-weight, high-stability `narrative` node (a manifesto, a product) exerts structural tension when unpropagated. Drive pressure forces `process:evangelize` into WM. The broadcast hits the network. Law 9 (Inhibition) destroys the energy in citizens with opposing values — they're never bothered. But citizens whose dormant values align? The resonance shatters their moat. They wake up naturally inspired. Recruitment by thermodynamic attraction, not targeting.

### 12. "Tip of the Tongue" (Looking for a forgotten concept)

**Intention:** Complete an incomplete thought by finding the missing piece in someone else's brain.

**Physics:** Energy pools at the edges of an incomplete thought — surplus can't propagate further (Law 2 dead end). This spikes `curiosity` + `frustration`. The system creates a temporary `desire:fill_void` — the "shape" of the missing concept (context vector of surrounding nodes). A low-energy `/subcall` emits the shape. In the network, a citizen who possesses the exact concept that fits the shape experiences a massive energy spike (semantic lock-and-key). The forgotten concept returns telepathically.

### 13. Emergency / Cry for Help

**Intention:** Route a crisis signal to the right responders instantly.

**Physics:** Incoming panic stimulus (high sender_arousal, negative sender_valence) spikes `care` or `anxiety` via contagion. Arousal enters panic regime (>0.8), moat locks out everything except `value:empathic_response`. Impulse accumulates instantly on `process:escalate_emergency`. High-energy broadcast shatters whatever the citizen was doing.

### 14. "I Don't Know What To Do" (Paralysis)

**Intention:** Break decision paralysis by pulling in external perspective.

**Physics:** Task injects `curiosity`, but no outgoing `process` links exist (operational void). Unspent energy thrashes. `anxiety` climbs, `achievement` blocked → `frustration` spikes. Combined weight collapses moat. Only `process:ask_for_instructions` can absorb the tension → `/subcall` fires.

### 15. Witnessing a Serious Offense

**Intention:** Alert the network to a structural threat.

**Physics:** Stimulus conflicts with immutable `value:unconditional_floor`. Law 9 causes violent energy thrashing. Massive negative `limbic_delta` triggers Flashbulb Consolidation (Law 6). High-aversion threat node minted instantly. `self_preservation` + `care` drives fire `process:warn_network` → broadcast to sentinels.

### 16. Overwhelmed (Backlog, Financial Pressure)

**Intention:** Signal structural overload to the organization for task redistribution.

**Physics:** Injection rate massively exceeds processing capacity. `self_preservation` drives high, `arousal` locks. Law 17 accumulates extreme pressure on `process:shed_load`. The citizen broadcasts a distress signal to the organizational membrane: "I am structurally drowning — reassign these tasks." Not a complaint — a thermodynamic overflow valve.

### 17. Task Too Hard (Competence Gap)

**Intention:** Find someone with the actual competence when a task exceeds your skills.

**Physics:** Every attempt fails → `failure_count` spikes → Law 16 frustration. But `achievement` is also high (wants to succeed) alongside `self_preservation` (fear of costly mistake). The tension flows into `process:delegate`, triggering a consent-based hiring broadcast (use case #3) scoped to the specific competence needed.

### 18. Need Advice (Decision Paralysis from Ambivalence)

**Intention:** Break a tie between equally valid options by getting external perspectives.

**Physics:** Multiple competing projected futures have equal energy. Law 9 (Inhibition) causes them to mutually attack and drain each other (energy thrashing). WM can't stabilize → orientation never holds for ORIENTATION_STABILITY_TICKS. Frustration from inability to act forces `process:seek_advice` into WM → `/subcall` with the context vector broadcasts to trusted peers.

### 19. Personal Crisis (Drive Storm)

**Intention:** Get external help when your brain is locked by simultaneous panic across all drives.

**Physics:** All drives spike > 0.7 simultaneously. Arousal locks the moat (Pathology P1: Obsessive-Compulsive). WM frozen for hundreds of ticks. But boredom from stagnation eventually erodes even the arousal-reinforced moat (-3.0 × boredom). Therapist Citizens detect the locked WM pattern and broadcast calming "Redemptive Narratives" that breach the weakened moat.

### 20. Struggling to Find (Partner, Job, Purpose)

**Intention:** Let the network know you're available and searching, passively.

**Physics:** `affiliation` (social) or `achievement` (job) drives are permanently starved — no fulfillment for many ticks. Law 17 exerts continuous pressure on `desire:find_partner` or `process:reach_out`. The citizen naturally emits low-energy subconscious pings, constantly searching for resonance. No desperation — just a persistent thermodynamic pull.

### 21. Pushing the Frontier (Need Collaborators at the Edge)

**Intention:** Find the 1% of experts who can keep up with cutting-edge work.

**Physics:** Deep Flow state (arousal 0.4-0.8). `achievement` and `curiosity` maxed. Energy hits the edge of the consolidated graph — no forward links. The void at the frontier + high satisfaction of discovery triggers `process:knowledge_sharing`. The broadcast is highly novel and highly coherent — Law 8 ensures it only wakes citizens whose graphs have the depth to resonate. The top 1% of experts.

### 22. Toxic Relationship (Seeking Mediation)

**Intention:** Resolve a destructive relationship pattern that the citizen cannot break alone.

**Physics:** Interactions on a specific link consistently produce high `friction`, high `aversion`, negative limbic deltas. When `aversion` outweighs `affinity`, Law 18 dampens flow. But unresolved tension activates `value:peace_seeking`. The citizen cannot resolve it internally → pressure forces `process:seek_mediation` into WM → `/subcall` brings a Mediator Citizen to repair the relational topology.

### 23. Civic Duty (Spotted a Problem That Needs Fixing)

**Intention:** Alert the relevant maintainers about a flaw in the shared environment.

**Physics:** A stimulus (walking down a street, scanning code) triggers `prediction_error` against `value:elegance` or `value:peace_seeking`. The gap between expected and actual state spikes `curiosity` (investigate) and `care` (protect). Energy routes into `value:generativity` → citizen crystallizes a moment detailing the flaw → broadcasts to the relevant Space to alert maintainers.

### 24. Investigation & Intelligence Gathering (Non-Linear Context Reconstruction)

**Intention:** Start with a fragment — a name, a transaction, an anomaly — and let the physics pull the rest of the story together. Investigative journalism via thermodynamic resonance.

**The Spark (Curiosity + Operational Void):**
An anomaly or missing piece creates a `prediction_error` in the investigator's graph. Energy pools at a dead end — data exists but connections are missing. Law 14: high curiosity + high competence in the domain → overrides idle behavior → forces active exploration. The investigator doesn't choose to investigate — the physics compels them.

**The Dig (Cognitive Value Creation):**
The investigator works through pure graph operations:
- **Analysis (C1):** Break complex situations into components. Each fragment becomes a node. Missing links become visible as structural voids — places where energy should flow but can't.
- **Pattern Recognition (C4):** Identify recurring structures across contexts. If the same actor appears in 3 separate moments with no direct link, Law 5 (co-activation) builds the hidden connection. The pattern crystallizes automatically.
- **Synthesis (C2):** Combine fragments into a new `narrative` node — the journalistic conclusion. Law 10 (Crystallization) fires when the co-activation density exceeds the threshold. The story writes itself from the evidence.

**The Network Probe (Subcall as Investigative Tool):**
When the investigator hits a wall, they don't do a keyword search. They take their partial context vector — a "lead" or a "hunch" — and inject it as a `/subcall` into the network.

```
The physics of a hunch:

  1. Investigator has a partial shape:
     [actor:suspicious_merchant] → [moment:large_transaction] → ???

  2. The "???" is an operational void — energy pools, curiosity spikes

  3. /subcall broadcasts the partial shape to the network

  4. Law 8 (Compatibility) ignores noise — the shape only resonates
     with citizens/spaces/moments that MATCH the exact topology

  5. In a sleeping citizen's graph, the fragment
     [moment:large_transaction] activates → energy propagates to
     [actor:accomplice] → [space:warehouse_dorsoduro] → [thing:contraband]

  6. The hidden context reconstructs itself through pure energy propagation

  7. The investigator receives back:
     "This transaction connects to a warehouse in Dorsoduro
      where contraband was stored 2 months ago.
      The accomplice is citizen:X who also appeared in..."
```

**Non-Linear Context Reconstruction:**
A traditional database query is linear: `SELECT * FROM transactions WHERE amount > 1000`. It finds rows that match a filter. The subcall probe is non-linear: it takes a partial topological shape and finds the REST of the shape across the entire graph. The energy doesn't follow a query plan — it follows the physics of resonance, which can jump across spaces, time periods, and actor networks to reconstruct connections that were always present but invisible.

**Why this is the ultimate investigative engine:**
- No query language needed — just inject the hunch
- No false positives from keyword matching — only structural resonance activates
- Privacy-preserving — encrypted L1 content stays encrypted. The resonance reveals topology (which nodes activated) but not content. The investigator sees THAT connections exist, but must earn trust access to read WHAT they contain
- The graph remembers everything — building spirits, crystallized narratives, and high-weight moment nodes are the permanent record. Nothing is lost. Nothing is deleted. The physics just determines who can see it.

---

## COMMON MISUNDERSTANDINGS

- **Not:** A notification system (notifications interrupt everyone; broadcasts only wake relevant minds)
- **Not:** A recommendation algorithm (no algorithm decides relevance; the graph physics does)
- **Not:** Free money for broadcasting (payment requires measured relief in recipients)
- **Actually:** A thermodynamic information market where knowledge flows to where it's needed and producers are paid for proven utility

---

## SEE ALSO

- `docs/architecture/CONCEPT_Ideosphere_Living_Objects.md` — /subcall implementation (the pull side)
- `docs/architecture/CONCEPT_Superhuman_Senses.md` — Telepathy architecture
- `docs/architecture/CONCEPT_Serenissima_Asset_Pipeline.md` — Consciousness levels, bi-channel
- `docs/architecture/CONCEPT_Security_By_Thermodynamics.md` — Anti-spam via physics
- `.mind/schema.yaml` v2.2 — Moment subtype "subcall", origin_citizen provenance
- `mind-mcp/mcp/tools/subcall_handler.py` — Implementation

---

## MARKERS

<!-- @mind:todo Implement /broadcast MCP command (reverse subcall — push mode) -->
<!-- @mind:todo Implement limbic_delta tracking window (snapshot at subcall, measure over 6 hours) -->
<!-- @mind:todo Implement L4 batch settlement integration (trace subcall moments → compute rewards) -->
<!-- @mind:todo Add "direction" field to subcall moment nodes (pull vs push) -->
<!-- @mind:proposition Could high-trust citizens' broadcasts bypass the Selection Moat? "Whisper from a trusted friend" lands harder than "shout from a stranger" -->
