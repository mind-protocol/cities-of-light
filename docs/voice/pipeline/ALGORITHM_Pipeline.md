# ALGORITHM -- Voice Pipeline

> Pseudocode and data flow for every stage of the voice pipeline.
> Reference implementations: `src/server/voice.js`, `src/client/voice.js`,
> `src/server/ai-citizens.js`, `src/client/voice-chat.js`.

---

## 1. Full Pipeline: End-to-End

```
PIPELINE(audio_buffer, citizen_id, ws_send):

    start_time = now()

    // ── Phase 1: STT ──────────────────────────────────────
    temp_file = write_to_disk(audio_buffer, format="webm")
    transcription = whisper_api.transcribe(temp_file, model="whisper-1")

    if transcription is empty or null:
        return null    // silence-is-valid: no response

    stt_ms = now() - start_time

    // ── Phase 2: Target Citizen Selection ─────────────────
    speaker_position = get_citizen_position(citizen_id)
    target = select_nearest_citizen(speaker_position)

    if target is null:
        return null    // no citizen in range, no response

    if target.cooldown_active():
        return null    // another citizen spoke recently

    // ── Phase 3: Context Assembly ─────────────────────────
    system_prompt = target.system_prompt
    history = target.conversation_history  // rolling window, last 10 turns

    history.append({
        role: "user",
        content: "[{speaker_name} is {distance}m away]: {transcription}"
    })
    trim_history(history, max=10)

    // ── Phase 4: LLM ─────────────────────────────────────
    response = gpt4o.chat(
        system=system_prompt,
        messages=history,
        max_tokens=150,
        temperature=0.9
    )

    if response is empty:
        target.action = "wandering"
        return null

    history.append({ role: "assistant", content: response })
    llm_ms = now() - start_time

    // ── Phase 5: Sentence Chunking (future) ───────────────
    // Currently: full response sent to TTS as one block.
    // Future: split response into sentences, send each to TTS
    // separately for progressive playback.
    sentences = [response]   // TODO: split_into_sentences(response)

    // ── Phase 6: Streaming TTS ────────────────────────────
    ws_send({
        type: "voice_stream_start",
        transcription: transcription,
        response: response,
        sttMs: stt_ms,
        llmMs: llm_ms
    })

    voice_id = assign_voice(target)
    chunks_streamed = 0

    for sentence in sentences:
        stream = elevenlabs.tts_stream(
            text=sentence,
            voice_id=voice_id,
            model="eleven_turbo_v2_5",
            output_format="mp3_44100_128"
        )

        for chunk in stream:
            chunks_streamed += 1
            ws_send({
                type: "voice_stream_data",
                chunk: base64(chunk),
                index: chunks_streamed,
                source: "ai-citizen",
                citizenId: target.id
            })

    // Fallback: OpenAI TTS if ElevenLabs failed
    if chunks_streamed == 0:
        audio = openai.tts(
            model="tts-1",
            voice=assign_openai_voice(target),
            input=response,
            format="mp3"
        )
        ws_send({
            type: "voice_stream_data",
            chunk: base64(audio),
            index: 1,
            source: "ai-citizen",
            citizenId: target.id
        })
        chunks_streamed = 1

    ws_send({
        type: "voice_stream_end",
        chunks: chunks_streamed,
        latency: now() - start_time,
        source: "ai-citizen",
        citizenId: target.id
    })

    // ── Phase 7: Logging ──────────────────────────────────
    append_dialogue_log(speaker=speaker_name, text=transcription, source="visitor")
    append_dialogue_log(speaker=target.name, text=response, source="ai-citizen")

    return { transcription, response, latency: now() - start_time }
```

---

## 2. Citizen Selection Algorithm

```
SELECT_NEAREST_CITIZEN(speaker_position):
    SPEECH_RANGE = 15        // meters
    COOLDOWN_MS = 10000      // 10 seconds between AI speeches

    if (now() - last_global_speech_time) < COOLDOWN_MS:
        return null

    nearest = null
    nearest_dist = infinity

    for citizen in ai_citizens:
        if citizen.action == "speaking":
            continue

        dx = citizen.position.x - speaker_position.x
        dy = citizen.position.y - speaker_position.y
        dz = citizen.position.z - speaker_position.z
        dist = sqrt(dx*dx + dy*dy + dz*dz)

        if dist < SPEECH_RANGE and dist < nearest_dist:
            nearest_dist = dist
            nearest = citizen

    if nearest is null:
        return null

    nearest.action = "speaking"
    last_global_speech_time = now()

    return nearest
```

