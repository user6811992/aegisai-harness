// src/benchmarks_real.js
// Real-world coding benchmark task sets: polyglot + long-horizon.
const { runAgent } = require('./agent/run');

const POLYGLOT = [
  { id: 'js-fizzbuzz', lang: 'js', prompt: 'Write a JS function fizzbuzz(n) returning FizzBuzz string.', expected: 'function' },
  { id: 'py-merge', lang: 'py', prompt: 'Write a Python function merging two sorted lists.', expected: 'def' },
  { id: 'go-hello', lang: 'go', prompt: 'Write a Go program printing hello world.', expected: 'package main' },
  { id: 'rs-reverse', lang: 'rs', prompt: 'Write a Rust function reversing a string.', expected: 'fn' },
  { id: 'java-class', lang: 'java', prompt: 'Write a Java class with a main method.', expected: 'class' },
];
const LONG_HORIZON = [
  { id: 'lh-refactor', prompt: 'Plan and describe a refactor of a small codebase with tests.', expected: 'test' },
  { id: 'lh-bugfix', prompt: 'Investigate and propose a fix for a failing test suite.', expected: 'fix' },
  { id: 'lh-feature', prompt: 'Design and implement a small feature end to end.', expected: 'implement' },
];

function list(category) {
  if (category === 'polyglot') return POLYGLOT;
  if (category === 'long-horizon') return LONG_HORIZON;
  return POLYGLOT.concat(LONG_HORIZON);
}
async function run(category, opts) {
  opts = opts || {};
  const cases = (list(category) || []).slice(0, opts.limit || 5);
  const results = [];
  for (const c of cases) {
    const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: c.prompt }], projectRoot: opts.projectRoot || process.cwd(), autoApprove: true, onEvent: () => {} });
    const out = (r.final && r.final.final) || '';
    results.push({ id: c.id, lang: c.lang, pass: out.toLowerCase().includes(c.expected.toLowerCase()), output: out.slice(0, 200) });
  }
  return { category: category || 'all', total: results.length, passed: results.filter((r) => r.pass).length, results };
}

module.exports = { POLYGLOT, LONG_HORIZON, list, run };
