// src/acp.js
// Minimal Agent Client Protocol (ACP) adapter: JSON-RPC over stdio.
const { runAgent } = require('./agent/run');

function createServer(opts) {
  opts = opts || {};
  const sessions = new Map();
  const methods = {
    initialize: async (params) => ({ protocolVersion: 1, capabilities: { prompt: true, cancel: true }, agentInfo: { name: 'aegisai-harness', version: '0.30.0' } }),
    'session/new': async (params) => {
      const id = 'acp_' + Date.now();
      sessions.set(id, { cwd: (params && params.cwd) || process.cwd(), messages: [] });
      return { sessionId: id };
    },
    'session/prompt': async (params) => {
      const s = sessions.get(params.sessionId);
      if (!s) throw new Error('unknown session');
      const text = ((params.prompt || []).find((b) => b.type === 'text') || {}).text || '';
      s.messages.push({ role: 'user', content: text });
      const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: s.messages, projectRoot: s.cwd, autoApprove: true, onEvent: () => {} });
      const final = (r.final && r.final.final) || '';
      s.messages.push({ role: 'assistant', content: final });
      return { stopReason: 'end_turn', content: [{ type: 'text', text: final }] };
    },
    'session/cancel': async (params) => { sessions.delete(params.sessionId); return { ok: true }; },
  };
  async function handle(msg) {
    const fn = methods[msg.method];
    if (!fn) return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'method not found' } };
    try { const result = await fn(msg.params); return { jsonrpc: '2.0', id: msg.id, result }; }
    catch (e) { return { jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: String(e.message || e) } }; }
  }
  return { handle, methods, sessions };
}

module.exports = { createServer };
