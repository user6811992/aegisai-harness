const msgsEl = document.getElementById('messages');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const pendingEl = document.getElementById('pending');
const backendEl = document.getElementById('backend');
let history = [];

function add(cls, text, forkIndex) {
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  if (cls === 'assistant' && window.HarnessMarkdown) d.innerHTML = window.HarnessMarkdown.render(text);
  else d.textContent = text;
  if (forkIndex >= 0) {
    const b = document.createElement('button');
    b.className = 'fork';
    b.textContent = 'fork';
    b.onclick = () => forkAt(forkIndex);
    d.appendChild(b);
  }
  msgsEl.appendChild(d);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

async function forkAt(index) {
  const r = await fetch('/api/branch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index }) });
  const data = await r.json();
  if (data.messages) {
    history = data.messages;
    msgsEl.innerHTML = '';
    history.forEach((m, i) => add(m.role, m.content || '', i));
  }
}

async function sendMsg() {
  const text = input.value.trim();
  if (!text) return;
  add('user', text, history.length);
  history.push({ role: 'user', content: text });
  input.value = '';
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, history }) });
    const data = await r.json();
    add('assistant', data.reply || '(no reply)', history.length);
    history.push({ role: 'assistant', content: data.reply || '' });
    speak(data.reply || '');
    updateMeter();
    if (data.toolLog && data.toolLog.length) {
      for (const t of data.toolLog) add('tool', '[tool] ' + t.name + ': ' + (t.resultPreview || ''));
    }
    if (data.pendingActions && data.pendingActions.length) renderPending(data.pendingActions);
  } catch (e) { add('assistant', 'error: ' + e.message); }
}

