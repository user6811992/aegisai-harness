// src/integrations/bidi.js
// WebDriver BiDi-first browser backend (alternative to CDP).
const BIDI_URL = process.env.BIDI_URL || 'ws://127.0.0.1:4444/session';

class BiDi {
  constructor(url) { this.url = url || BIDI_URL; this.id = 0; this.pending = new Map(); this.ws = null; }
  async connect() {
    if (this.ws) return;
    this.ws = new WebSocket(this.url);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
      } catch (err) {}
    };
  }
  async call(method, params) {
    if (!this.ws) await this.connect();
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('BiDi timeout')); } }, 15000);
    });
  }
  async newSession(caps) { const r = await this.call('session.new', { capabilities: caps || { alwaysMatch: { 'bidi:create': true } } }); this.sessionId = r.sessionId; return r; }
  async navigate(url) {
    const contexts = await this.call('browsingContext.getTree', {});
    const ctx = contexts.contexts && contexts.contexts[0];
    if (!ctx) return { ok: false, error: 'no browsing context' };
    await this.call('browsingContext.navigate', { context: ctx.context, url, wait: 'load' });
    return { ok: true, context: ctx.context };
  }
  async evaluate(expression) {
    const contexts = await this.call('browsingContext.getTree', {});
    const ctx = contexts.contexts && contexts.contexts[0];
    const r = await this.call('script.evaluate', { expression, target: { context: ctx.context }, awaitPromise: true, resultOwnership: 'none' });
    return r.result && r.result.value !== undefined ? r.result.value : r.result;
  }
}

module.exports = { BiDi, BIDI_URL };
