# BEHAVIORS: narrative/graph -- Observable Effects

What the narrative graph produces that the visitor can witness. The graph is invisible. Its effects are not. Every citizen utterance, every shared rumor, every stubborn belief is the graph surfacing through lived behavior. This document describes those surface effects from the visitor's perspective -- no node IDs, no energy values, no Cypher queries.

---

## B1. Citizens Speak Their Beliefs

A citizen who BELIEVES "the Doge is corrupt" does not say those words unprompted. But the belief colors everything they say about governance, authority, taxation, and public works.

GIVEN a citizen holds a high-confidence belief about Doge corruption
WHEN the visitor asks "How are things in Venice?"
THEN the citizen's response reflects the belief without stating it directly:
- "Things are fine -- if you're on the right side of the Council."
- "The city runs on favors. Always has. Just got worse lately."

GIVEN a citizen holds the same belief at low confidence
WHEN asked the same question
THEN the response is vaguer, more hedged:
- "Some people say things aren't right at the top. I don't know. I mind my own business."

The visitor cannot extract the raw belief. They can only infer it from patterns across multiple conversations.

### Beliefs Are Consistent Across Conversations

GIVEN a citizen BELIEVES "the glass-workers deserve better pay"
WHEN the visitor speaks to that citizen on Monday and again on Thursday about the guild
THEN both responses are consistent with the same underlying position. The citizen does not contradict themselves on held beliefs. They may change emphasis or shift tone based on mood -- but the directional position remains stable as long as the BELIEVES edge exists.

GIVEN the belief has decayed to near-zero energy between visits
WHEN the visitor asks about the same topic
THEN the citizen no longer volunteers the position:
- "The glass-workers? I haven't thought about that in a while."

The belief faded. The citizen moved on. This is observable as a change in conversational priority, not as a retraction.

---

## B2. Shared Narratives Create the Sound of a City

GIVEN a Narrative node has high energy and multiple citizens hold BELIEVES edges to it
WHEN the visitor walks through the affected district
THEN they hear the narrative from multiple sources:

- The fishmonger mentions rising tariffs.
- A customer at a nearby stall complains about the same tariffs.
- A dock worker, unprompted, says something about ships being turned away.

The visitor was not told "tariff crisis is active." They pieced it together from three independent conversations. Each citizen used their own words, filtered through their own personality and social class.

### The Chorus Effect

When a narrative reaches high energy with many believers, the district sounds like it has a dominant topic. This is not scripted ambient dialogue. It is the convergence of individual citizens each expressing their own version of a shared belief.

GIVEN a "guild corruption" narrative is held by 15+ citizens in Rialto with energy above 0.3
WHEN the visitor enters Rialto
THEN within 5 minutes they overhear at least 3 references to guild problems from different citizens.

GIVEN the same narrative drops below 0.05 energy
THEN guild corruption is no longer the ambient topic. The chorus has ended.

---

## B3. Belief Consistency Under Pressure

GIVEN a citizen BELIEVES "the Arsenal workers are being treated fairly"
WHEN the visitor argues that the workers are being exploited
THEN the citizen pushes back, proportional to their confidence:

- High confidence (0.8+): "You don't know what you're talking about. I've seen the contracts."
- Medium confidence (0.5-0.7): "I've heard people say that, but I haven't seen the evidence."
- Low confidence (0.2-0.4): "Maybe. I don't know anymore. Everyone says something different."

The visitor cannot talk a citizen out of a high-confidence belief in a single conversation. Trust, repeated interactions, and real-world evidence are what change beliefs. Not rhetoric.

### Contradicting Beliefs Create Visible Discomfort

GIVEN a citizen holds two beliefs under TENSION (e.g., "the guild is necessary" and "the guild is bleeding us dry")
WHEN the visitor raises either topic
THEN the citizen exhibits internal conflict:
- "I know the guild does good work. I just wish they didn't charge us to death for it."
- Pauses mid-sentence. Changes subject. Returns to it unprompted.

The visitor observes ambivalence. They do not see a "TENSION edge with strength 0.6." They see a person struggling with contradictory positions.

---

## B4. Graph Changes Surface as Behavior Shifts

### Gradual Shifts

GIVEN a new Narrative node gains energy over 20+ ticks (several hours)
WHEN the visitor has been speaking to a citizen before and after the shift
THEN the change is observable as a drift in conversational emphasis:

- Before: The citizen talked mostly about their craft, their family, the weather.
- After: The citizen brings up politics. Mentions the Council. Asks the visitor if they have heard about the new decree.

### Sudden Shifts (Post-Event)

GIVEN a Moment has flipped and new Narratives were injected into the graph
WHEN the visitor speaks to a citizen who was assigned BELIEVES edges to the new Narratives
THEN the citizen's conversational behavior changes sharply:

- Before the event: "Business is steady. No complaints."
- After the event: "Everything changed when the warehouse burned. I don't know what I'm going to do."

### Belief Adoption from Other Citizens

