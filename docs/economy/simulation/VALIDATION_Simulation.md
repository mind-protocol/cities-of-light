# VALIDATION: economy/simulation -- What Must Be True

Health checks, invariants, and acceptance criteria for the economic simulation engine. Every assertion is testable. Every threshold is derived from the simulation's actual parameters: 152 citizens, 5-minute tick interval, Airtable rate limit of 5 req/sec. The economy is real. The validation must be real too.

---

## Invariants (must ALWAYS hold)

### INV-S1. Ducats Conservation

Total Ducats in the system must remain stable across ticks. Ducats are created only through treasury redistribution and import revenue. Ducats are destroyed only through filing fees, taxation, and bankruptcy write-offs.

```
ASSERT: For any tick T:
  sum(citizen.Ducats for all citizens at T+1)
  + treasury_balance(T+1)
  == sum(citizen.Ducats for all citizens at T)
     + treasury_balance(T)
     + import_revenue(T)
     - export_costs(T)
     - bankruptcy_writeoffs(T)

Tolerance: 0.01 Ducats (floating point rounding)
```

Every `transfer_ducats()` call is a zero-sum operation: one citizen loses exactly what another gains. If the sum diverges beyond tolerance, a transaction has been miscounted or a write failed silently.

### INV-S2. No Negative Ducats Without Bankruptcy

A citizen's Ducats balance must never go below zero unless they are in the bankruptcy process. The `transfer_ducats()` function must reject transfers that would cause a negative balance, except for loan repayment defaults which trigger the bankruptcy handler.

```
ASSERT: For every citizen C at any time:
  C.Ducats >= 0 OR C.Status == "bankrupt" OR C.Status == "bankruptcy_pending"
```

### INV-S3. Prices Always Positive

All resource prices in active contracts must be strictly positive. A price of zero would mean free goods, breaking the supply/demand equilibrium. A negative price is nonsensical.

```
ASSERT: For every active contract:
  contract.PricePerResource > 0

ASSERT: For every resource in recalculate_market_prices():
  calculated_price > 0
  Minimum floor: 1 Ducat per unit
```

### INV-S4. One Activity Per Citizen

Each citizen may have at most one non-terminal activity at any time. Terminal states are `processed`, `failed`, and `cancelled`. A citizen with two active activities would create conflicting position updates and resource mutations.

```
ASSERT: For every citizen C:
  count(activities WHERE CitizenId == C.CitizenId
        AND Status NOT IN ["processed", "failed", "cancelled"]) <= 1
```

### INV-S5. Resource Non-Negativity

Building and citizen inventory counts must never go below zero. The `decrement_resource()` function must verify sufficient stock before subtracting.

```
ASSERT: For every resource entry in every building and citizen inventory:
  resource.amount >= 0
```

### INV-S6. Activity Processor Determinism

Given the same Airtable state, an activity processor must produce the same result. No randomness in processing (randomness is permitted only in activity creation and governance engagement rolls).

```
ASSERT: process_production(tables_snapshot, activity) at T1
     == process_production(tables_snapshot, activity) at T2
     when tables_snapshot is identical
```

---

## Health Checks

### HC-S1. Simulation Tick Duration

Each tick must complete within the tick interval. At 5 req/sec with ~744 API calls per full tick, the theoretical minimum is ~149 seconds. The 5-minute (300s) interval provides margin.

```
CHECK: tick_duration < 300 seconds (TICK_INTERVAL_MINUTES * 60)
  WARN  at: tick_duration > 200 seconds (67% of interval)
  ALERT at: tick_duration > 280 seconds (93% of interval)
  CRITICAL at: tick_duration > 300 seconds (tick overlap)
```

If ticks overlap, the next tick starts before the previous one finishes, causing concurrent Airtable mutations on the same records.

### HC-S2. Activity Completion Rate

In a healthy simulation, the majority of activities should complete successfully. A low completion rate means preconditions are failing: citizens lack resources, buildings are full, contracts are invalid.

```
CHECK: activity_completion_rate = processed / (processed + failed) per tick
  HEALTHY: >= 0.80 (80% of activities succeed)
  WARN   at: < 0.60 (systemic precondition failures)
  ALERT  at: < 0.30 (simulation is stalling)
```

Track per-activity-type failure rates. If `production` fails at >50%, input resource supply is likely broken. If `fetch_resource` fails at >50%, contracts are referencing depleted stock.

### HC-S3. Bankruptcy Rate

Bankruptcy is a natural outcome. Mass bankruptcy is a simulation failure.

```
CHECK: bankruptcy_count per day
  HEALTHY: 0-3 citizens per day (<2% of population)
  WARN   at: 4-9 citizens per day (2-5%)
  ALERT  at: 10+ citizens per day (>5%, potential death spiral)
```

