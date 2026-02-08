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

    // UI elements
    this._statusEl = document.getElementById('voice-status');
    this._transcriptionEl = document.getElementById('transcription');
    this._transcriptionTimer = null;
  }

  /** Request mic access and set up spatial audio. Call once on user gesture. */
  async init() {
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

    this.audioContext = new AudioContext({ sampleRate: 44100 });

    // HRTF spatial panner for Manemus voice
    this.pannerNode = this.audioContext.createPanner();
    this.pannerNode.panningModel = 'HRTF';
    this.pannerNode.distanceModel = 'inverse';
    this.pannerNode.refDistance = 1;
    this.pannerNode.maxDistance = 50;
    this.pannerNode.rolloffFactor = 1;
    this.pannerNode.coneInnerAngle = 360;
    this.pannerNode.coneOuterAngle = 360;
    this.pannerNode.connect(this.audioContext.destination);

    console.log('🎤 Spatial voice initialized');
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
      `<span style="color:#00ff88">You:</span> ${userText}<br>` +
      `<span style="color:#ff8800">Manemus:</span> ${manemusText}`;
    this._transcriptionEl.style.display = 'block';
    clearTimeout(this._transcriptionTimer);
    this._transcriptionTimer = setTimeout(() => {
      this._transcriptionEl.style.display = 'none';
    }, 8000);
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
