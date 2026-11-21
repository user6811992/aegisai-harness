// src/failure_cluster.js
// Cluster failures from traces and suggest prompt/tool/guardrail fixes.
const failureMod = require('./reliability');

function cluster(limit) {
  const report = failureMod.report(limit || 200);
  const byCategory = report.byCategory || {};
  const clusters = Object.entries(byCategory).filter(([, n]) => n > 0).map(([category, count]) => ({
    category, count,
    suggestion: suggestionFor(category),
  }));
  return { total: report.failures, reliability: report.reliability, clusters };
}
function suggestionFor(category) {
  const map = {
    tool_error: 'add tool-output validation + retry in the tool registry',
    loop: 'tighten doom-loop detection thresholds; add steer step',
    budget: 'raise tokenBudgetTotal or enable progressive tool discovery',
    backend: 'enable fallback models + circuit breaker tuning',
    approval: 'pre-approve low-risk tools via policy allowlist',
    unknown: 'inspect trace; add failure attribution category',
  };
  return map[category] || 'inspect trace';
}

module.exports = { cluster, suggestionFor };
