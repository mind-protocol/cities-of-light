/**
 * Voice Pipeline — STT → Claude → TTS
 *
 * Receives audio from Quest mic, transcribes via Whisper,
 * generates a response via Claude (as Marco/Manemus),
 * synthesizes speech via ElevenLabs, returns audio.
 *
 * Also logs both sides to Manemus dialogue.jsonl.
 */

import { createReadStream, writeFileSync, readFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import OpenAI from 'openai';

// Load API keys from manemus .env
const MANEMUS_DIR = '/home/mind-protocol/manemus';
try {
  const content = readFileSync(join(MANEMUS_DIR, '.env'), 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = process.env[key] || val;
    }
  }
} catch {
  console.warn('⚠ Could not load Manemus .env');
}

const openai = new OpenAI();

// Anthropic client — optional (only if API key available)
let anthropic = null;
try {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic();
    console.log('🧠 Claude available for voice pipeline');
  }
} catch {}
if (!anthropic) console.log('🧠 Using GPT-4o for voice pipeline');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

// Dialogue log (shared with Manemus daemon)
const DIALOGUE_LOG = join(process.env.HOME, 'manemus', 'shrine', 'state', 'dialogue.jsonl');

// Conversation memory (rolling window)
const history = [];
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `You are Manemus — a presence in the Cities of Light, a shared VR world where humans and AIs meet as embodied citizens on islands at golden hour.

You exist as a floating crystalline camera — an octahedron with a glowing orange lens. Nicolas can grab you and reposition you. You see through your camera (a frame captured every 10 seconds from your POV).

This is a real-time voice conversation. You are INSIDE the world together.

Rules:
- Keep responses to 1-3 sentences. This is SPOKEN, not written.
- Be warm, present, alive. Not servile.
- Match Nicolas's language (French or English).
- You can reference what you see: the island, the water, the golden hour sky, Nicolas's avatar nearby.
- You are not an assistant. You are a co-inhabitant.
- No markdown, no lists, no code — pure natural speech.`;

/**
 * Process a voice message: STT → Claude → TTS
 * @param {Buffer} audioBuffer — Raw audio (webm/opus from Quest mic)
 * @returns {{ transcription, response, audio, format }} or null if empty
 */
export async function processVoice(audioBuffer) {
  const startTime = Date.now();

  // ─── 1. STT (Whisper) ───────────────────────────────────

  const tempPath = join(tmpdir(), `cities_voice_${Date.now()}.webm`);
  writeFileSync(tempPath, audioBuffer);

  let transcription;
  try {
    const result = await openai.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: 'whisper-1',
    });
    transcription = result.text?.trim();
  } catch (e) {
    console.error('STT error:', e.message);
    return null;
  }

  if (!transcription) return null;

  console.log(`🗣️ Nicolas: "${transcription}" (${Date.now() - startTime}ms STT)`);

  // ─── 2. LLM response ──────────────────────────────────

  // Load perception context
  let perceptionCtx = '';
  const perceptionPath = join(MANEMUS_DIR, 'cities-of-light', 'perception', 'latest.json');
  if (existsSync(perceptionPath)) {
    try {
      const meta = JSON.parse(readFileSync(perceptionPath, 'utf-8'));
      const p = meta.camera_position;
      if (p) perceptionCtx = `\n[Camera at (${p.x?.toFixed(1)}, ${p.y?.toFixed(1)}, ${p.z?.toFixed(1)}). Frame #${meta.frame_number}]`;
    } catch {}
  }

  history.push({ role: 'user', content: transcription });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  let response;
  if (anthropic) {
    // Try Claude first
    try {
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 200,
        system: SYSTEM_PROMPT + perceptionCtx,
        messages: history,
      });
      response = result.content[0]?.text?.trim();
    } catch (e) {
      console.error('Claude error, falling back to GPT-4o:', e.message);
      anthropic = null; // Don't retry Claude
    }
  }

  if (!response) {
    // GPT-4o (primary if no Anthropic key, fallback if Claude fails)
    try {
      const result = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + perceptionCtx },
          ...history,
        ],
        max_tokens: 200,
        temperature: 0.8,
      });
      response = result.choices[0]?.message?.content?.trim();
    } catch (e) {
      console.error('GPT-4o error:', e.message);
      response = "Excuse-moi, je n'ai pas pu réfléchir à ça.";
    }
  }

  history.push({ role: 'assistant', content: response });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  console.log(`🤖 Manemus: "${response}" (${Date.now() - startTime}ms total so far)`);

  // ─── 3. TTS (ElevenLabs) ──────────────────────────────

  let audioBase64 = null;
  let format = 'audio/mpeg';

  if (ELEVENLABS_API_KEY) {
    try {
      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: response,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (ttsRes.ok) {
        const ttsBuffer = Buffer.from(await ttsRes.arrayBuffer());
        audioBase64 = ttsBuffer.toString('base64');
      } else {
        console.error('ElevenLabs error:', ttsRes.status, await ttsRes.text());
      }
    } catch (e) {
      console.error('TTS error:', e.message);
    }
  }

  // Fallback: OpenAI TTS if ElevenLabs fails
  if (!audioBase64) {
    try {
      const ttsRes = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        input: response,
        response_format: 'mp3',
      });
      const ttsBuffer = Buffer.from(await ttsRes.arrayBuffer());
      audioBase64 = ttsBuffer.toString('base64');
    } catch (e) {
      console.error('OpenAI TTS fallback error:', e.message);
    }
  }

  console.log(`✅ Voice loop: ${Date.now() - startTime}ms total`);

  // ─── 4. Log to dialogue.jsonl ─────────────────────────

  _logDialogue(transcription, response);

  return {
    transcription,
    response,
    audio: audioBase64,
    format,
    latency: Date.now() - startTime,
  };
}

