# IMPLEMENTATION: economy/governance -- Code Architecture

Where the governance code lives. How grievances flow from Airtable through the sync layer into the 3D world. KinOS API call format. Council deliberation implementation. Outcome application to Airtable. Narrative graph injection. Guard NPC generation. Crowd effects. File paths in both repos. JS interfaces for every structure.

---

## Governance Flow: Two Repos, One System

Governance runs as part of the Serenissima economic simulation (Python, writes to Airtable). Venezia observes governance events through the sync layer (Node.js, reads from Airtable). The 3D world renders the consequences: citizens rallying, guards appearing, atmosphere shifts.

```
serenissima/backend/engine/handlers/governance.py        ← Rule-based grievance logic
serenissima/backend/engine/handlers/governance_kinos.py  ← KinOS-enhanced grievance logic
serenissima/backend/engine/activity_processors/
  support_grievance_processor.py                         ← Process support activities
serenissima/backend/engine/activity_creators/
  file_grievance_activity_creator.py                     ← Create file_grievance activities
  support_grievance_activity_creator.py                  ← Create support_grievance activities

cities-of-light/src/server/serenissima-sync.js           ← Fetches GRIEVANCES table
cities-of-light/src/server/venice-state.js               ← Caches grievances in Map
cities-of-light/src/server/physics-bridge.js             ← Injects into FalkorDB graph
cities-of-light/src/client/citizens/citizen-manager.js   ← Renders crowd effects
cities-of-light/src/client/atmosphere/district-mood.js   ← Atmosphere from governance
```

---

## Serenissima Governance: Python Implementation

### Handler Entry Points

Two handler files implement governance participation. Both have the same signature. The orchestrator chooses which to call based on `KINOS_API_KEY` availability.

```python
# serenissima/backend/engine/handlers/governance.py
def _handle_governance_participation(
    tables: Dict[str, Any],
    citizen_record: Dict[str, Any],
    is_night: bool,
    resource_defs: Dict[str, Any],
    building_type_defs: Dict[str, Any],
    now_venice_dt: datetime,
    now_utc_dt: datetime,
    transport_api_url: str,
    api_base_url: str,
    citizen_position: Optional[Dict[str, float]],
    citizen_custom_id: str,
    citizen_username: str,
    citizen_airtable_id: str,
    citizen_name: str,
    citizen_position_str: Optional[str],
    citizen_social_class: str,
    check_only: bool = False
) -> Optional[Dict[str, Any]]:
```

```python
# serenissima/backend/engine/handlers/governance_kinos.py
def _handle_governance_participation_kinos(
    # Same signature as above
) -> Optional[Dict[str, Any]]:
```

Both handlers:
1. Check preconditions (not nighttime, citizen has wealth, not recently filed)
2. Calculate political engagement probability by class
3. Decide: file new grievance OR support existing grievance OR do nothing
4. Create the appropriate activity record in Airtable

### Governance Imports

```python
# Both governance handlers import:
from backend.engine.utils.activity_helpers import (
    LogColors,
    _get_building_position_coords,
    _calculate_distance_meters,
)
from backend.engine.activity_creators.file_grievance_activity_creator import (
    try_create_file_grievance_activity,
)
from backend.engine.activity_creators.support_grievance_activity_creator import (
    try_create_support_grievance_activity,
)
```

### KinOS API Call Format

The KinOS-enhanced handler calls the KinOS API to generate contextually rich grievance content.

```python
# serenissima/backend/engine/handlers/governance_kinos.py

KINOS_API_KEY = os.getenv("KINOS_API_KEY")
KINOS_BASE_URL = "https://api.kinos-engine.ai/v2/blueprints/serenissima-ai"

def call_kinos_for_governance(citizen_username, channel, prompt, context):
    """
    Call KinOS API for governance decisions.

    Endpoint: POST {KINOS_BASE_URL}/{citizen_username}/kins/{channel}/messages
    """
    url = f"{KINOS_BASE_URL}/{citizen_username}/kins/{channel}/messages"

    payload = {
        "message": prompt,
        "addSystem": json.dumps(context),
        "model": "local",
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {KINOS_API_KEY}",
    }

    response = requests.post(url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()
```

The `context` object sent as `addSystem`:

```python
context = {
    "venice_time":         now_venice.isoformat(),
    "citizen_profile": {
        "username":        citizen_username,
        "name":            citizen_name,
        "social_class":    social_class,
        "wealth":          wealth,
        "influence":       influence,
        "liquid_wealth":   liquid_wealth,
        "occupation":      occupation,
        "home_district":   home_district,
    },
    "existing_grievances": [
        {"title": g.Title, "category": g.Category, "support": g.SupportCount}
        for g in existing_grievances
    ],
    "governance_rules": {
        "filing_fee":       50,
        "minimum_support":  10,
        "review_threshold": 20,
    },
    "ledger": ledger_data,  # Citizen's .cascade/ memory summary
}
```

The KinOS response is expected to be JSON:

```json
{
  "action": "file_grievance",
  "grievance_data": {
    "category": "economic",
    "title": "Unbearable Tax Burden on Workers",
    "description": "The taxes levied on our daily labor exceed what any honest worker can bear..."
  }
}
```

Or:

