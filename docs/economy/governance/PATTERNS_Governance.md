# PATTERNS -- Governance

> Design philosophy for the political layer of Venice.
> Governance is not a menu system. It is emergent political behavior made visible
> in 3D space through crowds, notices, and enforcement.

---

## Core Principle: Politics Is Embodied

In Venezia, governance is not a UI panel where you vote. It is what happens when
enough citizens are angry about the same thing. You see it before you understand
it: a crowd gathering at the Doge's Palace, a notice nailed to a pillar near the
Rialto, guards posted at a warehouse entrance.

The governance system produces observable world events. The visitor does not
interact with governance directly -- they witness it, overhear it, and
eventually understand the political currents of the city through conversation.

---

## The Grievance Lifecycle

All governance starts with a grievance. A citizen with a genuine complaint --
food prices too high, wages too low, a merchant cheating customers -- files a
formal grievance. Other citizens may support it.

```
Citizen files grievance
    |
    v
Grievance record created in Airtable (GRIEVANCES table)
    |
    v
Other citizens evaluate: support or ignore?
    |
    +--> Support count < threshold: grievance fades (decay)
    |
    +--> Support count >= threshold: grievance becomes political movement
            |
            v
         Council formation / Doge review
            |
            +--> Outcome: policy change (tax adjustment, trade restriction, etc.)
            |
            +--> Outcome: rejection (crowd disperses, tension lingers)
```

### What Makes Grievances Real

Grievances are not randomly generated. They emerge from actual economic
conditions:

- A citizen whose wages were cut files a labor grievance
- A citizen who cannot afford food files an economic grievance
- A citizen whose business was undercut by a stratagem files a trade grievance
- A citizen who was locked out of a supply chain files a commerce grievance

The governance handlers (`governance.py` and `governance_kinos.py`) check
the citizen's actual economic state before deciding whether to engage
politically. A wealthy, comfortable citizen has low engagement probability.
A struggling citizen with high influence has high probability.

This is the key insight: the economy drives the politics, which drives the
narrative, which the visitor witnesses.

---

## Decision-Making: Rule-Based vs. KinOS

Serenissima has two governance implementations:

### Rule-Based (`governance.py`)

Probability-driven. Calculates engagement likelihood from class, wealth,
influence, and proximity to Doge's Palace. Random roll determines if the
citizen acts. If acting, another random roll determines file vs. support.

Grievance content is template-generated from the citizen's economic situation.

**Advantage:** Fast, deterministic (given the random seed), no API cost.
**Disadvantage:** Grievances feel formulaic. Limited creativity.

### KinOS-Enhanced (`governance_kinos.py`)

Same preconditions as rule-based, but delegates the decision to KinOS:
- KinOS receives the citizen's full context (wealth, class, recent events, existing grievances)
- KinOS decides: file new grievance, support existing one, or disengage
- If filing, KinOS generates the grievance title, description, and category
- Falls back to rule-based if KinOS API key is missing

**Advantage:** Grievances are creative, contextual, and feel like real political expression.
**Disadvantage:** API cost per decision. Latency (~1-2 seconds per KinOS call).

### Venezia's Relationship to Both

Venezia does not call either handler. Both run inside Serenissima's simulation
engine. Venezia reads the results from the GRIEVANCES Airtable table via the
sync module. The rendered world shows the grievance's observable effects, not
the decision process.

---

## Political Structure of Venice

The governance system models (loosely) the historical Venetian republic:

### The Doge

Symbolic head of state. In the simulation, the Doge is a citizen with the
highest combined wealth and influence in the Nobili class. The Doge does not
change frequently -- it is a lifetime appointment unless political crisis
forces removal.

The Doge's Palace is a physical location in the 3D world. Citizens go there
to file grievances. Crowds gather there during political events. The visitor
can walk to the palace and observe proceedings.

### The Council

When a grievance reaches the support threshold, a council convenes. Council
members are citizens with high influence across social classes:
- Nobili contribute members by wealth rank
- Cittadini contribute members by guild standing
- Popolani contribute members by popular support

The council deliberates (via KinOS or rule-based logic) and produces an
outcome: accept the grievance (policy change) or reject it.

### Social Classes and Political Power

| Class | Political Role | Grievance Behavior |
|---|---|---|
| Nobili | Council members, Doge candidates | File governance grievances (policy, trade regulation) |
| Cittadini | Guild leaders, merchants | File economic grievances (prices, contracts, competition) |
| Popolani | Workers, artisans | File labor grievances (wages, working conditions) |
| Facchini | Dockworkers, laborers | Support grievances more than filing (low influence) |
| Forestieri | Visitors, foreigners | Cannot file or support (no political standing) |

