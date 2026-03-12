# PATTERNS -- Voice Pipeline

> Design philosophy for the end-to-end speech flow in Venezia.
> Voice is the only interface. There are no text boxes, no menus, no buttons.

---

## Core Principle: Voice-First, Voice-Only

The visitor walks into Renaissance Venice and speaks. A citizen nearby responds.
That is the entire interface. If voice breaks, the world breaks.

The pipeline exists to make this feel effortless:

```
Visitor speaks  -->  silence  -->  citizen responds from their position in 3D space
```

No confirmation dialogs. No "processing" spinners. No typed fallback.
The one exception: if TTS fails completely, the citizen's words appear as floating
text near their avatar for 5 seconds, then fade. This is the only visual text in
the entire experience.

---

## Latency Is King

**Budget: < 3 seconds from end-of-speech to first audible syllable of response.**

Every millisecond matters. The pipeline is structured around three serial phases,
each with a hard target:

| Phase             | Target  | Current    | Technique                           |
|-------------------|---------|------------|-------------------------------------|
| STT (Whisper API) | < 800ms | ~500-700ms | Streaming upload, webm/opus codec   |
| LLM (GPT-4o)      | < 1000ms| ~600-900ms | Short system prompt, max_tokens=150 |
| TTS first byte    | < 500ms | ~300-400ms | ElevenLabs streaming endpoint       |

Total wall clock: **1.3-2.0 seconds** in practice. The key optimization is that
TTS begins playing before the full audio is generated -- the first chunk of MP3
arrives while ElevenLabs is still synthesizing the rest.

### Why GPT-4o, Not Claude

The voice LLM is GPT-4o, not Claude. This is a deliberate architectural decision:
- GPT-4o averages ~600ms for a 1-2 sentence response at max_tokens=150
- Claude API adds ~200-400ms latency for equivalent responses
- Voice conversations tolerate zero extra latency; 200ms is perceptible
- Heavy work (code edits, file changes, task execution) routes to Claude Code
  sessions via the orchestrator -- those are async and latency-insensitive

The voice LLM is a fast mouth. Claude is the deep brain. They complement.

### Streaming Architecture

The pipeline never waits for a complete result before starting the next phase:

```
[mic capture]
    |
    v
[STT: Whisper API]  -- audio uploaded as webm/opus (small, ~16kB/s)
    |
    v  (transcription text)
[LLM: GPT-4o]       -- max_tokens=150, temperature=0.9 for citizen personality
    |
    v  (response text)
[TTS: ElevenLabs streaming]
    |
    +--> chunk 1 arrives (300ms) --> client starts playback
    +--> chunk 2 arrives (50ms later)
    +--> chunk 3 arrives ...
    +--> stream ends
```

The client collects all chunks, concatenates into a single ArrayBuffer, then
plays through the Web Audio API HRTF panner at the citizen's 3D position.
Future optimization: progressive playback (play chunk 1 while chunk 2 downloads).

---

## Voice Diversity Strategy

152 citizens cannot all sound the same. The current prototype uses a single
ElevenLabs voice ID for all speakers. Venezia needs a voice assignment system.

### The Plan: Voice Tiers by Social Class

