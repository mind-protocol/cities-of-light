/**
 * PlaceNetwork — WebSocket client for Living Places protocol.
 */
export class PlaceNetwork {
  constructor() {
    this.ws = null;
    this.actorId = null;
    this.placeId = null;

    // Callbacks
    this.onState = null;
    this.onHistory = null;
    this.onPresence = null;
    this.onMoment = null;
    this.onPlaces = null;
    this.onCreated = null;
    this.onError = null;

    this._reconnectTimer = null;
    this._name = null;
    this._placeId = null;
  }

  connect(placeId, name, renderer = 'web') {
    this._name = name;
    this._placeId = placeId;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/places/ws`;

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.error('WebSocket connection failed:', e);
      return;
    }

    this.ws.onopen = () => {
      console.log('Connected to Living Places');
      // Auto-join the place
      this.ws.send(JSON.stringify({
        type: 'place:join',
        place_id: placeId,
        name,
        renderer,
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'place:state':
            this.placeId = msg.place?.id;
            if (this.onState) this.onState(msg);
            break;
          case 'place:history':
            if (this.onHistory) this.onHistory(msg);
            break;
          case 'place:presence':
            if (this.onPresence) this.onPresence(msg);
            break;
          case 'place:moment':
            if (this.onMoment) this.onMoment(msg);
            break;
          case 'place:places':
            if (this.onPlaces) this.onPlaces(msg);
            break;
          case 'place:created':
            if (this.onCreated) this.onCreated(msg);
            break;
          case 'place:error':
            console.error('Place error:', msg.message);
            if (this.onError) this.onError(msg);
            break;
        }
      } catch (e) {
        console.error('Message parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from Living Places, reconnecting in 3s...');
      this._reconnectTimer = setTimeout(() => this.connect(placeId, name, renderer), 3000);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  sendMoment(content, kind = 'text') {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'place:moment',
        place_id: this._placeId,
        content,
        kind,
      }));
    }
  }

  sendVoice(base64Audio) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'place:voice',
        place_id: this._placeId,
        audio: base64Audio,
      }));
    }
  }

  sendDiscover() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'place:discover' }));
    }
  }

  disconnect() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.ws) this.ws.close();
  }
}
