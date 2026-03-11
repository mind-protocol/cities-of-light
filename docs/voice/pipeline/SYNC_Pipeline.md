# SYNC -- Voice Pipeline

> Current state of voice infrastructure across Cities of Light and Manemus.
> What exists, what needs merging, what must be built from scratch.

---

## What Exists in Cities of Light

The Cities of Light repo has a **complete, working voice pipeline** running on
port 8800. It handles the full flow from mic capture to spatial playback.

### Server Side

| File                         | Status  | Function                                    |
|------------------------------|---------|---------------------------------------------|
| `src/server/voice.js`        | Working | STT (Whisper API) + LLM (GPT-4o) + TTS (ElevenLabs streaming) |
| `src/server/biography-voice.js` | Working | STT + biography archive query + TTS      |
| `src/server/ai-citizens.js`  | Working | 3 AI citizens (VOX, LYRA, PITCH), proximity detection, LLM response |
| `src/server/index.js`        | Working | WebSocket message routing, room-scoped broadcast |
| `src/server/rooms.js`        | Working | Room management, peer lists for WebRTC signaling |

**`voice.js` capabilities:**
- `processVoice()` -- non-streaming: full STT + LLM + TTS, returns base64 audio
- `processVoiceStreaming()` -- streaming: sends TTS chunks over WebSocket as they arrive
- `speakToWorld()` -- TTS broadcast from POST /speak (sessions push voice into VR)
- `speakAsAICitizen()` -- TTS with citizen ID and position for spatial playback
- `callLLM()` -- GPT-4o with tool support (`invoke_session` for spawning Claude Code)
- `buildSystemPrompt()` -- assembles context from journal, biometrics, dialogue, perception, sessions
- Conversation history: rolling 20-turn window
- TTS fallback: ElevenLabs -> OpenAI TTS
- Dialogue logging to Manemus `dialogue.jsonl`

**`ai-citizens.js` capabilities:**
- 3 citizens with distinct personalities and system prompts
- 5-second behavior tick: wander within home zone radius
- `checkProximityAndRespond()`: 15m range, 10s cooldown, nearest-citizen selection
- Per-citizen conversation history (10-turn rolling window)
- GPT-4o for responses (max_tokens=150, temperature=0.9)

### Client Side

| File                         | Status  | Function                                    |
|------------------------------|---------|---------------------------------------------|
| `src/client/voice.js`        | Working | Mic capture (MediaRecorder, webm/opus), HRTF spatial playback, streaming TTS handler |
| `src/client/voice-chat.js`   | Working | WebRTC peer-to-peer spatial voice between human visitors |
| `src/client/network.js`      | Working | WebSocket client, all voice message types wired |
| `src/client/main.js`         | Working | Push-to-talk (A button VR, Space desktop), stream mode audio |

**`voice.js` (SpatialVoice class) capabilities:**
- `init()` -- mic access (16kHz mono, echo cancellation, noise suppression)
- `startRecording()` / `stopRecording()` -- push-to-talk via MediaRecorder
- `playAtPosition()` -- decode + play base64 audio through HRTF PannerNode
- `playRawAtPosition()` -- play webm/opus citizen voice (Audio element + spatial fallback)
- `handleStreamStart/Data/End()` -- collect streamed TTS chunks, concatenate, play
- `updateListener()` -- per-frame HRTF listener position from camera/headset
- Crossfade: 300ms fade-out of previous audio, 200ms fade-in of new
- Subtitle display: 20s visible, then 2s CSS opacity fade

**`voice-chat.js` (VoiceChat class) capabilities:**
- WebRTC PeerConnection per remote citizen
- STUN servers (Google public STUN)
- HRTF PannerNode per peer (inverse distance model, rolloff 1.5)
- Per-frame spatial position updates from avatar transforms
- ICE candidate relay via WebSocket signaling
- Mute/unmute toggle
- ~0.5ms CPU per peer, ~2MB memory per peer

---

## What Exists in Manemus

Manemus has a mature voice pipeline built for a different context (desktop daemon,
terminal interface, Telegram bridge). Components relevant to Venezia:

| File                          | Status  | Function                                    |
|-------------------------------|---------|---------------------------------------------|
| `scripts/speak.py`            | Working | ElevenLabs TTS, markdown stripping, file lock for concurrent TTS |
| `scripts/audio_buffer.py`     | Working | Rolling 60s audio buffer (20 x 3s WAV chunks), Whisper transcription |
| `scripts/voice_server.py`     | Working | FastAPI/uvicorn WebSocket server for real-time voice (STT + Claude + TTS) |

**`speak.py` capabilities (relevant to Venezia):**
- Markdown stripping before TTS (removes code blocks, headers, links, bullets)
- File-based TTS lock (`/tmp/mind_tts.lock`) prevents simultaneous playback
- ElevenLabs API call with voice_settings (stability, similarity_boost)
- Voice interrupt detection via audio probing (not applicable to VR)