**Key design decisions:**
- Global cooldown, not per-citizen. Only one citizen speaks at a time across the
  entire world. This prevents cacophony.
- Distance is 3D Euclidean (includes Y axis). A citizen floating 5m above counts
  as farther than one at ground level 3m away.
- A citizen currently speaking is excluded. No interruptions.

---

## 3. Voice Assignment Algorithm

```
VOICE_POOL_ELEVENLABS = [
    // Curated from ElevenLabs Voice Library
    // Split by gender for matching
    male: ["voice_id_1", "voice_id_2", ..., "voice_id_8"],
    female: ["voice_id_9", "voice_id_10", ..., "voice_id_15"]
]

VOICE_POOL_OPENAI = [
    male: ["onyx", "echo", "fable"],
    female: ["nova", "alloy", "shimmer"]
]

ASSIGN_VOICE(citizen):
    // Named NPCs have pre-generated custom voices
    if citizen.custom_voice_id exists:
        return { provider: "elevenlabs", voice_id: citizen.custom_voice_id }

    gender = citizen.gender or "male"

    // Merchants and artisans use ElevenLabs library voices
    if citizen.tier in ["merchant", "artisan"]:
        pool = VOICE_POOL_ELEVENLABS[gender]
        index = stable_hash(citizen.id) % len(pool)
        return { provider: "elevenlabs", voice_id: pool[index] }

    // Common folk use OpenAI TTS
    pool = VOICE_POOL_OPENAI[gender]
    index = stable_hash(citizen.id) % len(pool)
    return { provider: "openai", voice: pool[index] }


STABLE_HASH(citizen_id):
    // Deterministic hash so same citizen always gets same voice
    // Simple: sum of char codes modulo a prime
    h = 0
    for char in citizen_id:
        h = (h * 31 + charcode(char)) % 2147483647
    return h
```

**Current state:** All citizens use a single ElevenLabs voice_id
(`pNInz6obpgDQGcFmaJgB`, "Adam"). The above algorithm is the target design.

---

## 4. Client-Side Mic Capture

```
// src/client/voice.js — SpatialVoice class

INIT():
    audio_context = new AudioContext(sampleRate=44100)
    panner = audio_context.createPanner(
        model="HRTF",
        distanceModel="inverse",
        refDistance=1,
        maxDistance=50,
        rolloffFactor=1
    )
    panner.connect(audio_context.destination)

    media_stream = getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000
        }
    })

START_RECORDING():
    if audio_context.state == "suspended":
        audio_context.resume()

    chunks = []
    mime = "audio/webm;codecs=opus"   // preferred: small, high quality

    recorder = new MediaRecorder(media_stream, mimeType=mime)

    recorder.ondataavailable = (event):
        if event.data.size > 0:
            chunks.append(event.data)

    recorder.onstop = async ():
        blob = new Blob(chunks, type=mime)
        if blob.size < 1000:
            return    // too short, discard

        base64 = blob_to_base64(blob)
        on_recording_complete(base64)    // sends via WebSocket

    recorder.start()

STOP_RECORDING():
    recorder.stop()
```

**Push-to-talk triggers:**
- Quest VR: A button on right controller (XRInputSource gamepad button index via VRControls)
- Desktop: Space bar held down
- Both call `startRecording()` on press, `stopRecording()` on release

---

## 5. Client-Side Spatial Playback

