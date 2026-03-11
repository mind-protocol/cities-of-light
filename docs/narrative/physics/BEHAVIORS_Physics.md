# BEHAVIORS: narrative/physics -- Observable Effects

What the physics tick produces that the visitor can witness. The visitor never sees a number. Never sees an energy bar. Never reads a tension score. They see citizens getting agitated. They feel a district darkening. They hear the same argument from five different people in one afternoon. Then something breaks. That is the physics, made flesh.

---

## B1. Tension Building Over Time

The physics tick runs every 5 minutes. Each tick, citizens pump energy into their beliefs. Energy flows through connections. Tension accumulates between contradicting beliefs. None of this is instantaneous.

GIVEN a district has two opposing belief clusters (e.g., "the tariffs protect us" vs. "the tariffs are strangling trade")
WHEN 12 ticks pass (1 hour)
THEN the visitor observes a gradual escalation:
- Tick 1-4: Conversations are normal. The opposing beliefs exist but are not dominant.
- Tick 5-8: The topic surfaces more often. A merchant mentions tariffs unprompted. Ambient volume rises slightly.
- Tick 9-12: The topic dominates. Citizens who hold opposing views argue when forced together. District fog thickens. Ambient audio carries an edge.

The visitor perceives this as "things are getting tense around here." They do not perceive "energy has accumulated in TENSION edges over 12 physics ticks."

### Pressure Is Not Linear

GIVEN tension is building between two narrative clusters
WHEN one cluster receives an energy injection from an economic event
THEN the escalation accelerates visibly. Citizens on the affected side become more vocal within 1-2 ticks.

GIVEN both sides lose energy (a new topic emerges that draws attention away)
THEN tension plateaus or slowly recedes. The district atmosphere eases. Fog thins. The visitor senses relief, though nothing was explicitly resolved.

---

## B2. Moment Flips -- When the World Breaks

GIVEN a Moment's salience exceeds its threshold during a physics tick
WHEN the flip occurs
THEN the world changes in ways the visitor can directly observe:

**For an economic_crisis flip at Rialto:**
- Market stalls close their shutters. Merchants stand idle, speaking in low voices.
- Ambient sound drops sharply -- murmurs and silence replace market bustle.
- Fog thickens. Light dims. If the visitor approaches a merchant: "Not now. I don't know if I'll still have a stall tomorrow."

**For a political_uprising flip at Dorsoduro:**
- Citizens converge on the central piazza. Voices rise with shouting and chanting.
- Citizens divide into visible groups. Guards appear. The visitor, caught in the crowd, is jostled.

**For a celebration flip at San Marco:**
- Music begins. Citizens gather with open posture. Lanterns light if evening. Colors brighten. Citizens greet the visitor more warmly.

### The Flip Is Not Announced

There is no notification, no popup, no event banner. The visitor discovers the flip by being present or by arriving after and hearing about it from citizens.

GIVEN a moment flips in a district the visitor is not in
THEN they learn about the event only through citizens who heard the news, or by walking to the affected district. If the visitor never goes and never asks, they may miss the event entirely. This is authentic.

---

## B3. Decay -- The World Forgets

GIVEN a narrative has high energy (0.5+) at time T
WHEN no citizen reinforces it and no economic event feeds it
THEN energy decays at approximately 2% per tick. The visitor observes citizens losing interest:
- Hour 1: "The tariffs are destroying us! Something must be done!"
- Hour 3: "The tariffs are a problem, yes, but what can we do?"
- Hour 6: "The tariffs? I suppose they're still there. I have other worries now."
- Hour 12: The citizen no longer mentions tariffs unless directly asked.

### Grudges and Debts Linger

GIVEN a narrative of type "grudge," "debt," "oath," or "alliance"
WHEN no reinforcement occurs
THEN decay is approximately 4x slower. A citizen still talks about a debt from three days ago: "He still owes me. I haven't forgotten." A grudge that should have faded persists: "I know what she did last spring. Don't tell me to move on."

### Decay Creates Space for New Stories

GIVEN multiple high-energy narratives occupy a citizen's attention
WHEN the oldest ones decay below threshold
THEN topics that were crowded out now surface. The visitor who returns after a few days finds a city that has moved on. New concerns have taken its place. The world breathes.

---

## B4. Energy Flow -- Beliefs Spreading and Dying

### Popular Beliefs Gaining Strength

GIVEN a narrative is held by many citizens with moderate confidence
WHEN the physics tick routes energy through SUPPORTS edges
THEN connected narratives gain energy, amplifying the belief cluster:

- Visit 1: One merchant complains about foreign competition.
- Visit 2: Three merchants near the same stall echo similar complaints.
- Visit 3: A guild representative is organizing a petition. Citizens reference each other's arguments.

The belief has not changed. But more citizens now hold it more strongly. The visitor perceives a movement forming.

### Unpopular Beliefs Dying

GIVEN a narrative is held by only 1-2 citizens at low confidence
WHEN no economic event reinforces it
THEN the narrative decays toward zero. The lone believer mentions their position less frequently. Other citizens dismiss the topic: "Marco and his theories. Nobody listens." Eventually, even Marco stops bringing it up.

### Energy Backflow to Citizens

