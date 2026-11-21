// src/counterfactual.js
// Counterfactual trace diagnosis: find which harness setting would have changed an outcome.
const obs = require('./observability');
const optimizer = require('./optimizer');

function diagnose(limit) {
  const runs = obs.listRuns(limit || 200);
  if (!runs.length) return { runs: 0, diagnoses: [] };
  const diagnoses = [];
  const failed = runs.filter((r) => r.ok !== 1);
  const ok = runs.filter((r) => r.ok === 1);
  const avg = (arr, f) => arr.length ? arr.reduce((a, r) => a + f(r), 0) / arr.length : 0;

  const failTools = avg(failed, (r) => r.tool_count || 0);
  const okTools = avg(ok, (r) => r.tool_count || 0);
  if (failTools > okTools + 2) diagnoses.push({ finding: 'failed runs use more tools', failed: +failTools.toFixed(1), ok: +okTools.toFixed(1), counterfactual: 'enable progressive tool discovery (8-16 tools)', param: 'progressiveTools', value: 12 });

  const failTokens = avg(failed, (r) => r.tokens || 0);
  const okTokens = avg(ok, (r) => r.tokens || 0);
  if (failTokens > okTokens * 1.2) diagnoses.push({ finding: 'failed runs consume more tokens', failed: Math.round(failTokens), ok: Math.round(okTokens), counterfactual: 'enable tool-output compression (1500 chars)', param: 'toolOutputCompression', value: 1500 });

  if (failed.length && !diagnoses.length) diagnoses.push({ finding: 'failures not explained by tool/token load', counterfactual: 'inspect failure attribution via /reliability', param: null, value: null });
  return { runs: runs.length, failures: failed.length, diagnoses };
}

function evolve() {
  const d = diagnose();
  const suggestions = d.diagnoses.filter((x) => x.param).map((x) => ({ param: x.param, value: x.value, reason: x.counterfactual }));
  return { diagnoses: d.diagnoses, applied: optimizer.apply(suggestions) };
}

module.exports = { diagnose, evolve };
