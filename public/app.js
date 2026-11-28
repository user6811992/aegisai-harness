// Vendored locally so the web UI works with no internet connection.
import { h, render } from '/vendor/preact.mjs';
import { useState, useEffect, useRef, useCallback } from '/vendor/hooks.mjs';
import htm from '/vendor/htm.mjs';
const html = htm.bind(h);

// Auth token support: stored in sessionStorage, sent as Bearer on every API call.
function authToken() { try { return sessionStorage.getItem('aegisai_token') || localStorage.getItem('aegisai_token') || ''; } catch (e) { return ''; } }
function setAuthToken(t) { try { if (t) { sessionStorage.setItem('aegisai_token', t); localStorage.setItem('aegisai_token', t); } else { sessionStorage.removeItem('aegisai_token'); localStorage.removeItem('aegisai_token'); } } catch (e) {} }
function authHeaders(extra) {
  const h = Object.assign({}, extra || {});
  const t = authToken();
  if (t) h.Authorization = 'Bearer ' + t;
  return h;
}

// Central API helper: throws on non-2xx so callers cannot report false success.
async function API(p, opts) {
  const o = Object.assign({}, opts || {});
  o.headers = authHeaders(o.headers);
  const r = await fetch(p, o);
  let body = null;
  try { body = await r.json(); } catch (e) { body = null; }
  if (!r.ok) {
    if (r.status === 401) window.dispatchEvent(new CustomEvent('aegisai-unauthorized'));
    const msg = (body && body.error) || ('HTTP ' + r.status);
    throw Object.assign(new Error(msg), { status: r.status, body });
  }
  return body;
}

// Fetch wrapper for streaming + non-JSON callers.
function apiFetch(p, opts) {
  const o = Object.assign({}, opts || {});
  o.headers = authHeaders(o.headers);
  return fetch(p, o);
}

let toastFn = null;
function toast(msg, type = 'info') { if (toastFn) toastFn(msg, type); }

function escapeHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function notify(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { new Notification(title, { body, icon: '/icon-192.png' }); }
  else if (Notification.permission !== 'denied') { Notification.requestPermission().then((p) => { if (p === 'granted') new Notification(title, { body, icon: '/icon-192.png' }); }); }
}

// ---------- Components ----------

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    toastFn = (msg, type) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, msg, type, progress: null }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    };
  }, []);
  return html`
    <div class="toast-container" role="status" aria-live="polite" aria-atomic="true">
      ${toasts.map((t) => html`<div class=${'toast toast-' + t.type}>${t.msg}</div>`)}
    </div>
  `;
}

function CommandPalette({ open, onClose, commands }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);
  useEffect(() => { setSel(0); }, [q]);
  if (!open) return null;
  const filtered = commands.filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase()) || (c.keywords || '').toLowerCase().includes(q.toLowerCase()));
  return html`
    <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${onClose}>
      <div class="palette" onClick=${(e) => e.stopPropagation()}>
        <input ref=${inputRef} value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Type a command..." class="palette-input" />
        <div class="palette-list">
          ${filtered.map((c, i) => html`
            <div class=${'palette-item' + (i === sel ? ' selected' : '')} onClick=${() => { c.run(); onClose(); }} onMouseEnter=${() => setSel(i)}>
              <span class="palette-icon">${c.icon || '⚡'}</span>
              <span class="palette-label">${c.label}</span>
              ${c.shortcut ? html`<span class="palette-shortcut">${c.shortcut}</span>` : null}
            </div>
          `)}
          ${filtered.length === 0 ? html`<div class="palette-empty">No matching commands</div>` : null}
        </div>
      </div>
    </div>
  `;
}

function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [backend, setBackend] = useState('ollama');
  const [model, setModel] = useState('');
  const [token, setToken] = useState('');
  const [backendInfo, setBackendInfo] = useState(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [modelPath, setModelPath] = useState('');
  const steps = ['Welcome', 'Backend', 'Model', 'Security', 'Done'];

  async function loadBackendInfo(b) {
    setBackendInfo(null);
    try {
      const r = await apiFetch('/api/backend/setup?type=' + encodeURIComponent(b));
      if (r.ok) setBackendInfo(await r.json());
    } catch (e) {}
  }
  useEffect(() => { loadBackendInfo(backend); }, [backend]);

  async function setupBackend() {
    setSetupBusy(true);
    try {
      const body = { type: backend, install: true, start: true, confirmed: true };
      if (backend === 'llamacpp' && modelPath) body.model = modelPath;
      const r = await apiFetch('/api/backend/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || ('HTTP ' + r.status));
      toast(backend + ' is ready', 'success');
      await loadBackendInfo(backend);
    } catch (e) { toast('Backend setup failed: ' + (e && e.message ? e.message : e), 'error'); }
    finally { setSetupBusy(false); }
  }

  async function finish() {
    try {
      const body = { BACKEND_TYPE: backend };
      if (model) body.AEGISAI_MODEL = model;
      if (token) body.AEGISAI_TOKEN = token;
      const r = await apiFetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) {
        let msg = 'HTTP ' + r.status;
        try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (e) {}
        throw new Error(msg);
      }
      // Keep the UI authenticated after enabling a token.
      if (token) setAuthToken(token.trim());
    } catch (e) {
      console.error('config save failed:', e);
      toast('Setup failed: ' + (e && e.message ? e.message : e), 'error');
      return;
    }
    try { localStorage.setItem('onboarded', '1'); } catch (e) {}
    onComplete();
  }

  return html`
    <div class="onboarding">
      <div class="onboarding-card">
        <div class="onboarding-progress">
          ${steps.map((s, i) => html`<div class=${'step-dot' + (i <= step ? ' active' : '') + (i === step ? ' current' : '')}>${i + 1}</div>`)}
        </div>
        <h2>${steps[step]}</h2>
        ${step === 0 ? html`
          <p>Welcome to <strong>AegisAi Harness</strong> — a local-first, privacy-first AI agent harness.</p>
          <p>This wizard will help you set up your backend, model, and security in under a minute.</p>
        ` : null}
        ${step === 1 ? html`
          <p>Choose your AI backend:</p>
          <div class="option-grid">
            ${['ollama', 'lmstudio', 'llamacpp', 'openai'].map((b) => html`
              <button class=${'option-btn' + (backend === b ? ' selected' : '')} onClick=${() => setBackend(b)}>${b}</button>
            `)}
          </div>
          ${backendInfo ? html`
            <p class="hint">${backendInfo.running ? '✅ Running' : backendInfo.installed ? '⚠️ Installed but not running' : '❌ Not installed'} · ${backendInfo.url}</p>
            ${!backendInfo.running && backendInfo.canInstall ? html`
              <button class="btn-secondary" disabled=${setupBusy} onClick=${setupBackend}>${setupBusy ? 'Installing…' : 'Install & start ' + backend}</button>
            ` : null}
            ${!backendInfo.running && !backendInfo.canInstall && backendInfo.docs ? html`
              <p class="hint">No automatic installer for ${backend}. <a href=${backendInfo.docs} target="_blank" rel="noopener">Install instructions</a>, then return here.</p>
            ` : null}
          ` : html`<p class="hint">Checking backend status…</p>`}
          ${backend === 'llamacpp' ? html`
            <p class="hint">GGUF model path (required to start llama.cpp):</p>
            <input class="onboarding-input" value=${modelPath} onInput=${(e) => setModelPath(e.target.value)} placeholder="D:\\models\\model-q4_k_m.gguf" />
          ` : null}
          <p class="hint">Ollama is recommended for local use. You can change this later in Settings.</p>
        ` : null}
        ${step === 2 ? html`
          <p>Enter a model name (or leave blank to configure later):</p>
          <input class="onboarding-input" value=${model} onInput=${(e) => setModel(e.target.value)} placeholder="e.g. llama3.2:3b" />
          <p class="hint">Models can be pulled from the Models panel after setup.</p>
        ` : null}
        ${step === 3 ? html`
          <p>Set an auth token (recommended for security):</p>
          <input class="onboarding-input" type="password" value=${token} onInput=${(e) => setToken(e.target.value)} placeholder="Leave blank for open mode" />
          <p class="hint">In open mode, anyone on your network can access the harness. A token is strongly recommended.</p>
        ` : null}
        ${step === 4 ? html`
          <p>Setup complete! You're ready to start chatting.</p>
          <p class="hint">Use <kbd>Ctrl+K</kbd> to open the command palette anytime. Press <kbd>?</kbd> for help.</p>
        ` : null}
        <div class="onboarding-actions">
          ${step > 0 ? html`<button class="btn-secondary" onClick=${() => setStep(step - 1)}>Back</button>` : null}
          ${step < steps.length - 1
            ? html`<button class="btn-primary" onClick=${() => setStep(step + 1)}>Next</button>`
            : html`<button class="btn-primary" onClick=${finish}>Get Started</button>`}
        </div>
      </div>
    </div>
  `;
}

