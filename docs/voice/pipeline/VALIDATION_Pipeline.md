# VALIDATION -- Voice Pipeline

> Health checks, invariants, and acceptance criteria for the end-to-end speech flow.
> The pipeline is the interface. If validation fails, the world is mute.

---

## Invariants (must ALWAYS hold)

### I1. End-to-end latency under 3 seconds

From the moment the visitor releases the push-to-talk button to the first
audible syllable of the citizen's response: less than 3 seconds. This is
the perceptual threshold beyond which the world stops feeling alive and
starts feeling like a program.

Breakdown:
- STT (Whisper API): < 800ms
- LLM (GPT-4o): < 1000ms
- TTS first byte (ElevenLabs streaming): < 500ms
- Overhead (WebSocket transit, audio decode): < 700ms

Measurement: `voice_stream_end.latency` field logged per interaction.
Any response exceeding 3000ms is a latency violation. More than 5% of
responses exceeding 3000ms in a session is a pipeline degradation.

### I2. STT always produces text or silence -- never an error to the visitor

The Whisper API may fail. The audio may be garbage. The microphone may
capture only noise. In all cases, the visitor experiences silence. Never
an error message. Never "I didn't understand you." Never a retry prompt.

Valid STT outcomes:
- Transcription text (pipeline continues to LLM)
- Empty/null transcription (pipeline terminates silently)
- API error (pipeline terminates silently, error logged server-side)

Invalid STT outcomes:
- Error text delivered to the visitor via TTS
- Error text displayed on screen
- Pipeline hang (no response AND no silent termination within 5 seconds)

### I3. TTS fallback chain always produces output

If ElevenLabs fails, OpenAI TTS fires. If OpenAI TTS fails, browser
speechSynthesis fires. If all TTS providers fail, response text appears
as floating 3D text near the citizen for 5 seconds. The visitor always
receives the citizen's response in some form.

Fallback chain:
```
ElevenLabs streaming  -->  OpenAI tts-1  -->  browser speechSynthesis  -->  floating 3D text
```

No fallback level may be skipped. Each level fires only if the previous
returned zero chunks or threw an error. No retry delays between levels.

### I4. One citizen responds per utterance

The nearest citizen within SPEECH_RANGE (15m) responds. If two citizens
are equidistant, the first evaluated wins. Multiple citizens never respond
to the same visitor utterance. The global cooldown (COOLDOWN_MS = 10000)
prevents rapid-fire stacking.

### I5. Language match

The citizen responds in the language the visitor speaks. Whisper auto-detects
the input language. The LLM system prompt instructs language matching. No
language configuration exists. No settings menu. If the visitor speaks French,
the response is French. If the visitor speaks English, the response is English.

---

## Health Checks

### HC1. STT Accuracy

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Transcription success rate    | > 95%       | Non-empty transcriptions / total STT calls |
| STT latency (p50)            | < 500ms     | Whisper API round-trip time          |
| STT latency (p95)            | < 800ms     | Whisper API round-trip time          |
| False silence rate            | < 3%        | Empty transcription when audio contains speech |
| Garbage transcription rate    | < 2%        | Non-language output (random symbols, repeated tokens) |

Detection of garbage transcription: if transcription contains > 50% non-word
characters or consists of a single repeated token, classify as garbage and
discard silently.

### HC2. LLM Response Time

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| LLM latency (p50)            | < 700ms     | GPT-4o chat completion time          |
| LLM latency (p95)            | < 1200ms    | GPT-4o chat completion time          |
| Empty response rate           | < 5%        | LLM returns empty or null            |
| Response length               | 10-150 tokens | max_tokens=150, short enough for voice |
| Context injection success     | 100%        | System prompt includes citizen state  |

### HC3. TTS Generation Time

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| TTS first byte (ElevenLabs)  | < 400ms     | Time from API call to first chunk    |
| TTS first byte (OpenAI)      | < 1500ms    | Fallback latency is acceptable       |
| TTS total generation          | < 3000ms    | Full audio delivered                 |
| Fallback trigger rate         | < 2%        | ElevenLabs failures per session      |
| Voice consistency             | 100%        | Same citizen always gets same voice_id |

