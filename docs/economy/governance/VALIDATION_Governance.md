# VALIDATION: economy/governance -- What Must Be True

Health checks, invariants, and acceptance criteria for the governance system. Governance is the political layer that translates economic pressure into policy change. Grievances are filed by real citizens with real complaints. Councils vote with deterministic logic. Outcomes modify the simulation state. If any link in this chain breaks, politics becomes theater.

---

## Invariants (must ALWAYS hold)

### INV-G1. Grievance Lifecycle Integrity

Every grievance must follow the defined state machine. No state may be skipped. No backward transitions.

```
VALID TRANSITIONS:
  filed       -> gathering     (first support received)
  filed       -> expired       (no support within 7 days)
  gathering   -> threshold     (support_count >= 20)
  gathering   -> expired       (support decays below 5 after 7 days)
  threshold   -> deliberating  (council formed)
  deliberating -> accepted     (council votes in favor)
  deliberating -> rejected     (council votes against)
  accepted    -> enacted       (enforcement deployed)

ASSERT: For every grievance state change:
  (old_status, new_status) IN VALID_TRANSITIONS

ASSERT: No grievance transitions backward:
  NOT (accepted -> deliberating)
  NOT (threshold -> gathering)
  NOT (enacted -> accepted)
  NOT (rejected -> deliberating)
```

A grievance stuck in `deliberating` for more than 48 hours has a stalled council. A grievance in `accepted` for more than 24 hours without reaching `enacted` has a stalled enforcement pipeline.

### INV-G2. Council Vote Determinism

Given identical inputs -- the same council members, the same grievance state, the same citizen wealth/influence/trust values, and the same random seed -- the council must produce the same vote outcome.

```
ASSERT: council_deliberate(tables_snapshot, council, grievance, seed=S)
     == council_deliberate(tables_snapshot, council, grievance, seed=S)

This means:
  - Vote probability is computed purely from citizen state and grievance state
  - No external side effects influence the vote
  - The random seed fully determines the roll outcomes
```

All inputs are from Airtable state. The random roll is the only non-deterministic element, controlled by the seed.

### INV-G3. Outcomes Always Affect the Economy

Every accepted grievance must produce a measurable change in the simulation state.

```
ASSERT: For every grievance WHERE Status == "enacted":
  outcome = parse_json(grievance.OutcomeDetails)
  VERIFY at least one of: tax rate modified, price cap applied, wage floor set,
    trade restriction enacted, fine levied, building permit issued, repair decree
    funded, cultural funding disbursed, social mobility threshold adjusted
```

### INV-G4. Filing Fee Conservation

Filing deducts exactly 50 Ducats from filer to treasury. Support contributions follow the tiered schedule (10/20/50/100/200 based on wealth). Both are zero-sum transactions.

```
ASSERT: For every grievance creation: filer -50, treasury +50
ASSERT: For every support action: supporter -amount, treasury +amount
  WHERE amount = calculate_support_amount(supporter.liquid_wealth)
```

### INV-G5. Forestieri Exclusion

Visitors (Forestieri class) must never file or support grievances. They have no political standing in Venice.

```
ASSERT: For every grievance:
  filer_class = get_citizen(grievance.Citizen).SocialClass
  ASSERT: filer_class != "Forestieri"

ASSERT: For every support action:
  supporter_class = get_citizen(supporter_username).SocialClass
  ASSERT: supporter_class != "Forestieri"
```

### INV-G6. Support Threshold Consistency

The review threshold is 20 supporters. A grievance must not transition to `threshold` with fewer than 20 supporters. A grievance must not remain in `filed` or `gathering` after reaching 20 supporters.

```
ASSERT: For every grievance WHERE Status == "threshold":
  grievance.SupportCount >= 20

ASSERT: For every grievance WHERE Status IN ["filed", "gathering"]:
  grievance.SupportCount < 20
```

---

## Health Checks

### HC-G1. Grievance Processing Time

Lifecycle pacing should feel like real politics -- days, not minutes or months.

```
CHECK: time_in_state
  filed -> gathering:       HEALTHY < 3 days, WARN > 5 days
  gathering -> threshold:   HEALTHY 1-7 days, WARN > 14 days
  threshold -> deliberating: HEALTHY < 24h, WARN > 48h, ALERT > 72h
  deliberating -> outcome:  HEALTHY < 24h, WARN > 48h, ALERT > 72h
```

### HC-G2. Support Accumulation Rate

Support gathering should follow a natural curve: slow start, acceleration as momentum builds, plateau near threshold.