A death spiral occurs when bankruptcies remove producers from the economy, causing supply shortages, causing price spikes, causing more bankruptcies.

### HC-S4. Market Price Range

Prices should fluctuate within reasonable bounds. The simulation uses supply/demand-driven pricing with no hard caps (unless governance imposes a price_cap decree).

```
CHECK: For each resource type:
  price_ratio = current_price / baseline_price
  HEALTHY: 0.25 <= price_ratio <= 4.0
  WARN   at: price_ratio < 0.10 or price_ratio > 8.0
  ALERT  at: price_ratio < 0.01 or price_ratio > 20.0 (hyperinflation / deflation)
```

Baseline prices are established from the first 7 days of simulation data.

### HC-S5. Idle Citizen Count

After activity creation runs, no citizen should remain idle for more than 2 consecutive ticks unless the simulation is frozen. Idle citizens are economically dead.

```
CHECK: idle_citizens = citizens with no activity for > 10 minutes
  HEALTHY: < 10 idle citizens (<5% of 152)
  WARN   at: 10-30 idle citizens (5-16%)
  ALERT  at: > 30 idle citizens (activity creation is broken)
```

### HC-S6. Airtable API Error Rate

The simulation depends entirely on Airtable availability. Track API call success rate per tick.

```
CHECK: api_success_rate = successful_calls / total_calls per tick
  HEALTHY: >= 0.99
  WARN   at: < 0.95 (intermittent failures)
  ALERT  at: < 0.80 (Airtable degradation, consider pausing simulation)
```

---

## Acceptance Criteria

### AC-S1. 24-Hour Stability Run

The simulation must run for 24 continuous hours without manual intervention.

- [ ] Zero tick overlaps (no tick starts before the previous completes)
- [ ] Activity completion rate stays above 60% for every tick
- [ ] Bankruptcy count stays below 10 per day
- [ ] No resource prices hit zero or go negative
- [ ] Total Ducats conservation holds within 0.01 tolerance across all ticks
- [ ] Zero unhandled exceptions in simulation logs

### AC-S2. Economic Cycle Verification

Over a 7-day simulation run, the economy must demonstrate natural cycles.

- [ ] At least 3 distinct price fluctuation cycles observed for a major resource (grain, fish, timber)
- [ ] At least 1 citizen transitions social class (upward or downward)
- [ ] At least 1 bankruptcy occurs and is resolved (citizen re-enters economy)
- [ ] Trade volume (completed contracts) increases and decreases with time-of-day patterns
- [ ] Wage levels respond to labor supply changes

### AC-S3. Stratagem Impact Verification

Stratagems must produce measurable economic effects.

- [ ] A `monopoly_pricing` stratagem raises the target resource price by at least 20% within 3 ticks
- [ ] A `supplier_lockout` stratagem reduces the locked-out citizen's production by at least 50% within 5 ticks
- [ ] A `political_campaign` stratagem increases the citizen's influence by at least 10 points
- [ ] No stratagem produces an effect that violates INV-S1 through INV-S5

### AC-S4. Population Scale

All 152 citizens must participate in the economy simultaneously.

- [ ] Every citizen completes at least 1 activity per hour when the simulation is active
- [ ] No citizen accumulates Ducats without performing productive activities
- [ ] Citizen positions in Airtable update with each activity completion
- [ ] The activity dispatch table covers all 30+ activity types without missing processors

---

## Anti-Patterns

### AP-S1. Hyperinflation

**Symptom:** Resource prices double within a single day. Citizens cannot afford food. Bankruptcy cascade begins.

**Detection:** Monitor `recalculate_market_prices()` output. If any resource price increases by >100% between consecutive daily recalculations, flag immediately.

**Root Cause:** Usually a supply chain break -- a key import galley route is blocked, or the sole producer of a resource went bankrupt. Can also be caused by a `monopoly_pricing` stratagem with no competing suppliers.

**Mitigation:** Verify import routes are functioning. Check that at least 2 independent suppliers exist for each critical resource (grain, fish, timber, cloth). If a single stratagem caused the spike, verify the stratagem processor respects price floor constraints.

### AP-S2. Mass Bankruptcy Cascade

**Symptom:** More than 10 citizens go bankrupt in a single day. Each bankruptcy removes a producer, increasing prices, triggering more bankruptcies.

**Detection:** Track `bankruptcy_count` per tick. If 3+ bankruptcies occur in a single tick, pause and investigate.

**Root Cause:** Wages too low relative to food prices. Or a governance `tax_change` decree raised taxes beyond what citizens can bear. Or daily_expenses systematically exceeds daily_income for an entire social class.

**Mitigation:** Verify `calculate_citizen_financials()` produces realistic daily_income and daily_expenses values. Ensure bankruptcy recovery path exists (citizen can re-enter economy with starter capital).

### AP-S3. Stratagem Deadlocks