### HC4. Pipeline Success Rate

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Full pipeline completion      | > 90%       | Visitor speaks, citizen audibly responds |
| Silent-by-design rate         | 5-15%       | Legitimate silence (no citizen in range, empty audio, cooldown) |
| Silent-by-error rate          | < 2%        | Pipeline failure producing unintended silence |
| End-to-end latency (p50)     | < 2000ms    | Total wall clock                     |
| End-to-end latency (p95)     | < 3000ms    | Total wall clock                     |
| End-to-end latency (p99)     | < 4000ms    | Occasional spikes tolerable          |

### HC5. Concurrent Pipeline Isolation

| Metric                        | Target      | Measurement                          |
|-------------------------------|-------------|--------------------------------------|
| Cross-visitor interference    | 0%          | Visitor A's speech never triggers response to Visitor B |
| Concurrent pipeline limit     | 3 max       | 1 visitor + 2 ambient citizen conversations |
| Queue depth                   | < 2         | Pending voice requests waiting for pipeline slot |

---

## Acceptance Criteria

### AC1. Five-Minute Voice Conversation (Manual Test)

1. Enter the world. Approach a citizen within 10 meters.
2. Press push-to-talk. Speak a greeting in English.
3. Release button. Citizen responds audibly within 3 seconds.
4. Citizen's response is contextually relevant to their economic state.
5. Repeat 10 times. At least 9 of 10 produce audible, relevant responses.
6. Switch to French. Citizen responds in French.
7. Walk away from all citizens (> 15m). Speak. No response (silence-is-valid).

Pass criteria: 9/10 responses within 3 seconds, language match, no errors audible.

### AC2. Fallback Chain Verification (Automated Test)

1. Disable ElevenLabs API key. Trigger voice pipeline.
2. Verify OpenAI TTS produces audible output. Log latency.
3. Disable OpenAI TTS key. Trigger voice pipeline.
4. Verify browser speechSynthesis produces output (or floating text appears).
5. Re-enable all keys. Verify ElevenLabs resumes as primary.

Pass criteria: each fallback level activates without delay or error.

### AC3. Sustained Session (30-Minute Stress Test)

1. Interact with citizens continuously for 30 minutes.
2. Log every pipeline invocation with timestamps and latency breakdown.
3. At least 50 voice interactions in the session.
4. Compute: mean latency, p95 latency, error rate, fallback trigger count.

Pass criteria:
- Mean latency < 2000ms
- p95 latency < 3000ms
- Error rate < 5%
- No pipeline hang (> 10 seconds with no response and no silent termination)

### AC4. Silence Validation (Edge Cases)

1. Press and immediately release push-to-talk (< 500ms). No response, no error.
2. Speak with no citizen in range. No response, no error.
3. Speak while another citizen is in cooldown. No response, no error.
4. Speak gibberish / non-language sounds. No response, no error.
5. Press push-to-talk in total silence. No response, no error.

Pass criteria: all five cases produce clean silence. Server logs show correct
short-circuit reason (audio_too_short, no_citizen_in_range, cooldown_active,
empty_transcription).

---

## Anti-Patterns

### AP1. Garbled STT

**Symptom:** Citizen responds to nonsensical transcription. Visitor says
"How is business?" and citizen responds as if they heard "house business
three."

**Detection:** Log both raw transcription and visitor-reported intent.
Flag conversations where the citizen's response is semantically unrelated
to the visitor's apparent question (manual review or cosine similarity
between transcription and response < 0.3).

**Root cause:** Audio codec mismatch, low microphone gain, excessive
background noise, Whisper model confusion on short utterances.

**Fix:** Validate audio format is webm/opus before STT call. Discard
recordings under 1000 bytes. Consider client-side noise gate before
capture. Log Whisper confidence scores if available.

### AP2. Generic Responses

**Symptom:** Citizen responses are contextually flat. "I am doing well"
regardless of whether they are bankrupt, starving, or celebrating.

**Detection:** Cross-reference citizen response text against their
Airtable state. If a citizen with < 10 Ducats says "Business is good,"
context injection is broken.

**Root cause:** System prompt not injecting citizen economic state.
Conversation history overflow pushing context out of the token window.
max_tokens too low for meaningful responses.

**Fix:** Verify `BUILD_SYSTEM_PROMPT()` includes Ducats balance, active
tensions, mood score. Trim conversation history to 10 turns. Log full
system prompt on every 10th call for audit.

### AP3. TTS Voice Mismatch