```
CHECK: support_rate = new_supporters_per_day for each gathering grievance
  HEALTHY: 1-10 supporters/day
  WARN   at: 0 supporters/day for 3 consecutive days (momentum dead, will expire)
  WARN   at: > 20 supporters/day (suspiciously fast, check for spam)
```

### HC-G3. Council Deliberation Frequency

Councils should form whenever grievances reach threshold. Track how often councils convene.

```
CHECK: councils_formed_per_week
  HEALTHY: 0-5 per week (matches the number of threshold-reaching grievances)
  WARN   at: 0 for 30 days while active grievances exist at threshold status
  ALERT  at: > 10 per week (too many grievances reaching threshold simultaneously)
```

### HC-G4. Outcome Enforcement Latency

After a council accepts a grievance, the policy change must take effect and guards must be deployed (if applicable).

```
CHECK: time from accepted -> enacted
  HEALTHY: < 24 hours
  WARN   at: > 48 hours
  ALERT  at: > 72 hours (enforcement pipeline is broken)

CHECK: For enacted outcomes with requires_enforcement == true:
  ASSERT: at least 1 guard NPC spawned at the relevant location within 24 hours
```

### HC-G5. Grievance Volume and Decay

```
CHECK: active_grievance_count (filed + gathering + threshold + deliberating)
  HEALTHY: 5-30,  WARN < 3 or > 50,  ALERT > 100

CHECK: expired_grievances_per_week
  HEALTHY: > 0,  WARN: 0 for 14 days with active grievances (decay not running)

CHECK: average_grievance_lifespan (filed -> expired)
  HEALTHY: 7-21 days,  WARN > 30 days or < 3 days
```

---

## Acceptance Criteria

### AC-G1. Full Grievance Lifecycle

A single grievance must complete the full path from filing to enforcement.

- [ ] A citizen with liquid_wealth > 100 Ducats, within 500m of Doge's Palace, files a grievance
- [ ] Filing fee of 50 Ducats is deducted from filer and credited to city treasury
- [ ] Grievance record created in Airtable GRIEVANCES table with Status "filed"
- [ ] Other citizens discover and support the grievance over subsequent ticks
- [ ] SupportCount reaches 20; Status transitions to "threshold"
- [ ] Council of 9 forms (3 Nobili, 3 Cittadini/Mercatores, 3 Popolani/Facchini)
- [ ] Council votes; outcome determined by class alignment, wealth, trust, and random roll
- [ ] If accepted: OutcomeType and OutcomeDetails are set; Status becomes "accepted"
- [ ] Policy change is applied to the simulation (verifiable in Airtable)
- [ ] If enforcement required: guard NPCs spawned; Status becomes "enacted"

### AC-G2. Rejection and Tension Persistence

A rejected grievance must not disappear silently. It must increase narrative tension.

- [ ] Council rejects a grievance; Status becomes "rejected"
- [ ] All supporters receive an anger increase (verifiable as mood shift)
- [ ] Narrative graph receives a tension injection (TENSION edge energy increases)
- [ ] The grievance's underlying economic condition persists (prices still high, wages still low)
- [ ] Within 14 days, a new grievance on the same topic is filed by a different citizen

### AC-G3. Cross-Class Council Dynamics

- [ ] Economic grievance: Nobili tend to vote against, Popolani tend to vote for
- [ ] Criminal grievance: Nobili tend to vote for (law and order)
- [ ] Same grievance/council, 100 runs (different seeds): acceptance rate 30-70%

### AC-G4. Engagement Probability Verification

- [ ] liquid_wealth < 1000: 1.5x base engagement probability
- [ ] liquid_wealth > 100000: 0.8x base; influence < 100: 0.8x; influence > 1000: 1.2x
- [ ] No citizen exceeds 30% engagement probability (hard cap)
- [ ] Forestiero: always 0.05 probability, can never file

### AC-G5. KinOS Fallback

- [ ] Valid KinOS API key: AI-generated, contextual grievance content
- [ ] Missing key: falls back to template-based generation with valid output
- [ ] No error propagation from KinOS failure to the simulation tick

---

## Anti-Patterns

### AP-G1. Grievance Spam

**Symptom:** A single citizen or social class floods the system with grievances. The GRIEVANCES table grows unbounded. Council formation becomes a bottleneck.

**Detection:** Track grievance filing rate per citizen and per class.

```
ALERT IF:
  any citizen files > 1 grievance per 7 days
  any social class files > 10 grievances per day
  total grievance filing rate > 20 per day
```

**Root Cause:** The 7-day cooldown per citizen (`can_file_grievance` checks recent filing history) is not being enforced, or engagement probability is set too high for a specific class.

**Mitigation:** Verify the `recent_grievances` check in `can_file_grievance()`. Verify the 30% hard cap on engagement probability. If a specific class is over-represented, audit their economic conditions -- perhaps the simulation has a genuine systemic issue that is correctly triggering mass political engagement.

