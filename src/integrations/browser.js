// src/integrations/browser.js
// Computer-use / browser-use via Chrome DevTools Protocol (CDP).
// Connects to a local Chrome started with --remote-debugging-port=9222.
const BASE = process.env.CDP_URL || 'http://127.0.0.1:9222';

function targets() {
  return fetch(BASE + '/json/list').then((r) => r.json()).catch(() => []);
}

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.ws = null;
  }
  async connect() {
    if (this.ws) return;
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.id && this.pending.has(m.id)) {
          const { resolve, reject } = this.pending.get(m.id);
          this.pending.delete(m.id);
          if (m.error) reject(new Error(JSON.stringify(m.error)));
          else resolve(m.result);
        }
      } catch (err) {}
    };
  }
  async call(method, params) {
    if (!this.ws) await this.connect();
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); } }, 15000);
    });
  }
  close() { if (this.ws) { this.ws.close(); this.ws = null; } }
}

async function attach() {
  const list = await targets();
  const page = list.find((t) => t.type === 'page');
  if (!page) return null;
  const c = new CDP(page.webSocketDebuggerUrl);
  await c.connect();
  return c;
}

async function evaluate(c, expression) {
  const r = await c.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result && r.result.value !== undefined ? r.result.value : (r.result && r.result.description) || '';
}

const TOOLS = [
  { type: 'function', function: { name: 'browser_navigate', description: 'Navigate the browser to a URL.', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
  { type: 'function', function: { name: 'browser_snapshot', description: 'Return a compact accessibility tree snapshot of the current page.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'browser_click', description: 'Click an element by CSS selector.', parameters: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } } },
  { type: 'function', function: { name: 'browser_type', description: 'Type text into an element by CSS selector.', parameters: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } }, required: ['selector', 'text'] } } },
  { type: 'function', function: { name: 'browser_eval', description: 'Evaluate JavaScript in the page.', parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] } } },
];

async function handle(name, args, cdp) {
  const c = cdp || await attach();
  if (!c) return { ok: false, output: 'no browser page target (start Chrome with --remote-debugging-port=9222)' };
  try {
    if (name === 'browser_navigate') {
      await c.call('Page.navigate', { url: args.url });
      return { ok: true, output: 'navigating to ' + args.url };
    }
    if (name === 'browser_snapshot') {
      const r = await c.call('Accessibility.getFullAXTree');
      const nodes = (r.nodes || []).filter((n) => n.role && n.name).slice(0, 120);
      return { ok: true, output: nodes.map((n) => n.role.value + ': ' + n.name.value).join('\n') };
    }
    if (name === 'browser_click') {
      const out = await evaluate(c, `document.querySelector(${JSON.stringify(args.selector)})?.click(); 'clicked'`);
      return { ok: true, output: String(out) };
    }
    if (name === 'browser_type') {
      const out = await evaluate(c, `(()=>{const e=document.querySelector(${JSON.stringify(args.selector)});if(!e)return 'no element';e.value=${JSON.stringify(args.text)};e.dispatchEvent(new Event('input',{bubbles:true}));return 'typed'})()`);
      return { ok: true, output: String(out) };
    }
    if (name === 'browser_eval') {
      const out = await evaluate(c, args.expression);
      return { ok: true, output: typeof out === 'string' ? out : JSON.stringify(out) };
    }
    return { ok: false, output: 'unknown browser tool: ' + name };
  } catch (e) { return { ok: false, output: String(e.message || e) }; }
}

module.exports = { CDP, targets, attach, evaluate, TOOLS, handle, BASE };