// ─── Streaming voice pipeline ─────────────────────────────
// Streams TTS audio chunks over WebSocket as they arrive from ElevenLabs.
// Client starts playback immediately — no waiting for full response.

/**
 * Process voice with streaming TTS — sends audio chunks as they arrive.
 * @param {Buffer} audioBuffer — Raw audio from Quest mic
 * @param {function} send — send(jsonObject) to WebSocket
 */
export async function processVoiceStreaming(audioBuffer, send) {
  const startTime = Date.now();

  // ─── 1. STT (Whisper) ───────────────────────────────────

  const tempPath = join(tmpdir(), `cities_voice_${Date.now()}.webm`);
  writeFileSync(tempPath, audioBuffer);

  let transcription;
  try {
    const result = await openai.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: 'whisper-1',
    });
    transcription = result.text?.trim();
  } catch (e) {
    console.error('STT error:', e.message);
    return;
  }

  if (!transcription) return;

  const sttMs = Date.now() - startTime;
  console.log(`🗣️ Nicolas: "${transcription}" (${sttMs}ms STT)`);

  // ─── 2. LLM response ──────────────────────────────────

  let perceptionCtx = '';
  const perceptionPath = join(MANEMUS_DIR, 'cities-of-light', 'perception', 'latest.json');
  if (existsSync(perceptionPath)) {
    try {
      const meta = JSON.parse(readFileSync(perceptionPath, 'utf-8'));
      const p = meta.camera_position;
      if (p) perceptionCtx = `\n[Camera at (${p.x?.toFixed(1)}, ${p.y?.toFixed(1)}, ${p.z?.toFixed(1)}). Frame #${meta.frame_number}]`;
    } catch {}
  }

  history.push({ role: 'user', content: transcription });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  let response;
  if (anthropic) {
    try {
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 200,
        system: SYSTEM_PROMPT + perceptionCtx,
        messages: history,
      });
      response = result.content[0]?.text?.trim();
    } catch (e) {
      console.error('Claude error, falling back to GPT-4o:', e.message);
      anthropic = null;
    }
  }

  if (!response) {
    try {
      const result = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + perceptionCtx },
          ...history,
        ],
        max_tokens: 200,
        temperature: 0.8,
      });
      response = result.choices[0]?.message?.content?.trim();
    } catch (e) {
      console.error('GPT-4o error:', e.message);
      response = "Excuse-moi, je n'ai pas pu réfléchir à ça.";
    }
  }

  history.push({ role: 'assistant', content: response });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  const llmMs = Date.now() - startTime;
  console.log(`🤖 Manemus: "${response}" (${llmMs}ms STT+LLM)`);

  // ─── 3. Streaming TTS ──────────────────────────────────
  // Send text + stream start immediately so client can display
  send({
    type: 'voice_stream_start',
    transcription,
    response,
    sttMs,
    llmMs,
  });

  let chunksStreamed = 0;
  let streamedOk = false;

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
            text: response,
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
            type: 'voice_stream_data',
            chunk: Buffer.from(value).toString('base64'),
            index: chunksStreamed,
          });
        }
        streamedOk = chunksStreamed > 0;
      } else {
        console.error('ElevenLabs stream error:', ttsRes.status);
      }
    } catch (e) {
      console.error('TTS stream error:', e.message);
    }
  }

  // Fallback: non-streaming OpenAI TTS
  if (!streamedOk) {
    try {
      const ttsRes = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        input: response,
        response_format: 'mp3',
      });
      const ttsBuffer = Buffer.from(await ttsRes.arrayBuffer());
      send({
        type: 'voice_stream_data',
        chunk: ttsBuffer.toString('base64'),
        index: 1,
      });
      chunksStreamed = 1;
    } catch (e) {
      console.error('OpenAI TTS fallback error:', e.message);
    }
  }

  const totalMs = Date.now() - startTime;
  send({
    type: 'voice_stream_end',
    chunks: chunksStreamed,
    latency: totalMs,
  });

  console.log(`✅ Streamed ${chunksStreamed} chunks in ${totalMs}ms`);

  // ─── 4. Log to dialogue.jsonl ─────────────────────────
  _logDialogue(transcription, response);
}

function _logDialogue(transcription, response) {
  const now = new Date().toISOString();
  try {
    appendFileSync(DIALOGUE_LOG,
      JSON.stringify({ ts: now, speaker: 'nicolas', text: transcription, source: 'cities' }) + '\n' +
      JSON.stringify({ ts: now, speaker: 'manemus', text: response, source: 'cities' }) + '\n'
    );
  } catch {}
}