```
// Streaming TTS playback (current: collect-then-play)

HANDLE_STREAM_START(msg, citizen_position):
    stream_chunks = []
    stream_position = citizen_position
    show_subtitle(msg.transcription, msg.response)

HANDLE_STREAM_DATA(msg):
    stream_chunks.append(msg.chunk)

HANDLE_STREAM_END(msg):
    if stream_chunks is empty:
        return

    // Concatenate all base64 chunks into single ArrayBuffer
    buffers = [base64_to_arraybuffer(chunk) for chunk in stream_chunks]
    total_length = sum(buf.byteLength for buf in buffers)
    full_buffer = new Uint8Array(total_length)

    offset = 0
    for buf in buffers:
        full_buffer.set(new Uint8Array(buf), offset)
        offset += buf.byteLength

    // Decode MP3 to PCM
    audio_buffer = audio_context.decodeAudioData(full_buffer.buffer)

    // Crossfade: fade out previous playback over 300ms
    if active_source exists:
        active_gain.linearRampToValueAtTime(0, now + 0.3)
        setTimeout(() => active_source.stop(), 350)

    // Play through HRTF panner at citizen's 3D position
    panner.positionX.value = stream_position.x
    panner.positionY.value = stream_position.y
    panner.positionZ.value = stream_position.z

    gain_node = audio_context.createGain()
    gain_node.gain.setValueAtTime(0, now)
    gain_node.gain.linearRampToValueAtTime(1, now + 0.2)   // fade in 200ms
    gain_node.connect(panner)

    source = audio_context.createBufferSource()
    source.buffer = audio_buffer
    source.connect(gain_node)
    source.start()
```

**Crossfade logic:** If a new response arrives while a previous one is still
playing (rare but possible), the old audio fades out over 300ms while the new
audio fades in over 200ms. No hard cuts.

---

## 6. Listener Position Update (Per Frame)

```
// Called every frame in the animation loop

UPDATE_LISTENER(camera):
    listener = audio_context.listener

    pos = camera.getWorldPosition()
    fwd = camera.getWorldDirection()
    up = Vector3(0, 1, 0).applyQuaternion(camera.quaternion)

    // Modern Web Audio API (AudioParam)
    listener.positionX.value = pos.x
    listener.positionY.value = pos.y
    listener.positionZ.value = pos.z
    listener.forwardX.value = fwd.x
    listener.forwardY.value = fwd.y
    listener.forwardZ.value = fwd.z
    listener.upX.value = up.x
    listener.upY.value = up.y
    listener.upZ.value = up.z
```

This runs at render framerate (72Hz on Quest 3). The visitor's head tracking
directly controls where "forward" is for audio. Turning your head moves the
sound field.

---

## 7. WebRTC Peer Voice (Human-to-Human)

```
// src/client/voice-chat.js — VoiceChat class
// Peer-to-peer spatial voice between human visitors

CREATE_PEER(remote_citizen_id):
    pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
        ]
    })

    // Add our mic tracks
    for track in local_stream.getAudioTracks():
        pc.addTrack(track, local_stream)

    // When remote audio arrives: wire into spatial panner
    pc.ontrack = (event):
        remote_stream = event.streams[0]
        source = audio_context.createMediaStreamSource(remote_stream)

        panner = audio_context.createPanner()
        panner.panningModel = "HRTF"
        panner.distanceModel = "inverse"
        panner.refDistance = 1
        panner.maxDistance = 50
        panner.rolloffFactor = 1.5

        source.connect(panner)
        panner.connect(audio_context.destination)

    // ICE candidates relayed via WebSocket (no TURN server)
    pc.onicecandidate = (event):
        ws_send_signaling({
            sigType: "ice_candidate",
            targetCitizenId: remote_citizen_id,
            candidate: event.candidate
        })

    return pc

// Per-frame: update each peer's panner to their avatar position
UPDATE_PEER_POSITIONS(listener_pos, listener_fwd, citizen_positions):
    for (citizen_id, peer) in peers:
        pos = citizen_positions.get(citizen_id)
        if pos and peer.panner:
            peer.panner.positionX.value = pos.x
            peer.panner.positionY.value = pos.y
            peer.panner.positionZ.value = pos.z
```

**Signaling flow:**
1. Visitor A joins room. Server sends `voice_peers` list.
2. Visitor A creates WebRTC offer for each peer, sends via WebSocket.
3. Server relays offer to Visitor B.
4. Visitor B creates answer, sends via WebSocket.
5. Server relays answer to Visitor A.
6. ICE candidates exchanged via same WebSocket relay.
7. Direct peer-to-peer audio established. Server is no longer in the audio path.