```json
{
  "action": "support_grievance",
  "grievance_id": "recXXXXXXXX",
  "reason": "This cause aligns with my experience as a struggling artisan."
}
```

Or:

```json
{
  "action": "none",
  "reason": "Current conditions do not warrant political action."
}
```

### Wealth Breakdown Function

Used by both handlers to determine economic stress:

```python
# serenissima/backend/engine/handlers/governance.py
def get_citizen_wealth_breakdown(citizen_record: Dict[str, Any]) -> Dict[str, Any]:
    total_wealth = citizen_record.get('Ducats', 0)
    return {
        'total_wealth': total_wealth,
        'liquid_wealth': int(total_wealth * 0.8) if total_wealth > 10000 else total_wealth,
    }
```

### Activity Creators

```python
# serenissima/backend/engine/activity_creators/file_grievance_activity_creator.py
def try_create_file_grievance_activity(
    tables: Dict[str, Any],
    citizen_record: Dict[str, Any],
    grievance_data: Dict[str, Any],     # {category, title, description}
    now_venice_dt: datetime,
    now_utc_dt: datetime,
    transport_api_url: str,
) -> Optional[Dict[str, Any]]:
    """
    1. Find Doge's Palace building
    2. Compute path from citizen position to palace
    3. Calculate travel + filing duration
    4. Deduct 50 ducat filing fee
    5. Create GRIEVANCES record in Airtable
    6. Create file_grievance ACTIVITIES record
    """
```

```python
# serenissima/backend/engine/activity_creators/support_grievance_activity_creator.py
def try_create_support_grievance_activity(
    tables: Dict[str, Any],
    citizen_record: Dict[str, Any],
    grievance_id: str,                  # Airtable record ID
    support_amount: int,                # Ducats contributed
    now_utc_dt: datetime,
    transport_api_url: str,
) -> Optional[Dict[str, Any]]:
    """
    1. Validate grievance still exists and is active
    2. Deduct support_amount from citizen
    3. Update GRIEVANCES: increment SupportCount, append to Supporters
    4. If SupportCount >= 20: transition to "threshold" status
    5. Create support_grievance ACTIVITIES record
    """
```

---

## Airtable GRIEVANCES Table Schema

| Field | Type | Description |
|---|---|---|
| GrievanceId | Text | Unique ID, format `grv_<uuid>` |
| Title | Text | Short grievance title |
| Description | Long Text | Full grievance text |
| Category | Single Select | `economic`, `social`, `criminal`, `infrastructure` |
| Status | Single Select | `filed`, `gathering`, `threshold`, `deliberating`, `accepted`, `rejected`, `expired`, `enacted` |
| Citizen | Text | Username of the filer |
| SocialClass | Text | Class of the filer |
| SupportCount | Number | Current support score |
| SupportAmount | Number | Total ducats contributed |
| Supporters | Long Text | JSON array of usernames |
| CreatedAt | Date | Filing timestamp |
| ThresholdAt | Date | When threshold was reached |
| ResolvedAt | Date | When council decided |
| OutcomeType | Text | `tax_change`, `price_cap`, `trade_restriction`, etc. |
| OutcomeDetails | Long Text | JSON of specific policy changes |
| DecayRate | Number | Support points lost per day (default: 1) |

---

## Venezia Sync: Grievance Data in the Cache

The `serenissima-sync.js` module fetches the GRIEVANCES table as part of its 15-minute cycle. See IMPLEMENTATION_Sync.md for the full fetch mechanism.

### Sync Table Definition for Grievances

```javascript
// In SYNC_TABLES array (serenissima-sync.js)
{
  name:     'grievances',
  airtable: 'GRIEVANCES',
  keyField: null,                // Uses Airtable record ID as key
  fields:   ['Title', 'Description', 'Category', 'Status', 'Citizen',
             'SupportCount', 'CreatedAt'],
}
```

### Transform Function for Grievances

```javascript
// In transformRecord() switch (serenissima-sync.js)
case 'grievances':
  return {
    id:           record.id,
    title:        get('Title'),
    description:  get('Description'),
    category:     get('Category'),
    status:       get('Status'),
    citizen:      get('Citizen'),
    supportCount: get('SupportCount') || 0,
    createdAt:    get('CreatedAt'),
    lastSync:     now,
  };
```

### WebSocket Event for Grievance Changes

```javascript
// In mapToWsEvent() switch (serenissima-sync.js)
case 'grievances':
  return {
    type:       'event_alert',
    alertType:  'governance',
    grievance:  {
      id:           record.id,
      title:        record.title,
      category:     record.category,
      status:       record.status,
      supportCount: record.supportCount,
      citizen:      record.citizen,
    },
    changed:    event.changed_fields,
  };
```

### Cache Query for Active Grievances

```javascript
// In venice-state.js
export function getActiveGrievances() {
  const results = [];
  for (const [, grievance] of cache.grievances) {
    if (grievance.status === 'filed' || grievance.status === 'gathering') {
      results.push(grievance);
    }
  }
  return results;
}

export function getThresholdGrievances() {
  const results = [];
  for (const [, grievance] of cache.grievances) {
    if (grievance.status === 'threshold' || grievance.status === 'deliberating') {
      results.push(grievance);
    }
  }
  return results;
}

export function getEnactedDecrees() {
  const results = [];
  for (const [, grievance] of cache.grievances) {
    if (grievance.status === 'enacted' || grievance.status === 'accepted') {
      results.push(grievance);
    }
  }
  return results;
}
```

