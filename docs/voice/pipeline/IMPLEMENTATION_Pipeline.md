# IMPLEMENTATION -- Voice Pipeline

> Concrete code, packages, interfaces, and integration points for the
> STT -> LLM -> TTS voice pipeline in Venezia.
> Reference source: `src/server/voice.js`, `src/client/voice.js`,
> `src/client/main.js`, `src/server/index.js`.

---

## 1. npm Dependencies

```json
{
  "dependencies": {
    "openai": "^6.18.0",
    "@anthropic-ai/sdk": "^0.74.0"
  }
}
```

The OpenAI SDK provides both Whisper STT and GPT-4o chat completions.
The Anthropic SDK is present for future citizen conversation migration to Claude.
ElevenLabs and OpenAI TTS are called via raw `fetch()` -- no dedicated SDK.

No additional packages are required for the voice pipeline. The `fs`, `os`,
`child_process`, and `path` modules from Node.js core handle file I/O, temp
files, and session invocation.

---

## 2. Environment Variables

```bash
# Required -- voice pipeline will not produce audio without these
OPENAI_API_KEY=sk-...                  # Whisper STT + GPT-4o + fallback TTS
ELEVENLABS_API_KEY=xi-...              # Primary TTS provider
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB   # Default voice ("Adam")

# Optional -- enriches system prompt context
HOME=/home/mind-protocol               # Used to locate manemus paths
CITIES_SERVICES_URL=http://localhost:8900   # FastAPI biography/consent backend
```

The voice module loads additional keys from `/home/mind-protocol/manemus/.env`
at import time. Keys already set in `process.env` are not overwritten.

```javascript
// src/server/voice.js, lines 18-31
const MANEMUS_DIR = '/home/mind-protocol/manemus';
try {
  const content = readFileSync(join(MANEMUS_DIR, '.env'), 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = process.env[key] || val;
    }
  }
} catch {}
```

---

## 3. Server-Side STT Integration (Whisper)

### 3.1 Audio Format: Client to Server

The client records via `MediaRecorder` with MIME type `audio/webm;codecs=opus`.
Audio is base64-encoded and sent as a JSON WebSocket message:

```javascript
// Client sends:
{ type: "voice", audio: "<base64 webm/opus data>" }
```

The server decodes and writes to a temp file for Whisper:

```javascript
// src/server/voice.js — processVoiceStreaming()
const tempPath = join(tmpdir(), `cities_voice_${Date.now()}.webm`);
writeFileSync(tempPath, audioBuffer);

const result = await openai.audio.transcriptions.create({
  file: createReadStream(tempPath),
  model: 'whisper-1',
});
const transcription = result.text?.trim();
```

### 3.2 Whisper API Parameters

| Parameter | Value | Reason |
|-----------|-------|--------|
| model | `whisper-1` | Only model available via API |
| file | ReadStream of `.webm` | Whisper accepts webm/opus natively |
| language | not set | Auto-detection for French/English bilingual |
| response_format | default (json) | Returns `{ text: "..." }` |

The temp file is not explicitly deleted. The OS cleans `/tmp` on reboot.
For production, add `unlinkSync(tempPath)` in a `finally` block.

### 3.3 Empty Transcription Handling

```javascript
if (!transcription) return;  // Silence — no response generated
```

Empty or null transcription means the audio was silence or noise.
The pipeline exits without sending any WebSocket messages.
The client receives no `voice_stream_start` and remains idle.

---

## 4. Server-Side LLM Integration (GPT-4o)

### 4.1 Conversation History

```javascript
const history = [];          // Module-level, persists across requests
const MAX_HISTORY = 20;      // Rolling window of turns

// On each voice message:
history.push({ role: 'user', content: transcription });
if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

const { response, sessionInvoked } = await callLLM(history, systemPrompt);

history.push({ role: 'assistant', content: response });
if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
```

History is shared across all visitors in the current server process.
This is intentional -- Manemus (Marco) maintains a single conversation thread.

### 4.2 callLLM Function Signature

```javascript
async function callLLM(messages, systemPrompt) {
  // Returns: { response: string, sessionInvoked: boolean }

  const result = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    tools: OPENAI_TOOLS,
    max_tokens: 300,
    temperature: 0.8,
  });

  // Extract text content and handle tool calls
  // ...
}
```

### 4.3 Tool Calling (Session Invocation)

The LLM has a single tool: `invoke_session`, which spawns a Claude Code
session via the Manemus orchestrator.

