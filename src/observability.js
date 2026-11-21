// src/observability.js
// Capture every run: prompts, tool calls, results, tokens, timing → SQLite.
const db = require('./storage/db');

function captureRun(run) {
  const id = 'run_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const rec = {
    id,
    started: run.started || new Date().toISOString(),
    ended: new Date().toISOString(),
    model: run.model || '',
    prompt: (run.prompt || '').slice(0, 4000),
    final: (run.final || '').slice(0, 4000),
    toolCount: (run.toolLog || []).length,
    tools: (run.toolLog || []).map((t) => t.name),
    tokens: (run.tokenStats && run.tokenStats.total) || 0,
    durationMs: run.durationMs || 0,
    ok: run.ok !== false,
  };
  try {
    db.get().prepare('INSERT INTO runs (id, started, ended, model, prompt, final, tool_count, tools, tokens, duration_ms, ok) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(rec.id, rec.started, rec.ended, rec.model, rec.prompt, rec.final, rec.toolCount, JSON.stringify(rec.tools), rec.tokens, rec.durationMs, rec.ok ? 1 : 0);
  } catch (e) {}
  return rec;
}

function listRuns(limit) {
  try { return db.get().prepare('SELECT * FROM runs ORDER BY started DESC LIMIT ?').all(limit || 50); } catch (e) { return []; }
}

module.exports = { captureRun, listRuns };