**`audio_buffer.py` capabilities (relevant to Venezia):**
- Continuous recording in 3s WAV chunks with ring buffer
- PulseAudio/ALSA/WASAPI capture strategies
- Whisper API transcription with:
  - Non-Latin character rejection (filters hallucinated Chinese/Arabic)
  - `no_speech_prob` filter (threshold 0.6)
  - Repetition detection (catches Whisper loops like "Thank you thank you thank you")
- On-demand buffer concatenation for any time window

**`voice_server.py` capabilities (relevant to Venezia):**
- Real-time STT -> Claude -> TTS over WebSocket
- Client-side VAD (voice activity detection)
- Sentence-by-sentence streaming TTS
- 10-turn conversation history per session

---

## What Needs Merging

### From Manemus into Cities of Light

1. **Whisper hardening** (from `audio_buffer.py`)

   Cities of Light currently trusts Whisper output blindly. Manemus has three
   filters that prevent bad transcriptions from reaching the LLM:

   - **Non-Latin rejection**: If transcription contains primarily non-Latin
     characters (Chinese, Arabic, Cyrillic), discard it. Whisper hallucinates
     these on silence or noise.
   - **no_speech_prob filter**: Whisper returns a confidence score. If
     `no_speech_prob > 0.6`, discard.
   - **Repetition detection**: If the transcription is a repeated phrase
     ("thank you thank you thank you"), discard. Whisper does this on
     rhythmic background noise.

   **Action**: Port the three filters from `audio_buffer.py` into
   `src/server/voice.js` after the Whisper API call. Requires switching from
   simple `transcriptions.create()` to using `verbose_json` response format
   to access `no_speech_prob`.

2. **Markdown stripping** (from `speak.py`)

   LLM responses sometimes contain markdown even when instructed not to.
   Manemus strips it before TTS. Cities of Light should do the same.

   **Action**: Port `strip_markdown()` from `speak.py` into `voice.js`,
   apply to LLM response before sending to TTS.

3. **TTS file lock / concurrency guard**

   Manemus uses a file lock to prevent multiple TTS calls from overlapping.
   Cities of Light has a different concurrency model (WebSocket per client,
   room-scoped broadcast), but needs equivalent protection: if two visitors
   trigger AI citizen responses simultaneously, TTS calls should be queued
   or the second one should be dropped.

   **Action**: Add a per-citizen speaking lock in `ai-citizens.js`. Already
   partially done (citizen.action === "speaking" check), but the global
   cooldown is too coarse -- it blocks ALL citizens, not just the one speaking.

---

### Already Present in Both (No Merge Needed)

| Capability                | Cities of Light        | Manemus                |
|---------------------------|------------------------|------------------------|
| ElevenLabs TTS            | `voice.js` (streaming) | `speak.py` (blocking)  |
| OpenAI TTS fallback       | `voice.js`             | `speak.py`             |
| Whisper STT               | `voice.js` (API)       | `audio_buffer.py` (API)|
| Conversation history      | 20-turn rolling        | 10-turn rolling        |
| Dialogue logging          | `dialogue.jsonl`       | `dialogue.jsonl`       |
| Push-to-talk              | A button / Space       | F9 key                 |

---

## What Must Be Built New

These capabilities do not exist in either codebase and must be created for Venezia:

### 1. Voice Assignment System

186 citizens need distinct voices. Neither codebase has multi-voice support.

**Required:**
- Voice assignment table: citizen_id -> voice_id mapping
- ElevenLabs Voice Library integration (curate ~15 voices)
- ElevenLabs Voice Design API integration (generate voices for named NPCs)
- Gender-aware voice pool selection
- Persistent mapping (same citizen always gets same voice across sessions)
- Storage: `data/voice_assignments.json` or database table

**Estimated effort:** 2-3 days

### 2. Ambient Citizen Conversations

AI citizens currently only speak when a visitor talks to them. They need to
talk to each other autonomously -- ambient background chatter that makes the
world feel alive.

**Required:**
- Conversation trigger: two citizens within range of each other
- Topic generation: context-appropriate (trade, weather, gossip)
- Turn-taking: citizen A speaks, pause, citizen B responds
- Spatial audio: both voices positioned at their respective locations
- Volume: ambient conversations should be quieter than direct responses
- Rate limiting: max 1 ambient conversation per 30 seconds in any zone

**Estimated effort:** 3-5 days

### 3. VAD (Voice Activity Detection) Option

Push-to-talk works but requires a controller button. For hands-free mode
(walking around, looking at things, speaking naturally):

**Required:**
- Client-side VAD (Silero VAD compiled to WebAssembly)
- Echo cancellation: must not detect TTS playback as speech
- Start/stop detection: voice onset -> start recording, silence for 1.5s -> stop
- Fallback: push-to-talk always available as override
- Config: toggle in settings (VR controller menu)

**Estimated effort:** 5-7 days (VAD + echo cancellation is hard)

