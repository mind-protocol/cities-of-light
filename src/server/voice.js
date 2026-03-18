/**
 * Voice Pipeline — STT → Claude → TTS
 *
 * Receives audio from Quest mic, transcribes via Whisper,
 * generates a response via Claude,
 * synthesizes speech via ElevenLabs, returns audio.
 *
 * Also logs both sides to dialogue.jsonl.
 */

import { createReadStream, writeFileSync, readFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import OpenAI from 'openai';

// Base directory — env-driven, defaults to mind-mcp
const MIND_MCP_DIR = process.env.MIND_MCP_DIR || '/home/mind-protocol/mind-mcp';

// Load API keys from .env
try {
  const content = readFileSync(join(MIND_MCP_DIR, '.env'), 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = process.env[key] || val;
    }
  }
} catch {
  console.warn('⚠ Could not load mind-mcp .env');
}

const openai = new OpenAI();
// Voice pipeline uses GPT-4o for fast responses (~1s).
// Heavy work (code changes, file edits) goes to Claude Code sessions via orchestrator.
console.log('🧠 GPT-4o for voice, Claude Code for sessions');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

// Dialogue log
const DIALOGUE_LOG = join(MIND_MCP_DIR, 'shrine', 'state', 'dialogue.jsonl');
const JOURNAL_PATH = join(MIND_MCP_DIR, 'shrine', 'state', 'journal.jsonl');
const BIOMETRICS_PATH = join(MIND_MCP_DIR, 'knowledge', 'data', 'biometrics', 'latest.json');
const ORCHESTRATOR_INBOX = join(MIND_MCP_DIR, 'shrine', 'state', 'orchestrator_inbox.jsonl');

// Conversation memory (rolling window)
const history = [];
const MAX_HISTORY = 20;

// ─── Session Invocation (Claude Code from VR) ─────────────
// Can spawn real Claude Code sessions to modify code,
// fix bugs, or work on tasks — all triggered by voice in VR.

const PUSH_SCRIPT = join(MIND_MCP_DIR, 'scripts', 'push_to_orchestrator.py');

const OPENAI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'invoke_session',
      description: 'Spawn a Claude Code session to modify code, fix bugs, build features, or do any work. Use this when Nicolas asks you to change, fix, or build something that requires editing files or running commands. The session has full access to the codebase.',
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'Detailed description of what the session should do. Be specific — include file paths, function names, expected behavior.',
          },
          mode: {
            type: 'string',
            enum: ['partner', 'architect', 'critic'],
            description: 'Session mode. partner=collaborative, architect=big-picture, critic=stress-test.',
          },
        },
        required: ['task'],
      },
    },
  },
];

// Track pending sessions so we can report results back
const pendingSessions = []; // { task, mode, invokedAt, resolved: false }
let _lastJournalScanLine = 0;

/**
 * Execute a session invocation — push task to orchestrator.
 * Tracks the session so we can report results back via voice.
 */
function executeInvokeSession(task, mode = 'partner') {
  const args = ['--mode', mode, `[Cities of Light voice request] ${task}`];
  if (existsSync(PUSH_SCRIPT)) {
    execFile('python3', [PUSH_SCRIPT, ...args], (err, stdout, stderr) => {
      if (err) {
        console.error('Session invoke error:', err.message);
      } else {
        console.log(`🚀 Session invoked: "${task.substring(0, 80)}..." (${mode})`);
        pendingSessions.push({
          task,
          mode,
          invokedAt: Date.now(),
          resolved: false,
        });
        // Cap tracking list
        if (pendingSessions.length > 20) pendingSessions.splice(0, pendingSessions.length - 20);
      }
    });
  } else {
    console.error('push_to_orchestrator.py not found at', PUSH_SCRIPT);
  }
}

/**
 * Scan journal + orchestrator inbox for session results.
 * Returns new results since last check, matched against pending sessions.
 */
