# BEHAVIORS -- Economy Sync

> What the visitor experiences. The sync layer should be invisible. If the
> visitor notices the sync, something is wrong. This document describes what
> the visitor sees when sync works, what they see when it breaks, and the
> narrow seams where staleness might leak through.

---

## Core Principle: Sync Is Invisible Infrastructure

The visitor does not know Airtable exists. They do not know there is an
Express server caching data. They do not know the world state refreshes every
15 minutes. They experience a living city. The sync layer's job is to
maintain that illusion absolutely.

If a visitor ever thinks "this feels laggy" or "why did that citizen teleport,"
the sync layer has failed.

---

## Real-Time Updates: What the Visitor Sees

### Citizen Position Changes

**GIVEN** a citizen has moved from the Rialto to their home in Castello
**WHEN** the next sync cycle completes (within 15 minutes)
**THEN** the visitor observes:
- The citizen is now at their home, not at the Rialto
- The transition is not instantaneous -- the citizen walks along a plausible
  route between the two locations
- If the visitor is watching at the moment the sync resolves, the citizen
  smoothly adjusts their path. No teleportation, no pop-in

The 3D client interpolates between last known and new synced position,
following pathfinding along streets and bridges. Citizens do not walk through
walls or across water.

### Citizen Activity Changes

**GIVEN** a citizen was producing goods (activity: production) and is now
  walking to market (activity: goto_location)
**WHEN** the sync delivers the new activity
**THEN** the citizen stops their production animation, begins walking toward
the market. If asked en route: "Just finished a batch of glass beads. Taking
them to market before the afternoon crowd."

Activity transitions feel natural. No freezing, no glitch, no reset.

### Building and Stall Updates

**GIVEN** a building has changed ownership
**WHEN** the sync delivers the updated record
**THEN** the building's signage or displayed goods change to reflect the new
owner. The change is applied during a natural visual break (camera turn,
district transition). If the visitor is not looking, they never notice.

---

## Data Freshness: The 15-Minute Window

The world state can be up to 14 minutes and 59 seconds stale. The visitor
should never feel this.

**GIVEN** a citizen completed a trade 10 minutes ago but sync has not run
**WHEN** the visitor asks that citizen what they are doing
**THEN** the response is plausible for either state:
- "I was at the market earlier, negotiating a deal." (references past)
- "Just wrapping up some business." (vague, covers the gap)

Citizens speak in terms of recent past ("I sold goods this morning") rather
than exact present ("I am selling right now"). This linguistic softness
absorbs the staleness.

### What the Visitor Should Never Experience

- A citizen claiming to be at the market while visibly at home
- A stall displaying goods sold 14 minutes ago in Airtable
- Two citizens contradicting each other about the same transaction
- A citizen's wealth claims contradicting their visible clothing quality

The atomic cache swap prevents partial-state rendering. The visitor sees
the old state or the new state, never a mix.

---

## Diff Events: Observable World Changes

When the sync computes a diff, certain changes produce observable effects.

### Citizen Promoted (class change)

**GIVEN** a Popolani has been promoted to Cittadini
**WHEN** the diff detects the class field change
**THEN** the visitor observes over subsequent visits:
- Improved clothing quality
- Citizen seen at different locations (guild halls instead of workshops)
- Others acknowledge it: "Marco is a Cittadino now. Moving up."
- Citizen references it: "The guild accepted my petition."

### Building Changes Ownership

**GIVEN** the BUILDINGS table shows a new owner for a warehouse
**WHEN** the diff detects the ownership change
**THEN** the warehouse's displayed goods or signage change. Previous owner,
if encountered: "I sold the warehouse. Could not afford the upkeep." New
owner: "Just bought a warehouse near the docks. Good location."

### Contract Created or Completed

**GIVEN** a new public sell contract for silk appears
**WHEN** the diff detects the new record
**THEN** a new stall section displays silk. The seller is positioned there.

**GIVEN** a trade completes
**WHEN** the diff detects the status change
**THEN** goods are removed from the seller's stall. The buyer carries goods
away from the market.

### New Grievance Filed

**GIVEN** a new grievance appears in the table
**WHEN** the diff detects it
**THEN** an `event_alert` fires. A citizen is seen agitated near a notice
board. If the visitor is in that district, ambient tension shifts (slightly
darker lighting, more urgent sound). Citizens discuss the issue.

