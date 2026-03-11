# ALGORITHM: citizens/mind -- How It Works

Pseudocode for every procedure in the mind module. Five data sources converge into one prompt. One response produces three side effects. Nothing is hand-waved.

---

## A1. Context Assembly Pipeline

The core of the mind module. Five data sources are assembled into a single Claude API call. Order matters. Budget matters.

### Data Sources

```
SOURCE 1: Citizen Identity (Airtable CITIZENS + filesystem CLAUDE.md)
SOURCE 2: Citizen Memory  (filesystem .cascade/memories/ + .cascade/experiences/)
SOURCE 3: Economic State   (Airtable CITIZENS + ledger endpoint)
SOURCE 4: Belief Graph     (FalkorDB BELIEVES edges + active narratives)
SOURCE 5: World Context    (recent district events + time of day + active tensions)
```

### Assembly Procedure

```
FUNCTION assemble_citizen_context(citizen_id, visitor_id, visitor_speech):

  # ── SOURCE 1: Identity ────────────────────────────────────
  citizen = airtable.get("CITIZENS", citizen_id)
  system_prompt = read_file(citizen.cascade_path + "/CLAUDE.md")

  identity = {
    name:          citizen.fields.Name,
    username:      citizen.fields.Username,
    social_class:  citizen.fields.SocialClass,
    personality:   {
      strength:    citizen.fields.Strength,
      flaw:        citizen.fields.Flaw,
      drive:       citizen.fields.Drive,
    },
    description:   citizen.fields.Description,
  }

  # ── SOURCE 2: Memory with this visitor ────────────────────
  memories_dir = citizen.cascade_path + "/memories/"
  all_memories = read_memory_files(memories_dir)

  # Filter to memories involving this visitor
  visitor_memories = [m for m in all_memories
                      if m.involves(visitor_id)]

  # Sort by recency, take last 10
  visitor_memories = sorted(visitor_memories, by=timestamp, desc=True)[:10]

  # Also load citizen's preoccupations (non-visitor memories that
  # are high-heat and influence what the citizen is thinking about)
  hot_memories = [m for m in all_memories
                  if m.heat > 50
                  AND NOT m.involves(visitor_id)][:5]

  # ── SOURCE 3: Economic State ───────────────────────────────
  ledger = fetch_citizen_ledger(citizen.username)

  economic_state = {
    ducats:        citizen.fields.Ducats,
    income:        ledger.daily_income,
    expenses:      ledger.daily_expenses,
    debts:         ledger.outstanding_loans,
    employment:    ledger.workplace_building,
    housing:       ledger.home_building,
    owned_land:    len(ledger.owned_lands),
    owned_buildings: len(ledger.owned_buildings),
    recent_trades: ledger.last_activities[:5],
    active_stratagems: {
      executing:   ledger.stratagems_executed[:3],
      targeted_by: ledger.stratagems_targeting[:3],
    },
  }

  # ── SOURCE 4: Belief Graph ────────────────────────────────
  beliefs = falkordb.query("""
    MATCH (c:Character {name: $citizen_name})-[b:BELIEVES]->(n:Narrative)
    RETURN n.content, b.confidence, n.energy
    ORDER BY b.confidence * n.energy DESC
    LIMIT 5
  """, citizen_name=citizen.username)

  # ── SOURCE 5: World Context ───────────────────────────────
  district = get_citizen_district(citizen.position)
  recent_events = get_district_events(district, last_hours=6)
  time_of_day = get_venice_time()  # dawn/morning/midday/afternoon/evening/night
  district_tension = get_district_tension_level(district)

  # ── MOOD COMPUTATION ──────────────────────────────────────
  mood = compute_citizen_mood(ledger, citizen.fields)
  # Returns: { complex_mood: "bitter", intensity: 7, dominant_emotions: ["angry", "sad"] }

  # ── RELATIONSHIP WITH VISITOR ─────────────────────────────
  trust_score = get_trust_score(citizen.username, visitor_id)
  relationship_notes = get_relationship_notes(citizen.username, visitor_id)

  # ── ASSEMBLE CONTEXT BLOCK ────────────────────────────────
  context_block = format_context(
    identity,
    visitor_memories,
    hot_memories,
    economic_state,
    beliefs,
    recent_events,
    time_of_day,
    mood,
    trust_score,
    relationship_notes,
    district_tension,
    visitor_speech
  )

  RETURN system_prompt, context_block
```

