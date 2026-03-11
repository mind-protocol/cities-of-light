# BEHAVIORS: citizens/mind -- Observable Effects

What happens when you talk to a citizen. What they do. What they refuse to do. Described from the visitor's perspective -- no implementation leaks, only lived experience.

---

## B1. The First Word

### Approaching a Stranger

You walk toward a citizen you have never met. They are a Popolani fishmonger at the Rialto, arranging eels on ice. You stop two meters away.

The citizen does not greet you. They notice you -- a slight shift in posture, a glance -- but they continue their work. You are a Forestiere. They owe you nothing.

If you speak first, they respond. Their response depends on their mood and personality, not on your needs:

- **If their mood is neutral and personality is warm:** "You want something? The eels are fresh. If you're looking for something else, you picked the wrong stall."
- **If their mood is stressed and personality is suspicious:** "What do you want." (Not a question. A wall.)
- **If their mood is good and personality is gregarious:** "Ah, a new face! You look lost. Everyone looks lost the first time at the Rialto. What brings you to Venice?"

They do not introduce themselves unless asked. They do not explain the world. They are not a tutorial.

### Approaching Someone You've Met Before

You return to the same fishmonger three days later. You had a brief, pleasant exchange last time. Trust moved from 50 to 52.

The citizen recognizes you. Their greeting reflects the accumulated history:

- "Back again? Did you ever find that tailor I mentioned?"
- "You. I remember you. You asked too many questions about the Arsenal. I don't know what your business is there, but I don't like it."
- "Ah, the Forestiere who actually listened. Most of your kind just nod and walk away."

The callback is specific. It references what was actually said. Not "we met before" but "you told me about the fire at the warehouse and I've been thinking about it."

---

## B2. Trust Shapes Everything

### Trust 0-15: The Locked Door

The citizen will not speak to you beyond the minimum required by social convention. They may:

- Turn away when you approach
- Respond with "I have nothing to say to you"
- Warn nearby citizens about you: "Watch that one"
- Actively refuse to answer questions
- Report your presence if you are in a restricted area

You cannot force a conversation. You can only leave and try again later, or find another citizen who might vouch for you.

### Trust 16-30: The Stone Wall

The citizen answers direct, factual questions with minimal information. They volunteer nothing. Emotional topics are deflected.

- **Visitor:** "How is business?"
- **Citizen:** "Fine."
- **Visitor:** "I heard the guild is raising fees."
- **Citizen:** "You heard wrong." (They know it's true. They don't trust you enough to discuss it.)

Questions about other citizens are met with silence or redirection: "Ask them yourself."

### Trust 31-45: The Careful Merchant

The citizen engages in transactional conversation. They share information that benefits them (advertising their goods, complaining about competitors) but nothing personal.

- They describe their work but not their worries
- They comment on public events but not private opinions
- They ask about the visitor's purpose in Venice but do not share their own ambitions
- They may recommend other citizens to speak to -- but only ones they are publicly allied with

### Trust 46-55: The Default Stranger

Polite, measured interaction. The citizen treats the visitor as a potential acquaintance -- not yet a friend, not a threat.

- Answers most questions with reasonable detail
- Offers opinions on safe topics (weather, market prices, festival preparations)
- Deflects personal questions with humor or generality
- May end the conversation naturally: "Well, these barrels won't move themselves"

### Trust 56-70: The Warming Relationship

The citizen begins to reveal themselves. The visitor is no longer a stranger but an acquaintance with a track record.

- Initiates conversation when the visitor appears nearby
- Shares opinions about the political situation, other citizens, guild politics
- Asks the visitor's opinion and responds to it genuinely
- References previous conversations: "You said something last time that stuck with me"
- Laughs more. Uses the visitor's name if they know it.
- May introduce the visitor to another citizen: "You should talk to my friend Marco. He's been dealing with the same problem."

### Trust 71-85: The Confidant

The citizen trusts the visitor enough to be vulnerable.

- Confides financial troubles, family problems, fears about the future
- Asks for advice on difficult decisions
- Shares information that could be damaging if repeated
- Speaks differently when others are nearby vs. when alone with the visitor
- Defends the visitor if another citizen speaks badly of them
- May ask the visitor to carry a message or act as intermediary

### Trust 86-100: The Bond

Almost never reached with a visitor. This level of trust normally exists only between citizens who have years of shared history. If a visitor reaches it:

- The citizen speaks with complete openness
- They reveal beliefs they hide from everyone else
- They may ask the visitor to participate in sensitive plans (supporting a grievance, mediating a dispute)
- They consider the visitor's wellbeing in their own decisions
- They grieve the visitor's absence and celebrate their return

---

## B3. Mood Changes Everything

Mood is not a label. It is the weather inside the citizen. It is computed from their actual situation -- Ducats, relationships, employment, recent events, personality traits, social class.

### How Mood Manifests

**When a citizen is "ecstatic" (rare -- requires recent major success):**
- Longer responses. More detail. More generosity with information.
- Initiates conversation more readily. Laughs.
- Prone to overconfidence. May share secrets they shouldn't.
- Physical behavior: animated gestures, upright posture, louder voice.

**When a citizen is "content" (stable finances, good relationships):**
- Normal conversational rhythm. Responsive but not effusive.
- Willing to help but within limits.
- Physical behavior: relaxed posture, steady eye contact.

**When a citizen is "anxious" (financial pressure, uncertain future):**
- Shorter responses. Changes subject frequently.
- Asks more questions than they answer -- looking for information, advantages.
- May misinterpret neutral statements as threats.
- Physical behavior: fidgeting, breaking eye contact, checking surroundings.

**When a citizen is "bitter" (recent failure, perceived injustice):**
- Sarcastic. Makes cutting remarks about other citizens, the system, the visitor.
- Volunteers complaints without being asked.
- Less likely to help. More likely to test the visitor's motives.
- Physical behavior: tight posture, sharp gestures, clipped speech.

**When a citizen is "desperate" (near bankruptcy, homeless, starving):**
- Raw honesty or complete shutdown. No middle ground.
- May approach the visitor uninvited. May beg. May threaten.
- Personal boundaries collapse. They will tell you things no one should hear.
- Physical behavior: sitting on ground, head in hands, erratic movement.

**When a citizen is "paranoid" (targeted by stratagems, enemies active):**
- Suspects every question has a hidden motive.
- Refuses to discuss certain topics entirely.
- Asks the visitor who sent them, who they've spoken to.
- Physical behavior: looking over shoulder, whispering, standing with back to wall.

### Mood and the Emotion Wheel

Mood is not a single axis. It is computed from six basic emotion scores (happy, sad, angry, fearful, surprised, disgusted), each driven by ledger data:

- **Financial stress** pushes fear and anger up
- **Homelessness** pushes sadness and fear up
- **Being targeted by stratagems** pushes anger and disgust up
- **Successful trade** pushes happiness up
- **Positive relationships** push happiness up, reduce fear
- **Personality traits** modulate all emotions (a "suspicious" citizen has baseline elevated fear)

Two dominant emotions combine into a complex mood: angry + sad = "bitter." Happy + fearful = "anxiously optimistic." The citizen speaks and behaves from this computed complex mood, not from a scripted emotion tag.

---

## B4. What Citizens Volunteer vs. What They Withhold

### What Citizens Volunteer (Without Being Asked)

Citizens talk about what is on their mind. What is on their mind depends on their situation:

- **A citizen under financial pressure** will mention rising costs, unfair prices, difficulty paying rent -- even if the visitor didn't ask. It is their preoccupation.
- **A citizen who just witnessed an event** will talk about it. "Did you see what happened at the market this morning? The Medici agent was thrown out."
- **A citizen with a grievance** will express it to anyone who will listen, especially if their trust is high enough and their anger is fresh.
- **A citizen in love** (high relationship trust with another citizen) will mention them. "My friend Elena says..." appears naturally in conversation.
- **A citizen who is proud** of recent work will describe it. "I just finished the finest silk the guild has ever seen."

### What Citizens Withhold (Even When Asked)

- **Debts.** Unless trust is above 70, a citizen will never reveal the true extent of their debts. They will say "things are tight" when they are one week from ruin.
- **Criminal activity.** Stratagems like "undercut," "hoard," or "supplier_lockout" are never discussed openly. A citizen executing a stratagem will deny it or change the subject.
- **Relationship problems.** Trust scores below 30 with another citizen are not discussed unless the visitor is deeply trusted. "We don't get along" is the most they'll offer.
- **Political opinions.** In earshot of authority figures (guards, nobles, officials), even high-trust citizens will moderate their political speech. In private, they may be inflammatory.
- **Knowledge of others' secrets.** A citizen who knows another citizen's secret will not share it unless their trust in the visitor exceeds their trust in the other citizen, AND they have a motive to betray.