---

## Council Deliberation Implementation

Council deliberation runs on the Serenissima side (Python). It is triggered when a grievance reaches "threshold" status. Venezia does not participate in deliberation -- it observes the outcome through Airtable status transitions.

### Implementation Location

The council deliberation logic is not yet extracted into a separate file in the Serenissima codebase. It will live alongside the governance handlers:

```
serenissima/backend/engine/handlers/governance.py        ← Contains council logic
serenissima/backend/engine/council_deliberation.py       ← NEW: extracted module
```

### Council Formation Interface

```python
# serenissima/backend/engine/council_deliberation.py (planned)

from typing import Dict, Any, List, Optional
from dataclasses import dataclass

@dataclass
class CouncilMember:
    username: str
    social_class: str
    wealth: float
    influence: float

@dataclass
class Council:
    members: List[CouncilMember]
    grievance_id: str
    formed_at: str  # ISO timestamp

@dataclass
class DeliberationResult:
    accepted: bool
    votes_for: int
    votes_against: int
    vote_records: List[Dict[str, str]]  # [{member, vote}]
    council: Council


def form_council(tables: Dict[str, Any], grievance: Dict[str, Any]) -> Council:
    """
    Form a 9-member council:
      3 Nobili (by wealth rank)
      3 Cittadini/Mercatores (by influence rank)
      3 Popolani/Facchini (by political activity)
    """
    COUNCIL_SIZE = 9
    all_citizens = tables['CITIZENS'].all()

    nobili = sorted(
        [c for c in all_citizens if c['fields'].get('SocialClass') == 'Nobili'],
        key=lambda c: c['fields'].get('Wealth', 0),
        reverse=True,
    )[:3]

    merchants = sorted(
        [c for c in all_citizens
         if c['fields'].get('SocialClass') in ('Cittadini', 'Mercatores')],
        key=lambda c: c['fields'].get('Influence', 0),
        reverse=True,
    )[:3]

    commons = sorted(
        [c for c in all_citizens
         if c['fields'].get('SocialClass') in ('Popolani', 'Facchini')],
        key=lambda c: count_grievance_supports(tables, c['fields']['Username']),
        reverse=True,
    )[:3]

    members = []
    for c in nobili + merchants + commons:
        members.append(CouncilMember(
            username=c['fields']['Username'],
            social_class=c['fields'].get('SocialClass', 'Popolani'),
            wealth=c['fields'].get('Wealth', 0),
            influence=c['fields'].get('Influence', 0),
        ))

    return Council(
        members=members,
        grievance_id=grievance['id'],
        formed_at=datetime.now(timezone.utc).isoformat(),
    )
```

### Council Vote Procedure

```python
# serenissima/backend/engine/council_deliberation.py (planned)

import random

# Class-category alignment scores
CLASS_CATEGORY_ALIGNMENT = {
    ('Nobili', 'economic'):       -0.20,
    ('Nobili', 'social'):         -0.10,
    ('Nobili', 'criminal'):       +0.10,
    ('Nobili', 'infrastructure'): +0.05,
    ('Cittadini', 'economic'):    +0.10,
    ('Cittadini', 'social'):      +0.15,
    ('Mercatores', 'economic'):   +0.15,
    ('Mercatores', 'criminal'):   +0.10,
    ('Popolani', 'economic'):     +0.20,
    ('Popolani', 'social'):       +0.20,
    ('Popolani', 'infrastructure'): +0.15,
    ('Facchini', 'economic'):     +0.25,
    ('Facchini', 'social'):       +0.15,
}


def council_deliberate(
    tables: Dict[str, Any],
    council: Council,
    grievance: Dict[str, Any],
) -> DeliberationResult:
    """
    Each council member votes. Probability of voting "for" is computed from:
    - Base: 0.50
    - Class-category alignment (see table above)
    - Wealth bias: wealthy members resist economic changes
    - Support momentum: high support count sways votes
    - Relationship with filer: trust score affects vote
    - Doge influence: mild push toward Doge's position
    """
    filer = grievance['fields'].get('Citizen', '')
    category = grievance['fields'].get('Category', 'economic')
    support_count = grievance['fields'].get('SupportCount', 0)

    votes_for = 0
    votes_against = 0
    vote_records = []

    for member in council.members:
        prob = 0.50

        # Class alignment
        alignment = CLASS_CATEGORY_ALIGNMENT.get(
            (member.social_class, category), 0.0
        )
        prob += alignment

        # Wealth bias
        if member.wealth > 50000 and category == 'economic':
            prob -= 0.15

        # Support momentum
        if support_count > 100:
            prob += 0.20
        elif support_count > 50:
            prob += 0.10

        # Trust with filer
        trust = get_trust_between_citizens(tables, member.username, filer)
        if trust > 70:
            prob += 0.10
        elif trust < 30:
            prob -= 0.10

        # Doge influence
        doge = get_current_doge(tables)
        if doge and member.username != doge['fields']['Username']:
            doge_pos = get_doge_position_on_grievance(doge, grievance)
            if doge_pos == 'favor':
                prob += 0.05
            elif doge_pos == 'oppose':
                prob -= 0.05

        # Clamp
        prob = max(0.05, min(0.95, prob))

        # Vote
        if random.random() < prob:
            votes_for += 1
            vote_records.append({'member': member.username, 'vote': 'for'})
        else:
            votes_against += 1
            vote_records.append({'member': member.username, 'vote': 'against'})

    return DeliberationResult(
        accepted=votes_for > votes_against,
        votes_for=votes_for,
        votes_against=votes_against,
        vote_records=vote_records,
        council=council,
    )
```