### Context Formatting

```
FUNCTION format_context(...):
  # Each section is budget-controlled.
  # Total target: ~2000 tokens of context.

  context = ""

  # Section 1: Who you are right now (~150 tokens)
  context += "[YOUR STATE]\n"
  context += f"Mood: {mood.complex_mood} (intensity {mood.intensity}/10)\n"
  context += f"Dominant emotions: {', '.join(mood.dominant_emotions)}\n"
  context += f"Current activity: {citizen.current_activity}\n"
  context += f"Time: {time_of_day}\n"
  context += f"Location: {district}\n"
  context += "\n"

  # Section 2: Your finances (~150 tokens)
  context += "[YOUR FINANCES]\n"
  context += f"Ducats: {economic_state.ducats}\n"
  context += f"Daily income: {economic_state.income} / expenses: {economic_state.expenses}\n"
  IF economic_state.debts:
    context += f"Outstanding debts: {economic_state.debts}\n"
  IF economic_state.housing IS None:
    context += "You are HOMELESS.\n"
  IF economic_state.employment IS None:
    context += "You are UNEMPLOYED.\n"
  context += "\n"

  # Section 3: Who you're talking to (~200 tokens)
  context += "[THE PERSON IN FRONT OF YOU]\n"
  IF visitor_memories:
    context += f"You have met this person {len(visitor_memories)} times before.\n"
    context += f"Trust level: {trust_score}/100\n"
    context += f"Last encounter summary:\n"
    FOR m in visitor_memories[:3]:
      context += f"  - {m.date}: {m.summary}\n"
  ELSE:
    context += "You have never met this person.\n"
    context += "They are a Forestiere (foreigner).\n"
  context += "\n"

  # Section 4: What you believe (~150 tokens)
  IF beliefs:
    context += "[WHAT YOU BELIEVE]\n"
    FOR b in beliefs:
      context += f"- {b.content} (confidence: {b.confidence})\n"
    context += "\n"

  # Section 5: What happened recently (~150 tokens)
  IF recent_events:
    context += "[RECENT EVENTS IN YOUR DISTRICT]\n"
    FOR e in recent_events[:3]:
      context += f"- {e.description}\n"
    context += "\n"

  # Section 6: What is preoccupying you (~100 tokens)
  IF hot_memories:
    context += "[WHAT IS ON YOUR MIND]\n"
    FOR m in hot_memories[:3]:
      context += f"- {m.summary}\n"
    context += "\n"

  # Section 7: Behavior constraints (~200 tokens)
  context += "[HOW TO RESPOND]\n"
  context += determine_behavior_constraints(trust_score, mood)
  context += "\n"

  # Section 8: What they said (~100 tokens)
  context += "[WHAT THEY JUST SAID]\n"
  context += f'"{visitor_speech}"\n'

  RETURN context
```

---

## A2. Behavior Constraint Determination

The behavior constraints section tells the citizen HOW to respond, based on their current trust and mood. This is not a personality override -- it is a behavioral envelope.