### Bankruptcy Event

**GIVEN** the diff detects a citizen's Ducats at 0 with no employment
**WHEN** the `event_alert` fires
**THEN** the citizen is no longer at their former position. Their stall or
workshop is empty. Others reference it: "Another one gone. Third this month."

---

## Sync Failure: Graceful World Freeze

### Short Outage (one missed cycle)

**GIVEN** Airtable is unreachable for one 15-minute cycle
**WHEN** the sync fails and retries next interval
**THEN** the visitor observes nothing unusual. The world renders from the
stale cache. Citizens stay at current positions doing current activities.
The world feels slightly static but is indistinguishable from a quiet
period. When sync recovers, citizens walk to new positions, stalls update,
diff events fire.

### Extended Outage (multiple missed cycles)

**GIVEN** Airtable is unreachable for over an hour
**WHEN** the visitor is in the world
**THEN** they observe:
- Citizens repeat current activities indefinitely
- No new events: no trades, no grievances, no movement
- The world feels "frozen in amber" -- beautiful but still
- If spoken to, citizens respond based on last known state
- When sync recovers, the world updates atomically. A burst of changes:
  citizens in new positions, stalls restocked, grievances posted. The
  city "wakes up."

### What Does NOT Happen During Failure

- No error messages in the world
- No "Connection Lost" banner
- No degraded rendering quality
- No citizens freezing mid-animation (they loop current animation)
- No empty world (citizens remain from cache)
- No partial updates (atomic swap: all-or-nothing)

---

## Sync Seams: Where the Visitor Might Notice

### Seam: Citizen References Outdated Information

**Mitigation:** Citizens speak in past tense about economic actions. "I sold
goods this morning" is safe. "I am selling goods right now" is risky.

### Seam: Visitor Watches a Citizen at Sync Moment

**GIVEN** the visitor is staring at a citizen when sync resolves
**AND** the citizen's position changed significantly
**THEN** the citizen must walk to new position, not teleport.

**Mitigation:** The client plots a walking path. Speed accelerates up to 2x
for large distances. If gap exceeds 500 meters, the citizen is despawned
from old location and spawned at new one during a moment the visitor is
not looking.

### Seam: Stall Inventory Visual Pop

**GIVEN** a stall displays goods from old cache, now sold in new cache
**THEN** goods fade out over 2 seconds rather than popping. If the visitor
is not looking, the change is instant.

---

## Testing Sync Behaviors

**GIVEN** the sync module runs on a 15-minute cycle
**WHEN** an observer monitors the world for one hour
**THEN** no citizen teleports, no stall inventory pops, no errors appear.
All state changes manifest as smooth transitions.

**GIVEN** Airtable API is blocked (firewall rule)
**WHEN** the sync fails
**THEN** the Express server serves stale cache. Client renders normally.
Citizens loop animations. No crashes, no client console errors.

**GIVEN** a sync is in progress (fetching table 3 of 6)
**WHEN** the client requests citizen data via WebSocket
**THEN** the client receives data from the previous complete cache, not
partial. The response is internally consistent.

**GIVEN** previous cache: Citizen X at building A, activity "production"
**AND** new cache: Citizen X at building B, activity "goto_location"
**WHEN** the diff is computed
**THEN** a `citizen_update` WebSocket event emits with citizen ID, new
position, and new activity. Client animates the walk from A to B.

**GIVEN** sync failed for 3 consecutive cycles (45 minutes)
**AND** Airtable becomes reachable
**WHEN** the next sync completes
**THEN** the diff contains all accumulated changes. Multiple events fire.
The world catches up within 60 seconds.

---

## Summary

| Situation | Visitor Experience |
|---|---|
| Normal operation | Living city, smooth transitions, no lag |
| Single missed sync | No perceptible difference |
| Extended outage | City feels quiet and still, not broken |
| Recovery after outage | Burst of activity -- city "wakes up" |
| Citizen position change | Citizen walks to new position along streets |
| Stall inventory change | Goods appear or fade smoothly |
| Building ownership change | Signage updates between glances |
| New grievance | Citizen at notice board, ambient tension shifts |
| Bankruptcy | Former workspace empty, citizen relocated |

The sync layer succeeds when the visitor forgets it exists.