### AP-G2. Council Deadlock

**Symptom:** Grievance stuck in `threshold` or `deliberating` indefinitely.

**Detection:** Alert if any grievance has Status `threshold` or `deliberating` for >72 hours.

**Root Cause:** A class group has zero members (e.g., all Nobili bankrupt), so council cannot form. Or deliberation function throws an error silently.

**Mitigation:** Fallback for empty class groups: fill remaining seats from the next class. Add 48-hour timeout: auto-reject stalled deliberations with a log entry.

### AP-G3. Unenforced Outcomes

**Symptom:** Grievance accepted with `OutcomeType` set, but economy unchanged. The decree is on paper only.

**Detection:** After enacted transition, verify: `tax_change` modified the tax rate, `price_cap` capped the resource price, `wage_floor` raised minimum wage. If the relevant economic metric is unchanged after 24 hours, the outcome is unenforced.

**Root Cause:** `apply_governance_outcome()` not called, or it writes to fields the simulation engine does not read.

**Mitigation:** Integration tests per outcome type: create test grievance, apply outcome, run simulation tick, verify economic impact.

### AP-G4. Guard Accumulation

**Symptom:** Guards spawned for enforcement decrees but never despawned. Venice fills with stale guard NPCs.

**Detection:** Alert if `count(guard_NPCs) > count(active_enforcement_decrees) * 3`, or any guard exists at a location with no active decree.

**Root Cause:** `deploy_enforcement()` spawns guards but no cleanup runs when `duration_days` expires.

**Mitigation:** Daily enforcement expiry check: if `now - ResolvedAt > duration_days`, despawn guards and mark grievance as terminal. Guard lifecycle must be tied to the decree.

### AP-G5. Political Monoculture

**Symptom:** All grievances are the same category. Council votes become predictable.

**Detection:** Warn if any category >60% of all grievances over 30 days, or any category has 0 grievances.

**Root Cause:** Simulation stresses one economic dimension exclusively. Or engagement modifiers favor one class.

**Mitigation:** Verify template bank covers all categories per class. The fix is in the simulation -- diverse economic pressures produce diverse political expression.

---

## Data Integrity

### DI-G1. Grievance-Airtable Consistency

Every governance state change must be persisted to Airtable. The cached GRIEVANCES data must match Airtable after the next sync.

```
POST-ACTION CHECK:
  After every grievance status change:
    ASSERT: tables.grievances.get(grievance_id).fields.Status == new_status
    ASSERT: next Venezia sync cache reflects the status change

  After every support action:
    ASSERT: tables.grievances.get(grievance_id).fields.SupportCount == expected_count
    ASSERT: citizen_username IN parse_json(grievance.fields.Supporters)
```

### DI-G2. Decree-to-Economic-Effect Verification

For each enacted outcome, verify the three-link chain: Airtable record -> simulation processing -> citizen impact.

```
VERIFICATION MATRIX:
  tax_change:       OutcomeDetails.percentage -> daily_wages processing -> DailyExpenses
  price_cap:        OutcomeDetails.max_price  -> recalculate_market_prices() -> contract prices
  wage_floor:       OutcomeDetails.min_wage   -> process_daily_wages() -> citizen wages
  trade_restriction: OutcomeDetails.restricted_activity -> activity creators -> citizen activities
  fine_enforcement:  OutcomeDetails.fine_amount -> transfer_ducats() -> target's Ducats
```

### DI-G3. Council Composition Audit

```
PERIODIC CHECK (after every council formation):
  ASSERT: len(council.members) == 9, no duplicates, all exist in CITIZENS
  ASSERT: 3 Nobili (by wealth), 3 Cittadini/Mercatores (by influence),
          3 Popolani/Facchini (by political activity)
  ASSERT: no bankrupt members
```

### DI-G4. Supporter List Integrity

```
PERIODIC CHECK (every sync):
  FOR each grievance G:
    ASSERT: len(parse_json(G.Supporters)) == G.SupportCount
    ASSERT: no duplicate usernames, all exist in CITIZENS
    ASSERT: G.SupportAmount >= G.SupportCount * 10 (minimum 10 Ducats per supporter)
```

### DI-G5. Filing Precondition Audit

```
PERIODIC CHECK (daily, sample 5 grievances):
  ASSERT: filer.SocialClass != "Forestieri"
  ASSERT: filer had >= 100 Ducats at filing time (50 fee + 50 buffer)
  ASSERT: filer within 500m of Doge's Palace at filing time
  ASSERT: no other grievance filed by same citizen within 7 days prior
```