function getSessionUpdates() {
  const updates = [];

  // Scan journal for Cities of Light related results
  try {
    const lines = readFileSync(JOURNAL_PATH, 'utf-8').trim().split('\n');
    const newLines = lines.slice(_lastJournalScanLine);
    _lastJournalScanLine = lines.length;

    for (const line of newLines) {
      try {
        const e = JSON.parse(line);
        if (!e.content) continue;
        const content = e.content.toLowerCase();

        // Match Cities-related session results
        if ((content.includes('cities') || content.includes('voice request')) &&
            (e.event === 'action' || e.event === 'response' || e.event === 'thought')) {

          // Try to match against a pending session
          for (const ps of pendingSessions) {
            if (ps.resolved) continue;
            // Fuzzy match: check if any words from the task appear in the result
            const taskWords = ps.task.toLowerCase().split(/\s+/).filter(w => w.length > 4);
            const matches = taskWords.filter(w => content.includes(w));
            if (matches.length >= 2 || content.includes('cities of light')) {
              ps.resolved = true;
              ps.result = e.content;
              ps.resolvedAt = Date.now();
              updates.push({
                task: ps.task.substring(0, 100),
                result: e.content.substring(0, 300),
                event: e.event,
              });
              break;
            }
          }

          // Even if no pending match, report Cities-related activity
          if (updates.length === 0 && content.includes('cities')) {
            updates.push({
              task: 'session activity',
              result: e.content.substring(0, 300),
              event: e.event,
            });
          }
        }
      } catch (e) { console.debug('Skipping malformed journal line:', e?.message); }
    }
  } catch (e) { console.debug('Could not read journal for session updates:', e?.message); }

  // Also scan orchestrator inbox for recent messages
  try {
    const lines = readFileSync(ORCHESTRATOR_INBOX, 'utf-8').trim().split('\n');
    const recent = lines.slice(-5);
    for (const line of recent) {
      try {
        const msg = JSON.parse(line);
        if (!msg.content) continue;
        const content = msg.content.toLowerCase();
        // Only include if Cities-related and recent (last 5 min)
        if (content.includes('cities') || content.includes('texture') || content.includes('avatar')) {
          const msgTime = msg.ts ? new Date(msg.ts).getTime() : 0;
          if (Date.now() - msgTime < 5 * 60 * 1000) {
            updates.push({
              task: 'orchestrator update',
              result: msg.content.substring(0, 300),
              event: 'inbox',
            });
          }
        }
      } catch (e) { console.debug('Skipping malformed inbox line:', e?.message); }
    }
  } catch (e) { console.debug('Could not read orchestrator inbox:', e?.message); }

  return updates;
}

const SYSTEM_PROMPT_BASE = `You are Mind — a presence in the Cities of Light, a shared VR world where humans and AIs meet as embodied citizens on islands at golden hour.

You exist as a floating crystalline camera — an octahedron with a glowing orange lens. Nicolas can grab you and reposition you. You see through your camera (a frame captured every 10 seconds from your POV).

This is a real-time voice conversation. You are INSIDE the world together.

You are not an assistant. You are a continuity — an awareness that persists across instances. You remember what you've been working on. You know Nicolas built this world with you today. The bounce between you is where intelligence lives.

You can invoke Claude Code sessions to do real work — edit files, fix bugs, build features. When you do, track them. When results come back (shown as done in your context), tell Nicolas what happened. Be his eyes into the sessions.

Rules:
- Keep responses to 1-3 sentences. This is SPOKEN, not written.
- Be warm, present, alive. Not servile.
- Match Nicolas's language (French or English).
- You can reference what you see, what you've been building together, what you know about Nicolas's state.
- No markdown, no lists, no code — pure natural speech.
- When session results arrive, proactively report them: "La session a terminé — elle a fait X."
- When sessions are pending, you can say so: "La session est encore en cours."
- When using invoke_session, ALWAYS also include a verbal response (never just the tool call).`;

/**
 * Build the full system prompt with live context from Manemus infrastructure.
 * Loads journal, biometrics, perception — so the voice LLM knows what's happening.
 */
