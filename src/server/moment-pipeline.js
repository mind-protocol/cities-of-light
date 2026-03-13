/**
 * Moment Pipeline — processes text/voice input into graph-persisted Moments.
 * Flow: validate → create Moment node → create links → buffer → broadcast.
 * Graph persistence is async (fire-and-forget with error logging).
 */

export class MomentPipeline {
  constructor(graphClient, placeServer, voicePipeline = null) {
    this.graphClient = graphClient;
    this.placeServer = placeServer;
    this.voicePipeline = voicePipeline;
  }

  /**
   * Handle text input: create Moment, persist to graph, broadcast.
   */
  async handleInput(actorId, spaceId, content, kind = 'text', source = 'text') {
    if (!content || !content.trim()) return;

    const room = this.placeServer.rooms.get(spaceId);
    if (!room) throw new Error(`Room not found: ${spaceId}`);

    // Verify actor is in room
    if (!room.participants.has(actorId)) throw new Error(`Actor ${actorId} not in room ${spaceId}`);

    // Get actor name from room state
    const participant = room.participants.get(actorId);
    const authorName = participant?.name || actorId;

    // Create Moment (graph persistence — async, don't block broadcast)
    const momentPromise = this.graphClient.createMoment(content, source, kind, 1.0);

    // Create a broadcast-ready moment immediately (don't wait for graph)
    const timestamp = new Date().toISOString();
    const momentForBroadcast = {
      id: null, // Will be set after graph returns
      author: actorId,
      author_name: authorName,
      content,
      kind,
      source,
      timestamp,
      energy: 1.0,
    };

    // Wait for graph to get the moment ID, then create links
    momentPromise.then(async (moment) => {
      momentForBroadcast.id = moment.id;

      // Create links: Moment -[IN]-> Space, Actor -[CREATED]-> Moment
      await Promise.all([
        this.graphClient.createLink(moment.id, spaceId, 'IN'),
        this.graphClient.createLink(actorId, moment.id, 'CREATED'),
      ]);
    }).catch(e => {
      console.error(`Moment graph persist error: ${e.message}`);
    });

    // Buffer and broadcast immediately (don't wait for graph)
    room.momentBuffer.push(momentForBroadcast);
    if (room.momentBuffer.length > 100) room.momentBuffer.splice(0, room.momentBuffer.length - 100);

    this.placeServer.broadcastToRoom(spaceId, {
      type: 'place:moment',
      moment: momentForBroadcast,
    });
  }

  /**
   * Handle voice input: transcribe via Whisper, then create text Moment.
   * Uses the existing voice pipeline from cities-of-light.
   */
  async handleVoiceInput(actorId, spaceId, audioBase64) {
    if (!this.voicePipeline) {
      throw new Error('Voice pipeline not available');
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    console.log(`Place voice from ${actorId} (${audioBuffer.length} bytes)`);

    try {
      // Reuse existing Whisper transcription
      const result = await this.voicePipeline(audioBuffer);
      if (result?.transcription) {
        await this.handleInput(actorId, spaceId, result.transcription, 'text', 'voice');
      }
    } catch (e) {
      console.error(`Place voice error: ${e.message}`);
    }
  }
}