**Symptom:** Two citizens execute competing stratagems that block each other indefinitely. Example: Citizen A locks out Citizen B from Supplier X, while Citizen B locks out Citizen A from Supplier Y. Both citizens starve of inputs.

**Detection:** Monitor stratagem pairs where both parties have active stratagems targeting each other. Flag if both parties' production drops below 20% of normal for 3+ consecutive ticks.

**Root Cause:** The stratagem system has no mutual-exclusion detection. Two lock-outs can create a circular dependency.

**Mitigation:** Add a deadlock detection pass to the stratagem processing phase. If circular lock-outs are detected, the older stratagem expires.

### AP-S4. Idle Citizen Accumulation

**Symptom:** Citizens finish their activity and sit idle for multiple ticks. The `determine_next_activity()` function returns None because no handler matches their situation.

**Detection:** Count citizens with no activity across 3 consecutive ticks. If the count grows each tick, activity creation has a gap.

**Root Cause:** The priority chain in `determine_next_activity()` does not cover an edge case. Common case: citizen is not hungry, not tired, it is not work time, but it is not leisure time either. The citizen falls through all handlers.

**Mitigation:** The fallback at the end of `determine_next_activity()` must always assign an activity. The `idle` and `goto_location` activities serve as catch-alls. Verify the fallback path is reachable and functional.

### AP-S5. Phantom Wealth

**Symptom:** A citizen's Ducats balance increases without any corresponding `transfer_ducats()` call. Wealth appears from nowhere.

**Detection:** Audit trail: every Ducats change must have a corresponding transaction record with `transaction_type`, `from`, `to`, and `amount`. Run a daily reconciliation: sum of all transactions for a citizen must equal their current balance minus their starting balance.

**Root Cause:** A processor directly sets `Ducats` via Airtable update instead of going through `transfer_ducats()`. This bypasses conservation.

**Mitigation:** All Ducats mutations must go through `transfer_ducats()`. Grep the codebase for direct Airtable updates to the Ducats field and eliminate them.

---

## Data Integrity

### DI-S1. Transaction Log Reconciliation

Every Ducat transfer must be logged. The transaction log must balance.

```
DAILY CHECK:
  FOR each citizen C:
    initial_balance = C.Ducats at start of day
    credits = SUM(transaction.amount WHERE transaction.to == C.Username)
    debits  = SUM(transaction.amount WHERE transaction.from == C.Username)
    expected_balance = initial_balance + credits - debits
    ASSERT: abs(C.Ducats - expected_balance) < 0.01
```

### DI-S2. Contract Consistency

Active contracts must reference valid citizens and buildings.

```
PERIODIC CHECK (every tick):
  FOR each contract WHERE Status == "active":
    ASSERT: contract.Seller exists in CITIZENS table
    ASSERT: contract.Buyer exists in CITIZENS table (if set)
    ASSERT: contract.SellerBuilding exists in BUILDINGS table
    ASSERT: contract.PricePerResource > 0
    ASSERT: contract.TargetAmount > 0
    ASSERT: contract.FilledAmount <= contract.TargetAmount
    ASSERT: contract.FilledAmount >= 0
```

### DI-S3. Activity-Citizen Linkage

Every active activity must reference a valid citizen. Orphaned activities waste tick processing time.

```
PERIODIC CHECK (every tick):
  FOR each activity WHERE Status NOT IN ["processed", "failed", "cancelled"]:
    ASSERT: activity.CitizenId exists in CITIZENS table
    ASSERT: activity.Citizen (username) matches the CitizenId record
    ASSERT: activity.StartDate < activity.EndDate
    ASSERT: activity.Type exists in ACTIVITY_PROCESSORS dispatch table
```

### DI-S4. Building Inventory Integrity

Building resource counts must be non-negative and within storage capacity.

```
PERIODIC CHECK (every tick):
  FOR each building B:
    total_stored = SUM(resource.amount for all resources in B)
    ASSERT: total_stored <= B.StorageCapacity (with 5% tolerance for in-flight deliveries)
    FOR each resource in B:
      ASSERT: resource.amount >= 0
      ASSERT: resource.type is a valid resource in resource_defs
```

### DI-S5. Position Format Validation

All citizen positions must be valid Venice coordinates.

```
PERIODIC CHECK (every sync):
  FOR each citizen:
    ASSERT: citizen.Position is not null
    ASSERT: citizen.Position matches format "lat,lng"
    parsed = parse_position(citizen.Position)
    ASSERT: 45.40 <= parsed.lat <= 45.47 (Venice latitude bounds)
    ASSERT: 12.30 <= parsed.lng <= 12.38 (Venice longitude bounds)
```

Citizens outside Venice are either in transit via galley (valid) or have corrupted position data (invalid). Galley citizens should have a `leave_venice` activity; any other activity type with out-of-bounds position is an error.