---

## Outcome Application to Airtable

When a council accepts a grievance, the outcome is applied directly to Airtable by the Serenissima backend.

### Outcome Determination

```python
# serenissima/backend/engine/council_deliberation.py (planned)

CATEGORY_OUTCOMES = {
    'economic': [
        {'type': 'tax_change',
         'details': {'direction': 'decrease', 'percentage': 10, 'duration_days': 30}},
        {'type': 'price_cap',
         'details': {'resource': None, 'duration_days': 14}},
        {'type': 'wage_floor',
         'details': {'min_wage': 10, 'duration_days': 30}},
    ],
    'social': [
        {'type': 'social_mobility_reform',
         'details': {'class_threshold_reduction': 0.10, 'duration_days': 60}},
        {'type': 'cultural_funding',
         'details': {'amount': 1000, 'recipients': 'Artisti', 'duration_days': 30}},
    ],
    'criminal': [
        {'type': 'trade_restriction',
         'details': {'restricted_activity': None, 'duration_days': 14}},
        {'type': 'fine_enforcement',
         'details': {'fine_amount': 100, 'target': None, 'duration_days': 7}},
    ],
    'infrastructure': [
        {'type': 'building_permit',
         'details': {'district': None, 'building_type': 'public', 'duration_days': 90}},
        {'type': 'repair_decree',
         'details': {'district': None, 'budget': 5000}},
    ],
}


def determine_governance_outcome(grievance: Dict[str, Any]) -> Dict[str, Any]:
    category = grievance['fields'].get('Category', 'economic')
    support_count = grievance['fields'].get('SupportCount', 0)

    possible = CATEGORY_OUTCOMES.get(category, [])
    if not possible:
        return {'type': 'declaration', 'details': {'message': grievance['fields']['Title']}}

    if support_count > 50 and len(possible) > 1:
        return possible[0]  # Most impactful
    return random.choice(possible)
```

### Applying Outcomes

```python
# serenissima/backend/engine/council_deliberation.py (planned)

def apply_governance_outcome(tables: Dict[str, Any], outcome: Dict[str, Any]):
    outcome_type = outcome['type']
    details = outcome['details']

    if outcome_type == 'tax_change':
        # Read current tax rate, adjust, write back
        current_rate = get_city_config(tables, 'tax_rate') or 5.0
        if details['direction'] == 'decrease':
            new_rate = max(0, current_rate - details['percentage'])
        else:
            new_rate = min(50, current_rate + details['percentage'])
        set_city_config(tables, 'tax_rate', new_rate)
        set_city_config(tables, 'tax_change_expires',
                        (datetime.now(timezone.utc) + timedelta(days=details['duration_days'])).isoformat())

    elif outcome_type == 'price_cap':
        resource = details.get('resource')
        if resource:
            market_price = get_market_price(tables, resource) or 10
            cap = market_price * 1.2
            contracts = get_active_sell_contracts_for_resource(tables, resource)
            for contract in contracts:
                if contract['fields'].get('PricePerResource', 0) > cap:
                    tables['CONTRACTS'].update(contract['id'], {'PricePerResource': cap})

    elif outcome_type == 'wage_floor':
        min_wage = details['min_wage']
        businesses = tables['BUILDINGS'].all(formula="{Category} = 'business'")
        for building in businesses:
            current_wages = building['fields'].get('Wages', 0)
            if 0 < current_wages < min_wage:
                tables['BUILDINGS'].update(building['id'], {'Wages': min_wage})

    elif outcome_type == 'cultural_funding':
        amount = details['amount']
        recipients_class = details['recipients']
        recipients = [
            c for c in tables['CITIZENS'].all()
            if c['fields'].get('SocialClass') == recipients_class
        ]
        if recipients:
            per_citizen = amount // len(recipients)
            for citizen in recipients:
                transfer_ducats(tables, 'city_treasury',
                                citizen['fields']['Username'],
                                per_citizen,
                                transaction_type='cultural_funding')

    # Additional outcome types follow same pattern...
```

### Writing the Decision Back to GRIEVANCES

```python
def apply_council_decision(
    tables: Dict[str, Any],
    grievance: Dict[str, Any],
    result: DeliberationResult,
):
    if result.accepted:
        outcome = determine_governance_outcome(grievance)
        tables['GRIEVANCES'].update(grievance['id'], {
            'Status':         'accepted',
            'ResolvedAt':     datetime.now(timezone.utc).isoformat(),
            'OutcomeType':    outcome['type'],
            'OutcomeDetails': json.dumps(outcome['details']),
        })
        apply_governance_outcome(tables, outcome)
        inject_governance_narrative(tables, grievance, outcome, 'accepted')
        if outcome_requires_enforcement(outcome):
            deploy_enforcement(tables, outcome)
    else:
        tables['GRIEVANCES'].update(grievance['id'], {
            'Status':     'rejected',
            'ResolvedAt': datetime.now(timezone.utc).isoformat(),
        })
        inject_governance_narrative(tables, grievance, None, 'rejected')
        # Rejection increases anger in supporters
        supporters = json.loads(grievance['fields'].get('Supporters', '[]'))
        for username in supporters:
            increase_citizen_anger(tables, username, amount=2)
```

