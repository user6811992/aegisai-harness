// src/pairing.js
// Model × harness pairing evals: rankings don't transfer across models.
const evalMod = require('./eval');
const { runAgent } = require('./agent/run');
const profiles = require('./agents/profiles');

const CONFIGS = {
  default: {},
  lean: { progressiveTools: 8, toolOutputCompression: 1500 },
  strict: { guardrails: { input: true, output: {} }, verifyWork: true },
  context: { contextFiles: true, planMode: false },
};

async function runPairing(models, configNames, opts) {
  opts = opts || {};
  models = models && models.length ? models : [process.env.AEGISAI_MODEL || 'llama3.2:3b'];
  configNames = configNames && configNames.length ? configNames : Object.keys(CONFIGS);
  const cases = (evalMod.listEvals() || []).slice(0, opts.limit || 5);
  const matrix = {};
  for (const model of models) {
    matrix[model] = {};
    for (const cn of configNames) {
      const cfg = CONFIGS[cn];
      if (!cfg) continue;
      let passed = 0;
      for (const c of cases) {
        const profile = profiles.getProfile(c.agent || 'default');
        const r = await runAgent(Object.assign({
          model,
          messages: [{ role: 'system', content: profile.systemPrompt }, { role: 'user', content: c.prompt }],
          projectRoot: opts.projectRoot || process.cwd(),
          autoApprove: true,
          onEvent: () => {},
        }, cfg));
        const out = (r.final && r.final.final) || '';
        const expected = (c.expected || '').toLowerCase();
        if (!expected || out.toLowerCase().includes(expected)) passed += 1;
      }
      matrix[model][cn] = { passed, total: cases.length, rate: cases.length ? +(passed / cases.length).toFixed(2) : 0 };
    }
  }
  return { models, configs: configNames, cases: cases.length, matrix };
}

module.exports = { CONFIGS, runPairing };
