import { h, render } from 'https://esm.sh/preact@10.25.4';
import { useState, useEffect, useRef } from 'https://esm.sh/preact@10.25.4/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
const html = htm.bind(h);

const API = (p) => fetch(p).then((r) => r.json());

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ctx, setCtx] = useState({ tokens: 0, limit: 8192 });
  const [showConfig, setShowConfig] = useState(false);
  const [cfg, setCfg] = useState({});
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const listRef = useRef(null);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => { updateCtx(); }, []);

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
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Error: ' + e.message }]);
    } finally { setLoading(false); }
  }

  return html`
    <div class="app">
      <header class="topbar">
        <h1>AegisAi Harness</h1>
        <span class="ctx-meter">ctx ${ctx.tokens}/${ctx.limit}${ctx.compacted ? ' · compacted' : ''}</span>
        <button onClick=${() => setTheme(theme === 'dark' ? 'light' : 'dark')}>${theme === 'dark' ? 'Light' : 'Dark'}</button>
        <button onClick=${() => setShowConfig(true)}>Config</button>
      </header>
      <main class="chat">
        ${messages.map((m) => html`<div class=${'msg ' + m.role}><div class="bubble" dangerouslySetInnerHTML=${{ __html: m.role === 'assistant' && window.HarnessMarkdown ? window.HarnessMarkdown.render(m.content) : escapeHtml(m.content) }}></div></div>`)}
        ${loading ? html`<div class="msg assistant"><div class="bubble">Thinking…</div></div>` : null}
      </main>
      <footer class="composer">
        <textarea value=${input} onInput=${(e) => setInput(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Type a message…"></textarea>
        <button onClick=${send} disabled=${loading}>Send</button>
      </footer>
      ${showConfig ? html`<${ConfigModal} cfg=${cfg} setCfg=${setCfg} onClose=${() => setShowConfig(false)} />` : null}
    </div>
  `;
}

function ConfigModal({ cfg, setCfg, onClose }) {
  const [local, setLocal] = useState(cfg);
  useEffect(() => { API('/api/config').then(setLocal); }, []);
  async function save() {
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(local) });
    setCfg(local);
    onClose();
  }
  const keys = ['BACKEND_TYPE', 'BACKEND_URL', 'AEGISAI_MODEL', 'REA_BIN', 'GHIDRA_MCP_URL', 'CRAFT_BIN', 'sttUrl', 'ttsUrl'];
  return html`
    <div class="modal-backdrop" onClick=${onClose}>
      <div class="modal" onClick=${(e) => e.stopPropagation()}>
        <h2>Configuration</h2>
        ${keys.map((k) => html`<label>${k}<input value=${local[k] || ''} onInput=${(e) => setLocal({ ...local, [k]: e.target.value })} /></label>`)}
        <div class="modal-actions">
          <button onClick=${save}>Save</button>
          <button onClick=${onClose}>Close</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

render(html`<${App} />`, document.getElementById('app'));
