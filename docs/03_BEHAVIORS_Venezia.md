# BEHAVIORS: Venezia — Observable Effects

What a visitor experiences. What the world does. What citizens do. Described from the outside — no implementation details, only observable behavior.

---

## B1. Entering the World

### First Entry
- The visitor appears on a dock at the edge of the city
- Ambient sound: water lapping, distant voices, seagulls, a bell
- No tutorial, no text overlay, no instructions
- A Forestiere merchant nearby is unloading goods — the visitor can approach or not
- If approached, the merchant speaks first: "Ah, another face from the mainland. Watch your purse near the Rialto."

### Returning Entry
- The visitor appears at the last location they left from
- If a citizen they know is nearby, that citizen may acknowledge them: "Back again? You missed the trial yesterday. The baker was accused of watering down his flour."
- The world has visibly changed since last visit — new market stalls, a building under repair, different weather

---

## B2. Moving Through the City

### Locomotion
- **Desktop:** WASD movement, mouse look
- **VR:** Hand-based locomotion (point and teleport, or continuous walk via thumbstick)
- Movement is at walking speed — running is possible but citizens notice ("Why the hurry, Forestiere?")

### Districts
- Each district has distinct atmosphere: lighting, ambient sound, density of citizens, architecture style
- **Rialto** (commerce): Crowded, loud, merchants calling out prices, smell of fish and spice
- **San Marco** (power): Grand, open, echoing, guards present, formal conversations
- **Castello** (memory): Quiet, residential, intimate, sounds of domestic life
- **Dorsoduro** (governance): Debates audible from the piazza, petitioners waiting
- **Cannaregio** (knowledge): Soft, studious, the sound of pages turning and quills scratching

### Transitions
- Walking between districts: gradual ambient shift (sound crossfade, lighting change, fog transition)
- Bridges and waterways serve as natural boundaries
- Gondolas visible on canals (ambient, not rideable in V1)

---

## B3. Encountering Citizens

### Proximity Detection
- Citizens become aware of the visitor at ~15 meters (spatial audio range)
- At 15m: citizen may glance toward visitor, adjust posture
- At 8m: citizen's ongoing conversation may acknowledge visitor presence ("...and who is this listening?")
- At 3m: direct interaction possible — visitor speaks, citizen responds

### Conversation
- **Visitor speaks → STT transcription → injected into citizen's KinOS context → citizen responds via TTS**
- Citizen responses are informed by:
  - Their current emotional state (computed from economic/social/health situation)
  - Their relationship with the visitor (trust score, memory of past encounters)
  - Their current activity (a citizen rushing to work responds differently than one drinking at a tavern)
  - Their personality traits (some are warm, some suspicious, some arrogant)
  - Active tensions and narratives they believe (from the Blood Ledger graph)
- Citizens may:
  - Refuse to talk ("I don't have time for foreigners today.")
  - Talk about their problems without being asked
  - Ask the visitor for advice or help
  - Gossip about other citizens
  - Lie (especially about their debts or crimes)
  - Become emotional (a citizen in crisis may cry, shout, or go silent)

### Remembering
- After first interaction, the citizen stores the encounter in their `.cascade/memories/`
- Subsequent encounters reference previous ones: "You're the one who told me to confront the landlord. I did. It went badly."
- Citizens can develop opinions about the visitor over time
- Citizens may talk about the visitor to other citizens ("There's a Forestiere who keeps coming to the tavern. Seems decent.")

---

## B4. Witnessing Citizen Life

### Daily Rhythms (observable without interaction)
- **Dawn:** Citizens wake, leave homes, walk to workplaces. Bakers start early. Fishermen are already at the docks.
- **Morning:** Markets open. Goods change hands. Conversations about prices, weather, news.
- **Midday:** Work slows. Citizens eat. Taverns fill. Social conversations replace commercial ones.
- **Afternoon:** Production continues. Political discussions at Dorsoduro. Artists work.
- **Evening:** Citizens return home. Taverns get louder. Music from theaters. Couples walk along canals.
- **Night:** Streets empty. Guards patrol. Occasional shadowy figures. Ambient shifts to dark, quiet, mysterious.

