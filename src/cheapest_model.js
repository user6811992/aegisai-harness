// src/cheapest_model.js
// Cheapest model finder: pass your tests, then rank by estimated cost.
const { runAgent } = require('./agent/run');
const tokenizer = require('./tokenizer');

const DEFAULT_PRICES = { 'llama3.2:3b': 0, 'llama3.1:8b': 0, 'llama3.1:14b': 0 };

async function find(models, opts) {
  opts = opts || {};
  const tests = opts.tests || [{ prompt: 'Reply with the single word: OK', expected: 'ok' }];
  const prices = Object.assign({}, DEFAULT_PRICES, opts.prices || {});
  const results = [];
  for (const model of models) {
    let passed = 0;
    let tokens = 0;
    for (const t of tests) {
      try {
        const r = await runAgent({ model, messages: [{ role: 'user', content: t.prompt }], projectRoot: process.cwd(), autoApprove: true, onEvent: () => {} });
        const out = (r.final && r.final.final) || '';
        tokens += tokenizer.countTokens(out);
        if (!t.expected || out.toLowerCase().includes(t.expected.toLowerCase())) passed += 1;
      } catch (e) {}
    }
    const ok = passed === tests.length;
    results.push({ model, passed, total: tests.length, ok, tokens, estimatedCost: +(tokens * (prices[model] || 0)).toFixed(4) });
  }
  const passing = results.filter((r) => r.ok).sort((a, b) => a.estimatedCost - b.estimatedCost);
  return { results, cheapest: passing[0] || null, ranked: passing };
}

module.exports = { find, DEFAULT_PRICES };
