# BEHAVIORS: narrative/events -- Observable Effects

What a world event looks and sounds like. Not what the system emits. Not what the event descriptor contains. What the visitor standing in a Venetian piazza actually experiences when the world breaks open around them.

---

## B1. Event Types -- What Each One Feels Like

### Economic Crisis

GIVEN an economic_crisis Moment flips at Rialto with severity 0.5 (NOTABLE)
WHEN the visitor is present
THEN within 5 minutes:
- Market stalls close their shutters. Merchants pull goods from display.
- Citizens cluster in groups of 2-4, speaking in low, worried voices.
- Spatial audio shifts: market calls drop out, replaced by murmuring and occasional sharp arguments.
- Fog increases. Light takes on a grey quality.
- If the visitor approaches a merchant: "Not now. I don't know if I'll still have a stall tomorrow."

### Political Uprising

GIVEN a political_uprising Moment flips at Dorsoduro with severity 0.6 (MAJOR)
WHEN the visitor is present
THEN within 5 minutes:
- Citizens converge on the central piazza. Foot traffic reverses inward.
- Voices rise. Spatial audio fills with shouting, chanting, stamping feet.
- Citizens divide into groups: those shouting demands, those watching, those leaving.
- Guards appear at entrances. The visitor, caught in the crowd, is jostled.
- If the visitor speaks to a participant: "This has been coming for months!"
- If the visitor speaks to a bystander: "Stay out of it. This is not your fight, Forestiere."

### Celebration

GIVEN a celebration Moment flips at San Marco with severity 0.5 (NOTABLE)
WHEN the visitor is present
THEN within 5 minutes:
- Music begins. Citizens gather with open posture, laughter audible.
- Lanterns appear along colonnades if evening. Garlands on stalls and balconies.
- Fog clears. Light shifts warm and golden. Citizens greet the visitor more warmly.
- "Forestiere! Come, have a drink! Even strangers are welcome tonight!"

### Personal Tragedy

GIVEN a personal_tragedy Moment flips centered on a specific citizen with severity 0.4
WHEN the visitor is nearby
THEN:
- The affected citizen is visible in distress -- sitting on the ground, staring at nothing.
- A circle of stillness radiates from them. Ambient noise drops within 10 meters.
- Some citizens approach to comfort; others avert their eyes and walk faster.
- If the visitor asks a bystander: "Something terrible happened to old Francesco. He lost everything."

### Guild Dispute

GIVEN a guild_dispute Moment flips with severity 0.5
WHEN the visitor enters the affected area
THEN:
- Workshops have doors closed during business hours. Production sounds are absent.
- Guild members argue in a courtyard. Non-guild citizens avoid the area.
- If the visitor asks a guild member: "We'll sort this ourselves. No outsiders."

### Trade Disruption

GIVEN a trade_disruption Moment flips at the port with severity 0.6
WHEN the visitor walks the waterfront
THEN:
- Docks are unusually empty. Mooring points vacant. Dock cranes still.
- Workers stand idle against warehouses. Harbor sounds diminish.
- Merchants display reduced inventory. "No ships for three days. Some say pirates. Some say politics."

---

## B2. How Events Propagate

Events do not become instantly known. Information moves at the speed of human conversation, constrained by trust and geography.

GIVEN an economic crisis flips at Rialto at T=0:

**T=0:** Citizens who witnessed it know immediately. "I was right there when the guild master collapsed." Confidence is total.

**T=15 minutes:** Citizens in Rialto who trust the witnesses have heard. "Giovanni told me the market shut down." Confidence is high but minor details may be wrong.

**T=1 hour:** Citizens in adjacent districts with social ties know. "I heard there was trouble at Rialto. Something about the guilds." Details are vague.

**T=3 hours:** Most citizens city-wide are aware through trust chains. Rumors have attached to facts. "The Rialto guild is bankrupt." / "There was a riot at the market." (There was no riot.)

**T=6 hours:** Universal awareness. The most distant accounts bear little resemblance to the original.

### The Visitor as Newsbearer

GIVEN the visitor witnessed an event at Rialto
WHEN they travel to Cannaregio and speak to a citizen who has not heard
THEN the citizen reacts: "What? The market closed? When did this happen?" The visitor carries information faster than the social graph propagates it, becoming an unwitting newsbearer.

### Distortion Is a Feature

GIVEN news has propagated 3 hops through the social graph
THEN accounts contain inaccuracies. Original: a guild representative collapsed during an argument. Third hop: "The guild is at war with the Council. People are getting killed." The visitor must cross-reference multiple sources to determine accuracy.

---

## B3. Citizen Reactions to Events

### Reactions Depend on Proximity

GIVEN an event in a citizen's home district, their reaction is immediate and strong -- they are participants, not observers. A citizen in a distant district with no personal stake says: "Sounds bad. Not my problem though."

### Reactions Depend on Belief Alignment

GIVEN a political uprising occurs:
- A citizen with aligned beliefs: "Finally! Someone is standing up to them!"
- A citizen with opposing beliefs: "Troublemakers. They'll ruin everything."

The visitor observes the city splitting along belief lines in response to the same event.

### Reactions Depend on Social Class

