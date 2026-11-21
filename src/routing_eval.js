// src/routing_eval.js
// Routing evaluation harness for multi-agent / multi-model systems.
const TASKS = [
  { id: 't1', text: 'list files in src', complexity: 'low', tools: true },
  { id: 't2', text: 'explain quantum entanglement in depth with math', complexity: 'high', tools: false },
  { id: 't3', text: 'write and test a parser with many tools', complexity: 'high', tools: true },
  { id: 't4', text: 'what time is it', complexity: 'low', tools: false },
];

const STRATEGIES = {
  round_robin: (t, i) => i % 2 === 0 ? 'fast' : 'capable',
  capability: (t) => t.complexity === 'high' ? 'capable' : 'fast',
  stage: (t) => t.tools ? 'capable' : 'fast',
  advisor: (t) => t.complexity === 'high' || t.tools ? 'capable' : 'fast',
};

function evaluate() {
  const out = {};
  for (const [name, fn] of Object.entries(STRATEGIES)) {
    const picks = TASKS.map((t, i) => ({ id: t.id, pick: fn(t, i), ideal: t.complexity === 'high' || t.tools ? 'capable' : 'fast' }));
    const correct = picks.filter((p) => p.pick === p.ideal).length;
    out[name] = { correct, total: picks.length, accuracy: +(correct / picks.length).toFixed(2), picks };
  }
  const best = Object.entries(out).sort((a, b) => b[1].accuracy - a[1].accuracy)[0];
  return { tasks: TASKS.length, strategies: out, best: best ? best[0] : null };
}

module.exports = { TASKS, STRATEGIES, evaluate };