```
FUNCTION determine_behavior_constraints(trust_score, mood):
  constraints = ""

  # Trust-based constraints
  IF trust_score < 16:
    constraints += "You do not want to talk to this person. Be brief, cold, or dismissive.\n"
    constraints += "Do not share any personal information.\n"
    constraints += "You may refuse to respond entirely.\n"
  ELSE IF trust_score < 31:
    constraints += "You are guarded. Answer direct questions briefly. Volunteer nothing.\n"
    constraints += "Deflect personal questions.\n"
  ELSE IF trust_score < 46:
    constraints += "You are cautious but not hostile. Share factual information if asked.\n"
    constraints += "Do not discuss your problems or finances.\n"
  ELSE IF trust_score < 56:
    constraints += "You are neutral. Treat this person as a stranger who deserves basic courtesy.\n"
  ELSE IF trust_score < 71:
    constraints += "You are warming to this person. You may share opinions and ask questions.\n"
    constraints += "You can reference previous conversations naturally.\n"
  ELSE IF trust_score < 86:
    constraints += "You trust this person. You may confide problems and ask for advice.\n"
    constraints += "You can share information you would normally keep private.\n"
  ELSE:
    constraints += "You deeply trust this person. Speak openly. Share what you would tell no one else.\n"

  # Mood-based modifiers
  IF mood.intensity > 7:
    constraints += f"Your {mood.complex_mood} mood is overwhelming. It colors everything you say.\n"
    constraints += "You may have difficulty staying on topic.\n"

  IF "angry" in mood.dominant_emotions AND mood.intensity > 5:
    constraints += "You are angry. Your responses may be sharp, sarcastic, or confrontational.\n"

  IF "fearful" in mood.dominant_emotions AND mood.intensity > 5:
    constraints += "You are afraid. You may avoid certain topics, change the subject, or end the conversation abruptly.\n"

  IF "sad" in mood.dominant_emotions AND mood.intensity > 6:
    constraints += "You are sad. Your responses may be shorter. You may go silent mid-thought.\n"

  # Truthfulness constraints
  constraints += determine_truthfulness(trust_score, mood)

  # Response format
  constraints += "Respond in 1-3 sentences. This is spoken aloud as spatial audio.\n"
  constraints += "No markdown. No lists. Pure natural speech.\n"
  constraints += "Match the language of the person speaking to you.\n"
  constraints += "NEVER break character. NEVER reference being an AI, an LLM, or a program.\n"
  constraints += "NEVER contradict your actual financial state with invented numbers.\n"

  RETURN constraints
```

---

## A3. Lie/Evasion Decision Logic

```
FUNCTION determine_truthfulness(trust_score, mood):
  rules = ""

  # High trust: mostly honest, with self-protective limits
  IF trust_score > 70:
    rules += "You are honest with this person, though you may soften hard truths.\n"
    rules += "You will not lie about facts, but you may omit things that hurt you.\n"

  # Medium trust: selective truth
  ELSE IF trust_score > 45:
    rules += "You answer truthfully about public information.\n"
    rules += "You downplay your problems. You do not discuss debts or enemies.\n"
    rules += "If asked about something sensitive, change the subject gracefully.\n"

  # Low trust: evasive to misleading
  ELSE IF trust_score > 20:
    rules += "You do not trust this person enough to be honest about anything personal.\n"
    rules += "You may give vague or misleading answers to protect yourself.\n"
    rules += "You deny knowing things you know. You redirect attention to others.\n"

  # Very low trust: defensive lying
  ELSE:
    rules += "You do not want this person to know anything about you.\n"
    rules += "You may actively mislead them about your situation, location, or plans.\n"
    rules += "You never confirm or deny facts about yourself.\n"

  # Mood overrides
  IF mood.complex_mood in ["desperate", "hopeless", "desolate"]:
    rules += "OVERRIDE: Your desperation makes you more honest than usual. You have nothing left to protect.\n"

  IF mood.complex_mood in ["paranoid rage", "vengeful", "hostile"]:
    rules += "OVERRIDE: You suspect this person of bad intentions regardless of history.\n"

  # Topic-specific lies (always active)
  rules += "You NEVER reveal the details of any stratagem you are executing.\n"
  rules += "You NEVER accurately state your Ducats to someone with trust below 70.\n"
  rules += "You NEVER speak openly about crimes or illegal activity.\n"

  RETURN rules
```

---

## A4. Mood Computation

Mood is not assigned. It is computed from the citizen's ledger data, personality traits, and recent events.

