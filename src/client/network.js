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
    this._reconnectTimer = null;
    this._positionInterval = null;
  }

  connect(name = 'Anonymous', persona = null) {
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
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'citizen_joined':
            if (this.onCitizenJoined) this.onCitizenJoined(msg);
            break;
          case 'citizen_moved':
            if (this.onCitizenMoved) this.onCitizenMoved(msg);
            break;
          case 'citizen_left':
            if (this.onCitizenLeft) this.onCitizenLeft(msg);
            break;
          case 'voice':
            if (this.onVoice) this.onVoice(msg);
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