---

## Narrative Graph Injection

Governance events are injected into the FalkorDB narrative graph via `physics-bridge.js` on the Venezia side. The physics engine consumes these nodes and edges to generate world events.

### FalkorDB Connection

```javascript
// cities-of-light/src/server/physics-bridge.js (planned)

import { Graph } from 'falkordb';

const FALKORDB_HOST  = process.env.FALKORDB_HOST || 'localhost';
const FALKORDB_PORT  = parseInt(process.env.FALKORDB_PORT || '6379');
const FALKORDB_GRAPH = process.env.FALKORDB_GRAPH || 'venezia';

let graph = null;

async function connectGraph() {
  const { FalkorDB } = await import('falkordb');
  const db = await FalkorDB.connect({ host: FALKORDB_HOST, port: FALKORDB_PORT });
  graph = db.selectGraph(FALKORDB_GRAPH);
  return graph;
}
```

### Injecting Governance Events

```javascript
// cities-of-light/src/server/physics-bridge.js (planned)

/**
 * @typedef {Object} GovernanceNarrativeEvent
 * @property {string} grievanceId
 * @property {string} title
 * @property {string} category
 * @property {number} supportCount
 * @property {string} decisionType   - "accepted" or "rejected"
 * @property {Object|null} outcome   - Outcome details if accepted
 */

/**
 * Inject a governance event into the FalkorDB narrative graph.
 * Called from serenissima-sync.js when a grievance status changes.
 *
 * @param {GovernanceNarrativeEvent} event
 */
async function injectGovernanceNarrative(event) {
  if (!graph) await connectGraph();

  if (event.decisionType === 'accepted') {
    // Create a Moment node (observable world change)
    await graph.query(`
      CREATE (m:Moment {
        id: $grievanceId,
        content: $content,
        energy: $energy,
        category: $category,
        source: 'governance',
        created_at: datetime()
      })
    `, {
      grievanceId: event.grievanceId,
      content:     `The Council has accepted: ${event.title}`,
      energy:      event.supportCount * 2,
      category:    event.category,
    });

    // Create RESOLVES edge to related Narrative
    const narrativeResult = await graph.query(`
      MATCH (n:Narrative)
      WHERE n.category = $category AND n.energy > 0
      RETURN n.id AS id
      ORDER BY n.energy DESC
      LIMIT 1
    `, { category: event.category });

    if (narrativeResult.data.length > 0) {
      const narrativeId = narrativeResult.data[0][0];
      await graph.query(`
        MATCH (m:Moment {id: $momentId}), (n:Narrative {id: $narrativeId})
        CREATE (m)-[:RESOLVES {weight: $weight}]->(n)
      `, {
        momentId:    event.grievanceId,
        narrativeId,
        weight:      event.supportCount,
      });
    }

  } else if (event.decisionType === 'rejected') {
    // Rejection amplifies tension. Pump energy into existing Narrative.
    const result = await graph.query(`
      MATCH (n:Narrative)
      WHERE n.category = $category AND n.energy > 0
      RETURN n
      ORDER BY n.energy DESC
      LIMIT 1
    `, { category: event.category });

    if (result.data.length > 0) {
      // Amplify by 3x the support count
      await graph.query(`
        MATCH (n:Narrative)
        WHERE n.category = $category AND n.energy > 0
        WITH n ORDER BY n.energy DESC LIMIT 1
        SET n.energy = n.energy + $delta
      `, {
        category: event.category,
        delta:    event.supportCount * 3,
      });
    } else {
      // No existing narrative: create one
      await graph.query(`
        CREATE (n:Narrative {
          id: $id,
          content: $title,
          energy: $energy,
          category: $category,
          source: 'governance_rejection',
          created_at: datetime()
        })
      `, {
        id:       `nar_${event.grievanceId}`,
        title:    event.title,
        energy:   event.supportCount * 3,
        category: event.category,
      });
    }

    // Create TENSION edge from filer to narrative
    await graph.query(`
      MATCH (c:Character {username: $citizen})
      MATCH (n:Narrative {category: $category})
      WITH c, n ORDER BY n.energy DESC LIMIT 1
      CREATE (c)-[:TENSION {weight: $weight, source: 'grievance_rejected'}]->(n)
    `, {
      citizen:  event.citizen,
      category: event.category,
      weight:   event.supportCount * 1.5,
    });
  }
}
```

### Triggering Graph Injection from Sync

