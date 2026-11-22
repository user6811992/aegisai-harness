// src/token_dashboard.js
// Token usage dashboard data (deer-flow "Workspace UI").
const db = require('./storage/db');

function summary(limit) {
  let rows = [];
  try { rows = db.get().prepare('SELECT model, tool_count, tokens, duration_ms, ok, started FROM runs ORDER BY started DESC LIMIT ?').all(limit || 200); } catch (e) {}
  const byModel = {};
  for (const r of rows) {
    const m = r.model || 'unknown';
    if (!byModel[m]) byModel[m] = { model: m, runs: 0, tokens: 0, durationMs: 0, tools: 0, ok: 0 };
    byModel[m].runs += 1; byModel[m].tokens += r.tokens || 0; byModel[m].durationMs += r.duration_ms || 0; byModel[m].tools += r.tool_count || 0; if (r.ok === 1) byModel[m].ok += 1;
  }
  const models = Object.values(byModel).map((m) => ({ ...m, avgTokens: m.runs ? Math.round(m.tokens / m.runs) : 0, successRate: m.runs ? +(m.ok / m.runs * 100).toFixed(1) : 0 }));
  const total = { runs: rows.length, tokens: rows.reduce((a, r) => a + (r.tokens || 0), 0), durationMs: rows.reduce((a, r) => a + (r.duration_ms || 0), 0), tools: rows.reduce((a, r) => a + (r.tool_count || 0), 0) };
  return { total, models, recent: rows.slice(0, 20) };
}

module.exports = { summary };