function renderPending(actions) {
  pendingEl.classList.remove('hidden');
  pendingEl.innerHTML = '<strong>Pending approvals</strong>';
  actions.forEach((a, i) => {
    const row = document.createElement('div');
    row.textContent = (a.name || a.tool || 'action') + ' ';
    const ok = document.createElement('button');
    ok.textContent = 'Approve';
    ok.onclick = async () => { await fetch('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index: i, approve: true }) }); row.remove(); };
    const no = document.createElement('button');
    no.textContent = 'Reject';
    no.onclick = async () => { await fetch('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index: i, approve: false }) }); row.remove(); };
    row.appendChild(ok); row.appendChild(no);
    pendingEl.appendChild(row);
  });
}

async function updateMeter() {
  try {
    const r = await fetch('/api/context'); const d = await r.json();
    document.getElementById('ctxMeter').textContent = 'ctx ' + d.tokens + '/' + d.limit + (d.compacted ? ' · compacted' : '');
  } catch (e) {}
}
async function loadBackends() {
  const r = await fetch('/api/backends');
  const data = await r.json();
  backendEl.innerHTML = '';
  (data.backends || []).forEach((b) => {
    const o = document.createElement('option');
    o.value = b; o.textContent = b;
    if (b === data.current) o.selected = true;
    backendEl.appendChild(o);
  });
}
backendEl.onchange = async () => {
  await fetch('/api/backend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: backendEl.value }) });
};

document.getElementById('themeBtn').onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
};
if (localStorage.getItem('theme') === 'light') document.documentElement.setAttribute('data-theme', 'light');

const modelsPanel = document.getElementById('modelsPanel');
document.getElementById('modelsBtn').onclick = async () => {
  modelsPanel.classList.remove('hidden');
  const r = await fetch('/api/models');
  const data = await r.json();
  const list = document.getElementById('modelList');
  list.innerHTML = '';
  (data.models || []).forEach((m) => { const li = document.createElement('li'); li.textContent = m.name || m; list.appendChild(li); });
};
document.querySelectorAll('.closePanel').forEach((b) => b.onclick = () => b.parentElement.classList.add('hidden'));
function showPanel(id) {
  document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}
document.getElementById('pullBtn').onclick = async () => {
  const model = document.getElementById('modelPull').value.trim();
  if (!model) return;
  await fetch('/api/models/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
  document.getElementById('modelPull').value = '';
};

sendBtn.addEventListener('click', sendMsg);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });
document.getElementById('integrationsBtn').onclick = async () => {
  showPanel('integrationsPanel');
  const r = await fetch('/api/integrations'); const data = await r.json();
  const list = document.getElementById('integrationList'); list.innerHTML = '';
  Object.entries(data).forEach(([k, v]) => { const li = document.createElement('li'); li.textContent = k + ': ' + (v.ready ? 'ready' : 'not configured'); list.appendChild(li); });
};
document.getElementById('knowledgeBtn').onclick = async () => {
  showPanel('knowledgePanel');
  const [s, m] = await Promise.all([fetch('/api/skills'), fetch('/api/memories')]);
  const sd = await s.json(); const md = await m.json();
  const sl = document.getElementById('skillList'); sl.innerHTML = '';
  (sd.skills || []).forEach((x) => { const li = document.createElement('li'); li.textContent = x.name + ' — ' + (x.description || ''); sl.appendChild(li); });
  const ml = document.getElementById('memoryList'); ml.innerHTML = '';
  (md.memories || []).forEach((x) => { const li = document.createElement('li'); li.textContent = x.text || x.content || ''; ml.appendChild(li); });
};
document.getElementById('addSkillBtn').onclick = async () => {
  await fetch('/api/skills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('skillName').value, description: document.getElementById('skillDesc').value }) });
  document.getElementById('knowledgeBtn').click();
};
document.getElementById('addMemoryBtn').onclick = async () => {
  await fetch('/api/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: document.getElementById('memoryText').value }) });
  document.getElementById('knowledgeBtn').click();
};
document.getElementById('backupBtn').onclick = async () => {
  showPanel('backupPanel');
  const r = await fetch('/api/backup'); const data = await r.json();
  document.getElementById('importData').value = JSON.stringify(data.backup);
};
document.getElementById('exportBtn').onclick = async () => {
  const r = await fetch('/api/backup'); const data = await r.json();
  const blob = new Blob([JSON.stringify(data.backup)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aegisai-harness-backup.json'; a.click();
};
document.getElementById('importBtn').onclick = async () => {
  const data = document.getElementById('importData').value;
  try { await fetch('/api/backup/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: JSON.parse(data) }) }); } catch (e) {}
};
document.getElementById('infoBtn').onclick = async () => {
  showPanel('infoPanel');
  const [v, e] = await Promise.all([fetch('/api/version'), fetch('/api/errors')]);
  const vd = await v.json(); const ed = await e.json();
  document.getElementById('infoText').textContent = JSON.stringify(vd, null, 2);
  document.getElementById('errorText').textContent = (ed.errors || []).join('\n');
  const cfg = await (await fetch('/api/config')).json();
  document.getElementById('sttUrl').value = cfg.sttUrl || '';
  document.getElementById('ttsUrl').value = cfg.ttsUrl || '';
  const fields = document.getElementById('configFields'); fields.innerHTML = '';
  for (const key of ['BACKEND_TYPE', 'BACKEND_URL', 'AEGISAI_MODEL', 'REA_BIN', 'GHIDRA_MCP_URL', 'CRAFT_BIN']) {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<label>' + key + ' </label><input data-key="' + key + '" value="' + (cfg[key] || '').replace(/"/g, '&quot;') + '" />';
    fields.appendChild(wrap);
  }
};
document.getElementById('saveConfig').onclick = async () => {
  const body = {};
  document.querySelectorAll('#configFields input').forEach((i) => { body[i.dataset.key] = i.value; });
  await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
};
document.getElementById('saveVoice').onclick = async () => {
  await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sttUrl: document.getElementById('sttUrl').value, ttsUrl: document.getElementById('ttsUrl').value }) });
};
// Voice input/output via Web Speech API
let recognition = null;
let autoSpeak = false;
const micBtn = document.getElementById('micBtn');
const speakBtn = document.getElementById('speakBtn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    input.value = text;
    sendMsg();
  };
  recognition.onend = () => { micBtn.textContent = '🎤'; };
  micBtn.onclick = () => {
    if (recognition) { recognition.start(); micBtn.textContent = '🔴'; }
  };
} else {
  micBtn.onclick = () => { add('assistant', 'Speech recognition not supported in this browser'); };
}
speakBtn.onclick = () => {
  autoSpeak = !autoSpeak;
  speakBtn.textContent = autoSpeak ? '🔊' : '🔇';
};
function speak(text) {
  if (!autoSpeak || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(u);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
loadBackends();
updateMeter();