### 4. Progressive Streaming Playback

Current streaming TTS collects ALL chunks before playing. The pipeline should
play the first chunk immediately while subsequent chunks download.

**Required:**
- MediaSource Extensions (MSE) or AudioWorklet for progressive decode
- Buffer management: queue chunks, decode incrementally
- Seamless playback: no gaps between chunks
- Error handling: if a chunk is corrupted, skip it

**Estimated effort:** 3-4 days

### 5. Scaling to 186 Citizens

Current: 3 AI citizens, all in server memory, GPT-4o call per response.

For 186 citizens:
- Citizens not near any visitor should be dormant (no LLM calls)
- Only citizens within SPEECH_RANGE of a visitor activate
- System prompts must be loaded on demand, not all held in memory
- Conversation history: persist to disk, load on proximity
- LLM calls: consider batching or using a faster/cheaper model for background chatter

**Estimated effort:** 5-7 days

---

## Architecture Comparison

```
CITIES OF LIGHT (current)              MANEMUS (current)
========================               =====================

Quest mic                              Desktop mic (PulseAudio)
    |                                      |
MediaRecorder (webm/opus)              audio_buffer.py (WAV chunks)
    |                                      |
WebSocket (base64)                     File on disk
    |                                      |
voice.js: Whisper API                  Whisper API + filters
    |                                      |
voice.js: GPT-4o                       Claude Code / Claude API
    |                                      |
voice.js: ElevenLabs stream            speak.py: ElevenLabs blocking
    |                                      |
WebSocket (base64 MP3 chunks)          ffplay (local speaker)
    |                                      |
voice.js client: HRTF PannerNode       N/A (no spatial audio)
    |
Quest speakers (binaural)


KEY DIFFERENCES:
- Cities: browser-based, WebSocket transport, spatial audio
- Manemus: system-level, file-based, mono audio
- Cities: GPT-4o (fast, for voice)
- Manemus: Claude (deep, for work)
- Cities: streaming TTS
- Manemus: blocking TTS
- Cities: no STT filters
- Manemus: 3 STT filters (non-Latin, no_speech, repetition)
```

---

## File Map

All voice-related files in the Cities of Light repo:

```
src/
  server/
    voice.js             # Main pipeline: STT + LLM + TTS (streaming + non-streaming)
    biography-voice.js   # Biography archive voice query pipeline
    ai-citizens.js       # AI citizen definitions, proximity detection, LLM response
    index.js             # WebSocket routing for all voice message types
    rooms.js             # Room-scoped broadcast, WebRTC signaling relay
  client/
    voice.js             # SpatialVoice: mic capture, HRTF playback, streaming handler
    voice-chat.js        # VoiceChat: WebRTC peer-to-peer spatial voice
    network.js           # WebSocket client, voice message types
    main.js              # Push-to-talk wiring, stream mode audio init

docs/
  voice/
    pipeline/
      PATTERNS_Pipeline.md    # Design philosophy (this doc set)
      BEHAVIORS_Pipeline.md   # Observable visitor experience
      ALGORITHM_Pipeline.md   # Pseudocode for all pipeline stages
      SYNC_Pipeline.md        # Current state and merge plan (this file)
```

---

## Deployment Notes

- Server runs on port 8800 (HTTP) and 8443 (HTTPS, self-signed cert for Quest)
- HTTPS is required for Quest microphone access (getUserMedia)
- WebSocket path: `/ws` (same port as HTTP server)
- Self-signed cert generated to `/tmp/cities-cert.pem` and `/tmp/cities-key.pem`
- API keys loaded from Manemus `.env` file (`/home/mind-protocol/manemus/.env`):
  - `OPENAI_API_KEY` (Whisper STT + GPT-4o + OpenAI TTS fallback)
  - `ELEVENLABS_API_KEY` (primary TTS)
  - `ELEVENLABS_VOICE_ID` (default voice, currently "Adam")
- No TURN server for WebRTC -- STUN only (Google public). Peer-to-peer voice
  will fail behind symmetric NATs. Acceptable for local/LAN use; production
  needs a TURN server (e.g., Twilio, Cloudflare).

---

## Priority Roadmap

| Priority | Task                          | Blocks                     | Effort  |
|----------|-------------------------------|----------------------------|---------|
| P0       | Whisper STT hardening         | False transcriptions       | 1 day   |
| P0       | Markdown stripping            | TTS reads "asterisk asterisk" | 0.5 day |
| P1       | Voice assignment (15 voices)  | All citizens sound identical | 2-3 days |
| P1       | Progressive streaming playback| ~1s unnecessary latency    | 3-4 days |
| P2       | Ambient citizen conversations | World feels empty/silent   | 3-5 days |
| P2       | 186-citizen scaling           | Memory/cost at scale       | 5-7 days |
| P3       | Client-side VAD               | Requires button press      | 5-7 days |
| P3       | TURN server for WebRTC        | P2P fails on public internet | 1 day  |