```javascript
// cities-of-light/src/server/serenissima-sync.js (addition to broadcastDiff)

import { injectGovernanceNarrative } from './physics-bridge.js';

function broadcastDiff(diff) {
  // ... existing broadcast logic ...

  // Governance narrative injection
  for (const event of diff.updated) {
    if (event.table === 'grievances'
        && event.changed_fields
        && event.changed_fields.includes('status')) {
      const newStatus = event.record.status;
      if (newStatus === 'accepted' || newStatus === 'rejected') {
        injectGovernanceNarrative({
          grievanceId:  event.record.id,
          title:        event.record.title,
          category:     event.record.category,
          supportCount: event.record.supportCount,
          decisionType: newStatus,
          citizen:      event.record.citizen,
          outcome:      null,  // Venezia does not know outcome details
        });
      }
    }
  }
}
```

---

## Guard NPC Generation

When a governance outcome requires enforcement, the Serenissima backend creates guard NPCs in the CITIZENS table.

### Guard Creation (Python Side)

```python
# serenissima/backend/engine/council_deliberation.py (planned)

import uuid

def deploy_enforcement(tables: Dict[str, Any], outcome: Dict[str, Any]):
    deployments = []

    if outcome['type'] == 'price_cap':
        resource = outcome['details'].get('resource')
        market_buildings = get_buildings_selling_resource(tables, resource)
        for building in market_buildings:
            position = _get_building_position_coords(building)
            deployments.append({
                'location':  building['fields']['BuildingId'],
                'position':  position,
                'reason':    'price_cap_enforcement',
                'resource':  resource,
                'dialogue':  f"Council orders. {resource} prices are capped. No exceptions.",
            })

    elif outcome['type'] == 'trade_restriction':
        restricted = outcome['details'].get('restricted_activity')
        affected = get_buildings_for_activity(tables, restricted)
        for building in affected:
            position = _get_building_position_coords(building)
            deployments.append({
                'location':  building['fields']['BuildingId'],
                'position':  position,
                'reason':    'trade_restriction',
                'activity':  restricted,
                'dialogue':  f"By decree of the Council, {restricted} is restricted.",
            })

    elif outcome['type'] == 'fine_enforcement':
        target = outcome['details'].get('target')
        target_record = get_citizen_by_username(tables, target)
        if target_record:
            for building_id in [
                target_record['fields'].get('Home'),
                target_record['fields'].get('Work'),
            ]:
                if building_id:
                    building = get_building_by_id(tables, building_id)
                    position = _get_building_position_coords(building)
                    fine = outcome['details']['fine_amount']
                    deployments.append({
                        'location':  building_id,
                        'position':  position,
                        'reason':    'fine_collection',
                        'target':    target,
                        'fine':      fine,
                        'dialogue':  f"You owe {fine} ducats. Council decree.",
                    })

    for deployment in deployments:
        create_guard_npc(tables, deployment)

    return deployments


def create_guard_npc(tables: Dict[str, Any], deployment: Dict[str, Any]):
    guard_id = f"guard_{uuid.uuid4().hex[:12]}"
    expires = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()

    tables['CITIZENS'].create({
        'CitizenId':   guard_id,
        'Username':    guard_id,
        'Name':        'Guard of the Republic',
        'SocialClass': 'Guard',
        'Position':    format_position(deployment['position']),
        'Occupation':  'Enforcement',
        'Description': deployment['dialogue'],
        'IsNPC':       True,
        'SpawnedBy':   'governance_system',
        'SpawnReason': deployment['reason'],
        'ExpiresAt':   expires,
    })
```

### Guard Rendering in Venezia

Guards appear in the sync as citizens with `SocialClass = "Guard"`. The 3D client detects them and renders them differently.

```javascript
// cities-of-light/src/client/citizens/citizen-manager.js (planned)

/**
 * Determine rendering tier for a citizen.
 * Guards get special treatment: always ACTIVE tier with guard model.
 *
 * @param {CachedCitizen} citizen
 * @param {number} distanceFromVisitor - meters
 * @returns {{tier: string, model: string}}
 */
function assignCitizenTier(citizen, distanceFromVisitor) {
  // Guards are always visible within their patrol radius
  if (citizen.socialClass === 'Guard') {
    return {
      tier: 'ACTIVE',
      model: 'guard_venetian',
      animations: ['guard_idle', 'guard_alert'],
      props: ['halberd', 'lantern'],
      dialogueOnApproach: citizen.description, // "Council orders. No exceptions."
    };
  }

  // Regular citizen tier assignment by distance
  if (distanceFromVisitor < 5)   return { tier: 'FULL', model: 'citizen_full' };
  if (distanceFromVisitor < 20)  return { tier: 'ACTIVE', model: 'citizen_active' };
  if (distanceFromVisitor < 50)  return { tier: 'AMBIENT', model: 'citizen_ambient' };
  return { tier: 'BACKGROUND', model: 'citizen_billboard' };
}
```

### Guard Expiration

Guards have an `ExpiresAt` field. The Serenissima backend should periodically clean up expired guards:

```python
# serenissima/backend/engine/council_deliberation.py (planned)

def cleanup_expired_guards(tables: Dict[str, Any]):
    now = datetime.now(timezone.utc).isoformat()
    formula = f"AND({{IsNPC}} = TRUE(), {{SpawnedBy}} = 'governance_system', IS_BEFORE({{ExpiresAt}}, '{now}'))"
    expired = tables['CITIZENS'].all(formula=formula)
    for guard in expired:
        tables['CITIZENS'].delete(guard['id'])
    if expired:
        log.info(f"[Governance] Cleaned up {len(expired)} expired guards")
```

