// src/teams.js
// Multi-agent teams: coordinator decomposes, specialists execute in parallel, coordinator synthesizes.
const db = require('./storage/db');
const { runAgent } = require('./agent/run');

function create(name, definition) {
  const def = Object.assign({ name, coordinator: {}, specialists: [] }, definition || {});
  try { db.get().prepare('INSERT OR REPLACE INTO teams (name, created, data) VALUES (?,?,?)').run(name, new Date().toISOString(), JSON.stringify(def)); } catch (e) {}
  return def;
}
function get(name) {
  try { const r = db.get().prepare('SELECT * FROM teams WHERE name = ?').get(name); return r ? JSON.parse(r.data || '{}') : null; } catch (e) { return null; }
}
function list() {
  try { return db.get().prepare('SELECT name, created FROM teams ORDER BY created DESC').all(); } catch (e) { return []; }
}

async function run(name, task, opts) {
  opts = opts || {};
  const def = get(name);
  if (!def) return { ok: false, error: 'no team: ' + name };
  const model = opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b';
  const specNames = def.specialists.map((s) => s.name).join(', ');
  const planPrompt = 'You are a coordinator. Decompose this task into subtasks for specialists: ' + specNames + '. Return a JSON array of {"specialist","task"} objects.\n\nTask: ' + task;
  let assignments = [];
  try {
    const pr = await runAgent({ model, messages: [{ role: 'user', content: planPrompt }], projectRoot: opts.projectRoot || process.cwd(), planMode: true, autoApprove: true, onEvent: () => {} });
    const text = (pr.final && pr.final.final) || '';
    const m = text.match(/\[[\s\S]*\]/);
    if (m) assignments = JSON.parse(m[0]);
  } catch (e) {}
  if (!assignments.length) assignments = def.specialists.map((s) => ({ specialist: s.name, task }));
  const results = await Promise.all(assignments.map(async (a) => {
    const spec = def.specialists.find((s) => s.name === a.specialist) || {};
    const r = await runAgent({
      model: spec.model || model,
      messages: [{ role: 'system', content: spec.systemPrompt || 'You are a specialist: ' + a.specialist }, { role: 'user', content: a.task }],
      projectRoot: opts.projectRoot || process.cwd(),
      autoApprove: true,
      allowedTools: spec.allowedTools,
      deniedTools: spec.deniedTools,
      onEvent: () => {},
    });
    return { specialist: a.specialist, task: a.task, output: (r.final && r.final.final) || '' };
  }));
  let final = '';
  try {
    const sr = await runAgent({ model, messages: [{ role: 'user', content: 'Synthesize these specialist results into one final answer for the task: ' + task + '\n\n' + results.map((r) => '[' + r.specialist + '] ' + r.output).join('\n') }], projectRoot: opts.projectRoot || process.cwd(), planMode: true, autoApprove: true, onEvent: () => {} });
    final = (sr.final && sr.final.final) || '';
  } catch (e) { final = results.map((r) => '[' + r.specialist + '] ' + r.output).join('\n'); }
  return { ok: true, team: name, assignments, results, final };
}

module.exports = { create, get, list, run };