```javascript
const OPENAI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'invoke_session',
      description: 'Spawn a Claude Code session to modify code, fix bugs, build features...',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Detailed description of what to do.' },
          mode: { type: 'string', enum: ['partner', 'architect', 'critic'] },
        },
        required: ['task'],
      },
    },
  },
];
```

Execution pushes the task to the orchestrator via a Python subprocess:

```javascript
function executeInvokeSession(task, mode = 'partner') {
  const args = ['--mode', mode, `[Cities of Light voice request] ${task}`];
  execFile('python3', [PUSH_SCRIPT, ...args], (err, stdout, stderr) => {
    // Track in pendingSessions for later reporting
  });
}
```

### 4.4 System Prompt Assembly

`buildSystemPrompt()` constructs a context-rich prompt from live infrastructure:

| Source | Path | Content |
|--------|------|---------|
| Journal | `~/manemus/shrine/state/journal.jsonl` | Last 10 meaningful events |
| Biometrics | `~/manemus/knowledge/data/biometrics/latest.json` | HR, stress, body battery |
| Dialogue | `~/manemus/shrine/state/dialogue.jsonl` | Last 4 conversation turns |
| Perception | `~/manemus/cities-of-light/perception/latest.json` | Camera position, frame number |
| Sessions | In-memory `pendingSessions` array | Pending/completed Claude Code sessions |

Each section is appended only if the source file exists and parses correctly.
Failures are silently caught -- partial context is acceptable.

---

## 5. Server-Side TTS Integration (ElevenLabs Streaming)

### 5.1 Streaming API Call

```javascript
const ttsRes = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
  {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: response,
      model_id: 'eleven_turbo_v2_5',
      output_format: 'mp3_44100_128',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  }
);
```

### 5.2 Chunk Streaming to Client

The ElevenLabs response body is a readable stream of MP3 chunks.
Each chunk is base64-encoded and sent over WebSocket immediately:

```javascript
if (ttsRes.ok && ttsRes.body) {
  const reader = ttsRes.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunksStreamed++;
    send({
      type: 'voice_stream_data',
      chunk: Buffer.from(value).toString('base64'),
      index: chunksStreamed,
    });
  }
}
```

### 5.3 TTS Parameters

| Parameter | Value | Reason |
|-----------|-------|--------|
| model_id | `eleven_turbo_v2_5` | Lowest latency ElevenLabs model |
| output_format | `mp3_44100_128` | Wide compatibility, 128kbps quality |
| stability | 0.5 | Balanced naturalness vs. consistency |
| similarity_boost | 0.75 | Stay close to reference voice |

### 5.4 OpenAI TTS Fallback

If ElevenLabs fails (API error, missing key, zero chunks streamed):

```javascript
if (!streamedOk) {
  const ttsRes = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'onyx',
    input: response,
    response_format: 'mp3',
  });
  const ttsBuffer = Buffer.from(await ttsRes.arrayBuffer());
  send({
    type: 'voice_stream_data',
    chunk: ttsBuffer.toString('base64'),
    index: 1,
  });
  chunksStreamed = 1;
}
```

OpenAI TTS is not streaming -- the entire audio arrives as one chunk.
The client handles this identically (collects chunks, plays after stream end).

---

## 6. WebSocket Message Protocol

### 6.1 Client to Server

```javascript
// Push-to-talk voice message
{ type: "voice", audio: "<base64 webm/opus>" }

// Biography voice (near a memorial)
{ type: "biography_voice", audio: "<base64 webm/opus>", donorId: "donor_123" }
```

### 6.2 Server to Client (Streaming Sequence)

```javascript
// 1. Text arrives immediately (client shows subtitles)
{
  type: "voice_stream_start",
  transcription: "What Nicolas said",
  response: "What Manemus says back",
  sttMs: 450,
  llmMs: 1200
}

// 2. Audio chunks arrive as ElevenLabs streams them (~200ms apart)
{
  type: "voice_stream_data",
  chunk: "<base64 MP3 data>",
  index: 1
}
// ... more chunks ...

// 3. Stream end signal
{
  type: "voice_stream_end",
  chunks: 14,
  latency: 2800
}
```

### 6.3 AI Citizen Speech

```javascript
// Text + position (for subtitles and spatial placement)
{
  type: "ai_citizen_speak",
  citizenId: "ai_vox",
  citizenName: "VOX",
  text: "Response text",
  position: { x: 5.2, y: 1.2, z: -3.1 }
}

// Audio chunks tagged with source
{
  type: "voice_stream_data",
  chunk: "<base64 MP3>",
  index: 1,
  source: "ai-citizen",
  citizenId: "ai_vox"
}

// Stream end tagged with source
{
  type: "voice_stream_end",
  chunks: 8,
  latency: 1900,
  source: "ai-citizen",
  citizenId: "ai_vox"
}
```