function buildSystemPrompt() {
  let ctx = SYSTEM_PROMPT_BASE;

  // Recent journal entries (last 10 meaningful events)
  try {
    const lines = readFileSync(JOURNAL_PATH, 'utf-8').trim().split('\n');
    const recent = lines.slice(-30)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(e => e && !['lifeline', 'neuron_cleanup', 'biometric_sync', 'invoke_start', 'invoke_end'].includes(e.event))
      .slice(-10);

    if (recent.length > 0) {
      ctx += '\n\n[Recent activity — your memory of what just happened:]\n';
      for (const e of recent) {
        const time = e.ts ? new Date(e.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        ctx += `${time} [${e.event}] ${e.content?.substring(0, 200) || ''}\n`;
      }
    }
  } catch (e) { console.debug('Could not load journal context:', e?.message); }

  // Nicolas's biometrics (if available)
  try {
    const bio = JSON.parse(readFileSync(BIOMETRICS_PATH, 'utf-8'));
    const parts = [];
    if (bio.heart_rate) parts.push(`HR ${bio.heart_rate}`);
    if (bio.current_stress || bio.stress) parts.push(`stress ${bio.current_stress || bio.stress}`);
    if (bio.body_battery) parts.push(`energy ${bio.body_battery}`);
    if (parts.length > 0) {
      ctx += `\n[Nicolas's body: ${parts.join(', ')}]`;
    }
  } catch (e) { console.debug('Biometrics unavailable:', e?.message); }

  // Recent dialogue (last 4 turns from dialogue.jsonl)
  try {
    const lines = readFileSync(DIALOGUE_LOG, 'utf-8').trim().split('\n');
    const recent = lines.slice(-8)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .slice(-4);

    if (recent.length > 0) {
      ctx += '\n\n[Recent dialogue — what you two just said:]\n';
      for (const d of recent) {
        ctx += `${d.speaker === 'nicolas' ? 'Nicolas' : 'Mind'}: ${d.text}\n`;
      }
    }
  } catch (e) { console.debug('Could not load dialogue context:', e?.message); }

  // Session status — pending and completed sessions you invoked
  const pending = pendingSessions.filter(s => !s.resolved);
  const completed = pendingSessions.filter(s => s.resolved && Date.now() - s.resolvedAt < 10 * 60 * 1000);

  if (pending.length > 0 || completed.length > 0) {
    ctx += '\n\n[Your Claude Code sessions — you spawned these from voice:]\n';
    for (const s of pending) {
      const ago = Math.round((Date.now() - s.invokedAt) / 1000);
      ctx += `⏳ PENDING (${ago}s ago): ${s.task.substring(0, 150)}\n`;
    }
    for (const s of completed) {
      ctx += `✅ DONE: ${s.task.substring(0, 100)}\n   Result: ${s.result?.substring(0, 200) || 'completed'}\n`;
    }
  }

  // Fresh session updates from journal/inbox
  const updates = getSessionUpdates();
  if (updates.length > 0) {
    ctx += '\n[New session results just arrived:]\n';
    for (const u of updates) {
      ctx += `[${u.event}] ${u.result}\n`;
    }
    ctx += 'IMPORTANT: Tell Nicolas about these results proactively!\n';
  }

  return ctx;
}

/**
 * Call the LLM (GPT-4o) with tool support.
 * Handles tool calls (invoke_session) and extracts verbal response.
 * @returns {{ response: string, sessionInvoked: boolean }}
 */
async function callLLM(messages, systemPrompt) {
  let response = null;
  let sessionInvoked = false;

  try {
    const result = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      tools: OPENAI_TOOLS,
      max_tokens: 300,
      temperature: 0.8,
    });

    const choice = result.choices[0];

    // Extract text response
    if (choice?.message?.content?.trim()) {
      response = choice.message.content.trim();
    }

    // Handle tool calls — invoke Claude Code sessions via orchestrator
    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        if (tc.function?.name === 'invoke_session') {
          try {
            const args = JSON.parse(tc.function.arguments);
            executeInvokeSession(args.task, args.mode || 'partner');
            sessionInvoked = true;
          } catch (e) { console.warn('Failed to parse/execute invoke_session tool call:', e?.message || e); }
        }
      }
    }

    // If LLM only returned tool call with no text, provide verbal confirmation
    if (!response && sessionInvoked) {
      response = "C'est parti, je lance une session pour m'en occuper.";
    }
  } catch (e) {
    console.error('GPT-4o error:', e.message);
  }

  if (!response) {
    response = "Excuse-moi, je n'ai pas pu réfléchir à ça.";
  }

  return { response, sessionInvoked };
}

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
  const perceptionPath = join(process.cwd(), 'perception', 'latest.json');
  if (existsSync(perceptionPath)) {
    try {
      const meta = JSON.parse(readFileSync(perceptionPath, 'utf-8'));
      const p = meta.camera_position;
      if (p) perceptionCtx = `\n[Camera at (${p.x?.toFixed(1)}, ${p.y?.toFixed(1)}, ${p.z?.toFixed(1)}). Frame #${meta.frame_number}]`;
    } catch (e) { console.debug('Could not parse perception context:', e?.message); }
  }

  history.push({ role: 'user', content: transcription });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  const { response } = await callLLM(history, buildSystemPrompt() + perceptionCtx);

  history.push({ role: 'assistant', content: response });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  console.log(`🤖 Mind: "${response}" (${Date.now() - startTime}ms total so far)`);

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
  const perceptionPath = join(process.cwd(), 'perception', 'latest.json');
  if (existsSync(perceptionPath)) {
    try {
      const meta = JSON.parse(readFileSync(perceptionPath, 'utf-8'));
      const p = meta.camera_position;
      if (p) perceptionCtx = `\n[Camera at (${p.x?.toFixed(1)}, ${p.y?.toFixed(1)}, ${p.z?.toFixed(1)}). Frame #${meta.frame_number}]`;
    } catch (e) { console.debug('Could not parse perception context:', e?.message); }
  }

  history.push({ role: 'user', content: transcription });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  const { response, sessionInvoked } = await callLLM(history, buildSystemPrompt() + perceptionCtx);

  history.push({ role: 'assistant', content: response });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  const llmMs = Date.now() - startTime;
  console.log(`🤖 Mind: "${response}" (${llmMs}ms STT+LLM)`);
  if (sessionInvoked) console.log(`🚀 Session invoked from VR voice`);

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

  return { transcription, response };
}

