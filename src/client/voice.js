/**
 * Spatial Voice — mic capture + HRTF spatial playback.
 *
 * Captures Nicolas's voice from Quest mic, sends to server.
 * Plays Manemus's response positioned at its 3D location.
 * Uses HRTF panning — Manemus sounds like it's really there.
 */

import * as THREE from 'three';

export class SpatialVoice {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.recorder = null;
    this.pannerNode = null;
    this.isRecording = false;
    this.isPlaying = false;

    // Callbacks
    this.onRecordingComplete = null; // (base64Audio) => void
    this.onSpeechStart = null;
    this.onSpeechEnd = null;

    // Streaming TTS state
    this._streamChunks = [];
    this._streamPosition = null; // THREE.Vector3 — where to play from

    // Active audio (for crossfade when new playback starts)
    this._activeSource = null;
    this._activeGain = null;

    // UI elements
    this._statusEl = document.getElementById('voice-status');
    this._transcriptionEl = document.getElementById('transcription');
    this._transcriptionTimer = null;
    this._fadeTimer = null;

    // Smooth CSS transition for subtitle fade
    if (this._transcriptionEl) {
      this._transcriptionEl.style.transition = 'opacity 2s ease-out';
    }
  }

  /** Ensure AudioContext + panner exist (playback only, no mic). */
  _ensurePlayback() {
    if (this.audioContext) return true;
    try {
      this.audioContext = new AudioContext({ sampleRate: 44100 });
      this.pannerNode = this.audioContext.createPanner();
      this.pannerNode.panningModel = 'HRTF';
      this.pannerNode.distanceModel = 'inverse';
      this.pannerNode.refDistance = 1;
      this.pannerNode.maxDistance = 50;
      this.pannerNode.rolloffFactor = 1;
      this.pannerNode.coneInnerAngle = 360;
      this.pannerNode.coneOuterAngle = 360;
      this.pannerNode.connect(this.audioContext.destination);
      console.log('🔊 Playback audio initialized');
      return true;
    } catch (e) {
      console.warn('AudioContext creation failed:', e.message);
      return false;
    }
  }

  /** Request mic access and set up spatial audio. Call once on user gesture. */
  async init() {
    // Ensure playback context exists first
    this._ensurePlayback();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
    } catch (e) {
      console.warn('Mic access denied:', e.message);
      return false;
    }

    console.log('🎤 Spatial voice initialized (mic + playback)');
    return true;
  }

  /** Start recording from mic. Call on push-to-talk press. */
  startRecording() {
    if (this.isRecording || !this.mediaStream) return;

    // Resume AudioContext if suspended (browser policy)
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    const chunks = [];
    // Prefer opus in webm container — small, high quality
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.recorder = new MediaRecorder(this.mediaStream, { mimeType });

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    this.recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size < 1000) return; // Skip tiny clips (accidental presses)

      const base64 = await this._blobToBase64(blob);
      if (this.onRecordingComplete) {
        this.onRecordingComplete(base64);
      }
    };

    this.recorder.start();
    this.isRecording = true;
    this._showStatus('recording');
    if (this.onSpeechStart) this.onSpeechStart();
    console.log('🎤 Recording...');
  }

  /** Stop recording. Call on push-to-talk release. */
  stopRecording() {
    if (!this.isRecording || !this.recorder) return;

    this.recorder.stop();
    this.isRecording = false;
    this._showStatus('processing');
    if (this.onSpeechEnd) this.onSpeechEnd();
    console.log('🎤 Recording stopped');
  }

  /**
   * Play audio spatially at a 3D position (Manemus's location).
   * @param {string} base64Audio — base64 encoded audio (mp3/ogg/wav)
   * @param {THREE.Vector3} position — world position to play from
   */
  async playAtPosition(base64Audio, position) {
    if (!this.audioContext || !base64Audio) return;

    // Resume if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Position the panner at Manemus
    this.pannerNode.positionX.value = position.x;
    this.pannerNode.positionY.value = position.y;
    this.pannerNode.positionZ.value = position.z;

    // Decode audio
    const arrayBuffer = this._base64ToArrayBuffer(base64Audio);
    let audioBuffer;
    try {
      audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.error('Audio decode error:', e.message);
      return;
    }

    // Play through spatial panner
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.pannerNode);

    this.isPlaying = true;
    this._showStatus('speaking');
    source.onended = () => {
      this.isPlaying = false;
      this._showStatus('idle');
    };
    source.start();
  }

  /**
   * Play raw citizen voice (webm/opus) at a 3D position.
   * Used for broadcasting Nicolas's mic audio to stream clients.
   * Uses Audio element for webm/opus compatibility, with Web Audio API spatial fallback.
   */
  async playRawAtPosition(base64Audio, position) {
    // Ensure AudioContext exists (stream viewers may not have called init())
    this._ensurePlayback();

    // Primary: Audio element (handles webm/opus natively in all browsers)
    try {
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/webm;codecs=opus' });
      const url = URL.createObjectURL(blob);

      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Try spatial playback via Web Audio API MediaElementSource
      if (this.audioContext) {
        const audio = new Audio(url);
        audio.crossOrigin = 'anonymous';
        const source = this.audioContext.createMediaElementSource(audio);

        const panner = this.audioContext.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 50;
        panner.rolloffFactor = 1;
        panner.positionX.value = position.x;
        panner.positionY.value = position.y;
        panner.positionZ.value = position.z;
        panner.connect(this.audioContext.destination);

        source.connect(panner);
        audio.onended = () => { panner.disconnect(); URL.revokeObjectURL(url); };
        audio.onerror = () => URL.revokeObjectURL(url);
        await audio.play();
        return;
      }

      // Fallback: plain Audio element (no spatial, but at least audible)
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      console.warn('Citizen voice playback failed:', e.message);
    }
  }

  // ─── Streaming TTS playback ─────────────────────────────
  // Server streams MP3 chunks as they arrive from ElevenLabs.
  // We collect them and play the full audio when stream ends.
  // Text arrives immediately in stream_start for instant UI feedback.

  /** Called when server starts streaming (text available immediately). */
  handleStreamStart(msg, manemusPosition) {
    this._streamChunks = [];
    this._streamPosition = manemusPosition;
    this._showStatus('speaking');

    // Show transcription immediately — no waiting for audio
    if (msg.transcription || msg.response) {
      this.showTranscription(msg.transcription || '', msg.response || '');
    }
    console.log(`🗣️ You: "${msg.transcription}"`);
    console.log(`🤖 Manemus: "${msg.response}"`);
    if (msg.sttMs) console.log(`  STT: ${msg.sttMs}ms | LLM: ${msg.llmMs}ms`);
  }

  /** Called for each audio chunk from the TTS stream. */
  handleStreamData(msg) {
    if (msg.chunk) {
      this._streamChunks.push(msg.chunk);
    }
  }

  /** Called when stream ends — concatenate chunks and play spatially. */
  async handleStreamEnd(msg) {
    if (this._streamChunks.length === 0) {
      this._showStatus('idle');
      return;
    }

    // Concatenate all base64 chunks into one MP3 buffer
    const combined = this._streamChunks.map(c => this._base64ToArrayBuffer(c));
    const totalLength = combined.reduce((sum, buf) => sum + buf.byteLength, 0);
    const fullBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of combined) {
      fullBuffer.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    this._streamChunks = [];

    // Play the full audio spatially
    if (this._streamPosition) {
      await this._playBuffer(fullBuffer.buffer, this._streamPosition);
    }

    if (msg.latency) console.log(`⏱️ ${msg.latency}ms total | ${msg.chunks} chunks`);
  }

  /** Fade out any currently playing audio over 300ms. */
  _crossfadeOut() {
    if (this._activeSource && this._activeGain) {
      const now = this.audioContext.currentTime;
      this._activeGain.gain.setValueAtTime(this._activeGain.gain.value, now);
      this._activeGain.gain.linearRampToValueAtTime(0, now + 0.3);
      // Stop after fade completes
      const oldSource = this._activeSource;
      setTimeout(() => { try { oldSource.stop(); } catch(e) {} }, 350);
      this._activeSource = null;
      this._activeGain = null;
    }
  }

  /** Internal: decode and play an ArrayBuffer through spatial panner. */
  async _playBuffer(arrayBuffer, position) {
    if (!this._ensurePlayback()) return;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Fade out previous playback if still active
    this._crossfadeOut();

    this.pannerNode.positionX.value = position.x;
    this.pannerNode.positionY.value = position.y;
    this.pannerNode.positionZ.value = position.z;

    let audioBuffer;
    try {
      audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.error('Stream audio decode error:', e.message);
      this._showStatus('idle');
      return;
    }

    // Route: source → gain (for crossfade control) → panner → destination
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(this.pannerNode);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);

    // Fade in over 200ms
    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + 0.2);

    // Track active source for future crossfade
    this._activeSource = source;
    this._activeGain = gainNode;

    this.isPlaying = true;
    source.onended = () => {
      if (this._activeSource === source) {
        this._activeSource = null;
        this._activeGain = null;
      }
      this.isPlaying = false;
      this._showStatus('idle');
    };
    source.start();
  }

  /**
   * Update the AudioContext listener to match the camera/headset.
   * Call every frame for accurate spatialization.
   */
  updateListener(camera) {
    if (!this.audioContext) return;

    const listener = this.audioContext.listener;
    const pos = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    camera.getWorldPosition(pos);
    camera.getWorldDirection(fwd);
    up.applyQuaternion(camera.quaternion);

    // Position
    if (listener.positionX) {
      listener.positionX.value = pos.x;
      listener.positionY.value = pos.y;
      listener.positionZ.value = pos.z;
    } else {
      listener.setPosition(pos.x, pos.y, pos.z);
    }

    // Orientation
    if (listener.forwardX) {
      listener.forwardX.value = fwd.x;
      listener.forwardY.value = fwd.y;
      listener.forwardZ.value = fwd.z;
      listener.upX.value = up.x;
      listener.upY.value = up.y;
      listener.upZ.value = up.z;
    } else {
      listener.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }


  // ─── UI ────────────────────────────────────────────────

  _showStatus(state) {
    if (!this._statusEl) return;
    switch (state) {
      case 'recording':
        this._statusEl.textContent = '🔴 Listening...';
        this._statusEl.style.display = 'block';
        this._statusEl.style.color = '#ff4444';
        break;
      case 'processing':
        this._statusEl.textContent = '⏳ Thinking...';
        this._statusEl.style.display = 'block';
        this._statusEl.style.color = '#ffaa00';
        break;
      case 'speaking':
        this._statusEl.textContent = '🔊 Manemus';
        this._statusEl.style.display = 'block';
        this._statusEl.style.color = '#ff8800';
        break;
      default:
        this._statusEl.style.display = 'none';
    }
  }

  showTranscription(userText, manemusText) {
    if (!this._transcriptionEl) return;
    this._transcriptionEl.innerHTML =
      (userText ? `<div style="margin-bottom:8px;opacity:0.7;font-size:0.85em;">
        <span style="color:#00ff88;font-weight:bold;">NLR_ai</span>
        <span style="color:rgba(255,255,255,0.6);margin-left:8px;">${userText}</span>
      </div>` : '') +
      `<div>
        <span style="color:#ff8800;font-weight:bold;">Manemus</span>
        <span style="color:rgba(255,255,255,0.95);margin-left:8px;">${manemusText}</span>
      </div>`;
    this._transcriptionEl.style.display = 'block';
    this._transcriptionEl.style.opacity = '1';
    clearTimeout(this._transcriptionTimer);
    clearTimeout(this._fadeTimer);
    // Show for 20s, then fade out over 2s
    this._transcriptionTimer = setTimeout(() => {
      this._transcriptionEl.style.opacity = '0';
      this._fadeTimer = setTimeout(() => {
        this._transcriptionEl.style.display = 'none';
      }, 2000);
    }, 20000);
  }

  // ─── Utils ──────────────────────────────────────────────

  _blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }
    return buffer;
  }
}
