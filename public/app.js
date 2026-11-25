// Vendored locally so the web UI works with no internet connection.
import { h, render } from '/vendor/preact.mjs';
import { useState, useEffect, useRef, useCallback } from '/vendor/hooks.mjs';
import htm from '/vendor/htm.mjs';
const html = htm.bind(h);

// Auth token support: stored in sessionStorage, sent as Bearer on every API call.
function authToken() { try { return sessionStorage.getItem('aegisai_token') || localStorage.getItem('aegisai_token') || ''; } catch (e) { return ''; } }
function setAuthToken(t) { try { if (t) sessionStorage.setItem('aegisai_token', t); else sessionStorage.removeItem('aegisai_token'); } catch (e) {} }
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
    <div class="toast-container">
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
    <div class="modal-backdrop" onClick=${onClose}>
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
  const steps = ['Welcome', 'Backend', 'Model', 'Security', 'Done'];

  async function finish() {
    try {
      const body = { BACKEND_TYPE: backend };
      if (model) body.AEGISAI_MODEL = model;
      if (token) body.AEGISAI_TOKEN = token;
      await apiFetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      // Keep the UI authenticated after enabling a token.
      if (token) setAuthToken(token.trim());
    } catch (e) {
      console.error('config save failed:', e);
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
    <div class="modal-backdrop" onClick=${onClose}>
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
    <div class="modal-backdrop" onClick=${onClose}>
      <div class="modal" style="max-width: 700px" onClick=${(e) => e.stopPropagation()}>
        <h2>Configuration & Models</h2>
        <div class="tab-bar">
          <button class=${'tab' + (tab === 'config' ? ' active' : '')} onClick=${() => setTab('config')}>Config</button>
          <button class=${'tab' + (tab === 'models' ? ' active' : '')} onClick=${() => setTab('models')}>Models</button>
          <button class=${'tab' + (tab === 'discover' ? ' active' : '')} onClick=${() => setTab('discover')}>Discover</button>
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
                <button class="btn-sm" onClick=${() => { setLocal({ ...local, AEGISAI_MODEL: m.name || m }); toast('Selected ' + (m.name || m), 'info'); }}>Use</button>
              </div>
            `)}
            <button class="btn-secondary" onClick=${() => API('/api/models').then((d) => setModels(d.models || []))}>Refresh</button>
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
  useEffect(() => {
    if (open) {
      API('/api/sessions').then((d) => setSessions(d.sessions || [])).catch(() => {});
    }
  }, [open]);
  const filtered = sessions.filter((s) => !q || (s.title || s.id || '').toLowerCase().includes(q.toLowerCase()));
  if (!open) return null;
  return html`
    <div class="sidebar">
      <div class="sidebar-header">
        <h3>Sessions</h3>
        <button class="sidebar-close" onClick=${onClose}>×</button>
      </div>
      <input class="sidebar-search" value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Search sessions..." />
      <div class="sidebar-list">
        ${filtered.map((s) => html`
          <div class="session-item" onClick=${() => { onSelect(s); onClose(); }}>
            <div class="session-title">${s.title || s.id}</div>
            <div class="session-meta">${s.updated || ''}</div>
          </div>
        `)}
        ${filtered.length === 0 ? html`<div class="sidebar-empty">No sessions found</div>` : null}
      </div>
    </div>
  `;
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

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
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
  const [toasts, setToasts] = useState([]);
  const [toolLog, setToolLog] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [needAuth, setNeedAuth] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const inputRef = useRef(null);
  const chatRef = useRef(null);

  useEffect(() => {
    toastFn = (msg, type) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, msg, type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => { updateCtx(); }, []);
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); setShowSessions((s) => !s); }
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
          toast('Attached ' + files.length + ' file(s)', 'info');
          // Read file contents and append to input
          Array.from(files).forEach((f) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              setInput((prev) => prev + '\n[File: ' + f.name + ']\n' + ev.target.result.slice(0, 2000) + '\n');
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
    try { const d = await API('/api/context'); setCtx(d); } catch (e) {}
  }

  function newChat() {
    setMessages([]);
    setToolLog([]);
    toast('New chat started', 'info');
  }

  async function send() {
    if (!input.trim() || loading) return;
    const text = input;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    setToolLog([]);
    // Add empty assistant message for streaming
    setMessages((m) => [...m, { role: 'assistant', content: '' }]);
    try {
      const r = await apiFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, stream: true }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullReply = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\\n\\n');
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
            } else if (data.type === 'done') {
              if (data.toolLog) setToolLog(data.toolLog);
              updateCtx();
              toast('Response received', 'success');
            }
          } catch (e) {}
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
  const [showCompare, setShowCompare] = useState(false);
  const [compareModels, setCompareModels] = useState('');
  const [comparePrompt, setComparePrompt] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [comparing, setComparing] = useState(false);

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
    return html`<${OnboardingWizard} onComplete=${() => setView('chat')} />`;
  }

  return html`
    <div class="app" data-theme=${theme}>
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
      ${showShortcuts ? html`        <div class="modal-backdrop" onClick=${() => setShowShortcuts(false)}>
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
        <div class="modal-backdrop" onClick=${() => setShowSearch(false)}>
          <div class="modal" style="max-width: 600px" onClick=${(e) => e.stopPropagation()}>
            <h2>Search Conversations</h2>
            <div class="search-bar">
              <input value=${searchQuery} onInput=${(e) => setSearchQuery(e.target.value)} placeholder="Search messages..." style="flex:1" onKeyDown=${(e) => { if (e.key === 'Enter') searchConversations(); }} />
              <button class="btn-primary" onClick=${searchConversations}>Search</button>
            </div>
            ${searchResults.length > 0 ? html`
              <div class="search-results">
                ${searchResults.map((r) => html`
                  <div class="search-result-item">
                    <span class="search-role">${r.role}</span>
                    <span class="search-snippet">${r.snippet}</span>
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
        <div class="modal-backdrop" onClick=${() => setShowFiles(false)}>
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
                  <h3>${selectedFile.split(/[\\/]/).pop()}</h3>
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
        <div class="modal-backdrop" onClick=${() => setShowCompare(false)}>
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
              <div class="compare-results">
                ${compareResult.comparison.results.map((r) => html`
                  <div class="compare-card">
                    <h3>${r.model} ${r.ok ? '✓' : '✗'} ${r.duration}ms</h3>
                    <div class="compare-reply">${r.ok ? r.reply.slice(0, 500) : r.error}</div>
                  </div>
                `)}
                <p class="hint">Fastest: ${compareResult.comparison.fastest} | Shortest: ${compareResult.comparison.shortest} | Longest: ${compareResult.comparison.longest}</p>
              </div>
            ` : null}
          </div>
        </div>
      ` : null}
      <${SessionSidebar} open=${showSessions} onClose=${() => setShowSessions(false)} onSelect=${async (s) => {
        try {
          const d = await API('/api/sessions?id=' + encodeURIComponent(s.id));
          setMessages((d.messages || []).map((m) => ({ role: m.role, content: m.content })));
          toast('Loaded session: ' + (s.title || s.id), 'success');
        } catch (e) { toast('Load failed: ' + e.message, 'error'); }
      }} />
      <header class="topbar">
        <h1>AegisAi Harness</h1>
        <span class="ctx-meter">ctx ${ctx.tokens}/${ctx.limit}${ctx.compacted ? ' · compacted' : ''}</span>
        <button onClick=${() => setShowSessions(true)} title="Sessions (Ctrl+B)">📂</button>
        <button onClick=${() => { const idx = THEMES.indexOf(theme); const next = THEMES[(idx + 1) % THEMES.length]; setTheme(next); localStorage.setItem('theme', next); toast('Theme: ' + next, 'info'); }} title="Cycle theme (${theme})">${theme === 'dark' ? '☀️' : theme === 'light' ? '🌙' : theme === 'high-contrast' ? '🔲' : '🌅'}</button>
        <button onClick=${() => setShowConfig(true)} title="Settings (Ctrl+,)">⚙️</button>
        <button onClick=${() => setShowPalette(true)} title="Command palette (Ctrl+K)">⌘</button>
        <button onClick=${() => setShowFiles(true) || loadFiles('')} title="File browser">📁</button>
        <button onClick=${() => setShowSearch(true)} title="Search conversations">🔍</button>
        <button onClick=${() => exportChat('markdown')} title="Export chat as Markdown">📤</button>
        <button onClick=${() => setShowCompare(true)} title="Compare models">⚖️</button>
        <button onClick=${() => setShowHelp(true)} title="Help (Ctrl+/)">?</button>
      </header>
      <div class="main-layout">
        <main class="chat ${dragOver ? 'drag-over' : ''}">
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
      </div>
      <footer class="composer">
        <textarea ref=${inputRef} value=${input} onInput=${(e) => setInput(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Type a message... (Shift+Enter for new line, drag files to attach)" rows="2"></textarea>
        <button onClick=${send} disabled=${loading || !input.trim()}>Send</button>
      </footer>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => reg.update()).catch(() => {});
  });
}