---

## 7. Client-Side Mic Capture

### 7.1 SpatialVoice.init()

```javascript
// src/client/voice.js
async init() {
  this._ensurePlayback();  // AudioContext + PannerNode for HRTF playback

  this.mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000,       // Lower sample rate for STT (smaller files)
    },
  });
}
```

The `getUserMedia` constraint uses 16kHz for STT-bound audio (smaller uploads).
The playback AudioContext uses 44.1kHz for TTS audio quality.

### 7.2 Recording Flow

```javascript
startRecording() {
  const chunks = [];
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  this.recorder = new MediaRecorder(this.mediaStream, { mimeType });

  this.recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  this.recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size < 1000) return;  // Skip accidental presses

    const base64 = await this._blobToBase64(blob);
    if (this.onRecordingComplete) {
      this.onRecordingComplete(base64);
    }
  };

  this.recorder.start();
}
```

### 7.3 Push-to-Talk Triggers

```javascript
// VR: A button on right controller (via VRControls callback)
vrControls.onPushToTalkStart = () => {
  initVoice().then(() => spatialVoice.startRecording());
};
vrControls.onPushToTalkEnd = () => {
  spatialVoice.stopRecording();
};

// Desktop: Space bar hold
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && !renderer.xr.isPresenting) {
    e.preventDefault();
    initVoice().then(() => spatialVoice.startRecording());
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && !renderer.xr.isPresenting) {
    spatialVoice.stopRecording();
  }
});
```

### 7.4 Memorial Proximity Routing

When recording completes, the callback checks proximity to memorials:

```javascript
spatialVoice.onRecordingComplete = (base64) => {
  const nearMemorial = memorialManager.getNearestActiveMemorial();
  if (nearMemorial) {
    network.sendBiographyVoice(base64, nearMemorial.donor.id);
  } else {
    network.sendVoice(base64);
  }
};
```

---

## 8. Client-Side Streaming Playback

### 8.1 Chunk Collection

```javascript
handleStreamStart(msg, manemusPosition) {
  this._streamChunks = [];
  this._streamPosition = manemusPosition;
  // Show subtitle immediately -- text arrives before audio
  this.showTranscription(msg.transcription || '', msg.response || '');
}

handleStreamData(msg) {
  if (msg.chunk) {
    this._streamChunks.push(msg.chunk);
  }
}
```

### 8.2 Buffer Assembly and Spatial Playback

```javascript
async handleStreamEnd(msg) {
  if (this._streamChunks.length === 0) return;

  // Concatenate base64 chunks into single ArrayBuffer
  const combined = this._streamChunks.map(c => this._base64ToArrayBuffer(c));
  const totalLength = combined.reduce((sum, buf) => sum + buf.byteLength, 0);
  const fullBuffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of combined) {
    fullBuffer.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  this._streamChunks = [];
  await this._playBuffer(fullBuffer.buffer, this._streamPosition);
}
```

### 8.3 Crossfade Logic

```javascript
_crossfadeOut() {
  if (this._activeSource && this._activeGain) {
    const now = this.audioContext.currentTime;
    this._activeGain.gain.setValueAtTime(this._activeGain.gain.value, now);
    this._activeGain.gain.linearRampToValueAtTime(0, now + 0.3);
    const oldSource = this._activeSource;
    setTimeout(() => { try { oldSource.stop(); } catch(e) {} }, 350);
    this._activeSource = null;
    this._activeGain = null;
  }
}
```

Audio graph for each playback: `BufferSource -> GainNode -> PannerNode -> destination`.
The GainNode provides crossfade control (fade in 200ms, fade out 300ms).

---

## 9. Dialogue Logging

Both sides of every conversation are logged to a shared JSONL file:

```javascript
function _logDialogue(transcription, response) {
  const now = new Date().toISOString();
  appendFileSync(DIALOGUE_LOG,
    JSON.stringify({ ts: now, speaker: 'nicolas', text: transcription, source: 'cities' }) + '\n' +
    JSON.stringify({ ts: now, speaker: 'manemus', text: response, source: 'cities' }) + '\n'
  );
}
```

Path: `~/manemus/shrine/state/dialogue.jsonl`

The `source: 'cities'` tag distinguishes Cities of Light dialogue from
Manemus daemon dialogue (which uses `source: 'daemon'`).

AI citizen dialogue uses `source: 'ai-citizen'` and the citizen's lowercase
name as the speaker field.

---

## 10. AI Citizen Voice Pipeline

### 10.1 Proximity Check

