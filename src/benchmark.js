// src/benchmark.js
// Benchmark runner: run eval cases across multiple models, report pass rates.
const evalMod = require('./eval');
const profiles = require('./agents/profiles');

async function runBenchmark(opts) {
  opts = opts || {};
  const models = opts.models || [process.env.AEGISAI_MODEL || 'llama3.2:3b'];
  const cases = evalMod.listEvals();
  const report = { models: {}, cases: cases.length };
  for (const m of models) {
    let passed = 0;
    const results = [];
    for (const c of cases) {
      const profile = profiles.getProfile(c.agent || 'default');
      const { runAgent } = require('./agent/run');
      const res = await runAgent({
        model: m,
        messages: [{ role: 'system', content: profile.systemPrompt }, { role: 'user', content: c.prompt }],
        projectRoot: opts.projectRoot || process.cwd(),
        includeCoding: profile.includeCoding !== false,
        cleanRoom: profile.cleanRoom,
        allowedTools: profile.allowedTools,
        deniedTools: profile.deniedTools,
        sandbox: profile.sandbox,
        autoApprove: true,
      });
      const out = (res.final && res.final.final) || '';
      const expected = (c.expected || '').toLowerCase();
      const pass = expected ? out.toLowerCase().includes(expected) : true;
      if (pass) passed += 1;
      results.push({ id: c.id, name: c.name, pass });
    }
    report.models[m] = { total: cases.length, passed, failed: cases.length - passed, passRate: cases.length ? passed / cases.length : 0, results };
  }
  return report;
}

module.exports = { runBenchmark };