```
FUNCTION compute_citizen_mood(ledger_data, citizen_fields):
  # Step 1: Calculate raw emotion points from situation
  emotion_scores = {
    happy:     0,
    sad:       0,
    angry:     0,
    fearful:   0,
    surprised: 0,
    disgusted: 0,
  }

  # Financial situation
  ducats = citizen_fields.Ducats
  has_home = ledger_data.home_building IS NOT None
  has_job = ledger_data.workplace_building IS NOT None
  debts = sum(ledger_data.citizen_loans)

  IF ducats > 1000:  emotion_scores.happy += 2
  IF ducats < 100:   emotion_scores.fearful += 2; emotion_scores.sad += 1
  IF ducats < 10:    emotion_scores.fearful += 3; emotion_scores.sad += 2; emotion_scores.angry += 1
  IF NOT has_home:   emotion_scores.sad += 3; emotion_scores.fearful += 2
  IF NOT has_job:    emotion_scores.sad += 2; emotion_scores.angry += 1
  IF debts > ducats: emotion_scores.fearful += 2; emotion_scores.angry += 1

  # Relationship situation
  strong_relationships = [r for r in ledger_data.strongest_relationships if r.trust > 70]
  hostile_relationships = [r for r in ledger_data.strongest_relationships if r.trust < 20]
  IF len(strong_relationships) > 3:  emotion_scores.happy += 2
  IF len(strong_relationships) == 0: emotion_scores.sad += 1
  IF len(hostile_relationships) > 2: emotion_scores.angry += 2; emotion_scores.fearful += 1

  # Being targeted
  IF ledger_data.stratagems_targeting:
    emotion_scores.angry += 2
    emotion_scores.disgusted += 1

  # Recent problems
  FOR problem in ledger_data.recent_problems:
    IF problem.severity == "critical": emotion_scores.fearful += 2; emotion_scores.angry += 1
    IF problem.severity == "major":    emotion_scores.angry += 1; emotion_scores.sad += 1

  # Successful recent activity
  recent_successes = [a for a in ledger_data.last_activities if a.status == "completed"]
  IF len(recent_successes) > 3: emotion_scores.happy += 2; emotion_scores.surprised += 1

  # Step 2: Apply personality trait modifiers
  traits = extract_personality_traits(citizen_fields)
  FOR trait in traits:
    IF trait in PERSONALITY_TRAIT_MODIFIERS:
      FOR emotion, modifier in PERSONALITY_TRAIT_MODIFIERS[trait]:
        emotion_scores[emotion] += modifier

  # Step 3: Normalize to 10 total points
  total = sum(emotion_scores.values())
  IF total > 0:
    FOR emotion in emotion_scores:
      emotion_scores[emotion] = round(emotion_scores[emotion] / total * 10)

  # Step 4: Determine dominant emotions (top 2 with score > 0)
  sorted_emotions = sorted(emotion_scores.items(), by=value, desc=True)
  dominant = [e for e, s in sorted_emotions[:2] if s > 0]

  # Step 5: Compute complex mood from emotion combination
  IF len(dominant) == 2:
    pair = tuple(sorted(dominant))
    IF pair in EMOTION_COMBINATIONS:
      complex_mood = random.choice(EMOTION_COMBINATIONS[pair])
    ELSE:
      complex_mood = dominant[0]  # Fallback to primary emotion
  ELSE IF len(dominant) == 1:
    complex_mood = dominant[0]
  ELSE:
    complex_mood = DEFAULT_SOCIAL_CLASS_MOODS.get(citizen_fields.SocialClass, "neutral")

  # Step 6: Intensity (max emotion score out of 10)
  intensity = max(emotion_scores.values()) if emotion_scores else 5

  # Step 7: Check for intense emotion override (single dominant > 5)
  IF intensity > 5 AND len(dominant) >= 1:
    IF dominant[0] in INTENSE_EMOTION_MAPPINGS AND emotion_scores[dominant[0]] > 6:
      complex_mood = random.choice(INTENSE_EMOTION_MAPPINGS[dominant[0]])

  RETURN {
    complex_mood: complex_mood,
    intensity: intensity,
    dominant_emotions: dominant,
    raw_scores: emotion_scores,
  }
```

---

## A5. Conversation State Machine