function HelpPanel({ onClose }) {
  const sections = [
    { title: 'Chat', items: ['Enter — send message', 'Shift+Enter — new line', 'Ctrl+K — command palette', 'Ctrl+N — new chat', 'Ctrl+, — settings', 'Ctrl+/ or ? — help'] },
    { title: 'Commands', items: ['/help — list all commands', '/clear — clear chat', '/model <name> — switch model', '/compact — compact context', '/tools — list tools', '/diff-review — review changes'] },
    { title: 'Tips', items: ['Drag & drop files to attach', 'Use /squeeze <url>|<question> to extract answers', 'Type /providers to see available backends'] },
  ];
  return html`
    <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${onClose}>
      <div class="modal help-modal" onClick=${(e) => e.stopPropagation()}>
        <h2>Help & Shortcuts</h2>
        ${sections.map((s) => html`
          <div class="help-section">
            <h3>${s.title}</h3>
            <ul>${s.items.map((i) => html`<li>${i}</li>`)}</ul>
          </div>
        `)}
        <button class="btn-primary" onClick=${onClose}>Close</button>
      </div>
    </div>
  `;
}

function ConfigModal({ cfg, setCfg, onClose }) {
  const [local, setLocal] = useState(cfg);
  const [saving, setSaving] = useState(false);
  useEffect(() => { API('/api/config').then(setLocal); }, []);
  async function save() {
    setSaving(true);
    try {
      await apiFetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(local) }).then(async (r) => {
        if (!r.ok) { let e = 'HTTP ' + r.status; try { const b = await r.json(); if (b && b.error) e = b.error; } catch (_) {} throw new Error(e); }
      });
      setCfg(local);
      toast('Configuration saved', 'success');
      onClose();
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    }
    setSaving(false);
  }
  const keys = ['BACKEND_TYPE', 'BACKEND_URL', 'AEGISAI_MODEL', 'REA_BIN', 'GHIDRA_MCP_URL', 'CRAFT_BIN', 'sttUrl', 'ttsUrl'];
  const [tab, setTab] = useState('config');
  const [models, setModels] = useState([]);
  const [scanResults, setScanResults] = useState([]);
  const [hfQuery, setHfQuery] = useState('');
  const [hfResults, setHfResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [searching, setSearching] = useState(false);
  const [scanRoot, setScanRoot] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [importText, setImportText] = useState('');

  async function loadProfiles() {
    try {
      const d = await API('/api/hardware-profile');
      setProfiles(d.profiles || []);
    } catch (e) {}
  }
  useEffect(() => { if (tab === 'hardware') loadProfiles(); }, [tab]);
  async function postProfile(body) {
    try {
      const r = await apiFetch('/api/hardware-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || ('HTTP ' + r.status));
      await loadProfiles();
      return d;
    } catch (e) { toast('Profile action failed: ' + (e && e.message ? e.message : e), 'error'); return null; }
  }

  useEffect(() => {
    if (tab === 'models') {
      API('/api/models').then((d) => setModels(d.models || [])).catch(() => {});
    }
  }, [tab]);

  async function scanDrives() {
    setScanning(true);
    try {
      const url = scanRoot ? '/api/models/scan?roots=' + encodeURIComponent(scanRoot) : '/api/models/scan';
      const d = await API(url);
      setScanResults(d.models || []);
      toast('Found ' + (d.models || []).length + ' models', 'success');
    } catch (e) { toast('Scan failed: ' + e.message, 'error'); }
    setScanning(false);
  }

  async function searchHF() {
    if (!hfQuery.trim()) return;
    setSearching(true);
    try {
      const d = await API('/api/models/hf-search?q=' + encodeURIComponent(hfQuery));
      setHfResults(d.results || []);
      toast('Found ' + (d.results || []).length + ' models', 'info');
    } catch (e) { toast('Search failed: ' + e.message, 'error'); }
    setSearching(false);
  }

  async function pullModel(name) {
    toast('Pulling ' + name + '...', 'info');
    try {
      const r = await apiFetch('/api/models/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: name }) });
      const d = await r.json();
      if (d.ok) toast('Pulled ' + name + ' successfully', 'success');
      else toast('Pull failed: ' + (d.error || 'unknown'), 'error');
      const m = await API('/api/models');
      setModels(m.models || []);
    } catch (e) { toast('Pull failed: ' + e.message, 'error'); }
  }

  return html`
    <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${onClose}>
      <div class="modal" style="max-width: 700px" onClick=${(e) => e.stopPropagation()}>
        <h2>Configuration & Models</h2>
        <div class="tab-bar">
          <button class=${'tab' + (tab === 'config' ? ' active' : '')} onClick=${() => setTab('config')}>Config</button>
          <button class=${'tab' + (tab === 'models' ? ' active' : '')} onClick=${() => setTab('models')}>Models</button>
          <button class=${'tab' + (tab === 'discover' ? ' active' : '')} onClick=${() => setTab('discover')}>Discover</button>
          <button class=${'tab' + (tab === 'hardware' ? ' active' : '')} onClick=${() => setTab('hardware')}>Hardware</button>
        </div>
        ${tab === 'config' ? html`
          ${keys.map((k) => html`
            <label>${k}
              <input value=${local[k] || ''} onInput=${(e) => setLocal({ ...local, [k]: e.target.value })} />
            </label>
          `)}
        ` : null}
        ${tab === 'models' ? html`
          <div class="model-list">
            <h3>Installed Models</h3>
            ${models.length === 0 ? html`<p class="hint">No models found. Start Ollama and refresh.</p>` : null}
            ${models.map((m) => html`
              <div class="model-item">
                <span class="model-name">${m.name || m}</span>
                <button class="btn-sm" onClick=${async () => {
                  const selected = m.name || m;
                  setLocal({ ...local, AEGISAI_MODEL: selected });
                  try {
                    const r = await apiFetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ AEGISAI_MODEL: selected }) });
                    if (!r.ok) {
                      let msg = 'HTTP ' + r.status;
                      try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (e) {}
                      throw new Error(msg);
                    }
                    setCfg({ ...cfg, AEGISAI_MODEL: selected });
                    toast('Selected ' + selected, 'success');
                  } catch (e) { toast('Failed to set model: ' + e.message, 'error'); }
                }}>Use</button>
              </div>
            `)}
            <button class="btn-secondary" onClick=${() => API('/api/models').then((d) => setModels(d.models || []))}>Refresh</button>
          </div>
        ` : null}
        ${tab === 'hardware' ? html`
          <div class="discover-section">
            <h3>Hardware Profiles</h3>
            <p class="hint">Profiles are local JSON files under <code>data/profiles</code>. The active profile is applied at startup.</p>
            <button class="btn-secondary" onClick=${async () => {
              const s = await postProfile({ action: 'suggest' });
              if (s && s.profile) {
                const saved = await postProfile({ action: 'save', name: s.profile.name, profile: s.profile });
                if (saved) toast('Saved ' + s.profile.name, 'success');
              }
            }}>Suggest from hardware</button>
            ${profiles.length === 0 ? html`<p class="hint">No profiles saved yet.</p>` : null}
            ${profiles.map((p) => html`
              <div class="model-item">
                <span class="model-name">${p.name}${p.active ? ' (active)' : ''}</span>
                <span class="hint">${p.engine || p.backendType || ''} ${p.quant || ''} ${p.context || ''}</span>
                <button class="btn-sm" onClick=${() => postProfile({ action: 'apply', name: p.name })}>Apply</button>
                <button class="btn-sm" onClick=${() => postProfile({ action: 'remove', name: p.name })}>Delete</button>
              </div>
            `)}
            <h3>Import a shared profile</h3>
            <textarea rows="4" style="width:100%" value=${importText} onInput=${(e) => setImportText(e.target.value)} placeholder="Paste profile JSON"></textarea>
            <button class="btn-secondary" onClick=${() => postProfile({ action: 'import', json: importText })}>Import</button>
          </div>
        ` : null}
        ${tab === 'discover' ? html`
          <div class="discover-section">
            <h3>Scan for Local Models</h3>
            <p class="hint">Active backend: <strong>${cfg.BACKEND_TYPE || 'auto'}</strong>. Scan drives and directories for model files compatible with your backend.</p>
            <div class="search-bar">
              <input value=${scanRoot} onInput=${(e) => setScanRoot(e.target.value)} placeholder="Leave empty for default roots, or enter a path (e.g. D:\\models)" style="flex:1" />
              <button class="btn-primary" onClick=${scanDrives} disabled=${scanning}>${scanning ? 'Scanning...' : 'Scan'}</button>
            </div>
            ${scanResults.length > 0 ? html`
              <div class="scan-results">
                <p class="hint">Found ${scanResults.length} models</p>
                ${scanResults.slice(0, 30).map((m) => html`
                  <div class="scan-item">
                    <span class="model-name">${m.name}</span>
                    <span class="hint">${m.sizeGB > 0 ? m.sizeGB + ' GB' : ''} ${m.type ? '[' + m.type + ']' : ''}</span>
                    ${m.type !== 'ollama' && m.path && !m.path.startsWith('ollama://') ? html`<button class="btn-sm" onClick=${() => { setLocal({ ...local, AEGISAI_MODEL: m.path }); toast('Selected ' + m.name, 'info'); }}>Use</button>` : null}
                  </div>
                `)}
              </div>
            ` : html`<p class="hint">No models found. Try scanning a specific directory or changing the backend.</p>`}
            <h3 style="margin-top: 16px">Search HuggingFace</h3>
            <p class="hint">Search HuggingFace for GGUF models. Try terms like "llama", "mistral", "phi", "gemma".</p>
            <div class="search-bar">
              <input value=${hfQuery} onInput=${(e) => setHfQuery(e.target.value)} placeholder="e.g. llama, mistral, phi, gemma" style="flex:1" onKeyDown=${(e) => { if (e.key === 'Enter') searchHF(); }} />
              <button class="btn-primary" onClick=${searchHF} disabled=${searching}>${searching ? 'Searching...' : 'Search'}</button>
            </div>
            ${hfResults.length > 0 ? html`
              <div class="hf-results">
                <p class="hint">Found ${hfResults.length} models</p>
                ${hfResults.map((m) => html`
                  <div class="hf-item">
                    <span class="model-name">${m.id}</span>
                    <span class="hint">${(m.downloads || 0).toLocaleString()} downloads ${m.isGguf ? '✓ GGUF' : ''}</span>
                    <button class="btn-sm" onClick=${() => pullModel(m.id)}>Pull</button>
                  </div>
                `)}
              </div>
            ` : null}
            ${hfResults.length === 0 && hfQuery && !searching ? html`<p class="hint">No results found. Try a broader search term like "llama", "mistral", or "phi".</p>` : null}
          </div>
        ` : null}
        <div class="modal-actions">
          <button class="btn-primary" onClick=${save} disabled=${saving}>${saving ? 'Saving...' : 'Save'}</button>
          <button onClick=${onClose}>Close</button>
        </div>
      </div>
    </div>
  `;
}

function SessionSidebar({ open, onClose, onSelect }) {
  const [sessions, setSessions] = useState([]);
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [tagDraft, setTagDraft] = useState({});
  const load = () => API('/api/sessions').then((d) => setSessions(d.sessions || [])).catch(() => {});
  useEffect(() => { if (open) load(); }, [open]);
  const allTags = Array.from(new Set(sessions.flatMap((s) => s.tags || []))).sort();
  const filtered = sessions.filter((s) => {
    const text = ((s.title || '') + ' ' + (s.id || '')).toLowerCase();
    const matchesQ = !q || text.includes(q.toLowerCase());
    const matchesTag = !tagFilter || (s.tags || []).includes(tagFilter);
    return matchesQ && matchesTag;
  });
  async function saveTags(s) {
    const raw = tagDraft[s.id];
    if (raw == null) return;
    const tags = raw.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      await API('/api/sessions/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, tags }) });
      toast('Tags saved', 'success');
      setTagDraft((d) => { const n = Object.assign({}, d); delete n[s.id]; return n; });
      load();
    } catch (e) { toast('Tag save failed: ' + e.message, 'error'); }
  }
  if (!open) return null;
  return html`
    <div class="sidebar">
      <div class="sidebar-header">
        <h3>Sessions</h3>
        <label class="btn-sm" style="cursor:pointer;margin-right:4px">
          Import
          <input type="file" accept=".json" style="display:none" onChange=${async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
              try {
                const data = JSON.parse(String(ev.target.result || '{}'));
                const sess = data.session || data;
                if (!sess.id) { toast('Invalid session file', 'error'); return; }
                await API('/api/sessions/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: sess }) });
                toast('Session imported: ' + sess.id, 'success');
                load();
              } catch (err) { toast('Import failed: ' + err.message, 'error'); }
            };
            reader.readAsText(file);
            e.target.value = '';
          }} />
        </label>
        <button class="sidebar-close" onClick=${onClose}>×</button>
      </div>
      <input class="sidebar-search" value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Search sessions..." />
      ${allTags.length ? html`
        <div class="tag-filter">
          <span class=${'tag-pill' + (tagFilter === '' ? ' active' : '')} onClick=${() => setTagFilter('')}>all</span>
          ${allTags.map((t) => html`<span class=${'tag-pill' + (tagFilter === t ? ' active' : '')} onClick=${() => setTagFilter(tagFilter === t ? '' : t)}>${t}</span>`)}
        </div>
      ` : null}
      <div class="sidebar-list">
        ${filtered.map((s) => html`
          <div class="session-item">
            <div class="session-title" onClick=${() => { onSelect(s); onClose(); }}>${s.title || s.id}</div>
            <div class="session-meta">${s.updated || ''}</div>
            <div class="session-tags">
              ${(s.tags || []).map((t) => html`<span class="tag-pill small">${t}</span>`)}
              <input
                class="tag-input"
                placeholder="+ tags (comma sep)"
                value=${tagDraft[s.id] != null ? tagDraft[s.id] : (s.tags || []).join(', ')}
                onInput=${(e) => setTagDraft((d) => Object.assign({}, d, { [s.id]: e.target.value }))}
                onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); saveTags(s); } }}
              />
            </div>
          </div>
        `)}
        ${filtered.length === 0 ? html`<div class="sidebar-empty">No sessions found</div>` : null}
      </div>
    </div>
  `;
}

