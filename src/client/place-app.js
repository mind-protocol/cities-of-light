import { PlaceNetwork } from './place-network.js';

// ─── DOM ──────────────────────────────────────────────
const placeName = document.getElementById('place-name');
const participantCount = document.getElementById('participant-count');
const participantList = document.getElementById('participant-list');
const momentStream = document.getElementById('moment-stream');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');

// ─── State ────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const placeId = params.get('id');
const userName = params.get('name') || 'Anonymous';
let autoScroll = true;

if (!placeId) {
  placeName.textContent = 'Error: no place ID';
  momentStream.innerHTML = '<div class="moment-system">Add ?id=PLACE_ID&name=YOUR_NAME to the URL</div>';
}

// ─── Color hash for consistent author colors ─────────
const AUTHOR_COLORS = [
  '#00ff88', '#ff8800', '#58a6ff', '#d2a8ff', '#ff7b72',
  '#79c0ff', '#ffa657', '#7ee787', '#ff9bce', '#a5d6ff',
];

function authorColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}

// ─── Moment Rendering ────────────────────────────────
function renderMoment(moment) {
  const div = document.createElement('div');
  div.className = 'moment';

  const authorName = moment.author_name || moment.author || 'Unknown';
  const time = moment.timestamp ? new Date(moment.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '';
  const sourceTag = moment.source === 'voice' ? ' (voice)' : '';

  div.innerHTML = `
    <div class="moment-header">
      <span class="moment-author" style="color: ${authorColor(authorName)}">${escapeHtml(authorName)}</span>
      <span class="moment-time">${time}</span>
      ${sourceTag ? `<span class="moment-source">${sourceTag}</span>` : ''}
    </div>
    <div class="moment-content">${escapeHtml(moment.content)}</div>
  `;

  momentStream.appendChild(div);

  if (autoScroll) {
    momentStream.scrollTop = momentStream.scrollHeight;
  }
}

function renderSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'moment-system';
  div.textContent = text;
  momentStream.appendChild(div);
  if (autoScroll) momentStream.scrollTop = momentStream.scrollHeight;
}

// ─── Participant Rendering ───────────────────────────
function updateParticipants(participants) {
  participantList.innerHTML = '';
  participantCount.textContent = participants.length;

  for (const p of participants) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="participant-dot ${p.renderer || 'web'}"></span>
      <span class="participant-name">${escapeHtml(p.name || p.actor_id)}</span>
      <span class="participant-renderer">${p.renderer || 'web'}</span>
    `;
    participantList.appendChild(li);
  }
}

// ─── Auto-scroll detection ───────────────────────────
momentStream.addEventListener('scroll', () => {
  const atBottom = momentStream.scrollHeight - momentStream.scrollTop - momentStream.clientHeight < 50;
  autoScroll = atBottom;
});

// ─── Network ─────────────────────────────────────────
const network = new PlaceNetwork();

network.onState = (msg) => {
  const place = msg.place;
  placeName.textContent = place.name || place.id;
  document.title = `${place.name} — Living Place`;
  updateParticipants(place.participants || []);
  renderSystemMessage(`Joined ${place.name}`);
};

network.onHistory = (msg) => {
  if (msg.moments && msg.moments.length > 0) {
    for (const m of msg.moments) {
      renderMoment(m);
    }
  }
};

network.onPresence = (msg) => {
  if (msg.participants) updateParticipants(msg.participants);
  const action = msg.action === 'joined' ? 'joined' : 'left';
  renderSystemMessage(`${msg.name || msg.actor_id} ${action}`);
};

network.onMoment = (msg) => {
  renderMoment(msg.moment);
};

network.onError = (msg) => {
  renderSystemMessage(`Error: ${msg.message}`);
};

// ─── Input Handling ──────────────────────────────────
function sendMessage() {
  const text = textInput.value.trim();
  if (!text) return;
  network.sendMoment(text);
  textInput.value = '';
  textInput.focus();
}

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

// ─── Voice (push-to-talk) ────────────────────────────
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        network.sendVoice(base64);
      };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach(t => t.stop());
    };

    mediaRecorder.start();
    isRecording = true;
    micBtn.classList.add('recording');
    micBtn.textContent = 'Recording...';
  } catch (e) {
    console.error('Mic access error:', e);
    renderSystemMessage('Microphone access denied');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  isRecording = false;
  micBtn.classList.remove('recording');
  micBtn.textContent = 'Mic';
}

micBtn.addEventListener('mousedown', () => startRecording());
micBtn.addEventListener('mouseup', () => stopRecording());
micBtn.addEventListener('mouseleave', () => { if (isRecording) stopRecording(); });

// Spacebar push-to-talk (when input not focused)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement !== textInput && !isRecording) {
    e.preventDefault();
    startRecording();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && isRecording) {
    e.preventDefault();
    stopRecording();
  }
});

// ─── Utility ─────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Connect ─────────────────────────────────────────
if (placeId) {
  network.connect(placeId, userName);
}