GIVEN a citizen has pumped significant energy into their beliefs over many ticks
WHEN those beliefs have high energy and the citizen's personal energy is low
THEN excess energy flows back. The visitor observes this as citizens deeply invested in a cause appearing energized by it -- animated, passionate, tireless -- even when their economic situation is poor. A citizen whose beliefs are all decaying appears listless and without direction.

---

## B5. The 5-Minute Tick Creates Drama Without Scripting

No event is authored. No crisis is scheduled. The physics tick runs every 5 minutes, applying deterministic rules to the graph, and drama emerges from the interaction of beliefs, tensions, economic pressures, and thresholds.

GIVEN a visitor spends 1 hour in the world
THEN they experience approximately 12 ticks. Tension has accumulated perceptibly in at least one district. At least one narrative has crossed the awareness threshold. There is a non-trivial chance (roughly 15-30% per hour) that a Moment flips and produces a dramatic event.

### The Tick Is Invisible

GIVEN the physics tick fires at time T
WHEN the visitor is mid-conversation with a citizen
THEN the citizen's behavior does not visibly "update" at tick boundaries. Changes manifest gradually: the next response reflecting slightly updated mood, atmospheric adjustments fading in over 30-60 seconds, other citizens shifting at slightly different times. There is no visible "pulse."

### Emergent Pacing

The homeostasis mechanisms (decay, threshold escalation, cooldown periods) produce a natural dramatic rhythm:

- **Long slow build** (30 minutes to 2 hours): Tension accumulates. Atmosphere darkens. Conversations sharpen.
- **Sudden break** (1-5 minutes): A Moment flips. The world changes.
- **Aftermath and recovery** (1-6 hours): Effects fade. Citizens process. New narratives form.
- **Return to build**: New tensions emerge from the aftermath. The cycle begins again.

This rhythm is not designed. It is an emergent property of the physics constants and the graph structure. The calibration target is 1-3 moment flips per hour of world time.

---

## B6. Economic Injection Is Felt, Not Seen

Every 15 minutes, economic data from the Serenissima simulation injects energy into the graph. The visitor experiences this as shifts in the city's mood, not as a data event.

GIVEN a major trade deal completes, enriching 20 citizens in Rialto
THEN over the next 2-3 ticks: Rialto citizens are in better spirits. Merchants are more generous with information. The district atmosphere brightens.

GIVEN a supply chain disruption cuts income for dock workers
THEN over the next 2-3 ticks: Dock workers express frustration. Existing grievance narratives resurface. The district atmosphere darkens.

---

## B7. The Daily Rhythm

GIVEN the world time advances to night
THEN the generation rate decreases (citizens are sleeping). Fewer conversations occur. Tension accumulates more slowly. The visitor at night finds a quieter city in every sense -- not just fewer people, but less narrative pressure.

GIVEN the world time advances to dawn
THEN the generation rate increases. Citizens wake, begin talking, pump energy into beliefs. Tensions that simmered overnight begin to climb. The visitor arriving in the morning finds a city warming up.

---

## B8. Testable Observations

### Tension Build Rate Test

GIVEN a seeded graph with two opposing belief clusters of 10 citizens each
WHEN 24 ticks pass (2 hours) with no external energy injection
THEN the TENSION edge strength has increased by at least 50%.
AND at least 3 citizens from each side discuss the topic in conversation.

### Decay Rate Test

GIVEN a narrative node at energy 0.5 with no active reinforcement
WHEN 35 ticks pass (~3 hours)
THEN the narrative energy is between 0.20 and 0.30.
AND citizens who previously volunteered the topic no longer do so without prompting.

### Core Type Persistence Test

GIVEN a "grudge" narrative at energy 0.5 with no reinforcement
WHEN 35 ticks pass (~3 hours)
THEN the narrative energy is between 0.40 and 0.48 (decayed at 1/4 normal rate).

### Moment Flip Test

GIVEN a Moment with threshold 3.0 connected to narratives with combined energy approaching 3.0
WHEN the next tick pushes salience past threshold
THEN the Moment flips. Within 5 minutes, the affected district shows observable changes.
AND no other Moment in the same district flips for at least 15 minutes (3-tick cooldown).

### Homeostasis Test

GIVEN a moment flips and creates new tensions and narratives
WHEN those new tensions begin feeding new Moments
THEN no runaway cascade occurs: maximum 1 additional flip in the same district within 1 hour, no more than 3 active Moments simultaneously, and the system self-dampens if average pressure exceeds the criticality ceiling.

### Invisible Tick Test

GIVEN the visitor is in conversation with a citizen when a tick fires
THEN the citizen's current response is not interrupted or visibly altered.
AND the visitor cannot determine the exact moment the tick fired from conversational behavior alone.

---

## B9. What the Visitor Never Perceives

The visitor never sees energy values, tension scores, threshold percentages, or tick counts. There is no health bar for the world's narrative state. The world does not pulse at tick boundaries. Changes are continuous from the visitor's perspective.

Citizens never say "energy," "tension," "threshold," "decay," "moment," or "flip" in their physics-engine senses. A citizen says "things are getting worse" not "tension is accumulating." A citizen says "something is going to break" not "a Moment is approaching threshold."

The physics is deterministic given the same inputs. But the visitor perceives it as unpredictable because they cannot see the inputs. The world surprises them the way real life does -- not because it is random, but because they lack complete information.