**Symptom:** A female citizen speaks with a male voice. Or a noble speaks
with the same voice as a fishmonger.

**Detection:** Periodic audit of voice assignments. Verify
`ASSIGN_VOICE(citizen)` returns gender-appropriate, tier-appropriate voice.

**Root cause:** Voice pool configuration error. Hash collision assigning
same voice to adjacent citizens. Gender field missing from citizen metadata.

**Fix:** Voice assignment is deterministic (hash of citizen_id). Validate
pool split by gender. Ensure no two citizens within 20m share the same
voice_id (re-hash with salt if collision detected).

### AP4. Silence Loops

**Symptom:** Visitor speaks repeatedly and receives only silence, even
when standing next to a citizen. The pipeline appears dead.

**Detection:** If a visitor sends > 3 consecutive voice messages without
receiving any `voice_stream_start` response, flag as silence loop.

**Root cause:** STT API key expired or rate-limited. Global cooldown
stuck (timestamp not resetting). Citizen action stuck in "speaking" state
after a failed TTS. WebSocket connection degraded (messages sent but not
received).

**Fix:** Add server-side pipeline health heartbeat: every 60 seconds,
run a synthetic STT call with a known audio sample. If it fails, log
alert. Reset citizen action state to "wandering" after 30 seconds
regardless of TTS outcome.

### AP5. Latency Creep

**Symptom:** Pipeline starts fast (< 2s) but degrades over session length.
By minute 20, responses take 4-5 seconds.

**Detection:** Plot end-to-end latency over time. If the linear regression
slope exceeds 50ms per minute, latency is creeping.

**Root cause:** Conversation history growing unbounded. Memory leak in
audio processing. API rate limiting kicking in after sustained usage.

**Fix:** Enforce 10-turn conversation history trim. Monitor JS heap
during voice processing. Log per-phase latency (STT, LLM, TTS) to
isolate which phase is degrading.

---

## Data Integrity

### Audio Format Validation

```
ON EVERY VOICE MESSAGE RECEIVED:
  - Verify MIME type is audio/webm or audio/webm;codecs=opus
  - Verify payload size > 1000 bytes (not accidental press)
  - Verify payload size < 5MB (not corrupted or attack)
  - Verify base64 decoding succeeds before writing temp file
  - If any check fails: discard silently, log reason, do not call STT

ON EVERY TTS CHUNK SENT:
  - Verify chunk is valid base64-encoded MP3
  - Verify chunk size > 0 bytes
  - Verify chunk index is sequential (no gaps)
  - If stream_end sent with 0 chunks: fallback chain was triggered or pipeline failed
```

### Language Detection Accuracy

```
ON EVERY STT RESULT:
  - Log detected language (from Whisper response metadata if available)
  - Verify LLM response language matches input language
  - Flag mismatches: visitor speaks French, response is English (or vice versa)
  - Tolerable mismatch rate: < 3% of interactions

PERIODIC AUDIT (weekly):
  - Sample 20 logged interactions
  - Verify transcription accurately represents the spoken words
  - Verify citizen response is grounded in their actual state
  - Verify voice_id matches citizen gender and tier
```

### Pipeline Logging Completeness

```
EVERY PIPELINE INVOCATION MUST LOG:
  - Timestamp (ms precision)
  - Visitor citizen_id
  - Target citizen_id (or null if no citizen in range)
  - Transcription text (or "EMPTY" / "DISCARDED")
  - LLM response text (or "SKIPPED")
  - TTS provider used (elevenlabs / openai / speechSynthesis / text_fallback)
  - Per-phase latency: stt_ms, llm_ms, tts_first_byte_ms, total_ms
  - Outcome: success / silence_valid / silence_error / fallback_triggered
  - Error details (if any)

MISSING FIELDS IN A LOG ENTRY = LOGGING BUG. Fix immediately.
```

### Conversation History Integrity

```
PER CITIZEN:
  - conversation_history length <= 10 turns (20 messages: 10 user + 10 assistant)
  - No orphaned user messages without assistant response
  - No assistant messages without preceding user message
  - History must not contain messages from different visitors without clear delineation
  - History trim must remove oldest turns, never middle or newest

ON SERVER RESTART:
  - Conversation histories are cleared (in-memory only)
  - This is acceptable: citizens do not "remember" across server restarts in V1
  - Future: persist history to FalkorDB for cross-session memory
```