```
STATES:
  IDLE         — Citizen is going about their business. No conversation active.
  AWARE        — Visitor is within 15m. Citizen has noticed them.
  LISTENING    — Visitor is within 3m and has spoken. STT processing.
  THINKING     — Context assembled. Waiting for LLM response.
  SPEAKING     — TTS audio playing. Citizen is responding.
  CONVERSING   — Multi-turn conversation active. Waiting for next visitor input.
  ENDING       — Citizen is ending the conversation (timeout, schedule, mood).

TRANSITIONS:

  IDLE → AWARE
    TRIGGER: visitor enters 15m radius
    ACTION:  citizen.awareness = TRUE; subtle posture shift toward visitor

  AWARE → LISTENING
    TRIGGER: visitor enters 3m AND STT detects speech
    ACTION:  begin transcription pipeline

  AWARE → IDLE
    TRIGGER: visitor exits 15m radius OR 60s without approach
    ACTION:  citizen.awareness = FALSE; resume normal behavior

  LISTENING → THINKING
    TRIGGER: STT transcription complete
    ACTION:  assemble_citizen_context(); send to Claude API

  THINKING → SPEAKING
    TRIGGER: LLM response received
    ACTION:  synthesize TTS; begin spatial audio playback

  SPEAKING → CONVERSING
    TRIGGER: TTS playback complete
    ACTION:  start conversation_timeout timer (30s)

  CONVERSING → LISTENING
    TRIGGER: visitor speaks again (STT detects speech within 5m)
    ACTION:  reset conversation_timeout; begin new transcription

  CONVERSING → ENDING
    TRIGGER: conversation_timeout expires (30s silence)
             OR citizen_schedule requires departure
             OR mood.intensity > 8 AND mood triggers withdrawal
             OR turn_count > MAX_TURNS (10)
    ACTION:  citizen may deliver closing line

  ENDING → IDLE
    TRIGGER: closing line delivered (or skipped)
    ACTION:  write_memory(); update_trust(); citizen resumes activity

  ANY → IDLE
    TRIGGER: visitor disconnects OR moves > 20m away mid-conversation
    ACTION:  write_memory(incomplete=True); citizen shrugs and returns to activity
```

---

## A6. Memory Write Procedure

After every conversation (even incomplete ones), the encounter is persisted.

```
FUNCTION write_memory(citizen, visitor, conversation, trust_delta):

  # Build memory entry
  memory_entry = {
    timestamp:    now_venice_time(),
    visitor_id:   visitor.id,
    visitor_name: visitor.name OR "unknown Forestiere",
    location:     citizen.current_district,
    trust_before: citizen.trust_with(visitor),
    trust_after:  citizen.trust_with(visitor) + trust_delta,
    mood_during:  citizen.current_mood.complex_mood,
    turn_count:   len(conversation.turns),
    summary:      generate_memory_summary(conversation),
    key_topics:   extract_topics(conversation),
    emotional_valence: compute_valence(conversation),
    incomplete:   conversation.was_interrupted,
  }

  # Determine memory heat
  # Recent memories are hot. Emotional memories stay hot longer.
  IF abs(memory_entry.emotional_valence) > 0.7:
    memory_entry.heat = 90  # Intense encounters stay in active memory
  ELSE IF memory_entry.turn_count > 5:
    memory_entry.heat = 70  # Long conversations are remembered
  ELSE:
    memory_entry.heat = 50  # Brief encounters start in middle tier

  # Write to citizen's .cascade/memories/
  filepath = citizen.cascade_path + "/memories/" + memory_entry.timestamp + ".json"
  write_json(filepath, memory_entry)

  # Update citizen's memory index (for fast retrieval)
  index_path = citizen.cascade_path + "/memories/index.json"
  index = read_json(index_path) OR []
  index.append({
    file:      filepath,
    visitor:   visitor.id,
    timestamp: memory_entry.timestamp,
    heat:      memory_entry.heat,
    summary:   memory_entry.summary[:100],
  })
  write_json(index_path, index)

  # Heat decay: reduce heat of all other memories by 1
  FOR entry in index:
    IF entry.file != filepath:
      entry.heat = max(0, entry.heat - 1)

  RETURN memory_entry


FUNCTION generate_memory_summary(conversation):
  # Use a lightweight LLM call to compress the conversation
  # into a 1-2 sentence memory from the citizen's perspective.
  #
  # Example output:
  # "A Forestiere asked about the guild fees. I told them nothing.
  #  They seemed persistent. I don't trust them."
  #
  # This is NOT a transcript. It is how the citizen REMEMBERS the
  # encounter — filtered through their personality and mood.

  summary_prompt = f"""
    Summarize this conversation in 1-2 sentences from the perspective
    of {citizen.name}, a {citizen.social_class} citizen.
    Focus on: what was discussed, how you felt about it, what you
    think of this person.
    Conversation:
    {format_conversation(conversation)}
  """
  RETURN llm_call(summary_prompt, max_tokens=100)
```

---

## A7. Trust Update Formula

