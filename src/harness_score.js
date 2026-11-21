// src/harness_score.js
// Score the harness from captured runs (seconds, not minutes).
const obs = require('./observability');

function score(limit) {
  const runs = obs.listRuns(limit || 100);
  if (runs.length === 0) return { runs: 0, score: 0, note: 'no runs captured' };
  const ok = runs.filter((r) => r.ok === 1).length;
  const avgTokens = runs.reduce((a, r) => a + (r.tokens || 0), 0) / runs.length;
  const avgDuration = runs.reduce((a, r) => a + (r.duration_ms || 0), 0) / runs.length;
  const avgTools = runs.reduce((a, r) => a + (r.tool_count || 0), 0) / runs.length;
  const successRate = ok / runs.length;
  const tokenEfficiency = Math.max(0, 1 - avgTokens / 20000);
  const speed = Math.max(0, 1 - avgDuration / 60000);
  const toolEfficiency = Math.max(0, 1 - avgTools / 20);
  const total = successRate * 0.5 + tokenEfficiency * 0.2 + speed * 0.2 + toolEfficiency * 0.1;
  return {
    runs: runs.length,
    successRate: +successRate.toFixed(3),
    avgTokens: Math.round(avgTokens),
    avgDurationMs: Math.round(avgDuration),
    avgTools: +avgTools.toFixed(1),
    score: +(total * 100).toFixed(1),
  };
}

module.exports = { score };
