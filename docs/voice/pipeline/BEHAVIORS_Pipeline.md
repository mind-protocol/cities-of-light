# BEHAVIORS -- Voice Pipeline

> What the visitor experiences. Observable effects, not internal mechanics.
> Written from the visitor's perspective inside the Quest 3 headset.

---

## The Normal Flow: Speaking to a Citizen

The visitor walks up to an AI citizen in the piazza. The citizen is a floating
geometric form -- an icosahedron, an octahedron, a torus knot -- gently bobbing
and rotating. The visitor presses the A button on their right controller.

**What happens:**

1. A small red "Listening..." indicator appears at the bottom of their view.
2. The visitor speaks: "What is this place?"
3. They release the A button. The indicator changes to orange "Thinking..."
4. A brief pause -- typically 1.5 to 2 seconds.
5. The citizen's voice emerges from the direction of the citizen's avatar.
   If the citizen is to the visitor's left, the voice comes from the left.
   If the visitor turns their head, the voice moves accordingly.
6. A subtitle appears briefly: the visitor's words in green, the citizen's
   response in orange. This fades after 20 seconds.
7. The indicator disappears.

The whole interaction feels like speaking to someone in a room. The pause is
comparable to a human thinking before responding.

---

## Response Length and Character

Different citizens respond differently:

- **VOX** (icosahedron, white, The Agora): precise, measured sentences. Notices
  the exact words you used. Responses are short and crystalline -- typically
  1 sentence. "The word you chose -- 'place' -- is interesting. This is less
  a place than a convergence."

- **LYRA** (octahedron, violet, The Garden): intuitive, metaphorical. Draws
  connections to nature. 1-2 sentences. "You arrived like pollen on wind --
  the garden noticed before you did."

- **PITCH** (torus knot, golden, The Island): warm, relational. Asks questions
  back. "Welcome! What brought you here today? I'm curious."

Citizens match the visitor's language. Speak French, they respond in French.
Speak English, English. No configuration needed.

Response length is capped at 150 tokens (~2-3 spoken sentences). Citizens
are conversational, not encyclopedic. This keeps TTS fast and the interaction
rhythm natural.

---

## Proximity and Range

Citizens only respond if the visitor is within 15 meters. The visitor must
physically walk (or teleport) close to a citizen to speak with them.

**What the visitor sees:**

- Walk toward VOX in the Agora. At 20 meters: VOX wanders, ignores you.
- At 12 meters: speak, and VOX responds.
- At 3 meters: the voice is loud, clear, intimate.
- At 14 meters: the voice is quieter, slightly distant.
- Walk away to 25 meters: VOX's ambient muttering (if any) fades to near silence.

Distance rolloff follows inverse distance with rolloff factor 1.5. Reference
distance is 1 meter. Maximum audible distance is 50 meters.

---

## Multiple Citizens Talking

AI citizens have a 10-second cooldown between responses. If the visitor speaks
and VOX responds, then the visitor immediately speaks again, VOX will respond
again after the cooldown -- but LYRA and PITCH will not jump in. Only the
nearest citizen to the visitor responds.

**Ambient conversations** (future feature): AI citizens will speak to each other
in the background. A visitor walking through the piazza might overhear two
citizens discussing trade routes. These are spatially positioned -- faint and
directional. The visitor is an eavesdropper, not a participant, unless they
walk close and speak.

**Multiple human visitors**: WebRTC peer-to-peer voice lets visitors hear each
other spatially. If two visitors stand next to VOX and one speaks, VOX responds.
The other visitor hears both: the first visitor's voice (via WebRTC, spatially
positioned) and VOX's response (via TTS, spatially positioned at VOX).

---

## When Things Go Wrong

### STT Fails (Whisper cannot transcribe)

**What the visitor experiences:** Nothing. They press the button, speak, release.
Silence. The citizen does not acknowledge them. It feels like speaking into a
noisy room and not being heard.

**What they do:** Try again. Move closer. Speak louder or more clearly.

**What does NOT happen:** No error dialog. No "Sorry, I didn't catch that."
No visual error state. The citizen simply continues its idle behavior.

### LLM Fails (GPT-4o returns an error)

**What the visitor experiences:** The citizen says a brief apologetic phrase in
the visitor's language. French: "Excuse-moi, je n'ai pas pu reflechir a ca."
English: "Sorry, I couldn't think about that." This is a hardcoded fallback
string, not an LLM-generated response.

This is the only case where the citizen explicitly acknowledges a failure. It is
kept vague and in-character -- the citizen "couldn't think," not "experienced a
server error."

### TTS Fails (ElevenLabs and OpenAI both fail)