The visitor is a Forestiero. They have no political power. They observe.

---

## Observable Effects in 3D

Governance produces world changes that the visitor can see and hear:

### Crowd Gatherings

When a grievance gains support, citizens physically move toward the Doge's
Palace or relevant piazza. The crowd grows as support increases. At threshold,
the crowd is large enough to be visible from across the district.

Implementation: modify citizen movement targets during governance events.
Citizens with `support_grievance` activity move toward the palace. The
population system renders them as a cluster.

### Posted Notices

Governance outcomes are posted as notices on buildings. Tax changes, trade
restrictions, new regulations -- all appear as 3D text objects on designated
notice boards near the Rialto and Doge's Palace.

Implementation: notices are world props generated from governance events.
They persist for a configurable duration (e.g., 3 in-world days) then decay.

### Guard Enforcement

When governance outcomes include enforcement (e.g., trade restriction on a
specific resource), guard citizens appear at relevant locations. A lockout
on fish imports means guards at the fish market entrance.

Implementation: guard NPCs are special citizens spawned by governance events.
They stand at fixed positions and respond to visitor questions about the
regulation.

### Citizen Mood Shifts

Political events affect citizen mood en masse. A rejected grievance makes
supporters angry. A successful policy change makes supporters relieved and
opponents resentful. Mood shifts are visible as animation changes and
conversation tone.

---

## Governance Cycle Timing

Governance operates on a longer timescale than economic activity:

| Phase | Duration | What Happens |
|---|---|---|
| Filing | Continuous | Citizens file grievances as economic conditions warrant |
| Support | 1-3 days | Other citizens decide whether to support |
| Threshold | Instant | When support count passes threshold, council forms |
| Deliberation | 1 day | Council evaluates and votes |
| Outcome | Instant | Policy change enacted or grievance rejected |
| Enforcement | Ongoing | Guards posted, notices displayed, economy adjusted |

The visitor may witness different phases on different visits. Tuesday: a few
citizens grumbling about grain prices. Thursday: a crowd at the palace.
Saturday: guards at the granary enforcing new import quotas.

---

## Feeding Governance Into the Narrative Graph

Governance events are natural Tension and Moment sources for the Blood Ledger
physics engine:

| Governance Event | Narrative Graph Effect |
|---|---|
| Grievance filed | New Narrative node, TENSION edge to relevant economic topic |
| Support growing | Energy pumped into Narrative node |
| Threshold reached | Moment node created (potential flip) |
| Council rejects | Tension increases (energy does not dissipate, it builds) |
| Council accepts | Moment flips (policy change = observable world event) |

A rejected grievance is narratively more interesting than an accepted one.
Rejection means the tension persists and grows. The physics engine may eventually
flip it into a larger political crisis.

---

## What Venezia Owns vs. What Serenissima Owns

| Component | Owner | Venezia's Role |
|---|---|---|
| Grievance filing logic | Serenissima | Read GRIEVANCES table via sync |
| Support accumulation | Serenissima | Read support counts via sync |
| Council deliberation | Serenissima | Read outcomes via sync |
| Policy enforcement (economic) | Serenissima | Observe price/contract changes |
| 3D crowd rendering | Venezia | Render citizen clusters at palace |
| Notice board display | Venezia | Generate 3D text from governance events |
| Guard spawning | Venezia | Create enforcement NPCs from outcomes |
| Mood propagation to atmosphere | Venezia | Compute district mood from citizen states |
| Narrative graph integration | Venezia | Create Tension/Moment nodes in FalkorDB |

---

## Anti-Patterns

1. **Do not let the visitor influence governance directly.** No voting UI, no
   petition signing, no dialogue option that says "I support this grievance."
   The visitor is a Forestiero. They observe. If they want to influence politics,
   they do it indirectly: befriend a Nobili, share information, change someone's
   mind through conversation. The citizen then decides whether to act.

2. **Do not generate grievances for drama.** Every grievance must be traceable
   to an actual economic condition. If citizens are not complaining, the economy
   is working. That is fine. Silence is valid.

3. **Do not resolve governance instantly.** The cycle takes days. A visitor who
   sees a crowd today and returns tomorrow should find the situation evolved,
   not resolved. Political processes are slow.

4. **Do not show governance mechanics.** No support counters, no progress bars,
   no "65% support needed" text. The visitor infers political momentum from
   crowd size, conversation intensity, and notice frequency.

5. **Do not duplicate governance logic in Venezia.** The handlers run in
   Serenissima. Venezia reads the output. If you need a new governance behavior,
   add it to Serenissima's engine, not to the Venezia codebase.
