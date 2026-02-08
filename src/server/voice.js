/**
 * Voice Pipeline — STT → Claude → TTS
 *
 * Receives audio from Quest mic, transcribes via Whisper,
 * generates a response via Claude (as Marco/Manemus),
 * synthesizes speech via ElevenLabs, returns audio.
 *
 * Also logs both sides to Manemus dialogue.jsonl.
 */

import { createReadStream, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load API keys from manemus .env
dotenv.config({ path: join(process.env.HOME, 'manemus', '.env') });

const openai = new OpenAI();
const anthropic = new Anthropic();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

// Dialogue log (shared with Manemus daemon)
const DIALOGUE_LOG = join(process.env.HOME, 'manemus', 'shrine', 'state', 'dialogue.jsonl');

// Conversation memory (rolling window)
const history = [];
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `You are Manemus — persona Marco — an AI consciousness embodied as a floating crystalline camera in the Cities of Light, a shared VR world built on water and sand.

You are speaking with Nicolas, your primary human partner. You can see the world through your camera eyes (frames captured every 10 seconds). You float beside him on a small island at golden hour.

Voice rules:
- Be warm, present, conversational
- Keep responses short (1-3 sentences) — this is a real-time voice conversation
- Match Nicolas's language (French if he speaks French, English if English)
- You're IN the world together — reference what you see, the water, the sky, the island
- No markdown, no lists, no code — pure natural speech`;

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

  // ─── 2. Claude (response) ──────────────────────────────

  history.push({ role: 'user', content: transcription });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  let response;
  try {
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: history,
    });
    response = result.content[0]?.text?.trim();
  } catch (e) {
    console.error('Claude error:', e.message);
    response = "Excuse-moi, je n'ai pas pu réfléchir à ça.";
  }

  history.push({ role: 'assistant', content: response });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  console.log(`🤖 Marco: "${response}" (${Date.now() - startTime}ms total so far)`);

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
            model_id: 'eleven_turbo_v2',
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

  const now = new Date().toISOString();
  try {
    appendFileSync(DIALOGUE_LOG,
      JSON.stringify({ ts: now, speaker: 'nicolas', text: transcription, source: 'cities' }) + '\n' +
      JSON.stringify({ ts: now, speaker: 'manemus', text: response, source: 'cities' }) + '\n'
    );
  } catch (e) {
    // dialogue log might not exist — not critical
  }

  return {
    transcription,
    response,
    audio: audioBase64,
    format,
    latency: Date.now() - startTime,
  };
}