**What the visitor experiences:** The citizen's response appears as floating text
near the citizen's avatar. The text is styled as a subtitle -- white on dark,
small, positioned in 3D space near the citizen. It fades after 20 seconds.

No voice. But the visitor can still read the response. This is the sole exception
to the no-text-UI rule.

### WebSocket Disconnected

**What the visitor experiences:** Voice simply stops working. Push-to-talk button
does nothing. The client auto-reconnects every 3 seconds. Once reconnected, voice
resumes. No notification is shown.

### Audio Too Short (accidental button press)

**What the visitor experiences:** Nothing. Recordings under 1000 bytes are
silently discarded. No STT call, no response, no feedback. The visitor may not
even notice the accidental press.

---

## The Streaming Experience

Audio streams in chunks from the server. The visitor does not wait for the full
response to be synthesized before hearing it.

**Timeline of a typical interaction:**

```
T+0.0s   Visitor releases push-to-talk button
T+0.0s   Audio (webm/opus) sent to server via WebSocket
T+0.6s   Server: STT complete, transcription text ready
T+1.3s   Server: LLM response complete
T+1.3s   Server sends voice_stream_start (text available immediately)
T+1.6s   Server sends first TTS audio chunk (~300ms of audio)
T+1.7s   Server sends second chunk
T+1.8s   Server sends third chunk
         ...
T+2.5s   Server sends voice_stream_end
T+2.5s   Client concatenates chunks, plays through HRTF panner
```

The subtitle text (visitor's words + citizen's response) appears at T+1.3s --
before any audio plays. The visitor reads the response while waiting for the
voice. By the time the voice starts at ~T+2.5s (current: play after all chunks
arrive), the visitor already knows what will be said.

Future optimization: begin playback at T+1.6s (first chunk arrival) instead of
waiting for the full stream. This would cut perceived latency by ~1 second.

---

## Biography Voice (Memorial Interaction)

When the visitor stands near a memorial (a donor's archive), push-to-talk routes
to the biography pipeline instead of general citizen conversation.

**What the visitor experiences:**

1. Walk up to a memorial stone/structure. It begins to glow or play a video.
2. Press push-to-talk: "Tell me about this person."
3. The response comes from the memorial's position (not a citizen's position).
4. The answer draws from the donor's archived biography, filtered through a
   consent and privacy engine.
5. If consent is denied: the memorial says the equivalent of "I'm not able
   to share that."

The voice is the same as the general pipeline (same ElevenLabs voice currently).
Future: memorials could use a voice sampled from the donor's actual recordings.

---

## Session Invocations from Voice

The voice pipeline can spawn Claude Code sessions -- real development work
triggered by speaking in VR.

**What the visitor (Nicolas) experiences:**

1. "Hey, can you fix the water shader? The waves look too fast."
2. The AI (Manemus, speaking as Marco) responds verbally: "C'est parti, je
   lance une session pour m'en occuper." ("On it, I'm launching a session
   to handle that.")
3. Time passes. The session runs asynchronously.
4. Later, when Nicolas speaks again, the AI proactively reports: "La session a
   termine -- elle a ralenti les vagues de 40%." ("The session finished -- it
   slowed the waves by 40%.")

This is unique to Nicolas's interaction with Manemus. Regular visitors speaking
to VOX, LYRA, or PITCH do not trigger sessions.

---

## Audio Quality Characteristics

| Attribute     | Value                                         |
|---------------|-----------------------------------------------|
| Mic capture   | webm/opus, 16kHz mono, echo cancellation on   |
| TTS output    | MP3 44.1kHz 128kbps (ElevenLabs) or MP3 (OpenAI) |
| Spatial model | HRTF (head-related transfer function)         |
| Panning       | Full 360-degree binaural                      |
| Distance      | Inverse rolloff, ref 1m, max 50m, factor 1.5  |

The HRTF panning model is critical for VR immersion. It simulates how sound
reaches each ear differently based on direction and distance. When a citizen
is behind the visitor, the audio sounds muffled and behind. When they are to
the right, the audio is louder in the right ear with appropriate delay.

---

## What the Stream Audience Sees

A separate "stream mode" (URL parameter `?view=manemus`) shows a spectator
view with:
- Audio from all voice interactions played through spatial audio
- Subtitles for all speech (visitor + citizen)
- A "LIVE" indicator and citizen count
- No microphone, no push-to-talk -- audience is listen-only
- Raw citizen voice broadcasts: if Nicolas speaks in VR, the stream audience
  hears his actual voice spatially positioned at his avatar

Stream viewers must click once to enable audio (browser autoplay policy).