```javascript
// src/server/ai-citizens.js — AICitizenManager
async checkProximityAndRespond(transcription, speakerPos, speakerName) {
  const SPEECH_RANGE = 15;    // meters
  const COOLDOWN_MS = 10000;  // 10s global cooldown

  // Find nearest AI citizen within range (3D Euclidean distance)
  // Only one citizen speaks at a time (global cooldown, not per-citizen)
  // Returns: { citizenId, citizenName, text, position } or null
}
```

### 10.2 AI Citizen LLM Call

```javascript
const result = await this.openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: citizen.systemPrompt },
    ...citizen.history,  // Rolling 10-turn window per citizen
  ],
  max_tokens: 150,       // Short responses for spoken audio
  temperature: 0.9,      // High creativity for personality
});
```

### 10.3 Voice Assignment (Current vs. Target)

Currently: all citizens share the same ElevenLabs voice ID (`pNInz6obpgDQGcFmaJgB`).
The `speakAsAICitizen` function in `voice.js` uses the global voice ID.

Target design (from ALGORITHM_Pipeline.md): per-citizen voice assignment
using a deterministic hash of `citizenId` to select from voice pools.
ElevenLabs for merchant/artisan tiers, OpenAI TTS for common folk.

---

## 11. Venezia Extension Points

### 11.1 Citizen Router (New: `src/server/citizen-router.js`)

The existing pipeline routes all speech through Manemus (Marco) with an
AI citizen check after. For Venezia with 200+ citizens:

```javascript
// citizen-router.js — proposed interface
export class CitizenRouter {
  /**
   * Route visitor speech to the correct citizen.
   * @param {string} transcription - STT result
   * @param {{ x, y, z }} visitorPosition
   * @param {string} visitorName
   * @param {VeniceState} worldState - Airtable-synced citizen data
   * @returns {{ citizenId, response, audioChunks[] }}
   */
  async routeSpeech(transcription, visitorPosition, visitorName, worldState) {
    // 1. Find nearest FULL-tier citizen facing the visitor
    // 2. Load context: Airtable state + .cascade/ memory + FalkorDB beliefs
    // 3. Call Claude API with citizen's CLAUDE.md system prompt
    // 4. Write to citizen's .cascade/memories/ (append-only)
    // 5. Update trust in Airtable RELATIONSHIPS
    // 6. Return response + generate TTS
  }
}
```

### 11.2 Claude API Migration

Currently GPT-4o handles all voice. For Venezia citizen conversations,
the plan is to use Claude with the Anthropic SDK already in `package.json`:

```javascript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const msg = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 300,
  system: citizenSystemPrompt,
  messages: citizenHistory,
});
```

### 11.3 Voice Pool Implementation

```javascript
// Deterministic voice assignment from ALGORITHM_Pipeline.md
function stableHash(citizenId) {
  let h = 0;
  for (let i = 0; i < citizenId.length; i++) {
    h = (h * 31 + citizenId.charCodeAt(i)) % 2147483647;
  }
  return h;
}

function assignVoice(citizen) {
  if (citizen.custom_voice_id) {
    return { provider: 'elevenlabs', voice_id: citizen.custom_voice_id };
  }
  const gender = citizen.gender || 'male';
  const pool = VOICE_POOL_ELEVENLABS[gender];
  const index = stableHash(citizen.id) % pool.length;
  return { provider: 'elevenlabs', voice_id: pool[index] };
}
```

---

## 12. Latency Budget

| Phase | Target | Measured | Notes |
|-------|--------|----------|-------|
| Client recording | 500ms-5s | varies | User-controlled (push-to-talk duration) |
| WebSocket send | <50ms | ~30ms | Base64 encoding + JSON serialize |
| Whisper STT | <800ms | 400-800ms | Depends on audio length |
| GPT-4o | <1500ms | 800-1500ms | With tools, slightly slower |
| ElevenLabs first chunk | <500ms | 200-500ms | `eleven_turbo_v2_5` optimized for latency |
| Stream to client | <50ms per chunk | ~30ms | Base64 + WebSocket |
| Client decode + play | <100ms | ~80ms | `decodeAudioData` + buffer source start |
| **Total (text visible)** | **<2.5s** | **1.5-2.5s** | Subtitle shown at stream_start |
| **Total (audio plays)** | **<4s** | **2.5-4s** | Full pipeline end-to-end |

The text subtitle appears at `voice_stream_start` (after STT + LLM, before TTS).
Audio starts playing after all chunks arrive and are concatenated.
Future optimization: progressive chunk playback (play first chunk while
remaining chunks arrive) would reduce audio latency by ~1s.