// Word-level diff render: additions highlighted, deletions struck through.
function DiffText({ a, b }) {
  const tok = (s) => String(s || '').split(/(\s+)/).filter((t) => t !== '');
  const A = tok(a).slice(0, 3000);
  const B = tok(b).slice(0, 3000);
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0, key = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push(html`<span key=${key++}>${A[i]}</span>`); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(html`<del key=${key++}>${A[i]}</del>`); i++; }
    else { out.push(html`<ins key=${key++}>${B[j]}</ins>`); j++; }
  }
  while (i < n) out.push(html`<del key=${key++}>${A[i++]}</del>`);
  while (j < m) out.push(html`<ins key=${key++}>${B[j++]}</ins>`);
  return html`<pre class="compare-pre diff">${out}</pre>`;
}

function ToolTimeline({ tools }) {
  if (!tools || tools.length === 0) return null;
  return html`
    <div class="tool-timeline">
      ${tools.map((t) => html`
        <div class="tool-entry">
          <span class="tool-name">${t.name}</span>
          <span class="tool-status ${t.ok ? 'ok' : 'err'}">${t.ok ? '✓' : '✗'}</span>
          ${t.duration ? html`<span class="tool-duration">${t.duration}ms</span>` : null}
        </div>
      `)}
    </div>
  `;
}

