// src/decision_gates.js
// Semantic decision gates: cheap checks before expensive model work.
const GATES = [
  { id: 'empty', check: (s) => !!(s && String(s.input || '').trim()), fail: 'empty input' },
  { id: 'too_short', check: (s) => String(s.input || '').length >= 3, fail: 'input too short' },
  { id: 'repeat', check: (s) => !(s.history || []).includes(String(s.input || '')), fail: 'repeated identical request (doom loop)' },
  { id: 'known_fact', check: (s) => !(s.memory || []).some((m) => m.toLowerCase() === String(s.input || '').toLowerCase()), fail: 'already known' },
];

function evaluate(session) {
  const failed = [];
  for (const g of GATES) if (!g.check(session || {})) failed.push({ gate: g.id, reason: g.fail });
  return { proceed: failed.length === 0, failed, gates: GATES.length };
}

module.exports = { GATES, evaluate };
