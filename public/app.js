// Vendored locally so the web UI works with no internet connection.
import { h, render } from '/vendor/preact.mjs';
import { useState, useEffect, useRef, useCallback } from '/vendor/hooks.mjs';
import htm from '/vendor/htm.mjs';
const html = htm.bind(h);

const API = (p) => fetch(p).then((r) => r.json());

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
      await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(local) });
    setCfg(local);
    setSaving(false);
    toast('Configuration saved', 'success');
    onClose();
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
      const r = await fetch('/api/models/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: name }) });
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
            <p class="hint">Scan drives and directories for GGUF, BIN, and Safetensors model files, plus Ollama models.</p>
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
                    <span class="hint">${m.sizeGB > 0 ? m.sizeGB + ' GB' : ''} ${m.type ? '(' + m.type + ')' : ''}</span>
                  </div>
                `)}
              </div>
            ` : html`<p class="hint">No models found. Try scanning a specific directory.</p>`}
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
  const [view, setView] = useState(localStorage.getItem('onboarded') ? 'chat' : 'onboarding');
  const [toasts, setToasts] = useState([]);
  const [toolLog, setToolLog] = useState([]);
  const [dragOver, setDragOver] = useState(false);
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
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
      const d = await r.json();
      setMessages((m) => [...m, { role: 'assistant', content: d.reply || '(no reply)' }]);
      if (d.toolLog) setToolLog(d.toolLog);
      updateCtx();
      toast('Response received', 'success');
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Error: ' + e.message }]);
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
  ];

  if (view === 'onboarding') {
    return html`<${OnboardingWizard} onComplete=${() => setView('chat')} />`;
  }

  return html`
    <div class="app" data-theme=${theme}>
      <${ToastContainer} />
      <${CommandPalette} open=${showPalette} onClose=${() => setShowPalette(false)} commands=${commands} />
      ${showConfig ? html`<${ConfigModal} cfg=${cfg} setCfg=${setCfg} onClose=${() => setShowConfig(false)} />` : null}
      ${showHelp ? html`<${HelpPanel} onClose=${() => setShowHelp(false)} />` : null}
      <${SessionSidebar} open=${showSessions} onClose=${() => setShowSessions(false)} onSelect=${(s) => { toast('Loaded session: ' + (s.title || s.id), 'info'); }} />
      <header class="topbar">
        <h1>AegisAi Harness</h1>
        <span class="ctx-meter">ctx ${ctx.tokens}/${ctx.limit}${ctx.compacted ? ' · compacted' : ''}</span>
        <button onClick=${() => setShowSessions(true)} title="Sessions (Ctrl+B)">📂</button>
        <button onClick=${() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">${theme === 'dark' ? '☀️' : '🌙'}</button>
        <button onClick=${() => setShowConfig(true)} title="Settings (Ctrl+,)">⚙️</button>
        <button onClick=${() => setShowPalette(true)} title="Command palette (Ctrl+K)">⌘</button>
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