### Economic Activity (visible)
- Market stalls with displayed goods (visible crates, baskets, fabrics)
- Citizens physically carrying goods between locations
- Price negotiations audible as spatial audio when nearby
- Construction/repair on buildings (scaffolding, sounds of hammering)
- Ships arriving/departing at the port (Forestiere merchants)

### Social Activity (visible)
- Groups of citizens talking (2-5 people, spatial audio of their conversation)
- Citizens greeting each other, arguing, laughing
- A citizen sitting alone, looking troubled (high stress, low mood)
- Processions (religious, political, funeral)
- Celebrations (feast days, successful trade deals, new births)

### Political Activity (visible)
- Crowds gathering at Dorsoduro when a grievance is being debated
- Citizens posting notices on walls
- Guards enforcing a decision
- Protests (if grievance support is high enough)

---

## B5. World Events (Blood Ledger Physics)

### Tension Building (gradual, observable)
- Ambient conversations shift topic: more citizens discuss the same issue
- Mood of a district darkens: fog thickens, ambient sound becomes tenser
- Specific citizens become more agitated in conversation
- Market prices visibly change (fewer goods on stalls, higher complaints)

### Tension Breaking (dramatic, observable)
- A sudden event: a fight breaks out, a business collapses, a citizen is arrested, a fire starts
- Citizens react: running, gathering, shouting, hiding
- The spatial audio landscape shifts sharply
- The aftermath is visible: damage, displaced citizens, new alliances formed
- Citizens talk about the event for days afterward

### News Propagation (gradual, observable)
- An event happens in one district → citizens in that district talk about it
- Hours later, citizens in adjacent districts know
- By the next day, the whole city knows (possibly distorted — rumors)
- Forestiere merchants bring news from outside (real-world RSS translated to 15th century)

---

## B6. Sensory Design

### Sound (primary sense)
- **Ambient layer:** Water, wind, bells, birds, distant construction
- **Social layer:** Citizen conversations, market calls, laughter, arguments
- **Event layer:** Bells ringing for events, shouts for emergencies, music for celebrations
- **All spatially positioned** — you hear what's near you, directionally accurate

### Light
- **Time of day:** Dawn gold → midday brightness → dusk orange → night blue-black
- **Weather:** Overcast desaturates, rain adds reflections, fog reduces visibility
- **District variation:** Rialto is bright and busy, Castello is shadowed and intimate
- **Biometric integration (optional):** Visitor's Garmin stress → slight world tint shift

### Absence of text
- No floating names above citizens
- No subtitles (unless accessibility mode is enabled)
- No written instructions anywhere in the world
- Signs exist on buildings but are in Venetian Italian — you learn or you ask

---

## B7. Leaving and Returning

### Leaving
- The visitor simply removes the headset or closes the browser
- No save prompt, no confirmation
- The world continues without them

### Returning After Absence
- The world has advanced: time has passed, events have occurred
- Citizens the visitor knows may remark on their absence
- The visitor discovers changes through exploration, not through a log
- Major events may be visible in the world: a burned building, a new market stall, a monument

---

## B8. Edge Cases

### Citizen is in crisis
- If a citizen's mood reaches "desperate" (e.g., homeless, starving), they may approach the visitor unbidden
- Their speech is more raw, less polished — authentic distress from their computed situation
- The visitor can listen, offer words, but cannot give them money (the visitor has no Ducats)
- This creates emotional weight without gamification

### Citizen is hostile
- Some citizens distrust foreigners. They may be cold, dismissive, or actively antagonistic
- This is not a bug — it is authentic social behavior
- The visitor can leave, or try to change the citizen's mind over multiple visits

### World is empty (night / bad weather)
- Few citizens are visible. The world becomes atmospheric rather than social
- This is intentional — solitude in the world is its own experience
- The sounds of the city at night tell their own story
