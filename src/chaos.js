// src/chaos.js
// Chaos testing: inject failing tools and stale state, grade agent recovery.
const FAULTS = {
  tool_fail: (tool) => ({ injected: true, type: 'tool_fail', tool, output: 'ERROR: injected failure' }),
  stale_state: (key) => ({ injected: true, type: 'stale_state', key, value: 'STALE' }),
  timeout: (tool) => ({ injected: true, type: 'timeout', tool, output: 'timeout' }),
  partial_output: (tool) => ({ injected: true, type: 'partial_output', tool, output: 'partial...' }),
};
function inject(kind, arg) {
  const f = FAULTS[kind];
  return f ? f(arg || 'default') : { injected: false, error: 'unknown fault' };
}
function grade(results) {
  const recovered = (results || []).filter((r) => r.recovered).length;
  return { total: (results || []).length, recovered, rate: results && results.length ? +(recovered / results.length).toFixed(2) : 0 };
}

module.exports = { FAULTS, inject, grade };
