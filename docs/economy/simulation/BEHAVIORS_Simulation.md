# BEHAVIORS -- Economic Simulation

> What the visitor experiences. Observable effects of a 24/7 autonomous economy.
> Written from the visitor's perspective. No implementation details, only what
> they see, hear, and discover.

---

## The Economy Moved While You Were Gone

The simulation runs continuously. When the visitor returns hours or days later,
the world has changed -- not from scripted "time passed" events, but because
186 citizens continued making autonomous decisions.

**GIVEN** the visitor last visited Venice 24 hours ago
**WHEN** they return and walk to the Rialto market
**THEN** they observe:
- Different goods on the stalls (yesterday's surplus fish is gone)
- A merchant who was thriving yesterday has closed his stall (bankruptcy)
- A new stall where an empty space was (citizen promoted to trader)
- Price changes audible: "Three Ducats for bread? It was two last week!"

No changelog, no notification. The visitor discovers changes through
observation and conversation.

---

## Citizens Going to Work

**GIVEN** the visitor is near a residential district at dawn
**WHEN** they observe citizen movement
**THEN** they see:
- Citizens leaving doorways, walking purposefully along streets and bridges
- Bakers to bakeries, fishermen to docks, merchants to stalls
- Citizens walking at different speeds -- rushing means late or anxious
- Greetings en route: "Morning, Marco. Heard the grain shipment is late."

**GIVEN** the visitor follows a glassblower to the Murano workshops
**WHEN** the citizen arrives
**THEN** they observe the citizen taking position at the workshop, activity
changing from walking to producing, ambient sounds shifting (furnace, glass,
tools). If spoken to: "Can't talk long -- this batch needs constant heat."

---

## Market Activity and Trading

**GIVEN** the visitor walks through the Rialto during business hours
**WHEN** they observe the market
**THEN** they see:
- Stalls with physical goods (crates, baskets, fabric, hanging fish, spices)
- Sellers behind stalls, buyers browsing, transactions animated
- Stall variety reflects actual production -- no shoes if nobody makes shoes

**GIVEN** a trade route has been disrupted (galley delay, supplier lockout)
**WHEN** the visitor visits the market
**THEN** affected stalls are sparse or empty. Vendors explain: "The galley
from the East is three days late. I have nothing to sell."

---

## Price Changes and Citizen Complaints

Prices emerge from supply and demand, not designer settings.

**GIVEN** the price of bread has risen 40%
**WHEN** the visitor walks near a food stall
**THEN** they hear citizens complaining ("I cannot feed my family"), the baker
explaining ("Grain costs me more"), and wealthier citizens dismissing it
("Still cheaper than during the last shortage").

**GIVEN** a luxury good has oversupplied
**WHEN** the visitor visits those stalls
**THEN** multiple merchants undercut each other, calling out lower prices.
One mutters: "That Florentine is selling silk at a loss to steal my customers."

Prices are never shown as numbers. The visitor infers movement from behavior.

---

## Resource Scarcity

**GIVEN** fish supply has dropped to 30% of demand
**WHEN** the visitor walks through the fish market
**THEN** most stalls are empty, queues form at the few active ones, citizens
leave empty-handed. A fisherman explains: "The catch was poor."

**GIVEN** timber is scarce
**WHEN** the visitor walks past a building site
**THEN** construction has stalled -- scaffolding idle, no workers. If asked:
"No timber. The sawmill owner's supplier was bought out by a Nobili."

Scarcity propagates. Timber affects construction, which affects housing,
which affects rent, which affects mood. The visitor sees downstream effects
without being told the upstream cause.

---

## Wealth Inequality

**GIVEN** the visitor walks from San Marco (wealthy) to Castello (poor)
**WHEN** they observe citizen appearance and housing
**THEN** the contrast is clear:
- Wealthy: finer clothing, larger homes, confident gait, deference from others
- Poor: muted clothing, smaller homes in disrepair, hurried, resigned or angry

**GIVEN** the visitor asks a merchant and an artisan about the city
**THEN** responses reveal inequality:
- Merchant: "Venice has never been more prosperous."
- Artisan: "Prosperous for whom? I work dawn to dusk and can barely afford rent."

Class is expressed through behavior, not labels. No text says "Nobili."

---

## Stratagems Playing Out

Competitive moves produce visible consequences, not abstract effects.

**Price undercutting:** Citizen A's stall has more customers; Citizen B's is
quiet, the merchant agitated. B says: "That rat is selling below cost to
drive me out." A says: "I offer fair prices."

**Supplier lockout:** Citizen D's workshop is idle. D is angry: "My supplier
told me he has an exclusive contract now. With whom? He would not say."

**Monopoly pricing:** One dominant stall, no competitors. Buyers grumble but
purchase: "Where else would I go?" Others whisper: "Do not cross him."

**Reputation assault:** Citizens repeat gossip about the target. The target is
defensive: "Lies. All of it. I know who started this."

The visitor never sees the stratagem mechanism. They see social aftermath.

---

## Economic Cycles: Boom and Bust

### Boom Phase

**GIVEN** the economy is expanding
**WHEN** the visitor walks through the city
**THEN** markets are busy, stalls well-stocked, new construction visible,
citizens discuss expansion plans, luxury goods selling, taverns full.

### Bust Phase

**GIVEN** the economy has contracted
**WHEN** the visitor walks through the city
**THEN** empty stalls, shuttered businesses, halted construction, citizens
discuss hardship ("Three workshops closed this week"), more grievances
being filed, taverns emptier.

### Transition

The shift is gradual across visits. First: a few stalls close. Second visit:
more closures, optimism turns to caution. Third visit: citywide mood shift,
conversations about survival not opportunity. The visitor pieces together the
narrative from observations across visits.

---

## Bankruptcy

**GIVEN** a citizen has gone bankrupt
**WHEN** the visitor encounters them
**THEN** they observe:
- Citizen no longer at their former workplace
- Their stall is empty or taken by another citizen
- Clothing has degraded (simpler, duller)
- Located at a lower-status position (back alley, church steps)
- If spoken to: "I had a good business once. Now I look for day labor."
- Other citizens reference it: "Did you hear about Giovanni? Lost everything."

---

## Galley Arrivals and Departures

**GIVEN** a galley has arrived with goods
**WHEN** the visitor is near the docks
**THEN** they see a vessel at the pier, Facchini unloading crates, merchants
negotiating. Citizens discuss cargo: "Finally, the spice shipment."

**GIVEN** an expected galley has not arrived
**WHEN** the visitor asks merchants
**THEN** they hear: "The Eastern galley is overdue. If it does not arrive by
Friday, I will have to raise prices."

Galley disruptions cascade. The visitor who understands this can predict
market changes.

---

## What Does NOT Happen

- **No price tags.** Prices are never displayed as numbers in the world.
- **No economy dashboard.** No GDP panel, no inflation chart.
- **No visitor participation.** No Ducats, no buying, no selling. Forestiero.
- **No scripted events.** Crashes emerge from 186 autonomous agents.
- **No resets.** Monopolies persist until dismantled. Bankruptcy is permanent
  until rebuilt.

---

## Testing Economic Behaviors

**GIVEN** the sync cache contains 0 active sell contracts for "fish"
**WHEN** the 3D renderer evaluates fish market stalls
**THEN** those stalls display empty shelves or are visually closed.

**GIVEN** a citizen has activity type "production" at building X
**WHEN** the 3D renderer positions that citizen
**THEN** the citizen avatar is at building X with a production animation.

**GIVEN** a citizen's food expenditure exceeds 50% of income
**WHEN** the visitor speaks to them
**THEN** their KinOS context includes economic hardship; their response
references food prices or financial struggle.

**GIVEN** two citizens -- one with 5000 Ducats (Nobili), one with 50 (Popolani)
**WHEN** both are rendered
**THEN** the Nobili has richer clothing textures. Distinction visible at 10m.

**GIVEN** a citizen has 0 Ducats and no employment contract
**WHEN** rendered
**THEN** positioned at a low-status location with degraded clothing and
distressed mood animation.
