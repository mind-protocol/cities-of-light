/**
 * Biography Voice Pipeline — STT → Consent Check → Biography Match → TTS
 *
 * When a visitor speaks near a memorial, this pipeline:
 * 1. Transcribes their question (Whisper)
 * 2. Checks consent via FastAPI policy engine
 * 3. Queries the biography archive for a matching answer
 * 4. TTS the answer (or a graceful fallback) and streams it back
 */

import { createReadStream, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import OpenAI from 'openai';

const openai = new OpenAI();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
const SERVICES_URL = process.env.CITIES_SERVICES_URL || 'http://localhost:8900';
const DIALOGUE_LOG = join(process.env.HOME, 'manemus', 'shrine', 'state', 'dialogue.jsonl');

/**
 * Process a biography voice query.
 * @param {Buffer} audioBuffer — raw audio from Quest mic
 * @param {string} donorId — which donor's archive to query
 * @param {string} interactantId — who is asking (citizen ID)
 * @param {Function} send — broadcast function (msg → all clients)
 */
export async function processBiographyVoice(audioBuffer, donorId, interactantId, send) {
  const startTime = Date.now();

  // ─── 1. STT (Whisper) ──────────────────────────────────

  const tempPath = join(tmpdir(), `bio_voice_${Date.now()}.webm`);
  writeFileSync(tempPath, audioBuffer);

  let transcription;
  try {
    const result = await openai.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: 'whisper-1',
    });
    transcription = result.text?.trim();
  } catch (e) {
    console.error('Biography STT error:', e.message);
    return;
  }

  if (!transcription) return;

  const sttMs = Date.now() - startTime;
  console.log(`📜 Biography query for ${donorId}: "${transcription}" (${sttMs}ms STT)`);

  // ─── 2. Biography query via FastAPI ─────────────────────

  let answer = null;
  let aiDisclosure = '';
  let refused = false;
  let refusalReason = '';

  try {
    const url = `${SERVICES_URL}/donors/${encodeURIComponent(donorId)}/biography` +
      `?q=${encodeURIComponent(transcription)}&interactant_id=${encodeURIComponent(interactantId)}`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (!data.allowed) {
      refused = true;
      refusalReason = data.refusal_reason || 'Access not authorized';
    } else if (data.answer) {
      answer = data.answer;
    }
    aiDisclosure = data.ai_disclosure || '';
  } catch (e) {
    console.error('Biography service error:', e.message);
    refusalReason = 'Archive service unavailable';
    refused = true;
  }

  const llmMs = Date.now() - startTime - sttMs;

  // ─── 3. Determine response text ────────────────────────

  let responseText;
  if (refused) {
    responseText = refusalReason;
  } else if (answer) {
    responseText = answer;
  } else {
    responseText = "I don't have a recording about that. Try asking something else.";
  }

  console.log(`📜 Biography response: "${responseText.substring(0, 80)}..." (${llmMs}ms query)`);

  // ─── 4. Stream TTS ─────────────────────────────────────

  // Send start with transcription and AI disclosure
  send({
    type: 'biography_stream_start',
    donorId,
    transcription,
    response: responseText,
    aiDisclosure,
    sttMs,
    llmMs,
  });

  let chunksStreamed = 0;
  let streamedOk = false;

  // ElevenLabs streaming TTS
  if (ELEVENLABS_API_KEY) {
    try {
      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: responseText,
            model_id: 'eleven_turbo_v2_5',
            output_format: 'mp3_44100_128',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (ttsRes.ok && ttsRes.body) {
        const reader = ttsRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunksStreamed++;
          send({
            type: 'biography_stream_data',
            chunk: Buffer.from(value).toString('base64'),
            index: chunksStreamed,
          });
        }
        streamedOk = chunksStreamed > 0;
      }
    } catch (e) {
      console.error('Biography TTS stream error:', e.message);
    }
  }

  // Fallback: OpenAI TTS
  if (!streamedOk) {
    try {
      const ttsRes = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        input: responseText,
        response_format: 'mp3',
      });
      const ttsBuffer = Buffer.from(await ttsRes.arrayBuffer());
      send({
        type: 'biography_stream_data',
        chunk: ttsBuffer.toString('base64'),
        index: 1,
      });
      chunksStreamed = 1;
    } catch (e) {
      console.error('Biography TTS fallback error:', e.message);
    }
  }

  send({
    type: 'biography_stream_end',
    donorId,
    chunks: chunksStreamed,
    latency: Date.now() - startTime,
  });

  console.log(`📜 Biography complete: ${chunksStreamed} chunks in ${Date.now() - startTime}ms`);

  // Log to dialogue
  const now = new Date().toISOString();
  try {
    appendFileSync(DIALOGUE_LOG,
      JSON.stringify({ ts: now, speaker: interactantId, text: transcription, source: 'biography-query', donorId }) + '\n'
    );
    if (answer) {
      appendFileSync(DIALOGUE_LOG,
        JSON.stringify({ ts: now, speaker: donorId, text: answer, source: 'biography-archive', donorId }) + '\n'
      );
    }
  } catch {}
}