---

## Crowd Effects: Citizens Reacting to Governance

### Political Movement Detection in Venezia

Venezia detects movements by analyzing the grievance cache:

```javascript
// cities-of-light/src/server/physics-bridge.js (planned)

import { getActiveGrievances } from './venice-state.js';

/**
 * @typedef {Object} PoliticalMovement
 * @property {string} category
 * @property {number} grievanceCount
 * @property {number} totalSupport
 * @property {string} escalationLevel  - "low"|"medium"|"high"
 */

/**
 * Detect political movements from cached grievance data.
 * A movement exists when 3+ grievances in the same category have
 * a combined support count above 15.
 *
 * @returns {PoliticalMovement[]}
 */
function detectPoliticalMovements() {
  const grievances = getActiveGrievances();

  // Group by category
  const byCategory = {};
  for (const g of grievances) {
    const cat = g.category || 'economic';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(g);
  }

  const movements = [];

  for (const [category, grps] of Object.entries(byCategory)) {
    if (grps.length < 3) continue;

    const totalSupport = grps.reduce((sum, g) => sum + (g.supportCount || 0), 0);
    if (totalSupport < 15) continue;

    let escalationLevel = 'low';
    if (totalSupport > 100) escalationLevel = 'high';
    else if (totalSupport > 50) escalationLevel = 'medium';

    movements.push({
      category,
      grievanceCount: grps.length,
      totalSupport,
      escalationLevel,
    });
  }

  return movements;
}
```

### Crowd Gathering Rendering

When a political movement reaches "medium" or "high" escalation, the 3D client shows citizens clustering in public spaces.

```javascript
// cities-of-light/src/client/citizens/citizen-manager.js (planned)

/**
 * Apply crowd effects based on active political movements.
 * Called after each sync diff is received.
 *
 * @param {PoliticalMovement[]} movements
 * @param {Map<string, CachedCitizen>} citizens
 * @returns {Object[]} Crowd effect instructions for the renderer
 */
function computeCrowdEffects(movements, citizens) {
  const effects = [];

  for (const movement of movements) {
    if (movement.escalationLevel === 'high') {
      effects.push({
        type:     'gathering',
        location: 'doges_palace',     // Near the palace
        count:    Math.min(30, movement.totalSupport),
        mood:     'agitated',
        category: movement.category,
        // Particle effect: torches at night, raised fists
        particles: ['torch_glow', 'dust_feet'],
      });
    } else if (movement.escalationLevel === 'medium') {
      effects.push({
        type:     'gathering',
        location: 'piazza_san_marco', // Central piazza
        count:    Math.min(15, movement.totalSupport),
        mood:     'concerned',
        category: movement.category,
        particles: ['murmur_bubble'],
      });
    }
    // 'low' escalation: no visible gathering, only mood shift
  }

  return effects;
}
```

### District Mood from Governance

Active governance events shift the atmosphere of districts where they occur.

```javascript
// cities-of-light/src/client/atmosphere/district-mood.js (planned)

/**
 * @typedef {Object} GovernanceMoodModifier
 * @property {number} tensionDelta       - Added to district tension (0-1 scale)
 * @property {number} fogDensityDelta    - Added to fog density
 * @property {number} lightWarmthDelta   - Subtracted from light warmth (tension = cooler)
 * @property {string} ambientSound       - Additional ambient loop to play
 */

/**
 * Compute mood modifiers from governance state.
 *
 * @param {CachedGrievance[]} activeGrievances
 * @param {PoliticalMovement[]} movements
 * @returns {GovernanceMoodModifier}
 */
function computeGovernanceMood(activeGrievances, movements) {
  const modifier = {
    tensionDelta:     0,
    fogDensityDelta:  0,
    lightWarmthDelta: 0,
    ambientSound:     null,
  };

  // Base tension from grievance count
  const grievanceCount = activeGrievances.length;
  if (grievanceCount > 10) {
    modifier.tensionDelta += 0.15;
    modifier.fogDensityDelta += 0.05;
  } else if (grievanceCount > 5) {
    modifier.tensionDelta += 0.08;
  }

  // Movement escalation effects
  for (const movement of movements) {
    if (movement.escalationLevel === 'high') {
      modifier.tensionDelta += 0.25;
      modifier.fogDensityDelta += 0.10;
      modifier.lightWarmthDelta -= 0.15;
      modifier.ambientSound = 'crowd_murmur_intense';
    } else if (movement.escalationLevel === 'medium') {
      modifier.tensionDelta += 0.12;
      modifier.fogDensityDelta += 0.05;
      modifier.ambientSound = 'crowd_murmur_distant';
    }
  }

  // Clamp values
  modifier.tensionDelta = Math.min(0.5, modifier.tensionDelta);
  modifier.fogDensityDelta = Math.min(0.2, modifier.fogDensityDelta);
  modifier.lightWarmthDelta = Math.max(-0.3, modifier.lightWarmthDelta);

  return modifier;
}
```

---

## Integration with Citizen Conversations

When a visitor talks to a citizen, the citizen's awareness of governance events is injected into the Claude API call context.