GIVEN Citizen A holds a strong belief and Citizen B trusts Citizen A
WHEN the physics engine propagates the belief (creating a new BELIEVES edge for Citizen B)
THEN the visitor who has been tracking Citizen B observes them adopting a new position:

- Visit 1: Citizen B has no opinion on warehouse safety.
- Visit 3: "My friend tells me the warehouses are a disaster waiting to happen. I believe her."
- Visit 6: "The warehouses are dangerous. Everyone knows it." (Confidence has increased.)

The visitor witnesses social influence as a gradual process, not as an instant state change.

---

## B5. What the Visitor Never Sees

### No Graph Visualization

There is no map of beliefs. There is no network diagram. There is no "belief overlay" on the world. The graph is infrastructure, like plumbing. The visitor experiences the water, not the pipes.

### No Debug Data in Conversation

Citizens never reference energy levels, confidence scores, tension values, graph structure, node IDs, timestamps, or system state of any kind.

GIVEN a system error causes a citizen's graph context to be empty
THEN the citizen does not say "I have no beliefs." They say something generic and personality-appropriate:
- "I don't have much on my mind today."

### No Belief Menus, Inventories, or Labels

The visitor cannot browse a citizen's beliefs. They cannot compare two citizens' belief sets. Understanding what a citizen believes requires talking to them, repeatedly, and listening. The visitor never sees the words "Narrative," "Belief," "Tension," or "Moment." The world presents itself in the language of human experience: opinions, rumors, fears, hopes, grudges, alliances.

---

## B6. Social Clusters Are Audible, Not Visible

GIVEN 5 citizens share a high-energy belief about merchant exploitation
WHEN the physics tick places them in proximity (shared district, shared Place node)
THEN the visitor observes them near each other. They stand together at the market. They eat at the same tavern. Their conversations reference each other: "Giovanni and I were just saying the same thing."

The visitor infers social clusters from spatial proximity and conversational cross-references. There is no "faction indicator" or group label.

GIVEN two citizens hold beliefs that are under TENSION
WHEN both are in the same district
THEN they stand apart. One warns the visitor about the other. If forced into proximity, the conversation is terse, charged, or hostile.

GIVEN the tension resolves (one belief decays, or an event reconciles them)
THEN the avoidance behavior ends. One may acknowledge the shift: "We used to disagree. Things have changed."

---

## B7. Testable Observations

### Consistency Test

GIVEN a citizen with a known high-confidence belief
WHEN the visitor asks about the related topic 5 times across 5 separate sessions
THEN the citizen's position is directionally consistent in all 5 responses (wording varies, position does not).

### Propagation Test

GIVEN a new Narrative is seeded with high energy, connected to 3 citizens in Rialto
WHEN 12 ticks pass (1 hour)
THEN at least 2 additional citizens in Rialto express awareness of the narrative's content.
AND at least 1 citizen in an adjacent district has heard about it.

### Decay Test

GIVEN a Narrative node at energy 0.5 with 4 believers
WHEN no citizen reinforces it for 36 ticks (3 hours)
THEN energy falls below 0.1
AND citizens who previously discussed it no longer volunteer the topic.

### Tension Visibility Test

GIVEN two Narratives under TENSION, each held by 5+ citizens
WHEN the visitor walks through the district where both groups reside
THEN they observe at least one instance of: two citizens arguing about the topic, a citizen expressing frustration about disagreement, or ambient conversational tone shifting toward conflict.

### Contradiction Resilience Test

GIVEN a citizen holds a belief at confidence 0.9
WHEN the visitor directly contradicts the belief in conversation 3 times
THEN the citizen does not abandon the belief.
AND the citizen's responses escalate in defensiveness or dismissal.

### Empty Graph Graceful Degradation Test

GIVEN a citizen has no active BELIEVES edges (all narratives decayed)
WHEN the visitor initiates conversation
THEN the citizen speaks from personality, mood, and situational context only.
AND the citizen's responses are coherent and personality-consistent, not empty or error-like.

---

## B8. Visitor Influence on the Graph

### Attention as Energy

GIVEN a visitor discusses a topic related to an existing Narrative with a citizen
WHEN the citizen holds a BELIEVES edge to that Narrative
THEN the Narrative receives a small energy boost from the conversation.

The visitor does not know this is happening. From their perspective, they are having a conversation. From the system's perspective, the visitor is reinforcing a narrative -- keeping it alive in the city's consciousness by paying attention to it. The visitor becomes an unwitting narrative agent. Their curiosity shapes the world.

### Limits of Visitor Influence

GIVEN a visitor attempts to introduce an entirely new belief to a citizen
WHEN the belief has no existing Narrative node in the graph
THEN the citizen acknowledges the visitor's words but does not adopt a new position:
- "That's an interesting way to see it."
- "I'll think about that."

New beliefs enter the graph through economic events, physics propagation, and Forestiere news injection -- not through visitor persuasion. The visitor can reinforce existing beliefs and shift energy between them. They cannot author new ones.
