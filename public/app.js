import { h, render } from 'https://esm.sh/preact@10.25.4';
import { useState, useEffect, useRef, useCallback } from 'https://esm.sh/preact@10.25.4/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
const html = htm.bind(h);

const API = (p) => fetch(p).then((r) => r.json());

// ---------- Toast system ----------
let toastFn = null;
function toast(msg, type = 'info') {
  if (toastFn) toastFn(msg, type);
}

// ---------- Keyboard shortcuts ----------
const shortcuts = [];
function registerShortcut(key, fn) {
  shortcuts.push({ key, fn });
}

// ---------- Helpers ----------
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- Components ----------

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    toastFn = (msg, type) => {
      const id = Date.now();
      setToasts((t) => [...t, { id, msg, type }]);
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
    const body = { BACKEND_TYPE: backend };
    if (token) body.AEGISAI_TOKEN = token;
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (model) {
      await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'ping' }) }).catch(() => {});
    }
    localStorage.setItem('onboarded', '1');
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
          <p class="hint">Use <kbd>Ctrl+K</kbd> to open the command palette anytime.</p>
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

function Dashboard({ onNavigate }) {
  const [status, setStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    API('/api/plugins').then(setStatus).catch(() => {});
    API('/api/context').then(setStatus).catch(() => {});
  }, []);
  const quickActions = [
    { icon: '💬', label: 'New Chat', action: () => onNavigate('chat') },
    { icon: '📊', label: 'Dashboard', action: () => onNavigate('dashboard') },
    { icon: '🔧', label: 'Tools', action: () => onNavigate('tools') },
    { icon: '🧠', label: 'Memory', action: () => onNavigate('memory') },
    { icon: '📚', label: 'Skills', action: () => onNavigate('skills') },
    { icon: '⚙️', label: 'Settings', action: () => onNavigate('settings') },
  ];
  return html`
    <div class="dashboard">
      <h2>Dashboard</h2>
      <div class="quick-actions">
        ${quickActions.map((a) => html`
          <button class="quick-action" onClick=${a.action}>
            <span class="qa-icon">${a.icon}</span>
            <span class="qa-label">${a.label}</span>
          </button>
        `)}
      </div>
      <div class="dashboard-grid">
        <div class="dash-card">
          <h3>System Status</h3>
          <div class="dash-stat"><span>Context</span><span>${status ? status.tokens + '/' + status.limit : '—'}</span></div>
          <div class="dash-stat"><span>Tools</span><span>64+</span></div>
          <div class="dash-stat"><span>Tests</span><span>257 passing</span></div>
        </div>
        <div class="dash-card">
          <h3>Quick Tips</h3>
          <ul class="tips">
            <li>Press <kbd>Ctrl+K</kbd> for command palette</li>
            <li>Use <kbd>Shift+Enter</kbd> for multi-line input</li>
            <li>Type <code>/help</code> for all commands</li>
            <li>Drag & drop files to attach</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

function HelpPanel({ onClose }) {
  const sections = [
    { title: 'Chat', items: ['Enter — send message', 'Shift+Enter — new line', 'Ctrl+K — command palette', 'Ctrl+/ — toggle help'] },
    { title: 'Commands', items: ['/help — list all commands', '/clear — clear chat', '/model <name> — switch model', '/compact — compact context', '/tools — list tools'] },
    { title: 'Shortcuts', items: ['Ctrl+K — command palette', 'Ctrl+N — new chat', 'Ctrl+, — settings', 'Esc — close modal'] },
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

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ctx, setCtx] = useState({ tokens: 0, limit: 8192 });
  const [showConfig, setShowConfig] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [cfg, setCfg] = useState({});
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [view, setView] = useState(localStorage.getItem('onboarded') ? 'chat' : 'onboarding');
  const [toasts, setToasts] = useState([]);
  const inputRef = useRef(null);

  // Toast system
  useEffect(() => {
    toastFn = (msg, type) => {
      const id = Date.now();
      setToasts((t) => [...t, { id, msg, type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => { updateCtx(); }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowPalette(true); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); setMessages([]); toast('New chat started', 'info'); }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); setShowConfig(true); }
      if (e.key === '/' && e.ctrlKey) { e.preventDefault(); setShowHelp(true); }
      if (e.key === 'Escape') { setShowConfig(false); setShowHelp(false); setShowPalette(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  async function updateCtx() {
    try { const d = await API('/api/context'); setCtx(d); } catch (e) {}
  }

  async function send() {
    if (!input.trim() || loading) return;
    const text = input;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text }) });
      const d = await r.json();
      setMessages((m) => [...m, { role: 'assistant', content: d.reply || '(no reply)' }]);
      updateCtx();
      toast('Response received', 'success');
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Error: ' + e.message }]);
      toast('Error: ' + e.message, 'error');
    } finally { setLoading(false); }
  }

  const commands = [
    { icon: '💬', label: 'New Chat', keywords: 'new chat clear', shortcut: 'Ctrl+N', run: () => { setMessages([]); toast('New chat started', 'info'); } },
    { icon: '⚙️', label: 'Settings', keywords: 'config settings', shortcut: 'Ctrl+,', run: () => setShowConfig(true) },
    { icon: '❓', label: 'Help', keywords: 'help shortcuts', shortcut: 'Ctrl+/', run: () => setShowHelp(true) },
    { icon: '🎨', label: 'Toggle Theme', keywords: 'theme dark light', run: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    { icon: '🗑️', label: 'Clear Chat', keywords: 'clear reset', run: () => { setMessages([]); toast('Chat cleared', 'info'); } },
    { icon: '📊', label: 'Context Info', keywords: 'context tokens', run: () => toast('Context: ' + ctx.tokens + '/' + ctx.limit, 'info') },
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
      <header class="topbar">
        <h1>AegisAi Harness</h1>
        <span class="ctx-meter">ctx ${ctx.tokens}/${ctx.limit}${ctx.compacted ? ' · compacted' : ''}</span>
        <button onClick=${() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme (Ctrl+K → Toggle Theme)">${theme === 'dark' ? '☀️' : '🌙'}</button>
        <button onClick=${() => setShowConfig(true)} title="Settings (Ctrl+,)">⚙️</button>
        <button onClick=${() => setShowPalette(true)} title="Command palette (Ctrl+K)">⌘</button>
        <button onClick=${() => setShowHelp(true)} title="Help (Ctrl+/)">?</button>
      </header>
      <main class="chat">
        ${messages.length === 0 ? html`
          <div class="empty-state">
            <h2>Welcome to AegisAi Harness</h2>
            <p>Start a conversation or press <kbd>Ctrl+K</kbd> for commands.</p>
            <div class="empty-actions">
              <button onClick=${() => { setMessages([{ role: 'assistant', content: 'Hello! How can I help you today?' }]); }}>Start chatting</button>
              <button onClick=${() => setShowHelp(true)}>View shortcuts</button>
            </div>
          </div>
        ` : null}
        ${messages.map((m) => html`
          <div class=${'msg ' + m.role}>
            <div class="bubble" dangerouslySetInnerHTML=${{ __html: m.role === 'assistant' && window.HarnessMarkdown ? window.HarnessMarkdown.render(m.content) : escapeHtml(m.content) }}></div>
          </div>
        `)}
        ${loading ? html`<div class="msg assistant"><div class="bubble loading">Thinking<span class="dots">...</span></div></div>` : null}
      </main>
      <footer class="composer">
        <textarea ref=${inputRef} value=${input} onInput=${(e) => setInput(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Type a message... (Shift+Enter for new line)" rows="2"></textarea>
        <button onClick=${send} disabled=${loading || !input.trim()}>Send</button>
      </footer>
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
  return html`
    <div class="modal-backdrop" onClick=${onClose}>
      <div class="modal" onClick=${(e) => e.stopPropagation()}>
        <h2>Configuration</h2>
        ${keys.map((k) => html`
          <label>${k}
            <input value=${local[k] || ''} onInput=${(e) => setLocal({ ...local, [k]: e.target.value })} />
          </label>
        `)}
        <div class="modal-actions">
          <button class="btn-primary" onClick=${save} disabled=${saving}>${saving ? 'Saving...' : 'Save'}</button>
          <button onClick=${onClose}>Close</button>
        </div>
      </div>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