ElevenLabs provides three mechanisms:
1. **Voice Library** -- pre-made voices (free, hundreds available)
2. **Voice Design** -- generate a voice from a text description ("elderly Venetian
   man, warm baritone, speaks slowly")
3. **Voice Cloning** -- clone from audio sample (premium, high fidelity)

Proposed allocation:

| Tier          | Citizens | Voice Method        | Cost        |
|---------------|----------|---------------------|-------------|
| Named NPCs   | ~10      | Voice Design (custom)| One-time    |
| Merchants     | ~30      | Voice Library pool   | Free        |
| Artisans      | ~50      | Voice Library pool   | Free        |
| Common folk   | ~96      | OpenAI TTS rotation  | Per-request |

Named NPCs (the Doge, guild leaders, key storyline figures) get individually
designed voices via ElevenLabs Voice Design API. Each voice is generated once
from a text description and cached as a voice_id.

Merchants and artisans draw from a curated pool of ~15 ElevenLabs Library voices,
assigned deterministically by citizen_id hash. Same citizen always gets the same
voice, but nearby citizens will sound different.

Common folk use OpenAI TTS with its 6 built-in voices (alloy, echo, fable, nova,
onyx, shimmer), rotated by citizen_id. Cheaper, slightly less natural, but
adequate for background conversations.

### Voice Assignment Algorithm

```
voice_id = assign_voice(citizen):
    if citizen.tier == "named":
        return citizen.custom_voice_id   // pre-generated via Voice Design
    elif citizen.tier in ["merchant", "artisan"]:
        pool = ELEVENLABS_LIBRARY_VOICES  // ~15 curated voices
        index = hash(citizen.id) % len(pool)
        return pool[index]
    else:
        voices = ["alloy", "echo", "fable", "nova", "onyx", "shimmer"]
        index = hash(citizen.id) % len(voices)
        return { provider: "openai", voice: voices[index] }
```

Gender matching: citizen metadata includes gender. The voice pool is split into
male/female subsets, and the hash selects within the matching subset.

### Language Handling

Citizens respond in the language the visitor speaks. The LLM system prompt
instructs: "Match the speaker's language (French or English)." ElevenLabs
Turbo v2.5 handles both languages natively with the same voice_id -- no
language-specific voice switching needed.

The STT step (Whisper) auto-detects language. No language parameter is passed.

---

## The Silence-Is-Valid Principle

Not every utterance deserves a response. The pipeline must know when to stay
silent:

1. **STT returns empty or garbage** -- citizen says nothing. No error message,
   no "I didn't understand you." The visitor simply hears... nothing. They can
   try again. This feels natural -- like speaking to someone who didn't hear you.

2. **STT returns text but no citizen is in range** -- nobody responds. The visitor
   is talking to empty air. The pipeline short-circuits before the LLM call.
   Range check: 15 meters (SPEECH_RANGE constant in ai-citizens.js).

3. **Citizen is on cooldown** -- another citizen spoke within the last 10 seconds
   (COOLDOWN_MS). The world doesn't stack responses. One citizen at a time
   responds to the visitor. Others continue their ambient behavior.

4. **Audio too short** -- recordings under 1000 bytes are discarded (accidental
   button press). No STT call is made.

Silence is not a bug. Silence is the world breathing.

---

## Concurrent Audio: The Cocktail Party Problem

Multiple audio streams play simultaneously:
- A citizen responding to the visitor (foreground, spatially positioned)
- Ambient conversations between AI citizens (background, distant)
- WebRTC peer-to-peer voice (other human visitors in the room)

Each stream gets its own spatial audio treatment:

- **HRTF PannerNode** per audio source -- Web Audio API handles binaural
  spatialization. The visitor's headset orientation determines what sounds
  "left," "right," "in front," "behind."
- **Distance rolloff** -- `distanceModel: 'inverse'`, `rolloffFactor: 1.5`,
  `refDistance: 1m`, `maxDistance: 50m`. A citizen 20m away is barely audible.
  A citizen 2m away is clear and present.
- **No mixing conflicts** -- each citizen's TTS stream creates its own audio
  source node. The Web Audio API mixes them spatially before output. No manual
  gain management needed for up to ~10 concurrent sources.

### Priority Rules

When the visitor speaks to a citizen and that citizen responds:
1. The responding citizen's audio is played at normal volume from their position
2. Any ambient conversations continue (they are far enough away to be faint)
3. No audio ducking or interruption of other streams

If two citizens both want to respond (e.g., visitor is equidistant between two):
the nearest one wins. Only one citizen responds per visitor utterance.

---

## Fallback Chain

The pipeline degrades gracefully. Each component has a fallback:

```
STT:  Whisper API  -->  (no fallback -- if STT fails, silence)
LLM:  GPT-4o       -->  (no fallback -- if LLM fails, silence)
TTS:  ElevenLabs   -->  OpenAI TTS  -->  browser speechSynthesis
```

- **ElevenLabs down**: OpenAI TTS (`tts-1` model, ~1.5s latency instead of ~0.4s).
  Quality drops slightly, but the visitor still hears a voice.
- **OpenAI TTS also down**: browser `speechSynthesis` API (last resort, robotic
  but functional on Quest browser). Not yet implemented.
- **All TTS fails**: response text appears as floating 3D text near the citizen
  for 5 seconds. This is the only text ever shown in the experience.

The fallback chain is tested on every deployment. If ElevenLabs returns non-200,
the code immediately falls through to OpenAI. No retry, no delay.

---

## Push-to-Talk, Not Always-On

Voice capture uses push-to-talk, not continuous VAD:
- **Quest 3 VR**: A button on right controller (via VRControls)
- **Desktop**: hold Space bar
- **Mobile/tablet**: not yet supported

Rationale: always-on VAD in a shared 3D world would capture ambient noise, other
visitors' speech, and the citizen's own TTS playing through speakers. Push-to-talk
is explicit intent: "I am speaking to you now."

Future: client-side VAD (e.g., Silero VAD in WebAssembly) could enable hands-free
mode, but only after solving echo cancellation with spatial audio playback.

---

## WebSocket Protocol

All voice data flows over the existing WebSocket connection (port 8800, path `/ws`).
No separate voice server, no WebRTC for AI-to-visitor audio.

Message types for the voice pipeline:

| Direction        | Type                  | Payload                                  |
|------------------|-----------------------|------------------------------------------|
| Client -> Server | `voice`               | `{ audio: base64_webm }`                 |
| Server -> Client | `voice_stream_start`  | `{ transcription, response, sttMs, llmMs }` |
| Server -> Client | `voice_stream_data`   | `{ chunk: base64_mp3, index }`           |
| Server -> Client | `voice_stream_end`    | `{ chunks, latency }`                    |
| Server -> Client | `ai_citizen_speak`    | `{ citizenId, citizenName, text, position }` |
| Server -> Client | `citizen_voice`       | `{ citizenId, name, audio: base64_webm }` |
| Client -> Server | `biography_voice`     | `{ audio: base64_webm, donorId }`        |

Voice messages are room-scoped: only visitors in the same room hear each other
and the AI citizen responses triggered by their speech.

---

## The Non-Negotiables

1. **No text input anywhere.** Voice is the interface. Period.
2. **< 3 seconds latency.** If it takes longer, the illusion of a living world breaks.
3. **Spatial audio on every response.** The citizen's voice comes from their position.
   Flat stereo is not acceptable.
4. **Silence over error messages.** A citizen that says "Sorry, I couldn't process
   your request" is worse than a citizen that stays quiet.
5. **Same language response.** Speak French, hear French. Speak English, hear English.
   No language configuration, no settings menu.
