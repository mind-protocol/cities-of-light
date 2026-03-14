/**
 * VoicePipeline — Engine voice processing.
 *
 * STT (Whisper) -> EntityManager routing -> TTS (ElevenLabs)
 *
 * World-agnostic: entity prompts come from the world repo,
 * voice IDs come from entity descriptors.
 *
 * Supports two modes:
 * - HTTP: POST /voice -> returns { transcription, response, audio, format }
 * - WebSocket: streams TTS chunks as voice_stream_start/data/end messages
 */

import { writeFileSync, createReadStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export class VoicePipeline {
  /**
   * @param {object} options
   * @param {object} options.entityManager — EntityManager instance for routing voice to entities
   * @param {object} options.llmClient — OpenAI SDK instance (used for Whisper STT)
   * @param {function} options.broadcast — (msg, exclude?) => void, broadcasts to all WebSocket clients
   * @param {object} [options.ttsConfig] — TTS configuration from manifest
   * @param {string} [options.ttsConfig.elevenlabs_api_key]
   * @param {string} [options.ttsConfig.elevenlabs_model] — default: 'eleven_turbo_v2_5'
   * @param {string} [options.ttsConfig.openai_fallback_voice] — default: 'nova'
   * @param {string} [options.sttModel] — Whisper model, default: 'whisper-1'
   */
  constructor({ entityManager, llmClient, broadcast, ttsConfig = {}, sttModel = 'whisper-1' }) {
    if (!entityManager) throw new Error('VoicePipeline requires an EntityManager');
    if (!llmClient) throw new Error('VoicePipeline requires an LLM client (OpenAI SDK) for STT');

    this.entityManager = entityManager;
    this.llmClient = llmClient;
    this.broadcast = broadcast;
    this.sttModel = sttModel;

    // TTS config — ElevenLabs is primary, OpenAI is the fallback
    this.elevenlabsApiKey = ttsConfig.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY || null;
    this.elevenlabsModel = ttsConfig.elevenlabs_model || 'eleven_turbo_v2_5';
    this.openaiTtsFallbackVoice = ttsConfig.openai_fallback_voice || 'nova';

    // Default ElevenLabs voice ID when entity has no voice config
    this.defaultVoiceId = ttsConfig.default_voice_id || process.env.ELEVENLABS_VOICE_ID || null;
    this.voiceByClass = ttsConfig.voice_by_class || {};
  }

  // ─── STT ────────────────────────────────────────────────

  /**
   * Transcribe audio via Whisper.
   * @param {Buffer} audioBuffer — raw audio data (WAV, webm, etc.)
   * @param {string} [format='wav'] — file extension hint for Whisper
   * @returns {Promise<string|null>} transcription text or null
   */
  async transcribe(audioBuffer, format = 'wav') {
    const tempPath = join(tmpdir(), `engine_voice_${Date.now()}.${format}`);
    writeFileSync(tempPath, audioBuffer);

    try {
      const result = await this.llmClient.audio.transcriptions.create({
        file: createReadStream(tempPath),
        model: this.sttModel,
      });
      return result.text?.trim() || null;
    } catch (e) {
      console.error('VoicePipeline STT error:', e.message);
      throw e;
    }
  }

  // ─── TTS ────────────────────────────────────────────────

  /**
   * Resolve the ElevenLabs voice ID for an entity.
   * Entity descriptors can specify voice.elevenlabs_voice_id.
   * Falls back to the pipeline default.
   * @param {object|null} voiceConfig — entity.voice from descriptor
   * @returns {string|null}
   */
  _resolveVoiceId(voiceConfig) {
    if (voiceConfig?.elevenlabs_voice_id) return voiceConfig.elevenlabs_voice_id;
    return this.defaultVoiceId;
  }

  /**
   * Synthesize speech via ElevenLabs (non-streaming, full buffer).
   * @param {string} text
   * @param {string} voiceId — ElevenLabs voice ID
   * @returns {Promise<Buffer|null>}
   */
  async _ttsElevenLabs(text, voiceId) {
    if (!this.elevenlabsApiKey || !voiceId) return null;

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: this.elevenlabsModel,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!res.ok) {
      console.error('VoicePipeline ElevenLabs error:', res.status, await res.text());
      return null;
    }

    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Synthesize speech via OpenAI TTS (fallback, non-streaming).
   * @param {string} text
   * @param {string} [voice] — OpenAI voice name
   * @returns {Promise<Buffer|null>}
   */
  async _ttsOpenAI(text, voice) {
    try {
      const res = await this.llmClient.audio.speech.create({
        model: 'tts-1',
        voice: voice || this.openaiTtsFallbackVoice,
        input: text,
        response_format: 'mp3',
      });
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      console.error('VoicePipeline OpenAI TTS error:', e.message);
      return null;
    }
  }

  /**
   * Stream TTS audio chunks via ElevenLabs streaming endpoint.
   * Calls onChunk(base64String, index) for each chunk as it arrives.
   * @param {string} text
   * @param {string} voiceId
   * @param {function} onChunk — (base64Chunk: string, index: number) => void
   * @returns {Promise<number>} number of chunks streamed, 0 if failed
   */
  async _ttsElevenLabsStream(text, voiceId, onChunk) {
    if (!this.elevenlabsApiKey || !voiceId) return 0;

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.elevenlabsApiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: this.elevenlabsModel,
            output_format: 'mp3_44100_128',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (!res.ok || !res.body) {
        console.error('VoicePipeline ElevenLabs stream error:', res.status);
        return 0;
      }

      const reader = res.body.getReader();
      let index = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        index++;
        onChunk(Buffer.from(value).toString('base64'), index);
      }

      return index;
    } catch (e) {
      console.error('VoicePipeline ElevenLabs stream error:', e.message);
      return 0;
    }
  }

  // ─── Full pipeline: HTTP mode ───────────────────────────

  /**
   * Process a voice request end-to-end (HTTP mode).
   * Returns the complete response with optional audio.
   *
   * @param {object} params
   * @param {string} params.audio — base64-encoded audio data
   * @param {string} [params.format='wav'] — audio format hint
   * @param {{ x, y, z }} params.position — speaker's world position
   * @param {string} [params.name='Visitor'] — speaker name
   * @returns {Promise<object>} { transcription, entityId, entityName, response, audio, format, latency }
   */
  async processHTTP({ audio, format = 'wav', position, name = 'Visitor' }) {
    const startTime = Date.now();

    // 1. Decode audio
    const audioBuffer = Buffer.from(audio, 'base64');

    // 2. STT
    const transcription = await this.transcribe(audioBuffer, format);
    if (!transcription) {
      return { transcription: null, response: null, error: 'empty_transcription' };
    }

    const sttMs = Date.now() - startTime;
    console.log(`Voice STT: "${transcription}" (${sttMs}ms)`);

    // 3. Route to EntityManager
    const entityResponse = await this.entityManager.handleVoiceInput(transcription, position, name);
    if (!entityResponse) {
      return {
        transcription,
        response: null,
        error: 'no_entity_in_range',
        latency: Date.now() - startTime,
      };
    }

    const { entityId, entityName, text, position: entityPos, voiceConfig, className } = entityResponse;
    const llmMs = Date.now() - startTime;
    console.log(`Voice LLM: ${entityName} -> "${text}" (${llmMs}ms STT+LLM)`);

    // 4. Broadcast the speech event so all clients see subtitles
    this.broadcast({
      type: 'entity_speak',
      entityId,
      entityName,
      text,
      position: entityPos,
    });

    // 5. TTS
    const voiceId = this._resolveVoiceId(voiceConfig, className);
    let audioBase64 = null;

    // Try ElevenLabs first
    if (voiceId) {
      const buf = await this._ttsElevenLabs(text, voiceId);
      if (buf) audioBase64 = buf.toString('base64');
    }

    // Fallback to OpenAI TTS
    if (!audioBase64) {
      const openaiVoice = voiceConfig?.openai_voice || this.openaiTtsFallbackVoice;
      const buf = await this._ttsOpenAI(text, openaiVoice);
      if (buf) audioBase64 = buf.toString('base64');
    }

    const totalMs = Date.now() - startTime;
    console.log(`Voice complete: ${entityName} responded in ${totalMs}ms`);

    return {
      transcription,
      entityId,
      entityName,
      response: text,
      audio: audioBase64,
      format: 'audio/mpeg',
      position: entityPos,
      latency: totalMs,
    };
  }

  // ─── Full pipeline: WebSocket streaming mode ────────────

  /**
   * Process a voice request with streaming TTS over WebSocket.
   * Sends voice_stream_start, voice_stream_data (chunks), voice_stream_end.
   *
   * @param {object} params
   * @param {string} params.audio — base64-encoded audio data
   * @param {string} [params.format='wav'] — audio format hint
   * @param {{ x, y, z }} params.position — speaker's world position
   * @param {string} [params.name='Visitor'] — speaker name
   * @param {function} send — (jsonObject) => void, sends to the requesting WebSocket client
   */
  async processStreaming({ audio, format = 'wav', position, name = 'Visitor' }, send) {
    const startTime = Date.now();

    // 1. Decode audio
    const audioBuffer = Buffer.from(audio, 'base64');

    // 2. STT
    let transcription;
    try {
      transcription = await this.transcribe(audioBuffer, format);
    } catch {
      send({ type: 'voice_stream_end', error: 'stt_failed', chunks: 0, latency: Date.now() - startTime });
      return;
    }

    if (!transcription) {
      send({ type: 'voice_stream_end', error: 'empty_transcription', chunks: 0, latency: Date.now() - startTime });
      return;
    }

    const sttMs = Date.now() - startTime;
    console.log(`Voice STT: "${transcription}" (${sttMs}ms)`);

    // 3. Route to EntityManager
    const entityResponse = await this.entityManager.handleVoiceInput(transcription, position, name);
    if (!entityResponse) {
      send({
        type: 'voice_stream_end',
        transcription,
        error: 'no_entity_in_range',
        chunks: 0,
        latency: Date.now() - startTime,
      });
      return;
    }

    const { entityId, entityName, text, position: entityPos, voiceConfig, className } = entityResponse;
    const llmMs = Date.now() - startTime;
    console.log(`Voice LLM: ${entityName} -> "${text}" (${llmMs}ms STT+LLM)`);

    // 4. Broadcast the speech event to all clients
    this.broadcast({
      type: 'entity_speak',
      entityId,
      entityName,
      text,
      position: entityPos,
    });

    // 5. Send stream start — client can display transcription + response text immediately
    send({
      type: 'voice_stream_start',
      transcription,
      entityId,
      entityName,
      response: text,
      position: entityPos,
      sttMs,
      llmMs,
    });

    // 6. Stream TTS chunks
    let chunksStreamed = 0;
    const voiceId = this._resolveVoiceId(voiceConfig, className);

    if (voiceId) {
      chunksStreamed = await this._ttsElevenLabsStream(text, voiceId, (chunk, index) => {
        send({
          type: 'voice_stream_data',
          chunk,
          index,
          entityId,
        });
      });
    }

    // Fallback: non-streaming OpenAI TTS as single chunk
    if (chunksStreamed === 0) {
      const openaiVoice = voiceConfig?.openai_voice || this.openaiTtsFallbackVoice;
      const buf = await this._ttsOpenAI(text, openaiVoice);
      if (buf) {
        send({
          type: 'voice_stream_data',
          chunk: buf.toString('base64'),
          index: 1,
          entityId,
        });
        chunksStreamed = 1;
      }
    }

    // 7. Stream end
    const totalMs = Date.now() - startTime;
    send({
      type: 'voice_stream_end',
      entityId,
      entityName,
      chunks: chunksStreamed,
      latency: totalMs,
    });

    console.log(`Voice streamed: ${entityName}, ${chunksStreamed} chunks in ${totalMs}ms`);
  }

  // ─── Speak as entity (text-only input, TTS + broadcast) ─

  /**
   * Make an entity speak with TTS — for programmatic use (not voice-triggered).
   * Broadcasts speech event + streams TTS to all clients.
   *
   * @param {string} entityId
   * @param {string} text
   */
  async speakAsEntity(entityId, text) {
    const entity = this.entityManager.entities.get(entityId);
    if (!entity) {
      console.error(`VoicePipeline: entity ${entityId} not found`);
      return;
    }

    const startTime = Date.now();

    // Broadcast text immediately (subtitles)
    this.broadcast({
      type: 'entity_speak',
      entityId,
      entityName: entity.name,
      text,
      position: entity.position,
    });

    // Stream TTS to all clients
    const voiceId = this._resolveVoiceId(entity.voice);
    let chunksStreamed = 0;

    this.broadcast({
      type: 'voice_stream_start',
      entityId,
      entityName: entity.name,
      response: text,
      position: entity.position,
      sttMs: 0,
      llmMs: 0,
    });

    if (voiceId) {
      chunksStreamed = await this._ttsElevenLabsStream(text, voiceId, (chunk, index) => {
        this.broadcast({
          type: 'voice_stream_data',
          chunk,
          index,
          entityId,
        });
      });
    }

    if (chunksStreamed === 0) {
      const openaiVoice = entity.voice?.openai_voice || this.openaiTtsFallbackVoice;
      const buf = await this._ttsOpenAI(text, openaiVoice);
      if (buf) {
        this.broadcast({
          type: 'voice_stream_data',
          chunk: buf.toString('base64'),
          index: 1,
          entityId,
        });
        chunksStreamed = 1;
      }
    }

    this.broadcast({
      type: 'voice_stream_end',
      entityId,
      entityName: entity.name,
      chunks: chunksStreamed,
      latency: Date.now() - startTime,
    });

    console.log(`Entity ${entity.name} spoke: ${chunksStreamed} chunks in ${Date.now() - startTime}ms`);
  }
}
