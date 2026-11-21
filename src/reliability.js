// src/reliability.js
// Harness reliability + failure attribution: separate task success from harness reliability.
const obs = require('./observability');

const CATEGORIES = ['tool_error', 'loop', 'budget', 'backend', 'approval', 'unknown'];

function attribute(run) {
  const final = (run.final || '').toLowerCase();
  if (final.includes('doom loop')) return 'loop';
  if (final.includes('budget') || final.includes('max iterations')) return 'budget';
  if (final.includes('error:') || final.includes('all models failed') || final.includes('circuit')) return 'backend';
  if (final.includes('approval denied') || final.includes('blocked')) return 'approval';
  if (final.includes('failed') || final.includes('error')) return 'tool_error';
  return 'unknown';
}

function report(limit) {
  const runs = obs.listRuns(limit || 100);
  const counts = {};
  for (const c of CATEGORIES) counts[c] = 0;
  for (const r of runs) {
    if (r.ok === 1) continue;
    counts[attribute(r)] += 1;
  }
  const failed = runs.filter((r) => r.ok !== 1).length;
  return {
    runs: runs.length,
    failures: failed,
    reliability: runs.length ? +((runs.length - failed) / runs.length * 100).toFixed(1) : 0,
    byCategory: counts,
  };
}

module.exports = { attribute, report, CATEGORIES };