```javascript
// cities-of-light/src/server/citizen-router.js (planned addition)

import {
  getActiveGrievances,
  getEnactedDecrees,
  getCitizen,
} from './venice-state.js';

/**
 * Build governance context for a citizen's conversation prompt.
 * Injected into the Claude API system prompt so the citizen can
 * reference current political events organically.
 *
 * @param {string} citizenUsername
 * @returns {string} Governance context paragraph
 */
function buildGovernanceContext(citizenUsername) {
  const activeGrievances = getActiveGrievances();
  const decrees = getEnactedDecrees();
  const citizen = getCitizen(citizenUsername);

  const lines = [];

  if (activeGrievances.length > 0) {
    const top3 = activeGrievances
      .sort((a, b) => b.supportCount - a.supportCount)
      .slice(0, 3);
    lines.push('Active grievances in the city:');
    for (const g of top3) {
      lines.push(`  - "${g.title}" (${g.category}, ${g.supportCount} supporters)`);
    }
  }

  if (decrees.length > 0) {
    lines.push('Current decrees in force:');
    for (const d of decrees) {
      lines.push(`  - ${d.title} (${d.status})`);
    }
  }

  if (citizen && citizen.socialClass === 'Guard') {
    lines.push('You are a Guard of the Republic. You enforce council decrees.');
    lines.push(`Your current assignment: ${citizen.description || 'patrol'}`);
  }

  return lines.join('\n');
}
```

### Claude API Call with Governance Context

```javascript
// cities-of-light/src/server/citizen-router.js (planned)

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate a citizen's response to the visitor.
 *
 * @param {CachedCitizen} citizen
 * @param {string} visitorText
 * @param {Object[]} memories
 * @returns {Promise<string>}
 */
async function generateCitizenResponse(citizen, visitorText, memories) {
  const governanceCtx = buildGovernanceContext(citizen.username);

  const systemPrompt = [
    `You are ${citizen.name}, a ${citizen.socialClass} citizen of Venice.`,
    `Occupation: ${citizen.occupation || 'none'}.`,
    `Wealth: ${citizen.ducats} ducats. Hunger: ${citizen.hungerLevel}/100.`,
    '',
    governanceCtx,
    '',
    'Speak naturally as a Renaissance Venetian. Keep responses to 2-4 sentences.',
    'Reference current events only if they affect you personally.',
  ].join('\n');

  const messages = [];

  // Inject recent memories as assistant context
  for (const mem of memories.slice(0, 5)) {
    messages.push({
      role: 'assistant',
      content: `[Memory: ${mem.summary}]`,
    });
  }

  messages.push({
    role: 'user',
    content: visitorText,
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages,
  });

  return response.content[0].text;
}
```

---

## Doge System

The Doge is identified by the Serenissima backend. Venezia reads the Doge's identity from the cache.

### Identifying the Doge from Cache

```javascript
// cities-of-light/src/server/venice-state.js (planned addition)

/**
 * Identify the current Doge: highest-scoring Nobili.
 * Score = 60% normalized wealth + 40% normalized influence.
 *
 * @returns {CachedCitizen|null}
 */
export function getCurrentDoge() {
  const nobili = [];
  for (const [, citizen] of cache.citizens) {
    if (citizen.socialClass === 'Nobili') {
      nobili.push(citizen);
    }
  }

  if (nobili.length === 0) return null;

  const maxWealth = Math.max(...nobili.map(c => c.wealth || 0)) || 1;
  const maxInfluence = Math.max(...nobili.map(c => c.influence || 0)) || 1;

  let bestScore = -1;
  let doge = null;

  for (const citizen of nobili) {
    const wNorm = (citizen.wealth || 0) / maxWealth;
    const iNorm = (citizen.influence || 0) / maxInfluence;
    const score = (wNorm * 0.6) + (iNorm * 0.4);
    if (score > bestScore) {
      bestScore = score;
      doge = citizen;
    }
  }

  return doge;
}
```

---

## Files Summary

### Serenissima (Python, writes)

| File | Status | Purpose |
|---|---|---|
| `backend/engine/handlers/governance.py` | Exists | Rule-based governance handler |
| `backend/engine/handlers/governance_kinos.py` | Exists | KinOS-enhanced governance handler |
| `backend/engine/activity_processors/support_grievance_processor.py` | Exists | Process support activities |
| `backend/engine/activity_creators/file_grievance_activity_creator.py` | Exists | Create file_grievance activities |
| `backend/engine/activity_creators/support_grievance_activity_creator.py` | Exists | Create support_grievance activities |
| `backend/engine/council_deliberation.py` | Planned | Council formation, voting, outcomes |
| `backend/engine/decrees/affectpublicbuildingstolandowners.py` | Exists | Decree application (example) |

### Venezia (Node.js, reads)

| File | Status | Purpose |
|---|---|---|
| `src/server/serenissima-sync.js` | Planned | Fetches GRIEVANCES, detects status changes |
| `src/server/venice-state.js` | Planned | Caches grievances, query functions |
| `src/server/physics-bridge.js` | Planned | Injects governance events into FalkorDB |
| `src/server/citizen-router.js` | Planned | Governance context in conversations |
| `src/client/citizens/citizen-manager.js` | Planned | Guard rendering, crowd effects |
| `src/client/atmosphere/district-mood.js` | Planned | Atmosphere from governance tension |