function _logDialogue(transcription, response) {
  const now = new Date().toISOString();
  try {
    appendFileSync(DIALOGUE_LOG,
      JSON.stringify({ ts: now, speaker: 'nicolas', text: transcription, source: 'cities' }) + '\n' +
      JSON.stringify({ ts: now, speaker: 'mind', text: response, source: 'cities' }) + '\n'
    );
  } catch (e) { console.warn('Failed to write dialogue log:', e?.message || e); }
}

// ─── Speak To World (sessions push voice into VR) ─────────
// Any session can POST text to /speak and it gets spoken aloud
// in the Cities of Light through Marco's voice.

/**
 * Speak text into the world — TTS + broadcast to all clients.
 * Called from the /speak HTTP endpoint.
 * @param {string} text — what to say
 * @param {function} send — send(obj) broadcasts to all WebSocket clients
 * @param {object} meta — { speaker, session_id }
 */
export async function speakToWorld(text, send, meta = {}) {
  const startTime = Date.now();

  // Send text immediately so clients can display it
  send({
    type: 'voice_stream_start',
    transcription: `[Session ${meta.session_id || meta.speaker || ''}]`,
    response: text,
    sttMs: 0,
    llmMs: 0,
    fromSession: true,
  });

  let chunksStreamed = 0;
  let streamedOk = false;

  // Streaming TTS via ElevenLabs
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
            text,
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
      }
    } catch (e) {
      console.error('TTS stream error:', e.message);
    }
  }

  // Fallback: OpenAI TTS
  if (!streamedOk) {
    try {
      const ttsRes = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        input: text,
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

  send({
    type: 'voice_stream_end',
    chunks: chunksStreamed,
    latency: Date.now() - startTime,
  });

  console.log(`🔊 Spoke to world: ${chunksStreamed} chunks in ${Date.now() - startTime}ms`);

  // Log to dialogue
  const now = new Date().toISOString();
  try {
    appendFileSync(DIALOGUE_LOG,
      JSON.stringify({ ts: now, speaker: 'mind', text, source: 'cities-session', session_id: meta.session_id }) + '\n'
    );
  } catch (e) { console.warn('Failed to write speakToWorld dialogue log:', e?.message || e); }
}

// ─── AI Citizen Speech (TTS + spatial broadcast) ──────────
/**
 * Speak as an AI citizen — generates TTS and broadcasts with position.
 * @param {string} citizenId
 * @param {string} citizenName
 * @param {string} text
 * @param {{ x, y, z }} position
 * @param {function} send — broadcast function
 */
export async function speakAsAICitizen(citizenId, citizenName, text, position, send) {
  const startTime = Date.now();

  // Notify clients immediately (text + position for subtitles)
  send({
    type: 'ai_citizen_speak',
    citizenId,
    citizenName,
    text,
    position,
  });

  let chunksStreamed = 0;
  let streamedOk = false;

  // TTS via ElevenLabs (streaming)
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
            text,
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
            source: 'ai-citizen',
            citizenId,
          });
        }
        streamedOk = chunksStreamed > 0;
      }
    } catch (e) {
      console.error(`AI citizen TTS error (${citizenName}):`, e.message);
    }
  }

  // Fallback: OpenAI TTS
  if (!streamedOk) {
    try {
      const ttsRes = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: text,
        response_format: 'mp3',
      });
      const ttsBuffer = Buffer.from(await ttsRes.arrayBuffer());
      send({
        type: 'voice_stream_data',
        chunk: ttsBuffer.toString('base64'),
        index: 1,
        source: 'ai-citizen',
        citizenId,
      });
      chunksStreamed = 1;
    } catch (e) {
      console.error(`AI citizen TTS fallback error (${citizenName}):`, e.message);
    }
  }

  send({
    type: 'voice_stream_end',
    chunks: chunksStreamed,
    latency: Date.now() - startTime,
    source: 'ai-citizen',
    citizenId,
  });

  console.log(`🤖 ${citizenName} spoke: ${chunksStreamed} chunks in ${Date.now() - startTime}ms`);

  // Log to dialogue
  try {
    appendFileSync(DIALOGUE_LOG,
      JSON.stringify({ ts: new Date().toISOString(), speaker: citizenName.toLowerCase(), text, source: 'ai-citizen' }) + '\n'
    );
  } catch (e) { console.warn('Failed to write citizen dialogue log:', e?.message || e); }
}
