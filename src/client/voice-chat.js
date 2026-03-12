/**
 * VoiceChat — WebRTC peer-to-peer spatial voice.
 *
 * Web equivalent of Photon Voice:
 * - Peer-to-peer audio via WebRTC (no server relay for audio data)
 * - HRTF spatialization via Web Audio API PannerNode per peer
 * - Signaling via existing WebSocket connection
 * - Positions updated per frame from citizen transforms
 *
 * CPU cost:  ~0.5ms per peer (WebRTC decode + spatial processing)
 * GPU cost:  0
 * Memory:    ~2MB per peer (audio buffers)
 */

// Pre-allocated temporaries (zero per-frame allocs)
const _fwd = { x: 0, y: 0, z: 0 };
const _up = { x: 0, y: 1, z: 0 };

export class VoiceChat {
  constructor(network) {
    this.network = network;
    this.localStream = null;
    this.peers = new Map();  // citizenId → { pc, panner, source, stream }
    this.audioCtx = null;
    this.muted = false;
    this.enabled = false;
    this._initPromise = null;
  }

  /**
   * Initialize microphone + audio context.
   * Must be called from a user gesture (click/touch).
   */
  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  }

  async _doInit() {
    try {
      // Resume or create audio context
      this.audioCtx = new AudioContext({ sampleRate: 48000 });
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Get microphone — optimized for voice on Quest
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
      });

      this.enabled = true;
      console.log('VoiceChat: mic acquired, ready for peers');
      return true;
    } catch (e) {
      console.warn('VoiceChat init failed:', e.message);
      this.enabled = false;
      return false;
    }
  }

  /**
   * Create a WebRTC peer connection for a remote citizen.
   * Called when a new citizen joins the room.
   */
  _createPeer(citizenId) {
    if (this.peers.has(citizenId)) return this.peers.get(citizenId);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    const peer = { pc, panner: null, source: null, stream: null };
    this.peers.set(citizenId, peer);

    // Add local audio tracks
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    // On remote audio stream: wire into spatial audio
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream || !this.audioCtx) return;

      peer.stream = remoteStream;
      peer.source = this.audioCtx.createMediaStreamSource(remoteStream);

      // HRTF panner for 3D spatial positioning
      peer.panner = this.audioCtx.createPanner();
      peer.panner.panningModel = 'HRTF';
      peer.panner.distanceModel = 'inverse';
      peer.panner.refDistance = 1;
      peer.panner.maxDistance = 50;
      peer.panner.rolloffFactor = 1.5;
      peer.panner.coneInnerAngle = 360;
      peer.panner.coneOuterAngle = 360;

      peer.source.connect(peer.panner);
      peer.panner.connect(this.audioCtx.destination);

      console.log(`VoiceChat: spatial audio connected for ${citizenId}`);
    };

    // ICE candidate → relay via WebSocket signaling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.network.sendSignaling({
          sigType: 'ice_candidate',
          targetCitizenId: citizenId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn(`VoiceChat: peer ${citizenId} ${pc.connectionState}`);
      }
      if (pc.connectionState === 'connected') {
        console.log(`VoiceChat: peer ${citizenId} connected`);
      }
    };

    return peer;
  }

  /**
   * Initiate WebRTC connection to a new peer (we are the offerer).
   * Called for each existing citizen when we join a room.
   */
  async createOffer(citizenId) {
    if (!this.enabled) return;
    const peer = this._createPeer(citizenId);
    try {
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      this.network.sendSignaling({
        sigType: 'webrtc_offer',
        targetCitizenId: citizenId,
        sdp: peer.pc.localDescription,
      });
    } catch (e) {
      console.error(`VoiceChat: offer failed for ${citizenId}:`, e.message);
    }
  }

  /**
   * Handle incoming WebRTC offer (we are the answerer).
   */
  async handleOffer(citizenId, sdp) {
    if (!this.enabled) return;
    const peer = this._createPeer(citizenId);
    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      this.network.sendSignaling({
        sigType: 'webrtc_answer',
        targetCitizenId: citizenId,
        sdp: peer.pc.localDescription,
      });
    } catch (e) {
      console.error(`VoiceChat: answer failed for ${citizenId}:`, e.message);
    }
  }

  /**
   * Handle incoming WebRTC answer.
   */
  async handleAnswer(citizenId, sdp) {
    const peer = this.peers.get(citizenId);
    if (!peer) return;
    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (e) {
      console.error(`VoiceChat: setRemoteDescription failed for ${citizenId}:`, e.message);
    }
  }

  /**
   * Handle incoming ICE candidate.
   */
  async handleIceCandidate(citizenId, candidate) {
    const peer = this.peers.get(citizenId);
    if (!peer) return;
    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      // Benign — candidate may arrive before remote description
    }
  }

  /**
   * Remove a peer (citizen left).
   */
  removePeer(citizenId) {
    const peer = this.peers.get(citizenId);
    if (!peer) return;
    try {
      if (peer.source) peer.source.disconnect();
      if (peer.panner) peer.panner.disconnect();
      peer.pc.close();
    } catch (e) { /* cleanup, ignore */ }
    this.peers.delete(citizenId);
    console.log(`VoiceChat: peer ${citizenId} removed`);
  }

  /**
   * Per-frame update: move each peer's spatial audio to their avatar position.
   * Also update the listener (our) position + orientation.
   *
   * @param {Object} listenerPos - {x,y,z} our world position
   * @param {Object} listenerFwd - {x,y,z} our forward direction
   * @param {Map} citizenPositions - citizenId → {x,y,z} world positions
   */
  updatePositions(listenerPos, listenerFwd, citizenPositions) {
    if (!this.audioCtx || !this.enabled) return;

    const listener = this.audioCtx.listener;

    // Update our listener position
    if (listener.positionX) {
      // Modern API (AudioParam)
      listener.positionX.value = listenerPos.x;
      listener.positionY.value = listenerPos.y;
      listener.positionZ.value = listenerPos.z;
      listener.forwardX.value = listenerFwd.x;
      listener.forwardY.value = listenerFwd.y;
      listener.forwardZ.value = listenerFwd.z;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    } else {
      // Legacy API
      listener.setPosition(listenerPos.x, listenerPos.y, listenerPos.z);
      listener.setOrientation(listenerFwd.x, listenerFwd.y, listenerFwd.z, 0, 1, 0);
    }

    // Update each peer's panner position
    for (const [citizenId, peer] of this.peers) {
      if (!peer.panner) continue;
      const pos = citizenPositions.get(citizenId);
      if (!pos) continue;

      if (peer.panner.positionX) {
        peer.panner.positionX.value = pos.x;
        peer.panner.positionY.value = pos.y;
        peer.panner.positionZ.value = pos.z;
      } else {
        peer.panner.setPosition(pos.x, pos.y, pos.z);
      }
    }
  }

  /**
   * Toggle microphone mute.
   */
  setMuted(muted) {
    this.muted = muted;
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Clean up all peers and mic.
   */
  dispose() {
    for (const [id] of this.peers) this.removePeer(id);
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop();
      this.localStream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
    }
    this.enabled = false;
  }
}