function highlightSearch(text, query) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const q = String(query || '').trim();
  const escaped = esc(text);
  if (!q) return escaped;
  const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try { return escaped.replace(new RegExp(safeQ, 'gi'), (m) => '<mark class="search-highlight">' + m + '</mark>'); }
  catch (e) { return escaped; }
}
function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [currentSession, setCurrentSession] = useState('default');
  const [promptHistory, setPromptHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [ctx, setCtx] = useState({ tokens: 0, limit: 8192 });
  const [showConfig, setShowConfig] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [cfg, setCfg] = useState({});
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const THEMES = ['dark', 'light', 'high-contrast', 'solarized'];
  const [view, setView] = useState(localStorage.getItem('onboarded') ? 'chat' : 'onboarding');
  const [toolLog, setToolLog] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachPreview, setAttachPreview] = useState(null);
  const [fileEditor, setFileEditor] = useState(null);
  const [showBlame, setShowBlame] = useState(false);
  const [blameData, setBlameData] = useState(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const inputRef = useRef(null);
  const chatRef = useRef(null);

  // Apply theme to document for CSS variable switching
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const d = await API('/api/sessions?id=' + encodeURIComponent('default'));
        if (d && Array.isArray(d.messages)) {
          setMessages((d.messages || []).map((m) => ({ role: m.role, content: m.content })));
        }
      } catch (e) {}
      updateCtx('default');
    })();
  }, []);
  useEffect(() => {
    // Server rejected our request: prompt for a token instead of failing silently.
    const onUnauth = () => setNeedAuth(true);
    window.addEventListener('aegisai-unauthorized', onUnauth);
    return () => window.removeEventListener('aegisai-unauthorized', onUnauth);
  }, []);
  useEffect(() => {
    API('/api/version').then((v) => {
      if (v && v.updateAvailable) toast('Update available: v' + (v.latest || '') + ' (current ' + (v.current || '') + ')', 'info');
    }).catch((e) => { if (e && e.status === 401) setNeedAuth(true); });
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowPalette(true); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); newChat(); }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); setShowConfig(true); }
      if (e.key === '/' && e.ctrlKey) { e.preventDefault(); setShowHelp(true); }
      if (e.key === 'Escape') { setShowConfig(false); setShowHelp(false); setShowPalette(false); setShowSessions(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowSearch(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Drag and drop
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      if (e.type === 'dragover') setDragOver(true);
      if (e.type === 'dragleave') setDragOver(false);
      if (e.type === 'drop') {
        setDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length) {
          Array.from(files).forEach((f) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const content = String(ev.target.result || '').slice(0, 2000);
              const id = 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
              setAttachments((prev) => [...prev, { id, name: f.name, size: f.size, content }]);
              toast('Attached ' + f.name, 'info');
            };
            reader.readAsText(f);
          });
        }
      }
    };
    window.addEventListener('dragover', handler);
    window.addEventListener('dragleave', handler);
    window.addEventListener('drop', handler);
    return () => {
      window.removeEventListener('dragover', handler);
      window.removeEventListener('dragleave', handler);
      window.removeEventListener('drop', handler);
    };
  }, []);

  async function updateCtx() {
    try { const d = await API('/api/context?session=' + encodeURIComponent(currentSession)); setCtx(d); } catch (e) {}
  }

  function newChat() {
    const newId = 'sess_' + Date.now();
    setCurrentSession(newId);
    setMessages([]);
    setToolLog([]);
    toast('New chat started', 'info');
  }

  async function send() {
    if ((!input.trim() && attachments.length === 0) || loading) return;
    let text = input;
    if (attachments.length) {
      const parts = attachments.map((a) => '[File: ' + a.name + ']\n' + a.content);
      text = (text ? text + '\n\n' : '') + parts.join('\n\n');
    }
    const displayText = input || (attachments.length ? '(attached ' + attachments.map((a) => a.name).join(', ') + ')' : '');
    setInput('');
    setAttachments([]);
    setHistoryIdx(-1);
    if (input.trim()) setPromptHistory((h) => [...h.slice(-49), input.trim()]);
    setMessages((m) => [...m, { role: 'user', content: displayText }]);
    setLoading(true);
    setToolLog([]);
    // Add empty assistant message for streaming
    setMessages((m) => [...m, { role: 'assistant', content: '' }]);
    try {
      const r = await apiFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, stream: true, sessionId: currentSession }) });
      if (r.status === 401) { window.dispatchEvent(new CustomEvent('aegisai-unauthorized')); throw new Error('unauthorized'); }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullReply = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'token') {
              fullReply += data.content;
              setMessages((m) => {
                const updated = [...m];
                updated[updated.length - 1] = { role: 'assistant', content: fullReply };
                return updated;
              });
            } else if (data.type === 'tool_call') {
              toast('Tool: ' + data.name, 'info');
            } else if (data.type === 'error') {
              throw new Error(data.message || 'stream error');
            } else if (data.type === 'done') {
              if (data.toolLog) setToolLog(data.toolLog);
              // Always apply the authoritative reply from the server.
              if (data.reply) {
                fullReply = data.reply;
                setMessages((m) => {
                  const updated = [...m];
                  if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                    updated[updated.length - 1] = { role: 'assistant', content: fullReply };
                  } else {
                    updated.push({ role: 'assistant', content: fullReply });
                  }
                  return updated;
                });
              }
              // Surface an empty response as an error instead of a blank bubble.
              if (!fullReply) {
                const msg = 'No response received. The model may be unavailable — check `ollama list` and the configured model name.';
                setMessages((m) => {
                  const updated = [...m];
                  updated[updated.length - 1] = { role: 'assistant', content: '⚠️ ' + msg };
                  return updated;
                });
                toast(msg, 'error');
              } else {
                updateCtx();
                toast('Response received', 'success');
              }
            }
          } catch (e) { if (e && e.message && e.message !== 'Unexpected end of JSON input') throw e; }
        }
      }
    } catch (e) {
      setMessages((m) => {
        const updated = [...m];
        if (updated.length > 0 && updated[updated.length - 1].role === 'assistant' && !updated[updated.length - 1].content) {
          updated[updated.length - 1] = { role: 'assistant', content: 'Error: ' + e.message };
        } else {
          updated.push({ role: 'assistant', content: 'Error: ' + e.message });
        }
        return updated;
      });
      toast('Error: ' + e.message, 'error');
    } finally { setLoading(false); }
  }

  const commands = [
    { icon: '💬', label: 'New Chat', keywords: 'new chat clear', shortcut: 'Ctrl+N', run: () => { newChat(); } },
    { icon: '📂', label: 'Sessions', keywords: 'sessions history', shortcut: 'Ctrl+B', run: () => setShowSessions(true) },
    { icon: '⚙️', label: 'Settings', keywords: 'config settings', shortcut: 'Ctrl+,', run: () => setShowConfig(true) },
    { icon: '❓', label: 'Help', keywords: 'help shortcuts', shortcut: 'Ctrl+/', run: () => setShowHelp(true) },
    { icon: '🎨', label: 'Toggle Theme', keywords: 'theme dark light', run: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    { icon: '🗑️', label: 'Clear Chat', keywords: 'clear reset', run: () => { setMessages([]); setToolLog([]); toast('Chat cleared', 'info'); } },
    { icon: '📊', label: 'Context Info', keywords: 'context tokens', run: () => toast('Context: ' + ctx.tokens + '/' + ctx.limit, 'info') },
    { icon: '🔧', label: 'Tools', keywords: 'tools list', run: () => toast('64+ tools available', 'info') },
    { icon: '📤', label: 'Export Chat', keywords: 'export markdown json', run: () => exportChat('markdown') },
    { icon: '⚖️', label: 'Compare Models', keywords: 'compare models', run: () => setShowCompare(true) },
  ];

  const [showFiles, setShowFiles] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [fileDir, setFileDir] = useState('');
  const [fileEntries, setFileEntries] = useState([]);
  const [fileContent, setFileContent] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [showWebhooks, setShowWebhooks] = useState(false);
  const [webhookEvent, setWebhookEvent] = useState('push');
  const [webhookPayload, setWebhookPayload] = useState('{}');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookResult, setWebhookResult] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showScheduled, setShowScheduled] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [schedForm, setSchedForm] = useState({ name: '', cron: 'every 5m', prompt: '', model: '' });
  const [showPerf, setShowPerf] = useState(false);
  const [perfReport, setPerfReport] = useState(null);
  const [snippets, setSnippets] = useState([]);
  const [snippetSearch, setSnippetSearch] = useState('');
  const [snippetForm, setSnippetForm] = useState({ name: '', language: 'javascript', code: '', description: '' });
  const [showSandbox, setShowSandbox] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [sandboxCode, setSandboxCode] = useState('');
  const [sandboxLang, setSandboxLang] = useState('python');
  const [sandboxResult, setSandboxResult] = useState(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [compareModels, setCompareModels] = useState('');
  const [comparePrompt, setComparePrompt] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [compareDiff, setCompareDiff] = useState(false);

  // Focus management: move focus to first focusable element in modals.
  useEffect(() => {
    const modal = document.querySelector('.modal');
    if (modal) {
      const focusable = modal.querySelectorAll('button, input, textarea, select, a[href]');
      if (focusable.length > 0) setTimeout(() => focusable[0].focus(), 50);
      // Focus trap: Tab cycles within modal.
      const trap = (e) => {
        if (e.key !== 'Tab') return;
        const els = modal.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]');
        if (els.length === 0) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      };
      modal.addEventListener('keydown', trap);
      return () => modal.removeEventListener('keydown', trap);
    }
  }, [showCompare, showSnippets, showSandbox, showWebhooks, showScheduled, showPerf, showSearch, showFiles, showHelp, showConfig, showPalette]);

  async function exportChat(format) {
    try {
      const r = await apiFetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format, title: 'Chat Export' }) });
      const d = await r.json();
      if (d.ok) toast('Exported to ' + d.path, 'success');
      else toast('Export failed: ' + (d.error || 'unknown'), 'error');
    } catch (e) { toast('Export failed: ' + e.message, 'error'); }
  }

  async function loadFiles(dir) {
    try {
      const d = await API('/api/files?dir=' + encodeURIComponent(dir || ''));
      setFileDir(d.dir || dir);
      setFileEntries(d.entries || []);
    } catch (e) { toast('Failed to load files: ' + e.message, 'error'); }
  }

  async function searchConversations() {
    if (!searchQuery.trim()) return;
    try {
      const d = await API('/api/search-sessions?q=' + encodeURIComponent(searchQuery));
      setSearchResults(d.results || []);
    } catch (e) { toast('Search failed: ' + e.message, 'error'); }
  }

  async function openFile(filePath) {
    try {
      const d = await API('/api/file?path=' + encodeURIComponent(filePath));
      setSelectedFile(filePath);
      setFileContent(d.content || '');
    } catch (e) { toast('Failed to read file: ' + e.message, 'error'); }
  }

  async function openInEditor(filePath) {
    try {
      const d = await API('/api/file?path=' + encodeURIComponent(filePath));
      setFileEditor({ path: filePath, content: d.content || '', dirty: false });
      setShowFiles(false);
      toast('Opened in editor', 'info');
    } catch (e) { toast('Open failed: ' + e.message, 'error'); }
  }

  async function saveEditor() {
    if (!fileEditor) return;
    try {
      await API('/api/file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: fileEditor.path, content: fileEditor.content }) });
      setFileEditor(Object.assign({}, fileEditor, { dirty: false }));
      toast('Saved ' + fileEditor.path.split(/[\\/]/).pop(), 'success');
    } catch (e) { toast('Save failed: ' + e.message, 'error'); }
  }

  async function loadSnippets() {
    try { const r = await API('/api/snippets'); setSnippets(r.snippets || []); }
    catch (e) { toast('Failed to load snippets: ' + e.message, 'error'); }
  }
  async function saveSnippet() {
    try {
      await API('/api/snippets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snippetForm) });
      toast('Snippet saved', 'success');
      setSnippetForm({ name: '', language: 'javascript', code: '', description: '' });
      loadSnippets();
    } catch (e) { toast('Save failed: ' + e.message, 'error'); }
  }
  async function loadScheduled() {
    try { const r = await API('/api/scheduled-tasks'); setScheduledTasks(r.tasks || []); }
    catch (e) { toast('Failed to load scheduled tasks: ' + e.message, 'error'); }
  }
  async function loadPerf() {
    try { const r = await API('/api/profile'); setPerfReport(r); }
    catch (e) { toast('Failed to load perf: ' + e.message, 'error'); }
  }
  async function createScheduled() {
    try {
      await API('/api/scheduled-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schedForm) });
      toast('Scheduled task created', 'success');
      setSchedForm({ name: '', cron: 'every 5m', prompt: '', model: '' });
      loadScheduled();
    } catch (e) { toast('Create failed: ' + e.message, 'error'); }
  }
  async function deleteScheduled(id) {
    try { await API('/api/scheduled-tasks?id=' + encodeURIComponent(id), { method: 'DELETE' }); toast('Deleted', 'success'); loadScheduled(); }
    catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }
  async function triggerWebhook() {
    try {
      const payload = JSON.parse(webhookPayload || '{}');
      const body = JSON.stringify(payload);
      const headers = { 'Content-Type': 'application/json' };
      if (webhookSecret) {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', enc.encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body));
        const hex = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
        headers['X-Hub-Signature-256'] = 'sha256=' + hex;
      }
      const r = await API('/api/webhook?event=' + encodeURIComponent(webhookEvent), { method: 'POST', headers, body });
      setWebhookResult(r);
      toast('Webhook triggered', 'success');
    } catch (e) { toast('Webhook failed: ' + e.message, 'error'); }
  }
  async function deleteSnippet(id) {
    try { await API('/api/snippets?id=' + encodeURIComponent(id), { method: 'DELETE' }); toast('Snippet deleted', 'success'); loadSnippets(); }
    catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }
  async function runSandbox() {
    if (!sandboxCode.trim()) { toast('Enter code first', 'error'); return; }
    setSandboxRunning(true); setSandboxResult(null);
    try {
      const r = await API('/api/sandbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: sandboxCode, language: sandboxLang }) });
      setSandboxResult(r);
    } catch (e) { toast('Sandbox failed: ' + e.message, 'error'); }
    finally { setSandboxRunning(false); }
  }
  async function runCompare() {
    if (!comparePrompt.trim() || !compareModels.trim()) { toast('Enter a prompt and models', 'error'); return; }
    setComparing(true);
    try {
      const models = compareModels.split(',').map((m) => m.trim()).filter(Boolean);
      const r = await apiFetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: comparePrompt, models }) });
      const d = await r.json();
      setCompareResult(d);
      toast('Comparison complete', 'success');
    } catch (e) { toast('Compare failed: ' + e.message, 'error'); }
    setComparing(false);
  }

  if (view === 'onboarding') {
    return html`
      <div class="app" data-theme=${theme}>
        <${ToastContainer} />
        ${needAuth ? html`
          <div class="modal-backdrop">
            <div class="modal" onClick=${(e) => e.stopPropagation()}>
              <h2>Authentication Required</h2>
              <p>The server requires an access token. Enter it below.</p>
              <input type="password" value=${tokenInput} onInput=${(e) => setTokenInput(e.target.value)} placeholder="Access token" style="width:100%" />
              <div class="modal-actions">
                <button class="btn-primary" onClick=${() => { setAuthToken(tokenInput.trim()); setNeedAuth(false); setTokenInput(''); toast('Token set', 'success'); updateCtx(); }}>Use Token</button>
              </div>
            </div>
          </div>
        ` : null}
        <${OnboardingWizard} onComplete=${() => { setNeedAuth(false); setView('chat'); updateCtx(); }} />
      </div>
    `;
  }

  return html`
    <div class="app" data-theme=${theme} role="application" aria-label="AegisAi Harness">
      <${ToastContainer} />
      <${CommandPalette} open=${showPalette} onClose=${() => setShowPalette(false)} commands=${commands} />
      ${showConfig ? html`<${ConfigModal} cfg=${cfg} setCfg=${setCfg} onClose=${() => setShowConfig(false)} />` : null}
      ${showHelp ? html`<${HelpPanel} onClose=${() => setShowHelp(false)} />` : null}
      ${needAuth ? html`
        <div class="modal-backdrop">
          <div class="modal" onClick=${(e) => e.stopPropagation()}>
            <h2>Authentication Required</h2>
            <p>The server requires an access token. Enter it below (stored in this browser session only).</p>
            <input type="password" value=${tokenInput} onInput=${(e) => setTokenInput(e.target.value)} placeholder="Access token" style="width:100%" />
            <div class="modal-actions">
              <button class="btn-primary" onClick=${() => { setAuthToken(tokenInput.trim()); setNeedAuth(false); setTokenInput(''); toast('Token set', 'success'); updateCtx(); }}>Use Token</button>
            </div>
          </div>
        </div>
      ` : null}
      ${showShortcuts ? html`        <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${() => setShowShortcuts(false)}>
          <div class="modal" onClick=${(e) => e.stopPropagation()}>
            <h2>Keyboard Shortcuts</h2>
            <div class="shortcuts-list">
              <div class="shortcut-item"><kbd>Ctrl+K</kbd> <span>Command palette</span></div>
              <div class="shortcut-item"><kbd>Ctrl+N</kbd> <span>New chat</span></div>
              <div class="shortcut-item"><kbd>Ctrl+B</kbd> <span>Toggle sessions</span></div>
              <div class="shortcut-item"><kbd>Ctrl+,</kbd> <span>Settings</span></div>
              <div class="shortcut-item"><kbd>Ctrl+/</kbd> <span>Help</span></div>
              <div class="shortcut-item"><kbd>Ctrl+Shift+F</kbd> <span>Search conversations</span></div>
              <div class="shortcut-item"><kbd>Ctrl+Shift+E</kbd> <span>Export chat</span></div>
              <div class="shortcut-item"><kbd>Ctrl+Shift+C</kbd> <span>Compare models</span></div>
              <div class="shortcut-item"><kbd>Ctrl+Shift+T</kbd> <span>Cycle theme</span></div>
              <div class="shortcut-item"><kbd>Esc</kbd> <span>Close modals</span></div>
              <div class="shortcut-item"><kbd>Enter</kbd> <span>Send message</span></div>
              <div class="shortcut-item"><kbd>Shift+Enter</kbd> <span>New line in input</span></div>
            </div>
            <div class="modal-actions">
              <button onClick=${() => setShowShortcuts(false)}>Close</button>
            </div>
          </div>
        </div>
      ` : null}
      ${showSearch ? html`
        <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${() => setShowSearch(false)}>
          <div class="modal" style="max-width: 600px" onClick=${(e) => e.stopPropagation()}>
            <h2>Search Conversations</h2>
            <div class="search-bar">
              <input value=${searchQuery} onInput=${(e) => setSearchQuery(e.target.value)} placeholder="Search messages..." style="flex:1" onKeyDown=${(e) => { if (e.key === 'Enter') searchConversations(); }} />
              <button class="btn-primary" onClick=${searchConversations}>Search</button>
            </div>
            ${searchResults.length > 0 ? html`
              <div class="search-results">
                ${searchResults.map((r) => html`
                  <div class="search-result-item" onClick=${async () => {
                    try {
                      const d = await API('/api/sessions?id=' + encodeURIComponent(r.sessionId));
                      setCurrentSession(r.sessionId);
                      setMessages((d.messages || []).map((m) => ({ role: m.role, content: m.content })));
                      updateCtx(r.sessionId);
                      setShowSearch(false);
                      toast('Loaded session: ' + r.sessionId, 'success');
                    } catch (e) { toast('Load failed: ' + e.message, 'error'); }
                  }}>
                    <span class="search-role">${r.role}</span>
                    <span class="search-snippet" dangerouslySetInnerHTML=${{ __html: highlightSearch(r.snippet, searchQuery) }}></span>
                    <span class="search-session">${r.sessionId}</span>
                  </div>
                `)}
              </div>
            ` : searchQuery ? html`<p class="hint">No results found.</p>` : null}
            <div class="modal-actions">
              <button onClick=${() => setShowSearch(false)}>Close</button>
            </div>
          </div>
        </div>
      ` : null}
      ${showFiles ? html`
        <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${() => setShowFiles(false)}>
          <div class="modal" style="max-width: 800px; max-height: 80vh" onClick=${(e) => e.stopPropagation()}>
            <h2>File Browser</h2>
            <p class="hint">${fileDir}</p>
            <div class="file-browser">
              <div class="file-list">
                ${fileEntries.map((e) => html`
                  <div class=${'file-item' + (e.type === 'dir' ? ' dir' : '')} onClick=${() => e.type === 'dir' ? loadFiles(e.path) : openFile(e.path)}>
                    <span class="file-icon">${e.type === 'dir' ? '📁' : '📄'}</span>
                    <span class="file-name">${e.name}</span>
                    ${e.type === 'file' ? html`<span class="file-size">${e.size > 1024 ? (e.size / 1024).toFixed(1) + ' KB' : e.size + ' B'}</span>` : null}
                  </div>
                `)}
              </div>
              ${selectedFile ? html`
                <div class="file-preview">
                  <div class="file-preview-head">
                    <h3>${selectedFile.split(/[\\/]/).pop()}</h3>
                    <button class="btn-sm" onClick=${() => openInEditor(selectedFile)}>Open in editor</button>
                  </div>
                  <pre class="file-content">${fileContent.slice(0, 5000)}</pre>
                </div>
              ` : null}
            </div>
            <div class="modal-actions">
              <button onClick=${() => setShowFiles(false)}>Close</button>
            </div>
          </div>
        </div>
      ` : null}
      ${showCompare ? html`
        <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${() => setShowCompare(false)}>
          <div class="modal" style="max-width: 800px" onClick=${(e) => e.stopPropagation()}>
            <h2>Compare Models</h2>
            <label>Prompt
              <textarea value=${comparePrompt} onInput=${(e) => setComparePrompt(e.target.value)} placeholder="Enter a prompt to compare..." rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--input);color:var(--fg)" />
            </label>
            <label>Models (comma-separated)
              <input value=${compareModels} onInput=${(e) => setCompareModels(e.target.value)} placeholder="e.g. llama3.2:3b, mistral, phi3:mini" />
            </label>
            <div class="modal-actions">
              <button class="btn-primary" onClick=${runCompare} disabled=${comparing}>${comparing ? 'Comparing...' : 'Compare'}</button>
              <button onClick=${() => setShowCompare(false)}>Close</button>
            </div>
            ${compareResult ? html`
              <div class="compare-summary">
                ${compareResult.analysis ? html`<span class="hint">Agreement: ${(compareResult.analysis.agreement == null ? 'n/a' : (compareResult.analysis.agreement * 100).toFixed(1) + '%')}</span>` : null}
                <span class="hint">Fastest: ${compareResult.comparison.fastest || 'n/a'}</span>
                <span class="hint">Shortest: ${compareResult.comparison.shortest || 'n/a'}</span>
                <span class="hint">Longest: ${compareResult.comparison.longest || 'n/a'}</span>
              </div>
              <div class=${'compare-grid' + (compareDiff ? ' with-diff' : '')}>
                ${compareResult.comparison.results.map((r, i) => html`
                  <div class="compare-col">
                    <div class="compare-head">
                      <strong>${r.model}</strong>
                      <span class="compare-badge ${r.ok ? 'ok' : 'err'}">${r.ok ? r.duration + 'ms' : 'error'}</span>
                    </div>
                    <div class="compare-body">
                      ${r.ok ? (compareDiff && i > 0
                        ? html`<${DiffText} a=${compareResult.comparison.results[0].reply} b=${r.reply} />`
                        : html`<pre class="compare-pre">${r.reply.slice(0, 2000)}</pre>`) : html`<pre class="compare-pre err">${r.error}</pre>`}
                    </div>
                  </div>
                `)}
              </div>
              <div class="modal-actions">
                <button class="btn-secondary" onClick=${() => setCompareDiff((v) => !v)}>${compareDiff ? 'Hide diff' : 'Show diff vs first'}</button>
              </div>
              <div class="compare-metrics">
                <table class="md-table">
                  <thead><tr><th>Metric</th>${compareResult.comparison.results.map((r) => html`<th>${r.model}</th>`)}</tr></thead>
                  <tbody>
                    <tr><td>Duration (ms)</td>${compareResult.comparison.results.map((r) => html`<td>${r.ok ? r.duration : 'err'}</td>`)}</tr>
                    <tr><td>Reply length</td>${compareResult.comparison.results.map((r) => html`<td>${r.ok ? r.reply.length : 0}</td>`)}</tr>
                    <tr><td>Status</td>${compareResult.comparison.results.map((r) => html`<td class=${r.ok ? 'ok' : 'err'}>${r.ok ? '✓' : '✗'}</td>`)}</tr>
                  </tbody>
                </table>
                <div class="compare-chart">
                  ${compareResult.comparison.results.map((r, i) => {
                    const maxDur = Math.max(...compareResult.comparison.results.map((x) => x.ok ? x.duration : 0));
                    const pct = maxDur > 0 ? (r.ok ? (r.duration / maxDur * 100) : 0) : 0;
                    return html`<div class="chart-bar">
                      <span class="chart-label">${r.model}</span>
                      <div class="chart-track"><div class="chart-fill" style="width:${pct}%"></div></div>
                      <span class="chart-value">${r.ok ? r.duration + 'ms' : 'err'}</span>
                    </div>`;
                  })}
                </div>
              </div>
            ` : null}
          </div>
        </div>
      ` : null}
      ${showSnippets ? html`
        <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${() => setShowSnippets(false)}>
          <div class="modal" style="max-width: 700px" onClick=${(e) => e.stopPropagation()}>
            <h2>Code Snippets</h2>
            <div class="snippet-form">
              <input value=${snippetForm.name} onInput=${(e) => setSnippetForm(Object.assign({}, snippetForm, { name: e.target.value }))} placeholder="Name" style="width:100%;padding:6px;margin:4px 0;border:1px solid var(--border);border-radius:4px;background:var(--input);color:var(--fg)" />
              <select value=${snippetForm.language} onChange=${(e) => setSnippetForm(Object.assign({}, snippetForm, { language: e.target.value }))} style="padding:6px;margin:4px 0;border:1px solid var(--border);border-radius:4px;background:var(--input);color:var(--fg)">
                <option value="javascript">JavaScript</option><option value="python">Python</option><option value="bash">Bash</option><option value="go">Go</option><option value="rust">Rust</option><option value="text">Text</option>
              </select>
              <textarea value=${snippetForm.code} onInput=${(e) => setSnippetForm(Object.assign({}, snippetForm, { code: e.target.value }))} placeholder="Code..." rows="6" style="width:100%;padding:6px;margin:4px 0;border:1px solid var(--border);border-radius:4px;background:var(--input);color:var(--fg);font-family:monospace" />
              <input value=${snippetForm.description} onInput=${(e) => setSnippetForm(Object.assign({}, snippetForm, { description: e.target.value }))} placeholder="Description (optional)" style="width:100%;padding:6px;margin:4px 0;border:1px solid var(--border);border-radius:4px;background:var(--input);color:var(--fg)" />
              <div class="modal-actions">
                <button class="btn-primary" onClick=${saveSnippet}>Save Snippet</button>
              </div>
            </div>
            <div class="snippet-list">
              <input value=${snippetSearch} onInput=${async (e) => { setSnippetSearch(e.target.value); try { const r = await API('/api/snippets?q=' + encodeURIComponent(e.target.value)); setSnippets(r.snippets || []); } catch (err) {} }} placeholder="Search snippets..." style="width:100%;padding:6px;margin:4px 0;border:1px solid var(--border);border-radius:4px;background:var(--input);color:var(--fg)" />
              ${snippets.map((s) => html`
                <div class="snippet-item">
                  <div class="snippet-head">
                    <strong>${s.name}</strong> <span class="hint">${s.language}</span>
                    <button class="btn-sm" onClick=${() => { navigator.clipboard.writeText(s.code); toast('Copied', 'success'); }}>Copy</button>
                    <button class="btn-sm" onClick=${() => deleteSnippet(s.id)}>Delete</button>
                  </div>
                  <pre class="snippet-code">${s.code.slice(0, 300)}</pre>
                  ${s.description ? html`<p class="hint">${s.description}</p>` : null}
                </div>
              `)}
            </div>
            <div class="modal-actions">
              <button onClick=${() => setShowSnippets(false)}>Close</button>
            </div>
          </div>
        </div>
      ` : null}
      ${showSandbox ? html`
        <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${() => setShowSandbox(false)}>
          <div class="modal" style="max-width: 700px" onClick=${(e) => e.stopPropagation()}>
            <h2>Code Sandbox</h2>
            <label>Language
              <select value=${sandboxLang} onChange=${(e) => setSandboxLang(e.target.value)} style="padding:6px;margin:4px 0;border:1px solid var(--border);border-radius:4px;background:var(--input);color:var(--fg)">
                <option value="python">Python</option><option value="javascript">JavaScript</option><option value="bash">Bash</option><option value="go">Go</option><option value="rust">Rust</option>
              </select>
            </label>
            <textarea value=${sandboxCode} onInput=${(e) => setSandboxCode(e.target.value)} placeholder="Enter code..." rows="8" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--input);color:var(--fg);font-family:monospace" />
            <div class="modal-actions">
              <button class="btn-primary" onClick=${runSandbox} disabled=${sandboxRunning}>${sandboxRunning ? 'Running...' : 'Run'}</button>
              <button onClick=${() => setShowSandbox(false)}>Close</button>
            </div>
            ${sandboxResult ? html`
              <div class="sandbox-result">
                <div class="sandbox-status ${sandboxResult.ok ? 'ok' : 'err'}">${sandboxResult.ok ? '✓ Exit ' + sandboxResult.exitCode : '✗ ' + (sandboxResult.error || 'Failed')} (${sandboxResult.durationMs}ms, ${sandboxResult.runtime})</div>
                ${sandboxResult.stdout ? html`<pre class="sandbox-output">${sandboxResult.stdout}</pre>` : null}
                ${sandboxResult.stderr ? html`<pre class="sandbox-error">${sandboxResult.stderr}</pre>` : null}
              </div>
            ` : null}
          </div>
        </div>
      ` : null}
      ${showWebhooks ? html`
        <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${() => setShowWebhooks(false)}>
          <div class="modal" style="max-width: 600px" onClick=${(e) => e.stopPropagation()}>
            <h2>Webhook Triggers</h2>
            <p class="hint">Webhook URL: <code>${window.location.origin}/api/webhook?event=push</code></p>
            <p class="hint">Set <code>AEGISAI_WEBHOOK_SECRET</code> for HMAC verification. Events: push, pull_request, issues.</p>
            <input value=${webhookSecret} onInput=${(e) => setWebhookSecret(e.target.value)} placeholder="Webhook secret (for HMAC signing)" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--input);color:var(--fg);margin-bottom:8px" />
            <label>Event
              <select value=${webhookEvent} onChange=${(e) => setWebhookEvent(e.target.value)} style="padding:6px;margin:4px 0;border:1px solid var(--border);border-radius:4px;background:var(--input);color:var(--fg)">
                <option value="push">push</option><option value="pull_request">pull_request</option><option value="issues">issues</option>
              </select>
            </label>
            <label>Payload (JSON)
              <textarea value=${webhookPayload} onInput=${(e) => setWebhookPayload(e.target.value)} rows="6" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--input);color:var(--fg);font-family:monospace" />
            </label>
            <div class="modal-actions">
              <button class="btn-primary" onClick=${triggerWebhook}>Trigger</button>
              <button onClick=${() => setShowWebhooks(false)}>Close</button>
            </div>
            ${webhookResult ? html`<pre class="sandbox-output">${JSON.stringify(webhookResult, null, 2).slice(0, 2000)}</pre>` : null}
          </div>
        </div>
      ` : null}
      ${showPerf ? html`
        <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${() => setShowPerf(false)}>
          <div class="modal" style="max-width: 700px" onClick=${(e) => e.stopPropagation()}>
            <h2>Performance Dashboard</h2>
            ${perfReport ? html`
              <div class="perf-summary" style="display:flex;gap:12px;flex-wrap:wrap;margin:8px 0">
                <span class="hint">Total: ${perfReport.totalMs}ms</span>
                <span class="hint">Iterations: ${perfReport.iterations}</span>
                <span class="hint">Tokens: ${perfReport.tokens}</span>
                <span class="hint">Tool calls: ${perfReport.toolCalls}</span>
                <span class="hint">Unique tools: ${perfReport.uniqueTools}</span>
                ${perfReport.topBottleneck ? html`<span class="hint">Top bottleneck: ${perfReport.topBottleneck.name} (${perfReport.topBottleneck.totalMs}ms)</span>` : null}
              </div>
              <table class="md-table">
                <thead><tr><th>Tool</th><th>Count</th><th>Total ms</th><th>Avg ms</th><th>Errors</th><th>%</th></tr></thead>
                <tbody>
                  ${(perfReport.tools || []).map((t) => html`<tr><td>${t.name}</td><td>${t.count}</td><td>${t.totalMs}</td><td>${t.avgMs}</td><td>${t.errors}</td><td>${t.pctOfTotal}%</td></tr>`)}
                </tbody>
              </table>
            ` : html`<p class="hint">No profiling data yet. Run an agent task first.</p>`}
            <div class="modal-actions">
              <button onClick=${() => loadPerf()}>Refresh</button>
              <button onClick=${() => setShowPerf(false)}>Close</button>
            </div>
          </div>
        </div>
      ` : null}
      ${showScheduled ? html`
        <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${() => setShowScheduled(false)}>
          <div class="modal" style="max-width: 700px" onClick=${(e) => e.stopPropagation()}>
            <h2>Scheduled Tasks</h2>
            <div class="sched-form">
              <input value=${schedForm.name} onInput=${(e) => setSchedForm(Object.assign({}, schedForm, { name: e.target.value }))} placeholder="Name" style="width:100%;padding:6px;margin:4px 0;border:1px solid var(--border);border-radius:4px;background:var(--input);color:var(--fg)" />
              <input value=${schedForm.cron} onInput=${(e) => setSchedForm(Object.assign({}, schedForm, { cron: e.target.value }))} placeholder="Cron (e.g. every 5m, daily 09:00)" style="width:100%;padding:6px;margin:4px 0;border:1px solid var(--border);border-radius:4px;background:var(--input);color:var(--fg)" />
              <textarea value=${schedForm.prompt} onInput=${(e) => setSchedForm(Object.assign({}, schedForm, { prompt: e.target.value }))} placeholder="Prompt to run..." rows="3" style="width:100%;padding:6px;margin:4px 0;border:1px solid var(--border);border-radius:4px;background:var(--input);color:var(--fg)" />
              <div class="modal-actions">
                <button class="btn-primary" onClick=${createScheduled}>Create</button>
              </div>
            </div>
            <div class="sched-list">
              ${scheduledTasks.map((t) => html`
                <div class="sched-item">
                  <strong>${t.name}</strong> <span class="hint">${t.cron}</span>
                  <span class="hint">runs: ${t.runCount}, next: ${t.nextRun ? new Date(t.nextRun).toLocaleString() : 'n/a'}</span>
                  <button class="btn-sm" onClick=${() => deleteScheduled(t.id)}>Delete</button>
                </div>
              `)}
            </div>
            <div class="modal-actions">
              <button onClick=${() => setShowScheduled(false)}>Close</button>
            </div>
          </div>
        </div>
      ` : null}

      <${SessionSidebar} open=${showSessions} onClose=${() => setShowSessions(false)} onSelect=${async (s) => {
        try {
          const d = await API('/api/sessions?id=' + encodeURIComponent(s.id));
          setCurrentSession(s.id);
          setMessages((d.messages || []).map((m) => ({ role: m.role, content: m.content })));
          updateCtx(s.id);
          toast('Loaded session: ' + (s.title || s.id), 'success');
        } catch (e) { toast('Load failed: ' + e.message, 'error'); }
      }} />
      <header class="topbar">
        <h1>AegisAi Harness</h1>
        <span class="ctx-meter">ctx ${ctx.tokens}/${ctx.limit}${ctx.compacted ? ' · compacted' : ''}</span>
        <button onClick=${() => setShowSessions(true)} title="Sessions (Ctrl+B)">📂</button>
        <button onClick=${async () => {
          try {
            const r = await API('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: currentSession, format: 'markdown' }) });
            toast('Exported to ' + (r.path || 'download'), 'success');
          } catch (e) { toast('Export failed: ' + e.message, 'error'); }
        }} title="Export session" aria-label="Export session">📥</button>
        <button onClick=${() => { const idx = THEMES.indexOf(theme); const next = THEMES[(idx + 1) % THEMES.length]; setTheme(next); localStorage.setItem('theme', next); toast('Theme: ' + next, 'info'); }} title="Cycle theme (${theme})">${theme === 'dark' ? '☀️' : theme === 'light' ? '🌙' : theme === 'high-contrast' ? '🔲' : '🌅'}</button>
        <button onClick=${() => setShowConfig(true)} title="Settings (Ctrl+,)" aria-label="Open settings">⚙️</button>
        <button onClick=${() => setShowPalette(true)} title="Command palette (Ctrl+K)" aria-label="Open command palette">⌘</button>
        <button onClick=${() => setShowFiles(true) || loadFiles('')} title="File browser" aria-label="Open file browser">📁</button>
        <button onClick=${() => { setShowWebhooks(true); }} title="Webhooks" aria-label="Webhooks">🔗</button>
        <button onClick=${() => { setShowScheduled(true); loadScheduled(); }} title="Scheduled tasks" aria-label="Scheduled tasks">⏰</button>
        <button onClick=${() => { setShowPerf(true); loadPerf(); }} title="Performance" aria-label="Performance dashboard">📊</button>
        <button onClick=${() => setShowSearch(true)} title="Search conversations" aria-label="Search conversations">🔍</button>
        <button onClick=${() => exportChat('markdown')} title="Export chat as Markdown" aria-label="Export chat as Markdown">📤</button>
        <button onClick=${() => setShowSnippets(true) || loadSnippets()} title="Snippets" aria-label="Open snippets">📝</button>
        <button onClick=${() => setShowHelp(true)} title="Help (Ctrl+/)" aria-label="Open help">?</button>
      </header>
      <div class=${'main-layout' + (fileEditor ? ' split' : '')}>
        <main id="main-content" class="chat ${dragOver ? 'drag-over' : ''}" role="main" aria-label="Chat messages">
          ${dragOver ? html`<div class="drag-overlay">Drop files here to attach</div>` : null}
          ${messages.length === 0 ? html`
            <div class="empty-state">
              <h2>Welcome to AegisAi Harness</h2>
              <p>Start a conversation, or press <kbd>Ctrl+K</kbd> for commands.</p>
              <div class="empty-actions">
                <button onClick=${() => { setMessages([{ role: 'assistant', content: 'Hello! How can I help you today?' }]); }}>Start chatting</button>
                <button onClick=${() => setShowHelp(true)}>View shortcuts</button>
                <button onClick=${() => setShowSessions(true)}>Browse sessions</button>
              </div>
            </div>
          ` : null}
          ${messages.map((m) => html`
            <div class=${'msg ' + m.role}>
              <div class="bubble" dangerouslySetInnerHTML=${{ __html: m.role === 'assistant' && window.HarnessMarkdown ? window.HarnessMarkdown.render(m.content) : escapeHtml(m.content) }}></div>
            </div>
          `)}
          ${loading ? html`<div class="msg assistant"><div class="bubble loading">Thinking<span class="dots">...</span></div></div>` : null}
          ${toolLog.length > 0 ? html`<${ToolTimeline} tools=${toolLog} />` : null}
        </main>
        ${fileEditor ? html`
          <aside class="editor-pane">
            <div class="editor-head">
              <span class="editor-path" title=${fileEditor.path}>${fileEditor.path.split(/[\\/]/).pop()}</span>
              <span class="editor-dirty">${fileEditor.dirty ? '●' : ''}</span>
              <button class="btn-sm" onClick=${() => saveEditor()} disabled=${!fileEditor.dirty}>Save</button>
              <button class="btn-sm" onClick=${async () => {
                if (showBlame) { setShowBlame(false); setBlameData(null); return; }
                try {
                  const r = await API('/api/git-blame?path=' + encodeURIComponent(fileEditor.path));
                  if (r.ok) { setBlameData(r.data || r); setShowBlame(true); }
                  else toast('Blame failed: ' + (r.data && r.data.error || r.status), 'error');
                } catch (e) { toast('Blame failed: ' + e.message, 'error'); }
              }}>${showBlame ? 'Hide Blame' : 'Blame'}</button>
              <button class="btn-sm" onClick=${() => setFileEditor(null)}>Close</button>
            </div>
            <textarea
              class="editor-area"
              value=${fileEditor.content}
              onInput=${(e) => setFileEditor(Object.assign({}, fileEditor, { content: e.target.value, dirty: true }))}
              spellcheck="false"
            ></textarea>
            ${showBlame && blameData ? html`
              <div class="blame-pane">
                <div class="blame-head">Git Blame</div>
                <pre class="blame-list">${(blameData.entries || blameData || []).map((l) => html`<div class="blame-line"><span class="blame-author">${l.author || '?'}</span> <span class="blame-commit">${l.commit || ''}</span> <span class="blame-code">${l.line || l.content || l.text || ''}</span></div>`)}</pre>
              </div>
            ` : null}
          </aside>
        ` : null}
      </div>
      <footer class="composer">
        ${attachments.length ? html`
          <div class="attach-chips">
            ${attachments.map((a) => html`
              <div class="attach-chip" key=${a.id}>
                <span class="attach-icon">📄</span>
                <span class="attach-name" onClick=${() => setAttachPreview(a)} title="Preview">${a.name}</span>
                <span class="attach-size">${(a.size / 1024).toFixed(1)} KB</span>
                <button class="attach-remove" onClick=${() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))} title="Remove">×</button>
              </div>
            `)}
          </div>
        ` : null}
        <textarea ref=${inputRef} value=${input} onInput=${(e) => setInput(e.target.value)} onKeyDown=${(e) => {
          if (e.key === 'ArrowUp' && !e.shiftKey && (input === '' || historyIdx >= 0)) {
            e.preventDefault();
            if (promptHistory.length === 0) return;
            const next = historyIdx < 0 ? promptHistory.length - 1 : Math.max(0, historyIdx - 1);
            setHistoryIdx(next);
            setInput(promptHistory[next] || '');
            return;
          }
          if (e.key === 'ArrowDown' && !e.shiftKey && historyIdx >= 0) {
            e.preventDefault();
            const next = historyIdx + 1;
            if (next >= promptHistory.length) { setHistoryIdx(-1); setInput(''); }
            else { setHistoryIdx(next); setInput(promptHistory[next] || ''); }
            return;
          }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        }} placeholder="Type a message... (Shift+Enter for new line, ↑/↓ for history, drag files to attach)" rows="2"></textarea>
        <button onClick=${send} disabled=${loading || (!input.trim() && attachments.length === 0)}>Send</button>
      </footer>
      ${attachPreview ? html`
        <div class="modal-backdrop" role="dialog" aria-modal="true" onClick=${() => setAttachPreview(null)}>
          <div class="modal" style="max-width: 720px" onClick=${(e) => e.stopPropagation()}>
            <h2>${attachPreview.name}</h2>
            <pre class="file-content">${attachPreview.content}</pre>
            <div class="modal-actions"><button onClick=${() => setAttachPreview(null)}>Close</button></div>
          </div>
        </div>
      ` : null}
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => reg.update()).catch(() => {});
  });
}
