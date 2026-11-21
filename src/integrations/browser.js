// src/integrations/browser.js
// Computer-use / browser-use via Chrome DevTools Protocol (CDP).
// Connects to a local Chrome started with --remote-debugging-port=9222.
const BASE = process.env.CDP_URL || 'http://127.0.0.1:9222';
const lastAX = new Map(); // session -> array of { ref, role, name }

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
  { type: 'function', function: { name: 'browser_ax', description: 'Accessibility-first snapshot with stable refs and optional diff.', parameters: { type: 'object', properties: { diff: { type: 'boolean' }, limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'browser_click_ref', description: 'Click an element by stable AX ref.', parameters: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'] } } },
  { type: 'function', function: { name: 'browser_type_ref', description: 'Type into an element by stable AX ref.', parameters: { type: 'object', properties: { ref: { type: 'string' }, text: { type: 'string' } }, required: ['ref', 'text'] } } },
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
    if (name === 'browser_ax') {
      const r = await c.call('Accessibility.getFullAXTree');
      const nodes = (r.nodes || []).filter((n) => n.role && n.name && n.backendDOMNodeId).slice(0, args.limit || 120);
      const ax = nodes.map((n, i) => ({ ref: 'r' + i, role: n.role.value, name: n.name.value, domId: n.backendDOMNodeId }));
      // bind refs into DOM elements for stable subsequent actions
      for (const n of ax) {
        try {
          const obj = await c.call('DOM.resolveNode', { backendNodeId: n.domId });
          if (obj && obj.object) await c.call('Runtime.callFunctionOn', { objectId: obj.object.objectId, functionDeclaration: 'function(){this.setAttribute("data-aegisai-ref", arguments[0]);}', arguments: [{ value: n.ref }] });
        } catch (e) {}
      }
      const key = c.wsUrl || 'default';
      const prev = lastAX.get(key) || [];
      const prevNames = new Set(prev.map((p) => p.role + ':' + p.name));
      const curNames = new Set(ax.map((p) => p.role + ':' + p.name));
      const added = ax.filter((p) => !prevNames.has(p.role + ':' + p.name));
      const removed = prev.filter((p) => !curNames.has(p.role + ':' + p.name));
      lastAX.set(key, ax);
      const lines = args.diff
        ? added.map((p) => '+ ' + p.ref + ' ' + p.role + ': ' + p.name).concat(removed.map((p) => '- ' + p.role + ': ' + p.name))
        : ax.map((p) => p.ref + ' ' + p.role + ': ' + p.name);
      return { ok: true, output: lines.join('\n') || '(no AX changes)', ax };
    }
    if (name === 'browser_click_ref' || name === 'browser_type_ref') {
      const ref = String(args.ref || '');
      if (!/^r\d+$/.test(ref)) return { ok: false, output: 'invalid ref' };
      const sel = '[data-aegisai-ref="' + ref + '"]';
      const js = name === 'browser_click_ref'
        ? `document.querySelector(${JSON.stringify(sel)})?.click(); 'clicked'`
        : `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'no element';e.value=${JSON.stringify(args.text)};e.dispatchEvent(new Event('input',{bubbles:true}));return 'typed'})()`;
      const out = await evaluate(c, js);
      return { ok: String(out) !== 'no element', output: String(out) };
    }
    if (name === 'browser_eval') {
      const out = await evaluate(c, args.expression);
      return { ok: true, output: typeof out === 'string' ? out : JSON.stringify(out) };
    }
    return { ok: false, output: 'unknown browser tool: ' + name };
  } catch (e) { return { ok: false, output: String(e.message || e) }; }
}

module.exports = { CDP, targets, attach, evaluate, TOOLS, handle, BASE };