---

## B5. Multi-Visit Relationship Arcs

The relationship between visitor and citizen is not a state -- it is a trajectory. These are the observable arcs:

### The Slow Thaw (Most Common)

Visit 1: "What do you want?"
Visit 3: "Oh, you again. Still wandering?"
Visit 7: "I was wondering if you'd come back."
Visit 15: "Sit down. I want to tell you something."

Each visit adds a small trust increment (`TRUST_SCORE_MINOR_POSITIVE = 0.2` just for showing up, more for quality interaction). The citizen remembers. Consistency is rewarded.

### The Fast Bond (Rare)

Triggered by a high-stakes interaction early. The visitor gives excellent advice during a crisis, or defends the citizen in front of others, or mediates a conflict successfully.

Visit 1: Crisis encounter. Trust jumps +5.
Visit 2: Citizen seeks the visitor out. "I never thanked you properly."
Visit 4: Confidant level. The relationship skipped the middle stages.

This arc is fragile. High trust earned quickly is easily shattered by a single negative interaction.

### The Deterioration

Trust can go down. A visitor who gossips about a citizen's secrets to another citizen, who gives bad advice that leads to loss, or who is rude and dismissive, will watch trust erode.

Visit 1: Pleasant. Trust 52.
Visit 3: Visitor shares citizen's financial trouble with a competitor. Trust drops to 38.
Visit 5: Citizen is cold. "I heard you've been talking to Marco about my business. I have nothing more to say to you."
Visit 8: If the visitor persists and is careful, trust may stabilize. If they don't, the citizen avoids them.

### The Indirect Arc

Citizens talk to each other about the visitor. A visitor who is trusted by one citizen may find that trust spreading:

"Elena told me about you. She says you're decent for a Forestiere."

Conversely, a bad reputation spreads:

"I know who you are. The merchant at Rialto warned me. I'd rather you didn't come here."

The visitor may never know which conversation caused the shift.

---

## B6. Conversation Mechanics (From the Visitor's Side)

### Starting a Conversation
- Walk within 3 meters of a citizen
- Speak (voice captured by STT)
- Wait for response (1-3 seconds: context assembly + LLM + TTS)
- Citizen responds via spatial audio from their position in the world

### During Conversation
- Speak naturally. No commands, no keywords, no menus.
- The citizen may interrupt if you say something that triggers a strong reaction
- The citizen may go silent if you say something that makes them uncomfortable
- The citizen may change the subject if you press on a topic they want to avoid
- The citizen may end the conversation: "I need to go" / "I've said enough" / *walks away*

### Ending a Conversation
- Walk away (citizen may call after you if they had more to say)
- Stop talking (citizen waits, then returns to their activity)
- The citizen ends it (they have schedules, obligations, patience limits)

### What You Cannot Do
- You cannot give citizens money (you have no Ducats)
- You cannot give citizens orders (you have no authority)
- You cannot touch citizens (no physics interaction)
- You cannot follow a citizen into a private space if they don't invite you
- You cannot eavesdrop on citizen-to-citizen conversations beyond spatial audio range

---

## B7. Edge Behaviors

### When a Citizen is Interrupted Mid-Activity

If you approach a citizen who is working (carrying goods, negotiating a deal, crafting), their response accounts for the interruption:

- "Can it wait? I'm in the middle of something."
- *continues working while talking, shorter responses*
- "Come back at sunset. I'll be at the tavern."

### When Multiple Visitors Exist (Future)

A citizen can only be in one conversation at a time. If a second visitor approaches, the citizen either:
- Acknowledges them briefly and returns to the current conversation
- Ends the current conversation if the new visitor has higher trust

### When a Citizen is Emotionally Overwhelmed

Emotion intensity (computed from the emotion wheel) can exceed a threshold where the citizen cannot maintain normal conversation:
- Speech becomes fragmented
- They may repeat themselves
- They may say things they would normally withhold
- They may simply stop talking and sit down

### When a Citizen Has Just Learned News

If a world event occurred recently, citizens in the affected district will talk about it even if you ask about something else. The event dominates their attention:

"Forget about that. Did you hear about the fire at the warehouse? Three families lost everything."

The news fades over hours. By the next day, it is background knowledge, not foreground preoccupation.