GIVEN an economic crisis affects all citizens, the visitor hears five perspectives:
- **Nobili:** "This is a temporary setback. The Council will manage it."
- **Cittadini:** "We need to act carefully. Our contracts depend on recovery."
- **Popolani:** "We'll be the ones who starve. Same as always."
- **Facchini:** "No work today. No work tomorrow. What are we supposed to eat?"
- **Forestieri:** "This is why I keep my goods on the ship until the last moment."

Same event. Five lived experiences. The visitor hears the city's class structure through its crisis response.

---

## B4. Atmosphere Changes During Events

Events change the quality of the world -- its light, sound, density, and feeling.

**Economic crisis (severity 0.6):** Fog increased. Light reduced 15%. Ambient volume down 20%. The district is heavier, quieter, greyer.

**Celebration (severity 0.5):** Fog cleared. Light warm and golden. Ambient volume up 30%. Music, laughter, glasses clinking.

### Emergence and Settlement

Events ease in and ease out. They do not snap on and off.

**EMERGING (0-5 min):** Effects at 50% intensity. A few citizens react. The visitor senses something starting.
**ACTIVE (5-60 min):** Full intensity. The district is transformed. Most citizens reacting.
**SETTLING (1-6 hours):** Effects fade linearly. Citizens return to routines but still reference the event.
**AFTERMATH (6-24 hours):** No atmospheric effects. Citizens still discuss it. Visible scars remain: a closed stall, a boarded window.

---

## B5. Forestiere News

Venice is not an island of narrative. Ships arrive bearing news from Constantinople, Genoa, the Holy Land.

GIVEN a Forestiere news event ("The Sultan has closed the Silk Road to Venetian merchants")
WHEN it enters the world:

**At the docks:** A newly arrived merchant speaks in agitated tones. Travel-worn clothes, foreign accent. "The Sultan has cut us off. No silk, no spices."

**Within 1-2 hours:** Rialto citizens discuss implications. Merchants rush to buy or sell remaining stock.

**Within 3-6 hours:** The news reaches citizens with no direct stake. "I heard something about the Sultan. What does that mean for us?" Interpretation varies by class.

**After 24 hours:** The news is absorbed into the graph. It is no longer news but a belief feeding existing tensions. "Ever since the Sultan's decree, things have not been the same."

Forestiere news arrives at most once per day. It is a distant rumble, not a constant stream.

---

## B6. Event Aftermath -- Scars on the World

### Physical Scars

GIVEN an economic crisis closed market stalls
WHEN the event moves to AFTERMATH
THEN some stalls reopen when the economic simulation restores trade flow (hours to days). Some may not reopen at all. The empty stall remains -- a visible scar. Citizens reference it: "That's where Bernardo's workshop used to be."

### Social Scars

GIVEN a political uprising was resolved
THEN citizens who were on opposite sides still avoid each other. Trust between formerly allied citizens may be damaged. New alliances formed during the crisis persist.

### Narrative Scars

GIVEN any event has moved to RESOLVED status (24+ hours)
THEN it exists as memory: "The market crisis? That was weeks ago. We've recovered. Mostly." The graph has absorbed the consequences. The moment itself is historical, but its children -- new narratives, new tensions -- are alive.

---

## B7. Maximum Concurrent Events

GIVEN 3 events are ACTIVE
WHEN a 4th Moment flips:
- Lower severity than all 3: suppressed until a slot opens.
- Higher severity than the weakest: preempts it. The weakest event's effects end immediately.

The visitor experiences a world with at most 3 simultaneous dramatic situations. A city with 7 crises is noise, not drama.

GIVEN 3 ACTIVE events in 3 different districts
WHEN the visitor walks between them
THEN each district feels distinctly different. The contrast is itself dramatic.

---

## B8. Testable Observations

### Event Manifestation Test

GIVEN an economic_crisis flips at Rialto at severity 0.5
WHEN the visitor enters within 5 minutes
THEN at least 3 of: stalls closed, citizens in worried posture, ambient volume decreased, fog increased, a citizen references the crisis unprompted.

### Propagation Timing Test

GIVEN an event flips at Rialto at T=0
THEN: T=0: all witnesses aware. T=15m: 60%+ of district aware. T=1h: at least 1 citizen in adjacent district aware. T=6h: 90%+ city-wide awareness.

### Distortion Test

GIVEN news propagated 3+ hops
THEN the account differs from the original in at least one factual detail but is still recognizably about the same event.

### Atmosphere Lifecycle Test

GIVEN a NOTABLE event begins
THEN: EMERGING (0-5m): effects subtle. ACTIVE (5-60m): full intensity. SETTLING (1-6h): fading linearly. AFTERMATH (6+h): no effects, conversation persists.

### Forestiere News Test

GIVEN Forestiere news injected at the docks at T=0
THEN: T=0: only dock area aware. T=1h: Rialto trade citizens discussing. T=6h: city-wide with decreasing accuracy. No non-social channel delivers the news.

### Scar Persistence Test

GIVEN an economic crisis closed 5 stalls
WHEN the event reaches RESOLVED
THEN at least 1 stall remains closed. The event system does not restore it -- only the economic simulation can.

### Class-Differentiated Reaction Test

GIVEN a city-wide crisis
WHEN the visitor speaks to one citizen of each social class
THEN each response reflects the class perspective. No two class responses are interchangeable.