---

## 8. Concurrent Conversation Management

```
// Server-side: src/server/index.js voice handler

ON_VOICE_MESSAGE(citizen_id, audio_buffer):
    // Step 1: Broadcast raw voice to room (other visitors hear you speak)
    room_broadcast(citizen_id, {
        type: "citizen_voice",
        citizenId: citizen_id,
        name: citizen_name,
        audio: base64(audio_buffer)
    }, exclude=sender_ws)

    // Step 2: Process through STT → LLM → TTS pipeline
    result = processVoiceStreaming(audio_buffer, room_broadcast_fn)

    // Step 3: Check if any AI citizen should respond
    if result and result.transcription:
        ai_result = ai_manager.checkProximityAndRespond(
            result.transcription,
            speaker_position,
            speaker_name
        )

        if ai_result:
            speakAsAICitizen(
                ai_result.citizenId,
                ai_result.citizenName,
                ai_result.text,
                ai_result.position,
                room_broadcast_fn
            )
```

**Concurrency rules:**
- Raw visitor voice broadcasts to room immediately (no processing delay)
- STT + LLM + TTS runs asynchronously -- does not block the WebSocket
- AI citizen response is triggered after the main pipeline completes
- Only one AI citizen responds per utterance (nearest wins)
- Global 10-second cooldown prevents rapid-fire AI responses
- Multiple visitors can speak simultaneously -- each triggers independent pipeline runs
- Manemus (Marco) responds first (via `processVoiceStreaming`), then AI citizen check runs

---

## 9. Server-Side System Prompt Assembly

```
BUILD_SYSTEM_PROMPT():
    prompt = BASE_PROMPT   // Manemus identity, rules, persona

    // Inject recent journal entries (last 10 meaningful events)
    journal = read_journal_file()
    recent = filter_noise(journal.last(30)).last(10)
    prompt += "\n[Recent activity:]\n"
    for entry in recent:
        prompt += "{time} [{event}] {content}\n"

    // Inject Nicolas's biometrics (if available)
    bio = read_biometrics()
    if bio:
        prompt += "\n[Nicolas's body: HR {hr}, stress {stress}, energy {battery}]"

    // Inject recent dialogue (last 4 turns)
    dialogue = read_dialogue_log().last(4)
    prompt += "\n[Recent dialogue:]\n"
    for turn in dialogue:
        prompt += "{speaker}: {text}\n"

    // Inject pending/completed session status
    for session in pending_sessions:
        prompt += "PENDING ({age}s ago): {task}\n"
    for session in completed_sessions.last(10min):
        prompt += "DONE: {task}\nResult: {result}\n"

    // Inject perception context (camera position in 3D world)
    perception = read_perception_latest()
    if perception:
        prompt += "\n[Camera at ({x}, {y}, {z}). Frame #{n}]"

    return prompt
```

This is specific to the Manemus/Marco pipeline. AI citizens (VOX, LYRA, PITCH)
use simpler static system prompts with only their conversation history.

---

## 10. Biography Voice Pipeline

```
PROCESS_BIOGRAPHY_VOICE(audio_buffer, donor_id, interactant_id, ws_send):
    // Phase 1: STT (same as main pipeline)
    transcription = whisper_api.transcribe(audio_buffer)
    if not transcription: return

    // Phase 2: Biography query via FastAPI consent engine
    response = http_get(
        "{SERVICES_URL}/donors/{donor_id}/biography"
        "?q={transcription}&interactant_id={interactant_id}"
    )

    if not response.allowed:
        text = response.refusal_reason or "Access not authorized"
    elif response.answer:
        text = response.answer
    else:
        text = "I don't have a recording about that."

    // Phase 3: Stream TTS (same as main pipeline)
    ws_send({ type: "biography_stream_start", ... })
    stream_tts(text, ws_send, message_type="biography_stream_data")
    ws_send({ type: "biography_stream_end", ... })
```

The biography pipeline differs from the main pipeline in two ways:
1. LLM is replaced by a biography archive query with consent checking
2. Message types are prefixed with `biography_` to distinguish on the client
3. Audio plays from the memorial's position, not a citizen's position