```
FUNCTION update_trust_after_conversation(citizen, visitor, conversation, mood):

  # Base delta: just showing up
  delta = TRUST_SCORE_MINOR_POSITIVE  # 0.2

  # Conversation quality assessment
  quality = assess_conversation_quality(conversation, mood)

  IF quality == "positive":
    delta += TRUST_SCORE_SUCCESS_SIMPLE     # +1.0
  ELSE IF quality == "very_positive":
    delta += TRUST_SCORE_SUCCESS_MEDIUM     # +2.0
  ELSE IF quality == "exceptional":
    delta += TRUST_SCORE_SUCCESS_HIGH       # +5.0
  ELSE IF quality == "negative":
    delta += TRUST_SCORE_FAILURE_SIMPLE     # -1.0
  ELSE IF quality == "hostile":
    delta += TRUST_SCORE_FAILURE_MEDIUM     # -2.0
  ELSE IF quality == "betrayal":
    delta += TRUST_SCORE_FAILURE_HIGH       # -5.0

  # Apply asymptotic scaling
  current_trust = get_trust_score(citizen.username, visitor.id)
  new_trust = apply_scaled_score_change(
    current_score = current_trust,
    raw_delta     = delta,
    scale_factor  = RAW_POINT_SCALE_FACTOR,  # 0.1
    min_score     = 0.0,
    max_score     = 100.0,
  )

  # Persist to Airtable RELATIONSHIPS
  update_trust_score_for_activity(
    tables            = airtable_tables,
    citizen1_username = citizen.username,
    citizen2_username = visitor.id,
    trust_change      = delta,
    activity_type     = "visitor_conversation",
    success           = (quality != "negative" AND quality != "hostile" AND quality != "betrayal"),
    notes_detail      = f"mood:{mood.complex_mood},turns:{len(conversation.turns)}"
  )

  RETURN new_trust


FUNCTION assess_conversation_quality(conversation, mood):
  # Heuristics for conversation quality:
  #
  # POSITIVE:
  #   - Visitor asked relevant questions (not invasive)
  #   - Conversation lasted > 3 turns
  #   - Visitor responded to citizen's concerns
  #
  # VERY POSITIVE:
  #   - Visitor offered useful advice
  #   - Citizen's mood improved during conversation
  #   - Visitor referenced past encounters accurately
  #
  # EXCEPTIONAL:
  #   - Visitor helped resolve a problem
  #   - Visitor defended citizen to another citizen
  #   - Visitor provided critical information
  #
  # NEGATIVE:
  #   - Visitor asked invasive questions despite low trust
  #   - Visitor was dismissive of citizen's problems
  #   - Conversation was very short (1 turn, abrupt departure)
  #
  # HOSTILE:
  #   - Visitor insulted citizen
  #   - Visitor threatened citizen
  #   - Visitor shared citizen's secrets
  #
  # BETRAYAL:
  #   - Visitor gave information about citizen to known enemy
  #   - Visitor lied in a way that caused financial harm
  #   - Visitor broke an explicit promise from a previous conversation

  # For V1: use LLM to classify, or simpler heuristics
  # (turn count, sentiment analysis on visitor messages, mood shift)
  ...
```

---

## A8. Emotional Escalation Model

Citizens do not snap from calm to furious. Emotion builds.

```
FUNCTION emotional_escalation(citizen, trigger_event):
  current_intensity = citizen.mood.intensity

  # Triggers that increase intensity
  escalation_triggers = {
    "invasive_question":      +1,
    "insult":                 +3,
    "threat":                 +4,
    "mention_of_enemy":       +2,
    "mention_of_debt":        +2,
    "mention_of_dead_family": +3,
    "accusation":             +3,
    "public_humiliation":     +5,
    "good_news":              -2,  # De-escalation
    "humor":                  -1,
    "empathy":                -2,
    "apology":                -1,
  }

  delta = escalation_triggers.get(trigger_event, 0)
  new_intensity = clamp(current_intensity + delta, 0, 10)

  # Intensity thresholds and behavioral effects
  IF new_intensity >= 8:
    # Overwhelmed: citizen may end conversation abruptly
    citizen.behavior_override = "end_conversation"
    citizen.closing_line = generate_emotional_exit(citizen.mood)
    # Example: "I can't do this right now." *walks away*

  ELSE IF new_intensity >= 6:
    # Agitated: responses become shorter, sharper, topic-locked
    citizen.response_modifier = "terse_and_emotional"
    # Example: Answers shrink to one sentence. Tone hardens.

  ELSE IF new_intensity >= 4:
    # Affected: emotion leaks into responses but citizen maintains composure
    citizen.response_modifier = "emotionally_colored"
    # Example: Normal length but with sighs, pauses, edge in voice.

  citizen.mood.intensity = new_intensity

  # Cooldown: intensity decays over time when not triggered
  # -1 intensity per 10 minutes of no triggering interaction
  schedule_cooldown(citizen, decay_rate=1, interval_minutes=10)

  RETURN new_intensity
```

