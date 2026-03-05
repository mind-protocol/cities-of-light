/**
 * Network — WebSocket connection to spatial state server.
 * Syncs citizen positions in real-time.
 */

export class Network {
  constructor() {
    this.ws = null;
    this.citizenId = null;
    this.onCitizenJoined = null;
    this.onCitizenMoved = null;
    this.onCitizenLeft = null;
    this.onVoice = null;
    this.onVoiceResponse = null;
    this.onVoiceStreamStart = null;
    this.onVoiceStreamData = null;
    this.onVoiceStreamEnd = null;
    this.onManemusCameraUpdate = null;
    this.onCitizenVoice = null;
    this.onCitizenHands = null;
    this.onBiographyStreamStart = null;
    this.onBiographyStreamData = null;
    this.onBiographyStreamEnd = null;
    this.onAICitizenSpeak = null;
    this.onCitizenZoneChanged = null;
    this._reconnectTimer = null;
    this._positionInterval = null;
  }

  connect(name = 'Anonymous', persona = null, { spectator = false } = {}) {
    this._spectator = spectator;
    // Use same host as page, but WebSocket port
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In dev: proxy via Vite (/ws → ws://localhost:8801)
    // In prod: direct connection
    const url = `${protocol}//${location.host}/ws`;

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.warn('WebSocket connection failed, trying direct:', e);
      this.ws = new WebSocket(`ws://${location.hostname}:8801`);
    }

    this.ws.onopen = () => {
      console.log('Connected to Cities of Light server');
      this.ws.send(JSON.stringify({
        type: 'join',
        name,
        persona,
        citizenId: this.citizenId,
        spectator: this._spectator,
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'welcome':
            this.citizenId = msg.citizenId;
            console.log('Assigned citizenId:', this.citizenId);
            break;
          case 'citizen_joined':
            // Skip our own join echo (safety net — server already excludes us)
            if (msg.citizenId === this.citizenId) break;
            if (this.onCitizenJoined) this.onCitizenJoined(msg);
            break;
          case 'citizen_moved':
            if (msg.citizenId === this.citizenId) break;
            if (this.onCitizenMoved) this.onCitizenMoved(msg);
            break;
          case 'citizen_left':
            if (this.onCitizenLeft) this.onCitizenLeft(msg);
            break;
          case 'voice':
            if (this.onVoice) this.onVoice(msg);
            break;
          case 'voice_response':
            if (this.onVoiceResponse) this.onVoiceResponse(msg);
            break;
          case 'voice_stream_start':
            if (this.onVoiceStreamStart) this.onVoiceStreamStart(msg);
            break;
          case 'voice_stream_data':
            if (this.onVoiceStreamData) this.onVoiceStreamData(msg);
            break;
          case 'voice_stream_end':
            if (this.onVoiceStreamEnd) this.onVoiceStreamEnd(msg);
            break;
          case 'manemus_camera':
            if (this.onManemusCameraUpdate) this.onManemusCameraUpdate(msg);
            break;
          case 'citizen_voice':
            if (this.onCitizenVoice) this.onCitizenVoice(msg);
            break;
          case 'citizen_hands':
            if (this.onCitizenHands) this.onCitizenHands(msg);
            break;
          case 'biography_stream_start':
            if (this.onBiographyStreamStart) this.onBiographyStreamStart(msg);
            break;
          case 'biography_stream_data':
            if (this.onBiographyStreamData) this.onBiographyStreamData(msg);
            break;
          case 'biography_stream_end':
            if (this.onBiographyStreamEnd) this.onBiographyStreamEnd(msg);
            break;
          case 'ai_citizen_speak':
            if (this.onAICitizenSpeak) this.onAICitizenSpeak(msg);
            break;
          case 'citizen_zone_changed':
            if (this.onCitizenZoneChanged) this.onCitizenZoneChanged(msg);
            break;
        }
      } catch (e) {
        console.error('Message parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from server, reconnecting in 3s...');
      this._reconnectTimer = setTimeout(() => this.connect(name, persona), 3000);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  sendPosition(position, rotation) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'position',
        position: { x: position.x, y: position.y, z: position.z },
        rotation: rotation ? { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w } : null,
      }));
    }
  }

  /** Broadcast Manemus streaming camera position (VR client → stream clients) */
  sendManemusCameraPosition(position, rotation) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'manemus_camera',
        position: { x: position.x, y: position.y, z: position.z },
        rotation: rotation ? { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w } : null,
      }));
    }
  }

  /** Send hand/controller joint data for remote rendering */
  sendHands(handsData) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'hands',
        hands: handsData,
      }));
    }
  }

  /** Send voice audio for biography query (near a memorial) */
  sendBiographyVoice(base64Audio, donorId) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'biography_voice',
        audio: base64Audio,
        donorId,
      }));
    }
  }

  /** Send teleport to target zone */
  sendTeleport(targetZoneId) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'teleport',
        targetZone: targetZoneId,
      }));
    }
  }

  /** Send voice audio to server for STT → Claude → TTS processing */
  sendVoice(base64Audio) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'voice',
        audio: base64Audio,
      }));
    }
  }

  /** Start sending position updates at interval (ms) */
  startPositionSync(getPosition, intervalMs = 100) {
    this._positionInterval = setInterval(() => {
      const { position, rotation } = getPosition();
      this.sendPosition(position, rotation);
    }, intervalMs);
  }

  stopPositionSync() {
    if (this._positionInterval) {
      clearInterval(this._positionInterval);
      this._positionInterval = null;
    }
  }

  disconnect() {
    this.stopPositionSync();
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.ws) this.ws.close();
  }
}
