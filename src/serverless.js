// src/serverless.js
// "An agent is a function" — define durable, callable agent functions with session state.
const db = require('./storage/db');
const { runAgent } = require('./agent/run');

function defineAgent(name, fn, opts) {
  opts = opts || {};
  const record = { name, model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', created: new Date().toISOString() };
  try { db.get().prepare('INSERT OR REPLACE INTO serverless_agents (name, created, data) VALUES (?,?,?)').run(name, record.created, JSON.stringify(record)); } catch (e) {}
  return {
    name,
    async invoke(input, ctx) {
      const prompt = typeof fn === 'function' ? await fn(input, ctx || {}) : String(fn || input);
      const r = await runAgent({ model: record.model, messages: [{ role: 'user', content: prompt }], projectRoot: (ctx && ctx.cwd) || process.cwd(), autoApprove: true, onEvent: () => {} });
      return { ok: true, agent: name, output: (r.final && r.final.final) || '', toolLog: r.toolLog || [] };
    },
  };
}
function list() {
  try { return db.get().prepare('SELECT name, created FROM serverless_agents ORDER BY created DESC').all(); } catch (e) { return []; }
}

module.exports = { defineAgent, list };
