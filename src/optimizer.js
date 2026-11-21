// src/optimizer.js
// Harness optimizer: tune parameters from captured rollout trajectories.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const obs = require('./observability');

const CONFIG_PATH = () => path.join(DATA_DIR, 'harness-opt.json');

function analyze(limit) {
  const runs = obs.listRuns(limit || 200);
  if (!runs.length) return { runs: 0, suggestions: [] };
  const avgTokens = runs.reduce((a, r) => a + (r.tokens || 0), 0) / runs.length;
  const avgTools = runs.reduce((a, r) => a + (r.tool_count || 0), 0) / runs.length;
  const failures = runs.filter((r) => r.ok !== 1).length;
  const suggestions = [];
  if (avgTools > 8) suggestions.push({ param: 'toolBudget', value: 32, reason: 'avg ' + avgTools.toFixed(1) + ' tools per run; reduce schema load' });
  if (avgTokens > 8000) suggestions.push({ param: 'compactThreshold', value: 12, reason: 'avg ' + Math.round(avgTokens) + ' tokens; compact earlier' });
  if (failures / runs.length > 0.2) suggestions.push({ param: 'tokenBudgetTotal', value: 200000, reason: 'high failure rate; raise budget headroom' });
  return { runs: runs.length, avgTokens: Math.round(avgTokens), avgTools: +avgTools.toFixed(1), failures, suggestions };
}

function apply(suggestions) {
  const cfg = {};
  for (const s of suggestions || []) cfg[s.param] = s.value;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH(), JSON.stringify({ generated: new Date().toISOString(), config: cfg }, null, 2));
  return cfg;
}

function load() {
  const p = CONFIG_PATH();
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')).config || {}; } catch (e) { return {}; }
}

module.exports = { analyze, apply, load };
