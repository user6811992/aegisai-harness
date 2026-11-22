// src/composable_api.js
// Composable agent APIs: 6-phase state machine with typed phases.
const PHASES = ['intake', 'plan', 'act', 'verify', 'review', 'deliver'];

function create() { return { phase: 'intake', history: [] }; }
function advance(api, to, evidence) {
  const from = api.phase;
  const i = PHASES.indexOf(to);
  if (i < 0 || i > PHASES.indexOf(from) + 1) return { ok: false, error: 'invalid phase transition ' + from + ' -> ' + to };
  api.phase = to;
  api.history.push({ from, to, evidence: evidence || '', at: new Date().toISOString() });
  return { ok: true, phase: to };
}
function status(api) { return { phase: api.phase, next: PHASES[PHASES.indexOf(api.phase) + 1] || null, history: api.history }; }

module.exports = { PHASES, create, advance, status };