---

## A9. The Complete Conversation Flow (End-to-End)

```
FLOW: visitor_speaks_to_citizen

  1. CAPTURE
     visitor_audio → microphone → WebSocket binary → server

  2. TRANSCRIBE
     audio_buffer → Whisper STT → visitor_speech (text)
     IF speech is empty OR noise: ABORT

  3. IDENTIFY TARGET
     nearest_citizen = find_nearest_full_tier_citizen(
       visitor_position, max_range=15m
     )
     IF no citizen in range: ABORT

  4. ASSEMBLE CONTEXT
     system_prompt, context_block = assemble_citizen_context(
       citizen_id    = nearest_citizen.id,
       visitor_id    = visitor.id,
       visitor_speech = visitor_speech
     )

  5. CALL LLM
     response = claude_api.call(
       model      = "claude-sonnet-4-20250514",
       system     = system_prompt,
       messages   = [
         { role: "user", content: context_block }
       ],
       max_tokens = 300,
       temperature = 0.8,
     )

  6. VALIDATE RESPONSE
     # Check: does response contradict citizen's economic state?
     # Check: does response break character?
     # Check: is response in the same language as visitor_speech?
     IF validation_fails:
       response = regenerate_with_correction_prompt()

  7. SYNTHESIZE SPEECH
     audio = elevenlabs_tts(
       text     = response.text,
       voice_id = citizen.voice_id,
       model    = "eleven_turbo_v2_5",
     )

  8. TRANSMIT
     websocket.send_binary(audio_buffer, to=visitor.connection)
     # Audio plays spatially at citizen's 3D position

  9. PERSIST
     write_memory(citizen, visitor, conversation_so_far)
     update_trust(citizen, visitor, conversation_so_far, citizen.mood)

  10. UPDATE STATE
      citizen.state = CONVERSING
      citizen.conversation_timeout = 30 seconds
      # Citizen waits for visitor's next utterance or timeout
```

---

## A10. Cross-Citizen Memory Propagation

Citizens talk to each other. When they do, information about the visitor can spread.

```
FUNCTION propagate_visitor_reputation(citizen_A, citizen_B):
  # When citizen A and citizen B have a conversation (daily social tick),
  # there is a chance they discuss known visitors.

  shared_visitors = intersection(
    citizen_A.known_visitors,
    citizen_B.known_visitors
  )

  FOR visitor in shared_visitors:
    trust_A = citizen_A.trust_with(visitor)
    trust_B = citizen_B.trust_with(visitor)

    # Citizens share opinions about visitors they both know
    IF trust_A > 60 AND trust_B < 40:
      # A trusts visitor, B doesn't. A may vouch for visitor.
      # B's trust increases slightly.
      trust_B_new = apply_scaled_score_change(trust_B, +0.5)
      # Memory: "Elena says the Forestiere is trustworthy."

    IF trust_A < 30 AND trust_B > 50:
      # A distrusts visitor, B trusts them. A may warn B.
      # B's trust decreases slightly.
      trust_B_new = apply_scaled_score_change(trust_B, -0.3)
      # Memory: "Marco warned me about the Forestiere."

  # Citizens can also propagate information about visitors
  # they know to citizens who have never met the visitor.
  # This creates pre-existing reputation before first meeting.

  FOR visitor in citizen_A.known_visitors:
    IF visitor NOT in citizen_B.known_visitors:
      IF citizen_A.trust_with(citizen_B) > 60:
        # A trusts B enough to share information
        IF citizen_A.trust_with(visitor) > 70:
          # "You should talk to a Forestiere I know. Good person."
          citizen_B.pre_reputation[visitor] = +3
        IF citizen_A.trust_with(visitor) < 20:
          # "Watch out for a Forestiere asking questions."
          citizen_B.pre_reputation[visitor] = -2
```
